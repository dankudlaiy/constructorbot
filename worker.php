<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';
use Dotenv\Dotenv;

Dotenv::createImmutable(dirname(__DIR__))->load();

function escapeFilterPath(string $path): string {
    $p = str_replace('\\', '/', $path);
    $p = preg_replace('#^([A-Za-z]):/#', '$1\\:/' , $p);
    $p = str_replace("'", "\\'", $p);
    return $p;
}

function ensurePathUnder(string $candidate, string $baseDir): string {
    $realBase = realpath($baseDir) ?: $baseDir;
    $realCand = realpath($candidate);
    if ($realCand === false || strpos($realCand, $realBase) !== 0) {
        throw new Exception('Invalid path');
    }
    return $realCand;
}

function resolveBinary(array $candidates, string $name): string {
    foreach ($candidates as $bin) {
        if ($bin === '') { continue; }
        $testCmd = sprintf('"%s" -version 2>&1', $bin);
        $out = [];
        $code = 0;
        @exec($testCmd, $out, $code);
        if ($code === 0) {
            error_log("[worker] using $name bin: " . $bin);
            return $bin;
        }
    }
    return $candidates[0] ?? $name;
}

$queueFile  = __DIR__ . '/queue.json';
$outputsDir = __DIR__ . '/outputs';
$logFile    = __DIR__ . '/logs/worker.log';

if (!is_dir($outputsDir)) @mkdir($outputsDir, 0755, true);
if (!is_dir(__DIR__ . '/logs')) @mkdir(__DIR__ . '/logs', 0755, true);

function wlog(string $msg): void {
    global $logFile;
    $line = '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL;
    echo $line;
    @file_put_contents($logFile, $line, FILE_APPEND | LOCK_EX);
}

// Определяем пути к FFmpeg
if (PHP_OS_FAMILY === 'Windows') {
    $localAppData = getenv('LOCALAPPDATA') ?: 'C:\Users\\' . getenv('USERNAME') . '\AppData\Local';
    $wingetFfmpeg = $localAppData . '\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1.1-full_build\bin\ffmpeg.exe';
    $wingetFfprobe = $localAppData . '\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1.1-full_build\bin\ffprobe.exe';
    
    $ffmpegPath = resolveBinary([
        'ffmpeg',
        is_file($wingetFfmpeg) ? $wingetFfmpeg : '',
        $_ENV['FFMPEG_PATH'] ?? '',
    ], 'ffmpeg');

    $ffprobePath = resolveBinary([
        'ffprobe',
        is_file($wingetFfprobe) ? $wingetFfprobe : '',
        $_ENV['FFPROBE_PATH'] ?? '',
    ], 'ffprobe');
} else {
    $ffmpegPath = resolveBinary([
        'ffmpeg',
        '/usr/bin/ffmpeg',
        '/usr/local/bin/ffmpeg',
        $_ENV['FFMPEG_PATH'] ?? '',
    ], 'ffmpeg');

    $ffprobePath = resolveBinary([
        'ffprobe',
        '/usr/bin/ffprobe',
        '/usr/local/bin/ffprobe',
        $_ENV['FFPROBE_PATH'] ?? '',
    ], 'ffprobe');
}

wlog('Worker started. Checking queue every 2 seconds...');

while (true) {
    if (!file_exists($queueFile)) {
        sleep(2);
        continue;
    }

    // Блокируем файл для безопасного чтения/записи
    // На Windows используем неблокирующую блокировку с повторными попытками
    $maxAttempts = 10;
    $attempt = 0;
    $fp = null;
    
    while ($attempt < $maxAttempts) {
        $fp = @fopen($queueFile, 'r+');
        if (!$fp) {
            sleep(1);
            $attempt++;
            continue;
        }
        
        // Пытаемся заблокировать файл (неблокирующий режим)
        if (@flock($fp, LOCK_EX | LOCK_NB)) {
            break; // Успешно заблокировали
        }
        
        fclose($fp);
        $fp = null;
        usleep(500000); // 0.5 секунды
        $attempt++;
    }
    
    if (!$fp) {
        sleep(1);
        continue; // Не удалось открыть файл
    }
    
    // Читаем через открытый дескриптор
    $queueContent = '';
    rewind($fp);
    while (!feof($fp)) {
        $chunk = fread($fp, 8192);
        if ($chunk === false) {
            break;
        }
        $queueContent .= $chunk;
    }
    $queue = json_decode($queueContent, true);
    if (!is_array($queue)) {
        $queue = [];
    }
    
    // Ищем задачу в очереди со статусом 'queued'
    $taskIndex = null;
    $task = null;
    foreach ($queue as $index => $t) {
        if ($t['status'] === 'queued') {
            $task = $t;
            $taskIndex = $index;
            break;
        }
    }

    if ($task === null) {
        flock($fp, LOCK_UN);
        fclose($fp);
        sleep(2);
        continue;
    }

    // Обновляем статус на 'processing'
    $queue[$taskIndex]['status'] = 'processing';
    $queue[$taskIndex]['started_at'] = time();
    
    // Записываем обновленную очередь через открытый дескриптор
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT));
    fflush($fp);
    flock($fp, LOCK_UN);
    fclose($fp);

    wlog("Processing task: {$task['id']} video={$task['video_path']} promo={$task['promo_text']}");

    try {
        $videoPath = $task['video_path'];
        $promoText = $task['promo_text'];
        $textSize = (int)($task['text_size'] ?? 45);
        $skewAngle = (float)($task['skew_angle'] ?? 0);
        $textAlignment = $task['text_alignment'] ?? 'center';
        $textColor = $task['text_color'] ?? '#000000';
        $positionX = (int)($task['position_x'] ?? 0);
        $positionY = (int)($task['position_y'] ?? 0);
        $promoStart = (float)($task['promo_start'] ?? 0);
        $promoEnd = (float)($task['promo_end'] ?? 0);

        // Обрабатываем путь к видео (поддержка изображений)
        $ext = strtolower(pathinfo(parse_url($videoPath, PHP_URL_PATH) ?? '', PATHINFO_EXTENSION));
        $isImageExt = in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp'], true);
        if ($isImageExt) {
            $baseName = pathinfo(parse_url($videoPath, PHP_URL_PATH) ?? '', PATHINFO_FILENAME);
            if ($baseName) {
                $maybeVideo = '/uploads/videos/' . $baseName . '.mp4';
                $videoPath = $maybeVideo;
            }
        }

        $uploadsDir = __DIR__ . '/uploads/videos';
        $fullVideoPath = __DIR__ . $videoPath;
        $fullVideoPath = ensurePathUnder($fullVideoPath, $uploadsDir);

        if (!is_file($fullVideoPath)) {
            throw new Exception('Video file not found: ' . $fullVideoPath);
        }

        $videoExt = strtolower(pathinfo($fullVideoPath, PATHINFO_EXTENSION));
        $allowedVideoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
        if (!in_array($videoExt, $allowedVideoExtensions, true)) {
            throw new Exception('Invalid video file type');
        }

        // Получаем размер видео
        $probeCmd = sprintf('"%s" -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "%s" 2>&1', $ffprobePath, $fullVideoPath);
        $probeCmd = str_replace('\"', '"', $probeCmd);
        $probeOut = [];
        $probeCode = 0;
        @exec($probeCmd, $probeOut, $probeCode);
        if ($probeCode === 0 && !empty($probeOut)) {
            $dims = trim($probeOut[0]);
            if (preg_match('/^(\d+)x(\d+)$/', $dims, $m)) {
                $videoW = (int)$m[1];
                $videoH = (int)$m[2];
            } else {
                $videoW = 1000;
                $videoH = 1000;
            }
        } else {
            $videoW = 1000;
            $videoH = 1000;
        }

        $centerX = $positionX;
        $centerY = $positionY;

        // Применяем масштабирование шрифта
        $fontSize = max(10, (int)$textSize);
        $textLength = mb_strlen($promoText, 'UTF-8');
        if ($textLength > 6) {
            $fontSize = $fontSize - 2 * ($textLength - 6);
            $fontSize = max(10, $fontSize);
        }

        $hex = ltrim((string)$textColor, '#');
        if (!preg_match('/^[0-9A-Fa-f]{6}$/', $hex)) { $hex = '000000'; }
        $fontColor = '0x' . $hex;

        // Находим шрифт
        $fontFile = $_ENV['DRAW_FONT_FILE'] ?? '';
        if ($fontFile && !is_file($fontFile) && !preg_match('/^[A-Za-z]:/', $fontFile) && !preg_match('/^\//', $fontFile)) {
            $fontFile = dirname(__DIR__) . DIRECTORY_SEPARATOR . $fontFile;
        }

        if ($fontFile === '' || !is_file($fontFile)) {
            $os = PHP_OS_FAMILY;
            if ($os === 'Windows') {
                $candidates = [
                    dirname(__DIR__) . DIRECTORY_SEPARATOR . 'Inter-BlackItalic.ttf',
                    'C:\\Windows\\Fonts\\Inter-BlackItalic.ttf',
                    'C:\\Windows\\Fonts\\Inter-ExtraBoldItalic.ttf',
                    'C:\\Windows\\Fonts\\Inter-Black.ttf',
                    'C:\\Windows\\Fonts\\Inter-ExtraBold.ttf',
                ];
            } elseif ($os === 'Darwin') {
                $candidates = [
                    '/Library/Fonts/Inter Black Italic.ttf',
                    '/Library/Fonts/Inter ExtraBold Italic.ttf',
                    '/Library/Fonts/Inter Black.ttf',
                    '/Library/Fonts/Inter ExtraBold.ttf',
                ];
            } else {
                $candidates = [
                    '/usr/share/fonts/truetype/inter/Inter-BlackItalic.ttf',
                    '/usr/share/fonts/truetype/inter/Inter-ExtraBoldItalic.ttf',
                    '/usr/share/fonts/truetype/inter/Inter-Black.ttf',
                    '/usr/share/fonts/truetype/inter/Inter-ExtraBold.ttf',
                ];
            }
            foreach ($candidates as $cand) {
                if (is_file($cand)) { $fontFile = $cand; break; }
            }
        }

        $fontNamePart = ":font='Inter'";
        $fontFilePart = '';
        if ($fontFile && is_file($fontFile)) {
            $fontFilePart = ":fontfile='" . escapeFilterPath($fontFile) . "'";
        }

        // Создаем временный файл для текста
        $tmpDir = sys_get_temp_dir();
        $textFile = tempnam($tmpDir, 'promo_txt_');
        if ($textFile === false) {
            throw new Exception('Failed to create temp text file');
        }
        file_put_contents($textFile, $promoText);
        $textFileEsc = escapeFilterPath($textFile);

        // Рассчитываем позицию текста
        $halfBoxW = 225;
        $cxStr = number_format($centerX, 2, '.', '');
        $cyStr = number_format($centerY, 2, '.', '');

        if ($textAlignment === 'left') {
            $xExpr = '(' . $cxStr . ') - ' . $halfBoxW;
        } elseif ($textAlignment === 'right') {
            $xExpr = '(' . $cxStr . ') + ' . $halfBoxW . ' - text_w';
        } else {
            $xExpr = '(' . $cxStr . ') - (text_w/2)';
        }
        $yExpr = '(' . $cyStr . ') - (text_h/2)';

        // Временное условие отображения
        $timeCondition = '';
        if ($promoStart > 0 || $promoEnd > 0) {
            if ($promoStart > 0 && $promoEnd > 0) {
                $timeCondition = ":enable='between(t," . $promoStart . "," . $promoEnd . ")'";
            } elseif ($promoStart > 0) {
                $timeCondition = ":enable='gte(t," . $promoStart . ")'";
            } elseif ($promoEnd > 0) {
                $timeCondition = ":enable='lte(t," . $promoEnd . ")'";
            }
        }

        $filter = "drawtext=textfile='" . $textFileEsc . "':fontsize=" . $fontSize . ":fontcolor=" . $fontColor . $fontNamePart . $fontFilePart . ":x=" . $xExpr . ":y=" . $yExpr . ":reload=0" . $timeCondition;

        $outputFile = $task['output_file'];
        
        // Запускаем ffmpeg
        $cmd = sprintf('"%s" -y -i "%s" -vf "%s,format=yuv420p" -c:a copy -movflags +faststart "%s" 2>&1',
            $ffmpegPath,
            $fullVideoPath,
            $filter,
            $outputFile
        );
        $cmd = str_replace('\"', '"', $cmd);
        
        wlog('[ffmpeg cmd] ' . $cmd);
        
        $output = [];
        $ret = 0;
        @exec($cmd, $output, $ret);

        @unlink($textFile);

        if ($ret !== 0 || !is_file($outputFile)) {
            throw new Exception('FFmpeg processing failed: ' . implode("\n", $output));
        }

        // Обновляем статус задачи на 'completed'
        $fp = fopen($queueFile, 'c+');
        if ($fp && @flock($fp, LOCK_EX)) {
            // Читаем через открытый дескриптор
            $queueContent = '';
            rewind($fp);
            while (!feof($fp)) {
                $queueContent .= fread($fp, 8192);
            }
            $queue = json_decode($queueContent, true) ?: [];
            foreach ($queue as $index => $t) {
                if ($t['id'] === $task['id']) {
                    $queue[$index]['status'] = 'completed';
                    $queue[$index]['completed_at'] = time();
                    break;
                }
            }
            // Записываем обновленную очередь
            rewind($fp);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
        }
        if ($fp) {
            fclose($fp);
        }

        wlog("Task {$task['id']} completed successfully");

    } catch (Exception $e) {
        wlog('[ERROR] Task ' . $task['id'] . ': ' . $e->getMessage());
        
        // Обновляем статус задачи на 'failed'
        $fp = fopen($queueFile, 'c+');
        if ($fp && @flock($fp, LOCK_EX)) {
            // Читаем через открытый дескриптор
            $queueContent = '';
            rewind($fp);
            while (!feof($fp)) {
                $queueContent .= fread($fp, 8192);
            }
            $queue = json_decode($queueContent, true) ?: [];
            foreach ($queue as $index => $t) {
                if ($t['id'] === $task['id']) {
                    $queue[$index]['status'] = 'failed';
                    $queue[$index]['completed_at'] = time();
                    $queue[$index]['error'] = $e->getMessage();
                    break;
                }
            }
            // Записываем обновленную очередь
            rewind($fp);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
        }
        if ($fp) {
            fclose($fp);
        }

        wlog("Task {$task['id']} failed: " . $e->getMessage());
    }

    sleep(1);
}



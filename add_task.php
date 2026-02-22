<?php
declare(strict_types=1);

header('Content-Type: application/json');

$logFile = __DIR__ . '/logs/app.log';
function alog(string $msg): void {
    global $logFile;
    @file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . '] [add_task] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
}

$queueFile = __DIR__ . '/queue.json';
$outputsDir = __DIR__ . '/outputs';

// Создаем директорию outputs если её нет
if (!is_dir($outputsDir)) {
    @mkdir($outputsDir, 0755, true);
}

// Инициализируем очередь если её нет
if (!file_exists($queueFile)) {
    file_put_contents($queueFile, json_encode([], JSON_PRETTY_PRINT));
}

$videoPath = $_POST['video_path'] ?? '';
$promoText = $_POST['promo_text'] ?? '';
$textSize = (int)($_POST['text_size'] ?? 45);
$skewAngle = (float)($_POST['skew_angle'] ?? 0);
$textAlignment = $_POST['text_alignment'] ?? 'center';
$textColor = $_POST['text_color'] ?? '#000000';
$positionX = (int)($_POST['position_x'] ?? 0);
$positionY = (int)($_POST['position_y'] ?? 0);
$promoStart = (float)($_POST['promo_start'] ?? 0);
$promoEnd = (float)($_POST['promo_end'] ?? 0);

alog("Request: video_path=$videoPath promo=$promoText");

if ($videoPath === '' || $promoText === '') {
    alog("ERROR: Missing required parameters");
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing required parameters'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$fullPath = __DIR__ . $videoPath;
if (!is_file($fullPath)) {
    alog("ERROR: Video file not found: $fullPath");
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Video file not found: ' . $videoPath], JSON_UNESCAPED_UNICODE);
    exit;
}

// Генерируем уникальный ID задачи
$taskId = uniqid('task_', true);
$outputFile = $outputsDir . '/' . $taskId . '.mp4';

// Создаем задачу
$task = [
    'id' => $taskId,
    'video_path' => $videoPath,
    'promo_text' => $promoText,
    'text_size' => $textSize,
    'skew_angle' => $skewAngle,
    'text_alignment' => $textAlignment,
    'text_color' => $textColor,
    'position_x' => $positionX,
    'position_y' => $positionY,
    'promo_start' => $promoStart,
    'promo_end' => $promoEnd,
    'output_file' => $outputFile,
    'status' => 'queued',
    'created_at' => time(),
    'started_at' => null,
    'completed_at' => null,
    'error' => null
];

// Загружаем очередь с блокировкой файла
// На Windows используем более надежный способ с блокировкой чтения/записи
$maxAttempts = 10;
$attempt = 0;
$saved = false;

while ($attempt < $maxAttempts && !$saved) {
    $fp = @fopen($queueFile, 'c+');
    if ($fp) {
        if (@flock($fp, LOCK_EX)) {
            // Читаем очередь через открытый дескриптор
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
            
            // Добавляем задачу
            $queue[] = $task;
            
            // Записываем обновленную очередь через дескриптор
            rewind($fp);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
            $saved = true;
        }
        fclose($fp);
    }
    if (!$saved) {
        usleep(500000); // 0.5 секунды
        $attempt++;
    }
}

// Если не удалось сохранить с блокировкой, пробуем без блокировки (fallback)
if (!$saved) {
    $queue = json_decode(@file_get_contents($queueFile), true) ?: [];
    $queue[] = $task;
    @file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT), LOCK_EX);
}

alog("Task queued: $taskId");
echo json_encode([
    'success' => true,
    'task_id' => $taskId,
    'status' => 'queued'
], JSON_UNESCAPED_UNICODE);



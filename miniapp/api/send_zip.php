<?php
/**
 * Send ZIP archive to Telegram chat
 *
 * Receives banners (base64) and video metadata from the frontend,
 * creates a ZIP archive, and sends it as a document to the user's Telegram chat.
 *
 * ZIP naming: {promo}_{language}_{currency}_{directions}.zip
 */

ini_set('display_errors', '0');
ini_set('html_errors', '0');
error_reporting(E_ALL);
ini_set('max_execution_time', '300');
ini_set('memory_limit', '256M');

header('Content-Type: application/json');

$logFile = dirname(__DIR__, 2) . '/logs/app.log';
function zlog(string $msg): void {
    global $logFile;
    @file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . '] [send_zip] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
}

set_error_handler(function($errno, $errstr, $errfile, $errline) {
    zlog("PHP Error [$errno]: $errstr in $errfile:$errline");
    return true;
});

try {
    require __DIR__ . '/telegram_auth.php';
    require __DIR__ . '/../bot/bot_helpers.php';
} catch (\Throwable $e) {
    zlog("FATAL: Failed to load dependencies: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);
if (!$input) {
    http_response_code(400);
    echo json_encode(['error' => 'Invalid JSON']);
    exit;
}

$initData   = $input['initData'] ?? '';
$brand      = $input['brand'] ?? null;
$banners    = $input['banners'] ?? [];
$videos     = $input['videos'] ?? [];
$promoText  = $input['promo_text'] ?? '';
$directions = $input['directions'] ?? [];
$language   = $input['language'] ?? '';
$currency   = $input['currency'] ?? '';

if (!$initData) {
    http_response_code(400);
    echo json_encode(['error' => 'initData is required']);
    exit;
}

if (empty($banners) && empty($videos)) {
    http_response_code(400);
    echo json_encode(['error' => 'No banners or videos to download']);
    exit;
}

// Validate auth
zlog("ZIP request: brand=$brand, banners=" . count($banners) . ", videos=" . count($videos) . ", promo=$promoText");
$user = validateInitData($initData, $brand);
if ($user === false) {
    zlog("ERROR: Invalid initData");
    http_response_code(401);
    echo json_encode(['error' => 'Invalid initData']);
    exit;
}

$chatId = $user['id'] ?? null;
if (!$chatId) {
    zlog("ERROR: No chat_id");
    http_response_code(400);
    echo json_encode(['error' => 'Could not determine chat_id']);
    exit;
}

zlog("User validated: chatId=$chatId");

// Send typing action
sendChatAction($chatId, 'upload_document', $brand);

// Create temp directory for this ZIP
$projectRoot = dirname(__DIR__, 2);
$tmpDir = $projectRoot . '/outputs/zip_' . uniqid();
if (!mkdir($tmpDir, 0755, true)) {
    zlog("ERROR: Could not create temp dir: $tmpDir");
    http_response_code(500);
    echo json_encode(['error' => 'Server error: could not create temp directory']);
    exit;
}

$filesToZip = [];
$errors = [];

// --- Process banners (base64 → image files) ---
foreach ($banners as $i => $banner) {
    $base64 = $banner['base64'] ?? '';
    $name = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $banner['template_name'] ?? "banner_$i");

    if (!$base64) {
        $errors[] = "Banner $i: empty base64";
        continue;
    }

    // Strip data:image/...;base64, prefix if present
    if (strpos($base64, 'base64,') !== false) {
        $base64 = explode('base64,', $base64)[1];
    }

    $binaryData = base64_decode($base64);
    if ($binaryData === false) {
        $errors[] = "Banner $i: invalid base64";
        continue;
    }

    $ext = 'jpg';
    // Detect PNG from binary header
    if (substr($binaryData, 0, 4) === "\x89PNG") {
        $ext = 'png';
    }

    $filename = "{$name}.{$ext}";
    $filepath = $tmpDir . '/' . $filename;
    file_put_contents($filepath, $binaryData);
    $filesToZip[] = ['path' => $filepath, 'name' => $filename];
    zlog("Banner saved: $filename (" . strlen($binaryData) . " bytes)");
}

// --- Process videos (FFmpeg text overlay → video files) ---
foreach ($videos as $i => $video) {
    $videoPath = $video['video_path'] ?? '';
    if (!$videoPath) {
        $errors[] = "Video $i: no video_path";
        continue;
    }

    // Resolve to absolute path
    $absVideoPath = $projectRoot . $videoPath;
    if (!file_exists($absVideoPath)) {
        $errors[] = "Video $i: file not found at $absVideoPath";
        continue;
    }

    // Queue FFmpeg task for text overlay
    $queueFile = $projectRoot . '/queue.json';
    $outputsDir = $projectRoot . '/outputs';

    if (!file_exists($queueFile)) {
        file_put_contents($queueFile, json_encode([], JSON_PRETTY_PRINT));
    }

    $taskId = uniqid('zip_vid_', true);
    $outputFile = $outputsDir . '/' . $taskId . '.mp4';

    $task = [
        'id'             => $taskId,
        'video_path'     => $videoPath,
        'promo_text'     => $promoText,
        'text_size'      => (int)($video['text_size'] ?? 45),
        'skew_angle'     => (float)($video['skew_angle'] ?? 0),
        'text_alignment' => $video['text_alignment'] ?? 'center',
        'text_color'     => $video['text_color'] ?? '#000000',
        'position_x'     => (int)($video['position_x'] ?? 0),
        'position_y'     => (int)($video['position_y'] ?? 0),
        'promo_start'    => (float)($video['promo_start'] ?? 0),
        'promo_end'      => (float)($video['promo_end'] ?? 0),
        'output_file'    => $outputFile,
        'status'         => 'queued',
        'created_at'     => time(),
        'started_at'     => null,
        'completed_at'   => null,
        'error'          => null,
    ];

    // Write to queue with file locking
    $saved = false;
    for ($attempt = 0; $attempt < 10 && !$saved; $attempt++) {
        $fp = @fopen($queueFile, 'c+');
        if ($fp && @flock($fp, LOCK_EX)) {
            $content = '';
            rewind($fp);
            while (!feof($fp)) {
                $content .= fread($fp, 8192);
            }
            $queue = json_decode($content, true) ?: [];
            $queue[] = $task;
            rewind($fp);
            ftruncate($fp, 0);
            fwrite($fp, json_encode($queue, JSON_PRETTY_PRINT));
            fflush($fp);
            flock($fp, LOCK_UN);
            $saved = true;
        }
        if ($fp) fclose($fp);
        if (!$saved) usleep(500000);
    }

    if (!$saved) {
        $errors[] = "Video $i: failed to queue task";
        continue;
    }

    // Poll for completion (max 120s)
    $maxWait = 120;
    $startTime = time();
    $taskStatus = 'queued';

    while (time() - $startTime < $maxWait) {
        usleep(1500000); // 1.5 seconds

        // Re-send upload action periodically
        if ((time() - $startTime) % 5 === 0) {
            sendChatAction($chatId, 'upload_document', $brand);
        }

        $queueContent = @file_get_contents($queueFile);
        if ($queueContent === false) continue;

        $queue = json_decode($queueContent, true) ?: [];
        foreach ($queue as $t) {
            if ($t['id'] === $taskId) {
                $taskStatus = $t['status'];
                if ($taskStatus === 'completed' || $taskStatus === 'failed') {
                    break 2;
                }
                break;
            }
        }
    }

    if ($taskStatus === 'completed' && is_file($outputFile)) {
        $videoName = preg_replace('/[^a-zA-Z0-9_\-]/', '_', "video_" . ($video['image_id'] ?? $i));
        $destFile = $tmpDir . "/{$videoName}.mp4";
        rename($outputFile, $destFile);
        $filesToZip[] = ['path' => $destFile, 'name' => "{$videoName}.mp4"];
        zlog("Video processed: {$videoName}.mp4");
    } else {
        $errors[] = "Video $i: processing " . ($taskStatus === 'failed' ? 'failed' : 'timed out');
        @unlink($outputFile);
    }
}

// --- Create ZIP archive ---
if (empty($filesToZip)) {
    zlog("ERROR: No files to zip. Errors: " . implode('; ', $errors));
    cleanup($tmpDir);
    http_response_code(500);
    echo json_encode(['error' => 'No files could be processed', 'details' => $errors]);
    exit;
}

// Build ZIP filename: {promo}_{language}_{currency}_{direction}.zip
$safePromo = preg_replace('/[^A-Za-z0-9]/', '', $promoText) ?: 'NOPROMO';
$safeLang = preg_replace('/[^A-Za-z0-9]/', '', $language) ?: 'ALL';
$safeCur = preg_replace('/[^A-Za-z0-9]/', '', $currency) ?: 'ALL';
$safeDir = !empty($directions)
    ? preg_replace('/[^A-Za-z0-9\-]/', '', implode('-', $directions))
    : 'all';

$zipFilename = "{$safePromo}_{$safeLang}_{$safeCur}_{$safeDir}.zip";
$zipPath = $tmpDir . '/' . $zipFilename;

$zip = new ZipArchive();
if ($zip->open($zipPath, ZipArchive::CREATE) !== true) {
    zlog("ERROR: Could not create ZIP at $zipPath");
    cleanup($tmpDir);
    http_response_code(500);
    echo json_encode(['error' => 'Could not create ZIP archive']);
    exit;
}

foreach ($filesToZip as $file) {
    $zip->addFile($file['path'], $file['name']);
}
$zip->close();

zlog("ZIP created: $zipFilename (" . filesize($zipPath) . " bytes, " . count($filesToZip) . " files)");

// --- Send ZIP to Telegram ---
sendChatAction($chatId, 'upload_document', $brand);

$caption = "📦 {$safePromo} | {$safeLang} | {$safeCur} | {$safeDir}";
$result = sendDocumentToChat($chatId, $zipPath, $caption, $brand);

zlog("Telegram API response: " . json_encode($result));

// --- Log download ---
try {
    // Connect to DB for logging
    $dbUrl = $_ENV['DATABASE_URL'] ?? '';
    if ($dbUrl) {
        $url = parse_url($dbUrl);
        $dsn = "pgsql:host={$url['host']};port=" . ($url['port'] ?? 5432) . ";dbname=" . ltrim($url['path'], '/');
        $pdo = new PDO($dsn, $url['user'] ?? '', $url['pass'] ?? '', [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);

        $stmt = $pdo->prepare('INSERT INTO telegram_download_log (telegram_user_id, promo_text, download_type, download_format, items_count, zip_filename) VALUES (?, ?, ?, ?, ?, ?)');
        $stmt->execute([
            $chatId,
            $promoText,
            count($videos) > 0 ? 'mixed' : 'banner',
            'zip',
            count($filesToZip),
            $zipFilename,
        ]);
    }
} catch (\Throwable $e) {
    zlog("Warning: Could not log download: " . $e->getMessage());
}

// Cleanup
cleanup($tmpDir);

if ($result && isset($result['ok']) && $result['ok']) {
    zlog("ZIP sent OK to chatId=$chatId");
    echo json_encode(['success' => true, 'filename' => $zipFilename, 'files_count' => count($filesToZip)]);
} else {
    $desc = $result['description'] ?? 'Unknown error';
    zlog("ERROR sending ZIP: $desc");
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send ZIP to Telegram', 'details' => $desc]);
}

/**
 * Recursively delete a directory
 */
function cleanup(string $dir): void {
    if (!is_dir($dir)) return;
    $files = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($files as $file) {
        if ($file->isDir()) {
            @rmdir($file->getPathname());
        } else {
            @unlink($file->getPathname());
        }
    }
    @rmdir($dir);
}

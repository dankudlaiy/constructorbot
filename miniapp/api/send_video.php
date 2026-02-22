<?php
// DEPRECATED: This endpoint sends individual videos. New flow uses send_zip.php for batch ZIP delivery.
// Kept for backward compatibility with old clients.
// Suppress HTML error output - we only return JSON
ini_set('display_errors', '0');
ini_set('html_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json');

$logFile = dirname(__DIR__, 2) . '/logs/app.log';
function vlog(string $msg): void {
    global $logFile;
    @file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . '] [send_video] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// Set custom error handler to log PHP errors instead of outputting HTML
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    vlog("PHP Error [$errno]: $errstr in $errfile:$errline");
    return true;
});

try {
    require __DIR__ . '/telegram_auth.php';
    require __DIR__ . '/../bot/bot_helpers.php';
} catch (\Throwable $e) {
    vlog("FATAL: Failed to load dependencies: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Server configuration error', 'details' => $e->getMessage()]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed']);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true);

$initData    = $input['initData'] ?? '';
$videoPath   = $input['video_path'] ?? '';
$promoText   = $input['promo_text'] ?? '';
$textSize    = (int)($input['text_size'] ?? 45);
$skewAngle   = (float)($input['skew_angle'] ?? 0);
$textAlign   = $input['text_alignment'] ?? 'center';
$textColor   = $input['text_color'] ?? '#000000';
$positionX   = (int)($input['position_x'] ?? 0);
$positionY   = (int)($input['position_y'] ?? 0);
$promoStart  = (float)($input['promo_start'] ?? 0);
$promoEnd    = (float)($input['promo_end'] ?? 0);
$caption     = $input['caption'] ?? '';
$brand       = $input['brand'] ?? null;

if (!$initData) {
    http_response_code(400);
    echo json_encode(['error' => 'initData is required']);
    exit;
}

if (!$videoPath || !$promoText) {
    http_response_code(400);
    echo json_encode(['error' => 'video_path and promo_text are required']);
    exit;
}

vlog("Request: video=$videoPath promo=$promoText brand=" . ($brand ?? 'null'));
$user = validateInitData($initData, $brand);
if ($user === false) {
    vlog("ERROR: Invalid initData");
    http_response_code(401);
    echo json_encode(['error' => 'Invalid initData']);
    exit;
}

$chatId = $user['id'] ?? null;
vlog("User validated: chatId=$chatId");
if (!$chatId) {
    vlog("ERROR: No chat_id");
    http_response_code(400);
    echo json_encode(['error' => 'Could not determine chat_id']);
    exit;
}

// --- Add task to queue (same logic as add_task.php) ---
$projectRoot = dirname(__DIR__, 2); // constructorbot root
$queueFile = $projectRoot . '/queue.json';
$outputsDir = $projectRoot . '/outputs';

if (!is_dir($outputsDir)) {
    @mkdir($outputsDir, 0755, true);
}
if (!file_exists($queueFile)) {
    file_put_contents($queueFile, json_encode([], JSON_PRETTY_PRINT));
}

$taskId = uniqid('task_', true);
$outputFile = $outputsDir . '/' . $taskId . '.mp4';

$task = [
    'id'             => $taskId,
    'video_path'     => $videoPath,
    'promo_text'     => $promoText,
    'text_size'      => $textSize,
    'skew_angle'     => $skewAngle,
    'text_alignment' => $textAlign,
    'text_color'     => $textColor,
    'position_x'     => $positionX,
    'position_y'     => $positionY,
    'promo_start'    => $promoStart,
    'promo_end'      => $promoEnd,
    'output_file'    => $outputFile,
    'status'         => 'queued',
    'created_at'     => time(),
    'started_at'     => null,
    'completed_at'   => null,
    'error'          => null,
];

// Write task to queue with file locking
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
    vlog("ERROR: Failed to save task to queue");
    http_response_code(500);
    echo json_encode(['error' => 'Failed to queue task']);
    exit;
}
vlog("Task queued: $taskId");

// --- Poll for completion ---
$maxWait = 120; // seconds
$startTime = time();
$taskStatus = 'queued';

// Send typing/upload action
sendChatAction($chatId, 'upload_video', $brand);

while (time() - $startTime < $maxWait) {
    usleep(1500000); // 1.5 seconds

    $queueContent = @file_get_contents($queueFile);
    if ($queueContent === false) continue;

    $queue = json_decode($queueContent, true) ?: [];
    foreach ($queue as $t) {
        if ($t['id'] === $taskId) {
            $taskStatus = $t['status'];
            if ($taskStatus === 'completed' || $taskStatus === 'failed') {
                break 2; // break both foreach and while
            }
            break;
        }
    }

    // Re-send upload action periodically so Telegram shows "uploading video..."
    if ((time() - $startTime) % 5 === 0) {
        sendChatAction($chatId, 'upload_video', $brand);
    }
}

if ($taskStatus === 'failed') {
    vlog("ERROR: Task failed: $taskId");
    http_response_code(500);
    echo json_encode(['error' => 'Video processing failed']);
    exit;
}

if ($taskStatus !== 'completed') {
    vlog("ERROR: Task timed out after 120s: $taskId");
    http_response_code(504);
    echo json_encode(['error' => 'Video processing timed out']);
    exit;
}

vlog("Task completed: $taskId, sending video");

if (!is_file($outputFile)) {
    vlog("ERROR: Output file missing: $outputFile");
    http_response_code(500);
    echo json_encode(['error' => 'Output file not found']);
    exit;
}

sendChatAction($chatId, 'upload_video', $brand);
$result = sendVideoToChat($chatId, $outputFile, $caption, $brand);
@unlink($outputFile);

if ($result && isset($result['ok']) && $result['ok']) {
    vlog("Video sent OK to chatId=$chatId");
    echo json_encode(['success' => true]);
} else {
    $desc = $result['description'] ?? 'Unknown error';
    vlog("ERROR sending video: $desc");
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send video', 'details' => $desc]);
}

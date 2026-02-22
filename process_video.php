<?php
/**
 * Synchronous video processing endpoint for client page (index.php).
 * Adds task to queue, polls for completion, streams the result back.
 */
declare(strict_types=1);

$queueFile  = __DIR__ . '/queue.json';
$outputsDir = __DIR__ . '/outputs';

if (!is_dir($outputsDir)) {
    @mkdir($outputsDir, 0755, true);
}
if (!file_exists($queueFile)) {
    file_put_contents($queueFile, json_encode([], JSON_PRETTY_PRINT));
}

$videoPath   = $_POST['video_path'] ?? '';
$promoText   = $_POST['promo_text'] ?? '';
$textSize    = (int)($_POST['text_size'] ?? 45);
$skewAngle   = (float)($_POST['skew_angle'] ?? 0);
$textAlign   = $_POST['text_alignment'] ?? 'center';
$textColor   = $_POST['text_color'] ?? '#000000';
$positionX   = (int)($_POST['position_x'] ?? 0);
$positionY   = (int)($_POST['position_y'] ?? 0);
$promoStart  = (float)($_POST['promo_start'] ?? 0);
$promoEnd    = (float)($_POST['promo_end'] ?? 0);

if ($videoPath === '' || $promoText === '') {
    http_response_code(400);
    echo 'Missing required parameters';
    exit;
}

$taskId     = uniqid('task_', true);
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

// Write to queue
$saved = false;
for ($attempt = 0; $attempt < 10 && !$saved; $attempt++) {
    $fp = @fopen($queueFile, 'c+');
    if ($fp && @flock($fp, LOCK_EX)) {
        $content = '';
        rewind($fp);
        while (!feof($fp)) { $content .= fread($fp, 8192); }
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
    http_response_code(500);
    echo 'Failed to queue task';
    exit;
}

// Poll for completion (max 120 seconds)
$maxWait   = 120;
$startTime = time();
$status    = 'queued';

while (time() - $startTime < $maxWait) {
    usleep(1500000);

    $raw = @file_get_contents($queueFile);
    if ($raw === false) continue;
    $queue = json_decode($raw, true) ?: [];

    foreach ($queue as $t) {
        if ($t['id'] === $taskId) {
            $status = $t['status'];
            if ($status === 'completed' || $status === 'failed') break 2;
            break;
        }
    }
}

if ($status !== 'completed' || !is_file($outputFile)) {
    http_response_code(500);
    echo $status === 'failed' ? 'Video processing failed' : 'Timeout';
    exit;
}

// Stream video back
header('Content-Type: video/mp4');
header('Content-Length: ' . filesize($outputFile));
header('Cache-Control: no-cache');

while (ob_get_level() > 0) { ob_end_clean(); }
readfile($outputFile);

// Clean up
@unlink($outputFile);

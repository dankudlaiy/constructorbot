<?php
declare(strict_types=1);

$queueFile = __DIR__ . '/queue.json';
$taskId = $_GET['task_id'] ?? '';

if ($taskId === '') {
    http_response_code(400);
    die('Missing task_id parameter');
}

if (!file_exists($queueFile)) {
    http_response_code(404);
    die('Task not found');
}

// Загружаем очередь
$queue = json_decode(file_get_contents($queueFile), true) ?: [];

// Ищем задачу
$task = null;
foreach ($queue as $t) {
    if ($t['id'] === $taskId) {
        $task = $t;
        break;
    }
}

if ($task === null || $task['status'] !== 'completed') {
    http_response_code(404);
    die('Task not found or not completed');
}

$outputFile = $task['output_file'] ?? '';

if (!is_file($outputFile)) {
    http_response_code(404);
    die('Output file not found');
}

// Генерируем имя файла для скачивания
$geo = $_GET['geo'] ?? 'GEO';
$cur = $_GET['cur'] ?? 'CUR';
$dir = $_GET['dir'] ?? 'DIR';
$promo = $task['promo_text'] ?? 'PROMO';
$filename = sprintf('%s_%s_%s_%s.mp4', $promo, $geo, $cur, $dir);

header('Content-Type: video/mp4');
header('Content-Disposition: attachment; filename="' . $filename . '"');
header('Content-Length: ' . filesize($outputFile));
header('Cache-Control: no-cache, must-revalidate');
header('Expires: 0');

if (function_exists('ob_get_level')) {
    while (ob_get_level() > 0) { ob_end_clean(); }
}

readfile($outputFile);

// Помечаем задачу как скачанную
$fp = fopen($queueFile, 'c+');
if (flock($fp, LOCK_EX)) {
    $queue = json_decode(file_get_contents($queueFile), true) ?: [];
    foreach ($queue as $index => $t) {
        if ($t['id'] === $taskId) {
            $queue[$index]['downloaded'] = true;
            $queue[$index]['downloaded_at'] = time();
            break;
        }
    }
    file_put_contents($queueFile, json_encode($queue, JSON_PRETTY_PRINT));
    flock($fp, LOCK_UN);
}
fclose($fp);



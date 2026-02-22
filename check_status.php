<?php
declare(strict_types=1);

header('Content-Type: application/json');

$queueFile = __DIR__ . '/queue.json';
$taskId = $_GET['task_id'] ?? '';

if ($taskId === '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Missing task_id parameter'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Инициализируем очередь если её нет
if (!file_exists($queueFile)) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => 'Task not found (queue file does not exist)'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Загружаем очередь
$queueContent = @file_get_contents($queueFile);
if ($queueContent === false) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Failed to read queue file'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$queue = json_decode($queueContent, true);
if (!is_array($queue)) {
    $queue = [];
}

// Ищем задачу
$task = null;
foreach ($queue as $t) {
    if ($t['id'] === $taskId) {
        $task = $t;
        break;
    }
}

if ($task === null) {
    http_response_code(404);
    echo json_encode([
        'success' => false,
        'error' => 'Task not found'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Проверяем, существует ли файл для completed задач
if ($task['status'] === 'completed' && isset($task['output_file']) && is_file($task['output_file'])) {
    $task['file_size'] = filesize($task['output_file']);
    $task['download_url'] = '/download_task.php?task_id=' . urlencode($taskId);
}

echo json_encode([
    'success' => true,
    'task' => $task
], JSON_UNESCAPED_UNICODE);



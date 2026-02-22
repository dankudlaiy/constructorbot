<?php
// DEPRECATED: This endpoint sends individual photos. New flow uses send_zip.php for batch ZIP delivery.
// Kept for backward compatibility with old clients.
// Suppress HTML error output - we only return JSON
ini_set('display_errors', '0');
ini_set('html_errors', '0');
error_reporting(E_ALL);

header('Content-Type: application/json');

$logFile = dirname(__DIR__, 2) . '/logs/app.log';
function mlog(string $msg): void {
    global $logFile;
    @file_put_contents($logFile, '[' . date('Y-m-d H:i:s') . '] [send_photo] ' . $msg . PHP_EOL, FILE_APPEND | LOCK_EX);
}

// Set custom error handler to log PHP errors instead of outputting HTML
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    mlog("PHP Error [$errno]: $errstr in $errfile:$errline");
    return true;
});

try {
    require __DIR__ . '/telegram_auth.php';
    require __DIR__ . '/../bot/bot_helpers.php';
} catch (\Throwable $e) {
    mlog("FATAL: Failed to load dependencies: " . $e->getMessage());
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

$initData   = $input['initData'] ?? '';
$imageData  = $input['image_base64'] ?? '';
$caption    = $input['caption'] ?? '';
$brand      = $input['brand'] ?? null;

if (!$initData) {
    http_response_code(400);
    echo json_encode(['error' => 'initData is required']);
    exit;
}

if (!$imageData) {
    http_response_code(400);
    echo json_encode(['error' => 'image_base64 is required']);
    exit;
}

// Validate Telegram auth
mlog("Request received, initData length=" . strlen($initData) . ", image_base64 length=" . strlen($imageData) . ", caption=" . $caption . ", brand=" . ($brand ?? 'null'));
$user = validateInitData($initData, $brand);
if ($user === false) {
    mlog("ERROR: Invalid initData");
    http_response_code(401);
    echo json_encode(['error' => 'Invalid initData']);
    exit;
}

$chatId = $user['id'] ?? null;
mlog("User validated: chatId=$chatId");
if (!$chatId) {
    mlog("ERROR: No chat_id in user data");
    http_response_code(400);
    echo json_encode(['error' => 'Could not determine chat_id']);
    exit;
}

// Strip data:image/...;base64, prefix if present
if (strpos($imageData, 'base64,') !== false) {
    $imageData = explode('base64,', $imageData)[1];
}

// Send typing action
sendChatAction($chatId, 'upload_photo', $brand);

// Send the photo
mlog("Sending photo to chatId=$chatId, base64 length after strip=" . strlen($imageData));
$result = sendPhotoToChat($chatId, $imageData, $caption, $brand);
mlog("Telegram API response: " . json_encode($result));

if ($result && isset($result['ok']) && $result['ok']) {
    mlog("Photo sent OK");
    echo json_encode(['success' => true]);
} else {
    $desc = $result['description'] ?? 'Unknown error';
    mlog("ERROR sending photo: $desc");
    http_response_code(500);
    echo json_encode(['error' => 'Failed to send photo', 'details' => $desc]);
}

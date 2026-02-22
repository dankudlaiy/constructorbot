<?php
/**
 * Telegram Bot API helper functions
 * Supports multi-brand bot tokens
 */

/**
 * Get bot token for a specific brand
 * @param string|null $brand 'coldbet', 'spinbetter', or null for legacy fallback
 * @return string Bot token
 */
function getBotToken($brand = null) {
    if ($brand === 'spinbetter') {
        return $_ENV['TELEGRAM_BOT_TOKEN_SPINBETTER'] ?? '';
    }
    if ($brand === 'coldbet') {
        return $_ENV['TELEGRAM_BOT_TOKEN_COLDBET'] ?? $_ENV['TELEGRAM_BOT_TOKEN'] ?? '';
    }
    // Legacy fallback: try COLDBET first, then generic
    return $_ENV['TELEGRAM_BOT_TOKEN_COLDBET'] ?? $_ENV['TELEGRAM_BOT_TOKEN'] ?? '';
}

/**
 * Send a photo to a Telegram chat
 * @param int $chatId Telegram chat/user ID
 * @param string $photoData Base64-encoded image data (without data:... prefix)
 * @param string $caption Optional caption
 * @param string|null $brand Brand identifier for token selection
 * @return array Response from Telegram API
 */
function sendPhotoToChat($chatId, $photoData, $caption = '', $brand = null) {
    $token = getBotToken($brand);
    $url = "https://api.telegram.org/bot{$token}/sendPhoto";

    // Decode base64 to binary
    $binaryData = base64_decode($photoData);
    if ($binaryData === false) {
        return ['ok' => false, 'description' => 'Invalid base64 data'];
    }

    // Save to temp file
    $tmpFile = tempnam(sys_get_temp_dir(), 'tg_photo_');
    file_put_contents($tmpFile, $binaryData);

    $postFields = [
        'chat_id' => $chatId,
        'photo'   => new CURLFile($tmpFile, 'image/jpeg', 'banner.jpg'),
    ];
    if ($caption) {
        $postFields['caption'] = $caption;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    // Clean up
    unlink($tmpFile);

    $result = json_decode($response, true);
    return $result ?: ['ok' => false, 'description' => 'Failed to parse response', 'http_code' => $httpCode];
}

/**
 * Send a video to a Telegram chat
 * @param int $chatId Telegram chat/user ID
 * @param string $videoPath Path to the video file
 * @param string $caption Optional caption
 * @param string|null $brand Brand identifier for token selection
 * @return array Response from Telegram API
 */
function sendVideoToChat($chatId, $videoPath, $caption = '', $brand = null) {
    $token = getBotToken($brand);
    $url = "https://api.telegram.org/bot{$token}/sendVideo";

    if (!file_exists($videoPath)) {
        return ['ok' => false, 'description' => 'Video file not found'];
    }

    $postFields = [
        'chat_id' => $chatId,
        'video'   => new CURLFile($videoPath, 'video/mp4', basename($videoPath)),
    ];
    if ($caption) {
        $postFields['caption'] = $caption;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 120,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);
    return $result ?: ['ok' => false, 'description' => 'Failed to parse response', 'http_code' => $httpCode];
}

/**
 * Send a document (e.g. ZIP archive) to a Telegram chat
 * @param int $chatId Telegram chat/user ID
 * @param string $filePath Path to the file
 * @param string $caption Optional caption
 * @param string|null $brand Brand identifier for token selection
 * @return array Response from Telegram API
 */
function sendDocumentToChat($chatId, $filePath, $caption = '', $brand = null) {
    $token = getBotToken($brand);
    $url = "https://api.telegram.org/bot{$token}/sendDocument";

    if (!file_exists($filePath)) {
        return ['ok' => false, 'description' => 'File not found'];
    }

    $mimeType = mime_content_type($filePath) ?: 'application/octet-stream';

    $postFields = [
        'chat_id'  => $chatId,
        'document' => new CURLFile($filePath, $mimeType, basename($filePath)),
    ];
    if ($caption) {
        $postFields['caption'] = $caption;
    }

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $postFields,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 120,
    ]);
    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    $result = json_decode($response, true);
    return $result ?: ['ok' => false, 'description' => 'Failed to parse response', 'http_code' => $httpCode];
}

/**
 * Send chat action (typing indicator, upload_photo, upload_video, upload_document, etc.)
 * @param int $chatId
 * @param string $action
 * @param string|null $brand Brand identifier for token selection
 */
function sendChatAction($chatId, $action = 'upload_photo', $brand = null) {
    $token = getBotToken($brand);
    $url = "https://api.telegram.org/bot{$token}/sendChatAction";

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => ['chat_id' => $chatId, 'action' => $action],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

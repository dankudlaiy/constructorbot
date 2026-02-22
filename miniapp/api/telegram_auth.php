<?php
/**
 * Telegram WebApp initData validation
 * Validates HMAC-SHA256 signature as per:
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 *
 * Can be used as:
 * 1. Standalone endpoint: POST /api/telegram_auth.php
 * 2. Included as library: require 'telegram_auth.php' then call validateInitData()
 */

if (!defined('MINIAPP_AUTH_LOADED')) {
    define('MINIAPP_AUTH_LOADED', true);

    // miniapp/api/ → miniapp/ → html/ → www/vendor
    require __DIR__ . '/../../../vendor/autoload.php';

    try {
        \Dotenv\Dotenv::createImmutable(dirname(__DIR__, 3))->safeLoad();
    } catch (\Throwable $e) {
        // .env might not exist if env vars are set via docker-compose
        error_log("Dotenv load warning: " . $e->getMessage());
    }
}

/**
 * Validate Telegram WebApp initData
 * @param string $initData Raw initData query string from Telegram.WebApp.initData
 * @return array|false Parsed user data if valid, false otherwise
 */
function validateInitData($initData, $brand = null) {
    // Try brand-specific token first, then legacy fallback
    $botToken = '';
    if ($brand === 'spinbetter') {
        $botToken = $_ENV['TELEGRAM_BOT_TOKEN_SPINBETTER'] ?? '';
    } elseif ($brand === 'coldbet') {
        $botToken = $_ENV['TELEGRAM_BOT_TOKEN_COLDBET'] ?? $_ENV['TELEGRAM_BOT_TOKEN'] ?? '';
    }
    // If no brand or token not found, try all tokens
    if (!$botToken) {
        $botToken = $_ENV['TELEGRAM_BOT_TOKEN_COLDBET'] ?? $_ENV['TELEGRAM_BOT_TOKEN'] ?? '';
    }
    if (!$botToken || !$initData) {
        return false;
    }

    // Parse the initData query string
    parse_str($initData, $params);

    if (!isset($params['hash'])) {
        return false;
    }

    $hash = $params['hash'];
    unset($params['hash']);

    // Sort parameters alphabetically
    ksort($params);

    // Build data-check-string
    $dataCheckParts = [];
    foreach ($params as $key => $value) {
        $dataCheckParts[] = $key . '=' . $value;
    }
    $dataCheckString = implode("\n", $dataCheckParts);

    // Calculate secret key: HMAC-SHA256("WebAppData", bot_token)
    $secretKey = hash_hmac('sha256', $botToken, 'WebAppData', true);

    // Calculate hash: HMAC-SHA256(secret_key, data_check_string)
    $computedHash = hash_hmac('sha256', $dataCheckString, $secretKey);

    // Compare hashes
    if (!hash_equals($computedHash, $hash)) {
        return false;
    }

    // Check auth_date (not older than 24 hours)
    if (isset($params['auth_date'])) {
        $authDate = (int) $params['auth_date'];
        if (time() - $authDate > 86400) {
            return false;
        }
    }

    // Parse user JSON
    $user = null;
    if (isset($params['user'])) {
        $user = json_decode($params['user'], true);
    }

    return $user;
}

// Only handle as standalone endpoint if accessed directly
if (basename($_SERVER['SCRIPT_FILENAME']) === 'telegram_auth.php') {
    header('Content-Type: application/json');

    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
        exit;
    }

    $input = json_decode(file_get_contents('php://input'), true);
    $initData = $input['initData'] ?? '';

    if (!$initData) {
        http_response_code(400);
        echo json_encode(['error' => 'initData is required']);
        exit;
    }

    $user = validateInitData($initData);

    if ($user === false) {
        http_response_code(401);
        echo json_encode(['error' => 'Invalid initData']);
        exit;
    }

    echo json_encode([
        'success'    => true,
        'user_id'    => $user['id'] ?? null,
        'first_name' => $user['first_name'] ?? '',
        'username'   => $user['username'] ?? '',
    ]);
}

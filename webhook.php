<?php
require __DIR__ . '/../vendor/autoload.php';
use Dotenv\Dotenv;

Dotenv::createImmutable(dirname(__DIR__))->load();

// Determine brand from query parameter
// Each bot registers its webhook as: /miniapp/webhook.php?brand=coldbet (or spinbetter)
$brand = $_GET['brand'] ?? 'coldbet';
if (!in_array($brand, ['coldbet', 'spinbetter'], true)) {
    $brand = 'coldbet';
}

// Pick the correct bot token for this brand
$token = '';
if ($brand === 'spinbetter') {
    $token = $_ENV['TELEGRAM_BOT_TOKEN_SPINBETTER'] ?? '';
} else {
    $token = $_ENV['TELEGRAM_BOT_TOKEN_COLDBET'] ?? $_ENV['TELEGRAM_BOT_TOKEN'] ?? '';
}

if (!$token) {
    http_response_code(500);
    exit;
}

$input = file_get_contents('php://input');
$update = json_decode($input, true);

if (!$update) {
    exit;
}

$chatId = $update['message']['chat']['id'] ?? null;
$text   = $update['message']['text'] ?? '';

if (!$chatId) {
    exit;
}

if ($text === '/start') {
    $appUrl = $_ENV['APP_URL'] ?? '';
    $miniappUrl = rtrim($appUrl, '/') . '/miniapp/?brand=' . $brand;

    $brandName = $brand === 'spinbetter' ? 'SpinBetter' : 'ColdBet';

    $payload = [
        'chat_id' => $chatId,
        'text'    => "Welcome to {$brandName} Affiliate!\n\nPress the button below to open the app.",
        'reply_markup' => json_encode([
            'inline_keyboard' => [[
                ['text' => 'Open App', 'web_app' => ['url' => $miniappUrl]],
            ]],
        ]),
    ];

    $ch = curl_init("https://api.telegram.org/bot{$token}/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    curl_exec($ch);
    curl_close($ch);
}

http_response_code(200);

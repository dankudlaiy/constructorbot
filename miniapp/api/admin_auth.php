<?php
/**
 * Admin auth API for embedded mini-app admin screen.
 *
 * GET  ?action=check  — returns {ok, logged_in}
 * POST action=login   — {username, password} → sets session, returns {ok} or 401
 * POST action=logout  — clears session
 */

ini_set('display_errors', '0');
ini_set('html_errors', '0');
header('Content-Type: application/json');

if (session_status() === PHP_SESSION_NONE) session_start();

$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET' && ($_GET['action'] ?? '') === 'check') {
    echo json_encode(['ok' => true, 'logged_in' => !empty($_SESSION['admin_logged_in'])]);
    exit;
}

if ($method === 'POST') {
    $body   = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    if ($action === 'login') {
        require __DIR__ . '/../../../vendor/autoload.php';
        try { \Dotenv\Dotenv::createImmutable(dirname(__DIR__, 3))->safeLoad(); } catch (\Throwable $e) {}

        $adminUser = $_ENV['ADMIN_USER'] ?? 'admin';
        $adminPass = $_ENV['ADMIN_PASS'] ?? 'admin';

        if (($body['username'] ?? '') === $adminUser && ($body['password'] ?? '') === $adminPass) {
            $_SESSION['admin_logged_in'] = true;
            echo json_encode(['ok' => true]);
        } else {
            http_response_code(401);
            echo json_encode(['ok' => false, 'error' => 'Неверный логин или пароль']);
        }
        exit;
    }

    if ($action === 'logout') {
        $_SESSION['admin_logged_in'] = false;
        session_destroy();
        echo json_encode(['ok' => true]);
        exit;
    }
}

http_response_code(400);
echo json_encode(['error' => 'Bad request']);

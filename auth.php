<?php
/**
 * Session-based auth for admin panel
 */

function requireAdmin() {
    if (session_status() === PHP_SESSION_NONE) {
        session_start();
    }

    if (!empty($_SESSION['admin_logged_in'])) {
        return;
    }

    // Handle login form submission
    if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['_admin_login'])) {
        require_once __DIR__ . '/../vendor/autoload.php';
        try {
            \Dotenv\Dotenv::createImmutable(__DIR__ . '/..')->safeLoad();
        } catch (\Throwable $e) {}

        $adminUser = $_ENV['ADMIN_USER'] ?? 'admin';
        $adminPass = $_ENV['ADMIN_PASS'] ?? 'admin';

        if (($_POST['username'] ?? '') === $adminUser && ($_POST['password'] ?? '') === $adminPass) {
            $_SESSION['admin_logged_in'] = true;
            $redirectTo = strtok($_SERVER['REQUEST_URI'], '?');
            header('Location: ' . $redirectTo);
            exit;
        }

        _renderLoginForm('Неверный логин или пароль');
        exit;
    }

    _renderLoginForm();
    exit;
}

function _renderLoginForm(string $error = '') {
    ?><!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Вход</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f0f2f5;
      font-family: Inter, sans-serif;
    }
    .login-card {
      background: #fff;
      border-radius: 16px;
      padding: 40px 36px;
      width: 340px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.10);
    }
    .login-title {
      font-size: 22px;
      font-weight: 900;
      color: #111;
      margin-bottom: 28px;
      text-align: center;
      letter-spacing: 0.5px;
    }
    .login-error {
      background: #fee2e2;
      color: #b91c1c;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 14px;
      margin-bottom: 18px;
    }
    label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: #555;
      margin-bottom: 6px;
      margin-top: 16px;
    }
    input[type=text], input[type=password] {
      width: 100%;
      padding: 11px 14px;
      border: 1.5px solid #d1d5db;
      border-radius: 8px;
      font-size: 15px;
      outline: none;
      transition: border-color .2s;
    }
    input:focus { border-color: #0F917E; }
    button[type=submit] {
      width: 100%;
      margin-top: 24px;
      padding: 13px;
      background: #0F917E;
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      letter-spacing: 0.5px;
      transition: background .2s;
    }
    button[type=submit]:hover { background: #0a7566; }
  </style>
</head>
<body>
  <div class="login-card">
    <div class="login-title">Admin Panel</div>
    <?php if ($error): ?>
      <div class="login-error"><?= htmlspecialchars($error) ?></div>
    <?php endif; ?>
    <form method="POST">
      <input type="hidden" name="_admin_login" value="1">
      <label for="username">Логин</label>
      <input type="text" id="username" name="username" autocomplete="username" required autofocus>
      <label for="password">Пароль</label>
      <input type="password" id="password" name="password" autocomplete="current-password" required>
      <button type="submit">Войти</button>
    </form>
  </div>
</body>
</html><?php
}

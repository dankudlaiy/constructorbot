<?php
require __DIR__ . '/auth.php';
require __DIR__ . '/../vendor/autoload.php';
use Dotenv\Dotenv;
Dotenv::createImmutable(dirname(__DIR__))->load();

requireAdmin();

$workerLog = __DIR__ . '/logs/worker.log';
$phpLog    = __DIR__ . '/logs/php.log';
$appLog    = __DIR__ . '/logs/app.log';
$lines     = (int)($_GET['lines'] ?? 200);
$type      = $_GET['type'] ?? 'worker';

function tailFile(string $path, int $n): string {
    if (!is_file($path) || filesize($path) === 0) return '(empty)';
    $content = file_get_contents($path);
    $all = array_filter(explode("\n", $content), fn($l) => $l !== '');
    $slice = array_slice($all, -$n);
    return implode("\n", $slice);
}

if (isset($_GET['clear'])) {
    file_put_contents($type === 'php' ? $phpLog : $workerLog, '');
    header('Location: logs.php?type=' . $type);
    exit;
}

$logContent = match($type) {
    'php'    => tailFile($phpLog, $lines),
    'app'    => tailFile($appLog, $lines),
    default  => tailFile($workerLog, $lines),
};
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Logs</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Inter', sans-serif; background: #0f0f14; color: #d0d0d0; min-height: 100vh; padding: 24px; }
    h1 { font-size: 18px; font-weight: 700; color: #fff; margin-bottom: 16px; }
    .toolbar {
      display: flex; gap: 10px; align-items: center; margin-bottom: 16px; flex-wrap: wrap;
    }
    .tab {
      padding: 6px 16px; border-radius: 6px; border: 1px solid #333;
      background: #1a1a24; color: #aaa; text-decoration: none; font-size: 13px;
    }
    .tab.active { background: #C2D715; color: #000; border-color: #C2D715; font-weight: 700; }
    .btn {
      padding: 6px 16px; border-radius: 6px; border: 1px solid #444;
      background: #1a1a24; color: #aaa; font-size: 13px; cursor: pointer; text-decoration: none;
    }
    .btn:hover { border-color: #666; color: #fff; }
    .btn.danger { border-color: #c0392b; color: #e74c3c; }
    .btn.danger:hover { background: #c0392b; color: #fff; }
    .lines-select { background: #1a1a24; border: 1px solid #333; color: #aaa; padding: 5px 10px; border-radius: 6px; font-size: 13px; }
    pre {
      background: #13131a; border: 1px solid #2a2a38; border-radius: 8px;
      padding: 16px; font-family: 'Courier New', monospace; font-size: 12px;
      line-height: 1.6; white-space: pre-wrap; word-break: break-all;
      max-height: calc(100vh - 140px); overflow-y: auto; color: #c8c8c8;
    }
    .err  { color: #e74c3c; }
    .warn { color: #f39c12; }
    .ok   { color: #2ecc71; }
    .info { color: #3498db; }
  </style>
</head>
<body>
  <h1>Logs</h1>
  <div class="toolbar">
    <a class="tab <?= $type === 'worker' ? 'active' : '' ?>" href="?type=worker&lines=<?= $lines ?>">Worker</a>
    <a class="tab <?= $type === 'app' ? 'active' : '' ?>" href="?type=app&lines=<?= $lines ?>">App (requests)</a>
    <a class="tab <?= $type === 'php' ? 'active' : '' ?>" href="?type=php&lines=<?= $lines ?>">PHP errors</a>
    <select class="lines-select" onchange="location.href='?type=<?= $type ?>&lines='+this.value">
      <?php foreach ([50,100,200,500] as $n): ?>
        <option value="<?= $n ?>" <?= $n===$lines?'selected':'' ?>>Last <?= $n ?> lines</option>
      <?php endforeach; ?>
    </select>
    <a class="btn" href="?type=<?= $type ?>&lines=<?= $lines ?>">↻ Refresh</a>
    <a class="btn danger" href="?type=<?= $type ?>&lines=<?= $lines ?>&clear=1"
       onclick="return confirm('Clear log?')">✕ Clear</a>
    <a class="btn" href="admin.php">← Admin</a>
  </div>
  <pre id="log"><?php
    $lines_arr = explode("\n", htmlspecialchars($logContent));
    foreach ($lines_arr as $l) {
        if (str_contains($l, 'ERROR') || str_contains($l, 'failed') || str_contains($l, 'Fatal')) {
            echo '<span class="err">' . $l . '</span>' . "\n";
        } elseif (str_contains($l, 'Warning') || str_contains($l, 'warning')) {
            echo '<span class="warn">' . $l . '</span>' . "\n";
        } elseif (str_contains($l, 'completed') || str_contains($l, 'started')) {
            echo '<span class="ok">' . $l . '</span>' . "\n";
        } elseif (str_contains($l, 'ffmpeg') || str_contains($l, 'Processing')) {
            echo '<span class="info">' . $l . '</span>' . "\n";
        } else {
            echo $l . "\n";
        }
    }
  ?></pre>
  <script>
    // Auto-scroll to bottom
    const pre = document.getElementById('log');
    pre.scrollTop = pre.scrollHeight;
    // Auto-refresh every 5 seconds
    setTimeout(() => location.reload(), 5000);
  </script>
</body>
</html>

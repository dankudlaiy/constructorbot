<?php
// vendor is at /var/www/vendor (one level above project root)
// miniapp/index.php → html/ → www/vendor
require __DIR__ . '/../../vendor/autoload.php';
use Dotenv\Dotenv;

Dotenv::createImmutable(dirname(__DIR__, 2))->load();

$url = parse_url($_ENV['DATABASE_URL']);
if ($url === false || !isset($url['scheme'], $url['host'], $url['path'])) {
    error_log("Invalid DATABASE_URL");
    http_response_code(500);
    exit;
}
$host = $url['host'];
$port = $url['port'] ?? 5432;
$db   = ltrim($url['path'], '/');
$user = $url['user'] ?? '';
$pass = $url['pass'] ?? '';
$dsn = "pgsql:host={$host};port={$port};dbname={$db}";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    error_log("DB Connection failed: " . $e->getMessage());
    http_response_code(500);
    exit;
}

// Auto-correct template_type: images in /uploads/images/ are banners, not videos
try {
    $pdo->exec("
        UPDATE templates t
        SET template_type = 'banner'
        WHERE template_type = 'video'
          AND EXISTS (
              SELECT 1 FROM template_images ti
              WHERE ti.template_id = t.id
                AND ti.image_url LIKE '/uploads/images/%'
          )
    ");
} catch (\Throwable $e) {}

$images = $pdo->query(<<<'SQL'
    SELECT ti.id, ti.template_id, t.template_name, t.direction, t.template_type, ti.geo, ti.currency,
           ti.image_url, ti.text_size, ti.skew_angle, ti.text_alignment, ti.text_color,
           ti.position_x, ti.position_y, ti.promo_start, ti.promo_end, ti.size
    FROM template_images ti
    JOIN templates t ON ti.template_id = t.id
    WHERE t.client_access = true
      AND ti.image_url IS NOT NULL
      AND ti.image_url <> 'tmp'
    ORDER BY t.direction, t.created_at DESC, ti.id
SQL)->fetchAll();

$templates = [];
foreach ($images as $image) {
    $templateType = $image['template_type'] ?? 'banner';
    $videoUrl = '';
    if ($templateType === 'video' && $image['image_url']) {
        $previewFilename = basename(parse_url($image['image_url'], PHP_URL_PATH));
        $videoFilename = pathinfo($previewFilename, PATHINFO_FILENAME) . '.mp4';
        $videoUrl = '/uploads/videos/' . $videoFilename;
    }

    $templates[] = [
        'id'             => $image['template_id'],
        'image_id'       => $image['id'],
        'template_name'  => $image['template_name'],
        'direction'      => $image['direction'],
        'template_type'  => $image['template_type'],
        'geo'            => $image['geo'],
        'currency'       => $image['currency'],
        'image_url'      => $image['image_url'],
        'preview_url'    => $image['image_url'],
        'video_url'      => $videoUrl,
        'text_size'      => $image['text_size'],
        'skew_angle'     => $image['skew_angle'],
        'text_alignment' => $image['text_alignment'],
        'text_color'     => $image['text_color'],
        'position_x'     => $image['position_x'],
        'position_y'     => $image['position_y'],
        'promo_start'    => $image['promo_start'],
        'promo_end'      => $image['promo_end'],
        'size'           => $image['size'],
    ];
}

// Determine brand from query parameter (set by webhook)
$brand = $_GET['brand'] ?? 'coldbet';
if (!in_array($brand, ['coldbet', 'spinbetter'], true)) {
    $brand = 'coldbet';
}
$brandName = $brand === 'spinbetter' ? 'SpinBetter' : 'ColdBet';
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title><?php echo $brandName; ?> — Affiliate</title>
  <link rel="stylesheet" href="dist/css/miniapp.bundle.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:ital,wght@0,400;0,700;0,900;1,900&display=swap" rel="stylesheet">
  <script src="https://telegram.org/js/telegram-web-app.js"></script>
</head>
<body>
  <div id="app"></div>

  <script>
    window.__brand = '<?php echo $brand; ?>';
    window.templates = <?php echo json_encode($templates, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
  </script>
  <script src="dist/js/miniapp.bundle.js"></script>
</body>
</html>

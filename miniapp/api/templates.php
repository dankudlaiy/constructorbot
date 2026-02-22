<?php
/**
 * Templates API endpoint
 * Returns templates with optional filtering by geo, currency, direction
 */

// miniapp/api/ → miniapp/ → html/ → www/vendor
require __DIR__ . '/../../../vendor/autoload.php';
use Dotenv\Dotenv;

Dotenv::createImmutable(dirname(__DIR__, 3))->load();

header('Content-Type: application/json');

$url = parse_url($_ENV['DATABASE_URL']);
if ($url === false || !isset($url['scheme'], $url['host'], $url['path'])) {
    http_response_code(500);
    echo json_encode(['error' => 'Database configuration error']);
    exit;
}

$dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s',
    $url['host'],
    $url['port'] ?? 5432,
    ltrim($url['path'], '/')
);

try {
    $pdo = new PDO($dsn, $url['user'] ?? '', $url['pass'] ?? '', [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    error_log("DB Connection failed: " . $e->getMessage());
    http_response_code(500);
    echo json_encode(['error' => 'Database connection failed']);
    exit;
}

// Migration guard: column may not exist on older DB instances
try {
    $pdo->exec("ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(10) NOT NULL DEFAULT 'video'");
} catch (\Throwable $e) {}

// Fix template_type for templates whose image is stored in /uploads/images/ (banner)
// vs /uploads/previews/ (video thumbnail). Runs only on rows still holding the wrong default.
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
    SELECT ti.id, ti.template_id, t.template_name, t.direction, t.template_type,
           ti.geo, ti.currency, ti.image_url, ti.text_size, ti.skew_angle,
           ti.text_alignment, ti.text_color, ti.position_x, ti.position_y,
           ti.promo_start, ti.promo_end, ti.size
    FROM template_images ti
    JOIN templates t ON ti.template_id = t.id
    WHERE t.client_access = true
      AND ti.image_url IS NOT NULL
      AND ti.image_url <> 'tmp'
    ORDER BY t.direction, t.created_at DESC, ti.id
SQL)->fetchAll();

$uploadsBase = dirname(__DIR__, 3) . '/html';

$templates = [];
foreach ($images as $image) {
    $templateType = $image['template_type'] ?? 'video';
    $videoUrl = '';
    if ($templateType === 'video' && $image['image_url'] && $image['image_url'] !== 'tmp') {
        $previewFilename = basename(parse_url($image['image_url'], PHP_URL_PATH));
        $videoFilename = pathinfo($previewFilename, PATHINFO_FILENAME) . '.mp4';
        $videoUrl = '/uploads/videos/' . $videoFilename;
    }

    $templates[] = [
        'id'             => $image['template_id'],
        'image_id'       => $image['id'],
        'template_name'  => $image['template_name'],
        'direction'      => $image['direction'],
        'template_type'  => $templateType,
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

echo json_encode([
    'success'   => true,
    'templates' => $templates,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

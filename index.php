<?php
require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/auth.php';
use Dotenv\Dotenv;
// use Aws\S3\S3Client;

Dotenv::createImmutable(dirname(__DIR__))->load();

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

// $s3 = new S3Client([
//     'version'     => 'latest',
//     'region'      => $_ENV['AWS_REGION'],
//     'credentials' => [
//         'key'    => $_ENV['AWS_ACCESS_KEY_ID'],
//         'secret' => $_ENV['AWS_SECRET_ACCESS_KEY'],
//     ],
// ]);

$images = $pdo->query(<<<'SQL'
    SELECT ti.id, ti.template_id, t.template_name, t.direction, ti.geo, ti.currency, ti.image_url, ti.text_size, ti.skew_angle, ti.text_alignment, ti.text_color, ti.position_x, ti.position_y, ti.promo_start, ti.promo_end, ti.size
    FROM template_images ti
    JOIN templates t ON ti.template_id = t.id
    WHERE t.client_access = true
    ORDER BY t.direction, t.created_at DESC, ti.id
SQL)->fetchAll();

$templates = [];
foreach ($images as $image) {
    // Получаем путь к видео на основе пути к превью
    $videoUrl = '';
    if ($image['image_url'] && $image['image_url'] !== 'tmp') {
        $previewFilename = basename(parse_url($image['image_url'], PHP_URL_PATH));
        $videoFilename = pathinfo($previewFilename, PATHINFO_FILENAME) . '.mp4';
        $videoUrl = '/uploads/videos/' . $videoFilename;
    }
    
    $templates[] = [
        'id' => $image['template_id'],
        'image_id' => $image['id'],
        'template_name' => $image['template_name'],
        'direction' => $image['direction'],
        'geo' => $image['geo'],
        'currency' => $image['currency'],
        'image_url' => $image['image_url'], // Оставляем оригинальное поле для совместимости
        'preview_url' => $image['image_url'], // Превью для отображения
        'video_url' => $videoUrl, // Путь к видео для обработки
        'text_size' => $image['text_size'],
        'skew_angle' => $image['skew_angle'],
        'text_alignment' => $image['text_alignment'],
        'text_color' => $image['text_color'],
        'position_x' => $image['position_x'],
        'position_y' => $image['position_y'],
        'promo_start' => $image['promo_start'],
        'promo_end' => $image['promo_end'],
        'size' => $image['size'],
    ];
}



$allGeos = [];
$allCurrencies = [];
foreach ($templates as $template) {
    if (is_array($template['geo'])) {
        foreach ($template['geo'] as $geo) {
            $allGeos[$geo] = true;
        }
    }
    if (is_array($template['currency'])) {
        foreach ($template['currency'] as $currency) {
            $allCurrencies[$currency] = true;
        }
    }
}
$allGeos = array_keys($allGeos);
$allCurrencies = array_keys($allCurrencies);
sort($allGeos);
sort($allCurrencies);

if (isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
    header('Content-Type: application/json');
    echo json_encode([
        'templates' => $templates,
        'geos' => $allGeos,
        'currencies' => $allCurrencies
    ]);
    exit;
}
?>
<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Создание видео с промокодом</title>
  <link rel="stylesheet" href="dist/css/app.bundle.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@700;900&display=swap" rel="stylesheet">
  <style>
    .spinner {
        width: 40px;
        height: 40px;
        border: 4px solid rgba(0,0,0,0.1);
        border-top-color:rgb(183, 187, 190);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: translate(-50%, -50%) rotate(360deg); }
    }
    

    .all-controls-row {
        display: flex;
        align-items: center;
        gap: 20px;
    }
    
    
    .display-mode-buttons {
        display: flex;
        align-items: center;
        gap: 10px;
    }
    
    #canvasContainer {
        display: flex;
        justify-content: center;
        align-items: center;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="client-panel">
      <h1>VIDEO GENERATOR</h1>
      <div class="controls-panel">
        <div class="selectors">
          <div class="dropdown-block">
            <label for="geoSelect" data-i18n="geo">Гео</label>
            <select id="geoSelect" name="geoSelect">
            </select>
          </div>
          <div class="dropdown-block">
            <label for="currencySelect" data-i18n="currency">Валюта</label>
            <select id="currencySelect" name="currencySelect">
            </select>
          </div>
          <div class="dropdown-block">
            <label for="directionSelect" data-i18n="choose_direction">Выбери направление</label>
            <select id="directionSelect">
	      <option value="all" data-i18n="all">Все</option>
              <option value="sport" data-i18n="sport">Спорт</option>
              <option value="casino" data-i18n="casino">Казино</option>
              <option value="universal" data-i18n="universal">Универсальный</option>
            </select>
          </div>
        </div>
        <div class="promo-block">
          <label for="textInput" data-i18n="enter_promocode">Введи промокод</label>
          <input type="text" id="textInput" placeholder="PROMOCODE">
        </div>
      </div>
    </div>
    <div class="preview-panel-container">
      <div class="login-button-container">
        <button onclick="location.href='/admin.php'">LOG IN</button>
        <button id="langSwitchBtn" style="margin-left: 16px; min-width: 80px;">RU</button>
      </div>
      <div class="preview-panel">
        <div class="display-mode-selector">
          <div class="all-controls-row">
            <div class="display-mode-buttons">
              <span data-i18n="display_mode">Режим отображения</span>
              <button id="oneImageBtn" class="display-mode-button selected">
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="41" height="41" rx="7.5" stroke="#C1C1C1"/>
                <rect class="icon-rect" x="6" y="6" width="30" height="30" rx="5" fill="#C9C9C9"/>
                </svg>

            </button>
            <button id="manyImagesBtn" class="display-mode-button">
              <svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="0.5" y="0.5" width="41" height="41" rx="7.5" stroke="#C1C1C1"/>
                <rect class="icon-rect" x="8" y="8" width="12" height="12" rx="3" fill="#C2D715"/>
                <rect class="icon-rect" x="22" y="8" width="12" height="12" rx="3" fill="#C2D715"/>
                <rect class="icon-rect" x="8" y="22" width="12" height="12" rx="3" fill="#C2D715"/>
                <rect class="icon-rect" x="22" y="22" width="12" height="12" rx="3" fill="#C2D715"/>
                </svg>

            </button>
            </div>
          </div>
        </div>
        <div id="canvasContainer" class="preview-item" style="position: relative;">
          <div class="spinner" style="display: none; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 3;"></div>
          <video id="previewVideo" playsinline muted style="display: none; width: 0; height: 0;"></video>
          <canvas id="canvas" width="1000" height="1000" style="position: relative; z-index: 1;"></canvas>
        </div>
        <div id="galleryContainer" class="preview-item" style="display: none;"></div>
        <div class="select-all-btn-container" style="display: flex; align-items: center; gap: 8px;">
          <button class="select-all-btn" style="padding: 0; background: none; border: none; cursor: pointer;">
            <img src="assets/images/check_box_outline_blank.svg" alt="Select All" style="width: 28px; height: 28px;">
          </button>
          <h2 style="margin: 0; font-size: 16px;" data-i18n="select_all">Select All</h2>
          <button id="playPauseBtn" style="display: none; margin-left: 30px; padding: 0; background: none; border: none; cursor: pointer;">
            <img src="assets/images/play_arrow.svg" alt="Play" style="width: 28px; height: 28px;">
          </button>
        </div>
        <button id="downloadBtn"><span data-i18n="download">СОЗДАТЬ ВИДЕО</span> <img src="assets/images/download-arrow-sqaure.svg" alt="Download"></button>
      </div>
    </div>
  </div>
  
  <script>
    window.templates = <?php echo json_encode($templates, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); ?>;
  </script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>
  <script src="dist/js/app.bundle.js"></script>
  <script src="dist/js/zip_override.bundle.js"></script>
</body>
</html>

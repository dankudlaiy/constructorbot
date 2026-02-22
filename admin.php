<?php
declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';
require __DIR__ . '/auth.php';
use Dotenv\Dotenv;
// Удаляем инициализацию S3
// use Aws\S3\S3Client;

requireAdmin();

Dotenv::createImmutable(dirname(__DIR__))->load();

$url = parse_url($_ENV['DATABASE_URL']);
if ($url === false || !isset($url['scheme'], $url['host'], $url['path'])) {
    error_log("Invalid DATABASE_URL");
    exit(1);
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
    exit(1);
}

// Migration: add template_type column if missing
$pdo->exec("ALTER TABLE templates ADD COLUMN IF NOT EXISTS template_type VARCHAR(10) NOT NULL DEFAULT 'video'");

// Fix template_type: templates with images in /uploads/images/ are banner templates
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

// Удаляем инициализацию S3
// $s3 = new S3Client([
//     'version'     => 'latest',
//     'region'      => $_ENV['AWS_REGION'],
//     'credentials' => [
//         'key'    => $_ENV['AWS_ACCESS_KEY_ID'],
//         'secret' => $_ENV['AWS_SECRET_ACCESS_KEY'],
//     ],
// ]);

function generateRandomFilename(PDO $pdo, int $length = 20): string {
    do {
        $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
        $max   = strlen($chars) - 1;
        $str   = '';
        for ($i = 0; $i < $length; $i++) {
            $str .= $chars[random_int(0, $max)];
        }
        $filename = $str . '.mp4';
        
        $stmt = $pdo->prepare("SELECT COUNT(*) FROM template_images WHERE image_url LIKE ?");
        $stmt->execute(['%' . $filename]);
        $exists = (int)$stmt->fetchColumn();
    } while ($exists > 0);
    
    return $filename;
}

function extractVideoThumbnail($videoPath, $thumbnailPath, $time = '00:00:01'): bool {
    // Определяем путь к FFmpeg в зависимости от ОС
    if (PHP_OS_FAMILY === 'Windows') {
        $localAppData = getenv('LOCALAPPDATA') ?: 'C:\Users\\' . getenv('USERNAME') . '\AppData\Local';
        $ffmpegPath = $localAppData . '\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1.1-full_build\bin\ffmpeg.exe';
    } else {
        // Linux/Unix - пробуем стандартные пути
        $ffmpegPath = '/usr/bin/ffmpeg';
    }
    
    // Проверяем существование файла
    if (!file_exists($ffmpegPath)) {
        // Пробуем найти в PATH
        $ffmpegPath = 'ffmpeg';
    }
    
    $command = sprintf(
        '"%s" -i "%s" -ss %s -vframes 1 -q:v 2 "%s" 2>&1',
        $ffmpegPath,
        $videoPath,
        $time,
        $thumbnailPath
    );
    
    exec($command, $output, $returnCode);
    
    return $returnCode === 0 && file_exists($thumbnailPath);
}

function processVideoWithFaststart($inputPath, $outputPath): bool {
    // Определяем путь к FFmpeg в зависимости от ОС
    if (PHP_OS_FAMILY === 'Windows') {
        $localAppData = getenv('LOCALAPPDATA') ?: 'C:\Users\\' . getenv('USERNAME') . '\AppData\Local';
        $ffmpegPath = $localAppData . '\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-7.1.1-full_build\bin\ffmpeg.exe';
    } else {
        // Linux/Unix - пробуем стандартные пути
        $ffmpegPath = '/usr/bin/ffmpeg';
    }
    
    // Проверяем существование файла
    if (!file_exists($ffmpegPath)) {
        // Пробуем найти в PATH
        $ffmpegPath = 'ffmpeg';
    }
    
    $command = sprintf(
        '"%s" -y -i "%s" -c copy -movflags +faststart "%s" 2>&1',
        $ffmpegPath,
        $inputPath,
        $outputPath
    );
    
    exec($command, $output, $returnCode);
    
    return $returnCode === 0 && file_exists($outputPath);
}

if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['action'])) {
    if ($_GET['action'] === 'get_directions') {
        // Return all active directions
        $stmt = $pdo->query("SELECT id, slug, label, sort_order FROM directions WHERE is_active = true ORDER BY sort_order, label");
        $directions = $stmt->fetchAll();
        header('Content-Type: application/json');
        echo json_encode($directions);
        exit;
    } elseif ($_GET['action'] === 'get_template_directions') {
        $template_id = isset($_GET['template_id']) ? (int)$_GET['template_id'] : 0;
        if ($template_id <= 0) {
            header('Content-Type: application/json');
            echo json_encode([]);
            exit;
        }
        $stmt = $pdo->prepare("
            SELECT d.slug FROM template_directions td
            JOIN directions d ON d.id = td.direction_id
            WHERE td.template_id = ?
        ");
        $stmt->execute([$template_id]);
        $slugs = $stmt->fetchAll(PDO::FETCH_COLUMN);
        header('Content-Type: application/json');
        echo json_encode($slugs);
        exit;
    } elseif ($_GET['action'] === 'get_countries') {
        $search = $_GET['search'] ?? '';
        error_log("Searching for countries with prefix: " . $search);
        
        $stmt = $pdo->prepare("
            SELECT country as country_code, currency 
            FROM country_currencies 
            WHERE LOWER(country) LIKE LOWER(:search) || '%'
            ORDER BY country
            LIMIT 10
        ");
        $stmt->execute([':search' => $search]);
        $countries = $stmt->fetchAll();
        
        error_log("Found countries: " . json_encode($countries));
        
        header('Content-Type: application/json');
        echo json_encode($countries);
        exit;
    } elseif ($_GET['action'] === 'get_currencies') {
        $search = $_GET['search'] ?? '';
        error_log("Searching for currencies with prefix: " . $search);
        
        $stmt = $pdo->prepare("
            SELECT DISTINCT currency 
            FROM country_currencies 
            WHERE LOWER(currency) LIKE LOWER(:search) || '%'
            ORDER BY currency
            LIMIT 20
        ");
        $stmt->execute([':search' => $search]);
        $currencies = $stmt->fetchAll();
        
        error_log("Found currencies: " . json_encode($currencies));
        
        header('Content-Type: application/json');
        echo json_encode($currencies);
        exit;
    } elseif ($_GET['action'] === 'get_image') {
        $url = $_GET['url'] ?? '';
        if (empty($url)) {
            header('HTTP/1.1 400 Bad Request');
            exit;
        }

        $decodedUrl = urldecode($url);
        $filename = basename(parse_url($decodedUrl, PHP_URL_PATH));
        error_log("Attempting to load image: " . $filename);

        try {
            $result = $s3->getObject([
                'Bucket' => $_ENV['S3_BUCKET'],
                'Key'    => $filename
            ]);

            error_log("Successfully retrieved image from S3");

            header('Content-Type: ' . $result['ContentType']);
            header('Cache-Control: max-age=86400, public');
            header('Access-Control-Allow-Origin: *');
            
            echo $result['Body'];
            exit;
        } catch (Exception $e) {
            error_log("Error loading image from S3: " . $e->getMessage());
            error_log("Failed filename: " . $filename);
            header('HTTP/1.1 404 Not Found');
            exit;
        }
    }
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        if (isset($_POST['action'])) {
            if ($_POST['action'] === 'delete_template') {
                $template_id = isset($_POST['template_id']) ? (int)$_POST['template_id'] : 0;
                if ($template_id <= 0) {
                    throw new Exception('Invalid template ID');
                }

                $pdo->beginTransaction();

                // Get all image URLs before deletion
                $stmt = $pdo->prepare("SELECT image_url FROM template_images WHERE template_id = ?");
                $stmt->execute([$template_id]);
                $images = $stmt->fetchAll();

                // Delete from template_images first (cascade will handle templates)
                $pdo->prepare("DELETE FROM template_images WHERE template_id = ?")->execute([$template_id]);
                $pdo->prepare("DELETE FROM templates WHERE id = ?")->execute([$template_id]);

                // Delete videos and previews from disk
                foreach ($images as $image) {
                    if ($image['image_url'] && $image['image_url'] !== 'tmp') {
                        try {
                            // Удаляем превью
                            $previewFilename = basename(parse_url($image['image_url'], PHP_URL_PATH));
                            if ($previewFilename) {
                                $previewPath = __DIR__ . '/uploads/previews/' . $previewFilename;
                                if (file_exists($previewPath)) {
                                    unlink($previewPath);
                                }
                            }
                            
                            // Удаляем видео (используем то же имя файла но с расширением .mp4)
                            $videoFilename = pathinfo($previewFilename, PATHINFO_FILENAME) . '.mp4';
                            if ($videoFilename) {
                                $videoPath = __DIR__ . '/uploads/videos/' . $videoFilename;
                                if (file_exists($videoPath)) {
                                    unlink($videoPath);
                                }
                            }
                        } catch (Exception $e) {
                            error_log("Error deleting video files: " . $e->getMessage());
                        }
                    }
                }

                $pdo->commit();
                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
                exit;
            } elseif ($_POST['action'] === 'enable_client_access' || $_POST['action'] === 'disable_client_access') {
                $template_id = isset($_POST['template_id']) ? (int)$_POST['template_id'] : 0;
                if ($template_id <= 0) {
                    throw new Exception('Invalid template ID');
                }

                $new_status = $_POST['action'] === 'enable_client_access' ? 'true' : 'false';
                
                $stmt = $pdo->prepare("UPDATE templates SET client_access = ? WHERE id = ?");
                $stmt->execute([$new_status, $template_id]);

                if ($stmt->rowCount() === 0) {
                    throw new Exception('Template not found');
                }

                header('Content-Type: application/json; charset=UTF-8');
                echo json_encode(['success' => true], JSON_UNESCAPED_UNICODE);
                exit;
            } elseif ($_POST['action'] === 'delete_template_image') {
                $geo = $_POST['geo'] ?? '';
                $currency = $_POST['currency'] ?? '';
                $template_id = $_POST['template_id'] ?? '';
                
                if (!empty($geo) && !empty($currency) && !empty($template_id)) {
                    try {
                        $stmt = $pdo->prepare("DELETE FROM template_images WHERE template_id = :template_id AND geo = :geo AND currency = :currency");
                        $stmt->execute([
                            ':template_id' => $template_id,
                            ':geo' => $geo,
                            ':currency' => $currency
                        ]);
                        
                        if ($stmt->rowCount() > 0) {
                            echo json_encode(['success' => true]);
                        } else {
                            echo json_encode(['success' => false, 'error' => 'No record found to delete']);
                        }
                    } catch (PDOException $e) {
                        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
                    }
                } else {
                    echo json_encode(['success' => false, 'error' => 'Missing required parameters']);
                }
                exit;
            }
        }

        $pdo->beginTransaction();

        $template_name = trim($_POST['template_name'] ?? '');
        $direction = trim($_POST['direction'] ?? '');
        $template_type = in_array($_POST['template_type'] ?? '', ['video', 'banner']) ? $_POST['template_type'] : 'video';
        $text_size = isset($_POST['text_size']) ? (int)$_POST['text_size'] : 45;
        $skew_angle = isset($_POST['skew_angle']) ? (float)$_POST['skew_angle'] : 0;
        $text_alignment = trim($_POST['text_alignment'] ?? 'center');
        $text_color = trim($_POST['text_color'] ?? '#000000');
        $position_x = isset($_POST['position_x']) ? (int)$_POST['position_x'] : 0;
        $position_y = isset($_POST['position_y']) ? (int)$_POST['position_y'] : 0;
        $geo = trim($_POST['geo'] ?? '');
        $currency = trim($_POST['currency'] ?? '');
        $promo_start = isset($_POST['promo_start']) ? (float)$_POST['promo_start'] : 0.0;
        $promo_end = isset($_POST['promo_end']) ? (float)$_POST['promo_end'] : 0.0;
        $video_size = trim($_POST['video_size'] ?? '1x1');

        if (empty($template_name)) {
            throw new Exception('Template name is required');
        }

        if (empty($geo)) {
            throw new Exception('Geo is required');
        }

        if (empty($currency)) {
            throw new Exception('Currency is required');
        }

        // Check if country already exists in country_currencies, if not - add it
        $stmt = $pdo->prepare("SELECT 1 FROM country_currencies WHERE country = ?");
        $stmt->execute([$geo]);
        if (!$stmt->fetch()) {
            // Country doesn't exist, add new geo-currency pair
            $stmt = $pdo->prepare("INSERT INTO country_currencies (country, currency) VALUES (?, ?)");
            $stmt->execute([$geo, $currency]);
            
            // Also add to geos table if not exists
            $stmt = $pdo->prepare("SELECT id FROM geos WHERE name = ?");
            $stmt->execute([$geo]);
            if (!$stmt->fetch()) {
                $stmt = $pdo->prepare("INSERT INTO geos (name) VALUES (?)");
                $stmt->execute([$geo]);
            }
        }

        $isUpdate = isset($_POST['template_id']) && $_POST['template_id'] > 0;
        $template_id = $isUpdate ? (int)$_POST['template_id'] : null;

        // Parse directions from POST (comma-separated slugs)
        $directions_raw = trim($_POST['directions'] ?? '');
        $direction_slugs = $directions_raw ? array_filter(array_map('trim', explode(',', $directions_raw))) : [];
        // For backward compatibility: set old direction field to first slug or 'universal'
        if (!empty($direction_slugs)) {
            $direction = $direction_slugs[0];
        }

        if ($isUpdate) {
            $stmt = $pdo->prepare(<<<'SQL'
                UPDATE templates
                SET template_name = :template_name,
                    direction = :direction,
                    template_type = :template_type
                WHERE id = :id
            SQL);
            $stmt->execute([
                ':template_name' => $template_name,
                ':direction' => $direction,
                ':template_type' => $template_type,
                ':id' => $template_id
            ]);
        } else {
            $stmt = $pdo->prepare(<<<'SQL'
                INSERT INTO templates (template_name, direction, template_type)
                VALUES (:template_name, :direction, :template_type)
                RETURNING id
            SQL);
            $stmt->execute([
                ':template_name' => $template_name,
                ':direction' => $direction,
                ':template_type' => $template_type,
            ]);
            $template_id = (int)$stmt->fetchColumn();
        }

        // Dual-write: sync template_directions junction table
        if (!empty($direction_slugs)) {
            // Clear existing directions for this template
            $pdo->prepare("DELETE FROM template_directions WHERE template_id = ?")->execute([$template_id]);
            // Insert new directions
            $insertDir = $pdo->prepare("
                INSERT INTO template_directions (template_id, direction_id)
                SELECT ?, d.id FROM directions d WHERE d.slug = ?
                ON CONFLICT DO NOTHING
            ");
            foreach ($direction_slugs as $slug) {
                $insertDir->execute([$template_id, $slug]);
            }
        }

        if (!empty($_FILES['custom_image']['tmp_name']) && $_FILES['custom_image']['error'] === UPLOAD_ERR_OK) {
            $originalName = $_FILES['custom_image']['name'];
            $contentType = $_FILES['custom_image']['type'];
            $extension = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

            $allowedVideoExtensions = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'webm'];
            $allowedImageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
            $isVideoFile = in_array($extension, $allowedVideoExtensions)
                || str_starts_with($contentType, 'video/');
            $isImageFile = in_array($extension, $allowedImageExtensions)
                || str_starts_with($contentType, 'image/');

            if (!$isVideoFile && !$isImageFile) {
                throw new Exception('Разрешены только видео или изображения');
            }

            if ($isVideoFile) {
                $filename = generateRandomFilename($pdo);
                $videoPath = __DIR__ . '/uploads/videos/' . $filename;
                $thumbnailPath = __DIR__ . '/uploads/previews/' . pathinfo($filename, PATHINFO_FILENAME) . '.jpg';

                if (!is_dir(__DIR__ . '/uploads/videos/')) mkdir(__DIR__ . '/uploads/videos/', 0755, true);
                if (!is_dir(__DIR__ . '/uploads/previews/')) mkdir(__DIR__ . '/uploads/previews/', 0755, true);

                if (!move_uploaded_file($_FILES['custom_image']['tmp_name'], $videoPath)) {
                    throw new Exception('Ошибка при сохранении видео файла');
                }

                $tempVideoPath = $videoPath . '.temp';
                if (processVideoWithFaststart($videoPath, $tempVideoPath) && file_exists($tempVideoPath)) {
                    unlink($videoPath);
                    rename($tempVideoPath, $videoPath);
                }

                if (!extractVideoThumbnail($videoPath, $thumbnailPath)) {
                    throw new Exception('Ошибка при создании превью видео');
                }

                $imageUrl = '/uploads/previews/' . pathinfo($filename, PATHINFO_FILENAME) . '.jpg';
            } else {
                // Banner / photo upload
                $chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
                $randomName = '';
                for ($i = 0; $i < 20; $i++) $randomName .= $chars[random_int(0, strlen($chars) - 1)];
                $saveExt = in_array($extension, $allowedImageExtensions) ? $extension : 'jpg';
                $imageFilename = $randomName . '.' . $saveExt;

                if (!is_dir(__DIR__ . '/uploads/images/')) mkdir(__DIR__ . '/uploads/images/', 0755, true);

                $imagePath = __DIR__ . '/uploads/images/' . $imageFilename;
                if (!move_uploaded_file($_FILES['custom_image']['tmp_name'], $imagePath)) {
                    throw new Exception('Ошибка при сохранении изображения');
                }

                $imageUrl = '/uploads/images/' . $imageFilename;
            }
        }

        // Check if image already exists for this geo/currency combination
        $stmt = $pdo->prepare("SELECT id, image_url FROM template_images WHERE template_id = ? AND geo = ? AND currency = ?");
        $stmt->execute([$template_id, $geo, $currency]);
        $existingImage = $stmt->fetch();

        if ($existingImage) {
            // Update existing image
            $updateFields = [
                'text_size = :text_size',
                'skew_angle = :skew_angle',
                'text_alignment = :text_alignment',
                'text_color = :text_color',
                'position_x = :position_x',
                'position_y = :position_y',
                'promo_start = :promo_start',
                'promo_end = :promo_end',
                'size = :video_size'
            ];

            $params = [
                ':text_size' => $text_size,
                ':skew_angle' => $skew_angle,
                ':text_alignment' => $text_alignment,
                ':text_color' => $text_color,
                ':position_x' => $position_x,
                ':position_y' => $position_y,
                ':promo_start' => $promo_start,
                ':promo_end' => $promo_end,
                ':video_size' => $video_size,
                ':id' => $existingImage['id']
            ];

                            // Only update image_url if a new video was uploaded
                if (isset($imageUrl)) {
                    $updateFields[] = 'image_url = :image_url';
                    $params[':image_url'] = $imageUrl;

                    // Удаляем старые файлы с диска
                    if ($existingImage['image_url'] && $existingImage['image_url'] !== 'tmp') {
                        $oldPreviewFilename = basename(parse_url($existingImage['image_url'], PHP_URL_PATH));
                        $oldPreviewPath = __DIR__ . '/uploads/previews/' . $oldPreviewFilename;
                        if (file_exists($oldPreviewPath)) {
                            unlink($oldPreviewPath);
                        }
                        
                        $oldVideoFilename = pathinfo($oldPreviewFilename, PATHINFO_FILENAME) . '.mp4';
                        $oldVideoPath = __DIR__ . '/uploads/videos/' . $oldVideoFilename;
                        if (file_exists($oldVideoPath)) {
                            unlink($oldVideoPath);
                        }
                    }
                }

            $sql = "UPDATE template_images SET " . implode(', ', $updateFields) . " WHERE id = :id";
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        } else {
            // Insert new image
            $stmt = $pdo->prepare(<<<'SQL'
                INSERT INTO template_images 
                (template_id, geo, currency, image_url, text_size, skew_angle, 
                 text_alignment, text_color, position_x, position_y, promo_start, promo_end, size)
                VALUES 
                (:template_id, :geo, :currency, :image_url, :text_size, :skew_angle,
                 :text_alignment, :text_color, :position_x, :position_y, :promo_start, :promo_end, :video_size)
            SQL);
            $stmt->execute([
                ':template_id' => $template_id,
                ':geo' => $geo,
                ':currency' => $currency,
                ':image_url' => $imageUrl ?? 'tmp',
                ':text_size' => $text_size,
                ':skew_angle' => $skew_angle,
                ':text_alignment' => $text_alignment,
                ':text_color' => $text_color,
                ':position_x' => $position_x,
                ':position_y' => $position_y,
                ':promo_start' => $promo_start,
                ':promo_end' => $promo_end,
                ':video_size' => $video_size
            ]);
        }

        $pdo->commit();
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode(['success' => true, 'id' => $template_id], JSON_UNESCAPED_UNICODE);
        exit;

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        error_log("Error in admin.php: " . $e->getMessage());
        error_log("Stack trace: " . $e->getTraceAsString());
        header('Content-Type: application/json; charset=UTF-8', true, 500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$templates = $pdo->query(<<<'SQL'
    SELECT t.id, t.template_name, t.direction, t.template_type, t.client_access, t.created_at,
           array_remove(array_agg(DISTINCT ti.geo), NULL) AS geo_list,
           array_remove(array_agg(DISTINCT ti.currency), NULL) AS currency_list,
           COALESCE(
               (SELECT array_agg(d.slug) FROM template_directions td JOIN directions d ON d.id = td.direction_id WHERE td.template_id = t.id),
               CASE WHEN t.direction IS NOT NULL AND t.direction != '' THEN ARRAY[t.direction] ELSE ARRAY[]::text[] END
           ) AS directions_list,
           array_agg(
               json_build_object(
                   'id', ti.id,
                   'geo', ti.geo,
                   'currency', ti.currency,
                   'image_url', ti.image_url,
                   'text_size', ti.text_size,
                   'skew_angle', ti.skew_angle,
                   'text_alignment', ti.text_alignment,
                   'text_color', ti.text_color,
                   'position_x', ti.position_x,
                   'position_y', ti.position_y,
                   'promo_start', ti.promo_start,
                   'promo_end', ti.promo_end,
                   'video_size', ti.size
               )
           ) FILTER (WHERE ti.id IS NOT NULL) AS images
    FROM templates t
    LEFT JOIN template_images ti ON t.id = ti.template_id
    GROUP BY t.id
    ORDER BY t.created_at DESC
SQL)->fetchAll();

foreach ($templates as &$template) {
    if (is_string($template['geo_list'])) {
        $template['geo_list'] = array_filter(str_getcsv(trim($template['geo_list'], '{}')));
    }
    if (is_string($template['currency_list'])) {
        $template['currency_list'] = array_filter(str_getcsv(trim($template['currency_list'], '{}')));
    }
    if (is_string($template['directions_list'])) {
        $template['directions_list'] = array_filter(str_getcsv(trim($template['directions_list'], '{}')));
    }
    if (!is_array($template['directions_list']) || empty($template['directions_list'])) {
        $template['directions_list'] = $template['direction'] ? [$template['direction']] : [];
    }
}
unset($template);

// Fetch all directions for the admin UI
$allDirections = $pdo->query("SELECT id, slug, label, sort_order FROM directions WHERE is_active = true ORDER BY sort_order, label")->fetchAll();

$currentConfig = [
  'image_url'      => '',
  'template_name'  => '',
  'direction'      => '',
  'text_size'      => 45,
  'skew_angle'     => 0,
  'text_alignment' => 'center',
  'text_color'     => '#FFFFFF',
  'position_x'     => 0,
  'position_y'     => 0,
  'geo_list'       => [],
  'currency_list'  => [],
];
?><!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
  <title>Админ-панель</title>
  <link rel="stylesheet" href="css/admin.css">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;900&display=swap" rel="stylesheet">
  <script src="https://cdn.jsdelivr.net/npm/fabric@5.2.4/dist/fabric.min.js"></script>
  <script>
  </script>
</head>
<body>
  <!-- Mobile Tab Navigation -->
  <div class="admin-tabs">
    <button class="admin-tab active" data-tab="templates">Шаблоны</button>
    <button class="admin-tab" data-tab="editor">Редактор</button>
    <a href="logs.php" class="admin-tab admin-tab-link">Логи</a>
    <a href="logout.php" class="admin-tab admin-tab-link">Выход</a>
  </div>

  <div class="container">
    <!-- TAB 1: Template List -->
    <div class="tab-panel active" id="tabTemplates" data-tab="templates">
      <div class="template-list">
        <div class="template-list-header">
          <h2>Шаблоны</h2>
          <button class="add-template-btn" id="addTemplateBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
            Новый
          </button>
        </div>
        <div id="templateList" class="template-list-store">
          <?php foreach ($templates as $tpl): ?>
            <div class="template-item <?php echo $tpl['client_access'] ? 'client-access' : ''; ?>"
                data-id="<?php echo (int)$tpl['id']; ?>"
                data-name="<?php echo htmlspecialchars($tpl['template_name'], ENT_QUOTES); ?>"
                data-directions="<?php echo htmlspecialchars(implode(',', $tpl['directions_list']), ENT_QUOTES); ?>">
              <div class="template-item-info">
                <span class="template-item-name"><?php echo htmlspecialchars($tpl['template_name'], ENT_QUOTES); ?></span>
                <span class="template-item-meta">
                  <?php echo $tpl['template_type'] === 'banner' ? '🖼' : '🎬'; ?>
                  <?php echo count($tpl['geo_list']); ?> гео
                  <?php if (!empty($tpl['directions_list'])): ?>
                    · <?php echo implode(', ', $tpl['directions_list']); ?>
                  <?php endif; ?>
                </span>
              </div>
              <div class="template-item-actions">
                <?php if ($tpl['client_access']): ?>
                  <span class="template-badge badge-active">Активен</span>
                <?php endif; ?>
                <button class="delete-template-btn" data-id="<?php echo (int)$tpl['id']; ?>" type="button">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                </button>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>

    <!-- TAB 2: Editor (Settings + Preview combined) -->
    <div class="tab-panel" id="tabEditor" data-tab="editor">
      <form id="configForm" method="post" enctype="multipart/form-data" novalidate>
        <input type="hidden" name="template_id" id="template_id" value="">
        <input type="hidden" name="geo_list" id="geo_list" value="[]">
        <input type="hidden" name="currency_list" id="currency_list" value="[]">
        <input type="hidden" name="video_size" id="video_size" value="1x1">
        <input type="hidden" name="promo_start" id="promo_start" value="0.0">
        <input type="hidden" name="promo_end" id="promo_end" value="0.0">
        <input type="hidden" name="template_type" id="template_type" value="video">
        <input type="hidden" name="directions" id="directionsInput" value="">

        <!-- Template Name -->
        <div class="editor-section">
          <div class="template-name-container">
            <div class="template-name-wrapper">
              <input type="text" id="templateName" name="template_name" placeholder="Название шаблона" value="<?php echo htmlspecialchars($currentConfig['template_name'] ?? ''); ?>" style="display:none;">
              <div id="templateNameDisplay" class="template-name-display"><?php echo htmlspecialchars($currentConfig['template_name'] ?? 'Название шаблона'); ?></div>
            </div>
            <button type="button" class="btn-icon" id="addTemplateNameBtn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </div>
        </div>

        <!-- Preview Canvas -->
        <div class="editor-section editor-preview">
          <div class="canvas-wrapper">
            <div class="size-toggle">
              <button type="button" class="size-toggle-btn active" data-size="1x1">1:1</button>
              <button type="button" class="size-toggle-btn" data-size="9x16">9:16</button>
              <button type="button" id="deleteCurrentImageBtn" class="btn-icon btn-delete-image" style="display:none;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>

            <div id="canvasContainer" class="canvas-container">
              <video id="previewVideo" playsinline muted style="display:none;width:0;height:0;"></video>
              <!-- Video Timeline -->
              <div id="videoTimelineContainer" style="display:none;" class="video-timeline-container">
                <div id="videoTimeline" class="video-timeline">
                  <div id="selectedRange" class="timeline-range"></div>
                  <div id="startMarker" class="timeline-marker timeline-marker-edge" style="left:0;">
                    <span class="timeline-label">0s</span>
                  </div>
                  <div id="startRangeMarker" class="timeline-marker timeline-marker-drag" style="left:0%;">
                    <span id="startRangeLabel" class="timeline-label">0s</span>
                  </div>
                  <div id="endRangeMarker" class="timeline-marker timeline-marker-drag" style="left:100%;">
                    <span id="endRangeLabel" class="timeline-label">0s</span>
                  </div>
                  <div id="endMarker" class="timeline-marker timeline-marker-edge" style="right:0;">
                    <span id="durationLabel" class="timeline-label">0s</span>
                  </div>
                </div>
              </div>
              <canvas id="canvas" width="400" height="400"></canvas>
            </div>

            <div class="navigation-buttons">
              <button type="button" class="nav-button left-button">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
              <div class="image-nav-buttons"></div>
              <button type="button" class="nav-button right-button">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
              </button>
            </div>
          </div>

          <!-- Upload -->
          <div class="file-input-wrapper">
            <div class="file-input-button" id="fileInputLabel">ЗАГРУЗИТЬ ВИДЕО</div>
            <input type="file" name="custom_image" id="custom_image" accept="video/*">
          </div>
        </div>

        <!-- Geo & Currency -->
        <div class="editor-section">
          <h3 class="section-title">Гео и валюта</h3>
          <div class="form-row-2">
            <div class="form-group">
              <label>Гео</label>
              <div class="dropdown-with-button">
                <div class="custom-select">
                  <div class="select-selected" id="geoSelectDisplay">Выберите гео</div>
                  <div class="select-items select-hide" id="geoSelectOptions">
                    <?php foreach ($templates as $template): ?>
                      <?php foreach ($template['geo_list'] as $geo): ?>
                        <div class="select-item" data-value="<?php echo htmlspecialchars($geo); ?>">
                          <span><?php echo htmlspecialchars($geo); ?></span>
                        </div>
                      <?php endforeach; ?>
                    <?php endforeach; ?>
                  </div>
                  <input type="hidden" id="geoSelect" name="geo" required>
                </div>
                <div class="input-with-button">
                  <input type="text" id="geoInput" style="display:none;" autocomplete="off" placeholder="Код страны (US, DE...)">
                  <button type="button" class="done-button" id="geoDoneBtn" style="display:none;">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                  </button>
                </div>
                <button type="button" class="btn-icon" id="addGeoBtn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>
              <div id="geoSuggestions" class="autocomplete-suggestions" style="display:none;"></div>
            </div>
            <div class="form-group">
              <label>Валюта</label>
              <div class="dropdown-with-button">
                <select id="currencySelect" name="currency" required>
                  <option value="">Выберите валюту</option>
                  <?php foreach ($templates as $template): ?>
                    <?php foreach ($template['currency_list'] as $currency): ?>
                      <option value="<?php echo htmlspecialchars($currency); ?>"><?php echo htmlspecialchars($currency); ?></option>
                    <?php endforeach; ?>
                  <?php endforeach; ?>
                </select>
                <input type="text" id="currencyInput" style="display:none;width:100%;" autocomplete="off" placeholder="Валюта...">
                <button type="button" class="btn-icon" id="addCurrencyBtn">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
                </button>
              </div>
              <div id="currencySuggestions" class="autocomplete-suggestions" style="display:none;"></div>
            </div>
          </div>
        </div>

        <!-- Directions (tag chips) -->
        <div class="editor-section">
          <h3 class="section-title">Направления</h3>
          <div class="direction-chips" id="directionChips">
            <?php foreach ($allDirections as $dir): ?>
              <label class="direction-chip">
                <input type="checkbox" name="dir_check[]" value="<?php echo htmlspecialchars($dir['slug']); ?>">
                <span class="chip-label"><?php echo htmlspecialchars($dir['label']); ?></span>
              </label>
            <?php endforeach; ?>
          </div>
          <!-- Legacy hidden field for backward compat -->
          <select name="direction" id="directionSelect" style="display:none;">
            <option value="sport">Спорт</option>
            <option value="casino">Казино</option>
            <option value="universal">Универсальный</option>
          </select>
        </div>

        <!-- Promo Code & Text Settings -->
        <div class="editor-section">
          <h3 class="section-title">Промокод</h3>
          <div class="form-group">
            <input type="text" id="textInput" placeholder="Введите промокод" value="PROMO">
          </div>
        </div>

        <div class="editor-section">
          <h3 class="section-title">Расположение текста</h3>
          <div class="form-row-2">
            <div class="form-group">
              <label for="text_size">Размер</label>
              <input type="number" name="text_size" id="text_size" value="<?php echo $currentConfig['text_size']; ?>" min="10" max="200">
            </div>
            <div class="form-group">
              <label for="skew_angle">Наклон</label>
              <input type="number" name="skew_angle" id="skew_angle" value="<?php echo $currentConfig['skew_angle']; ?>" step="0.01" min="-90" max="90">
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label for="text_alignment">Выравнивание</label>
              <select name="text_alignment" id="text_alignment">
                <option value="left" <?php if($currentConfig['text_alignment']=='left') echo 'selected';?>>Слева</option>
                <option value="center" <?php if($currentConfig['text_alignment']=='center') echo 'selected';?>>По центру</option>
                <option value="right" <?php if($currentConfig['text_alignment']=='right') echo 'selected';?>>Справа</option>
              </select>
            </div>
            <div class="form-group">
              <label for="text_color">Цвет</label>
              <div class="color-input-row">
                <input type="text" name="text_color" id="text_color" placeholder="RRGGBB" value="<?php echo ltrim($currentConfig['text_color'], '#'); ?>" maxlength="6" pattern="[0-9A-Fa-f]{6}">
                <div id="colorPreview" class="color-preview" style="background-color: <?php echo htmlspecialchars($currentConfig['text_color']); ?>;"></div>
              </div>
            </div>
          </div>
          <div class="form-row-2">
            <div class="form-group">
              <label for="position_x">X</label>
              <input type="number" name="position_x" id="position_x" value="<?php echo $currentConfig['position_x']; ?>">
            </div>
            <div class="form-group">
              <label for="position_y">Y</label>
              <input type="number" name="position_y" id="position_y" value="<?php echo $currentConfig['position_y']; ?>">
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="editor-section editor-actions">
          <button type="submit" class="btn-primary btn-save">СОХРАНИТЬ</button>
          <button type="button" id="uploadToClientBtn" class="btn-secondary btn-client">ЗАЛИТЬ НА КЛИЕНТ</button>
        </div>
      </form>
    </div>
  </div>

  <!-- Create template modal -->
  <div id="createTemplateModal" class="modal-overlay" style="display:none;">
    <div class="modal-content">
      <p class="modal-title">Новый шаблон</p>
      <div class="modal-field">
        <label for="newTemplateName">Название</label>
        <input type="text" id="newTemplateName" placeholder="Название шаблона">
      </div>
      <div class="modal-field">
        <label>Тип</label>
        <div class="type-toggle">
          <button type="button" class="create-type-btn active" data-type="video">Видео</button>
          <button type="button" class="create-type-btn" data-type="banner">Фото</button>
        </div>
      </div>
      <div class="modal-actions">
        <button id="confirmCreateBtn" class="modal-confirm">Создать</button>
        <button id="cancelCreateBtn" class="modal-cancel">Отмена</button>
      </div>
    </div>
  </div>

  <div id="deleteModal" class="modal-overlay" style="display:none;">
    <div class="modal-content">
      <p>Вы уверены, что хотите удалить шаблон?</p>
      <div class="modal-actions">
        <button id="confirmDeleteBtn" class="modal-confirm">Да</button>
        <button id="cancelDeleteBtn" class="modal-cancel">Нет</button>
      </div>
    </div>
  </div>

  <div id="deleteImageModal" class="modal-overlay" style="display:none;">
    <div class="modal-content">
      <p>Вы уверены, что хотите удалить видео?</p>
      <div class="modal-actions">
        <button id="confirmImageDeleteBtn" class="modal-confirm">Да</button>
        <button id="cancelImageDeleteBtn" class="modal-cancel">Нет</button>
      </div>
    </div>
  </div>

  <script>
    window.templates = <?= json_encode($templates, JSON_UNESCAPED_SLASHES) ?>;
    window.adminConfig = <?php echo json_encode($currentConfig, JSON_UNESCAPED_SLASHES); ?>;
    window.allDirections = <?= json_encode($allDirections, JSON_UNESCAPED_SLASHES) ?>;
  </script>
  <script src="dist/js/admin.bundle.js"></script>
</body>
</html>

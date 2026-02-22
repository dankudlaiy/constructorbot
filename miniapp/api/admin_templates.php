<?php
/**
 * Admin Templates API — used by the embedded admin screen in the Telegram Mini App.
 * Protected by session-based admin auth (same as admin.php).
 *
 * GET  ?action=list              — return all templates with aggregated data
 * POST action=toggle_access       — toggle client_access for a template
 * POST action=delete              — delete a template
 */

ini_set('display_errors', '0');
ini_set('html_errors', '0');
error_reporting(E_ALL);
header('Content-Type: application/json');

// Session-based admin auth — same mechanism as admin.php
if (session_status() === PHP_SESSION_NONE) session_start();

if (empty($_SESSION['admin_logged_in'])) {
    http_response_code(401);
    echo json_encode(['error' => 'Unauthorized']);
    exit;
}

require __DIR__ . '/../../../vendor/autoload.php';
use Dotenv\Dotenv;
Dotenv::createImmutable(dirname(__DIR__, 3))->safeLoad();

$url  = parse_url($_ENV['DATABASE_URL']);
$dsn  = "pgsql:host={$url['host']};port=" . ($url['port'] ?? 5432) . ";dbname=" . ltrim($url['path'], '/');
try {
    $pdo = new PDO($dsn, $url['user'] ?? '', $url['pass'] ?? '', [
        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['error' => 'DB error']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];

// ---- GET: list templates ----
if ($method === 'GET') {
    $action = $_GET['action'] ?? 'list';

    if ($action === 'list') {
        $rows = $pdo->query("
            SELECT t.id, t.template_name, t.direction, t.template_type, t.client_access, t.created_at,
                   array_remove(array_agg(DISTINCT ti.geo), NULL) AS geo_list,
                   array_remove(array_agg(DISTINCT ti.currency), NULL) AS currency_list,
                   count(DISTINCT ti.id) AS image_count,
                   COALESCE(
                       (SELECT array_agg(d.slug) FROM template_directions td JOIN directions d ON d.id = td.direction_id WHERE td.template_id = t.id),
                       CASE WHEN t.direction IS NOT NULL AND t.direction != '' THEN ARRAY[t.direction] ELSE ARRAY[]::text[] END
                   ) AS directions_list
            FROM templates t
            LEFT JOIN template_images ti ON ti.template_id = t.id
            GROUP BY t.id
            ORDER BY t.created_at DESC
        ")->fetchAll();

        // Parse Postgres arrays
        foreach ($rows as &$row) {
            foreach (['geo_list', 'currency_list', 'directions_list'] as $col) {
                if (is_string($row[$col])) {
                    $row[$col] = array_values(array_filter(str_getcsv(trim($row[$col], '{}'))));
                }
                if (!is_array($row[$col])) $row[$col] = [];
            }
            $row['image_count'] = (int)$row['image_count'];
            $row['client_access'] = (bool)$row['client_access'];
        }
        unset($row);

        echo json_encode(['ok' => true, 'templates' => $rows]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}

// ---- POST: mutations ----
if ($method === 'POST') {
    $body = json_decode(file_get_contents('php://input'), true) ?? [];
    $action = $body['action'] ?? '';

    if ($action === 'toggle_access') {
        $id = (int)($body['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); exit; }

        $row = $pdo->prepare("SELECT client_access FROM templates WHERE id = ?");
        $row->execute([$id]);
        $current = $row->fetchColumn();

        $pdo->prepare("UPDATE templates SET client_access = ? WHERE id = ?")
            ->execute([$current ? 'false' : 'true', $id]);

        echo json_encode(['ok' => true, 'client_access' => !$current]);
        exit;
    }

    if ($action === 'delete') {
        $id = (int)($body['id'] ?? 0);
        if (!$id) { http_response_code(400); echo json_encode(['error' => 'Missing id']); exit; }

        // Get images to delete files
        $images = $pdo->prepare("SELECT image_url FROM template_images WHERE template_id = ?");
        $images->execute([$id]);
        foreach ($images->fetchAll() as $img) {
            if ($img['image_url'] && $img['image_url'] !== 'tmp') {
                $previewPath = __DIR__ . '/../../' . ltrim($img['image_url'], '/');
                $videoPath   = dirname($previewPath) . '/../videos/' . pathinfo(basename($previewPath), PATHINFO_FILENAME) . '.mp4';
                @unlink($previewPath);
                @unlink($videoPath);
            }
        }

        $pdo->prepare("DELETE FROM template_images WHERE template_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM template_directions WHERE template_id = ?")->execute([$id]);
        $pdo->prepare("DELETE FROM templates WHERE id = ?")->execute([$id]);

        echo json_encode(['ok' => true]);
        exit;
    }

    http_response_code(400);
    echo json_encode(['error' => 'Unknown action']);
    exit;
}

http_response_code(405);
echo json_encode(['error' => 'Method not allowed']);

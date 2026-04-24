<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';

turnout_cors();
turnout_require_method('GET');

$pdo = turnout_db();
$user = turnout_current_user();
$mine = isset($_GET['mine']) && $_GET['mine'] === '1';

$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = min(50, max(1, (int)($_GET['per_page'] ?? 12)));
$offset = ($page - 1) * $perPage;

if ($mine) {
    $u = turnout_require_role('organizer');
    $countStmt = $pdo->prepare('SELECT COUNT(*) c FROM events WHERE organizer_id = ?');
    $countStmt->execute([$u['sub']]);
    $total = (int)$countStmt->fetch()['c'];
    $stmt = $pdo->prepare(
        'SELECT id, title, slug, status, starts_at, cover_image_url, updated_at
         FROM events WHERE organizer_id = ?
         ORDER BY updated_at DESC LIMIT ? OFFSET ?'
    );
    $stmt->bindValue(1, $u['sub']);
    $stmt->bindValue(2, $perPage, PDO::PARAM_INT);
    $stmt->bindValue(3, $offset, PDO::PARAM_INT);
    $stmt->execute();
} else {
    $countStmt = $pdo->query("SELECT COUNT(*) c FROM events WHERE status = 'published'");
    $total = (int)$countStmt->fetch()['c'];
    $stmt = $pdo->prepare(
        "SELECT e.id, e.title, e.slug, e.starts_at, e.cover_image_url, p.full_name organizer_name
         FROM events e
         JOIN profiles p ON p.id = e.organizer_id
         WHERE e.status = 'published'
         ORDER BY e.starts_at IS NULL, e.starts_at ASC, e.created_at DESC
         LIMIT ? OFFSET ?"
    );
    $stmt->bindValue(1, $perPage, PDO::PARAM_INT);
    $stmt->bindValue(2, $offset, PDO::PARAM_INT);
    $stmt->execute();
}

$rows = $stmt->fetchAll();
turnout_json_response([
    'ok' => true,
    'data' => $rows,
    'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
]);

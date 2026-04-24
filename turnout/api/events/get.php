<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('GET');

$pdo = turnout_db();
$id = isset($_GET['id']) ? (string)$_GET['id'] : '';
$slug = isset($_GET['slug']) ? (string)$_GET['slug'] : '';

if ($slug !== '') {
    $slug = turnout_validate_string($slug, 1, 160, 'slug');
    $stmt = $pdo->prepare(
        'SELECT e.*, p.full_name organizer_name
         FROM events e
         JOIN profiles p ON p.id = e.organizer_id
         WHERE e.slug = ? LIMIT 1'
    );
    $stmt->execute([$slug]);
} elseif ($id !== '') {
    $stmt = $pdo->prepare(
        'SELECT e.*, p.full_name organizer_name
         FROM events e
         JOIN profiles p ON p.id = e.organizer_id
         WHERE e.id = ? LIMIT 1'
    );
    $stmt->execute([$id]);
} else {
    turnout_json_response(['ok' => false, 'error' => 'missing_identifier'], 400);
}

$row = $stmt->fetch();
if (!$row) {
    turnout_json_response(['ok' => false, 'error' => 'not_found'], 404);
}

$user = turnout_current_user();
$isOwner = $user && ($user['sub'] ?? '') === $row['organizer_id'];
$isAdmin = $user && ($user['role'] ?? '') === 'admin';
if ($row['status'] !== 'published' && !$isOwner && !$isAdmin) {
    turnout_json_response(['ok' => false, 'error' => 'not_found'], 404);
}

$pageSchema = json_decode($row['page_schema'] ?: '{}', true);
if (!is_array($pageSchema)) {
    $pageSchema = turnout_default_page_schema();
}
$row['page_schema'] = $pageSchema;

$tierStmt = $pdo->prepare(
    "SELECT id, name, description, price_lkr, quantity, sold, is_active
     FROM ticket_tiers WHERE event_id = ? AND is_active = 1 ORDER BY sort_order ASC, created_at ASC"
);
$tierStmt->execute([$row['id']]);
$row['ticket_tiers'] = $tierStmt->fetchAll();

turnout_json_response(['ok' => true, 'event' => $row]);

<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';

turnout_cors();
turnout_require_method('GET');

$eventId = isset($_GET['event_id']) ? (string)$_GET['event_id'] : '';
if (strlen($eventId) !== 36) {
    turnout_json_response(['ok' => false, 'error' => 'invalid_event'], 400);
}

$pdo = turnout_db();
$stmt = $pdo->prepare(
    'SELECT r.id, r.rating, r.comment, r.created_at, p.full_name author_name
     FROM reviews r
     JOIN profiles p ON p.id = r.user_id
     WHERE r.event_id = ?
     ORDER BY r.created_at DESC
     LIMIT 100'
);
$stmt->execute([$eventId]);
turnout_json_response(['ok' => true, 'reviews' => $stmt->fetchAll()]);

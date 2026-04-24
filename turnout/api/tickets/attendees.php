<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('GET');

$user = turnout_require_role('organizer');
$eventId = turnout_validate_string($_GET['event_id'] ?? '', 36, 36, 'event_id');

$pdo = turnout_db();
$stmt = $pdo->prepare('SELECT id FROM events WHERE id = ? AND organizer_id = ?');
$stmt->execute([$eventId, $user['sub']]);
if (!$stmt->fetch()) {
    turnout_json_response(['ok' => false, 'error' => 'not_found'], 404);
}

$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = min(100, max(1, (int)($_GET['per_page'] ?? 25)));
$offset = ($page - 1) * $perPage;

$c = $pdo->prepare('SELECT COUNT(*) n FROM registrations WHERE event_id = ?');
$c->execute([$eventId]);
$total = (int)$c->fetch()['n'];

$q = $pdo->prepare(
    'SELECT r.*, t.name tier_name
     FROM registrations r
     JOIN ticket_tiers t ON t.id = r.ticket_tier_id
     WHERE r.event_id = ?
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?'
);
$q->bindValue(1, $eventId);
$q->bindValue(2, $perPage, PDO::PARAM_INT);
$q->bindValue(3, $offset, PDO::PARAM_INT);
$q->execute();

turnout_json_response([
    'ok' => true,
    'data' => $q->fetchAll(),
    'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
]);

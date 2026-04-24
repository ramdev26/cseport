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

$t = $pdo->prepare(
    'SELECT * FROM ticket_tiers WHERE event_id = ? ORDER BY sort_order ASC, created_at ASC'
);
$t->execute([$eventId]);
turnout_json_response(['ok' => true, 'tiers' => $t->fetchAll()]);

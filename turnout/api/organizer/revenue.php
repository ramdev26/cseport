<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('GET');
$user = turnout_require_role('organizer');

$eventId = isset($_GET['event_id']) ? (string)$_GET['event_id'] : '';
$pdo = turnout_db();

if ($eventId !== '') {
    turnout_validate_string($eventId, 36, 36, 'event_id');
    $chk = $pdo->prepare('SELECT id FROM events WHERE id = ? AND organizer_id = ?');
    $chk->execute([$eventId, $user['sub']]);
    if (!$chk->fetch()) {
        turnout_json_response(['ok' => false, 'error' => 'not_found'], 404);
    }
    $sum = $pdo->prepare(
        "SELECT COALESCE(SUM(amount_lkr),0) gross, COUNT(*) sales
         FROM registrations WHERE event_id = ? AND payment_status = 'paid'"
    );
    $sum->execute([$eventId]);
    $row = $sum->fetch();
    turnout_json_response(['ok' => true, 'summary' => $row]);
}

$sum = $pdo->prepare(
    "SELECT COALESCE(SUM(r.amount_lkr),0) gross, COUNT(*) sales
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE e.organizer_id = ? AND r.payment_status = 'paid'"
);
$sum->execute([$user['sub']]);
turnout_json_response(['ok' => true, 'summary' => $sum->fetch()]);

<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('POST');

$user = turnout_require_roles(['attendee', 'organizer']);
$body = turnout_read_json_body();
$eventId = turnout_validate_string($body['event_id'] ?? null, 36, 36, 'event_id');
$rating = turnout_validate_int($body['rating'] ?? null, 1, 5, 'rating');
$comment = isset($body['comment']) && is_string($body['comment']) ? mb_substr(trim($body['comment']), 0, 2000) : '';

$pdo = turnout_db();
$ev = $pdo->prepare("SELECT id FROM events WHERE id = ? AND status = 'published'");
$ev->execute([$eventId]);
if (!$ev->fetch()) {
    turnout_json_response(['ok' => false, 'error' => 'not_found'], 404);
}

$paid = $pdo->prepare(
    "SELECT id FROM registrations WHERE event_id = ? AND user_id = ? AND payment_status = 'paid' LIMIT 1"
);
$paid->execute([$eventId, $user['sub']]);
if (!$paid->fetch()) {
    turnout_json_response(['ok' => false, 'error' => 'must_attend'], 403);
}

$id = turnout_uuid();
try {
    $pdo->prepare(
        'INSERT INTO reviews (id, event_id, user_id, rating, comment) VALUES (?,?,?,?,?)'
    )->execute([$id, $eventId, $user['sub'], $rating, $comment !== '' ? $comment : null]);
} catch (Throwable $e) {
    turnout_json_response(['ok' => false, 'error' => 'already_reviewed'], 409);
}

turnout_json_response(['ok' => true, 'review' => ['id' => $id]], 201);

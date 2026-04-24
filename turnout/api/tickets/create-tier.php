<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('POST');

$user = turnout_require_role('organizer');
$body = turnout_read_json_body();
$eventId = turnout_validate_string($body['event_id'] ?? null, 36, 36, 'event_id');
$name = turnout_validate_string($body['name'] ?? null, 1, 120, 'name');
$description = isset($body['description']) && is_string($body['description'])
    ? mb_substr($body['description'], 0, 512)
    : null;
$price = turnout_validate_int($body['price_lkr'] ?? 0, 0, 100000000, 'price_lkr');
$quantity = turnout_validate_int($body['quantity'] ?? 0, 0, 1000000, 'quantity');

$pdo = turnout_db();
$stmt = $pdo->prepare('SELECT id FROM events WHERE id = ? AND organizer_id = ?');
$stmt->execute([$eventId, $user['sub']]);
if (!$stmt->fetch()) {
    turnout_json_response(['ok' => false, 'error' => 'not_found'], 404);
}

$id = turnout_uuid();
$pdo->prepare(
    'INSERT INTO ticket_tiers (id, event_id, name, description, price_lkr, quantity, sold, is_active, sort_order)
     VALUES (?,?,?,?,?,?,0,1,0)'
)->execute([$id, $eventId, $name, $description, $price, $quantity]);

turnout_json_response(['ok' => true, 'tier' => ['id' => $id]], 201);

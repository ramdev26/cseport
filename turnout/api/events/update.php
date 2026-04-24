<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('PUT');

$user = turnout_require_role('organizer');
$body = turnout_read_json_body();
$id = turnout_validate_string($body['id'] ?? null, 36, 36, 'id');

$pdo = turnout_db();
$stmt = $pdo->prepare('SELECT * FROM events WHERE id = ?');
$stmt->execute([$id]);
$event = $stmt->fetch();
if (!$event) {
    turnout_json_response(['ok' => false, 'error' => 'not_found'], 404);
}
if ($event['organizer_id'] !== $user['sub'] && ($user['role'] ?? '') !== 'admin') {
    turnout_json_response(['ok' => false, 'error' => 'forbidden'], 403);
}

$fields = [];
$params = [];

if (isset($body['title'])) {
    $fields[] = 'title = ?';
    $params[] = turnout_validate_string($body['title'], 3, 255, 'title');
}
if (array_key_exists('description', $body)) {
    $fields[] = 'description = ?';
    $params[] = is_string($body['description']) ? mb_substr(trim($body['description']), 0, 5000) : null;
}
if (array_key_exists('venue', $body)) {
    $fields[] = 'venue = ?';
    $params[] = is_string($body['venue']) ? mb_substr(trim($body['venue']), 0, 255) : null;
}
if (array_key_exists('starts_at', $body)) {
    $fields[] = 'starts_at = ?';
    $params[] = is_string($body['starts_at']) && $body['starts_at'] !== '' ? $body['starts_at'] : null;
}
if (array_key_exists('ends_at', $body)) {
    $fields[] = 'ends_at = ?';
    $params[] = is_string($body['ends_at']) && $body['ends_at'] !== '' ? $body['ends_at'] : null;
}
if (isset($body['status'])) {
    $fields[] = 'status = ?';
    $params[] = turnout_validate_in($body['status'], ['draft', 'published', 'cancelled'], 'status');
}
if (isset($body['slug'])) {
    $newSlug = turnout_slugify((string)$body['slug']);
    $check = $pdo->prepare('SELECT id FROM events WHERE slug = ? AND id <> ?');
    $check->execute([$newSlug, $id]);
    if ($check->fetch()) {
        turnout_json_response(['ok' => false, 'error' => 'slug_in_use'], 409);
    }
    $fields[] = 'slug = ?';
    $params[] = $newSlug;
}
if (isset($body['page_schema'])) {
    if (!is_array($body['page_schema'])) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_page_schema'], 422);
    }
    $fields[] = 'page_schema = ?';
    $params[] = json_encode($body['page_schema'], JSON_UNESCAPED_SLASHES);
}
if (array_key_exists('cover_image_url', $body)) {
    $fields[] = 'cover_image_url = ?';
    $params[] = is_string($body['cover_image_url']) ? mb_substr($body['cover_image_url'], 0, 512) : null;
}

if ($fields === []) {
    turnout_json_response(['ok' => true, 'event' => $event]);
}

$params[] = $id;
$sql = 'UPDATE events SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?';
$pdo->prepare($sql)->execute($params);

$stmt = $pdo->prepare('SELECT * FROM events WHERE id = ?');
$stmt->execute([$id]);
$row = $stmt->fetch();
$row['page_schema'] = json_decode($row['page_schema'] ?: '{}', true);

turnout_json_response(['ok' => true, 'event' => $row]);

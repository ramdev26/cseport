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

$title = turnout_validate_string($body['title'] ?? null, 3, 255, 'title');
$slugInput = isset($body['slug']) ? (string)$body['slug'] : '';
$slug = $slugInput !== '' ? turnout_slugify($slugInput) : turnout_slugify($title);
$description = isset($body['description']) && is_string($body['description'])
    ? mb_substr(trim($body['description']), 0, 5000)
    : null;
$venue = isset($body['venue']) && is_string($body['venue']) ? mb_substr(trim($body['venue']), 0, 255) : null;
$startsAt = isset($body['starts_at']) && is_string($body['starts_at']) ? $body['starts_at'] : null;
$endsAt = isset($body['ends_at']) && is_string($body['ends_at']) ? $body['ends_at'] : null;
$status = turnout_validate_in($body['status'] ?? 'draft', ['draft', 'published', 'cancelled'], 'status');

$pdo = turnout_db();
$baseSlug = $slug;
for ($i = 0; $i < 20; $i++) {
    $check = $pdo->prepare('SELECT id FROM events WHERE slug = ?');
    $check->execute([$slug]);
    if (!$check->fetch()) {
        break;
    }
    $slug = $baseSlug . '-' . substr(turnout_uuid(), 0, 8);
}

$id = turnout_uuid();
$schema = turnout_default_page_schema();
$schemaJson = json_encode($schema, JSON_UNESCAPED_SLASHES);

$pdo->prepare(
    'INSERT INTO events (id, organizer_id, title, slug, description, venue, starts_at, ends_at, status, page_schema)
     VALUES (?,?,?,?,?,?,?,?,?,?)'
)->execute([
    $id,
    $user['sub'],
    $title,
    $slug,
    $description,
    $venue,
    $startsAt ?: null,
    $endsAt ?: null,
    $status,
    $schemaJson,
]);

turnout_json_response(['ok' => true, 'event' => ['id' => $id, 'slug' => $slug]], 201);

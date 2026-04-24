<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('GET');

$user = turnout_require_roles(['attendee', 'organizer', 'admin']);
$pdo = turnout_db();

$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = min(50, max(1, (int)($_GET['per_page'] ?? 20)));
$offset = ($page - 1) * $perPage;

$c = $pdo->prepare('SELECT COUNT(*) n FROM registrations WHERE user_id = ? AND payment_status = "paid"');
$c->execute([$user['sub']]);
$total = (int)$c->fetch()['n'];

$q = $pdo->prepare(
    'SELECT r.*, e.title event_title, e.slug event_slug, t.name tier_name
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     JOIN ticket_tiers t ON t.id = r.ticket_tier_id
     WHERE r.user_id = ? AND r.payment_status = "paid"
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?'
);
$q->bindValue(1, $user['sub']);
$q->bindValue(2, $perPage, PDO::PARAM_INT);
$q->bindValue(3, $offset, PDO::PARAM_INT);
$q->execute();

turnout_json_response([
    'ok' => true,
    'data' => $q->fetchAll(),
    'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
]);

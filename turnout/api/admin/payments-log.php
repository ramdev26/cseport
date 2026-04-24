<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';

turnout_cors();
turnout_require_method('GET');
turnout_require_role('admin');

$pdo = turnout_db();
$page = max(1, (int)($_GET['page'] ?? 1));
$perPage = min(100, max(1, (int)($_GET['per_page'] ?? 25)));
$offset = ($page - 1) * $perPage;

$total = (int)$pdo->query('SELECT COUNT(*) c FROM registrations')->fetch()['c'];
$stmt = $pdo->prepare(
    'SELECT r.id, r.payment_status, r.amount_lkr, r.payhere_payment_id, r.created_at,
            e.title event_title, p.email user_email
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN profiles p ON p.id = r.user_id
     ORDER BY r.created_at DESC
     LIMIT ? OFFSET ?'
);
$stmt->bindValue(1, $perPage, PDO::PARAM_INT);
$stmt->bindValue(2, $offset, PDO::PARAM_INT);
$stmt->execute();

turnout_json_response([
    'ok' => true,
    'data' => $stmt->fetchAll(),
    'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
]);

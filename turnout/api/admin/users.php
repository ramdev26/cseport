<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_role('admin');

$pdo = turnout_db();
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

if ($method === 'GET') {
    $page = max(1, (int)($_GET['page'] ?? 1));
    $perPage = min(100, max(1, (int)($_GET['per_page'] ?? 20)));
    $offset = ($page - 1) * $perPage;
    $total = (int)$pdo->query('SELECT COUNT(*) c FROM profiles')->fetch()['c'];
    $stmt = $pdo->prepare(
        'SELECT id, email, full_name, role, created_at FROM profiles ORDER BY created_at DESC LIMIT ? OFFSET ?'
    );
    $stmt->bindValue(1, $perPage, PDO::PARAM_INT);
    $stmt->bindValue(2, $offset, PDO::PARAM_INT);
    $stmt->execute();
    turnout_json_response([
        'ok' => true,
        'data' => $stmt->fetchAll(),
        'meta' => ['page' => $page, 'per_page' => $perPage, 'total' => $total],
    ]);
}

if ($method === 'PATCH') {
    $body = turnout_read_json_body();
    $id = turnout_validate_string($body['id'] ?? null, 36, 36, 'id');
    $role = turnout_validate_in($body['role'] ?? '', ['attendee', 'organizer', 'admin'], 'role');
    $stmt = $pdo->prepare('UPDATE profiles SET role = ?, updated_at = NOW() WHERE id = ?');
    $stmt->execute([$role, $id]);
    turnout_json_response(['ok' => true]);
}

turnout_json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);

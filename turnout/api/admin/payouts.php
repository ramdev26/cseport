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
    $total = (int)$pdo->query('SELECT COUNT(*) c FROM payout_history')->fetch()['c'];
    $stmt = $pdo->prepare(
        'SELECT ph.*, p.email organizer_email, p.full_name organizer_name
         FROM payout_history ph
         JOIN profiles p ON p.id = ph.organizer_id
         ORDER BY ph.created_at DESC LIMIT ? OFFSET ?'
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

if ($method === 'POST') {
    turnout_require_method('POST');
    $body = turnout_read_json_body();
    $organizerId = turnout_validate_string($body['organizer_id'] ?? null, 36, 36, 'organizer_id');
    $amount = turnout_validate_int($body['amount_lkr'] ?? null, 1, 1000000000, 'amount_lkr');
    $reference = isset($body['reference']) && is_string($body['reference'])
        ? mb_substr(trim($body['reference']), 0, 120)
        : null;
    $notes = isset($body['notes']) && is_string($body['notes']) ? mb_substr($body['notes'], 0, 2000) : null;

    $chk = $pdo->prepare('SELECT id, role FROM profiles WHERE id = ?');
    $chk->execute([$organizerId]);
    $row = $chk->fetch();
    if (!$row || !in_array($row['role'], ['organizer', 'admin'], true)) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_organizer'], 422);
    }

    $id = turnout_uuid();
    $pdo->prepare(
        'INSERT INTO payout_history (id, organizer_id, amount_lkr, reference, notes) VALUES (?,?,?,?,?)'
    )->execute([$id, $organizerId, $amount, $reference, $notes]);
    turnout_json_response(['ok' => true, 'payout' => ['id' => $id]], 201);
}

turnout_json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);

<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';

turnout_cors();
turnout_require_method('POST');

$body = turnout_read_json_body();
$email = turnout_validate_email($body['email'] ?? null);
$password = turnout_validate_string($body['password'] ?? null, 8, 200, 'password');
$fullName = turnout_validate_string($body['full_name'] ?? null, 2, 255, 'full_name');
$role = turnout_validate_in($body['role'] ?? 'attendee', ['attendee', 'organizer'], 'role');

$pdo = turnout_db();
$stmt = $pdo->prepare('SELECT id FROM profiles WHERE email = ?');
$stmt->execute([$email]);
if ($stmt->fetch()) {
    turnout_json_response(['ok' => false, 'error' => 'email_in_use'], 409);
}

$id = turnout_uuid();
$hash = password_hash($password, PASSWORD_DEFAULT);
$pdo->beginTransaction();
try {
    $pdo->prepare(
        'INSERT INTO profiles (id, email, password_hash, full_name, role) VALUES (?,?,?,?,?)'
    )->execute([$id, $email, $hash, $fullName, $role]);

    if ($role === 'organizer') {
        $orgName = turnout_validate_string($body['org_name'] ?? $fullName, 2, 255, 'org_name');
        $pdo->prepare(
            'INSERT INTO organizer_profiles (user_id, org_name) VALUES (?,?)'
        )->execute([$id, $orgName]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    turnout_json_response(['ok' => false, 'error' => 'server_error'], 500);
}

$cfg = require __DIR__ . '/../includes/config.php';
$token = turnout_jwt_encode(
    ['sub' => $id, 'email' => $email, 'role' => $role, 'name' => $fullName],
    $cfg['jwt']['secret'],
    $cfg['jwt']['issuer'],
    (int)$cfg['jwt']['ttl_seconds']
);
turnout_set_auth_cookie($token);

turnout_json_response([
    'ok' => true,
    'user' => ['id' => $id, 'email' => $email, 'full_name' => $fullName, 'role' => $role],
]);

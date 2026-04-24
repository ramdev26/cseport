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
$password = turnout_validate_string($body['password'] ?? null, 1, 200, 'password');

$pdo = turnout_db();
$stmt = $pdo->prepare('SELECT id, email, password_hash, full_name, role FROM profiles WHERE email = ?');
$stmt->execute([$email]);
$row = $stmt->fetch();
if (!$row || !password_verify($password, $row['password_hash'])) {
    turnout_json_response(['ok' => false, 'error' => 'invalid_credentials'], 401);
}

$cfg = require __DIR__ . '/../includes/config.php';
$token = turnout_jwt_encode(
    [
        'sub' => $row['id'],
        'email' => $row['email'],
        'role' => $row['role'],
        'name' => $row['full_name'],
    ],
    $cfg['jwt']['secret'],
    $cfg['jwt']['issuer'],
    (int)$cfg['jwt']['ttl_seconds']
);
turnout_set_auth_cookie($token);

turnout_json_response([
    'ok' => true,
    'user' => [
        'id' => $row['id'],
        'email' => $row['email'],
        'full_name' => $row['full_name'],
        'role' => $row['role'],
    ],
]);

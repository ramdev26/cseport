<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';

turnout_cors();
turnout_require_method('GET');

$user = turnout_current_user();
if (!$user) {
    turnout_json_response(['ok' => false, 'error' => 'unauthorized'], 401);
}

$pdo = turnout_db();
$stmt = $pdo->prepare('SELECT id, email, full_name, role, avatar_url FROM profiles WHERE id = ?');
$stmt->execute([$user['sub']]);
$row = $stmt->fetch();
if (!$row) {
    turnout_json_response(['ok' => false, 'error' => 'unauthorized'], 401);
}

turnout_json_response(['ok' => true, 'user' => $row]);

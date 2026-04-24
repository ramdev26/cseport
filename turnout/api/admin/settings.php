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
    $row = $pdo->query('SELECT id, platform_fee_bps, currency, payhere_merchant_id, payhere_sandbox FROM platform_settings WHERE id = 1')->fetch();
    turnout_json_response(['ok' => true, 'settings' => $row]);
}

if ($method === 'PUT') {
    turnout_require_method('PUT');
    $body = turnout_read_json_body();
    $fee = isset($body['platform_fee_bps']) ? turnout_validate_int($body['platform_fee_bps'], 0, 5000, 'platform_fee_bps') : null;
    $currency = isset($body['currency']) ? turnout_validate_string($body['currency'], 3, 3, 'currency') : null;
    $mid = array_key_exists('payhere_merchant_id', $body)
        ? (is_string($body['payhere_merchant_id']) ? trim($body['payhere_merchant_id']) : '')
        : null;
    $secret = array_key_exists('payhere_merchant_secret', $body) && is_string($body['payhere_merchant_secret'])
        ? $body['payhere_merchant_secret']
        : null;
    $sandbox = isset($body['payhere_sandbox']) ? ($body['payhere_sandbox'] ? 1 : 0) : null;

    $fields = [];
    $params = [];
    if ($fee !== null) {
        $fields[] = 'platform_fee_bps = ?';
        $params[] = $fee;
    }
    if ($currency !== null) {
        $fields[] = 'currency = ?';
        $params[] = strtoupper($currency);
    }
    if ($mid !== null) {
        $fields[] = 'payhere_merchant_id = ?';
        $params[] = $mid;
    }
    if ($secret !== null && $secret !== '') {
        $fields[] = 'payhere_merchant_secret = ?';
        $params[] = $secret;
    }
    if ($sandbox !== null) {
        $fields[] = 'payhere_sandbox = ?';
        $params[] = $sandbox;
    }
    if ($fields === []) {
        turnout_json_response(['ok' => true]);
    }
    $params[] = 1;
    $pdo->prepare('UPDATE platform_settings SET ' . implode(', ', $fields) . ', updated_at = NOW() WHERE id = ?')->execute($params);
    turnout_json_response(['ok' => true]);
}

turnout_json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);

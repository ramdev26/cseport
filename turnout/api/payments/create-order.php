<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';
require __DIR__ . '/../includes/util.php';
require __DIR__ . '/../includes/payhere.php';

turnout_cors();
turnout_require_method('POST');

$body = turnout_read_json_body();
$eventId = turnout_validate_string($body['event_id'] ?? null, 36, 36, 'event_id');
$tierId = turnout_validate_string($body['ticket_tier_id'] ?? null, 36, 36, 'ticket_tier_id');

$current = turnout_current_user();
$userId = $current['sub'] ?? null;
$attendeeName = isset($body['attendee_name']) && is_string($body['attendee_name'])
    ? trim($body['attendee_name'])
    : '';
$attendeeEmail = isset($body['attendee_email']) && is_string($body['attendee_email'])
    ? trim($body['attendee_email'])
    : '';

if ($current) {
    if ($attendeeName === '') {
        $attendeeName = (string)($current['name'] ?? '');
    }
    if ($attendeeEmail === '') {
        $attendeeEmail = (string)($current['email'] ?? '');
    }
}

if ($attendeeName === '' || $attendeeEmail === '') {
    turnout_json_response(['ok' => false, 'error' => 'attendee_details_required'], 422);
}
$attendeeEmail = turnout_validate_email($attendeeEmail);
$attendeeName = turnout_validate_string($attendeeName, 2, 255, 'attendee_name');

$pdo = turnout_db();
$settings = $pdo->query('SELECT * FROM platform_settings WHERE id = 1')->fetch();
$merchantId = $settings['payhere_merchant_id'] ?: (require __DIR__ . '/../includes/config.php')['payhere']['merchant_id'];
$merchantSecret = $settings['payhere_merchant_secret'] ?: (require __DIR__ . '/../includes/config.php')['payhere']['merchant_secret'];
$sandbox = (int)($settings['payhere_sandbox'] ?? 1) === 1;

if ($merchantId === '' || $merchantSecret === '') {
    turnout_json_response(['ok' => false, 'error' => 'payhere_not_configured'], 503);
}

$pdo->beginTransaction();
try {
    $tierStmt = $pdo->prepare(
        'SELECT t.*, e.title event_title, e.status, e.slug
         FROM ticket_tiers t
         JOIN events e ON e.id = t.event_id
         WHERE t.id = ? AND t.event_id = ? FOR UPDATE'
    );
    $tierStmt->execute([$tierId, $eventId]);
    $tier = $tierStmt->fetch();
    if (!$tier || $tier['is_active'] != 1) {
        $pdo->rollBack();
        turnout_json_response(['ok' => false, 'error' => 'invalid_tier'], 404);
    }
    if ($tier['status'] !== 'published') {
        $pdo->rollBack();
        turnout_json_response(['ok' => false, 'error' => 'event_not_published'], 400);
    }
    if ($tier['quantity'] > 0 && (int)$tier['sold'] >= (int)$tier['quantity']) {
        $pdo->rollBack();
        turnout_json_response(['ok' => false, 'error' => 'sold_out'], 409);
    }

    $regId = turnout_uuid();
    $amount = (int)$tier['price_lkr'];
    $pdo->prepare(
        'INSERT INTO registrations (id, event_id, user_id, ticket_tier_id, payment_status, amount_lkr, attendee_name, attendee_email)
         VALUES (?,?,?,?,?,?,?,?)'
    )->execute([
        $regId,
        $eventId,
        $userId,
        $tierId,
        'pending',
        $amount,
        $attendeeName,
        $attendeeEmail,
    ]);

    $currency = $settings['currency'] ?: 'LKR';
    $amountStr = number_format($amount, 2, '.', '');
    $hash = turnout_payhere_hash($merchantId, $regId, $amountStr, $currency, $merchantSecret);

    $cfg = require __DIR__ . '/../includes/config.php';
    $returnUrl = $cfg['app']['public_url'] . '/attendee/payment/success?registration_id=' . urlencode($regId);
    $cancelUrl = $cfg['app']['public_url'] . '/e/' . rawurlencode($tier['slug']);
    $notifyUrl = $cfg['app']['api_public_url'] . '/payments/notify.php';

    $itemsPayload = [
        [
            'name' => $tier['event_title'] . ' — ' . $tier['name'],
            'quantity' => 1,
            'unit_price' => $amount,
        ],
    ];
    $itemsEncoded = base64_encode(json_encode($itemsPayload, JSON_UNESCAPED_UNICODE));

    $pdo->commit();
} catch (Throwable $e) {
    $pdo->rollBack();
    turnout_json_response(['ok' => false, 'error' => 'server_error'], 500);
}

turnout_json_response([
    'ok' => true,
    'registration_id' => $regId,
    'checkout' => [
        'action' => turnout_payhere_checkout_url($sandbox),
        'fields' => [
            'merchant_id' => $merchantId,
            'return_url' => $returnUrl,
            'cancel_url' => $cancelUrl,
            'notify_url' => $notifyUrl,
            'order_id' => $regId,
            'items' => $itemsEncoded,
            'currency' => $currency,
            'amount' => $amountStr,
            'first_name' => mb_substr($attendeeName, 0, 50),
            'last_name' => '.',
            'email' => $attendeeEmail,
            'phone' => '0000000000',
            'address' => 'N/A',
            'city' => 'Colombo',
            'country' => 'Sri Lanka',
            'hash' => $hash,
        ],
    ],
]);

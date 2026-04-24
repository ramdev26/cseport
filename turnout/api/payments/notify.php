<?php
declare(strict_types=1);

require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/payhere.php';
require __DIR__ . '/../includes/email.php';

/**
 * PayHere server-to-server notify (POST fields).
 * Docs: validate md5sig before trusting payment.
 */
header('Content-Type: text/plain; charset=utf-8');

if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo 'Method Not Allowed';
    exit;
}

$merchantId = (string)($_POST['merchant_id'] ?? '');
$orderId = (string)($_POST['order_id'] ?? '');
$payhereAmount = (string)($_POST['payhere_amount'] ?? '');
$payhereCurrency = (string)($_POST['payhere_currency'] ?? '');
$statusCode = (int)(is_numeric($_POST['status_code'] ?? null) ? $_POST['status_code'] : 0);
$md5sig = strtoupper((string)($_POST['md5sig'] ?? ''));
$paymentId = (string)($_POST['payment_id'] ?? $_POST['payhere_payment_id'] ?? '');

$pdo = turnout_db();
$settings = $pdo->query('SELECT * FROM platform_settings WHERE id = 1')->fetch();
$cfgSecret = (require __DIR__ . '/../includes/config.php')['payhere']['merchant_secret'];
$secret = $settings['payhere_merchant_secret'] ?: $cfgSecret;
$dbMerchant = $settings['payhere_merchant_id'] ?: (require __DIR__ . '/../includes/config.php')['payhere']['merchant_id'];

if ($secret === '' || $dbMerchant === '' || $merchantId !== $dbMerchant) {
    http_response_code(400);
    echo 'Invalid merchant configuration';
    exit;
}

$localSig = turnout_payhere_notify_hash($merchantId, $orderId, $payhereAmount, $payhereCurrency, $statusCode, $secret);
if (!hash_equals($localSig, $md5sig)) {
    http_response_code(400);
    echo 'Invalid signature';
    exit;
}

$pdo->beginTransaction();
$stmt = $pdo->prepare(
    'SELECT r.*, t.quantity, t.sold, e.title event_title
     FROM registrations r
     JOIN ticket_tiers t ON t.id = r.ticket_tier_id
     JOIN events e ON e.id = r.event_id
     WHERE r.id = ? FOR UPDATE'
);
try {
    $stmt->execute([$orderId]);
    $reg = $stmt->fetch();
    if (!$reg) {
        $pdo->rollBack();
        http_response_code(404);
        echo 'Order not found';
        exit;
    }

    if ($statusCode === 2) {
        if ($reg['payment_status'] === 'paid') {
            $pdo->commit();
            echo 'OK';
            exit;
        }
        $expectedAmount = number_format((int)$reg['amount_lkr'], 2, '.', '');
        if ($payhereAmount !== $expectedAmount) {
            $pdo->rollBack();
            http_response_code(400);
            echo 'Amount mismatch';
            exit;
        }

        if ((int)$reg['quantity'] > 0 && (int)$reg['sold'] >= (int)$reg['quantity']) {
            $pdo->rollBack();
            http_response_code(409);
            echo 'Sold out';
            exit;
        }

        $qrToken = $orderId;
        $pdo->prepare(
            'UPDATE registrations SET payment_status = ?, payhere_payment_id = ?, qr_payload = ?, updated_at = NOW() WHERE id = ?'
        )->execute(['paid', $paymentId !== '' ? $paymentId : null, $qrToken, $orderId]);

        $pdo->prepare('UPDATE ticket_tiers SET sold = sold + 1 WHERE id = ?')->execute([$reg['ticket_tier_id']]);

        $pdo->commit();

        $qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' . rawurlencode($qrToken);
        turnout_email_ticket_confirmation(
            (string)$reg['attendee_name'],
            (string)$reg['attendee_email'],
            (string)$reg['event_title'],
            $qrUrl
        );
    } elseif (in_array($statusCode, [-1, -2, -3], true)) {
        $pdo->prepare(
            'UPDATE registrations SET payment_status = ?, updated_at = NOW() WHERE id = ?'
        )->execute(['failed', $orderId]);
        $pdo->commit();
    } else {
        $pdo->commit();
    }
} catch (Throwable $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo 'Server error';
    exit;
}

echo 'OK';

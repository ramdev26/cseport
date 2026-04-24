<?php
declare(strict_types=1);

function turnout_payhere_hash(
    string $merchantId,
    string $orderId,
    string $amount,
    string $currency,
    string $merchantSecret
): string {
    $md5secret = strtoupper(md5($merchantSecret));
    return strtoupper(md5($merchantId . $orderId . $amount . $currency . $md5secret));
}

function turnout_payhere_notify_hash(
    string $merchantId,
    string $orderId,
    string $payhereAmount,
    string $payhereCurrency,
    int $statusCode,
    string $merchantSecret
): string {
    $md5secret = strtoupper(md5($merchantSecret));
    return strtoupper(md5($merchantId . $orderId . $payhereAmount . $payhereCurrency . (string)$statusCode . $md5secret));
}

function turnout_payhere_checkout_url(bool $sandbox): string
{
    return $sandbox
        ? 'https://sandbox.payhere.lk/pay/checkout'
        : 'https://www.payhere.lk/pay/checkout';
}

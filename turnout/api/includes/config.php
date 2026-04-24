<?php
declare(strict_types=1);

/**
 * Copy to config.local.php and override for production.
 */
$config = [
    'db' => [
        'host' => getenv('TURNOUT_DB_HOST') ?: '127.0.0.1',
        'name' => getenv('TURNOUT_DB_NAME') ?: 'turnout',
        'user' => getenv('TURNOUT_DB_USER') ?: 'root',
        'pass' => getenv('TURNOUT_DB_PASS') ?: '',
        'charset' => 'utf8mb4',
    ],
    'jwt' => [
        'secret' => getenv('TURNOUT_JWT_SECRET') ?: 'change-me-in-production',
        'issuer' => getenv('TURNOUT_JWT_ISS') ?: 'turnout',
        'ttl_seconds' => (int)(getenv('TURNOUT_JWT_TTL') ?: 604800),
        'cookie_name' => 'turnout_token',
    ],
    'cors' => [
        'origin' => getenv('TURNOUT_CORS_ORIGIN') ?: 'http://localhost:5173',
    ],
    'app' => [
        'public_url' => rtrim(getenv('TURNOUT_PUBLIC_URL') ?: 'http://localhost:5173', '/'),
        'api_public_url' => rtrim(getenv('TURNOUT_API_PUBLIC_URL') ?: 'http://localhost:8080', '/'),
    ],
    'payhere' => [
        'merchant_id' => getenv('PAYHERE_MERCHANT_ID') ?: '',
        'merchant_secret' => getenv('PAYHERE_MERCHANT_SECRET') ?: '',
        'sandbox' => filter_var(getenv('PAYHERE_SANDBOX') ?: 'true', FILTER_VALIDATE_BOOL),
    ],
    'uploads' => [
        'path' => dirname(__DIR__) . '/uploads',
        'public_prefix' => '/api/uploads',
    ],
];

if (is_file(__DIR__ . '/config.local.php')) {
    /** @var array $local */
    $local = require __DIR__ . '/config.local.php';
    $config = array_replace_recursive($config, $local);
}

return $config;

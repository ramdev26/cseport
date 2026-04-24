<?php
declare(strict_types=1);

function turnout_base64url_encode(string $data): string
{
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}

function turnout_base64url_decode(string $data): string
{
    $remainder = strlen($data) % 4;
    if ($remainder) {
        $data .= str_repeat('=', 4 - $remainder);
    }
    return (string)base64_decode(strtr($data, '-_', '+/'), true);
}

function turnout_jwt_sign(string $payload, string $secret): string
{
    return hash_hmac('sha256', $payload, $secret, true);
}

function turnout_jwt_encode(array $claims, string $secret, string $issuer, int $ttlSeconds): string
{
    $header = ['typ' => 'JWT', 'alg' => 'HS256'];
    $now = time();
    $claims['iat'] = $now;
    $claims['exp'] = $now + $ttlSeconds;
    $claims['iss'] = $issuer;
    $segments = [
        turnout_base64url_encode(json_encode($header, JSON_UNESCAPED_SLASHES)),
        turnout_base64url_encode(json_encode($claims, JSON_UNESCAPED_SLASHES)),
    ];
    $signingInput = implode('.', $segments);
    $sig = turnout_base64url_encode(turnout_jwt_sign($signingInput, $secret));
    return $signingInput . '.' . $sig;
}

/** @return array<string,mixed>|null */
function turnout_jwt_decode(string $jwt, string $secret, string $issuer): ?array
{
    $parts = explode('.', $jwt);
    if (count($parts) !== 3) {
        return null;
    }
    [$h, $p, $s] = $parts;
    $expected = turnout_base64url_encode(turnout_jwt_sign($h . '.' . $p, $secret));
    if (!hash_equals($expected, $s)) {
        return null;
    }
    $payloadJson = turnout_base64url_decode($p);
    $payload = json_decode($payloadJson, true);
    if (!is_array($payload)) {
        return null;
    }
    if (($payload['iss'] ?? '') !== $issuer) {
        return null;
    }
    if (!isset($payload['exp']) || (int)$payload['exp'] < time()) {
        return null;
    }
    return $payload;
}

function turnout_set_auth_cookie(string $token): void
{
    $cfg = require __DIR__ . '/config.php';
    $name = $cfg['jwt']['cookie_name'];
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    setcookie($name, $token, [
        'expires' => time() + (int)$cfg['jwt']['ttl_seconds'],
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

function turnout_clear_auth_cookie(): void
{
    $cfg = require __DIR__ . '/config.php';
    $name = $cfg['jwt']['cookie_name'];
    $secure = isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on';
    setcookie($name, '', [
        'expires' => time() - 3600,
        'path' => '/',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** @return array<string,mixed>|null */
function turnout_current_user(): ?array
{
    $cfg = require __DIR__ . '/config.php';
    $name = $cfg['jwt']['cookie_name'];
    $token = $_COOKIE[$name] ?? '';
    if ($token === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = $_SERVER['HTTP_AUTHORIZATION'];
        if (stripos($auth, 'Bearer ') === 0) {
            $token = trim(substr($auth, 7));
        }
    }
    if ($token === '') {
        return null;
    }
    $payload = turnout_jwt_decode($token, $cfg['jwt']['secret'], $cfg['jwt']['issuer']);
    return $payload;
}

function turnout_require_role(string $role): array
{
    $user = turnout_current_user();
    if (!$user) {
        turnout_json_response(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    if (($user['role'] ?? '') !== $role && ($user['role'] ?? '') !== 'admin') {
        turnout_json_response(['ok' => false, 'error' => 'forbidden'], 403);
    }
    return $user;
}

/** @param list<string> $roles */
function turnout_require_roles(array $roles): array
{
    $user = turnout_current_user();
    if (!$user) {
        turnout_json_response(['ok' => false, 'error' => 'unauthorized'], 401);
    }
    $r = $user['role'] ?? '';
    if ($r === 'admin') {
        return $user;
    }
    if (!in_array($r, $roles, true)) {
        turnout_json_response(['ok' => false, 'error' => 'forbidden'], 403);
    }
    return $user;
}

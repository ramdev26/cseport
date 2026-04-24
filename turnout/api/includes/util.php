<?php
declare(strict_types=1);

function turnout_uuid(): string
{
    $data = random_bytes(16);
    $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
    $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function turnout_slugify(string $text): string
{
    $text = strtolower(trim($text));
    $text = preg_replace('/[^a-z0-9]+/', '-', $text) ?? '';
    $text = trim($text, '-');
    if ($text === '') {
        $text = 'event';
    }
    return substr($text, 0, 120);
}

/** @param array<int,string> $allowed */
function turnout_validate_in(mixed $value, array $allowed, string $field): string
{
    if (!is_string($value) || !in_array($value, $allowed, true)) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_' . $field], 422);
    }
    return $value;
}

function turnout_validate_email(mixed $value): string
{
    if (!is_string($value)) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_email'], 422);
    }
    $email = filter_var(trim($value), FILTER_VALIDATE_EMAIL);
    if ($email === false) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_email'], 422);
    }
    return $email;
}

function turnout_validate_string(mixed $value, int $min, int $max, string $field): string
{
    if (!is_string($value)) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_' . $field], 422);
    }
    $v = trim($value);
    $len = mb_strlen($v);
    if ($len < $min || $len > $max) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_' . $field], 422);
    }
    return $v;
}

function turnout_validate_int(mixed $value, int $min, int $max, string $field): int
{
    if (!is_int($value) && !is_string($value)) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_' . $field], 422);
    }
    $n = filter_var($value, FILTER_VALIDATE_INT);
    if ($n === false || $n < $min || $n > $max) {
        turnout_json_response(['ok' => false, 'error' => 'invalid_' . $field], 422);
    }
    return (int)$n;
}

function turnout_default_page_schema(): array
{
    return [
        'version' => 1,
        'blocks' => [
            [
                'id' => turnout_uuid(),
                'type' => 'hero',
                'props' => [
                    'title' => 'Your event title',
                    'subtitle' => 'Tagline or date',
                    'align' => 'center',
                ],
            ],
        ],
    ];
}

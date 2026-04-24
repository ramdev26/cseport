<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/jwt.php';

turnout_cors();
turnout_require_method('POST');
turnout_clear_auth_cookie();
turnout_json_response(['ok' => true]);

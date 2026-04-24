<?php
declare(strict_types=1);

require __DIR__ . '/../includes/http.php';
require __DIR__ . '/../includes/db.php';
require __DIR__ . '/../includes/jwt.php';

turnout_cors();
turnout_require_method('GET');
turnout_require_role('admin');

$pdo = turnout_db();
$users = (int)$pdo->query('SELECT COUNT(*) c FROM profiles')->fetch()['c'];
$events = (int)$pdo->query('SELECT COUNT(*) c FROM events')->fetch()['c'];
$published = (int)$pdo->query("SELECT COUNT(*) c FROM events WHERE status = 'published'")->fetch()['c'];
$paid = (int)$pdo->query("SELECT COUNT(*) c FROM registrations WHERE payment_status = 'paid'")->fetch()['c'];
$revenue = (int)$pdo->query("SELECT COALESCE(SUM(amount_lkr),0) s FROM registrations WHERE payment_status = 'paid'")->fetch()['s'];

turnout_json_response([
    'ok' => true,
    'stats' => [
        'users' => $users,
        'events' => $events,
        'published_events' => $published,
        'paid_registrations' => $paid,
        'gross_revenue_lkr' => $revenue,
    ],
]);

<?php
declare(strict_types=1);

function turnout_send_mail(string $to, string $subject, string $htmlBody, string $textBody = ''): bool
{
    $cfg = require __DIR__ . '/config.php';
    $pdo = turnout_db();
    $row = $pdo->query('SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from_email, smtp_from_name FROM platform_settings WHERE id = 1')->fetch();
    $fromEmail = $row['smtp_from_email'] ?? '';
    $fromName = $row['smtp_from_name'] ?? 'TurnOut';

    if ($fromEmail === '' || ($row['smtp_host'] ?? '') === '') {
        error_log('[TurnOut email] SMTP not configured; skipping: ' . $subject);
        return false;
    }

    $headers = [];
    $headers[] = 'MIME-Version: 1.0';
    $headers[] = 'Content-type: text/html; charset=utf-8';
    $headers[] = 'From: ' . sprintf('"%s" <%s>', addslashes($fromName), $fromEmail);
    $headers[] = 'Reply-To: ' . $fromEmail;

    return @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $htmlBody, implode("\r\n", $headers));
}

function turnout_email_ticket_confirmation(string $toName, string $toEmail, string $eventTitle, string $qrDataUrl): void
{
    $safeName = htmlspecialchars($toName, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $safeEvent = htmlspecialchars($eventTitle, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
    $body = '<p>Hi ' . $safeName . ',</p><p>Your ticket for <strong>' . $safeEvent . '</strong> is confirmed.</p>';
    if ($qrDataUrl !== '') {
        $body .= '<p><img src="' . htmlspecialchars($qrDataUrl, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8') . '" alt="QR" width="200" height="200" /></p>';
    }
    turnout_send_mail($toEmail, 'Your TurnOut ticket', $body);
}

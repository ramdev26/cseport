<?php
// cpanel/api/index.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS");
header("Content-Type: application/json");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

require_once 'db.php';

$path = $_GET['path'] ?? '';
$user_id = $_GET['user_id'] ?? null;
$id = $_GET['id'] ?? null;
$symbol = $_GET['symbol'] ?? null;

$input = json_decode(file_get_contents('php://input'), true);

switch ($path) {
    // --- AUTH ---
    case 'auth/register':
        $email = $input['email'] ?? '';
        $pass = password_hash($input['password'] ?? '', PASSWORD_BCRYPT);
        $stmt = $pdo->prepare("INSERT INTO users (email, password) VALUES (?, ?)");
        try {
            $stmt->execute([$email, $pass]);
            echo json_encode(['message' => 'Registered']);
        } catch (Exception $e) {
            http_response_code(400);
            echo json_encode(['error' => 'User exists']);
        }
        break;

    case 'auth/login':
        $email = $input['email'] ?? '';
        $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if ($user && password_verify($input['password'] ?? '', $user['password'])) {
            echo json_encode(['message' => 'Logged in', 'user' => ['id' => $user['id'], 'email' => $user['email']]]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
        }
        break;

    // --- TRANSACTIONS ---
    case 'get-transactions':
        $stmt = $pdo->prepare("SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC");
        $stmt->execute([$user_id]);
        echo json_encode($stmt->fetchAll());
        break;

    case 'add-transaction':
        $stmt = $pdo->prepare("INSERT INTO transactions (user_id, stock_symbol, type, quantity, price, date) VALUES (?, ?, ?, ?, ?, ?)");
        $stmt->execute([$input['user_id'], $input['stock_symbol'], $input['type'], $input['quantity'], $input['price'], $input['date']]);
        echo json_encode(['message' => 'Added']);
        break;

    case 'delete-transaction':
        $stmt = $pdo->prepare("DELETE FROM transactions WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['message' => 'Deleted']);
        break;

    // --- WATCHLIST ---
    case 'get-watchlist':
        $stmt = $pdo->prepare("SELECT * FROM watchlist WHERE user_id = ?");
        $stmt->execute([$user_id]);
        echo json_encode($stmt->fetchAll());
        break;

    case 'add-watchlist':
        $stmt = $pdo->prepare("INSERT INTO watchlist (user_id, stock_symbol) VALUES (?, ?)");
        $stmt->execute([$input['user_id'], $input['stock_symbol']]);
        echo json_encode(['message' => 'Added']);
        break;

    case 'remove-watchlist':
        $stmt = $pdo->prepare("DELETE FROM watchlist WHERE id = ?");
        $stmt->execute([$id]);
        echo json_encode(['message' => 'Removed']);
        break;

    // --- CSE API (Proxy) ---
    case 'stock':
        echo cse_proxy('companyInfoSummery', ['symbol' => $symbol]);
        break;
    case 'market-summary':
        echo cse_proxy('marketSummery');
        break;
    case 'top-gainers':
        echo cse_proxy('topGainers');
        break;
    case 'top-losers':
        echo cse_proxy('topLooses');
        break;
    case 'most-active':
        echo cse_proxy('mostActiveTrades');
        break;
    case 'chart-data':
        echo cse_proxy('chartData', ['symbol' => $symbol]);
        break;

    default:
        http_response_code(404);
        echo json_encode(['error' => 'Not found']);
}

function cse_proxy($endpoint, $payload = []) {
    $url = "https://www.cse.lk/api/" . $endpoint;
    $ch = curl_init($url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_POST, true);
    curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Content-Type: application/json',
        'User-Agent: Mozilla/5.0'
    ]);
    $response = curl_exec($ch);
    curl_close($ch);
    return $response;
}
?>

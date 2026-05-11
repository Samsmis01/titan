// Service Worker pour persistance en arrière-plan
const CACHE_NAME = 'instagram-booster-v1';

self.addEventListener('install', (event) => {
    console.log('[SW] Installé');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[SW] Activé');
    event.waitUntil(clients.claim());
});

self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'ping') {
        console.log('[SW] Ping reçu');
    }
});

self.addEventListener('fetch', (event) => {
    // Intercepter les requêtes si besoin
});

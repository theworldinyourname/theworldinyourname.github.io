// Service Worker for Love App
// Handles caching, offline functionality, and background sync

const CACHE_NAME = 'love-app-v1.0.0';
const STATIC_CACHE = 'love-app-static-v1.0.0';
const DYNAMIC_CACHE = 'love-app-dynamic-v1.0.0';

// Files to cache immediately
const STATIC_FILES = [
    '/',
    '/index.html',
    '/login.html',
    '/chat.html',
    '/why-i-love-you.html',
    '/favorites.html',
    '/about-her.html',
    '/food-memories.html',
    '/photo-gallery.html',
    '/period-tracker.html',
    '/journal.html',
    '/apology.html',
    '/css/style.css',
    '/js/main.js',
    '/js/auth.js',
    '/js/chat.js',
    '/js/storage.js',
    '/manifest.json'
];

// External resources to cache
const EXTERNAL_RESOURCES = [
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&family=Poppins:wght@300;400;500;600&display=swap',
    'https://unpkg.com/aos@2.3.1/dist/aos.css',
    'https://unpkg.com/aos@2.3.1/dist/aos.js'
];

// Install event - cache static resources
self.addEventListener('install', event => {
    console.log('Service Worker: Installing...');
    
    event.waitUntil(
        Promise.all([
            // Cache static files
            caches.open(STATIC_CACHE).then(cache => {
                console.log('Service Worker: Caching static files');
                return cache.addAll(STATIC_FILES);
            }),
            // Cache external resources
            caches.open(DYNAMIC_CACHE).then(cache => {
                console.log('Service Worker: Caching external resources');
                return cache.addAll(EXTERNAL_RESOURCES);
            })
        ])
    );
    
    // Force the waiting service worker to become the active service worker
    self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
    console.log('Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete old caches
                    if (cacheName !== STATIC_CACHE && 
                        cacheName !== DYNAMIC_CACHE && 
                        cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    
    // Take control of all pages
    return self.clients.claim();
});

// Fetch event - serve cached content when offline
self.addEventListener('fetch', event => {
    const request = event.request;
    const url = new URL(request.url);
    
    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }
    
    // Skip chrome-extension and other protocols
    if (!url.protocol.startsWith('http')) {
        return;
    }
    
    event.respondWith(
        handleFetch(request)
    );
});

// Handle fetch with different strategies
async function handleFetch(request) {
    const url = new URL(request.url);
    
    try {
        // Strategy 1: Cache First for static resources
        if (isStaticResource(request)) {
            return await cacheFirst(request);
        }
        
        // Strategy 2: Network First for HTML pages
        if (isHTMLPage(request)) {
            return await networkFirst(request);
        }
        
        // Strategy 3: Stale While Revalidate for external resources
        if (isExternalResource(request)) {
            return await staleWhileRevalidate(request);
        }
        
        // Default: Network First
        return await networkFirst(request);
        
    } catch (error) {
        console.log('Service Worker: Fetch failed, serving offline page:', error);
        
        // Return offline page for navigation requests
        if (request.mode === 'navigate') {
            return await getOfflinePage();
        }
        
        // Return cached response or network error
        const cachedResponse = await caches.match(request);
        return cachedResponse || new Response('Network error', { status: 503 });
    }
}

// Cache First strategy
async function cacheFirst(request) {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    const cache = await caches.open(DYNAMIC_CACHE);
    cache.put(request, networkResponse.clone());
    
    return networkResponse;
}

// Network First strategy
async function networkFirst(request) {
    try {
        const networkResponse = await fetch(request);
        
        // Cache successful responses
        if (networkResponse.ok) {
            const cache = await caches.open(DYNAMIC_CACHE);
            cache.put(request, networkResponse.clone());
        }
        
        return networkResponse;
    } catch (error) {
        // Fall back to cache
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
            return cachedResponse;
        }
        throw error;
    }
}

// Stale While Revalidate strategy
async function staleWhileRevalidate(request) {
    const cachedResponse = await caches.match(request);
    
    const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse.ok) {
            const cache = caches.open(DYNAMIC_CACHE);
            cache.then(c => c.put(request, networkResponse.clone()));
        }
        return networkResponse;
    }).catch(() => {
        // Ignore network errors for this strategy
        return cachedResponse;
    });
    
    // Return cached response immediately, update cache in background
    return cachedResponse || fetchPromise;
}

// Check if request is for static resource
function isStaticResource(request) {
    const url = new URL(request.url);
    return url.pathname.endsWith('.css') ||
           url.pathname.endsWith('.js') ||
           url.pathname.endsWith('.png') ||
           url.pathname.endsWith('.jpg') ||
           url.pathname.endsWith('.jpeg') ||
           url.pathname.endsWith('.gif') ||
           url.pathname.endsWith('.webp') ||
           url.pathname.endsWith('.svg') ||
           url.pathname.endsWith('.ico') ||
           url.pathname.endsWith('.woff') ||
           url.pathname.endsWith('.woff2') ||
           url.pathname.endsWith('.ttf');
}

// Check if request is for HTML page
function isHTMLPage(request) {
    const url = new URL(request.url);
    return url.pathname === '/' ||
           url.pathname.endsWith('.html') ||
           request.headers.get('accept')?.includes('text/html');
}

// Check if request is for external resource
function isExternalResource(request) {
    const url = new URL(request.url);
    return url.origin !== self.location.origin;
}

// Get offline page
async function getOfflinePage() {
    const cache = await caches.open(STATIC_CACHE);
    let offlinePage = await cache.match('/offline.html');
    
    if (!offlinePage) {
        // Create a simple offline page if not cached
        offlinePage = new Response(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Love App - Offline</title>
                <style>
                    body {
                        font-family: system-ui, -apple-system, sans-serif;
                        background: linear-gradient(135deg, #ff6b9d, #c44569);
                        color: white;
                        height: 100vh;
                        margin: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        text-align: center;
                    }
                    .offline-content {
                        max-width: 400px;
                        padding: 2rem;
                    }
                    h1 { font-size: 2.5rem; margin-bottom: 1rem; }
                    p { font-size: 1.1rem; margin-bottom: 2rem; }
                    .heart { font-size: 3rem; margin: 1rem 0; }
                    .retry-btn {
                        background: white;
                        color: #ff6b9d;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 50px;
                        font-size: 1rem;
                        cursor: pointer;
                        font-weight: 600;
                    }
                    .retry-btn:hover {
                        transform: translateY(-2px);
                        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
                    }
                </style>
            </head>
            <body>
                <div class="offline-content">
                    <div class="heart">💕</div>
                    <h1>You're Offline</h1>
                    <p>Don't worry, our love doesn't need the internet! Some features may not work until you're back online.</p>
                    <button class="retry-btn" onclick="window.location.reload()">Try Again</button>
                </div>
            </body>
            </html>
        `, {
            headers: { 'Content-Type': 'text/html' }
        });
    }
    
    return offlinePage;
}

// Background sync for when connection is restored
self.addEventListener('sync', event => {
    if (event.tag === 'background-sync') {
        console.log('Service Worker: Background sync triggered');
        event.waitUntil(doBackgroundSync());
    }
});

// Perform background sync operations
async function doBackgroundSync() {
    try {
        // Sync any pending messages or data
        const pendingActions = await getPendingActions();
        
        for (const action of pendingActions) {
            await performAction(action);
        }
        
        // Clear pending actions
        await clearPendingActions();
        
        // Notify clients that sync is complete
        const clients = await self.clients.matchAll();
        clients.forEach(client => {
            client.postMessage({
                type: 'SYNC_COMPLETE',
                message: 'Background sync completed successfully'
            });
        });
        
    } catch (error) {
        console.error('Service Worker: Background sync failed:', error);
    }
}

// Get pending actions from IndexedDB or localStorage
async function getPendingActions() {
    // Implementation would depend on how you store pending actions
    return [];
}

// Perform a pending action
async function performAction(action) {
    // Implementation would depend on the type of action
    console.log('Service Worker: Performing action:', action);
}

// Clear pending actions
async function clearPendingActions() {
    // Implementation would clear the pending actions storage
}

// Handle push notifications (for future use)
self.addEventListener('push', event => {
    console.log('Service Worker: Push notification received');
    
    const options = {
        body: 'You have a new message from your love! 💕',
        icon: '/manifest-icon-192.png',
        badge: '/manifest-icon-96.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'explore',
                title: 'Open App',
                icon: '/manifest-icon-96.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/manifest-icon-96.png'
            }
        ]
    };
    
    event.waitUntil(
        self.registration.showNotification('Love App', options)
    );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
    console.log('Service Worker: Notification clicked');
    
    event.notification.close();
    
    if (event.action === 'explore') {
        // Open the app
        event.waitUntil(
            clients.openWindow('/')
        );
    } else if (event.action === 'close') {
        // Just close the notification
        return;
    } else {
        // Default action - open app
        event.waitUntil(
            clients.openWindow('/')
        );
    }
});

// Handle messages from the main thread
self.addEventListener('message', event => {
    console.log('Service Worker: Message received:', event.data);
    
    if (event.data && event.data.type) {
        switch (event.data.type) {
            case 'SKIP_WAITING':
                self.skipWaiting();
                break;
            
            case 'GET_VERSION':
                event.ports[0].postMessage({ version: CACHE_NAME });
                break;
            
            case 'CACHE_URLS':
                event.waitUntil(
                    cacheUrls(event.data.urls)
                );
                break;
            
            default:
                console.log('Service Worker: Unknown message type:', event.data.type);
        }
    }
});

// Cache specific URLs
async function cacheUrls(urls) {
    const cache = await caches.open(DYNAMIC_CACHE);
    return cache.addAll(urls);
}

// Periodic background sync (when available)
self.addEventListener('periodicsync', event => {
    if (event.tag === 'love-app-sync') {
        event.waitUntil(doPeriodicSync());
    }
});

// Perform periodic sync
async function doPeriodicSync() {
    console.log('Service Worker: Periodic sync triggered');
    
    try {
        // Clean up old cached data
        await cleanupOldCache();
        
        // Pre-cache frequently accessed content
        await preCacheContent();
        
    } catch (error) {
        console.error('Service Worker: Periodic sync failed:', error);
    }
}

// Clean up old cached data
async function cleanupOldCache() {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => 
        name.startsWith('love-app-') && 
        name !== STATIC_CACHE && 
        name !== DYNAMIC_CACHE
    );
    
    await Promise.all(
        oldCaches.map(cacheName => caches.delete(cacheName))
    );
}

// Pre-cache frequently accessed content
async function preCacheContent() {
    // Implementation would pre-cache content based on usage patterns
    console.log('Service Worker: Pre-caching frequently accessed content');
}

console.log('Service Worker: Script loaded');

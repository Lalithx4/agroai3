/**
 * CropMagix - Service Worker
 * Makes the app installable and usable offline.
 */

const VERSION = 'v3';
const SHELL_CACHE = `cropmagix-shell-${VERSION}`;
const RUNTIME_CACHE = `cropmagix-runtime-${VERSION}`;
const PAGES_CACHE = `cropmagix-pages-${VERSION}`;

// App shell routes precached on install. Precached individually so one
// failure (e.g. a route erroring at build time) doesn't break the rest.
const SHELL_ROUTES = ['/', '/home', '/scanner', '/voice-doctor', '/offline', '/manifest.json'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(SHELL_CACHE)
            .then((cache) => Promise.allSettled(SHELL_ROUTES.map((route) => cache.add(route))))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    const keep = [SHELL_CACHE, RUNTIME_CACHE, PAGES_CACHE];

    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => !keep.includes(key)).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const { request } = event;

    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Only handle same-origin requests.
    if (url.origin !== self.location.origin) return;

    // Immutable, content-hashed build assets: cache once, reuse forever.
    if (url.pathname.startsWith('/_next/static/')) {
        event.respondWith(cacheFirst(request, RUNTIME_CACHE));
        return;
    }

    // Static images and icons: cache-first.
    if (url.pathname.startsWith('/images/') || url.pathname.startsWith('/icons/')) {
        event.respondWith(cacheFirst(request, RUNTIME_CACHE));
        return;
    }

    // Page navigations: fresh when online, cached when offline, /offline as last resort.
    if (request.mode === 'navigate') {
        event.respondWith(networkFirstPage(request));
        return;
    }

    // API calls (all POST-heavy AI work; GETs like weather benefit from a cache):
    // try the network, fall back to the last good response.
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(request, RUNTIME_CACHE));
        return;
    }

    // Everything else on this origin (CSS, fonts, non-hashed _next output):
    // stale-while-revalidate so the app keeps opening offline.
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE));
});

async function cacheFirst(request, cacheName) {
    const cached = await caches.match(request);
    if (cached) return cached;

    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        return errorResponse();
    }
}

async function networkFirst(request, cacheName) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(cacheName);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        return errorResponse();
    }
}

async function networkFirstPage(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(PAGES_CACHE);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;

        // Shell routes precached at install keep the app openable even here.
        const shell = await caches.match(request, { cacheName: SHELL_CACHE });
        if (shell) return shell;

        const offline = await caches.match('/offline');
        if (offline) return offline;

        return errorResponse();
    }
}

async function staleWhileRevalidate(request, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(request);

    const refresh = fetch(request)
        .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
        })
        .catch(() => cached);

    return cached || refresh;
}

function errorResponse() {
    return new Response(
        JSON.stringify({ error: 'offline', message: 'You are offline and this was not cached.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
}

self.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

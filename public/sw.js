// SPDX-License-Identifier: GPL-3.0-or-later

const CACHE_NAME = 'orbitar-pwa-v2.4.0';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/orbitar-icon.svg',
  './data/solar-system-ro.json',
  './data/missions-ro.json',
  './data/tle-iss.json',
  './data/bodies.json',
  './audio/salut-voyager-ro.ogg',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldKeys = keys.filter((key) => key !== CACHE_NAME);
      await Promise.all(oldKeys.map((oldKey) => caches.delete(oldKey)));
      await self.clients.claim();

      // Dacă am înlocuit un cache vechi (ex: orbitar-pwa-v1.0.0), reîncărcăm automat tab-urile deschise
      if (oldKeys.length > 0) {
        const windowClients = await self.clients.matchAll({ type: 'window' });
        for (const client of windowClients) {
          try {
            await client.navigate(client.url);
          } catch (_e) {
            // Ignorăm eventualele restricții de navigare
          }
        }
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // În modul de dezvoltare Vite (/src/*, /@vite/*, /node_modules/*), nu interceptăm din cache
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@') ||
    url.pathname.startsWith('/node_modules/')
  ) {
    return;
  }

  // Pentru HTML, JS și CSS: Network-First cu fallback la Cache pentru offline
  const isAppShellCode =
    req.mode === 'navigate' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname === '/';

  if (isAppShellCode) {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Pentru date statice, texturi și audio: Network-First / Cache fallback
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const networkFetch = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(req, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || networkFetch;
    })
  );
});

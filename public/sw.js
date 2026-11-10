// SPDX-License-Identifier: GPL-3.0-or-later

// Versiunea cache-ului este sincronizată automat de scripts/bump-version.mjs atât în sw.js, cât și în app-version.js
const ORBITAR_SW_VERSION = '1.2.13';
importScripts(`./app-version.js?v=${ORBITAR_SW_VERSION}`);

const CACHE_NAME = self.ORBITAR_CACHE_NAME || `orbitar-pwa-v${ORBITAR_SW_VERSION}`;
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './app-version.js',
  './manifest.webmanifest',
  './icons/orbitar-icon.svg',
  './data/solar-system-ro.json',
  './data/missions-ro.json',
  './data/deep-space-ro.json',
  './data/tle-iss.json',
  './audio/salut-voyager-ro.ogg',
];

// Notă: cele 100 de fișiere TTS (~29 MB din public/audio/tts/) NU sunt pre-cachuite la instalare —
// sunt salvate automat în cache la prima redare online (vezi handler-ul fetch de mai jos).
// În scenariul complet offline de la prima utilizare, SpeechManager revine la sinteza vocală ro-RO.

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

  // Nu interceptăm cererile HTTP Range (bytes=0-) ale elementelor <audio>,
  // deoarece WebKit/Safari respinge răspunsurile 200 OK la cererile 206 Partial Content
  if (req.headers.has('range')) return;

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
      fetch(req, { cache: 'no-cache' })
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

  // Pentru date statice, texturi și audio: Cache-First (fără re-descărcare și scriere pe disc la fiecare cadru/încărcare!)
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseClone);
          });
        }
        return networkResponse;
      });
    })
  );
});

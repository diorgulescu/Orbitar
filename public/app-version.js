// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Sursă unică de adevăr pentru versiunea cache-ului PWA Orbitar.
 * - `public/sw.js` o încarcă prin `importScripts('./app-version.js')`
 * - `index.html` o încarcă prin `<script src="./app-version.js"></script>` înainte de scriptul inline din <head>
 *
 * La fiecare modificare a listei `PRECACHE_ASSETS` din sw.js, creșteți versiunea de mai jos,
 * astfel încât handler-ul `activate` să șteargă cache-urile vechi și să reîncarce tab-urile deschise.
 */
// biome-ignore lint/correctness/noUnusedVariables: variabilă globală intenționată, citită de sw.js (importScripts) și de index.html
var ORBITAR_CACHE_NAME = 'orbitar-pwa-v1.3.1';

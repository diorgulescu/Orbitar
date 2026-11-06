// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import { defineConfig } from 'vite';

const pkgJson = JSON.parse(
  fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8')
) as { version?: string };

export default defineConfig({
  base: './',
  define: {
    __ORBITAR_APP_VERSION__: JSON.stringify(pkgJson.version ?? '1.0.0'),
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          astro: ['astronomy-engine', 'satellite.js'],
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: false,
  },
});

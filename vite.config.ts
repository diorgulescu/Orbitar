// SPDX-License-Identifier: GPL-3.0-or-later
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
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

// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Smoke test end-to-end în browser real: servește build-ul de producție (dist/) cu `vite preview`,
 * îl deschide în Chromium headless (Playwright) și verifică că aplicația Orbitar pornește complet:
 *   - `window.__orbitar` este setat (bootstrap terminat)
 *   - canvas-ul WebGL există în #canvas-container
 *   - etichetele 2D (.celestial-label) și pastilele (.body-pill) au fost create
 *   - nu există erori JS de pagină și nicio cerere HTTP eșuată (4xx/5xx)
 *
 * Rulare: `npm run build && npm run test:smoke`
 * În CI (GitHub Actions ubuntu-latest) se folosește Chrome-ul de sistem (`channel: 'chrome'`);
 * local, dacă lipsește, se poate instala Chromium-ul bundled: `npx playwright-core install chromium`.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const rootDir = process.cwd();
const port = 4173;
const baseUrl = `http://127.0.0.1:${port}/`;

async function ensureBuild() {
  if (!fs.existsSync(path.join(rootDir, 'dist', 'index.html'))) {
    console.log('ℹ️  dist/ lipsește — rulez `npm run build` mai întâi…');
    const build = spawnSync('npm', ['run', 'build'], { cwd: rootDir, stdio: 'inherit', shell: true });
    if (build.status !== 0) {
      throw new Error('npm run build a eșuat');
    }
  }
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch (_e) {
      // serverul încă nu e gata
    }
    await sleep(250);
  }
  throw new Error(`Serverul ${url} nu a răspuns în ${timeoutMs} ms`);
}

async function main() {
  await ensureBuild();

  const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const preview = spawn(
    process.execPath,
    [viteBin, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'],
    { cwd: rootDir, stdio: ['ignore', 'pipe', 'pipe'] }
  );
  preview.stderr.on('data', (d) => process.stderr.write(`[vite preview] ${d}`));

  let browser = null;
  try {
    await waitForServer(baseUrl, 30000);
    console.log(`ℹ️  Build servit la ${baseUrl}`);

    const { chromium } = await import('playwright-core');
    const launchArgs = [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--use-angle=swiftshader',
      '--enable-unsafe-swiftshader',
    ];
    try {
      // CI (ubuntu-latest) are Google Chrome preinstalat
      browser = await chromium.launch({ channel: 'chrome', args: launchArgs });
      console.log('ℹ️  Chromium: Chrome de sistem (channel: chrome)');
    } catch (_e) {
      browser = await chromium.launch({ args: launchArgs });
      console.log('ℹ️  Chromium: build bundled Playwright (instalat separat)');
    }

    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    const pageErrors = [];
    const failedRequests = [];
    page.on('pageerror', (err) => pageErrors.push(String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') pageErrors.push(`console.error: ${msg.text()}`);
    });
    page.on('response', (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.url()}`);
    });

    await page.goto(baseUrl, { waitUntil: 'load', timeout: 60000 });
    await page.waitForFunction(() => window.__orbitar !== undefined, null, { timeout: 60000 });
    // Lăsăm câteva cadre să ruleze ca să detectăm erori de randare per-frame
    await sleep(2500);

    const checks = await page.evaluate(() => ({
      hasCanvas: Boolean(document.querySelector('#canvas-container canvas')),
      labelCount: document.querySelectorAll('.celestial-label').length,
      pillCount: document.querySelectorAll('.body-pill').length,
      horizon: window.__orbitar?.orbitalEngine?.getActiveHorizon?.() ?? null,
      bodyCount: window.__orbitar?.orbitalEngine?.getAllBodies?.().length ?? 0,
      visibleLabels: Array.from(document.querySelectorAll('.celestial-label')).filter(
        (el) => el.style.display !== 'none'
      ).length,
      sampleTransform:
        Array.from(document.querySelectorAll('.celestial-label')).find(
          (el) => el.style.display !== 'none'
        )?.style.transform ?? '',
    }));

    console.log('ℹ️  Rezultate smoke test:', JSON.stringify(checks, null, 2));

    if (!checks.hasCanvas) throw new Error('Canvas-ul WebGL lipsește din #canvas-container');
    if (checks.labelCount < 30) throw new Error(`Prea puține etichete 2D create: ${checks.labelCount}`);
    if (checks.pillCount < 30) throw new Error(`Prea puține pastile create: ${checks.pillCount}`);
    if (checks.horizon !== 'solar') throw new Error(`Orizontul activ ar trebui să fie „solar”, este: ${checks.horizon}`);
    if (checks.bodyCount < 38) throw new Error(`Prea puține corpuri încărcate: ${checks.bodyCount}`);
    if (checks.visibleLabels === 0) throw new Error('Nicio etichetă 2D vizibilă după pornire');
    if (!checks.sampleTransform.includes('translate3d(')) {
      throw new Error(`Etichetele trebuie poziționate prin translate3d, transform găsit: ${checks.sampleTransform}`);
    }
    if (failedRequests.length > 0) {
      throw new Error(`Cereri HTTP eșuate:\n${failedRequests.join('\n')}`);
    }
    if (pageErrors.length > 0) {
      throw new Error(`Erori JS în pagină:\n${pageErrors.join('\n')}`);
    }

    console.log('✅ Smoke test trecut: Orbitar pornește complet în browser, fără erori și fără resurse lipsă.');
  } finally {
    if (browser) await browser.close();
    preview.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('❌ Smoke test eșuat:', err);
  process.exit(1);
});

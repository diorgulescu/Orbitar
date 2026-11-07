// SPDX-License-Identifier: GPL-3.0-or-later
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT_DIR = process.cwd();

/**
 * Sincronizează o versiune semantică (ex: "1.2.5") în toate fișierele proiectului Orbitar:
 * - package.json
 * - src-tauri/tauri.conf.json
 * - src-tauri/Cargo.toml
 * - src/utils/UpdateChecker.ts
 * - index.html
 * - public/app-version.js
 */
export function syncVersionAcrossProject(version, rootDir = ROOT_DIR) {
  const cleanVer = String(version).trim().replace(/^v/i, '');
  if (!/^\d+\.\d+\.\d+$/.test(cleanVer)) {
    throw new Error(`Versiune semantică invalidă: "${version}". Format așteptat: X.Y.Z (ex: 1.2.5)`);
  }

  // 1. package.json
  const pkgPath = path.join(rootDir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
    pkg.version = cleanVer;
    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
  }

  // 2. src-tauri/tauri.conf.json
  const tauriConfPath = path.join(rootDir, 'src-tauri', 'tauri.conf.json');
  if (fs.existsSync(tauriConfPath)) {
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));
    tauriConf.version = cleanVer;
    fs.writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`, 'utf8');
  }

  // 3. src-tauri/Cargo.toml
  const cargoPath = path.join(rootDir, 'src-tauri', 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    const cargo = fs.readFileSync(cargoPath, 'utf8');
    const updatedCargo = cargo.replace(/^version\s*=\s*"[^"]*"/m, `version = "${cleanVer}"`);
    fs.writeFileSync(cargoPath, updatedCargo, 'utf8');
  }

  // 4. src/utils/UpdateChecker.ts
  const updateCheckerPath = path.join(rootDir, 'src', 'utils', 'UpdateChecker.ts');
  if (fs.existsSync(updateCheckerPath)) {
    const uc = fs.readFileSync(updateCheckerPath, 'utf8');
    const updatedUc = uc.replace(
      /export const ORBITAR_DEFAULT_VERSION = '[^']*';/,
      `export const ORBITAR_DEFAULT_VERSION = '${cleanVer}';`
    );
    fs.writeFileSync(updateCheckerPath, updatedUc, 'utf8');
  }

  // 5. index.html (#about-app-version + ./app-version.js?v=...)
  const indexHtmlPath = path.join(rootDir, 'index.html');
  if (fs.existsSync(indexHtmlPath)) {
    const html = fs.readFileSync(indexHtmlPath, 'utf8');
    const updatedHtml = html
      .replace(
        /(<span id="about-app-version"[^>]*>)Versiune:\s*v[0-9.]+(<\/span>)/,
        `$1Versiune: v${cleanVer}$2`
      )
      .replace(
        /<script src="\.\/app-version\.js(?:\?v=[^"]*)?"><\/script>/,
        `<script src="./app-version.js?v=${cleanVer}"></script>`
      );
    fs.writeFileSync(indexHtmlPath, updatedHtml, 'utf8');
  }

  // 6. public/app-version.js (cache PWA) + public/sw.js (ORBITAR_SW_VERSION)
  const appVerJsPath = path.join(rootDir, 'public', 'app-version.js');
  if (fs.existsSync(appVerJsPath)) {
    const appVerJs = fs.readFileSync(appVerJsPath, 'utf8');
    const updatedAppVerJs = appVerJs.replace(
      /var ORBITAR_CACHE_NAME = 'orbitar-pwa-v[^']*';/,
      `var ORBITAR_CACHE_NAME = 'orbitar-pwa-v${cleanVer}';`
    );
    fs.writeFileSync(appVerJsPath, updatedAppVerJs, { encoding: 'utf8', mode: 0o644 });
  }

  const swJsPath = path.join(rootDir, 'public', 'sw.js');
  if (fs.existsSync(swJsPath)) {
    const swJs = fs.readFileSync(swJsPath, 'utf8');
    const updatedSwJs = swJs.replace(
      /const ORBITAR_SW_VERSION = '[^']*';/,
      `const ORBITAR_SW_VERSION = '${cleanVer}';`
    );
    fs.writeFileSync(swJsPath, updatedSwJs, { encoding: 'utf8', mode: 0o644 });
  }

  return cleanVer;
}

/**
 * Calculează noua versiune pe baza modului ('patch' / 'revision', 'minor', 'major' sau 'set').
 */
export function computeNextVersion(currentVersion, mode = 'patch', explicitVersion = '') {
  const cleanCur = String(currentVersion).trim().replace(/^v/i, '');
  const parts = cleanCur.split('.').map((n) => Number.parseInt(n, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    throw new Error(`Versiune curentă invalidă în package.json: "${currentVersion}"`);
  }
  const [major, minor, patch] = parts;

  if (mode === 'set') {
    const cleanTarget = String(explicitVersion).trim().replace(/^v/i, '');
    if (!/^\d+\.\d+\.\d+$/.test(cleanTarget)) {
      throw new Error(`Versiune țintă invalidă pentru 'set': "${explicitVersion}"`);
    }
    return cleanTarget;
  }
  if (mode === 'sync') {
    return cleanCur;
  }
  if (mode === 'major') {
    return `${major + 1}.0.0`;
  }
  if (mode === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  // Implicit: 'patch' / 'revision' incrementează al treilea număr (X.Y.Z -> X.Y.Z+1)
  return `${major}.${minor}.${patch + 1}`;
}

function runCli() {
  const args = process.argv.slice(2);
  const flags = new Set(args.filter((a) => a.startsWith('--')));
  const positional = args.filter((a) => !a.startsWith('--'));

  const pkgPath = path.join(ROOT_DIR, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const currentVersion = pkg.version || '1.2.5';

  let mode = positional[0] || 'patch';
  let explicitVer = positional[1] || '';

  if (/^\d+\.\d+\.\d+$/.test(mode.replace(/^v/i, ''))) {
    explicitVer = mode;
    mode = 'set';
  } else if (mode === 'revision') {
    mode = 'patch';
  }

  // Opțiunea --if-tag-exists: incrementează revision-ul DOAR dacă tagul v<currentVersion> există deja în Git
  if (flags.has('--if-tag-exists')) {
    try {
      const existingTag = execSync(`git tag -l "v${currentVersion}"`, { encoding: 'utf8' }).trim();
      if (!existingTag) {
        mode = 'sync';
      }
    } catch (_e) {
      mode = 'sync';
    }
  }

  const nextVersion = computeNextVersion(currentVersion, mode, explicitVer);
  syncVersionAcrossProject(nextVersion, ROOT_DIR);

  if (nextVersion !== currentVersion) {
    console.log(`🚀 Versiunea Orbitar a fost actualizată: v${currentVersion} -> v${nextVersion}`);
  } else {
    console.log(`✅ Versiunea Orbitar a fost sincronizată: v${nextVersion}`);
  }

  if (flags.has('--tag') || flags.has('--commit')) {
    const trackedFiles = [
      'package.json',
      'src-tauri/tauri.conf.json',
      'src-tauri/Cargo.toml',
      'src/utils/UpdateChecker.ts',
      'index.html',
      'public/app-version.js',
    ];
    execSync(`git add ${trackedFiles.join(' ')}`, { stdio: 'inherit' });

    const status = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    if (status.length > 0) {
      execSync(`git commit -m "chore(release): v${nextVersion}"`, { stdio: 'inherit' });
    }

    if (flags.has('--tag')) {
      const existingTag = execSync(`git tag -l "v${nextVersion}"`, { encoding: 'utf8' }).trim();
      if (!existingTag) {
        execSync(`git tag -a "v${nextVersion}" -m "Orbitar v${nextVersion}"`, { stdio: 'inherit' });
        console.log(`🏷️  Tag Git creat: v${nextVersion}`);
      }
    }

    if (flags.has('--push')) {
      execSync('git push origin HEAD --follow-tags', { stdio: 'inherit' });
      console.log(`🌐 Versiunea v${nextVersion} și tag-ul aferent au fost publicate pe GitHub!`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli();
}

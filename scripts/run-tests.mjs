// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const rootDir = process.cwd();
const testDistDir = path.join(rootDir, '.test-dist');

function cleanTestDist() {
  fs.rmSync(testDistDir, { recursive: true, force: true });
}

function collectTestFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.test.js'))
    .sort()
    .map((f) => path.join(dir, f));
}

try {
  cleanTestDist();

  // 1. Compilăm testele TypeScript folosind binarul local TypeScript (compatibil Windows / macOS / Linux)
  const tscEntrypoint = path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
  const tscResult = spawnSync(
    process.execPath,
    [tscEntrypoint, '-p', 'tsconfig.test.json'],
    { stdio: 'inherit', cwd: rootDir }
  );

  if (tscResult.status !== 0) {
    process.exit(tscResult.status ?? 1);
  }

  // 2. Colectăm toate fișierele .test.js fără a depinde de expandarea glob-urilor din shell (cmd.exe pe Windows)
  const unitTests = collectTestFiles(path.join(testDistDir, 'tests', 'unit'));
  const functionalTests = collectTestFiles(path.join(testDistDir, 'tests', 'functional'));
  const allTestFiles = [...unitTests, ...functionalTests];

  if (allTestFiles.length === 0) {
    console.error('Nu a fost găsit niciun fișier de test compilat în .test-dist/');
    process.exit(1);
  }

  // 3. Rulăm suita cu node --test și loader-ul ESM
  const nodeResult = spawnSync(
    process.execPath,
    ['--import', './tests/setup/esm-loader.mjs', '--test', ...allTestFiles],
    { stdio: 'inherit', cwd: rootDir }
  );

  if (nodeResult.status !== 0) {
    process.exit(nodeResult.status ?? 1);
  }
} finally {
  cleanTestDist();
}

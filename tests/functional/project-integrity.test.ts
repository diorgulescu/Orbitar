// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

function collectFilesRecursively(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectFilesRecursively(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Integritatea Proiectului, Resurse NASA/HD și Conformitate Licență GNU GPLv3', () => {
  it('toate fișierele sursă (.ts, .css, .sh) conțin antetul SPDX-License-Identifier: GPL-3.0-or-later pe prima linie', () => {
    const root = process.cwd();
    const files = [
      ...collectFilesRecursively(path.join(root, 'src'), ['.ts', '.css']),
      ...collectFilesRecursively(path.join(root, 'tests'), ['.ts', '.mjs']),
      ...collectFilesRecursively(path.join(root, 'scripts'), ['.sh', '.mjs']),
    ];

    assert.ok(files.length >= 30);
    for (const file of files) {
      const firstLine = fs.readFileSync(file, 'utf8').split('\n')[0] ?? '';
      assert.ok(
        firstLine.includes('SPDX-License-Identifier: GPL-3.0-or-later'),
        `Fișierul ${path.relative(root, file)} nu are SPDX-License-Identifier: GPL-3.0-or-later pe prima linie`
      );
    }
  });

  it('bazele de date didactice JSON (solar-system-ro.json, missions-ro.json, deep-space-ro.json, tle-iss.json) sunt valide și complete', () => {
    const solar = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/solar-system-ro.json'), 'utf8')
    );
    const missions = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/missions-ro.json'), 'utf8')
    );
    const deepSpace = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/deep-space-ro.json'), 'utf8')
    );
    const tle = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/tle-iss.json'), 'utf8')
    );

    assert.equal(solar.bodies.length, 34, 'solar-system-ro.json trebuie să conțină 34 de corpuri cerești (inclusiv Phobos, Deimos, Mimas, Iapetus, Miranda, Titania, Triton și Charon)');
    assert.equal(solar.belts.length, 2, 'solar-system-ro.json trebuie să conțină 2 centuri');
    assert.equal(missions.missions.length, 12, 'missions-ro.json trebuie să conțină 12 misiuni spațiale');
    assert.equal(deepSpace.objects.length, 20, 'deep-space-ro.json trebuie să conțină 20 de obiecte din Cosmosul Îndepărtat (stele, nebuloase și galaxii)');
    assert.ok(
      tle.satellites?.iss?.line1 && tle.satellites?.iss?.line2,
      'tle-iss.json trebuie să conțină TLE pentru ISS'
    );
    assert.ok(
      tle.satellites?.hubble?.line1 && tle.satellites?.hubble?.line2,
      'tle-iss.json trebuie să conțină TLE pentru Hubble'
    );
  });

  it('toate cele 24 de fotografii oficiale NASA/ESA/JWST/Hubble/EHT (misiuni + Cosmosul Îndepărtat) există în public/textures/nasa/', () => {
    const expectedNasaPhotos = [
      'perseverance.jpg',
      'curiosity.jpg',
      'iss.jpg',
      'jwst.jpg',
      'hubble.jpg',
      'euclid.jpg',
      'voyager1.jpg',
      'voyager2.jpg',
      'newhorizons.jpg',
      'parker.jpg',
      'rosetta.jpg',
      'juice.jpg',
      'oort_cloud.jpg',
      'proxima_centauri.jpg',
      'sirius.jpg',
      'trappist1.jpg',
      'cancri55e.jpg',
      'pleiades.jpg',
      'betelgeuse.jpg',
      'orion_nebula.jpg',
      'pillars_of_creation.jpg',
      'sagittarius_a.jpg',
      'milky_way.jpg',
      'andromeda.jpg',
    ];

    for (const filename of expectedNasaPhotos) {
      const fullPath = path.resolve(process.cwd(), 'public/textures/nasa', filename);
      assert.ok(fs.existsSync(fullPath), `Lipsește fotografia NASA/ESA ${filename}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 10000, `Fotografia NASA/ESA ${filename} este prea mică sau invalidă (${stat.size} bytes)`);
    }
  });

  it('toate cele 39 de hărți planetare, ale lunilor și stelare științifice HD există în public/textures/hd/', () => {
    const hdDir = path.resolve(process.cwd(), 'public/textures/hd');
    const hdFiles = fs.readdirSync(hdDir).filter((f: string) => f.endsWith('.jpg') || f.endsWith('.png'));
    assert.ok(hdFiles.length >= 39, `Trebuie să existe cel puțin 39 de hărți HD în public/textures/hd/ (găsite: ${hdFiles.length})`);
    assert.ok(fs.existsSync(path.join(hdDir, 'betelgeuse_convection.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'red_dwarf_flare.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'blue_star_sirius.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'cancri55e_lava.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'trappist_habitable.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'phobos_viking.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'deimos_viking.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'mimas_cassini.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'iapetus_cassini.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'miranda_voyager.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'titania_voyager.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'triton_voyager.jpg')));
    assert.ok(fs.existsSync(path.join(hdDir, 'charon_newhorizons.jpg')));
  });

  it('toate cele 132 de fișiere audio narative pre-generate în limba română există în public/audio/tts/', () => {
    const ttsDir = path.resolve(process.cwd(), 'public/audio/tts');
    assert.ok(fs.existsSync(ttsDir), 'Directorul public/audio/tts trebuie să existe');
    const mp3Files = fs.readdirSync(ttsDir).filter((f: string) => f.endsWith('.mp3'));
    assert.equal(
      mp3Files.length,
      132,
      `Trebuie să existe 132 fișiere MP3 (66 corpuri × 2 niveluri) în public/audio/tts/ (găsite: ${mp3Files.length})`
    );
    assert.ok(fs.existsSync(path.join(ttsDir, 'mars_junior.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'phobos_junior.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'deimos_cadet.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'triton_cadet.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'charon_junior.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'voyager1_junior.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'proxima_centauri_junior.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'sagittarius_a_cadet.mp3')));
    assert.ok(fs.existsSync(path.join(ttsDir, 'manifest.json')));

    const manifest = JSON.parse(fs.readFileSync(path.join(ttsDir, 'manifest.json'), 'utf8'));
    assert.ok(
      manifest.engine !== 'macos-ioana',
      'Fișierele MP3 trebuie generate cu voce neurală (nu cu vocea robotică macos-ioana)'
    );
  });

  it('src-tauri/tauri.conf.json respectă strict schema Tauri v2 fără proprietăți deprecată din v1 (distDir, window)', () => {
    const tauriConfPath = path.resolve(process.cwd(), 'src-tauri/tauri.conf.json');
    const tauriConf = JSON.parse(fs.readFileSync(tauriConfPath, 'utf8'));

    assert.equal(tauriConf.build?.frontendDist, '../dist');
    assert.equal(
      'distDir' in (tauriConf.build || {}),
      false,
      'tauri.conf.json nu trebuie să conțină build.distDir în Tauri v2'
    );
    assert.equal(
      'window' in tauriConf,
      false,
      'tauri.conf.json nu trebuie să conțină proprietatea rădăcină window în Tauri v2 (se folosește app.windows)'
    );
    assert.ok(Array.isArray(tauriConf.app?.windows) && tauriConf.app.windows.length >= 1);
    assert.equal(
      tauriConf.app?.withGlobalTauri,
      true,
      'tauri.conf.json trebuie să aibă app.withGlobalTauri: true pentru a expune API-ul nativ în fereastra Tauri'
    );

    const capPath = path.resolve(process.cwd(), 'src-tauri/capabilities/default.json');
    const cap = JSON.parse(fs.readFileSync(capPath, 'utf8'));
    assert.ok(
      Array.isArray(cap.permissions) && cap.permissions.includes('core:webview:allow-print'),
      'src-tauri/capabilities/default.json trebuie să includă permisiunea core:webview:allow-print'
    );

    const rustMainPath = path.resolve(process.cwd(), 'src-tauri/src/main.rs');
    const rustMain = fs.readFileSync(rustMainPath, 'utf8');
    assert.ok(
      rustMain.includes('fn print_sheet') && rustMain.includes('window.print()'),
      'src-tauri/src/main.rs trebuie să definească comanda nativă print_sheet pentru macOS WKWebView'
    );
    assert.ok(
      rustMain.includes('fn save_export_file'),
      'src-tauri/src/main.rs trebuie să definească comanda nativă save_export_file pentru descărcarea SVG/PNG'
    );
    assert.ok(
      rustMain.includes('fn get_app_info') && rustMain.includes('fn open_external_url'),
      'src-tauri/src/main.rs trebuie să definească comenzile native get_app_info și open_external_url pentru caseta Despre și actualizările GitHub'
    );
    assert.ok(
      String(tauriConf.app?.security?.csp || '').includes('https://api.github.com'),
      'tauri.conf.json trebuie să permită https://api.github.com în connect-src pentru verificarea release-urilor noi'
    );
  });
});

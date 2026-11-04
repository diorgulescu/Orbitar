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

  it('bazele de date didactice JSON (solar-system-ro.json, missions-ro.json, tle-iss.json) sunt valide și complete', () => {
    const solar = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/solar-system-ro.json'), 'utf8')
    );
    const missions = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/missions-ro.json'), 'utf8')
    );
    const tle = JSON.parse(
      fs.readFileSync(path.resolve(process.cwd(), 'public/data/tle-iss.json'), 'utf8')
    );

    assert.equal(solar.bodies.length, 26, 'solar-system-ro.json trebuie să conțină 26 de corpuri cerești');
    assert.equal(solar.belts.length, 2, 'solar-system-ro.json trebuie să conțină 2 centuri');
    assert.equal(missions.missions.length, 12, 'missions-ro.json trebuie să conțină 12 misiuni spațiale');
    assert.ok(
      tle.satellites?.iss?.line1 && tle.satellites?.iss?.line2,
      'tle-iss.json trebuie să conțină TLE pentru ISS'
    );
    assert.ok(
      tle.satellites?.hubble?.line1 && tle.satellites?.hubble?.line2,
      'tle-iss.json trebuie să conțină TLE pentru Hubble'
    );
  });

  it('toate cele 12 fotografii oficiale NASA pentru rovere, stații, sonde și telescoape există în public/textures/nasa/', () => {
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
    ];

    for (const filename of expectedNasaPhotos) {
      const fullPath = path.resolve(process.cwd(), 'public/textures/nasa', filename);
      assert.ok(fs.existsSync(fullPath), `Lipsește fotografia NASA ${filename}`);
      const stat = fs.statSync(fullPath);
      assert.ok(stat.size > 10000, `Fotografia NASA ${filename} este prea mică sau invalidă (${stat.size} bytes)`);
    }
  });

  it('toate cele 26 de hărți planetare științifice HD există în public/textures/hd/', () => {
    const hdDir = path.resolve(process.cwd(), 'public/textures/hd');
    const hdFiles = fs.readdirSync(hdDir).filter((f: string) => f.endsWith('.jpg') || f.endsWith('.png'));
    assert.ok(hdFiles.length >= 26, `Trebuie să existe cel puțin 26 de hărți HD în public/textures/hd/ (găsite: ${hdFiles.length})`);
  });
});

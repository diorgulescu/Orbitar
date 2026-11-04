// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { SpaceAmbientEngine } from '../../src/audio/SpaceAmbientEngine';
import {
  ColoringSvgGenerator,
  generateBodyColoringSvg,
  generateSolarSystemColoringSvg,
} from '../../src/utils/ColoringSvgGenerator';
import {
  DiplomaGenerator,
  formatRomanianDiplomaDate,
  resolveDiplomaTitleRo,
} from '../../src/utils/DiplomaGenerator';

describe('SpaceAmbientEngine (Web Audio API Generative Synthesizer) — Unit Tests', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('pornește implicit oprit (muted), comută starea prin toggle() și salvează volumul în localStorage', () => {
    const engine = SpaceAmbientEngine.getInstance();
    engine.setVolumePercent(35);
    engine.setEnabled(false);

    assert.equal(engine.isEnabled(), false);
    assert.equal(engine.getVolumePercent(), 35);

    let notifiedCount = 0;
    engine.onChange(() => {
      notifiedCount++;
    });

    const nowOn = engine.toggle();
    assert.equal(nowOn, true);
    assert.equal(engine.isEnabled(), true);
    assert.equal(window.localStorage.getItem('orbitar_music_enabled'), 'true');
    assert.ok(notifiedCount >= 1);

    engine.setVolumePercent(72);
    assert.equal(engine.getVolumePercent(), 72);
    assert.equal(window.localStorage.getItem('orbitar_music_volume'), '72');

    // Clamp între 0 și 100
    engine.setVolumePercent(150);
    assert.equal(engine.getVolumePercent(), 100);
    engine.setVolumePercent(-20);
    assert.equal(engine.getVolumePercent(), 0);

    // Auto-ducking pentru naratorul vocal și salutul Voyager
    engine.setDucking(true);
    engine.setDucking(false);

    engine.setEnabled(false);
  });
});

describe('ColoringSvgGenerator & DiplomaGenerator — Unit Tests', () => {
  it('generează planșe vectoriale SVG A4 alb-negru valide pentru toate tipurile de corpuri cerești și sonde', () => {
    const ids = [
      'sun',
      'mercury',
      'venus',
      'earth',
      'moon',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
      'io',
      'europa',
      'enceladus',
      'ganymede',
      'haumea',
      'titan',
      'vesta',
      'iss',
      'jwst',
      'hubble',
      'euclid',
      'voyager1',
      'perseverance',
      'curiosity',
      'newhorizons',
      'parker',
      'rosetta',
      'juice',
    ];

    for (const id of ids) {
      const svg = ColoringSvgGenerator.generateBodyColoringSvg(id, `Titlu ${id}`);
      assert.ok(svg.startsWith('<svg'), `SVG invalid pentru ${id}`);
      assert.ok(svg.includes('viewBox="0 0 800 520"'));
      assert.ok(svg.includes('#ffffff') && svg.includes('#000000'));
    }

    const fullSystemSvg = generateSolarSystemColoringSvg();
    assert.ok(fullSystemSvg.includes('SISTEMUL SOLAR'));
    assert.ok(generateBodyColoringSvg('saturn', 'Saturn').includes('SATURN'));
  });

  it('generează Diploma A4 Landscape cu nume personalizat, în alb pentru clasă și cu insigne deblocate', () => {
    const dateStr = formatRomanianDiplomaDate(new Date(2026, 10, 4));
    assert.equal(dateStr, '4 Noiembrie 2026');

    assert.equal(resolveDiplomaTitleRo('explorer'), 'DIPLOMĂ DE MIC EXPLORATOR');
    assert.equal(resolveDiplomaTitleRo('cadet'), 'DIPLOMĂ DE CADET SPAȚIAL');
    assert.equal(resolveDiplomaTitleRo('commander'), 'DIPLOMĂ DE COMANDANT DE NAVĂ');
    assert.equal(resolveDiplomaTitleRo(undefined, 'junior'), 'DIPLOMĂ DE MIC EXPLORATOR');

    const namedDiploma = DiplomaGenerator.generateDiplomaSvg({
      recipientName: 'Andrei Popescu',
      rank: 'commander',
      unlockedBadgeIds: ['jwst', 'mars', 'saturn'],
    });
    assert.ok(namedDiploma.includes('Andrei Popescu'));
    assert.ok(namedDiploma.includes('DIPLOMĂ DE COMANDANT DE NAVĂ'));
    assert.ok(namedDiploma.includes('BIFAT'));

    const blankDiploma = DiplomaGenerator.generateDiplomaSvg({
      recipientName: '   ',
      rank: 'explorer',
    });
    assert.ok(blankDiploma.includes('___________________________________'));
  });
});

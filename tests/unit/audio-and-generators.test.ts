// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { SpaceAmbientEngine } from '../../src/audio/SpaceAmbientEngine';
import { UiSoundEngine } from '../../src/audio/UiSoundEngine';
import {
  normalizeRomanianSpeechText,
  splitIntoSpeechSentences,
} from '../../src/audio/RomanianSpeechNormalizer';
import {
  SpeechManager,
  scoreRomanianVoice,
  selectBestRomanianVoice,
} from '../../src/audio/SpeechManager';
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

describe('UiSoundEngine & Custom Cosmic Cursors — Unit Tests', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('sintetizează efecte sonore discrete pentru click, selecție corp, tranziție fade-out/fade-in a casetei de studiu și quiz la volumul sistemului gazdă', () => {
    const ambient = SpaceAmbientEngine.getInstance();
    ambient.setVolumePercent(0);
    ambient.setEnabled(false);

    const sfx = UiSoundEngine.getInstance();
    sfx.setEnabled(true);
    assert.equal(sfx.isEnabled(), true);
    assert.equal(
      sfx.getHostVolumeGain(),
      1.0,
      'Efectele sonore UI trebuie să se audă la 100% din volumul sistemului gazdă, independent de volumul muzicii ambientale'
    );

    sfx.playClick();
    sfx.playSelectBody();
    sfx.playDrawerOpen();
    sfx.playDrawerSwitchTransition(0.22);
    sfx.playDrawerClose();
    sfx.playQuizFeedback(true);
    sfx.playQuizFeedback(false);
    assert.equal(sfx.getHostVolumeGain(), 1.0);

    sfx.installGlobalUiListeners(document);
    const btnPlayPause = document.getElementById('btn-play-pause');
    btnPlayPause?.click();

    const btnDrawerClose = document.getElementById('btn-drawer-close');
    btnDrawerClose?.click();

    sfx.setEnabled(false);
    assert.equal(sfx.isEnabled(), false);
    assert.equal(window.localStorage.getItem('orbitar_ui_sfx_enabled'), '0');
    sfx.setEnabled(true);
  });

  it('definește cursoare SVG personalizate pentru interfața Orbitar (default, pointer, grab, grabbing)', () => {
    const cssPath = path.resolve(process.cwd(), 'src/style.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert.ok(css.includes('--cursor-orbitar-default:'));
    assert.ok(css.includes('--cursor-orbitar-pointer:'));
    assert.ok(css.includes('--cursor-orbitar-grab:'));
    assert.ok(css.includes('--cursor-orbitar-grabbing:'));
  });
});

describe('RomanianSpeechNormalizer & SpeechManager — Unit Tests', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('normalizează impecabil emoji-urile, temperaturile negative/pozitive, unitățile astronomice, zecimalele și numele misiunilor', () => {
    const rawSample =
      '🚀 🌡️ Temperatura pe Jupiter este -110 °C, iar pe Venus +460 °C! Voyager 1, James Webb (JWST), Hubble, Perseverance, Curiosity și Ingenuity zboară cu 50.000 km/h (14,5 km/s) la 24.6 mil. km (1,52 UA) sau 1c cu Vlaicu-1 și Coandă-X lângă Ganymede, Callisto, Enceladus, Makemake, Haumea, Bennu și Psyche.';

    const normalized = normalizeRomanianSpeechText(rawSample);

    assert.equal(normalized.includes('🚀'), false, 'Emoji-urile trebuie eliminate');
    assert.equal(normalized.includes('🌡'), false, 'Emoji-ul termometru trebuie eliminat');
    assert.ok(
      normalized.includes('minus 110 grade Celsius'),
      `Trebuie să conțină "minus 110 grade Celsius", primit: ${normalized}`
    );
    assert.ok(
      normalized.includes('plus 460 de grade Celsius'),
      `Trebuie să conțină "plus 460 de grade Celsius", primit: ${normalized}`
    );
    assert.ok(normalized.includes('Voiager unu'));
    assert.ok(normalized.includes('Geims Ueb'));
    assert.ok(normalized.includes('Habăl'));
    assert.ok(normalized.includes('Perseverăns'));
    assert.ok(normalized.includes('Chiuriositi'));
    assert.ok(normalized.includes('Ingeniuiti'));
    assert.ok(normalized.includes('kilometri pe oră'));
    assert.ok(normalized.includes('14 virgulă 5 kilometri pe secundă'));
    assert.ok(normalized.includes('24 virgulă 6 milioane de kilometri'));
    assert.ok(normalized.includes('1 virgulă 52 Unități Astronomice'));
    assert.ok(normalized.includes('viteza luminii'));
    assert.ok(normalized.includes('Vlaicu unu'));
    assert.ok(normalized.includes('Coandă Ics'));
    assert.ok(normalized.includes('Ganimede'));
    assert.ok(normalized.includes('Calisto'));
    assert.ok(normalized.includes('Ențeladus'));
    assert.ok(normalized.includes('Make-make'));
    assert.ok(normalized.includes('Ha-u-mea'));
    assert.ok(normalized.includes('Benu'));
    assert.ok(normalized.includes('Psihe'));

    const sentences = splitIntoSpeechSentences(normalized);
    assert.equal(sentences.length, 2, 'Trebuie împărțit în 2 propoziții distincte');
  });

  it('selectează prioritar vocile neurale românești (Emil/Alina Natural, Google română, Ioana Enhanced) și aplică chunking pe propoziții', () => {
    const mockVoices = [
      { name: 'English US', lang: 'en-US', localService: true } as SpeechSynthesisVoice,
      { name: 'Ioana', lang: 'ro-RO', localService: true } as SpeechSynthesisVoice,
      {
        name: 'Microsoft Emil Online (Natural) - Romanian (Romania)',
        lang: 'ro-RO',
        localService: false,
      } as SpeechSynthesisVoice,
    ];

    assert.ok(scoreRomanianVoice(mockVoices[2]) > scoreRomanianVoice(mockVoices[1]));
    assert.equal(scoreRomanianVoice(mockVoices[0]), -1);

    const best = selectBestRomanianVoice(mockVoices);
    assert.equal(best?.name, 'Microsoft Emil Online (Natural) - Romanian (Romania)');

    const speechMgr = SpeechManager.getInstance();
    let ended = false;
    speechMgr.speak('Marte are -63 °C. Roverul Perseverance explorează craterul!', {
      forceWebSpeech: true,
      sentencePauseMs: 0,
      onEnd: () => {
        ended = true;
      },
    });

    assert.equal(ended, true);
    assert.ok(
      speechMgr.getLastSpokenNormalizedText().includes('minus 63 grade Celsius') &&
        speechMgr.getLastSpokenNormalizedText().includes('Perseverăns')
    );
    assert.equal(speechMgr.getLastSpokenSentences().length, 2);
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

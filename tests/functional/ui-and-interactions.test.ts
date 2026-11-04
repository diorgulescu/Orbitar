// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { ScaleManager } from '../../src/core/ScaleManager';
import { OrbitalEngine } from '../../src/core/OrbitalEngine';
import { CameraController } from '../../src/core/CameraController';
import { SurfaceMarkers } from '../../src/core/SurfaceMarkers';
import { HeaderHud, matchesLayerFilter } from '../../src/ui/HeaderHud';
import { BottomDock } from '../../src/ui/BottomDock';
import { StudyDrawer } from '../../src/ui/StudyDrawer';
import { LightSpeedRuler } from '../../src/ui/LightSpeedRuler';
import { OrbitarMissions } from '../../src/ui/OrbitarMissions';
import { PrintManager } from '../../src/ui/PrintManager';
import { LicenseModal } from '../../src/ui/LicenseModal';
import { SpacecraftPilot } from '../../src/game/SpacecraftPilot';
import { CockpitHUD } from '../../src/ui/CockpitHUD';
import { SpeechManager } from '../../src/audio/SpeechManager';

describe('UI, CameraController & SurfaceMarkers — Functional Integration Tests', () => {
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let scaleManager: ScaleManager;
  let orbitalEngine: OrbitalEngine;
  let cameraController: CameraController;
  let surfaceMarkers: SurfaceMarkers;

  beforeEach(async () => {
    setupTestDomEnvironment();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, 1280 / 800, 0.0002, 24000);
    camera.position.set(0, 75, 135);

    const domEl = document.getElementById('canvas-container') as unknown as HTMLElement;
    const controls = new OrbitControls(camera, domEl);

    scaleManager = new ScaleManager('didactic');
    orbitalEngine = new OrbitalEngine(scene, scaleManager, new Date('2026-07-15T10:00:00Z'));
    await orbitalEngine.initialize();

    cameraController = new CameraController(camera, controls, domEl, orbitalEngine, scaleManager);
    const labelsContainer = document.getElementById('labels-container') as unknown as HTMLElement;
    surfaceMarkers = new SurfaceMarkers(orbitalEngine, labelsContainer);
  });

  it('SurfaceMarkers creează pini dedicați pentru Roverul Perseverance și Roverul Curiosity separat de cratere și îi menține vizibili la rotația lui Marte', () => {
    const markers = surfaceMarkers.getMarkers();
    assert.equal(markers.length, 9);

    const percyPin = surfaceMarkers.getMarkerByLinkedBodyId('perseverance')!;
    const curioPin = surfaceMarkers.getMarkerByLinkedBodyId('curiosity')!;
    assert.ok(percyPin, 'Trebuie să existe pin dedicat pentru Perseverance');
    assert.ok(curioPin, 'Trebuie să existe pin dedicat pentru Curiosity');
    assert.equal(percyPin.icon, '🤖');
    assert.equal(curioPin.icon, '🤖');
    assert.equal(percyPin.imageUrl, './textures/nasa/perseverance.jpg');
    assert.equal(curioPin.imageUrl, './textures/nasa/curiosity.jpg');

    // Când selectăm Marte, pinii ambelor rovere devin vizibili chiar dacă unul se află pe emisfera opusă
    cameraController.focusBody('mars');
    for (let step = 0; step < 30; step++) {
      orbitalEngine.updatePositions(0.5);
      cameraController.update(0.1);
    }
    surfaceMarkers.update(camera, cameraController.getTrackedBody());

    const labelsContainer = document.getElementById('labels-container') as any;
    const roverBadges = (labelsContainer.children as any[]).filter((el) =>
      el.classList.contains('is-rover-pin')
    );
    assert.equal(roverBadges.length, 2, 'Trebuie să existe 2 butoane de pin pentru rovere în DOM');
    for (const badge of roverBadges) {
      assert.equal(
        badge.classList.contains('is-hidden'),
        false,
        `Pinul roverului (${badge.textContent}) trebuie să fie vizibil când Marte este selectată`
      );
    }
  });

  it('CameraController păstrează camera în afara Pământului la selectarea JWST și urmărește sincron rotația lui Marte la selectarea unui Rover', () => {
    const earth = orbitalEngine.getBody('earth')!;
    cameraController.focusBody('jwst');
    for (let i = 0; i < 40; i++) {
      orbitalEngine.updatePositions(0.1);
      cameraController.update(0.1);
    }
    const camDistToEarthCenter = camera.position.distanceTo(earth.worldPosition);
    assert.ok(
      camDistToEarthCenter > earth.visualRadius * 2.5,
      `Camera pentru JWST nu trebuie să intre în Pământ (distanță: ${camDistToEarthCenter}, rază Pământ: ${earth.visualRadius})`
    );

    // Selectăm roverul Perseverance pe Marte și rulăm simularea în timp ce Marte se rotește
    const mars = orbitalEngine.getBody('mars')!;
    cameraController.focusBody('perseverance');
    for (let i = 0; i < 60; i++) {
      orbitalEngine.updatePositions(0.25);
      cameraController.update(0.1);
      const distFromMars = camera.position.distanceTo(mars.worldPosition);
      assert.ok(
        distFromMars >= mars.visualRadius * 1.35,
        `Camera nu trebuie să intre în interiorul planetei Marte în timpul rotației (pasul ${i})`
      );
    }
  });

  it('StudyDrawer & OrbitarLab afișează fotografia oficială NASA pentru rovere/sonde, comută Junior/Cadet și calculează greutatea/vârsta', () => {
    let unlockedBadge: string | null = null;
    const studyDrawer = new StudyDrawer(
      orbitalEngine,
      'junior',
      () => cameraController.resetToOverview(),
      (badgeId) => {
        unlockedBadge = badgeId;
      }
    );

    const percy = orbitalEngine.getBody('perseverance')!;
    studyDrawer.showBody(percy);

    const mediaCard = document.getElementById('hud-target-media')!;
    const mediaImg = document.getElementById('hud-target-img') as any;
    assert.equal(
      mediaCard.classList.contains('is-hidden'),
      false,
      'Caseta foto NASA (#hud-target-media) trebuie să fie vizibilă pentru Perseverance'
    );
    assert.equal(mediaImg.src, './textures/nasa/perseverance.jpg');

    // Pentru o planetă (ex: Marte), caseta foto NASA a sondei/roverului este ascunsă, iar calculatorul de greutate calculează gravitația marțiană
    const mars = orbitalEngine.getBody('mars')!;
    studyDrawer.showBody(mars);
    assert.equal(mediaCard.classList.contains('is-hidden'), true);
    const weightRes = document.getElementById('lab-result-weight')!;
    assert.ok(weightRes.textContent?.includes('kg'));

    // Apăsăm pe "🔊 Citește-mi" (#btn-speak-ro) pentru Marte și apoi pentru sonda Voyager 1
    const btnSpeak = document.getElementById('btn-speak-ro')!;
    btnSpeak.click();
    assert.ok(SpeechManager.getInstance().getLastSpokenNormalizedText().includes('Marte'));
    studyDrawer.stopSpeech();

    const voyager1 = orbitalEngine.getBody('voyager1')!;
    studyDrawer.showBody(voyager1);
    btnSpeak.click();
    assert.ok(
      SpeechManager.getInstance().getLastSpokenNormalizedText().includes('Voiager unu'),
      'Textul narativ pentru Voyager 1 trebuie normalizat fonetic în "Voiager unu"'
    );
    studyDrawer.stopSpeech();

    // Revenim la Marte, comutăm în modul Cadet (9–12 ani) și răspundem corect la Quiz
    studyDrawer.showBody(mars);
    studyDrawer.setTier('cadet');
    const quizOptions = document.getElementById('hud-quiz-options') as any;
    const correctIdx = mars.data.cadet.quiz.correctIndex;
    quizOptions.children[correctIdx]?.click();
    assert.equal(unlockedBadge, 'mars');
  });

  it('HeaderHud, BottomDock, LightSpeedRuler, OrbitarMissions, PrintManager și LicenseModal funcționează integrat', () => {
    assert.equal(matchesLayerFilter('terrestrial', 'planets_moons'), true);
    assert.equal(matchesLayerFilter('rover', 'probes_telescopes'), true);
    assert.equal(matchesLayerFilter('dwarf', 'dwarfs_asteroids'), true);

    let selectedFromHud: string | null = null;
    let selectedLayerFilter: string = 'all';
    const headerHud = new HeaderHud(orbitalEngine.getBodies(), {
      onSelectBody: (id) => {
        selectedFromHud = id;
      },
      onFilterChange: (filter) => {
        selectedLayerFilter = filter;
      },
      onTierChange: () => {},
    });
    assert.equal(headerHud.getTier(), 'junior');
    assert.equal(headerHud.getFilter(), 'all');

    const layerFilterSelect = document.getElementById('hud-layer-filter-select') as HTMLSelectElement | null;
    assert.ok(layerFilterSelect, 'Trebuie să existe dropdown-ul #hud-layer-filter-select pentru filtrarea obiectelor');
    assert.equal(layerFilterSelect.value, 'all');
    layerFilterSelect.value = 'probes_telescopes';
    layerFilterSelect.dispatchEvent({ type: 'change' } as unknown as Event);
    assert.equal(headerHud.getFilter(), 'probes_telescopes');
    assert.equal(selectedLayerFilter, 'probes_telescopes');

    // Căutare fără diacritice în bara de căutare
    const searchInput = document.getElementById('hud-search-input') as any;
    searchInput.value = 'pamant';
    searchInput.dispatchEvent({ type: 'input' });
    const searchDropdown = document.getElementById('hud-search-results') as any;
    assert.equal(searchDropdown.classList.contains('is-hidden'), false);
    searchDropdown.children[0]?.click();
    assert.equal(selectedFromHud, 'earth');

    // BottomDock: verificare viteză implicită "1 min / sec" și buton Pauză
    const bottomDock = new BottomDock(orbitalEngine, scaleManager);
    bottomDock.updateDateReadout();
    assert.equal(document.getElementById('hud-speed-label')?.textContent, '1 min / sec');
    document.getElementById('btn-time-pause')?.click();
    assert.equal(orbitalEngine.isPaused, true);

    // LightSpeedRuler: activare și calcul distanță Pământ -> Marte
    const ruler = new LightSpeedRuler(scene, orbitalEngine);
    document.getElementById('btn-ruler-toggle')?.click();
    ruler.update(0.5);
    assert.ok(document.getElementById('ruler-readout-au')?.textContent?.includes('UA'));
    assert.ok(document.getElementById('ruler-readout-km')?.textContent?.includes('km'));

    // OrbitarMissions & PrintManager & LicenseModal
    const missions = new OrbitarMissions(orbitalEngine, () => {});
    missions.unlockBadge('jwst');
    assert.ok(missions.getUnlockedBadges().includes('jwst'));

    const printManager = new PrintManager(
      orbitalEngine,
      () => 'cadet',
      () => missions.getUnlockedBadges()
    );
    const studyHtml = printManager.populateStudySheet('perseverance');
    assert.ok(studyHtml.includes('Perseverance'));
    assert.equal(
      document.getElementById('btn-coloring-modal-open'),
      null,
      'Butonul Planșe de Colorat & Fișe nu trebuie să fie dublat în antetul de sus'
    );
    document.getElementById('btn-dock-coloring')?.click();
    assert.equal(
      document.getElementById('hud-coloring-modal')?.classList.contains('is-hidden'),
      false,
      'Butonul #btn-dock-coloring din bara de jos deschide fereastra Planșe de Colorat & Fișe'
    );

    // Verificăm că openModalForBody + printColoringSheet deschide fereastra pe corpul selectat și apelează print_sheet în Tauri
    document.getElementById('hud-coloring-modal')?.classList.add('is-hidden');
    let tauriPrintInvoked = false;
    (window as any).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string) => {
        if (cmd === 'print_sheet') {
          tauriPrintInvoked = true;
        }
        return true;
      },
    };
    printManager.openModalForBody('saturn', 'coloring');
    printManager.printColoringSheet('saturn');
    assert.equal(
      document.getElementById('hud-coloring-modal')?.classList.contains('is-hidden'),
      false,
      'openModalForBody trebuie să deschidă fereastra modală de colorat pentru Saturn'
    );
    assert.ok(
      document.getElementById('coloring-preview-title')?.textContent?.includes('Saturn'),
      'Previzualizarea din fereastra modală trebuie să afișeze Saturn'
    );
    assert.equal(
      tauriPrintInvoked,
      true,
      'În aplicația desktop Tauri (macOS .dmg), printColoringSheet trebuie să apeleze comanda nativă print_sheet'
    );
    delete (window as any).__TAURI_INTERNALS__;

    new LicenseModal();
    const gplModal = document.getElementById('hud-gpl-modal')!;
    document.getElementById('btn-gpl-modal')?.click();
    assert.equal(gplModal.classList.contains('is-hidden'), false);
    (document as any).dispatchEvent({ type: 'keydown', key: 'Escape' });
    assert.equal(gplModal.classList.contains('is-hidden'), true);
  });

  it('SpacecraftPilot & CockpitHUD: zboară de la Pământ la Jupiter fără alerte de scuturi și deschide Briefingul de Sosire', () => {
    const pilot = new SpacecraftPilot(scene, camera, orbitalEngine, scaleManager, cameraController);
    const cockpitHud = new CockpitHUD(camera, orbitalEngine, pilot, {
      onOpenStudySheet: () => {},
      onExitPilotMode: () => {},
    });

    // 1. Activăm Modul Pilot ("🚀 La Manșa Navei")
    pilot.setPilotMode(true);
    cockpitHud.update();
    assert.equal(pilot.isActive(), true);
    assert.equal(cameraController.isEnabled(), false);

    // 2. Comutăm între cele 3 nave spațiale (Vlaicu-1, Coandă-X, Luceafărul)
    pilot.selectShip('coandax');
    assert.equal(pilot.getCurrentShip().speedKmh, 1_500_000);
    pilot.selectShip('luceafarul');
    assert.equal(pilot.getCurrentShip().lightSpeedPercent, 100);
    pilot.selectShip('vlaicu1');
    assert.equal(pilot.getCurrentShip().speedKmh, 50_000);

    // 3. Zburăm pe Pilot Automat de la Pământ către Jupiter fără alerte derutante
    let beltAlertTriggered = false;
    pilot.onBeltAlert(() => {
      beltAlertTriggered = true;
    });

    let arrivalReportReceived = false;
    pilot.onArrivalBriefing((report) => {
      if (report.body.data.id === 'jupiter') {
        arrivalReportReceived = true;
      }
    });

    cockpitHud.handleFlyToTarget('jupiter');
    for (let step = 0; step < 30; step++) {
      pilot.update(0.2);
      cockpitHud.update();
    }

    assert.equal(beltAlertTriggered, false, 'Nu trebuie să apară alerte de scuturi/gheață în timpul zborului');
    assert.equal(document.getElementById('cockpit-belt-alert'), null, 'Elementul #cockpit-belt-alert a fost eliminat din HUD');
    assert.equal(arrivalReportReceived, true, 'Trebuie să se deschidă raportul Calculatorului de Bord la sosirea lângă Jupiter');

    const briefingEl = document.getElementById('cockpit-arrival-briefing')!;
    assert.equal(briefingEl.classList.contains('is-hidden'), false);
    assert.ok(document.getElementById('briefing-headline')?.textContent?.includes('Jupiter'));
    assert.ok(document.getElementById('briefing-earth-clock')?.textContent?.includes('Vlaicu-1'));

    // Verificăm că raportul vocal al Calculatorului de Bord transformă "-110" în "minus 110 grade Celsius" și "Vlaicu-1" în "Vlaicu unu"
    document.getElementById('btn-briefing-repeat-audio')?.click();
    const spokenBriefing = SpeechManager.getInstance().getLastSpokenNormalizedText();
    assert.ok(spokenBriefing.includes('minus 110 grade Celsius'));
    assert.ok(spokenBriefing.includes('Vlaicu unu'));
    cockpitHud.stopCockpitSpeech();
  });
});

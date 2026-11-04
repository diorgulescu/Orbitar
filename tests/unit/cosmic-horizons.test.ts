// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { ScaleManager } from '../../src/core/ScaleManager';
import { OrbitalEngine } from '../../src/core/OrbitalEngine';
import { CameraController } from '../../src/core/CameraController';
import { CosmicScaleNavigator } from '../../src/core/CosmicScaleNavigator';
import { ProceduralModels } from '../../src/core/ProceduralModels';
import { RomanianSpeechNormalizer } from '../../src/audio/RomanianSpeechNormalizer';
import { StudyDrawer } from '../../src/ui/StudyDrawer';
import { ColoringSvgGenerator } from '../../src/utils/ColoringSvgGenerator';
import { SpacecraftPilot } from '../../src/game/SpacecraftPilot';

describe('Cele 3 Orizonturi Cosmice (CosmicScaleNavigator, Deep Space 3D, Voce, Colorat și Salt Hiperspațial)', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('OrbitalEngine încarcă toate cele 50 de obiecte pe 3 Orizonturi Cosmice și CosmicScaleNavigator comută grupurile 3D + indicatorul Acasă', async () => {
    const scene = new THREE.Scene();
    const scaleManager = new ScaleManager('didactic');
    const orbitalEngine = new OrbitalEngine(scene, scaleManager, new Date('2026-06-01T12:00:00Z'));
    await orbitalEngine.initialize();

    assert.equal(orbitalEngine.getAllBodies().length, 50);
    assert.equal(orbitalEngine.getBodiesForHorizon('solar').length, 38);
    assert.equal(orbitalEngine.getBodiesForHorizon('interstellar').length, 7);
    assert.equal(orbitalEngine.getBodiesForHorizon('galactic').length, 5);

    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.01, 20000);
    const controlsMock: any = {
      target: new THREE.Vector3(),
      minDistance: 0.1,
      maxDistance: 2000,
      enabled: true,
      update: () => {},
      addEventListener: () => {},
    };
    const domEl = document.createElement('canvas') as unknown as HTMLElement;
    const cameraController = new CameraController(
      camera,
      controlsMock,
      domEl,
      orbitalEngine,
      scaleManager
    );
    const labelsContainer = document.getElementById('labels-container');
    const navigator = new CosmicScaleNavigator(
      orbitalEngine,
      camera,
      cameraController,
      labelsContainer
    );

    assert.equal(navigator.getHorizon(), 'solar');
    const horizonSelect = document.getElementById('hud-horizon-select') as HTMLSelectElement | null;
    assert.ok(horizonSelect, 'Trebuie să existe dropdown-ul #hud-horizon-select în antet');
    assert.equal(horizonSelect.value, 'solar', 'Dropdown-ul trebuie setat implicit pe Sistemul Solar');

    const aboutBtn = document.getElementById('btn-about-orbitar');
    assert.ok(aboutBtn, 'Trebuie să existe butonul discret de info #btn-about-orbitar');
    assert.equal(aboutBtn.getAttribute('href'), 'https://orbitar.ro');
    assert.equal(aboutBtn.getAttribute('aria-label'), 'Despre proiect (orbitar.ro)');

    const homeMarker = document.getElementById('hud-home-solar-marker');
    assert.ok(homeMarker, 'Trebuie să existe indicatorul #hud-home-solar-marker');
    assert.ok(homeMarker.classList.contains('is-hidden'));

    // Comutăm pe Orizontul Interstelar (Stele & Exoplanete)
    navigator.setHorizon('interstellar');
    assert.equal(navigator.getHorizon(), 'interstellar');
    assert.equal(horizonSelect.value, 'interstellar');
    assert.equal(orbitalEngine.getActiveHorizon(), 'interstellar');
    assert.equal(orbitalEngine.getHorizonGroup('interstellar').visible, true);
    assert.equal(orbitalEngine.getHorizonGroup('solar').visible, false);
    assert.equal(homeMarker.classList.contains('is-hidden'), false);

    // Comutăm pe Orizontul Galactic (Calea Lactee & Galaxii) direct din dropdown
    horizonSelect.value = 'galactic';
    horizonSelect.dispatchEvent({ type: 'change' } as unknown as Event);
    assert.equal(navigator.getHorizon(), 'galactic');
    assert.equal(orbitalEngine.getHorizonGroup('galactic').visible, true);
    assert.equal(orbitalEngine.getHorizonGroup('interstellar').visible, false);
    assert.ok(homeMarker.textContent?.includes('Aici este Sistemul nostru Solar (Acasă)'));
  });

  it('ProceduralModels respectă bugetul de particule Eco (4.000) vs HD (25.000) pentru galaxii spirale și creează TRAPPIST-1 cu 7 planete', async () => {
    const scene = new THREE.Scene();
    const scaleManager = new ScaleManager('didactic');
    const orbitalEngine = new OrbitalEngine(scene, scaleManager);
    await orbitalEngine.initialize();

    const milkyWayData = orbitalEngine.getBody('milky_way')!.data;
    const trappistData = orbitalEngine.getBody('trappist1')!.data;

    const galaxyEco = ProceduralModels.createCelestialVisual(milkyWayData, 'eco');
    let ecoPointsCount = 0;
    galaxyEco.visualRoot.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Points) {
        const posAttr = obj.geometry.getAttribute('position');
        if (posAttr && posAttr.count >= 4000) {
          ecoPointsCount = posAttr.count;
        }
      }
    });
    assert.equal(ecoPointsCount, 4000, 'În modul Eco galaxia spirală trebuie să aibă exact 4.000 de particule');

    const galaxyHd = ProceduralModels.createCelestialVisual(milkyWayData, 'hd');
    let hdPointsCount = 0;
    galaxyHd.visualRoot.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Points) {
        const posAttr = obj.geometry.getAttribute('position');
        if (posAttr && posAttr.count >= 25000) {
          hdPointsCount = posAttr.count;
        }
      }
    });
    assert.equal(hdPointsCount, 25000, 'În modul HD galaxia spirală trebuie să aibă exact 25.000 de particule');

    const trappist = ProceduralModels.createCelestialVisual(trappistData, 'hd');
    assert.ok(trappist.visualRoot.children.length >= 7);
  });

  it('RomanianSpeechNormalizer pronunță fonetic corect Proxima Centauri, Betelgeuse, TRAPPIST-1, Sagittarius A* și ani-lumină', () => {
    const raw =
      'Zburăm spre Proxima Centauri (4.24 a.l.), apoi spre TRAPPIST-1 (40 al), Betelgeuse și gaura neagră Sagittarius A*!';
    const normalized = RomanianSpeechNormalizer.normalize(raw);

    assert.ok(normalized.includes('Procsima Centauri'));
    assert.ok(normalized.includes('4 virgulă 24 ani-lumină'));
    assert.ok(normalized.includes('Trapist unu'));
    assert.ok(normalized.includes('40 ani-lumină'));
    assert.ok(normalized.includes('Betelgeuz'));
    assert.ok(normalized.includes('Sagitarius A stea'));
  });

  it('StudyDrawer afișează caseta "Ce este un An-Lumină?" și ColoringSvgGenerator desenează Calea Lactee, TRAPPIST-1 și Gaura Neagră', async () => {
    const scene = new THREE.Scene();
    const scaleManager = new ScaleManager('didactic');
    const orbitalEngine = new OrbitalEngine(scene, scaleManager);
    await orbitalEngine.initialize();

    const drawer = new StudyDrawer(
      orbitalEngine,
      'junior',
      () => {},
      () => {}
    );

    const betelgeuse = orbitalEngine.getBody('betelgeuse')!;
    drawer.showBody(betelgeuse);

    const lyCard = document.getElementById('hud-lightyear-explainer');
    const distEl = document.getElementById('hud-target-dist');
    const mediaCard = document.getElementById('hud-target-media');
    const mediaImg = document.getElementById('hud-target-img') as HTMLImageElement | null;
    assert.ok(lyCard && !lyCard.classList.contains('is-hidden'));
    assert.ok(distEl?.textContent?.includes('640') && distEl?.textContent?.includes('ani-lumină'));
    assert.ok(mediaCard && !mediaCard.classList.contains('is-hidden'), 'Caseta foto NASA/ESA trebuie să fie vizibilă pentru Betelgeuse');
    assert.equal(mediaImg?.src, './textures/nasa/betelgeuse.jpg');

    const milkyWaySvg = ColoringSvgGenerator.generateBodyColoringSvg('milky_way', 'Calea Lactee');
    assert.ok(milkyWaySvg.includes('AICI SUNTEM NOI'));

    const trappistSvg = ColoringSvgGenerator.generateBodyColoringSvg('trappist1', 'TRAPPIST-1');
    assert.ok(trappistSvg.includes('ZONA LOCUIBILĂ'));

    const blackHoleSvg = ColoringSvgGenerator.generateBodyColoringSvg('sagittarius_a', 'Sagittarius A*');
    assert.ok(blackHoleSvg.includes('ORIZONTUL EVENIMENTELOR'));
    assert.ok(blackHoleSvg.includes('DISCUL DE ACREȚIE'));
  });

  it('SpacecraftPilot activează Motorul Hiperspațial pe Luceafărul și anunță în Briefingul de Sosire anul istoric al plecării luminii', async () => {
    const scene = new THREE.Scene();
    const scaleManager = new ScaleManager('didactic');
    const orbitalEngine = new OrbitalEngine(scene, scaleManager, new Date('2026-06-01T12:00:00Z'));
    await orbitalEngine.initialize();

    const camera = new THREE.PerspectiveCamera(48, 16 / 9, 0.01, 20000);
    const controlsMock: any = {
      target: new THREE.Vector3(),
      minDistance: 0.1,
      maxDistance: 2000,
      enabled: true,
      update: () => {},
      addEventListener: () => {},
    };
    const domEl = document.createElement('canvas') as unknown as HTMLElement;
    const cameraController = new CameraController(
      camera,
      controlsMock,
      domEl,
      orbitalEngine,
      scaleManager
    );

    const pilot = new SpacecraftPilot(scene, camera, orbitalEngine, scaleManager, cameraController);
    pilot.setPilotMode(true);

    let arrivalReportText = '';
    pilot.onArrivalBriefing((report) => {
      arrivalReportText = report.fullSpeechTextRo;
    });

    pilot.engageAutopilot('pleiades');
    assert.equal(pilot.getCurrentShip().id, 'luceafarul');
    assert.equal(orbitalEngine.getActiveHorizon(), 'interstellar');

    // Simulare zbor complet (5 secunde > 4.6s)
    for (let i = 0; i < 55; i++) {
      pilot.update(0.1);
    }

    assert.ok(
      arrivalReportText.includes('Motor Hiperspațial'),
      'Briefingul trebuie să menționeze Motorul Hiperspațial al Astronavei Luceafărul'
    );
    assert.ok(
      arrivalReportText.includes('Mihai Viteazul'),
      'Briefingul pentru Pleiade trebuie să menționeze că lumina a plecat pe vremea lui Mihai Viteazul'
    );
  });
});

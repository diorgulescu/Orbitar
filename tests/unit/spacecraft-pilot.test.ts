// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { ScaleManager } from '../../src/core/ScaleManager';
import { OrbitalEngine } from '../../src/core/OrbitalEngine';
import { CameraController } from '../../src/core/CameraController';
import {
  ASTEROID_BELT_ALERT_RO,
  KUIPER_BELT_ALERT_RO,
  SPACECRAFT_SPECS,
  SPEED_OF_LIGHT_KMH,
  SpacecraftPilot,
  computeCalibratedFlightMetrics,
  formatDidacticTripDurationRo,
} from '../../src/game/SpacecraftPilot';

describe('SpacecraftPilot — Cele 3 Nave, Fizica Timpului, Centurile de Asteroizi și Briefingul de Sosire', () => {
  let scene: THREE.Scene;
  let camera: THREE.PerspectiveCamera;
  let scaleManager: ScaleManager;
  let orbitalEngine: OrbitalEngine;
  let cameraController: CameraController;
  let pilot: SpacecraftPilot;

  beforeEach(async () => {
    setupTestDomEnvironment();
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(48, 1280 / 800, 0.0001, 60000);
    camera.position.set(0, 75, 135);

    const domEl = document.getElementById('canvas-container') as unknown as HTMLElement;
    const controls = new OrbitControls(camera, domEl);

    scaleManager = new ScaleManager('didactic');
    orbitalEngine = new OrbitalEngine(scene, scaleManager, new Date('2026-07-15T10:00:00Z'));
    await orbitalEngine.initialize();

    cameraController = new CameraController(camera, controls, domEl, orbitalEngine, scaleManager);
    pilot = new SpacecraftPilot(scene, camera, orbitalEngine, scaleManager, cameraController);
  });

  it('definește corect cele 3 nave spațiale (Vlaicu-1, Coandă-X, Luceafărul) și calibrează timpii de călătorie', () => {
    assert.equal(SPACECRAFT_SPECS.vlaicu1.speedKmh, 50_000);
    assert.equal(SPACECRAFT_SPECS.vlaicu1.theme, 'amber');

    assert.equal(SPACECRAFT_SPECS.coandax.speedKmh, 1_500_000);
    assert.equal(SPACECRAFT_SPECS.coandax.theme, 'cyan');

    assert.equal(SPACECRAFT_SPECS.luceafarul.speedKmh, Math.round(SPEED_OF_LIGHT_KMH));
    assert.equal(SPACECRAFT_SPECS.luceafarul.lightSpeedPercent, 100);
    assert.equal(SPACECRAFT_SPECS.luceafarul.theme, 'violet');

    const earth = orbitalEngine.getBody('earth')!;
    const moon = orbitalEngine.getBody('moon')!;
    const mars = orbitalEngine.getBody('mars')!;
    const jupiter = orbitalEngine.getBody('jupiter')!;
    const neptune = orbitalEngine.getBody('neptune')!;

    // Vlaicu-1: 3 zile la Lună, ~7 luni la Marte, ~5-6 ani la Jupiter, ~12 ani la Neptun
    const moonVlaicu = computeCalibratedFlightMetrics(earth, moon, 0.00257, SPACECRAFT_SPECS.vlaicu1);
    assert.equal(formatDidacticTripDurationRo(moonVlaicu.durationHours), '3 zile');

    const marsVlaicu = computeCalibratedFlightMetrics(earth, mars, 1.0, SPACECRAFT_SPECS.vlaicu1);
    assert.equal(formatDidacticTripDurationRo(marsVlaicu.durationHours), '7 luni');

    const jupVlaicu = computeCalibratedFlightMetrics(earth, jupiter, 4.2, SPACECRAFT_SPECS.vlaicu1);
    assert.ok(formatDidacticTripDurationRo(jupVlaicu.durationHours).includes('5 ani'));

    const nepVlaicu = computeCalibratedFlightMetrics(earth, neptune, 29.0, SPACECRAFT_SPECS.vlaicu1);
    assert.equal(formatDidacticTripDurationRo(nepVlaicu.durationHours), '12 ani');

    // Luceafărul (1c): ~43 minute la 5.2 UA (Jupiter) și ~4 ore la 29 UA (Neptun)
    const jupLight = computeCalibratedFlightMetrics(earth, jupiter, 5.2, SPACECRAFT_SPECS.luceafarul);
    assert.ok(jupLight.durationHours * 60 >= 41 && jupLight.durationHours * 60 <= 45);
  });

  it('ScaleManager.unscaleHeliocentricDistanceAu este inversa exactă a scaleHeliocentricPosition în modurile Didactic și Real', () => {
    for (const mode of ['didactic', 'real'] as const) {
      scaleManager.setMode(mode);
      for (const testAu of [0.39, 1.0, 2.5, 5.2, 9.5, 30.1, 42.0]) {
        const scaled = scaleManager.scaleHeliocentricPosition(new THREE.Vector3(testAu, 0, 0));
        const unscaledAu = scaleManager.unscaleHeliocentricDistanceAu(scaled);
        assert.ok(
          Math.abs(unscaledAu - testAu) < 0.001,
          `Inversa UA eșuată în modul ${mode} pentru ${testAu} UA (rezultat: ${unscaledAu})`
        );
      }
    }
  });

  it('activează Scuturile Deflectoare în Centura Principală de Asteroizi (2.1–3.3 UA) și în Centura Kuiper (30–50 UA)', () => {
    pilot.setPilotMode(true);

    const triggeredZones: string[] = [];
    const triggeredMessages: string[] = [];
    pilot.onBeltAlert((zone, msg) => {
      triggeredZones.push(zone);
      triggeredMessages.push(msg);
    });

    // Zbor Pământ -> Jupiter (traversează Centura Principală de Asteroizi 2.1–3.3 UA)
    pilot.engageAutopilot('jupiter');
    for (let i = 0; i < 30; i++) {
      pilot.update(0.2);
    }
    assert.ok(triggeredZones.includes('asteroid_belt'));
    assert.ok(triggeredMessages.includes(ASTEROID_BELT_ALERT_RO));

    // Zbor Jupiter -> Pluto (traversează Centura Kuiper 30–50 UA)
    pilot.engageAutopilot('pluto');
    for (let i = 0; i < 30; i++) {
      pilot.update(0.2);
    }
    assert.ok(triggeredZones.includes('kuiper_belt'));
    assert.ok(triggeredMessages.includes(KUIPER_BELT_ALERT_RO));
  });
});

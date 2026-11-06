// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { ISSTracker } from '../../src/core/ISSTracker';
import { OrbitalEngine } from '../../src/core/OrbitalEngine';
import { ScaleManager } from '../../src/core/ScaleManager';

describe('ISSTracker (SGP4 / satellite.js) — Unit Tests', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('încarcă TLE-urile locale dintle-iss.json și calculează telemetria SGP4 pentru ISS și Hubble', async () => {
    const tracker = new ISSTracker();
    await tracker.initialize();

    const testDate = new Date('2026-06-15T12:00:00Z');
    const issTel = tracker.getTelemetry('iss', testDate);
    assert.ok(issTel.latitudeDeg >= -90 && issTel.latitudeDeg <= 90);
    assert.ok(issTel.longitudeDeg >= -180 && issTel.longitudeDeg <= 180);
    assert.ok(issTel.altitudeKm > 300 && issTel.altitudeKm < 550);
    assert.ok(issTel.velocityKmh > 25000 && issTel.velocityKmh < 30000);
    assert.equal(issTel.source, 'offline-sgp4');

    const hubbleTel = tracker.getTelemetry('hubble', testDate);
    assert.ok(hubbleTel.altitudeKm > 450 && hubbleTel.altitudeKm < 650);

    const offsetAu = tracker.getOffsetFromEarthAu('iss', testDate);
    assert.ok(offsetAu.length() > 0, 'Vectorul 3D de offset al ISS față de Pământ trebuie să fie nenul');

    // În mod offline (fără internet), syncLiveISSCoordinates revine grațios la SGP4 offline
    const syncRes = await tracker.syncLiveISSCoordinates();
    assert.equal(syncRes.isOnlineLive, false);
  });
});

describe('OrbitalEngine — Unit & Integration Tests', () => {
  let scene: THREE.Scene;
  let scaleManager: ScaleManager;
  let engine: OrbitalEngine;

  beforeEach(async () => {
    setupTestDomEnvironment();
    scene = new THREE.Scene();
    scaleManager = new ScaleManager('didactic');
    engine = new OrbitalEngine(scene, scaleManager, new Date('2026-07-01T00:00:00Z'));
    await engine.initialize();
  });

  it('pornește cu viteza implicită de 1 min / sec (timeScale = 60) și încarcă toate cele 38 de corpuri și misiuni', () => {
    assert.equal(engine.timeScale, 60, 'Viteza orbitală implicită trebuie să fie 60 (1 min / sec)');
    assert.equal(engine.isPaused, false);

    const bodies = engine.getBodies();
    assert.equal(bodies.length, 38, 'Trebuie să existe exact 38 de corpuri cerești și misiuni spațiale');
    assert.equal(engine.getBeltConfigs().length, 2, 'Trebuie să existe Centura de Asteroizi și Centura Kuiper');

    const sun = engine.getBody('sun')!;
    assert.ok(sun);
    assert.equal(sun.worldPosition.length(), 0);
  });

  it('ancorează roverele Perseverance și Curiosity ca pinpoint-uri pe suprafața rotitoare a lui Marte (fără elipsă orbitală)', () => {
    const mars = engine.getBody('mars')!;
    const perseverance = engine.getBody('perseverance')!;
    const curiosity = engine.getBody('curiosity')!;

    assert.ok(mars && perseverance && curiosity);
    assert.equal(perseverance.orbitLine, null, 'Perseverance nu trebuie să aibă linie de orbită');
    assert.equal(curiosity.orbitLine, null, 'Curiosity nu trebuie să aibă linie de orbită');

    const distPerseveranceFromMarsCenter = perseverance.worldPosition.distanceTo(mars.worldPosition);
    const distCuriosityFromMarsCenter = curiosity.worldPosition.distanceTo(mars.worldPosition);
    const expectedSurfaceRadius = mars.visualRadius * 1.03;

    assert.ok(
      Math.abs(distPerseveranceFromMarsCenter - expectedSurfaceRadius) < 0.02,
      `Perseverance trebuie să fie ancorat exact pe suprafața lui Marte (${distPerseveranceFromMarsCenter} vs ${expectedSurfaceRadius})`
    );
    assert.ok(
      Math.abs(distCuriosityFromMarsCenter - expectedSurfaceRadius) < 0.02,
      `Curiosity trebuie să fie ancorat exact pe suprafața lui Marte (${distCuriosityFromMarsCenter} vs ${expectedSurfaceRadius})`
    );

    // Când timpul avansează și Marte se rotește în jurul axei sale, pinpoint-ul roverului se rotește sincron cu globul lui Marte
    const initialDir = perseverance.worldPosition.clone().sub(mars.worldPosition).normalize();
    engine.updatePositions(2.0);
    const rotatedDir = perseverance.worldPosition.clone().sub(mars.worldPosition).normalize();
    assert.ok(
      initialDir.distanceTo(rotatedDir) > 0.01,
      'Pinpoint-ul roverului trebuie să se rotească sincron cu globul planetei Marte'
    );
  });

  it('poziționează JWST și Euclid pe orbita exterioară L2 în jurul Pământului, în afara sferei terestre', () => {
    const earth = engine.getBody('earth')!;
    const jwst = engine.getBody('jwst')!;
    const euclid = engine.getBody('euclid')!;
    const iss = engine.getBody('iss')!;

    const distJwst = jwst.worldPosition.distanceTo(earth.worldPosition);
    const distEuclid = euclid.worldPosition.distanceTo(earth.worldPosition);
    const distIss = iss.worldPosition.distanceTo(earth.worldPosition);

    assert.ok(distJwst > earth.visualRadius * 3.0, 'JWST trebuie să fie mult în afara sferei Pământului');
    assert.ok(distEuclid > distJwst, 'Euclid este pe o orbită L2 separată de JWST');
    assert.ok(distJwst > distIss, 'JWST (L2) este mai departe de Pământ decât ISS (LEO)');
  });

  it('păstrează pinii de suprafață (SurfaceMarkers) la comutarea între Modul Eco și Modul HD', () => {
    const mars = engine.getBody('mars')!;
    const dummyPin = new THREE.Group();
    dummyPin.userData = { markerId: 'rover-perseverance' };
    mars.visualRoot.add(dummyPin);

    engine.applyQualityMode('eco');
    assert.ok(
      mars.visualRoot.children.some((c) => c.userData?.markerId === 'rover-perseverance'),
      'Pinul de suprafață trebuie păstrat pe noul visualRoot la trecerea în Eco'
    );

    engine.applyQualityMode('hd');
    assert.ok(
      mars.visualRoot.children.some((c) => c.userData?.markerId === 'rover-perseverance'),
      'Pinul de suprafață trebuie păstrat pe noul visualRoot la revenirea în HD'
    );
  });

  it('păstrează Marte și Pământul vizibile atunci când filtrul activ este Sonde & Telescoape', () => {
    engine.setCategoryVisibility(
      (cat) => cat === 'station' || cat === 'telescope' || cat === 'probe' || cat === 'rover'
    );
    assert.equal(engine.getBody('mars')?.rootGroup.visible, true);
    assert.equal(engine.getBody('earth')?.rootGroup.visible, true);
    assert.equal(engine.getBody('sun')?.rootGroup.visible, true);
    assert.equal(engine.getBody('jupiter')?.rootGroup.visible, false);
  });

  it('în Scara Didactică niciun corp ceresc, inel sau satelit nu trece prin altul (culoare orbitale disjuncte)', () => {
    scaleManager.setMode('didactic');
    const solarBodies = engine.getBodiesForHorizon('solar');

    // 1. Calculăm anvelopa radială maximă (inclusiv inele și cel mai îndepărtat satelit/telescop)
    // pentru fiecare corp heliocentric din Sistemul Solar în Scara Didactică
    const childrenByParent = new Map<string, typeof solarBodies>();
    for (const b of solarBodies) {
      if (!b.data.parentId || b.data.category === 'rover') continue;
      const list = childrenByParent.get(b.data.parentId) ?? [];
      list.push(b);
      childrenByParent.set(b.data.parentId, list);
    }

    // Verificăm că sateliții aceleiași planete sunt pe inele concentrice separate și nu ating planeta-mamă sau inelele ei
    for (const [parentId, children] of childrenByParent.entries()) {
      const parent = engine.getBody(parentId)!;
      const parentRingFactor = parentId === 'saturn' ? 2.32 : parentId === 'uranus' ? 1.85 : 1.05;
      const parentOuter = parent.visualRadius * parentRingFactor;

      const sortedChildren = children
        .map((c) => ({
          id: c.data.id,
          dist: c.worldPosition.distanceTo(parent.worldPosition),
          radius: c.visualRadius,
        }))
        .sort((a, b) => a.dist - b.dist);

      for (let i = 0; i < sortedChildren.length; i++) {
        const cur = sortedChildren[i];
        assert.ok(
          cur.dist - cur.radius > parentOuter,
          `Satelitul ${cur.id} (${cur.dist - cur.radius}) nu trebuie să intersecteze planeta/inelele lui ${parentId} (${parentOuter})`
        );
        if (i > 0) {
          const prev = sortedChildren[i - 1];
          assert.ok(
            cur.dist - cur.radius > prev.dist + prev.radius,
            `Orbitele locale ${prev.id} și ${cur.id} în jurul lui ${parentId} trebuie să fie clar separate`
          );
        }
      }
    }

    // 2. Verificăm că toate corpurile heliocentrice (cu întregul lor sistem de inele + sateliți)
    // au culoare radiale complet disjuncte chiar și la conjuncție directă
    const helioEnvelopes = solarBodies
      .filter((b) => !b.data.parentId)
      .map((b) => {
        const dist = b.worldPosition.length();
        const ringFactor =
          b.data.id === 'saturn'
            ? 2.32
            : b.data.id === 'uranus'
            ? 1.85
            : b.data.id === 'haumea'
            ? 1.74
            : b.data.id === 'sun'
            ? 1.56
            : 1.05;
        let systemRadius = b.visualRadius * ringFactor;
        const kids = childrenByParent.get(b.data.id) ?? [];
        for (const k of kids) {
          const kDist = k.worldPosition.distanceTo(b.worldPosition) + k.visualRadius;
          if (kDist > systemRadius) systemRadius = kDist;
        }
        return {
          id: b.data.id,
          dist,
          innerEdge: dist - systemRadius * 1.015,
          outerEdge: dist + systemRadius * 1.015,
        };
      })
      .sort((a, b) => a.dist - b.dist);

    for (let i = 1; i < helioEnvelopes.length; i++) {
      const prev = helioEnvelopes[i - 1];
      const cur = helioEnvelopes[i];
      assert.ok(
        cur.innerEdge > prev.outerEdge,
        `În Scara Didactică, culoarul lui ${cur.id} [${cur.innerEdge.toFixed(1)}, ${cur.outerEdge.toFixed(1)}] nu trebuie să se suprapună cu ${prev.id} [${prev.innerEdge.toFixed(1)}, ${prev.outerEdge.toFixed(1)}]`
      );
    }
  });
});

// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { ScaleManager, REAL_UNITS_PER_AU } from '../../src/core/ScaleManager';
import { QualityManager } from '../../src/core/QualityManager';

describe('ScaleManager — Unit Tests', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('pornește implicit în Scara Didactică și persistă comutarea în localStorage', () => {
    const sm = new ScaleManager('didactic');
    assert.equal(sm.getMode(), 'didactic');
    assert.equal(sm.getModeLabelRo(), 'Scară Didactică');

    let notifiedMode: string | null = null;
    const unsubscribe = sm.onChange((m) => {
      notifiedMode = m;
    });

    const toggled = sm.toggleMode();
    assert.equal(toggled, 'real');
    assert.equal(sm.getMode(), 'real');
    assert.equal(sm.getModeLabelRo(), 'Scară Reală');
    assert.equal(notifiedMode, 'real');
    assert.equal(window.localStorage.getItem('orbitar_scale_mode'), 'real');

    // O nouă instanță citește modul salvat în localStorage
    const smReloaded = new ScaleManager('didactic');
    assert.equal(smReloaded.getMode(), 'real');

    unsubscribe();
    sm.setMode('didactic');
    assert.equal(notifiedMode, 'real'); // nu mai notifică după unsubscribe
  });

  it('scaleRadius calculează corect razele în Scara Didactică și în Scara Reală pentru toate categoriile', () => {
    const sm = new ScaleManager('didactic');

    assert.equal(sm.scaleRadius(696340, 'star'), 6.2);
    assert.equal(sm.scaleRadius(0.003, 'rover'), 0.0012);

    const voyagerDidactic = sm.scaleRadius(0.002, 'probe');
    const hubbleDidactic = sm.scaleRadius(0.0066, 'telescope');
    const jwstDidactic = sm.scaleRadius(0.011, 'telescope');
    const issDidactic = sm.scaleRadius(0.055, 'station');
    const deimosDidactic = sm.scaleRadius(6.2, 'moon');
    const phobosDidactic = sm.scaleRadius(11.27, 'moon');
    const charonDidactic = sm.scaleRadius(606, 'moon');
    const plutoDidactic = sm.scaleRadius(1188.3, 'dwarf');
    const moonDidactic = sm.scaleRadius(1737.4, 'moon');
    const mercuryDidactic = sm.scaleRadius(2439.7, 'terrestrial');
    const ganymedeDidactic = sm.scaleRadius(2631.2, 'moon');
    const marsDidactic = sm.scaleRadius(3389.5, 'terrestrial');
    const venusDidactic = sm.scaleRadius(6051.8, 'terrestrial');
    const earthDidactic = sm.scaleRadius(6371, 'terrestrial');
    const jupiterDidactic = sm.scaleRadius(69911, 'gas_giant');
    const astDidactic = sm.scaleRadius(262, 'asteroid');

    assert.ok(
      voyagerDidactic < hubbleDidactic &&
        hubbleDidactic < jwstDidactic &&
        jwstDidactic < issDidactic &&
        issDidactic < earthDidactic / 500,
      'În Scara Didactică, sondele, telescoapele și ISS respectă ierarhia de mărime și sunt la scară micro (>500× mai mici decât Pământul)'
    );
    assert.ok(
      deimosDidactic < phobosDidactic &&
        phobosDidactic < charonDidactic &&
        charonDidactic < plutoDidactic &&
        plutoDidactic < moonDidactic &&
        moonDidactic < mercuryDidactic &&
        mercuryDidactic < ganymedeDidactic &&
        ganymedeDidactic < marsDidactic &&
        marsDidactic < venusDidactic &&
        venusDidactic < earthDidactic,
      'În Scara Didactică, ierarhia fizică Deimos < Phobos < Charon < Pluto < Luna < Mercur < Ganymede < Marte < Venus < Pământ este respectată strict'
    );
    assert.ok(
      Math.abs(earthDidactic / moonDidactic - 6371 / 1737.4) < 1e-6,
      'În Scara Didactică, raportul Pământ / Lună este exact cel fizic (3,667:1)'
    );
    assert.ok(
      Math.abs(earthDidactic / marsDidactic - 6371 / 3389.5) < 1e-6,
      'În Scara Didactică, raportul Pământ / Marte este exact cel fizic (1,88:1)'
    );
    assert.ok(jupiterDidactic > earthDidactic, 'Jupiter trebuie să fie mai mare decât Pământul');
    assert.ok(astDidactic >= 0.15 && astDidactic < moonDidactic, 'Asteroizii mari au rază didactică proporțională, mai mică decât Luna');

    sm.setMode('real');
    const earthReal = sm.scaleRadius(6371, 'terrestrial');
    const sunReal = sm.scaleRadius(696340, 'star');
    const moonReal = sm.scaleRadius(1737.4, 'moon');
    const marsReal = sm.scaleRadius(3389.5, 'terrestrial');
    const phobosReal = sm.scaleRadius(11.27, 'moon');
    const deimosReal = sm.scaleRadius(6.2, 'moon');
    const issReal = sm.scaleRadius(0.055, 'station');
    const jwstReal = sm.scaleRadius(0.011, 'telescope');
    const hubbleReal = sm.scaleRadius(0.0066, 'telescope');
    const voyagerReal = sm.scaleRadius(0.002, 'probe');

    // În Scara Reală, toate rapoartele fizice sunt respectate cu precizie matematică
    assert.ok(Math.abs(sunReal / earthReal - 696340 / 6371) < 1e-6, 'Raportul Soare / Pământ este exact 109,3');
    assert.ok(Math.abs(earthReal / moonReal - 6371 / 1737.4) < 1e-6, 'Raportul Pământ / Lună este exact 3,667');
    assert.ok(Math.abs(marsReal / phobosReal - 3389.5 / 11.27) < 1e-6, 'Raportul Marte / Phobos este exact 300,75');
    assert.ok(Math.abs(marsReal / deimosReal - 3389.5 / 6.2) < 1e-6, 'Raportul Marte / Deimos este exact 546,69');
    assert.ok(Math.abs(earthReal / issReal - 6371 / 0.055) < 1e-3, 'Raportul Pământ / ISS este exact (~115.836:1)');
    assert.ok(Math.abs(issReal / jwstReal - 0.055 / 0.011) < 1e-6, 'Raportul ISS / JWST este exact 5:1');
    assert.ok(Math.abs(jwstReal / hubbleReal - 0.011 / 0.0066) < 1e-6, 'Raportul JWST / Hubble este exact');
    assert.ok(hubbleReal > voyagerReal, 'Hubble este mai mare decât sonda Voyager în Scara Reală');
    // Stelele din Orizontul Interstelar (Sirius, Betelgeuse) păstrează raza vizuală calibrată și în Scara Reală
    assert.equal(sm.scaleRadius(1190000, 'star'), 6.2);
    assert.equal(sm.scaleRadius(487000000, 'star'), 7.8);
  });

  it('scaleHeliocentricPosition și scaleLocalChildOffset transformă corect coordonatele orbitale', () => {
    const sm = new ScaleManager('didactic');

    const zero = sm.scaleHeliocentricPosition(new THREE.Vector3(0, 0, 0));
    assert.equal(zero.length(), 0);

    const oneAuDidactic = sm.scaleHeliocentricPosition(new THREE.Vector3(1, 0, 0));
    assert.ok(Math.abs(oneAuDidactic.x - 56.0) < 0.001);

    // Offset pentru sateliți, stații (LEO vs L2) și rovere
    const parentRadius = 2.0;
    const leoOffset = sm.scaleLocalChildOffset(new THREE.Vector3(0.00004, 0, 0), parentRadius, 1, 'station');
    const l2Offset = sm.scaleLocalChildOffset(new THREE.Vector3(0.01, 0, 0), parentRadius, 3, 'telescope');
    const roverOffset = sm.scaleLocalChildOffset(new THREE.Vector3(0, 1, 0), parentRadius, 1, 'rover');

    assert.ok(l2Offset.length() > leoOffset.length(), 'Telescoapele L2 (JWST/Euclid) orbitează mai departe decât LEO (ISS/Hubble)');
    assert.ok(Math.abs(roverOffset.length() - parentRadius * 1.18) < 0.001);

    sm.setMode('real');
    const oneAuReal = sm.scaleHeliocentricPosition(new THREE.Vector3(1, 0, 0));
    assert.equal(oneAuReal.x, REAL_UNITS_PER_AU);
  });

  it('getHitSphereRadius oferă sfere de selecție adecvate în ambele moduri', () => {
    const sm = new ScaleManager('didactic');
    assert.ok(sm.getHitSphereRadius(6.2, 'star') > 7.5);
    assert.ok(sm.getHitSphereRadius(1.5, 'terrestrial') >= 2.2);
    assert.ok(sm.getHitSphereRadius(0.0024, 'telescope') >= 0.045);

    sm.setMode('real');
    assert.ok(sm.getHitSphereRadius(0.00000004, 'telescope') >= 0.00012);
    assert.ok(sm.getHitSphereRadius(0.00426, 'terrestrial') > 0.01);
  });
});

describe('QualityManager — Unit Tests', () => {
  it('detectează automat profilul HD pe hardware modern și profilul Eco pe dispozitive cu memorie redusă', () => {
    setupTestDomEnvironment({ deviceMemory: 8, hardwareConcurrency: 8 });
    const qmHigh = new QualityManager();
    assert.equal(qmHigh.getMode(), 'hd');
    assert.equal(qmHigh.getProfile().mode, 'hd');

    setupTestDomEnvironment({ deviceMemory: 2, hardwareConcurrency: 2 });
    const qmLow = new QualityManager();
    assert.equal(qmLow.getMode(), 'eco');
    assert.equal(qmLow.getProfile().mode, 'eco');
  });

  it('declanșează automat Watchdog-ul FPS la 5 secunde de rulare sub 24 FPS și păstrează modul HD la 60 FPS', () => {
    setupTestDomEnvironment({ deviceMemory: 8, hardwareConcurrency: 8 });
    const qm = new QualityManager();
    assert.equal(qm.getMode(), 'hd');

    let autoFallbackTriggered = false;
    qm.onChange((newMode, isAutoFallback) => {
      if (newMode === 'eco' && isAutoFallback) {
        autoFallbackTriggered = true;
      }
    });

    // Simulăm 105 de cadre lente (~20 FPS => deltaSeconds = 0.05s, 105 * 0.05 = 5.25s >= WATCHDOG_WINDOW_SECONDS)
    for (let i = 0; i < 105; i++) {
      qm.recordFrame(0.05);
    }

    assert.equal(qm.getMode(), 'eco');
    assert.equal(autoFallbackTriggered, true);

    // Dacă utilizatorul comută în HD și rulează la ~60 FPS (deltaSeconds = 0.016s), Watchdog-ul păstrează HD
    qm.toggleMode();
    assert.equal(qm.getMode(), 'hd');
    for (let i = 0; i < 320; i++) {
      qm.recordFrame(0.016);
    }
    assert.equal(qm.getMode(), 'hd');
  });
});

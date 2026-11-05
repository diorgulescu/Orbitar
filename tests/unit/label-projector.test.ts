// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { LabelProjector } from '../../src/ui/LabelProjector';
import type { CelestialBodyInstance } from '../../src/core/OrbitalEngine';
import type { CelestialBodyData, CosmicHorizon } from '../../src/types/celestial';

function makeBody(
  id: string,
  opts: {
    horizon?: CosmicHorizon;
    category?: CelestialBodyData['category'];
    parentId?: string;
    visible?: boolean;
    pos?: [number, number, number];
    radius?: number;
  } = {}
): CelestialBodyInstance {
  return {
    data: {
      id,
      horizon: opts.horizon ?? 'solar',
      category: opts.category ?? 'terrestrial',
      parentId: opts.parentId,
    } as CelestialBodyData,
    rootGroup: { visible: opts.visible ?? true },
    worldPosition: new THREE.Vector3(...(opts.pos ?? [0, 0, 0])),
    visualRadius: opts.radius ?? 1,
  } as unknown as CelestialBodyInstance;
}

function makeCamera(): THREE.PerspectiveCamera {
  const camera = new THREE.PerspectiveCamera(48, 1280 / 800, 0.0001, 60000);
  camera.position.set(0, 75, 135);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
}

describe('LabelProjector — proiecția optimizată a etichetelor 2D', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('afișează eticheta unui corp vizibil în fața camerei doar prin transform (fără left/top)', () => {
    const labels = new Map<string, HTMLButtonElement>();
    const label = document.createElement('button') as unknown as HTMLButtonElement;
    labels.set('earth', label);
    const bodies = [makeBody('earth', { pos: [0, 0, 0] })];

    const projector = new LabelProjector({
      labels,
      getBodies: () => bodies,
      getActiveHorizon: () => 'solar',
      getTrackedId: () => 'earth',
      getLayerFilter: () => 'all',
    });

    projector.update(makeCamera());

    const style = (label as unknown as { style: Record<string, string> }).style;
    assert.equal(style.display, 'block');
    assert.ok(
      /translate3d\(-?\d+(\.\d+)?px, -?\d+(\.\d+)?px, 0\) translate\(-50%, -140%\)/.test(
        style.transform ?? ''
      ),
      `transform-ul trebuie să fie translate3d + offset de centrare, a fost: ${style.transform}`
    );
    // Poziționarea NU mai trece prin left/top (care ar declanșa layout la fiecare cadru)
    assert.equal(style.left ?? '', '');
    assert.equal(style.top ?? '', '');
  });

  it('ascunde etichetele din alte orizonturi, pe cele ale roverelor și pe cele din spatele camerei', () => {
    const labels = new Map<string, HTMLButtonElement>();
    for (const id of ['earth', 'andromeda', 'perseverance', 'behind']) {
      labels.set(id, document.createElement('button') as unknown as HTMLButtonElement);
    }
    const bodies = [
      makeBody('earth', { pos: [0, 0, 0] }),
      makeBody('andromeda', { horizon: 'galactic', pos: [0, 0, 0] }),
      makeBody('perseverance', { category: 'rover', pos: [0, 0, 0] }),
      makeBody('behind', { pos: [0, 0, -10000] }),
    ];

    const projector = new LabelProjector({
      labels,
      getBodies: () => bodies,
      getActiveHorizon: () => 'solar',
      getTrackedId: () => undefined,
      getLayerFilter: () => 'all',
    });

    projector.update(makeCamera());

    const styleOf = (id: string) =>
      (labels.get(id) as unknown as { style: Record<string, string> }).style;
    assert.equal(styleOf('earth').display, 'block');
    assert.equal(styleOf('andromeda').display, 'none');
    assert.equal(styleOf('perseverance').display, 'none');
    assert.equal(styleOf('behind').display, 'none');
  });

  it('scrie în DOM doar când poziția efectivă se schimbă (fără thrash per frame)', () => {
    const label = document.createElement('button') as unknown as HTMLButtonElement;
    const labels = new Map<string, HTMLButtonElement>([['earth', label]]);
    const bodies = [makeBody('earth', { pos: [0, 0, 0] })];

    const projector = new LabelProjector({
      labels,
      getBodies: () => bodies,
      getActiveHorizon: () => 'solar',
      getTrackedId: () => 'earth',
      getLayerFilter: () => 'all',
    });

    // Numărăm scrierile efective în style.transform
    const rawStyle = (label as unknown as { style: Record<string, any> }).style;
    let transformWrites = 0;
    const spyStyle = new Proxy(rawStyle, {
      set(target, prop, value) {
        if (prop === 'transform') transformWrites += 1;
        target[prop as string] = value;
        return true;
      },
    });
    (label as unknown as { style: Record<string, any> }).style = spyStyle;

    const camera = makeCamera();
    projector.update(camera);
    projector.update(camera);
    projector.update(camera);
    assert.equal(transformWrites, 1, 'același cadru nu trebuie să rescrie transform-ul');

    // Mișcăm camera — poziția proiectată se schimbă, deci se mai scrie o singură dată
    camera.position.set(10, 80, 140);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    projector.update(camera);
    assert.equal(transformWrites, 2);

    // Corpul iese din cadru → display: none; revenirea în cadru → display: block din nou
    bodies[0].worldPosition.set(0, 0, -10000);
    projector.update(camera);
    assert.equal(spyStyle.display, 'none');
    bodies[0].worldPosition.set(0, 0, 0);
    projector.update(camera);
    assert.equal(spyStyle.display, 'block');
  });

  it('respectă culling-ul de distanță (>55 unități) pentru sateliți când filtrul este „all”', () => {
    const labels = new Map<string, HTMLButtonElement>([
      ['moon', document.createElement('button') as unknown as HTMLButtonElement],
    ]);
    const bodies = [makeBody('moon', { parentId: 'earth', pos: [60, 0, 0] })];

    const projector = new LabelProjector({
      labels,
      getBodies: () => bodies,
      getActiveHorizon: () => 'solar',
      getTrackedId: () => undefined,
      getLayerFilter: () => 'all',
    });

    const camera = makeCamera();
    projector.update(camera);
    const style = (labels.get('moon') as unknown as { style: Record<string, string> }).style;
    assert.equal(style.display, 'none', 'satelitul la >55 unități de cameră trebuie ascuns în filtrul „all”');

    // Când filtrul NU este „all”, culling-ul de distanță este dezactivat
    const projectorNoCull = new LabelProjector({
      labels,
      getBodies: () => bodies,
      getActiveHorizon: () => 'solar',
      getTrackedId: () => undefined,
      getLayerFilter: () => 'planets_moons',
    });
    projectorNoCull.update(camera);
    assert.equal(style.display, 'block');
  });
});

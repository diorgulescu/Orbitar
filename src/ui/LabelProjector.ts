// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import type { CelestialBodyInstance } from '../core/OrbitalEngine';
import type { CosmicHorizon } from '../types/celestial';
import type { LayerFilter } from './HeaderHud';

export interface LabelProjectorOptions {
  /** Etichetele 2D indexate după `bodyId` (create în main.ts și atașate în #labels-container). */
  labels: Map<string, HTMLButtonElement>;
  getBodies: () => CelestialBodyInstance[];
  getActiveHorizon: () => CosmicHorizon;
  getTrackedId: () => string | undefined;
  getLayerFilter: () => LayerFilter;
}

interface LabelState {
  visible: boolean;
  x: number;
  y: number;
}

/**
 * LabelProjector proiectează etichetele 2D ale corpurilor cerești deasupra scenei 3D (ecran → spațiu).
 *
 * Optimizări față de bucla din main.ts:
 * - Poziționarea se face exclusiv prin `transform: translate3d(...)` (compositor GPU, fără layout),
 *   în loc de `style.left` / `style.top` care forțează layout-ul la fiecare cadru.
 * - Scrierile în DOM (`display`, `transform`) se fac doar când starea efectivă a etichetei se schimbă,
 *   nu la fiecare frame.
 * - Vizibilitatea pe orizont este centralizată aici (nu mai există două surse de adevăr între
 *   filtrul de straturi și bucla de randare).
 */
export class LabelProjector {
  private readonly labels: Map<string, HTMLButtonElement>;
  private readonly getBodies: () => CelestialBodyInstance[];
  private readonly getActiveHorizon: () => CosmicHorizon;
  private readonly getTrackedId: () => string | undefined;
  private readonly getLayerFilter: () => LayerFilter;
  private readonly states = new Map<string, LabelState>();
  private readonly tempProj = new THREE.Vector3();

  constructor(options: LabelProjectorOptions) {
    this.labels = options.labels;
    this.getBodies = options.getBodies;
    this.getActiveHorizon = options.getActiveHorizon;
    this.getTrackedId = options.getTrackedId;
    this.getLayerFilter = options.getLayerFilter;
  }

  private stateFor(id: string): LabelState {
    let state = this.states.get(id);
    if (!state) {
      state = { visible: true, x: Number.NaN, y: Number.NaN };
      this.states.set(id, state);
    }
    return state;
  }

  /**
   * Actualizează pozițiile vizibile ale etichetelor pentru cadrul curent.
   * Trebuie apelat o singură dată per frame, după `orbitalEngine.updatePositions(...)`.
   */
  public update(camera: THREE.PerspectiveCamera): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const trackedId = this.getTrackedId();
    const activeHorizon = this.getActiveHorizon();
    const distanceCullingEnabled = this.getLayerFilter() === 'all';

    for (const body of this.getBodies()) {
      const labelEl = this.labels.get(body.data.id);
      if (!labelEl) continue;
      const state = this.stateFor(body.data.id);

      let visible = true;
      const bodyHorizon = body.data.horizon ?? 'solar';

      if (
        bodyHorizon !== activeHorizon ||
        !body.rootGroup.visible ||
        body.data.category === 'rover'
      ) {
        visible = false;
      } else if (body.data.parentId && body.data.id !== trackedId && body.data.parentId !== trackedId) {
        const distToCam = camera.position.distanceTo(body.worldPosition);
        if (distToCam > 55 && distanceCullingEnabled) {
          visible = false;
        }
      }

      let x = 0;
      let y = 0;
      if (visible) {
        this.tempProj.copy(body.worldPosition);
        this.tempProj.y += body.visualRadius * 1.25;
        this.tempProj.project(camera);

        if (this.tempProj.z < -1 || this.tempProj.z > 1) {
          visible = false;
        } else {
          x = (this.tempProj.x * 0.5 + 0.5) * width;
          y = (-this.tempProj.y * 0.5 + 0.5) * height;
          if (x < -80 || x > width + 80 || y < -40 || y > height + 40) {
            visible = false;
          }
        }
      }

      if (!visible) {
        if (state.visible) {
          state.visible = false;
          labelEl.style.display = 'none';
        }
        continue;
      }

      // Rotunjim la 0.1 px ca să evităm scrieri DOM inutile când camera abia se mișcă
      const rx = Math.round(x * 10) / 10;
      const ry = Math.round(y * 10) / 10;
      if (!state.visible || state.x !== rx || state.y !== ry) {
        state.visible = true;
        state.x = rx;
        state.y = ry;
        if (labelEl.style.display !== 'block') {
          labelEl.style.display = 'block';
        }
        labelEl.style.transform = `translate3d(${rx.toFixed(1)}px, ${ry.toFixed(1)}px, 0) translate(-50%, -140%)`;
      }
    }
  }
}

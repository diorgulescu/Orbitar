// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { KM_PER_AU } from 'astronomy-engine';
import { CelestialBodyInstance, OrbitalEngine } from '../core/OrbitalEngine';

/** Viteza luminii în vid (km/s) */
const SPEED_OF_LIGHT_KMS = 299792.458;

/**
 * LightSpeedRuler implementează unealta "🚀 Rigla cu Viteza Luminii":
 * - Măsoară în timp real distanța dintre două corpuri cerești selectate (în UA și km)
 * - Animează în scena 3D o rază de lumină / semnal radio între cele două corpuri
 * - Afișează timpul exact de parcurs al luminii (și al unui semnal radio către sonde)
 */
export class LightSpeedRuler {
  private readonly scene: THREE.Scene;
  private readonly orbitalEngine: OrbitalEngine;

  private isActive = false;
  private bodyAId = 'earth';
  private bodyBId = 'mars';
  private nextPickSlot: 'A' | 'B' = 'B';
  private pulseProgress = 0;

  private readonly rulerGroup: THREE.Group;
  private readonly beamLine: THREE.Line;
  private readonly photonMesh: THREE.Mesh;
  private readonly photonHalo: THREE.Sprite;

  constructor(scene: THREE.Scene, orbitalEngine: OrbitalEngine) {
    this.scene = scene;
    this.orbitalEngine = orbitalEngine;

    this.rulerGroup = new THREE.Group();
    this.rulerGroup.name = 'LightSpeedRulerGroup';
    this.rulerGroup.visible = false;
    this.scene.add(this.rulerGroup);

    // Linia laser dintre Obiectul A și Obiectul B
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(),
      new THREE.Vector3(1, 0, 0),
    ]);
    const lineMat = new THREE.LineBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.85,
    });
    this.beamLine = new THREE.Line(lineGeo, lineMat);
    this.rulerGroup.add(this.beamLine);

    // Impulsul luminos / fotonul care călătorește pe rază
    const photonGeo = new THREE.SphereGeometry(0.55, 16, 16);
    const photonMat = new THREE.MeshBasicMaterial({ color: 0xffb703 });
    this.photonMesh = new THREE.Mesh(photonGeo, photonMat);
    this.rulerGroup.add(this.photonMesh);

    this.photonHalo = this.createPhotonHaloSprite();
    this.photonMesh.add(this.photonHalo);

    this.populateSelectors();
    this.bindEvents();
  }

  private createPhotonHaloSprite(): THREE.Sprite {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
      grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
      grad.addColorStop(0.35, 'rgba(0, 240, 255, 0.85)');
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(4.2, 4.2, 1);
    return sprite;
  }

  private populateSelectors(): void {
    const selectA = document.getElementById('ruler-select-a') as HTMLSelectElement | null;
    const selectB = document.getElementById('ruler-select-b') as HTMLSelectElement | null;
    if (!selectA || !selectB) return;

    const bodies = this.orbitalEngine.getBodies();
    const optionsHtml = bodies
      .map((b) => `<option value="${b.data.id}">${b.data.name}</option>`)
      .join('');

    selectA.innerHTML = optionsHtml;
    selectB.innerHTML = optionsHtml;
    selectA.value = this.bodyAId;
    selectB.value = this.bodyBId;
  }

  private bindEvents(): void {
    const btnToggle = document.getElementById('btn-ruler-toggle');
    const btnClose = document.getElementById('btn-ruler-close');
    const selectA = document.getElementById('ruler-select-a') as HTMLSelectElement | null;
    const selectB = document.getElementById('ruler-select-b') as HTMLSelectElement | null;

    btnToggle?.addEventListener('click', () => {
      this.setActive(!this.isActive);
    });

    btnClose?.addEventListener('click', () => {
      this.setActive(false);
    });

    selectA?.addEventListener('change', () => {
      this.bodyAId = selectA.value;
      this.pulseProgress = 0;
    });

    selectB?.addEventListener('change', () => {
      this.bodyBId = selectB.value;
      this.pulseProgress = 0;
    });
  }

  public setActive(active: boolean): void {
    this.isActive = active;
    this.rulerGroup.visible = active;
    this.pulseProgress = 0;

    const btnToggle = document.getElementById('btn-ruler-toggle');
    const panelEl = document.getElementById('hud-ruler-panel');
    btnToggle?.classList.toggle('hud-btn-active-amber', active);
    panelEl?.classList.toggle('is-hidden', !active);
  }

  public isRulerActive(): boolean {
    return this.isActive;
  }

  /**
   * Când Rigla este activă, selectarea unui corp din scena 3D îl setează alternativ ca
   * Destinație (B) sau Origine (A), pentru a măsura intuitiv între oricare două corpuri.
   */
  public handleBodySelectedInScene(body: CelestialBodyInstance): void {
    if (!this.isActive) return;
    const selectA = document.getElementById('ruler-select-a') as HTMLSelectElement | null;
    const selectB = document.getElementById('ruler-select-b') as HTMLSelectElement | null;

    if (this.nextPickSlot === 'B' && body.data.id !== this.bodyAId) {
      this.bodyBId = body.data.id;
      if (selectB) selectB.value = this.bodyBId;
      this.nextPickSlot = 'A';
    } else {
      this.bodyAId = body.data.id;
      if (selectA) selectA.value = this.bodyAId;
      this.nextPickSlot = 'B';
    }
    this.pulseProgress = 0;
  }

  public update(deltaSeconds: number): void {
    if (!this.isActive) return;

    const bodyA = this.orbitalEngine.getBody(this.bodyAId);
    const bodyB = this.orbitalEngine.getBody(this.bodyBId);
    if (!bodyA || !bodyB) return;

    // 1. Actualizăm linia 3D și poziția fotonului animat
    const posAttr = this.beamLine.geometry.getAttribute('position') as THREE.BufferAttribute;
    posAttr.setXYZ(0, bodyA.worldPosition.x, bodyA.worldPosition.y, bodyA.worldPosition.z);
    posAttr.setXYZ(1, bodyB.worldPosition.x, bodyB.worldPosition.y, bodyB.worldPosition.z);
    posAttr.needsUpdate = true;

    this.pulseProgress = (this.pulseProgress + deltaSeconds * 0.55) % 1;
    this.photonMesh.position.lerpVectors(
      bodyA.worldPosition,
      bodyB.worldPosition,
      this.pulseProgress
    );

    // 2. Calculăm distanța reală în UA și km și timpul de parcurs al razei de lumină
    const distAu = bodyA.heliocentricAu.distanceTo(bodyB.heliocentricAu);
    const distKm = distAu * KM_PER_AU;
    const lightSeconds = distKm / SPEED_OF_LIGHT_KMS;

    const distAuEl = document.getElementById('ruler-readout-au');
    const distKmEl = document.getElementById('ruler-readout-km');
    const lightTimeEl = document.getElementById('ruler-readout-light');

    if (distAuEl) {
      distAuEl.textContent = `${distAu.toFixed(3).replace('.', ',')} UA`;
    }
    if (distKmEl) {
      if (distKm >= 1_000_000) {
        distKmEl.textContent = `${(distKm / 1_000_000).toFixed(2).replace('.', ',')} milioane km`;
      } else {
        distKmEl.textContent = `${Math.round(distKm).toLocaleString('ro-RO')} km`;
      }
    }
    if (lightTimeEl) {
      lightTimeEl.textContent = this.formatLightTimeRo(lightSeconds);
    }
  }

  private formatLightTimeRo(seconds: number): string {
    if (seconds < 0.05) {
      return 'Instantaneu (0 secunde)';
    }
    if (seconds < 60) {
      return `${seconds.toFixed(2).replace('.', ',')} secunde`;
    }
    if (seconds < 3600) {
      const m = Math.floor(seconds / 60);
      const s = Math.round(seconds % 60);
      return `${m} min ${s} sec`;
    }
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h} ore ${m} min`;
  }
}

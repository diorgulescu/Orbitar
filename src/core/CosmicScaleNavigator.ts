// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { CosmicHorizon } from '../types/celestial';
import { CelestialBodyInstance, OrbitalEngine } from './OrbitalEngine';
import { CameraController } from './CameraController';

export interface HorizonMeta {
  id: CosmicHorizon;
  labelRo: string;
  scaleUnitRo: string;
  descriptionRo: string;
  defaultBodyId: string;
  overviewCameraPos: [number, number, number];
}

export const COSMIC_HORIZONS: Record<CosmicHorizon, HorizonMeta> = {
  solar: {
    id: 'solar',
    labelRo: '☀️ Sistemul Solar',
    scaleUnitRo: 'Scara în km / Unități Astronomice (UA)',
    descriptionRo: 'Soarele, cele 8 planete, sateliții naturali, planetele pitice, asteroizii și sondele spațiale.',
    defaultBodyId: 'sun',
    overviewCameraPos: [0, 75, 135],
  },
  interstellar: {
    id: 'interstellar',
    labelRo: '✨ Stele & Exoplanete',
    scaleUnitRo: 'Scara în Ani-Lumină (1 – 650 ani-lumină)',
    descriptionRo: 'Norul lui Oort, Proxima Centauri, Sirius A & B, Sistemul TRAPPIST-1, 55 Cancri e, Pleiadele și Betelgeuse.',
    defaultBodyId: 'proxima_centauri',
    overviewCameraPos: [0, 88, 175],
  },
  galactic: {
    id: 'galactic',
    labelRo: '🌀 Calea Lactee & Galaxii',
    scaleUnitRo: 'Scara în Mii / Milioane de Ani-Lumină',
    descriptionRo: 'Calea Lactee, Gaura Neagră Sagittarius A*, Nebuloasa Orion, Stâlpii Creației și Galaxia Andromeda (M31).',
    defaultBodyId: 'milky_way',
    overviewCameraPos: [0, 95, 195],
  },
};

export type HorizonChangeCallback = (
  horizon: CosmicHorizon,
  meta: HorizonMeta,
  autoSelectedBody: CelestialBodyInstance | null
) => void;

/**
 * CosmicScaleNavigator gestionează explorarea Universului pe 3 Orizonturi Cosmice:
 * 1. `☀️ Sistemul Solar` (scara în km / UA)
 * 2. `✨ Stele & Exoplanete` (scara în Ani-Lumină)
 * 3. `🌀 Calea Lactee & Galaxii` (scara în Mii/Milioane de Ani-Lumină)
 *
 * Execută tranziții line de tip "Hyper-Zoom" ale camerei, comută grupurile 3D active
 * și menține mereu indicatorul luminos "📍 Aici este Sistemul nostru Solar (Acasă)".
 */
export class CosmicScaleNavigator {
  private readonly orbitalEngine: OrbitalEngine;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly cameraController: CameraController;
  private readonly labelsContainer: HTMLElement | null;

  private currentHorizon: CosmicHorizon = 'solar';
  private readonly listeners = new Set<HorizonChangeCallback>();

  private homeBeaconInterstellar: THREE.Group;
  private homeBeaconGalactic: THREE.Group;
  private homeMarkerDomEl: HTMLButtonElement | null = null;

  private hyperZoomProgress = 1;
  private hyperZoomActive = false;
  private readonly tempProj = new THREE.Vector3();

  constructor(
    orbitalEngine: OrbitalEngine,
    camera: THREE.PerspectiveCamera,
    cameraController: CameraController,
    labelsContainer: HTMLElement | null = document.getElementById('labels-container')
  ) {
    this.orbitalEngine = orbitalEngine;
    this.camera = camera;
    this.cameraController = cameraController;
    this.labelsContainer = labelsContainer;

    this.homeBeaconInterstellar = this.createHomeSolarBeacon3D();
    this.homeBeaconInterstellar.position.set(0, 0, 0);
    this.orbitalEngine.getHorizonGroup('interstellar').add(this.homeBeaconInterstellar);

    this.homeBeaconGalactic = this.createHomeSolarBeacon3D();
    this.homeBeaconGalactic.position.copy(this.orbitalEngine.getHomeSolarWorldPosition('galactic'));
    this.orbitalEngine.getHorizonGroup('galactic').add(this.homeBeaconGalactic);

    this.ensureHorizonSelectorDom();
    this.ensureHomeMarkerDom();
    this.bindEvents();
    this.syncUiState();
  }

  private createHomeSolarBeacon3D(): THREE.Group {
    const group = new THREE.Group();
    group.name = 'HomeSolarSystemBeacon3D';

    const coreSun = new THREE.Mesh(
      new THREE.SphereGeometry(1.15, 20, 20),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    group.add(coreSun);

    const ringInner = new THREE.Mesh(
      new THREE.RingGeometry(1.8, 2.25, 48),
      new THREE.MeshBasicMaterial({
        color: 0x00f0ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ringInner.rotation.x = Math.PI * 0.5;
    group.add(ringInner);

    const ringOuter = new THREE.Mesh(
      new THREE.RingGeometry(2.9, 3.25, 48),
      new THREE.MeshBasicMaterial({
        color: 0xffb703,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    ringOuter.rotation.x = Math.PI * 0.5;
    group.add(ringOuter);

    return group;
  }

  private ensureHorizonSelectorDom(): void {
    let navEl = document.getElementById('hud-horizon-selector');
    if (!navEl) {
      navEl = document.createElement('div');
      navEl.id = 'hud-horizon-selector';
      navEl.className = 'bento-card header-horizon-selector';
      navEl.setAttribute('aria-label', 'Selector Orizont Cosmic');
      navEl.innerHTML = `
        <select
          id="hud-horizon-select"
          class="hud-horizon-select"
          aria-label="Selectează Orizontul Cosmic"
          title="Comută între Sistemul Solar, Stele și Exoplanete sau Calea Lactee și Galaxii"
        >
          <option value="solar" selected>☀️ Sistemul Solar</option>
          <option value="interstellar">✨ Stele și exoplanete</option>
          <option value="galactic">🌀 Calea Lactee și galaxii</option>
        </select>
      `;
      const headerEl = document.querySelector('.hud-header');
      const filtersEl = document.querySelector('.header-filters');
      if (filtersEl && filtersEl.parentElement) {
        filtersEl.insertAdjacentElement('beforebegin', navEl);
      } else if (headerEl) {
        headerEl.appendChild(navEl);
      } else {
        document.body.appendChild(navEl);
      }
    }
  }

  private ensureHomeMarkerDom(): void {
    if (!this.labelsContainer) return;
    let markerBtn = document.getElementById('hud-home-solar-marker') as HTMLButtonElement | null;
    if (!markerBtn) {
      markerBtn = document.createElement('button');
      markerBtn.id = 'hud-home-solar-marker';
      markerBtn.type = 'button';
      markerBtn.className = 'celestial-label home-solar-beacon-label is-hidden';
      markerBtn.title = 'Click pentru a reveni acasă în Sistemul nostru Solar!';
      markerBtn.innerHTML = `<span class="label-dot" style="background:#00f0ff"></span>📍 Aici este Sistemul nostru Solar (Acasă)`;
      markerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setHorizon('solar');
      });
      this.labelsContainer.appendChild(markerBtn);
    }
    this.homeMarkerDomEl = markerBtn;
  }

  private bindEvents(): void {
    const selectEl = document.getElementById('hud-horizon-select') as HTMLSelectElement | null;
    if (selectEl) {
      selectEl.addEventListener('change', () => {
        const targetHorizon = selectEl.value as CosmicHorizon;
        if (targetHorizon && COSMIC_HORIZONS[targetHorizon]) {
          this.setHorizon(targetHorizon);
        }
      });
    }

    const btns = document.querySelectorAll<HTMLButtonElement>('[data-cosmic-horizon]');
    btns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetHorizon = (btn.dataset.cosmicHorizon ||
          btn.getAttribute('data-cosmic-horizon')) as CosmicHorizon | null;
        if (targetHorizon) {
          this.setHorizon(targetHorizon);
        }
      });
    });
  }

  public getHorizon(): CosmicHorizon {
    return this.currentHorizon;
  }

  public getHorizonMeta(horizon: CosmicHorizon = this.currentHorizon): HorizonMeta {
    return COSMIC_HORIZONS[horizon];
  }

  public onChange(cb: HorizonChangeCallback): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  /**
   * Comută Orizontul Cosmic activ (`solar`, `interstellar`, `galactic`),
   * lansează tranziția de tip "Hyper-Zoom" a camerei și actualizează grupul 3D activ.
   */
  public setHorizon(
    horizon: CosmicHorizon,
    options?: { targetBodyId?: string; skipAutoFocus?: boolean }
  ): void {
    const meta = COSMIC_HORIZONS[horizon];
    if (!meta) return;

    const changed = this.currentHorizon !== horizon;
    this.currentHorizon = horizon;
    this.orbitalEngine.setActiveHorizon(horizon);
    this.orbitalEngine.updatePositions(0);
    this.syncUiState();

    // Efect de Hyper-Zoom pe FOV-ul camerei
    if (changed) {
      this.hyperZoomActive = true;
      this.hyperZoomProgress = 0;
    }

    const focusId = options?.targetBodyId ?? meta.defaultBodyId;
    const focusBody = this.orbitalEngine.getBody(focusId) ?? null;

    if (!options?.skipAutoFocus) {
      const [cx, cy, cz] = meta.overviewCameraPos;
      this.camera.position.set(cx, cy, cz);
      if (focusBody) {
        this.cameraController.focusBody(focusBody.data.id);
      } else {
        this.cameraController.resetToOverview();
      }
    }

    for (const cb of this.listeners) {
      cb(horizon, meta, focusBody);
    }
  }

  private syncUiState(): void {
    const selectEl = document.getElementById('hud-horizon-select') as HTMLSelectElement | null;
    if (selectEl) {
      selectEl.value = this.currentHorizon;
    }

    const btns = document.querySelectorAll<HTMLButtonElement>('[data-cosmic-horizon]');
    btns.forEach((btn) => {
      const h = btn.dataset.cosmicHorizon || btn.getAttribute('data-cosmic-horizon');
      btn.classList.toggle('hud-btn-active-cyan', h === this.currentHorizon);
    });

    if (this.homeMarkerDomEl) {
      const showHome = this.currentHorizon !== 'solar';
      this.homeMarkerDomEl.classList.toggle('is-hidden', !showHome);
      if (!showHome) {
        this.homeMarkerDomEl.style.display = 'none';
      }
    }
  }

  /**
   * Actualizează în fiecare cadru animația de Hyper-Zoom, pulsația balizei Sistemului Solar
   * și proiecția 2D a indicatorului `📍 Aici este Sistemul nostru Solar (Acasă)`.
   */
  public update(deltaSeconds: number, elapsedSeconds: number): void {
    if (this.hyperZoomActive) {
      this.hyperZoomProgress = Math.min(1, this.hyperZoomProgress + deltaSeconds * 2.4);
      const wave = Math.sin(this.hyperZoomProgress * Math.PI);
      this.camera.fov = 48 + wave * 14;
      this.camera.updateProjectionMatrix();
      if (this.hyperZoomProgress >= 1) {
        this.hyperZoomActive = false;
        this.camera.fov = 48;
        this.camera.updateProjectionMatrix();
      }
    }

    if (this.currentHorizon === 'solar') {
      if (this.homeMarkerDomEl) {
        this.homeMarkerDomEl.style.display = 'none';
      }
      return;
    }

    const pulse = 1 + Math.sin(elapsedSeconds * 3.2) * 0.14;
    const activeBeacon =
      this.currentHorizon === 'interstellar'
        ? this.homeBeaconInterstellar
        : this.homeBeaconGalactic;
    activeBeacon.scale.setScalar(pulse);

    if (this.homeMarkerDomEl) {
      const width = window.innerWidth || 1280;
      const height = window.innerHeight || 800;

      this.tempProj.copy(activeBeacon.position);
      this.tempProj.y += 4.2;
      this.tempProj.project(this.camera);

      if (this.tempProj.z < -1 || this.tempProj.z > 1) {
        this.homeMarkerDomEl.style.display = 'none';
      } else {
        const x = (this.tempProj.x * 0.5 + 0.5) * width;
        const y = (-this.tempProj.y * 0.5 + 0.5) * height;
        this.homeMarkerDomEl.style.display = 'inline-flex';
        this.homeMarkerDomEl.style.left = `${x.toFixed(1)}px`;
        this.homeMarkerDomEl.style.top = `${y.toFixed(1)}px`;
      }
    }
  }
}

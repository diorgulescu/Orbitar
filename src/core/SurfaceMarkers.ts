// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { CelestialBodyInstance, OrbitalEngine } from './OrbitalEngine';

export interface SurfaceMarkerData {
  id: string;
  planetId: 'mars' | 'moon';
  titleRo: string;
  regionRo: string;
  missionNameRo: string;
  year: number;
  latDeg: number;
  lonDeg: number;
  color: string;
  descriptionRo: string;
  linkedBodyId?: string;
}

export const SURFACE_MARKERS_DATA: SurfaceMarkerData[] = [
  {
    id: 'jezero-perseverance',
    planetId: 'mars',
    titleRo: 'Craterul Jezero — Perseverance & Ingenuity',
    regionRo: 'Craterul Jezero (18,38° N, 77,58° E)',
    missionNameRo: 'NASA Mars 2020 (Perseverance & Ingenuity)',
    year: 2021,
    latDeg: 18.38,
    lonDeg: 77.58,
    color: '#00f0ff',
    descriptionRo:
      'Locul de amartizare din 18 februarie 2021: un fost lac marțian de 45 km diametru cu o deltă fluvială fosilă unde Perseverance colectează mostre de rocă, iar elicopterul Ingenuity a realizat 72 de zboruri istorice.',
    linkedBodyId: 'perseverance',
  },
  {
    id: 'gale-curiosity',
    planetId: 'mars',
    titleRo: 'Craterul Gale — Curiosity (MSL)',
    regionRo: 'Craterul Gale / Muntele Sharp (4,58° S, 137,44° E)',
    missionNameRo: 'NASA Mars Science Laboratory (Curiosity)',
    year: 2012,
    latDeg: -4.58,
    lonDeg: 137.44,
    color: '#ffb703',
    descriptionRo:
      'Amartizare pe 6 august 2012 la poalele muntelui Aeolis Mons (Mount Sharp, 5,5 km înălțime). Curiosity a demonstrat că în Craterul Gale au existat lacuri cu apă dulce și argile bogate în compuși organici.',
    linkedBodyId: 'curiosity',
  },
  {
    id: 'chryse-viking1',
    planetId: 'mars',
    titleRo: 'Chryse Planitia — Viking 1',
    regionRo: 'Câmpia Chryse Planitia (22,27° N, 47,95° V)',
    missionNameRo: 'NASA Viking 1 Lander',
    year: 1976,
    latDeg: 22.27,
    lonDeg: -47.95,
    color: '#f97316',
    descriptionRo:
      'Prima sondă din istorie care a amartizat cu succes și a transmis imagini de la solul lui Marte (20 iulie 1976), funcționând timp de peste 6 ani pe suprafața marțiană.',
  },
  {
    id: 'tranquillitatis-apollo11',
    planetId: 'moon',
    titleRo: 'Marea Liniștii — Apollo 11',
    regionRo: 'Mare Tranquillitatis (0,67° N, 23,47° E)',
    missionNameRo: 'Apollo 11 (Neil Armstrong & Buzz Aldrin)',
    year: 1969,
    latDeg: 0.67,
    lonDeg: 23.47,
    color: '#00f0ff',
    descriptionRo:
      'Locul istoric unde modulul lunar «Eagle» a aselenizat la 20 iulie 1969, iar oamenii au pășit pentru prima dată pe un alt corp ceresc: „Un pas mic pentru om, un salt uriaș pentru omenire!”',
  },
  {
    id: 'hadley-apollo15',
    planetId: 'moon',
    titleRo: 'Mons Hadley — Apollo 15 (Primul Rover Lunar)',
    regionRo: 'Munții Apenini Lunari (26,13° N, 3,63° E)',
    missionNameRo: 'Apollo 15 (David Scott & James Irwin)',
    year: 1971,
    latDeg: 26.13,
    lonDeg: 3.63,
    color: '#ffb703',
    descriptionRo:
      'Aselenizare la 30 iulie 1971 lângă canalul vulcanic Hadley Rille; prima misiune în care astronauții au condus automobilul electric Lunar Roving Vehicle (LRV) și au descoperit «Piatra Genezei».',
  },
  {
    id: 'taurus-littrow-apollo17',
    planetId: 'moon',
    titleRo: 'Valea Taurus-Littrow — Apollo 17',
    regionRo: 'Taurus-Littrow (20,19° N, 30,77° E)',
    missionNameRo: 'Apollo 17 (Eugene Cernan & Harrison Schmitt)',
    year: 1972,
    latDeg: 20.19,
    lonDeg: 30.77,
    color: '#38bdf8',
    descriptionRo:
      'Cea mai recentă aselenizare cu echipaj uman (11 decembrie 1972), la care a participat geologul Harrison Schmitt, descoperind solul portocaliu de sticlă vulcanică lunară.',
  },
];

interface MarkerInstance {
  data: SurfaceMarkerData;
  pinGroup: THREE.Group;
  pinHead: THREE.Mesh;
  badgeEl: HTMLButtonElement;
}

export type MarkerSelectCallback = (marker: SurfaceMarkerData) => void;

/**
 * SurfaceMarkers afișează pini 3D și etichete interactive pe globurile lui Marte și ale Lunii
 * atunci când camera se apropie de ele, marcând locurile istorice de amartizare și aselenizare.
 */
export class SurfaceMarkers {
  private readonly orbitalEngine: OrbitalEngine;
  private readonly labelsContainer: HTMLElement;
  private readonly markers: MarkerInstance[] = [];
  private readonly selectCallbacks: Set<MarkerSelectCallback> = new Set();

  private readonly tempWorldPos = new THREE.Vector3();
  private readonly tempPlanetPos = new THREE.Vector3();
  private readonly tempNormal = new THREE.Vector3();
  private readonly tempToCam = new THREE.Vector3();
  private readonly tempProj = new THREE.Vector3();

  constructor(orbitalEngine: OrbitalEngine, labelsContainer: HTMLElement) {
    this.orbitalEngine = orbitalEngine;
    this.labelsContainer = labelsContainer;
    this.createMarkers();
  }

  public onSelectMarker(callback: MarkerSelectCallback): () => void {
    this.selectCallbacks.add(callback);
    return () => this.selectCallbacks.delete(callback);
  }

  public getMarkers(): SurfaceMarkerData[] {
    return SURFACE_MARKERS_DATA;
  }

  private createMarkers(): void {
    const stemGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.14, 8);
    stemGeo.translate(0, 0.07, 0);
    const headGeo = new THREE.SphereGeometry(0.032, 14, 14);

    for (const data of SURFACE_MARKERS_DATA) {
      const planet = this.orbitalEngine.getBody(data.planetId);
      if (!planet) continue;

      const pinGroup = new THREE.Group();
      pinGroup.name = `SurfacePin_${data.id}`;
      pinGroup.userData = { markerId: data.id };

      // Convertim latitudinea și longitudinea în coordonate pe sfera unitară (raza = 1.0)
      const latRad = THREE.MathUtils.degToRad(data.latDeg);
      const lonRad = THREE.MathUtils.degToRad(data.lonDeg);

      const nx = Math.cos(latRad) * Math.cos(lonRad);
      const ny = Math.sin(latRad);
      const nz = -Math.cos(latRad) * Math.sin(lonRad);
      const normalDir = new THREE.Vector3(nx, ny, nz).normalize();

      pinGroup.position.copy(normalDir);
      pinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalDir);

      const pinMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(data.color) });
      const stemMesh = new THREE.Mesh(stemGeo, pinMat);
      const pinHead = new THREE.Mesh(headGeo, pinMat);
      pinHead.position.y = 0.15;

      pinGroup.add(stemMesh, pinHead);
      pinGroup.visible = false;
      planet.visualRoot.add(pinGroup);

      // Etichetă 2D interactivă pentru pinul de suprafață
      const badgeEl = document.createElement('button');
      badgeEl.type = 'button';
      badgeEl.className = 'surface-marker-pin is-hidden';
      badgeEl.dataset.markerId = data.id;
      badgeEl.innerHTML = `<span class="pin-beacon" style="background:${data.color}"></span>📍 ${data.titleRo}`;
      badgeEl.addEventListener('click', (e) => {
        e.stopPropagation();
        this.triggerMarkerSelect(data);
      });
      this.labelsContainer.appendChild(badgeEl);

      this.markers.push({
        data,
        pinGroup,
        pinHead,
        badgeEl,
      });
    }
  }

  public triggerMarkerSelect(data: SurfaceMarkerData): void {
    for (const cb of this.selectCallbacks) {
      cb(data);
    }
  }

  /**
   * Actualizează vizibilitatea și proiecția 2D a pinilor de pe Marte și Lună
   * atunci când camera se apropie de globul respectiv sau îl urmărește.
   */
  public update(camera: THREE.PerspectiveCamera, trackedBody: CelestialBodyInstance | null): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const trackedId = trackedBody?.data.id ?? '';

    for (const m of this.markers) {
      const planet = this.orbitalEngine.getBody(m.data.planetId);
      if (!planet || !planet.rootGroup.visible) {
        m.pinGroup.visible = false;
        m.badgeEl.classList.add('is-hidden');
        continue;
      }

      this.tempPlanetPos.copy(planet.worldPosition);
      const camDist = camera.position.distanceTo(this.tempPlanetPos);

      // Afișăm pinii când camera este aproape de Marte/Lună sau când planeta/roverul asociat este selectat
      const isFocusedOnSystem =
        trackedId === m.data.planetId ||
        (m.data.planetId === 'mars' &&
          (trackedId === 'perseverance' || trackedId === 'curiosity'));

      const proximityThreshold = Math.max(planet.visualRadius * 16, 12);
      const shouldShow = isFocusedOnSystem || camDist <= proximityThreshold;

      if (!shouldShow) {
        m.pinGroup.visible = false;
        m.badgeEl.classList.add('is-hidden');
        continue;
      }

      m.pinGroup.visible = true;
      m.pinHead.getWorldPosition(this.tempWorldPos);

      // Verificăm dacă pinul se află pe emisfera orientată spre cameră (sau aproape de orizont)
      this.tempNormal.copy(this.tempWorldPos).sub(this.tempPlanetPos).normalize();
      this.tempToCam.copy(camera.position).sub(this.tempWorldPos).normalize();
      const facingDot = this.tempNormal.dot(this.tempToCam);

      if (facingDot < -0.15) {
        m.badgeEl.classList.add('is-hidden');
        continue;
      }

      this.tempProj.copy(this.tempWorldPos).project(camera);
      if (this.tempProj.z < -1 || this.tempProj.z > 1) {
        m.badgeEl.classList.add('is-hidden');
        continue;
      }

      const x = (this.tempProj.x * 0.5 + 0.5) * width;
      const y = (-this.tempProj.y * 0.5 + 0.5) * height;

      m.badgeEl.classList.remove('is-hidden');
      m.badgeEl.style.left = `${x.toFixed(1)}px`;
      m.badgeEl.style.top = `${y.toFixed(1)}px`;
    }
  }
}

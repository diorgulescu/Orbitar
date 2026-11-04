// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { CelestialBodyInstance, OrbitalEngine } from './OrbitalEngine';

export interface SurfaceMarkerData {
  id: string;
  planetId: 'mars' | 'moon';
  icon?: string;
  titleRo: string;
  regionRo: string;
  missionNameRo: string;
  year: number;
  latDeg: number;
  lonDeg: number;
  color: string;
  descriptionRo: string;
  linkedBodyId?: string;
  imageUrl?: string;
  imageCaptionRo?: string;
}

export const SURFACE_MARKERS_DATA: SurfaceMarkerData[] = [
  {
    id: 'rover-perseverance',
    planetId: 'mars',
    icon: '🤖',
    titleRo: 'Roverul Perseverance & Ingenuity',
    regionRo: 'Craterul Jezero, Marte (18,38° N, 77,58° E)',
    missionNameRo: 'NASA Mars 2020 (Perseverance Rover & Ingenuity Helicopter)',
    year: 2021,
    latDeg: 18.38,
    lonDeg: 77.58,
    color: '#00f0ff',
    descriptionRo:
      'Laborator astrobiologic mobil de 1.025 kg amartizat la 18 februarie 2021 în Craterul Jezero. Caută biosemnături străvechi, sigilează eșantioane de rocă marțiană, produce oxigen prin experimentul MOXIE și a transportat elicopterul Ingenuity (72 de zboruri propulsate pe Marte!).',
    linkedBodyId: 'perseverance',
    imageUrl: './textures/nasa/perseverance.jpg',
    imageCaptionRo:
      '📸 Fotografie reală NASA/JPL-Caltech (PIA24542): Roverul Perseverance alături de elicopterul Ingenuity pe solul Craterului Jezero.',
  },
  {
    id: 'rover-curiosity',
    planetId: 'mars',
    icon: '🤖',
    titleRo: 'Roverul Curiosity (MSL)',
    regionRo: 'Craterul Gale / Muntele Sharp, Marte (4,58° S, 137,44° E)',
    missionNameRo: 'NASA Mars Science Laboratory (Curiosity Rover)',
    year: 2012,
    latDeg: -4.58,
    lonDeg: 137.44,
    color: '#f97316',
    descriptionRo:
      'Rover nuclear de 899 kg (alimentat cu plutoniu MMRTG) care explorează Craterul Gale din 6 august 2012. Cu ajutorul laserului ChemCam și al laboratorului intern SAM, Curiosity a demonstrat că Marte a avut râuri și lacuri cu apă dulce capabile să susțină viața microbiană.',
    linkedBodyId: 'curiosity',
    imageUrl: './textures/nasa/curiosity.jpg',
    imageCaptionRo:
      '📸 Autoportret real NASA/JPL-Caltech (PIA16239): Roverul Curiosity fotografiat în Craterul Gale de pe Marte.',
  },
  {
    id: 'crater-jezero',
    planetId: 'mars',
    icon: '📍',
    titleRo: 'Craterul Jezero',
    regionRo: 'Marginea Bazinului Isidis (18,85° N, 77,52° E)',
    missionNameRo: 'Fost lac marțian și deltă fluvială fosilă',
    year: 2021,
    latDeg: 24.2,
    lonDeg: 70.5,
    color: '#38bdf8',
    descriptionRo:
      'Crater de impact cu diametrul de 45 km care, acum peste 3,5 miliarde de ani, adăpostea un lac adânc alimentat de un râu. Delta fluvială fosilă păstrează sedimente de argilă și carbonați aduse de apele străvechi.',
  },
  {
    id: 'crater-gale',
    planetId: 'mars',
    icon: '📍',
    titleRo: 'Craterul Gale & Muntele Sharp',
    regionRo: 'Aeolis Mensae (5,4° S, 137,8° E)',
    missionNameRo: 'Bazin sedimentar stratificat (154 km diametru)',
    year: 2012,
    latDeg: -10.8,
    lonDeg: 130.2,
    color: '#ffb703',
    descriptionRo:
      'Crater uriaș de 154 km diametru în centrul căruia se înalță Aeolis Mons (Muntele Sharp, 5.500 m altitudine). Straturile sale de argile și sulfați sunt ca paginile unei cărți care arată cum s-a transformat Marte dintr-o planetă umedă într-un deșert rece.',
  },
  {
    id: 'olympus-mons',
    planetId: 'mars',
    icon: '🌋',
    titleRo: 'Vulcanul Olympus Mons (21,9 km)',
    regionRo: 'Regiunea vulcanică Tharsis (18,65° N, 133,8° V)',
    missionNameRo: 'Cel mai înalt munte din Sistemul Solar',
    year: 1971,
    latDeg: 18.65,
    lonDeg: -133.8,
    color: '#ef4444',
    descriptionRo:
      'Vulcan-scut gigantic cu înălțimea de 21,9 km (de aproape trei ori mai înalt decât Muntele Everest de pe Pământ!) și o bază de 600 km lățime — cât toată România!',
  },
  {
    id: 'chryse-viking1',
    planetId: 'mars',
    icon: '📍',
    titleRo: 'Chryse Planitia — Viking 1',
    regionRo: 'Câmpia Chryse Planitia (22,27° N, 47,95° V)',
    missionNameRo: 'NASA Viking 1 Lander',
    year: 1976,
    latDeg: 22.27,
    lonDeg: -47.95,
    color: '#fb923c',
    descriptionRo:
      'Prima sondă din istorie care a amartizat cu succes și a transmis fotografii color direct de pe solul lui Marte (20 iulie 1976), funcționând timp de peste 6 ani pe suprafața marțiană.',
  },
  {
    id: 'tranquillitatis-apollo11',
    planetId: 'moon',
    icon: '📍',
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
    icon: '🤖',
    titleRo: 'Mons Hadley — Apollo 15 (Rover Lunar)',
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
    icon: '📍',
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
 * pentru rovere (Perseverance & Ingenuity, Curiosity) și cratere / locuri istorice de explorare.
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
  private readonly tempLimbPos = new THREE.Vector3();

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

  public getMarkerByLinkedBodyId(bodyId: string): SurfaceMarkerData | undefined {
    return SURFACE_MARKERS_DATA.find((m) => m.linkedBodyId === bodyId);
  }

  private createMarkers(): void {
    const stemGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.22, 10);
    stemGeo.translate(0, 0.11, 0);
    const headGeo = new THREE.SphereGeometry(0.044, 16, 16);
    const ringGeo = new THREE.RingGeometry(0.045, 0.075, 24);
    ringGeo.rotateX(-Math.PI / 2);

    for (const data of SURFACE_MARKERS_DATA) {
      const planet = this.orbitalEngine.getBody(data.planetId);
      if (!planet) continue;

      const pinGroup = new THREE.Group();
      pinGroup.name = `SurfacePin_${data.id}`;
      pinGroup.userData = {
        markerId: data.id,
        bodyId: data.linkedBodyId ?? data.planetId,
      };

      // Convertim latitudinea și longitudinea în coordonate pe sfera unitară (raza = 1.0)
      const latRad = THREE.MathUtils.degToRad(data.latDeg);
      const lonRad = THREE.MathUtils.degToRad(data.lonDeg);

      const nx = Math.cos(latRad) * Math.cos(lonRad);
      const ny = Math.sin(latRad);
      const nz = -Math.cos(latRad) * Math.sin(lonRad);
      const normalDir = new THREE.Vector3(nx, ny, nz).normalize();

      pinGroup.position.copy(normalDir);
      pinGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normalDir);

      const pinMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(data.color),
        side: THREE.DoubleSide,
      });
      const stemMesh = new THREE.Mesh(stemGeo, pinMat);
      const pinHead = new THREE.Mesh(headGeo, pinMat);
      pinHead.position.y = 0.23;

      const surfaceRing = new THREE.Mesh(ringGeo, pinMat);
      surfaceRing.position.y = 0.036;

      stemMesh.userData = { markerId: data.id, bodyId: data.linkedBodyId ?? data.planetId };
      pinHead.userData = { markerId: data.id, bodyId: data.linkedBodyId ?? data.planetId };
      surfaceRing.userData = { markerId: data.id, bodyId: data.linkedBodyId ?? data.planetId };

      pinGroup.add(stemMesh, pinHead, surfaceRing);
      pinGroup.visible = false;
      planet.visualRoot.add(pinGroup);

      // Etichetă 2D interactivă pentru pinul de suprafață (rover sau crater)
      const badgeEl = document.createElement('button');
      badgeEl.type = 'button';
      const isRoverPin = Boolean(data.linkedBodyId);
      badgeEl.className = isRoverPin
        ? 'surface-marker-pin is-rover-pin is-hidden'
        : 'surface-marker-pin is-hidden';
      badgeEl.dataset.markerId = data.id;
      if (data.linkedBodyId) {
        badgeEl.dataset.bodyId = data.linkedBodyId;
      }
      const iconStr = data.icon ?? '📍';
      badgeEl.innerHTML = `<span class="pin-beacon" style="background:${data.color}"></span>${iconStr} ${data.titleRo}`;
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
   * atunci când camera se apropie de globul respectiv sau urmărește planeta/roverul.
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

      const proximityThreshold = Math.max(planet.visualRadius * 28, 22);
      const shouldShow = isFocusedOnSystem || camDist <= proximityThreshold;

      if (!shouldShow) {
        m.pinGroup.visible = false;
        m.badgeEl.classList.add('is-hidden');
        continue;
      }

      m.pinGroup.visible = true;
      m.pinHead.getWorldPosition(this.tempWorldPos);

      const isRoverPin = Boolean(m.data.linkedBodyId);
      const isThisRoverSelected = Boolean(m.data.linkedBodyId && trackedId === m.data.linkedBodyId);
      m.badgeEl.classList.toggle('is-active', isThisRoverSelected);

      // Verificăm dacă pinul se află pe emisfera orientată spre cameră
      this.tempNormal.copy(this.tempWorldPos).sub(this.tempPlanetPos).normalize();
      this.tempToCam.copy(camera.position).sub(this.tempPlanetPos).normalize();
      const facingDot = this.tempNormal.dot(this.tempToCam);

      if (facingDot < -0.1) {
        if (!isRoverPin) {
          m.badgeEl.classList.add('is-hidden');
          continue;
        }
        // Pentru pinii roverelor (Perseverance și Curiosity), chiar dacă Marte s-a rotit cu roverul pe
        // emisfera opusă, păstrăm pinul vizibil și accesibil pe marginea (limbul) globului marțian!
        this.tempLimbPos
          .copy(this.tempNormal)
          .addScaledVector(this.tempToCam, -facingDot + 0.15)
          .normalize();
        this.tempWorldPos
          .copy(this.tempPlanetPos)
          .addScaledVector(this.tempLimbPos, planet.visualRadius * 1.22);
        m.badgeEl.classList.add('is-behind-limb');
      } else {
        m.badgeEl.classList.remove('is-behind-limb');
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

// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { CelestialBodyInstance, OrbitalEngine } from '../core/OrbitalEngine';
import { ScaleManager } from '../core/ScaleManager';
import { CameraController } from '../core/CameraController';

export type SpacecraftId = 'vlaicu1' | 'coandax' | 'luceafarul';
export type CockpitTheme = 'amber' | 'cyan' | 'violet';
export type BeltHazardZone = 'none' | 'asteroid_belt' | 'kuiper_belt';

export const SPEED_OF_LIGHT_KMH = 1_079_252_848.8;
export const KM_PER_AU_CONST = 149_597_870.7;

export const ASTEROID_BELT_MIN_AU = 2.1;
export const ASTEROID_BELT_MAX_AU = 3.3;
export const KUIPER_BELT_MIN_AU = 30.0;
export const KUIPER_BELT_MAX_AU = 50.0;

export const ASTEROID_BELT_ALERT_RO =
  '⚠️ Atenție: Traversăm Centura de Asteroizi! Scuturile Deflectoare sunt active pentru micro-meteoriți. Știai că? Deși în filmele SF asteroizii par înghesuiți, în realitate ei sunt la sute de mii de kilometri distanță unul de altul — sondele NASA trec printre ei fără să lovească nimic!';

export const KUIPER_BELT_ALERT_RO =
  '❄️ Atenție: Am intrat în Centura Kuiper — tărâmul lumilor înghețate de la marginea Sistemului Solar! Scuturile termice și deflectoare sunt active. Aici locuiesc Pluto și mii de blocuri străvechi de gheață și rocă, aflate la distanțe uriașe unele de altele.';

export interface SpacecraftSpec {
  id: SpacecraftId;
  nameRo: string;
  shortNameRo: string;
  badgeIcon: string;
  propulsionRo: string;
  speedKmh: number;
  lightSpeedPercent: number;
  theme: CockpitTheme;
  accentColorHex: string;
  didacticSummaryRo: string;
  manualSceneSpeed: number;
  boostMultiplier: number;
}

export const SPACECRAFT_SPECS: Record<SpacecraftId, SpacecraftSpec> = {
  vlaicu1: {
    id: 'vlaicu1',
    nameRo: '🚀 Racheta "Vlaicu-1"',
    shortNameRo: 'Racheta "Vlaicu-1"',
    badgeIcon: '🚀',
    propulsionRo: 'Propulsie Chimică',
    speedKmh: 50_000,
    lightSpeedPercent: (50_000 / SPEED_OF_LIGHT_KMH) * 100,
    theme: 'amber',
    accentColorHex: '#ffb703',
    didacticSummaryRo:
      'Arată cât durează în realitate călătoriile de azi (3 zile până la Lună, ~7 luni până la Marte, ~5-6 ani până la Jupiter, ~12 ani până la Neptun).',
    manualSceneSpeed: 18,
    boostMultiplier: 5.5,
  },
  coandax: {
    id: 'coandax',
    nameRo: '🛸 Nava "Coandă-X"',
    shortNameRo: 'Nava "Coandă-X"',
    badgeIcon: '🛸',
    propulsionRo: 'Propulsie cu Fuziune & Plasmă',
    speedKmh: 1_500_000,
    lightSpeedPercent: (1_500_000 / SPEED_OF_LIGHT_KMH) * 100,
    theme: 'cyan',
    accentColorHex: '#00f0ff',
    didacticSummaryRo:
      'Tehnologia viitorului apropiat (ore până la Lună, câteva zile până la Marte, săptămâni până la giganții gazoși).',
    manualSceneSpeed: 28,
    boostMultiplier: 6.5,
  },
  luceafarul: {
    id: 'luceafarul',
    nameRo: '✨ Astronava "Luceafărul"',
    shortNameRo: 'Astronava "Luceafărul"',
    badgeIcon: '✨',
    propulsionRo: 'Propulsie Fotonică / Cuantică (1c)',
    speedKmh: Math.round(SPEED_OF_LIGHT_KMH),
    lightSpeedPercent: 100,
    theme: 'violet',
    accentColorHex: '#c084fc',
    didacticSummaryRo:
      'Călătorește cu viteza luminii (8 minute de la Soare la Pământ, ~43 minute până la Jupiter, ~4 ore până la Neptun).',
    manualSceneSpeed: 42,
    boostMultiplier: 8.0,
  },
};

export interface ArrivalBriefingReport {
  body: CelestialBodyInstance;
  ship: SpacecraftSpec;
  originBodyId: string | null;
  originBodyNameRo: string;
  distanceTraveledKm: number;
  tripDurationHours: number;
  tripDurationFormattedRo: string;
  earthDateOnArrival: Date;
  earthYearCalculated: number;
  temperatureC: number;
  distanceFromSunMilKm: string;
  distanceFromSunAuStr: string;
  distanceFromEarthMilKm: string;
  headlineRo: string;
  temperatureLineRo: string;
  distancesLineRo: string;
  earthClockLineRo: string;
  observationLineRo: string;
  fullSpeechTextRo: string;
}

export interface PilotTelemetryState {
  active: boolean;
  ship: SpacecraftSpec;
  currentSpeedKmh: number;
  currentLightPercent: number;
  isAutopilot: boolean;
  isBoosting: boolean;
  autopilotTarget: CelestialBodyInstance | null;
  autopilotProgress: number;
  anchoredBody: CelestialBodyInstance | null;
  selectedTargetBody: CelestialBodyInstance | null;
  heliocentricDistanceAu: number;
  activeBeltZone: BeltHazardZone;
  shieldActive: boolean;
  earthDate: Date;
  totalDistanceTraveledKm: number;
  lastTripDurationRo: string;
}

export type BeltAlertCallback = (zone: 'asteroid_belt' | 'kuiper_belt', messageRo: string) => void;
export type ArrivalBriefingCallback = (report: ArrivalBriefingReport) => void;
export type PilotModeChangeCallback = (active: boolean) => void;
export type ShipChangeCallback = (ship: SpacecraftSpec) => void;

/**
 * Formatează numele unui corp ceresc în acuzativ natural în limba română pentru
 * construcțiile "Am ajuns la ..." și "Sosire la ...", evitând articolele hotărâte
 * nenaturale ("Am ajuns la Soarele", "Am ajuns la Pământul", "Am ajuns la Luna").
 */
export function formatDestinationNameRo(data: {
  id: string;
  name: string;
  category?: string;
}): string {
  switch (data.id) {
    case 'sun':
      return 'Soare';
    case 'earth':
      return 'planeta Pământ';
    case 'moon':
      return 'Lună';
    case 'mercury':
    case 'venus':
    case 'mars':
    case 'jupiter':
    case 'saturn':
    case 'uranus':
    case 'neptune':
      return `planeta ${data.name}`;
    case 'pluto':
    case 'ceres':
    case 'eris':
    case 'haumea':
    case 'makemake':
      return `planeta pitică ${data.name}`;
    case 'iss':
      return 'Stația Spațială Internațională';
    case 'jwst':
      return 'Telescopul Spațial James Webb';
    case 'pleiades':
      return 'roiul stelar Pleiadele';
    case 'pillars_of_creation':
      return 'Stâlpii Creației din Nebuloasa Vulturul';
    case 'sagittarius_a':
      return 'gaura neagră Sagittarius A*';
    case 'proxima_centauri':
      return 'steaua Proxima Centauri';
    case 'sirius':
      return 'sistemul stelar Sirius';
    case 'betelgeuse':
      return 'steaua Betelgeuse';
    case 'cancri55e':
      return 'exoplaneta 55 Cancri e';
    default: {
      const cleanName = data.name.replace(/\s*\([^)]*\)\s*$/, '').trim();
      if (data.category === 'moon') {
        return `satelitul ${cleanName}`;
      }
      if (data.category === 'asteroid') {
        return `asteroidul ${cleanName}`;
      }
      return cleanName;
    }
  }
}

/**
 * Formatează didactic durata unei călătorii interplanetare în limba română
 * (secunde, minute, ore, zile, luni sau ani).
 */
export function formatDidacticTripDurationRo(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) {
    return 'câteva secunde';
  }
  const totalSeconds = hours * 3600;
  if (totalSeconds < 60) {
    const sec = Math.max(1, Math.round(totalSeconds));
    return `${sec} ${sec === 1 ? 'secundă' : 'secunde'}`;
  }
  const totalMinutes = hours * 60;
  if (totalMinutes < 60) {
    const mins = Math.round(totalMinutes);
    const remSec = Math.round(totalSeconds % 60);
    if (mins < 12 && remSec >= 10 && remSec <= 50) {
      return `${mins} minute și ${remSec} secunde`;
    }
    return `${mins} ${mins === 1 ? 'minut' : mins >= 20 ? 'de minute' : 'minute'}`;
  }
  if (hours < 48) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    if (h < 10 && m >= 10 && m < 60) {
      return `${h} ${h === 1 ? 'oră' : 'ore'} și ${m} minute`;
    }
    const roundedH = Math.max(1, Math.round(hours));
    return `${roundedH} ${roundedH === 1 ? 'oră' : roundedH >= 20 ? 'de ore' : 'ore'}`;
  }
  const totalDays = hours / 24;
  if (totalDays < 60) {
    const days = Math.round(totalDays);
    if (days >= 14 && days <= 25) {
      const weeks = Math.round(days / 7);
      return `${days} de zile (~${weeks} săptămâni)`;
    }
    return `${days} ${days === 1 ? 'zi' : days >= 20 ? 'de zile' : 'zile'}`;
  }
  const totalMonths = totalDays / 30.4375;
  if (totalMonths < 12) {
    const months = Math.round(totalMonths);
    return `${months} ${months === 1 ? 'lună' : 'luni'}`;
  }
  const years = totalDays / 365.25;
  const wholeYears = Math.floor(years);
  const remMonths = Math.round((years - wholeYears) * 12);
  if (remMonths <= 0 || wholeYears >= 10) {
    const roundedY = Math.round(years);
    return `${roundedY} ${roundedY === 1 ? 'an' : roundedY >= 20 ? 'de ani' : 'ani'}`;
  }
  if (remMonths === 12) {
    const nextY = wholeYears + 1;
    return `${nextY} ${nextY === 1 ? 'an' : 'ani'}`;
  }
  const yearLabel = wholeYears === 1 ? '1 an' : `${wholeYears} ani`;
  const monthLabel = remMonths === 1 ? '1 lună' : `${remMonths} luni`;
  return `${yearLabel} și ${monthLabel}`;
}

/**
 * Calibrează didactic distanța efectivă și durata călătoriei în funcție de nava aleasă:
 * - Pentru Racheta Chimică "Vlaicu-1" (50.000 km/h), aplică factorul de transfer orbital Hohmann /
 *   asistență gravitațională (astfel încât Pământ -> Lună = 3 zile, Marte = ~7 luni, Jupiter = ~5,5 ani, Neptun = ~12 ani).
 * - Pentru Nava "Coandă-X" (1.500.000 km/h) și Astronava "Luceafărul" (1c), folosește traiectoria directă.
 */
export function computeCalibratedFlightMetrics(
  originBody: CelestialBodyInstance | null,
  targetBody: CelestialBodyInstance,
  rawEuclideanAu: number,
  ship: SpacecraftSpec
): { distanceKm: number; durationHours: number } {
  const originId = originBody?.data.id ?? 'earth';
  const targetId = targetBody.data.id;

  // Cazul local Pământ <-> Lună / ISS / Hubble
  const isEarthMoonPair =
    (originId === 'earth' && targetId === 'moon') ||
    (originId === 'moon' && targetId === 'earth');

  if (isEarthMoonPair) {
    const moonDistKm = 384_400;
    if (ship.id === 'vlaicu1') {
      // Traiectoria translunară curbată Apollo (~3 zile = 72 ore)
      return { distanceKm: 3_600_000, durationHours: 72 };
    }
    if (ship.id === 'coandax') {
      // Câteva ore până la Lună cu propulsie cu fuziune și plasmă (inclusiv accelerație/frânare)
      return { distanceKm: 4_500_000, durationHours: 3.0 };
    }
    return {
      distanceKm: moonDistKm,
      durationHours: moonDistKm / ship.speedKmh,
    };
  }

  const rawDistKm = Math.max(rawEuclideanAu * KM_PER_AU_CONST, 2_500);

  if (ship.id === 'vlaicu1') {
    // Pentru racheta chimică Vlaicu-1 (50.000 km/h), folosim lungimea arcului de transfer Hohmann
    // când călătorim de la Pământ (sau din Sistemul Solar interior) către planetele exterioare/interioare
    const fromInnerEarthRegion =
      originId === 'earth' || originId === 'moon' || originId === 'iss' || originId === 'hubble';

    if (fromInnerEarthRegion) {
      if (targetId === 'mars' || targetBody.data.parentId === 'mars') {
        const hours = 7 * 30.4375 * 24; // ~7 luni
        return { distanceKm: hours * ship.speedKmh, durationHours: hours };
      }
      if (targetId === 'jupiter' || targetBody.data.parentId === 'jupiter') {
        const hours = 5.5 * 365.25 * 24; // ~5 ani și 6 luni
        return { distanceKm: hours * ship.speedKmh, durationHours: hours };
      }
      if (targetId === 'saturn' || targetBody.data.parentId === 'saturn') {
        const hours = 7.0 * 365.25 * 24; // ~7 ani
        return { distanceKm: hours * ship.speedKmh, durationHours: hours };
      }
      if (targetId === 'uranus') {
        const hours = 9.5 * 365.25 * 24; // ~9 ani și 6 luni
        return { distanceKm: hours * ship.speedKmh, durationHours: hours };
      }
      if (targetId === 'neptune') {
        const hours = 12.0 * 365.25 * 24; // ~12 ani (ca Voyager 2)
        return { distanceKm: hours * ship.speedKmh, durationHours: hours };
      }
      if (
        targetId === 'pluto' ||
        targetId === 'eris' ||
        targetId === 'haumea' ||
        targetId === 'makemake' ||
        targetId === 'newhorizons'
      ) {
        const hours = 14.5 * 365.25 * 24;
        return { distanceKm: hours * ship.speedKmh, durationHours: hours };
      }
    }

    // Factor general de spirală orbitală Hohmann (1.85x) pentru alte perechi interplanetare
    const hohmannKm = rawDistKm * 1.85;
    return {
      distanceKm: hohmannKm,
      durationHours: hohmannKm / ship.speedKmh,
    };
  }

  // Pentru Coandă-X (1.500.000 km/h) și Luceafărul (1c), zborul urmează traiectoria directă:
  // timpul este exact distanța împărțită la viteza fizică a navei
  return {
    distanceKm: rawDistKm,
    durationHours: rawDistKm / ship.speedKmh,
  };
}

/**
 * SpacecraftPilot gestionează modul First-Person Cockpit ("🚀 La Manșa Navei"):
 * - Atașează PerspectiveCamera la poziția și orientarea 3D a navei spațiale
 * - Permite comutarea în timp real între Vlaicu-1, Coandă-X și Luceafărul
 * - Oferă control dublu: Manual (W/S/A/D/Q/E/Shift + Săgeți + Joystick tactil) și Pilot Automat ("🔥 Zboară Acolo")
 * - Monitorizează continuu distanța heliocentrică în UA pentru activarea Scuturilor Deflectoare în
 *   Centura Principală de Asteroizi (~2.1–3.3 UA) și în Centura Kuiper (~30–50 UA)
 * - Generează efectul 3D de Warp / Star-Streaks și Briefingul de Sosire al Calculatorului de Bord
 */
export class SpacecraftPilot {
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly orbitalEngine: OrbitalEngine;
  private readonly scaleManager: ScaleManager;
  private readonly cameraController: CameraController;

  private active = false;
  private currentShip: SpacecraftSpec = SPACECRAFT_SPECS.vlaicu1;

  // Starea cinematică 3D a navei
  private readonly position = new THREE.Vector3();
  private readonly quaternion = new THREE.Quaternion();
  private readonly velocity = new THREE.Vector3();
  private currentSpeedKmh = 0;
  private prevHeliocentricAu = 1.0;
  private currentHeliocentricAu = 1.0;

  // Ancorare orbitală (station-keeping) lângă ultimul corp vizitat
  private anchoredBody: CelestialBodyInstance | null = null;
  private readonly lastAnchoredBodyPos = new THREE.Vector3();
  private selectedTargetBody: CelestialBodyInstance | null = null;
  private lastOriginBody: CelestialBodyInstance | null = null;

  // Starea Pilotului Automat ("🔥 Zboară Acolo")
  private isAutopilot = false;
  private autopilotTarget: CelestialBodyInstance | null = null;
  private autopilotElapsed = 0;
  private autopilotDuration = 4.6;
  private readonly autopilotStartPos = new THREE.Vector3();
  private readonly autopilotStartQuat = new THREE.Quaternion();
  private autopilotStartHelioAu = new THREE.Vector3();
  private autopilotTotalDistanceKm = 0;
  private autopilotTotalDurationHours = 0;
  private autopilotProgressPrev = 0;

  // Cronometrul Pământului și distanța parcursă
  private earthDate: Date = new Date();
  private totalDistanceTraveledKm = 0;
  private lastTripDurationRo = '0 secunde';
  private lastArrivalReport: ArrivalBriefingReport | null = null;

  // Stare centură (alertele de scuturi sunt dezactivate pentru claritate didactică)
  private activeBeltZone: BeltHazardZone = 'none';
  private shieldActive = false;

  // Controale de la tastatură și joystick tactil
  private readonly pressedKeys: Set<string> = new Set();
  private touchJoystickX = 0; // -1 (stânga) .. +1 (dreapta)
  private touchJoystickY = 0; // -1 (înapoi) .. +1 (înainte)
  private touchRoll = 0; // -1 (Q) .. +1 (E)
  private touchBoost = false;

  // Efect 3D de Warp / Star-Streaks atașat camerei
  private readonly warpTunnelGroup: THREE.Group;
  private readonly warpLinesMaterial: THREE.LineBasicMaterial;
  private readonly warpPositionsAttr: THREE.BufferAttribute;
  private readonly warpBasePoints: Array<{ x: number; y: number; z: number; speed: number }> = [];
  private warpIntensity = 0;

  // Callback-uri către UI (CockpitHUD)
  private readonly beltAlertCallbacks: Set<BeltAlertCallback> = new Set();
  private readonly arrivalCallbacks: Set<ArrivalBriefingCallback> = new Set();
  private readonly modeChangeCallbacks: Set<PilotModeChangeCallback> = new Set();
  private readonly shipChangeCallbacks: Set<ShipChangeCallback> = new Set();

  constructor(
    scene: THREE.Scene,
    camera: THREE.PerspectiveCamera,
    orbitalEngine: OrbitalEngine,
    scaleManager: ScaleManager,
    cameraController: CameraController
  ) {
    this.scene = scene;
    this.camera = camera;
    this.orbitalEngine = orbitalEngine;
    this.scaleManager = scaleManager;
    this.cameraController = cameraController;
    this.earthDate = new Date(this.orbitalEngine.simulationDate.getTime());

    const { group, material, posAttr } = this.createWarpStarStreaksTunnel();
    this.warpTunnelGroup = group;
    this.warpLinesMaterial = material;
    this.warpPositionsAttr = posAttr;
    this.scene.add(this.warpTunnelGroup);

    this.installKeyboardListeners();
  }

  /**
   * Construiește tunelul 3D de linii stelare (Star-Streaks) folosit la Warp și Hyper-Boost.
   */
  private createWarpStarStreaksTunnel(): {
    group: THREE.Group;
    material: THREE.LineBasicMaterial;
    posAttr: THREE.BufferAttribute;
  } {
    const streakCount = 180;
    const positions = new Float32Array(streakCount * 6);

    let seed = 88421;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < streakCount; i++) {
      const angle = nextRand() * Math.PI * 2;
      const radius = 1.6 + nextRand() * 9.5;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius * 0.72;
      const z = -4 - nextRand() * 48;
      const speed = 28 + nextRand() * 42;

      this.warpBasePoints.push({ x, y, z, speed });

      const idx = i * 6;
      positions[idx] = x;
      positions[idx + 1] = y;
      positions[idx + 2] = z;
      positions[idx + 3] = x;
      positions[idx + 4] = y;
      positions[idx + 5] = z - 2.5;
    }

    const geo = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', posAttr);

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color('#00f0ff'),
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const lines = new THREE.LineSegments(geo, material);
    const group = new THREE.Group();
    group.name = 'CockpitWarpStreaksTunnel';
    group.visible = false;
    group.add(lines);

    return { group, material, posAttr };
  }

  private installKeyboardListeners(): void {
    window.addEventListener('keydown', (e) => {
      if (!this.active) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      this.pressedKeys.add(e.code);
      this.pressedKeys.add(e.key.toLowerCase());
    });

    window.addEventListener('keyup', (e) => {
      this.pressedKeys.delete(e.code);
      this.pressedKeys.delete(e.key.toLowerCase());
    });

    window.addEventListener('blur', () => {
      this.pressedKeys.clear();
    });
  }

  public isActive(): boolean {
    return this.active;
  }

  public getCurrentShip(): SpacecraftSpec {
    return this.currentShip;
  }

  public getSelectedTarget(): CelestialBodyInstance | null {
    return this.selectedTargetBody;
  }

  public getAnchoredBody(): CelestialBodyInstance | null {
    return this.anchoredBody;
  }

  public getLastArrivalReport(): ArrivalBriefingReport | null {
    return this.lastArrivalReport;
  }

  public onBeltAlert(cb: BeltAlertCallback): () => void {
    this.beltAlertCallbacks.add(cb);
    return () => this.beltAlertCallbacks.delete(cb);
  }

  public onArrivalBriefing(cb: ArrivalBriefingCallback): () => void {
    this.arrivalCallbacks.add(cb);
    return () => this.arrivalCallbacks.delete(cb);
  }

  public onModeChange(cb: PilotModeChangeCallback): () => void {
    this.modeChangeCallbacks.add(cb);
    return () => this.modeChangeCallbacks.delete(cb);
  }

  public onShipChange(cb: ShipChangeCallback): () => void {
    this.shipChangeCallbacks.add(cb);
    return () => this.shipChangeCallbacks.delete(cb);
  }

  /**
   * Comută modul "🚀 La Manșa Navei (Mod Pilot)" On/Off.
   */
  public togglePilotMode(): boolean {
    this.setPilotMode(!this.active);
    return this.active;
  }

  /**
   * Activează sau dezactivează modul First-Person Cockpit.
   * Dacă la intrare camera se afla în vederea generală (pe Soare), poziționează nava
   * pe orbita Pământului (~1.0 UA) cu vedere spre Marte, Centura de Asteroizi și Jupiter,
   * astfel încât copiii să poată zbura imediat de la Pământ către orice planetă!
   */
  public setPilotMode(enable: boolean): void {
    if (this.active === enable) return;
    this.active = enable;
    this.pressedKeys.clear();

    if (enable) {
      this.cameraController.setEnabled(false);
      this.earthDate = new Date(this.orbitalEngine.simulationDate.getTime());

      const tracked = this.cameraController.getTrackedBody();
      const earth = this.orbitalEngine.getBody('earth');
      const startBody =
        tracked && tracked.data.id !== 'sun' && tracked.data.category !== 'rover'
          ? tracked
          : earth ?? tracked ?? this.orbitalEngine.getBody('sun') ?? null;

      if (startBody) {
        this.stationNearBody(startBody, 'jupiter');
      } else {
        this.position.copy(this.camera.position);
        this.quaternion.copy(this.camera.quaternion);
      }

      const defaultTarget =
        this.orbitalEngine.getBody(startBody?.data.id === 'jupiter' ? 'saturn' : 'jupiter') ??
        this.orbitalEngine.getBody('mars') ??
        null;
      this.selectedTargetBody = defaultTarget;

      this.currentHeliocentricAu = this.scaleManager.unscaleHeliocentricDistanceAu(this.position);
      this.prevHeliocentricAu = this.currentHeliocentricAu;
      this.evaluateBeltProximity(this.currentHeliocentricAu, this.currentHeliocentricAu);
    } else {
      this.isAutopilot = false;
      this.autopilotTarget = null;
      this.warpTunnelGroup.visible = false;
      this.warpIntensity = 0;

      // Restaurăm camera și OrbitControls
      this.camera.fov = 48;
      this.camera.up.set(0, 1, 0);
      this.camera.updateProjectionMatrix();
      this.cameraController.setEnabled(true);

      const resumeBody = this.anchoredBody ?? this.cameraController.getTrackedBody();
      if (resumeBody) {
        this.cameraController.focusBody(resumeBody.data.id);
      } else {
        this.cameraController.resetToOverview();
      }
    }

    for (const cb of this.modeChangeCallbacks) {
      cb(this.active);
    }
  }

  /**
   * Plasează nava la o distanță panoramică lângă un corp ceresc de plecare (ex: Pământ),
   * orientată spre ținta sugerată (ex: Jupiter) astfel încât atât planeta de plecare,
   * cât și Sistemul Solar exterior să fie vizibile prin parbriz.
   */
  public stationNearBody(body: CelestialBodyInstance, lookTowardBodyId?: string): void {
    this.isAutopilot = false;
    this.autopilotTarget = null;
    this.anchoredBody = body;
    this.lastOriginBody = body;
    this.lastAnchoredBodyPos.copy(body.worldPosition);

    const r = Math.max(body.visualRadius, 0.35);
    const viewDist = body.data.id === 'sun' ? Math.max(r * 5.2, 14) : Math.max(r * 4.2, 1.8);

    const lookTargetBody = lookTowardBodyId ? this.orbitalEngine.getBody(lookTowardBodyId) : null;

    if (lookTargetBody && lookTargetBody.data.id !== body.data.id) {
      const dirToTarget = lookTargetBody.worldPosition
        .clone()
        .sub(body.worldPosition)
        .normalize();
      const side = new THREE.Vector3(-dirToTarget.z, 0, dirToTarget.x).normalize();

      // Plasăm nava ușor lateral-spate față de planeta de plecare, privind pe lângă orizontul ei direct spre țintă
      const offset = dirToTarget
        .clone()
        .multiplyScalar(-viewDist * 0.85)
        .addScaledVector(side, viewDist * 0.52)
        .add(new THREE.Vector3(0, viewDist * 0.22, 0));

      this.position.copy(body.worldPosition).add(offset);

      const lookAtPoint = body.worldPosition
        .clone()
        .lerp(lookTargetBody.worldPosition, 0.35);
      const lookMat = new THREE.Matrix4().lookAt(
        this.position,
        lookAtPoint,
        new THREE.Vector3(0, 1, 0)
      );
      this.quaternion.setFromRotationMatrix(lookMat);
    } else {
      const vantageOffset = this.computePanoramicVantageOffset(body);
      this.position.copy(body.worldPosition).add(vantageOffset);
      const lookMat = new THREE.Matrix4().lookAt(
        this.position,
        body.worldPosition,
        new THREE.Vector3(0, 1, 0)
      );
      this.quaternion.setFromRotationMatrix(lookMat);
    }

    this.camera.position.copy(this.position);
    this.camera.quaternion.copy(this.quaternion);
    this.currentHeliocentricAu =
      body.data.id === 'earth'
        ? 1.0
        : this.scaleManager.unscaleHeliocentricDistanceAu(this.position);
    this.prevHeliocentricAu = this.currentHeliocentricAu;
  }

  /**
   * Schimbă în timp real nava spațială activă (Vlaicu-1, Coandă-X sau Luceafărul).
   */
  public selectShip(shipId: SpacecraftId): SpacecraftSpec {
    const spec = SPACECRAFT_SPECS[shipId];
    if (!spec) return this.currentShip;
    this.currentShip = spec;
    this.warpLinesMaterial.color.set(spec.accentColorHex);

    // Dacă există deja un raport de sosire deschis, îl recalculăm pentru noua navă aleasă
    // astfel încât copilul să poată compara instantaneu durata călătoriei!
    if (this.lastArrivalReport && !this.isAutopilot) {
      const updatedReport = this.buildArrivalReport(
        this.lastArrivalReport.body,
        this.lastOriginBody
      );
      this.lastArrivalReport = updatedReport;
      this.lastTripDurationRo = updatedReport.tripDurationFormattedRo;
      for (const cb of this.arrivalCallbacks) {
        cb(updatedReport);
      }
    }

    for (const cb of this.shipChangeCallbacks) {
      cb(spec);
    }
    return this.currentShip;
  }

  /**
   * Selectează o țintă pe parbrizul AR (fără a porni încă motoarele, sau pregătind butonul "🔥 Zboară Acolo").
   */
  public setSelectedTarget(bodyId: string | null): CelestialBodyInstance | null {
    if (!bodyId) {
      this.selectedTargetBody = null;
      return null;
    }
    const body = this.orbitalEngine.getBody(bodyId) ?? null;
    this.selectedTargetBody = body;
    return body;
  }

  /**
   * Setează input-ul de la joystick-ul tactil și butoanele virtuale pentru tablete.
   */
  public setTouchControls(input: {
    joystickX?: number;
    joystickY?: number;
    roll?: number;
    boost?: boolean;
  }): void {
    if (input.joystickX !== undefined) {
      this.touchJoystickX = Math.max(-1, Math.min(1, input.joystickX));
    }
    if (input.joystickY !== undefined) {
      this.touchJoystickY = Math.max(-1, Math.min(1, input.joystickY));
    }
    if (input.roll !== undefined) {
      this.touchRoll = Math.max(-1, Math.min(1, input.roll));
    }
    if (input.boost !== undefined) {
      this.touchBoost = input.boost;
    }
  }

  /**
   * Activează Pilotul Automat ("🔥 Zboară Acolo") către corpul ceresc ales:
   * - Orientează lin nava spre destinație
   * - Activează efectul de warp / star-streaks timp de ~4.6 secunde
   * - Avansează rapid ceasul Pământului conform vitezei navei alese
   * - Traversează fizic spațiul heliocentric (declanșând Scuturile Deflectoare la 2.1–3.3 UA sau 30–50 UA)
   * - Oprește lin la o distanță panoramică ideală în fața planetei și deschide Calculatorul de Bord
   */
  public engageAutopilot(targetBodyId?: string): boolean {
    const resolvedId = targetBodyId ?? this.selectedTargetBody?.data.id;
    if (!resolvedId) return false;

    const targetBody = this.orbitalEngine.getBody(resolvedId);
    if (!targetBody) return false;

    if (!this.active) {
      this.setPilotMode(true);
    }

    // Dacă ținta aparține altui Orizont Cosmic, comutăm automat orizontul și activăm propulsia hiperspațială pe Luceafărul
    const targetHorizon = targetBody.data.horizon ?? 'solar';
    if (this.orbitalEngine.getActiveHorizon() !== targetHorizon) {
      this.orbitalEngine.setActiveHorizon(targetHorizon);
    }
    if (targetHorizon !== 'solar' && this.currentShip.id !== 'luceafarul') {
      this.selectShip('luceafarul');
    }

    this.selectedTargetBody = targetBody;
    this.lastOriginBody = this.anchoredBody ?? this.findClosestBody();
    this.anchoredBody = null;

    this.isAutopilot = true;
    this.autopilotTarget = targetBody;
    this.autopilotElapsed = 0;
    this.autopilotDuration = 4.6;
    this.autopilotProgressPrev = 0;

    this.autopilotStartPos.copy(this.position);
    this.autopilotStartQuat.copy(this.quaternion);

    const startHelioAu =
      this.lastOriginBody &&
      this.position.distanceTo(this.lastOriginBody.worldPosition) <
        Math.max(this.lastOriginBody.visualRadius * 8, 6)
        ? this.lastOriginBody.heliocentricAu.clone()
        : this.scaleManager.unscaleHeliocentricPosition(this.position);
    this.autopilotStartHelioAu.copy(startHelioAu);

    const rawDistAu = startHelioAu.distanceTo(targetBody.heliocentricAu);
    const { distanceKm, durationHours } = computeCalibratedFlightMetrics(
      this.lastOriginBody,
      targetBody,
      rawDistAu,
      this.currentShip
    );

    this.autopilotTotalDistanceKm = distanceKm;
    this.autopilotTotalDurationHours = durationHours;

    return true;
  }

  /**
   * Calculează poziția panoramică de oprire în fața emisferei iluminate a corpului țintă.
   */
  private computePanoramicVantageOffset(target: CelestialBodyInstance): THREE.Vector3 {
    const r = Math.max(target.visualRadius, 0.35);
    const parent = target.data.parentId
      ? this.orbitalEngine.getBody(target.data.parentId)
      : undefined;

    if (target.data.category === 'rover' && parent) {
      const normal = target.worldPosition.clone().sub(parent.worldPosition);
      if (normal.lengthSq() < 0.00001) normal.set(0, 0.4, 1);
      normal.normalize();
      return normal.multiplyScalar(Math.max(parent.visualRadius * 1.55, 0.006));
    }

    const viewDist =
      target.data.id === 'sun'
        ? Math.max(r * 5.2, 14)
        : Math.max(r * 4.2, 0.005);

    const sunToBody = target.worldPosition.clone();
    if (sunToBody.lengthSq() < 0.0001) {
      sunToBody.set(0, 0.3, 1).normalize();
    } else {
      sunToBody.normalize();
    }

    const sideVec = new THREE.Vector3(-sunToBody.z, 0, sunToBody.x).normalize();
    const viewDir = sunToBody
      .clone()
      .multiplyScalar(-0.62)
      .addScaledVector(sideVec, 0.68)
      .add(new THREE.Vector3(0, 0.28, 0))
      .normalize();

    return viewDir.multiplyScalar(viewDist);
  }

  /**
   * Actualizează fizica navei, camera First-Person, detectorul de centuri de asteroizi și efectul de Warp.
   */
  public update(deltaSeconds: number): void {
    if (!this.active) return;

    const dt = Math.min(Math.max(deltaSeconds, 0.001), 0.25);
    this.prevHeliocentricAu = this.currentHeliocentricAu;

    if (this.isAutopilot && this.autopilotTarget) {
      this.updateAutopilotFlight(deltaSeconds);
    } else {
      this.updateManualFlight(dt);
    }

    // Sincronizăm camera First-Person cu poziția și orientarea navei
    this.camera.position.copy(this.position);
    this.camera.quaternion.copy(this.quaternion);

    // Actualizăm poziția și animația tunelului 3D de Warp / Star-Streaks
    this.updateWarpTunnelEffect(dt);
  }

  /**
   * Gestionează zborul pe Pilot Automat cu interpolare cilindrică heliocentrică,
   * garantând traversarea lină a centurilor de asteroizi și avansarea ceasului Pământului.
   */
  private updateAutopilotFlight(rawDeltaSeconds: number): void {
    const target = this.autopilotTarget;
    if (!target) return;

    this.autopilotElapsed += Math.max(rawDeltaSeconds, 0.016);
    const t = Math.min(1, this.autopilotElapsed / this.autopilotDuration);

    // Curba S-curve smoothstep pentru deplasarea spațială
    const travelT = t <= 0.12 ? 0 : t >= 0.92 ? 1 : (t - 0.12) / 0.8;
    const smoothProgress = travelT * travelT * (3 - 2 * travelT);
    const deltaProgress = Math.max(0, smoothProgress - this.autopilotProgressPrev);
    this.autopilotProgressPrev = smoothProgress;

    const vantageOffset = this.computePanoramicVantageOffset(target);
    const endPos = target.worldPosition.clone().add(vantageOffset);

    // Interpolăm raza heliocentrică în UA și direcția unghiulară pentru o traiectorie interplanetară curbată natural
    const startR = this.autopilotStartPos.length();
    const endR = endPos.length();

    if (startR > 4 && endR > 4) {
      const startAngle = Math.atan2(this.autopilotStartPos.z, this.autopilotStartPos.x);
      const endAngle = Math.atan2(endPos.z, endPos.x);
      let deltaAngle = endAngle - startAngle;
      while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
      while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;

      const curAngle = startAngle + deltaAngle * smoothProgress;
      const curR = THREE.MathUtils.lerp(startR, endR, smoothProgress);
      const curY = THREE.MathUtils.lerp(this.autopilotStartPos.y, endPos.y, smoothProgress);

      const radialPos = new THREE.Vector3(
        Math.cos(curAngle) * curR,
        curY,
        Math.sin(curAngle) * curR
      );
      // La apropierea de destinație, fuzionăm exact în punctul panoramic endPos
      this.position.copy(radialPos).lerp(endPos, smoothProgress * smoothProgress);
    } else {
      this.position.lerpVectors(this.autopilotStartPos, endPos, smoothProgress);
    }

    // Orientăm lin nava spre planeta țintă
    const lookTarget = target.worldPosition;
    const desiredLookMat = new THREE.Matrix4().lookAt(
      this.position,
      lookTarget,
      new THREE.Vector3(0, 1, 0)
    );
    const desiredQuat = new THREE.Quaternion().setFromRotationMatrix(desiredLookMat);
    const rotBlend = Math.min(1, t / 0.22);
    this.quaternion.copy(this.autopilotStartQuat).slerp(desiredQuat, rotBlend);

    // Avansăm ceasul Pământului și contorul de kilometri proporțional cu progresul zborului
    const stepKm = this.autopilotTotalDistanceKm * deltaProgress;
    const stepHours = this.autopilotTotalDurationHours * deltaProgress;
    this.totalDistanceTraveledKm += stepKm;
    this.earthDate = new Date(this.earthDate.getTime() + stepHours * 3600 * 1000);

    // Vitezometrul afișează viteza nominală a navei în timpul croazierei warp
    const speedEnvelope = Math.sin(Math.min(1, Math.max(0.05, t)) * Math.PI);
    this.currentSpeedKmh = Math.max(
      this.currentShip.speedKmh * 0.15,
      this.currentShip.speedKmh * (0.45 + 0.55 * speedEnvelope)
    );
    this.warpIntensity = Math.sin(t * Math.PI);

    // Calculăm distanța heliocentrică în UA și verificăm traversarea Centurii de Asteroizi / Centurii Kuiper
    const startAu = this.autopilotStartHelioAu.length();
    const targetAu = target.heliocentricAu.length();
    const interpolatedAu = THREE.MathUtils.lerp(startAu, targetAu, smoothProgress);
    const sceneAu = this.scaleManager.unscaleHeliocentricDistanceAu(this.position);
    this.currentHeliocentricAu = sceneAu > 0.05 ? sceneAu : interpolatedAu;

    this.evaluateBeltProximity(this.prevHeliocentricAu, this.currentHeliocentricAu);

    // La finalizarea zborului (t >= 1), oprim lin în fața planetei și deschidem Calculatorul de Bord
    if (t >= 1) {
      this.position.copy(endPos);
      this.quaternion.copy(desiredQuat);
      this.isAutopilot = false;
      this.autopilotTarget = null;
      this.currentSpeedKmh = 0;
      this.warpIntensity = 0;

      this.anchoredBody = target;
      this.lastAnchoredBodyPos.copy(target.worldPosition);

      const report = this.buildArrivalReport(
        target,
        this.lastOriginBody,
        this.autopilotTotalDistanceKm,
        this.autopilotTotalDurationHours
      );
      this.lastArrivalReport = report;
      this.lastTripDurationRo = report.tripDurationFormattedRo;

      for (const cb of this.arrivalCallbacks) {
        cb(report);
      }
    }
  }

  /**
   * Gestionează zborul manual (W/S/A/D/Q/E/Shift + Săgeți + Joystick tactil) și station-keeping-ul orbital.
   */
  private updateManualFlight(dt: number): void {
    const forwardInput =
      (this.isKeyPressed('KeyW', 'w', 'ArrowUp') ? 1 : 0) -
      (this.isKeyPressed('KeyS', 's', 'ArrowDown') ? 1 : 0) +
      this.touchJoystickY;
    const yawInput =
      (this.isKeyPressed('KeyA', 'a', 'ArrowLeft') ? 1 : 0) -
      (this.isKeyPressed('KeyD', 'd', 'ArrowRight') ? 1 : 0) -
      this.touchJoystickX;
    const rollInput =
      (this.isKeyPressed('KeyQ', 'q') ? 1 : 0) -
      (this.isKeyPressed('KeyE', 'e') ? 1 : 0) +
      this.touchRoll;
    const pitchInput =
      (this.isKeyPressed('KeyR', 'r') ? 1 : 0) -
      (this.isKeyPressed('KeyF', 'f') ? 1 : 0);
    const isBoosting =
      this.isKeyPressed('ShiftLeft', 'ShiftRight', 'shift') || this.touchBoost;

    const clampedForward = Math.max(-1, Math.min(1, forwardInput));
    const clampedYaw = Math.max(-1, Math.min(1, yawInput));
    const clampedRoll = Math.max(-1, Math.min(1, rollInput));
    const clampedPitch = Math.max(-1, Math.min(1, pitchInput));

    const hasPilotInput =
      Math.abs(clampedForward) > 0.02 ||
      Math.abs(clampedYaw) > 0.02 ||
      Math.abs(clampedRoll) > 0.02 ||
      Math.abs(clampedPitch) > 0.02;

    // Dacă nava este oprită lângă o planetă și pilotul nu apasă comenzile de propulsie,
    // menținem nava sincronizată cu mișcarea orbitală a planetei
    if (this.anchoredBody && Math.abs(clampedForward) < 0.02) {
      const orbitalDelta = this.anchoredBody.worldPosition
        .clone()
        .sub(this.lastAnchoredBodyPos);
      this.position.add(orbitalDelta);
      this.lastAnchoredBodyPos.copy(this.anchoredBody.worldPosition);
    } else if (Math.abs(clampedForward) >= 0.02) {
      this.anchoredBody = null;
    }

    // Rotații locale ale navei (Yaw, Pitch, Roll)
    if (hasPilotInput) {
      const yawAngle = clampedYaw * 1.35 * dt;
      const pitchAngle = clampedPitch * 0.95 * dt;
      const rollAngle = clampedRoll * 1.55 * dt;

      const deltaEuler = new THREE.Euler(pitchAngle, yawAngle, rollAngle, 'YXZ');
      const deltaQuat = new THREE.Quaternion().setFromEuler(deltaEuler);
      this.quaternion.multiply(deltaQuat).normalize();
    }

    // Accelerație și deplasare pe direcția înainte (-Z în spațiul camerei)
    const forwardDir = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quaternion).normalize();
    const boostFactor = isBoosting ? this.currentShip.boostMultiplier : 1.0;
    const targetSceneSpeed =
      clampedForward * this.currentShip.manualSceneSpeed * boostFactor;

    const desiredVel = forwardDir.multiplyScalar(targetSceneSpeed);
    const damping = 1 - Math.exp(-6.5 * dt);
    this.velocity.lerp(desiredVel, damping);

    const prevPos = this.position.clone();
    if (this.velocity.lengthSq() > 0.0001) {
      this.position.addScaledVector(this.velocity, dt);
    }

    // Calculăm distanța parcursă în UA / km și avansăm data pe Pământ
    const prevAuVec = this.scaleManager.unscaleHeliocentricPosition(prevPos);
    const currAuVec = this.scaleManager.unscaleHeliocentricPosition(this.position);
    const stepAu = prevAuVec.distanceTo(currAuVec);
    const stepKm = stepAu * KM_PER_AU_CONST;

    if (stepKm > 1 && Math.abs(clampedForward) > 0.01) {
      this.totalDistanceTraveledKm += stepKm;
      const stepHours = stepKm / this.currentShip.speedKmh;
      this.earthDate = new Date(this.earthDate.getTime() + stepHours * 3600 * 1000);
    }

    const speedRatio = Math.min(
      1,
      this.velocity.length() / Math.max(1, this.currentShip.manualSceneSpeed)
    );
    this.currentSpeedKmh =
      speedRatio < 0.02 ? 0 : Math.round(this.currentShip.speedKmh * Math.min(1, speedRatio));
    this.warpIntensity = isBoosting && Math.abs(clampedForward) > 0.1 ? 0.85 : 0;

    this.currentHeliocentricAu = currAuVec.length();
    this.evaluateBeltProximity(this.prevHeliocentricAu, this.currentHeliocentricAu);
  }

  /**
   * Alertele pentru scuturi deflectoare în Centura de Asteroizi / Centura Kuiper sunt dezactivate
   * pentru a nu întrerupe sau deruta copiii în timpul zborului spre planete.
   */
  private evaluateBeltProximity(_prevAu: number, _currAu: number): void {
    this.activeBeltZone = 'none';
    this.shieldActive = false;
  }

  /**
   * Animează liniile stelare 3D (Star-Streaks) în jurul parbrizului în timpul Warp-ului sau Hyper-Boost-ului.
   */
  private updateWarpTunnelEffect(dt: number): void {
    if (this.warpIntensity <= 0.02) {
      this.warpTunnelGroup.visible = false;
      if (Math.abs(this.camera.fov - 52) > 0.2) {
        this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, 52, 0.15);
        this.camera.updateProjectionMatrix();
      }
      return;
    }

    this.warpTunnelGroup.visible = true;
    this.warpTunnelGroup.position.copy(this.camera.position);
    this.warpTunnelGroup.quaternion.copy(this.camera.quaternion);

    this.warpLinesMaterial.opacity = Math.min(0.88, this.warpIntensity * 0.9);
    this.warpLinesMaterial.color.set(this.currentShip.accentColorHex);

    const targetFov = 52 + this.warpIntensity * 12;
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 0.18);
    this.camera.updateProjectionMatrix();

    const arr = this.warpPositionsAttr.array as Float32Array;
    const streakLen = 2.2 + this.warpIntensity * 7.5;

    for (let i = 0; i < this.warpBasePoints.length; i++) {
      const pt = this.warpBasePoints[i];
      pt.z += pt.speed * (0.6 + this.warpIntensity * 1.8) * dt;
      if (pt.z > -1.5) {
        pt.z = -48 - (i % 7);
      }

      const idx = i * 6;
      arr[idx] = pt.x;
      arr[idx + 1] = pt.y;
      arr[idx + 2] = pt.z;
      arr[idx + 3] = pt.x;
      arr[idx + 4] = pt.y;
      arr[idx + 5] = pt.z - streakLen;
    }
    this.warpPositionsAttr.needsUpdate = true;
  }

  /**
   * Construiește raportul complet al Calculatorului de Bord la sosirea lângă un corp ceresc.
   */
  public buildArrivalReport(
    targetBody: CelestialBodyInstance,
    originBody: CelestialBodyInstance | null,
    overrideDistanceKm?: number,
    overrideDurationHours?: number
  ): ArrivalBriefingReport {
    const d = targetBody.data;
    const ship = this.currentShip;
    const earthBody = this.orbitalEngine.getBody('earth');

    const startAuVec = originBody
      ? originBody.heliocentricAu
      : earthBody
      ? earthBody.heliocentricAu
      : new THREE.Vector3(1, 0, 0);
    const rawDistAu = startAuVec.distanceTo(targetBody.heliocentricAu);

    const calibrated = computeCalibratedFlightMetrics(originBody, targetBody, rawDistAu, ship);
    const distanceKm = overrideDistanceKm ?? calibrated.distanceKm;
    const durationHours = overrideDurationHours ?? calibrated.durationHours;
    const tripDurationFormattedRo = formatDidacticTripDurationRo(durationHours);

    // Dacă recalculăm la schimbarea navei, actualizăm și anul de sosire raportat la data simulării
    const baseDate = this.orbitalEngine.simulationDate;
    const arrivalDate =
      overrideDurationHours !== undefined
        ? new Date(this.earthDate.getTime())
        : new Date(baseDate.getTime() + durationHours * 3600 * 1000);
    if (overrideDurationHours === undefined) {
      this.earthDate = arrivalDate;
    }
    const earthYearCalculated = arrivalDate.getFullYear();

    const sunDistAu = targetBody.distanceFromSunAu;
    const sunDistMilKm = (sunDistAu * 149.5978707).toFixed(1).replace('.', ',');
    const sunDistAuStr = sunDistAu.toFixed(2).replace('.', ',');

    const earthDistAu = earthBody
      ? targetBody.heliocentricAu.distanceTo(earthBody.heliocentricAu)
      : Math.abs(sunDistAu - 1.0);
    const earthDistMilKm =
      d.id === 'earth'
        ? '0 (Chiar acasă!)'
        : earthDistAu < 0.01
        ? `${(earthDistAu * 149.5978707).toFixed(2).replace('.', ',')} (${Math.round(
            earthDistAu * KM_PER_AU_CONST
          ).toLocaleString('ro-RO')} km)`
        : (earthDistAu * 149.5978707).toFixed(1).replace('.', ',');

    const subtitleClean =
      d.subtitle.length > 0
        ? d.subtitle.charAt(0).toLowerCase() + d.subtitle.slice(1)
        : d.subtitle;

    const isDeepSpace = Boolean(d.distanceLightYears && d.distanceLightYears > 0);
    const lyValue = d.distanceLightYears ?? 0;
    const lyLabel =
      d.distanceLightYearsLabelRo ??
      `${lyValue.toLocaleString('ro-RO')} ani-lumină`;

    const currentCalendarYear = this.orbitalEngine.simulationDate.getFullYear();
    const departureYear = Math.round(currentCalendarYear - lyValue);
    const departureYearLabelRo =
      departureYear > 0
        ? `anul ${departureYear} d.Hr.`
        : `anul ${Math.abs(departureYear)} î.Hr.`;
    const destinationNameRo = formatDestinationNameRo(d);
    const historicalLightNote =
      d.lightDepartureHistoryRo ??
      `Lumina pe care o vedem azi de la ${destinationNameRo} a plecat spre Pământ acum ${lyLabel}, în ${departureYearLabelRo}!`;

    const shipDisplayPropulsion =
      isDeepSpace && ship.id === 'luceafarul'
        ? `${ship.shortNameRo} cu ⚡ Motor Hiperspațial (Salt în Ani-Lumină)`
        : ship.shortNameRo;

    const headlineRo = `Am ajuns la ${destinationNameRo}! Privim ${subtitleClean} chiar prin parbrizul navei ${shipDisplayPropulsion}.`;
    const temperatureLineRo = `🌡️ Temperatura caracteristică: ${d.meanTempC} °C`;
    const distancesLineRo = isDeepSpace
      ? `✨ Distanța față de Pământ și Sistemul Solar: ${lyLabel} (~${(lyValue * 9460.73).toLocaleString('ro-RO', { maximumFractionDigits: 0 })} miliarde km)`
      : `☀️ Distanța față de Soare: ${sunDistMilKm} milioane km (${sunDistAuStr} UA) | 🌍 Distanța față de Pământ: ${earthDistMilKm} milioane km`;
    const earthClockLineRo = isDeepSpace
      ? `⏳ Mașina Timpului cu Viteza Luminii: ${historicalLightNote}`
      : `⏳ Cronometrul Pământului: Călătoria cu nava ${ship.shortNameRo} a durat ${tripDurationFormattedRo}. Pe Pământ a trecut acest timp și acum este anul ${earthYearCalculated}!`;
    const observationLineRo = `💡 Observație de la bord: ${d.junior.funFact}`;

    const fullSpeechTextRo = isDeepSpace
      ? `${headlineRo} Distanța față de Pământ este de ${lyLabel}. ${historicalLightNote} Observație de la bord: ${d.junior.funFact}`
      : `${headlineRo} Temperatura afară este de ${d.meanTempC} grade Celsius. Distanța față de Soare este de ${sunDistMilKm} milioane de kilometri, adică ${sunDistAuStr} unități astronomice. Călătoria cu nava ${ship.shortNameRo} a durat ${tripDurationFormattedRo}. Pe Pământ a trecut acest timp și acum este anul ${earthYearCalculated}! Observație de la bord: ${d.junior.funFact}`;

    return {
      body: targetBody,
      ship,
      originBodyId: originBody?.data.id ?? 'earth',
      originBodyNameRo: originBody ? formatDestinationNameRo(originBody.data) : 'planeta Pământ',
      distanceTraveledKm: distanceKm,
      tripDurationHours: durationHours,
      tripDurationFormattedRo,
      earthDateOnArrival: arrivalDate,
      earthYearCalculated,
      temperatureC: d.meanTempC,
      distanceFromSunMilKm: sunDistMilKm,
      distanceFromSunAuStr: sunDistAuStr,
      distanceFromEarthMilKm: earthDistMilKm,
      headlineRo,
      temperatureLineRo,
      distancesLineRo,
      earthClockLineRo,
      observationLineRo,
      fullSpeechTextRo,
    };
  }

  private findClosestBody(): CelestialBodyInstance | null {
    let closest: CelestialBodyInstance | null = null;
    let minDist = Infinity;
    for (const body of this.orbitalEngine.getBodies()) {
      if (body.data.category === 'rover') continue;
      const dist = this.position.distanceTo(body.worldPosition);
      if (dist < minDist) {
        minDist = dist;
        closest = body;
      }
    }
    return closest;
  }

  private isKeyPressed(...keys: string[]): boolean {
    for (const k of keys) {
      if (this.pressedKeys.has(k)) return true;
    }
    return false;
  }

  public getTelemetry(): PilotTelemetryState {
    const isBoosting =
      this.isKeyPressed('ShiftLeft', 'ShiftRight', 'shift') || this.touchBoost;
    const currentLightPercent = (this.currentSpeedKmh / SPEED_OF_LIGHT_KMH) * 100;
    const autopilotProgress = this.isAutopilot
      ? Math.min(1, this.autopilotElapsed / Math.max(0.1, this.autopilotDuration))
      : 0;

    return {
      active: this.active,
      ship: this.currentShip,
      currentSpeedKmh: this.currentSpeedKmh,
      currentLightPercent,
      isAutopilot: this.isAutopilot,
      isBoosting,
      autopilotTarget: this.autopilotTarget,
      autopilotProgress,
      anchoredBody: this.anchoredBody,
      selectedTargetBody: this.selectedTargetBody,
      heliocentricDistanceAu: this.currentHeliocentricAu,
      activeBeltZone: this.activeBeltZone,
      shieldActive: this.shieldActive,
      earthDate: this.earthDate,
      totalDistanceTraveledKm: this.totalDistanceTraveledKm,
      lastTripDurationRo: this.lastTripDurationRo,
    };
  }

  public getPosition(): THREE.Vector3 {
    return this.position;
  }
}

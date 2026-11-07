// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import {
  BeltConfig,
  CelestialBodyData,
  CelestialCategory,
  CosmicHorizon,
  DeepSpaceDataset,
  KeplerianElements,
  MissionsDataset,
  SolarSystemDataset,
} from '../types/celestial';
import { ScaleManager } from './ScaleManager';
import { InstancedBeltEntry, ProceduralModels } from './ProceduralModels';
import { ISSTracker } from './ISSTracker';
import { PlanetMaterialFactory } from './PlanetMaterialFactory';
import { QualityMode } from './QualityManager';

export interface CelestialBodyInstance {
  data: CelestialBodyData;
  /** Alias compatibil cu interfața inițială */
  meta: CelestialBodyData & { nameRo: string; categoryNameRo: string };
  astroBody: Astronomy.Body | null;
  rootGroup: THREE.Group;
  visualRoot: THREE.Object3D;
  hitMesh: THREE.Mesh;
  orbitLine: THREE.LineLoop | null;
  heliocentricAu: THREE.Vector3;
  worldPosition: THREE.Vector3;
  distanceFromSunAu: number;
  visualRadius: number;
  updateShaderTime?: (elapsed: number, simDaysDelta?: number) => void;
}

const J2000_OBLIQUITY_RAD = (23.4392911 * Math.PI) / 180;
const COS_OBL = Math.cos(J2000_OBLIQUITY_RAD);
const SIN_OBL = Math.sin(J2000_OBLIQUITY_RAD);
const J2000_EPOCH_MS = Date.UTC(2000, 0, 1, 12, 0, 0);

export const ORBIT_CATEGORY_COLORS: Record<CelestialCategory, string> = {
  star: '#ffb703',
  terrestrial: '#00f0ff',
  gas_giant: '#ffb703',
  ice_giant: '#38bdf8',
  dwarf: '#c084fc',
  moon: '#94a3b8',
  asteroid: '#a8a29e',
  station: '#22c55e',
  telescope: '#22c55e',
  probe: '#22c55e',
  rover: '#f97316',
  oort_cloud: '#38bdf8',
  exoplanet: '#fb7185',
  star_cluster: '#38bdf8',
  nebula: '#e879f9',
  black_hole: '#ff9e00',
  galaxy: '#c084fc',
};

export const CATEGORY_LABELS_RO: Record<CelestialCategory, string> = {
  star: 'Stea',
  terrestrial: 'Planetă Telurică',
  gas_giant: 'Gigant Gazos',
  ice_giant: 'Gigant de Gheață',
  dwarf: 'Planetă Pitică',
  moon: 'Satelit Natural',
  asteroid: 'Asteroid',
  station: 'Stație Spațială',
  telescope: 'Telescop Spațial',
  probe: 'Sondă Interplanetară',
  rover: 'Rover Planetar',
  oort_cloud: 'Granița Sistemului Solar',
  exoplanet: 'Sistem Exoplanetar',
  star_cluster: 'Roi Stelar Deschis',
  nebula: 'Nebuloasă / Maternitate Stelară',
  black_hole: 'Gaură Neagră Supermasivă',
  galaxy: 'Galaxie Spirală',
};

const ASTRO_BODY_MAP: Record<string, Astronomy.Body> = {
  sun: Astronomy.Body.Sun,
  mercury: Astronomy.Body.Mercury,
  venus: Astronomy.Body.Venus,
  earth: Astronomy.Body.Earth,
  moon: Astronomy.Body.Moon,
  mars: Astronomy.Body.Mars,
  jupiter: Astronomy.Body.Jupiter,
  saturn: Astronomy.Body.Saturn,
  uranus: Astronomy.Body.Uranus,
  neptune: Astronomy.Body.Neptune,
  pluto: Astronomy.Body.Pluto,
};

/**
 * Culoare orbitale radiale calibrate strict pentru „Scara Didactică” (în UA echivalente),
 * astfel încât sferele mărite ale planetelor, inelele, sateliții lor naturali/artificiali,
 * planetele pitice, asteroizii și sondele să nu se intersecteze niciodată vizual.
 * În „Scara Reală” sunt folosite exclusiv coordonatele și excentricitățile fizice exacte.
 */
const DIDACTIC_ORBIT_AU: Record<string, number> = {
  parker: 0.12,
  mercury: 0.26,
  venus: 0.46,
  apophis: 0.60,
  earth: 1.0,
  bennu: 1.46,
  mars: 1.88,
  vesta: 2.36,
  ceres: 2.66,
  pallas: 2.96,
  psyche: 3.26,
  juice: 3.60,
  rosetta: 3.96,
  jupiter: 5.45,
  saturn: 9.582,
  uranus: 19.218,
  neptune: 30.11,
  pluto: 36.5,
  haumea: 41.2,
  makemake: 45.8,
  newhorizons: 50.5,
  voyager2: 55.5,
  voyager1: 61.0,
  eris: 67.86,
};

/**
 * OrbitalEngine încarcă bazele de date didactice statice (`solar-system-ro.json`, `missions-ro.json` și `deep-space-ro.json`),
 * calculează pozițiile 3D reale ale planetelor, sateliților, planetelor pitice, asteroizilor, misiunilor și obiectelor
 * din Cosmosul Îndepărtat (Stele, Exoplanete, Nebuloase, Găuri Negre, Galaxii) pe 3 Orizonturi Cosmice.
 */
export class OrbitalEngine {
  public simulationDate: Date;
  public timeScale: number = 60;
  public isPaused: boolean = false;
  public readonly issTracker: ISSTracker;

  private readonly scene: THREE.Scene;
  private readonly scaleManager: ScaleManager;
  private readonly bodies: Map<string, CelestialBodyInstance> = new Map();
  private allBodiesCache: CelestialBodyInstance[] = [];
  private readonly horizonBodiesCache: Map<CosmicHorizon, CelestialBodyInstance[]> = new Map();
  private readonly raycastTargetsCache: THREE.Object3D[] = [];
  private readonly belts: InstancedBeltEntry[] = [];
  private beltConfigs: BeltConfig[] = [];
  private elapsedShaderTime = 0;
  private activeHorizon: CosmicHorizon = 'solar';

  // Cache per-timestamp pentru sateliții galileeni ai lui Jupiter (evită 4 calcule identice per cadru)
  private cachedJupiterMoonsTimeMs = Number.NaN;
  private cachedJupiterMoons: ReturnType<typeof Astronomy.JupiterMoons> | null = null;
  private readonly tempSurfacePin = new THREE.Vector3();
  private readonly tempDir = new THREE.Vector3();
  private readonly tempPosAu = new THREE.Vector3();
  private readonly tempAdjustedAu = new THREE.Vector3();
  private readonly tempScaledPos = new THREE.Vector3();
  private readonly tempOffsetAu = new THREE.Vector3();
  private readonly tempScaledOffset = new THREE.Vector3();

  private readonly bodiesGroup: THREE.Group;
  private readonly orbitsGroup: THREE.Group;
  private readonly beltsGroup: THREE.Group;
  private readonly interstellarGroup: THREE.Group;
  private readonly galacticGroup: THREE.Group;

  constructor(scene: THREE.Scene, scaleManager: ScaleManager, initialDate: Date = new Date()) {
    this.scene = scene;
    this.scaleManager = scaleManager;
    this.simulationDate = new Date(initialDate.getTime());
    this.issTracker = new ISSTracker();

    this.bodiesGroup = new THREE.Group();
    this.bodiesGroup.name = 'CelestialBodiesGroup';
    this.scene.add(this.bodiesGroup);

    this.orbitsGroup = new THREE.Group();
    this.orbitsGroup.name = 'OrbitalEllipsesGroup';
    this.scene.add(this.orbitsGroup);

    this.beltsGroup = new THREE.Group();
    this.beltsGroup.name = 'InstancedBeltsGroup';
    this.scene.add(this.beltsGroup);

    this.interstellarGroup = new THREE.Group();
    this.interstellarGroup.name = 'InterstellarHorizonGroup';
    this.interstellarGroup.visible = false;
    this.scene.add(this.interstellarGroup);

    this.galacticGroup = new THREE.Group();
    this.galacticGroup.name = 'GalacticHorizonGroup';
    this.galacticGroup.visible = false;
    this.scene.add(this.galacticGroup);

    this.scaleManager.onChange(() => {
      this.rebuildScaleAndOrbits();
    });
  }

  public async initialize(): Promise<void> {
    const [solarRes, missionsRes, deepSpaceRes] = await Promise.all([
      fetch('./data/solar-system-ro.json'),
      fetch('./data/missions-ro.json'),
      fetch('./data/deep-space-ro.json').catch(() => null),
    ]);
    // TLE-urile SGP4 au propriul fallback intern (set încorporat în ISSTracker), deci le așteptăm separat
    await this.issTracker.initialize();

    const solarDataset = (await solarRes.json()) as SolarSystemDataset;
    const missionsDataset = (await missionsRes.json()) as MissionsDataset;
    let deepSpaceObjects: CelestialBodyData[] = [];
    if (deepSpaceRes && deepSpaceRes.ok) {
      const ds = (await deepSpaceRes.json()) as DeepSpaceDataset;
      deepSpaceObjects = ds.objects ?? [];
    }

    this.beltConfigs = solarDataset.belts ?? [];
    const allItems: CelestialBodyData[] = [
      ...(solarDataset.bodies ?? []),
      ...(missionsDataset.missions ?? []),
      ...deepSpaceObjects,
    ];

    const hitSphereGeo = new THREE.SphereGeometry(1, 16, 12);

    for (const data of allItems) {
      const astroBody = ASTRO_BODY_MAP[data.id] ?? null;
      const rootGroup = new THREE.Group();
      rootGroup.name = `Body_${data.id}`;
      rootGroup.userData = { bodyId: data.id };

      const { visualRoot, updateShaderTime } = ProceduralModels.createCelestialVisual(data);
      visualRoot.name = `Visual_${data.id}`;
      if (data.axialTiltDeg !== undefined) {
        visualRoot.rotation.z = THREE.MathUtils.degToRad(data.axialTiltDeg);
      }

      // Propagăm bodyId pe toate sub-mesh-urile vizuale pentru raycasting direct
      visualRoot.traverse((obj) => {
        obj.userData = { ...obj.userData, bodyId: data.id };
      });
      rootGroup.add(visualRoot);

      // Sferă de selecție invizibilă generoasă
      const hitMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const hitMesh = new THREE.Mesh(hitSphereGeo, hitMat);
      hitMesh.name = `Hit_${data.id}`;
      hitMesh.userData = { bodyId: data.id };
      rootGroup.add(hitMesh);

      const itemHorizon = data.horizon ?? 'solar';
      if (itemHorizon === 'interstellar') {
        this.interstellarGroup.add(rootGroup);
      } else if (itemHorizon === 'galactic') {
        this.galacticGroup.add(rootGroup);
      } else {
        this.bodiesGroup.add(rootGroup);
      }

      const metaCompat = {
        ...data,
        nameRo: data.name,
        categoryNameRo: CATEGORY_LABELS_RO[data.category] ?? data.subtitle,
      };

      const instance: CelestialBodyInstance = {
        data,
        meta: metaCompat,
        astroBody,
        rootGroup,
        visualRoot,
        hitMesh,
        orbitLine: null,
        heliocentricAu: new THREE.Vector3(),
        worldPosition: new THREE.Vector3(),
        distanceFromSunAu: data.distanceFromSunAU,
        visualRadius: 1,
        updateShaderTime,
      };

      this.bodies.set(data.id, instance);
    }

    this.rebuildBodyCaches();

    // Construim Centura de Asteroizi și Centura Kuiper cu THREE.InstancedMesh
    for (const beltCfg of this.beltConfigs) {
      const beltEntry = ProceduralModels.createInstancedBelt(beltCfg, this.scaleManager);
      this.belts.push(beltEntry);
      this.beltsGroup.add(beltEntry.mesh);
    }

    // Adăugăm Câmpul Profund de Galaxii și Nebuloase („Deep Field”) în Orizontul Galactic
    const galacticDeepField = ProceduralModels.createGalacticDeepField();
    this.galacticGroup.add(galacticDeepField);

    this.rebuildScaleAndOrbits();
    this.updatePositions(0);
    this.syncRealAxialRotations(this.simulationDate);
    this.updatePositions(0);
  }

  /**
   * Sincronizează simularea cu momentul astronomic real prezent (`new Date()`),
   * setează viteza pe Timp Real (`1×`, `timeScale = 1`), recalculează pozițiile
   * heliocentrice și locale ale tuturor planetelor, sateliților și sondelor și
   * aliniază faza de rotație axială reală a corpurilor cerești.
   */
  public syncToRealTimeNow(now: Date = new Date()): void {
    this.simulationDate = new Date(now.getTime());
    this.timeScale = 1;
    this.isPaused = false;
    this.updatePositions(0);
    this.syncRealAxialRotations(this.simulationDate);
    this.updatePositions(0);
  }

  /**
   * Aliniază unghiul de rotație axială (`visualRoot.rotation.y`) al planetelor și sateliților
   * la data astronomică dată (pentru Pământ, aliniază longitudinea sub-solară UTC astfel încât
   * emisfera de zi și emisfera de noapte cu luminile orașelor să corespundă orei reale).
   */
  public syncRealAxialRotations(date: Date = this.simulationDate): void {
    const hoursSinceJ2000 = (date.getTime() - J2000_EPOCH_MS) / 3600000;
    const utcHours =
      date.getUTCHours() +
      date.getUTCMinutes() / 60 +
      date.getUTCSeconds() / 3600 +
      date.getUTCMilliseconds() / 3600000;

    for (const instance of this.bodies.values()) {
      const rawHours = instance.data.dayLengthHours;
      if (!rawHours || rawHours === 0) continue;

      if (instance.data.id === 'earth') {
        const subSolarLonRad = ((12 - utcHours) * Math.PI) / 12;
        const sunAngleRad = Math.atan2(instance.worldPosition.z, -instance.worldPosition.x);
        instance.visualRoot.rotation.y = sunAngleRad - subSolarLonRad;
        continue;
      }

      const dir = rawHours >= 0 ? 1 : -1;
      const turns = hoursSinceJ2000 / Math.abs(rawHours);
      const fracTurns = turns - Math.floor(turns);
      instance.visualRoot.rotation.y = dir * fracTurns * Math.PI * 2;
    }
  }

  /**
   * Comută instantaneu în timp real între Modul Eco (`eco`) și Modul Realist HD (`hd`),
   * eliberând memoria VRAM pentru texturile 2K la trecerea în `eco` și păstrând poziția
   * camerei și corpul ceresc selectat.
   */
  public applyQualityMode(mode: QualityMode): void {
    PlanetMaterialFactory.setQualityMode(mode);

    for (const instance of this.bodies.values()) {
      const modelType = instance.data.modelType ?? 'sphere';
      if (modelType === 'rover') continue;

      const prevRotY = instance.visualRoot.rotation.y;
      const prevRotZ = instance.visualRoot.rotation.z;

      // Păstrăm pinii de suprafață (SurfaceMarkers) atașați de visualRoot
      const preservedMarkers: THREE.Object3D[] = [];
      for (const child of instance.visualRoot.children) {
        if (child.userData?.markerId) {
          preservedMarkers.push(child);
        }
      }
      for (const markerObj of preservedMarkers) {
        instance.visualRoot.remove(markerObj);
      }

      // Eliberăm materialele vechiului visualRoot
      instance.visualRoot.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m) => {
              m.dispose();
            });
          } else if (obj.material instanceof THREE.Material) {
            obj.material.dispose();
          }
        }
      });
      instance.rootGroup.remove(instance.visualRoot);

      const { visualRoot, updateShaderTime } = ProceduralModels.createCelestialVisual(
        instance.data,
        mode
      );
      visualRoot.name = `Visual_${instance.data.id}`;
      visualRoot.rotation.y = prevRotY;
      visualRoot.rotation.z = prevRotZ;
      visualRoot.scale.setScalar(instance.visualRadius);

      visualRoot.traverse((obj) => {
        obj.userData = { ...obj.userData, bodyId: instance.data.id };
      });

      for (const markerObj of preservedMarkers) {
        visualRoot.add(markerObj);
      }

      instance.visualRoot = visualRoot;
      instance.updateShaderTime = updateShaderTime;
      instance.rootGroup.add(visualRoot);
    }

    for (const beltEntry of this.belts) {
      ProceduralModels.updateInstancedBeltTransforms(beltEntry, this.scaleManager, mode);
    }
  }

  public eqjToThreeEclipticAu(
    vec: { x: number; y: number; z: number },
    target: THREE.Vector3 = new THREE.Vector3()
  ): THREE.Vector3 {
    const xEcl = vec.x;
    const yEcl = vec.y * COS_OBL + vec.z * SIN_OBL;
    const zEcl = -vec.y * SIN_OBL + vec.z * COS_OBL;
    return target.set(xEcl, zEcl, -yEcl);
  }

  /**
   * Calculează poziția heliocentrică 3D (în UA) din elemente kepleriene pentru planete pitice,
   * asteroizi și sonde interplanetare.
   */
  public keplerianToHeliocentricAu(
    kep: KeplerianElements,
    orbitPeriodDays: number,
    date: Date,
    target: THREE.Vector3 = new THREE.Vector3()
  ): THREE.Vector3 {
    const daysSinceJ2000 = (date.getTime() - J2000_EPOCH_MS) / 86400000;
    const nDegPerDay = orbitPeriodDays > 0 ? 360 / orbitPeriodDays : 0.9856 / Math.pow(kep.semiMajorAxisAU, 1.5);
    const M = THREE.MathUtils.degToRad((kep.meanAnomalyDeg + nDegPerDay * daysSinceJ2000) % 360);
    const e = kep.eccentricity;

    // Rezolvăm ecuația lui Kepler E - e*sin(E) = M (4 iterații Newton-Raphson)
    let E = M;
    for (let k = 0; k < 4; k++) {
      E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    }

    const xv = kep.semiMajorAxisAU * (Math.cos(E) - e);
    const yv = kep.semiMajorAxisAU * Math.sqrt(Math.max(0, 1 - e * e)) * Math.sin(E);

    const v = Math.atan2(yv, xv);
    const r = Math.hypot(xv, yv);

    const iRad = THREE.MathUtils.degToRad(kep.inclinationDeg);
    const omegaRad = THREE.MathUtils.degToRad(kep.ascendingNodeDeg);
    const wRad = THREE.MathUtils.degToRad(kep.argPerihelionDeg);
    const u = v + wRad;

    const xEcl =
      r * (Math.cos(omegaRad) * Math.cos(u) - Math.sin(omegaRad) * Math.sin(u) * Math.cos(iRad));
    const yEcl =
      r * (Math.sin(omegaRad) * Math.cos(u) + Math.cos(omegaRad) * Math.sin(u) * Math.cos(iRad));
    const zEcl = r * (Math.sin(u) * Math.sin(iRad));

    return target.set(xEcl, zEcl, -yEcl);
  }

  /**
   * Calculează vectorul local (în UA) al unui satelit natural, stații spațiale sau rover față de planeta-mamă.
   */
  private computeLocalChildOffsetAu(
    instance: CelestialBodyInstance,
    date: Date,
    target: THREE.Vector3 = new THREE.Vector3()
  ): THREE.Vector3 {
    const id = instance.data.id;

    if (id === 'moon') {
      const geoMoon = Astronomy.GeoMoon(date);
      return this.eqjToThreeEclipticAu(geoMoon, target);
    }

    if (id === 'io' || id === 'europa' || id === 'ganymede' || id === 'callisto') {
      const timeMs = date.getTime();
      if (this.cachedJupiterMoonsTimeMs !== timeMs || !this.cachedJupiterMoons) {
        this.cachedJupiterMoonsTimeMs = timeMs;
        this.cachedJupiterMoons = Astronomy.JupiterMoons(date);
      }
      const state = this.cachedJupiterMoons[id];
      return this.eqjToThreeEclipticAu(state, target);
    }

    // Calcul orbital SGP4 100% offline prin satellite.js (ISSTracker) pentru ISS și Hubble
    if (id === 'iss' || id === 'hubble') {
      return this.issTracker.getOffsetFromEarthAu(id, date, target);
    }

    // Telescoapele din punctul Lagrange L2 Soare–Pământ (JWST și Euclid, la ~1,5 milioane km = 0,01 UA de Pământ)
    if (id === 'jwst' || id === 'euclid') {
      const days = (date.getTime() - J2000_EPOCH_MS) / 86400000;
      const phase = id === 'jwst' ? 0.4 : 2.5;
      const angle = ((days / 182.62) * Math.PI * 2 + phase) % (Math.PI * 2);
      const radiusAu = id === 'jwst' ? 0.01 : 0.0108;
      const incl = id === 'jwst' ? 0.22 : -0.26;
      return target.set(
        Math.cos(angle) * radiusAu,
        Math.sin(angle) * Math.sin(incl) * radiusAu,
        -Math.sin(angle) * radiusAu
      );
    }

    // Pentru lunile lui Marte, Saturn, Uranus, Neptun, Pluto și roverele marțiene
    const rawPeriod = instance.data.orbitPeriodDays || 1;
    const orbitDir = rawPeriod < 0 ? -1 : 1;
    const periodDays = Math.max(Math.abs(rawPeriod), 0.05);
    const order = instance.data.localOrbitOrder ?? 1;
    const days = (date.getTime() - J2000_EPOCH_MS) / 86400000;
    const angle = orbitDir * (((days / periodDays) * Math.PI * 2 + order * 1.7) % (Math.PI * 2));

    if (instance.data.category === 'rover') {
      // Roverele se rotesc odată cu suprafața lui Marte
      const lat = order === 1 ? 0.32 : -0.15;
      return target
        .set(
          Math.cos(angle) * Math.cos(lat),
          Math.sin(lat),
          Math.sin(angle) * Math.cos(lat)
        )
        .multiplyScalar(0.000023);
    }

    const incl = id === 'triton' ? -0.35 : id === 'iapetus' ? 0.24 : order % 2 === 1 ? 0.08 : -0.14;
    const moonSemiMajorAu: Record<string, number> = {
      phobos: 0.0000627,
      deimos: 0.0001568,
      mimas: 0.00124,
      enceladus: 0.00159,
      titan: 0.00817,
      iapetus: 0.0238,
      miranda: 0.000868,
      titania: 0.00291,
      triton: 0.00237,
      charon: 0.000131,
    };
    const radiusAu =
      moonSemiMajorAu[id] ??
      (instance.data.parentId === 'saturn' ? 0.0016 * order * 2.5 : 0.000045 * order);

    return target.set(
      Math.cos(angle) * radiusAu,
      Math.sin(angle) * Math.sin(incl) * radiusAu,
      -Math.sin(angle) * radiusAu
    );
  }

  public rebuildScaleAndOrbits(): void {
    for (const instance of this.bodies.values()) {
      const visualRadius = this.scaleManager.scaleRadius(
        instance.data.radiusKm,
        instance.data.category
      );
      instance.visualRadius = visualRadius;
      instance.visualRoot.scale.setScalar(visualRadius);

      const hitRadius = this.scaleManager.getHitSphereRadius(visualRadius, instance.data.category);
      instance.hitMesh.scale.setScalar(hitRadius);
    }

    // Actualizăm centurile de asteroizi InstancedMesh
    for (const beltEntry of this.belts) {
      ProceduralModels.updateInstancedBeltTransforms(beltEntry, this.scaleManager);
    }

    // Reconstruim elipsele orbitale
    while (this.orbitsGroup.children.length > 0) {
      const child = this.orbitsGroup.children[0];
      this.orbitsGroup.remove(child);
      if (child instanceof THREE.Line) {
        child.geometry.dispose();
        if (child.material instanceof THREE.Material) {
          child.material.dispose();
        }
      }
    }

    for (const instance of this.bodies.values()) {
      const itemHorizon = instance.data.horizon ?? 'solar';
      if (
        itemHorizon !== 'solar' ||
        instance.data.id === 'sun' ||
        instance.data.category === 'rover'
      ) {
        instance.orbitLine = null;
        continue;
      }

      const orbitLine = this.buildOrbitEllipse(instance);
      instance.orbitLine = orbitLine;
      this.orbitsGroup.add(orbitLine);
    }

    this.updatePositions(0);
  }

  /**
   * În „Scara Didactică”, regularizează raza heliocentrică pe culoarul dedicat fiecărui corp
   * (păstrând neschimbate direcția 3D, faza orbitală și înclinația ecliptică), astfel încât
   * orbitele excentrice și sistemele de sateliți să nu treacă niciodată unele prin altele.
   * În „Scara Reală” returnează vectorul astronomic nemodificat.
   */
  private adjustDidacticHelioAu(
    instance: CelestialBodyInstance,
    rawPosAu: THREE.Vector3,
    target: THREE.Vector3 = new THREE.Vector3()
  ): THREE.Vector3 {
    const rawLenSq = rawPosAu.lengthSq();
    if (this.scaleManager.getMode() === 'real' || rawLenSq === 0) {
      return target.copy(rawPosAu);
    }
    const targetAu = DIDACTIC_ORBIT_AU[instance.data.id] ?? instance.data.distanceFromSunAU;
    if (!targetAu || targetAu <= 0) {
      return target.copy(rawPosAu);
    }
    const rawLen = Math.sqrt(rawLenSq);
    const nominalAu =
      instance.data.keplerian?.semiMajorAxisAU ||
      instance.data.distanceFromSunAU ||
      rawLen;
    const rawRatio = nominalAu > 0 ? rawLen / nominalAu : 1;
    const dampedRatio = 1 + THREE.MathUtils.clamp(rawRatio - 1, -0.012, 0.012);
    return target.copy(rawPosAu).multiplyScalar((targetAu * dampedRatio) / rawLen);
  }

  private buildOrbitEllipse(instance: CelestialBodyInstance): THREE.LineLoop {
    const samples = instance.data.parentId ? 96 : 180;
    const points: THREE.Vector3[] = [];
    const baseTimeMs = this.simulationDate.getTime();

    if (instance.data.parentId) {
      const parent = this.bodies.get(instance.data.parentId);
      const parentRadius = parent ? parent.visualRadius : 2.0;
      const periodDays = Math.max(Math.abs(instance.data.orbitPeriodDays), 0.05);

      for (let i = 0; i < samples; i++) {
        const tDate = new Date(baseTimeMs + (i / samples) * periodDays * 86400000);
        const offsetAu = this.computeLocalChildOffsetAu(instance, tDate);
        const scaledOffset = this.scaleManager.scaleLocalChildOffset(
          offsetAu,
          parentRadius,
          instance.data.localOrbitOrder ?? 1,
          instance.data.category
        );
        points.push(scaledOffset);
      }
    } else if (instance.astroBody) {
      const periodDays = Astronomy.PlanetOrbitalPeriod(instance.astroBody);
      for (let i = 0; i < samples; i++) {
        const tDate = new Date(baseTimeMs + (i / samples) * periodDays * 86400000);
        const helioVec = Astronomy.HelioVector(instance.astroBody, tDate);
        const posAu = this.eqjToThreeEclipticAu(helioVec);
        const adjustedAu = this.adjustDidacticHelioAu(instance, posAu);
        points.push(this.scaleManager.scaleHeliocentricPosition(adjustedAu));
      }
    } else if (instance.data.keplerian) {
      const periodDays = Math.max(instance.data.orbitPeriodDays, 80);
      for (let i = 0; i < samples; i++) {
        const tDate = new Date(baseTimeMs + (i / samples) * periodDays * 86400000);
        const posAu = this.keplerianToHeliocentricAu(
          instance.data.keplerian,
          periodDays,
          tDate
        );
        const adjustedAu = this.adjustDidacticHelioAu(instance, posAu);
        points.push(this.scaleManager.scaleHeliocentricPosition(adjustedAu));
      }
    }

    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const orbitHex =
      instance.data.orbitColor ||
      ORBIT_CATEGORY_COLORS[instance.data.category] ||
      '#00f0ff';

    const material = new THREE.LineBasicMaterial({
      color: new THREE.Color(orbitHex),
      transparent: true,
      opacity: instance.data.parentId ? 0.5 : 0.62,
    });

    const lineLoop = new THREE.LineLoop(geometry, material);
    lineLoop.name = `Orbit_${instance.data.id}`;
    lineLoop.userData = { bodyId: instance.data.id };
    return lineLoop;
  }

  public updatePositions(deltaSeconds: number): void {
    this.elapsedShaderTime += deltaSeconds;
    const simDaysDelta =
      !this.isPaused && deltaSeconds > 0 ? (deltaSeconds * this.timeScale) / 86400 : 0;

    if (!this.isPaused && deltaSeconds > 0) {
      const deltaSimMs = deltaSeconds * this.timeScale * 1000;
      this.simulationDate.setTime(this.simulationDate.getTime() + deltaSimMs);
    }

    // Rotim centurile de asteroizi proporțional cu timpul simulat
    if (!this.isPaused && deltaSeconds > 0) {
      const beltStep = Math.min(deltaSeconds * 0.008, simDaysDelta * 0.004);
      this.beltsGroup.rotation.y += beltStep;
    }

    const astroTime =
      this.activeHorizon === 'solar' ? Astronomy.MakeTime(this.simulationDate) : null;
    const bodyList = this.getBodiesForHorizon(this.activeHorizon);

    // 1. Actualizăm corpurile principale heliocentrice (fără parentId) din orizontul activ
    for (const instance of bodyList) {
      if (instance.updateShaderTime) {
        instance.updateShaderTime(this.elapsedShaderTime, simDaysDelta);
      }

      if (instance.data.parentId) continue;

      if (instance.data.deepSpacePosition) {
        const [dx, dy, dz] = instance.data.deepSpacePosition;
        instance.worldPosition.set(dx, dy, dz);
        instance.rootGroup.position.set(dx, dy, dz);
        const distAu = instance.data.distanceFromSunAU || 63241;
        if (instance.worldPosition.lengthSq() > 0.001) {
          this.tempDir.copy(instance.worldPosition).normalize();
        } else {
          this.tempDir.set(1, 0, 0);
        }
        instance.heliocentricAu.copy(this.tempDir.multiplyScalar(distAu));
        instance.distanceFromSunAu = distAu;
        continue;
      }

      if (instance.data.id === 'sun') {
        instance.heliocentricAu.set(0, 0, 0);
        instance.worldPosition.set(0, 0, 0);
        instance.distanceFromSunAu = 0;
        instance.rootGroup.position.set(0, 0, 0);
      } else if (instance.astroBody && astroTime) {
        const helio = Astronomy.HelioVector(instance.astroBody, astroTime);
        const posAu = this.eqjToThreeEclipticAu(helio, this.tempPosAu);
        instance.heliocentricAu.copy(posAu);
        instance.distanceFromSunAu = posAu.length();

        const adjustedAu = this.adjustDidacticHelioAu(instance, posAu, this.tempAdjustedAu);
        const scaledPos = this.scaleManager.scaleHeliocentricPosition(
          adjustedAu,
          this.tempScaledPos
        );
        instance.worldPosition.copy(scaledPos);
        instance.rootGroup.position.copy(scaledPos);
      } else if (instance.data.keplerian) {
        const posAu = this.keplerianToHeliocentricAu(
          instance.data.keplerian,
          instance.data.orbitPeriodDays,
          this.simulationDate,
          this.tempPosAu
        );
        instance.heliocentricAu.copy(posAu);
        instance.distanceFromSunAu = instance.data.distanceFromSunAU || posAu.length();

        const adjustedAu = this.adjustDidacticHelioAu(instance, posAu, this.tempAdjustedAu);
        const scaledPos = this.scaleManager.scaleHeliocentricPosition(
          adjustedAu,
          this.tempScaledPos
        );
        instance.worldPosition.copy(scaledPos);
        instance.rootGroup.position.copy(scaledPos);
      }

      this.applyAxialRotation(instance, deltaSeconds);
    }

    // 2. Actualizăm sateliții, stațiile orbitale și roverele atașate de o planetă-mamă (parentId)
    for (const instance of bodyList) {
      if (!instance.data.parentId) continue;

      const parent = this.bodies.get(instance.data.parentId);
      if (!parent) continue;

      if (instance.data.category === 'rover') {
        // Roverele marțiene sunt ancorate ca pinpoint-uri direct pe suprafața rotitoare a lui Marte
        // la coordonatele reale de amartizare (Craterul Jezero 18.38°N 77.58°E / Craterul Gale -4.58°S 137.44°E)
        const latDeg = instance.data.id === 'perseverance' ? 18.38 : -4.58;
        const lonDeg = instance.data.id === 'perseverance' ? 77.58 : 137.44;
        const latRad = THREE.MathUtils.degToRad(latDeg);
        const lonRad = THREE.MathUtils.degToRad(lonDeg);
        this.tempSurfacePin
          .set(
            Math.cos(latRad) * Math.cos(lonRad),
            Math.sin(latRad),
            -Math.cos(latRad) * Math.sin(lonRad)
          )
          .multiplyScalar(1.03);

        parent.visualRoot.updateWorldMatrix(true, false);
        instance.worldPosition.copy(this.tempSurfacePin).applyMatrix4(parent.visualRoot.matrixWorld);
        instance.rootGroup.position.copy(instance.worldPosition);
        instance.heliocentricAu.copy(parent.heliocentricAu);
        instance.distanceFromSunAu = parent.distanceFromSunAu;
        continue;
      }

      const offsetAu = this.computeLocalChildOffsetAu(
        instance,
        this.simulationDate,
        this.tempOffsetAu
      );
      instance.heliocentricAu.copy(parent.heliocentricAu).add(offsetAu);
      instance.distanceFromSunAu =
        instance.data.id === 'jwst' || instance.data.id === 'euclid'
          ? parent.distanceFromSunAu + 0.01
          : parent.distanceFromSunAu;

      const scaledOffset = this.scaleManager.scaleLocalChildOffset(
        offsetAu,
        parent.visualRadius,
        instance.data.localOrbitOrder ?? 1,
        instance.data.category,
        this.tempScaledOffset
      );

      instance.worldPosition.copy(parent.worldPosition).add(scaledOffset);
      instance.rootGroup.position.copy(instance.worldPosition);

      if (instance.orbitLine) {
        instance.orbitLine.position.copy(parent.worldPosition);
      }

      this.applyAxialRotation(instance, deltaSeconds);
    }
  }

  /**
   * Rotește corpul ceresc în jurul axei sale la viteza unghiulară fizică reală
   * dictată de durata zilei siderale (`dayLengthHours`) și de multiplicatorul de timp (`timeScale`):
   *   ω = (2π) / (dayLengthHours * 3600) radiani / secundă simulată.
   * În modul „Timp Real” (`timeScale = 1`), Pământul efectuează o rotație completă în 23h 56m 04s,
   * Jupiter în 9h 55m, Marte în 24h 37m, iar Venus se rotește retrograd în 243 de zile.
   */
  private applyAxialRotation(instance: CelestialBodyInstance, deltaSeconds: number): void {
    if (this.isPaused || deltaSeconds <= 0) return;
    const rawHours = instance.data.dayLengthHours;
    if (!rawHours || rawHours === 0) return;

    const dir = rawHours >= 0 ? 1 : -1;
    const periodSeconds = Math.abs(rawHours) * 3600;
    const deltaSimSeconds = deltaSeconds * this.timeScale;
    const physicalDeltaRad = dir * ((Math.PI * 2) / periodSeconds) * deltaSimSeconds;

    // Plafonăm doar pasul vizual per cadru la viteze extreme (ex: 30 zile/sec) pentru a evita efectul stroboscopic
    const maxStepRad = deltaSeconds * 4.2;
    const clampedDeltaRad =
      Math.abs(physicalDeltaRad) > maxStepRad
        ? Math.sign(physicalDeltaRad) * maxStepRad
        : physicalDeltaRad;

    instance.visualRoot.rotation.y += clampedDeltaRad;
  }

  private rebuildBodyCaches(): void {
    this.allBodiesCache = Array.from(this.bodies.values());
    this.horizonBodiesCache.clear();
    for (const h of ['solar', 'interstellar', 'galactic'] as const) {
      const list: CelestialBodyInstance[] = [];
      for (const instance of this.allBodiesCache) {
        if ((instance.data.horizon ?? 'solar') === h) {
          list.push(instance);
        }
      }
      this.horizonBodiesCache.set(h, list);
    }
  }

  public getBodies(): CelestialBodyInstance[] {
    return this.getBodiesForHorizon(this.activeHorizon);
  }

  public getAllBodies(): CelestialBodyInstance[] {
    if (this.allBodiesCache.length !== this.bodies.size) {
      this.rebuildBodyCaches();
    }
    return this.allBodiesCache;
  }

  public getBodiesForHorizon(horizon: CosmicHorizon): CelestialBodyInstance[] {
    if (this.allBodiesCache.length !== this.bodies.size) {
      this.rebuildBodyCaches();
    }
    return this.horizonBodiesCache.get(horizon) ?? [];
  }

  public getActiveHorizon(): CosmicHorizon {
    return this.activeHorizon;
  }

  public setActiveHorizon(horizon: CosmicHorizon): void {
    this.activeHorizon = horizon;
    const isSolar = horizon === 'solar';
    this.bodiesGroup.visible = isSolar;
    this.orbitsGroup.visible = isSolar;
    this.beltsGroup.visible = isSolar;
    this.interstellarGroup.visible = horizon === 'interstellar';
    this.galacticGroup.visible = horizon === 'galactic';
  }

  public getHorizonGroup(horizon: CosmicHorizon): THREE.Group {
    if (horizon === 'interstellar') return this.interstellarGroup;
    if (horizon === 'galactic') return this.galacticGroup;
    return this.bodiesGroup;
  }

  public getHomeSolarWorldPosition(horizon: CosmicHorizon = this.activeHorizon): THREE.Vector3 {
    if (horizon === 'galactic') {
      // Poziția Soarelui în Brațul Orion al Căii Lactee (la 26.000 ani-lumină de centru)
      return new THREE.Vector3(16.1, 1.4, 6.3);
    }
    return new THREE.Vector3(0, 0, 0);
  }

  public getBody(id: string): CelestialBodyInstance | undefined {
    return this.bodies.get(id);
  }

  public getBeltConfigs(): BeltConfig[] {
    return this.beltConfigs;
  }

  /**
   * Filtrează vizibilitatea corpurilor și a orbitelor în funcție de stratul selectat în Header HUD.
   */
  public setCategoryVisibility(predicate: (cat: CelestialCategory, id: string) => boolean): void {
    const missionsActive = predicate('rover', 'perseverance');
    for (const instance of this.bodies.values()) {
      const itemHorizon = instance.data.horizon ?? 'solar';
      if (itemHorizon !== 'solar') {
        instance.rootGroup.visible = true;
        continue;
      }
      // Soarele rămâne mereu vizibil, iar Marte/Pământul rămân vizibile când explorăm roverele și stațiile
      const isHostPlanetForMission =
        missionsActive && (instance.data.id === 'mars' || instance.data.id === 'earth');
      const visible =
        instance.data.id === 'sun' ||
        isHostPlanetForMission ||
        predicate(instance.data.category, instance.data.id);
      instance.rootGroup.visible = visible;
      if (instance.orbitLine) {
        instance.orbitLine.visible = visible;
      }
    }
  }

  public getRaycastTargets(): THREE.Object3D[] {
    this.raycastTargetsCache.length = 0;
    for (const instance of this.getBodiesForHorizon(this.activeHorizon)) {
      if (!instance.rootGroup.visible) continue;
      this.raycastTargetsCache.push(instance.hitMesh);
    }
    return this.raycastTargetsCache;
  }
}

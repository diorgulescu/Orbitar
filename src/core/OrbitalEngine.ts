// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import * as Astronomy from 'astronomy-engine';
import {
  BeltConfig,
  CelestialBodyData,
  CelestialCategory,
  KeplerianElements,
  MissionsDataset,
  SolarSystemDataset,
} from '../types/celestial';
import { ScaleManager } from './ScaleManager';
import { InstancedBeltEntry, ProceduralModels } from './ProceduralModels';
import { ISSTracker } from './ISSTracker';

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
  updateShaderTime?: (elapsed: number) => void;
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
 * OrbitalEngine încarcă bazele de date didactice statice (`solar-system-ro.json` și `missions-ro.json`),
 * calculează pozițiile 3D reale ale planetelor, sateliților, planetelor pitice, asteroizilor și misiunilor
 * și randează elipsele orbitale pe categorii + centurile de asteroizi cu `THREE.InstancedMesh`.
 */
export class OrbitalEngine {
  public simulationDate: Date;
  public timeScale: number = 86400;
  public isPaused: boolean = false;
  public readonly issTracker: ISSTracker;

  private readonly scene: THREE.Scene;
  private readonly scaleManager: ScaleManager;
  private readonly bodies: Map<string, CelestialBodyInstance> = new Map();
  private readonly belts: InstancedBeltEntry[] = [];
  private beltConfigs: BeltConfig[] = [];
  private elapsedShaderTime = 0;

  private readonly bodiesGroup: THREE.Group;
  private readonly orbitsGroup: THREE.Group;
  private readonly beltsGroup: THREE.Group;

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

    this.scaleManager.onChange(() => {
      this.rebuildScaleAndOrbits();
    });
  }

  public async initialize(): Promise<void> {
    const [solarRes, missionsRes] = await Promise.all([
      fetch('./data/solar-system-ro.json'),
      fetch('./data/missions-ro.json'),
      this.issTracker.initialize(),
    ]);

    const solarDataset = (await solarRes.json()) as SolarSystemDataset;
    const missionsDataset = (await missionsRes.json()) as MissionsDataset;

    this.beltConfigs = solarDataset.belts ?? [];
    const allItems: CelestialBodyData[] = [
      ...(solarDataset.bodies ?? []),
      ...(missionsDataset.missions ?? []),
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

      this.bodiesGroup.add(rootGroup);

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

    // Construim Centura de Asteroizi și Centura Kuiper cu THREE.InstancedMesh
    for (const beltCfg of this.beltConfigs) {
      const beltEntry = ProceduralModels.createInstancedBelt(beltCfg, this.scaleManager);
      this.belts.push(beltEntry);
      this.beltsGroup.add(beltEntry.mesh);
    }

    this.rebuildScaleAndOrbits();
    this.updatePositions(0);
  }

  public eqjToThreeEclipticAu(vec: { x: number; y: number; z: number }): THREE.Vector3 {
    const xEcl = vec.x;
    const yEcl = vec.y * COS_OBL + vec.z * SIN_OBL;
    const zEcl = -vec.y * SIN_OBL + vec.z * COS_OBL;
    return new THREE.Vector3(xEcl, zEcl, -yEcl);
  }

  /**
   * Calculează poziția heliocentrică 3D (în UA) din elemente kepleriene pentru planete pitice,
   * asteroizi și sonde interplanetare.
   */
  public keplerianToHeliocentricAu(
    kep: KeplerianElements,
    orbitPeriodDays: number,
    date: Date
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

    return new THREE.Vector3(xEcl, zEcl, -yEcl);
  }

  /**
   * Calculează vectorul local (în UA) al unui satelit natural, stații spațiale sau rover față de planeta-mamă.
   */
  private computeLocalChildOffsetAu(instance: CelestialBodyInstance, date: Date): THREE.Vector3 {
    const id = instance.data.id;

    if (id === 'moon') {
      const geoMoon = Astronomy.GeoMoon(date);
      return this.eqjToThreeEclipticAu(geoMoon);
    }

    if (id === 'io' || id === 'europa' || id === 'ganymede' || id === 'callisto') {
      const jMoons = Astronomy.JupiterMoons(date);
      const state = jMoons[id];
      return this.eqjToThreeEclipticAu(state);
    }

    // Calcul orbital SGP4 100% offline prin satellite.js (ISSTracker) pentru ISS și Hubble
    if (id === 'iss' || id === 'hubble') {
      return this.issTracker.getOffsetFromEarthAu(id, date);
    }

    // Pentru Titan, Enceladus, ISS, Hubble și roverele marțiene
    const periodDays = Math.max(instance.data.orbitPeriodDays, 0.05);
    const order = instance.data.localOrbitOrder ?? 1;
    const days = (date.getTime() - J2000_EPOCH_MS) / 86400000;
    const angle = ((days / periodDays) * Math.PI * 2 + order * 1.7) % (Math.PI * 2);

    if (instance.data.category === 'rover') {
      // Roverele se rotesc odată cu suprafața lui Marte
      const lat = order === 1 ? 0.32 : -0.15;
      return new THREE.Vector3(
        Math.cos(angle) * Math.cos(lat),
        Math.sin(lat),
        Math.sin(angle) * Math.cos(lat)
      ).multiplyScalar(0.000023);
    }

    const incl = order === 1 ? 0.08 : -0.16;
    const radiusAu =
      instance.data.parentId === 'saturn'
        ? 0.0016 * order * 2.5
        : 0.000045 * order;

    return new THREE.Vector3(
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
      if (instance.data.id === 'sun' || instance.data.category === 'rover') {
        instance.orbitLine = null;
        continue;
      }

      const orbitLine = this.buildOrbitEllipse(instance);
      instance.orbitLine = orbitLine;
      this.orbitsGroup.add(orbitLine);
    }

    this.updatePositions(0);
  }

  private buildOrbitEllipse(instance: CelestialBodyInstance): THREE.LineLoop {
    const samples = instance.data.parentId ? 96 : 180;
    const points: THREE.Vector3[] = [];
    const baseTimeMs = this.simulationDate.getTime();

    if (instance.data.parentId) {
      const parent = this.bodies.get(instance.data.parentId);
      const parentRadius = parent ? parent.visualRadius : 2.0;
      const periodDays = Math.max(instance.data.orbitPeriodDays, 0.05);

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
        points.push(this.scaleManager.scaleHeliocentricPosition(posAu));
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
        points.push(this.scaleManager.scaleHeliocentricPosition(posAu));
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

    if (!this.isPaused && deltaSeconds > 0) {
      const deltaSimMs = deltaSeconds * this.timeScale * 1000;
      this.simulationDate = new Date(this.simulationDate.getTime() + deltaSimMs);
    }

    // Rotim foarte fin centurile de asteroizi
    if (!this.isPaused && deltaSeconds > 0) {
      this.beltsGroup.rotation.y += deltaSeconds * 0.008;
    }

    // 1. Actualizăm corpurile principale heliocentrice (fără parentId)
    for (const instance of this.bodies.values()) {
      if (instance.updateShaderTime) {
        instance.updateShaderTime(this.elapsedShaderTime);
      }

      if (instance.data.parentId) continue;

      if (instance.data.id === 'sun') {
        instance.heliocentricAu.set(0, 0, 0);
        instance.worldPosition.set(0, 0, 0);
        instance.distanceFromSunAu = 0;
        instance.rootGroup.position.set(0, 0, 0);
      } else if (instance.astroBody) {
        const helio = Astronomy.HelioVector(instance.astroBody, this.simulationDate);
        const posAu = this.eqjToThreeEclipticAu(helio);
        instance.heliocentricAu.copy(posAu);
        instance.distanceFromSunAu = posAu.length();

        const scaledPos = this.scaleManager.scaleHeliocentricPosition(posAu);
        instance.worldPosition.copy(scaledPos);
        instance.rootGroup.position.copy(scaledPos);
      } else if (instance.data.keplerian) {
        const posAu = this.keplerianToHeliocentricAu(
          instance.data.keplerian,
          instance.data.orbitPeriodDays,
          this.simulationDate
        );
        instance.heliocentricAu.copy(posAu);
        instance.distanceFromSunAu = instance.data.distanceFromSunAU || posAu.length();

        const scaledPos = this.scaleManager.scaleHeliocentricPosition(posAu);
        instance.worldPosition.copy(scaledPos);
        instance.rootGroup.position.copy(scaledPos);
      }

      this.applyAxialRotation(instance, deltaSeconds);
    }

    // 2. Actualizăm sateliții, stațiile orbitale și roverele atașate de o planetă-mamă (parentId)
    for (const instance of this.bodies.values()) {
      if (!instance.data.parentId) continue;

      const parent = this.bodies.get(instance.data.parentId);
      if (!parent) continue;

      const offsetAu = this.computeLocalChildOffsetAu(instance, this.simulationDate);
      instance.heliocentricAu.copy(parent.heliocentricAu).add(offsetAu);
      instance.distanceFromSunAu = parent.distanceFromSunAu;

      const scaledOffset = this.scaleManager.scaleLocalChildOffset(
        offsetAu,
        parent.visualRadius,
        instance.data.localOrbitOrder ?? 1,
        instance.data.category
      );

      instance.worldPosition.copy(parent.worldPosition).add(scaledOffset);
      instance.rootGroup.position.copy(instance.worldPosition);

      if (instance.orbitLine) {
        instance.orbitLine.position.copy(parent.worldPosition);
      }

      this.applyAxialRotation(instance, deltaSeconds);
    }
  }

  private applyAxialRotation(instance: CelestialBodyInstance, deltaSeconds: number): void {
    if (this.isPaused || deltaSeconds <= 0) return;
    const dir = instance.data.dayLengthHours >= 0 ? 1 : -1;
    const visualSpinRate = dir * Math.min(Math.max(Math.abs(this.timeScale) / 86400, 0.15), 2.5);
    instance.visualRoot.rotation.y += deltaSeconds * 0.42 * visualSpinRate;
  }

  public getBodies(): CelestialBodyInstance[] {
    return Array.from(this.bodies.values());
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
    for (const instance of this.bodies.values()) {
      // Soarele rămâne mereu vizibil ca reper central și sursă de lumină
      const visible = instance.data.id === 'sun' || predicate(instance.data.category, instance.data.id);
      instance.rootGroup.visible = visible;
      if (instance.orbitLine) {
        instance.orbitLine.visible = visible;
      }
    }
  }

  public getRaycastTargets(): THREE.Object3D[] {
    const targets: THREE.Object3D[] = [];
    for (const instance of this.bodies.values()) {
      if (!instance.rootGroup.visible) continue;
      targets.push(instance.hitMesh, instance.visualRoot);
    }
    return targets;
  }
}

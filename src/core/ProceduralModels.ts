// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { BeltConfig, CelestialBodyData } from '../types/celestial';
import { ScaleManager } from './ScaleManager';
import { PlanetMaterialFactory } from './PlanetMaterialFactory';
import { QualityMode } from './QualityManager';

export interface InstancedBeltEntry {
  config: BeltConfig;
  mesh: THREE.InstancedMesh;
  orbitalPointsAu: THREE.Vector3[];
  rotations: THREE.Euler[];
  scales: number[];
}

/**
 * ProceduralModels construiește:
 * - Corpurile cerești prin `PlanetMaterialFactory` (texturi 2K progresive + fallback procedural 2048×1024 + PBR + Fresnel + inele UV radiale + asteroizi deformați 3D).
 * - Modele 3D stilizate din primitive Three.js pentru ISS, JWST, Hubble, Voyager, sonde și rovere.
 * - Centura de Asteroizi și Centura Kuiper randate eficient cu THREE.InstancedMesh.
 */
export class ProceduralModels {
  /**
   * Creează grupul vizual 3D complet al unui corp ceresc sau al unei misiuni spațiale,
   * folosind sistemul hibrid PBR + texturi 2K progresive sau Modul Eco din `PlanetMaterialFactory`.
   */
  public static createCelestialVisual(
    data: CelestialBodyData,
    mode: QualityMode = PlanetMaterialFactory.getQualityMode()
  ): { visualRoot: THREE.Object3D; updateShaderTime?: (elapsed: number) => void } {
    const modelType = data.modelType ?? 'sphere';

    if (data.id === 'sun') {
      return PlanetMaterialFactory.createSunVisual(mode);
    }

    if (modelType === 'iss') {
      return { visualRoot: this.createISSModel() };
    }
    if (modelType === 'jwst') {
      return { visualRoot: this.createJWSTModel() };
    }
    if (modelType === 'hubble') {
      return { visualRoot: this.createHubbleModel(data.color) };
    }
    if (modelType === 'voyager') {
      return { visualRoot: this.createVoyagerModel(data.color) };
    }
    if (modelType === 'probe') {
      return { visualRoot: this.createSpaceProbeModel(data) };
    }
    if (modelType === 'rover') {
      return { visualRoot: this.createMarsRoverModel(data.id === 'perseverance') };
    }
    if (modelType === 'asteroid') {
      return { visualRoot: PlanetMaterialFactory.createDeformedAsteroidMesh(data, mode) };
    }

    // Corp sferic PBR (planete, sateliți majori, planete pitice, Pământul multi-layer cu lumini de noapte în HD)
    return PlanetMaterialFactory.createPlanetVisual(data, mode);
  }

  /**
   * Model 3D stilizat pentru Stația Spațială Internațională (ISS) din primitive Three.js.
   */
  private static createISSModel(): THREE.Group {
    const group = new THREE.Group();

    const trussMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.6, roughness: 0.35 });
    const moduleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.4, roughness: 0.4 });
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.22,
      metalness: 0.7,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.25 });

    // Grinda centrală (Integrated Truss)
    const truss = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12), trussMat);
    group.add(truss);

    // Modulele presurizate centrale (Destiny, Harmony, Columbus, Zvezda)
    const mainModule = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.35, 16), moduleMat);
    mainModule.rotation.x = Math.PI / 2;
    group.add(mainModule);

    const crossModule = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.85, 16), moduleMat);
    crossModule.position.set(0, 0, 0.35);
    group.add(crossModule);

    const nodeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), goldMat);
    group.add(nodeSphere);

    // Cele 8 aripi solare fotovoltaice (4 perechi)
    const panelGeo = new THREE.BoxGeometry(0.26, 0.02, 1.55);
    const xPositions = [-1.15, -0.78, 0.78, 1.15];
    for (const xPos of xPositions) {
      const panel = new THREE.Mesh(panelGeo, solarMat);
      panel.position.set(xPos, 0, 0);
      group.add(panel);
    }

    return group;
  }

  /**
   * Model 3D stilizat pentru Telescopul Spațial James Webb (JWST):
   * scut termic în formă de romb + oglindă aurită segmentată + trepied secundar.
   */
  private static createJWSTModel(): THREE.Group {
    const group = new THREE.Group();

    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x9333ea,
      emissiveIntensity: 0.12,
      metalness: 0.85,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    const goldMirrorMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xffb703,
      emissiveIntensity: 0.28,
      metalness: 0.9,
      roughness: 0.15,
    });
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });

    // Scutul termic în straturi (romb alungit)
    for (let i = 0; i < 3; i++) {
      const shieldGeo = new THREE.ConeGeometry(1.15 - i * 0.06, 0.04, 4);
      shieldGeo.scale(1.35, 1, 0.85);
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.y = -0.25 - i * 0.07;
      group.add(shield);
    }

    // Oglinda primară hexagonală aurită
    const mirrorGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.08, 6);
    mirrorGeo.rotateZ(Math.PI / 2);
    const mirror = new THREE.Mesh(mirrorGeo, goldMirrorMat);
    mirror.position.set(0, 0.35, 0);
    group.add(mirror);

    // Oglinda secundară și brațele de susținere
    const secMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), goldMirrorMat);
    secMirror.rotation.z = Math.PI / 2;
    secMirror.position.set(0.65, 0.35, 0);
    group.add(secMirror);

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), strutMat);
    strut.rotation.z = Math.PI / 2.3;
    strut.position.set(0.32, 0.52, 0);
    group.add(strut);

    return group;
  }

  /**
   * Model 3D stilizat pentru Telescopul Hubble / Euclid (cilindru optic + panouri solare).
   */
  private static createHubbleModel(accentColor: string): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.75, roughness: 0.25 });
    const panelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.25,
      metalness: 0.6,
      roughness: 0.3,
    });

    const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.35, 20), bodyMat);
    mainTube.rotation.z = Math.PI / 2;
    group.add(mainTube);

    const apertureDoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.45), bodyMat);
    apertureDoor.position.set(0.72, 0.32, 0);
    apertureDoor.rotation.z = -0.35;
    group.add(apertureDoor);

    const wingGeo = new THREE.BoxGeometry(0.32, 0.03, 1.85);
    const wings = new THREE.Mesh(wingGeo, panelMat);
    group.add(wings);

    return group;
  }

  /**
   * Model 3D stilizat pentru sondele interstelare Voyager 1 și Voyager 2
   * (antenă parabolică albă + bus decagonal aurit + braț RTG și magnetometru).
   */
  private static createVoyagerModel(accentColor: string): THREE.Group {
    const group = new THREE.Group();
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.3 });
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.18,
      metalness: 0.7,
      roughness: 0.3,
    });
    const boomMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 });

    // Antena parabolică High-Gain
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.28, 24, 1, true), dishMat);
    dish.material.side = THREE.DoubleSide;
    dish.position.y = 0.22;
    group.add(dish);

    // Corpul decagonal și Discul de Aur
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 10), busMat);
    group.add(bus);

    // Brațul lung al magnetometrului
    const magBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.65, 8), boomMat);
    magBoom.rotation.z = Math.PI / 2.6;
    magBoom.position.set(0.68, -0.25, 0);
    group.add(magBoom);

    // Brațul generatorului nuclear RTG
    const rtgBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 10), boomMat);
    rtgBoom.rotation.z = -Math.PI / 3;
    rtgBoom.position.set(-0.45, -0.2, 0);
    group.add(rtgBoom);

    return group;
  }

  /**
   * Model 3D stilizat pentru sonde interplanetare (New Horizons, Parker Solar Probe, Rosetta, JUICE).
   */
  private static createSpaceProbeModel(data: CelestialBodyData): THREE.Group {
    const group = new THREE.Group();
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.2,
      metalness: 0.75,
      roughness: 0.25,
    });
    const panelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.color),
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.25,
      metalness: 0.6,
      roughness: 0.3,
    });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.3 });

    // Corpul central al sondei
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), busMat);
    group.add(bus);

    // Antena sau scutul termic (pentru Parker Solar Probe)
    if (data.id === 'parker') {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 6), whiteMat);
      shield.position.y = 0.36;
      group.add(shield);
    } else {
      const dish = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.2, 20), whiteMat);
      dish.position.y = 0.38;
      group.add(dish);
    }

    // Aripi solare extinse (pentru Rosetta și JUICE)
    if (data.id !== 'newhorizons') {
      const wings = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.42), panelMat);
      group.add(wings);
      if (data.id === 'juice') {
        const crossWings = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 2.2), panelMat);
        group.add(crossWings);
      }
    }

    return group;
  }

  /**
   * Model 3D stilizat pentru roverele marțiene Perseverance (cu Ingenuity) și Curiosity.
   */
  private static createMarsRoverModel(includeIngenuity: boolean): THREE.Group {
    const group = new THREE.Group();
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xf97316,
      emissiveIntensity: 0.15,
      metalness: 0.5,
      roughness: 0.35,
    });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Șasiul roverului
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.65), chassisMat);
    chassis.position.y = 0.2;
    group.add(chassis);

    // Catargul și camera SuperCam / ChemCam
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.58, 10), chassisMat);
    mast.position.set(0.32, 0.55, 0);
    group.add(mast);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.28), chassisMat);
    head.position.set(0.32, 0.85, 0);
    group.add(head);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), laserMat);
    eye.position.set(0.41, 0.85, 0);
    group.add(eye);

    // Cele 6 roți Rocker-Bogie
    const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelX = [-0.38, 0, 0.38];
    const wheelZ = [-0.42, 0.42];
    for (const wx of wheelX) {
      for (const wz of wheelZ) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0, wz);
        group.add(w);
      }
    }

    // Elicopterul Ingenuity plutind deasupra roverului Perseverance
    if (includeIngenuity) {
      const heliGroup = new THREE.Group();
      heliGroup.position.set(-0.2, 1.25, 0);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), chassisMat);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.02, 0.08), laserMat);
      rotor.position.y = 0.15;
      heliGroup.add(box, rotor);
      group.add(heliGroup);
    }

    return group;
  }

  /**
   * Construiește Centura de Asteroizi și Centura Kuiper folosind `THREE.InstancedMesh`
   * pentru randare la 60 FPS într-un singur draw call per centură.
   */
  public static createInstancedBelt(config: BeltConfig, scaleManager: ScaleManager): InstancedBeltEntry {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.color),
      roughness: 0.75,
      metalness: 0.15,
      emissive: new THREE.Color(config.color),
      emissiveIntensity: 0.18,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, config.count);
    mesh.name = `Belt_${config.id}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const orbitalPointsAu: THREE.Vector3[] = [];
    const rotations: THREE.Euler[] = [];
    const scales: number[] = [];

    let seed = config.id === 'asteroid-belt' ? 77123 : 99451;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < config.count; i++) {
      const rAu = config.innerRadiusAU + nextRand() * (config.outerRadiusAU - config.innerRadiusAU);
      const angle = nextRand() * Math.PI * 2;
      const yAu = (nextRand() - 0.5) * config.thicknessAU;

      orbitalPointsAu.push(new THREE.Vector3(rAu * Math.cos(angle), yAu, rAu * Math.sin(angle)));
      rotations.push(
        new THREE.Euler(nextRand() * Math.PI, nextRand() * Math.PI, nextRand() * Math.PI)
      );
      scales.push(0.45 + nextRand() * 0.85);
    }

    const entry: InstancedBeltEntry = {
      config,
      mesh,
      orbitalPointsAu,
      rotations,
      scales,
    };

    this.updateInstancedBeltTransforms(entry, scaleManager);
    return entry;
  }

  /**
   * Actualizează matricile instanțelor centurii atunci când utilizatorul comută între
   * Scara Didactică și Scara Reală sau între Modul Eco (25% particule) și Modul HD (100%).
   */
  public static updateInstancedBeltTransforms(
    entry: InstancedBeltEntry,
    scaleManager: ScaleManager,
    mode: QualityMode = PlanetMaterialFactory.getQualityMode()
  ): void {
    const dummy = new THREE.Object3D();
    const isReal = scaleManager.getMode() === 'real';
    const baseSize = isReal ? 0.14 : entry.config.id === 'kuiper-belt' ? 0.34 : 0.22;

    const activeCount =
      mode === 'eco' ? Math.max(1, Math.floor(entry.config.count * 0.25)) : entry.config.count;
    entry.mesh.count = activeCount;

    for (let i = 0; i < activeCount; i++) {
      const pos3D = scaleManager.scaleHeliocentricPosition(entry.orbitalPointsAu[i]);
      dummy.position.copy(pos3D);
      dummy.rotation.copy(entry.rotations[i]);
      dummy.scale.setScalar(baseSize * entry.scales[i]);
      dummy.updateMatrix();
      entry.mesh.setMatrixAt(i, dummy.matrix);
    }
    entry.mesh.instanceMatrix.needsUpdate = true;
  }
}

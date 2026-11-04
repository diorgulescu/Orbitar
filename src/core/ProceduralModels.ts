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

interface SpacecraftPbrTextures {
  solarMap: THREE.CanvasTexture;
  solarBump: THREE.CanvasTexture;
  goldMliMap: THREE.CanvasTexture;
  silverMliMap: THREE.CanvasTexture;
  mliBump: THREE.CanvasTexture;
  hullMap: THREE.CanvasTexture;
  hullBump: THREE.CanvasTexture;
  dishMap: THREE.CanvasTexture;
  dishBump: THREE.CanvasTexture;
}

/**
 * ProceduralModels construiește:
 * - Corpurile cerești prin `PlanetMaterialFactory` (texturi 2K progresive + fallback procedural 2048×1024 + PBR + Fresnel + inele UV radiale + asteroizi deformați 3D).
 * - Modele 3D detaliate cu texturi PBR procedurale în modul HD (celule fotovoltaice, folie termică Kapton MLI aurie/argintie șifonată, panouri Whipple pentru modulele ISS, oglinda din 18 segmente hexagonale pentru JWST, antene parabolice cu nervuri concentrice pentru Voyager/New Horizons/Rosetta/JUICE).
 * - Roverele marțiene sunt reprezentate ca pinpoint-uri pe suprafața planetei Marte.
 * - Centura de Asteroizi și Centura Kuiper randate eficient cu THREE.InstancedMesh.
 */
export class ProceduralModels {
  private static hdTexturesCache: SpacecraftPbrTextures | null = null;
  private static readonly deepSpaceTexCache = new Map<string, THREE.Texture>();
  private static softRadialAlphaMap: THREE.CanvasTexture | null = null;

  private static loadDeepSpaceTexture(url: string): THREE.Texture | null {
    if (this.deepSpaceTexCache.has(url)) {
      return this.deepSpaceTexCache.get(url)!;
    }
    try {
      const loader = new THREE.TextureLoader();
      const tex = loader.load(
        url,
        (loaded) => {
          loaded.colorSpace = THREE.SRGBColorSpace;
          loaded.needsUpdate = true;
        },
        undefined,
        () => {}
      );
      tex.colorSpace = THREE.SRGBColorSpace;
      this.deepSpaceTexCache.set(url, tex);
      return tex;
    } catch (_e) {
      return null;
    }
  }

  private static getSoftRadialAlphaMap(): THREE.CanvasTexture | null {
    if (this.softRadialAlphaMap) return this.softRadialAlphaMap;
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, 256, 256);
      const grad = ctx.createRadialGradient(128, 128, 18, 128, 128, 124);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.58, '#d8d8d8');
      grad.addColorStop(0.84, '#484848');
      grad.addColorStop(1, '#000000');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 256);
    }
    const tex = new THREE.CanvasTexture(canvas);
    this.softRadialAlphaMap = tex;
    return tex;
  }

  /**
   * Generează și memorează în cache texturile PBR de înaltă rezoluție (512×512)
   * pentru panourile solare fotovoltaice, izolația termică Kapton MLI, modulele presurizate și antenele parabolice.
   */
  private static getHdSpacecraftTextures(): SpacecraftPbrTextures {
    if (this.hdTexturesCache) {
      return this.hdTexturesCache;
    }

    // 1. Textură Panouri Fotovoltaice (celule solare albastre-safir cu magistrale argintii și micro-grilă)
    const solarCanvas = document.createElement('canvas');
    solarCanvas.width = 512;
    solarCanvas.height = 512;
    const sCtx = solarCanvas.getContext('2d')!;
    sCtx.fillStyle = '#071a3e';
    sCtx.fillRect(0, 0, 512, 512);

    const solarBumpCanvas = document.createElement('canvas');
    solarBumpCanvas.width = 512;
    solarBumpCanvas.height = 512;
    const sbCtx = solarBumpCanvas.getContext('2d')!;
    sbCtx.fillStyle = '#808080';
    sbCtx.fillRect(0, 0, 512, 512);

    const cols = 8;
    const rows = 16;
    const cellW = 512 / cols;
    const cellH = 512 / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = c * cellW;
        const y = r * cellH;
        const grad = sCtx.createLinearGradient(x, y, x + cellW, y + cellH);
        grad.addColorStop(0, '#0c2d6b');
        grad.addColorStop(0.5, '#13408a');
        grad.addColorStop(1, '#081f4d');
        sCtx.fillStyle = grad;
        sCtx.fillRect(x + 2, y + 2, cellW - 4, cellH - 4);

        // Linii fine de siliciu în interiorul fiecărei celule fotovoltaice
        sCtx.strokeStyle = 'rgba(148, 163, 184, 0.32)';
        sCtx.lineWidth = 0.75;
        for (let k = 1; k < 4; k++) {
          sCtx.beginPath();
          sCtx.moveTo(x + (cellW * k) / 4, y + 2);
          sCtx.lineTo(x + (cellW * k) / 4, y + cellH - 2);
          sCtx.stroke();
        }

        // Magistrale colectoare (busbars) aurii/argintii
        sCtx.strokeStyle = '#cbd5e1';
        sCtx.lineWidth = 1.6;
        sCtx.strokeRect(x + 1.5, y + 1.5, cellW - 3, cellH - 3);

        sbCtx.fillStyle = '#b8b8b8';
        sbCtx.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
        sbCtx.strokeStyle = '#303030';
        sbCtx.lineWidth = 2;
        sbCtx.strokeRect(x + 1, y + 1, cellW - 2, cellH - 2);
      }
    }

    // 2. Textură Folie Termică Multi-Layer Insulation (Kapton MLI Aurie & Argintie + Harta de relief șifonat)
    const goldCanvas = document.createElement('canvas');
    goldCanvas.width = 512;
    goldCanvas.height = 512;
    const gCtx = goldCanvas.getContext('2d')!;

    const silverCanvas = document.createElement('canvas');
    silverCanvas.width = 512;
    silverCanvas.height = 512;
    const agCtx = silverCanvas.getContext('2d')!;

    const mliBumpCanvas = document.createElement('canvas');
    mliBumpCanvas.width = 512;
    mliBumpCanvas.height = 512;
    const mbCtx = mliBumpCanvas.getContext('2d')!;

    gCtx.fillStyle = '#d99316';
    gCtx.fillRect(0, 0, 512, 512);
    agCtx.fillStyle = '#cbd5e1';
    agCtx.fillRect(0, 0, 512, 512);
    mbCtx.fillStyle = '#808080';
    mbCtx.fillRect(0, 0, 512, 512);

    // Generăm pliuri poligonale deterministe specifice foliei termice spațiale Kapton
    let seed = 13579;
    const rand = (): number => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };

    for (let i = 0; i < 220; i++) {
      const cx = rand() * 512;
      const cy = rand() * 512;
      const rx = 18 + rand() * 54;
      const ry = 14 + rand() * 46;
      const shade = Math.floor(rand() * 70) - 35;

      const gR = Math.min(255, Math.max(0, 224 + shade));
      const gG = Math.min(255, Math.max(0, 158 + Math.floor(shade * 0.8)));
      const gB = Math.min(255, Math.max(0, 24 + Math.floor(shade * 0.35)));
      gCtx.fillStyle = `rgba(${gR}, ${gG}, ${gB}, 0.42)`;

      const sVal = Math.min(255, Math.max(150, 212 + shade));
      agCtx.fillStyle = `rgba(${sVal}, ${sVal + 4}, ${ Math.min(255, sVal + 10) }, 0.42)`;

      const bVal = Math.min(255, Math.max(20, 128 + shade * 2));
      mbCtx.fillStyle = `rgba(${bVal}, ${bVal}, ${bVal}, 0.55)`;

      gCtx.beginPath();
      agCtx.beginPath();
      mbCtx.beginPath();
      for (let v = 0; v < 5; v++) {
        const ang = (v / 5) * Math.PI * 2 + rand() * 0.5;
        const px = cx + Math.cos(ang) * rx;
        const py = cy + Math.sin(ang) * ry;
        if (v === 0) {
          gCtx.moveTo(px, py);
          agCtx.moveTo(px, py);
          mbCtx.moveTo(px, py);
        } else {
          gCtx.lineTo(px, py);
          agCtx.lineTo(px, py);
          mbCtx.lineTo(px, py);
        }
      }
      gCtx.closePath();
      gCtx.fill();
      agCtx.closePath();
      agCtx.fill();
      mbCtx.closePath();
      mbCtx.fill();
    }

    // Cusături rectangulare pe păturile termice MLI
    gCtx.strokeStyle = 'rgba(120, 65, 5, 0.45)';
    agCtx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
    mbCtx.strokeStyle = '#383838';
    gCtx.lineWidth = 1.5;
    agCtx.lineWidth = 1.5;
    mbCtx.lineWidth = 2;
    for (let p = 64; p < 512; p += 64) {
      gCtx.beginPath();
      gCtx.moveTo(p, 0);
      gCtx.lineTo(p, 512);
      gCtx.moveTo(0, p);
      gCtx.lineTo(512, p);
      gCtx.stroke();

      agCtx.beginPath();
      agCtx.moveTo(p, 0);
      agCtx.lineTo(p, 512);
      agCtx.moveTo(0, p);
      agCtx.lineTo(512, p);
      agCtx.stroke();

      mbCtx.beginPath();
      mbCtx.moveTo(p, 0);
      mbCtx.lineTo(p, 512);
      mbCtx.moveTo(0, p);
      mbCtx.lineTo(512, p);
      mbCtx.stroke();
    }

    // 3. Textură Panouri Presurizate Whipple Shield (pentru modulele ISS și Hubble)
    const hullCanvas = document.createElement('canvas');
    hullCanvas.width = 512;
    hullCanvas.height = 512;
    const hCtx = hullCanvas.getContext('2d')!;
    hCtx.fillStyle = '#e8edf5';
    hCtx.fillRect(0, 0, 512, 512);

    const hullBumpCanvas = document.createElement('canvas');
    hullBumpCanvas.width = 512;
    hullBumpCanvas.height = 512;
    const hbCtx = hullBumpCanvas.getContext('2d')!;
    hbCtx.fillStyle = '#909090';
    hbCtx.fillRect(0, 0, 512, 512);

    for (let y = 0; y < 512; y += 64) {
      hCtx.fillStyle = y % 128 === 0 ? '#dde5f0' : '#f1f5f9';
      hCtx.fillRect(0, y, 512, 62);
      hCtx.strokeStyle = '#94a3b8';
      hCtx.lineWidth = 2;
      hCtx.strokeRect(2, y + 2, 508, 60);

      hbCtx.strokeStyle = '#404040';
      hbCtx.lineWidth = 2.5;
      hbCtx.strokeRect(2, y + 2, 508, 60);

      for (let x = 32; x < 512; x += 64) {
        hCtx.beginPath();
        hCtx.moveTo(x, y);
        hCtx.lineTo(x, y + 64);
        hCtx.stroke();

        hbCtx.beginPath();
        hbCtx.moveTo(x, y);
        hbCtx.lineTo(x, y + 64);
        hbCtx.stroke();

        // Nituri de fixare micrometeoritice
        hCtx.fillStyle = '#64748b';
        hCtx.fillRect(x - 4, y + 6, 2, 2);
        hCtx.fillRect(x + 4, y + 6, 2, 2);
      }
    }

    // 4. Textură Antenă Parabolică High-Gain (inele și nervuri radiale concentrice)
    const dishCanvas = document.createElement('canvas');
    dishCanvas.width = 512;
    dishCanvas.height = 512;
    const dCtx = dishCanvas.getContext('2d')!;
    dCtx.fillStyle = '#f1f5f9';
    dCtx.fillRect(0, 0, 512, 512);

    const dishBumpCanvas = document.createElement('canvas');
    dishBumpCanvas.width = 512;
    dishBumpCanvas.height = 512;
    const dbCtx = dishBumpCanvas.getContext('2d')!;
    dbCtx.fillStyle = '#808080';
    dbCtx.fillRect(0, 0, 512, 512);

    dCtx.strokeStyle = '#cbd5e1';
    dbCtx.strokeStyle = '#b8b8b8';
    for (let r = 24; r < 250; r += 22) {
      dCtx.lineWidth = 1.5;
      dCtx.beginPath();
      dCtx.arc(256, 256, r, 0, Math.PI * 2);
      dCtx.stroke();

      dbCtx.lineWidth = 2;
      dbCtx.beginPath();
      dbCtx.arc(256, 256, r, 0, Math.PI * 2);
      dbCtx.stroke();
    }
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      dCtx.beginPath();
      dCtx.moveTo(256, 256);
      dCtx.lineTo(256 + Math.cos(ang) * 250, 256 + Math.sin(ang) * 250);
      dCtx.stroke();

      dbCtx.beginPath();
      dbCtx.moveTo(256, 256);
      dbCtx.lineTo(256 + Math.cos(ang) * 250, 256 + Math.sin(ang) * 250);
      dbCtx.stroke();
    }

    const makeTex = (canvas: HTMLCanvasElement, isColor: boolean): THREE.CanvasTexture => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.wrapS = THREE.RepeatWrapping;
      tex.wrapT = THREE.RepeatWrapping;
      if (isColor) {
        tex.colorSpace = THREE.SRGBColorSpace;
      }
      return tex;
    };

    this.hdTexturesCache = {
      solarMap: makeTex(solarCanvas, true),
      solarBump: makeTex(solarBumpCanvas, false),
      goldMliMap: makeTex(goldCanvas, true),
      silverMliMap: makeTex(silverCanvas, true),
      mliBump: makeTex(mliBumpCanvas, false),
      hullMap: makeTex(hullCanvas, true),
      hullBump: makeTex(hullBumpCanvas, false),
      dishMap: makeTex(dishCanvas, true),
      dishBump: makeTex(dishBumpCanvas, false),
    };

    return this.hdTexturesCache;
  }

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
      return { visualRoot: this.createISSModel(mode) };
    }
    if (modelType === 'jwst') {
      return { visualRoot: this.createJWSTModel(mode) };
    }
    if (modelType === 'hubble') {
      return { visualRoot: this.createHubbleModel(data.id, data.color, mode) };
    }
    if (modelType === 'voyager') {
      return { visualRoot: this.createVoyagerModel(data.color, mode) };
    }
    if (modelType === 'probe') {
      return { visualRoot: this.createSpaceProbeModel(data, mode) };
    }
    if (modelType === 'rover') {
      // Roverele sunt afișate ca pinpoint-uri ancorate direct pe suprafața planetei Marte (SurfaceMarkers)
      return { visualRoot: new THREE.Group() };
    }
    if (modelType === 'asteroid') {
      return { visualRoot: PlanetMaterialFactory.createDeformedAsteroidMesh(data, mode) };
    }
    if (modelType === 'oort_cloud') {
      return this.createOortCloudModel(mode);
    }
    if (modelType === 'star_system') {
      return this.createDeepStarSystemModel(data, mode);
    }
    if (modelType === 'trappist_system') {
      return this.createTrappistSystemModel(mode);
    }
    if (modelType === 'lava_exoplanet') {
      return this.createLavaExoplanetModel(mode);
    }
    if (modelType === 'star_cluster') {
      return this.createStarClusterModel(mode);
    }
    if (modelType === 'nebula') {
      return this.createNebulaModel(data, mode);
    }
    if (modelType === 'black_hole') {
      return this.createBlackHoleModel(mode);
    }
    if (modelType === 'spiral_galaxy') {
      return this.createSpiralGalaxyModel(data, mode);
    }

    // Corp sferic PBR (planete, sateliți majori, planete pitice, Pământul multi-layer cu lumini de noapte în HD)
    return PlanetMaterialFactory.createPlanetVisual(data, mode);
  }

  /**
   * Model 3D pentru Stația Spațială Internațională (ISS):
   * În modul HD include texturi PBR pentru celulele fotovoltaice, scuturile Whipple ale modulelor
   * presurizate (Destiny, Harmony, Columbus, Kibo, Zvezda), Cupola, radiatoarele termice și grinda S0–S6/P1–P6.
   */
  private static createISSModel(mode: QualityMode = 'hd'): THREE.Group {
    const group = new THREE.Group();
    const isHd = mode === 'hd';
    const tex = isHd ? this.getHdSpacecraftTextures() : null;

    const trussMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      metalness: 0.72,
      roughness: 0.32,
      bumpMap: tex ? tex.hullBump : null,
      bumpScale: 0.015,
    });
    const moduleMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      map: tex ? tex.hullMap : null,
      bumpMap: tex ? tex.hullBump : null,
      bumpScale: 0.02,
      metalness: 0.45,
      roughness: 0.35,
    });
    const solarMat = new THREE.MeshStandardMaterial({
      color: isHd ? 0xffffff : 0x0284c7,
      map: tex ? tex.solarMap : null,
      bumpMap: tex ? tex.solarBump : null,
      bumpScale: 0.018,
      emissive: new THREE.Color(isHd ? 0x0a2e5c : 0x00f0ff),
      emissiveIntensity: isHd ? 0.32 : 0.22,
      metalness: 0.78,
      roughness: 0.22,
      side: THREE.DoubleSide,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      map: tex ? tex.goldMliMap : null,
      bumpMap: tex ? tex.mliBump : null,
      bumpScale: 0.02,
      metalness: 0.85,
      roughness: 0.22,
    });
    const radiatorMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      bumpMap: tex ? tex.solarBump : null,
      bumpScale: 0.01,
      metalness: 0.3,
      roughness: 0.28,
      side: THREE.DoubleSide,
    });

    // Grinda centrală (Integrated Truss Structure S0-S6 / P1-P6)
    const truss = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.11, 0.11), trussMat);
    group.add(truss);

    // Modulele presurizate principale (Zvezda -> Zarya -> Unity -> Destiny -> Harmony)
    const mainModule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.15, 0.15, 1.55, isHd ? 28 : 16),
      moduleMat
    );
    mainModule.rotation.x = Math.PI / 2;
    group.add(mainModule);

    // Laboratoarele transversale (Columbus & Kibo JEM)
    const crossModule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.13, 0.13, 0.96, isHd ? 24 : 16),
      moduleMat
    );
    crossModule.rotation.z = Math.PI / 2;
    crossModule.position.set(0, 0, 0.42);
    group.add(crossModule);

    // Nodul central de andocare și Cupola
    const nodeSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.19, isHd ? 24 : 16, isHd ? 24 : 16),
      goldMat
    );
    group.add(nodeSphere);

    if (isHd) {
      // Modulul rus Zvezda cu panouri solare proprii în spate
      const zvezdaAft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.14, 0.55, 24), goldMat);
      zvezdaAft.rotation.x = Math.PI / 2;
      zvezdaAft.position.set(0, 0, -0.82);
      group.add(zvezdaAft);

      // Radiatoarele albe de disipare termică (EATCS)
      const radGeo = new THREE.BoxGeometry(0.18, 0.012, 0.72);
      for (const rx of [-0.46, 0.46]) {
        const rad = new THREE.Mesh(radGeo, radiatorMat);
        rad.position.set(rx, -0.14, -0.35);
        rad.rotation.x = 0.25;
        group.add(rad);
      }

      // Cele 8 aripi solare duble (SAW) cu catarg central aurit
      const wingGeo = new THREE.BoxGeometry(0.24, 0.015, 0.82);
      const mastGeo = new THREE.CylinderGeometry(0.015, 0.015, 1.85, 8);
      mastGeo.rotateX(Math.PI / 2);
      const xPositions = [-1.26, -0.92, 0.92, 1.26];
      for (const xPos of xPositions) {
        const mast = new THREE.Mesh(mastGeo, goldMat);
        mast.position.set(xPos, 0, 0);
        group.add(mast);

        const northWing = new THREE.Mesh(wingGeo, solarMat);
        northWing.position.set(xPos, 0, 0.48);
        group.add(northWing);

        const southWing = new THREE.Mesh(wingGeo, solarMat);
        southWing.position.set(xPos, 0, -0.48);
        group.add(southWing);
      }
    } else {
      const panelGeo = new THREE.BoxGeometry(0.26, 0.02, 1.55);
      const xPositions = [-1.15, -0.78, 0.78, 1.15];
      for (const xPos of xPositions) {
        const panel = new THREE.Mesh(panelGeo, solarMat);
        panel.position.set(xPos, 0, 0);
        group.add(panel);
      }
    }

    return group;
  }

  /**
   * Model 3D pentru Telescopul Spațial James Webb (JWST):
   * În modul HD randează cele 5 straturi de Kapton ale scutului termic cu textură MLI șifonată,
   * toate cele 18 segmente hexagonale individuale din beriliu suflat cu aur ale oglinzii primare,
   * deflectorul central și trepiedul oglinzii secundare.
   */
  private static createJWSTModel(mode: QualityMode = 'hd'): THREE.Group {
    const group = new THREE.Group();
    const isHd = mode === 'hd';
    const tex = isHd ? this.getHdSpacecraftTextures() : null;

    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      map: tex ? tex.silverMliMap : null,
      bumpMap: tex ? tex.mliBump : null,
      bumpScale: 0.022,
      emissive: 0x9333ea,
      emissiveIntensity: 0.1,
      metalness: 0.88,
      roughness: 0.18,
      side: THREE.DoubleSide,
    });
    const goldMirrorMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.24,
      metalness: 0.96,
      roughness: 0.08,
    });
    const backplaneMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.65,
      roughness: 0.38,
    });
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      map: tex ? tex.goldMliMap : null,
      bumpMap: tex ? tex.mliBump : null,
      bumpScale: 0.02,
      metalness: 0.82,
      roughness: 0.25,
    });

    // Scutul termic în 5 straturi (în HD) sau 3 straturi (în Eco)
    const layerCount = isHd ? 5 : 3;
    for (let i = 0; i < layerCount; i++) {
      const shieldGeo = new THREE.ConeGeometry(1.18 - i * 0.045, 0.028, 4);
      shieldGeo.scale(1.38, 1, 0.86);
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.y = -0.22 - i * 0.048;
      group.add(shield);
    }

    if (isHd) {
      // Structura neagră de susținere din grafit-epoxid (Backplane)
      const backplaneGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.05, 6);
      backplaneGeo.rotateZ(Math.PI / 2);
      const backplane = new THREE.Mesh(backplaneGeo, backplaneMat);
      backplane.position.set(-0.04, 0.38, 0);
      group.add(backplane);

      // Cele 18 segmente hexagonale individuale din beriliu aurit dispuse în fagure (2 inele concentrice)
      const segRadius = 0.125;
      const segGeo = new THREE.CylinderGeometry(segRadius * 0.95, segRadius * 0.95, 0.035, 6);
      segGeo.rotateZ(Math.PI / 2);

      const d = segRadius * 1.76;
      const hexCoords: Array<[number, number]> = [
        // Inelul interior (6 segmente)
        [d, 0],
        [d * 0.5, d * 0.866],
        [-d * 0.5, d * 0.866],
        [-d, 0],
        [-d * 0.5, -d * 0.866],
        [d * 0.5, -d * 0.866],
        // Inelul exterior (12 segmente)
        [2 * d, 0],
        [1.5 * d, d * 0.866],
        [d, 2 * d * 0.866],
        [0, 2 * d * 0.866],
        [-d, 2 * d * 0.866],
        [-1.5 * d, d * 0.866],
        [-2 * d, 0],
        [-1.5 * d, -d * 0.866],
        [-d, -2 * d * 0.866],
        [0, -2 * d * 0.866],
        [d, -2 * d * 0.866],
        [1.5 * d, -d * 0.866],
      ];

      for (const [dy, dz] of hexCoords) {
        const seg = new THREE.Mesh(segGeo, goldMirrorMat);
        // Curbură concavă subtilă spre focarul secundar
        const rDist = Math.hypot(dy, dz);
        seg.position.set(rDist * 0.04, 0.38 + dy, dz);
        group.add(seg);
      }

      // Deflectorul optic central (Aft Optics Subsystem baffle)
      const baffle = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.16, 12), backplaneMat);
      baffle.rotation.z = Math.PI / 2;
      baffle.position.set(0.06, 0.38, 0);
      group.add(baffle);

      // Autobuzul spațial (Spacecraft Bus) sub scutul termic
      const bus = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.22, 0.38), busMat);
      bus.position.set(-0.1, -0.52, 0);
      group.add(bus);

      // Cele 3 brațe ale trepiedului oglinzii secundare
      const secPos = new THREE.Vector3(0.68, 0.38, 0);
      const secMirror = new THREE.Mesh(
        new THREE.CylinderGeometry(0.12, 0.12, 0.04, 18),
        goldMirrorMat
      );
      secMirror.rotation.z = Math.PI / 2;
      secMirror.position.copy(secPos);
      group.add(secMirror);

      const anchors = [
        new THREE.Vector3(0, 0.86, 0),
        new THREE.Vector3(0, 0.04, 0.42),
        new THREE.Vector3(0, 0.04, -0.42),
      ];
      for (const anc of anchors) {
        const len = anc.distanceTo(secPos);
        const strut = new THREE.Mesh(
          new THREE.CylinderGeometry(0.016, 0.016, len, 8),
          backplaneMat
        );
        strut.position.copy(anc).add(secPos).multiplyScalar(0.5);
        strut.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          secPos.clone().sub(anc).normalize()
        );
        group.add(strut);
      }
    } else {
      const mirrorGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.08, 6);
      mirrorGeo.rotateZ(Math.PI / 2);
      const mirror = new THREE.Mesh(mirrorGeo, goldMirrorMat);
      mirror.position.set(0, 0.35, 0);
      group.add(mirror);

      const secMirror = new THREE.Mesh(
        new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12),
        goldMirrorMat
      );
      secMirror.rotation.z = Math.PI / 2;
      secMirror.position.set(0.65, 0.35, 0);
      group.add(secMirror);

      const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), backplaneMat);
      strut.rotation.z = Math.PI / 2.3;
      strut.position.set(0.32, 0.52, 0);
      group.add(strut);
    }

    return group;
  }

  /**
   * Model 3D pentru Telescopul Spațial Hubble și Telescopul Spațial Euclid:
   * În modul HD aplică textura de folie argintie/aurie Kapton MLI pe tubul optic și celule fotovoltaice pe aripi.
   */
  private static createHubbleModel(
    bodyId: string,
    accentColor: string,
    mode: QualityMode = 'hd'
  ): THREE.Group {
    const group = new THREE.Group();
    const isHd = mode === 'hd';
    const tex = isHd ? this.getHdSpacecraftTextures() : null;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      map: tex ? tex.silverMliMap : null,
      bumpMap: tex ? tex.mliBump : null,
      bumpScale: 0.022,
      metalness: 0.82,
      roughness: 0.22,
    });
    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      map: tex ? tex.goldMliMap : null,
      bumpMap: tex ? tex.mliBump : null,
      bumpScale: 0.022,
      metalness: 0.85,
      roughness: 0.24,
    });
    const panelMat = new THREE.MeshStandardMaterial({
      color: isHd ? 0xffffff : new THREE.Color(accentColor),
      map: tex ? tex.solarMap : null,
      bumpMap: tex ? tex.solarBump : null,
      bumpScale: 0.016,
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: isHd ? 0.22 : 0.25,
      metalness: 0.72,
      roughness: 0.24,
      side: THREE.DoubleSide,
    });

    // Tubul optic principal + secțiunea posterioară a instrumentelor științifice
    const mainTube = new THREE.Mesh(
      new THREE.CylinderGeometry(0.3, 0.34, 1.15, isHd ? 28 : 20),
      bodyMat
    );
    mainTube.rotation.z = Math.PI / 2;
    group.add(mainTube);

    if (isHd) {
      const aftShroud = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.48, 28), goldMat);
      aftShroud.rotation.z = Math.PI / 2;
      aftShroud.position.x = -0.52;
      group.add(aftShroud);

      // Cavitatea interioară întunecată a oglinzii primare
      const cavity = new THREE.Mesh(
        new THREE.CylinderGeometry(0.27, 0.27, 0.06, 24),
        new THREE.MeshBasicMaterial({ color: 0x050814 })
      );
      cavity.rotation.z = Math.PI / 2;
      cavity.position.x = 0.56;
      group.add(cavity);
    }

    const apertureDoor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.31, 0.31, 0.04, isHd ? 24 : 12),
      bodyId === 'euclid' ? goldMat : bodyMat
    );
    apertureDoor.position.set(0.7, 0.32, 0);
    apertureDoor.rotation.z = -0.42;
    group.add(apertureDoor);

    const wingGeo = new THREE.BoxGeometry(0.34, 0.025, 1.92);
    const wings = new THREE.Mesh(wingGeo, panelMat);
    group.add(wings);

    return group;
  }

  /**
   * Model 3D pentru sondele interstelare Voyager 1 și Voyager 2:
   * Antenă parabolică High-Gain cu nervuri concentrice și trepied feedhorn, bus decagonal cu Discul de Aur,
   * generatorul nuclear RTG cu 3 cilindri și brațul magnetometrului.
   */
  private static createVoyagerModel(accentColor: string, mode: QualityMode = 'hd'): THREE.Group {
    const group = new THREE.Group();
    const isHd = mode === 'hd';
    const tex = isHd ? this.getHdSpacecraftTextures() : null;

    const dishMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      map: tex ? tex.dishMap : null,
      bumpMap: tex ? tex.dishBump : null,
      bumpScale: 0.02,
      roughness: 0.3,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });
    const busMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      map: tex ? tex.hullMap : null,
      bumpMap: tex ? tex.hullBump : null,
      bumpScale: 0.015,
      metalness: 0.72,
      roughness: 0.32,
    });
    const goldRecordMat = new THREE.MeshStandardMaterial({
      color: 0xffbe0b,
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.28,
      metalness: 0.95,
      roughness: 0.12,
    });
    const boomMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.68,
      roughness: 0.36,
    });

    // Antena parabolică High-Gain de 3,7 m
    const dish = new THREE.Mesh(
      new THREE.ConeGeometry(0.84, 0.28, isHd ? 36 : 24, 1, true),
      dishMat
    );
    dish.position.y = 0.22;
    group.add(dish);

    if (isHd) {
      // Sub-reflectorul central (Feedhorn) și trepiedul antenei
      const feedHorn = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.12, 0.16, 16), boomMat);
      feedHorn.position.y = 0.44;
      group.add(feedHorn);

      for (let k = 0; k < 3; k++) {
        const ang = (k / 3) * Math.PI * 2;
        const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.62, 8), boomMat);
        strut.position.set(Math.cos(ang) * 0.28, 0.32, Math.sin(ang) * 0.28);
        strut.rotation.z = Math.cos(ang) * 0.65;
        strut.rotation.x = -Math.sin(ang) * 0.65;
        group.add(strut);
      }

      // Discul de Aur (Voyager Golden Record) montat pe bus-ul decagonal
      const goldenRecord = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.11, 0.02, 24),
        goldRecordMat
      );
      goldenRecord.rotation.z = Math.PI / 2;
      goldenRecord.position.set(0.36, 0, 0);
      group.add(goldenRecord);
    }

    // Corpul decagonal al sondei
    const bus = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 0.24, 10),
      isHd ? busMat : goldRecordMat
    );
    group.add(bus);

    // Brațul lung al magnetometrului
    const magBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.7, 8), boomMat);
    magBoom.rotation.z = Math.PI / 2.6;
    magBoom.position.set(0.7, -0.25, 0);
    group.add(magBoom);

    // Brațul generatorului termoelectric cu radioizotopi (3 unități RTG)
    const rtgBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.98, 12), boomMat);
    rtgBoom.rotation.z = -Math.PI / 3;
    rtgBoom.position.set(-0.46, -0.2, 0);
    group.add(rtgBoom);

    return group;
  }

  /**
   * Model 3D pentru sonde interplanetare (New Horizons, Parker Solar Probe, Rosetta, JUICE)
   * cu folie termică Kapton MLI aurită, antene parabolice nervurate și panouri fotovoltaice texturate în HD.
   */
  private static createSpaceProbeModel(
    data: CelestialBodyData,
    mode: QualityMode = 'hd'
  ): THREE.Group {
    const group = new THREE.Group();
    const isHd = mode === 'hd';
    const tex = isHd ? this.getHdSpacecraftTextures() : null;

    const busMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      map: tex ? tex.goldMliMap : null,
      bumpMap: tex ? tex.mliBump : null,
      bumpScale: 0.024,
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.16,
      metalness: 0.84,
      roughness: 0.22,
    });
    const panelMat = new THREE.MeshStandardMaterial({
      color: isHd ? 0xffffff : new THREE.Color(data.color),
      map: tex ? tex.solarMap : null,
      bumpMap: tex ? tex.solarBump : null,
      bumpScale: 0.018,
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.22,
      metalness: 0.75,
      roughness: 0.24,
      side: THREE.DoubleSide,
    });
    const whiteMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      map: tex ? tex.dishMap : null,
      bumpMap: tex ? tex.dishBump : null,
      bumpScale: 0.018,
      roughness: 0.28,
      metalness: 0.35,
      side: THREE.DoubleSide,
    });

    // Corpul central al sondei învelit în folie termică Kapton aurie
    const bus = new THREE.Mesh(
      data.id === 'newhorizons'
        ? new THREE.CylinderGeometry(0.46, 0.46, 0.32, 3)
        : new THREE.BoxGeometry(0.55, 0.55, 0.55),
      busMat
    );
    group.add(bus);

    // Antena High-Gain sau scutul termic din carbon-carbon (pentru Parker Solar Probe)
    if (data.id === 'parker') {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.08, 6), whiteMat);
      shield.position.y = 0.36;
      group.add(shield);
    } else {
      const dish = new THREE.Mesh(
        new THREE.ConeGeometry(0.56, 0.22, isHd ? 32 : 20, 1, true),
        whiteMat
      );
      dish.position.y = 0.38;
      group.add(dish);
    }

    // Aripi solare extinse (pentru Rosetta, JUICE și Parker)
    if (data.id !== 'newhorizons') {
      const wings = new THREE.Mesh(new THREE.BoxGeometry(2.35, 0.03, 0.46), panelMat);
      group.add(wings);
      if (data.id === 'juice') {
        const crossWings = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.03, 2.35), panelMat);
        group.add(crossWings);
      }
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

  /**
   * 1. Norul lui Oort: Sferă gigantică de comete înghețate la ~1 an-lumină în jurul Sistemului Solar.
   */
  private static createOortCloudModel(mode: QualityMode): {
    visualRoot: THREE.Object3D;
    updateShaderTime: (elapsed: number) => void;
  } {
    const group = new THREE.Group();
    const count = mode === 'eco' ? 1200 : 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    let seed = 41009;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const c1 = new THREE.Color('#7dd3fc');
    const c2 = new THREE.Color('#e0f2fe');
    const c3 = new THREE.Color('#38bdf8');

    for (let i = 0; i < count; i++) {
      // Distribuție în coajă sferică (shell) + disc interior Hills
      const isInnerDisc = i < count * 0.25;
      const r = isInnerDisc ? 0.45 + rand() * 0.35 : 0.78 + rand() * 0.65;
      const theta = rand() * Math.PI * 2;
      const u = rand() * 2 - 1;
      const phi = Math.acos(isInnerDisc ? u * 0.28 : u);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi);
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const pick = rand();
      const col = pick < 0.45 ? c1 : pick < 0.8 ? c2 : c3;
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const mat = new THREE.PointsMaterial({
      size: mode === 'eco' ? 0.22 : 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const points = new THREE.Points(geo, mat);
    group.add(points);

    // Soarele central ca reper luminos în mijlocul Norului lui Oort
    const coreSun = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0xffd166 })
    );
    group.add(coreSun);

    const haloRing = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.02, 48),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    haloRing.rotation.x = Math.PI * 0.5;
    group.add(haloRing);

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        points.rotation.y = elapsed * 0.025;
      },
    };
  }

  /**
   * 2. Stele Vecine (Sirius A & B, Betelgeuse, Proxima Centauri & Proxima b) cu texturi fotosferice 2K și culori spectrale reale.
   */
  private static createDeepStarSystemModel(
    data: CelestialBodyData,
    mode: QualityMode
  ): { visualRoot: THREE.Object3D; updateShaderTime: (elapsed: number) => void } {
    const group = new THREE.Group();
    const segs = mode === 'eco' ? 24 : 48;
    const starColor = new THREE.Color(data.color);

    const starTexUrl =
      data.id === 'betelgeuse'
        ? './textures/hd/betelgeuse_convection.jpg'
        : data.id === 'sirius'
        ? './textures/hd/blue_star_sirius.jpg'
        : './textures/hd/red_dwarf_flare.jpg';
    const starMap = mode === 'hd' ? this.loadDeepSpaceTexture(starTexUrl) : this.loadDeepSpaceTexture('./textures/sun.jpg');

    const starRadius = data.id === 'betelgeuse' ? 1.35 : 0.82;
    const starMesh = new THREE.Mesh(
      new THREE.SphereGeometry(starRadius, segs, segs),
      new THREE.MeshBasicMaterial({
        color: starMap ? 0xffffff : starColor,
        map: starMap,
      })
    );
    group.add(starMesh);

    // Coroană stelară aditivă
    const coronaMesh = new THREE.Mesh(
      new THREE.SphereGeometry(starRadius * 1.38, segs, segs),
      new THREE.MeshBasicMaterial({
        color: starColor,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    group.add(coronaMesh);

    const outerHalo = new THREE.Mesh(
      new THREE.SphereGeometry(starRadius * 1.85, 24, 24),
      new THREE.MeshBasicMaterial({
        color: starColor,
        transparent: true,
        opacity: 0.11,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    group.add(outerHalo);

    const pivot = new THREE.Group();
    group.add(pivot);

    if (data.id === 'sirius') {
      // Pitica albă Sirius B pe orbită în jurul lui Sirius A
      const orbitRing = new THREE.Mesh(
        new THREE.RingGeometry(1.75, 1.8, 64),
        new THREE.MeshBasicMaterial({
          color: 0x93c5fd,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.35,
          depthWrite: false,
        })
      );
      orbitRing.rotation.x = Math.PI * 0.44;
      group.add(orbitRing);

      const siriusB = new THREE.Mesh(
        new THREE.SphereGeometry(0.18, 20, 20),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      siriusB.position.set(1.78, 0, 0);
      pivot.rotation.z = 0.18;
      pivot.add(siriusB);
    } else if (data.id === 'proxima_centauri') {
      // Zona locuibilă (inel verde-smarald discret) + exoplaneta Proxima Centauri b texturată
      const hzRing = new THREE.Mesh(
        new THREE.RingGeometry(1.55, 1.85, 64),
        new THREE.MeshBasicMaterial({
          color: 0x10b981,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.25,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      hzRing.rotation.x = Math.PI * 0.5;
      group.add(hzRing);

      const habMap = mode === 'hd' ? this.loadDeepSpaceTexture('./textures/hd/trappist_habitable.jpg') : null;
      const proximaB = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 24, 24),
        new THREE.MeshStandardMaterial({
          color: habMap ? 0xffffff : 0x38bdf8,
          map: habMap,
          emissive: 0x0ea5e9,
          emissiveMap: habMap,
          emissiveIntensity: 0.55,
          roughness: 0.55,
        })
      );
      proximaB.position.set(1.7, 0, 0);
      pivot.add(proximaB);
    }

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        starMesh.rotation.y = elapsed * 0.12;
        pivot.rotation.y = elapsed * 0.65;
        const pulse = 1 + Math.sin(elapsed * 2.2) * 0.045;
        coronaMesh.scale.setScalar(pulse);
      },
    };
  }

  /**
   * 3. Sistemul TRAPPIST-1: Stea pitică roșie-rubinie texturată + cele 7 exoplanete stâncoase (b, c, d, e, f, g, h).
   */
  private static createTrappistSystemModel(mode: QualityMode): {
    visualRoot: THREE.Object3D;
    updateShaderTime: (elapsed: number) => void;
  } {
    const group = new THREE.Group();
    const segs = mode === 'eco' ? 20 : 36;
    const redDwarfMap = mode === 'hd' ? this.loadDeepSpaceTexture('./textures/hd/red_dwarf_flare.jpg') : null;
    const habMap = mode === 'hd' ? this.loadDeepSpaceTexture('./textures/hd/trappist_habitable.jpg') : null;
    const rockyMap = mode === 'hd' ? this.loadDeepSpaceTexture('./textures/hd/mars_viking_albedo.jpg') : null;

    const starMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.55, segs, segs),
      new THREE.MeshBasicMaterial({
        color: redDwarfMap ? 0xffffff : 0xf43f5e,
        map: redDwarfMap,
      })
    );
    group.add(starMesh);

    const starGlow = new THREE.Mesh(
      new THREE.SphereGeometry(0.82, segs, segs),
      new THREE.MeshBasicMaterial({
        color: 0xfb7185,
        transparent: true,
        opacity: 0.28,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    group.add(starGlow);

    // Zona locuibilă (planetele e, f, g)
    const habitableZone = new THREE.Mesh(
      new THREE.RingGeometry(1.38, 1.98, 64),
      new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    habitableZone.rotation.x = Math.PI * 0.5;
    group.add(habitableZone);

    const planetColors = [
      0xf97316, // b
      0xfbbf24, // c
      0xa3e635, // d
      0x38bdf8, // e (locuibilă)
      0x06b6d4, // f (locuibilă)
      0x60a5fa, // g (locuibilă)
      0xc084fc, // h (înghețată)
    ];

    const planetPivots: Array<{ pivot: THREE.Group; speed: number }> = [];

    for (let i = 0; i < 7; i++) {
      const orbitR = 0.82 + i * 0.24;
      const isHabitable = i >= 3 && i <= 5;
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(orbitR - 0.012, orbitR + 0.012, 48),
        new THREE.MeshBasicMaterial({
          color: isHabitable ? 0x34d399 : 0xfda4af,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.32,
          depthWrite: false,
        })
      );
      ring.rotation.x = Math.PI * 0.5;
      group.add(ring);

      const pivot = new THREE.Group();
      pivot.rotation.y = i * 0.9;
      const pMap = isHabitable ? habMap : rockyMap;
      const planetMesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 16, 16),
        new THREE.MeshBasicMaterial({
          color: planetColors[i],
          map: pMap,
        })
      );
      planetMesh.position.set(orbitR, 0, 0);
      pivot.add(planetMesh);
      group.add(pivot);

      planetPivots.push({ pivot, speed: 1.4 / Math.pow(i + 1, 0.65) });
    }

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        starMesh.rotation.y = elapsed * 0.18;
        for (const p of planetPivots) {
          p.pivot.rotation.y = elapsed * p.speed;
        }
      },
    };
  }

  /**
   * 4. Exoplaneta 55 Cancri e: „Planeta de Lavă și Diamant” cu harta 2K a oceanelor incandescente de magmă (Spitzer PIA20068).
   */
  private static createLavaExoplanetModel(mode: QualityMode): {
    visualRoot: THREE.Object3D;
    updateShaderTime: (elapsed: number) => void;
  } {
    const group = new THREE.Group();
    const segs = mode === 'eco' ? 24 : 48;
    const lavaMap = mode === 'hd' ? this.loadDeepSpaceTexture('./textures/hd/cancri55e_lava.jpg') : null;

    const coreLava = new THREE.Mesh(
      new THREE.SphereGeometry(0.88, segs, segs),
      new THREE.MeshStandardMaterial({
        color: lavaMap ? 0xffffff : 0x450a0a,
        map: lavaMap,
        emissive: new THREE.Color(lavaMap ? 0xffffff : 0xf97316),
        emissiveMap: lavaMap,
        emissiveIntensity: lavaMap ? 0.95 : 0.85,
        roughness: 0.45,
        metalness: 0.25,
      })
    );
    group.add(coreLava);

    const magmaHalo = new THREE.Mesh(
      new THREE.SphereGeometry(1.12, 24, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfb923c,
        transparent: true,
        opacity: 0.26,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      })
    );
    group.add(magmaHalo);

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        coreLava.rotation.y = elapsed * 0.35;
        magmaHalo.scale.setScalar(1 + Math.sin(elapsed * 3.1) * 0.04);
      },
    };
  }

  /**
   * 5. Roiul Stelar Pleiadele („Cloșca cu Pui” M45): Stele tinere albastre învăluite în nebuloasă de reflexie.
   */
  private static createStarClusterModel(mode: QualityMode): {
    visualRoot: THREE.Object3D;
    updateShaderTime: (elapsed: number) => void;
  } {
    const group = new THREE.Group();
    const dustCount = mode === 'eco' ? 750 : 2800;
    const positions = new Float32Array(dustCount * 3);
    const colors = new Float32Array(dustCount * 3);

    let seed = 55123;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const cBlue = new THREE.Color('#38bdf8');
    const cWhite = new THREE.Color('#e0f2fe');
    const cIndigo = new THREE.Color('#60a5fa');

    for (let i = 0; i < dustCount; i++) {
      const r = Math.pow(rand(), 0.7) * 1.75;
      const theta = rand() * Math.PI * 2;
      const phi = Math.acos(rand() * 2 - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.cos(phi) * 0.65;
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);

      const c = i % 3 === 0 ? cWhite : i % 2 === 0 ? cBlue : cIndigo;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const cloud = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: mode === 'eco' ? 0.24 : 0.17,
        vertexColors: true,
        transparent: true,
        opacity: 0.75,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(cloud);

    // Cele 7 surori principale (Alcyone, Atlas, Electra, Maia, Merope, Taygeta, Pleione)
    const brightOffsets: Array<[number, number, number, number]> = [
      [0, 0, 0, 0.22],
      [-0.65, 0.18, 0.32, 0.17],
      [0.58, -0.14, -0.28, 0.16],
      [-0.38, -0.24, -0.52, 0.16],
      [0.42, 0.26, 0.48, 0.15],
      [-0.82, -0.08, 0.12, 0.14],
      [0.78, 0.12, -0.15, 0.14],
    ];
    for (const [x, y, z, r] of brightOffsets) {
      const s = new THREE.Mesh(
        new THREE.SphereGeometry(r, 16, 16),
        new THREE.MeshBasicMaterial({ color: 0xe0f2fe })
      );
      s.position.set(x, y, z);
      group.add(s);
    }

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        group.rotation.y = elapsed * 0.04;
      },
    };
  }

  /**
   * 6. Nebuloase (Nebuloasa Orion M42 & Stâlpii Creației M16): Nori volumetrici din particule cu AdditiveBlending.
   */
  private static createNebulaModel(
    data: CelestialBodyData,
    mode: QualityMode
  ): { visualRoot: THREE.Object3D; updateShaderTime: (elapsed: number) => void } {
    const group = new THREE.Group();
    const isPillars = data.id === 'pillars_of_creation';
    const count = mode === 'eco' ? 1100 : 4200;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);

    let seed = isPillars ? 77211 : 88321;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const colA = new THREE.Color(isPillars ? '#fbbf24' : '#e879f9');
    const colB = new THREE.Color(isPillars ? '#38bdf8' : '#818cf8');
    const colC = new THREE.Color(isPillars ? '#f97316' : '#2dd4bf');

    for (let i = 0; i < count; i++) {
      if (isPillars) {
        // 3 coloane ascendente („Stâlpii Creației”)
        const pillarIdx = i % 3;
        const baseX = (pillarIdx - 1) * 0.65;
        const h = (rand() - 0.45) * 2.1;
        const spread = 0.24 + (1 - (h + 1) * 0.35) * 0.18;
        positions[i * 3] = baseX + (rand() - 0.5) * spread + Math.sin(h * 1.8) * 0.12;
        positions[i * 3 + 1] = h;
        positions[i * 3 + 2] = (rand() - 0.5) * spread;
      } else {
        // Caverna luminoasă a Nebuloasei Orion (M42)
        const r = Math.pow(rand(), 0.65) * 1.65;
        const angle = rand() * Math.PI * 2;
        positions[i * 3] = Math.cos(angle) * r;
        positions[i * 3 + 1] = (rand() - 0.5) * 1.15;
        positions[i * 3 + 2] = Math.sin(angle) * r;
      }

      const mix = rand();
      const c = mix < 0.42 ? colA : mix < 0.78 ? colB : colC;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const nebulaPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: mode === 'eco' ? 0.26 : 0.19,
        vertexColors: true,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(nebulaPoints);

    // Strat fotografic real NASA/ESA/JWST (Stâlpii Creației PIA25433 sau Nebuloasa Orion PIA08653) cu mascare radială fină
    const nasaNebulaTex = this.loadDeepSpaceTexture(
      isPillars ? './textures/nasa/pillars_of_creation.jpg' : './textures/nasa/orion_nebula.jpg'
    );
    const alphaMask = this.getSoftRadialAlphaMap();
    if (nasaNebulaTex) {
      const planeMat = new THREE.MeshBasicMaterial({
        map: nasaNebulaTex,
        alphaMap: alphaMask,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const planeA = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 2.9), planeMat);
      const planeB = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), planeMat);
      planeB.rotation.y = Math.PI * 0.38;
      group.add(planeA);
      group.add(planeB);
    }

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        nebulaPoints.rotation.y = elapsed * 0.035;
      },
    };
  }

  /**
   * 7. Sagittarius A* (Gaura Neagră Supermasivă): Sferă centrală neagră (orizontul evenimentelor),
   * disc de acreție portocaliu-auriu în rotație și inel de lentilă gravitațională.
   */
  private static createBlackHoleModel(mode: QualityMode): {
    visualRoot: THREE.Object3D;
    updateShaderTime: (elapsed: number) => void;
  } {
    const group = new THREE.Group();
    const segs = mode === 'eco' ? 24 : 48;

    // 1. Orizontul evenimentelor (sferă neagră absolută)
    const shadowSphere = new THREE.Mesh(
      new THREE.SphereGeometry(0.58, segs, segs),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    group.add(shadowSphere);

    // 2. Inel fotonic și efect de lentilă gravitațională verticală
    const lensingRingVert = new THREE.Mesh(
      new THREE.RingGeometry(0.6, 0.86, segs),
      new THREE.MeshBasicMaterial({
        color: 0xffb703,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.78,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    group.add(lensingRingVert);

    // 3. Discul de acreție relativist din particule în rotație
    const diskCount = mode === 'eco' ? 1400 : 5200;
    const positions = new Float32Array(diskCount * 3);
    const colors = new Float32Array(diskCount * 3);

    let seed = 90125;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const innerHot = new THREE.Color('#fef08a');
    const midAmber = new THREE.Color('#ff9e00');
    const outerRed = new THREE.Color('#dc2626');

    for (let i = 0; i < diskCount; i++) {
      const t = rand();
      const r = 0.68 + Math.pow(t, 1.2) * 1.45;
      const angle = rand() * Math.PI * 2;
      const thickness = (rand() - 0.5) * 0.09 * (r - 0.5);

      positions[i * 3] = Math.cos(angle) * r;
      positions[i * 3 + 1] = thickness;
      positions[i * 3 + 2] = Math.sin(angle) * r;

      const c = t < 0.25 ? innerHot : t < 0.72 ? midAmber : outerRed;
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const accretionDisk = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: mode === 'eco' ? 0.16 : 0.11,
        vertexColors: true,
        transparent: true,
        opacity: 0.88,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    accretionDisk.rotation.x = 0.22;
    group.add(accretionDisk);

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        accretionDisk.rotation.y = elapsed * 0.55;
      },
    };
  }

  /**
   * 8. Calea Lactee & Galaxia Andromeda: Generator de galaxii spirale cu THREE.Points
   * (brațe spirale logaritmice, nucleu strălucitor cald și praf interstelar;
   *  4.000 de particule în modul `eco` pentru 60 FPS garantat, 25.000 de particule în modul `hd`).
   */
  private static createSpiralGalaxyModel(
    data: CelestialBodyData,
    mode: QualityMode
  ): { visualRoot: THREE.Object3D; updateShaderTime: (elapsed: number) => void } {
    const group = new THREE.Group();
    const isMilkyWay = data.id === 'milky_way';
    const particleCount = mode === 'eco' ? 4000 : 25000;

    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    let seed = isMilkyWay ? 104729 : 209715;
    const rand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    const coreColor = new THREE.Color(isMilkyWay ? '#fde68a' : '#fef3c7');
    const armColor = new THREE.Color(isMilkyWay ? '#38bdf8' : '#c084fc');
    const outerColor = new THREE.Color(isMilkyWay ? '#1d4ed8' : '#6366f1');
    const nebulaKnotColor = new THREE.Color('#f472b6');
    const tempColor = new THREE.Color();

    const arms = 4;
    const maxRadius = 2.6;
    const spinFactor = isMilkyWay ? 3.8 : 4.2;

    for (let i = 0; i < particleCount; i++) {
      const ratio = Math.pow(rand(), 1.35);
      const radius = ratio * maxRadius;
      const armIndex = i % arms;
      const baseAngle = (armIndex / arms) * Math.PI * 2;
      const spinAngle = radius * spinFactor;

      const scatterPower = 0.16 + (1 - ratio) * 0.22;
      const randX = (rand() - 0.5) * scatterPower * maxRadius;
      const randY = (rand() - 0.5) * (0.09 + (1 - ratio) * 0.18);
      const randZ = (rand() - 0.5) * scatterPower * maxRadius;

      const angle = baseAngle + spinAngle;
      positions[i * 3] = Math.cos(angle) * radius + randX;
      positions[i * 3 + 1] = randY;
      positions[i * 3 + 2] = Math.sin(angle) * radius + randZ;

      if (ratio < 0.22) {
        tempColor.copy(coreColor).lerp(armColor, ratio / 0.22);
      } else if (i % 29 === 0) {
        tempColor.copy(nebulaKnotColor);
      } else {
        tempColor.copy(armColor).lerp(outerColor, (ratio - 0.22) / 0.78);
      }

      colors[i * 3] = tempColor.r;
      colors[i * 3 + 1] = tempColor.g;
      colors[i * 3 + 2] = tempColor.b;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const galaxyPoints = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: mode === 'eco' ? 0.085 : 0.048,
        vertexColors: true,
        transparent: true,
        opacity: 0.86,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    if (!isMilkyWay) {
      galaxyPoints.rotation.x = 0.42;
      galaxyPoints.rotation.z = -0.25;
    }
    group.add(galaxyPoints);

    // Disc galactic texturat cu imaginea oficială NASA/JPL Spitzer/GALEX (Calea Lactee PIA19341 / Andromeda PIA15416)
    const galaxyTex = this.loadDeepSpaceTexture(
      isMilkyWay ? './textures/nasa/milky_way.jpg' : './textures/nasa/andromeda.jpg'
    );
    const alphaMask = this.getSoftRadialAlphaMap();
    let galaxyDiscMesh: THREE.Mesh | null = null;
    if (galaxyTex) {
      galaxyDiscMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(4.8, 4.8),
        new THREE.MeshBasicMaterial({
          map: galaxyTex,
          alphaMap: alphaMask,
          transparent: true,
          opacity: 0.58,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
      );
      galaxyDiscMesh.rotation.x = Math.PI * 0.5 + (isMilkyWay ? 0 : 0.42);
      if (!isMilkyWay) {
        galaxyDiscMesh.rotation.z = -0.25;
      }
      group.add(galaxyDiscMesh);
    }

    // Pentru Calea Lactee, adăugăm inelul-reper în Brațul Orion (~la jumătatea razei)
    if (isMilkyWay) {
      const sunMarker = new THREE.Mesh(
        new THREE.RingGeometry(0.11, 0.16, 32),
        new THREE.MeshBasicMaterial({
          color: 0x00f0ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.92,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      sunMarker.rotation.x = Math.PI * 0.5;
      sunMarker.position.set(1.15, 0.05, 0.45);
      group.add(sunMarker);
    }

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        galaxyPoints.rotation.y = elapsed * 0.022;
        if (galaxyDiscMesh && isMilkyWay) {
          galaxyDiscMesh.rotation.z = -elapsed * 0.022;
        }
      },
    };
  }
}

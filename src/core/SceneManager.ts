// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { PlanetMaterialFactory } from './PlanetMaterialFactory';
import { QualityMode } from './QualityManager';

export type FrameUpdateCallback = (deltaSeconds: number, elapsedSeconds: number) => void;

/**
 * SceneManager gestionează scena Three.js principală a planetariului Orbitar:
 * - Câmpul stelar procedural (THREE.Points cu distribuție sferică și culori spectrale)
 * - Iluminarea solară (PointLight heliocetric fără atenuare + lumină ambientală didactică)
 * - Camera perspectivă și OrbitControls cu amortizare lină (smooth damping)
 */
export class SceneManager {
  public readonly scene: THREE.Scene;
  public readonly camera: THREE.PerspectiveCamera;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly controls: OrbitControls;
  public readonly sunLight: THREE.PointLight;
  public readonly starfield: THREE.Points;

  private readonly container: HTMLElement;
  private readonly clock: THREE.Clock;
  private readonly updateCallbacks: Set<FrameUpdateCallback> = new Set();
  private animationFrameId: number | null = null;
  private activeQualityMode: QualityMode = 'hd';

  constructor(container: HTMLElement) {
    this.container = container;
    this.clock = new THREE.Clock();

    // 1. Scena 3D
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070d);

    // 2. Camera cu frustum larg și suport pentru atât Scara Didactică, cât și Scara Reală
    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, width / height, 0.0001, 60000);
    this.camera.position.set(0, 75, 135);

    // 3. Renderer WebGL cu buffer de adâncime logaritmic pentru precizie la scări extreme
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      logarithmicDepthBuffer: true,
    });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    PlanetMaterialFactory.configureRenderer(this.renderer);
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls cu amortizare lină (smooth damping)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.06;
    this.controls.rotateSpeed = 0.75;
    this.controls.zoomSpeed = 1.15;
    this.controls.panSpeed = 0.8;
    this.controls.minDistance = 0.0005;
    this.controls.maxDistance = 25000;
    this.controls.target.set(0, 0, 0);

    // 5. Iluminare solară caldă (contrast clar zi/noapte la terminator) și ambientală subtilă
    this.sunLight = new THREE.PointLight(0xfff4d6, 3.6, 0, 0);
    this.sunLight.position.set(0, 0, 0);
    this.scene.add(this.sunLight);

    const ambientLight = new THREE.AmbientLight(0x1e2c4a, 0.78);
    this.scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x5078e8, 0x090d18, 0.38);
    this.scene.add(hemiLight);

    // 6. Câmp stelar procedural (THREE.Points)
    this.starfield = this.createProceduralStarfield(6500);
    this.scene.add(this.starfield);

    window.addEventListener('resize', this.handleResize);
  }

  /**
   * Generează un câmp stelar procedural (`THREE.Points`) distribuit uniform pe sfera cerească,
   * cu temperaturi de culoare inspirate din clasificarea spectrală (O, B, A, F, G, K, M).
   */
  private createProceduralStarfield(starCount: number): THREE.Points {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);

    const spectralPalette = [
      new THREE.Color(0x9bb0ff), // O/B - albastru-alb fierbinte
      new THREE.Color(0xcad7ff), // A - alb-albăstrui
      new THREE.Color(0xf8f7ff), // F - alb pur
      new THREE.Color(0xfff4ea), // G - galben-alb (ca Soarele)
      new THREE.Color(0xffd2a1), // K - portocaliu cald
      new THREE.Color(0xffcc6f), // M - roșiatic-auriu
    ];

    // Generator determinist LCG pentru consistență vizuală și încărcare instantanee
    let seed = 421989;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < starCount; i++) {
      const u = nextRand();
      const v = nextRand();
      const theta = 2 * Math.PI * u;
      const phi = Math.acos(2 * v - 1);
      const radius = 8500 + nextRand() * 9000;

      const sinPhi = Math.sin(phi);
      positions[i * 3] = radius * sinPhi * Math.cos(theta);
      positions[i * 3 + 1] = radius * Math.cos(phi);
      positions[i * 3 + 2] = radius * sinPhi * Math.sin(theta);

      const baseColor = spectralPalette[Math.floor(nextRand() * spectralPalette.length)];
      const brightness = 0.55 + 0.45 * nextRand();
      colors[i * 3] = baseColor.r * brightness;
      colors[i * 3 + 1] = baseColor.g * brightness;
      colors[i * 3 + 2] = baseColor.b * brightness;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starSprite = this.createStarSpriteTexture();
    const material = new THREE.PointsMaterial({
      size: 26,
      map: starSprite,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const points = new THREE.Points(geometry, material);
    points.name = 'ProceduralStarfield';
    return points;
  }

  /**
   * Creează o textură radială fină pe un canvas local (100% offline, fără resurse externe).
   */
  private createStarSpriteTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
      gradient.addColorStop(0.25, 'rgba(220, 240, 255, 0.85)');
      gradient.addColorStop(0.6, 'rgba(120, 180, 255, 0.22)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  public onUpdate(callback: FrameUpdateCallback): () => void {
    this.updateCallbacks.add(callback);
    return () => this.updateCallbacks.delete(callback);
  }

  public start(): void {
    if (this.animationFrameId !== null) return;
    this.clock.start();
    const animate = () => {
      this.animationFrameId = window.requestAnimationFrame(animate);
      const deltaSeconds = Math.min(this.clock.getDelta(), 0.1);
      const elapsedSeconds = this.clock.elapsedTime;

      for (const cb of this.updateCallbacks) {
        cb(deltaSeconds, elapsedSeconds);
      }

      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    animate();
  }

  public stop(): void {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  public applyQualityProfile(mode: QualityMode): void {
    this.activeQualityMode = mode;
    const pixelRatio = mode === 'eco' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pixelRatio);
  }

  private handleResize = (): void => {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    const pixelRatio = this.activeQualityMode === 'eco' ? 1 : Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(width, height);
  };

  public dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.controls.dispose();
    this.renderer.dispose();
  }
}

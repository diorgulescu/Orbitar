// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CelestialBodyInstance, OrbitalEngine } from './OrbitalEngine';
import { ScaleManager } from './ScaleManager';

export type BodySelectCallback = (body: CelestialBodyInstance | null) => void;

/**
 * CameraController gestionează:
 * - Raycasting 3D cu zone de click generoase (inclusiv detecție în spațiul ecranului pentru Scara Reală)
 * - Tranziție lină (smooth lerp) către corpul ceresc selectat
 * - Urmărire orbitală continuă (camera călătorește împreună cu planeta pe orbită,
 *   permițând în același timp rotația și zoom-ul liber cu OrbitControls în jurul țintei)
 */
export class CameraController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly controls: OrbitControls;
  private readonly domElement: HTMLElement;
  private readonly orbitalEngine: OrbitalEngine;
  private readonly scaleManager: ScaleManager;

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointerNdc = new THREE.Vector2();
  private readonly pointerDownPos = new THREE.Vector2();
  private pointerDownTime = 0;

  private trackedBody: CelestialBodyInstance | null = null;
  private readonly lastTrackedWorldPos = new THREE.Vector3();
  private lastParentRotY = 0;
  private isTransitioning = false;
  private enabled = true;
  private readonly desiredCameraOffset = new THREE.Vector3(0, 75, 135);
  private readonly selectCallbacks: Set<BodySelectCallback> = new Set();

  constructor(
    camera: THREE.PerspectiveCamera,
    controls: OrbitControls,
    domElement: HTMLElement,
    orbitalEngine: OrbitalEngine,
    scaleManager: ScaleManager
  ) {
    this.camera = camera;
    this.controls = controls;
    this.domElement = domElement;
    this.orbitalEngine = orbitalEngine;
    this.scaleManager = scaleManager;

    this.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.domElement.addEventListener('pointerup', this.handlePointerUp);
    this.domElement.addEventListener('pointermove', this.handlePointerMove);

    // Dacă utilizatorul rotește sau face zoom manual în timpul apropierii, oprim doar forțarea offsetului,
    // păstrând însă ținta (controls.target) ancorată pe planeta urmărită.
    this.controls.addEventListener('start', () => {
      this.isTransitioning = false;
    });

    // La schimbarea scării (Didactică <-> Reală), reîncadrăm lin corpul urmărit
    this.scaleManager.onChange(() => {
      if (this.trackedBody) {
        this.focusBody(this.trackedBody.meta.id);
      } else {
        this.resetToOverview();
      }
    });
  }

  public onSelect(callback: BodySelectCallback): () => void {
    this.selectCallbacks.add(callback);
    return () => this.selectCallbacks.delete(callback);
  }

  public getTrackedBody(): CelestialBodyInstance | null {
    return this.trackedBody;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.controls.enabled = enabled;
    if (!enabled) {
      this.isTransitioning = false;
      this.domElement.style.cursor = 'crosshair';
    } else {
      this.domElement.style.cursor = 'grab';
      if (this.trackedBody) {
        this.lastTrackedWorldPos.copy(this.trackedBody.worldPosition);
      }
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Selectează un corp ceresc după ID și inițiază tranziția lină (smooth lerp + urmărire orbitală).
   */
  public focusBody(bodyId: string): void {
    const body = this.orbitalEngine.getBody(bodyId);
    if (!body) return;

    this.trackedBody = body;
    this.lastTrackedWorldPos.copy(body.worldPosition);

    // Calculăm o distanță de observare confortabilă în funcție de raza vizuală a corpului
    const r = body.visualRadius;
    const parent = body.data.parentId ? this.orbitalEngine.getBody(body.data.parentId) : undefined;

    if (body.data.category === 'rover' && parent) {
      this.lastParentRotY = parent.visualRoot.rotation.y;
      const surfaceNormal = body.worldPosition.clone().sub(parent.worldPosition);
      if (surfaceNormal.lengthSq() < 0.000001) {
        surfaceNormal.set(0, 0.35, 1);
      }
      surfaceNormal.normalize();
      const viewDir = surfaceNormal.clone().add(new THREE.Vector3(0, 0.22, 0)).normalize();
      const roverDist = Math.max(parent.visualRadius * 1.45, 0.004);
      this.desiredCameraOffset.copy(viewDir).multiplyScalar(roverDist);
      this.isTransitioning = true;

      for (const cb of this.selectCallbacks) {
        cb(body);
      }
      return;
    }

    const viewDist =
      body.meta.id === 'sun'
        ? Math.max(r * 4.8, 12)
        : Math.max(r * 4.5, 0.0025);

    // Alegem o direcție de privire care să pună în valoare emisfera iluminată de Soare
    const sunToBody = body.worldPosition.clone();
    if (sunToBody.lengthSq() < 0.0001) {
      sunToBody.set(0, 0.45, 1).normalize();
    } else {
      sunToBody.normalize();
    }

    // Direcție lateral-iluminată + ușor deasupra planului eclipticii
    const sideVec = new THREE.Vector3(-sunToBody.z, 0, sunToBody.x).normalize();
    const viewDir = sunToBody
      .clone()
      .multiplyScalar(-0.55)
      .addScaledVector(sideVec, 0.75)
      .add(new THREE.Vector3(0, 0.42, 0))
      .normalize();

    this.desiredCameraOffset.copy(viewDir).multiplyScalar(viewDist);
    this.isTransitioning = true;

    for (const cb of this.selectCallbacks) {
      cb(body);
    }
  }

  /**
   * Readuce camera la o vedere panoramică asupra întregului Sistem Solar.
   */
  public resetToOverview(): void {
    const sun = this.orbitalEngine.getBody('sun') ?? null;
    this.trackedBody = sun;
    this.lastTrackedWorldPos.set(0, 0, 0);

    if (this.scaleManager.getMode() === 'real') {
      this.desiredCameraOffset.set(0, 165, 290);
    } else {
      this.desiredCameraOffset.set(0, 75, 135);
    }
    this.isTransitioning = true;

    for (const cb of this.selectCallbacks) {
      cb(sun);
    }
  }

  /**
   * Actualizează în fiecare cadru urmărirea orbitală și interpolarea lină (smooth lerp) a camerei.
   */
  public update(deltaSeconds: number): void {
    if (!this.enabled || !this.trackedBody) return;

    const currentBodyPos = this.trackedBody.worldPosition;

    // 1. Deplasăm camera cu exact vectorul parcurs de planetă pe orbită în acest cadru
    const orbitalDelta = currentBodyPos.clone().sub(this.lastTrackedWorldPos);
    this.camera.position.add(orbitalDelta);
    this.lastTrackedWorldPos.copy(currentBodyPos);

    // 2. Interpolare lină (exponential smooth lerp) pentru ținta OrbitControls și poziția camerei
    const lerpAlpha = 1 - Math.exp(-5.5 * Math.max(deltaSeconds, 0.008));
    this.controls.target.lerp(currentBodyPos, lerpAlpha);

    // Pentru roverele ancorate ca pinpoint pe suprafața rotitoare a lui Marte, menținem camera sincronizată cu rotația lui Marte
    if (this.trackedBody.data.category === 'rover' && this.trackedBody.data.parentId) {
      const parent = this.orbitalEngine.getBody(this.trackedBody.data.parentId);
      if (parent) {
        const deltaRotY = parent.visualRoot.rotation.y - this.lastParentRotY;
        this.lastParentRotY = parent.visualRoot.rotation.y;

        const surfaceNormal = currentBodyPos.clone().sub(parent.worldPosition).normalize();
        const roverDist = Math.max(parent.visualRadius * 1.45, 0.004);
        const viewDir = surfaceNormal.clone().add(new THREE.Vector3(0, 0.22, 0)).normalize();
        this.desiredCameraOffset.copy(viewDir).multiplyScalar(roverDist);

        if (!this.isTransitioning && Math.abs(deltaRotY) > 0.000001) {
          const spinAxis = new THREE.Vector3(0, 1, 0).applyEuler(
            new THREE.Euler(0, 0, parent.visualRoot.rotation.z)
          );
          const camRel = this.camera.position.clone().sub(currentBodyPos);
          camRel.applyAxisAngle(spinAxis, deltaRotY);
          this.camera.position.copy(currentBodyPos).add(camRel);
        }

        // Prevenim pătrunderea camerei în interiorul sferei planetei Marte în timpul rotației acesteia
        const camFromParent = this.camera.position.clone().sub(parent.worldPosition);
        const minSafeRadius = parent.visualRadius * 1.38;
        if (camFromParent.length() < minSafeRadius) {
          camFromParent.normalize().multiplyScalar(minSafeRadius);
          this.camera.position.copy(parent.worldPosition).add(camFromParent);
        }
      }
    }

    if (this.isTransitioning) {
      const desiredCamPos = currentBodyPos.clone().add(this.desiredCameraOffset);
      this.camera.position.lerp(desiredCamPos, lerpAlpha);

      if (
        this.camera.position.distanceTo(desiredCamPos) <
        Math.max(this.trackedBody.visualRadius * 0.08, 0.0005)
      ) {
        this.isTransitioning = false;
      }
    }
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (!this.enabled) return;
    this.pointerDownPos.set(event.clientX, event.clientY);
    this.pointerDownTime = performance.now();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.enabled) return;
    const dx = event.clientX - this.pointerDownPos.x;
    const dy = event.clientY - this.pointerDownPos.y;
    const distPx = Math.hypot(dx, dy);
    const elapsedMs = performance.now() - this.pointerDownTime;

    // Ignorăm gesturile de drag/orbitare ale camerei
    if (distPx > 8 || elapsedMs > 600) return;

    const pickedBody = this.pickBodyAtClientCoords(event.clientX, event.clientY);
    if (pickedBody) {
      this.focusBody(pickedBody.meta.id);
    }
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.enabled) return;
    const pickedBody = this.pickBodyAtClientCoords(event.clientX, event.clientY);
    this.domElement.style.cursor = pickedBody ? 'pointer' : 'grab';
  };

  /**
   * Raycasting 3D combinat cu o zonă de captură generoasă în spațiul ecranului (28px),
   * astfel încât copiii să poată da click ușor pe orice planetă chiar și de la distanță mare.
   */
  public pickBodyAtClientCoords(clientX: number, clientY: number): CelestialBodyInstance | null {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const targets = this.orbitalEngine.getRaycastTargets();
    const hits = this.raycaster.intersectObjects(targets, true);

    if (hits.length > 0) {
      for (const hit of hits) {
        let obj: THREE.Object3D | null = hit.object;
        while (obj) {
          const bodyId = obj.userData?.bodyId as string | undefined;
          if (bodyId) {
            const body = this.orbitalEngine.getBody(bodyId);
            if (body) return body;
          }
          obj = obj.parent;
        }
      }
    }

    // Fallback generos în spațiul 2D al ecranului (rază 28 pixeli)
    let closestBody: CelestialBodyInstance | null = null;
    let minPixelDist = 28;
    const projected = new THREE.Vector3();

    for (const body of this.orbitalEngine.getBodies()) {
      if (body.data.category === 'rover') continue;
      projected.copy(body.worldPosition).project(this.camera);
      if (projected.z < -1 || projected.z > 1) continue;

      const screenX = ((projected.x + 1) * 0.5) * rect.width + rect.left;
      const screenY = ((-projected.y + 1) * 0.5) * rect.height + rect.top;
      const distPx = Math.hypot(clientX - screenX, clientY - screenY);

      if (distPx < minPixelDist) {
        minPixelDist = distPx;
        closestBody = body;
      }
    }

    return closestBody;
  }

  public dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.domElement.removeEventListener('pointerup', this.handlePointerUp);
    this.domElement.removeEventListener('pointermove', this.handlePointerMove);
  }
}

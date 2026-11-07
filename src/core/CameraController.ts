// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AgeTier } from '../types/celestial';
import { CelestialBodyInstance, OrbitalEngine } from './OrbitalEngine';
import { ScaleManager } from './ScaleManager';

export type BodySelectCallback = (body: CelestialBodyInstance | null) => void;

/**
 * CameraController gestionează:
 * - Raycasting 3D cu zone de click generoase (inclusiv detecție în spațiul ecranului pentru Scara Reală)
 * - Tranziție lină (smooth lerp) către corpul ceresc selectat
 * - Urmărire orbitală continuă (camera călătorește împreună cu planeta pe orbită,
 *   permițând în același timp rotația și zoom-ul liber cu OrbitControls în jurul țintei)
 * - Încadrarea panoramică adaptată grupei de vârstă (apropiată pentru Micul Explorator 6–8 ani,
 *   zoom-out „de departe” peste întregul Sistem Solar pentru Cadet Orbitar 9–12+ ani)
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
  private lastHoverCheckMs = 0;
  private lastCursorStyle = '';
  private readonly tempProjectedVec = new THREE.Vector3();

  private trackedBody: CelestialBodyInstance | null = null;
  private readonly lastTrackedWorldPos = new THREE.Vector3();
  private lastParentRotY = 0;
  private isTransitioning = false;
  private enabled = true;
  private ageTier: AgeTier = 'junior';
  private readonly desiredCameraOffset = new THREE.Vector3(0, 75, 135);
  private readonly tempOrbitalDelta = new THREE.Vector3();
  private readonly tempSurfaceNormal = new THREE.Vector3();
  private readonly tempViewDir = new THREE.Vector3();
  private readonly tempSpinAxis = new THREE.Vector3();
  private readonly tempCamRel = new THREE.Vector3();
  private readonly tempCamFromParent = new THREE.Vector3();
  private readonly tempDesiredCamPos = new THREE.Vector3();
  private readonly tempSpinEuler = new THREE.Euler();
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

    // La schimbarea scării (Didactică <-> Reală), reîncadrăm imediat corpul urmărit la noua scară
    this.scaleManager.onChange(() => {
      if (this.trackedBody && this.trackedBody.meta.id !== 'sun') {
        this.focusBody(this.trackedBody.meta.id, true);
      } else {
        this.resetToOverview();
      }
    });
  }

  public getAgeTier(): AgeTier {
    return this.ageTier;
  }

  /**
   * Actualizează grupa de vârstă activă și, dacă ne aflăm în vederea de ansamblu (Soare),
   * ajustează automat zoom-ul panoramic (apropiat pentru Junior 6–8 ani, vedere largă de departe pentru Cadet 9–12 ani).
   */
  public setAgeTier(tier: AgeTier, updateOverviewIfAtSun = true): void {
    this.ageTier = tier;
    if (updateOverviewIfAtSun && (!this.trackedBody || this.trackedBody.meta.id === 'sun')) {
      this.resetToOverview();
    }
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
  public focusBody(bodyId: string, snapImmediately = false): void {
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
      const roverDist = parent.visualRadius * 1.45;
      this.controls.minDistance = Math.max(parent.visualRadius * 1.15, 1e-10);
      this.desiredCameraOffset.copy(viewDir).multiplyScalar(roverDist);

      if (snapImmediately) {
        this.controls.target.copy(body.worldPosition);
        this.camera.position.copy(body.worldPosition).add(this.desiredCameraOffset);
        this.isTransitioning = false;
      } else {
        this.isTransitioning = true;
      }

      for (const cb of this.selectCallbacks) {
        cb(body);
      }
      return;
    }

    const isSpacecraft =
      body.data.category === 'station' ||
      body.data.category === 'telescope' ||
      body.data.category === 'probe';
    const viewDist =
      body.meta.id === 'sun'
        ? this.scaleManager.getMode() === 'real'
          ? r * 4.8
          : Math.max(r * 4.8, 12)
        : isSpacecraft
        ? r * 10.5
        : r * 4.5;

    this.controls.minDistance = Math.max(r * 1.25, 1e-10);

    let viewDir: THREE.Vector3;

    if (isSpacecraft && parent) {
      // Pentru stațiile și telescoapele de pe orbita Pământului (ISS, Hubble, JWST, Euclid),
      // construim o bază ortonormată locală (localRadial, tangent, binormal) și plasăm camera
      // ușor sub/lateral față de direcția radială locală (privind spre exterior și tangențial la orbită),
      // astfel încât ISS să NU fie niciodată suprapusă în perspectivă forțată peste discul Pământului!
      const localRadial = body.worldPosition.clone().sub(parent.worldPosition);
      if (localRadial.lengthSq() < 1e-16) {
        localRadial.set(1, 0, 0);
      } else {
        localRadial.normalize();
      }
      const upRef =
        Math.abs(localRadial.y) < 0.9
          ? new THREE.Vector3(0, 1, 0)
          : new THREE.Vector3(1, 0, 0);
      const tangent = new THREE.Vector3().crossVectors(upRef, localRadial).normalize();
      const binormal = new THREE.Vector3().crossVectors(localRadial, tangent).normalize();
      viewDir = localRadial
        .clone()
        .multiplyScalar(-0.26)
        .addScaledVector(tangent, 0.92)
        .addScaledVector(binormal, 0.28)
        .normalize();
    } else {
      // Alegem o direcție de privire care să pună în valoare emisfera iluminată de Soare
      const sunToBody = body.worldPosition.clone();
      if (sunToBody.lengthSq() < 0.0001) {
        sunToBody.set(0, 0.45, 1).normalize();
      } else {
        sunToBody.normalize();
      }

      // Direcție lateral-iluminată + ușor deasupra planului eclipticii
      const sideVec = new THREE.Vector3(-sunToBody.z, 0, sunToBody.x).normalize();
      viewDir = sunToBody
        .clone()
        .multiplyScalar(-0.55)
        .addScaledVector(sideVec, 0.75)
        .add(new THREE.Vector3(0, 0.42, 0))
        .normalize();
    }

    this.desiredCameraOffset.copy(viewDir).multiplyScalar(viewDist);

    if (snapImmediately) {
      this.controls.target.copy(body.worldPosition);
      this.camera.position.copy(body.worldPosition).add(this.desiredCameraOffset);
      this.isTransitioning = false;
    } else {
      // Dacă facem saltul de la scară planetară/interplanetară către un satelit sau o sondă microscopică,
      // aducem camera în vecinătatea țintei (3.2× viewDist) pentru o apropiere lină și precisă pe ultimii metri.
      const currentDist = this.camera.position.distanceTo(body.worldPosition);
      if (currentDist > viewDist * 80) {
        this.controls.target.copy(body.worldPosition);
        this.camera.position
          .copy(body.worldPosition)
          .addScaledVector(this.desiredCameraOffset, 3.2);
      }
      this.isTransitioning = true;
    }

    for (const cb of this.selectCallbacks) {
      cb(body);
    }
  }

  /**
   * Readuce camera la o vedere panoramică asupra întregului Sistem Solar,
   * adaptată scării active (Didactică vs Reală) și grupei de vârstă:
   * - Pentru Micul Explorator (6–8 ani, `junior`): cadru mai apropiat și prietenos asupra planetelor.
   * - Pentru Cadet Orbitar (9–12+ ani, `cadet`): zoom-out „de departe” care cuprinde întregul Sistem Solar.
   */
  public resetToOverview(snapImmediately = false): void {
    const sun = this.orbitalEngine.getBody('sun') ?? null;
    this.trackedBody = sun;
    this.lastTrackedWorldPos.set(0, 0, 0);

    if (this.scaleManager.getMode() === 'real') {
      if (this.ageTier === 'cadet') {
        this.desiredCameraOffset.set(0, 380, 680);
      } else {
        this.desiredCameraOffset.set(0, 165, 290);
      }
    } else if (this.ageTier === 'cadet') {
      this.desiredCameraOffset.set(0, 195, 360);
    } else {
      this.desiredCameraOffset.set(0, 75, 135);
    }

    if (snapImmediately) {
      this.controls.target.set(0, 0, 0);
      this.camera.position.copy(this.desiredCameraOffset);
      this.isTransitioning = false;
    } else {
      this.isTransitioning = true;
    }

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

    // 1. Deplasăm atât camera, cât și ținta OrbitControls cu exact vectorul parcurs de corp pe orbită în acest cadru
    this.tempOrbitalDelta.copy(currentBodyPos).sub(this.lastTrackedWorldPos);
    this.camera.position.add(this.tempOrbitalDelta);
    this.controls.target.add(this.tempOrbitalDelta);
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

        this.tempSurfaceNormal.copy(currentBodyPos).sub(parent.worldPosition).normalize();
        const roverDist = parent.visualRadius * 1.45;
        this.tempViewDir.copy(this.tempSurfaceNormal);
        this.tempViewDir.y += 0.22;
        this.tempViewDir.normalize();
        this.desiredCameraOffset.copy(this.tempViewDir).multiplyScalar(roverDist);

        if (!this.isTransitioning && Math.abs(deltaRotY) > 0.000001) {
          this.tempSpinEuler.set(0, 0, parent.visualRoot.rotation.z);
          this.tempSpinAxis.set(0, 1, 0).applyEuler(this.tempSpinEuler);
          this.tempCamRel.copy(this.camera.position).sub(currentBodyPos);
          this.tempCamRel.applyAxisAngle(this.tempSpinAxis, deltaRotY);
          this.camera.position.copy(currentBodyPos).add(this.tempCamRel);
        }

        // Prevenim pătrunderea camerei în interiorul sferei planetei Marte în timpul rotației acesteia
        this.tempCamFromParent.copy(this.camera.position).sub(parent.worldPosition);
        const minSafeRadius = parent.visualRadius * 1.38;
        if (this.tempCamFromParent.length() < minSafeRadius) {
          this.tempCamFromParent.normalize().multiplyScalar(minSafeRadius);
          this.camera.position.copy(parent.worldPosition).add(this.tempCamFromParent);
        }
      }
    }

    if (this.isTransitioning) {
      this.tempDesiredCamPos.copy(currentBodyPos).add(this.desiredCameraOffset);
      this.camera.position.lerp(this.tempDesiredCamPos, lerpAlpha);

      if (
        this.camera.position.distanceTo(this.tempDesiredCamPos) <
        Math.max(this.trackedBody.visualRadius * 0.04, 1e-10)
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
    // Dacă utilizatorul ține apăsat butonul mouse-ului (rotație/pan OrbitControls), nu facem raycasting
    if (event.buttons !== 0) return;

    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastHoverCheckMs < 55) return;
    this.lastHoverCheckMs = nowMs;

    const pickedBody = this.pickBodyAtClientCoords(event.clientX, event.clientY);
    const nextCursor = pickedBody ? 'var(--cursor-orbitar-pointer)' : 'var(--cursor-orbitar-grab)';
    if (nextCursor !== this.lastCursorStyle) {
      this.lastCursorStyle = nextCursor;
      this.domElement.style.cursor = nextCursor;
    }
  };

  /**
   * Raycasting 3D rapid pe sferele de selecție (`hitMesh`, fără traversarea recursivă a geometriilor HD)
   * combinat cu o zonă de captură generoasă în spațiul ecranului (28px),
   * astfel încât copiii să poată da click ușor pe orice planetă chiar și de la distanță mare.
   */
  public pickBodyAtClientCoords(clientX: number, clientY: number): CelestialBodyInstance | null {
    const rect = this.domElement.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    this.pointerNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointerNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.pointerNdc, this.camera);
    const targets = this.orbitalEngine.getRaycastTargets();
    const hits = this.raycaster.intersectObjects(targets, false);

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

    for (const body of this.orbitalEngine.getBodies()) {
      if (body.data.category === 'rover') continue;
      this.tempProjectedVec.copy(body.worldPosition).project(this.camera);
      if (this.tempProjectedVec.z < -1 || this.tempProjectedVec.z > 1) continue;

      const screenX = (this.tempProjectedVec.x + 1) * 0.5 * rect.width + rect.left;
      const screenY = (-this.tempProjectedVec.y + 1) * 0.5 * rect.height + rect.top;
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

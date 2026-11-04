// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { KM_PER_AU } from 'astronomy-engine';
import { CelestialCategory } from '../types/celestial';

export type { CelestialCategory };
export type ScaleMode = 'didactic' | 'real';
export type ScaleChangeListener = (mode: ScaleMode) => void;

const STORAGE_KEY_SCALE = 'orbitar_scale_mode';

/**
 * În Scara Reală, 1 Unitate Astronomică (UA) corespunde la 100 de unități 3D în scenă,
 * iar razele fizice ale corpurilor cerești sunt calculate exact cu același factor.
 */
export const REAL_UNITS_PER_AU = 100;

/**
 * ScaleManager gestionează comutarea între:
 * - "Scară Didactică" (implicită): planetele, sateliții, asteroizii și sondele sunt mărite logaritmic,
 *   iar distanțele orbitale sunt comprimate armonios pentru a fi ușor de găsit și explorat
 *   de către copii de 6–12 ani.
 * - "Scară Reală": proporții fizice exacte între razele corpurilor și distanțele în UA.
 */
export class ScaleManager {
  private mode: ScaleMode;
  private readonly listeners: Set<ScaleChangeListener> = new Set();

  constructor(defaultMode: ScaleMode = 'didactic') {
    const saved = this.readSavedMode();
    this.mode = saved ?? defaultMode;
  }

  private readSavedMode(): ScaleMode | null {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_SCALE);
      if (raw === 'didactic' || raw === 'real') {
        return raw;
      }
    } catch (_e) {
      // Ignorăm eventualele restricții de stocare locală
    }
    return null;
  }

  private saveMode(mode: ScaleMode): void {
    try {
      window.localStorage.setItem(STORAGE_KEY_SCALE, mode);
    } catch (_e) {
      // Ignorăm eventualele restricții de stocare locală
    }
  }

  public getMode(): ScaleMode {
    return this.mode;
  }

  public getModeLabelRo(): string {
    return this.mode === 'didactic' ? 'Scară Didactică' : 'Scară Reală';
  }

  public setMode(newMode: ScaleMode): void {
    if (this.mode === newMode) return;
    this.mode = newMode;
    this.saveMode(newMode);
    for (const listener of this.listeners) {
      listener(this.mode);
    }
  }

  public toggleMode(): ScaleMode {
    const next: ScaleMode = this.mode === 'didactic' ? 'real' : 'didactic';
    this.setMode(next);
    return this.mode;
  }

  public onChange(listener: ScaleChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Calculează raza 3D a unui corp ceresc sau a unei sonde în unități de scenă în funcție de modul activ.
   */
  public scaleRadius(radiusKm: number, category: CelestialCategory): number {
    if (category === 'galaxy') return 14.0;
    if (category === 'oort_cloud') return 8.5;
    if (category === 'nebula' || category === 'star_cluster') return 6.8;
    if (category === 'black_hole') return 5.2;
    if (category === 'exoplanet') return 4.2;

    if (this.mode === 'real') {
      const exactRadius = (radiusKm / KM_PER_AU) * REAL_UNITS_PER_AU;
      if (
        category === 'probe' ||
        category === 'station' ||
        category === 'telescope' ||
        category === 'rover'
      ) {
        return 0.0012;
      }
      return Math.max(exactRadius, 0.0004);
    }

    // Scară Didactică: mărire logaritmică pentru vizibilitate optimă (6–12 ani)
    if (category === 'star') {
      return radiusKm > 10_000_000 ? 7.8 : 6.2;
    }
    if (category === 'rover') {
      return 0.06;
    }
    if (
      category === 'probe' ||
      category === 'station' ||
      category === 'telescope'
    ) {
      return 0.58;
    }
    if (category === 'moon') {
      const moonLog = Math.log10(Math.max(radiusKm, 150));
      return 0.34 + Math.max(0, (moonLog - 2.2) / 1.3) * 0.36;
    }
    if (category === 'asteroid') {
      const astLog = Math.log10(Math.max(radiusKm, 0.2));
      return 0.48 + Math.max(0, (astLog + 0.7) / 3.2) * 0.45;
    }

    // Planete și planete pitice
    const logVal = Math.log10(Math.max(radiusKm, 400));
    const normalized = (logVal - 2.6) / (4.85 - 2.6);
    return 0.85 + Math.max(0, normalized) * 2.95;
  }

  /**
   * Transformă un vector heliocentric exprimat în Unități Astronomice (UA)
   * în coordonate 3D de scenă.
   */
  public scaleHeliocentricPosition(posAu: THREE.Vector3): THREE.Vector3 {
    const distAu = posAu.length();
    if (distAu === 0) {
      return new THREE.Vector3(0, 0, 0);
    }

    if (this.mode === 'real') {
      return posAu.clone().multiplyScalar(REAL_UNITS_PER_AU);
    }

    const scaledDist = 8.0 + 20.0 * Math.pow(distAu, 0.62);
    return posAu.clone().normalize().multiplyScalar(scaledDist);
  }

  /**
   * Transformă o poziție 3D din scenă înapoi în distanța heliocentrică echivalentă în Unități Astronomice (UA).
   */
  public unscaleHeliocentricDistanceAu(scenePos: THREE.Vector3): number {
    const sceneDist = scenePos.length();
    if (sceneDist <= 0.0001) return 0;

    if (this.mode === 'real') {
      return sceneDist / REAL_UNITS_PER_AU;
    }

    if (sceneDist <= 8.0) {
      return 0;
    }
    return Math.pow((sceneDist - 8.0) / 20.0, 1 / 0.62);
  }

  /**
   * Transformă un vector 3D din coordonate de scenă înapoi în vector heliocentric în UA.
   */
  public unscaleHeliocentricPosition(scenePos: THREE.Vector3): THREE.Vector3 {
    const distAu = this.unscaleHeliocentricDistanceAu(scenePos);
    if (distAu === 0 || scenePos.lengthSq() === 0) {
      return new THREE.Vector3(0, 0, 0);
    }
    return scenePos.clone().normalize().multiplyScalar(distAu);
  }

  /**
   * Scalează poziția unui satelit natural, stații orbitale sau rover relativ la planeta-mamă,
   * astfel încât în Scara Didactică orbitele locale să fie clar separate în jurul planetei.
   */
  public scaleLocalChildOffset(
    offsetAu: THREE.Vector3,
    parentVisualRadius: number,
    localOrbitOrder: number = 1,
    category: CelestialCategory = 'moon'
  ): THREE.Vector3 {
    const dir =
      offsetAu.lengthSq() > 0 ? offsetAu.clone().normalize() : new THREE.Vector3(1, 0, 0);

    if (category === 'rover') {
      // Roverele stau chiar la suprafața planetei Marte (sau imediat deasupra pentru a fi ușor de selectat)
      const surfaceRadius = parentVisualRadius * 1.18;
      return dir.multiplyScalar(surfaceRadius);
    }

    if (this.mode === 'real') {
      const realDist = offsetAu.length() * REAL_UNITS_PER_AU;
      const minOrbit = parentVisualRadius * (1.45 + localOrbitOrder * 0.45);
      return dir.multiplyScalar(Math.max(realDist, minOrbit));
    }

    // În Scara Didactică, ordonăm sateliții/stațiile pe inele concentrice clare în jurul planetei-mamă
    const baseMultiplier =
      category === 'station' || category === 'telescope'
        ? localOrbitOrder >= 3
          ? 2.45 + localOrbitOrder * 0.42
          : 1.55 + localOrbitOrder * 0.38
        : 2.15 + localOrbitOrder * 0.82;
    return dir.multiplyScalar(parentVisualRadius * baseMultiplier);
  }

  /**
   * Returnează raza zonei invizibile de click (raycasting) pentru ca orice corp ceresc sau sondă
   * să poată fi selectată fără frustrare de către copii, chiar și de la distanță.
   */
  public getHitSphereRadius(visualRadius: number, category: CelestialCategory): number {
    if (this.mode === 'real') {
      if (category === 'star') return Math.max(visualRadius * 3.5, 2.2);
      if (
        category === 'moon' ||
        category === 'station' ||
        category === 'telescope' ||
        category === 'rover'
      ) {
        return 0.18;
      }
      return 1.8;
    }
    if (category === 'star') return visualRadius * 1.3;
    if (
      category === 'moon' ||
      category === 'station' ||
      category === 'telescope' ||
      category === 'rover'
    ) {
      return Math.max(visualRadius * 1.9, 0.85);
    }
    return Math.max(visualRadius * 2.2, 2.6);
  }
}

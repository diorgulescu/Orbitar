// SPDX-License-Identifier: GPL-3.0-or-later

export type QualityMode = 'eco' | 'hd';

export interface QualityProfileConfig {
  mode: QualityMode;
  labelRo: string;
  buttonTextRo: string;
  tooltipRo: string;
  sphereWidthSegments: number;
  sphereHeightSegments: number;
  proceduralWidth: number;
  proceduralHeight: number;
  maxPixelRatio: number;
  beltParticleRatio: number;
  enableExternalTextures: boolean;
  enableBumpMaps: boolean;
  enableCloudLayers: boolean;
  enableFresnelAtmosphere: boolean;
  enableEarthNightLights: boolean;
}

export type QualityChangeListener = (mode: QualityMode, isAutoFallback: boolean) => void;

const STORAGE_KEY_QUALITY = 'orbitar_quality_mode';
const WATCHDOG_WINDOW_SECONDS = 5.0;
const WATCHDOG_MIN_AVG_FPS = 24;

/**
 * QualityManager gestionează performanța și incluziunea digitală în Orbitar:
 * - Două profiluri grafice salvate în `localStorage` sub cheia `orbitar_quality_mode`:
 *   a) `eco` ("⚡ Mod Rapid / Eco"): texturi procedurale 512×256, sfere 24×24, pixelRatio 1,
 *      25% particule în centurile de asteroizi, zero descărcări externe din `public/textures/`.
 *   b) `hd` ("✨ Mod Realist HD"): texturi 2K lazy-load + luminile orașelor noaptea pe Pământ,
 *      sfere 64×64, bumpMap, nori dinamici și atmosferă Fresnel.
 * - Detecție automată a hardware-ului la prima deschidere + Watchdog FPS în primele 5 secunde.
 */
export class QualityManager {
  private mode: QualityMode;
  private readonly listeners: Set<QualityChangeListener> = new Set();

  // Starea Watchdog-ului FPS (primele 5 secunde în modul HD)
  private watchdogElapsed = 0;
  private watchdogFrames = 0;
  private watchdogCompleted = false;

  constructor() {
    this.mode = this.resolveInitialMode();
    this.resetWatchdog();
  }

  private resolveInitialMode(): QualityMode {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_QUALITY);
      if (saved === 'eco' || saved === 'hd') {
        return saved;
      }
    } catch {
      // Ignorăm eventualele restricții LocalStorage
    }

    if (this.detectModestHardware()) {
      return 'eco';
    }
    return 'hd';
  }

  /**
   * Verifică dacă dispozitivul are resurse limitate:
   * `navigator.hardwareConcurrency <= 4`, `navigator.deviceMemory <= 4` sau ecran tactil mobil.
   */
  public detectModestHardware(): boolean {
    if (typeof navigator === 'undefined') return false;

    const cores = navigator.hardwareConcurrency ?? 8;
    const navWithMem = navigator as Navigator & { deviceMemory?: number };
    const memoryGb = navWithMem.deviceMemory ?? 8;
    const isSmallTouchScreen =
      (navigator.maxTouchPoints ?? 0) > 0 &&
      typeof window !== 'undefined' &&
      window.innerWidth <= 900;

    return cores <= 4 || memoryGb <= 4 || isSmallTouchScreen;
  }

  public getMode(): QualityMode {
    return this.mode;
  }

  public getProfile(): QualityProfileConfig {
    if (this.mode === 'eco') {
      return {
        mode: 'eco',
        labelRo: '⚡ Mod Rapid / Eco',
        buttonTextRo: '⚡ Grafică: Rapidă (Eco)',
        tooltipRo:
          'Ideal pentru tablete, telefoane și calculatoare mai vechi — consum minim de baterie și internet',
        sphereWidthSegments: 24,
        sphereHeightSegments: 24,
        proceduralWidth: 512,
        proceduralHeight: 256,
        maxPixelRatio: 1,
        beltParticleRatio: 0.25,
        enableExternalTextures: false,
        enableBumpMaps: false,
        enableCloudLayers: false,
        enableFresnelAtmosphere: false,
        enableEarthNightLights: false,
      };
    }

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    return {
      mode: 'hd',
      labelRo: '✨ Mod Realist HD',
      buttonTextRo: '✨ Grafică: Realistă HD',
      tooltipRo: 'Texturi detaliate 2K, nori și luminile orașelor noaptea',
      sphereWidthSegments: 64,
      sphereHeightSegments: 64,
      proceduralWidth: 2048,
      proceduralHeight: 1024,
      maxPixelRatio: Math.min(dpr, 2),
      beltParticleRatio: 1.0,
      enableExternalTextures: true,
      enableBumpMaps: true,
      enableCloudLayers: true,
      enableFresnelAtmosphere: true,
      enableEarthNightLights: true,
    };
  }

  public setMode(newMode: QualityMode, isAutoFallback = false): void {
    if (this.mode === newMode) return;
    this.mode = newMode;

    try {
      window.localStorage.setItem(STORAGE_KEY_QUALITY, newMode);
    } catch {
      // Ignorăm eventualele restricții LocalStorage
    }

    this.resetWatchdog();
    for (const listener of this.listeners) {
      listener(this.mode, isAutoFallback);
    }
  }

  public toggleMode(): QualityMode {
    const next: QualityMode = this.mode === 'hd' ? 'eco' : 'hd';
    this.setMode(next, false);
    return this.mode;
  }

  public onChange(listener: QualityChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private resetWatchdog(): void {
    this.watchdogElapsed = 0;
    this.watchdogFrames = 0;
    this.watchdogCompleted = this.mode !== 'hd';
  }

  /**
   * Monitorizează frame-rate-ul în primele 5 secunde de rulare în modul `hd`.
   * Dacă media scade sub 24 FPS, comută automat în modul `eco`.
   */
  public recordFrame(rawDeltaSeconds: number): void {
    if (this.watchdogCompleted || this.mode !== 'hd') return;
    if (typeof document !== 'undefined' && document.hidden) return;
    // Ignorăm spike-urile cauzate de schimbarea tab-ului
    if (rawDeltaSeconds <= 0 || rawDeltaSeconds > 0.5) return;

    this.watchdogElapsed += rawDeltaSeconds;
    this.watchdogFrames += 1;

    if (this.watchdogElapsed >= WATCHDOG_WINDOW_SECONDS) {
      this.watchdogCompleted = true;
      const avgFps = this.watchdogFrames / this.watchdogElapsed;
      if (avgFps < WATCHDOG_MIN_AVG_FPS) {
        this.setMode('eco', true);
      }
    }
  }
}

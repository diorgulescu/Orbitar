// SPDX-License-Identifier: GPL-3.0-or-later
import { OrbitalEngine } from '../core/OrbitalEngine';
import { ScaleManager } from '../core/ScaleManager';

interface SpeedStep {
  scale: number;
  labelRo: string;
}

const SPEED_STEPS: SpeedStep[] = [
  { scale: 1, labelRo: '1× (Timp real)' },
  { scale: 60, labelRo: '1 min / sec' },
  { scale: 3600, labelRo: '1 oră / sec' },
  { scale: 86400, labelRo: '1 zi / sec' },
  { scale: 604800, labelRo: '7 zile / sec' },
  { scale: 2592000, labelRo: '30 zile / sec' },
  { scale: 15768000, labelRo: '6 luni / sec' },
];

export const STORAGE_KEY_SIM_SPEED = 'orbitar_sim_speed';

/**
 * BottomDock gestionează Dock-ul Inferior de Navigație (Bento Dark Mode):
 * - Controlul timpului: Play/Pause, buton "Timp Real (Acum)", slider de viteză orbitală și afișarea datei
 * - Comutatorul "Scară Didactică" <-> "Scară Reală"
 * - Persistența vitezei simulării în `localStorage` (`orbitar_sim_speed`) pentru lansările următoare
 */
export class BottomDock {
  private readonly orbitalEngine: OrbitalEngine;
  private readonly scaleManager: ScaleManager;
  private readonly dateFormatter: Intl.DateTimeFormat;
  private simDateEl: HTMLElement | null = null;
  private lastFormattedMinuteBucket = Number.NaN;
  private lastRenderedDateText = '';
  private scaleToastTimer: number | null = null;

  constructor(orbitalEngine: OrbitalEngine, scaleManager: ScaleManager) {
    this.orbitalEngine = orbitalEngine;
    this.scaleManager = scaleManager;
    this.dateFormatter = new Intl.DateTimeFormat('ro-RO', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    this.restoreSavedSpeed();
    this.bindEvents();
    this.syncScaleButton();
    this.syncSpeedReadout();
    this.updateDateReadout();
  }

  private restoreSavedSpeed(): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_SIM_SPEED);
      if (!raw) return;
      const parsed = Number.parseInt(raw, 10);
      const validStep = SPEED_STEPS.find((s) => s.scale === parsed);
      if (!validStep) return;

      if (validStep.scale === 1) {
        this.orbitalEngine.syncToRealTimeNow();
      } else {
        this.orbitalEngine.timeScale = validStep.scale;
      }
    } catch (_e) {
      // Ignorăm eventualele restricții LocalStorage
    }
  }

  private saveSpeed(scale: number): void {
    try {
      window.localStorage.setItem(STORAGE_KEY_SIM_SPEED, String(scale));
    } catch (_e) {
      // Ignorăm eventualele restricții LocalStorage
    }
  }

  private bindEvents(): void {
    const btnPause = document.getElementById('btn-time-pause');
    const btnNow = document.getElementById('btn-time-now');
    const speedSlider = document.getElementById('hud-speed-slider') as HTMLInputElement | null;
    const btnScale = document.getElementById('btn-scale-toggle');

    btnPause?.addEventListener('click', () => {
      this.orbitalEngine.isPaused = !this.orbitalEngine.isPaused;
      this.syncPauseButton();
    });

    btnNow?.addEventListener('click', () => {
      this.orbitalEngine.syncToRealTimeNow();
      this.saveSpeed(1);
      if (speedSlider) {
        speedSlider.value = '0';
      }
      this.syncPauseButton();
      this.syncSpeedReadout();
      this.updateDateReadout();
    });

    speedSlider?.addEventListener('input', () => {
      const idx = Math.min(
        SPEED_STEPS.length - 1,
        Math.max(0, parseInt(speedSlider.value, 10) || 0)
      );
      const nextScale = SPEED_STEPS[idx].scale;
      if (nextScale === 1) {
        this.orbitalEngine.syncToRealTimeNow();
      } else {
        this.orbitalEngine.timeScale = nextScale;
        this.orbitalEngine.isPaused = false;
      }
      this.saveSpeed(nextScale);
      this.syncPauseButton();
      this.syncSpeedReadout();
      this.updateDateReadout();
    });

    btnScale?.addEventListener('click', () => {
      const nextMode = this.scaleManager.toggleMode();
      this.syncScaleButton();
      this.showScaleToast(
        nextMode === 'real'
          ? '📏 Scară Reală activată: proporții și distanțe fizice 1:1'
          : '🔭 Scară Didactică activată: corpuri mărite pentru explorare'
      );
    });

    this.scaleManager.onChange(() => {
      this.syncScaleButton();
    });
  }

  private syncPauseButton(): void {
    const btnPause = document.getElementById('btn-time-pause');
    if (!btnPause) return;
    btnPause.textContent = this.orbitalEngine.isPaused ? '▶ Continuă' : '⏸ Pauză';
    btnPause.classList.toggle('hud-btn-active-amber', this.orbitalEngine.isPaused);
  }

  private syncSpeedReadout(): void {
    const speedLabelEl = document.getElementById('hud-speed-label');
    const speedSlider = document.getElementById('hud-speed-slider') as HTMLInputElement | null;
    const foundIdx = SPEED_STEPS.findIndex((s) => s.scale === this.orbitalEngine.timeScale);
    const activeIdx = foundIdx >= 0 ? foundIdx : 1;
    if (speedSlider && document.activeElement !== speedSlider) {
      speedSlider.value = String(activeIdx);
    }
    if (!speedLabelEl) return;
    speedLabelEl.textContent = SPEED_STEPS[activeIdx].labelRo;
  }

  private syncScaleButton(): void {
    const btnScale = document.getElementById('btn-scale-toggle');
    if (!btnScale) return;
    const isDidactic = this.scaleManager.getMode() === 'didactic';
    btnScale.textContent = isDidactic ? '🔭 Scară Didactică' : '📏 Scară Reală';
    btnScale.setAttribute('aria-pressed', String(!isDidactic));
    btnScale.classList.toggle('hud-btn-active-cyan', isDidactic);
    btnScale.classList.toggle('hud-btn-active-amber', !isDidactic);
  }

  private showScaleToast(message: string): void {
    const toast = document.getElementById('hud-quality-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.remove('hidden');
    if (this.scaleToastTimer !== null) {
      window.clearTimeout(this.scaleToastTimer);
    }
    this.scaleToastTimer = window.setTimeout(() => {
      toast.classList.add('hidden');
    }, 3200);
  }

  public updateDateReadout(): void {
    const simDate = this.orbitalEngine.simulationDate;
    const minuteBucket = Math.floor(simDate.getTime() / 60000);
    if (!this.simDateEl || this.simDateEl.isConnected === false) {
      this.simDateEl = document.getElementById('hud-sim-date');
      this.lastFormattedMinuteBucket = Number.NaN;
      this.lastRenderedDateText = '';
    }
    if (!this.simDateEl) return;

    if (minuteBucket === this.lastFormattedMinuteBucket) {
      return;
    }
    this.lastFormattedMinuteBucket = minuteBucket;

    const nextText = this.dateFormatter.format(simDate);
    if (nextText !== this.lastRenderedDateText) {
      this.lastRenderedDateText = nextText;
      this.simDateEl.textContent = nextText;
    }
  }
}

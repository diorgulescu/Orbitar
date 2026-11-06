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

/**
 * BottomDock gestionează Dock-ul Inferior de Navigație (Bento Dark Mode):
 * - Controlul timpului: Play/Pause, buton "Timp Real (Acum)", slider de viteză orbitală și afișarea datei
 * - Comutatorul "Scară Didactică" <-> "Scară Reală"
 */
export class BottomDock {
  private readonly orbitalEngine: OrbitalEngine;
  private readonly scaleManager: ScaleManager;
  private readonly dateFormatter: Intl.DateTimeFormat;

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

    this.bindEvents();
    this.syncScaleButton();
    this.syncSpeedReadout();
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
      if (speedSlider) {
        speedSlider.value = '0';
      }
      this.syncPauseButton();
      this.syncSpeedReadout();
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
      this.syncPauseButton();
      this.syncSpeedReadout();
    });

    btnScale?.addEventListener('click', () => {
      this.scaleManager.toggleMode();
      this.syncScaleButton();
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
    btnScale.classList.toggle('hud-btn-active-cyan', isDidactic);
    btnScale.classList.toggle('hud-btn-active-amber', !isDidactic);
  }

  public updateDateReadout(): void {
    const simDateEl = document.getElementById('hud-sim-date');
    if (simDateEl) {
      simDateEl.textContent = this.dateFormatter.format(this.orbitalEngine.simulationDate);
    }
  }
}

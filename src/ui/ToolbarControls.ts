// SPDX-License-Identifier: GPL-3.0-or-later
import type { QualityManager } from '../core/QualityManager';
import type { SpaceAmbientEngine } from '../audio/SpaceAmbientEngine';
import type { SpacecraftPilot } from '../game/SpacecraftPilot';
import type { StudyDrawer } from './StudyDrawer';

export interface ToolbarControlsDeps {
  qualityManager: QualityManager;
  ambientEngine: SpaceAmbientEngine;
  spacecraftPilot: SpacecraftPilot;
  studyDrawer: StudyDrawer;
}

/**
 * ToolbarControls grupează toate controalele din bara superioară care pot fi create și dacă lipsesc
 * din index.html (fallback pentru medii de test / skin-uri vechi):
 * - comutatorul de calitate grafică ⚡ Eco / ✨ HD (tasta Q)
 * - butonul de proiecție fullscreen ⛶ F11 (cu comandă nativă Tauri când aplicația rulează în desktop)
 * - controalele de muzică ambientală 🎵 (tasta M) + volum
 * - butonul 🚀 Mod Pilot (tasta P)
 * - toast-urile de notificare (#hud-quality-toast) și scurtăturile de tastatură globale
 *
 * A fost extras din main.ts pentru a reduce „god-file-ul” de bootstrap la wiring pur.
 */
export class ToolbarControls {
  private readonly qualityManager: QualityManager;
  private readonly ambientEngine: SpaceAmbientEngine;
  private readonly spacecraftPilot: SpacecraftPilot;
  private readonly studyDrawer: StudyDrawer;

  private btnQualityToggle: HTMLButtonElement;
  private btnFullscreenToggle: HTMLButtonElement;
  private btnPilotToggle: HTMLButtonElement;
  private qualityToastEl: HTMLElement;
  private toastTimeoutId: number | null = null;
  private isTauriFullscreen = false;

  constructor(deps: ToolbarControlsDeps) {
    this.qualityManager = deps.qualityManager;
    this.ambientEngine = deps.ambientEngine;
    this.spacecraftPilot = deps.spacecraftPilot;
    this.studyDrawer = deps.studyDrawer;

    this.btnQualityToggle = this.getOrCreateQualityButton();
    this.btnFullscreenToggle = this.getOrCreateFullscreenButton();
    this.qualityToastEl = this.getOrCreateToast();
    this.setupQualityToggle();
    this.setupFullscreenToggle();
    this.setupAmbientAudioControls();
    this.btnPilotToggle = this.getOrCreatePilotButton();
    this.setupPilotToggle();
    this.setupKeyboardShortcuts();
  }

  /** Afișează un toast de notificare (#hud-quality-toast) timp de ~3.6 secunde. */
  public showToast(messageRo: string): void {
    this.qualityToastEl.textContent = messageRo;
    this.qualityToastEl.classList.remove('is-hidden');
    if (this.toastTimeoutId !== null) {
      window.clearTimeout(this.toastTimeoutId);
    }
    this.toastTimeoutId = window.setTimeout(() => {
      this.qualityToastEl.classList.add('is-hidden');
    }, 3600);
  }

  /** Sincronizează butonul 🚀 Mod Pilot cu starea internă a SpacecraftPilot. */
  public syncPilotToggleUI(active: boolean): void {
    this.btnPilotToggle.classList.toggle('is-active', active);
    this.btnPilotToggle.classList.toggle('hud-btn-active-amber', active);
    this.btnPilotToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    this.btnPilotToggle.textContent = active ? '🗗 Ieși Pilot (P)' : '🚀 Mod Pilot';

    if (active) {
      this.studyDrawer.stopSpeech();
      document.getElementById('hud-study-drawer')?.classList.add('is-collapsed');
    }
  }

  private getOrCreateQualityButton(): HTMLButtonElement {
    let btn = document.getElementById('orbitar-quality-toggle') as HTMLButtonElement | null;
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'orbitar-quality-toggle';
      btn.type = 'button';
      btn.className = 'hud-btn quality-pill-switch';
      const btnCadet = document.getElementById('btn-tier-cadet');
      const tierContainer =
        document.querySelector('.header-tier-switch') ?? document.querySelector('.hud-header');
      if (btnCadet && btnCadet.parentElement) {
        btnCadet.insertAdjacentElement('afterend', btn);
      } else if (tierContainer) {
        tierContainer.appendChild(btn);
      } else {
        document.body.appendChild(btn);
      }
    }
    return btn;
  }

  private getOrCreateFullscreenButton(): HTMLButtonElement {
    let btn = document.getElementById('orbitar-fullscreen-toggle') as HTMLButtonElement | null;
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'orbitar-fullscreen-toggle';
      btn.type = 'button';
      btn.className = 'hud-btn fullscreen-pill-btn';
      btn.setAttribute('aria-pressed', 'false');
      btn.title =
        'Mod Proiecție la Clasă pe tot ecranul pentru videoproiector sau tablă interactivă (Tasta F11)';
      btn.textContent = '⛶ F11';
      this.btnQualityToggle.insertAdjacentElement('afterend', btn);
    }
    return btn;
  }

  private getOrCreateToast(): HTMLElement {
    let el = document.getElementById('hud-quality-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'hud-quality-toast';
      el.className = 'bento-card quality-toast is-hidden';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    return el;
  }

  private getOrCreatePilotButton(): HTMLButtonElement {
    let btn = document.getElementById('btn-pilot-mode-toggle') as HTMLButtonElement | null;
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'btn-pilot-mode-toggle';
      btn.type = 'button';
      btn.className = 'hud-btn hud-btn-pilot';
      btn.setAttribute('aria-pressed', 'false');
      btn.title =
        'Activează mini-jocul La Manșa Navei — pilotează 3 nave spațiale la persoana întâi prin Sistemul Solar (Tasta rapidă: P)';
      btn.textContent = '🚀 Mod Pilot';
      const audioControls = document.getElementById('orbitar-audio-controls');
      if (audioControls) {
        audioControls.insertAdjacentElement('afterend', btn);
      } else {
        this.btnFullscreenToggle.insertAdjacentElement('afterend', btn);
      }
    }
    return btn;
  }

  private syncQualityButtonUI(): void {
    const profile = this.qualityManager.getProfile();
    this.btnQualityToggle.textContent = profile.mode === 'eco' ? '⚡ Eco' : '✨ HD';
    this.btnQualityToggle.title = `${profile.tooltipRo} (Scurtătură: Tasta Q)`;
    this.btnQualityToggle.dataset.qualityMode = profile.mode;
    this.btnQualityToggle.classList.toggle('is-eco', profile.mode === 'eco');
    this.btnQualityToggle.classList.toggle('is-hd', profile.mode === 'hd');
  }

  private setupQualityToggle(): void {
    this.syncQualityButtonUI();
    this.btnQualityToggle.addEventListener('click', () => {
      this.qualityManager.toggleMode();
    });
    this.qualityManager.onChange((newMode, isAutoFallback) => {
      this.syncQualityButtonUI();
      if (isAutoFallback) {
        this.showToast('Am activat Modul Rapid pentru ca Orbitar să se miște lin pe dispozitivul tău!');
      } else if (newMode === 'eco') {
        this.showToast('Mod Grafic activat: Rapid (Eco)');
      } else {
        this.showToast('Mod Grafic activat: Realist HD (Texturi 2K)');
      }
    });
  }

  private syncFullscreenUI(active: boolean): void {
    this.btnFullscreenToggle.classList.toggle('is-fullscreen', active);
    this.btnFullscreenToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    this.btnFullscreenToggle.textContent = active ? '🗗 Ieșire F11' : '⛶ F11';
  }

  private async toggleOrbitarFullscreen(): Promise<void> {
    const tauriWindow = window as unknown as {
      __TAURI_INTERNALS__?: { invoke?: (cmd: string) => Promise<boolean> };
      __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<boolean> } };
    };
    const tauriInvoke =
      tauriWindow.__TAURI_INTERNALS__?.invoke ?? tauriWindow.__TAURI__?.core?.invoke;

    if (typeof tauriInvoke === 'function') {
      try {
        this.isTauriFullscreen = await tauriInvoke('toggle_fullscreen');
        this.syncFullscreenUI(this.isTauriFullscreen);
        this.showToast(
          this.isTauriFullscreen
            ? '🖥️ Mod Proiecție la Clasă: Ecran Complet Activat (F11)'
            : '🗗 Mod Fereastră Normală (F11)'
        );
        return;
      } catch (_e) {
        // Fallback la API-ul Fullscreen standard din browser
      }
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        this.syncFullscreenUI(true);
        this.showToast('🖥️ Mod Proiecție la Clasă: Ecran Complet Activat (F11)');
      } else {
        await document.exitFullscreen();
        this.syncFullscreenUI(false);
        this.showToast('🗗 Mod Fereastră Normală (F11)');
      }
    } catch (_e) {
      // Unele medii restricționează requestFullscreen
    }
  }

  private setupFullscreenToggle(): void {
    this.btnFullscreenToggle.addEventListener('click', () => {
      void this.toggleOrbitarFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
      this.syncFullscreenUI(Boolean(document.fullscreenElement));
    });
  }

  private setupAmbientAudioControls(): void {
    let audioControlsEl = document.getElementById('orbitar-audio-controls');
    if (!audioControlsEl) {
      audioControlsEl = document.createElement('div');
      audioControlsEl.id = 'orbitar-audio-controls';
      audioControlsEl.className = 'ambient-audio-controls';
      audioControlsEl.innerHTML = `
        <button id="orbitar-audio-toggle" type="button" class="hud-btn ambient-toggle-btn is-off" aria-pressed="false">
          <span class="ambient-wave" aria-hidden="true"><i></i><i></i><i></i></span>
          <span id="orbitar-audio-label">🔇 Ambiental</span>
        </button>
        <input id="orbitar-audio-volume" class="ambient-volume-slider" type="range" min="0" max="100" step="1" value="35" aria-label="Volum muzică ambientală" />
        <span id="orbitar-audio-volume-label" class="ambient-volume-readout">35%</span>
      `;
      this.btnFullscreenToggle.insertAdjacentElement('afterend', audioControlsEl);
    }

    const btnAudioToggle = document.getElementById(
      'orbitar-audio-toggle'
    ) as HTMLButtonElement | null;
    const audioLabelEl = document.getElementById('orbitar-audio-label');
    const audioVolumeSlider = document.getElementById(
      'orbitar-audio-volume'
    ) as HTMLInputElement | null;
    const audioVolumeLabel = document.getElementById('orbitar-audio-volume-label');

    const syncAmbientAudioUI = (): void => {
      const enabled = this.ambientEngine.isEnabled();
      const vol = this.ambientEngine.getVolumePercent();
      if (btnAudioToggle) {
        btnAudioToggle.classList.toggle('is-on', enabled);
        btnAudioToggle.classList.toggle('is-off', !enabled);
        btnAudioToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
      }
      if (audioLabelEl) {
        audioLabelEl.textContent = enabled ? '🎵 Ambiental' : '🔇 Ambiental';
      }
      if (audioVolumeSlider && document.activeElement !== audioVolumeSlider) {
        audioVolumeSlider.value = String(vol);
        audioVolumeSlider.title = `Volum muzică ambientală: ${vol}%`;
      }
      if (audioVolumeLabel) {
        audioVolumeLabel.textContent = `${vol}%`;
      }
    };

    syncAmbientAudioUI();
    this.ambientEngine.onChange(() => {
      syncAmbientAudioUI();
    });

    btnAudioToggle?.addEventListener('click', () => {
      const nowEnabled = this.ambientEngine.toggle();
      this.showToast(
        nowEnabled
          ? `🎵 Muzică ambientală cosmică: Pornită (${this.ambientEngine.getVolumePercent()}%)`
          : '🔇 Muzică ambientală cosmică: Oprită'
      );
    });

    audioVolumeSlider?.addEventListener('input', () => {
      const val = Number(audioVolumeSlider.value);
      this.ambientEngine.setVolumePercent(val);
      if (audioVolumeLabel) {
        audioVolumeLabel.textContent = `${this.ambientEngine.getVolumePercent()}%`;
      }
    });
  }

  private setupPilotToggle(): void {
    this.spacecraftPilot.onModeChange((active) => {
      this.syncPilotToggleUI(active);
    });

    this.btnPilotToggle.addEventListener('click', () => {
      const nowActive = this.spacecraftPilot.togglePilotMode();
      this.showToast(
        nowActive
          ? `🚀 La Manșa Navei activat! Nava curentă: ${this.spacecraftPilot.getCurrentShip().shortNameRo}`
          : '🌌 Ai revenit la vederea orbitală a planetariului Orbitar'
      );
    });
  }

  private setupKeyboardShortcuts(): void {
    // Scurtături de tastatură: F11 (Fullscreen), P (Mod Pilot), Q (Calitate în afara Modului Pilot), M (Muzică)
    window.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'F11' || e.code === 'F11') {
        e.preventDefault();
        void this.toggleOrbitarFullscreen();
        return;
      }
      if (e.key === 'p' || e.key === 'P' || e.code === 'KeyP') {
        e.preventDefault();
        const nowActive = this.spacecraftPilot.togglePilotMode();
        this.showToast(
          nowActive
            ? `🚀 La Manșa Navei activat! Nava curentă: ${this.spacecraftPilot.getCurrentShip().shortNameRo}`
            : '🌌 Ai revenit la vederea orbitală a planetariului Orbitar'
        );
        return;
      }
      // În Modul Pilot, tasta Q este folosită pentru înclinarea navei (Roll Left)
      if (!this.spacecraftPilot.isActive() && (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ')) {
        e.preventDefault();
        this.qualityManager.toggleMode();
      } else if (e.key === 'm' || e.key === 'M' || e.code === 'KeyM') {
        e.preventDefault();
        const nowEnabled = this.ambientEngine.toggle();
        this.showToast(
          nowEnabled
            ? `🎵 Muzică ambientală cosmică: Pornită (${this.ambientEngine.getVolumePercent()}%)`
            : '🔇 Muzică ambientală cosmică: Oprită'
        );
      }
    });
  }
}

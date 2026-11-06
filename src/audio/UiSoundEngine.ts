// SPDX-License-Identifier: GPL-3.0-or-later

const STORAGE_KEY_UI_SFX = 'orbitar_ui_sfx_enabled';

const CLOSE_BUTTON_IDS = new Set([
  'btn-drawer-close',
  'btn-gpl-close',
  'btn-print-close',
  'btn-missions-close',
  'btn-onboarding-close',
  'btn-onboarding-skip',
  'btn-marker-card-close',
]);

const OPEN_MODAL_BUTTON_IDS = new Set([
  'btn-gpl-modal',
  'btn-about-orbitar',
  'btn-missions-toggle',
  'btn-print-coloring-dock',
  'btn-reopen-tutorial',
  'btn-print-study',
  'btn-print-coloring',
]);

/**
 * Motor audio procedural (100% Web Audio API, fără fișiere externe) pentru
 * micro-interacțiunile din interfața Orbitar:
 * - Click discret pe butoane, comutatoare și meniuri
 * - Selecția unui corp ceresc (chime cristalin în două note)
 * - Deschiderea și închiderea casetei de studiu / ferestrelor modale
 * - Feedback sonor la răspunsurile din Quiz (acord major ascendent vs. dublu ton grav discret)
 */
export class UiSoundEngine {
  private static instance: UiSoundEngine | null = null;
  private ctx: AudioContext | null = null;
  private enabled = true;
  private lastSoundTimestampMs = 0;
  private boundDoc: Document | null = null;

  private constructor() {
    this.loadPreference();
  }

  public static getInstance(): UiSoundEngine {
    if (!UiSoundEngine.instance) {
      UiSoundEngine.instance = new UiSoundEngine();
    }
    return UiSoundEngine.instance;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    try {
      window.localStorage.setItem(STORAGE_KEY_UI_SFX, enabled ? '1' : '0');
    } catch (_e) {
      // Ignorăm eventualele restricții LocalStorage
    }
  }

  private loadPreference(): void {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_UI_SFX);
      if (saved === '0') {
        this.enabled = false;
      }
    } catch (_e) {
      this.enabled = true;
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      this.ctx = new AudioCtx();
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return this.ctx;
    } catch (_e) {
      return null;
    }
  }

  private shouldThrottle(minGapMs = 18): boolean {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastSoundTimestampMs < minGapMs) {
      return true;
    }
    this.lastSoundTimestampMs = now;
    return false;
  }

  /**
   * Click tactil discret pentru butoane, comutatoare și controale HUD.
   */
  public playClick(): void {
    if (!this.enabled || this.shouldThrottle(18)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(740, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.034);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1900, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.052, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.038);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.042);
  }

  /**
   * Sunet cristalin în două armonice la selectarea unei planete, luni sau sonde.
   */
  public playSelectBody(): void {
    if (!this.enabled || this.shouldThrottle(30)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, delay: 0, duration: 0.11, peak: 0.042, type: 'sine' as OscillatorType },
      { freq: 783.99, delay: 0.032, duration: 0.14, peak: 0.036, type: 'triangle' as OscillatorType },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = n.type;
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2200, now + n.delay);

      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.linearRampToValueAtTime(n.peak, now + n.delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.duration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.duration + 0.01);
    }
  }

  /**
   * Glisaj armonic ascendent discret la afișarea Casetei de Studiu sau a unei ferestre modale.
   */
  public playDrawerOpen(): void {
    if (!this.enabled || this.shouldThrottle(35)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(310, now);
    osc.frequency.exponentialRampToValueAtTime(587.33, now + 0.13);

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(440, now);
    subOsc.frequency.exponentialRampToValueAtTime(659.25, now + 0.13);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1500, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.044, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.145);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.155);
    subOsc.stop(now + 0.155);
  }

  /**
   * Glisaj armonic descendent discret la închiderea Casetei de Studiu sau a unei ferestre modale.
   */
  public playDrawerClose(): void {
    if (!this.enabled || this.shouldThrottle(35)) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.115);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1350, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.042, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.135);
  }

  /**
   * Feedback sonor pentru răspunsurile din Quiz (acord luminos la răspuns corect, dublu ton blând la eroare).
   */
  public playQuizFeedback(correct: boolean): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const sequence = correct
      ? [
          { freq: 523.25, delay: 0, dur: 0.11, peak: 0.045 },
          { freq: 659.25, delay: 0.055, dur: 0.12, peak: 0.045 },
          { freq: 783.99, delay: 0.11, dur: 0.16, peak: 0.05 },
        ]
      : [
          { freq: 293.66, delay: 0, dur: 0.1, peak: 0.038 },
          { freq: 233.08, delay: 0.075, dur: 0.14, peak: 0.036 },
        ];

    for (const step of sequence) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = correct ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(step.freq, now + step.delay);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(correct ? 2400 : 1100, now + step.delay);

      gain.gain.setValueAtTime(0.0001, now + step.delay);
      gain.gain.linearRampToValueAtTime(step.peak, now + step.delay + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + step.delay + step.dur);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + step.delay);
      osc.stop(now + step.delay + step.dur + 0.01);
    }
  }

  /**
   * Atașează ascultători delegați pe document pentru a reda automat micro-sunete
   * la apăsarea butoanelor, pastilelor planetare, etichetelor și meniurilor din interfață.
   */
  public installGlobalUiListeners(doc: Document = document): void {
    if (this.boundDoc === doc) return;
    this.boundDoc = doc;

    doc.addEventListener('click', (e) => {
      const rawTarget = e.target as HTMLElement | null;
      const interactive = this.findInteractiveAncestor(rawTarget);
      if (!interactive) return;

      // Opțiunile de quiz au deja propriul sunet dedicat (playQuizFeedback)
      if (interactive.classList?.contains('quiz-opt-btn')) {
        return;
      }

      const id = interactive.id || '';
      if (CLOSE_BUTTON_IDS.has(id)) {
        this.playDrawerClose();
        return;
      }

      if (OPEN_MODAL_BUTTON_IDS.has(id)) {
        this.playDrawerOpen();
        return;
      }

      if (
        interactive.classList?.contains('body-pill') ||
        interactive.classList?.contains('celestial-label') ||
        interactive.classList?.contains('cockpit-dest-pill') ||
        interactive.classList?.contains('search-suggestion-item')
      ) {
        this.playSelectBody();
        return;
      }

      this.playClick();
    });

    doc.addEventListener('change', (e) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const tag = (target.tagName || '').toUpperCase();
      if (tag === 'SELECT' || tag === 'INPUT') {
        this.playClick();
      }
    });
  }

  private findInteractiveAncestor(start: HTMLElement | null): HTMLElement | null {
    let curr: HTMLElement | null = start;
    while (curr) {
      const tag = (curr.tagName || '').toUpperCase();
      if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') {
        return curr;
      }
      if (curr.getAttribute?.('role') === 'button') {
        return curr;
      }
      const cls = curr.classList;
      if (
        cls &&
        (cls.contains('hud-btn') ||
          cls.contains('hud-icon-btn') ||
          cls.contains('body-pill') ||
          cls.contains('celestial-label') ||
          cls.contains('cockpit-ship-card') ||
          cls.contains('cockpit-dest-pill') ||
          cls.contains('quiz-opt-btn') ||
          cls.contains('onboarding-dot') ||
          cls.contains('search-suggestion-item'))
      ) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }
}

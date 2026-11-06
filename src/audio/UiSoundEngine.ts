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
 * - Tranziție fade-out -> fade-in a casetei de studiu la schimbarea corpului ceresc
 * - Feedback sonor la răspunsurile din Quiz (acord major ascendent vs. dublu ton grav discret)
 *
 * Volumul acestor efecte sonore este legat direct de ieșirea audio a sistemului gazdă
 * (`masterGain = 1.0` -> `ctx.destination`), fiind complet independent de cursorul de volum
 * al muzicii ambientale (`SpaceAmbientEngine`).
 */
export class UiSoundEngine {
  private static instance: UiSoundEngine | null = null;
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
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

  /**
   * Returnează factorul de amplificare master (fixat la 1.0 = 100% din volumul sistemului gazdă,
   * niciodată scalat de cursorul muzicii ambientale).
   */
  public getHostVolumeGain(): number {
    return this.masterGain ? this.masterGain.gain.value : 1.0;
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

  private ensureOutputBus(): { ctx: AudioContext; output: AudioNode } | null {
    if (!this.enabled) return null;
    if (this.ctx && this.masterGain) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      return { ctx: this.ctx, output: this.masterGain };
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;

    try {
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return { ctx: this.ctx, output: this.masterGain };
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
    const bus = this.ensureOutputBus();
    if (!bus) return;
    const { ctx, output } = bus;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(760, now);
    osc.frequency.exponentialRampToValueAtTime(360, now + 0.036);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(2000, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(output);

    osc.start(now);
    osc.stop(now + 0.044);
  }

  /**
   * Sunet cristalin în două armonice la selectarea unei planete, luni sau sonde.
   */
  public playSelectBody(): void {
    if (!this.enabled || this.shouldThrottle(30)) return;
    const bus = this.ensureOutputBus();
    if (!bus) return;
    const { ctx, output } = bus;

    const now = ctx.currentTime;
    const notes = [
      { freq: 523.25, delay: 0, duration: 0.11, peak: 0.15, type: 'sine' as OscillatorType },
      { freq: 783.99, delay: 0.032, duration: 0.14, peak: 0.13, type: 'triangle' as OscillatorType },
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
      gain.connect(output);

      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.duration + 0.01);
    }
  }

  /**
   * Efect sonor discret în două faze sincronizat cu tranziția fade-out -> fade-in
   * a Casetei de Studiu atunci când utilizatorul schimbă corpul ceresc urmărit:
   * - Faza 1 (t = 0s): glisaj descendent catifelat la estomparea casetei vechi (în timp ce camera pornește spre noul obiect)
   * - Faza 2 (t = +fadeOutSeconds): acord cristalin ascendent la reapariția casetei cu detaliile noului corp
   */
  public playDrawerSwitchTransition(fadeOutSeconds = 0.22): void {
    if (!this.enabled || this.shouldThrottle(35)) return;
    const bus = this.ensureOutputBus();
    if (!bus) return;
    const { ctx, output } = bus;

    const now = ctx.currentTime;

    // Faza 1: Fade-out (glisaj armonic descendent scurt, discret)
    const outOsc = ctx.createOscillator();
    const outSub = ctx.createOscillator();
    const outFilter = ctx.createBiquadFilter();
    const outGain = ctx.createGain();

    outOsc.type = 'sine';
    outOsc.frequency.setValueAtTime(493.88, now);
    outOsc.frequency.exponentialRampToValueAtTime(329.63, now + 0.15);

    outSub.type = 'triangle';
    outSub.frequency.setValueAtTime(369.99, now);
    outSub.frequency.exponentialRampToValueAtTime(246.94, now + 0.15);

    outFilter.type = 'lowpass';
    outFilter.frequency.setValueAtTime(1400, now);

    outGain.gain.setValueAtTime(0.0001, now);
    outGain.gain.linearRampToValueAtTime(0.13, now + 0.015);
    outGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.165);

    outOsc.connect(outFilter);
    outSub.connect(outFilter);
    outFilter.connect(outGain);
    outGain.connect(output);

    outOsc.start(now);
    outSub.start(now);
    outOsc.stop(now + 0.175);
    outSub.stop(now + 0.175);

    // Faza 2: Fade-in (reapariție cristalină cu detaliile noului corp ceresc)
    const inStart = now + Math.max(0.08, fadeOutSeconds);
    const inOsc1 = ctx.createOscillator();
    const inOsc2 = ctx.createOscillator();
    const inFilter = ctx.createBiquadFilter();
    const inGain = ctx.createGain();

    inOsc1.type = 'sine';
    inOsc1.frequency.setValueAtTime(392.0, inStart);
    inOsc1.frequency.exponentialRampToValueAtTime(587.33, inStart + 0.13);

    inOsc2.type = 'triangle';
    inOsc2.frequency.setValueAtTime(587.33, inStart + 0.025);
    inOsc2.frequency.exponentialRampToValueAtTime(783.99, inStart + 0.15);

    inFilter.type = 'lowpass';
    inFilter.frequency.setValueAtTime(2100, inStart);

    inGain.gain.setValueAtTime(0.0001, inStart);
    inGain.gain.linearRampToValueAtTime(0.15, inStart + 0.018);
    inGain.gain.exponentialRampToValueAtTime(0.0001, inStart + 0.17);

    inOsc1.connect(inFilter);
    inOsc2.connect(inFilter);
    inFilter.connect(inGain);
    inGain.connect(output);

    inOsc1.start(inStart);
    inOsc2.start(inStart + 0.025);
    inOsc1.stop(inStart + 0.18);
    inOsc2.stop(inStart + 0.18);
  }

  /**
   * Glisaj armonic ascendent discret la afișarea Casetei de Studiu sau a unei ferestre modale.
   */
  public playDrawerOpen(): void {
    if (!this.enabled || this.shouldThrottle(35)) return;
    const bus = this.ensureOutputBus();
    if (!bus) return;
    const { ctx, output } = bus;

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
    filter.frequency.setValueAtTime(1600, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.16, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.145);

    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gain);
    gain.connect(output);

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
    const bus = this.ensureOutputBus();
    if (!bus) return;
    const { ctx, output } = bus;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(523.25, now);
    osc.frequency.exponentialRampToValueAtTime(261.63, now + 0.115);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.15, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.125);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(output);

    osc.start(now);
    osc.stop(now + 0.135);
  }

  /**
   * Feedback sonor pentru răspunsurile din Quiz (acord luminos la răspuns corect, dublu ton blând la eroare).
   */
  public playQuizFeedback(correct: boolean): void {
    if (!this.enabled) return;
    const bus = this.ensureOutputBus();
    if (!bus) return;
    const { ctx, output } = bus;

    const now = ctx.currentTime;
    const sequence = correct
      ? [
          { freq: 523.25, delay: 0, dur: 0.11, peak: 0.16 },
          { freq: 659.25, delay: 0.055, dur: 0.12, peak: 0.16 },
          { freq: 783.99, delay: 0.11, dur: 0.16, peak: 0.18 },
        ]
      : [
          { freq: 293.66, delay: 0, dur: 0.1, peak: 0.14 },
          { freq: 233.08, delay: 0.075, dur: 0.14, peak: 0.13 },
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
      gain.connect(output);

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
        interactive.classList?.contains('search-result-item') ||
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
      if (tag === 'SELECT') {
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
          cls.contains('search-result-item') ||
          cls.contains('search-suggestion-item'))
      ) {
        return curr;
      }
      curr = curr.parentElement;
    }
    return null;
  }
}

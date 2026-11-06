// SPDX-License-Identifier: GPL-3.0-or-later

const STORAGE_KEY_MUSIC_ENABLED = 'orbitar_music_enabled';
const STORAGE_KEY_MUSIC_VOLUME = 'orbitar_music_volume';
const DEFAULT_VOLUME_PERCENT = 35;

/**
 * Paletă de acorduri spațiale calde și misterioase în Re Lydian / Si Minor (6 voci per acord, în Hz):
 * - Acordul 0 (D Lydian Maj9#11): [D2, A2, F#3, A3, C#4, E4]
 * - Acordul 1 (B Minor 9):        [B1, F#2, D3, F#3, A3, C#4]
 * - Acordul 2 (G Lydian Maj9):    [G1, D2, B2, F#3, A3, C#4]
 * - Acordul 3 (A6/9 Cosmic):      [A1, E2, C#3, F#3, B3, E4]
 */
const COSMIC_CHORDS_HZ: ReadonlyArray<ReadonlyArray<number>> = [
  [73.42, 110.0, 185.0, 220.0, 277.18, 329.63],
  [61.74, 92.5, 146.83, 185.0, 220.0, 277.18],
  [49.0, 73.42, 123.47, 185.0, 220.0, 277.18],
  [55.0, 82.41, 138.59, 185.0, 246.94, 329.63],
];

/**
 * Note pentatonice / lydiene în Re Lydian pentru arpegiile stelare rare (Mystery Shimmer):
 * D4, E4, F#4, G#4, A4, B4, C#5, D5, E5, F#5, A5
 */
const SHIMMER_SCALE_HZ: ReadonlyArray<number> = [
  293.66, 329.63, 369.99, 415.3, 440.0, 493.88, 554.37, 587.33, 659.25, 739.99, 880.0,
];

interface DroneVoice {
  oscA: OscillatorNode;
  oscB: OscillatorNode;
  subOsc: OscillatorNode | null;
  voiceGain: GainNode;
}

export type AmbientStateListener = (enabled: boolean, volumePercent: number) => void;

/**
 * SpaceAmbientEngine — Sintetizator polifonic generativ în timp real bazat exclusiv pe Web Audio API:
 * 1. Warm Drone Layer: 3 perechi de oscilatoare (`sawtooth` + `triangle` + `sine` sub-bass) dezacordate fin
 *    (`±6` până la `±12 cents`), filtrate lowpass (`320–750 Hz`, `Q = 1.2`) și modulate de un LFO la `0.03 Hz`.
 * 2. Mystery Shimmer: arpegii stelare rare la fiecare 5–11 secunde (`sine` + `triangle` filtrate la `1400 Hz`,
 *    attack `1.5s`, release `5.0s`).
 * 3. Stereo Ping-Pong Delay (`0.75s` stânga, `1.12s` dreapta, feedback `0.45` cu lowpass la `1200 Hz`)
 *    & Lush Cosmic Reverb catedratic de 6 secunde (`wet: 65%`, `dry: 35%`, filtrat la `1800 Hz`).
 * 4. Sub-curent de „Vânt Cosmic" (zgomot roz/brun filtrat bandpass la `120–280 Hz`).
 * 5. Auto-Ducking (`setDucking(active)`): coboară lin volumul la 25% în `0.5s` în timpul sintezei vocale
 *    sau al salutului de pe sonda Voyager.
 */
export class SpaceAmbientEngine {
  private static instance: SpaceAmbientEngine | null = null;

  public static getInstance(): SpaceAmbientEngine {
    if (!SpaceAmbientEngine.instance) {
      SpaceAmbientEngine.instance = new SpaceAmbientEngine();
    }
    return SpaceAmbientEngine.instance;
  }

  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private duckingGain: GainNode | null = null;
  private synthBus: GainNode | null = null;
  private droneVoices: DroneVoice[] = [];

  private enabled: boolean;
  private volumePercent: number;
  private isDucked = false;
  private isGraphInitialized = false;
  private currentChordIndex = 0;

  private chordTimerId: number | null = null;
  private shimmerTimerId: number | null = null;
  private listeners: AmbientStateListener[] = [];

  private constructor() {
    this.enabled = this.readInitialEnabled();
    this.volumePercent = this.readInitialVolume();
    this.installAutoplayUnlockListeners();
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getVolumePercent(): number {
    return this.volumePercent;
  }

  public getAudioContextState(): AudioContextState | 'uninitialized' {
    return this.ctx ? this.ctx.state : 'uninitialized';
  }

  public onChange(listener: AmbientStateListener): void {
    this.listeners.push(listener);
  }

  /**
   * Comută muzica ambientală On/Off (folosit de butonul `#orbitar-audio-toggle` și de `Tasta M`).
   */
  public toggle(): boolean {
    this.setEnabled(!this.enabled, false);
    return this.enabled;
  }

  /**
   * Activează sau oprește muzica ambientală cu tranziție lină fără click-uri audio.
   */
  public setEnabled(enable: boolean, useLongFadeIn = false): void {
    this.enabled = enable;
    try {
      window.localStorage.setItem(STORAGE_KEY_MUSIC_ENABLED, enable ? 'true' : 'false');
    } catch (_e) {
      // Ignorăm eventualele restricții de stocare
    }

    if (enable) {
      this.ensureAudioGraph();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      this.scheduleMasterVolume(useLongFadeIn ? 3.0 : 0.6);
      this.startGenerativeTimers();
    } else {
      this.scheduleMasterVolume(0.45);
      this.stopGenerativeTimers();
    }

    this.notifyListeners();
  }

  /**
   * Setează volumul master (`0% – 100%`) și îl salvează în `localStorage`.
   */
  public setVolumePercent(percent: number): void {
    const clamped = Math.max(0, Math.min(100, Math.round(percent)));
    this.volumePercent = clamped;
    try {
      window.localStorage.setItem(STORAGE_KEY_MUSIC_VOLUME, String(clamped));
    } catch (_e) {
      // Ignorăm eventualele restricții de stocare
    }

    if (clamped > 0 && !this.enabled) {
      this.setEnabled(true, false);
      return;
    }

    if (this.ctx && this.masterGain) {
      this.scheduleMasterVolume(0.12);
    }
    this.notifyListeners();
  }

  /**
   * Auto-Ducking pentru „🔊 Citește-mi" și Salutul Voyager:
   * Coboară lin volumul la 25% din nivelul curent în `0.5s` și revine la 100% când vocea se oprește.
   */
  public setDucking(active: boolean): void {
    this.isDucked = active;
    if (!this.ctx || !this.duckingGain) return;

    const now = this.ctx.currentTime;
    const targetDuckGain = active ? 0.25 : 1.0;
    const rampDuration = active ? 0.5 : 0.8;

    this.duckingGain.gain.cancelScheduledValues(now);
    this.duckingGain.gain.setValueAtTime(
      Math.max(0.0001, this.duckingGain.gain.value),
      now
    );
    this.duckingGain.gain.linearRampToValueAtTime(targetDuckGain, now + rampDuration);
  }

  /**
   * Redă un sunet cald de rezonanță magnetică la activarea Scuturilor Deflectoare
   * în Centura Principală de Asteroizi (~2.1–3.3 UA) sau în Centura Kuiper (~30–50 UA).
   */
  public playDeflectorShieldResonance(beltType: 'asteroid' | 'kuiper' = 'asteroid'): void {
    try {
      this.ensureAudioGraph();
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }

      const ctx = this.ctx;
      const now = ctx.currentTime;
      const duration = 2.6;

      const outGain = ctx.createGain();
      const baseLevel = Math.max(0.05, (this.volumePercent / 100) * 0.16);
      outGain.gain.setValueAtTime(0.0001, now);
      outGain.gain.linearRampToValueAtTime(baseLevel, now + 0.35);
      outGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      if (this.enabled && this.synthBus) {
        outGain.connect(this.synthBus);
      } else {
        outGain.connect(ctx.destination);
      }

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(beltType === 'kuiper' ? 980 : 640, now);
      filter.Q.setValueAtTime(2.4, now);
      filter.connect(outGain);

      // LFO pentru pulsația magnetică caldă a scutului deflector
      const pulseLfo = ctx.createOscillator();
      pulseLfo.type = 'sine';
      pulseLfo.frequency.setValueAtTime(beltType === 'kuiper' ? 4.2 : 5.5, now);
      const pulseGain = ctx.createGain();
      pulseGain.gain.setValueAtTime(180, now);
      pulseLfo.connect(pulseGain);
      pulseGain.connect(filter.frequency);
      pulseLfo.start(now);
      pulseLfo.stop(now + duration + 0.1);

      const freqs =
        beltType === 'kuiper'
          ? [196.0, 293.66, 440.0] // Sol - Re - La cristalin
          : [146.83, 220.0, 293.66]; // Re - La - Re magnetic cald

      freqs.forEach((f, idx) => {
        const osc = ctx.createOscillator();
        osc.type = idx === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(f * 0.92, now);
        osc.frequency.exponentialRampToValueAtTime(f, now + 0.45);
        osc.detune.setValueAtTime(idx === 1 ? 6 : -6, now);

        const vGain = ctx.createGain();
        vGain.gain.setValueAtTime(idx === 0 ? 0.5 : 0.3, now);
        osc.connect(vGain);
        vGain.connect(filter);

        osc.start(now);
        osc.stop(now + duration + 0.1);
      });
    } catch (_e) {
      // Ignorăm eventualele restricții AudioContext în medii fără ieșire audio
    }
  }

  /**
   * Construiește întregul graf de sinteză în Web Audio API la prima activare.
   */
  private ensureAudioGraph(): void {
    if (this.isGraphInitialized && this.ctx) {
      return;
    }

    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) {
      return;
    }

    const ctx = new AudioCtx();
    this.ctx = ctx;

    // 1. Master Gain & Auto-Ducking Gain
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.masterGain = masterGain;

    const duckingGain = ctx.createGain();
    duckingGain.gain.setValueAtTime(this.isDucked ? 0.25 : 1.0, ctx.currentTime);
    this.duckingGain = duckingGain;

    duckingGain.connect(masterGain);
    masterGain.connect(ctx.destination);

    // 2. Mix Bus (Dry 35% + Wet Reverb 65% + Stereo Ping-Pong Delay)
    const synthBus = ctx.createGain();
    synthBus.gain.setValueAtTime(0.85, ctx.currentTime);
    this.synthBus = synthBus;

    const dryGain = ctx.createGain();
    dryGain.gain.setValueAtTime(0.35, ctx.currentTime);

    const wetReverbGain = ctx.createGain();
    wetReverbGain.gain.setValueAtTime(0.65, ctx.currentTime);

    // ConvolverNode cu impuls catedratic de 6 secunde filtrat low-pass la 1800 Hz
    const convolver = ctx.createConvolver();
    convolver.buffer = this.createCosmicReverbImpulse(ctx, 6.0, 1800);

    const reverbToneFilter = ctx.createBiquadFilter();
    reverbToneFilter.type = 'lowpass';
    reverbToneFilter.frequency.setValueAtTime(1800, ctx.currentTime);
    reverbToneFilter.Q.setValueAtTime(0.7, ctx.currentTime);

    synthBus.connect(dryGain);
    dryGain.connect(duckingGain);

    synthBus.connect(convolver);
    convolver.connect(reverbToneFilter);
    reverbToneFilter.connect(wetReverbGain);
    wetReverbGain.connect(duckingGain);

    // 3. Stereo Ping-Pong Delay (stânga 0.75s, dreapta 1.12s, feedback 0.45, lowpass 1200 Hz)
    this.buildStereoPingPongDelay(ctx, synthBus, duckingGain, convolver);

    // 4. Warm Drone Layer (3 perechi de oscilatoare sawtooth + triangle + sine sub-bass)
    this.buildWarmDroneLayer(ctx, synthBus);

    // 5. Sub-curent de „Vânt Cosmic" (zgomot roz/brun filtrat bandpass la 120–280 Hz)
    this.buildCosmicWindLayer(ctx, duckingGain, convolver);

    this.isGraphInitialized = true;
  }

  /**
   * Construiește stratul Warm Drone:
   * - 3 perechi de oscilatoare (`sawtooth` + `triangle` + `sine` sub-bass) dezacordate fin (`±6` la `±12 cents`)
   * - Filtru `BiquadFilterNode` lowpass (`320 Hz – 750 Hz`, `Q = 1.2`) modulat de un LFO sinusoidal la `0.03 Hz`
   */
  private buildWarmDroneLayer(ctx: AudioContext, destination: AudioNode): void {
    const droneFilter = ctx.createBiquadFilter();
    droneFilter.type = 'lowpass';
    // Frecvența centrală 535 Hz ± 215 Hz -> baleiază organic între 320 Hz și 750 Hz
    droneFilter.frequency.setValueAtTime(535, ctx.currentTime);
    droneFilter.Q.setValueAtTime(1.2, ctx.currentTime);

    // LFO sinusoidal foarte lent (0.03 Hz ~ un ciclu la 33.3 secunde)
    const filterLfo = ctx.createOscillator();
    filterLfo.type = 'sine';
    filterLfo.frequency.setValueAtTime(0.03, ctx.currentTime);

    const filterLfoGain = ctx.createGain();
    filterLfoGain.gain.setValueAtTime(215, ctx.currentTime);

    filterLfo.connect(filterLfoGain);
    filterLfoGain.connect(droneFilter.frequency);
    filterLfo.start();

    const droneSumGain = ctx.createGain();
    droneSumGain.gain.setValueAtTime(0.42, ctx.currentTime);
    droneFilter.connect(droneSumGain);
    droneSumGain.connect(destination);

    const initialChord = COSMIC_CHORDS_HZ[0];
    const detunePairs: ReadonlyArray<[number, number]> = [
      [-8, 8],
      [-11, 9],
      [-7, 12],
      [-10, 7],
      [-6, 10],
      [-12, 6],
    ];
    const voiceLevels = [0.22, 0.19, 0.16, 0.14, 0.12, 0.1];

    this.droneVoices = initialChord.map((freqHz, idx) => {
      const voiceGain = ctx.createGain();
      voiceGain.gain.setValueAtTime(voiceLevels[idx] ?? 0.12, ctx.currentTime);
      voiceGain.connect(droneFilter);

      // Oscilator A: sawtooth cald
      const oscA = ctx.createOscillator();
      oscA.type = 'sawtooth';
      oscA.frequency.setValueAtTime(freqHz, ctx.currentTime);
      oscA.detune.setValueAtTime(detunePairs[idx][0], ctx.currentTime);

      const oscAGain = ctx.createGain();
      oscAGain.gain.setValueAtTime(0.38, ctx.currentTime);
      oscA.connect(oscAGain);
      oscAGain.connect(voiceGain);

      // Oscilator B: triangle catifelat
      const oscB = ctx.createOscillator();
      oscB.type = 'triangle';
      oscB.frequency.setValueAtTime(freqHz, ctx.currentTime);
      oscB.detune.setValueAtTime(detunePairs[idx][1], ctx.currentTime);

      const oscBGain = ctx.createGain();
      oscBGain.gain.setValueAtTime(0.52, ctx.currentTime);
      oscB.connect(oscBGain);
      oscBGain.connect(voiceGain);

      // Pentru primele 3 perechi adăugăm și oscilatorul sine sub-bass profund
      let subOsc: OscillatorNode | null = null;
      if (idx < 3) {
        subOsc = ctx.createOscillator();
        subOsc.type = 'sine';
        subOsc.frequency.setValueAtTime(freqHz * 0.5, ctx.currentTime);
        subOsc.detune.setValueAtTime(idx === 0 ? -4 : 4, ctx.currentTime);

        const subGain = ctx.createGain();
        subGain.gain.setValueAtTime(idx === 0 ? 0.55 : 0.35, ctx.currentTime);
        subOsc.connect(subGain);
        subGain.connect(voiceGain);
        subOsc.start();
      }

      oscA.start();
      oscB.start();

      return {
        oscA,
        oscB,
        subOsc,
        voiceGain,
      };
    });
  }

  /**
   * Evoluție armonică lentă (crossfade de 7 secunde cu `exponentialRampToValueAtTime` / `linearRampToValueAtTime`)
   * prin paleta de acorduri în Re Lydian / Si Minor.
   */
  private transitionToNextChord(): void {
    if (!this.ctx || !this.enabled || this.droneVoices.length === 0) return;

    this.currentChordIndex = (this.currentChordIndex + 1) % COSMIC_CHORDS_HZ.length;
    const nextChord = COSMIC_CHORDS_HZ[this.currentChordIndex];
    const now = this.ctx.currentTime;
    const crossfadeSec = 7.0;

    this.droneVoices.forEach((voice, idx) => {
      const targetFreq = nextChord[idx] ?? nextChord[0];
      const safeTarget = Math.max(24, targetFreq);

      voice.oscA.frequency.cancelScheduledValues(now);
      voice.oscA.frequency.setValueAtTime(Math.max(24, voice.oscA.frequency.value), now);
      voice.oscA.frequency.exponentialRampToValueAtTime(safeTarget, now + crossfadeSec);

      voice.oscB.frequency.cancelScheduledValues(now);
      voice.oscB.frequency.setValueAtTime(Math.max(24, voice.oscB.frequency.value), now);
      voice.oscB.frequency.exponentialRampToValueAtTime(safeTarget, now + crossfadeSec);

      if (voice.subOsc) {
        const subTarget = Math.max(20, safeTarget * 0.5);
        voice.subOsc.frequency.cancelScheduledValues(now);
        voice.subOsc.frequency.setValueAtTime(Math.max(20, voice.subOsc.frequency.value), now);
        voice.subOsc.frequency.exponentialRampToValueAtTime(subTarget, now + crossfadeSec);
      }

      // Respiră ușor și amplitudinea fiecărei voci în timpul tranziției
      const baseLevel = [0.22, 0.19, 0.16, 0.14, 0.12, 0.1][idx] ?? 0.12;
      const breathedLevel = baseLevel * (0.88 + ((this.currentChordIndex + idx) % 3) * 0.08);
      voice.voiceGain.gain.cancelScheduledValues(now);
      voice.voiceGain.gain.setValueAtTime(voice.voiceGain.gain.value, now);
      voice.voiceGain.gain.linearRampToValueAtTime(breathedLevel, now + crossfadeSec);
    });
  }

  /**
   * Mystery Shimmer / Arpegii Stelare Rare:
   * Declanșează câte o notă caldă, cristalină dar rotunjită (`sine` + `triangle` filtrate low-pass la `1400 Hz`),
   * cu atac lent (`attack: 1.5s`) și eliberare lungă (`release: 5.0s`).
   */
  private triggerMysteryShimmerNote(): void {
    if (!this.ctx || !this.synthBus || !this.enabled || this.ctx.state !== 'running') {
      return;
    }

    const ctx = this.ctx;
    const now = ctx.currentTime;
    const noteHz =
      SHIMMER_SCALE_HZ[Math.floor(Math.random() * SHIMMER_SCALE_HZ.length)] ?? 440.0;

    const attackSec = 1.5;
    const releaseSec = 5.0;
    const totalDuration = attackSec + releaseSec + 0.25;

    const noteFilter = ctx.createBiquadFilter();
    noteFilter.type = 'lowpass';
    noteFilter.frequency.setValueAtTime(1400, now);
    noteFilter.Q.setValueAtTime(0.9, now);

    const envGain = ctx.createGain();
    envGain.gain.setValueAtTime(0.0001, now);
    envGain.gain.linearRampToValueAtTime(0.095, now + attackSec);
    envGain.gain.exponentialRampToValueAtTime(0.0001, now + attackSec + releaseSec);

    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime((Math.random() - 0.5) * 1.1, now);

    const sineOsc = ctx.createOscillator();
    sineOsc.type = 'sine';
    sineOsc.frequency.setValueAtTime(noteHz, now);
    sineOsc.detune.setValueAtTime(-5, now);

    const triOsc = ctx.createOscillator();
    triOsc.type = 'triangle';
    triOsc.frequency.setValueAtTime(noteHz, now);
    triOsc.detune.setValueAtTime(5, now);

    const triSubMix = ctx.createGain();
    triSubMix.gain.setValueAtTime(0.45, now);

    sineOsc.connect(noteFilter);
    triOsc.connect(triSubMix);
    triSubMix.connect(noteFilter);

    noteFilter.connect(envGain);
    envGain.connect(panner);
    panner.connect(this.synthBus);

    sineOsc.start(now);
    triOsc.start(now);
    sineOsc.stop(now + totalDuration);
    triOsc.stop(now + totalDuration);

    sineOsc.onended = () => {
      sineOsc.disconnect();
      triOsc.disconnect();
      triSubMix.disconnect();
      noteFilter.disconnect();
      envGain.disconnect();
      panner.disconnect();
    };
  }

  /**
   * Stereo Ping-Pong Delay:
   * `DelayNode` stânga `0.75s`, dreapta `1.12s`, feedback `0.45`, trecut printr-un filtru `lowpass`
   * la `1200 Hz` în bucla de feedback pentru ca ecourile să devină tot mai calde și mai întunecate.
   */
  private buildStereoPingPongDelay(
    ctx: AudioContext,
    source: AudioNode,
    dryDestination: AudioNode,
    reverbSend: AudioNode
  ): void {
    const delayLeft = ctx.createDelay(2.5);
    delayLeft.delayTime.setValueAtTime(0.75, ctx.currentTime);

    const delayRight = ctx.createDelay(2.5);
    delayRight.delayTime.setValueAtTime(1.12, ctx.currentTime);

    const fbFilterLeft = ctx.createBiquadFilter();
    fbFilterLeft.type = 'lowpass';
    fbFilterLeft.frequency.setValueAtTime(1200, ctx.currentTime);

    const fbFilterRight = ctx.createBiquadFilter();
    fbFilterRight.type = 'lowpass';
    fbFilterRight.frequency.setValueAtTime(1200, ctx.currentTime);

    const fbGainLeft = ctx.createGain();
    fbGainLeft.gain.setValueAtTime(0.45, ctx.currentTime);

    const fbGainRight = ctx.createGain();
    fbGainRight.gain.setValueAtTime(0.45, ctx.currentTime);

    // Intrare în bucla Ping-Pong
    const inputSend = ctx.createGain();
    inputSend.gain.setValueAtTime(0.32, ctx.currentTime);
    source.connect(inputSend);
    inputSend.connect(delayLeft);

    // Stânga -> Filtru 1200 Hz -> Feedback 0.45 -> Dreapta -> Filtru 1200 Hz -> Feedback 0.45 -> Stânga
    delayLeft.connect(fbFilterLeft);
    fbFilterLeft.connect(fbGainLeft);
    fbGainLeft.connect(delayRight);

    delayRight.connect(fbFilterRight);
    fbFilterRight.connect(fbGainRight);
    fbGainRight.connect(delayLeft);

    // Panoramare stereo stânga / dreapta
    const merger = ctx.createChannelMerger(2);
    fbFilterLeft.connect(merger, 0, 0);
    fbFilterRight.connect(merger, 0, 1);

    const delayOutGain = ctx.createGain();
    delayOutGain.gain.setValueAtTime(0.34, ctx.currentTime);
    merger.connect(delayOutGain);

    delayOutGain.connect(dryDestination);
    delayOutGain.connect(reverbSend);
  }

  /**
   * Generează matematic un `AudioBuffer` stereo de 6 secunde cu zgomot roz/alb amortizat exponențial
   * și filtrat low-pass la `1800 Hz` pentru `ConvolverNode`.
   */
  private createCosmicReverbImpulse(
    ctx: AudioContext,
    durationSeconds: number,
    lowpassCutoffHz: number
  ): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSeconds);
    const impulse = ctx.createBuffer(2, length, sampleRate);

    // Coeficient RC one-pole lowpass pentru 1800 Hz
    const dt = 1 / sampleRate;
    const rc = 1 / (2 * Math.PI * lowpassCutoffHz);
    const alpha = dt / (rc + dt);

    for (let ch = 0; ch < 2; ch++) {
      const channelData = impulse.getChannelData(ch);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      let lpPrev = 0;

      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const white = Math.random() * 2 - 1;
        // Aproximare Kellet pentru zgomot roz cald
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        const pink = (b0 + b1 + b2 + white * 0.1848) * 0.14;

        // Filtru low-pass la 1800 Hz aplicat direct eșantioanelor impulsului
        lpPrev = lpPrev + alpha * (pink - lpPrev);

        // Amortizare exponențială lină pe 6 secunde + pre-attack de 35ms
        const preIn = Math.min(1, t / 0.035);
        const decay = Math.exp((-4.6 * t) / durationSeconds);
        channelData[i] = lpPrev * preIn * decay;
      }
    }

    return impulse;
  }

  /**
   * Sub-curent de „Vânt Cosmic" (foarte subtil):
   * Zgomot roz/brun filtrat `bandpass` foarte jos (`120–280 Hz`), abia perceptibil,
   * care adaugă textură de „cameră spațială".
   */
  private buildCosmicWindLayer(
    ctx: AudioContext,
    dryDestination: AudioNode,
    reverbSend: AudioNode
  ): void {
    const bufferSec = 5.0;
    const length = Math.floor(ctx.sampleRate * bufferSec);
    const noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Zgomot brun/roz catifelat
      lastOut = (lastOut + 0.025 * white) / 1.025;
      // Fereastră de crossfade la capete pentru loop fără cusur
      const edge = Math.min(1, i / 2400, (length - 1 - i) / 2400);
      data[i] = lastOut * 2.4 * edge;
    }

    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(195, ctx.currentTime);
    bandpass.Q.setValueAtTime(1.5, ctx.currentTime);

    // Modulație lentă a filtrului bandpass între 120 Hz și 280 Hz
    const windLfo = ctx.createOscillator();
    windLfo.type = 'sine';
    windLfo.frequency.setValueAtTime(0.045, ctx.currentTime);

    const windLfoGain = ctx.createGain();
    windLfoGain.gain.setValueAtTime(75, ctx.currentTime);

    windLfo.connect(windLfoGain);
    windLfoGain.connect(bandpass.frequency);

    const windGain = ctx.createGain();
    windGain.gain.setValueAtTime(0.045, ctx.currentTime);

    noiseSource.connect(bandpass);
    bandpass.connect(windGain);
    windGain.connect(dryDestination);
    windGain.connect(reverbSend);

    noiseSource.start();
    windLfo.start();
  }

  private scheduleMasterVolume(rampSeconds: number): void {
    if (!this.ctx || !this.masterGain) return;
    const now = this.ctx.currentTime;
    const targetLinear = this.enabled
      ? Math.max(0.0001, (this.volumePercent / 100) * 0.65)
      : 0.0001;

    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(
      Math.max(0.0001, this.masterGain.gain.value),
      now
    );
    this.masterGain.gain.linearRampToValueAtTime(targetLinear, now + rampSeconds);
  }

  private startGenerativeTimers(): void {
    this.stopGenerativeTimers();

    // Evoluție armonică lentă la fiecare 19 secunde (cu crossfade de 7s)
    this.chordTimerId = window.setInterval(() => {
      this.transitionToNextChord();
    }, 19000);

    // Primul arpegiu stelar rar după ~3.2 secunde, apoi aleatoriu la fiecare 5–11 secunde
    const scheduleNextShimmer = (delayMs: number): void => {
      this.shimmerTimerId = window.setTimeout(() => {
        if (!this.enabled) return;
        this.triggerMysteryShimmerNote();
        const nextDelayMs = 5000 + Math.floor(Math.random() * 6000);
        scheduleNextShimmer(nextDelayMs);
      }, delayMs);
    };

    scheduleNextShimmer(3200);
  }

  private stopGenerativeTimers(): void {
    if (this.chordTimerId !== null) {
      window.clearInterval(this.chordTimerId);
      this.chordTimerId = null;
    }
    if (this.shimmerTimerId !== null) {
      window.clearTimeout(this.shimmerTimerId);
      this.shimmerTimerId = null;
    }
  }

  /**
   * Gestionarea politicii Autoplay din browsere:
   * Dacă `orbitar_music_enabled` este activ în `localStorage`, pornește `AudioContext`-ul
   * cu un fade-in de 3 secunde la primul click/atingere a utilizatorului oriunde în scena 3D.
   */
  private installAutoplayUnlockListeners(): void {
    const unlockHandler = (): void => {
      if (!this.enabled) return;
      const wasUninitialized = !this.isGraphInitialized || !this.ctx;
      this.ensureAudioGraph();
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx
          .resume()
          .then(() => {
            this.scheduleMasterVolume(3.0);
            this.startGenerativeTimers();
          })
          .catch(() => {});
      } else if (wasUninitialized && this.ctx && this.ctx.state === 'running') {
        this.scheduleMasterVolume(3.0);
        this.startGenerativeTimers();
      }
    };

    window.addEventListener('pointerdown', unlockHandler, { passive: true });
    window.addEventListener('keydown', unlockHandler, { passive: true });
  }

  private readInitialEnabled(): boolean {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_MUSIC_ENABLED);
      if (saved === 'true') return true;
      if (saved === 'false') return false;
    } catch (_e) {
      // Ignorăm eventualele restricții de stocare
    }
    return false;
  }

  private readInitialVolume(): number {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_MUSIC_VOLUME);
      if (saved !== null) {
        const parsed = Number(saved);
        if (Number.isFinite(parsed)) {
          return Math.max(0, Math.min(100, Math.round(parsed)));
        }
      }
    } catch (_e) {
      // Ignorăm eventualele restricții de stocare
    }
    return DEFAULT_VOLUME_PERCENT;
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.enabled, this.volumePercent);
    }
  }
}

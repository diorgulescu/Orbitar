// SPDX-License-Identifier: GPL-3.0-or-later
import { AgeTier } from '../types/celestial';
import { RomanianSpeechNormalizer } from './RomanianSpeechNormalizer';
import { SpaceAmbientEngine } from './SpaceAmbientEngine';

export interface SpeechPlaybackOptions {
  /** ID-ul corpului ceresc dacă se redă descrierea unui corp (pentru Treapta 1: `public/audio/tts/<bodyId>_<tier>.mp3`) */
  bodyId?: string;
  /** Nivelul de vârstă (`junior` sau `cadet`) pentru selecția fișierului audio pre-generat */
  tier?: AgeTier;
  /** Viteza de rostire Web Speech API (implicit `0.96` — ritm cald și clar pentru 6–12 ani) */
  rate?: number;
  /** Înălțimea tonală Web Speech API (implicit `1.02`) */
  pitch?: number;
  /** Pauza în milisecunde între propoziții în Treapta 2 (implicit `220ms`) */
  sentencePauseMs?: number;
  /** Forțează folosirea Treptei 2 (Web Speech API) chiar dacă există fișier pre-generat */
  forceWebSpeech?: boolean;
  /** Apelat când începe redarea vocală */
  onStart?: () => void;
  /** Apelat când redarea vocală s-a încheiat natural sau a fost oprită */
  onEnd?: () => void;
}

const DEFAULT_SPEECH_RATE = 0.96;
const DEFAULT_SPEECH_PITCH = 1.02;
const DEFAULT_SENTENCE_PAUSE_MS = 220;

/**
 * Calculează scorul de calitate al unei voci `SpeechSynthesisVoice` pentru limba română:
 * 1. Prioritate maximă: voci neurale/naturale (`Natural`, `Neural`, `Online`, `Microsoft Emil`, `Microsoft Alina`, `Google română`, `Enhanced`, `Premium`, `Ioana`).
 * 2. Prioritate secundară: orice altă voce cu `lang` care începe cu `ro` (`ro-RO`, `ro_RO`).
 */
export function scoreRomanianVoice(voice: SpeechSynthesisVoice): number {
  const lang = (voice.lang || '').toLowerCase().replace('_', '-');
  const name = voice.name || '';
  const nameLower = name.toLowerCase();

  const isRomanianLang = lang.startsWith('ro');
  const mentionsRomanian =
    nameLower.includes('română') ||
    nameLower.includes('romana') ||
    nameLower.includes('romanian') ||
    nameLower.includes('emil') ||
    nameLower.includes('alina') ||
    nameLower.includes('ioana');

  if (!isRomanianLang && !mentionsRomanian) {
    return -1;
  }

  let score = isRomanianLang ? 50 : 30;
  if (lang === 'ro-ro') {
    score += 10;
  }

  if (nameLower.includes('natural') || nameLower.includes('neural')) {
    score += 120;
  }
  if (nameLower.includes('emil') || nameLower.includes('alina')) {
    score += 90;
  }
  if (nameLower.includes('online')) {
    score += 60;
  }
  if (nameLower.includes('google') && (nameLower.includes('română') || nameLower.includes('romana'))) {
    score += 85;
  }
  if (nameLower.includes('enhanced') || nameLower.includes('premium')) {
    score += 75;
  }
  if (nameLower.includes('ioana')) {
    score += 45;
  }
  if (voice.localService === false) {
    score += 15;
  }

  return score;
}

/**
 * Selectează cea mai bună voce în limba română disponibilă dintr-o listă de `SpeechSynthesisVoice`.
 */
export function selectBestRomanianVoice(
  voices: ReadonlyArray<SpeechSynthesisVoice>
): SpeechSynthesisVoice | null {
  let bestVoice: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const voice of voices) {
    const score = scoreRomanianVoice(voice);
    if (score > bestScore) {
      bestScore = score;
      bestVoice = voice;
    }
  }

  return bestScore >= 0 ? bestVoice : null;
}

/**
 * SpeechManager — Arhitectură Hibridă de Redare Vocală în 2 Trepte pentru Orbitar:
 * - Treapta 1: Redă fișierele audio neurale pre-generate (`./audio/tts/<bodyId>_<tier>.mp3` sau `.ogg`)
 *   cu `HTMLAudioElement` pentru calitate studio 100% naturală, offline și identică pe orice dispozitiv.
 * - Treapta 2: Fallback / Redare dinamică prin Web Speech API cu selector inteligent de voci neurale
 *   (`ro-RO`), normalizare fonetică și științifică (`RomanianSpeechNormalizer`) și chunking pe propoziții
 *   cu micro-pauză naturală de `220ms`, `rate = 0.96` și `pitch = 1.02`.
 * - Gestionează unificat `SpaceAmbientEngine.getInstance().setDucking(true/false)`.
 */
export class SpeechManager {
  private static instance: SpeechManager | null = null;

  public static getInstance(): SpeechManager {
    if (!SpeechManager.instance) {
      SpeechManager.instance = new SpeechManager();
    }
    return SpeechManager.instance;
  }

  private cachedVoices: SpeechSynthesisVoice[] = [];
  private activeAudio: HTMLAudioElement | null = null;
  private activeBufferSource: AudioBufferSourceNode | null = null;
  private ttsAudioCtx: AudioContext | null = null;
  private sentenceTimerId: number | null = null;
  private playbackSessionId = 0;
  private speaking = false;
  private activeOnEndCallback: (() => void) | null = null;
  private lastSpokenNormalizedText = '';
  private lastSpokenSentences: string[] = [];

  private constructor() {
    this.initVoiceWatcher();
  }

  private initVoiceWatcher(): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    const refreshVoices = (): void => {
      try {
        const list = window.speechSynthesis.getVoices?.() ?? [];
        if (list.length > 0) {
          this.cachedVoices = list;
        }
      } catch (_e) {
        // Ignorăm eventualele restricții ale browserului
      }
    };

    refreshVoices();
    try {
      if (typeof window.speechSynthesis.addEventListener === 'function') {
        window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
      } else if ('onvoiceschanged' in window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = refreshVoices;
      }
    } catch (_e) {
      // Ignorăm dacă voiceschanged nu este suportat în mediul de test
    }
  }

  public isSpeaking(): boolean {
    return this.speaking;
  }

  public getLastSpokenNormalizedText(): string {
    return this.lastSpokenNormalizedText;
  }

  public getLastSpokenSentences(): ReadonlyArray<string> {
    return this.lastSpokenSentences;
  }

  public getPreferredVoice(): SpeechSynthesisVoice | null {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const liveVoices = window.speechSynthesis.getVoices?.() ?? [];
      if (liveVoices.length > 0) {
        this.cachedVoices = liveVoices;
      }
    }
    return selectBestRomanianVoice(this.cachedVoices);
  }

  /**
   * Oprește imediat orice redare vocală în curs (atât `HTMLAudioElement` cât și `speechSynthesis`)
   * și readuce volumul muzicii ambientale la 100%.
   */
  public stop(): void {
    this.playbackSessionId += 1;

    if (this.sentenceTimerId !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.sentenceTimerId);
      this.sentenceTimerId = null;
    }

    if (this.activeBufferSource) {
      try {
        this.activeBufferSource.onended = null;
        this.activeBufferSource.stop();
        this.activeBufferSource.disconnect();
      } catch (_e) {}
      this.activeBufferSource = null;
    }

    if (this.activeAudio) {
      try {
        this.activeAudio.onended = null;
        this.activeAudio.onerror = null;
        this.activeAudio.pause();
      } catch (_e) {}
      this.activeAudio = null;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch (_e) {}
    }

    const wasSpeaking = this.speaking;
    this.speaking = false;
    SpaceAmbientEngine.getInstance().setDucking(false);

    const endCb = this.activeOnEndCallback;
    this.activeOnEndCallback = null;
    if (wasSpeaking && endCb) {
      endCb();
    }
  }

  /**
   * Redă descrierea unui corp ceresc pentru butonul „🔊 Citește-mi”:
   * - Încearcă mai întâi Treapta 1 (`./audio/tts/${bodyId}_${tier}.mp3` / `.ogg`);
   * - Dacă fișierul nu este disponibil, folosește automat Treapta 2 (Web Speech API cu chunking și normalizare fonetică).
   */
  public speakBodyNarration(
    bodyId: string,
    tier: AgeTier,
    rawTextRo: string,
    options: Omit<SpeechPlaybackOptions, 'bodyId' | 'tier'> = {}
  ): void {
    this.speak(rawTextRo, {
      ...options,
      bodyId,
      tier,
    });
  }

  /**
   * Redă orice text în limba română (din Panoul de Studiu, Calculatorul de Bord din Mod Pilot sau Salutul Voyager).
   */
  public speak(rawTextRo: string, options: SpeechPlaybackOptions = {}): void {
    this.stop();

    const normalized = RomanianSpeechNormalizer.normalize(rawTextRo);
    const sentences = RomanianSpeechNormalizer.splitSentences(normalized);
    this.lastSpokenNormalizedText = normalized;
    this.lastSpokenSentences = sentences;

    if (!normalized || sentences.length === 0) {
      options.onEnd?.();
      return;
    }

    const sessionId = ++this.playbackSessionId;
    this.speaking = true;
    this.activeOnEndCallback = options.onEnd ?? null;
    SpaceAmbientEngine.getInstance().setDucking(true);
    options.onStart?.();

    if (options.bodyId && options.tier && !options.forceWebSpeech) {
      void this.tryPlayPreGeneratedAudio(
        options.bodyId,
        options.tier,
        sessionId,
        sentences,
        options
      );
      return;
    }

    this.speakSentencesWithWebSpeech(sentences, sessionId, options);
  }

  private getOrCreateTtsAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtxCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxCtor) return null;
    try {
      if (!this.ttsAudioCtx || this.ttsAudioCtx.state === 'closed') {
        this.ttsAudioCtx = new AudioCtxCtor();
      }
      if (this.ttsAudioCtx.state === 'suspended') {
        void this.ttsAudioCtx.resume().catch(() => {});
      }
      return this.ttsAudioCtx;
    } catch (_e) {
      return null;
    }
  }

  private async tryPlayPreGeneratedAudio(
    bodyId: string,
    tier: AgeTier,
    sessionId: number,
    fallbackSentences: string[],
    options: SpeechPlaybackOptions
  ): Promise<void> {
    const candidates = [
      `./audio/tts/${bodyId}_${tier}.mp3`,
      `./audio/tts/${bodyId}_${tier}.ogg`,
    ];

    // 1. Calea primară (100% compatibilă cu Tauri macOS WKWebView tauri://localhost, Safari și Service Worker):
    //    Descărcare în memorie cu fetch() + decodare Web Audio API (AudioContext.decodeAudioData)
    const audioCtx = this.getOrCreateTtsAudioContext();
    if (audioCtx && typeof window !== 'undefined' && typeof window.fetch === 'function') {
      for (const url of candidates) {
        if (sessionId !== this.playbackSessionId) return;
        try {
          const response = await window.fetch(url);
          if (!response.ok) continue;
          const arrayBuffer = await response.arrayBuffer();
          if (sessionId !== this.playbackSessionId) return;
          if (!arrayBuffer || arrayBuffer.byteLength < 512) continue;

          const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
          if (sessionId !== this.playbackSessionId) return;

          const source = audioCtx.createBufferSource();
          source.buffer = decodedBuffer;
          source.connect(audioCtx.destination);
          this.activeBufferSource = source;

          source.onended = () => {
            if (this.activeBufferSource === source) {
              this.activeBufferSource = null;
            }
            if (sessionId === this.playbackSessionId) {
              this.completeSession(sessionId);
            }
          };

          source.start(0);
          return;
        } catch (_err) {
          // Încercăm următorul candidat sau fallback-ul HTMLAudioElement
        }
      }
    }

    // 2. Calea secundară: HTMLAudioElement (new Audio)
    if (typeof Audio === 'undefined') {
      this.speakSentencesWithWebSpeech(fallbackSentences, sessionId, options);
      return;
    }

    const attemptCandidateAt = (idx: number): void => {
      if (sessionId !== this.playbackSessionId) return;
      if (idx >= candidates.length) {
        this.speakSentencesWithWebSpeech(fallbackSentences, sessionId, options);
        return;
      }

      const url = candidates[idx];
      try {
        const audio = new Audio(url);
        audio.preload = 'auto';
        this.activeAudio = audio;

        let settled = false;
        const handleEnded = (): void => {
          if (settled) return;
          settled = true;
          if (sessionId === this.playbackSessionId) {
            this.completeSession(sessionId);
          }
        };

        const handleFailure = (): void => {
          if (settled) return;
          settled = true;
          if (this.activeAudio === audio) {
            this.activeAudio = null;
          }
          attemptCandidateAt(idx + 1);
        };

        audio.onended = handleEnded;
        audio.onerror = handleFailure;

        const playPromise = audio.play();
        if (playPromise && typeof playPromise.then === 'function') {
          playPromise.catch(() => {
            handleFailure();
          });
        }
      } catch (_e) {
        attemptCandidateAt(idx + 1);
      }
    };

    attemptCandidateAt(0);
  }

  private speakSentencesWithWebSpeech(
    sentences: string[],
    sessionId: number,
    options: SpeechPlaybackOptions
  ): void {
    if (
      typeof window === 'undefined' ||
      !('speechSynthesis' in window) ||
      typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      this.completeSession(sessionId);
      return;
    }

    const rate = options.rate ?? DEFAULT_SPEECH_RATE;
    const pitch = options.pitch ?? DEFAULT_SPEECH_PITCH;
    const pauseMs = options.sentencePauseMs ?? DEFAULT_SENTENCE_PAUSE_MS;
    const preferredVoice = this.getPreferredVoice();

    try {
      window.speechSynthesis.cancel();
    } catch (_e) {}

    const speakChunkAtIndex = (index: number): void => {
      if (sessionId !== this.playbackSessionId) return;
      if (index >= sentences.length) {
        this.completeSession(sessionId);
        return;
      }

      const sentence = sentences[index];
      const utterance = new SpeechSynthesisUtterance(sentence);
      utterance.lang = 'ro-RO';
      utterance.rate = rate;
      utterance.pitch = pitch;
      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      let chunkFinished = false;
      const advanceNext = (): void => {
        if (chunkFinished || sessionId !== this.playbackSessionId) return;
        chunkFinished = true;

        if (index + 1 >= sentences.length) {
          this.completeSession(sessionId);
          return;
        }

        if (pauseMs <= 0) {
          speakChunkAtIndex(index + 1);
          return;
        }

        this.sentenceTimerId = window.setTimeout(() => {
          this.sentenceTimerId = null;
          speakChunkAtIndex(index + 1);
        }, pauseMs);
        (this.sentenceTimerId as unknown as { unref?: () => void })?.unref?.();
      };

      utterance.onend = advanceNext;
      utterance.onerror = advanceNext;

      try {
        window.speechSynthesis.speak(utterance);
      } catch (_e) {
        this.completeSession(sessionId);
      }
    };

    speakChunkAtIndex(0);
  }

  private completeSession(sessionId: number): void {
    if (sessionId !== this.playbackSessionId) return;
    this.activeAudio = null;
    this.speaking = false;
    SpaceAmbientEngine.getInstance().setDucking(false);

    const endCb = this.activeOnEndCallback;
    this.activeOnEndCallback = null;
    if (endCb) {
      endCb();
    }
  }
}

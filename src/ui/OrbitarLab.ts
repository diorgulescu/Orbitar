// SPDX-License-Identifier: GPL-3.0-or-later
import { CelestialBodyData } from '../types/celestial';

/**
 * OrbitarLab gestionează secțiunea interactivă "Laboratorul Orbitar" din Panoul Lateral de Studiu:
 * a) Calculatorul "Cât cântăresc și cât de sus sar aici?" (input greutate kg / săritură cm).
 * b) Calculatorul "Câți ani am pe această lume?" (conversie în ani și zile locale).
 * c) Pentru Voyager 1 și 2: caseta dedicată "Discul de Aur — Salutul în limba română (1977)"
 *    cu player audio pentru `/audio/salut-voyager-ro.ogg` și fallback vocal în limba română.
 */
export class OrbitarLab {
  private weightEarthKg = 35;
  private jumpEarthCm = 40;
  private ageEarthYears = 10;
  private currentBody: CelestialBodyData | null = null;
  private voyagerAudio: HTMLAudioElement | null = null;

  constructor() {
    this.bindEvents();
  }

  private bindEvents(): void {
    const inputWeight = document.getElementById('lab-input-weight') as HTMLInputElement | null;
    const inputJump = document.getElementById('lab-input-jump') as HTMLInputElement | null;
    const inputAge = document.getElementById('lab-input-age') as HTMLInputElement | null;
    const btnPlayVoyager = document.getElementById('btn-voyager-audio');

    inputWeight?.addEventListener('input', () => {
      const val = parseFloat(inputWeight.value);
      if (Number.isFinite(val) && val > 0) {
        this.weightEarthKg = Math.min(val, 500);
        this.recalculate();
      }
    });

    inputJump?.addEventListener('input', () => {
      const val = parseFloat(inputJump.value);
      if (Number.isFinite(val) && val > 0) {
        this.jumpEarthCm = Math.min(val, 300);
        this.recalculate();
      }
    });

    inputAge?.addEventListener('input', () => {
      const val = parseFloat(inputAge.value);
      if (Number.isFinite(val) && val > 0) {
        this.ageEarthYears = Math.min(val, 120);
        this.recalculate();
      }
    });

    btnPlayVoyager?.addEventListener('click', () => {
      this.playVoyagerRomanianGreeting();
    });
  }

  public updateForBody(body: CelestialBodyData): void {
    this.currentBody = body;

    // Afișăm caseta dedicată Discului de Aur exclusiv pentru Voyager 1 și Voyager 2
    const voyagerBox = document.getElementById('lab-voyager-golden-record');
    if (voyagerBox) {
      const isVoyager = body.id === 'voyager1' || body.id === 'voyager2';
      voyagerBox.classList.toggle('is-hidden', !isVoyager);
    }

    this.recalculate();
  }

  private recalculate(): void {
    if (!this.currentBody) return;
    const b = this.currentBody;

    // 1. Calculator "Cât cântăresc și cât de sus sar aici?"
    const weightResultEl = document.getElementById('lab-result-weight');
    const jumpResultEl = document.getElementById('lab-result-jump');

    if (b.gravityRatio <= 0.0005) {
      if (weightResultEl) {
        weightResultEl.textContent = '0 kg (Imponderabilitate!)';
      }
      if (jumpResultEl) {
        jumpResultEl.textContent = 'Plutești liber în spațiu ∞';
      }
    } else {
      const localWeight = this.weightEarthKg * b.gravityRatio;
      const localJumpCm = this.jumpEarthCm / b.gravityRatio;

      if (weightResultEl) {
        weightResultEl.textContent = `${localWeight.toFixed(1).replace('.', ',')} kg`;
      }
      if (jumpResultEl) {
        if (localJumpCm >= 100) {
          jumpResultEl.textContent = `${(localJumpCm / 100).toFixed(2).replace('.', ',')} metri!`;
        } else {
          jumpResultEl.textContent = `${localJumpCm.toFixed(1).replace('.', ',')} cm`;
        }
      }
    }

    // 2. Calculator "Câți ani am pe această lume?"
    const ageYearsEl = document.getElementById('lab-result-years');
    const ageDaysEl = document.getElementById('lab-result-days');

    const totalEarthDays = this.ageEarthYears * 365.256;
    const totalEarthHours = totalEarthDays * 24;

    if (b.orbitPeriodDays <= 0) {
      if (ageYearsEl) ageYearsEl.textContent = 'Soarele este centrul orbitelor!';
    } else {
      const localYears = totalEarthDays / b.orbitPeriodDays;
      if (ageYearsEl) {
        if (localYears >= 10) {
          ageYearsEl.textContent = `${localYears.toFixed(1).replace('.', ',')} ani locali`;
        } else {
          ageYearsEl.textContent = `${localYears.toFixed(3).replace('.', ',')} ani locali`;
        }
      }
    }

    const dayHours = Math.abs(b.dayLengthHours);
    if (dayHours > 0 && ageDaysEl) {
      const localDays = Math.round(totalEarthHours / dayHours);
      ageDaysEl.textContent = `${localDays.toLocaleString('ro-RO')} zile locale`;
    }
  }

  /**
   * Redă fișierul `/audio/salut-voyager-ro.ogg` și completează cu sinteza vocală în limba română
   * rostind salutul istoric de pe Discul de Aur Voyager (1977): "Salutări la toată lumea!".
   */
  private playVoyagerRomanianGreeting(): void {
    const statusEl = document.getElementById('voyager-audio-status');
    if (statusEl) {
      statusEl.textContent = '🔊 Se redă salutul în limba română: „Salutări la toată lumea!” (1977)…';
    }

    const speakFallbackGreeting = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(
          'Salutări la toată lumea! Acesta este mesajul în limba română gravat pe Discul de Aur al sondelor Voyager în anul o mie nouă sute șaptezeci și șapte.'
        );
        utter.lang = 'ro-RO';
        utter.rate = 0.95;
        utter.onend = () => {
          if (statusEl) {
            statusEl.textContent = '✅ Mesaj interstelar redat („Salutări la toată lumea!”)';
          }
        };
        window.speechSynthesis.speak(utter);
      }
    };

    try {
      if (!this.voyagerAudio) {
        this.voyagerAudio = new Audio('./audio/salut-voyager-ro.ogg');
      }
      this.voyagerAudio.currentTime = 0;
      this.voyagerAudio
        .play()
        .then(() => {
          // După tonul Discului de Aur, rostim salutul în limba română
          window.setTimeout(speakFallbackGreeting, 650);
        })
        .catch(() => {
          speakFallbackGreeting();
        });
    } catch {
      speakFallbackGreeting();
    }
  }
}

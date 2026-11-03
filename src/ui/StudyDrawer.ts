// SPDX-License-Identifier: GPL-3.0-or-later
import { CelestialBodyInstance } from '../core/OrbitalEngine';
import { AgeTier } from '../types/celestial';
import { OrbitarLab } from './OrbitarLab';

const STORAGE_KEY_BADGES = 'orbitar_badges';

/**
 * StudyDrawer gestionează Panoul Lateral de Studiu (Bento Dark Mode):
 * - Se deschide la selectarea unui corp ceresc
 * - Buton "🔊 Citește-mi" (window.speechSynthesis în limba ro-RO)
 * - Afișare adaptivă a datelor (junior vs cadet) + Quiz interactiv
 * - Secțiunea interactivă "Laboratorul Orbitar" (OrbitarLab)
 */
export class StudyDrawer {
  private currentBody: CelestialBodyInstance | null = null;
  private currentTier: AgeTier;
  private isSpeaking = false;
  private readonly lab: OrbitarLab;
  private readonly onResetOverview: () => void;

  constructor(initialTier: AgeTier, onResetOverview: () => void) {
    this.currentTier = initialTier;
    this.onResetOverview = onResetOverview;
    this.lab = new OrbitarLab();
    this.bindEvents();
  }

  private bindEvents(): void {
    const btnClose = document.getElementById('btn-drawer-close');
    const drawerEl = document.getElementById('hud-study-drawer');
    const btnResetCam = document.getElementById('btn-reset-camera');
    const btnSpeak = document.getElementById('btn-speak-ro');

    btnClose?.addEventListener('click', () => {
      this.stopSpeech();
      drawerEl?.classList.add('is-collapsed');
    });

    btnResetCam?.addEventListener('click', () => {
      this.stopSpeech();
      this.onResetOverview();
    });

    btnSpeak?.addEventListener('click', () => {
      this.toggleSpeechRo();
    });
  }

  public setTier(tier: AgeTier): void {
    this.currentTier = tier;
    this.stopSpeech();
    if (this.currentBody) {
      this.renderBody(this.currentBody, false);
    }
  }

  public showBody(body: CelestialBodyInstance): void {
    this.stopSpeech();
    this.renderBody(body, true);
  }

  public updateLiveDistance(body: CelestialBodyInstance | null): void {
    if (!body) return;
    const distEl = document.getElementById('hud-target-dist');
    if (distEl) {
      const distStr = body.distanceFromSunAu.toFixed(2).replace('.', ',');
      distEl.textContent = `Distanță de Soare: ${distStr} UA`;
    }
  }

  private renderBody(body: CelestialBodyInstance, openDrawer: boolean): void {
    this.currentBody = body;
    const d = body.data;

    const drawerEl = document.getElementById('hud-study-drawer');
    if (openDrawer && drawerEl) {
      drawerEl.classList.remove('is-collapsed');
    }

    const nameEl = document.getElementById('hud-target-name');
    const subtitleEl = document.getElementById('hud-target-subtitle');
    const catEl = document.getElementById('hud-target-category');
    const descEl = document.getElementById('hud-target-desc');

    if (nameEl) nameEl.textContent = d.name;
    if (subtitleEl) subtitleEl.textContent = d.subtitle;
    if (catEl) catEl.textContent = body.meta.categoryNameRo;

    const juniorBox = document.getElementById('hud-junior-box');
    const cadetBox = document.getElementById('hud-cadet-box');

    if (this.currentTier === 'junior') {
      if (descEl) descEl.textContent = d.junior.summary;
      juniorBox?.classList.remove('is-hidden');
      cadetBox?.classList.add('is-hidden');

      const analogyEl = document.getElementById('hud-junior-analogy');
      const factEl = document.getElementById('hud-junior-fact');
      const carEl = document.getElementById('travel-car');
      const planeEl = document.getElementById('travel-plane');
      const rocketEl = document.getElementById('travel-rocket');
      const lightEl = document.getElementById('travel-light');

      if (analogyEl) analogyEl.textContent = d.junior.analogy;
      if (factEl) factEl.textContent = d.junior.funFact;
      if (carEl) carEl.textContent = d.junior.travelTime.car;
      if (planeEl) planeEl.textContent = d.junior.travelTime.plane;
      if (rocketEl) rocketEl.textContent = d.junior.travelTime.rocket;
      if (lightEl) lightEl.textContent = d.junior.travelTime.light;
    } else {
      if (descEl) descEl.textContent = d.cadet.summary;
      juniorBox?.classList.add('is-hidden');
      cadetBox?.classList.remove('is-hidden');

      const radiusEl = document.getElementById('metric-radius');
      const gravityEl = document.getElementById('metric-gravity');
      const tempEl = document.getElementById('metric-temp');
      const orbitEl = document.getElementById('metric-orbit');
      const structureEl = document.getElementById('hud-cadet-structure');
      const historyEl = document.getElementById('hud-cadet-history');

      if (radiusEl) radiusEl.textContent = `${d.radiusKm.toLocaleString('ro-RO')} km`;
      if (gravityEl) gravityEl.textContent = `${d.gravityRatio} × Pământ`;
      if (tempEl) tempEl.textContent = `${d.meanTempC} °C`;
      if (orbitEl) {
        orbitEl.textContent =
          d.orbitPeriodDays > 0
            ? `${d.orbitPeriodDays.toLocaleString('ro-RO')} zile`
            : 'Centrul Sistemului Solar';
      }

      if (structureEl) {
        structureEl.innerHTML = d.cadet.structure
          .map(
            (s) =>
              `<div class="structure-item"><strong>${s.name}:</strong> ${s.description}</div>`
          )
          .join('');
      }
      if (historyEl) {
        historyEl.textContent = d.cadet.explorationHistory;
      }

      this.renderQuiz(d);
    }

    this.lab.updateForBody(d);
    this.updateLiveDistance(body);
  }

  private renderQuiz(d: CelestialBodyInstance['data']): void {
    const questionEl = document.getElementById('hud-quiz-question');
    const optionsEl = document.getElementById('hud-quiz-options');
    const feedbackEl = document.getElementById('hud-quiz-feedback');
    if (!questionEl || !optionsEl || !feedbackEl) return;

    questionEl.textContent = `🎯 Quiz Cadet: ${d.cadet.quiz.question}`;
    feedbackEl.textContent = '';
    optionsEl.innerHTML = '';

    d.cadet.quiz.options.forEach((optText, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-opt-btn';
      btn.textContent = optText;
      btn.addEventListener('click', () => {
        const isCorrect = idx === d.cadet.quiz.correctIndex;
        btn.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
        feedbackEl.textContent = isCorrect
          ? `✅ Bravo, Cadet! ${d.cadet.quiz.explanation}`
          : `❌ Mai încearcă! ${d.cadet.quiz.explanation}`;

        if (isCorrect) {
          this.saveBadge(d.id);
        }
      });
      optionsEl.appendChild(btn);
    });
  }

  private saveBadge(bodyId: string): void {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_BADGES);
      const list = raw ? (JSON.parse(raw) as string[]) : [];
      if (!list.includes(bodyId)) {
        list.push(bodyId);
        window.localStorage.setItem(STORAGE_KEY_BADGES, JSON.stringify(list));
      }
    } catch {
      // Ignorăm eventualele restricții LocalStorage
    }
  }

  /**
   * Sinteză vocală (Text-to-Speech) în limba română (`ro-RO`) pentru butonul "🔊 Citește-mi".
   */
  private toggleSpeechRo(): void {
    if (!('speechSynthesis' in window) || !this.currentBody) return;

    const btnSpeak = document.getElementById('btn-speak-ro');
    if (this.isSpeaking) {
      this.stopSpeech();
      return;
    }

    const d = this.currentBody.data;
    const textToRead =
      this.currentTier === 'junior'
        ? `${d.name}. ${d.subtitle}. ${d.junior.summary} Analogie: ${d.junior.analogy} Știai că? ${d.junior.funFact}`
        : `${d.name}. ${d.subtitle}. ${d.cadet.summary} Istoricul explorării: ${d.cadet.explorationHistory}`;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'ro-RO';
    utterance.rate = 0.96;

    const voices = window.speechSynthesis.getVoices();
    const roVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ro'));
    if (roVoice) {
      utterance.voice = roVoice;
    }

    this.isSpeaking = true;
    if (btnSpeak) {
      btnSpeak.textContent = '⏹ Oprește citirea';
      btnSpeak.classList.add('hud-btn-active-amber');
    }

    utterance.onend = () => {
      this.stopSpeech();
    };
    utterance.onerror = () => {
      this.stopSpeech();
    };

    window.speechSynthesis.speak(utterance);
  }

  public stopSpeech(): void {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    this.isSpeaking = false;
    const btnSpeak = document.getElementById('btn-speak-ro');
    if (btnSpeak) {
      btnSpeak.textContent = '🔊 Citește-mi';
      btnSpeak.classList.remove('hud-btn-active-amber');
    }
  }
}

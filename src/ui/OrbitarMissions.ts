// SPDX-License-Identifier: GPL-3.0-or-later
import { CelestialBodyInstance, OrbitalEngine } from '../core/OrbitalEngine';

const STORAGE_KEY_BADGES = 'orbitar_badges';

export interface CosmicTreasureMission {
  missionNumber: number;
  targetBodyId: string;
  badgeTitleRo: string;
  badgeIcon: string;
  challengePromptRo: string;
  hintRo: string;
}

export const ORBITAR_TREASURE_MISSIONS: CosmicTreasureMission[] = [
  {
    missionNumber: 1,
    targetBodyId: 'jwst',
    badgeTitleRo: 'Ochiul de Aur (JWST)',
    badgeIcon: '🔭',
    challengePromptRo:
      'Misiunea 1: Găsește în Orbitar telescopul spațial aflat în punctul L2 și dă click pe el!',
    hintRo:
      'Indiciu: Are o oglindă aurită în formă de fagure și orbitează chiar lângă Pământ (poți folosi și filtrul „Sonde & Telescoape”).',
  },
  {
    missionNumber: 2,
    targetBodyId: 'mars',
    badgeTitleRo: 'Explorator Marțian',
    badgeIcon: '🔴',
    challengePromptRo:
      'Misiunea 2: Găsește Planeta Roșie unde au amartizat roverele Perseverance și Curiosity și dă click pe ea!',
    hintRo:
      'Indiciu: Este a patra planetă de la Soare, aflată imediat după orbita Pământului.',
  },
  {
    missionNumber: 3,
    targetBodyId: 'saturn',
    badgeTitleRo: 'Stăpânul Inelelor',
    badgeIcon: '🪐',
    challengePromptRo:
      'Misiunea 3: Descoperă bijuteria Sistemului Solar, gigantul gazos înconjurat de inele strălucitoare de gheață!',
    hintRo: 'Indiciu: Este a șasea planetă de la Soare, după uriașul Jupiter.',
  },
  {
    missionNumber: 4,
    targetBodyId: 'iss',
    badgeTitleRo: 'Comandant Orbital (ISS)',
    badgeIcon: '🛰️',
    challengePromptRo:
      'Misiunea 4: Găsește laboratorul spațial locuit de astronauți care zboară pe orbita joasă a Pământului (~420 km)!',
    hintRo:
      'Indiciu: Apropie-te de Pământ sau selectează „Stația Spațială Internațională (ISS)” în scena 3D.',
  },
  {
    missionNumber: 5,
    targetBodyId: 'pluto',
    badgeTitleRo: 'Inima din Kuiper',
    badgeIcon: '💜',
    challengePromptRo:
      'Misiunea 5: Caută la marginea Sistemului Solar planeta pitică ce poartă pe suprafața ei un ghețar în formă de inimă!',
    hintRo: 'Indiciu: Se află în Centura Kuiper, dincolo de orbita albastră a lui Neptun.',
  },
  {
    missionNumber: 6,
    targetBodyId: 'voyager1',
    badgeTitleRo: 'Mesager Interstelar',
    badgeIcon: '💿',
    challengePromptRo:
      'Misiunea 6: Găsește sonda lansată în 1977 care poartă în spațiul interstelar Discul de Aur cu salutul în limba română!',
    hintRo: 'Indiciu: Este cel mai îndepărtat obiect creat de om — caută „Voyager 1”!',
  },
];

/**
 * OrbitarMissions implementează modulul de studiu interactiv "Misiunile Orbitar"
 * (joc de tip "Vânătoare de Comori Cosmică") și "Jurnalul de Bord Orbitar" cu insigne
 * salvate local în `localStorage` sub cheia `orbitar_badges`.
 */
export class OrbitarMissions {
  private readonly orbitalEngine: OrbitalEngine;
  private readonly onFocusBody: (bodyId: string) => void;
  private onGenerateDiploma?: () => void;

  private isOpen = false;
  private currentMissionIndex = 0;
  private targetIdentifiedIn3D = false;
  private unlockedBadges: Set<string>;

  constructor(orbitalEngine: OrbitalEngine, onFocusBody: (bodyId: string) => void) {
    this.orbitalEngine = orbitalEngine;
    this.onFocusBody = onFocusBody;
    this.unlockedBadges = new Set(this.loadBadgesFromStorage());

    // Alegem prima misiune încă nerezolvată
    const firstPending = ORBITAR_TREASURE_MISSIONS.findIndex(
      (m) => !this.unlockedBadges.has(m.targetBodyId)
    );
    this.currentMissionIndex = firstPending >= 0 ? firstPending : 0;

    this.bindEvents();
    this.render();
  }

  public setOnGenerateDiploma(callback: () => void): void {
    this.onGenerateDiploma = callback;
  }

  private loadBadgesFromStorage(): string[] {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY_BADGES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((x): x is string => typeof x === 'string');
        }
      }
    } catch {
      // Ignorăm eventualele restricții LocalStorage
    }
    return [];
  }

  private saveBadgesToStorage(): void {
    try {
      window.localStorage.setItem(
        STORAGE_KEY_BADGES,
        JSON.stringify(Array.from(this.unlockedBadges))
      );
    } catch {
      // Ignorăm eventualele restricții LocalStorage
    }
  }

  public unlockBadge(bodyId: string): void {
    if (!this.unlockedBadges.has(bodyId)) {
      this.unlockedBadges.add(bodyId);
      this.saveBadgesToStorage();
    }
    this.render();
  }

  public getUnlockedBadges(): string[] {
    return Array.from(this.unlockedBadges);
  }

  private bindEvents(): void {
    const btnToggle = document.getElementById('btn-missions-toggle');
    const btnClose = document.getElementById('btn-missions-close');
    const btnHint = document.getElementById('btn-mission-hint');
    const btnPrev = document.getElementById('btn-mission-prev');
    const btnNext = document.getElementById('btn-mission-next');
    const btnDiploma = document.getElementById('btn-missions-diploma');

    btnToggle?.addEventListener('click', () => {
      this.setOpen(!this.isOpen);
    });

    btnClose?.addEventListener('click', () => {
      this.setOpen(false);
    });

    btnDiploma?.addEventListener('click', () => {
      this.onGenerateDiploma?.();
    });

    btnHint?.addEventListener('click', () => {
      const hintBox = document.getElementById('mission-hint-text');
      const mission = ORBITAR_TREASURE_MISSIONS[this.currentMissionIndex];
      if (hintBox && mission) {
        hintBox.textContent = mission.hintRo;
        hintBox.classList.remove('is-hidden');
      }
    });

    btnPrev?.addEventListener('click', () => {
      this.currentMissionIndex =
        (this.currentMissionIndex - 1 + ORBITAR_TREASURE_MISSIONS.length) %
        ORBITAR_TREASURE_MISSIONS.length;
      this.targetIdentifiedIn3D = false;
      this.render();
    });

    btnNext?.addEventListener('click', () => {
      this.currentMissionIndex =
        (this.currentMissionIndex + 1) % ORBITAR_TREASURE_MISSIONS.length;
      this.targetIdentifiedIn3D = false;
      this.render();
    });
  }

  public setOpen(open: boolean): void {
    this.isOpen = open;
    const panelEl = document.getElementById('hud-missions-panel');
    const btnToggle = document.getElementById('btn-missions-toggle');
    panelEl?.classList.toggle('is-hidden', !open);
    btnToggle?.classList.toggle('hud-btn-active-amber', open);
    if (open) {
      this.render();
    }
  }

  /**
   * Apelată când copilul selectează un corp ceresc în scena 3D.
   * Verifică dacă obiectul selectat corespunde țintei Misiunii Orbitar curente!
   */
  public handleBodySelectedIn3D(body: CelestialBodyInstance | null): void {
    if (!body) return;
    const currentMission = ORBITAR_TREASURE_MISSIONS[this.currentMissionIndex];
    if (!currentMission) return;

    if (body.data.id === currentMission.targetBodyId) {
      this.targetIdentifiedIn3D = true;
      this.render();
    }
  }

  public render(): void {
    const mission = ORBITAR_TREASURE_MISSIONS[this.currentMissionIndex];
    if (!mission) return;

    const badgeCountEl = document.getElementById('hud-badges-count');
    const totalMissions = ORBITAR_TREASURE_MISSIONS.length;
    const earnedCount = this.unlockedBadges.size;
    if (badgeCountEl) {
      badgeCountEl.textContent = `${earnedCount}/${totalMissions}`;
    }

    // Actualizăm bara de progres a insignelor și bannerul festiv
    const progressFill = document.getElementById('missions-progress-bar-fill');
    const progressLabel = document.getElementById('missions-progress-label');
    const celebrationBanner = document.getElementById('missions-celebration-banner');
    const pct = Math.round((earnedCount / totalMissions) * 100);
    if (progressFill) {
      progressFill.style.width = `${pct}%`;
      progressFill.parentElement?.setAttribute('aria-valuenow', String(earnedCount));
    }
    if (progressLabel) {
      progressLabel.textContent = `${earnedCount} / ${totalMissions} insigne (${pct}%)`;
    }
    if (celebrationBanner) {
      celebrationBanner.classList.toggle('is-hidden', earnedCount < totalMissions);
    }

    const promptEl = document.getElementById('mission-prompt-text');
    const statusEl = document.getElementById('mission-step-status');
    const hintBox = document.getElementById('mission-hint-text');
    const quizContainer = document.getElementById('mission-quiz-container');
    const quizQuestionEl = document.getElementById('mission-quiz-question');
    const quizOptionsEl = document.getElementById('mission-quiz-options');
    const quizFeedbackEl = document.getElementById('mission-quiz-feedback');
    const logbookGrid = document.getElementById('logbook-badges-grid');

    if (promptEl) {
      promptEl.textContent = `${mission.badgeIcon} ${mission.challengePromptRo}`;
    }
    hintBox?.classList.add('is-hidden');

    const isAlreadyUnlocked = this.unlockedBadges.has(mission.targetBodyId);
    const targetBody = this.orbitalEngine.getBody(mission.targetBodyId);

    if (isAlreadyUnlocked) {
      if (statusEl) {
        statusEl.textContent = `🏅 Misiune îndeplinită! Ai deblocat insigna „${mission.badgeTitleRo}”.`;
        statusEl.className = 'mission-status is-success';
      }
      quizContainer?.classList.add('is-hidden');
    } else if (!this.targetIdentifiedIn3D) {
      if (statusEl) {
        statusEl.textContent =
          'Pasul 1/2: Caută obiectul în scena 3D (sau prin căutare) și dă click pe el!';
        statusEl.className = 'mission-status';
      }
      quizContainer?.classList.add('is-hidden');
    } else if (targetBody && quizContainer && quizQuestionEl && quizOptionsEl && quizFeedbackEl) {
      if (statusEl) {
        statusEl.textContent = `🎯 Țintă identificată (${targetBody.data.name})! Pasul 2/2: Răspunde la întrebarea grilă pentru insignă:`;
        statusEl.className = 'mission-status is-success';
      }
      quizContainer.classList.remove('is-hidden');
      const q = targetBody.data.cadet.quiz;
      quizQuestionEl.textContent = q.question;
      quizFeedbackEl.textContent = '';
      quizOptionsEl.innerHTML = '';

      q.options.forEach((optText, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'quiz-opt-btn';
        btn.textContent = optText;
        btn.addEventListener('click', () => {
          if (idx === q.correctIndex) {
            btn.classList.add('is-correct');
            quizFeedbackEl.textContent = `🎉 Felicitări! ${q.explanation}`;
            this.unlockBadge(mission.targetBodyId);
          } else {
            btn.classList.add('is-wrong');
            quizFeedbackEl.textContent = `❌ Mai încearcă! Indiciu: ${q.explanation}`;
          }
        });
        quizOptionsEl.appendChild(btn);
      });
    }

    // Randăm Jurnalul de Bord Orbitar (insigne deblocate și blocate)
    if (logbookGrid) {
      logbookGrid.innerHTML = ORBITAR_TREASURE_MISSIONS.map((m) => {
        const unlocked = this.unlockedBadges.has(m.targetBodyId);
        return `
          <button
            type="button"
            class="logbook-badge-card ${unlocked ? 'is-unlocked' : 'is-locked'}"
            data-badge-target="${m.targetBodyId}"
            title="${unlocked ? 'Insignă deblocată! Click pentru a zbura la țintă' : m.challengePromptRo}"
          >
            <span class="badge-icon">${unlocked ? m.badgeIcon : '🔒'}</span>
            <span class="badge-name">${m.badgeTitleRo}</span>
          </button>
        `;
      }).join('');

      logbookGrid.querySelectorAll<HTMLButtonElement>('[data-badge-target]').forEach((card) => {
        card.addEventListener('click', () => {
          const targetId = card.dataset.badgeTarget;
          if (targetId) {
            const idx = ORBITAR_TREASURE_MISSIONS.findIndex((m) => m.targetBodyId === targetId);
            if (idx >= 0) {
              this.currentMissionIndex = idx;
              if (this.unlockedBadges.has(targetId)) {
                this.onFocusBody(targetId);
              }
              this.render();
            }
          }
        });
      });
    }
  }
}

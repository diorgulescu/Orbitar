// SPDX-License-Identifier: GPL-3.0-or-later

export const ONBOARDING_STORAGE_KEY = 'orbitar_onboarding_seen_v1';

export interface TutorialStep {
  badgeRo: string;
  icon: string;
  titleRo: string;
  summaryRo: string;
  bulletsRo: string[];
  tipRo: string;
}

export const ORBITAR_TUTORIAL_STEPS: ReadonlyArray<TutorialStep> = [
  {
    badgeRo: 'Pasul 1 din 4 • Navigare 3D & Studiu',
    icon: '🪐',
    titleRo: 'Bun venit în Orbitar — Planetariul Tău 3D!',
    summaryRo:
      'Explorează interactiv Soarele, planetele, lunile lor (inclusiv Phobos, Deimos, Mimas, Iapetus, Miranda, Titania, Triton și Charon), asteroizii și sondele spațiale.',
    bulletsRo: [
      '🖱️ Rotește camera 3D ținând apăsat click-stânga (sau cu un deget pe tabletă) și apropie/depărtează cu rotița mouse-ului.',
      '🎯 Dă click direct pe orice corp ceresc în spațiu sau alege-l din banda de jos pentru a zbura automat către el.',
      '📖 În dreapta se deschide Fișa de Studiu cu narațiune vocală în română, fotografii NASA, calculator de greutate/vârstă și quiz.',
    ],
    tipRo: 'Sfat rapid: Poți căuta instant orice planetă, lună sau sondă în căsuța 🔍 Caută din stânga-sus!',
  },
  {
    badgeRo: 'Pasul 2 din 4 • Orizonturi Cosmice & Timp',
    icon: '🌌',
    titleRo: 'Călătorește de la Sistemul Solar până la Galaxii',
    summaryRo:
      'Orbitar îți permite să schimbi atât scara universului, cât și scara distanțelor și viteza timpului.',
    bulletsRo: [
      '🔭 Orizontul Cosmic (sus): comută între „☀️ Sistemul Solar”, „✨ Stele și exoplanete” și „🌀 Calea Lactee și galaxii”.',
      '🗂️ Filtre pe categorii (sus): afișează toate obiectele sau doar „Planete & Luni”, „Pitice & Asteroizi” ori „Sonde & Telescoape”.',
      '⏱️ Bara de jos: pune simularea pe Pauză, revino la „Timp Real (Acum)” sau comută între „Scara Didactică” și „Scara Reală”.',
    ],
    tipRo: 'Sfat rapid: Folosește „🚀 Rigla cu Viteza Luminii” din bara de jos pentru a vedea cât face o rază de lumină între două lumi!',
  },
  {
    badgeRo: 'Pasul 3 din 4 • Mod Pilot & Misiuni',
    icon: '🚀',
    titleRo: 'Urcă la Manșa Navei și Câștigă Insigne!',
    summaryRo:
      'Transformă planetariul într-un simulator de zbor spațial la persoana întâi sau rezolvă ghicitorile cosmice.',
    bulletsRo: [
      '🚀 Mod Pilot (butonul din dreapta-sus sau tasta P): pilotează 3 nave („Vlaicu-1”, „Coandă-X” și „Luceafărul”) cu W/A/S/D sau pe Pilot Automat.',
      '🎯 Misiuni (dreapta-sus): urmează indiciile din Vânătoarea de Comori Cosmică, răspunde la întrebările din Quiz și colecționează cele 6 insigne.',
    ],
    tipRo: 'Sfat rapid: În Modul Pilot, când alegi o destinație din listă, nava pornește automat zborul către ea!',
  },
  {
    badgeRo: 'Pasul 4 din 4 • Planșe A4, Vârstă & Clasă',
    icon: '🎨',
    titleRo: 'Adaptat pentru Copii (6–12 ani) și Sala de Clasă',
    summaryRo:
      'Personalizează explicațiile pe vârste și imprimă materiale didactice gata de folosit la școală sau acasă.',
    bulletsRo: [
      '👧👦 Nivel de vârstă (sus): comută între „6–8 ani” (Micul Explorator) și „9–12 ani” (Cadet Orbitar).',
      '🎨 Planșe de Colorat & Fișe (jos): printează pe hârtie A4 planșe de colorat vectoriale, fișe de studiu și Diplome de Cadet Spațial.',
      '🖥️ Comenzi rapide: tasta F11 pentru Ecran Complet la proiector, tasta Q pentru grafică HD / Eco, tasta M pentru muzică și F1 pentru caseta Despre.',
    ],
    tipRo: 'Poți redeschide oricând acest ghid din butonul „ⓘ Despre / GPLv3” din colțul din dreapta-jos.',
  },
];

/**
 * OnboardingTutorial gestionează ghidul interactiv succint al interfeței Orbitar,
 * afișat automat o singură dată la prima pornire a programului / prima accesare a site-ului
 * (și disponibil ulterior la cerere din caseta „Despre Orbitar”).
 */
export class OnboardingTutorial {
  private currentStepIndex = 0;

  constructor(autoShowOnFirstLaunch = true) {
    this.ensureDomElements();
    this.bindEvents();
    this.renderStep();

    if (autoShowOnFirstLaunch) {
      this.showIfFirstLaunch();
    }
  }

  /**
   * Verifică în `localStorage` dacă utilizatorul se află la prima pornire a aplicației.
   * Dacă da, deschide tutorialul și marchează cheia astfel încât să nu mai apară la următoarele porniri.
   */
  public showIfFirstLaunch(): boolean {
    if (this.hasSeenTutorial()) {
      return false;
    }
    this.markTutorialSeen();
    this.open(0);
    return true;
  }

  public hasSeenTutorial(): boolean {
    try {
      return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === '1';
    } catch (_e) {
      return false;
    }
  }

  public markTutorialSeen(): void {
    try {
      window.localStorage.setItem(ONBOARDING_STORAGE_KEY, '1');
    } catch (_e) {
      // Ignorăm eventualele restricții de localStorage
    }
  }

  public open(stepIndex = 0): void {
    this.currentStepIndex = Math.max(0, Math.min(ORBITAR_TUTORIAL_STEPS.length - 1, stepIndex));
    this.renderStep();
    const modal = document.getElementById('hud-onboarding-modal');
    modal?.classList.remove('is-hidden');
  }

  public close(): void {
    this.markTutorialSeen();
    const modal = document.getElementById('hud-onboarding-modal');
    modal?.classList.add('is-hidden');
  }

  public nextStep(): void {
    if (this.currentStepIndex < ORBITAR_TUTORIAL_STEPS.length - 1) {
      this.currentStepIndex += 1;
      this.renderStep();
    } else {
      this.close();
    }
  }

  public prevStep(): void {
    if (this.currentStepIndex > 0) {
      this.currentStepIndex -= 1;
      this.renderStep();
    }
  }

  public getCurrentStepIndex(): number {
    return this.currentStepIndex;
  }

  private renderStep(): void {
    const step = ORBITAR_TUTORIAL_STEPS[this.currentStepIndex] ?? ORBITAR_TUTORIAL_STEPS[0];
    const badgeEl = document.getElementById('onboarding-step-badge');
    const iconEl = document.getElementById('onboarding-step-icon');
    const titleEl = document.getElementById('onboarding-step-title');
    const summaryEl = document.getElementById('onboarding-step-summary');
    const listEl = document.getElementById('onboarding-step-list');
    const tipEl = document.getElementById('onboarding-step-tip');
    const dotsEl = document.getElementById('onboarding-step-dots');
    const btnPrev = document.getElementById('btn-onboarding-prev') as HTMLButtonElement | null;
    const btnNext = document.getElementById('btn-onboarding-next') as HTMLButtonElement | null;

    if (badgeEl) badgeEl.textContent = step.badgeRo;
    if (iconEl) iconEl.textContent = step.icon;
    if (titleEl) titleEl.textContent = step.titleRo;
    if (summaryEl) summaryEl.textContent = step.summaryRo;
    if (listEl) {
      listEl.innerHTML = step.bulletsRo.map((b) => `<li>${b}</li>`).join('');
    }
    if (tipEl) tipEl.textContent = `💡 ${step.tipRo}`;

    if (dotsEl) {
      dotsEl.innerHTML = ORBITAR_TUTORIAL_STEPS.map(
        (_, idx) =>
          `<button type="button" class="onboarding-dot${
            idx === this.currentStepIndex ? ' is-active' : ''
          }" data-step-index="${idx}" aria-label="Pasul ${idx + 1}"></button>`
      ).join('');

      const dotButtons = dotsEl.querySelectorAll('.onboarding-dot');
      for (const dotBtn of dotButtons) {
        dotBtn.addEventListener('click', () => {
          const idx = Number(dotBtn.getAttribute('data-step-index') ?? '0');
          this.currentStepIndex = Math.max(0, Math.min(ORBITAR_TUTORIAL_STEPS.length - 1, idx));
          this.renderStep();
        });
      }
    }

    if (btnPrev) {
      btnPrev.disabled = this.currentStepIndex === 0;
      btnPrev.style.visibility = this.currentStepIndex === 0 ? 'hidden' : 'visible';
    }

    if (btnNext) {
      const isLast = this.currentStepIndex === ORBITAR_TUTORIAL_STEPS.length - 1;
      btnNext.textContent = isLast ? '🚀 Începe Explorarea!' : 'Înainte ➡️';
    }
  }

  private ensureDomElements(): void {
    if (document.getElementById('hud-onboarding-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'hud-onboarding-modal';
    modal.className = 'modal-backdrop is-hidden';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'onboarding-step-title');
    modal.innerHTML = `
      <div class="bento-card modal-card onboarding-modal-card">
        <div class="modal-header">
          <span id="onboarding-step-badge" class="telemetry-tag">Pasul 1 din 4</span>
          <button id="btn-onboarding-close" type="button" class="hud-icon-btn" aria-label="Închide ghidul">✕</button>
        </div>
        <div class="modal-body onboarding-modal-body">
          <div class="onboarding-hero-row">
            <div id="onboarding-step-icon" class="onboarding-hero-icon" aria-hidden="true">🪐</div>
            <div>
              <h2 id="onboarding-step-title" class="onboarding-title">Bun venit în Orbitar!</h2>
              <p id="onboarding-step-summary" class="onboarding-summary"></p>
            </div>
          </div>
          <ul id="onboarding-step-list" class="gpl-freedoms-list onboarding-list"></ul>
          <div id="onboarding-step-tip" class="onboarding-tip-box"></div>
          <div class="onboarding-footer-bar">
            <button id="btn-onboarding-skip" type="button" class="hud-btn">
              Sari peste ghid
            </button>
            <div id="onboarding-step-dots" class="onboarding-dots" role="tablist" aria-label="Pași tutorial"></div>
            <div class="onboarding-nav-btns">
              <button id="btn-onboarding-prev" type="button" class="hud-btn">
                ⬅️ Înapoi
              </button>
              <button id="btn-onboarding-next" type="button" class="hud-btn hud-btn-active-cyan">
                Înainte ➡️
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
  }

  private bindEvents(): void {
    const modal = document.getElementById('hud-onboarding-modal');
    const btnClose = document.getElementById('btn-onboarding-close');
    const btnSkip = document.getElementById('btn-onboarding-skip');
    const btnPrev = document.getElementById('btn-onboarding-prev');
    const btnNext = document.getElementById('btn-onboarding-next');
    const btnReopenFromAbout = document.getElementById('btn-reopen-tutorial');

    btnClose?.addEventListener('click', () => this.close());
    btnSkip?.addEventListener('click', () => this.close());
    btnPrev?.addEventListener('click', () => this.prevStep());
    btnNext?.addEventListener('click', () => this.nextStep());

    btnReopenFromAbout?.addEventListener('click', () => {
      document.getElementById('hud-gpl-modal')?.classList.add('is-hidden');
      this.open(0);
    });

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        this.close();
      }
    });
  }
}

// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { CelestialBodyInstance, OrbitalEngine } from '../core/OrbitalEngine';
import { SpeechManager } from '../audio/SpeechManager';
import {
  ArrivalBriefingReport,
  KM_PER_AU_CONST,
  SpacecraftId,
  SpacecraftPilot,
  formatDestinationNameRo,
} from '../game/SpacecraftPilot';

export interface CockpitHUDCallbacks {
  onOpenStudySheet: (body: CelestialBodyInstance) => void;
  onExitPilotMode: () => void;
}

interface ArLabelElements {
  root: HTMLDivElement;
  selectBtn: HTMLButtonElement;
  nameSpan: HTMLSpanElement;
  distSpan: HTMLSpanElement;
  flyBtn: HTMLButtonElement;
}

/**
 * CockpitHUD gestionează interfața de la persoana întâi a mini-jocului educativ
 * "🚀 La Manșa Navei (Mod Pilot)":
 * - Cabina de pilotaj vectorială SVG (fără a bloca vederea centrală), cu temă adaptivă:
 *   Chihlimbar (Vlaicu-1), Cyan (Coandă-X), Violet-Neon (Luceafărul)
 * - Proiecție 3D -> 2D pe parbriz (Etichete AR cu nume în română, distanță și butonul "🔥 Zboară Acolo")
 * - Instrumente la bord: Vitezometru (km/h și % din c), Poziție în Sistemul Solar (UA), Data curentă pe Pământ
 * - Calculatorul de Bord Vorbitor la Destinație (Briefing de Sosire sintetizat vocal în română cu auto-ducking)
 * - Joystick tactil pe ecran pentru tablete + comenzi manuale și Pilot Automat
 */
export class CockpitHUD {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly orbitalEngine: OrbitalEngine;
  private readonly pilot: SpacecraftPilot;
  private readonly callbacks: CockpitHUDCallbacks;

  private rootEl: HTMLElement | null = null;
  private arLabelsContainer: HTMLElement | null = null;
  private readonly arLabels = new Map<string, ArLabelElements>();
  private readonly tempProj = new THREE.Vector3();

  private currentArrivalReport: ArrivalBriefingReport | null = null;

  constructor(
    camera: THREE.PerspectiveCamera,
    orbitalEngine: OrbitalEngine,
    pilot: SpacecraftPilot,
    callbacks: CockpitHUDCallbacks
  ) {
    this.camera = camera;
    this.orbitalEngine = orbitalEngine;
    this.pilot = pilot;
    this.callbacks = callbacks;

    this.ensureDomStructure();
    this.buildArLabels();
    this.bindEvents();
    this.syncShipThemeAndButtons();
    this.syncVisibility(this.pilot.isActive());
  }

  /**
   * Asigură existența containerului #cockpit-hud-overlay și a tuturor sub-elementelor SVG/DOM.
   */
  private ensureDomStructure(): void {
    let root = document.getElementById('cockpit-hud-overlay');
    if (!root) {
      root = document.createElement('section');
      root.id = 'cockpit-hud-overlay';
      root.className = 'cockpit-hud-overlay is-hidden';
      root.setAttribute('aria-label', 'Cabina de pilotaj La Manșa Navei (Mod Pilot)');
      root.setAttribute('data-cockpit-theme', 'amber');
      document.body.appendChild(root);
    }

    if (!document.getElementById('cockpit-ar-labels')) {
      root.innerHTML = this.buildCockpitTemplateHtml();
    }

    this.rootEl = root;
    this.arLabelsContainer = document.getElementById('cockpit-ar-labels');
    this.populateTargetSelectDropdown();
  }

  private buildCockpitTemplateHtml(): string {
    return `
      <!-- 1. Parbrizul Navei (Cockpit SVG Vectorial) -->
      <svg
        id="cockpit-svg-frame"
        class="cockpit-svg-frame"
        viewBox="0 0 1600 900"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <!-- Structura metalică a parbrizului (montanți laterali, arcadă superioară și consolă inferioară) -->
        <path
          class="cockpit-canopy-arch"
          d="M 0 0 L 1600 0 L 1600 84 L 1460 54 L 1120 34 L 480 34 L 140 54 L 0 84 Z"
        />
        <path
          class="cockpit-strut-line"
          d="M 140 54 L 42 440 L 135 765 M 1460 54 L 1558 440 L 1465 765"
        />
        <path
          class="cockpit-frame-accent"
          d="M 155 58 L 480 36 L 1120 36 L 1445 58"
        />
        <path
          class="cockpit-frame-accent"
          d="M 120 755 L 440 725 L 1160 725 L 1480 755"
        />

        <!-- Gradații telemetrice laterale pe sticla parbrizului -->
        <g class="cockpit-hud-ticks">
          <line x1="95" y1="240" x2="128" y2="240" />
          <line x1="88" y1="300" x2="116" y2="300" />
          <line x1="82" y1="360" x2="122" y2="360" />
          <line x1="78" y1="420" x2="132" y2="420" />
          <line x1="82" y1="480" x2="122" y2="480" />
          <line x1="88" y1="540" x2="116" y2="540" />
          <line x1="95" y1="600" x2="128" y2="600" />

          <line x1="1505" y1="240" x2="1472" y2="240" />
          <line x1="1512" y1="300" x2="1484" y2="300" />
          <line x1="1518" y1="360" x2="1478" y2="360" />
          <line x1="1522" y1="420" x2="1468" y2="420" />
          <line x1="1518" y1="480" x2="1478" y2="480" />
          <line x1="1512" y1="540" x2="1484" y2="540" />
          <line x1="1505" y1="600" x2="1472" y2="600" />
        </g>

        <!-- Reticul central de vizare (fără a bloca vederea centrală) -->
        <g class="cockpit-center-reticle" transform="translate(800, 395)">
          <circle cx="0" cy="0" r="34" class="reticle-ring" />
          <path d="M -52 0 L -24 0 M 24 0 L 52 0 M 0 -52 L 0 -24 M 0 24 L 0 52" class="reticle-cross" />
          <circle cx="0" cy="0" r="2.5" class="reticle-dot" />
        </g>
      </svg>

      <!-- 2. Container Etichete AR proiectate 3D -> 2D pe sticla parbrizului -->
      <div id="cockpit-ar-labels" class="cockpit-ar-labels"></div>

      <!-- 3. Bara Superioară a Cabinei: Titlu Navă + Buton Ieșire -->
      <div class="cockpit-top-bar">
        <div class="bento-card cockpit-status-pill">
          <span class="cockpit-mode-badge">🚀 LA MANȘA NAVEI (MOD PILOT)</span>
          <strong id="cockpit-active-ship-title" class="cockpit-ship-title">🚀 Racheta "Vlaicu-1"</strong>
          <span id="cockpit-active-ship-propulsion" class="telemetry-tag">Propulsie Chimică • 50.000 km/h</span>
        </div>

        <button
          id="btn-cockpit-exit"
          type="button"
          class="hud-btn hud-btn-amber cockpit-exit-btn"
          title="Ieși din Cabina de Pilotaj și revino la vederea orbitală (Tasta P)"
        >
          🗗 Ieși din Mod Pilot (P)
        </button>
      </div>

      <!-- 4. Fereastra Holografică a Calculatorului de Bord la Destinație (Briefing de Sosire) -->
      <aside
        id="cockpit-arrival-briefing"
        class="bento-card cockpit-arrival-briefing is-hidden"
        aria-label="Raport de sosire Calculatorul de Bord Orbitar"
      >
        <div class="briefing-header">
          <div>
            <span class="telemetry-tag">🤖 CALCULATORUL DE BORD ORBITAR</span>
            <h3 id="briefing-title" class="briefing-title">Raport de Sosire la Destinație</h3>
          </div>
          <button
            id="btn-briefing-close"
            type="button"
            class="hud-icon-btn"
            title="Închide raportul de sosire"
            aria-label="Închide raportul"
          >
            ✕
          </button>
        </div>

        <p id="briefing-headline" class="briefing-headline"></p>

        <div class="briefing-metrics-list">
          <div id="briefing-temp" class="briefing-metric-item"></div>
          <div id="briefing-distances" class="briefing-metric-item"></div>
          <div id="briefing-earth-clock" class="briefing-metric-item briefing-clock-highlight"></div>
          <div id="briefing-observation" class="briefing-metric-item briefing-observation-box"></div>
        </div>

        <div class="briefing-actions-row">
          <button id="btn-briefing-repeat-audio" type="button" class="hud-btn hud-btn-cyan">
            🔊 Repetă Raportul Audio
          </button>
          <button id="btn-briefing-open-study" type="button" class="hud-btn hud-btn-amber">
            📖 Deschide Fișa Completă / Printează
          </button>
          <button id="btn-briefing-next-dest" type="button" class="hud-btn">
            🚀 Alege Următoarea Destinație
          </button>
        </div>
      </aside>

      <!-- 6. Joystick Tactil și Comenzi Rapide pe Ecran (pentru Tablete / Touch) -->
      <div class="cockpit-touch-cluster" aria-label="Comenzi tactile de zbor">
        <div id="cockpit-touch-joystick" class="cockpit-joystick-pad" title="Trage pentru viraj și propulsie">
          <div id="cockpit-joystick-knob" class="cockpit-joystick-knob">🕹️</div>
        </div>
        <div class="cockpit-touch-buttons">
          <button id="btn-touch-boost" type="button" class="hud-btn cockpit-boost-btn">
            ⚡ Hyper-Boost (Shift)
          </button>
          <div class="cockpit-roll-row">
            <button id="btn-touch-roll-left" type="button" class="hud-btn" title="Înclină spre stânga (Q)">
              ↺ Q
            </button>
            <button id="btn-touch-roll-right" type="button" class="hud-btn" title="Înclină spre dreapta (E)">
              E ↻
            </button>
          </div>
        </div>
      </div>

      <!-- 7. Consola de Bord Inferioară (Instrumente, Selectorul celor 3 Nave și Pilot Automat) -->
      <footer id="cockpit-dashboard" class="cockpit-dashboard" aria-label="Instrumente la bord și selector nave">
        <!-- Rândul 1: Selectorul în timp real al celor 3 Nave Spațiale + Consola Pilot Automat -->
        <div class="bento-card cockpit-ships-and-nav-row">
          <div class="cockpit-ships-selector" role="group" aria-label="Alege nava spațială">
            <button
              id="btn-ship-vlaicu1"
              type="button"
              class="cockpit-ship-card is-selected"
              data-ship-id="vlaicu1"
            >
              <span class="ship-card-title">🚀 Racheta "Vlaicu-1"</span>
              <span class="ship-card-sub">Chimică • 50.000 km/h</span>
            </button>
            <button
              id="btn-ship-coandax"
              type="button"
              class="cockpit-ship-card"
              data-ship-id="coandax"
            >
              <span class="ship-card-title">🛸 Nava "Coandă-X"</span>
              <span class="ship-card-sub">Fuziune &amp; Plasmă • 1.500.000 km/h</span>
            </button>
            <button
              id="btn-ship-luceafarul"
              type="button"
              class="cockpit-ship-card"
              data-ship-id="luceafarul"
            >
              <span class="ship-card-title">✨ Astronava "Luceafărul"</span>
              <span class="ship-card-sub">Fotonică / Cuantică • 1c (Lumină)</span>
            </button>
          </div>

          <!-- Pilot Automat ("Zboară către...") -->
          <div class="cockpit-autopilot-box">
            <div class="autopilot-quick-Variable-row">
              <label for="cockpit-target-select" class="cockpit-inst-label">Țintă parbriz:</label>
              <select id="cockpit-target-select" class="cockpit-target-select" aria-label="Selectează destinația">
              </select>
              <button
                id="btn-cockpit-fly-there"
                type="button"
                class="hud-btn hud-btn-active-amber cockpit-fly-cta-btn"
              >
                🔥 Zboară Acolo
              </button>
            </div>
            <div class="autopilot-quick-pills" id="cockpit-quick-targets">
              <button type="button" class="cockpit-dest-pill" data-quick-fly="earth">🌍 Pământ</button>
              <button type="button" class="cockpit-dest-pill" data-quick-fly="moon">🌙 Lună</button>
              <button type="button" class="cockpit-dest-pill" data-quick-fly="mars">🔴 Marte</button>
              <button type="button" class="cockpit-dest-pill" data-quick-fly="jupiter">🟠 Jupiter</button>
              <button type="button" class="cockpit-dest-pill" data-quick-fly="saturn">🪐 Saturn</button>
              <button type="button" class="cockpit-dest-pill" data-quick-fly="neptune">🔵 Neptun</button>
              <button type="button" class="cockpit-dest-pill" data-quick-fly="pluto">❄️ Pluto</button>
            </div>
          </div>
        </div>

        <!-- Rândul 2: Instrumente la Bord (Vitezometru, Poziție în Sistemul Solar, Data pe Pământ, Ghid Taste) -->
        <div class="bento-card cockpit-instruments-bar">
          <div class="cockpit-instrument-cell">
            <span class="cockpit-inst-label">⚡ VITEZOMETRU NAVĂ</span>
            <strong id="cockpit-speed-kmh" class="cockpit-inst-value highlight-cyan">0 km/h</strong>
            <span id="cockpit-speed-light" class="cockpit-inst-sub">0,0000% din viteza luminii (c)</span>
          </div>

          <div class="cockpit-instrument-cell">
            <span class="cockpit-inst-label">☀️ POZIȚIE ÎN SISTEMUL SOLAR</span>
            <strong id="cockpit-helio-au" class="cockpit-inst-value highlight-cyan">Distanță de Soare: 1,00 UA</strong>
            <span id="cockpit-target-name-inst" class="cockpit-inst-sub">Țintă activă: —</span>
          </div>

          <div class="cockpit-instrument-cell">
            <span class="cockpit-inst-label">🌍 DATA CURENTĂ PE PĂMÂNT</span>
            <strong id="cockpit-earth-date" class="cockpit-inst-value highlight-amber">—</strong>
            <span id="cockpit-trip-elapsed" class="cockpit-inst-sub">Ultimul zbor: —</span>
          </div>

          <div class="cockpit-instrument-cell cockpit-keys-guide">
            <span class="cockpit-inst-label">🕹️ COMENZI DE ZBOR</span>
            <span class="cockpit-keys-line">
              <kbd>W</kbd>/<kbd>S</kbd> sau <kbd>↑</kbd>/<kbd>↓</kbd> Accelerație •
              <kbd>A</kbd>/<kbd>D</kbd> Viraj •
              <kbd>Q</kbd>/<kbd>E</kbd> Înclinare •
              <kbd>Shift</kbd> Boost
            </span>
            <span id="cockpit-ship-didactic-note" class="cockpit-inst-sub">
              Click pe orice etichetă AR de pe parbriz și apasă „🔥 Zboară Acolo”!
            </span>
          </div>
        </div>
      </footer>
    `;
  }

  private populateTargetSelectDropdown(): void {
    const selectEl = document.getElementById('cockpit-target-select') as HTMLSelectElement | null;
    if (!selectEl) return;

    const bodies = this.orbitalEngine
      .getBodies()
      .filter((b) => b.data.category !== 'rover');

    selectEl.innerHTML = bodies
      .map(
        (b) =>
          `<option value="${b.data.id}">${b.data.name} (${b.meta.categoryNameRo})</option>`
      )
      .join('');

    const currentSelected = this.pilot.getSelectedTarget()?.data.id;
    const defaultId =
      currentSelected && bodies.some((b) => b.data.id === currentSelected)
        ? currentSelected
        : bodies[0]?.data.id ?? 'jupiter';
    selectEl.value = defaultId;

    this.populateQuickTargetsForHorizon();
  }

  private populateQuickTargetsForHorizon(): void {
    const quickContainer = document.getElementById('cockpit-quick-targets');
    if (!quickContainer) return;

    const horizon = this.orbitalEngine.getActiveHorizon();
    let pills: { id: string; label: string }[];

    if (horizon === 'interstellar') {
      pills = [
        { id: 'oort_cloud', label: '❄️ Norul lui Oort' },
        { id: 'proxima_centauri', label: '✨ Proxima Centauri' },
        { id: 'sirius', label: '💎 Sirius A & B' },
        { id: 'trappist1', label: '🪐 TRAPPIST-1 (7 Planete)' },
        { id: 'cancri55e', label: '🌋 55 Cancri e' },
        { id: 'pleiades', label: '✨ Pleiadele (Cloșca cu Pui)' },
        { id: 'betelgeuse', label: '🔴 Betelgeuse' },
      ];
    } else if (horizon === 'galactic') {
      pills = [
        { id: 'orion_nebula', label: '🌸 Nebuloasa Orion (M42)' },
        { id: 'pillars_of_creation', label: '🏛️ Stâlpii Creației (M16)' },
        { id: 'carina_nebula', label: '⛰️ Nebuloasa Carina' },
        { id: 'crab_nebula', label: '🦀 Nebuloasa Crabului (M1)' },
        { id: 'ring_nebula', label: '💍 Nebuloasa Inelul (M57)' },
        { id: 'helix_nebula', label: '👁️ Nebuloasa Helix' },
        { id: 'sagittarius_a', label: '🕳️ Sagittarius A*' },
        { id: 'milky_way', label: '🌀 Calea Lactee' },
        { id: 'large_magellanic_cloud', label: '☁️ Marele Nor al lui Magellan' },
        { id: 'andromeda', label: '🌌 Andromeda (M31)' },
        { id: 'triangulum_galaxy', label: '🔺 Galaxia Triunghiului (M33)' },
        { id: 'whirlpool_galaxy', label: '🌀 Galaxia Vâltoarea (M51)' },
        { id: 'sombrero_galaxy', label: '👒 Galaxia Sombrero (M104)' },
      ];
    } else {
      pills = [
        { id: 'earth', label: '🌍 Pământ' },
        { id: 'moon', label: '🌙 Lună' },
        { id: 'mars', label: '🔴 Marte' },
        { id: 'jupiter', label: '🟠 Jupiter' },
        { id: 'saturn', label: '🪐 Saturn' },
        { id: 'neptune', label: '🔵 Neptun' },
        { id: 'pluto', label: '❄️ Pluto' },
      ];
    }

    quickContainer.innerHTML = pills
      .map(
        (p) =>
          `<button type="button" class="cockpit-dest-pill" data-quick-fly="${p.id}">${p.label}</button>`
      )
      .join('');

    quickContainer.querySelectorAll<HTMLButtonElement>('[data-quick-fly]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const bodyId = btn.dataset.quickFly || btn.getAttribute('data-quick-fly');
        if (bodyId) {
          this.handleFlyToTarget(bodyId);
        }
      });
    });
  }

  /**
   * Reîmprospătează țintele din selectorul cabinei și modul Motorului Hiperspațial la schimbarea Orizontului Cosmic.
   */
  public refreshForHorizon(): void {
    if (this.pilot.isActive()) {
      this.stopCockpitSpeech();
      document.getElementById('cockpit-arrival-briefing')?.classList.add('is-hidden');
      document.getElementById('hud-study-drawer')?.classList.add('is-collapsed');
    }
    this.populateTargetSelectDropdown();
    this.syncShipThemeAndButtons();
  }

  /**
   * Creează etichetele AR pe parbriz pentru toate corpurile cerești, sondele și obiectele din Cosmosul Îndepărtat.
   */
  private buildArLabels(): void {
    if (!this.arLabelsContainer) return;
    this.arLabelsContainer.innerHTML = '';
    this.arLabels.clear();

    for (const body of this.orbitalEngine.getAllBodies()) {
      if (body.data.category === 'rover') continue;

      const root = document.createElement('div');
      root.className = 'cockpit-ar-marker';
      root.setAttribute('data-cockpit-ar-id', body.data.id);

      const selectBtn = document.createElement('button');
      selectBtn.type = 'button';
      selectBtn.className = 'cockpit-ar-tag-btn';
      selectBtn.setAttribute('data-ar-select-id', body.data.id);

      const dotSpan = document.createElement('span');
      dotSpan.className = 'cockpit-ar-dot';
      dotSpan.style.background = body.data.color;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'cockpit-ar-name';
      nameSpan.textContent = body.data.name;

      const distSpan = document.createElement('span');
      distSpan.className = 'cockpit-ar-dist';
      distSpan.textContent = '— UA';

      selectBtn.appendChild(dotSpan);
      selectBtn.appendChild(nameSpan);
      selectBtn.appendChild(distSpan);

      const flyBtn = document.createElement('button');
      flyBtn.type = 'button';
      flyBtn.className = 'cockpit-ar-fly-btn';
      flyBtn.setAttribute('data-ar-fly-id', body.data.id);
      flyBtn.textContent = '🔥 Zboară Acolo';

      selectBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleFlyToTarget(body.data.id);
      });

      flyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.handleFlyToTarget(body.data.id);
      });

      root.appendChild(selectBtn);
      root.appendChild(flyBtn);
      this.arLabelsContainer.appendChild(root);

      this.arLabels.set(body.data.id, {
        root,
        selectBtn,
        nameSpan,
        distSpan,
        flyBtn,
      });
    }
  }

  private bindEvents(): void {
    // 1. Selectorul celor 3 nave spațiale
    const shipIds: SpacecraftId[] = ['vlaicu1', 'coandax', 'luceafarul'];
    for (const id of shipIds) {
      const btn = document.getElementById(`btn-ship-${id}`);
      btn?.addEventListener('click', () => {
        this.pilot.selectShip(id);
        this.syncShipThemeAndButtons();
      });
    }

    // 2. Selectorul de destinație pornește automat zborul spre corpul ceresc ales
    const selectEl = document.getElementById('cockpit-target-select') as HTMLSelectElement | null;
    selectEl?.addEventListener('change', () => {
      if (selectEl.value) {
        this.handleFlyToTarget(selectEl.value);
      }
    });

    const btnFlyThere = document.getElementById('btn-cockpit-fly-there');
    btnFlyThere?.addEventListener('click', () => {
      const targetId =
        selectEl?.value || this.pilot.getSelectedTarget()?.data.id || 'jupiter';
      this.handleFlyToTarget(targetId);
    });

    // Pastilele rapide pentru destinații principale (Pământ, Lună, Marte, Jupiter, Saturn, Neptun, Pluto)
    const quickBtns = document.querySelectorAll<HTMLButtonElement>('[data-quick-fly]');
    quickBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const bodyId = btn.dataset.quickFly || btn.getAttribute('data-quick-fly');
        if (bodyId) {
          this.handleFlyToTarget(bodyId);
        }
      });
    });

    // 3. Buton ieșire din Mod Pilot
    const btnExit = document.getElementById('btn-cockpit-exit');
    btnExit?.addEventListener('click', () => {
      this.stopCockpitSpeech();
      this.pilot.setPilotMode(false);
      this.callbacks.onExitPilotMode();
    });

    // 4. Butoanele din Briefingul de Sosire al Calculatorului de Bord
    const btnBriefingClose = document.getElementById('btn-briefing-close');
    btnBriefingClose?.addEventListener('click', () => {
      this.stopCockpitSpeech();
      document.getElementById('cockpit-arrival-briefing')?.classList.add('is-hidden');
    });

    const btnRepeatAudio = document.getElementById('btn-briefing-repeat-audio');
    btnRepeatAudio?.addEventListener('click', () => {
      if (this.currentArrivalReport) {
        this.speakTextRo(this.currentArrivalReport.fullSpeechTextRo);
      }
    });

    const btnOpenStudy = document.getElementById('btn-briefing-open-study');
    btnOpenStudy?.addEventListener('click', () => {
      if (this.currentArrivalReport) {
        this.stopCockpitSpeech();
        document.getElementById('cockpit-arrival-briefing')?.classList.add('is-hidden');
        this.callbacks.onOpenStudySheet(this.currentArrivalReport.body);
      }
    });

    const btnNextDest = document.getElementById('btn-briefing-next-dest');
    btnNextDest?.addEventListener('click', () => {
      this.stopCockpitSpeech();
      document.getElementById('cockpit-arrival-briefing')?.classList.add('is-hidden');
      const selectTarget = document.getElementById(
        'cockpit-target-select'
      ) as HTMLSelectElement | null;
      selectTarget?.focus?.();
    });

    // 5. Joystick tactil & butoane tactile pentru tablete
    this.bindTouchFlightControls();

    // 6. Evenimente de la SpacecraftPilot
    this.pilot.onModeChange((active) => {
      this.syncVisibility(active);
      if (!active) {
        this.stopCockpitSpeech();
      }
    });

    this.pilot.onShipChange(() => {
      this.syncShipThemeAndButtons();
    });

    this.pilot.onArrivalBriefing((report) => {
      this.showArrivalBriefing(report);
    });
  }

  private bindTouchFlightControls(): void {
    const pad = document.getElementById('cockpit-touch-joystick');
    const knob = document.getElementById('cockpit-joystick-knob');
    let dragging = false;

    const updateJoystickFromEvent = (clientX: number, clientY: number) => {
      if (!pad) return;
      const rect = pad.getBoundingClientRect();
      const cx = rect.left + rect.width * 0.5;
      const cy = rect.top + rect.height * 0.5;
      const maxR = Math.max(24, rect.width * 0.42);
      const dx = Math.max(-maxR, Math.min(maxR, clientX - cx));
      const dy = Math.max(-maxR, Math.min(maxR, clientY - cy));

      if (knob) {
        knob.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
      }
      this.pilot.setTouchControls({
        joystickX: dx / maxR,
        joystickY: -dy / maxR,
      });
    };

    const resetJoystick = () => {
      dragging = false;
      if (knob) {
        knob.style.transform = 'translate(0px, 0px)';
      }
      this.pilot.setTouchControls({ joystickX: 0, joystickY: 0 });
    };

    pad?.addEventListener('pointerdown', (e: PointerEvent) => {
      dragging = true;
      updateJoystickFromEvent(e.clientX, e.clientY);
    });
    window.addEventListener('pointermove', (e: PointerEvent) => {
      if (!dragging) return;
      updateJoystickFromEvent(e.clientX, e.clientY);
    });
    window.addEventListener('pointerup', () => {
      if (dragging) resetJoystick();
    });

    const btnBoost = document.getElementById('btn-touch-boost');
    btnBoost?.addEventListener('pointerdown', () => {
      this.pilot.setTouchControls({ boost: true });
      btnBoost.classList.add('hud-btn-active-amber');
    });
    const releaseBoost = () => {
      this.pilot.setTouchControls({ boost: false });
      btnBoost?.classList.remove('hud-btn-active-amber');
    };
    btnBoost?.addEventListener('pointerup', releaseBoost);
    btnBoost?.addEventListener('pointerleave', releaseBoost);

    const btnRollL = document.getElementById('btn-touch-roll-left');
    const btnRollR = document.getElementById('btn-touch-roll-right');
    btnRollL?.addEventListener('pointerdown', () => this.pilot.setTouchControls({ roll: 1 }));
    btnRollL?.addEventListener('pointerup', () => this.pilot.setTouchControls({ roll: 0 }));
    btnRollR?.addEventListener('pointerdown', () => this.pilot.setTouchControls({ roll: -1 }));
    btnRollR?.addEventListener('pointerup', () => this.pilot.setTouchControls({ roll: 0 }));
  }

  public handleSelectTargetOnWindshield(bodyId: string): void {
    const target = this.pilot.setSelectedTarget(bodyId);
    const selectEl = document.getElementById('cockpit-target-select') as HTMLSelectElement | null;
    if (selectEl && target) {
      selectEl.value = target.data.id;
    }

    const btnFlyThere = document.getElementById('btn-cockpit-fly-there');
    if (btnFlyThere && target) {
      btnFlyThere.textContent = `🔥 Zboară Acolo (${target.data.name})`;
    }

    for (const [id, entry] of this.arLabels.entries()) {
      entry.root.classList.toggle('is-target-selected', id === bodyId);
    }
  }

  public handleFlyToTarget(bodyId: string): void {
    this.handleSelectTargetOnWindshield(bodyId);
    document.getElementById('cockpit-arrival-briefing')?.classList.add('is-hidden');
    document.getElementById('hud-study-drawer')?.classList.add('is-collapsed');
    this.pilot.engageAutopilot(bodyId);
  }

  private syncVisibility(active: boolean): void {
    this.rootEl?.classList.toggle('is-hidden', !active);
    if (!active) {
      document.getElementById('cockpit-arrival-briefing')?.classList.add('is-hidden');
    }
    const orbitLabelsEl = document.getElementById('labels-container');
    if (orbitLabelsEl) {
      orbitLabelsEl.style.display = active ? 'none' : '';
    }
    const bottomDockEl = document.getElementById('hud-bottom-dock');
    if (bottomDockEl) {
      bottomDockEl.classList.toggle('is-hidden', active);
    }
    if (active) {
      const selected = this.pilot.getSelectedTarget();
      if (selected) {
        this.handleSelectTargetOnWindshield(selected.data.id);
      }
    }
  }

  private syncShipThemeAndButtons(): void {
    const ship = this.pilot.getCurrentShip();
    const horizon = this.orbitalEngine.getActiveHorizon();
    const isDeepHorizon = horizon !== 'solar';

    this.rootEl?.setAttribute('data-cockpit-theme', ship.theme);

    const titleEl = document.getElementById('cockpit-active-ship-title');
    const propEl = document.getElementById('cockpit-active-ship-propulsion');
    const noteEl = document.getElementById('cockpit-ship-didactic-note');
    const luceafarSubEl = document.querySelector(
      '#btn-ship-luceafarul .ship-card-sub'
    );

    if (titleEl) titleEl.textContent = ship.nameRo;
    if (propEl) {
      if (isDeepHorizon && ship.id === 'luceafarul') {
        propEl.textContent = '⚡ Motor Hiperspațial (Salt în Ani-Lumină) • Activ';
      } else {
        propEl.textContent = `${ship.propulsionRo} • ${ship.speedKmh.toLocaleString('ro-RO')} km/h`;
      }
    }
    if (luceafarSubEl) {
      luceafarSubEl.textContent = isDeepHorizon
        ? '⚡ Motor Hiperspațial (Salt în Ani-Lumină)'
        : 'Fotonică / Cuantică • 1c (Lumină)';
    }
    if (noteEl) {
      noteEl.textContent =
        isDeepHorizon && ship.id === 'luceafarul'
          ? '⚡ Motorul Hiperspațial al Astronavei Luceafărul este activ pentru salturi în Ani-Lumină!'
          : ship.didacticSummaryRo;
    }

    const shipIds: SpacecraftId[] = ['vlaicu1', 'coandax', 'luceafarul'];
    for (const id of shipIds) {
      const btn = document.getElementById(`btn-ship-${id}`);
      btn?.classList.toggle('is-selected', id === ship.id);
    }
  }

  /**
   * Afișează pe parbriz fereastra holografică a Calculatorului de Bord la sosirea lângă un corp ceresc
   * (fără a porni automat citirea vocală, pentru a nu deveni agasantă pentru cei mici).
   */
  public showArrivalBriefing(report: ArrivalBriefingReport): void {
    this.currentArrivalReport = report;
    this.stopCockpitSpeech();
    document.getElementById('hud-study-drawer')?.classList.add('is-collapsed');

    const briefingEl = document.getElementById('cockpit-arrival-briefing');
    const titleEl = document.getElementById('briefing-title');
    const headlineEl = document.getElementById('briefing-headline');
    const tempEl = document.getElementById('briefing-temp');
    const distEl = document.getElementById('briefing-distances');
    const clockEl = document.getElementById('briefing-earth-clock');
    const obsEl = document.getElementById('briefing-observation');

    if (titleEl) {
      const destLabel = formatDestinationNameRo(report.body.data);
      titleEl.textContent = `Sosire la ${destLabel} (${report.body.meta.categoryNameRo})`;
    }
    if (headlineEl) headlineEl.textContent = report.headlineRo;
    if (tempEl) tempEl.textContent = report.temperatureLineRo;
    if (distEl) distEl.textContent = report.distancesLineRo;
    if (clockEl) clockEl.textContent = report.earthClockLineRo;
    if (obsEl) obsEl.textContent = report.observationLineRo;

    briefingEl?.classList.remove('is-hidden');
  }

  private speakTextRo(textRo: string): void {
    SpeechManager.getInstance().speak(textRo, {
      forceWebSpeech: true,
    });
  }

  public stopCockpitSpeech(): void {
    SpeechManager.getInstance().stop();
  }

  /**
   * Actualizează în fiecare cadru etichetele AR proiectate pe parbriz și instrumentele de bord.
   */
  public update(): void {
    if (!this.pilot.isActive()) return;

    const tel = this.pilot.getTelemetry();

    // 1. Actualizăm Vitezometrul (km/h și % din viteza luminii)
    const speedKmhEl = document.getElementById('cockpit-speed-kmh');
    const speedLightEl = document.getElementById('cockpit-speed-light');
    if (speedKmhEl) {
      speedKmhEl.textContent = `${Math.round(tel.currentSpeedKmh).toLocaleString('ro-RO')} km/h`;
    }
    if (speedLightEl) {
      const pctStr =
        tel.currentLightPercent >= 10
          ? tel.currentLightPercent.toFixed(1).replace('.', ',')
          : tel.currentLightPercent.toFixed(4).replace('.', ',');
      speedLightEl.textContent = `${pctStr}% din viteza luminii (c)`;
    }

    // 2. Actualizăm Poziția în Sistemul Solar / Orizontul Cosmic și Ținta Activă
    const helioAuEl = document.getElementById('cockpit-helio-au');
    const targetNameInstEl = document.getElementById('cockpit-target-name-inst');
    const activeHorizon = this.orbitalEngine.getActiveHorizon();
    const anchoredOrSelected =
      tel.autopilotTarget ?? tel.selectedTargetBody ?? tel.anchoredBody;
    if (helioAuEl) {
      if (
        activeHorizon !== 'solar' &&
        anchoredOrSelected?.data.distanceLightYears &&
        anchoredOrSelected.data.distanceLightYears > 0
      ) {
        const lyLabel =
          anchoredOrSelected.data.distanceLightYearsLabelRo ??
          `${anchoredOrSelected.data.distanceLightYears.toLocaleString('ro-RO')} ani-lumină`;
        helioAuEl.textContent = `Distanță de Sistemul Solar: ${lyLabel}`;
      } else {
        helioAuEl.textContent = `Distanță de Soare: ${tel.heliocentricDistanceAu
          .toFixed(2)
          .replace('.', ',')} UA`;
      }
    }
    if (targetNameInstEl) {
      const targetName =
        tel.autopilotTarget?.data.name ??
        tel.selectedTargetBody?.data.name ??
        tel.anchoredBody?.data.name ??
        '—';
      targetNameInstEl.textContent = `Țintă activă: ${targetName}`;
    }

    // 3. Actualizăm Data curentă pe Pământ și durata ultimei călătorii
    const earthDateEl = document.getElementById('cockpit-earth-date');
    const tripElapsedEl = document.getElementById('cockpit-trip-elapsed');
    if (earthDateEl) {
      const yearVal = Number.isFinite(tel.earthYear)
        ? tel.earthYear
        : tel.earthDate.getFullYear();
      if (yearVal > 9999) {
        earthDateEl.textContent = `Anul ${yearVal.toLocaleString('ro-RO')}`;
      } else {
        const formattedDate = tel.earthDate.toLocaleDateString('ro-RO', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        });
        earthDateEl.textContent = `${formattedDate} (Anul ${yearVal})`;
      }
    }
    if (tripElapsedEl) {
      tripElapsedEl.textContent = `Ultimul zbor: ${tel.lastTripDurationRo}`;
    }

    // 4. Proiecția 3D -> 2D a etichetelor AR pe parbrizul navei
    this.updateWindshieldArLabels(tel.selectedTargetBody?.data.id ?? null);
  }

  private updateWindshieldArLabels(selectedId: string | null): void {
    const width = window.innerWidth || 1280;
    const height = window.innerHeight || 800;
    const shipPos = this.pilot.getPosition();
    const activeHorizon = this.orbitalEngine.getActiveHorizon();

    this.camera.updateMatrixWorld();

    for (const body of this.orbitalEngine.getAllBodies()) {
      const entry = this.arLabels.get(body.data.id);
      if (!entry) continue;

      const bodyHorizon = body.data.horizon ?? 'solar';
      if (
        bodyHorizon !== activeHorizon ||
        !body.rootGroup.visible ||
        body.data.category === 'rover'
      ) {
        entry.root.style.display = 'none';
        continue;
      }

      // Pentru sateliți și stații orbitale, le afișăm pe parbriz când suntem aproape de planeta-mamă sau când sunt selectate
      const isSelected = body.data.id === selectedId;
      if (body.data.parentId && !isSelected) {
        const sceneDist = shipPos.distanceTo(body.worldPosition);
        if (sceneDist > 42) {
          entry.root.style.display = 'none';
          continue;
        }
      }

      this.tempProj.copy(body.worldPosition);
      this.tempProj.y += body.visualRadius * 1.15;
      this.tempProj.project(this.camera);

      // Afișăm doar corpurile aflate în fața parbrizului (în frustum: -1 <= z <= 1)
      if (this.tempProj.z < -1 || this.tempProj.z > 1) {
        entry.root.style.display = 'none';
        continue;
      }

      const x = (this.tempProj.x * 0.5 + 0.5) * width;
      const y = (-this.tempProj.y * 0.5 + 0.5) * height;

      if (x < 50 || x > width - 50 || y < 65 || y > height - 155) {
        entry.root.style.display = 'none';
        continue;
      }

      let distLabel: string;
      if (body.data.distanceLightYears && body.data.distanceLightYears > 0) {
        distLabel =
          body.data.distanceLightYearsLabelRo ??
          `${body.data.distanceLightYears.toLocaleString('ro-RO')} a.l.`;
      } else {
        // Calculăm distanța astronomică reală dintre navă și corpul ceresc
        const shipAu = this.pilot.getTelemetry().heliocentricDistanceAu;
        const bodyAu = body.distanceFromSunAu;
        const approxAu = Math.max(
          0.0005,
          Math.hypot(
            bodyAu - shipAu,
            shipPos.distanceTo(body.worldPosition) * 0.015
          )
        );

        distLabel =
          approxAu < 0.02
            ? `${Math.round(approxAu * KM_PER_AU_CONST).toLocaleString('ro-RO')} km`
            : `${approxAu.toFixed(2).replace('.', ',')} UA`;
      }

      entry.distSpan.textContent = distLabel;
      entry.root.style.display = 'inline-flex';
      entry.root.style.left = `${x.toFixed(1)}px`;
      entry.root.style.top = `${y.toFixed(1)}px`;
      entry.root.classList.toggle('is-target-selected', isSelected);
    }
  }
}

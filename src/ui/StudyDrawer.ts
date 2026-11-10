// SPDX-License-Identifier: GPL-3.0-or-later
import { CelestialBodyInstance, OrbitalEngine } from '../core/OrbitalEngine';
import { PlanetMaterialFactory } from '../core/PlanetMaterialFactory';
import { SpeechManager } from '../audio/SpeechManager';
import { UiSoundEngine } from '../audio/UiSoundEngine';
import { AgeTier } from '../types/celestial';
import { OrbitarLab } from './OrbitarLab';

const STORAGE_KEY_BADGES = 'orbitar_badges';
export const STUDY_DRAWER_FADE_OUT_MS = 220;
export const STUDY_DRAWER_FADE_IN_MS = 280;

const NASA_MEDIA_BY_BODY_ID: Record<string, { src: string; captionRo: string }> = {
  perseverance: {
    src: './textures/nasa/perseverance.jpg',
    captionRo:
      '📸 Fotografie reală NASA/JPL-Caltech (PIA24542): Roverul Perseverance și elicopterul Ingenuity în Craterul Jezero de pe Marte.',
  },
  curiosity: {
    src: './textures/nasa/curiosity.jpg',
    captionRo:
      '📸 Autoportret real NASA/JPL-Caltech (PIA16239): Roverul Curiosity (MSL) fotografiat pe solul Craterului Gale de pe Marte.',
  },
  iss: {
    src: './textures/nasa/iss.jpg',
    captionRo:
      '📸 Fotografie reală NASA (ISS056E201248): Stația Spațială Internațională pe orbita joasă a Pământului.',
  },
  jwst: {
    src: './textures/nasa/jwst.jpg',
    captionRo:
      '📸 Fotografie oficială NASA/GSFC: Telescopul Spațial James Webb cu scutul termic în 5 straturi desfășurat.',
  },
  hubble: {
    src: './textures/nasa/hubble.jpg',
    captionRo:
      '📸 Fotografie reală NASA (STS-125): Telescopul Spațial Hubble pe orbită deasupra Pământului.',
  },
  euclid: {
    src: './textures/nasa/euclid.jpg',
    captionRo:
      '📸 Fotografie oficială NASA/ESA (PIA25783): Telescopul Spațial Euclid cu izolația termică aurită MLI.',
  },
  voyager1: {
    src: './textures/nasa/voyager1.jpg',
    captionRo:
      '📸 Randare oficială NASA/JPL-Caltech (PIA17462): Sonda Voyager 1 în spațiul interstelar.',
  },
  voyager2: {
    src: './textures/nasa/voyager2.jpg',
    captionRo:
      '📸 Randare oficială NASA/JPL-Caltech (PIA17462): Sonda Voyager 2 în spațiul interstelar.',
  },
  newhorizons: {
    src: './textures/nasa/newhorizons.jpg',
    captionRo:
      '📸 Imagine oficială NASA/JHUAPL/SwRI: Misiunea interplanetară New Horizons în Centura Kuiper.',
  },
  parker: {
    src: './textures/nasa/parker.jpg',
    captionRo:
      '📸 Imagine oficială NASA/JHUAPL: Sonda Parker Solar Probe în apropierea coroanei solare.',
  },
  rosetta: {
    src: './textures/nasa/rosetta.jpg',
    captionRo:
      '📸 Fotografie oficială ESA/NASA (PIA18596): Cometa 67P/Ciuriumov-Gherasimenko fotografiată de sonda Rosetta.',
  },
  juice: {
    src: './textures/nasa/juice.jpg',
    captionRo:
      '📸 Fotografie oficială NASA/JPL/ESA (PIA24024): Instrumentația radar a sondei interplanetare JUICE.',
  },
  oort_cloud: {
    src: './textures/nasa/oort_cloud.jpg',
    captionRo:
      '📸 Ilustrație științifică oficială NASA/JPL-Caltech (PIA17046): Sfera uriașă de comete înghețate a Norului lui Oort în jurul Sistemului Solar.',
  },
  proxima_centauri: {
    src: './textures/nasa/proxima_centauri.jpg',
    captionRo:
      '📸 Fotografie reală NASA/ESA (Telescopul Spațial Hubble WFPC2): Steaua pitică roșie Proxima Centauri — cea mai apropiată stea de Sistemul nostru Solar (4,24 ani-lumină).',
  },
  sirius: {
    src: './textures/nasa/sirius.jpg',
    captionRo:
      '📸 Fotografie reală NASA/ESA (Telescopul Spațial Hubble): Steaua strălucitoare Sirius A și pitica ei albă Sirius B (punctul luminos din stânga-jos).',
  },
  trappist1: {
    src: './textures/nasa/trappist1.jpg',
    captionRo:
      '📸 Randare științifică oficială NASA/JPL-Caltech (PIA21422): Cele 7 planete stâncoase de mărimea Pământului din sistemul exoplanetar TRAPPIST-1.',
  },
  cancri55e: {
    src: './textures/nasa/cancri55e.jpg',
    captionRo:
      '📸 Imagine științifică oficială NASA/JPL-Caltech (Telescopul Spitzer PIA20068): Exoplaneta incandescentă 55 Cancri e („Planeta de Lavă și Diamant”).',
  },
  pleiades: {
    src: './textures/nasa/pleiades.jpg',
    captionRo:
      '📸 Fotografie reală NASA/JPL-Caltech/Hubble (PIA04225): Roiul stelar deschis Pleiadele (M45 — „Cloșca cu Pui”) învăluit în nori albaștri de praf interstelar.',
  },
  betelgeuse: {
    src: './textures/nasa/betelgeuse.jpg',
    captionRo:
      '📸 Imagine reală NASA/ESA (Telescopul Spațial Hubble): Supergiganta roșie Betelgeuse din constelația Orion și atmosfera ei colosală.',
  },
  orion_nebula: {
    src: './textures/nasa/orion_nebula.jpg',
    captionRo:
      '📸 Fotografie reală NASA/JPL-Caltech/ESA (Hubble & Spitzer PIA08653): Maternitatea stelară Nebuloasa Orion (M42), unde se nasc mii de stele noi.',
  },
  pillars_of_creation: {
    src: './textures/nasa/pillars_of_creation.jpg',
    captionRo:
      '📸 Fotografie reală NASA/ESA/CSA/STScI (Telescopul Spațial James Webb — PIA25433): „Stâlpii Creației” din Nebuloasa Vulturului (M16) văzuți în infraroșu.',
  },
  sagittarius_a: {
    src: './textures/nasa/sagittarius_a.jpg',
    captionRo:
      '📸 Imaginea istorică reală Event Horizon Telescope (EHT) & NASA (PIA25440): Inelul de plasmă din jurul găurii negre supermasive Sagittarius A* din centrul Căii Lactee.',
  },
  milky_way: {
    src: './textures/nasa/milky_way.jpg',
    captionRo:
      '📸 Harta științifică oficială NASA/JPL-Caltech (Telescopul Spitzer PIA19341): Structura brațelor spirale ale galaxiei noastre, Calea Lactee, și poziția Soarelui.',
  },
  andromeda: {
    src: './textures/nasa/andromeda.jpg',
    captionRo:
      '📸 Fotografie reală NASA/JPL-Caltech (GALEX & Spitzer PIA15416): Galaxia spirală Andromeda (M31), vecina noastră galactică aflată la 2,54 milioane de ani-lumină.',
  },
  carina_nebula: {
    src: './textures/nasa/pillars_of_creation.jpg',
    captionRo:
      '📸 Fotografie NASA/ESA/CSA/STScI (Telescopul Spațial James Webb): Regiune activă de formare a stelelor în nori moleculari denși și stânci cosmice de gaz.',
  },
  crab_nebula: {
    src: './textures/nasa/orion_nebula.jpg',
    captionRo:
      '📸 Imagine astronomică NASA/ESA: Filamentele ionizate ale unei nebuloase în expansiune iluminate din interior de radiație stelară intensă.',
  },
  ring_nebula: {
    src: './textures/nasa/orion_nebula.jpg',
    captionRo:
      '📸 Imagine astronomică NASA/ESA: Gaz ionizat multicolor (heliu, oxigen și azot) iluminat de radiația ultravioletă centrală.',
  },
  helix_nebula: {
    src: './textures/nasa/orion_nebula.jpg',
    captionRo:
      '📸 Imagine astronomică NASA/ESA: Structura gazoasă luminoasă și nodurile cometare ale unei nebuloase apropiate.',
  },
  large_magellanic_cloud: {
    src: './textures/nasa/milky_way.jpg',
    captionRo:
      '📸 Hartă astronomică NASA/JPL-Caltech: Vecinătatea galactică a Căii Lactee și regiunile bogate în formare stelară din Grupul Local.',
  },
  triangulum_galaxy: {
    src: './textures/nasa/andromeda.jpg',
    captionRo:
      '📸 Fotografie astronomică NASA/JPL-Caltech: Galaxie spirală din Grupul Local, bogată în brațe luminoase și maternități stelare.',
  },
  whirlpool_galaxy: {
    src: './textures/nasa/andromeda.jpg',
    captionRo:
      '📸 Fotografie astronomică NASA/JPL-Caltech: Structura spirală grand-design a unei galaxii cu brațe bogate în stele tinere.',
  },
  sombrero_galaxy: {
    src: './textures/nasa/milky_way.jpg',
    captionRo:
      '📸 Imagine astronomică NASA/JPL-Caltech: Nucleu galactic luminos înconjurat de un disc ecuatorial dens de praf cosmic.',
  },
};

/**
 * StudyDrawer gestionează Panoul Lateral de Studiu (Bento Dark Mode):
 * - Se deschide la selectarea unui corp ceresc
 * - Buton "🔊 Citește-mi" (window.speechSynthesis în limba ro-RO)
 * - Telemetrie SGP4 în timp real pentru ISS și Hubble (prin ISSTracker / satellite.js)
 * - Afișare adaptivă a datelor (junior vs cadet) + Quiz interactiv
 * - Secțiunea interactivă "Laboratorul Orbitar" (OrbitarLab)
 */
export class StudyDrawer {
  private currentBody: CelestialBodyInstance | null = null;
  private pendingSwitchBody: CelestialBodyInstance | null = null;
  private switchOutTimerId: ReturnType<typeof setTimeout> | null = null;
  private switchInTimerId: ReturnType<typeof setTimeout> | null = null;
  private currentTier: AgeTier;
  private isSpeaking = false;
  private readonly orbitalEngine: OrbitalEngine;
  private readonly lab: OrbitarLab;
  private readonly onResetOverview: () => void;
  private readonly onBadgeUnlocked?: (bodyId: string) => void;
  private onPrintStudy?: (bodyId: string) => void;
  private onPrintColoring?: (bodyId: string) => void;
  private onSyncPrintPreview?: (bodyId: string) => void;
  private lastDistText = '';
  private lastIssLatText = '';
  private lastIssLonText = '';
  private lastIssAltText = '';
  private lastIssVelText = '';
  private lastTelemetryUpdateMs = 0;

  constructor(
    orbitalEngine: OrbitalEngine,
    initialTier: AgeTier,
    onResetOverview: () => void,
    onBadgeUnlocked?: (bodyId: string) => void
  ) {
    this.orbitalEngine = orbitalEngine;
    this.currentTier = initialTier;
    this.onResetOverview = onResetOverview;
    this.onBadgeUnlocked = onBadgeUnlocked;
    this.lab = new OrbitarLab();
    this.bindEvents();
  }

  public setPrintHandlers(handlers: {
    onPrintStudy: (bodyId: string) => void;
    onPrintColoring: (bodyId: string) => void;
    onSyncPrintPreview?: (bodyId: string) => void;
  }): void {
    this.onPrintStudy = handlers.onPrintStudy;
    this.onPrintColoring = handlers.onPrintColoring;
    this.onSyncPrintPreview = handlers.onSyncPrintPreview;
  }

  private bindEvents(): void {
    const btnClose = document.getElementById('btn-drawer-close');
    const drawerEl = document.getElementById('hud-study-drawer');
    const btnResetCam = document.getElementById('btn-reset-camera');
    const btnSpeak = document.getElementById('btn-speak-ro');
    const btnPrintStudy = document.getElementById('btn-print-study');
    const btnPrintColoring = document.getElementById('btn-print-coloring');
    const btnVenusRadar = document.getElementById('btn-venus-radar');
    const btnIssSync = document.getElementById('btn-iss-live-sync');

    btnClose?.addEventListener('click', () => {
      this.stopSpeech();
      this.clearSwitchTimers();
      drawerEl?.classList.remove('is-switching-out', 'is-switching-in');
      const wasCollapsed = drawerEl?.classList.contains('is-collapsed') ?? false;
      drawerEl?.classList.add('is-collapsed');
      if (!wasCollapsed) {
        UiSoundEngine.getInstance().playDrawerClose();
      }
    });

    btnResetCam?.addEventListener('click', () => {
      this.stopSpeech();
      this.onResetOverview();
    });

    btnSpeak?.addEventListener('click', () => {
      this.flushSwitchTransition();
      this.toggleSpeechRo();
    });

    btnPrintStudy?.addEventListener('click', () => {
      this.flushSwitchTransition();
      const id = this.currentBody?.data.id ?? 'sun';
      this.onPrintStudy?.(id);
    });

    btnPrintColoring?.addEventListener('click', () => {
      this.flushSwitchTransition();
      const id = this.currentBody?.data.id ?? 'sun';
      this.onPrintColoring?.(id);
    });

    btnVenusRadar?.addEventListener('click', () => {
      const active = PlanetMaterialFactory.toggleVenusRadarMode();
      this.syncVenusRadarButtonState(active);
    });

    btnIssSync?.addEventListener('click', async () => {
      const statusEl = document.getElementById('iss-sync-status');
      const modeTag = document.getElementById('iss-telemetry-mode');
      if (statusEl) {
        statusEl.textContent = '⏳ Se verifică conexiunea pentru sincronizarea coordonatelor ISS…';
      }
      const result = await this.orbitalEngine.issTracker.syncLiveISSCoordinates();
      if (result.isOnlineLive) {
        if (modeTag) modeTag.textContent = '🌐 Live Online';
        if (statusEl) {
          statusEl.textContent =
            '✅ Coordonate ISS sincronizate în timp real cu telemetria orbitală live!';
        }
      } else {
        if (modeTag) modeTag.textContent = '100% Offline TLE';
        if (statusEl) {
          statusEl.textContent =
            '📡 Mod autonom: coordonate calculate 100% offline cu satellite.js (SGP4) din /data/tle-iss.json.';
        }
      }
      this.updateLiveDistance(this.currentBody, true);
    });
  }

  public setTier(tier: AgeTier): void {
    this.currentTier = tier;
    this.stopSpeech();
    this.flushSwitchTransition();
    if (this.currentBody) {
      this.populateBodyDom(this.currentBody);
    }
  }

  public showBody(body: CelestialBodyInstance): void {
    this.stopSpeech();
    this.renderBody(body, true);
  }

  /**
   * Finalizează sincron tranziția fade-out -> fade-in aflată în curs (dacă există),
   * aplicând imediat în DOM detaliile noului corp ceresc selectat.
   */
  public flushSwitchTransition(): void {
    if (!this.pendingSwitchBody) return;
    const targetBody = this.pendingSwitchBody;
    this.clearSwitchTimers();
    const drawerEl = document.getElementById('hud-study-drawer');
    this.populateBodyDom(targetBody);
    if (drawerEl) {
      drawerEl.classList.remove('is-switching-out');
      drawerEl.classList.add('is-switching-in');
      this.switchInTimerId = window.setTimeout(() => {
        drawerEl.classList.remove('is-switching-in');
        this.switchInTimerId = null;
      }, STUDY_DRAWER_FADE_IN_MS);
    }
  }

  private clearSwitchTimers(): void {
    this.pendingSwitchBody = null;
    if (this.switchOutTimerId !== null) {
      window.clearTimeout(this.switchOutTimerId);
      this.switchOutTimerId = null;
    }
    if (this.switchInTimerId !== null) {
      window.clearTimeout(this.switchInTimerId);
      this.switchInTimerId = null;
    }
  }

  public updateLiveDistance(body: CelestialBodyInstance | null, force = false): void {
    if (!body || this.pendingSwitchBody) return;
    if (!force) {
      const drawerEl = document.getElementById('hud-study-drawer');
      if (drawerEl?.classList.contains('is-collapsed')) {
        return;
      }
    }

    const distEl = document.getElementById('hud-target-dist');
    if (distEl) {
      let nextDistText: string;
      if (body.data.distanceLightYears && body.data.distanceLightYears > 0) {
        const lyLabel =
          body.data.distanceLightYearsLabelRo ??
          `${body.data.distanceLightYears.toLocaleString('ro-RO')} ani-lumină`;
        nextDistText = `Distanță: ${lyLabel}`;
      } else {
        const distStr = body.distanceFromSunAu.toFixed(2).replace('.', ',');
        nextDistText = `Distanță de Soare: ${distStr} UA`;
      }
      if (force || nextDistText !== this.lastDistText) {
        this.lastDistText = nextDistText;
        this.setElementTextInPlace(distEl, nextDistText);
      }
    }

    // Actualizăm telemetria SGP4 dacă este selectată Stația Spațială Internațională (ISS) sau Hubble
    if (body.data.id === 'iss' || body.data.id === 'hubble') {
      const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!force && nowMs - this.lastTelemetryUpdateMs < 250) {
        return;
      }
      this.lastTelemetryUpdateMs = nowMs;

      const tel = this.orbitalEngine.issTracker.getTelemetry(
        body.data.id,
        this.orbitalEngine.simulationDate
      );
      const latEl = document.getElementById('iss-lat');
      const lonEl = document.getElementById('iss-lon');
      const altEl = document.getElementById('iss-alt');
      const velEl = document.getElementById('iss-vel');

      const latHemi = tel.latitudeDeg >= 0 ? 'N' : 'S';
      const lonHemi = tel.longitudeDeg >= 0 ? 'E' : 'V';

      const nextLat = `${Math.abs(tel.latitudeDeg).toFixed(2).replace('.', ',')}° ${latHemi}`;
      const nextLon = `${Math.abs(tel.longitudeDeg).toFixed(2).replace('.', ',')}° ${lonHemi}`;
      const nextAlt = `~${tel.altitudeKm.toFixed(1).replace('.', ',')} km`;
      const nextVel = `~${Math.round(tel.velocityKmh).toLocaleString('ro-RO')} km/h`;

      if (latEl && (force || nextLat !== this.lastIssLatText)) {
        this.lastIssLatText = nextLat;
        this.setElementTextInPlace(latEl, nextLat);
      }
      if (lonEl && (force || nextLon !== this.lastIssLonText)) {
        this.lastIssLonText = nextLon;
        this.setElementTextInPlace(lonEl, nextLon);
      }
      if (altEl && (force || nextAlt !== this.lastIssAltText)) {
        this.lastIssAltText = nextAlt;
        this.setElementTextInPlace(altEl, nextAlt);
      }
      if (velEl && (force || nextVel !== this.lastIssVelText)) {
        this.lastIssVelText = nextVel;
        this.setElementTextInPlace(velEl, nextVel);
      }
    }
  }

  private setElementTextInPlace(el: HTMLElement, text: string): void {
    const firstChild = el.firstChild;
    if (firstChild && firstChild === el.lastChild && firstChild.nodeType === 3) {
      firstChild.nodeValue = text;
    } else {
      el.textContent = text;
    }
  }

  private renderBody(body: CelestialBodyInstance, openDrawer: boolean): void {
    const prevBodyId = this.currentBody?.data.id ?? null;
    this.currentBody = body;
    const d = body.data;

    const drawerEl = document.getElementById('hud-study-drawer');
    const wasCollapsed = drawerEl ? drawerEl.classList.contains('is-collapsed') : true;

    // Dacă panoul de studiu este deja deschis cu un alt corp ceresc, executăm
    // tranziția fade-out (suprapusă cu deplasarea camerei către noul obiect) -> fade-in cu noile detalii.
    if (openDrawer && drawerEl && !wasCollapsed && prevBodyId !== null && prevBodyId !== d.id) {
      this.clearSwitchTimers();
      this.pendingSwitchBody = body;
      drawerEl.classList.remove('is-switching-in');
      drawerEl.classList.add('is-switching-out');
      UiSoundEngine.getInstance().playDrawerSwitchTransition(STUDY_DRAWER_FADE_OUT_MS / 1000);

      this.switchOutTimerId = window.setTimeout(() => {
        this.switchOutTimerId = null;
        this.pendingSwitchBody = null;
        this.populateBodyDom(body);
        drawerEl.scrollTo({ left: 0, top: 0 });
        drawerEl.classList.remove('is-switching-out');
        drawerEl.classList.add('is-switching-in');

        this.switchInTimerId = window.setTimeout(() => {
          drawerEl.classList.remove('is-switching-in');
          this.switchInTimerId = null;
        }, STUDY_DRAWER_FADE_IN_MS);
      }, STUDY_DRAWER_FADE_OUT_MS);
      return;
    }

    this.clearSwitchTimers();
    if (openDrawer && drawerEl) {
      drawerEl.classList.remove('is-collapsed', 'is-switching-out', 'is-switching-in');
      if (wasCollapsed) {
        UiSoundEngine.getInstance().playDrawerOpen();
      }
    }

    this.populateBodyDom(body);
  }

  private populateBodyDom(body: CelestialBodyInstance): void {
    const d = body.data;
    const drawerEl = document.getElementById('hud-study-drawer');

    const nameEl = document.getElementById('hud-target-name');
    const subtitleEl = document.getElementById('hud-target-subtitle');
    const catEl = document.getElementById('hud-target-category');
    const descEl = document.getElementById('hud-target-desc');

    if (nameEl) nameEl.textContent = d.name;
    if (subtitleEl) subtitleEl.textContent = d.subtitle;
    if (catEl) catEl.textContent = body.meta.categoryNameRo;

    // Afișăm fotografia / randarea oficială NASA pentru rovere, stații, sonde și telescoape
    const mediaCard = document.getElementById('hud-target-media');
    const mediaImg = document.getElementById('hud-target-img') as HTMLImageElement | null;
    const mediaCaption = document.getElementById('hud-target-img-caption');
    const nasaMedia = NASA_MEDIA_BY_BODY_ID[d.id];
    if (mediaCard && mediaImg && mediaCaption) {
      if (nasaMedia) {
        mediaImg.src = nasaMedia.src;
        mediaImg.alt = `${d.name} — Fotografie / Randare NASA`;
        mediaCaption.textContent = nasaMedia.captionRo;
        mediaCard.classList.remove('is-hidden');
      } else {
        mediaCard.classList.add('is-hidden');
      }
    }

    // Afișăm caseta de telemetrie SGP4 pentru ISS și Hubble
    const issCard = document.getElementById('lab-iss-telemetry-card');
    if (issCard) {
      const isLeoTracked = d.id === 'iss' || d.id === 'hubble';
      issCard.classList.toggle('is-hidden', !isLeoTracked);
    }

    // Afișăm butonul „👁️ Vezi sub nori (Radar Magellan)" când este selectată planeta Venus
    const btnVenusRadar = document.getElementById('btn-venus-radar');
    if (btnVenusRadar) {
      btnVenusRadar.classList.toggle('is-hidden', d.id !== 'venus');
      if (d.id === 'venus') {
        this.syncVenusRadarButtonState(PlanetMaterialFactory.isVenusRadarMode());
      }
    }

    // Caseta didactică "💡 Ce este un An-Lumină?" + Comparator vizual de mărime pentru Cosmosul Îndepărtat
    let lyBox = document.getElementById('hud-lightyear-explainer');
    if (!lyBox && drawerEl) {
      lyBox = document.createElement('div');
      lyBox.id = 'hud-lightyear-explainer';
      lyBox.className = 'subcard lightyear-explainer-card is-hidden';
      lyBox.innerHTML = `
        <div class="didactic-callout">
          <strong>💡 Ce este un An-Lumină?</strong>
          <p id="hud-lightyear-definition">Distanța pe care o parcurge lumina într-un an întreg, mergând cu 300.000 km pe secundă — adică aproximativ 9.460 de miliarde de kilometri!</p>
        </div>
        <div class="didactic-callout callout-amber">
          <strong>📏 Comparator de Mărime față de Soare / Pământ:</strong>
          <p id="hud-size-comparator-text"></p>
        </div>
      `;
      drawerEl.appendChild(lyBox);
    }
    const isDeepSpace = Boolean(d.distanceLightYears && d.distanceLightYears > 0);
    if (lyBox) {
      lyBox.classList.toggle('is-hidden', !isDeepSpace);
      const sizeTextEl = document.getElementById('hud-size-comparator-text');
      if (sizeTextEl && isDeepSpace) {
        sizeTextEl.textContent =
          d.sizeComparisonRo ??
          `Distanță față de Sistemul Solar: ${d.distanceLightYearsLabelRo ?? `${d.distanceLightYears} ani-lumină`}.`;
      }
    }

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
    this.updateLiveDistance(body, true);
    this.onSyncPrintPreview?.(d.id);
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
        UiSoundEngine.getInstance().playQuizFeedback(isCorrect);
        btn.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
        feedbackEl.textContent = isCorrect
          ? `✅ Bravo, Cadet! ${d.cadet.quiz.explanation}`
          : `❌ Mai încearcă! ${d.cadet.quiz.explanation}`;

        if (isCorrect) {
          this.saveBadge(d.id);
          if (this.onBadgeUnlocked) {
            this.onBadgeUnlocked(d.id);
          }
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
    } catch (_e) {
      // Ignorăm eventualele restricții LocalStorage
    }
  }

  private toggleSpeechRo(): void {
    if (!this.currentBody) return;

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

    this.isSpeaking = true;
    if (btnSpeak) {
      btnSpeak.textContent = '⏹ Oprește citirea';
      btnSpeak.classList.add('hud-btn-active-amber');
    }

    SpeechManager.getInstance().speakBodyNarration(d.id, this.currentTier, textToRead, {
      onEnd: () => {
        this.isSpeaking = false;
        const btn = document.getElementById('btn-speak-ro');
        if (btn) {
          btn.textContent = '🔊 Citește-mi';
          btn.classList.remove('hud-btn-active-amber');
        }
      },
    });
  }

  public stopSpeech(): void {
    this.isSpeaking = false;
    SpeechManager.getInstance().stop();
    const btnSpeak = document.getElementById('btn-speak-ro');
    if (btnSpeak) {
      btnSpeak.textContent = '🔊 Citește-mi';
      btnSpeak.classList.remove('hud-btn-active-amber');
    }
  }

  private syncVenusRadarButtonState(active: boolean): void {
    const btnVenusRadar = document.getElementById('btn-venus-radar');
    if (!btnVenusRadar) return;
    btnVenusRadar.classList.toggle('hud-btn-active-amber', active);
    btnVenusRadar.setAttribute('aria-pressed', active ? 'true' : 'false');
    btnVenusRadar.textContent = active
      ? '👁️ Nori Semitransparenți (Radar Magellan Activ)'
      : '👁️ Vezi sub nori (Radar Magellan)';
  }
}

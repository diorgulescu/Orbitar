// SPDX-License-Identifier: GPL-3.0-or-later
import { CelestialBodyInstance, OrbitalEngine } from '../core/OrbitalEngine';
import { AgeTier } from '../types/celestial';
import {
  generateBodyColoringSvg,
  generateSolarSystemColoringSvg,
} from '../utils/ColoringSvgGenerator';
import {
  DiplomaGenerator,
  DiplomaOptions,
  DiplomaRank,
  resolveDiplomaTitleRo,
} from '../utils/DiplomaGenerator';

export type PrintTemplateType = 'study' | 'coloring' | 'mission-table' | 'diploma';

/**
 * PrintManager gestionează generarea și imprimarea fișelor didactice A4, a planșelor de colorat
 * și a Diplomei de Explorator / Cadet Spațial Orbitar:
 * - Populează containerul #orbitar-print-sheet (singurul vizibil la @media print)
 * - Șablonul A: "Fișă de Studiu & Colorat" (date + rezumat adaptiv + desen SVG + Quiz cu căsuțe de bifat)
 * - Șablonul B: "Planșă de Colorat A4 — Doar Desen Mare" (~85% desen SVG + litere conturate + curiozități)
 * - Șablonul C: "Jurnal de Misiune — Toate Planetele pe o Pagină" (tabel comparativ + harta Sistemului Solar)
 * - Șablonul D: "Diplomă de Explorator / Cadet Spațial Orbitar" (A4 Landscape, line-art oficial + insigne + ștampilă)
 * - Fereastra modală "🎨 Planșe de Colorat & Fișe" cu grilă vizuală și descărcare locală SVG / PNG
 */
export class PrintManager {
  private readonly orbitalEngine: OrbitalEngine;
  private readonly getTier: () => AgeTier;
  private readonly getUnlockedBadges: () => string[];
  private selectedModalTargetId = 'solar-system';
  private lastTemplate: PrintTemplateType = 'study';

  constructor(
    orbitalEngine: OrbitalEngine,
    getTier: () => AgeTier,
    getUnlockedBadges?: () => string[]
  ) {
    this.orbitalEngine = orbitalEngine;
    this.getTier = getTier;
    this.getUnlockedBadges =
      getUnlockedBadges ??
      (() => {
        try {
          const raw = window.localStorage.getItem('orbitar_badges');
          return raw ? (JSON.parse(raw) as string[]) : [];
        } catch (_e) {
          return [];
        }
      });
    this.initModalUI();
    // Pre-populăm #orbitar-print-sheet cu Soarele pentru a avea mereu o fișă pregătită
    this.populateStudySheet('sun');
  }

  private getPrintContainer(): HTMLElement | null {
    return document.getElementById('orbitar-print-sheet');
  }

  /**
   * Șablonul A ("Fișă de Studiu & Colorat") pentru un corp ceresc sau sondă spațială
   */
  public populateStudySheet(bodyId: string): string {
    const body =
      this.orbitalEngine.getBody(bodyId) ??
      this.orbitalEngine.getBody('sun') ??
      this.orbitalEngine.getBodies()[0];
    if (!body) return '';

    this.lastTemplate = 'study';
    const d = body.data;
    const tier = this.getTier();
    const isDeepSpace = Boolean(d.distanceLightYears && d.distanceLightYears > 0);
    const diameterKm =
      d.sizeComparisonRo && isDeepSpace
        ? d.sizeComparisonRo
        : `${(d.radiusKm * 2).toLocaleString('ro-RO')} km`;
    const distAuStr = isDeepSpace
      ? d.distanceLightYearsLabelRo ??
        `${(d.distanceLightYears ?? 0).toLocaleString('ro-RO')} ani-lumină`
      : `${d.distanceFromSunAU.toFixed(2).replace('.', ',')} UA`;
    const dayStr =
      d.dayLengthHours > 0
        ? `${d.dayLengthHours.toLocaleString('ro-RO')} ore`
        : 'Rotație diferențială / Orbital';
    const yearStr =
      d.orbitPeriodDays > 0
        ? `${d.orbitPeriodDays.toLocaleString('ro-RO')} zile pământești`
        : 'Centrul Sistemului Solar';
    const weight30kg = (30 * d.gravityRatio).toFixed(1).replace('.', ',');

    const levelLabel =
      tier === 'junior'
        ? 'Micul Explorator (6–8 ani)'
        : 'Cadet Orbitar (9–12 ani)';
    const summaryText = tier === 'junior' ? d.junior.summary : d.cadet.summary;
    const extraTitle =
      tier === 'junior' ? '⏱️ Timp de călătorie' : '🛰️ Istoricul explorării';
    const extraContent =
      tier === 'junior'
        ? `Cu racheta: ${d.junior.travelTime.rocket} • Cu viteza luminii: ${d.junior.travelTime.light}`
        : d.cadet.explorationHistory;

    const svgMarkup = generateBodyColoringSvg(d.id, d.name);

    const quizOptionsHtml = d.cadet.quiz.options
      .map(
        (opt) => `
        <li class="print-quiz-item">
          <span class="print-checkbox-square" aria-hidden="true"></span>
          <span>${opt}</span>
        </li>`
      )
      .join('');

    const html = `
      <article class="print-a4-page" data-template="study" data-body-id="${d.id}">
        <header class="print-header-banner">
          <div class="print-brand-block">
            <h1>ORBITAR // Fișă de Explorator Spațial</h1>
            <p>Planetariu Didactic Interactiv în Limba Română • Nivel: ${levelLabel}</p>
          </div>
          <div class="print-student-fields">
            <div>Numele exploratorului: _______________________</div>
            <div>Data: _______________ &nbsp; Clasa / Grupa: ________</div>
          </div>
        </header>

        <section class="print-title-row">
          <div>
            <h2 class="print-body-title">${d.name}</h2>
            <p class="print-body-subtitle">${d.subtitle}</p>
          </div>
          <span class="print-category-pill">${body.meta.categoryNameRo}</span>
        </section>

        <table class="print-facts-table" aria-label="Date astronomice rapide">
          <thead>
            <tr>
              <th>Diametru</th>
              <th>Distanța față de Soare</th>
              <th>Durata zilei</th>
              <th>Durata anului</th>
              <th>Temperatura medie</th>
              <th>Gravitație (Copil 30 kg)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>${diameterKm}</strong></td>
              <td><strong>${distAuStr}</strong></td>
              <td>${dayStr}</td>
              <td>${yearStr}</td>
              <td><strong>${d.meanTempC} °C</strong></td>
              <td>${d.gravityRatio} × Pământ (<strong>${weight30kg} kg</strong>)</td>
            </tr>
          </tbody>
        </table>

        <section class="print-didactic-grid">
          <div class="print-box print-box-full">
            <h3>📖 Descriere Astronomică (${levelLabel})</h3>
            <p>${summaryText}</p>
          </div>
          <div class="print-box">
            <h3>🎨 Analogie Vizuală pentru Copii</h3>
            <p>${d.junior.analogy}</p>
          </div>
          <div class="print-box">
            <h3>✨ Știai că...</h3>
            <p>${d.junior.funFact}</p>
          </div>
          <div class="print-box print-box-full">
            <h3>${extraTitle}</h3>
            <p>${extraContent}</p>
          </div>
        </section>

        <section class="print-bottom-split">
          <div class="print-coloring-zone">
            ${svgMarkup}
          </div>
          <div class="print-quiz-zone">
            <div>
              <h3>🎯 Verifică-ți Cunoștințele (Quiz)</h3>
              <p class="print-quiz-question">${d.cadet.quiz.question}</p>
              <ul class="print-quiz-list">
                ${quizOptionsHtml}
              </ul>
            </div>
            <div class="print-notes-lines">
              <strong>✏️ Bifează cu creionul răspunsul corect!</strong><br/>
              Notițele mele de explorator: ____________________________________________<br/>
              ________________________________________________________________________
            </div>
          </div>
        </section>

        <footer class="print-license-footnote">
          Orbitar v1.0.0 — Resursă Educațională Deschisă (GNU GPLv3) • Generat 100% offline pentru studiu și colorat
        </footer>
      </article>
    `;

    const container = this.getPrintContainer();
    if (container) {
      container.innerHTML = html;
    }
    return html;
  }

  /**
   * Șablonul B ("Planșă de Colorat A4 — Doar Desen Mare"):
   * ~85% din pagină dedicată ilustrației vectoriale de colorat (corp individual sau Harta Sistemului Solar),
   * cu titlul în litere mari conturate și 2–3 curiozități scurte în subsol.
   */
  public populateColoringSheet(targetId: string): string {
    this.lastTemplate = 'coloring';

    if (targetId === 'solar-system') {
      const mapSvg = generateSolarSystemColoringSvg();
      const html = `
        <article class="print-a4-page" data-template="coloring" data-body-id="solar-system">
          <header class="print-header-banner">
            <div class="print-brand-block">
              <h1>ORBITAR // Planșă de Colorat A4</h1>
              <p>Harta Sistemului Solar — Colorează planetele, orbitele și literele conturate!</p>
            </div>
            <div class="print-student-fields">
              <div>Numele exploratorului: _______________________ &nbsp; Data: ____________</div>
            </div>
          </header>

          <div class="print-full-coloring-wrap">
            ${mapSvg}
          </div>

          <section class="print-curiosities-footer">
            <h3>✨ 3 Curiozități despre Sistemul Solar (Colorează și Reține!)</h3>
            <ul class="print-curiosities-list">
              <li><strong>Ordinea planetelor de la Soare:</strong> Mercur, Venus, Pământ, Marte (planete stâncoase), apoi Centura de Asteroizi și giganții Jupiter, Saturn, Uranus și Neptun!</li>
              <li><strong>Soarele este uriaș:</strong> Conține 99,86% din toată masa Sistemului Solar — în el ar încăpea 1,3 milioane de planete Pământ.</li>
              <li><strong>Exploratori roboți:</strong> Stația Spațială Internațională (ISS) înconjoară Pământul în 90 de minute, iar sondele Voyager călătoresc acum printre stele!</li>
            </ul>
          </section>

          <footer class="print-license-footnote">
            Orbitar v1.0.0 — Planșă Educațională Liberă (GNU GPLv3) • Line-Art Vectorial Optimizat pentru Imprimare
          </footer>
        </article>
      `;
      const container = this.getPrintContainer();
      if (container) container.innerHTML = html;
      return html;
    }

    const body =
      this.orbitalEngine.getBody(targetId) ??
      this.orbitalEngine.getBody('sun') ??
      this.orbitalEngine.getBodies()[0];
    if (!body) return '';

    const d = body.data;
    const bodySvg = generateBodyColoringSvg(d.id, d.name);
    const diameterKm = (d.radiusKm * 2).toLocaleString('ro-RO');

    const html = `
      <article class="print-a4-page" data-template="coloring" data-body-id="${d.id}">
        <header class="print-header-banner">
          <div class="print-brand-block">
            <h1>ORBITAR // Planșă de Colorat A4</h1>
            <p>${d.name} (${body.meta.categoryNameRo}) — ${d.subtitle}</p>
          </div>
          <div class="print-student-fields">
            <div>Numele exploratorului: _______________________ &nbsp; Data: ____________</div>
          </div>
        </header>

        <div class="print-full-coloring-wrap">
          ${bodySvg}
        </div>

        <section class="print-curiosities-footer">
          <h3>✨ Curiozități despre ${d.name}</h3>
          <ul class="print-curiosities-list">
            <li><strong>Analogie vizuală:</strong> ${d.junior.analogy}</li>
            <li><strong>Știai că:</strong> ${d.junior.funFact}</li>
            <li><strong>Date rapide:</strong> Diametru ${diameterKm} km • Temperatură medie ${d.meanTempC} °C • Călătorie cu viteza luminii: ${d.junior.travelTime.light}.</li>
          </ul>
        </section>

        <footer class="print-license-footnote">
          Orbitar v1.0.0 — Planșă Educațională Liberă (GNU GPLv3) • Line-Art Vectorial Optimizat pentru Imprimare
        </footer>
      </article>
    `;

    const container = this.getPrintContainer();
    if (container) container.innerHTML = html;
    return html;
  }

  /**
   * Șablonul C ("Jurnal de Misiune — Toate Planetele pe o Pagină"):
   * Tabel comparativ de sinteză cu toate planetele Sistemului Solar + mini-harta de colorat.
   */
  public populateMissionLogTable(): string {
    this.lastTemplate = 'mission-table';
    const planetOrder = [
      'sun',
      'mercury',
      'venus',
      'earth',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
    ];

    const rowsHtml = planetOrder
      .map((id) => this.orbitalEngine.getBody(id))
      .filter((b): b is CelestialBodyInstance => Boolean(b))
      .map((b) => {
        const d = b.data;
        const diam = (d.radiusKm * 2).toLocaleString('ro-RO');
        const dist = d.distanceFromSunAU.toFixed(2).replace('.', ',');
        const period =
          d.orbitPeriodDays > 0
            ? `${d.orbitPeriodDays.toLocaleString('ro-RO')} zile`
            : '— (Stea centrală)';
        const dayH =
          d.dayLengthHours > 0
            ? `${d.dayLengthHours.toLocaleString('ro-RO')} ore`
            : '—';
        const weight30 = (30 * d.gravityRatio).toFixed(1).replace('.', ',');

        return `
          <tr>
            <td><strong>${d.name}</strong></td>
            <td>${b.meta.categoryNameRo}</td>
            <td>${diam} km</td>
            <td>${dist} UA</td>
            <td>${dayH}</td>
            <td>${period}</td>
            <td>${d.meanTempC} °C</td>
            <td>${d.gravityRatio}g (${weight30} kg)</td>
            <td><span class="print-checkbox-square"></span> Explorat</td>
          </tr>
        `;
      })
      .join('');

    const miniMapSvg = generateSolarSystemColoringSvg();

    const html = `
      <article class="print-a4-page" data-template="mission-table" data-body-id="all-planets">
        <header class="print-header-banner">
          <div class="print-brand-block">
            <h1>ORBITAR // Jurnal de Misiune — Tabelul Comparativ al Planetelor</h1>
            <p>Sinteză astronomică pentru școală și acasă + Harta Sistemului Solar de Colorat</p>
          </div>
          <div class="print-student-fields">
            <div>Numele exploratorului: _______________________</div>
            <div>Data: _______________ &nbsp; Clasa: ____________</div>
          </div>
        </header>

        <table class="print-facts-table" aria-label="Tabel comparativ al planetelor din Sistemul Solar">
          <thead>
            <tr>
              <th>Corp Ceresc</th>
              <th>Categorie</th>
              <th>Diametru</th>
              <th>Distanță Soare</th>
              <th>Durata Zilei</th>
              <th>Anul Orbital</th>
              <th>Temp. Medie</th>
              <th>Gravitație (30 kg)</th>
              <th>Jurnal</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <div class="print-coloring-zone" style="margin-top: 8px;">
          ${miniMapSvg}
        </div>

        <footer class="print-license-footnote">
          Orbitar v1.0.0 — Jurnal de Misiune Didactic (GNU GPLv3) • Bifează fiecare lume pe măsură ce o explorezi și colorează harta!
        </footer>
      </article>
    `;

    const container = this.getPrintContainer();
    if (container) container.innerHTML = html;
    return html;
  }

  private getTauriInvoke():
    | ((cmd: string, args?: Record<string, unknown>) => Promise<unknown>)
    | null {
    const w = window as unknown as {
      __TAURI_INTERNALS__?: {
        invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
      __TAURI__?: {
        core?: {
          invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
        };
      };
    };
    const fn = w.__TAURI_INTERNALS__?.invoke ?? w.__TAURI__?.core?.invoke;
    return typeof fn === 'function' ? fn.bind(w.__TAURI_INTERNALS__ ?? w.__TAURI__?.core) : null;
  }

  private showExportToast(messageRo: string): void {
    const toastEl = document.getElementById('hud-quality-toast');
    if (!toastEl) return;
    toastEl.textContent = messageRo;
    toastEl.classList.remove('is-hidden');
    window.setTimeout(() => {
      toastEl.classList.add('is-hidden');
    }, 4200);
  }

  /**
   * Declanșează dialogul nativ de imprimare:
   * - În aplicația desktop Tauri (macOS WKWebView / Windows / Linux), apelează comanda Rust `print_sheet`
   *   (`WebviewWindow::print()`), deoarece `window.print()` din JS este ignorat de WKWebView pe macOS.
   * - În browser web standard, apelează `window.print()`.
   */
  public triggerNativePrint(): void {
    const tauriInvoke = this.getTauriInvoke();
    if (tauriInvoke) {
      const invokePrint = (): void => {
        tauriInvoke('print_sheet').catch(() => {
          const w = window as unknown as {
            __TAURI__?: {
              webview?: {
                getCurrentWebview?: () => { print?: () => Promise<void> };
              };
            };
          };
          const webviewPrint = w.__TAURI__?.webview?.getCurrentWebview?.()?.print;
          if (typeof webviewPrint === 'function') {
            webviewPrint().catch(() => {
              window.print();
            });
          } else {
            window.print();
          }
        });
      };
      invokePrint();
      return;
    }
    window.print();
  }

  /**
   * Deschide fereastra modală "🎨 Planșe de Colorat & Fișe" direct pe corpul ceresc selectat,
   * derulând grila la acel corp și afișând previzualizarea planșei pe ecran.
   */
  public openModalForBody(
    targetId: string,
    template: 'coloring' | 'study' = 'coloring'
  ): void {
    const modal = document.getElementById('hud-coloring-modal');
    this.selectGridTarget(targetId);
    if (template === 'coloring') {
      this.populateColoringSheet(targetId);
    } else {
      this.populateStudySheet(targetId);
    }
    modal?.classList.remove('is-hidden');

    const gridEl = document.getElementById('coloring-bodies-grid');
    const selectedItem = gridEl?.querySelector<HTMLElement>(
      `.coloring-grid-item[data-target-id="${targetId}"]`
    );
    if (selectedItem && typeof selectedItem.scrollIntoView === 'function') {
      selectedItem.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }

  /**
   * Populează #orbitar-print-sheet cu Șablonul A pentru corpul dat și deschide dialogul de imprimare
   */
  public printStudySheet(bodyId: string): void {
    this.populateStudySheet(bodyId);
    this.triggerNativePrint();
  }

  /**
   * Populează #orbitar-print-sheet cu Șablonul B (Planșă de Colorat A4) și deschide dialogul de imprimare
   */
  public printColoringSheet(targetId: string): void {
    this.populateColoringSheet(targetId);
    this.triggerNativePrint();
  }

  /**
   * Populează #orbitar-print-sheet cu Șablonul C (Tabel Comparativ + Harta) și deschide dialogul de imprimare
   */
  public printMissionLogTable(): void {
    this.populateMissionLogTable();
    this.triggerNativePrint();
  }

  /**
   * Citește opțiunile curente din interfața diplomei (Nume + Rang + Insigne deblocate)
   */
  public getCurrentDiplomaOptions(overrides: DiplomaOptions = {}): DiplomaOptions {
    const nameInput = document.getElementById(
      'diploma-input-name'
    ) as HTMLInputElement | null;
    const rankSelect = document.getElementById(
      'diploma-select-rank'
    ) as HTMLSelectElement | null;

    const recipientName =
      overrides.recipientName !== undefined
        ? overrides.recipientName
        : nameInput?.value ?? '';
    const rank =
      overrides.rank ??
      ((rankSelect?.value as DiplomaRank | undefined) ||
        (this.getTier() === 'junior' ? 'explorer' : 'cadet'));

    return {
      recipientName,
      rank,
      ageTier: overrides.ageTier ?? this.getTier(),
      unlockedBadgeIds: overrides.unlockedBadgeIds ?? this.getUnlockedBadges(),
      issueDate: overrides.issueDate ?? new Date(),
    };
  }

  /**
   * Șablonul D ("Diplomă de Explorator / Cadet Spațial Orbitar" — A4 Landscape):
   * Populează #orbitar-print-sheet cu diploma oficială a Academiei Spațiale Orbitar.
   */
  public populateDiplomaSheet(overrides: DiplomaOptions = {}): string {
    this.lastTemplate = 'diploma';
    const opts = this.getCurrentDiplomaOptions(overrides);
    const html = DiplomaGenerator.generateDiplomaPrintHtml(opts);
    const container = this.getPrintContainer();
    if (container) {
      container.innerHTML = html;
    }
    return html;
  }

  /**
   * Populează #orbitar-print-sheet cu Șablonul D (Diploma A4 Landscape) și deschide dialogul de imprimare
   */
  public printDiplomaSheet(overrides: DiplomaOptions = {}): void {
    this.populateDiplomaSheet(overrides);
    this.triggerNativePrint();
  }

  /**
   * Deschide fereastra modală direct pe Șablonul D (Diploma de Cadet / Explorator)
   * și declanșează o animație festivă de felicitare.
   */
  public openDiplomaBuilder(syncRankWithTier = true): void {
    const modal = document.getElementById('hud-coloring-modal');
    const rankSelect = document.getElementById(
      'diploma-select-rank'
    ) as HTMLSelectElement | null;
    const builderCard = document.getElementById('diploma-builder-card');
    const festiveBadge = document.getElementById('diploma-festive-badge');
    const nameInput = document.getElementById(
      'diploma-input-name'
    ) as HTMLInputElement | null;

    if (syncRankWithTier && rankSelect) {
      rankSelect.value = this.getTier() === 'junior' ? 'explorer' : 'cadet';
    }

    this.selectedModalTargetId = 'diploma';
    this.renderModalPreview('diploma');
    modal?.classList.remove('is-hidden');

    const unlockedCount = this.getUnlockedBadges().length;
    if (festiveBadge) {
      festiveBadge.textContent =
        unlockedCount >= 6
          ? '🎉 Toate cele 6 Misiuni Îndeplinite!'
          : `🏅 ${unlockedCount}/6 Insigne Cucerite`;
    }

    if (builderCard) {
      builderCard.classList.remove('is-celebrating');
      void builderCard.offsetWidth;
      builderCard.classList.add('is-celebrating');
    }

    nameInput?.focus();
  }

  public getLastTemplate(): PrintTemplateType {
    return this.lastTemplate;
  }

  /**
   * Descarcă ilustrația vectorială SVG curentă ca fișier .svg local
   */
  public downloadSvg(targetId: string): void {
    const svgString = this.getSvgForTarget(targetId);
    const filename = `orbitar-plansa-colorat-${targetId}.svg`;
    const tauriInvoke = this.getTauriInvoke();
    if (tauriInvoke && typeof TextEncoder !== 'undefined') {
      const bytes = Array.from(new TextEncoder().encode(svgString));
      tauriInvoke('save_export_file', { filename, bytes })
        .then((savedPath) => {
          this.showExportToast(
            `✅ Planșa SVG a fost salvată în Downloads: ${String(savedPath)}`
          );
        })
        .catch(() => {
          this.triggerBrowserDownloadSvg(svgString, filename);
        });
      return;
    }
    this.triggerBrowserDownloadSvg(svgString, filename);
  }

  private triggerBrowserDownloadSvg(svgString: string, filename: string): void {
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Convertește ilustrația SVG într-o imagine PNG alb-negru de înaltă rezoluție și o descarcă local
   */
  public async downloadPng(targetId: string): Promise<void> {
    const svgString = this.getSvgForTarget(targetId);
    const filename = `orbitar-plansa-colorat-${targetId}.png`;
    const isLandscapeMap =
      targetId === 'solar-system' || targetId === 'diploma';
    const width = isLandscapeMap ? 2200 : 1600;
    const height = isLandscapeMap ? 1400 : 1080;

    const svgBlob = new Blob([svgString], {
      type: 'image/svg+xml;charset=utf-8',
    });
    const url = URL.createObjectURL(svgBlob);

    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          const pngUrl = canvas.toDataURL('image/png');
          const tauriInvoke = this.getTauriInvoke();
          if (tauriInvoke && pngUrl.includes(',')) {
            try {
              const base64Part = pngUrl.split(',')[1] ?? '';
              const binaryStr = window.atob(base64Part);
              const bytes = new Array<number>(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              tauriInvoke('save_export_file', { filename, bytes })
                .then((savedPath) => {
                  this.showExportToast(
                    `✅ Planșa PNG a fost salvată în Downloads: ${String(savedPath)}`
                  );
                })
                .catch(() => {
                  const a = document.createElement('a');
                  a.href = pngUrl;
                  a.download = filename;
                  document.body.appendChild(a);
                  a.click();
                  document.body.removeChild(a);
                });
              URL.revokeObjectURL(url);
              resolve();
              return;
            } catch (_e) {
              // Fallback la descărcarea din browser
            }
          }
          const a = document.createElement('a');
          a.href = pngUrl;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve();
      };
      img.src = url;
    });
  }

  private getSvgForTarget(targetId: string): string {
    if (targetId === 'diploma') {
      return DiplomaGenerator.generateDiplomaSvg(this.getCurrentDiplomaOptions());
    }
    if (targetId === 'solar-system') {
      return generateSolarSystemColoringSvg();
    }
    const body = this.orbitalEngine.getBody(targetId);
    return generateBodyColoringSvg(targetId, body?.data.name);
  }

  /**
   * Inițializează fereastra modală "🎨 Planșe de Colorat & Fișe" (#hud-coloring-modal)
   */
  private initModalUI(): void {
    const modal = document.getElementById('hud-coloring-modal');
    const btnOpenDock = document.getElementById('btn-dock-coloring');
    const btnClose = document.getElementById('btn-coloring-modal-close');

    const btnHeroMap = document.getElementById('btn-print-solar-map');
    const btnHeroTable = document.getElementById('btn-print-mission-table');
    const gridEl = document.getElementById('coloring-bodies-grid');

    const diplomaNameInput = document.getElementById(
      'diploma-input-name'
    ) as HTMLInputElement | null;
    const diplomaRankSelect = document.getElementById(
      'diploma-select-rank'
    ) as HTMLSelectElement | null;
    const btnPreviewDiploma = document.getElementById('btn-preview-diploma');
    const btnPrintDiploma = document.getElementById('btn-print-diploma');

    const btnPreviewPrintColoring = document.getElementById(
      'btn-preview-print-coloring'
    );
    const btnPreviewPrintStudy = document.getElementById(
      'btn-preview-print-study'
    );
    const btnDownloadSvg = document.getElementById('btn-coloring-download-svg');
    const btnDownloadPng = document.getElementById('btn-coloring-download-png');

    const openModal = (initialTargetId?: string): void => {
      if (initialTargetId) {
        this.selectedModalTargetId = initialTargetId;
      }
      this.renderModalPreview(this.selectedModalTargetId);
      modal?.classList.remove('is-hidden');
    };

    const closeModal = (): void => {
      modal?.classList.add('is-hidden');
    };

    btnOpenDock?.addEventListener('click', () => openModal());
    btnClose?.addEventListener('click', closeModal);

    modal?.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    btnHeroMap?.addEventListener('click', () => {
      this.selectedModalTargetId = 'solar-system';
      this.renderModalPreview('solar-system');
      this.printColoringSheet('solar-system');
    });

    btnHeroTable?.addEventListener('click', () => {
      this.populateMissionLogTable();
      const previewFrame = document.getElementById('coloring-preview-frame');
      const previewTitle = document.getElementById('coloring-preview-title');
      if (previewTitle) {
        previewTitle.textContent =
          '📊 Tabelul Comparativ al Planetelor + Harta Sistemului Solar';
      }
      if (previewFrame) {
        previewFrame.innerHTML = generateSolarSystemColoringSvg();
      }
      this.triggerNativePrint();
    });

    btnPreviewPrintColoring?.addEventListener('click', () => {
      if (this.selectedModalTargetId === 'diploma') {
        this.printDiplomaSheet();
        return;
      }
      this.printColoringSheet(this.selectedModalTargetId);
    });

    btnPreviewPrintStudy?.addEventListener('click', () => {
      if (this.selectedModalTargetId === 'diploma') {
        this.printDiplomaSheet();
        return;
      }
      const target =
        this.selectedModalTargetId === 'solar-system'
          ? 'sun'
          : this.selectedModalTargetId;
      this.printStudySheet(target);
    });

    const refreshDiplomaPreview = (): void => {
      this.selectedModalTargetId = 'diploma';
      this.renderModalPreview('diploma');
    };

    diplomaNameInput?.addEventListener('input', refreshDiplomaPreview);
    diplomaRankSelect?.addEventListener('change', refreshDiplomaPreview);
    btnPreviewDiploma?.addEventListener('click', refreshDiplomaPreview);
    btnPrintDiploma?.addEventListener('click', () => {
      this.selectedModalTargetId = 'diploma';
      this.renderModalPreview('diploma');
      this.printDiplomaSheet();
    });

    btnDownloadSvg?.addEventListener('click', () => {
      this.downloadSvg(this.selectedModalTargetId);
    });

    btnDownloadPng?.addEventListener('click', () => {
      void this.downloadPng(this.selectedModalTargetId);
    });

    // Populăm grila vizuală cu toate planetele, asteroizii și sondele
    if (gridEl) {
      gridEl.innerHTML = '';

      // Card special pentru Harta Sistemului Solar
      const mapCard = document.createElement('div');
      mapCard.className = 'coloring-grid-item is-selected';
      mapCard.dataset.targetId = 'solar-system';
      mapCard.innerHTML = `
        <div class="coloring-grid-item-head">
          <span class="body-pill-dot" style="background:#ffb703"></span>
          <span>Harta Sistemului Solar</span>
        </div>
        <div class="coloring-grid-item-actions">
          <button type="button" class="coloring-mini-btn" data-action="preview">👁️ Vezi</button>
          <button type="button" class="coloring-mini-btn" data-action="print-color">🎨 Colorat</button>
        </div>
      `;
      mapCard.addEventListener('click', (e) => {
        const btn = (e.target as HTMLElement).closest('button');
        const action = btn?.dataset.action;
        this.selectGridTarget('solar-system');
        if (action === 'print-color') {
          this.printColoringSheet('solar-system');
        }
      });
      gridEl.appendChild(mapCard);

      for (const body of this.orbitalEngine.getAllBodies()) {
        const d = body.data;
        const card = document.createElement('div');
        card.className = 'coloring-grid-item';
        card.dataset.targetId = d.id;
        card.innerHTML = `
          <div class="coloring-grid-item-head">
            <span class="body-pill-dot" style="background:${d.color}"></span>
            <span>${d.name}</span>
          </div>
          <div class="coloring-grid-item-actions">
            <button type="button" class="coloring-mini-btn" data-action="print-color" title="Printează Planșa de Colorat A4">🎨 Colorat</button>
            <button type="button" class="coloring-mini-btn" data-action="print-study" title="Printează Fișa de Studiu & Quiz">🖨️ Fișă</button>
          </div>
        `;
        card.addEventListener('click', (e) => {
          const btn = (e.target as HTMLElement).closest('button');
          const action = btn?.dataset.action;
          this.selectGridTarget(d.id);
          if (action === 'print-color') {
            this.printColoringSheet(d.id);
          } else if (action === 'print-study') {
            this.printStudySheet(d.id);
          }
        });
        gridEl.appendChild(card);
      }
    }

    this.renderModalPreview('solar-system');
  }

  public selectGridTarget(targetId: string): void {
    this.selectedModalTargetId = targetId;
    const gridEl = document.getElementById('coloring-bodies-grid');
    if (gridEl) {
      gridEl
        .querySelectorAll<HTMLElement>('.coloring-grid-item')
        .forEach((item) => {
          item.classList.toggle(
            'is-selected',
            item.dataset.targetId === targetId
          );
        });
    }
    this.renderModalPreview(targetId);
  }

  private renderModalPreview(targetId: string): void {
    const previewFrame = document.getElementById('coloring-preview-frame');
    const previewTitle = document.getElementById('coloring-preview-title');
    if (!previewFrame) return;

    if (targetId === 'diploma') {
      const opts = this.getCurrentDiplomaOptions();
      const titleRo = resolveDiplomaTitleRo(opts.rank, opts.ageTier);
      if (previewTitle) {
        previewTitle.textContent = `🎓 Previzualizare: ${titleRo} (A4 Landscape)`;
      }
      previewFrame.innerHTML = DiplomaGenerator.generateDiplomaSvg(opts);
      this.populateDiplomaSheet(opts);
      return;
    }

    if (targetId === 'solar-system') {
      if (previewTitle) {
        previewTitle.textContent =
          '🗺️ Previzualizare: Harta Sistemului Solar de Colorat (A4)';
      }
      previewFrame.innerHTML = generateSolarSystemColoringSvg();
      this.populateColoringSheet('solar-system');
      return;
    }

    const body = this.orbitalEngine.getBody(targetId);
    const titleRo = body?.data.name ?? targetId;
    if (previewTitle) {
      previewTitle.textContent = `🎨 Previzualizare: ${titleRo}`;
    }
    previewFrame.innerHTML = generateBodyColoringSvg(targetId, titleRo);
    this.populateStudySheet(targetId);
  }
}

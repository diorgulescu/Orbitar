// SPDX-License-Identifier: GPL-3.0-or-later
import { ORBITAR_TREASURE_MISSIONS } from '../ui/OrbitarMissions';
import { AgeTier } from '../types/celestial';

export type DiplomaRank = 'explorer' | 'cadet' | 'commander';

export interface DiplomaOptions {
  recipientName?: string;
  rank?: DiplomaRank;
  ageTier?: AgeTier;
  unlockedBadgeIds?: string[];
  issueDate?: Date;
}

const ROMANIAN_MONTHS = [
  'Ianuarie',
  'Februarie',
  'Martie',
  'Aprilie',
  'Mai',
  'Iunie',
  'Iulie',
  'August',
  'Septembrie',
  'Octombrie',
  'Noiembrie',
  'Decembrie',
];

/**
 * Formatare dată în limba română cu lună cu majusculă (ex: "3 Noiembrie 2026")
 */
export function formatRomanianDiplomaDate(date: Date = new Date()): string {
  const day = date.getDate();
  const month = ROMANIAN_MONTHS[date.getMonth()] ?? 'Noiembrie';
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

/**
 * Determină titlul oficial al diplomei în funcție de rangul selectat sau nivelul de vârstă activ
 */
export function resolveDiplomaTitleRo(rank?: DiplomaRank, ageTier?: AgeTier): string {
  const effectiveRank: DiplomaRank =
    rank ?? (ageTier === 'junior' ? 'explorer' : 'cadet');
  switch (effectiveRank) {
    case 'explorer':
      return 'DIPLOMĂ DE MIC EXPLORATOR';
    case 'commander':
      return 'DIPLOMĂ DE COMANDANT DE NAVĂ';
    case 'cadet':
    default:
      return 'DIPLOMĂ DE CADET SPAȚIAL';
  }
}

/**
 * DiplomaGenerator construiește o diplomă oficială A4 Landscape în line-art vectorial SVG
 * și HTML/CSS alb-negru (#ffffff fundal, #000000 contururi), gata de imprimat și colorat.
 */
export class DiplomaGenerator {
  /**
   * Generează SVG-ul complet A4 Landscape (viewBox 1120×760) al Diplomei Orbitar,
   * utilizabil atât pentru previzualizare/descărcare SVG/PNG, cât și în pagina de printare.
   */
  public static generateDiplomaSvg(options: DiplomaOptions = {}): string {
    const trimmedName = (options.recipientName ?? '').trim();
    const displayName =
      trimmedName.length > 0
        ? this.escapeXml(trimmedName)
        : '___________________________________';
    const isHandwrittenLine = trimmedName.length === 0;
    const titleRo = resolveDiplomaTitleRo(options.rank, options.ageTier);
    const dateStr = formatRomanianDiplomaDate(options.issueDate ?? new Date());
    const unlockedSet = new Set(options.unlockedBadgeIds ?? []);

    const badgesSvg = this.renderBadgesRowSvg(unlockedSet);
    const officialStampSvg = this.renderOfficialStampSvg(560, 622);

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 760" width="100%" height="100%" style="background:#ffffff">
      <!-- Bordură exterioară dublă A4 Landscape cu colțuri stelare -->
      <rect x="6" y="6" width="1108" height="748" rx="18" fill="#ffffff" stroke="#000000" stroke-width="4"/>
      <rect x="20" y="20" width="1080" height="720" rx="12" fill="#ffffff" stroke="#000000" stroke-width="2"/>
      <rect x="28" y="28" width="1064" height="704" rx="8" fill="none" stroke="#000000" stroke-width="1.5" stroke-dasharray="10 6"/>

      <!-- Ornamente cosmice în cele 4 colțuri (rachete, planete, stele și orbite de colorat) -->
      ${this.renderCornerDecorationsSvg()}

      <!-- Antetul Academiei Spațiale Orbitar -->
      <g text-anchor="middle" font-family="Arial, sans-serif" fill="#000000">
        <text x="560" y="72" font-size="16" font-weight="900" letter-spacing="3.5">
          ACADEMIA SPAȚIALĂ ORBITAR // PLANETARIU DIDACTIC INTERACTIV
        </text>
        <line x1="210" y1="84" x2="910" y2="84" stroke="#000000" stroke-width="2"/>

        <!-- Titlul Mare Central cu litere conturate ce pot fi și colorate -->
        <text x="560" y="138" font-size="40" font-weight="900" fill="#ffffff" stroke="#000000" stroke-width="2.6" letter-spacing="3">
          ${this.escapeXml(titleRo)}
        </text>

        <!-- Text solemn și cald -->
        <text x="560" y="176" font-size="18" font-style="italic" font-weight="700">
          Se acordă cu mândrie exploratorului cosmic:
        </text>

        <!-- Numele copilului sau linia punctată generoasă pentru completare cu stiloul -->
        <text x="560" y="226" font-size="${isHandwrittenLine ? '28' : '36'}" font-weight="900" letter-spacing="${isHandwrittenLine ? '2' : '1.5'}">
          ${displayName}
        </text>
        ${
          !isHandwrittenLine
            ? `<line x1="260" y1="238" x2="860" y2="238" stroke="#000000" stroke-width="2" stroke-dasharray="6 4"/>`
            : ''
        }

        <!-- Motivul acordării -->
        <text x="560" y="274" font-size="15.5" font-weight="700">
          Pentru curiozitate științifică, navigare cu succes prin Sistemul Solar și îndeplinirea
        </text>
        <text x="560" y="296" font-size="15.5" font-weight="700">
          misiunilor de studiu despre planete, asteroizi, telescoape și sonde spațiale.
        </text>
      </g>

      <!-- Secțiunea: Insigne Cucerite în Jurnalul de Bord -->
      <g>
        <rect x="70" y="318" width="980" height="196" rx="12" fill="#ffffff" stroke="#000000" stroke-width="2.5"/>
        <text x="560" y="344" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#000000" letter-spacing="2">
          🏅 INSIGNE CUCERITE ÎN JURNALUL DE BORD ORBITAR (COLOREAZĂ ȘI BIFEAZĂ!)
        </text>
        ${badgesSvg}
      </g>

      <!-- Subsolul diplomei (3 coloane: Data emiterii | Ștampila Oficială Orbitar | Semnătura Comandantului) -->
      <g font-family="Arial, sans-serif" fill="#000000">
        <!-- Coloana 1: Data emiterii -->
        <text x="215" y="592" text-anchor="middle" font-size="14" font-weight="800">
          Data emiterii:
        </text>
        <text x="215" y="622" text-anchor="middle" font-size="18" font-weight="900">
          ${this.escapeXml(dateStr)}
        </text>
        <line x1="95" y1="636" x2="335" y2="636" stroke="#000000" stroke-width="2"/>
        <text x="215" y="656" text-anchor="middle" font-size="12" font-weight="700">
           Stația Orbitală Terestră • Sistemul Solar
        </text>

        <!-- Coloana 2: Ștampila Oficială Orbitar (Saturn + Rachetă + Deviza Ad Astra) -->
        ${officialStampSvg}

        <!-- Coloana 3: Semnătura Comandantului de Misiune -->
        <text x="895" y="586" text-anchor="middle" font-size="13.5" font-weight="800">
          Semnătura Comandantului de Misiune
        </text>
        <text x="895" y="604" text-anchor="middle" font-size="12.5" font-weight="700">
          (Părinte / Profesor):
        </text>
        <text x="895" y="642" text-anchor="middle" font-size="16" font-weight="900">
          ___________________________
        </text>
        <text x="895" y="662" text-anchor="middle" font-size="11.5" font-style="italic" font-weight="700">
          Aprobat pentru zbor interplanetar
        </text>
      </g>
    </svg>`;
  }

  /**
   * Generează pagina completă Șablonul D (HTML + SVG) pentru #orbitar-print-sheet,
   * garantată să încapă pe o singură pagină A4 Landscape.
   */
  public static generateDiplomaPrintHtml(options: DiplomaOptions = {}): string {
    const svg = this.generateDiplomaSvg(options);
    return `
      <article class="print-a4-page print-diploma-page" data-template="diploma" data-body-id="diploma">
        <div class="print-diploma-svg-wrap">
          ${svg}
        </div>
      </article>
    `;
  }

  private static renderCornerDecorationsSvg(): string {
    return `<g stroke="#000000" stroke-width="2.5" fill="#ffffff">
      <!-- Colț Stânga-Sus: Rachetă cosmică în ascensiune + stele -->
      <g transform="translate(86, 86) rotate(-32)">
        <path d="M 0,-34 C 14,-18 16,6 14,24 L -14,24 C -16,6 -14,-18 0,-34 Z" stroke-width="2.8"/>
        <polygon points="-14,12 -26,28 -14,24"/>
        <polygon points="14,12 26,28 14,24"/>
        <circle cx="0" cy="-4" r="7"/>
        <path d="M -8,24 L 0,40 L 8,24 Z"/>
      </g>
      <polygon points="148,52 152,62 163,62 154,68 157,78 148,72 139,78 142,68 133,62 144,62" stroke-width="2"/>

      <!-- Colț Dreapta-Sus: Planeta Saturn cu inele + stea -->
      <g transform="translate(1028, 86) rotate(-18)">
        <ellipse cx="0" cy="0" rx="44" ry="14"/>
        <circle cx="0" cy="0" r="21"/>
        <path d="M -44,0 A 44,14 0 0,0 44,0" fill="none" stroke-width="2.8"/>
      </g>
      <polygon points="962,54 966,64 977,64 968,70 971,80 962,74 953,80 956,70 947,64 958,64" stroke-width="2"/>

      <!-- Colț Stânga-Jos: Orbită eliptică și semilună -->
      <g transform="translate(78, 675)">
        <path d="M -12,-24 A 24,24 0 1,0 18,18 A 18,18 0 1,1 -12,-24 Z"/>
        <circle cx="24" cy="-12" r="5"/>
      </g>

      <!-- Colț Dreapta-Jos: Stea polară cu 8 raze -->
      <g transform="translate(1038, 675)">
        <polygon points="0,-28 7,-7 28,0 7,7 0,28 -7,7 -28,0 -7,-7"/>
        <circle cx="0" cy="0" r="5"/>
      </g>
    </g>`;
  }

  private static renderBadgesRowSvg(unlockedSet: Set<string>): string {
    const startX = 92;
    const stepX = 158;
    const y = 362;

    return ORBITAR_TREASURE_MISSIONS.map((m, idx) => {
      const x = startX + idx * stepX;
      const isUnlocked = unlockedSet.has(m.targetBodyId);
      const iconDrawing = this.renderBadgeVectorIcon(m.targetBodyId);
      const statusText = isUnlocked ? '☑ CUCERITĂ' : '☐ DE BIFAT';

      return `<g transform="translate(${x}, ${y})" font-family="Arial, sans-serif">
        <rect x="0" y="0" width="144" height="136" rx="10" fill="#ffffff" stroke="#000000" stroke-width="${
          isUnlocked ? '2.8' : '2'
        }" ${isUnlocked ? '' : 'stroke-dasharray="5 3"'}/>
        <!-- Medalia circulară line-art de colorat -->
        <g transform="translate(72, 48)" stroke="#000000" stroke-width="2.4" fill="#ffffff">
          <circle cx="0" cy="0" r="32"/>
          ${iconDrawing}
        </g>
        <text x="72" y="102" text-anchor="middle" font-size="11.5" font-weight="900" fill="#000000">
          ${this.escapeXml(m.badgeTitleRo)}
        </text>
        <text x="72" y="122" text-anchor="middle" font-size="10.5" font-weight="800" fill="#000000">
          ${statusText}
        </text>
      </g>`;
    }).join('\n');
  }

  private static renderBadgeVectorIcon(targetBodyId: string): string {
    switch (targetBodyId) {
      case 'jwst':
        // Fagure hexagonal JWST
        return `<polygon points="0,-20 17,-10 17,10 0,20 -17,10 -17,-10"/>
                <circle cx="0" cy="0" r="7"/>`;
      case 'mars':
        // Planeta Marte cu vulcanul Olympus Mons
        return `<circle cx="0" cy="0" r="20"/>
                <polygon points="-10,8 0,-8 10,8"/>`;
      case 'saturn':
        // Saturn cu inele
        return `<ellipse cx="0" cy="0" rx="26" ry="8" transform="rotate(-18)"/>
                <circle cx="0" cy="0" r="12"/>`;
      case 'iss':
        // Stația Spațială Internațională (ISS)
        return `<line x1="-22" y1="0" x2="22" y2="0" stroke-width="2.8"/>
                <rect x="-20" y="-14" width="8" height="28"/>
                <rect x="12" y="-14" width="8" height="28"/>
                <rect x="-6" y="-6" width="12" height="12" rx="2"/>`;
      case 'pluto':
        // Pluto cu inima Tombaugh Regio
        return `<circle cx="0" cy="0" r="19"/>
                <path d="M 0,10 C -9,4 -11,-4 -5,-7 C 0,-9 0,-3 0,-3 C 0,-3 0,-9 5,-7 C 11,-4 9,4 0,10 Z"/>`;
      case 'voyager1':
      default:
        // Sonda Voyager și Discul de Aur
        return `<circle cx="0" cy="0" r="18"/>
                <circle cx="0" cy="0" r="6"/>
                <line x1="-18" y1="0" x2="18" y2="0"/>`;
    }
  }

  /**
   * Ștampila Oficială Orbitar: emblemă circulară SVG cu Saturn, o rachetă și deviza
   * "Ad Astra — Prin Știință către Stele"
   */
  private static renderOfficialStampSvg(cx: number, cy: number): string {
    return `<g transform="translate(${cx}, ${cy})" stroke="#000000" fill="#ffffff" font-family="Arial, sans-serif">
      <!-- Cercuri concentrice de sigiliu oficial -->
      <circle cx="0" cy="0" r="88" stroke-width="3"/>
      <circle cx="0" cy="0" r="80" stroke-width="1.8" stroke-dasharray="6 4"/>
      <circle cx="0" cy="0" r="56" stroke-width="2.2"/>

      <!-- Textul superior și inferior al ștampilei -->
      <text x="0" y="-62" text-anchor="middle" font-size="9.5" font-weight="900" fill="#000000" stroke="none" letter-spacing="1.2">
        ★ ȘTAMPILA OFICIALĂ ORBITAR ★
      </text>
      <text x="0" y="71" text-anchor="middle" font-size="8.8" font-weight="900" fill="#000000" stroke="none" letter-spacing="0.6">
        AD ASTRA — PRIN ȘTIINȚĂ CĂTRE STELE
      </text>

      <!-- Ilustrația centrală din ștampilă: Saturn + Rachetă -->
      <g transform="translate(-14, 6) rotate(-18)" stroke-width="2.2">
        <ellipse cx="0" cy="0" rx="28" ry="9"/>
        <circle cx="0" cy="0" r="13"/>
      </g>
      <g transform="translate(20, -6) rotate(22)" stroke-width="2.2">
        <path d="M 0,-22 C 8,-10 9,4 8,14 L -8,14 C -9,4 -8,-10 0,-22 Z"/>
        <circle cx="0" cy="-4" r="4"/>
        <polygon points="-8,8 -14,18 -8,14"/>
        <polygon points="8,8 14,18 8,14"/>
      </g>
    </g>`;
  }

  private static escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}

export function generateDiplomaSvg(options: DiplomaOptions = {}): string {
  return DiplomaGenerator.generateDiplomaSvg(options);
}

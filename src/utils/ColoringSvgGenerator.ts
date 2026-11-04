// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * ColoringSvgGenerator produce ilustrații vectoriale SVG "line-art" alb-negru
 * (fundal #ffffff, contururi #000000, stroke-width="3", fără degradeuri gri),
 * optimizate pentru imprimare A4 cu consum redus de cerneală/toner și ideale
 * pentru a fi colorate cu creioane sau carioci de copii de 6–12 ani.
 */
export class ColoringSvgGenerator {
  /**
   * Generează ilustrația SVG de colorat (800×520) specifică unui corp ceresc sau unei sonde spațiale.
   */
  public static generateBodyColoringSvg(bodyId: string, titleRo: string = ''): string {
    const id = bodyId.toLowerCase();
    const decorativeStars = this.renderDecorativeStarsAndSparkles();
    let artwork = '';

    switch (id) {
      case 'sun':
        artwork = this.drawSunLineArt();
        break;
      case 'mercury':
        artwork = this.drawCrateredWorldLineArt(155, 'MERCUR', false);
        break;
      case 'venus':
        artwork = this.drawVenusLineArt();
        break;
      case 'earth':
        artwork = this.drawEarthLineArt();
        break;
      case 'moon':
        artwork = this.drawCrateredWorldLineArt(150, 'LUNA', true);
        break;
      case 'mars':
        artwork = this.drawMarsLineArt();
        break;
      case 'jupiter':
        artwork = this.drawJupiterLineArt();
        break;
      case 'saturn':
        artwork = this.drawSaturnLineArt();
        break;
      case 'uranus':
        artwork = this.drawUranusLineArt();
        break;
      case 'neptune':
        artwork = this.drawNeptuneLineArt();
        break;
      case 'pluto':
        artwork = this.drawPlutoLineArt();
        break;
      case 'io':
        artwork = this.drawIoVolcanicLineArt();
        break;
      case 'europa':
      case 'enceladus':
        artwork = this.drawIcyGeyserMoonLineArt(id === 'enceladus');
        break;
      case 'ganymede':
      case 'callisto':
      case 'ceres':
      case 'eris':
      case 'makemake':
        artwork = this.drawDwarfOrMoonLineArt(id);
        break;
      case 'haumea':
        artwork = this.drawHaumeaLineArt();
        break;
      case 'titan':
        artwork = this.drawTitanLineArt();
        break;
      case 'vesta':
      case 'pallas':
      case 'bennu':
      case 'apophis':
      case 'psyche':
        artwork = this.drawAsteroidLineArt(id);
        break;
      case 'iss':
        artwork = this.drawISSLineArt();
        break;
      case 'jwst':
        artwork = this.drawJWSTLineArt();
        break;
      case 'hubble':
      case 'euclid':
        artwork = this.drawSpaceTelescopeLineArt(id === 'euclid');
        break;
      case 'voyager1':
      case 'voyager2':
        artwork = this.drawVoyagerLineArt();
        break;
      case 'perseverance':
      case 'curiosity':
        artwork = this.drawMarsRoverLineArt(id === 'perseverance');
        break;
      case 'newhorizons':
      case 'parker':
      case 'rosetta':
      case 'juice':
        artwork = this.drawDeepSpaceProbeLineArt(id);
        break;
      case 'milky_way':
      case 'andromeda':
        artwork = this.drawSpiralGalaxyLineArt(id === 'milky_way');
        break;
      case 'trappist1':
      case 'proxima_centauri':
        artwork = this.drawTrappistExoplanetSystemLineArt(id === 'trappist1');
        break;
      case 'cancri55e':
        artwork = this.drawLavaDiamondExoplanetLineArt();
        break;
      case 'sagittarius_a':
        artwork = this.drawBlackHoleAccretionLineArt();
        break;
      case 'oort_cloud':
        artwork = this.drawOortCloudLineArt();
        break;
      case 'sirius':
      case 'betelgeuse':
        artwork = this.drawStarComparisonLineArt(id === 'betelgeuse');
        break;
      case 'pleiades':
        artwork = this.drawPleiadesClusterLineArt();
        break;
      case 'orion_nebula':
      case 'pillars_of_creation':
        artwork = this.drawCosmicNebulaLineArt(id === 'pillars_of_creation');
        break;
      default:
        artwork = this.drawSaturnLineArt();
        break;
    }

    const bannerTitle = titleRo
      ? `<text x="400" y="498" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="900" fill="#ffffff" stroke="#000000" stroke-width="2.2" letter-spacing="4">${this.escapeXml(
          titleRo.toUpperCase()
        )}</text>`
      : '';

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 520" width="100%" height="100%" style="background:#ffffff">
      <rect x="2" y="2" width="796" height="516" rx="16" fill="#ffffff" stroke="#000000" stroke-width="3"/>
      ${decorativeStars}
      ${artwork}
      ${bannerTitle}
    </svg>`;
  }

  /**
   * Generează planșa generală A4 Landscape "Harta Sistemului Solar de Colorat"
   * cu Soarele în stânga, orbitele punctate, toate cele 8 planete în ordine, Centura de Asteroizi,
   * Pluto, o cometă, Stația Spațială Internațională și etichete în limba română.
   */
  public static generateSolarSystemColoringSvg(): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1120 760" width="100%" height="100%" style="background:#ffffff">
      <!-- Cadru exterior A4 Landscape -->
      <rect x="4" y="4" width="1112" height="752" rx="18" fill="#ffffff" stroke="#000000" stroke-width="3.5"/>

      <!-- Titlu mare conturat (pentru a fi colorat de copii) -->
      <text x="560" y="54" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="900" fill="#ffffff" stroke="#000000" stroke-width="2.5" letter-spacing="5">
        SISTEMUL SOLAR — HARTA DE COLORAT ORBITAR
      </text>
      <text x="560" y="80" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#000000">
        Colorează Soarele, cele 8 planete în ordine, Centura de Asteroizi, Pluto, cometa și Stația Spațială Internațională!
      </text>

      <!-- Stele de fundal de colorat -->
      <g fill="#ffffff" stroke="#000000" stroke-width="2">
        <polygon points="190,115 196,130 212,130 199,139 204,155 190,145 176,155 181,139 168,130 184,130"/>
        <polygon points="480,108 485,120 498,120 487,128 491,140 480,132 469,140 473,128 462,120 475,120"/>
        <polygon points="880,105 886,120 902,120 889,129 894,145 880,135 866,145 871,129 858,120 874,120"/>
        <polygon points="1045,210 1050,222 1063,222 1052,230 1056,242 1045,234 1034,242 1038,230 1027,222 1040,222"/>
        <circle cx="310" cy="120" r="6"/>
        <circle cx="660" cy="112" r="7"/>
        <circle cx="260" cy="645" r="6"/>
        <circle cx="775" cy="660" r="7"/>
      </g>

      <!-- Orbitele eliptice punctate ale planetelor -->
      <g fill="none" stroke="#000000" stroke-width="2" stroke-dasharray="7 7">
        <path d="M 145,170 A 260,260 0 0,1 145,630"/>
        <path d="M 215,140 A 320,320 0 0,1 215,660"/>
        <path d="M 300,120 A 380,380 0 0,1 300,680"/>
        <path d="M 390,110 A 440,440 0 0,1 390,690"/>
        <path d="M 555,100 A 520,520 0 0,1 555,700"/>
        <path d="M 720,95 A 600,600 0 0,1 720,705"/>
        <path d="M 865,95 A 660,660 0 0,1 865,705"/>
        <path d="M 980,95 A 720,720 0 0,1 980,705"/>
      </g>

      <!-- 0. SOARELE (în stânga, cu raze și protuberanțe de colorat) -->
      <g stroke="#000000" stroke-width="3" fill="#ffffff">
        <!-- Raze triunghiulare solare -->
        <polygon points="85,185 115,215 72,225"/>
        <polygon points="125,245 158,265 120,285"/>
        <polygon points="145,320 182,340 145,360"/>
        <polygon points="150,395 186,410 148,430"/>
        <polygon points="135,470 172,490 130,505"/>
        <polygon points="110,540 145,565 100,575"/>
        <path d="M 4,190 A 150,220 0 0,1 4,610 Z" fill="#ffffff" stroke="#000000" stroke-width="3.5"/>
        <circle cx="52" cy="330" r="14"/>
        <circle cx="75" cy="420" r="18"/>
        <circle cx="45" cy="490" r="11"/>
      </g>
      <text x="68" y="655" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="900" fill="#000000">SOARELE</text>

      <!-- 1. MERCUR -->
      <g transform="translate(175, 390)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <circle cx="0" cy="0" r="22"/>
        <circle cx="-6" cy="-5" r="5"/>
        <circle cx="7" cy="6" r="4"/>
      </g>
      <text x="175" y="435" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#000000">1. Mercur</text>

      <!-- 2. VENUS -->
      <g transform="translate(245, 320)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <circle cx="0" cy="0" r="32"/>
        <path d="M -26,-10 Q 0,-22 26,-8" fill="none"/>
        <path d="M -28,6 Q 0,18 28,4" fill="none"/>
      </g>
      <text x="245" y="374" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#000000">2. Venus</text>

      <!-- 3. PĂMÂNTUL + LUNA + ISS -->
      <g transform="translate(332, 430)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <circle cx="0" cy="0" r="36"/>
        <path d="M -18,-22 Q -4,-12 -10,4 Q -16,18 -4,24 Q 10,16 6,-4 Q 14,-18 -2,-26 Z"/>
        <path d="M 14,-8 Q 26,0 20,16 Q 12,18 14,-8 Z"/>
        <!-- Luna -->
        <circle cx="38" cy="-42" r="11"/>
        <circle cx="36" cy="-44" r="3"/>
      </g>
      <text x="332" y="488" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#000000">3. Pământul</text>
      <text x="385" y="375" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="700" fill="#000000">Luna</text>

      <!-- ISS deasupra Pământului -->
      <g transform="translate(310, 220)" stroke="#000000" stroke-width="2.5" fill="#ffffff">
        <line x1="-38" y1="0" x2="38" y2="0" stroke-width="3"/>
        <rect x="-12" y="-7" width="24" height="14" rx="4"/>
        <rect x="-34" y="-22" width="12" height="44"/>
        <rect x="22" y="-22" width="12" height="44"/>
      </g>
      <text x="310" y="262" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#000000">Stația ISS</text>

      <!-- 4. MARTE -->
      <g transform="translate(425, 345)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <circle cx="0" cy="0" r="27"/>
        <path d="M -16,-20 Q 0,-14 16,-20" fill="none"/>
        <polygon points="-8,6 0,-8 8,6"/>
        <circle cx="10" cy="10" r="4"/>
      </g>
      <text x="425" y="394" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="800" fill="#000000">4. Marte</text>

      <!-- CENTURA DE ASTEROIZI (între Marte și Jupiter) -->
      <g stroke="#000000" stroke-width="2.5" fill="#ffffff">
        <circle cx="485" cy="180" r="9"/>
        <polygon points="492,235 504,242 498,255 484,250"/>
        <circle cx="498" cy="300" r="12"/>
        <polygon points="488,360 502,366 496,382 482,374"/>
        <circle cx="496" cy="430" r="10"/>
        <polygon points="485,490 500,498 494,514 480,506"/>
        <circle cx="482" cy="560" r="11"/>
      </g>
      <text x="492" y="610" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#000000">Centura de</text>
      <text x="492" y="626" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#000000">Asteroizi</text>

      <!-- 5. JUPITER -->
      <g transform="translate(595, 385)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <circle cx="0" cy="0" r="64"/>
        <path d="M -58,-26 Q 0,-32 58,-26" fill="none"/>
        <path d="M -63,-8 Q 0,-14 63,-8" fill="none"/>
        <path d="M -63,12 Q 0,18 63,12" fill="none"/>
        <path d="M -55,32 Q 0,38 55,32" fill="none"/>
        <!-- Marea Pată Roșie -->
        <ellipse cx="18" cy="22" rx="18" ry="10"/>
      </g>
      <text x="595" y="474" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#000000">5. Jupiter</text>

      <!-- 6. SATURN (cu sistemul de inele) -->
      <g transform="translate(765, 325)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <ellipse cx="0" cy="0" rx="92" ry="28" transform="rotate(-18)"/>
        <ellipse cx="0" cy="0" rx="74" ry="20" transform="rotate(-18)"/>
        <circle cx="0" cy="0" r="46"/>
        <!-- Arcul din față al inelului -->
        <path d="M -86,28 A 92,28 -18 0,0 86,-28" fill="none" stroke-width="3.5"/>
      </g>
      <text x="765" y="402" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#000000">6. Saturn</text>

      <!-- 7. URANUS (cu inel vertical/înclinat) -->
      <g transform="translate(900, 455)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <ellipse cx="0" cy="0" rx="16" ry="56" transform="rotate(12)"/>
        <circle cx="0" cy="0" r="34"/>
        <path d="M -32,-10 Q 0,-4 32,-10" fill="none"/>
        <path d="M -32,10 Q 0,16 32,10" fill="none"/>
      </g>
      <text x="900" y="534" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="800" fill="#000000">7. Uranus</text>

      <!-- 8. NEPTUN -->
      <g transform="translate(1005, 340)" stroke="#000000" stroke-width="3" fill="#ffffff">
        <circle cx="0" cy="0" r="33"/>
        <ellipse cx="-8" cy="4" rx="10" ry="6"/>
        <path d="M -28,-14 Q 0,-20 28,-12" fill="none"/>
        <path d="M -28,16 Q 0,22 28,14" fill="none"/>
      </g>
      <text x="1005" y="396" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-weight="800" fill="#000000">8. Neptun</text>

      <!-- PLUTO (Planetă Pitică cu inimă) -->
      <g transform="translate(1055, 560)" stroke="#000000" stroke-width="2.8" fill="#ffffff">
        <circle cx="0" cy="0" r="18"/>
        <path d="M 0,8 C -8,2 -10,-6 -4,-8 C 0,-9 0,-3 0,-3 C 0,-3 0,-9 4,-8 C 10,-6 8,2 0,8 Z"/>
      </g>
      <text x="1055" y="596" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#000000">Pluto (Pitică)</text>

      <!-- COMETĂ CU COADĂ -->
      <g transform="translate(650, 175)" stroke="#000000" stroke-width="2.8" fill="#ffffff">
        <path d="M 0,0 Q 95,-35 165,-45 Q 115,-10 170,5 Q 100,10 0,0 Z"/>
        <circle cx="0" cy="0" r="14"/>
      </g>
      <text x="720" y="202" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#000000">Cometă</text>

      <!-- Subsol didactic pe planșă -->
      <text x="560" y="732" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="700" fill="#000000">
        Ordinea de la Soare: Mercur • Venus • Pământ • Marte • (Centura de Asteroizi) • Jupiter • Saturn • Uranus • Neptun • (Centura Kuiper &amp; Pluto)
      </text>
    </svg>`;
  }

  private static renderDecorativeStarsAndSparkles(): string {
    return `<g fill="#ffffff" stroke="#000000" stroke-width="2.2">
      <!-- Stele în 5 colțuri pe care copiii le pot colora în galben/auriu -->
      <polygon points="85,75 93,95 115,95 97,108 104,128 85,115 66,128 73,108 55,95 77,95"/>
      <polygon points="710,85 717,102 735,102 720,112 726,130 710,119 694,130 700,112 685,102 703,102"/>
      <polygon points="95,415 101,430 117,430 104,439 109,455 95,445 81,455 86,439 73,430 89,430"/>
      <polygon points="715,410 721,425 737,425 724,434 729,450 715,440 701,450 706,434 693,425 709,425"/>
      <circle cx="170" cy="65" r="7"/>
      <circle cx="630" cy="60" r="8"/>
      <circle cx="65" cy="245" r="6"/>
      <circle cx="735" cy="255" r="7"/>
    </g>`;
  }

  private static drawSunLineArt(): string {
    const rays: string[] = [];
    for (let i = 0; i < 16; i++) {
      const a1 = (i * Math.PI * 2) / 16;
      const aMid = ((i + 0.5) * Math.PI * 2) / 16;
      const a2 = ((i + 1) * Math.PI * 2) / 16;
      const rIn = 148;
      const rOut = i % 2 === 0 ? 215 : 185;
      const x1 = 400 + Math.cos(a1) * rIn;
      const y1 = 245 + Math.sin(a1) * rIn;
      const xm = 400 + Math.cos(aMid) * rOut;
      const ym = 245 + Math.sin(aMid) * rOut;
      const x2 = 400 + Math.cos(a2) * rIn;
      const y2 = 245 + Math.sin(a2) * rIn;
      rays.push(`<polygon points="${x1.toFixed(1)},${y1.toFixed(1)} ${xm.toFixed(1)},${ym.toFixed(1)} ${x2.toFixed(1)},${y2.toFixed(1)}"/>`);
    }

    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      ${rays.join('\n')}
      <circle cx="400" cy="245" r="148" stroke-width="3.5"/>
      <!-- Bucle magnetice / protuberanțe solare -->
      <path d="M 270,175 C 215,130 235,85 295,125" fill="none" stroke-width="3"/>
      <path d="M 530,175 C 585,130 565,85 505,125" fill="none" stroke-width="3"/>
      <!-- Granulație și pete solare de colorat -->
      <circle cx="345" cy="210" r="22"/>
      <circle cx="345" cy="210" r="9"/>
      <circle cx="455" cy="220" r="18"/>
      <circle cx="455" cy="220" r="7"/>
      <path d="M 335,285 Q 400,325 465,285" fill="none" stroke-width="3.5"/>
    </g>`;
  }

  private static drawCrateredWorldLineArt(radius: number, label: string, withApolloFlag: boolean): string {
    const flagMarkup = withApolloFlag
      ? `<g stroke="#000000" stroke-width="3" fill="#ffffff">
          <line x1="455" y1="115" x2="495" y2="45"/>
          <polygon points="495,45 555,62 535,98 478,80"/>
          <line x1="490" y1="62" x2="540" y2="76"/>
        </g>`
      : '';

    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-label="${label}">
      ${flagMarkup}
      <circle cx="400" cy="245" r="${radius}" stroke-width="3.5"/>
      <ellipse cx="335" cy="185" rx="34" ry="24" transform="rotate(-22 335 185)"/>
      <circle cx="335" cy="185" r="8"/>
      <ellipse cx="455" cy="205" rx="28" ry="22" transform="rotate(18 455 205)"/>
      <ellipse cx="385" cy="285" rx="44" ry="30"/>
      <circle cx="385" cy="285" r="11"/>
      <circle cx="468" cy="295" r="20"/>
      <circle cx="315" cy="265" r="16"/>
      <circle cx="410" cy="145" r="15"/>
    </g>`;
  }

  private static drawVenusLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <circle cx="400" cy="245" r="158" stroke-width="3.5"/>
      <path d="M 262,170 Q 340,135 415,172 T 538,170" fill="none"/>
      <path d="M 245,215 Q 330,255 415,215 T 555,218" fill="none"/>
      <path d="M 243,265 Q 335,230 420,268 T 556,262" fill="none"/>
      <path d="M 265,318 Q 350,350 435,315 T 535,318" fill="none"/>
      <circle cx="345" cy="195" r="16"/>
      <circle cx="465" cy="290" r="18"/>
    </g>`;
  }

  private static drawEarthLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <circle cx="400" cy="245" r="162" stroke-width="3.5"/>
      <!-- Calote polare -->
      <path d="M 310,112 Q 400,132 490,112" fill="none"/>
      <path d="M 315,380 Q 400,360 485,380" fill="none"/>
      <!-- Continente stilizate de colorat -->
      <path d="M 280,175 Q 325,155 345,190 Q 360,220 335,248 Q 355,280 335,330 Q 305,320 295,275 Q 265,230 280,175 Z"/>
      <path d="M 410,155 Q 475,145 515,185 Q 535,225 495,250 Q 485,305 445,325 Q 415,295 425,250 Q 395,210 410,155 Z"/>
      <!-- Nori și Lună mică pe orbită -->
      <circle cx="625" cy="135" r="34"/>
      <circle cx="615" cy="128" r="7"/>
      <circle cx="635" cy="145" r="5"/>
    </g>`;
  }

  private static drawMarsLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <circle cx="400" cy="245" r="156" stroke-width="3.5"/>
      <!-- Calota polară nordică -->
      <path d="M 312,116 Q 400,138 488,116" fill="none"/>
      <!-- Vulcanul gigant Olympus Mons -->
      <polygon points="305,225 348,168 392,225"/>
      <ellipse cx="348" cy="172" rx="11" ry="5"/>
      <!-- Canionul Valles Marineris -->
      <path d="M 335,268 Q 415,285 505,258 Q 425,305 335,268 Z"/>
      <!-- Cratere marțiene -->
      <circle cx="465" cy="195" r="22"/>
      <circle cx="375" cy="332" r="20"/>
      <circle cx="458" cy="325" r="14"/>
    </g>`;
  }

  private static drawJupiterLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <circle cx="400" cy="245" r="168" stroke-width="3.5"/>
      <!-- Benzi de nori jovieni -->
      <path d="M 262,148 L 538,148" fill="none"/>
      <path d="M 240,188 Q 330,178 400,188 T 560,188" fill="none"/>
      <path d="M 233,228 L 567,228" fill="none"/>
      <path d="M 235,272 Q 315,284 405,272 T 565,272" fill="none"/>
      <path d="M 250,318 L 550,318" fill="none"/>
      <path d="M 285,355 L 515,355" fill="none"/>
      <!-- Marea Pată Roșie -->
      <ellipse cx="455" cy="295" rx="44" ry="26"/>
      <ellipse cx="455" cy="295" rx="24" ry="13"/>
    </g>`;
  }

  private static drawSaturnLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <g transform="translate(400, 245) rotate(-18)">
        <!-- Inelele exterioare și diviziunea Cassini -->
        <ellipse cx="0" cy="0" rx="285" ry="82" stroke-width="3.5"/>
        <ellipse cx="0" cy="0" rx="242" ry="68"/>
        <ellipse cx="0" cy="0" rx="198" ry="54"/>
        <!-- Globul lui Saturn -->
        <circle cx="0" cy="0" r="118" stroke-width="3.5"/>
        <path d="M -112,-35 Q 0,-48 112,-35" fill="none"/>
        <path d="M -117,0 Q 0,-12 117,0" fill="none"/>
        <path d="M -112,38 Q 0,26 112,38" fill="none"/>
        <!-- Partea din față a inelelor care trece peste planetă -->
        <path d="M -285,0 A 285,82 0 0,0 285,0" fill="none" stroke-width="3.5"/>
        <path d="M -242,0 A 242,68 0 0,0 242,0" fill="none"/>
        <path d="M -198,0 A 198,54 0 0,0 198,0" fill="none"/>
      </g>
    </g>`;
  }

  private static drawUranusLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <g transform="translate(400, 245) rotate(12)">
        <ellipse cx="0" cy="0" rx="58" ry="210" stroke-width="3"/>
        <ellipse cx="0" cy="0" rx="44" ry="182" stroke-width="2.5"/>
        <circle cx="0" cy="0" r="122" stroke-width="3.5"/>
        <path d="M -35,-116 Q -48,0 -35,116" fill="none"/>
        <path d="M 35,-116 Q 22,0 35,116" fill="none"/>
      </g>
    </g>`;
  }

  private static drawNeptuneLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <circle cx="400" cy="245" r="158" stroke-width="3.5"/>
      <path d="M 255,180 Q 400,160 545,180" fill="none"/>
      <path d="M 242,245 Q 400,225 558,245" fill="none"/>
      <path d="M 255,310 Q 400,290 545,310" fill="none"/>
      <!-- Marea Pată Întunecată -->
      <ellipse cx="355" cy="245" rx="38" ry="22"/>
      <ellipse cx="355" cy="245" rx="20" ry="10"/>
    </g>`;
  }

  private static drawPlutoLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <circle cx="380" cy="245" r="145" stroke-width="3.5"/>
      <!-- Inima lui Pluto (Tombaugh Regio / Sputnik Planitia) -->
      <path d="M 405,335 C 335,285 315,205 365,185 C 395,172 405,215 405,215 C 405,215 415,172 445,185 C 495,205 475,285 405,335 Z" stroke-width="3.5"/>
      <circle cx="305" cy="185" r="18"/>
      <circle cx="295" cy="265" r="14"/>
      <!-- Satelitul Charon -->
      <circle cx="620" cy="155" r="52" stroke-width="3"/>
      <circle cx="605" cy="145" r="10"/>
    </g>`;
  }

  private static drawIoVolcanicLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <!-- Jeturi vulcanice eruptive la marginea discului -->
      <path d="M 330,105 Q 300,45 255,70" fill="none" stroke-width="3"/>
      <path d="M 330,105 Q 355,40 395,65" fill="none" stroke-width="3"/>
      <circle cx="400" cy="255" r="150" stroke-width="3.5"/>
      <circle cx="355" cy="215" r="22"/>
      <circle cx="355" cy="215" r="8"/>
      <circle cx="455" cy="245" r="26"/>
      <circle cx="455" cy="245" r="10"/>
      <circle cx="385" cy="315" r="18"/>
    </g>`;
  }

  private static drawIcyGeyserMoonLineArt(withSouthGeysers: boolean): string {
    const geysers = withSouthGeysers
      ? `<g stroke="#000000" stroke-width="2.8" fill="none">
          <path d="M 375,390 Q 345,455 310,468"/>
          <path d="M 400,395 L 400,472"/>
          <path d="M 425,390 Q 455,455 490,468"/>
        </g>`
      : '';
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      ${geysers}
      <circle cx="400" cy="240" r="152" stroke-width="3.5"/>
      <!-- Fracturi în gheață (lineae / dungi de tigru) -->
      <path d="M 275,165 Q 395,235 515,175" fill="none"/>
      <path d="M 260,245 Q 410,205 535,265" fill="none"/>
      <path d="M 295,315 Q 400,275 505,325" fill="none"/>
      <path d="M 345,105 Q 385,240 445,375" fill="none"/>
    </g>`;
  }

  private static drawDwarfOrMoonLineArt(id: string): string {
    return this.drawCrateredWorldLineArt(150, id.toUpperCase(), false);
  }

  private static drawHaumeaLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <g transform="translate(400, 245) rotate(-15)">
        <ellipse cx="0" cy="0" rx="255" ry="58"/>
        <ellipse cx="0" cy="0" rx="175" ry="105" stroke-width="3.5"/>
        <circle cx="-55" cy="-20" r="18"/>
        <circle cx="48" cy="25" r="22"/>
      </g>
    </g>`;
  }

  private static drawTitanLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <circle cx="400" cy="245" r="165" stroke-width="3" stroke-dasharray="10 6"/>
      <circle cx="400" cy="245" r="145" stroke-width="3.5"/>
      <!-- Lacuri de metan și nori pe Titan -->
      <path d="M 325,175 Q 375,155 415,185 Q 395,215 345,205 Z"/>
      <path d="M 420,255 Q 475,245 495,285 Q 455,320 415,295 Z"/>
      <path d="M 275,245 Q 340,235 390,248" fill="none"/>
    </g>`;
  }

  private static drawAsteroidLineArt(id: string): string {
    return `<g stroke="#000000" stroke-width="3.5" fill="#ffffff" data-asteroid="${id}">
      <path d="M 235,235 C 225,145 315,95 405,112 C 495,95 575,150 565,245 C 578,330 495,385 400,372 C 305,388 242,325 235,235 Z"/>
      <circle cx="335" cy="205" r="32" stroke-width="3"/>
      <circle cx="335" cy="205" r="10" stroke-width="2.5"/>
      <circle cx="465" cy="235" r="38" stroke-width="3"/>
      <circle cx="395" cy="305" r="24" stroke-width="3"/>
      <circle cx="485" cy="165" r="16" stroke-width="2.5"/>
    </g>`;
  }

  private static drawISSLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <!-- Grinda centrală (Integrated Truss Structure) -->
      <rect x="110" y="232" width="580" height="24" rx="4"/>
      <!-- Modulele presurizate centrale -->
      <rect x="368" y="135" width="64" height="220" rx="18" stroke-width="3.5"/>
      <rect x="315" y="212" width="170" height="64" rx="16" stroke-width="3.5"/>
      <circle cx="400" cy="244" r="22"/>
      <!-- Cele 8 aripi solare mari cu grilă fotovoltaică -->
      <g stroke-width="2.5">
        <rect x="130" y="75" width="58" height="145"/>
        <rect x="208" y="75" width="58" height="145"/>
        <rect x="130" y="268" width="58" height="145"/>
        <rect x="208" y="268" width="58" height="145"/>
        <rect x="534" y="75" width="58" height="145"/>
        <rect x="612" y="75" width="58" height="145"/>
        <rect x="534" y="268" width="58" height="145"/>
        <rect x="612" y="268" width="58" height="145"/>
        <!-- Linii interioare pe panourile solare -->
        <line x1="159" y1="75" x2="159" y2="220"/>
        <line x1="237" y1="75" x2="237" y2="220"/>
        <line x1="563" y1="75" x2="563" y2="220"/>
        <line x1="641" y1="75" x2="641" y2="220"/>
      </g>
    </g>`;
  }

  private static drawJWSTLineArt(): string {
    const hexCenters = [
      [0, -76],
      [-66, -38],
      [66, -38],
      [-66, 38],
      [66, 38],
      [0, 76],
      [0, -152],
      [-66, -114],
      [66, -114],
      [-132, -76],
      [132, -76],
      [-132, 0],
      [132, 0],
      [-132, 76],
      [132, 76],
      [-66, 114],
      [66, 114],
      [0, 152],
    ];

    const hexPolys = hexCenters
      .map(([cx, cy]) => {
        const pts: string[] = [];
        const r = 36;
        for (let k = 0; k < 6; k++) {
          const ang = (k * Math.PI) / 3;
          const px = 400 + cx * 0.72 + Math.cos(ang) * r * 0.72;
          const py = 205 + cy * 0.72 + Math.sin(ang) * r * 0.72;
          pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
        return `<polygon points="${pts.join(' ')}"/>`;
      })
      .join('\n');

    return `<g stroke="#000000" stroke-width="2.8" fill="#ffffff">
      <!-- Scutul termic în 5 straturi (romb în baza telescopului) -->
      <polygon points="400,305 665,375 400,445 135,375" stroke-width="3.5"/>
      <polygon points="400,320 630,375 400,430 170,375"/>
      <!-- Cele 18 segmente hexagonale tip fagure ale oglinzii JWST -->
      ${hexPolys}
      <!-- Oglinda secundară în centru -->
      <circle cx="400" cy="205" r="20" stroke-width="3.5"/>
    </g>`;
  }

  private static drawSpaceTelescopeLineArt(isEuclid: boolean): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-euclid="${isEuclid}">
      <!-- Aripi solare -->
      <rect x="145" y="185" width="135" height="120" rx="6"/>
      <line x1="212" y1="185" x2="212" y2="305"/>
      <rect x="520" y="185" width="135" height="120" rx="6"/>
      <line x1="587" y1="185" x2="587" y2="305"/>
      <!-- Tubul cilindric al telescopului -->
      <rect x="315" y="105" width="170" height="275" rx="22" stroke-width="3.5"/>
      <circle cx="400" cy="195" r="52"/>
      <circle cx="400" cy="195" r="20"/>
      <line x1="315" y1="295" x2="485" y2="295"/>
      <!-- Capacul deschis al telescopului -->
      <polygon points="315,115 265,65 395,65 415,105"/>
    </g>`;
  }

  private static drawVoyagerLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      <!-- Brațul lung al magnetometrului și brațul RTG -->
      <line x1="310" y1="265" x2="125" y2="385" stroke-width="4"/>
      <line x1="490" y1="265" x2="645" y2="365" stroke-width="4"/>
      <rect x="615" y="345" width="55" height="32" rx="6"/>
      <!-- Antena parabolică mare (3,7 m) -->
      <ellipse cx="400" cy="215" rx="145" ry="95" stroke-width="3.5"/>
      <ellipse cx="400" cy="215" rx="95" ry="60"/>
      <circle cx="400" cy="215" r="22"/>
      <!-- Bus-ul decagonal și Discul de Aur Voyager -->
      <rect x="330" y="295" width="140" height="68" rx="10" stroke-width="3.5"/>
      <circle cx="400" cy="329" r="24" stroke-width="3"/>
      <circle cx="400" cy="329" r="7"/>
    </g>`;
  }

  private static drawMarsRoverLineArt(withIngenuity: boolean): string {
    const heli = withIngenuity
      ? `<g stroke="#000000" stroke-width="2.8" fill="#ffffff">
          <!-- Elicopterul Ingenuity deasupra roverului -->
          <line x1="540" y1="95" x2="660" y2="95" stroke-width="3.5"/>
          <line x1="555" y1="108" x2="645" y2="108" stroke-width="3.5"/>
          <rect x="582" y="108" width="36" height="34" rx="5"/>
          <line x1="585" y1="142" x2="565" y2="168"/>
          <line x1="615" y1="142" x2="635" y2="168"/>
        </g>`
      : '';

    return `<g stroke="#000000" stroke-width="3" fill="#ffffff">
      ${heli}
      <!-- Orizontul marțian -->
      <path d="M 60,405 Q 250,385 420,405 T 740,398" fill="none" stroke-width="3"/>
      <!-- Catargul și capul SuperCam / Mastcam -->
      <rect x="265" y="135" width="22" height="115"/>
      <rect x="235" y="95" width="82" height="46" rx="8" stroke-width="3.5"/>
      <circle cx="262" cy="118" r="12"/>
      <circle cx="295" cy="118" r="8"/>
      <!-- Șasiul roverului -->
      <rect x="225" y="245" width="285" height="82" rx="12" stroke-width="3.5"/>
      <!-- Cele 6 roți marțiene -->
      <circle cx="255" cy="368" r="38" stroke-width="3.5"/>
      <circle cx="255" cy="368" r="16"/>
      <circle cx="368" cy="368" r="38" stroke-width="3.5"/>
      <circle cx="368" cy="368" r="16"/>
      <circle cx="480" cy="368" r="38" stroke-width="3.5"/>
      <circle cx="480" cy="368" r="16"/>
    </g>`;
  }

  private static drawDeepSpaceProbeLineArt(id: string): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-probe="${id}">
      <rect x="115" y="215" width="185" height="65" rx="6"/>
      <rect x="500" y="215" width="185" height="65" rx="6"/>
      <polygon points="400,115 485,195 455,345 345,345 315,195" stroke-width="3.5"/>
      <circle cx="400" cy="235" r="46"/>
      <circle cx="400" cy="235" r="16"/>
    </g>`;
  }

  /**
   * Galaxie Spirală (Calea Lactee cu săgeata "📍 AICI SUNTEM NOI" sau Galaxia Andromeda M31)
   */
  private static drawSpiralGalaxyLineArt(withHereWeAreArrow: boolean): string {
    const arrowMarkup = withHereWeAreArrow
      ? `<g stroke="#000000" stroke-width="3" fill="#ffffff">
          <circle cx="535" cy="285" r="14" stroke-width="3.5"/>
          <circle cx="535" cy="285" r="5" fill="#000000"/>
          <line x1="635" y1="365" x2="552" y2="298" stroke-width="3.5"/>
          <polygon points="548,295 568,298 556,314" fill="#000000"/>
          <rect x="485" y="370" width="285" height="52" rx="10" fill="#ffffff" stroke="#000000" stroke-width="3"/>
          <text x="627" y="394" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#000000">📍 AICI SUNTEM NOI!</text>
          <text x="627" y="413" text-anchor="middle" font-family="Arial, sans-serif" font-size="11" font-weight="700" fill="#000000">Brațul Orion (Sistemul Solar)</text>
        </g>`
      : `<g stroke="#000000" stroke-width="2.8" fill="#ffffff">
          <ellipse cx="195" cy="145" rx="38" ry="18" transform="rotate(-20 195 145)"/>
          <circle cx="195" cy="145" r="7"/>
          <text x="195" y="182" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#000000">Galaxie Satelit M32</text>
        </g>`;

    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-galaxy="${withHereWeAreArrow ? 'milky_way' : 'andromeda'}">
      <g transform="translate(390, 235) rotate(-14)">
        <!-- Haloul și discul galactic exterior -->
        <ellipse cx="0" cy="0" rx="285" ry="132" stroke-dasharray="10 7" stroke-width="2.5"/>
        <!-- Cele 4 brațe spirale galactice de colorat -->
        <path d="M 45,0 C 95,-65 195,-75 265,-15" fill="none" stroke-width="3.5"/>
        <path d="M 28,22 C 85,78 185,95 255,42" fill="none" stroke-width="3"/>
        <path d="M -45,0 C -95,65 -195,75 -265,15" fill="none" stroke-width="3.5"/>
        <path d="M -28,-22 C -85,-78 -185,-95 -255,-42" fill="none" stroke-width="3"/>
        <path d="M 0,32 C -65,92 -165,112 -225,75" fill="none" stroke-width="2.8"/>
        <path d="M 0,-32 C 65,-92 165,-112 225,-75" fill="none" stroke-width="2.8"/>
        <!-- Bara și nucleul galactic strălucitor -->
        <ellipse cx="0" cy="0" rx="86" ry="38" stroke-width="3.5"/>
        <circle cx="0" cy="0" r="24" stroke-width="3.5"/>
        <!-- Roiuri stelare pe brațele spirale -->
        <circle cx="125" cy="-42" r="8"/>
        <circle cx="-135" cy="45" r="9"/>
        <circle cx="-110" cy="-52" r="7"/>
        <circle cx="155" cy="52" r="8"/>
      </g>
      ${arrowMarkup}
    </g>`;
  }

  /**
   * Sistemul Exoplanetar TRAPPIST-1 (steaua centrală ultra-rece + cele 7 planete stâncoase b, c, d, e, f, g, h)
   */
  private static drawTrappistExoplanetSystemLineArt(isSevenPlanetTrappist: boolean): string {
    if (!isSevenPlanetTrappist) {
      return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-system="proxima_centauri">
        <!-- Steaua pitică roșie Proxima Centauri -->
        <circle cx="235" cy="245" r="86" stroke-width="3.5"/>
        <circle cx="210" cy="220" r="14"/>
        <path d="M 185,275 Q 235,305 285,275" fill="none" stroke-width="3"/>
        <text x="235" y="362" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#000000">STEAUA PROXIMA CENTAURI</text>
        <!-- Orbita și Exoplaneta Proxima Centauri b -->
        <ellipse cx="235" cy="245" rx="320" ry="135" fill="none" stroke-dasharray="9 7" stroke-width="2.5"/>
        <circle cx="555" cy="245" r="46" stroke-width="3.5"/>
        <path d="M 525,232 Q 555,215 585,235 Q 565,265 525,232 Z"/>
        <text x="555" y="318" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="900" fill="#000000">EXOPLANETA PROXIMA b (4,24 a.l.)</text>
      </g>`;
    }

    const planets = [
      { label: 'b', x: 205, y: 245, r: 16 },
      { label: 'c', x: 268, y: 215, r: 17 },
      { label: 'd', x: 332, y: 265, r: 14 },
      { label: 'e (Zonă Locuibilă)', x: 408, y: 225, r: 19 },
      { label: 'f', x: 492, y: 262, r: 20 },
      { label: 'g', x: 578, y: 222, r: 22 },
      { label: 'h', x: 665, y: 255, r: 15 },
    ];

    const planetNodes = planets
      .map(
        (p, idx) => `
        <path d="M 115,${150 - idx * 12} A ${95 + idx * 88},${95 + idx * 42} 0 0,1 115,${340 + idx * 12}" fill="none" stroke="#000000" stroke-width="1.8" stroke-dasharray="6 6"/>
        <circle cx="${p.x}" cy="${p.y}" r="${p.r}" fill="#ffffff" stroke="#000000" stroke-width="3"/>
        <text x="${p.x}" y="${p.y + p.r + 22}" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="800" fill="#000000">${p.label}</text>
      `
      )
      .join('\n');

    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-system="trappist1">
      <!-- Zona Locuibilă (Habitable Zone) marcată punctat -->
      <rect x="372" y="95" width="235" height="305" rx="14" fill="none" stroke="#000000" stroke-width="2.2" stroke-dasharray="8 6"/>
      <text x="490" y="118" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="#000000">💧 ZONA LOCUIBILĂ (e, f, g)</text>
      <!-- Steaua TRAPPIST-1 în stânga -->
      <circle cx="115" cy="245" r="54" stroke-width="3.5"/>
      <circle cx="102" cy="230" r="9"/>
      <circle cx="128" cy="260" r="11"/>
      <text x="115" y="325" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="900" fill="#000000">TRAPPIST-1</text>
      <!-- Cele 7 planete stâncoase de mărimea Pământului -->
      ${planetNodes}
    </g>`;
  }

  /**
   * Exoplaneta 55 Cancri e ("Planeta de Lavă și Diamant")
   */
  private static drawLavaDiamondExoplanetLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-exoplanet="cancri55e">
      <circle cx="400" cy="240" r="154" stroke-width="3.5"/>
      <!-- Râuri de lavă pe emisfera de zi -->
      <path d="M 275,180 Q 355,215 410,165 T 525,195" fill="none" stroke-width="3.5"/>
      <path d="M 255,250 Q 345,285 425,240 T 545,265" fill="none" stroke-width="3.5"/>
      <!-- Cristale de diamant stilizate în manta -->
      <polygon points="400,275 432,315 400,355 368,315" stroke-width="3"/>
      <polygon points="325,205 348,232 325,260 302,232" stroke-width="2.8"/>
      <polygon points="475,205 498,232 475,260 452,232" stroke-width="2.8"/>
    </g>`;
  }

  /**
   * Gaura Neagră Supermasivă Sagittarius A* cu Orizontul Evenimentelor și Discul de Acreție Relativist
   */
  private static drawBlackHoleAccretionLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-blackhole="sagittarius_a">
      <!-- Arcul superior și inferior al lentilei gravitaționale (Einstein Ring) -->
      <path d="M 210,235 A 190,155 0 0,1 590,235" fill="none" stroke-width="3.5"/>
      <path d="M 235,235 A 165,128 0 0,1 565,235" fill="none" stroke-width="2.5" stroke-dasharray="10 6"/>
      <path d="M 225,255 A 175,135 0 0,0 575,255" fill="none" stroke-width="3"/>
      <!-- Discul de acreție în vârtej (planul ecuatorial) -->
      <ellipse cx="400" cy="245" rx="295" ry="68" stroke-width="3.5"/>
      <ellipse cx="400" cy="245" rx="245" ry="52" stroke-width="2.8"/>
      <ellipse cx="400" cy="245" rx="192" ry="38" stroke-width="2.5" stroke-dasharray="12 6"/>
      <!-- Orizontul Evenimentelor și Umbra Găurii Negre în centru -->
      <circle cx="400" cy="245" r="88" fill="#ffffff" stroke="#000000" stroke-width="4"/>
      <circle cx="400" cy="245" r="68" fill="#000000"/>
      <!-- Etichete didactice pentru copii -->
      <text x="400" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="#ffffff" stroke="none">ORIZONTUL EVENIMENTELOR</text>
      <text x="400" y="65" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="800" fill="#000000">DISCUL DE ACREȚIE &amp; LENTILA GRAVITAȚIONALĂ</text>
    </g>`;
  }

  /**
   * Norul lui Oort (Sfera uriașă de comete înghețate la 1 an-lumină în jurul Soarelui)
   */
  private static drawOortCloudLineArt(): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-oort="oort_cloud">
      <circle cx="400" cy="245" r="195" fill="none" stroke-width="3.5" stroke-dasharray="12 8"/>
      <circle cx="400" cy="245" r="145" fill="none" stroke-width="2.5" stroke-dasharray="8 8"/>
      <!-- Soarele minuscul în centru -->
      <circle cx="400" cy="245" r="22" stroke-width="3.5"/>
      <text x="400" y="286" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" font-weight="900" fill="#000000">☀️ SISTEMUL SOLAR</text>
      <!-- Comete înghețate în Norul lui Oort -->
      <circle cx="245" cy="145" r="12"/>
      <path d="M 245,145 L 195,115" fill="none"/>
      <circle cx="555" cy="150" r="12"/>
      <path d="M 555,150 L 605,120" fill="none"/>
      <circle cx="255" cy="340" r="12"/>
      <path d="M 255,340 L 200,375" fill="none"/>
      <circle cx="545" cy="345" r="12"/>
      <path d="M 545,345 L 600,380" fill="none"/>
    </g>`;
  }

  /**
   * Comparație Stelară: Supergiganta Betelgeuse vs Soare sau Sirius A & Pitica Albă Sirius B
   */
  private static drawStarComparisonLineArt(isBetelgeuse: boolean): string {
    if (isBetelgeuse) {
      return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-star="betelgeuse">
        <circle cx="345" cy="245" r="172" stroke-width="3.5" stroke-dasharray="14 6"/>
        <circle cx="345" cy="245" r="156" stroke-width="3.5"/>
        <circle cx="295" cy="205" r="28"/>
        <circle cx="395" cy="275" r="34"/>
        <text x="345" y="248" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#000000">SUPERGIGANTA BETELGEUSE</text>
        <!-- Soarele nostru pentru comparație -->
        <circle cx="635" cy="245" r="16" stroke-width="3"/>
        <text x="635" y="282" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#000000">☀️ SOARELE NOSTRU</text>
      </g>`;
    }
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-star="sirius">
      <circle cx="330" cy="245" r="135" stroke-width="3.5"/>
      <text x="330" y="250" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" font-weight="900" fill="#000000">SIRIUS A</text>
      <circle cx="595" cy="215" r="24" stroke-width="3.5"/>
      <text x="595" y="262" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" font-weight="900" fill="#000000">PITICA ALBĂ SIRIUS B</text>
    </g>`;
  }

  /**
   * Roiul Stelar Pleiadele ("Cloșca cu Pui" — Cele 7 Surori)
   */
  private static drawPleiadesClusterLineArt(): string {
    const stars = [
      [250, 210, 28, 'Alcyone'],
      [355, 165, 24, 'Atlas'],
      [455, 185, 22, 'Electra'],
      [535, 235, 24, 'Maia'],
      [465, 295, 22, 'Merope'],
      [345, 290, 22, 'Taygeta'],
      [285, 325, 20, 'Pleione'],
    ] as const;

    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-cluster="pleiades">
      <path d="M 185,235 Q 290,110 430,145 Q 595,160 595,265 Q 545,365 385,355 Q 205,365 185,235 Z" fill="none" stroke-dasharray="10 7"/>
      ${stars
        .map(
          ([cx, cy, r, name]) => `
        <polygon points="${cx},${cy - r} ${cx + r * 0.3},${cy - r * 0.3} ${cx + r},${cy} ${cx + r * 0.3},${cy + r * 0.3} ${cx},${cy + r} ${cx - r * 0.3},${cy + r * 0.3} ${cx - r},${cy} ${cx - r * 0.3},${cy - r * 0.3}"/>
        <text x="${cx}" y="${cy + r + 18}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" font-weight="800" fill="#000000">${name}</text>
      `
        )
        .join('\n')}
    </g>`;
  }

  /**
   * Nebuloasă Cosmică (Stâlpii Creației M16 sau Nebuloasa Orion M42)
   */
  private static drawCosmicNebulaLineArt(isPillars: boolean): string {
    return `<g stroke="#000000" stroke-width="3" fill="#ffffff" data-nebula="${isPillars ? 'pillars' : 'orion'}">
      <path d="M 215,395 C 210,285 235,155 275,125 C 315,155 320,265 335,345 C 355,235 375,105 415,95 C 455,115 462,245 475,345 C 495,255 515,165 550,155 C 585,175 590,295 585,395 Z" stroke-width="3.5"/>
      <circle cx="275" cy="112" r="10"/>
      <circle cx="415" cy="82" r="12"/>
      <circle cx="550" cy="142" r="10"/>
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

export function generateBodyColoringSvg(bodyId: string, titleRo: string = ''): string {
  return ColoringSvgGenerator.generateBodyColoringSvg(bodyId, titleRo);
}

export function generateSolarSystemColoringSvg(): string {
  return ColoringSvgGenerator.generateSolarSystemColoringSvg();
}


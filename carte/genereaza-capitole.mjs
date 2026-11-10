// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Generator pentru cartea didactică LaTeX „Orbitar — Enciclopedia Cosmică Ilustrată”.
 * Citește bazele de date oficiale din ../public/data/ și generează fișierul principal
 * `orbitar-carte.tex` împreună cu capitolele modulare din `capitole/*.tex`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const CARTE_DIR = __dirname;
const CAPITOLE_DIR = path.join(CARTE_DIR, 'capitole');

fs.mkdirSync(CAPITOLE_DIR, { recursive: true });

const solarData = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'public/data/solar-system-ro.json'), 'utf8')
);
const missionsData = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'public/data/missions-ro.json'), 'utf8')
);
const deepSpaceData = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'public/data/deep-space-ro.json'), 'utf8')
);
const tleData = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'public/data/tle-iss.json'), 'utf8')
);
const pkgData = JSON.parse(
  fs.readFileSync(path.join(ROOT_DIR, 'package.json'), 'utf8')
);

/**
 * Convertește un șir UTF-8 în cod LaTeX sigur, păstrând diacriticele românești
 * și transformând simbolurile matematice/științifice speciale.
 */
export function texEscape(str) {
  if (str === null || str === undefined) return '';
  let s = String(str);
  // Înlocuim mai întâi backslash-ul dacă ar exista
  s = s.replace(/\\/g, '\\textbackslash{}');
  // Caractere speciale LaTeX
  s = s.replace(/&/g, '\\&');
  s = s.replace(/%/g, '\\%');
  s = s.replace(/\$/g, '\\$');
  s = s.replace(/#/g, '\\#');
  s = s.replace(/_/g, '\\_');
  s = s.replace(/\{/g, '\\{');
  s = s.replace(/\}/g, '\\}');
  s = s.replace(/\^/g, '\\textasciicircum{}');
  s = s.replace(/~/g, '$\\sim$');
  // Simboluri Unicode științifice și tipografice
  s = s.replace(/×/g, '$\\times$');
  s = s.replace(/°/g, '$^\\circ$');
  s = s.replace(/¹/g, '$^1$');
  s = s.replace(/²/g, '$^2$');
  s = s.replace(/³/g, '$^3$');
  s = s.replace(/₂/g, '$_2$');
  s = s.replace(/₃/g, '$_3$');
  s = s.replace(/₄/g, '$_4$');
  s = s.replace(/☉/g, '$_\\odot$');
  s = s.replace(/ʻ/g, "'");
  s = s.replace(/„/g, '\\quotedblbase{}');
  s = s.replace(/”/g, '\\textquotedblright{}');
  s = s.replace(/«/g, '\\guillemotleft{}');
  s = s.replace(/»/g, '\\guillemotright{}');
  s = s.replace(/—/g, '---');
  s = s.replace(/–/g, '--');
  return s;
}

export function fmtNum(n, decimals = null) {
  if (n === null || n === undefined || !Number.isFinite(Number(n))) return '-';
  const val = Number(n);
  if (decimals !== null) {
    return val.toFixed(decimals).replace('.', ',');
  }
  return val.toLocaleString('ro-RO');
}

const RO_WORD_END = '(?![a-zA-ZăâîșțĂÂÎȘȚ0-9])';

function numNeedsDe(numStr) {
  if (numStr.includes(',')) return false;
  const clean = numStr.replace(/\./g, '').split(/[–-]/).pop();
  const n = parseInt(clean, 10);
  if (Number.isNaN(n) || n === 0) return false;
  const mod100 = n % 100;
  return n >= 20 && (mod100 === 0 || mod100 >= 20);
}

const SPECIFIC_DASH_REPLACEMENTS = [
  [
    'Venus are aproape aceeași mărime ca Pământul — ca două portocale așezate una lângă alta!',
    'Venus are aproape aceeași mărime ca Pământul, asemenea a două portocale așezate una lângă alta!',
  ],
  [
    'Marte este cam pe jumătate cât Pământul — dacă Pământul e o portocală, Marte e o caisă roșiatică!',
    'Marte este cam pe jumătate cât Pământul: dacă Pământul ar fi o portocală, Marte ar fi o caisă roșiatică!',
  ],
  [
    'Neptun este de 30 de ori mai departe de Soare decât Pământul — acolo Soarele pare doar o stea foarte strălucitoare!',
    'Neptun este de 30 de ori mai departe de Soare decât Pământul, astfel că acolo Soarele pare doar o stea foarte strălucitoare!',
  ],
  [
    'Luna se rotește în jurul axei sale în exact 27,3 zile — același timp în care înconjoară Pământul.',
    'Luna se rotește în jurul axei sale în exact 27,3 zile, adică în același timp în care înconjoară Pământul.',
  ],
  [
    'orbitează la numai 6.000 km deasupra suprafeței marțiene — mai aproape de planeta sa decât orice alt satelit natural din Sistemul Solar.',
    'orbitează la numai 6.000 de kilometri deasupra suprafeței marțiene, fiind mai aproape de planeta sa decât orice alt satelit natural din Sistemul Solar.',
  ],
  [
    'Craterul Herschel are 139 km diametru — o treime din diametrul întregului satelit!',
    'Craterul Herschel are 139 de kilometri în diametru, ceea ce reprezintă o treime din diametrul întregului satelit!',
  ],
  [
    'Tethys este mai ușoară decât apa — dacă ai găsi un ocean destul de mare, Tethys ar pluti pe el ca un cub de gheață!',
    'Tethys este mai ușoară decât apa, astfel că dacă ai găsi un ocean destul de mare, Tethys ar pluti pe el ca un cub de gheață!',
  ],
  [
    'Rhea are un diametru de peste 1.500 de kilometri — este de aproape trei ori mai lată decât România!',
    'Rhea are un diametru de peste 1.500 de kilometri, fiind de aproape trei ori mai lată decât România!',
  ],
  [
    'Munții de la ecuatorul lui Iapetus au 20 de kilometri înălțime — mai mult decât dublul vârfului Everest de pe Pământ!',
    'Munții de la ecuatorul lui Iapetus au 20 de kilometri înălțime, depășind de peste două ori înălțimea vârfului Everest de pe Pământ!',
  ],
  [
    'Stânca Verona Rupes are 20 de kilometri înălțime — este cea mai înaltă prăpastie din întregul Sistem Solar!',
    'Stânca Verona Rupes are 20 de kilometri înălțime și este cea mai înaltă prăpastie din întregul Sistem Solar!',
  ],
  [
    'poartă numele unui personaj din piesele lui William Shakespeare — Regina Zânelor!',
    'poartă numele unui personaj din piesele lui William Shakespeare, și anume Regina Zânelor!',
  ],
  [
    'un munte uriaș care se înalță la 11 kilometri deasupra orizontului — mai înalt decât muntele Everest!',
    'un munte uriaș care se înalță la 11 kilometri deasupra orizontului, fiind mai înalt decât muntele Everest!',
  ],
  [
    'Triton este singura lună mare din Sistemul Solar care merge «pe contrasens» — se învârte în jurul lui Neptun în sens invers față de rotația planetei!',
    'Triton este singura lună mare din Sistemul Solar care merge «pe contrasens» și se învârte în jurul lui Neptun în sens invers față de rotația planetei!',
  ],
  [
    'Pluto și Charon se rotesc în jurul axelor lor în exact 6,387 zile — aceeași durată în care orbitează în jurul baricentrului lor comun.',
    'Pluto și Charon se rotesc în jurul axelor lor în exact 6,387 zile, având exact aceeași durată în care orbitează în jurul baricentrului lor comun.',
  ],
  [
    'Pluto este mai mic chiar și decât Luna noastră — cam cât jumătate din lățimea Europei!',
    'Pluto este mai mic chiar și decât Luna noastră, măsurând cam cât jumătate din lățimea Europei!',
  ],
  [
    'Pe 13 aprilie 2029, Apophis va trece în deplină siguranță la doar 32.000 km de Pământ — mai aproape decât unii sateliți TV!',
    'Pe 13 aprilie 2029, Apophis va trece în deplină siguranță la doar 32.000 de kilometri de Pământ, adică mai aproape decât unii sateliți de televiziune!',
  ],
  [
    'am trimis o sondă spațială să viziteze un nucleu direct în spațiu — pe Psyche!',
    'am trimis o sondă spațială să viziteze un nucleu planetar direct în spațiu, pe asteroidul Psyche!',
  ],
  [
    'A plecat de pe Pământ mai repede decât orice altă rachetă — a trecut de orbita Lunii în doar 9 ore',
    'A plecat de pe Pământ mai repede decât orice altă rachetă și a trecut de orbita Lunii în doar 9 ore',
  ],
  [
    'Atinge viteza incredibilă de 690.000 km/h — cu această viteză ai ajunge de la București la Oradea în mai puțin de 3 secunde!',
    'Atinge viteza incredibilă de 690.000 de kilometri pe oră, viteză cu care ai ajunge de la București la Oradea în mai puțin de 3 secunde!',
  ],
  [
    'Aripile solare ale sondei Rosetta erau lungi de 32 de metri — cât o balenă albastră!',
    'Aripile solare ale sondei Rosetta erau lungi de 32 de metri, având lungimea unei balene albastre!',
  ],
  [
    'cântărește doar 1,8 kg — cât o cutie mare de lapte!',
    'cântărește doar 1,8 kilograme, cam cât o cutie mare de lapte!',
  ],
  [
    'El marchează limita sferei Hill a Sistemului Solar — frontiera până la care gravitația Soarelui mai poate reține obiecte pe orbită.',
    'El marchează limita sferei Hill a Sistemului Solar, adică frontiera până la care gravitația Soarelui mai poate reține obiecte pe orbită.',
  ],
  [
    'Acesta este Norul lui Oort — casa din care pornesc spre noi cometele cu coadă lungă și strălucitoare!',
    'Acesta este Norul lui Oort, regiunea îndepărtată din care pornesc spre noi cometele cu coadă lungă și strălucitoare!',
  ],
  [
    'în jurul ei se învârte Proxima Centauri b — cea mai apropiată exoplanetă (planetă din afara Sistemului Solar) de Pământ!',
    'în jurul ei se învârte Proxima Centauri b, care este cea mai apropiată exoplanetă (planetă din afara Sistemului Solar) de Pământ!',
  ],
  [
    'a plecat acum mai bine de 4 ani și 3 luni — când erai cu 4 clase mai mic!',
    'a plecat acum mai bine de 4 ani și 3 luni, pe când erai cu patru ani mai mic!',
  ],
  [
    'De fapt, Sirius ascunde un secret — nu este o singură stea, ci două stele care dansează împreună!',
    'De fapt, Sirius ascunde un secret fascinant, întrucât nu este o singură stea, ci un sistem binar format din două stele care orbitează împreună!',
  ],
  [
    'ar cântări pe Pământ aproximativ 5 tone — cât un elefant african matur!',
    'ar cântări pe Pământ aproximativ 5 tone, adică tot atât cât un elefant african matur!',
  ],
  [
    'a plecat acum 8,6 ani — pe vremea când mulți dintre elevii de azi abia învățau să meargă!',
    'a plecat spre Pământ acum 8,6 ani!',
  ],
  [
    'Sirius B este o pitică albă — nucleul dens rămas dintr-o stea străveche',
    'Sirius B este o pitică albă, reprezentând nucleul dens rămas dintr-o stea străveche',
  ],
  [
    'acum 100 de milioane de ani — pe când pe Pământ încă se plimbau dinozaurii!',
    'acum 100 de milioane de ani, în epoca în care pe Pământ încă trăiau dinozaurii!',
  ],
  [
    'a plecat acum 444 de ani — în anul 1582, pe vremea lui Mihai Viteazul!',
    'a plecat acum 444 de ani, în anul 1582, pe vremea lui Mihai Viteazul!',
  ],
  [
    'a plecat acum 640 de ani — în anul 1386, chiar în anul în care a început domnia lui Mircea cel Bătrân',
    'a plecat acum 640 de ani, în anul 1386, chiar în anul în care a început domnia lui Mircea cel Bătrân',
  ],
  [
    'Nebuloasa Orion măsoară 24 de ani-lumină de la un capăt la altul — de 24 de ori mai lată decât întregul Sistem Solar cu Norul lui Oort!',
    'Nebuloasa Orion măsoară 24 de ani-lumină de la un capăt la altul și este de 24 de ori mai lată decât întregul Sistem Solar împreună cu Norul lui Oort!',
  ],
  [
    'Cel mai înalt stâlp are o lungime de ~4–5 ani-lumină — cât distanța de la Soarele nostru până la cea mai apropiată stea, Proxima Centauri!',
    'Cel mai înalt stâlp are o lungime de aproximativ 4–5 ani-lumină, egală cu distanța de la Soarele nostru până la cea mai apropiată stea, Proxima Centauri!',
  ],
  [
    '(orizontul evenimentelor — limita dincolo de care viteza de evadare depășește viteza luminii)',
    '(orizontul evenimentelor, adică limita dincolo de care viteza de evadare depășește viteza luminii)',
  ],
  [
    'a plecat acum 26.000 de ani — din Epoca de Gheață, când oamenii preistorici pictau peșterile și pe Pământ trăiau mamuții!',
    'a plecat acum 26.000 de ani, în timpul Epocii de Gheață, când oamenii preistorici pictau peșterile și pe Pământ trăiau mamuții!',
  ],
  [
    'Calea Lactee este marea noastră casă din Univers — un oraș cosmic în formă de morișcă spiralată',
    'Calea Lactee este marea noastră casă din Univers, un imens disc cosmic în formă de morișcă spiralată',
  ],
  [
    '(„un an galactic”) — ultima dată când am fost în același loc pe orbită, primii dinozauri abia apăreau pe Pământ!',
    '(numit „un an galactic”), astfel că ultima dată când Sistemul Solar s-a aflat în același loc pe orbită, primii dinozauri abia apăreau pe Pământ!',
  ],
  [
    'la doar câțiva metri distanță — iar lumina de la ea călătorește spre noi de 2,5 milioane de ani!',
    'la doar câțiva metri distanță, iar lumina de la ea călătorește spre noi timp de 2,5 milioane de ani!',
  ],
  [
    'un bilion) de stele — este chiar mai mare decât Calea Lactee!',
    'un bilion) de stele și este chiar mai mare decât Calea Lactee!',
  ],
  [
    'a plecat acum 2,5 milioane de ani — de la începutul Cuaternarului',
    'a plecat acum 2,5 milioane de ani, de la începutul Cuaternarului',
  ],
  [
    'ne-a arătat aici „Stâncile Cosmice” — creste înalte de 7 ani-lumină în care se aprind mii de stele noi!',
    'ne-a arătat aici „Stâncile Cosmice”, creste înalte de 7 ani-lumină în care se aprind mii de stele noi!',
  ],
  [
    'Nebuloasa Carina se întinde pe ~300 de ani-lumină — este de peste 10 ori mai mare decât Nebuloasa Orion!',
    'Nebuloasa Carina se întinde pe aproximativ 300 de ani-lumină și este de peste 10 ori mai mare decât Nebuloasa Orion!',
  ],
  [
    'Inelul luminos principal are un diametru de ~1,3 ani-lumină — de peste 400 de ori mai lat decât orbita planetei Neptun în jurul Soarelui!',
    'Inelul luminos principal are un diametru de aproximativ 1,3 ani-lumină, fiind de peste 400 de ori mai lat decât orbita planetei Neptun în jurul Soarelui!',
  ],
  [
    'a plecat spre noi acum 2.300 de ani — pe vremea vechilor daci și a marelui matematician Arhimede!',
    'a plecat spre noi acum 2.300 de ani, pe vremea vechilor daci și a marelui matematician Arhimede!',
  ],
  [
    'conține ~40.000 de noduri cometare — condensări dense de gaz molecular',
    'conține aproximativ 40.000 de noduri cometare, care sunt condensări dense de gaz molecular',
  ],
  [
    'are propriii ei „sateliți” — galaxii mai mici care o însoțesc prin Univers!',
    'are propriii ei „sateliți”, adică galaxii mai mici care o însoțesc prin Univers!',
  ],
  [
    'se află „Nebuloasa Tarantula” — o maternitate de stele atât de strălucitoare',
    'se află „Nebuloasa Tarantula”, o maternitate de stele atât de strălucitoare',
  ],
  [
    'a plecat spre noi acum 160.000 de ani — pe când primii oameni moderni trăiau în Africa!',
    'a plecat spre noi acum 160.000 de ani, pe vremea când primii oameni moderni trăiau în Africa!',
  ],
  [
    'a plecat acum 23,5 milioane de ani — din epoca Miocenului',
    'a plecat acum 23,5 milioane de ani, în epoca Miocenului',
  ],
  [
    'din câte sute de mii de stele fiecare) — de zece ori mai multe decât are Calea Lactee!',
    'din câte sute de mii de stele fiecare), adică de zece ori mai multe decât are Calea Lactee!',
  ],
  [
    'a plecat spre Pământ acum peste 29 de milioane de ani — din epoca Oligocenului!',
    'a plecat spre Pământ acum peste 29 de milioane de ani, din epoca Oligocenului!',
  ],
];

/**
 * Rafinează textul în proză: elimină cratimele duble/em-dash-urile din mijlocul frazei
 * și înlocuiește abrevierile „km” / „m” / „cm” / „kg” cu formele desfășurate („kilometri” etc.).
 */
function refineProse(rawText) {
  if (!rawText) return '';
  let res = String(rawText);
  for (const [fromStr, toStr] of SPECIFIC_DASH_REPLACEMENTS) {
    if (res.includes(fromStr)) {
      res = res.split(fromStr).join(toStr);
    }
  }
  res = res.replace(/\s*—\s*/g, ', ');
  res = res.replace(/~(\d)/g, 'aproximativ $1');
  res = res.replace(/\baprox\.\s*/g, 'aproximativ ');
  res = res.replace(
    new RegExp('(\\d[\\d.]*)\\s+(milioane|miliarde|mii)' + RO_WORD_END, 'g'),
    (_, num, unit) => `${num} ${numNeedsDe(num) ? 'de ' + unit : unit}`
  );
  res = res.replace(
    new RegExp('\\bmilioane\\s+km' + RO_WORD_END, 'g'),
    'milioane de kilometri'
  );
  res = res.replace(
    new RegExp('\\bmiliarde\\s+km' + RO_WORD_END, 'g'),
    'miliarde de kilometri'
  );
  res = res.replace(new RegExp('\\bmii\\s+km' + RO_WORD_END, 'g'), 'mii de kilometri');
  res = res.replace(new RegExp('\\bkm/s' + RO_WORD_END, 'g'), 'kilometri pe secundă');
  res = res.replace(new RegExp('\\bkm/h' + RO_WORD_END, 'g'), 'kilometri pe oră');
  res = res.replace(/km²/g, 'kilometri pătrați');
  res = res.replace(/m²/g, 'metri pătrați');
  res = res.replace(/m\/s²/g, 'metri pe secundă la pătrat');
  res = res.replace(/\b(\d+)\s*m\/pixel\b/g, (_, num) => {
    return `${num} ${numNeedsDe(num) ? 'de metri' : 'metri'} pe pixel`;
  });
  res = res.replace(new RegExp('\\bde\\s+km' + RO_WORD_END, 'g'), 'de kilometri');
  res = res.replace(new RegExp('\\bde\\s+m' + RO_WORD_END, 'g'), 'de metri');
  res = res.replace(new RegExp('\\bde\\s+cm' + RO_WORD_END, 'g'), 'de centimetri');
  res = res.replace(new RegExp('\\bde\\s+kg' + RO_WORD_END, 'g'), 'de kilograme');

  res = res.replace(new RegExp('(\\d[\\d.,–-]*)\\s+km' + RO_WORD_END, 'g'), (_, num) => {
    return `${num} ${numNeedsDe(num) ? 'de kilometri' : 'kilometri'}`;
  });
  res = res.replace(
    new RegExp('(\\d[\\d.,–-]*)\\s+m' + RO_WORD_END + '(?![/.])', 'g'),
    (_, num) => {
      return `${num} ${numNeedsDe(num) ? 'de metri' : 'metri'}`;
    }
  );
  res = res.replace(new RegExp('(\\d[\\d.,–-]*)\\s+cm' + RO_WORD_END, 'g'), (_, num) => {
    return `${num} ${numNeedsDe(num) ? 'de centimetri' : 'centimetri'}`;
  });
  res = res.replace(new RegExp('(\\d[\\d.,–-]*)\\s+kg' + RO_WORD_END, 'g'), (_, num) => {
    return `${num} ${numNeedsDe(num) ? 'de kilograme' : 'kilograme'}`;
  });
  return texEscape(res);
}

const VERB_START_RE =
  /^(Transmite|Generează|Găzduiește|Ocupă|Conține|Reflectă|Mențin|Menține|Măsoară|Determină|A măsurat|A descoperit|Au cartografiat|Asigură|Se retrag|Au detectat|Poate|Vor măsura|A produs|Identifică|Permite|Susține|Constituie|Reprezintă)(?=\s)/;

const CLAUSE_START_RE =
  /^(Curenții|La presiuni|Metanul|La adâncimi|Contactul|Modelele|Craterele sunt|Praful|Când interiorul|Spre deosebire|Petele|Radiația|Ocultațiile|121,6 grame|Forțele|Presiunile|Oceanele și straturile)(?=\s)/;

function lowerFirstForClause(str) {
  if (!str) return '';
  if (str.startsWith('Sub-Pământ')) {
    return 'un sub-Pământ' + str.slice('Sub-Pământ'.length);
  }
  if (/^(H II|UV|CO₂|121,6)/.test(str)) {
    return str;
  }
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function formatStructureItemSentence(s, conn) {
  const cleanName = refineProse(s.name.replace(' — ', ', '));
  const rawDesc = s.description;
  if (s.name.includes('Antena parabolică de 3,7') && rawDesc.startsWith('Transmite')) {
    return `${conn} \\textbf{${cleanName}}, prin care ${refineProse(lowerFirstForClause(rawDesc))}`;
  }
  if (VERB_START_RE.test(rawDesc)) {
    return `${conn} \\textbf{${cleanName}}, care ${refineProse(lowerFirstForClause(rawDesc))}`;
  }
  if (CLAUSE_START_RE.test(rawDesc)) {
    return `${conn} \\textbf{${cleanName}}, unde ${refineProse(lowerFirstForClause(rawDesc))}`;
  }
  if (/^95% dioxid/.test(rawDesc)) {
    return `${conn} \\textbf{${cleanName}}, alcătuită în proporție de ${refineProse(rawDesc)}`;
  }
  if (/^Rază de/.test(rawDesc)) {
    return `${conn} \\textbf{${cleanName}}, cu o ${refineProse(lowerFirstForClause(rawDesc))}`;
  }
  return `${conn} \\textbf{${cleanName}}, ${refineProse(lowerFirstForClause(rawDesc))}`;
}

const CATEGORY_LABELS_RO = {
  star: 'Stea',
  terrestrial: 'Planetă Telurică (Stâncoasă)',
  gas_giant: 'Gigant Gazos',
  ice_giant: 'Gigant de Gheață',
  dwarf: 'Planetă Pitică',
  moon: 'Satelit Natural (Lună)',
  asteroid: 'Asteroid',
  station: 'Stație Spațială Orbitală',
  telescope: 'Telescop Spațial',
  probe: 'Sondă Interplanetară',
  rover: 'Rover Planetar',
  oort_cloud: 'Rezervor Cometar Circumsolar',
  exoplanet: 'Sistem Exoplanetar / Exoplanetă',
  star_cluster: 'Roi Stelar Deschis',
  nebula: 'Nebuloasă Cosmică',
  black_hole: 'Gaură Neagră Supermasivă',
  galaxy: 'Galaxie',
};

const PARENT_NAMES_RO = {
  sun: 'Soarele',
  earth: 'Pământul',
  mars: 'Marte',
  jupiter: 'Jupiter',
  saturn: 'Saturn',
  uranus: 'Uranus',
  neptune: 'Neptun',
  pluto: 'Pluto',
};

const IMAGE_BY_ID = {
  sun: {
    path: '../public/textures/hd/sun_albedo.jpg',
    caption: 'Harta fotosferei solare în rezoluție 2K folosită în Orbitar (date NASA Solar Dynamics Observatory — SDO).',
  },
  mercury: {
    path: '../public/textures/hd/mercury_messenger_albedo.jpg',
    caption: 'Harta globală a suprafeței craterizate a lui Mercur, realizată de sonda NASA MESSENGER (2K HD).',
  },
  venus: {
    path: '../public/textures/hd/venus_magellan_surface.jpg',
    caption: 'Harta radar a reliefului vulcanic de sub norii planetei Venus, obținută de sonda NASA Magellan (modul „Vezi sub nori” în Orbitar).',
  },
  earth: {
    path: '../public/textures/hd/earth_albedo.jpg',
    caption: 'Harta globală NASA Blue Marble a planetei Pământ, cu oceanele, continentele și calotele polare.',
  },
  mars: {
    path: '../public/textures/hd/mars_viking_albedo.jpg',
    caption: 'Harta globală a Planetei Roșii Marte (mozaic NASA Viking / MOLA), evidențiind Valles Marineris și regiunea vulcanică Tharsis.',
  },
  jupiter: {
    path: '../public/textures/hd/jupiter_cassini_albedo.jpg',
    caption: 'Harta globală a benzilor de nori și a Marii Pete Roșii de pe Jupiter, fotografiată de sonda NASA/ESA Cassini.',
  },
  saturn: {
    path: '../public/textures/hd/saturn_cassini_albedo.jpg',
    caption: 'Harta benzilor atmosferice aurii ale gigantului gazos Saturn (date NASA/ESA Cassini).',
  },
  uranus: {
    path: '../public/textures/hd/uranus_voyager.jpg',
    caption: 'Harta atmosferei de hidrogen, heliu și metan a gigantului de gheață Uranus (date NASA Voyager 2).',
  },
  neptune: {
    path: '../public/textures/hd/neptune_voyager.jpg',
    caption: 'Harta atmosferei azurii și a furtunilor supersonice de pe Neptun, cartografiată de NASA Voyager 2.',
  },
  moon: {
    path: '../public/textures/hd/moon_lro_albedo.jpg',
    caption: 'Harta globală a Lunii (NASA Lunar Reconnaissance Orbiter — LRO), cu mările bazaltice și craterele de impact.',
  },
  phobos: {
    path: '../public/textures/hd/phobos_viking.jpg',
    caption: 'Harta suprafeței satelitul marțian Phobos și a marelui crater Stickney (date NASA Viking).',
  },
  deimos: {
    path: '../public/textures/hd/deimos_viking.jpg',
    caption: 'Harta suprafeței netede și prăfuite a lui Deimos, satelitul exterior al lui Marte (date NASA Viking).',
  },
  io: {
    path: '../public/textures/hd/io_galileo.jpg',
    caption: 'Harta vulcanică globală a lunii Io, acoperită cu depozite de sulf și caldere active (sonda NASA Galileo).',
  },
  europa: {
    path: '../public/textures/hd/europa_galileo.jpg',
    caption: 'Scoarța de gheață brăzdată de fracturi roșiatice (lineae) a lunii Europa, sub care se află un ocean global (NASA Galileo).',
  },
  ganymede: {
    path: '../public/textures/hd/ganymede_galileo.jpg',
    caption: 'Harta celui mai mare satelit din Sistemul Solar, Ganymede, obținută de misiunile NASA Voyager și Galileo.',
  },
  callisto: {
    path: '../public/textures/hd/callisto_galileo.jpg',
    caption: 'Suprafața străveche a lunii Callisto și bazinul multi-inelar Valhalla (date NASA Galileo).',
  },
  mimas: {
    path: '../public/textures/hd/mimas_cassini.jpg',
    caption: 'Harta satelitul înghețat Mimas și a uriașului crater Herschel, fotografiate de sonda NASA/ESA Cassini.',
  },
  enceladus: {
    path: '../public/textures/hd/enceladus_cassini.jpg',
    caption: 'Gheața pură a lunii Enceladus și fisurile „Dungi de Tigru” de la polul sudic (sonda NASA/ESA Cassini).',
  },
  tethys: {
    path: '../public/textures/hd/tethys_cassini.jpg',
    caption: 'Harta globală a lunii înghețate Tethys, cu uriașul bazin de impact Odysseus și canionul Ithaca Chasma (NASA/ESA Cassini).',
  },
  dione: {
    path: '../public/textures/hd/dione_cassini.jpg',
    caption: 'Harta globală a lunii Dione și a falezelor luminoase de gheață Padua Chasmata (NASA/ESA Cassini).',
  },
  rhea: {
    path: '../public/textures/hd/rhea_cassini.jpg',
    caption: 'Suprafața intens craterizată a lunii Rhea, al doilea satelit ca mărime al lui Saturn (NASA/ESA Cassini).',
  },
  titan: {
    path: '../public/textures/hd/titan_cassini.jpg',
    caption: 'Harta globală a lunii Titan obținută prin străpungerea ceții portocalii de azot și metan de către sonda Cassini.',
  },
  hyperion: {
    path: '../public/textures/hd/hyperion_cassini.jpg',
    caption: 'Aspectul poros, de „burete cosmic” ciuruit de cratere adânci, al satelitului cu rotație haotică Hyperion (NASA/ESA Cassini).',
  },
  iapetus: {
    path: '../public/textures/hd/iapetus_cassini.jpg',
    caption: 'Contrastul „Yin-Yang” dintre emisfera întunecată (Cassini Regio) și emisfera strălucitoare de gheață a lunii Iapetus (NASA/ESA Cassini).',
  },
  phoebe: {
    path: '../public/textures/hd/phoebe_cassini.jpg',
    caption: 'Harta satelitului retrograd Phoebe (planetozimal capturat din Centura Kuiper) și a craterului Jason (NASA/ESA Cassini).',
  },
  miranda: {
    path: '../public/textures/hd/miranda_voyager.jpg',
    caption: 'Relieful spectaculos al lunii Miranda, cu stâncile Verona Rupes și regiunile coronae (NASA Voyager 2).',
  },
  ariel: {
    path: '../public/textures/hd/ariel_voyager.jpg',
    caption: 'Harta celei mai luminoase luni a lui Uranus, Ariel, brăzdată de canioanele tectonice Kachina Chasmata (NASA Voyager 2).',
  },
  umbriel: {
    path: '../public/textures/hd/umbriel_voyager.jpg',
    caption: 'Suprafața întunecată a lunii Umbriel și misteriosul inel luminos al craterului Wunda de la ecuator (NASA Voyager 2).',
  },
  titania: {
    path: '../public/textures/hd/titania_voyager.jpg',
    caption: 'Harta celei mai mari luni a lui Uranus, Titania, și a canionului tectonic Messina Chasmata (NASA Voyager 2).',
  },
  oberon: {
    path: '../public/textures/hd/oberon_voyager.jpg',
    caption: 'Harta celei mai exterioare luni mari a lui Uranus, Oberon, cu craterul Hamlet și razele sale de gheață (NASA Voyager 2).',
  },
  triton: {
    path: '../public/textures/hd/triton_voyager.jpg',
    caption: 'Terenul de tip „coajă de pepene galben” și calota de azot înghețat cu gheizere de pe Triton (NASA Voyager 2).',
  },
  charon: {
    path: '../public/textures/hd/charon_newhorizons.jpg',
    caption: 'Harta lunii Charon cu calota polară roșiatică Mordor Macula și canionul Serenity Chasma (NASA New Horizons, 2015).',
  },
  pluto: {
    path: '../public/textures/hd/pluto_newhorizons.jpg',
    caption: 'Harta globală a planetei pitice Pluto și a ghețarului în formă de inimă Tombaugh Regio / Sputnik Planitia (NASA New Horizons).',
  },
  ceres: {
    path: '../public/textures/hd/ceres_dawn.jpg',
    caption: 'Harta globală a planetei pitice Ceres și a craterului Occator cu depozite strălucitoare de săruri (sonda NASA Dawn).',
  },
  eris: {
    path: '../public/textures/eris.jpg',
    caption: 'Harta artistică științifică a suprafeței înghețate și extrem de reflectante de metan a planetei pitice Eris.',
  },
  haumea: {
    path: '../public/textures/haumea.jpg',
    caption: 'Harta suprafeței de gheață cristalină și a petei roșiatice de pe planeta pitică elipsoidală Haumea.',
  },
  makemake: {
    path: '../public/textures/makemake.jpg',
    caption: 'Harta suprafeței bogate în toline roșiatice și metan înghețat a planetei pitice Makemake din Centura Kuiper.',
  },
  vesta: {
    path: '../public/textures/hd/vesta_dawn.jpg',
    caption: 'Harta topografică a protoplanetei 4 Vesta, obținută de sonda NASA Dawn în 2011–2012.',
  },
  pallas: {
    path: 'imagini/globuri/pallas_map.jpg',
    caption: 'Harta desfășurată a reliefului craterizat al asteroidului 2 Pallas din Centura Principală.',
  },
  psyche: {
    path: 'imagini/globuri/psyche_map.jpg',
    caption: 'Harta desfășurată a suprafeței bogate în fier și nichel a asteroidului metalic 16 Psyche.',
  },
  bennu: {
    path: 'imagini/globuri/bennu_map.jpg',
    caption: 'Harta desfășurată a suprafeței carbonifere întunecate a asteroidului 101955 Bennu.',
  },
  apophis: {
    path: 'imagini/globuri/apophis_map.jpg',
    caption: 'Harta desfășurată a suprafeței stâncoase a asteroidului din apropierea Pământului 99942 Apophis.',
  },
  iss: {
    path: '../public/textures/nasa/iss.jpg',
    caption: 'Fotografie reală NASA (ISS056E201248): Stația Spațială Internațională pe orbita joasă a Pământului (~420 km altitudine).',
  },
  hubble: {
    path: '../public/textures/nasa/hubble.jpg',
    caption: 'Fotografie reală NASA (STS-125): Telescopul Spațial Hubble pe orbită deasupra Pământului.',
  },
  jwst: {
    path: '../public/textures/nasa/jwst.jpg',
    caption: 'Imagine oficială NASA/GSFC: Telescopul Spațial James Webb cu oglinda din 18 segmente hexagonale aurii și scutul termic în 5 straturi.',
  },
  euclid: {
    path: '../public/textures/nasa/euclid.jpg',
    caption: 'Fotografie oficială NASA/ESA (PIA25783): Telescopul Spațial Euclid pentru cartografierea materiei și energiei întunecate.',
  },
  voyager1: {
    path: '../public/textures/nasa/voyager1.jpg',
    caption: 'Randare oficială NASA/JPL-Caltech (PIA17462): Sonda Voyager 1 călătorind în spațiul interstelar cu Discul de Aur la bord.',
  },
  voyager2: {
    path: '../public/textures/nasa/voyager2.jpg',
    caption: 'Randare oficială NASA/JPL-Caltech (PIA17462): Sonda Voyager 2, singura navă care a vizitat toți cei patru giganți planetari.',
  },
  newhorizons: {
    path: '../public/textures/nasa/newhorizons.jpg',
    caption: 'Imagine oficială NASA/JHUAPL/SwRI: Sonda interplanetară New Horizons în timpul explorării Centurii Kuiper.',
  },
  parker: {
    path: '../public/textures/nasa/parker.jpg',
    caption: 'Imagine oficială NASA/JHUAPL: Sonda Parker Solar Probe zburând prin coroana solară incandescentă.',
  },
  rosetta: {
    path: '../public/textures/nasa/rosetta.jpg',
    caption: 'Fotografie oficială ESA/NASA (PIA18596): Nucleul bilobat al cometei 67P/Ciuriumov-Gherasimenko fotografiat de sonda Rosetta.',
  },
  juice: {
    path: '../public/textures/nasa/juice.jpg',
    caption: 'Fotografie oficială NASA/JPL/ESA (PIA24024): Sonda interplanetară europeană JUICE destinată studiului lunilor înghețate ale lui Jupiter.',
  },
  perseverance: {
    path: '../public/textures/nasa/perseverance.jpg',
    caption: 'Fotografie reală NASA/JPL-Caltech (PIA24542): Roverul Perseverance alături de elicopterul Ingenuity în Craterul Jezero de pe Marte.',
  },
  curiosity: {
    path: '../public/textures/nasa/curiosity.jpg',
    caption: 'Autoportret real NASA/JPL-Caltech (PIA16239): Roverul Curiosity (MSL) pe solul Craterului Gale de pe Marte.',
  },
  oort_cloud: {
    path: '../public/textures/nasa/oort_cloud.jpg',
    caption: 'Ilustrație științifică oficială NASA/JPL-Caltech (PIA17046): Sfera gigantică de comete înghețate a Norului lui Oort în jurul Sistemului Solar.',
  },
  proxima_centauri: {
    path: '../public/textures/nasa/proxima_centauri.jpg',
    caption: 'Fotografie reală NASA/ESA (Telescopul Spațial Hubble WFPC2): Steaua pitică roșie Proxima Centauri, aflată la 4,24 ani-lumină.',
  },
  sirius: {
    path: '../public/textures/nasa/sirius.jpg',
    caption: 'Fotografie reală NASA/ESA (Telescopul Spațial Hubble): Steaua strălucitoare Sirius A și pitica albă Sirius B (punctul din stânga-jos).',
  },
  trappist1: {
    path: '../public/textures/nasa/trappist1.jpg',
    caption: 'Randare științifică oficială NASA/JPL-Caltech (PIA21422): Cele 7 exoplanete stâncoase de mărimea Pământului din sistemul TRAPPIST-1.',
  },
  cancri55e: {
    path: '../public/textures/nasa/cancri55e.jpg',
    caption: 'Imagine științifică oficială NASA/JPL-Caltech (Telescopul Spitzer PIA20068): Exoplaneta incandescentă de lavă 55 Cancri e (Janssen).',
  },
  pleiades: {
    path: '../public/textures/nasa/pleiades.jpg',
    caption: 'Fotografie reală NASA/JPL-Caltech/Hubble (PIA04225): Roiul stelar deschis Pleiadele (M45 — „Cloșca cu Pui”).',
  },
  betelgeuse: {
    path: '../public/textures/nasa/betelgeuse.jpg',
    caption: 'Imagine reală NASA/ESA (Telescopul Spațial Hubble): Supergiganta roșie Betelgeuse din constelația Orion.',
  },
  orion_nebula: {
    path: '../public/textures/nasa/orion_nebula.jpg',
    caption: 'Fotografie reală NASA/JPL-Caltech/ESA (Hubble & Spitzer PIA08653): Maternitatea stelară Nebuloasa Orion (M42).',
  },
  pillars_of_creation: {
    path: '../public/textures/nasa/pillars_of_creation.jpg',
    caption: 'Fotografie reală NASA/ESA/CSA/STScI (Telescopul Spațial James Webb — PIA25433): „Stâlpii Creației” din Nebuloasa Vulturului (M16).',
  },
  sagittarius_a: {
    path: '../public/textures/nasa/sagittarius_a.jpg',
    caption: 'Imaginea istorică reală Event Horizon Telescope (EHT) & NASA (PIA25440): Gaura neagră supermasivă Sagittarius A* din centrul Căii Lactee.',
  },
  milky_way: {
    path: '../public/textures/nasa/milky_way.jpg',
    caption: 'Harta științifică oficială NASA/JPL-Caltech (Telescopul Spitzer PIA19341): Brațele spirale ale galaxiei noastre, Calea Lactee, și poziția Soarelui.',
  },
  andromeda: {
    path: '../public/textures/nasa/andromeda.jpg',
    caption: 'Fotografie reală NASA/JPL-Caltech (GALEX & Spitzer PIA15416): Galaxia spirală Andromeda (M31), aflată la 2,54 milioane de ani-lumină.',
  },
};

/**
 * Generează secțiunea LaTeX completă pentru un corp ceresc, misiune spațială sau obiect Deep Space.
 */
function renderBodySection(body, indexNumber, sectionLevel = 'section', extraEndBox = '') {
  const catLabel = CATEGORY_LABELS_RO[body.category] || body.category;
  const parentName = body.parentId ? PARENT_NAMES_RO[body.parentId] || body.parentId : null;
  const isDeepSpace = Boolean(body.distanceLightYears && body.distanceLightYears > 0);
  const isMission = ['station', 'telescope', 'probe', 'rover'].includes(body.category);

  const distText = isDeepSpace
    ? refineProse(body.distanceLightYearsLabelRo || `${fmtNum(body.distanceLightYears)} ani-lumină`)
    : body.id === 'sun'
    ? '0 UA (Centrul Sistemului Solar)'
    : `${fmtNum(body.distanceFromSunAU, 3)} UA ($\\approx$ ${fmtNum(Math.round(body.distanceFromSunAU * 149.598))} milioane de kilometri)`;

  const spanMeters = Math.round(body.radiusKm * 1000);
  const radiusText = isDeepSpace
    ? refineProse(body.sizeComparisonRo || `${fmtNum(body.radiusKm)} de kilometri`)
    : isMission
    ? `anvergură de aproximativ ${spanMeters === 1 ? '2,1 metri' : `${fmtNum(spanMeters)} ${numNeedsDe(String(spanMeters)) ? 'de metri' : 'metri'}`}`
    : `rază medie ${fmtNum(body.radiusKm)} ${numNeedsDe(String(Math.round(body.radiusKm))) ? 'de kilometri' : 'kilometri'}`;

  const massText = isMission
    ? 'Vehicul spațial artificial'
    : body.massEarthRatio >= 0.001
    ? `${fmtNum(body.massEarthRatio, 3)} $\\times M_\\oplus$`
    : `${body.massEarthRatio.toExponential(2).replace('.', ',')} $\\times M_\\oplus$`;

  const gravText =
    body.gravityRatio <= 0.0005
      ? 'Microgravitație / Imponderabilitate ($\\approx 0\\,g$)'
      : `${fmtNum(body.gravityRatio, 3)} $\\times g_\\oplus$ (${fmtNum(body.gravityRatio * 9.81, 2)} m/s$^2$)`;

  const orbitText =
    body.orbitPeriodDays === 0
      ? 'Orbitează centrul Căii Lactee (aproximativ 230 de milioane de ani)'
      : body.orbitPeriodDays < 0
      ? `${fmtNum(Math.abs(body.orbitPeriodDays))} zile pământești (Orbită retrogradă!)`
      : body.orbitPeriodDays >= 365.25
      ? `${fmtNum(body.orbitPeriodDays)} zile ($\\approx$ ${fmtNum(body.orbitPeriodDays / 365.25, 2)} ani pământești)`
      : `${fmtNum(body.orbitPeriodDays)} zile pământești`;

  const dayHours = Number(body.dayLengthHours);
  const dayText =
    dayHours === 0
      ? '-'
      : dayHours < 0
      ? `${fmtNum(Math.abs(dayHours), 2)} ore (Rotație retrogradă!)`
      : `${fmtNum(dayHours, 2)} ore (${fmtNum(dayHours / 24, 2)} zile pământești)`;

  const tempText =
    body.meanTempC >= 1000
      ? `+${fmtNum(body.meanTempC)} $^\\circ$C`
      : body.meanTempC > 0
      ? `+${fmtNum(body.meanTempC)} $^\\circ$C`
      : `${fmtNum(body.meanTempC)} $^\\circ$C`;

  const tiltText =
    body.axialTiltDeg !== undefined ? `${fmtNum(body.axialTiltDeg, 2)}$^\\circ$` : 'Nespecificată';

  let keplerInline = '';
  if (body.keplerian) {
    const k = body.keplerian;
    keplerInline = ` (elemente kepleriene: $a = ${fmtNum(k.semiMajorAxisAU, 3)}$ UA, $e = ${fmtNum(k.eccentricity, 4)}$, $i = ${fmtNum(k.inclinationDeg, 2)}^\\circ$, $\\Omega = ${fmtNum(k.ascendingNodeDeg, 1)}^\\circ$, $\\omega = ${fmtNum(k.argPerihelionDeg, 1)}^\\circ$)`;
  }

  const imgInfo = IMAGE_BY_ID[body.id];
  const globeRelPath = `imagini/globuri/${body.id}.jpg`;
  const hasGlobe3D =
    !isDeepSpace &&
    !isMission &&
    fs.existsSync(path.join(CARTE_DIR, globeRelPath));

  let imageBlock = '';
  if (hasGlobe3D && imgInfo) {
    imageBlock = `
\\begin{center}
\\begin{tabular}{@{}m{0.44\\textwidth}@{\\hspace{0.03\\textwidth}}m{0.51\\textwidth}@{}}
\\centering\\includegraphics[width=\\linewidth,height=4.4cm,keepaspectratio]{${globeRelPath}}\\\\[2pt]
{\\scriptsize\\itshape\\color{orbitarMuted} Vedere 3D a corpului ceresc (\\textbf{${texEscape(body.name)}})}
&
\\centering\\includegraphics[width=\\linewidth,height=4.4cm,keepaspectratio]{${imgInfo.path}}\\\\[2pt]
{\\scriptsize\\itshape\\color{orbitarMuted} Planiglob desfășurat: ${refineProse(imgInfo.caption)}}
\\end{tabular}
\\end{center}
`;
  } else if (imgInfo) {
    imageBlock = `
\\begin{center}
\\includegraphics[width=0.78\\textwidth,height=5.6cm,keepaspectratio]{${imgInfo.path}}\\\\[3pt]
{\\footnotesize\\itshape\\color{orbitarMuted} ${refineProse(imgInfo.caption)}}
\\end{center}
`;
  }

  const structHeading = isMission
    ? 'Arhitectura tehnică și instrumentele științifice de la bord'
    : 'Alcătuirea fizică și structura internă';

  const structIntro = isMission
    ? 'Din punct de vedere constructiv și ingineresc, vehiculul spațial reunește mai multe subsisteme și instrumente științifice de înaltă precizie, proiectate să funcționeze în condițiile extreme ale spațiului cosmic.'
    : 'Privind în profunzimea sa, alcătuirea fizică este organizată pe mai multe straturi și regiuni distincte, fiecare având un rol bine definit în evoluția și dinamica acestui obiect cosmic.';

  const structConnectors = [
    'În primul rând se distinge',
    'În strânsă legătură cu această componentă se află',
    'Totodată, un rol esențial îi revine regiunii cunoscute drept',
    'La acestea se adaugă',
  ];

  const structureProse =
    structIntro +
    ' ' +
    body.cadet.structure
      .map((s, idx) => {
        const conn =
          idx === 0
            ? 'În primul rând se remarcă'
            : idx === body.cadet.structure.length - 1 && body.cadet.structure.length > 1
            ? 'În completarea acestui ansamblu întâlnim'
            : structConnectors[idx % structConnectors.length];
        return formatStructureItemSentence(s, conn);
      })
      .join(' ');

  let deepSpaceProse = '';
  if (isDeepSpace) {
    deepSpaceProse = `\n\n\\subsubsection*{Scara cosmică și călătoria luminii în timp}\nLa scară astronomică, dimensiunile sale sunt impresionante: ${refineProse(body.sizeComparisonRo || '')} Totodată, privind astăzi spre ${refineProse(body.name)}, observăm practic trecutul îndepărtat al Universului, întrucât lumina sa a călătorit prin spațiu până la noi: ${refineProse(body.lightDepartureHistoryRo || '')}`;
  }

  const quiz = body.cadet.quiz;
  const letters = ['A', 'B', 'C', 'D'];
  const quizOptions = quiz.options
    .map((opt, idx) => `  \\item[$\\square$ \\textbf{${letters[idx]}.}] ${refineProse(opt)}`)
    .join('\n');
  const correctLetter = letters[quiz.correctIndex] || 'A';

  return `
\\${sectionLevel}{${refineProse(body.name)}}
\\label{sec:body-${body.id}}
\\vspace{-4pt}
{\\large\\itshape\\color{orbitarAccent} ${refineProse(body.subtitle)}}\\\\[4pt]

${imageBlock}

\\begin{tcolorbox}[orbitardata, title={\\textbf{Repere esențiale: ${refineProse(body.name)}}}]
\\small
\\begin{itemize}[leftmargin=1.4em, itemsep=2pt, topsep=2pt]
  \\item \\textbf{Clasificare și orbită:} ${texEscape(catLabel)}${parentName ? ` (orbitează în jurul: \\textbf{${texEscape(parentName)}})` : ''} \\quad$\\bullet$\\quad \\textbf{Distanță:} ${distText}
  \\item \\textbf{Dimensiuni și masă:} ${radiusText} \\quad$\\bullet$\\quad masă: ${massText}
  \\item \\textbf{Gravitație și regim termic:} ${gravText} \\quad$\\bullet$\\quad temperatură medie: ${tempText}${!isDeepSpace && !isMission ? ` (înclinarea axei: ${tiltText})` : ''}
  \\item \\textbf{Ciclu orbital și rotație:} perioadă orbitală (an): ${orbitText} \\quad$\\bullet$\\quad rotație (zi): ${dayText}${keplerInline}
  \\item \\textbf{Durata călătoriei de pe Pământ:} cu viteza luminii ($1c$): \\emph{${refineProse(body.junior.travelTime.light)}}; cu racheta ($50.000$ de kilometri pe oră): \\emph{${refineProse(body.junior.travelTime.rocket)}}; cu avionul ($900$ de kilometri pe oră): \\emph{${refineProse(body.junior.travelTime.plane)}}; cu mașina ($100$ de kilometri pe oră): \\emph{${refineProse(body.junior.travelTime.car)}}.
  \\item \\textbf{Repere de scară și curiozitate:} ${refineProse(body.junior.analogy)} ${refineProse(body.junior.funFact)}
\\end{itemize}
\\end{tcolorbox}

\\subsubsection*{Prezentare generală și profil astrofizic}
${refineProse(body.cadet.summary)} ${refineProse(body.junior.summary)} ${refineProse(body.junior.analogy)}${deepSpaceProse}

\\subsubsection*{${structHeading}}
${structureProse}

\\subsubsection*{Observații astronomice și istoricul explorării}
${refineProse(body.cadet.explorationHistory)} ${refineProse(body.junior.funFact)}

\\vspace{6pt}
\\begin{tcolorbox}[orbitarquiz, title={\\textbf{Întrebare de verificare \\#${indexNumber}: ${refineProse(body.name)}}}]
\\textbf{${refineProse(quiz.question)}}
\\begin{itemize}[leftmargin=2.2em, itemsep=2pt, topsep=4pt]
${quizOptions}
\\end{itemize}
\\vspace{2pt}
{\\footnotesize\\color{orbitarMuted}\\textbf{Răspuns corect:} \\textbf{${correctLetter}} (${refineProse(quiz.options[quiz.correctIndex])}). \\emph{${refineProse(quiz.explanation)}}}
\\end{tcolorbox}
${extraEndBox ? `\\vspace{6pt}\n${extraEndBox}\n` : ''}\\clearpage
`;
}

// ============================================================================
// 0. FIȘIERUL PRINCIPAL: carte/orbitar-carte.tex
// ============================================================================
const mainTex = `% SPDX-License-Identifier: GPL-3.0-or-later
% =============================================================================
% ORBITAR — ENCICLOPEDIA COSMICĂ ILUSTRATĂ
% Sistemul Solar, Misiuni Spațiale, Stele, Exoplanete, Nebuloase și Galaxii
% Carte didactică generată din baza de cunoștințe a planetariului 3D Orbitar
% Licență: GNU General Public License v3.0 (GPL-3.0-or-later)
% =============================================================================
\\documentclass[11pt,a4paper,twoside,openany]{book}

\\usepackage[utf8]{inputenc}
\\usepackage[T1]{fontenc}
\\usepackage{lmodern}
\\usepackage[romanian]{babel}
\\usepackage{microtype}

\\usepackage[
  a4paper,
  top=2.4cm,
  bottom=2.4cm,
  inner=2.4cm,
  outer=2.0cm,
  headheight=15pt
]{geometry}

\\usepackage{xcolor}
\\usepackage{amsmath,amssymb}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{tabularx}
\\usepackage{longtable}
\\usepackage{array}
\\usepackage{enumitem}
\\usepackage{multicol}
\\usepackage{float}
\\usepackage{caption}
\\usepackage{fancyhdr}
\\usepackage{titlesec}
\\usepackage[most]{tcolorbox}
\\usepackage{tikz}
\\usetikzlibrary{shapes.geometric, arrows.meta, positioning, calc, decorations.pathmorphing}

\\usepackage[
  colorlinks=true,
  linkcolor=orbitarDeepBlue,
  urlcolor=orbitarCyanDark,
  citecolor=orbitarDeepBlue,
  pdftitle={Orbitar — Enciclopedia Cosmică Ilustrată},
  pdfauthor={Proiectul Open-Source Orbitar},
  pdfsubject={Astronomie didactică: Sistemul Solar, Sonde, Rovere, Exoplanete, Nebuloase și Galaxii},
  pdfkeywords={Orbitar, Astronomie, Sistemul Solar, Planete, Sonde Spațiale, Exoplanete, Galaxii, GPLv3}
]{hyperref}

% Definirea paletei cromatice Orbitar (adaptată pentru lizibilitate maximă pe ecran și la tipar)
\\definecolor{orbitarSpaceBg}{HTML}{0B1021}
\\definecolor{orbitarDeepBlue}{HTML}{0F2942}
\\definecolor{orbitarCyan}{HTML}{00F0FF}
\\definecolor{orbitarCyanDark}{HTML}{007799}
\\definecolor{orbitarAmber}{HTML}{D97706}
\\definecolor{amber}{HTML}{FFB703}
\\definecolor{orbitarAmberLight}{HTML}{FEF3C7}
\\definecolor{orbitarJuniorBg}{HTML}{FFFBEB}
\\definecolor{orbitarCadetBg}{HTML}{F0F9FF}
\\definecolor{orbitarDataBg}{HTML}{F8FAFC}
\\definecolor{orbitarQuizBg}{HTML}{F5F3FF}
\\definecolor{orbitarViolet}{HTML}{6D28D9}
\\definecolor{orbitarAccent}{HTML}{1E3A8A}
\\definecolor{orbitarMuted}{HTML}{475569}
\\definecolor{orbitarSuccess}{HTML}{15803D}

% Stiluri tcolorbox pentru casetele didactice
\\tcbset{
  orbitardata/.style={
    enhanced,
    breakable,
    colback=orbitarDataBg,
    colframe=orbitarDeepBlue,
    coltitle=white,
    fonttitle=\\bfseries\\small,
    boxrule=0.8pt,
    arc=3pt,
    left=8pt, right=8pt, top=6pt, bottom=6pt
  },
  orbitarjunior/.style={
    enhanced,
    breakable,
    colback=orbitarJuniorBg,
    colframe=orbitarAmber,
    coltitle=white,
    fonttitle=\\bfseries\\small,
    boxrule=0.9pt,
    arc=4pt,
    left=8pt, right=8pt, top=6pt, bottom=6pt
  },
  orbitarcadet/.style={
    enhanced,
    breakable,
    colback=orbitarCadetBg,
    colframe=orbitarCyanDark,
    coltitle=white,
    fonttitle=\\bfseries\\small,
    boxrule=0.9pt,
    arc=4pt,
    left=8pt, right=8pt, top=6pt, bottom=6pt
  },
  orbitarquiz/.style={
    enhanced,
    breakable,
    colback=orbitarQuizBg,
    colframe=orbitarViolet,
    coltitle=white,
    fonttitle=\\bfseries\\small,
    boxrule=0.8pt,
    arc=4pt,
    left=8pt, right=8pt, top=6pt, bottom=6pt
  },
  orbitarlightyear/.style={
    enhanced,
    breakable,
    colback=white,
    colframe=orbitarAccent,
    coltitle=white,
    fonttitle=\\bfseries\\small,
    boxrule=0.8pt,
    arc=3pt,
    left=8pt, right=8pt, top=6pt, bottom=6pt
  }
}

% Antet și subsol elegante
\\pagestyle{fancy}
\\fancyhf{}
\\fancyhead[LE]{\\footnotesize\\scshape Orbitar — Enciclopedia Cosmică Ilustrată}
\\fancyhead[RO]{\\footnotesize\\nouppercase{\\leftmark}}
\\fancyfoot[LE,RO]{\\footnotesize\\textbf{\\thepage}}
\\fancyfoot[LO,RE]{\\footnotesize\\color{orbitarMuted}Licență liberă GNU GPLv3 \\quad|\\quad \\texttt{orbitar.ro}}
\\renewcommand{\\headrulewidth}{0.4pt}
\\renewcommand{\\footrulewidth}{0.2pt}

% Formatarea titlurilor de capitol și secțiune
\\titleformat{\\chapter}[display]
  {\\normalfont\\huge\\bfseries\\color{orbitarDeepBlue}}
  {\\filright\\normalsize\\scshape\\color{orbitarCyanDark}Capitolul \\thechapter}
  {6pt}
  {\\titlerule[1.2pt]\\vspace{6pt}\\filright}
  [\\vspace{4pt}\\titlerule]

\\titleformat{\\section}
  {\\normalfont\\Large\\bfseries\\color{orbitarDeepBlue}}
  {\\thesection}{0.8em}{}

\\titleformat{\\subsection}
  {\\normalfont\\large\\bfseries\\color{orbitarAccent}}
  {\\thesubsection}{0.7em}{}

\\titleformat{\\subsubsection}
  {\\normalfont\\normalsize\\bfseries\\color{orbitarDeepBlue}}
  {\\thesubsubsection}{0.6em}{}
\\titlespacing*{\\subsubsection}{0pt}{8pt plus 2pt minus 1pt}{2pt}

\\setlength{\\parskip}{4pt}
\\setlength{\\parindent}{0pt}

% Contor și macro pentru alinierea paginilor la multiplu de 4 (tipar Print-on-Demand / Blurb)
\\newcounter{orbitartmp}
\\newcommand{\\orbitarPadToModFour}[1]{%
  \\clearpage
  \\loop
    \\setcounter{orbitartmp}{\\value{page}}%
    \\divide\\value{orbitartmp} by 4\\relax
    \\multiply\\value{orbitartmp} by 4\\relax
    \\setcounter{orbitartmp}{\\numexpr\\value{page}-\\value{orbitartmp}\\relax}%
  \\ifnum\\value{orbitartmp}=#1\\relax
  \\else
    \\thispagestyle{empty}\\mbox{}\\clearpage
  \\repeat
}

\\begin{document}

% =============================================================================
% COPERTA I (COPERTA FAȚĂ — PAGINA 1 PDF, RECTO)
% =============================================================================
\\begin{titlepage}
\\begin{tikzpicture}[remember picture, overlay]
  % Fundal cosmic închis
  \\fill[orbitarSpaceBg] (current page.south west) rectangle (current page.north east);

  % Inele orbitale decorative în jurul centrului paginii
  \\coordinate (C) at ([yshift=-0.8cm]current page.center);
  \\draw[orbitarCyan!25, line width=0.6pt, dashed] (C) circle (2.0cm);
  \\draw[orbitarCyan!35, line width=0.8pt] (C) circle (3.2cm);
  \\draw[orbitarAmber!40, line width=1.1pt] (C) circle (4.5cm);
  \\draw[orbitarCyan!20, line width=0.6pt, dashed] (C) circle (5.9cm);
  \\draw[white!15, line width=0.4pt] (C) circle (7.3cm);

  % Soarele central
  \\shade[inner color=yellow!90!white, outer color=orange!90!red] (C) circle (1.00cm);

  % Planete simbolice pe orbite
  \\fill[cyan!70!blue] ($(C)+(35:2.0cm)$) circle (0.18cm);
  \\fill[orange!80!red] ($(C)+(145:3.2cm)$) circle (0.22cm);
  \\fill[amber!80!orange] ($(C)+(-30:4.5cm)$) circle (0.42cm);
  \\draw[white!80, line width=1.4pt] ($(C)+(-30:4.5cm)$) ellipse (0.72cm and 0.20cm);
  \\fill[blue!60!cyan] ($(C)+(215:5.9cm)$) circle (0.28cm);

  % Stele pe fundal
  \\foreach \\x/\\y/\\r in {-7/11/1.2, -5/12.5/0.8, 6/11.8/1.4, 7.5/9/1.0, -8/6/1.1, 8/4/0.9, -6/-4/1.3, 7/-5/1.1, -4/-9/0.9, 5/-10/1.2} {
    \\fill[white!85] ($(current page.center)+(\\x cm, \\y cm)$) circle (\\r pt);
  }
\\end{tikzpicture}

\\vspace*{0.6cm}
\\begin{center}
  {\\color{orbitarCyan}\\Large\\bfseries\\scshape Planetariul Didactic Interactiv 3D}\\\\[0.45cm]
  {\\color{white}\\fontsize{40}{46}\\selectfont\\bfseries ORBITAR}\\\\[0.55cm]
  \\begin{tcolorbox}[
    enhanced,
    width=0.68\\textwidth,
    colback=black!95!orbitarSpaceBg,
    colframe=orbitarAmber!85!yellow,
    boxrule=0.9pt,
    arc=5pt,
    top=9pt,
    bottom=9pt,
    left=12pt,
    right=12pt
  ]
  \\centering
  {\\color{amber!90!yellow}\\LARGE\\bfseries Enciclopedia Cosmică Ilustrată}
  \\end{tcolorbox}
\\end{center}

\\vfill

\\begin{center}
  {\\color{orbitarCyan!85}\\small\\scshape Proiect Educațional Open-Source \\quad$\\bullet$\\quad \\texttt{orbitar.ro}}
\\end{center}
\\end{titlepage}

% =============================================================================
% PAGINI INTERMEDIARE DE ÎNCEPUT (FRONT MATTER PENTRU TIPAR / BLURB.COM)
% =============================================================================
\\makeatletter
\\@mainmatterfalse
\\makeatother
\\pagenumbering{roman}
\\setcounter{page}{2}

% Pagina 2 PDF (ii, Verso): Coperta a II-a / Pagină de gardă preliminară verso
\\thispagestyle{empty}
\\mbox{}
\\clearpage

% Pagina 3 PDF (iii, Recto): Pagina de gardă (Semititlu / Half-Title)
\\thispagestyle{empty}
\\vspace*{6.5cm}
\\begin{center}
  {\\color{orbitarCyanDark}\\normalsize\\scshape\\bfseries Planetariul Didactic Interactiv 3D}\\\\[0.35cm]
  {\\color{orbitarDeepBlue}\\fontsize{30}{36}\\selectfont\\bfseries ORBITAR}\\\\[0.35cm]
  \\begin{tikzpicture}
    \\draw[orbitarAmber, line width=1.0pt] (-3.2,0) -- (-0.4,0);
    \\fill[orbitarAmber] (0,0) circle (2.5pt);
    \\draw[orbitarAmber, line width=1.0pt] (0.4,0) -- (3.2,0);
  \\end{tikzpicture}\\\\[0.3cm]
  {\\color{orbitarMuted}\\Large\\itshape Enciclopedia Cosmică Ilustrată}
\\end{center}
\\vfill
\\clearpage

% Pagina 4 PDF (iv, Verso): Frontispiciu / Verso pagină de gardă
\\thispagestyle{empty}
\\vspace*{7.5cm}
\\begin{center}
  \\begin{tikzpicture}[scale=0.85]
    \\draw[orbitarCyanDark!35, line width=0.6pt, dashed] (0,0) circle (1.2cm);
    \\draw[orbitarDeepBlue!40, line width=0.8pt] (0,0) circle (2.0cm);
    \\draw[orbitarAmber!60, line width=0.9pt] (0,0) circle (2.8cm);
    \\fill[orbitarAmber] (0,0) circle (0.28cm);
    \\fill[orbitarCyanDark] (35:1.2cm) circle (0.09cm);
    \\fill[orbitarDeepBlue] (150:2.0cm) circle (0.12cm);
    \\fill[orbitarAmber!90!orange] (-40:2.8cm) circle (0.15cm);
  \\end{tikzpicture}\\\\[0.8cm]
  {\\color{orbitarDeepBlue}\\large\\itshape „Ad Astra — Prin Știință către Stele!”}\\\\[0.25cm]
  {\\color{orbitarMuted}\\small O călătorie enciclopedică prin cele trei orizonturi ale Universului:\\\\
  Sistemul Solar $\\bullet$ Stele și Exoplanete $\\bullet$ Nebuloase și Galaxii}
\\end{center}
\\vfill
\\clearpage

% Pagina 5 PDF (v, Recto): Pagina de titlu interioară completă (Full Interior Title Page)
\\thispagestyle{empty}
\\vspace*{1.2cm}
\\begin{center}
  {\\color{orbitarCyanDark}\\large\\bfseries\\scshape Planetariul Didactic Interactiv 3D}\\\\[0.45cm]
  {\\color{orbitarDeepBlue}\\fontsize{38}{44}\\selectfont\\bfseries ORBITAR}\\\\[0.4cm]
  {\\color{orbitarAmber}\\LARGE\\bfseries Enciclopedia Cosmică Ilustrată}\\\\[0.5cm]
  \\begin{tikzpicture}
    \\draw[orbitarDeepBlue, line width=1.2pt] (-5.5,0) -- (5.5,0);
    \\draw[orbitarAmber, line width=0.8pt] (-3.8,-0.12) -- (3.8,-0.12);
  \\end{tikzpicture}\\\\[0.5cm]
  {\\color{orbitarDeepBlue}\\large\\bfseries Sistemul Solar $\\bullet$ Sateliți Naturali $\\bullet$ Planete Pitice și Asteroizi\\\\[4pt]
  Misiuni Spațiale, Sonde și Rovere $\\bullet$ Stele și Exoplanete $\\bullet$ Nebuloase și Galaxii}\\\\[0.45cm]
  {\\color{orbitarMuted}\\normalsize Prezentări enciclopedice detaliate, repere astrofizice esențiale, structură internă,\\\\
  istoric al explorării, hărți științifice, Laboratorul Orbitar și 74 de întrebări grilă cu barem}
\\end{center}

\\vfill

\\begin{center}
  \\begin{tikzpicture}[scale=0.95]
    \\draw[orbitarDeepBlue!25, line width=0.5pt] (0,0) circle (2.4cm);
    \\draw[orbitarCyanDark!45, line width=0.7pt, dashed] (0,0) circle (1.7cm);
    \\draw[orbitarAmber!70, line width=0.9pt] (0,0) circle (1.0cm);
    \\fill[orbitarAmber] (0,0) circle (0.32cm);
    \\fill[orbitarCyanDark] (40:1.0cm) circle (0.10cm);
    \\fill[orbitarDeepBlue] (160:1.7cm) circle (0.14cm);
    \\fill[orbitarAmber!85!red] (-35:2.4cm) circle (0.18cm);
    \\draw[orbitarDeepBlue!70, line width=0.8pt] (-35:2.4cm) ellipse (0.34cm and 0.10cm);
  \\end{tikzpicture}
\\end{center}

\\vfill

\\begin{center}
  \\begin{tikzpicture}
    \\draw[orbitarDeepBlue!40, line width=0.6pt] (-5.5,0) -- (5.5,0);
  \\end{tikzpicture}\\\\[0.3cm]
  {\\color{orbitarDeepBlue}\\large\\bfseries Proiectul Educațional Open-Source Orbitar (Ediția v${pkgData.version})}\\\\[4pt]
  {\\color{orbitarMuted}\\small Licență liberă GNU General Public License v3.0 (\\texttt{GPL-3.0-or-later}) \\quad$\\bullet$\\quad \\texttt{https://orbitar.ro}}
\\end{center}
\\vspace*{0.5cm}
\\clearpage

% Pagina 6 PDF (vi, Verso): Caseta tehnică, credite și licența GNU GPLv3
\\thispagestyle{empty}
\\vspace*{0.4cm}
\\begin{tcolorbox}[orbitardata, title={\\textbf{Caseta Tehnică a Cărții și Licența Liberă GNU GPLv3}}]
\\textbf{Titlu:} \\emph{Orbitar — Enciclopedia Cosmică Ilustrată: Sistemul Solar, Misiuni Spațiale, Exoplanete și Galaxii}\\\\[4pt]
\\textbf{Baza de cunoștințe și redactare:} Informațiile, explicațiile didactice, analogiile și sintezele din această carte au fost agregate și redactate cu ajutorul inteligenței artificiale (AI) pe baza seturilor de date din aplicația \\textbf{Orbitar v${pkgData.version}} (\\texttt{public/data/solar-system-ro.json}, \\texttt{public/data/missions-ro.json}, \\texttt{public/data/deep-space-ro.json}, \\texttt{public/data/tle-iss.json} și modulele din \\texttt{src/}).\\\\[4pt]
\\textbf{Contribuitori proiect principal Orbitar:} Dragoș Iorgulescu (\\texttt{@diorgulescu}), Google Antigravity (Gemini) \\& Mistral Vibe.\\\\[4pt]
\\textbf{Credite fotografii și hărți științifice:} NASA / JPL-Caltech / ESA / CSA / STScI (Telescoapele Spațiale Hubble, James Webb, Spitzer, GALEX, Euclid) / Event Horizon Telescope (EHT) / Solar Dynamics Observatory (SDO) / Lunar Reconnaissance Orbiter (LRO) / MOLA / MESSENGER / Magellan / Cassini-Huygens / Voyager 1 \\& 2 / New Horizons / Dawn / Galileo / Viking / USGS Astrogeology (Public Domain \\& CC-BY 4.0), CelestiaContent (GNU GPLv2+) \\& Solar System Scope (CC-BY 4.0).\\\\[6pt]
\\textbf{Licență — GNU General Public License v3.0 (\\texttt{GPL-3.0-or-later}):}\\\\
Această carte (inclusiv codul sursă \\LaTeX{}, scripturile de generare, diagramele vectoriale TikZ și ediția PDF rezultată) este o lucrare educațională liberă: o puteți copia, tipări, distribui în școli sau biblioteci și/sau modifica în conformitate cu termenii \\textbf{Licenței Publice Generale GNU (GNU General Public License)} publicate de Free Software Foundation, fie versiunea 3 a Licenței, fie (la alegerea dumneavoastră) orice versiune ulterioară.\\\\[4pt]
Această lucrare este distribuită în speranța că va fi utilă elevilor, profesorilor și pasionaților de astronomie, dar \\textbf{FĂRĂ NICIO GARANȚIE}, fără chiar garanția implicită de vandabilitate sau potrivire pentru un anumit scop. Consultați fișierul \\texttt{LICENSE} din depozitul proiectului sau \\url{https://www.gnu.org/licenses/gpl-3.0.html} pentru textul integral al licenței.
\\end{tcolorbox}

\\vspace{0.3cm}
\\begin{tcolorbox}[orbitarlightyear, title={\\textbf{Specificații Tehnice pentru Tipărire (Print-on-Demand / Blurb.com PDF-to-Book)}}]
\\small
\\textbf{Format și paginare:} A4 ($210 \\times 297\\text{ mm}$), paginare în oglindă (\\texttt{twoside}, margine interioară de legătorie $24\\text{ mm}$, margine exterioară $20\\text{ mm}$).\\\\[2pt]
\\textbf{Structură de tipar:} Documentul include Coperta I (față), paginile intermediare de gardă și de titlu la interior, blocul de carte cu capitolele ilustrate, colofonul tipografic, paginile de gardă finale (Coperta a III-a) și Coperta a IV-a (coperta-spate), numărul total de pagini fiind calibrat automat la multiplu de 4.
\\end{tcolorbox}
\\vfill
\\clearpage

% Pagina 7 PDF (vii, Recto): Pagina de dedicație
\\thispagestyle{empty}
\\vspace*{7.0cm}
\\begin{center}
  {\\color{orbitarDeepBlue}\\Large\\itshape „Ad Astra — Prin Știință către Stele!”}\\\\[0.5cm]
  \\begin{tikzpicture}
    \\draw[orbitarAmber, line width=0.8pt] (-2.5,0) -- (2.5,0);
  \\end{tikzpicture}\\\\[0.5cm]
  \\parbox{0.75\\textwidth}{\\centering\\large\\color{orbitarMuted}
  Dedicată tuturor copiilor curioși, elevilor, profesorilor și exploratorilor care privesc cerul înstelat și își pun întrebarea:\\\\[0.3cm]
  {\\color{orbitarDeepBlue}\\bfseries „Ce se află acolo, sus?”}}
\\end{center}
\\vfill
\\clearpage

% Pagina 8 PDF (viii, Verso): Pagină intermediară albă înaintea Cuprinsului
\\thispagestyle{empty}
\\mbox{}
\\clearpage

% Pagina 9 PDF (ix, Recto): Cuprinsul general
\\tableofcontents

% Aliniere la multiplu de 4 pagini în frontmatter înaintea începerii blocului principal (\\mainmatter)
\\orbitarPadToModFour{1}

\\mainmatter
\\input{capitole/00-introducere}
\\input{capitole/01-planetele-sistemului-solar}
\\input{capitole/02-corpuri-ceresti-sistem-solar}
\\input{capitole/03-misiuni-spatiale}
\\input{capitole/04-stele-si-exoplanete}
\\input{capitole/05-nebuloase-si-galaxii}
\\input{capitole/06-laborator-nave-si-activitati}
\\input{capitole/07-barem-quiz-si-glosar}

% =============================================================================
% PAGINI INTERMEDIARE DE FINAL ȘI COLOFON (PENTRU TIPAR / BLURB.COM)
% =============================================================================
\\clearpage
\\thispagestyle{empty}
\\vspace*{0.2cm}
\\begin{center}
  {\\color{orbitarCyanDark}\\small\\scshape\\bfseries Jurnalul Astronomic al Cititorului}\\\\[0.15cm]
  {\\color{orbitarDeepBlue}\\Large\\bfseries FIȘĂ DE OBSERVAȚII PE CERUL NOPȚII}\\\\[0.1cm]
  {\\color{orbitarMuted}\\footnotesize Folosește acest tabel pentru a nota propriile tale observații astronomice realizate cu ochiul liber, binoclul, telescopul sau în simulatorul 3D \\textbf{Orbitar}.}
\\end{center}
\\vspace{0.15cm}

\\begin{tcolorbox}[orbitardata, title={\\textbf{Însemnări de teren și jurnal de bord}}]
\\small
\\renewcommand{\\arraystretch}{1.85}
\\begin{tabularx}{\\textwidth}{@{}p{2.6cm}p{3.6cm}p{3.0cm}X@{}}
\\toprule
\\textbf{Data și ora} & \\textbf{Obiectul observat} & \\textbf{Instrumentul} & \\textbf{Observații (culoare, sateliți, cratere)} \\\\
\\midrule
\\dotfill & \\dotfill & \\dotfill & \\dotfill \\\\
\\dotfill & \\dotfill & \\dotfill & \\dotfill \\\\
\\dotfill & \\dotfill & \\dotfill & \\dotfill \\\\
\\dotfill & \\dotfill & \\dotfill & \\dotfill \\\\
\\dotfill & \\dotfill & \\dotfill & \\dotfill \\\\
\\dotfill & \\dotfill & \\dotfill & \\dotfill \\\\
\\bottomrule
\\end{tabularx}
\\end{tcolorbox}

\\vspace{0.35cm}
\\begin{center}
  \\begin{tikzpicture}
    \\draw[orbitarAmber, line width=1.0pt] (-3.5,0) -- (-0.4,0);
    \\fill[orbitarDeepBlue] (0,0) circle (2.5pt);
    \\draw[orbitarAmber, line width=1.0pt] (0.4,0) -- (3.5,0);
  \\end{tikzpicture}\\\\[0.25cm]
  {\\color{orbitarDeepBlue}\\large\\bfseries COLOFON ȘI NOTĂ TIPOGRAFICĂ}
\\end{center}
\\vspace{0.1cm}

\\begin{tcolorbox}[orbitarlightyear]
\\footnotesize
Această ediție a volumului \\textbf{Orbitar: Enciclopedia Cosmică Ilustrată (v${pkgData.version})} a fost generată automat și tehnoredactată computerizat în sistemul tipografic \\LaTeX{} (\\texttt{pdfLaTeX}), folosind familia de fonturi vectoriale \\emph{Latin Modern}, pachetele \\texttt{tcolorbox} și \\texttt{booktabs}, precum și motorul grafic vectorial \\texttt{PGF/TikZ}.\\\\[4pt]
\\textbf{Reconstrucție din surse și tipărire la cerere (Print-on-Demand / Blurb.com):}\\\\
Întregul cod sursă al cărții și al aplicației interactive 3D este disponibil liber în directorul \\texttt{carte/} al depozitului oficial. Volumul poate fi recompilat integral prin comanda \\texttt{npm run build:book} și este calibrat tipografic (cu pagini de gardă la interior și la final, margini în oglindă și număr total de pagini multiplu de 4) pentru tipărire directă prin servicii de tip \\emph{PDF-to-Book} (precum \\textbf{Blurb.com}, Lulu sau tipografii digitale educaționale).\\\\[4pt]
\\textbf{Drepturi de multiplicare pentru școli și biblioteci:}\\\\
Sub termenii licenței libere \\textbf{GNU General Public License v3.0 (\\texttt{GPL-3.0-or-later})}, elevii, profesorii, cluburile de astronomie și bibliotecile au libertatea deplină de a tipări, fotoscana, partaja și utiliza această carte în scop didactic sau personal.
\\end{tcolorbox}

\\vfill
\\begin{center}
  {\\color{orbitarMuted}\\footnotesize Tipărit sub semnul științei deschise \\quad$\\bullet$\\quad \\texttt{https://orbitar.ro}}
\\end{center}
\\clearpage

% Pagină albă de gardă finală (Coperta a III-a / Inside Back Cover) și aliniere automată
% astfel încât Coperta a IV-a (Coperta-spate) să ocupe ultima pagină (multiplu de 4):
\\orbitarPadToModFour{0}

% =============================================================================
% COPERTA IV (COPERTA-SPATE — ULTIMA PAGINĂ PDF, VERSO)
% =============================================================================
\\thispagestyle{empty}
\\begin{tikzpicture}[remember picture, overlay]
  % Fundal cosmic închis identic cu cel al copertei față
  \\fill[orbitarSpaceBg] (current page.south west) rectangle (current page.north east);

  % Arcuri orbitale subtile în fundal
  \\coordinate (BC) at ([yshift=-1.0cm]current page.center);
  \\draw[orbitarCyan!12, line width=0.5pt, dashed] (BC) circle (3.8cm);
  \\draw[orbitarAmber!16, line width=0.7pt] (BC) circle (5.4cm);
  \\draw[white!8, line width=0.4pt] (BC) circle (7.0cm);

  % Stele discrete pe coperta-spate
  \\foreach \\x/\\y/\\r in {-7/11.5/1.0, 6.5/12/1.2, -8/5/0.9, 7.8/6/1.1, -7.2/-3/1.0, 7.5/-4/0.9, -6/-10/1.1, 5.5/-11/1.0} {
    \\fill[white!80] ($(current page.center)+(\\x cm, \\y cm)$) circle (\\r pt);
  }
\\end{tikzpicture}

\\vspace*{0.8cm}
\\begin{center}
  {\\color{orbitarCyan}\\normalsize\\bfseries\\scshape Planetariul Didactic Interactiv 3D}\\\\[0.25cm]
  {\\color{white}\\fontsize{26}{32}\\selectfont\\bfseries ORBITAR}\\\\[0.15cm]
  {\\color{amber!90!yellow}\\large\\bfseries Enciclopedia Cosmică Ilustrată}
\\end{center}

\\vspace{0.5cm}
\\begin{center}
\\begin{tcolorbox}[
  enhanced,
  width=0.88\\textwidth,
  colback=black!85!orbitarSpaceBg,
  colframe=orbitarAmber!80!yellow,
  boxrule=0.8pt,
  arc=5pt,
  coltext=white,
  top=10pt,
  bottom=10pt,
  left=12pt,
  right=12pt
]
\\normalsize
Pornește într-o călătorie științifică și vizuală de la atmosfera incandescentă a Soarelui până la cele mai îndepărtate galaxii observate de Telescopul Spațial James Webb! Născută din baza de cunoștințe a planetariului interactiv 3D \\textbf{Orbitar}, această enciclopedie ilustrată aduce Universul mai aproape de tinerii exploratori, elevi, profesori și pasionați de astronomie.\\\\[8pt]
\\textbf{\\color{amber!90!yellow}Ce vei descoperi în paginile acestei cărți:}\\\\[4pt]
\\begin{itemize}[leftmargin=1.4em, itemsep=3pt, topsep=2pt]
  \\item \\textbf{Orizontul 1 (Sistemul Solar):} Soarele, cele 8 planete împreună cu cei 23 de sateliți naturali majori, planetele pitice (Pluto, Ceres, Eris, Haumea, Makemake), asteroizii și cometele, ilustrate atât ca globuri 3D, cât și prin planigloburi științifice desfășurate.
  \\item \\textbf{Flota Spațială a Omenirii:} 12 misiuni legendare, cuprinzând sonde interplanetare, telescoape spațiale, stații orbitale și rovere marțiene, cu arhitectura lor tehnică explicată pe înțelesul tuturor.
  \\item \\textbf{Orizonturile 2 și 3 (Stele, Exoplanete, Nebuloase și Galaxii):} lumi îndepărtate precum \\emph{Proxima Centauri b}, sistemul \\emph{TRAPPIST-1}, nebuloasele stelare, gaura neagră supermasivă \\emph{Sagittarius A*}, Calea Lactee și galaxia Andromeda.
  \\item \\textbf{Laboratorul Orbitar și Autoevaluare:} experimente interactive de astrofizică, astronavele românești \\emph{Vlaicu-1}, \\emph{Coandă-X} și \\emph{Luceafărul}, glosar astronomic și 74 de întrebări grilă cu barem complet și explicații.
\\end{itemize}
\\end{tcolorbox}
\\end{center}

\\vfill

\\begin{center}
  {\\color{white}\\normalsize\\bfseries Proiect Educațional Open-Source Orbitar}\\\\[4pt]
  {\\color{white!80}\\footnotesize Lucrare liberă publicată sub licența \\textbf{GNU General Public License v3.0} (\\texttt{GPL-3.0-or-later}).\\\\
  Fotografiile și hărțile provin din arhivele NASA, ESA, CSA, STScI (JWST, Hubble), EHT și USGS.}\\\\[6pt]
  {\\color{orbitarCyan}\\small\\bfseries \\texttt{https://orbitar.ro}}
\\end{center}
\\vspace*{0.4cm}

\\end{document}
`;

fs.writeFileSync(path.join(CARTE_DIR, 'orbitar-carte.tex'), mainTex, 'utf8');
console.log('Generat: orbitar-carte.tex');

// ============================================================================
// CAPITOLUL 0: INTRODUCERE ÎN UNIVERSUL ORBITAR (00-introducere.tex)
// ============================================================================
const cap00 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Introducere în Universul Orbitar}
\\label{chap:introducere}

\\textbf{Orbitar} este un planetariu didactic interactiv 3D în limba română, conceput special pentru copiii cu vârste între \\textbf{6 și 12 ani}, pentru orele de științe de la școală (la videoproiector sau tablă interactivă) și pentru explorarea cosmosului acasă. Această carte reunește, într-o formă enciclopedică ilustrată și tipăribilă, toate informațiile științifice, explicațiile pe înțelesul copiilor, analogiile vizuale, curiozitățile, istoricele misiunilor spațiale, laboratoarele interactive și întrebările de verificare din aplicația \\textbf{Orbitar}.

\\section{Cum este organizată această carte}

Fiecare dintre cele \\textbf{74 de corpuri cerești, sateliți naturali, planete pitice, asteroizi, misiuni spațiale, stele, exoplanete, nebuloase și galaxii} din \\textbf{Orbitar} este prezentat într-o formă enciclopedică unitară, prietenoasă dar riguroasă științific:

\\begin{itemize}[leftmargin=1.5em, itemsep=4pt]
  \\item \\textbf{Ilustrații astronomice (glob 3D și planiglob desfășurat / fotografie oficială):} pentru toate corpurile din Sistemul Solar sunt afișate alături atât vederea tridimensională a corpului ceresc, cât și harta sa științifică desfășurată, iar pentru sonde, rovere, exoplanete, nebuloase și galaxii sunt incluse fotografiile oficiale NASA / ESA / JWST / Hubble / EHT.
  \\item \\textbf{Caseta cu repere esențiale:} o sinteză structurată sub formă de listă care reunește clasificarea, distanța de referință, raza, masa raportată la Pământ ($M_\\oplus$), gravitația de suprafață ($g_\\oplus$), perioada orbitală, rotația, temperatura medie, elementele kepleriene, durata călătoriei de pe Pământ (cu lumina, racheta, avionul și mașina) și analogia intuitivă de scară.
  \\item \\textbf{Descriere amplă în proză:} text narativ structurat pe trei direcții complementare (\\emph{prezentarea generală și profilul astrofizic}, \\emph{alcătuirea fizică și structura internă pe straturi} ori \\emph{arhitectura tehnică și instrumentele științifice de la bord} în cazul sondelor, telescoapelor și roverelor, respectiv \\emph{observațiile astronomice și istoricul explorării}), urmat de o întrebare grilă de verificare.
\\end{itemize}

\\section{Cele 3 Orizonturi Cosmice din Orbitar}

Universul este atât de vast încât nicio unitate de măsură unică nu poate descrie comod atât distanța de la Pământ la Stația Spațială Internațională (aproximativ $420\\text{ de kilometri}$), cât și distanța până la Galaxia Sombrero ($29{,}3\\text{ milioane de ani-lumină}$). De aceea, \\textbf{Orbitar} (prin modulul \\texttt{CosmicScaleNavigator}) organizează explorarea spațiului pe \\textbf{3 Orizonturi Cosmice}:

\\begin{center}
\\begin{tikzpicture}[
  box/.style={rectangle, rounded corners=4pt, draw=orbitarDeepBlue, line width=0.9pt, fill=orbitarCadetBg, text width=4.4cm, minimum height=3.1cm, align=center, font=\\small},
  arrow/.style={-{Stealth[length=3mm, width=2mm]}, line width=1.2pt, color=orbitarAmber}
]
  \\node[box, fill=orbitarJuniorBg, draw=orbitarAmber] (h1) at (0,0) {
    \\textbf{\\color{orbitarDeepBlue}Orizontul 1}\\\\[2pt]
    \\textbf{Sistemul Solar}\\\\[4pt]
    {\\footnotesize 54 de corpuri \\& misiuni:\\\\Soarele, 8 planete, 23 de luni,\\\\5 planete pitice, 5 asteroizi,\\\\2 centuri \\& 12 misiuni}\\\\[3pt]
    \\textbf{\\color{orbitarAmber}Scara: km \\& UA}
  };

  \\node[box, fill=orbitarCadetBg, draw=orbitarCyanDark] (h2) at (5.4,0) {
    \\textbf{\\color{orbitarDeepBlue}Orizontul 2}\\\\[2pt]
    \\textbf{Stele \\& Exoplanete}\\\\[4pt]
    {\\footnotesize 7 sisteme în vecinătatea\\\\stelară: Norul lui Oort,\\\\Proxima b, Sirius A\\&B,\\\\TRAPPIST-1, 55 Cancri e,\\\\Pleiadele, Betelgeuse}\\\\[3pt]
    \\textbf{\\color{orbitarCyanDark}Scara: 1 -- 640 a.l.}
  };

  \\node[box, fill=orbitarQuizBg, draw=orbitarViolet] (h3) at (10.8,0) {
    \\textbf{\\color{orbitarDeepBlue}Orizontul 3}\\\\[2pt]
    \\textbf{Calea Lactee \\& Galaxii}\\\\[4pt]
    {\\footnotesize 13 obiecte galactice \\&\\\\extragalactice: 6 nebuloase,\\\\Sagittarius A*, Calea Lactee\\\\și 5 galaxii exterioare}\\\\[3pt]
    \\textbf{\\color{orbitarViolet}Scara: mii -- mil. a.l.}
  };

  \\draw[arrow] (h1.east) -- (h2.west);
  \\draw[arrow] (h2.east) -- (h3.west);
\\end{tikzpicture}
\\end{center}

\\section{Unitățile de măsură ale astronomilor și scara didactică}

Pentru a înțelege cifrele din fișele tehnice ale cărții, iată reperele fundamentale folosite în \\textbf{Orbitar}:

\\begin{tcolorbox}[orbitardata, title={\\textbf{Repere Fundamentale de Distanță, Timp și Gravitație în Orbitar}}]
\\begin{itemize}[leftmargin=1.4em, itemsep=3pt]
  \\item \\textbf{Unitatea Astronomică ($1\\text{ UA}$):} reprezintă distanța medie dintre Pământ și Soare, egală exact cu $149.597.870{,}7$ kilometri (aproximativ $150\\text{ de milioane de kilometri}$). Planeta Mercur se află la $0{,}387\\text{ UA}$, Pământul la $1{,}000\\text{ UA}$, Jupiter la $5{,}204\\text{ UA}$, Neptun la $30{,}07\\text{ UA}$, iar planeta pitică Eris la $67{,}78\\text{ UA}$.
  \\item \\textbf{Viteza Luminii ($1c$):} în vid, lumina și undele radio călătoresc cu $299.792{,}458$ kilometri pe secundă (aproximativ $300.000$ de kilometri pe secundă sau $1.079.252.848{,}8$ kilometri pe oră). O rază de lumină face $1{,}3\\text{ secunde}$ de la Lună la Pământ și $8\\text{ minute și } 20\\text{ de secunde}$ de la Soare la Pământ.
  \\item \\textbf{Anul-Lumină (a.l.):} este o unitate de \\textbf{distanță} (nu de timp!), egală cu drumul parcurs de o rază de lumină într-un an pământesc întreg: aproximativ $9.460\\text{ de miliarde de kilometri}$ ($63.241\\text{ UA}$).
  \\item \\textbf{Masa și Gravitația raportate la Pământ ($M_\\oplus$ și $g_\\oplus$):} Pământul are raza medie de $6.371$ de kilometri, accelerația gravitațională $1{,}00\\,g_\\oplus$ ($9{,}81\\text{ m/s}^2$) și masa $1{,}00\\,M_\\oplus$ ($5{,}97 \\times 10^{24}$ kilograme). Dacă o planetă are gravitația $0{,}38 \\times g_\\oplus$ (cum sunt Mercur și Marte), acolo vei cântări doar $38\\%$ din greutatea de pe Pământ și vei putea sări de aproape trei ori mai sus!
  \\item \\textbf{Scară Didactică vs. Scară Reală:} în modul \\emph{Scară Reală}, proporțiile dintre razele planetelor și distanțele în UA sunt cele fizice exacte (unde planetele par puncte minuscule în imensitatea spațiului). În modul \\emph{Scară Didactică}, \\textbf{Orbitar} mărește logaritmic corpurile și alocă culoare orbitale disjuncte pentru ca niciun satelit sau inel planetar să nu se intersecteze vizual cu planeta-mamă.
\\end{itemize}
\\end{tcolorbox}

\\clearpage
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '00-introducere.tex'), cap00, 'utf8');
console.log('Generat: capitole/00-introducere.tex');

// ============================================================================
// CAPITOLUL 1: STEAUA NOASTRĂ, PLANETELE ȘI SATELIȚII LOR NATURALI
// ============================================================================
const sunAndPlanetsIds = [
  'sun',
  'mercury',
  'venus',
  'earth',
  'mars',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
];
const sunAndPlanets = sunAndPlanetsIds
  .map((id) => solarData.bodies.find((b) => b.id === id))
  .filter(Boolean);

const moonsOrder = [
  'moon',
  'phobos',
  'deimos',
  'io',
  'europa',
  'ganymede',
  'callisto',
  'mimas',
  'enceladus',
  'tethys',
  'dione',
  'rhea',
  'titan',
  'hyperion',
  'iapetus',
  'phoebe',
  'miranda',
  'ariel',
  'umbriel',
  'titania',
  'oberon',
  'triton',
  'charon',
];
const moonsList = moonsOrder
  .map((id) => solarData.bodies.find((b) => b.id === id))
  .filter(Boolean);

const apolloSurfaceMarkersBox = `
\\begin{tcolorbox}[orbitarcadet, title={\\textbf{Repere Istorice pe Globul Lunii în Orbitar (\\texttt{SurfaceMarkers.ts})}}]
Când te apropii cu camera 3D de \\textbf{Lună} în aplicația \\textbf{Orbitar}, pe suprafața ei se activează trei pini geografici interactivi care marchează locurile istorice unde astronauții programului \\textbf{NASA Apollo} au pășit pe solul selenar:
\\begin{itemize}[leftmargin=1.4em, itemsep=3pt]
  \\item \\textbf{Marea Liniștii (Apollo 11, $0{,}67^\\circ\\text{ N}, 23{,}47^\\circ\\text{ E}$, 20 iulie 1969):} locul istoric din \\emph{Mare Tranquillitatis} unde modulul lunar «Eagle» pilotat de \\textbf{Neil Armstrong} și \\textbf{Buzz Aldrin} a aselenizat, iar oamenii au pășit pentru prima dată pe un alt corp ceresc: \\emph{„Un pas mic pentru om, un salt uriaș pentru omenire!”}
  \\item \\textbf{Mons Hadley (Apollo 15, $26{,}13^\\circ\\text{ N}, 3{,}63^\\circ\\text{ E}$, 30 iulie 1971):} situat în Munții Apenini Lunari, lângă canalul vulcanic \\emph{Hadley Rille}; prima misiune în care astronauții \\textbf{David Scott} și \\textbf{James Irwin} au condus automobilul electric \\emph{Lunar Roving Vehicle (LRV)} și au descoperit faimoasa «Piatră a Genezei».
  \\item \\textbf{Valea Taurus-Littrow (Apollo 17, $20{,}19^\\circ\\text{ N}, 30{,}77^\\circ\\text{ E}$, 11 decembrie 1972):} cea mai recentă aselenizare cu echipaj uman (\\textbf{Eugene Cernan} și geologul \\textbf{Harrison Schmitt}), care a condus la descoperirea solului portocaliu din micro-sfere de sticlă vulcanică lunară.
\\end{itemize}
\\end{tcolorbox}
`;

let quizCounter = 1;
const orderedSolarBodies = [];

const planetsTableRows = sunAndPlanets
  .map((b) => {
    const catShort =
      b.category === 'star'
        ? 'Stea (G2V)'
        : b.category === 'terrestrial'
        ? 'Telurică'
        : b.category === 'gas_giant'
        ? 'Gigant gazos'
        : 'Gigant gheață';
    return `${texEscape(b.name)} & ${catShort} & ${fmtNum(b.distanceFromSunAU, 2)} & ${fmtNum(b.radiusKm)} & ${fmtNum(b.massEarthRatio, 2)} & ${fmtNum(b.gravityRatio, 2)} & ${fmtNum(b.meanTempC)}$^\\circ$C \\\\`;
  })
  .join('\n');

const moonsTableRows = moonsList
  .map((m) => {
    const pName = PARENT_NAMES_RO[m.parentId] || m.parentId;
    const periodLabel =
      m.orbitPeriodDays < 0
        ? `${fmtNum(Math.abs(m.orbitPeriodDays), 2)} zile (retrograd)`
        : `${fmtNum(m.orbitPeriodDays, 2)} zile`;
    return `${texEscape(m.name)} & ${texEscape(pName)} & ${fmtNum(m.radiusKm, 1)} & ${fmtNum(m.gravityRatio, 3)} & ${periodLabel} & ${fmtNum(m.meanTempC)}$^\\circ$C \\\\`;
  })
  .join('\n');

const cap01BodiesTex = sunAndPlanets
  .map((planet) => {
    orderedSolarBodies.push(planet);
    let block = renderBodySection(planet, quizCounter++, 'section');
    const planetMoons = moonsList.filter((m) => m.parentId === planet.id);
    if (planetMoons.length > 0) {
      for (const moon of planetMoons) {
        orderedSolarBodies.push(moon);
        block +=
          '\n' +
          renderBodySection(
            moon,
            quizCounter++,
            'subsection',
            moon.id === 'moon' ? apolloSurfaceMarkersBox : ''
          );
      }
    }
    return block;
  })
  .join('\n');

const cap01 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Steaua Noastră, Planetele și Sateliții Lor Naturali}
\\label{chap:planete}

Sistemul nostru Solar s-a format acum aproximativ \\textbf{4,6 miliarde de ani} din prăbușirea gravitațională a unui nor molecular gigant de gaz și praf interstelar. Peste $99{,}86\\%$ din întreaga masă a sistemului s-a concentrat în centru, dând naștere stelei noastre, \\textbf{Soarele}, în timp ce din discul protoplanetar rămas s-au format \\textbf{cele 8 planete majore} și \\textbf{sateliții lor naturali (lunile)}, care sunt prezentate în acest capitol împreună cu planeta în jurul căreia orbitează:
\\begin{enumerate}[leftmargin=1.6em, itemsep=2pt]
  \\item \\textbf{Planetele Interioare Telurice (Stâncoase):} \\emph{Mercur} și \\emph{Venus} (fără sateliți naturali), \\emph{Pământul} (însoțit de \\emph{Lună}) și \\emph{Marte} (însoțit de sateliții săi capturați \\emph{Phobos} și \\emph{Deimos}).
  \\item \\textbf{Planetele Exterioare Gigante și Sistemele Lor de Sateliți:} \\emph{Giganții Gazoși}, reprezentați de \\emph{Jupiter} (cu cele 4 luni galileene: \\emph{Io, Europa, Ganymede, Callisto}) și \\emph{Saturn} (cu \\emph{Mimas, Enceladus, Tethys, Dione, Rhea, Titan, Hyperion, Iapetus, Phoebe}), precum și \\emph{Giganții de Gheață}, reprezentați de \\emph{Uranus} (cu \\emph{Miranda, Ariel, Umbriel, Titania, Oberon}) și \\emph{Neptun} (cu satelitul retrograd \\emph{Triton}).
\\end{enumerate}

\\begin{center}
\\resizebox{\\textwidth}{!}{%
\\begin{tikzpicture}[scale=0.88, every node/.style={transform shape}]
  \\fill[orbitarSpaceBg, rounded corners=6pt] (-0.8,-1.8) rectangle (15.6,2.1);
  % Soarele
  \\shade[inner color=yellow!95!white, outer color=orange!90!red] (0.2,0) circle (0.72cm);
  \\node[white, font=\\scriptsize\\bfseries] at (0.2,-1.15) {Soarele};

  % Mercur
  \\fill[gray!70] (1.7,0) circle (0.10cm);
  \\node[white, font=\\scriptsize] at (1.7,0.55) {Mercur};
  \\node[orbitarCyan, font=\\tiny] at (1.7,-0.55) {0,39 UA};

  % Venus
  \\fill[yellow!75!orange] (3.0,0) circle (0.18cm);
  \\node[white, font=\\scriptsize] at (3.0,0.65) {Venus};
  \\node[orbitarCyan, font=\\tiny] at (3.0,-0.55) {0,72 UA};

  % Pământ
  \\fill[cyan!70!blue] (4.4,0) circle (0.19cm);
  \\node[white, font=\\scriptsize\\bfseries] at (4.4,0.65) {Pământ};
  \\node[orbitarCyan, font=\\tiny] at (4.4,-0.55) {1,00 UA};

  % Marte
  \\fill[orange!85!red] (5.8,0) circle (0.14cm);
  \\node[white, font=\\scriptsize] at (5.8,0.60) {Marte};
  \\node[orbitarCyan, font=\\tiny] at (5.8,-0.55) {1,52 UA};

  % Centura de asteroizi
  \\draw[gray!60, line width=2.2pt, dotted] (6.9,-1.3) -- (6.9,1.3);
  \\node[gray!40, font=\\tiny, rotate=90] at (6.65,0) {Centura de Asteroizi};

  % Jupiter
  \\fill[orange!65!brown] (8.3,0) circle (0.50cm);
  \\node[white, font=\\scriptsize\\bfseries] at (8.3,0.88) {Jupiter};
  \\node[orbitarCyan, font=\\tiny] at (8.3,-0.85) {5,20 UA};

  % Saturn
  \\fill[yellow!70!brown] (10.4,0) circle (0.42cm);
  \\draw[white!80, line width=1.2pt] (10.4,0) ellipse (0.72cm and 0.18cm);
  \\node[white, font=\\scriptsize\\bfseries] at (10.4,0.85) {Saturn};
  \\node[orbitarCyan, font=\\tiny] at (10.4,-0.80) {9,58 UA};

  % Uranus
  \\fill[cyan!60!white] (12.5,0) circle (0.28cm);
  \\node[white, font=\\scriptsize] at (12.5,0.72) {Uranus};
  \\node[orbitarCyan, font=\\tiny] at (12.5,-0.68) {19,20 UA};

  % Neptun
  \\fill[blue!70!cyan] (14.3,0) circle (0.27cm);
  \\node[white, font=\\scriptsize] at (14.3,0.72) {Neptun};
  \\node[orbitarCyan, font=\\tiny] at (14.3,-0.68) {30,07 UA};
\\end{tikzpicture}%
}
\\end{center}

\\begin{table}[H]
\\centering
\\small
\\caption{Tabel sinoptic comparativ: Soarele și cele 8 planete ale Sistemului Solar în Orbitar}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}llrrrrr@{}}
\\toprule
\\textbf{Corp ceresc} & \\textbf{Clasă} & \\textbf{Distanță (UA)} & \\textbf{Rază (km)} & \\textbf{Masă ($M_\\oplus$)} & \\textbf{Gravitație ($g_\\oplus$)} & \\textbf{Temp. medie} \\\\
\\midrule
${planetsTableRows}
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\begin{table}[H]
\\centering
\\small
\\caption{Tabel sinoptic al celor 23 de sateliți naturali majori din Orbitar (asociați cu planetele lor)}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}llrrrr@{}}
\\toprule
\\textbf{Satelit (Lună)} & \\textbf{Planeta-mamă} & \\textbf{Rază (km)} & \\textbf{Gravitație ($g_\\oplus$)} & \\textbf{Perioadă orbitală} & \\textbf{Temp. medie} \\\\
\\midrule
${moonsTableRows}
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\clearpage
${cap01BodiesTex}
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '01-planetele-sistemului-solar.tex'), cap01, 'utf8');
console.log('Generat: capitole/01-planetele-sistemului-solar.tex');

// ============================================================================
// CAPITOLUL 2: CENTURI COSMICE, PLANETE PITICE ȘI ASTEROIZI
// ============================================================================
const dwarfsList = ['ceres', 'pluto', 'haumea', 'makemake', 'eris']
  .map((id) => solarData.bodies.find((b) => b.id === id))
  .filter(Boolean);

const asteroidsList = ['vesta', 'pallas', 'psyche', 'bennu', 'apophis']
  .map((id) => solarData.bodies.find((b) => b.id === id))
  .filter(Boolean);

const dwarfsAsteroidsTableRows = [...dwarfsList, ...asteroidsList]
  .map((b) => {
    const catName = b.category === 'dwarf' ? 'Planetă pitică' : 'Asteroid';
    return `${texEscape(b.name)} & ${catName} & ${fmtNum(b.distanceFromSunAU, 2)} UA & ${fmtNum(b.radiusKm, 2)} & ${fmtNum(b.orbitPeriodDays / 365.25, 2)} ani & ${fmtNum(b.meanTempC)}$^\\circ$C \\\\`;
  })
  .join('\n');

const beltsTex = solarData.belts
  .map(
    (belt) => `
\\subsection{${texEscape(belt.name)}}
\\begin{tcolorbox}[orbitardata, title={\\textbf{Parametrii Regiunii Toroidale — ${texEscape(belt.name)}}}]
\\begin{tabularx}{\\textwidth}{@{}lX@{}}
\\textbf{Rază interioară -- exterioară} & ${fmtNum(belt.innerRadiusAU, 2)} UA -- ${fmtNum(belt.outerRadiusAU, 2)} UA față de Soare \\\\
\\textbf{Grosime verticală în modelul 3D} & ${fmtNum(belt.thicknessAU, 2)} UA (${fmtNum(belt.count)} asteroizi/corpuri randate prin \\texttt{THREE.InstancedMesh}) \\\\
\\textbf{Descriere științifică} & ${texEscape(belt.descriptionRo)} \\\\
\\end{tabularx}
\\end{tcolorbox}
`
  )
  .join('\n');

const dwarfsTex = dwarfsList
  .map((d) => {
    orderedSolarBodies.push(d);
    let block = renderBodySection(d, quizCounter++, 'subsection');
    const dwarfMoons = moonsList.filter((m) => m.parentId === d.id);
    for (const moon of dwarfMoons) {
      orderedSolarBodies.push(moon);
      block += '\n' + renderBodySection(moon, quizCounter++, 'subsection');
    }
    return block;
  })
  .join('\n');

const asteroidsTex = asteroidsList
  .map((a) => {
    orderedSolarBodies.push(a);
    return renderBodySection(a, quizCounter++, 'subsection');
  })
  .join('\n');

const cap02 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Centuri Cosmice, Planete Pitice și Asteroizi}
\\label{chap:corpuri-sistem-solar}

Dincolo de cele 8 planete majore și sateliții lor naturali prezentați în Capitolul~\\ref{chap:planete}, Sistemul Solar adăpostește \\textbf{două centuri uriașe de corpuri minore} (Centura Principală de Asteroizi și Centura Kuiper), \\textbf{5 planete pitice recunoscute de Uniunea Astronomică Internațională} (împreună cu satelitul binar \\textbf{Charon}, asociat planetei pitice \\textbf{Pluto}) și \\textbf{5 asteroizi emblematici}.

\\section{Centura Principală de Asteroizi și Centura Kuiper}
\\label{sec:centuri}

În \\textbf{Orbitar}, mii de corpuri stâncoase și înghețate sunt simulate simultan în timp real în cele două mari centuri circumsolare:

${beltsTex}

\\begin{tcolorbox}[orbitarjunior, title={\\textbf{Mit vs. Realitate: Cum arată în realitate zborul printr-o centură de asteroizi?}}]
În filmele SF, navele spațiale trebuie să facă slalom periculos printre stânci uriașe înghesuite unele lângă altele. \\textbf{În realitate}, Centura de Asteroizi și Centura Kuiper sunt atât de vaste încât distanța medie dintre doi asteroizi de dimensiuni notabile este de \\textbf{sute de mii sau milioane de kilometri} (de câteva ori distanța de la Pământ la Lună!). Toate sondele trimise de NASA și ESA (precum \\emph{Pioneer}, \\emph{Voyager}, \\emph{Galileo}, \\emph{Cassini}, \\emph{New Horizons} și \\emph{JUICE}) au traversat centura fără să lovească absolut nimic!
\\end{tcolorbox}

\\begin{table}[H]
\\centering
\\small
\\caption{Planetele pitice și asteroizii principali din Orbitar}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}llrrrr@{}}
\\toprule
\\textbf{Nume} & \\textbf{Categorie} & \\textbf{Distanță Soare} & \\textbf{Rază medie (km)} & \\textbf{Perioadă orbitală} & \\textbf{Temp. medie} \\\\
\\midrule
${dwarfsAsteroidsTableRows}
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\clearpage
\\section{Cele 5 Planete Pitice și Sistemul Binar Pluto--Charon}
${dwarfsTex}

\\section{Asteroizi Principali și Obiecte din Apropierea Pământului}
${asteroidsTex}
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '02-corpuri-ceresti-sistem-solar.tex'), cap02, 'utf8');
console.log('Generat: capitole/02-corpuri-ceresti-sistem-solar.tex');

// ============================================================================
// CAPITOLUL 3: OBIECTE LANSATE DE OM (STAȚII, TELESCOAPE, SONDE ȘI ROVERE)
// ============================================================================
const missionsList = missionsData.missions;

const missionsTableRows = missionsList
  .map((m) => {
    const catName = CATEGORY_LABELS_RO[m.category] || m.category;
    const pName = m.parentId ? PARENT_NAMES_RO[m.parentId] || m.parentId : 'Soarele (Heliocentric)';
    return `${texEscape(m.name)} & ${texEscape(catName)} & ${texEscape(pName)} & ${fmtNum(m.distanceFromSunAU, 2)} UA & ${fmtNum(m.meanTempC)}$^\\circ$C \\\\`;
  })
  .join('\n');

const missionsTex = missionsList
  .map((m) => renderBodySection(m, quizCounter++, 'section'))
  .join('\n');

const issTle = tleData.satellites.iss;
const hubbleTle = tleData.satellites.hubble;

const cap03 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Obiecte Lansate de Om: Stații Spațiale, Telescoape, Sonde și Rovere}
\\label{chap:misiuni}

Începând cu a doua jumătate a secolului XX, omenirea a trimis în cosmos laboratoare orbitale locuite de astronauți, telescoape spațiale plasate deasupra atmosferei terestre, sonde automate care au explorat fiecare planetă a Sistemului Solar și rovere robotice care analizează rocile de pe Marte. În \\textbf{Orbitar} sunt modelate 3D și urmărite orbital \\textbf{12 misiuni spațiale emblematice}.

\\section*{Unde zboară misiunile spațiale? De la Orbita Joasă (LEO) la Punctul Lagrange L2 și Spațiul Interstelar}

\\begin{itemize}[leftmargin=1.5em, itemsep=3pt]
  \\item \\textbf{Orbita Joasă a Pământului (LEO, \\emph{Low Earth Orbit}):} situată între $400$ și $600$ de kilometri altitudine deasupra Pământului. Aici zboară \\textbf{Stația Spațială Internațională (ISS)} și \\textbf{Telescopul Spațial Hubble} cu o viteză orbitală de aproape $28.000$ de kilometri pe oră, înconjurând globul pământesc o dată la fiecare $90\\text{--}95\\text{ de minute}$. În \\textbf{Orbitar}, poziția lor exactă (latitudine, longitudine, altitudine și viteză) este calculată în timp real prin modelul fizic de perturbații \\textbf{SGP4} (\\texttt{satellite.js}) din elementele orbitale \\textbf{NORAD Two-Line Element (TLE)}.
  \\item \\textbf{Punctul Lagrange L2 Soare--Pământ ($1{,}5\\text{ milioane de kilometri}$ de Pământ):} un punct de echilibru gravitațional și centrifugal situat pe linia Soare--Pământ, în spatele Pământului. Aici orbitează \\textbf{Telescopul Spațial James Webb (JWST)} și \\textbf{Telescopul Spațial Euclid}, astfel încât scuturile lor termice să blocheze simultan căldura Soarelui, a Pământului și a Lunii!
  \\item \\textbf{Traiectorii interplanetare și interstelare:} sonde precum \\textbf{Parker Solar Probe} (care plonjează în coroana Soarelui), \\textbf{Rosetta} (care a însoțit cometa 67P), \\textbf{JUICE} (în drum spre lunile înghețate ale lui Jupiter), \\textbf{New Horizons} (în Centura Kuiper) și gemenele \\textbf{Voyager 1 \\& 2} (aflate deja în spațiul interstelar!).
  \\item \\textbf{Suprafața planetei Marte:} roverele nucleare \\textbf{Curiosity} (în Craterul Gale) și \\textbf{Perseverance \\& elicopterul Ingenuity} (în Craterul Jezero), ancorate în \\textbf{Orbitar} direct pe coordonatele lor areografice reale de pe globul rotitor al lui Marte.
\\end{itemize}

\\begin{center}
\\begin{tikzpicture}[scale=0.92, every node/.style={transform shape}]
  \\fill[orbitarSpaceBg, rounded corners=6pt] (-1.2,-2.2) rectangle (13.4,2.2);
  % Soarele
  \\shade[inner color=yellow!95!white, outer color=orange!90!red] (0.4,0) circle (0.85cm);
  \\node[white, font=\\footnotesize\\bfseries] at (0.4,-1.3) {Soarele};

  % Pământul
  \\fill[cyan!75!blue] (6.8,0) circle (0.34cm);
  \\node[white, font=\\footnotesize\\bfseries] at (6.8,-0.85) {Pământul (1 UA)};

  % Orbita LEO (ISS & Hubble)
  \\draw[orbitarCyan, line width=0.8pt, dashed] (6.8,0) circle (0.58cm);
  \\node[orbitarCyan, font=\\scriptsize, align=center] at (6.8,1.15) {Orbita LEO ($\\sim$420--540 km)\\\\ISS \\& Hubble};

  % Orbita Lunii
  \\draw[white!40, line width=0.6pt] (6.8,0) circle (1.45cm);
  \\fill[gray!60] (6.8,-1.45) circle (0.11cm);
  \\node[white!80, font=\\tiny] at (7.8,-1.55) {Luna (384.400 km)};

  % Punctul Lagrange L2
  \\draw[orbitarAmber, line width=1.0pt, dashed] (11.2,0) ellipse (0.55cm and 1.1cm);
  \\fill[orbitarAmber] (11.2,0) circle (0.10cm);
  \\node[amber!90!yellow, font=\\footnotesize\\bfseries, align=center] at (11.2,1.50) {Punctul Lagrange L2\\\\JWST \\& Euclid};
  \\node[white!85, font=\\scriptsize, align=center] at (11.2,-1.50) {1,5 mil. km de Pământ\\\\(Scutul termic spre Soare)};

  \\draw[-{Stealth}, white!50, dashed] (1.4,0) -- (6.1,0) node[midway, above, font=\\scriptsize, text=white!80] {150 milioane km (1 UA)};
  \\draw[-{Stealth}, amber!80, dashed] (7.3,0) -- (10.5,0) node[midway, above, font=\\scriptsize, text=amber!80!yellow] {1,5 mil. km};
\\end{tikzpicture}
\\end{center}

\\begin{table}[H]
\\centering
\\small
\\caption{Cele 12 misiuni spațiale (stații, telescoape, sonde și rovere) prezente în Orbitar}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}lllrr@{}}
\\toprule
\\textbf{Misiune / Obiect} & \\textbf{Tip} & \\textbf{Corp central / Regiune} & \\textbf{Distanță Soare} & \\textbf{Temp. operare} \\\\
\\midrule
${missionsTableRows}
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\begin{tcolorbox}[orbitardata, title={\\textbf{Propagare Orbitală SGP4 100\\% Offline în Orbitar (\\texttt{public/data/tle-iss.json})}}]
Pentru a calcula poziția deasupra continentelor fără a depinde de internet, \\textbf{Orbitar} integrează algoritmul astrodinamic \\textbf{SGP4} cu seturile oficiale \\textbf{NORAD Two-Line Element (TLE)}:
\\begin{itemize}[leftmargin=1.4em, itemsep=3pt]
  \\item \\textbf{${refineProse(issTle.name)} (NORAD ID ${issTle.noradId}):} altitudine nominală aproximativ ${fmtNum(issTle.nominalAltitudeKm, 1)} de kilometri, viteză orbitală aproximativ ${fmtNum(issTle.nominalVelocityKmh)} de kilometri pe oră ($15{,}49\\text{ orbite/zi}$, înclinație $51{,}64^\\circ$).\\\\
  {\\scriptsize\\texttt{${texEscape(issTle.line1)}}}\\\\
  {\\scriptsize\\texttt{${texEscape(issTle.line2)}}}
  \\item \\textbf{${refineProse(hubbleTle.name)} (NORAD ID ${hubbleTle.noradId}):} altitudine nominală aproximativ ${fmtNum(hubbleTle.nominalAltitudeKm, 1)} de kilometri, viteză orbitală aproximativ ${fmtNum(hubbleTle.nominalVelocityKmh)} de kilometri pe oră ($15{,}12\\text{ orbite/zi}$, înclinație $28{,}47^\\circ$).\\\\
  {\\scriptsize\\texttt{${texEscape(hubbleTle.line1)}}}\\\\
  {\\scriptsize\\texttt{${texEscape(hubbleTle.line2)}}}
\\end{itemize}
\\end{tcolorbox}

\\begin{tcolorbox}[orbitarjunior, title={\\textbf{Discul de Aur Voyager (1977) și Salutul în Limba Română din Spațiul Interstelar}}]
La bordul ambelor sonde \\textbf{Voyager 1} și \\textbf{Voyager 2} (lansate în august--septembrie 1977) se află \\textbf{Discul de Aur (\\emph{Voyager Golden Record})}, un disc de cupru placat cu aur cu diametrul de $30$ de centimetri, conceput de o comisie condusă de astronomul \\textbf{Carl Sagan} ca o „sticlă cu mesaj în oceanul cosmic”. Discul conține 115 imagini codate analogic, sunete ale naturii terestre, 90 de minute de muzică (Bach, Beethoven, Mozart, folclor mondial) și \\textbf{saluturi rostite în 55 de limbi ale Pământului}.\\\\[4pt]
Printre cele 55 de limbi se află și \\textbf{limba română}, cu mesajul rostit de \\textbf{Sanda Huffman}:\\\\
\\begin{center}
{\\Large\\bfseries\\color{orbitarDeepBlue}„Salutări la toată lumea!”}
\\end{center}
În aplicația \\textbf{Orbitar}, când selectezi \\emph{Voyager 1} sau \\emph{Voyager 2}, poți asculta acest salut istoric direct din caseta dedicată a \\textbf{Laboratorului Orbitar}!
\\end{tcolorbox}

\\begin{tcolorbox}[orbitarcadet, title={\\textbf{Atlasul Reperelor Geografice și al Roverelor de pe Marte în Orbitar (\\texttt{SurfaceMarkers.ts})}}]
Pe globul 3D al planetei \\textbf{Marte}, aplicația \\textbf{Orbitar} afișează 6 pini geografici interactivi care marchează rovere active, cratere lacustre fosile și cel mai înalt vulcan din Sistemul Solar:
\\begin{enumerate}[leftmargin=1.5em, itemsep=3pt]
  \\item \\textbf{Roverul Perseverance \\& Elicopterul Ingenuity ($18{,}38^\\circ\\text{ N}, 77{,}58^\\circ\\text{ E}$, 2021):} laborator astrobiologic mobil de $1.025$ de kilograme amartizat în Craterul Jezero; caută biosemnături străvechi, sigilează tuburi cu mostre de rocă, a produs oxigen pe Marte prin experimentul \\emph{MOXIE} și a adus elicopterul \\emph{Ingenuity} (care a realizat 72 de zboruri propulsate!).
  \\item \\textbf{Roverul Curiosity, Mars Science Laboratory ($4{,}58^\\circ\\text{ S}, 137{,}44^\\circ\\text{ E}$, 2012):} rover nuclear de $899$ de kilograme care explorează Craterul Gale și urcă pe straturile Muntelui Sharp; a demonstrat că Marte a avut râuri și lacuri cu apă dulce capabile să susțină viața microbiană.
  \\item \\textbf{Craterul Jezero ($18{,}85^\\circ\\text{ N}, 77{,}52^\\circ\\text{ E}$):} crater de impact cu diametrul de $45$ de kilometri care, acum peste $3{,}5\\text{ miliarde de ani}$, adăpostea un lac adânc alimentat de un râu, a cărui deltă fluvială fosilă păstrează sedimente de argilă și carbonați.
  \\item \\textbf{Craterul Gale \\& Muntele Sharp / Aeolis Mons ($5{,}4^\\circ\\text{ S}, 137{,}8^\\circ\\text{ E}$):} bazin sedimentar cu diametrul de $154$ de kilometri în centrul căruia se înalță \\emph{Aeolis Mons} ($5.500$ de metri altitudine), ale cărui straturi de argile și sulfați arată tranziția lui Marte de la o planetă caldă și umedă la un deșert înghețat.
  \\item \\textbf{Vulcanul Olympus Mons ($18{,}65^\\circ\\text{ N}, 133{,}8^\\circ\\text{ V}$):} vulcan-scut gigantic din regiunea Tharsis, cu înălțimea de $21{,}9$ kilometri (de aproape trei ori mai înalt decât Muntele Everest de pe Pământ!) și o bază cu lățimea de $600$ de kilometri, comparabilă cu suprafața României!
  \\item \\textbf{Chryse Planitia, Sonda Viking 1 ($22{,}27^\\circ\\text{ N}, 47{,}95^\\circ\\text{ V}$, 20 iulie 1976):} prima sondă din istorie care a amartizat cu succes și a transmis fotografii color direct de pe solul marțian, funcționând timp de peste 6 ani.
\\end{enumerate}
\\end{tcolorbox}

\\clearpage
${missionsTex}
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '03-misiuni-spatiale.tex'), cap03, 'utf8');
console.log('Generat: capitole/03-misiuni-spatiale.tex');

// ============================================================================
// CAPITOLUL 4: DINCOLO DE SOARE — STELE APROPIATE ȘI EXOPLANETE (Orizontul 2)
// ============================================================================
const interstellarObjects = deepSpaceData.objects.filter((o) => o.horizon === 'interstellar');

const interstellarTableRows = interstellarObjects
  .map((o) => {
    const catName = CATEGORY_LABELS_RO[o.category] || o.category;
    return `${texEscape(o.name)} & ${texEscape(catName)} & ${texEscape(o.distanceLightYearsLabelRo || `${o.distanceLightYears} a.l.`)} & ${fmtNum(o.meanTempC)}$^\\circ$C \\\\`;
  })
  .join('\n');

const interstellarTex = interstellarObjects
  .map((o) => renderBodySection(o, quizCounter++, 'section'))
  .join('\n');

const cap04 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Dincolo de Soare: Stele Apropiate și Exoplanete}
\\label{chap:exoplanete}

Când comutăm în \\textbf{Orbitar} de la \\emph{Orizontul 1 (Sistemul Solar)} la \\textbf{Orizontul 2 („Stele și Exoplanete”)}, părăsim căldura Soarelui nostru și pășim în \\textbf{vecinătatea stelară}, unde distanțele nu se mai măsoară în kilometri sau Unități Astronomice, ci în \\textbf{ani-lumină} ($1\\text{ an-lumină}$ reprezintă aproximativ $9.460$ de miliarde de kilometri). În centrul scenei 3D rămâne aprins farul interactiv \\textbf{„Aici este Sistemul nostru Solar (Acasă)”}, înconjurat de cele mai fascinante sisteme stelare și exoplanetare din jurul nostru.

\\section*{Ce este o Exoplanetă și cum le descoperă astronomii?}

O \\textbf{exoplanetă} (sau planetă extrasolară) este o planetă care orbitează în jurul altei stele decât Soarele nostru. Prima exoplanetă în jurul unei stele asemănătoare Soarelui (\\emph{51 Pegasi b}) a fost descoperită în anul \\textbf{1995} de astronomii elvețieni Michel Mayor și Didier Queloz (Premiul Nobel pentru Fizică). De atunci, telescoapele spațiale \\emph{Kepler}, \\emph{Spitzer}, \\emph{TESS} și \\emph{James Webb} au confirmat peste \\textbf{5.700 de exoplanete} în Calea Lactee!

\\begin{tcolorbox}[orbitardata, title={\\textbf{Cum găsim o planetă ascunsă în strălucirea unei stele îndepărtate?}}]
Deoarece stelele sunt de milioane sau miliarde de ori mai strălucitoare decât planetele lor, astronomii folosesc metode ingenioase pentru a detecta exoplanetele:
\\begin{enumerate}[leftmargin=1.5em, itemsep=3pt]
  \\item \\textbf{Metoda Tranzitului (Eclipsa în miniatură):} atunci când o exoplanetă trece exact prin fața stelei sale (privită dinspre Pământ), ea blochează o mică fracțiune din lumina stelei (de obicei între $0{,}01\\%$ și $1\\%$). Măsurând această scădere periodică de strălucire, aflăm raza exactă a planetei și durata anului ei! Mai mult, \\textbf{Telescopul Spațial James Webb} analizează lumina stelară filtrată prin atmosfera exoplanetei în timpul tranzitului (spectroscopie de transmisie) pentru a detecta vapori de apă, dioxid de carbon sau metan.
  \\item \\textbf{Metoda Vitezei Radiale (Efectul Doppler):} planeta și steaua se atrag reciproc și se rotesc în jurul centrului comun de masă. Acest „dans” face ca steaua să oscileze ușor înainte și înapoi față de noi, deplasându-i spectrul luminos spre albastru și spre roșu. Din această oscilație calculăm \\textbf{masa} exoplanetei!
  \\item \\textbf{Zona Locuibilă („Zona Goldilocks”):} este regiunea din jurul unei stele unde nu este nici prea cald (ca apa să fiarbă și să se evapore), nici prea frig (ca apa să înghețe complet), permițând existența \\textbf{apei lichide} la suprafața unei planete stâncoase, așa cum se întâmplă pe \\textbf{Proxima Centauri b} și pe planetele \\textbf{TRAPPIST-1d, e și f}!
\\end{enumerate}
\\end{tcolorbox}

\\begin{center}
\\begin{tikzpicture}[scale=0.90, every node/.style={transform shape}]
  \\fill[orbitarSpaceBg, rounded corners=6pt] (-0.8,-2.1) rectangle (14.2,2.1);

  % Steaua gazdă
  \\shade[inner color=yellow!90!white, outer color=orange!90!red] (2.4,0.3) circle (1.0cm);
  \\node[white, font=\\footnotesize\\bfseries] at (2.4,1.65) {Steaua-gazdă};

  % Orbita exoplanetei
  \\draw[white!40, dashed, line width=0.8pt] (2.4,0.3) ellipse (2.1cm and 0.35cm);
  % Exoplaneta în tranzit
  \\fill[orbitarDeepBlue!90!black, draw=orbitarCyan, line width=0.8pt] (2.8,0.0) circle (0.24cm);
  \\node[orbitarCyan, font=\\scriptsize\\bfseries] at (2.8,-0.55) {Exoplanetă în tranzit};

  % Graficul curbei de lumină în dreapta
  \\draw[-{Stealth}, white!80, line width=0.8pt] (6.5,-1.3) -- (13.4,-1.3) node[below left, font=\\scriptsize, text=white] {Timp};
  \\draw[-{Stealth}, white!80, line width=0.8pt] (6.5,-1.3) -- (6.5,1.5) node[below right, font=\\scriptsize, text=white] {Strălucirea stelei};

  % Curba de lumină
  \\draw[orbitarAmber, line width=1.6pt] (6.8,1.0) -- (8.4,1.0) -- (8.9,-0.4) -- (10.9,-0.4) -- (11.4,1.0) -- (13.0,1.0);
  \\draw[orbitarCyan, dashed] (6.5,1.0) -- (13.0,1.0);
  \\node[white!90, font=\\scriptsize, align=center] at (9.9,0.35) {Scăderea luminii\\\\în timpul tranzitului};
\\end{tikzpicture}
\\end{center}

\\begin{table}[H]
\\centering
\\small
\\caption{Cele 7 sisteme și corpuri din Orizontul 2 („Stele și Exoplanete”) în Orbitar}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}lllr@{}}
\\toprule
\\textbf{Nume Sistem / Obiect} & \\textbf{Categorie} & \\textbf{Distanță față de Soare} & \\textbf{Temp. caracteristică} \\\\
\\midrule
${interstellarTableRows}
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\clearpage
${interstellarTex}
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '04-stele-si-exoplanete.tex'), cap04, 'utf8');
console.log('Generat: capitole/04-stele-si-exoplanete.tex');

// ============================================================================
// CAPITOLUL 5: NEBULOASE, GĂURI NEGRE ȘI GALAXII (Orizontul 3)
// ============================================================================
const galacticObjects = deepSpaceData.objects.filter((o) => o.horizon === 'galactic');

const galacticTableRows = galacticObjects
  .map((o) => {
    const catName = CATEGORY_LABELS_RO[o.category] || o.category;
    return `${refineProse(o.name)} & ${texEscape(catName)} & ${refineProse(o.distanceLightYearsLabelRo || `${o.distanceLightYears} a.l.`)} \\\\`;
  })
  .join('\n');

const galacticTex = galacticObjects
  .map((o) => renderBodySection(o, quizCounter++, 'section'))
  .join('\n');

const cap05 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Nebuloase, Găuri Negre și Galaxii}
\\label{chap:galaxii}

În \\textbf{Orizontul 3 („Calea Lactee și Galaxii”)}, camera din \\textbf{Orbitar} se ridică la mii și milioane de ani-lumină pentru a cuprinde arhitectura la scară mare a Universului: \\textbf{nebuloasele difuze} (maternitățile cosmice unde se nasc mii de stele noi), \\textbf{nebuloasele planetare și rămășițele de supernovă} (care îmbogățesc galaxia cu elementele chimice ale vieții), \\textbf{gaura neagră supermasivă Sagittarius A*} din inima galaxiei noastre, \\textbf{Calea Lactee} și \\textbf{galaxiile vecine sau îndepărtate}.

\\section*{De la Maternitățile de Stele la Galaxiile Spirale}

\\begin{itemize}[leftmargin=1.5em, itemsep=3pt]
  \\item \\textbf{Nebuloasele de emisie și formare stelară (\\emph{Orion M42, Stâlpii Creației M16, Carina NGC 3372}):} nori colosali de hidrogen rece și praf cosmic în care gravitația strânge materia în noduri dense numite protostele.
  \\item \\textbf{Nebuloasele planetare (\\emph{Inelul M57, Helix NGC 7293}):} straturile exterioare luminoase de gaz eliberate pașnic la finalul vieții de stelele de mărimea Soarelui, lăsând în centru o \\emph{pitică albă}.
  \\item \\textbf{Rămășițele de supernovă și pulsarii (\\emph{Nebuloasa Crabului M1}):} explozii cataclismice ale stelelor masive, în urma cărora nucleul colapsează într-o \\emph{stea neutronică (pulsar)} sau într-o \\emph{gaură neagră}.
  \\item \\textbf{Roiurile globulare (precum \\emph{Omega Centauri}):} sfere străvechi de până la $10\\text{ milioane de stele}$ care orbitează în haloul Căii Lactee.
  \\item \\textbf{Galaxiile (\\emph{Calea Lactee, Marele Nor al lui Magellan, Andromeda M31, Triunghiul M33, Vâltoarea M51, Sombrero M104}):} insule cosmice legate gravitațional, formate din zeci sau sute de miliarde de stele, gaz, praf, o gaură neagră supermasivă centrală și un halou invizibil de materie întunecată.
\\end{itemize}

\\begin{center}
\\begin{tikzpicture}[scale=0.90, every node/.style={transform shape}]
  \\fill[orbitarSpaceBg, rounded corners=6pt] (-1.0,-2.3) rectangle (13.6,2.3);

  % Discul Căii Lactee văzut de sus (schematic)
  \\coordinate (G) at (3.6,0);
  \\draw[white!20, line width=6pt] (G) circle (1.7cm);
  \\draw[orbitarCyan!40, line width=3pt, dashed] (G) circle (1.25cm);
  \\draw[orbitarAmber!60, line width=2pt] ($(G)+(-0.6,-0.25)$) -- ($(G)+(0.6,0.25)$);
  \\fill[yellow!90!orange] (G) circle (0.28cm);
  \\fill[black] (G) circle (0.09cm);
  \\node[amber!90!yellow, font=\\scriptsize\\bfseries] at (3.6,-2.0) {Calea Lactee ($\\sim$100.000 a.l. diametru)};

  % Poziția Soarelui în Brațul Orion
  \\fill[orbitarCyan] ($(G)+(0.95,-0.55)$) circle (0.11cm);
  \\draw[orbitarCyan, line width=0.8pt] ($(G)+(0.95,-0.55)$) circle (0.22cm);
  \\draw[-{Stealth}, orbitarCyan, line width=0.8pt] (7.2,-0.8) -- ($(G)+(1.22,-0.58)$);
  \\node[orbitarCyan, font=\\scriptsize\\bfseries, anchor=west, align=left] at (7.3,-0.8) {Sistemul nostru Solar (Acasă)\\\\în Brațul Orion (26.000 a.l. de centru)};

  % Săgeată spre Sagittarius A*
  \\draw[-{Stealth}, amber!90!yellow, line width=0.8pt] (7.2,0.9) -- ($(G)+(0.25,0.15)$);
  \\node[amber!90!yellow, font=\\scriptsize\\bfseries, anchor=west, align=left] at (7.3,0.9) {Gaura Neagră Sagittarius A*\\\\(4,3 milioane mase solare)};
\\end{tikzpicture}
\\end{center}

\\begin{table}[H]
\\centering
\\small
\\caption{Cele 13 nebuloase, găuri negre și galaxii din Orizontul 3 în Orbitar}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}lll@{}}
\\toprule
\\textbf{Obiect Cosmic} & \\textbf{Categorie} & \\textbf{Distanță / Scară în Ani-Lumină} \\\\
\\midrule
${galacticTableRows}
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\clearpage
${galacticTex}
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '05-nebuloase-si-galaxii.tex'), cap05, 'utf8');
console.log('Generat: capitole/05-nebuloase-si-galaxii.tex');

// ============================================================================
// CAPITOLUL 6: LABORATORUL ORBITAR, LA MANȘA NAVEI ȘI MISIUNILE CADETULUI
// ============================================================================
const labWeightRows = solarData.bodies
  .map((b) => {
    const catName = CATEGORY_LABELS_RO[b.category] || b.category;
    let wStr = '0 kg (Imponderabilitate)';
    let jStr = 'Plutești în spațiu ($\\infty$)';
    if (b.gravityRatio > 0.0005) {
      const w = (35 * b.gravityRatio).toFixed(1).replace('.', ',');
      const jCm = 40 / b.gravityRatio;
      wStr = `${w} kg`;
      jStr =
        jCm >= 100
          ? `${(jCm / 100).toFixed(2).replace('.', ',')} metri`
          : `${jCm.toFixed(1).replace('.', ',')} cm`;
    }
    return `${texEscape(b.name)} & ${texEscape(catName)} & ${fmtNum(b.gravityRatio, 3)} $\\times g_\\oplus$ & \\textbf{${wStr}} & \\textbf{${jStr}} \\\\`;
  })
  .join('\n');

const ageBodies = solarData.bodies.filter((b) =>
  ['terrestrial', 'gas_giant', 'ice_giant', 'dwarf'].includes(b.category)
);

const labAgeRows = ageBodies
  .map((b) => {
    const totalEarthDays = 10 * 365.256;
    const totalEarthHours = totalEarthDays * 24;
    const localYears = totalEarthDays / b.orbitPeriodDays;
    const localYearsStr =
      localYears >= 10
        ? `${localYears.toFixed(1).replace('.', ',')} ani`
        : `${localYears.toFixed(3).replace('.', ',')} ani`;
    const localDays = Math.round(totalEarthHours / Math.abs(b.dayLengthHours));
    return `${texEscape(b.name)} & ${fmtNum(b.orbitPeriodDays, 1)} zile & ${fmtNum(Math.abs(b.dayLengthHours), 1)} ore & \\textbf{${localYearsStr}} & \\textbf{${fmtNum(localDays)} zile locale} \\\\`;
  })
  .join('\n');

const cap06 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Laboratorul Orbitar, La Manșa Navei și Misiunile Cadetului}
\\label{chap:laborator}

Dincolo de enciclopedia corpurilor cerești, \\textbf{Orbitar} oferă unelte interactive de fizică aplicată și explorare: mini-jocul de pilotaj spațial \\textbf{„La Manșa Navei (Mod Pilot)”}, \\textbf{Laboratorul Orbitar} (calculatoarele de greutate, săritură și vârstă pe alte lumi), \\textbf{Rigla cu Viteza Luminii}, jocul de orientare cosmică \\textbf{„Misiunile Orbitar \\& Jurnalul de Bord”} și \\textbf{Normalizatorul Fonetic Român}.

\\section{„La Manșa Navei (Mod Pilot)”: Cele 3 Astronave Didactice Românești}

În modul First-Person Cockpit (activat prin tasta \\texttt{P} în \\textbf{Orbitar}), copiii preiau manșa a \\textbf{trei nave spațiale didactice} care omagiază pionierii aviației românești și literatura română, ilustrând scara reală a timpului și a distanțelor cosmice:

\\begin{tcolorbox}[orbitardata, title={\\textbf{Flota Spațială Didactică din Orbitar (\\texttt{SpacecraftPilot.ts})}}]
\\begin{enumerate}[leftmargin=1.5em, itemsep=5pt]
  \\item \\textbf{Racheta „Vlaicu-1”, Propulsie Chimică ($50.000$ de kilometri pe oră / $0{,}0046\\%\\,c$):}\\\\
  Numită în onoarea inginerului și pionierului aviației românești \\textbf{Aurel Vlaicu} (1882--1913). Are viteza caracteristică a sondelor interplanetare actuale (\\emph{New Horizons}, \\emph{Apollo}, \\emph{Voyager}) și urmează \\textbf{arcul de transfer orbital Hohmann} și manevrele de asistență gravitațională: călătoria de la Pământ la Lună durează aproximativ $3\\text{ zile}$, până la Marte aproximativ $7\\text{ luni}$, până la Jupiter aproximativ $5\\text{ ani și } 6\\text{ luni}$, iar până la Neptun aproximativ $12\\text{ ani}$!
  \\item \\textbf{Nava „Coandă-X”, Propulsie cu Fuziune \\& Plasmă ($1.500.000$ de kilometri pe oră / $0{,}139\\%\\,c$):}\\\\
  Numită în onoarea savantului și inventatorului avionului cu reacție \\textbf{Henri Coandă} (1886--1972). Reprezintă tehnologia spațială a viitorului apropiat, de 30 de ori mai rapidă decât rachetele chimice: ajunge la Lună în aproximativ $3\\text{ ore}$, pe Marte în aproximativ $2\\text{ zile}$, la Jupiter în aproximativ $18\\text{ zile}$ și la Neptun în aproximativ $4\\text{ luni}$!
  \\item \\textbf{Astronava „Luceafărul”, Motor Fotonic ($1c = 1.079.252.849$ kilometri pe oră) \\& Salt Hiperspațial:}\\\\
  Inspirată de poemul cosmogonic \\emph{„Luceafărul”} al lui \\textbf{Mihai Eminescu} (\\emph{„Porni luceafărul. Creșteau / În cer a lui aripe, / Și căi de mii de ani treceau / În tot atâtea clipe”}). În Sistemul Solar călătorește exact cu \\textbf{viteza luminii ($1c$)}: $1{,}3\\text{ secunde}$ până la Lună, $8\\text{ minute și } 20\\text{ de secunde}$ de la Soare la Pământ și aproximativ $4\\text{ ore}$ până la Neptun. Pentru țintele din Orizonturile 2 și 3 (stele, exoplanete și galaxii), activează \\textbf{Motorul Hiperspațial (Warp)} și explică la sosire în ce epocă istorică a plecat lumina de la acea stea sau galaxie!
\\end{enumerate}
\\end{tcolorbox}

\\begin{table}[H]
\\centering
\\small
\\caption{Compararea duratei călătoriilor de la Pământ cu cele 3 astronave din Orbitar}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}llrrr@{}}
\\toprule
\\textbf{Destinație} & \\textbf{Distanță tipică} & \\textbf{Racheta „Vlaicu-1”} & \\textbf{Nava „Coandă-X”} & \\textbf{Astronava „Luceafărul”} \\\\
 & & ($50.000\\text{ km/h}$) & ($1.500.000\\text{ km/h}$) & (Viteza luminii $1c$) \\\\
\\midrule
Luna & $384.400\\text{ km}$ & $3\\text{ zile}$ & $3\\text{ ore}$ & $1{,}3\\text{ secunde}$ \\\\
Soarele & $1{,}00\\text{ UA}$ ($150\\text{ mil. km}$) & $\\sim 6\\text{ luni}$ & $4\\text{ zile}$ & $8\\text{ min } 20\\text{ sec}$ \\\\
Marte & $\\sim 0{,}52\\text{ UA}$ (min.) & $7\\text{ luni}$ (Hohmann) & $2\\text{ zile}$ & $\\sim 4{,}3\\text{ minute}$ \\\\
Jupiter & $\\sim 4{,}20\\text{ UA}$ & $5\\text{ ani și } 6\\text{ luni}$ & $18\\text{ zile}$ & $\\sim 35\\text{ minute}$ \\\\
Saturn & $\\sim 8{,}58\\text{ UA}$ & $7\\text{ ani}$ & $36\\text{ de zile}$ & $1\\text{ oră și } 11\\text{ min}$ \\\\
Uranus & $\\sim 18{,}20\\text{ UA}$ & $9\\text{ ani și } 6\\text{ luni}$ & $76\\text{ de zile}$ & $2\\text{ ore și } 31\\text{ min}$ \\\\
Neptun & $\\sim 29{,}07\\text{ UA}$ & $12\\text{ ani}$ & $4\\text{ luni}$ & $4\\text{ ore și } 2\\text{ min}$ \\\\
Pluto & $\\sim 38{,}5\\text{ UA}$ & $14\\text{ ani și } 6\\text{ luni}$ & $5\\text{ luni}$ & $5\\text{ ore și } 20\\text{ min}$ \\\\
Proxima Centauri b & $4{,}24\\text{ ani-lumină}$ & $\\sim 81.000\\text{ de ani}$ & $\\sim 3.050\\text{ de ani}$ & $4\\text{ ani și } 3\\text{ luni}$ (sau Warp) \\\\
Galaxia Andromeda & $2{,}54\\text{ mil. a.l.}$ & $\\sim 50\\text{ mld. ani}$ & $\\sim 1{,}8\\text{ mld. ani}$ & $2{,}54\\text{ mil. ani}$ (sau Warp) \\\\
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\section{Laboratorul Orbitar: Cât cântăresc și cât de sus sar pe alte lumi?}

Mulți oameni confundă \\textbf{masa} cu \\textbf{greutatea}, dar în astronomie diferența dintre ele este esențială:
\\begin{itemize}[leftmargin=1.5em, itemsep=2pt]
  \\item \\textbf{Masa ($m$, măsurată în kilograme)} reprezintă cantitatea de materie din corpul tău și rămâne \\textbf{neschimbată} oriunde în Univers.
  \\item \\textbf{Greutatea ($G = m \\cdot g_{\\text{local}}$)} reprezintă forța cu care gravitația corpului ceresc te atrage spre sol. În \\textbf{Laboratorul Orbitar} (\\texttt{OrbitarLab.ts}), greutatea aparentă și înălțimea săriturii pe o lume cu raportul gravitațional $g_{\\text{raport}} = g_{\\text{local}} / g_\\oplus$ se calculează prin relațiile:
  \\[
    M_{\\text{echivalent}} = M_{\\text{Pământ}} \\times g_{\\text{raport}}, \\qquad h_{\\text{săritură}} = \\frac{h_{\\text{Pământ}}}{g_{\\text{raport}}}
  \\]
\\end{itemize}

Tabelul de mai jos prezintă valorile exacte calculate de \\textbf{Laboratorul Orbitar} pentru un copil cu masa de \\textbf{35 kg} care pe Pământ sare \\textbf{40 cm} în înălțime:

\\begingroup
\\small
\\begin{longtable}{@{} >{\\raggedright\\arraybackslash}p{2.5cm} >{\\raggedright\\arraybackslash}p{3.1cm} r r r @{}}
\\caption{Cât cântărește și cât de sus sare un copil de 35 kg (săritură 40 cm pe Pământ) pe toate cele 50 de corpuri naturale din Sistemul Solar} \\\\
\\toprule
\\textbf{Corp ceresc} & \\textbf{Categorie} & \\textbf{Gravitație ($g_\\oplus$)} & \\textbf{Cântarul arată} & \\textbf{Înălțimea săriturii} \\\\
\\midrule
\\endfirsthead
\\multicolumn{5}{c}{{\\footnotesize\\itshape (continuare de pe pagina anterioară)}} \\\\
\\toprule
\\textbf{Corp ceresc} & \\textbf{Categorie} & \\textbf{Gravitație ($g_\\oplus$)} & \\textbf{Cântarul arată} & \\textbf{Înălțimea săriturii} \\\\
\\midrule
\\endhead
\\bottomrule
\\endfoot
${labWeightRows}
\\end{longtable}
\\endgroup

\\section{Laboratorul Orbitar: Câți ani și câte zile am pe alte planete?}

Pe Pământ, un \\textbf{an} durează $365{,}256\\text{ zile}$ (timpul unei rotații complete în jurul Soarelui), iar o \\textbf{zi} durează $24\\text{ de ore}$ (o rotație în jurul propriei axe). Pentru un copil în vârstă de \\textbf{10 ani pământești} ($3.652{,}56\\text{ zile pământești} = 87.661{,}4\\text{ ore}$), iată vârsta exprimată în ani și zile locale pe fiecare planetă și planetă pitică:

\\begin{table}[H]
\\centering
\\small
\\caption{Vârsta unui copil de 10 ani pământești pe planetele și planetele pitice din Orbitar}
\\begin{tabular}{@{}lrrrr@{}}
\\toprule
\\textbf{Lumea} & \\textbf{Durata unui an} & \\textbf{Durata unei zile} & \\textbf{Vârsta în ani locali} & \\textbf{Vârsta în zile locale} \\\\
\\midrule
${labAgeRows}
\\bottomrule
\\end{tabular}
\\end{table}

\\section{Misiunile Orbitar și Jurnalul de Bord (Vânătoarea de Comori Cosmică)}

Pentru a transforma studiul Sistemului Solar într-o aventură interactivă, modulul \\textbf{Misiunile Orbitar} (\\texttt{OrbitarMissions.ts}) propune 6 provocări de explorare. Fiecare misiune îi cere copilului să găsească ținta în scena 3D și apoi să răspundă corect la întrebarea grilă pentru a debloca insigna în \\textbf{Jurnalul de Bord}:

\\begin{tcolorbox}[orbitarquiz, title={\\textbf{Cele 6 Misiuni Oficiale și Insigne din Jurnalul de Bord Orbitar}}]
\\begin{enumerate}[leftmargin=1.5em, itemsep=4pt]
  \\item \\textbf{Misiunea 1: Insigna „Ochiul de Aur (JWST)” (țintă: \\texttt{jwst}):}\\\\
  \\emph{Provocare:} Găsește în Orbitar telescopul spațial aflat în punctul L2 și dă click pe el!\\\\
  \\emph{Indiciu:} Are o oglindă aurită în formă de fagure și orbitează chiar lângă Pământ.
  \\item \\textbf{Misiunea 2: Insigna „Explorator Marțian” (țintă: \\texttt{mars}):}\\\\
  \\emph{Provocare:} Găsește Planeta Roșie unde au amartizat roverele Perseverance și Curiosity!\\\\
  \\emph{Indiciu:} Este a patra planetă de la Soare, aflată imediat după orbita Pământului.
  \\item \\textbf{Misiunea 3: Insigna „Stăpânul Inelelor” (țintă: \\texttt{saturn}):}\\\\
  \\emph{Provocare:} Descoperă bijuteria Sistemului Solar, gigantul gazos înconjurat de inele strălucitoare de gheață!\\\\
  \\emph{Indiciu:} Este a șasea planetă de la Soare, după uriașul Jupiter.
  \\item \\textbf{Misiunea 4: Insigna „Comandant Orbital (ISS)” (țintă: \\texttt{iss}):}\\\\
  \\emph{Provocare:} Găsește laboratorul spațial locuit de astronauți care zboară pe orbita joasă a Pământului (la aproximativ $420$ de kilometri altitudine)!\\\\
  \\emph{Indiciu:} Apropie-te de Pământ și selectează Stația Spațială Internațională.
  \\item \\textbf{Misiunea 5: Insigna „Inima din Kuiper” (țintă: \\texttt{pluto}):}\\\\
  \\emph{Provocare:} Caută la marginea Sistemului Solar planeta pitică ce poartă pe suprafața ei un ghețar în formă de inimă!\\\\
  \\emph{Indiciu:} Se află în Centura Kuiper, dincolo de orbita albastră a lui Neptun.
  \\item \\textbf{Misiunea 6: Insigna „Mesager Interstelar” (țintă: \\texttt{voyager1}):}\\\\
  \\emph{Provocare:} Găsește sonda lansată în 1977 care poartă în spațiul interstelar Discul de Aur cu salutul în limba română!\\\\
  \\emph{Indiciu:} Este cel mai îndepărtat obiect creat de om, așa că poți căuta sonda \\emph{Voyager 1}!
\\end{enumerate}
\\end{tcolorbox}

\\section{Ghid de Pronunție Astronomică în Limba Română}

Multe nume de stele, sateliți, cratere, astronomi și sonde spațiale provin din greaca veche, latină, arabă, hawaiiană sau engleză. Iată ghidul fonetic utilizat de modulul \\texttt{RomanianSpeechNormalizer.ts} din \\textbf{Orbitar} pentru pronunțarea lor corectă:

\\begin{table}[H]
\\centering
\\small
\\caption{Dicționarul fonetic al termenilor astronomici și al misiunilor din Orbitar}
\\resizebox{\\textwidth}{!}{%
\\begin{tabular}{@{}lll@{}}
\\toprule
\\textbf{Grafie oficială} & \\textbf{Pronunție recomandată} & \\textbf{Explicație / Origine} \\\\
\\midrule
Betelgeuse & \\emph{Be-tel-geuz} & Supergigantă roșie în constelația Orion \\\\
Enceladus & \\emph{En-țe-la-dus} & Satelitul cu gheizere de gheață al lui Saturn \\\\
Ganymede & \\emph{Ga-ni-me-de} & Cel mai mare satelit al lui Jupiter \\\\
Callisto & \\emph{Ca-lis-to} & Satelit galileean exterior al lui Jupiter \\\\
Phobos / Stickney & \\emph{Fo-bos / Stic-ni} & Satelitul interior al lui Marte și marele său crater \\\\
Charon & \\emph{Ha-ron} & Satelitul binar al planetei pitice Pluto \\\\
Haumea / Makemake & \\emph{Ha-u-me-a / Ma-ke-ma-ke} & Planete pitice din Centura Kuiper \\\\
16 Psyche / 101955 Bennu & \\emph{Psi-he / Be-nu} & Asteroidul metalic și asteroidul carbonifer \\\\
99942 Apophis / 2 Pallas & \\emph{A-po-fis / Pa-las} & Asteroizi din Sistemul Solar \\\\
Centura Kuiper / Norul Oort & \\emph{Cai-păr / Ort} & După astronomii olandezi Gerard Kuiper și Jan Oort \\\\
Clyde Tombaugh & \\emph{Claid Tom-bo} & Descoperitorul lui Pluto (1930); \\emph{Tombaugh Regio} \\\\
Christiaan Huygens & \\emph{Cris-ti-an Hoi-ghens} & Descoperitorul lui Titan și sonda europeană \\emph{Huygens} \\\\
William Herschel & \\emph{Ui-li-am Her-șăl} & Descoperitorul planetei Uranus (1781) \\\\
67P/Churyumov-Gerasimenko & \\emph{67P Ciu-riu-mov Ghe-ra-si-men-co} & Cometa explorată de misiunea \\emph{Rosetta \\& Philae} \\\\
James Webb (JWST) & \\emph{Geims Ueb} & Telescopul spațial în infraroșu din punctul L2 \\\\
Hubble / Spitzer / Kepler & \\emph{Ha-băl / Șpi-țăr / Che-plăr} & Marile telescoape spațiale NASA \\\\
Voyager 1 \\& 2 & \\emph{Vo-ia-ger unu și doi} & Sondele interstelare lansate în 1977 \\\\
New Horizons & \\emph{Niu Ho-rai-zăns} & Sonda care a zburat pe lângă Pluto în 2015 \\\\
Parker Solar Probe & \\emph{Sonda Solară Par-căr} & Sonda care studiază coroana Soarelui \\\\
Rosetta \\& Philae & \\emph{Ro-ze-ta și Fi-le} & Sonda orbitală și modulul de asolizare pe cometă \\\\
JUICE & \\emph{Juis} & \\emph{Jupiter Icy Moons Explorer} (ESA) \\\\
Perseverance \\& Ingenuity & \\emph{Per-se-ve-răns și In-ge-niu-i-ti} & Roverul și elicopterul NASA din Craterul Jezero \\\\
Curiosity & \\emph{Chiu-ri-o-si-ti} & Roverul nuclear NASA din Craterul Gale \\\\
Sagittarius A* (Sgr A*) & \\emph{Sa-gi-ta-ri-us A stea} & Gaura neagră supermasivă din centrul Căii Lactee \\\\
TRAPPIST-1 & \\emph{Tra-pist unu} & Sistemul cu 7 exoplanete stâncoase \\\\
\\bottomrule
\\end{tabular}%
}
\\end{table}

\\clearpage
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '06-laborator-nave-si-activitati.tex'), cap06, 'utf8');
console.log('Generat: capitole/06-laborator-nave-si-activitati.tex');

// ============================================================================
// CAPITOLUL 7: BAREMUL COMPLET AL CELOR 74 DE ÎNTREBĂRI QUIZ ȘI GLOSAR
// ============================================================================
const all66Ordered = [
  ...orderedSolarBodies,
  ...missionsList,
  ...interstellarObjects,
  ...galacticObjects,
];

const letters = ['A', 'B', 'C', 'D'];
const baremRows = all66Ordered
  .map((item, idx) => {
    const q = item.cadet.quiz;
    const ansLetter = letters[q.correctIndex] || 'A';
    const ansText = q.options[q.correctIndex] || '';
    return `\\textbf{${idx + 1}} & \\textbf{${refineProse(item.name)}} & ${refineProse(q.question)} & \\textbf{${ansLetter}: ${refineProse(ansText)}}. {\\footnotesize ${refineProse(q.explanation)}} \\\\ \\midrule`;
  })
  .join('\n');

const cap07 = `% SPDX-License-Identifier: GPL-3.0-or-later
\\chapter{Baremul Complet al celor 74 de Întrebări Quiz și Glosar Astronomic}
\\label{chap:barem-glosar}

Acest capitol centralizează răspunsurile corecte și explicațiile științifice pentru toate cele \\textbf{74 de întrebări grilă de verificare} din capitolele anterioare, urmate de un \\textbf{Glosar de Termeni Astronomici și Spațiali}.

\\section{Baremul celor 74 de Întrebări Grilă de Verificare}

\\begingroup
\\small
\\begin{longtable}{@{}r >{\\raggedright\\arraybackslash}p{2.7cm} >{\\raggedright\\arraybackslash}p{4.8cm} >{\\raggedright\\arraybackslash}p{6.5cm}@{}}
\\caption{Baremul complet de verificare pentru cele 74 de corpuri cerești, misiuni, exoplanete și galaxii} \\\\
\\toprule
\\textbf{\\#} & \\textbf{Obiect Cosmic} & \\textbf{Întrebarea Quiz} & \\textbf{Răspuns Corect \\& Explicație} \\\\
\\midrule
\\endfirsthead
\\multicolumn{4}{c}{{\\footnotesize\\itshape (continuare barem Quiz de pe pagina anterioară)}} \\\\
\\toprule
\\textbf{\\#} & \\textbf{Obiect Cosmic} & \\textbf{Întrebarea Quiz} & \\textbf{Răspuns Corect \\& Explicație} \\\\
\\midrule
\\endhead
\\bottomrule
\\endfoot
${baremRows}
\\end{longtable}
\\endgroup

\\clearpage
\\section{Glosar de Termeni Astronomici și Spațiali}

\\begin{description}[leftmargin=1.2em, itemsep=4pt]
  \\item[Albedo:] fracțiunea din lumina solară pe care un corp ceresc o reflectă înapoi în spațiu. Enceladus are un albedo de aproape $0{,}99$ (reflectă $99\\%$ din lumină ca zăpada proaspătă), în timp ce asteroizii carboniferi precum Bennu reflectă doar $4\\%$.
  \\item[An-lumină (a.l.):] distanța parcursă de lumină în vid într-un an julian ($365{,}25\\text{ zile}$), egală cu aproximativ $9.460{,}7\\text{ miliarde de kilometri}$ ($63.241\\text{ UA}$).
  \\item[Centura Kuiper:] regiune în formă de disc situată dincolo de orbita planetei Neptun ($30\\text{--}50\\text{ UA}$), populată de corpuri înghețate și planete pitice precum Pluto, Haumea și Makemake.
  \\item[Criovulcanism:] fenomen geologic prin care „vulcanii de gheață” de pe sateliți înghețați (precum Enceladus sau Triton) aruncă în spațiu jeturi de apă, amoniac, azot sau metan în loc de rocă topită.
  \\item[Efect de seră:] procesul prin care gazele dintr-o atmosferă planetară (precum dioxidul de carbon $\\text{CO}_2$ pe Venus sau metanul $\\text{CH}_4$) captează căldura infraroșie, ridicând temperatura suprafeței.
  \\item[Elemente kepleriene:] cei 6 parametri matematici care definesc în mod unic o orbită în spațiu: semiaxa mare ($a$), excentricitatea ($e$), înclinația ($i$), longitudinea nodului ascendent ($\\Omega$), argumentul periheliului ($\\omega$) și anomalia medie ($M$).
  \\item[Exoplanetă:] planetă aflată în afara Sistemului Solar, care orbitează în jurul altei stele.
  \\item[Gaură neagră supermasivă:] obiect cosmic cu o gravitație atât de intensă încât nici măcar lumina nu poate scăpa din interiorul \\emph{orizontului evenimentelor} său; se află în nucleul majorității galaxiilor (precum \\emph{Sagittarius A*} în Calea Lactee).
  \\item[Magnetosferă:] scutul magnetic invizibil generat de nucleul metalic lichid al unei planete (precum Pământul sau Jupiter), care deviază particulele încărcate electric ale vântului solar.
  \\item[Nebuloasă:] nor interstelar uriaș de gaz (hidrogen, heliu și gaze ionizate) și praf cosmic; poate fi o maternitate de stele (\\emph{Nebuloasa Orion}) sau rămășița unei stele (\\emph{Nebuloasa Inelul}, \\emph{Nebuloasa Crabului}).
  \\item[Norul lui Oort:] rezervor sferic uriaș de trilioane de nuclee cometare înghețate care înconjoară Sistemul Solar la distanțe de până la $\\sim 1\\text{ an-lumină}$.
  \\item[Pitică albă:] nucleul fierbinte și extrem de dens (de mărimea Pământului, dar cu o masă comparabilă cu a Soarelui) rămas după ce o stea de masă mică sau medie își eliberează straturile exterioare.
  \\item[Pitică roșie:] cel mai răspândit și mai longeviv tip de stea din Univers (clasa spectrală M, precum \\emph{Proxima Centauri} și \\emph{TRAPPIST-1}), mai mică și mai rece decât Soarele.
  \\item[Punctul Lagrange L2:] punct de echilibru orbital situat la $1{,}5\\text{ milioane de kilometri}$ în spatele Pământului (pe direcția opusă Soarelui), ideal pentru telescoapele în infraroșu precum \\emph{James Webb} și \\emph{Euclid}.
  \\item[Rezonanță orbitală Laplace:] raportul matematic exact ($4:2:1$) dintre perioadele orbitale ale lunilor \\emph{Io}, \\emph{Europa} și \\emph{Ganymede}, care menține interiorul lor încălzit prin forțe mareice.
  \\item[Rotație sincronă (blocare mareică):] fenomenul prin care un satelit (cum este Luna față de Pământ) sau o exoplanetă apropiată se rotește în jurul axei sale exact în același timp în care parcurge o orbită, arătând mereu aceeași emisferă către corpul central.
  \\item[Unitate Astronomică (UA):] distanța medie dintre Pământ și Soare ($149.597.870{,}7\\text{ km}$).
  \\item[Zonă locuibilă (Goldilocks):] intervalul de distanțe față de o stea în care temperatura permite existența apei lichide la suprafața unei planete.
\\end{description}

\\clearpage
`;

fs.writeFileSync(path.join(CAPITOLE_DIR, '07-barem-quiz-si-glosar.tex'), cap07, 'utf8');
console.log('Generat: capitole/07-barem-quiz-si-glosar.tex');
console.log('Toate fișierele LaTeX au fost generate cu succes în carte/!');

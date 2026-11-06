// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Elimină parantezele cu acronime redundante înainte de aplicarea dicționarului fonetic,
 * evitând dublările de tipul "Stația Spațială Internațională (Stația Spațială Internațională)"
 * sau "Telescopul Spațial Geims Ueb (Geims Ueb)".
 */
const REDUNDANT_ACRONYM_PATTERNS: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\s*\(\s*ISS\s*\)/gi, replacement: '' },
  { pattern: /\s*\(\s*JWST\s*\)/gi, replacement: '' },
  { pattern: /\s*\(\s*EHT\s*\)/gi, replacement: '' },
  { pattern: /\s*\(\s*MSL\s*\)/gi, replacement: '' },
  { pattern: /\s*\(\s*LMC\s*\)/gi, replacement: '' },
  { pattern: /\s*\(\s*EGGs\s*\)/gi, replacement: '' },
  { pattern: /\s*\(\s*Proplyds\s*\)/gi, replacement: '' },
  { pattern: /\s*\(\s*Sgr\s*A\s*\*\s*\)/gi, replacement: '' },
  { pattern: /\bJUICE\s*\(\s*Jupiter Icy Moons Explorer\s*\)/gi, replacement: 'Juis, Exploratorul Lunilor Înghețate ale lui Jupiter' },
  { pattern: /\b67P\s*\/\s*Ciuriumov[-–]Gherasimenko\b/gi, replacement: '67 P Ciuriumov Gherasimenco' },
  { pattern: /\b67P\s*\/\s*Churyumov[-–]Gerasimenko\b/gi, replacement: '67 P Ciuriumov Gherasimenco' },
  { pattern: /\b101955\s+Bennu\b/gi, replacement: 'Benu' },
  { pattern: /\b99942\s+Apophis\b/gi, replacement: 'Apofis' },
  { pattern: /\b16\s+Psyche\b/gi, replacement: 'Psihe' },
  { pattern: /\b4\s+Vesta\b/gi, replacement: 'Vesta' },
  { pattern: /\b2\s+Pallas\b/gi, replacement: 'Palas' },
  { pattern: /\b149[.\s]?597[.\s]?870\b/g, replacement: '150 de milioane' },
];

/**
 * Dicționar fonetic pentru adaptarea pronunției numelor de misiuni, sonde,
 * nave spațiale, astronomi și corpuri cerești la fonetica limbii române.
 * Se aplică EXCLUSIV textului trimis către sinteza vocală (fără a modifica UI-ul).
 */
const PHONETIC_DICTIONARY: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bParker Solar Probe\b/gi, replacement: 'Sonda Solară Parcăr' },
  { pattern: /\bNew Horizons\b/gi, replacement: 'Niu Horaizăns' },
  { pattern: /\bJames Webb\b/gi, replacement: 'Geims Ueb' },
  { pattern: /\bJWST\b/g, replacement: 'Geims Ueb' },
  { pattern: /\bOSIRIS-REx\b/gi, replacement: 'Osiris Recs' },
  { pattern: /\bBepiColombo\b/gi, replacement: 'Bepi-Colombo' },
  { pattern: /\bMESSENGER\b/g, replacement: 'Mesengiar' },
  { pattern: /\bVlaicu-1\b/gi, replacement: 'Vlaicu unu' },
  { pattern: /\bCoandă-X\b/gi, replacement: 'Coandă Ics' },
  { pattern: /\bVoyager\s+1\b/gi, replacement: 'Voiager unu' },
  { pattern: /\bVoyager\s+2\b/gi, replacement: 'Voiager doi' },
  { pattern: /\bVoyager\b/gi, replacement: 'Voiager' },
  { pattern: /\bHubble\b/gi, replacement: 'Habăl' },
  { pattern: /\bPerseverance\b/gi, replacement: 'Perseverăns' },
  { pattern: /\bCuriosity\b/gi, replacement: 'Chiuriositi' },
  { pattern: /\bIngenuity\b/gi, replacement: 'Ingeniuiti' },
  { pattern: /\bOpportunity\b/gi, replacement: 'Oportiuniti' },
  { pattern: /\bPathfinder\b/gi, replacement: 'Pat-faindăr' },
  { pattern: /\bViking\b/gi, replacement: 'Vaiching' },
  { pattern: /\bMariner\b/gi, replacement: 'Marinăr' },
  { pattern: /\bMagellan\b/gi, replacement: 'Magelan' },
  { pattern: /\bCassini[-–]Huygens\b/gi, replacement: 'Casini Hoighens' },
  { pattern: /\bChristiaan Huygens\b/gi, replacement: 'Cristian Hoighens' },
  { pattern: /\bHuygens\b/gi, replacement: 'Hoighens' },
  { pattern: /\bCassini\b/gi, replacement: 'Casini' },
  { pattern: /\bJuno\b/gi, replacement: 'Giuno' },
  { pattern: /\bDawn\b/gi, replacement: 'Don' },
  { pattern: /\bJUICE\b/g, replacement: 'Juis' },
  { pattern: /\bRosetta\b/gi, replacement: 'Rozeta' },
  { pattern: /\bPhilae\b/gi, replacement: 'File' },
  { pattern: /\bSpaceX\b/gi, replacement: 'Speis Ics' },
  { pattern: /\bBlue Origin\b/gi, replacement: 'Blu Origin' },
  { pattern: /\bApollo\b/gi, replacement: 'Apolo' },
  { pattern: /\bSpitzer\b/gi, replacement: 'Șpițăr' },
  { pattern: /\bKepler\b/gi, replacement: 'Cheplăr' },
  { pattern: /\bNIRCam\b/gi, replacement: 'Nir-Cam' },
  { pattern: /\bMIRI\b/g, replacement: 'Miri' },
  { pattern: /\bEvent Horizon Telescope\b/gi, replacement: 'Telescopul Orizontului Evenimentelor' },
  { pattern: /\bMars Science Laboratory\b/gi, replacement: 'Laboratorul Științific Marțian' },
  { pattern: /\bMount Sharp\b/gi, replacement: 'Muntele Șarp' },
  { pattern: /\bSky Crane\b/gi, replacement: 'Scai Crein' },
  { pattern: /\bGolden Record\b/gi, replacement: 'Discul de Aur' },
  { pattern: /\bPale Blue Dot\b/gi, replacement: 'Un Punct Albastru Pal' },
  { pattern: /\bGrand Tour\b/gi, replacement: 'Marele Tur' },
  { pattern: /\bHeart of Gold\b/gi, replacement: 'Inimă de Aur' },
  { pattern: /\bEarly Release Observations\b/gi, replacement: 'Primele Observații Oficiale' },
  { pattern: /\bSample Caching\b/gi, replacement: 'colectare de eșantioane' },
  { pattern: /\brubble-pile\b/gi, replacement: 'grămadă de rocă și pietriș' },
  { pattern: /\bgrand-design\b/gi, replacement: 'cu brațe simetrice' },
  { pattern: /\bEasterbunny\b/gi, replacement: 'Iepurașul de Paște' },
  { pattern: /\bNightingale\b/gi, replacement: 'Naitingheil' },
  { pattern: /\bRheasilvia\b/gi, replacement: 'Rea-Silvia' },
  { pattern: /\bClyde Tombaugh\b/gi, replacement: 'Claid Tombo' },
  { pattern: /\bTombaugh Regio\b/gi, replacement: 'Regiunea Tombo' },
  { pattern: /\bTombaugh\b/gi, replacement: 'Tombo' },
  { pattern: /\bSputnik Planitia\b/gi, replacement: 'Câmpia Sputnic' },
  { pattern: /\bCthulhu Macula\b/gi, replacement: 'Regiunea Ctulu' },
  { pattern: /\bCthulhu\b/gi, replacement: 'Ctulu' },
  { pattern: /\bSchiaparelli\b/gi, replacement: 'Schiapareli' },
  { pattern: /\bLowell\b/gi, replacement: 'Louel' },
  { pattern: /\bTycho\b/gi, replacement: 'Tiho' },
  { pattern: /\bKuiper\b/gi, replacement: 'Caipăr' },
  { pattern: /\bOort\b/gi, replacement: 'Ort' },
  { pattern: /\bISS\b/g, replacement: 'Stația Spațială Internațională' },
  { pattern: /\bGanymede\b/gi, replacement: 'Ganimede' },
  { pattern: /\bCallisto\b/gi, replacement: 'Calisto' },
  { pattern: /\bEnceladus\b/gi, replacement: 'Ențeladus' },
  { pattern: /\bMakemake\b/gi, replacement: 'Make-make' },
  { pattern: /\bHaumea\b/gi, replacement: 'Ha-u-mea' },
  { pattern: /\bBennu\b/gi, replacement: 'Benu' },
  { pattern: /\bPsyche\b/gi, replacement: 'Psihe' },
  { pattern: /\bApophis\b/gi, replacement: 'Apofis' },
  { pattern: /\bPallas\b/gi, replacement: 'Palas' },
  { pattern: /\bCharon\b/gi, replacement: 'Haron' },
  { pattern: /\bPhobos\b/gi, replacement: 'Fobos' },
  { pattern: /\bStickney\b/gi, replacement: 'Sticni' },
  { pattern: /\bWilliam Herschel\b/gi, replacement: 'Uiliam Herșăl' },
  { pattern: /\bHerschel\b/gi, replacement: 'Herșăl' },
  { pattern: /\bAsaph Hall\b/gi, replacement: 'Asaf Hol' },
  { pattern: /\bWilliam Shakespeare\b/gi, replacement: 'Uiliam Șecspir' },
  { pattern: /\bShakespeare\b/gi, replacement: 'Șecspir' },
  { pattern: /\bWilliam Lassell\b/gi, replacement: 'Uiliam Lasel' },
  { pattern: /\bJames Christy\b/gi, replacement: 'Geims Cristi' },
  { pattern: /\bSerenity Chasma\b/gi, replacement: 'Canionul Sereniti' },
  { pattern: /\bMessina Chasmata\b/gi, replacement: 'Canionul Mesina' },
  { pattern: /\bRoncevaux Terra\b/gi, replacement: 'Regiunea Ronsevo' },
  { pattern: /\bHalley\b/gi, replacement: 'Halei' },
  { pattern: /\bCiuriumov[-–]Gherasimenko\b/gi, replacement: 'Ciuriumov Gherasimenco' },
  { pattern: /\bSagittarius\s+A\s*\*/gi, replacement: 'Sagitarius A stea' },
  { pattern: /\bSgr\s+A\s*\*/gi, replacement: 'Sagitarius A stea' },
  { pattern: /\bSagittarius\b/gi, replacement: 'Sagitarius' },
  { pattern: /\bProxima\s+Centauri\b/gi, replacement: 'Procsima Centauri' },
  { pattern: /\bProxima\b/gi, replacement: 'Procsima' },
  { pattern: /\bAlpha\s+Centauri\b/gi, replacement: 'Alfa Centauri' },
  { pattern: /\bAlpha\s+Orionis\b/gi, replacement: 'Alfa Orionis' },
  { pattern: /\bBetelgeuse\b/gi, replacement: 'Betelgeuz' },
  { pattern: /\bTRAPPIST-1\s*([a-h])\b/gi, replacement: 'Trapist unu $1' },
  { pattern: /\bTRAPPIST-1\b/gi, replacement: 'Trapist unu' },
  { pattern: /\bTRAPPIST\b/gi, replacement: 'Trapist' },
  { pattern: /\bHelix\b/gi, replacement: 'Helics' },
  { pattern: /\bMessier\b/gi, replacement: 'Mesie' },
];

/**
 * Elimină toate emoji-urile și simbolurile grafice decorative dintr-un șir de caractere,
 * pentru ca sintetizatorul vocal să nu le citească numele în engleză.
 */
export function stripEmojisAndDecorativeSymbols(input: string): string {
  return input
    .replace(
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: intervalul de simboluri/emoji (inclusiv ZWJ) este intenționat pentru eliminarea emoji-urilor
      /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0E\uFE0F\u200D\u2600-\u27BF]/gu,
      ' '
    )
    .replace(/[|•«»„”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Transformă orice text științific și astronomic într-o formă fonetică românească naturală:
 * a) Elimină emoji-urile și simbolurile decorative;
 * b) Elimină acronimele dublate în paranteze și convertește formulele chimice și clasele spectrale;
 * c) Transformă temperaturile negative/pozitive (`-110 °C` -> `"minus 110 grade Celsius"`, `+460 °C` -> `"plus 460 de grade Celsius"`);
 * d) Expandează unitățile de măsură (`km/h`, `km/s`, `mil. km`, `mld. km`, `km`, `UA`/`AU`, `1c`, `g/cm³`);
 * e) Aplică dicționarul fonetic pentru misiuni, sonde și corpuri cerești;
 * f) Înlocuiește punctul sau virgula zecimală dintre cifre (`24.6` / `24,6`) cu `"virgulă"` (`"24 virgulă 6"`).
 */
export function normalizeRomanianSpeechText(rawText: string): string {
  if (!rawText) return '';

  // 1. Curățăm emoji-urile și simbolurile decorative
  let text = stripEmojisAndDecorativeSymbols(rawText);

  // 1b. Eliminăm acronimele redundante din paranteze înainte de dicționarul fonetic
  for (const entry of REDUNDANT_ACRONYM_PATTERNS) {
    text = text.replace(entry.pattern, entry.replacement);
  }

  // 1c. Formule chimice, clase spectrale și notații de catalog astronomic
  text = text.replace(/\bCO[₂2]\b/g, 'dioxid de carbon');
  text = text.replace(/\bH[₂2]O\b/g, 'apă');
  text = text.replace(/\bH[₂2]SO[₄4]\b/g, 'acid sulfuric');
  text = text.replace(/\bCH[₄4]\b/g, 'metan');
  text = text.replace(/\bNH[₃3]\b/g, 'amoniac');
  text = text.replace(/\bSO[₂2]\b/g, 'dioxid de sulf');
  text = text.replace(/\bN[₂2]\b/g, 'azot');
  text = text.replace(/\bO[₂2]\b/g, 'oxigen');
  text = text.replace(/\bFe[-–]Ni\b/g, 'fier și nichel');
  text = text.replace(/\bG2V\b/g, 'tip G doi V');
  text = text.replace(/\bSBbc\b/g, 'spirală barată');
  text = text.replace(/\bSA\(s\)cd\b/g, 'spirală deschisă');
  text = text.replace(/10¹²/g, 'o mie de miliarde de');
  text = text.replace(/M☉/g, 'mase solare');
  text = text.replace(/\bM(\d{1,3})\b/g, 'Mesie $1');
  text = text.replace(/\bNGC\s*(\d+)\b/g, 'N G C $1');
  text = text.replace(/\bd\.Hr\./gi, 'după Hristos');
  text = text.replace(/\bî\.Hr\./gi, 'înainte de Hristos');
  text = text.replace(/\s*&\s*/g, ' și ');

  // Rapoarte de rezonanță orbitală (ex: 4:2:1 -> "4 la 2 la 1", 3:2 -> "3 la 2")
  text = text.replace(/\b(\d+):(\d+):(\d+)\b/g, '$1 la $2 la $3');
  text = text.replace(/\b(\d+):(\d+)\b/g, '$1 la $2');

  // 2. Aplicăm dicționarul fonetic pentru misiuni, sonde, nave și corpuri cerești
  for (const entry of PHONETIC_DICTIONARY) {
    text = text.replace(entry.pattern, entry.replacement);
  }

  // 3. Normalizăm separatoarele de mii evidente (ex: 1.500.000 -> 1500000, 50.000 -> 50000, 6.500 -> 6500, 1.344 -> 1344)
  text = text.replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3$4');
  text = text.replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3');
  text = text.replace(/\b([1-9]\d{0,2})\.(\d{3})\b/g, '$1$2');

  // 4. Temperaturi negative și pozitive:
  // Inclusiv "15 milioane °C" sau "15 milioane grade C"
  text = text.replace(
    /(\d+(?:[.,]\d+)?)\s+(milioane|miliarde|mii)\s+(?:de\s+)?(?:°\s*C\b|grade\s+C\b|grade\s+Celsius\b)/gi,
    '$1 $2 de grade Celsius'
  );

  // -110 °C sau -110°C -> "minus 110 grade Celsius"
  text = text.replace(
    /(?<![\w\d])[-−]\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*C\b|grade\s+C\b|grade\s+Celsius\b)/gi,
    'minus $1 grade Celsius'
  );

  // +460 °C sau +460°C -> "plus 460 de grade Celsius" (sau "plus X grade Celsius" pentru < 20)
  text = text.replace(
    /(?<![\w\d])\+\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*C\b|grade\s+C\b|grade\s+Celsius\b)/gi,
    (_match, numStr: string) => {
      const intVal = parseInt(numStr.split(/[.,]/)[0] ?? '0', 10);
      const prep =
        intVal >= 20 && intVal % 100 >= 20
          ? 'de grade Celsius'
          : intVal >= 20 && intVal % 100 === 0
          ? 'de grade Celsius'
          : 'grade Celsius';
      return `plus ${numStr} ${prep}`;
    }
  );

  // Temperaturi fără semn explicit: 15 °C -> "15 grade Celsius"
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*(?:°\s*C\b|grade\s+C\b)/gi, '$1 grade Celsius');

  // Alte numere negative de sine stătătoare (ex: -63 -> "minus 63")
  text = text.replace(/(?<![\w\d])[-−](\d+(?:[.,]\d+)?)\b/g, 'minus $1');

  // Intervalele numerice (ex: 6–8 ani, 2,1–3,3 UA) -> "6 până la 8"
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)/g, '$1 până la $2');

  // 5. Zecimale în limba română: 24.6 sau 24,6 -> "24 virgulă 6"
  text = text.replace(/(\d+)[.,](\d+)/g, '$1 virgulă $2');

  // 6. Unități de măsură astronomice și fizice
  text = text.replace(/\bg\s*\/\s*cm[³3]\b/gi, 'grame pe centimetru cub');
  text = text.replace(/\bkg\s*\/\s*m[³3]\b/gi, 'kilograme pe metru cub');
  text = text.replace(/\bm\s*\/\s*s[²2]\b/gi, 'metri pe secundă la pătrat');
  text = text.replace(/\bmil\.\s*km\b/gi, 'milioane de kilometri');
  text = text.replace(/\bmld\.\s*km\b/gi, 'miliarde de kilometri');
  text = text.replace(/\bmilioane\s+km\b/gi, 'milioane de kilometri');
  text = text.replace(/\bmiliarde\s+km\b/gi, 'miliarde de kilometri');
  text = text.replace(/\bkm\s*\/\s*h\b/gi, 'kilometri pe oră');
  text = text.replace(/\bkm\s*\/\s*s\b/gi, 'kilometri pe secundă');
  text = text.replace(/\bm\s*\/\s*s\b/gi, 'metri pe secundă');
  text = text.replace(/\bkm\b/gi, 'kilometri');
  text = text.replace(/\b1\s+(?:UA|AU)\b/g, 'o Unitate Astronomică');
  text = text.replace(/\b(?:UA|AU)\b/g, 'Unități Astronomice');
  text = text.replace(/\ba\.l\.(?=\s|$|[.,;!?)]|\b)/gi, 'ani-lumină');
  text = text.replace(/(\d+(?:\s+virgulă\s+\d+)?)\s+\bal\b/gi, '$1 ani-lumină');
  text = text.replace(/\b1c\b/gi, 'viteza luminii');
  text = text.replace(/×/g, ' ori ');
  text = text.replace(/~/g, 'aproximativ ');
  text = text.replace(/°/g, ' grade ');

  // Înlocuim slash-ul dintre cuvinte (ex: "gaz/gheață", "lenticulară/neregulată") cu " sau "
  text = text.replace(/([a-zA-ZăâîșțĂÂÎȘȚ])\s*\/\s*([a-zA-ZăâîșțĂÂÎȘȚ])/g, '$1 sau $2');

  // 7. Curățare finală a spațiilor multiple
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Împarte un text normalizat în propoziții individuale după `.`, `!`, `?`,
 * păstrând intonația finală a fiecărei propoziții pentru sinteza vocală cu micro-pauze.
 */
export function splitIntoSpeechSentences(normalizedText: string): string[] {
  const cleaned = normalizedText.trim();
  if (!cleaned) return [];

  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  return parts.length > 0 ? parts : [cleaned];
}

export class RomanianSpeechNormalizer {
  public static normalize(rawText: string): string {
    return normalizeRomanianSpeechText(rawText);
  }

  public static stripEmojis(rawText: string): string {
    return stripEmojisAndDecorativeSymbols(rawText);
  }

  public static splitSentences(normalizedText: string): string[] {
    return splitIntoSpeechSentences(normalizedText);
  }
}

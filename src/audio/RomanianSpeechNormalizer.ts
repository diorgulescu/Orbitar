// SPDX-License-Identifier: GPL-3.0-or-later

/**
 * Dicționar fonetic pentru adaptarea pronunției numelor de misiuni, sonde,
 * nave spațiale și corpuri cerești la fonetica limbii române.
 * Se aplică EXCLUSIV textului trimis către sinteza vocală (fără a modifica UI-ul).
 */
const PHONETIC_DICTIONARY: ReadonlyArray<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bParker Solar Probe\b/gi, replacement: 'Sonda Solară Parcăr' },
  { pattern: /\bNew Horizons\b/gi, replacement: 'Niu Horaizăns' },
  { pattern: /\bJames Webb\b/gi, replacement: 'Geims Ueb' },
  { pattern: /\bJWST\b/g, replacement: 'Geims Ueb' },
  { pattern: /\bOSIRIS-REx\b/gi, replacement: 'Osiris Recs' },
  { pattern: /\bVlaicu-1\b/gi, replacement: 'Vlaicu unu' },
  { pattern: /\bCoandă-X\b/gi, replacement: 'Coandă Ics' },
  { pattern: /\bVoyager\s+1\b/gi, replacement: 'Voiager unu' },
  { pattern: /\bVoyager\s+2\b/gi, replacement: 'Voiager doi' },
  { pattern: /\bVoyager\b/gi, replacement: 'Voiager' },
  { pattern: /\bHubble\b/gi, replacement: 'Habăl' },
  { pattern: /\bPerseverance\b/gi, replacement: 'Perseverăns' },
  { pattern: /\bCuriosity\b/gi, replacement: 'Chiuriositi' },
  { pattern: /\bIngenuity\b/gi, replacement: 'Ingeniuiti' },
  { pattern: /\bISS\b/g, replacement: 'Stația Spațială Internațională' },
  { pattern: /\bGanymede\b/gi, replacement: 'Ganimede' },
  { pattern: /\bCallisto\b/gi, replacement: 'Calisto' },
  { pattern: /\bEnceladus\b/gi, replacement: 'Ențeladus' },
  { pattern: /\bMakemake\b/gi, replacement: 'Make-make' },
  { pattern: /\bHaumea\b/gi, replacement: 'Ha-u-mea' },
  { pattern: /\bBennu\b/gi, replacement: 'Benu' },
  { pattern: /\bPsyche\b/gi, replacement: 'Psihe' },
  { pattern: /\bPhilae\b/gi, replacement: 'File' },
  { pattern: /\bSagittarius\s+A\s*\*/gi, replacement: 'Sagitarius A stea' },
  { pattern: /\bSgr\s+A\s*\*/gi, replacement: 'Sagitarius A stea' },
  { pattern: /\bSagittarius\b/gi, replacement: 'Sagitarius' },
  { pattern: /\bProxima\s+Centauri\b/gi, replacement: 'Procsima Centauri' },
  { pattern: /\bProxima\b/gi, replacement: 'Procsima' },
  { pattern: /\bBetelgeuse\b/gi, replacement: 'Betelgeuz' },
  { pattern: /\bTRAPPIST-1\b/gi, replacement: 'Trapist unu' },
  { pattern: /\bTRAPPIST\b/gi, replacement: 'Trapist' },
  { pattern: /\bOort\b/gi, replacement: 'Ort' },
];

/**
 * Elimină toate emoji-urile și simbolurile grafice decorative dintr-un șir de caractere,
 * pentru ca sintetizatorul vocal să nu le citească numele în engleză.
 */
export function stripEmojisAndDecorativeSymbols(input: string): string {
  return input
    .replace(
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
 * b) Transformă temperaturile negative/pozitive (`-110 °C` -> `"minus 110 grade Celsius"`, `+460 °C` -> `"plus 460 de grade Celsius"`);
 * c) Expandează unitățile de măsură (`km/h`, `km/s`, `mil. km`, `mld. km`, `km`, `UA`/`AU`, `1c`);
 * d) Aplică dicționarul fonetic pentru misiuni, sonde și corpuri cerești (`Voyager` -> `"Voiager"`, `JWST` -> `"Geims Ueb"` etc.);
 * e) Înlocuiește punctul sau virgula zecimală dintre cifre (`24.6` / `24,6`) cu `"virgulă"` (`"24 virgulă 6"`).
 */
export function normalizeRomanianSpeechText(rawText: string): string {
  if (!rawText) return '';

  // 1. Curățăm emoji-urile și simbolurile decorative
  let text = stripEmojisAndDecorativeSymbols(rawText);

  // 2. Aplicăm dicționarul fonetic pentru misiuni, sonde, nave și corpuri cerești
  // (înainte de conversia zecimalelor și a liniuțelor, pentru a păstra "Vlaicu-1", "Coandă-X", "OSIRIS-REx")
  for (const entry of PHONETIC_DICTIONARY) {
    text = text.replace(entry.pattern, entry.replacement);
  }

  // 3. Normalizăm separatoarele de mii evidente (ex: 1.500.000 -> 1500000, 50.000 -> 50000)
  text = text.replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3$4');
  text = text.replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3');
  text = text.replace(/\b([1-9]\d{1,2})\.(000)\b/g, '$1$2');

  // 4. Temperaturi negative și pozitive:
  // -110 °C sau -110°C -> "minus 110 grade Celsius"
  text = text.replace(
    /(?<![\w\d])[-−]\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*C\b|grade\s+Celsius\b)/gi,
    'minus $1 grade Celsius'
  );

  // +460 °C sau +460°C -> "plus 460 de grade Celsius" (sau "plus X grade Celsius" pentru < 20)
  text = text.replace(
    /(?<![\w\d])\+\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*C\b|grade\s+Celsius\b)/gi,
    (_match, numStr: string) => {
      const intVal = parseInt(numStr.split(/[.,]/)[0] ?? '0', 10);
      const prep = intVal >= 20 && intVal % 100 >= 20 ? 'de grade Celsius' : intVal >= 20 && intVal % 100 === 0 ? 'de grade Celsius' : 'grade Celsius';
      return `plus ${numStr} ${prep}`;
    }
  );

  // Temperaturi fără semn explicit: 15 °C -> "15 grade Celsius"
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*°\s*C\b/gi, '$1 grade Celsius');

  // Alte numere negative de sine stătătoare (ex: -63 -> "minus 63")
  text = text.replace(/(?<![\w\d])[-−](\d+(?:[.,]\d+)?)\b/g, 'minus $1');

  // Intervalele numerice (ex: 6–8 ani, 2,1–3,3 UA) -> "6 până la 8"
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)/g, '$1 până la $2');

  // 5. Zecimale în limba română: 24.6 sau 24,6 -> "24 virgulă 6"
  text = text.replace(/(\d+)[.,](\d+)/g, '$1 virgulă $2');

  // 6. Unități de măsură astronomice și fizice
  text = text.replace(/\bmil\.\s*km\b/gi, 'milioane de kilometri');
  text = text.replace(/\bmld\.\s*km\b/gi, 'miliarde de kilometri');
  text = text.replace(/\bmilioane\s+km\b/gi, 'milioane de kilometri');
  text = text.replace(/\bmiliarde\s+km\b/gi, 'miliarde de kilometri');
  text = text.replace(/\bkm\s*\/\s*h\b/gi, 'kilometri pe oră');
  text = text.replace(/\bkm\s*\/\s*s\b/gi, 'kilometri pe secundă');
  text = text.replace(/\bkm\b/gi, 'kilometri');
  text = text.replace(/\b(?:UA|AU)\b/g, 'Unități Astronomice');
  text = text.replace(/\ba\.l\.(?=\s|$|[.,;!?)]|\b)/gi, 'ani-lumină');
  text = text.replace(/(\d+(?:\s+virgulă\s+\d+)?)\s+\bal\b/gi, '$1 ani-lumină');
  text = text.replace(/\b1c\b/gi, 'viteza luminii');
  text = text.replace(/×/g, ' ori ');
  text = text.replace(/~/g, 'aproximativ ');
  text = text.replace(/°/g, ' grade ');

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

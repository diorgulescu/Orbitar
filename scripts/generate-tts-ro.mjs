// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Dicționar fonetic identic cu `src/audio/RomanianSpeechNormalizer.ts`
 * pentru ca fișierele audio `.mp3` generate în `public/audio/tts/` să rostească
 * impecabil numele sondelor, misiunilor, temperaturilor și zecimalelor în română.
 */
const PHONETIC_DICTIONARY = [
  { pattern: /\bParker Solar Probe\b/gi, replacement: 'Sonda Solară Parcăr' },
  { pattern: /\bNew Horizons\b/gi, replacement: 'Niu Horaizăns' },
  { pattern: /\bJames Webb\b/gi, replacement: 'Geims Ueb' },
  { pattern: /\bJWST\b/g, replacement: 'Geims Ueb' },
  { pattern: /\bOSIRIS-REx\b/gi, replacement: 'Osiris Recs' },
  { pattern: /\bVlaicu-1\b/gi, replacement: 'Vlaicu unu' },
  { pattern: /\bCoandă-X\b/gi, replacement: 'Coandă Ics' },
  { pattern: /\bProxima Centauri\b/gi, replacement: 'Procsima Centauri' },
  { pattern: /\bTRAPPIST-1\b/gi, replacement: 'Trapist unu' },
  { pattern: /Sagittarius\s+A\*/gi, replacement: 'Sagitarius A stea' },
  { pattern: /\bSagittarius\b/gi, replacement: 'Sagitarius' },
  { pattern: /\bBetelgeuse\b/gi, replacement: 'Betelgeuz' },
  { pattern: /\bOort\b/gi, replacement: 'Ort' },
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
];

export function normalizeRomanianSpeechText(rawText) {
  if (!rawText) return '';

  let text = rawText
    .replace(
      /[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0E\uFE0F\u200D\u2600-\u27BF]/gu,
      ' '
    )
    .replace(/[|•«»„”"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  for (const entry of PHONETIC_DICTIONARY) {
    text = text.replace(entry.pattern, entry.replacement);
  }

  text = text.replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3$4');
  text = text.replace(/\b(\d{1,3})\.(\d{3})\.(\d{3})\b/g, '$1$2$3');
  text = text.replace(/\b([1-9]\d{1,2})\.(000)\b/g, '$1$2');

  text = text.replace(
    /(?<![\w\d])[-−]\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*C\b|grade\s+Celsius\b)/gi,
    'minus $1 grade Celsius'
  );

  text = text.replace(
    /(?<![\w\d])\+\s*(\d+(?:[.,]\d+)?)\s*(?:°\s*C\b|grade\s+Celsius\b)/gi,
    (_match, numStr) => {
      const intVal = parseInt(numStr.split(/[.,]/)[0] ?? '0', 10);
      const prep =
        (intVal >= 20 && intVal % 100 >= 20) || (intVal >= 20 && intVal % 100 === 0)
          ? 'de grade Celsius'
          : 'grade Celsius';
      return `plus ${numStr} ${prep}`;
    }
  );

  text = text.replace(/(\d+(?:[.,]\d+)?)\s*°\s*C\b/gi, '$1 grade Celsius');
  text = text.replace(/(?<![\w\d])[-−](\d+(?:[.,]\d+)?)\b/g, 'minus $1');
  text = text.replace(/(\d+(?:[.,]\d+)?)\s*[–—-]\s*(\d+(?:[.,]\d+)?)/g, '$1 până la $2');
  text = text.replace(/(\d+)[.,](\d+)/g, '$1 virgulă $2');

  text = text.replace(/\bmil\.\s*km\b/gi, 'milioane de kilometri');
  text = text.replace(/\bmld\.\s*km\b/gi, 'miliarde de kilometri');
  text = text.replace(/\bmilioane\s+km\b/gi, 'milioane de kilometri');
  text = text.replace(/\bmiliarde\s+km\b/gi, 'miliarde de kilometri');
  text = text.replace(/\ba\.l\.(?!\w)/gi, 'ani-lumină');
  text = text.replace(/(\d+)\s+al\b/gi, '$1 ani-lumină');
  text = text.replace(/\bkm\s*\/\s*h\b/gi, 'kilometri pe oră');
  text = text.replace(/\bkm\s*\/\s*s\b/gi, 'kilometri pe secundă');
  text = text.replace(/\bkm\b/gi, 'kilometri');
  text = text.replace(/\b(?:UA|AU)\b/g, 'Unități Astronomice');
  text = text.replace(/\b1c\b/gi, 'viteza luminii');
  text = text.replace(/×/g, ' ori ');
  text = text.replace(/~/g, 'aproximativ ');
  text = text.replace(/°/g, ' grade ');

  return text.replace(/\s+/g, ' ').trim();
}

async function commandExists(cmd) {
  try {
    await execFileAsync('which', [cmd]);
    return true;
  } catch {
    return false;
  }
}

async function detectSynthesisEngine() {
  const forced = process.env.ORBITAR_TTS_ENGINE;
  if (forced) return forced;

  if (await commandExists('edge-tts')) {
    return 'edge-tts';
  }
  if (await commandExists('piper')) {
    return 'piper';
  }
  if ((await commandExists('say')) && (await commandExists('ffmpeg'))) {
    return 'macos-ioana';
  }
  return 'none';
}

async function synthesizeToMp3(engine, normalizedText, outputMp3Path) {
  const voice = process.env.ORBITAR_TTS_VOICE || 'ro-RO-AlinaNeural';

  if (engine === 'edge-tts') {
    await execFileAsync('edge-tts', [
      '--voice',
      voice,
      '--rate=-4%',
      '--pitch=+2Hz',
      '--text',
      normalizedText,
      '--write-media',
      outputMp3Path,
    ]);
    return;
  }

  if (engine === 'piper') {
    const modelPath = process.env.ORBITAR_PIPER_MODEL || 'ro_RO-mihai-medium.onnx';
    const tmpWav = path.join(
      os.tmpdir(),
      `orbitar_piper_${path.basename(outputMp3Path, '.mp3')}_${process.pid}.wav`
    );
    try {
      await execFileAsync('sh', [
        '-c',
        `printf "%s" "$1" | piper --model "$2" --output_file "$3"`,
        '--',
        normalizedText,
        modelPath,
        tmpWav,
      ]);
      await execFileAsync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-i',
        tmpWav,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '48k',
        '-ar',
        '24000',
        '-ac',
        '1',
        outputMp3Path,
      ]);
    } finally {
      if (fs.existsSync(tmpWav)) fs.unlinkSync(tmpWav);
    }
    return;
  }

  if (engine === 'macos-ioana') {
    const tmpAiff = path.join(
      os.tmpdir(),
      `orbitar_tts_${path.basename(outputMp3Path, '.mp3')}_${process.pid}.aiff`
    );
    try {
      await execFileAsync('say', ['-v', 'Ioana', '-r', '172', '-o', tmpAiff, normalizedText]);
      await execFileAsync('ffmpeg', [
        '-y',
        '-loglevel',
        'error',
        '-i',
        tmpAiff,
        '-codec:a',
        'libmp3lame',
        '-b:a',
        '48k',
        '-ar',
        '24000',
        '-ac',
        '1',
        outputMp3Path,
      ]);
    } finally {
      if (fs.existsSync(tmpAiff)) fs.unlinkSync(tmpAiff);
    }
  }
}

async function main() {
  const rootDir = process.cwd();
  const solarPath = path.resolve(rootDir, 'public/data/solar-system-ro.json');
  const missionsPath = path.resolve(rootDir, 'public/data/missions-ro.json');
  const deepSpacePath = path.resolve(rootDir, 'public/data/deep-space-ro.json');
  const outputDir = path.resolve(rootDir, 'public/audio/tts');

  fs.mkdirSync(outputDir, { recursive: true });

  const solarData = JSON.parse(fs.readFileSync(solarPath, 'utf8'));
  const missionsData = JSON.parse(fs.readFileSync(missionsPath, 'utf8'));
  const deepSpaceData = fs.existsSync(deepSpacePath)
    ? JSON.parse(fs.readFileSync(deepSpacePath, 'utf8'))
    : { deepSpace: [] };
  const allBodies = [
    ...(solarData.bodies || []),
    ...(missionsData.missions || []),
    ...(deepSpaceData.objects || deepSpaceData.deepSpace || []),
  ];

  const engine = await detectSynthesisEngine();
  console.log(`[Orbitar TTS] Motor de sinteză selectat: ${engine}`);
  console.log(`[Orbitar TTS] Corpuri cerești și misiuni de procesat: ${allBodies.length} (× 2 niveluri = ${allBodies.length * 2} fișiere)`);

  const tasks = [];
  const manifestEntries = {};

  for (const d of allBodies) {
    const rawJunior = `${d.name}. ${d.subtitle}. ${d.junior.summary} Analogie: ${d.junior.analogy} Știai că? ${d.junior.funFact}`;
    const rawCadet = `${d.name}. ${d.subtitle}. ${d.cadet.summary} Istoricul explorării: ${d.cadet.explorationHistory}`;

    const normJunior = normalizeRomanianSpeechText(rawJunior);
    const normCadet = normalizeRomanianSpeechText(rawCadet);

    const juniorFile = `${d.id}_junior.mp3`;
    const cadetFile = `${d.id}_cadet.mp3`;

    manifestEntries[`${d.id}_junior`] = {
      bodyId: d.id,
      tier: 'junior',
      file: `./audio/tts/${juniorFile}`,
      normalizedText: normJunior,
    };
    manifestEntries[`${d.id}_cadet`] = {
      bodyId: d.id,
      tier: 'cadet',
      file: `./audio/tts/${cadetFile}`,
      normalizedText: normCadet,
    };

    tasks.push({
      key: `${d.id}_junior`,
      normalizedText: normJunior,
      outputPath: path.join(outputDir, juniorFile),
    });
    tasks.push({
      key: `${d.id}_cadet`,
      normalizedText: normCadet,
      outputPath: path.join(outputDir, cadetFile),
    });
  }

  if (engine !== 'none') {
    const concurrency = 6;
    let completed = 0;

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (t) => {
          if (
            process.env.ORBITAR_TTS_FORCE !== '1' &&
            fs.existsSync(t.outputPath) &&
            fs.statSync(t.outputPath).size > 1024
          ) {
            completed += 1;
            return;
          }
          await synthesizeToMp3(engine, t.normalizedText, t.outputPath);
          completed += 1;
        })
      );
      process.stdout.write(`\r[Orbitar TTS] Generat ${completed}/${tasks.length} fișiere MP3 în public/audio/tts/...`);
    }
    process.stdout.write('\n');
  } else {
    console.log(
      '[Orbitar TTS] Niciun sintetizator CLI local (edge-tts / piper / say) detectat — s-a generat manifestul fonetic normalizat.'
    );
  }

  const manifestPath = path.join(outputDir, 'manifest.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        version: '1.0.0',
        license: 'GPL-3.0-or-later',
        engine,
        count: tasks.length,
        entries: manifestEntries,
      },
      null,
      2
    ),
    'utf8'
  );

  console.log(`[Orbitar TTS] Finalizat! Manifest salvat în ${path.relative(rootDir, manifestPath)}`);
}

main().catch((err) => {
  console.error('[Orbitar TTS] Eroare:', err);
  process.exit(1);
});

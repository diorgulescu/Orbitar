// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import tls from 'node:tls';
import https from 'node:https';
import crypto from 'node:crypto';
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
      // biome-ignore lint/suspicious/noMisleadingCharacterClass: intervalul de simboluri/emoji (inclusiv ZWJ) este intenționat pentru eliminarea emoji-urilor
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
  text = text.replace(/\b([1-9]\d{0,2})\.(\d{3})\b/g, '$1$2');

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

const EDGE_TRUSTED_TOKEN = '6A5AA1D4EAFF4E9FB37E23D68491D6F4';
const EDGE_CHROMIUM_VERSION = '130.0.2849.68';

function generateSecMsGec() {
  const winEpoch = 11644473600;
  let ticks = Math.floor(Date.now() / 1000) + winEpoch;
  ticks -= ticks % 300;
  const winTicks = BigInt(ticks) * 10000000n;
  const toHash = `${winTicks.toString()}${EDGE_TRUSTED_TOKEN}`;
  return crypto.createHash('sha256').update(toHash, 'ascii').digest('hex').toUpperCase();
}

function escapeSsml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function encodeWsTextFrame(str) {
  const payload = Buffer.from(str, 'utf8');
  const mask = crypto.randomBytes(4);
  let header;
  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = 0x80 | payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 0x80 | 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 0x80 | 127;
    header.writeBigUInt64BE(BigInt(payload.length), 2);
  }
  const masked = Buffer.alloc(payload.length);
  for (let i = 0; i < payload.length; i++) {
    masked[i] = payload[i] ^ mask[i % 4];
  }
  return Buffer.concat([header, mask, masked]);
}

/**
 * Sintetizează direct cu Microsoft Edge Neural TTS (ro-RO-AlinaNeural / ro-RO-EmilNeural)
 * prin conexiune TLS WebSocket nativă Node.js, fără dependențe externe.
 */
function synthesizeWithEdgeNeuralSocket(normalizedText, outputMp3Path, voice = 'ro-RO-AlinaNeural') {
  return new Promise((resolve, reject) => {
    const connId = crypto.randomUUID().replace(/-/g, '');
    const reqId = crypto.randomUUID().replace(/-/g, '');
    const secMsGec = generateSecMsGec();
    const wsKey = crypto.randomBytes(16).toString('base64');
    const host = 'speech.platform.bing.com';
    const wsPath = `/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=${EDGE_TRUSTED_TOKEN}&Sec-MS-GEC=${secMsGec}&Sec-MS-GEC-Version=1-${EDGE_CHROMIUM_VERSION}&ConnectionId=${connId}`;

    const socket = tls.connect({ host, port: 443, servername: host }, () => {
      const handshake = [
        `GET ${wsPath} HTTP/1.1`,
        `Host: ${host}`,
        'Pragma: no-cache',
        'Cache-Control: no-cache',
        `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/${EDGE_CHROMIUM_VERSION}`,
        'Origin: chrome-extension://jdiccldimpdaibmpdkjnbmckianbfold',
        'Upgrade: websocket',
        'Connection: Upgrade',
        `Sec-WebSocket-Key: ${wsKey}`,
        'Sec-WebSocket-Version: 13',
        'Accept-Encoding: gzip, deflate, br',
        'Accept-Language: ro-RO,ro;q=0.9,en-US;q=0.8,en;q=0.7',
        '\r\n',
      ].join('\r\n');
      socket.write(handshake);
    });

    let upgraded = false;
    let recvBuf = Buffer.alloc(0);
    const audioChunks = [];
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        socket.destroy();
        reject(new Error('Timeout la conectarea Edge Neural TTS'));
      }
    }, 15000);

    const finishError = (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      reject(err);
    };

    const finishSuccess = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.end();
      const fullMp3 = Buffer.concat(audioChunks);
      if (fullMp3.length < 512) {
        reject(new Error('Flux audio Edge Neural prea scurt'));
        return;
      }
      fs.writeFileSync(outputMp3Path, fullMp3);
      resolve();
    };

    socket.on('error', finishError);

    socket.on('data', (chunk) => {
      recvBuf = Buffer.concat([recvBuf, chunk]);

      if (!upgraded) {
        const headerEnd = recvBuf.indexOf('\r\n\r\n');
        if (headerEnd === -1) return;
        const headerStr = recvBuf.subarray(0, headerEnd).toString('utf8');
        if (!headerStr.includes('101 Switching Protocols')) {
          finishError(new Error(`Handshake respins: ${headerStr.split('\r\n')[0]}`));
          return;
        }
        upgraded = true;
        recvBuf = recvBuf.subarray(headerEnd + 4);

        const ts = new Date().toUTCString();
        const configMsg =
          `X-Timestamp:${ts}\r\n` +
          'Content-Type:application/json; charset=utf-8\r\n' +
          'Path:speech.config\r\n\r\n' +
          JSON.stringify({
            context: {
              synthesis: {
                audio: {
                  metadataoptions: {
                    sentenceBoundaryEnabled: 'false',
                    wordBoundaryEnabled: 'false',
                  },
                  outputFormat: 'audio-24khz-48kbitrate-mono-mp3',
                },
              },
            },
          });

        const ssml =
          `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='ro-RO'>` +
          `<voice name='${voice}'>` +
          `<prosody pitch='+2Hz' rate='-4%' volume='+0%'>${escapeSsml(normalizedText)}</prosody>` +
          `</voice></speak>`;

        const ssmlMsg =
          `X-RequestId:${reqId}\r\n` +
          'Content-Type:application/ssml+xml\r\n' +
          `X-Timestamp:${ts}Z\r\n` +
          'Path:ssml\r\n\r\n' +
          ssml;

        socket.write(encodeWsTextFrame(configMsg));
        socket.write(encodeWsTextFrame(ssmlMsg));
      }

      while (recvBuf.length >= 2) {
        const firstByte = recvBuf[0];
        const secondByte = recvBuf[1];
        const opcode = firstByte & 0x0f;
        const isMasked = (secondByte & 0x80) !== 0;
        let payloadLen = secondByte & 0x7f;
        let offset = 2;

        if (payloadLen === 126) {
          if (recvBuf.length < 4) return;
          payloadLen = recvBuf.readUInt16BE(2);
          offset = 4;
        } else if (payloadLen === 127) {
          if (recvBuf.length < 10) return;
          payloadLen = Number(recvBuf.readBigUInt64BE(2));
          offset = 10;
        }

        const maskLen = isMasked ? 4 : 0;
        if (recvBuf.length < offset + maskLen + payloadLen) return;

        let frameData = recvBuf.subarray(offset + maskLen, offset + maskLen + payloadLen);
        if (isMasked) {
          const maskKey = recvBuf.subarray(offset, offset + 4);
          frameData = Buffer.from(frameData);
          for (let i = 0; i < frameData.length; i++) {
            frameData[i] ^= maskKey[i % 4];
          }
        }
        recvBuf = recvBuf.subarray(offset + maskLen + payloadLen);

        if (opcode === 0x02) {
          // Cadru binar: primele 2 octeți reprezintă lungimea antetului text
          if (frameData.length > 2) {
            const headerLen = frameData.readUInt16BE(0);
            const headerText = frameData.subarray(2, 2 + headerLen).toString('utf8');
            if (headerText.includes('Path:audio')) {
              const mp3Slice = frameData.subarray(2 + headerLen);
              if (mp3Slice.length > 0) {
                audioChunks.push(mp3Slice);
              }
            }
          }
        } else if (opcode === 0x01) {
          const textMsg = frameData.toString('utf8');
          if (textMsg.includes('Path:turn.end')) {
            finishSuccess();
            return;
          }
        } else if (opcode === 0x08) {
          if (audioChunks.length > 0) {
            finishSuccess();
          } else {
            finishError(new Error('Conexiune WebSocket închisă prematur'));
          }
          return;
        }
      }
    });
  });
}

function splitIntoChunksForGoogleTts(text, maxLen = 185) {
  const rawSentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const chunks = [];
  for (const s of rawSentences) {
    if (s.length <= maxLen) {
      chunks.push(s);
    } else {
      const words = s.split(/\s+/);
      let current = '';
      for (const w of words) {
        if ((current + ' ' + w).trim().length > maxLen) {
          if (current) chunks.push(current.trim());
          current = w;
        } else {
          current = (current + ' ' + w).trim();
        }
      }
      if (current) chunks.push(current.trim());
    }
  }
  return chunks;
}

function downloadHttpsBuffer(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
          },
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          const parts = [];
          res.on('data', (d) => parts.push(d));
          res.on('end', () => resolve(Buffer.concat(parts)));
        }
      )
      .on('error', reject);
  });
}

async function synthesizeWithGoogleNeuralRo(normalizedText, outputMp3Path) {
  const chunks = splitIntoChunksForGoogleTts(normalizedText, 180);
  const tmpFiles = [];
  try {
    for (let i = 0; i < chunks.length; i++) {
      const q = encodeURIComponent(chunks[i]);
      const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=ro&client=tw-ob&q=${q}`;
      const buf = await downloadHttpsBuffer(url);
      const tmpPath = path.join(
        os.tmpdir(),
        `orbitar_gtts_${path.basename(outputMp3Path, '.mp3')}_${process.pid}_${i}.mp3`
      );
      fs.writeFileSync(tmpPath, buf);
      tmpFiles.push(tmpPath);
    }

    if (tmpFiles.length === 1) {
      fs.copyFileSync(tmpFiles[0], outputMp3Path);
    } else {
      const concatListPath = path.join(
        os.tmpdir(),
        `orbitar_gtts_list_${path.basename(outputMp3Path, '.mp3')}_${process.pid}.txt`
      );
      const listContent = tmpFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
      fs.writeFileSync(concatListPath, listContent, 'utf8');
      try {
        await execFileAsync('ffmpeg', [
          '-y',
          '-loglevel',
          'error',
          '-f',
          'concat',
          '-safe',
          '0',
          '-i',
          concatListPath,
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
        if (fs.existsSync(concatListPath)) fs.unlinkSync(concatListPath);
      }
    }
  } finally {
    for (const f of tmpFiles) {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    }
  }
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
  // Testăm dacă Microsoft Edge Neural TTS (ro-RO-AlinaNeural) este accesibil prin conexiune directă
  const probeFile = path.join(os.tmpdir(), `orbitar_edge_probe_${process.pid}.mp3`);
  try {
    await synthesizeWithEdgeNeuralSocket('Orbitar.', probeFile, 'ro-RO-AlinaNeural');
    if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);
    return 'msedge-neural-ro';
  } catch {
    if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);
  }

  // Fallback neural secundar: Google Neural Romanian TTS
  try {
    await synthesizeWithGoogleNeuralRo('Orbitar.', probeFile);
    if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);
    return 'google-neural-ro';
  } catch {
    if (fs.existsSync(probeFile)) fs.unlinkSync(probeFile);
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

  if (engine === 'msedge-neural-ro') {
    await synthesizeWithEdgeNeuralSocket(normalizedText, outputMp3Path, voice);
    return;
  }

  if (engine === 'google-neural-ro') {
    await synthesizeWithGoogleNeuralRo(normalizedText, outputMp3Path);
    return;
  }

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

  const manifestPath = path.join(outputDir, 'manifest.json');
  let previousEngine = '';
  let previousEntries = {};
  if (fs.existsSync(manifestPath)) {
    try {
      const prevJson = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      previousEngine = prevJson.engine || '';
      previousEntries = prevJson.entries || {};
    } catch {}
  }
  const upgradeFromRobotic =
    previousEngine === 'macos-ioana' && engine !== 'macos-ioana' && engine !== 'none';
  const wouldDowngradeToRobotic =
    previousEngine &&
    previousEngine !== 'macos-ioana' &&
    previousEngine !== 'none' &&
    engine === 'macos-ioana';

  if (wouldDowngradeToRobotic) {
    console.error(
      `[Orbitar TTS] Conexiune la motorul neural indisponibilă (s-ar degrada de la ${previousEngine} la macos-ioana). Se oprește fără a suprascrie fișierele neurale.`
    );
    process.exit(1);
  }

  if (engine !== 'none') {
    const concurrency = 4;
    let completed = 0;

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      await Promise.all(
        batch.map(async (t) => {
          const textChanged = previousEntries[t.key]?.normalizedText !== t.normalizedText;
          if (
            process.env.ORBITAR_TTS_FORCE !== '1' &&
            !upgradeFromRobotic &&
            !textChanged &&
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

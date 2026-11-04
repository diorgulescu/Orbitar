// SPDX-License-Identifier: GPL-3.0-or-later
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ICONS_DIR = path.resolve(process.cwd(), 'src-tauri/icons');
fs.mkdirSync(ICONS_DIR, { recursive: true });

// Copiem și sigla vectorială SVG ca referință
const svgSource = path.resolve(process.cwd(), 'public/icons/orbitar-icon.svg');
if (fs.existsSync(svgSource)) {
  fs.copyFileSync(svgSource, path.join(ICONS_DIR, 'icon.svg'));
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function renderOrbitarIconPng(size) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const cx = size / 2;
  const cy = size / 2;
  const radiusBg = size * 0.46;
  const sunRad = size * 0.16;
  const ringRx = size * 0.38;
  const ringRy = size * 0.16;
  const cosA = Math.cos(-0.42);
  const sinA = Math.sin(-0.42);

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0;
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const dist = Math.hypot(dx, dy);

      let r = 7;
      let g = 11;
      let b = 25;
      let a = 0;

      if (dist <= radiusBg) {
        a = 255;
        // Fundal cosmic #070b19 cu halou radial
        const glow = Math.max(0, 1 - dist / radiusBg);
        r = Math.round(7 + glow * 14);
        g = Math.round(11 + glow * 26);
        b = Math.round(25 + glow * 52);

        // Elipsa orbitală cyan #00f0ff
        const rx = (dx * cosA - dy * sinA) / ringRx;
        const ry = (dx * sinA + dy * cosA) / ringRy;
        const ellDist = Math.abs(Math.hypot(rx, ry) - 1.0);
        if (ellDist < 0.095) {
          const blend = 1 - ellDist / 0.095;
          r = Math.round(r * (1 - blend) + 0 * blend);
          g = Math.round(g * (1 - blend) + 240 * blend);
          b = Math.round(b * (1 - blend) + 255 * blend);
        }

        // Soarele central chihlimbar #ffb703
        if (dist <= sunRad) {
          const core = 1 - dist / sunRad;
          r = 255;
          g = Math.round(183 + core * 62);
          b = Math.round(3 + core * 120);
        }
      }

      const idx = rowStart + 1 + x * 4;
      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = a;
    }
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // 8-bit
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', idat),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

const png32 = renderOrbitarIconPng(32);
const png128 = renderOrbitarIconPng(128);
const png256 = renderOrbitarIconPng(256);

fs.writeFileSync(path.join(ICONS_DIR, '32x32.png'), png32);
fs.writeFileSync(path.join(ICONS_DIR, '128x128.png'), png128);
fs.writeFileSync(path.join(ICONS_DIR, '128x128@2x.png'), png256);
fs.writeFileSync(path.join(ICONS_DIR, 'icon.png'), png256);

// Container .ico valid (încapsulând PNG 256x256)
const icoHeader = Buffer.alloc(22);
icoHeader.writeUInt16LE(0, 0); // Reserved
icoHeader.writeUInt16LE(1, 2); // ICO type
icoHeader.writeUInt16LE(1, 4); // 1 image
icoHeader[6] = 0; // 256px width
icoHeader[7] = 0; // 256px height
icoHeader[8] = 0;
icoHeader[9] = 0;
icoHeader.writeUInt16LE(1, 10); // color planes
icoHeader.writeUInt16LE(32, 12); // bits per pixel
icoHeader.writeUInt32LE(png256.length, 14);
icoHeader.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(ICONS_DIR, 'icon.ico'), Buffer.concat([icoHeader, png256]));

// Container .icns valid (încapsulând 'ic08' 256x256 PNG)
const icnsHeader = Buffer.alloc(16);
icnsHeader.write('icns', 0, 'ascii');
icnsHeader.writeUInt32BE(16 + png256.length, 4);
icnsHeader.write('ic08', 8, 'ascii');
icnsHeader.writeUInt32BE(8 + png256.length, 12);
fs.writeFileSync(path.join(ICONS_DIR, 'icon.icns'), Buffer.concat([icnsHeader, png256]));

console.log('Generated Tauri icons in src-tauri/icons/');

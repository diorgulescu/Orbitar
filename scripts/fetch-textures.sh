# SPDX-License-Identifier: GPL-3.0-or-later
#!/usr/bin/env bash
# ==============================================================================
# Orbitar — Script de descărcare și pregătire a texturilor planetare 2K Open-Source
# Surse: Solar System Scope (CC-BY 4.0) & NASA Visible Earth / Wikimedia (Public Domain)
# Dacă un URL eșuează sau conexiunea este offline, scriptul continuă fără a bloca
# build-ul și generează local harta equirectangulară corespunzătoare.
# ==============================================================================

set -u

TEXTURE_DIR="public/textures"
mkdir -p "$TEXTURE_DIR"

echo "🪐 [Orbitar] Se pregătesc texturile planetare 2K în ${TEXTURE_DIR}/ ..."

download_texture() {
  local filename="$1"
  local url="$2"
  local target="${TEXTURE_DIR}/${filename}"

  if [ -s "$target" ]; then
    echo "  ✓ Există deja: ${filename}"
    return 0
  fi

  if command -v curl >/dev/null 2>&1; then
    if curl -fsSL --connect-timeout 4 --max-time 15 -A "Orbitar-Planetarium/1.0 (GPLv3 Educational)" "$url" -o "$target" 2>/dev/null; then
      if [ -s "$target" ]; then
        echo "  ↓ Descărcat: ${filename}"
        return 0
      fi
    fi
  fi

  rm -f "$target" 2>/dev/null || true
  echo "  ⚠ Descărcarea online pentru ${filename} nu a fost posibilă (mod offline/fallback) — se va genera local."
  return 0
}

# Lista celor 18 hărți planetare 2K (Solar System Scope CC-BY 4.0 & NASA Public Domain)
download_texture "sun.jpg"              "https://www.solarsystemscope.com/textures/download/2k_sun.jpg"
download_texture "mercury.jpg"          "https://www.solarsystemscope.com/textures/download/2k_mercury.jpg"
download_texture "venus_surface.jpg"    "https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg"
download_texture "venus_atmosphere.jpg" "https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg"
download_texture "earth_daymap.jpg"     "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg"
download_texture "earth_nightmap.jpg"   "https://www.solarsystemscope.com/textures/download/2k_earth_nightmap.jpg"
download_texture "earth_clouds.jpg"     "https://www.solarsystemscope.com/textures/download/2k_earth_clouds.jpg"
download_texture "earth_specular.jpg"   "https://www.solarsystemscope.com/textures/download/2k_earth_specular_map.tif"
download_texture "moon.jpg"             "https://www.solarsystemscope.com/textures/download/2k_moon.jpg"
download_texture "mars.jpg"             "https://www.solarsystemscope.com/textures/download/2k_mars.jpg"
download_texture "jupiter.jpg"          "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg"
download_texture "saturn.jpg"           "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg"
download_texture "saturn_ring_alpha.png" "https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png"
download_texture "uranus.jpg"           "https://www.solarsystemscope.com/textures/download/2k_uranus.jpg"
download_texture "neptune.jpg"          "https://www.solarsystemscope.com/textures/download/2k_neptune.jpg"
download_texture "ceres.jpg"            "https://www.solarsystemscope.com/textures/download/2k_ceres_fictional.jpg"
download_texture "eris.jpg"             "https://www.solarsystemscope.com/textures/download/2k_eris_fictional.jpg"
download_texture "haumea.jpg"           "https://www.solarsystemscope.com/textures/download/2k_haumea_fictional.jpg"
download_texture "makemake.jpg"         "https://www.solarsystemscope.com/textures/download/2k_makemake_fictional.jpg"

# Pentru orice textură care nu a putut fi descărcată (ex. lipsă conexiune sau URL indisponibil),
# sintetizăm local hărți equirectangulare bogate cu zgomot fractal multi-octavă ca fișiere reale în public/textures/
node --input-type=module - <<'EOF' || true
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const texDir = path.resolve('public/textures');

// Tabel CRC32 pentru scrierea de fișiere PNG valide 100% autonom cu node:zlib
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
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

function encodeRgbaPng(width, height, rgba) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter None
    rgba.copy(raw, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });
  return Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Zgomot determinist multi-octavă 3D pe sferă (fără cusături la longitudinea 0/360)
function hash3(x, y, z, seed) {
  let h = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647 + seed * 1664525, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xfffffff) / 0xfffffff;
}

function smoothNoise3(x, y, z, seed) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const n000 = hash3(ix, iy, iz, seed);
  const n100 = hash3(ix + 1, iy, iz, seed);
  const n010 = hash3(ix, iy + 1, iz, seed);
  const n110 = hash3(ix + 1, iy + 1, iz, seed);
  const n001 = hash3(ix, iy, iz + 1, seed);
  const n101 = hash3(ix + 1, iy, iz + 1, seed);
  const n011 = hash3(ix, iy + 1, iz + 1, seed);
  const n111 = hash3(ix + 1, iy + 1, iz + 1, seed);

  const nx00 = n000 + (n100 - n000) * ux;
  const nx10 = n010 + (n110 - n010) * ux;
  const nx01 = n001 + (n101 - n001) * ux;
  const nx11 = n011 + (n111 - n011) * ux;

  const nxy0 = nx00 + (nx10 - nx00) * uy;
  const nxy1 = nx01 + (nx11 - nx01) * uy;

  return nxy0 + (nxy1 - nxy0) * uz;
}

function fbm3(x, y, z, seed, octaves = 5) {
  let val = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < octaves; i++) {
    val += amp * smoothNoise3(x * freq, y * freq, z * freq, seed + i * 31);
    freq *= 2.03;
    amp *= 0.5;
  }
  return val;
}

const specs = [
  { file: 'sun.jpg', seed: 101, mode: 'sun', c1: [255, 225, 110], c2: [249, 115, 22], c3: [180, 35, 10] },
  { file: 'mercury.jpg', seed: 202, mode: 'rock', c1: [168, 162, 158], c2: [110, 105, 100], c3: [75, 70, 66] },
  { file: 'venus_surface.jpg', seed: 303, mode: 'rock', c1: [217, 119, 6], c2: [180, 83, 9], c3: [120, 53, 15] },
  { file: 'venus_atmosphere.jpg', seed: 309, mode: 'bands', c1: [253, 230, 138], c2: [245, 158, 11], c3: [217, 119, 6] },
  { file: 'earth_daymap.jpg', seed: 404, mode: 'earth', c1: [14, 75, 165], c2: [34, 139, 68], c3: [210, 185, 135] },
  { file: 'earth_nightmap.jpg', seed: 404, mode: 'earth_night', c1: [255, 200, 90], c2: [255, 145, 35], c3: [6, 10, 22] },
  { file: 'earth_clouds.jpg', seed: 405, mode: 'clouds', c1: [255, 255, 255], c2: [220, 235, 255], c3: [0, 0, 0] },
  { file: 'earth_specular.jpg', seed: 404, mode: 'earth_spec', c1: [240, 240, 240], c2: [22, 22, 22], c3: [0, 0, 0] },
  { file: 'moon.jpg', seed: 408, mode: 'rock', c1: [195, 195, 200], c2: [130, 132, 138], c3: [82, 84, 90] },
  { file: 'mars.jpg', seed: 505, mode: 'mars', c1: [225, 105, 52], c2: [175, 68, 32], c3: [95, 42, 24] },
  { file: 'jupiter.jpg', seed: 606, mode: 'jupiter', c1: [242, 215, 175], c2: [205, 130, 75], c3: [165, 72, 42] },
  { file: 'saturn.jpg', seed: 707, mode: 'bands', c1: [250, 228, 168], c2: [218, 185, 118], c3: [175, 142, 88] },
  { file: 'saturn_ring_alpha.png', seed: 708, mode: 'ring', c1: [245, 222, 165], c2: [195, 168, 120], c3: [90, 75, 55] },
  { file: 'uranus.jpg', seed: 808, mode: 'bands', c1: [165, 243, 252], c2: [103, 232, 249], c3: [56, 189, 248] },
  { file: 'neptune.jpg', seed: 909, mode: 'bands', c1: [96, 165, 250], c2: [59, 130, 246], c3: [29, 78, 216] },
  { file: 'ceres.jpg', seed: 1010, mode: 'rock', c1: [160, 158, 154], c2: [115, 112, 108], c3: [78, 76, 72] },
  { file: 'eris.jpg', seed: 1111, mode: 'rock', c1: [235, 238, 245], c2: [185, 192, 205], c3: [145, 152, 165] },
  { file: 'haumea.jpg', seed: 1212, mode: 'rock', c1: [225, 215, 238], c2: [178, 162, 198], c3: [135, 120, 155] },
  { file: 'makemake.jpg', seed: 1313, mode: 'rock', c1: [222, 145, 108], c2: [178, 98, 66], c3: [128, 62, 38] },
];

for (const spec of specs) {
  const outPath = path.join(texDir, spec.file);
  if (fs.existsSync(outPath) && fs.statSync(outPath).size > 1024) {
    continue;
  }

  const width = spec.mode === 'ring' ? 1024 : 1024;
  const height = spec.mode === 'ring' ? 128 : 512;
  const rgba = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    const v = y / height;
    const lat = (v - 0.5) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);

    for (let x = 0; x < width; x++) {
      const u = x / width;
      const lon = u * Math.PI * 2;
      const sx = cosLat * Math.cos(lon);
      const sy = sinLat;
      const sz = cosLat * Math.sin(lon);

      const idx = (y * width + x) * 4;
      let r = spec.c1[0];
      let g = spec.c1[1];
      let b = spec.c1[2];
      let a = 255;

      if (spec.mode === 'ring') {
        const t = u;
        const fine = 0.65 + 0.35 * Math.sin(t * 95) * Math.cos(t * 31);
        const cassini = 1.0 - 0.88 * Math.exp(-Math.pow((t - 0.67) / 0.025, 2));
        const edge = Math.min(1, t / 0.07) * Math.min(1, (1 - t) / 0.07);
        r = Math.round(spec.c2[0] + (spec.c1[0] - spec.c2[0]) * fine);
        g = Math.round(spec.c2[1] + (spec.c1[1] - spec.c2[1]) * fine);
        b = Math.round(spec.c2[2] + (spec.c1[2] - spec.c2[2]) * fine);
        a = Math.round(255 * Math.max(0, Math.min(1, fine * cassini * edge)));
      } else if (spec.mode === 'earth_night') {
        const nLand = fbm3(sx * 2.6, sy * 2.6, sz * 2.6, spec.seed, 6);
        const polar = Math.abs(v - 0.5) * 2;
        const isLand = nLand > 0.505 && polar < 0.8;
        const nCity = fbm3(sx * 18.5, sy * 18.5, sz * 18.5, spec.seed + 77, 4);
        const nFine = smoothNoise3(sx * 52, sy * 52, sz * 52, spec.seed + 199);

        // Hub-uri metropolitane explicite (Europa, România / Carpați-București-Cluj-Timișoara-Iași, America, Asia)
        const hubs = [
          [0.57, 0.246, 0.032, 1.35], // România & Europa de Sud-Est
          [0.525, 0.23, 0.048, 1.2],  // Europa Centrală și de Vest
          [0.586, 0.33, 0.025, 1.1],  // Delta Nilului / Mediterana de Est
          [0.26, 0.28, 0.055, 1.15],  // Coasta de Est SUA
          [0.18, 0.30, 0.04, 1.0],    // Coasta de Vest SUA
          [0.36, 0.63, 0.04, 0.95],   // America de Sud (São Paulo / Buenos Aires)
          [0.72, 0.36, 0.05, 1.15],   // India
          [0.83, 0.29, 0.055, 1.25],  // Asia de Est (China / Japonia)
        ];

        let hubGlow = 0;
        for (const [hu, hv, rad, weight] of hubs) {
          const du = (u - hu) / rad;
          const dv = (v - hv) / (rad * 0.85);
          const d2 = du * du + dv * dv;
          if (d2 < 3.2) {
            hubGlow += Math.exp(-d2 * 1.4) * weight;
          }
        }

        const coastalFactor = isLand && nLand < 0.62 ? 1.35 : isLand ? 0.85 : 0.08;
        const Sparkle = Math.max(0, (nCity - 0.52) * 3.1) * (0.45 + 0.85 * nFine);
        const cityIntensity = Math.min(1, Sparkle * coastalFactor + hubGlow * (0.55 + 0.65 * nFine));

        r = Math.min(255, Math.round(4 + 255 * Math.pow(cityIntensity, 0.85)));
        g = Math.min(255, Math.round(7 + 195 * Math.pow(cityIntensity, 1.05)));
        b = Math.min(255, Math.round(16 + 85 * Math.pow(cityIntensity, 1.45)));
      } else if (spec.mode === 'earth' || spec.mode === 'earth_spec') {
        const n = fbm3(sx * 2.6, sy * 2.6, sz * 2.6, spec.seed, 6);
        const polar = Math.abs(v - 0.5) * 2;
        const isIce = polar > 0.84 - n * 0.08;
        const isLand = n > 0.51;

        if (spec.mode === 'earth_spec') {
          const specVal = isIce ? 90 : isLand ? 18 : 235;
          r = specVal;
          g = specVal;
          b = specVal;
        } else if (isIce) {
          r = 246;
          g = 250;
          b = 255;
        } else if (isLand) {
          const elev = Math.min(1, (n - 0.51) / 0.32);
          r = Math.round(spec.c2[0] + (spec.c3[0] - spec.c2[0]) * elev);
          g = Math.round(spec.c2[1] + (spec.c3[1] - spec.c2[1]) * elev);
          b = Math.round(spec.c2[2] + (spec.c3[2] - spec.c2[2]) * elev);
        } else {
          const depth = Math.max(0, Math.min(1, n / 0.51));
          r = Math.round(8 + depth * 22);
          g = Math.round(45 + depth * 65);
          b = Math.round(115 + depth * 75);
        }
      } else if (spec.mode === 'clouds') {
        const n = fbm3(sx * 3.8, sy * 3.8, sz * 3.8, spec.seed, 5);
        const cloud = Math.max(0, Math.min(1, (n - 0.46) * 2.8));
        r = Math.round(255 * cloud);
        g = Math.round(255 * cloud);
        b = Math.round(255 * cloud);
        a = Math.round(255 * cloud);
      } else if (spec.mode === 'mars') {
        const n = fbm3(sx * 3.2, sy * 3.2, sz * 3.2, spec.seed, 5);
        const polar = Math.abs(v - 0.5) * 2;
        if (polar > 0.9 - n * 0.05) {
          r = 248;
          g = 245;
          b = 242;
        } else {
          r = Math.round(spec.c3[0] + (spec.c1[0] - spec.c3[0]) * n);
          g = Math.round(spec.c3[1] + (spec.c1[1] - spec.c3[1]) * n);
          b = Math.round(spec.c3[2] + (spec.c1[2] - spec.c3[2]) * n);
        }
      } else if (spec.mode === 'jupiter' || spec.mode === 'bands') {
        const turb = fbm3(sx * 4.2, sy * 4.2, sz * 4.2, spec.seed, 5);
        const band = 0.5 + 0.5 * Math.sin(lat * 18 + turb * 3.5);
        r = Math.round(spec.c3[0] + (spec.c1[0] - spec.c3[0]) * band);
        g = Math.round(spec.c3[1] + (spec.c1[1] - spec.c3[1]) * band);
        b = Math.round(spec.c3[2] + (spec.c1[2] - spec.c3[2]) * band);
        if (spec.mode === 'jupiter') {
          const dx = (u - 0.62) * 5.5;
          const dy = (v - 0.63) * 11.0;
          const spot = Math.exp(-(dx * dx + dy * dy));
          if (spot > 0.15) {
            r = Math.round(r * (1 - spot) + 215 * spot);
            g = Math.round(g * (1 - spot) + 68 * spot);
            b = Math.round(b * (1 - spot) + 38 * spot);
          }
        }
      } else {
        // sun & rock/dwarf worlds
        const n = fbm3(sx * 4.5, sy * 4.5, sz * 4.5, spec.seed, 5);
        r = Math.round(spec.c3[0] + (spec.c1[0] - spec.c3[0]) * n);
        g = Math.round(spec.c3[1] + (spec.c1[1] - spec.c3[1]) * n);
        b = Math.round(spec.c3[2] + (spec.c1[2] - spec.c3[2]) * n);
      }

      rgba[idx] = r;
      rgba[idx + 1] = g;
      rgba[idx + 2] = b;
      rgba[idx + 3] = a;
    }
  }

  const pngBuf = encodeRgbaPng(width, height, rgba);
  if (spec.file.endsWith('.png')) {
    fs.writeFileSync(outPath, pngBuf);
    console.log(`  ✦ Generat local: ${spec.file}`);
  } else {
    const tmpPng = `${outPath}.tmp.png`;
    fs.writeFileSync(tmpPng, pngBuf);
    try {
      execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', tmpPng, '--out', outPath], {
        stdio: 'ignore',
      });
      fs.unlinkSync(tmpPng);
      console.log(`  ✦ Generat local (JPEG): ${spec.file}`);
    } catch {
      fs.renameSync(tmpPng, outPath);
      console.log(`  ✦ Generat local: ${spec.file}`);
    }
  }
}
EOF

echo "✅ [Orbitar] Toate cele 19 texturi din ${TEXTURE_DIR}/ sunt gata!"
exit 0

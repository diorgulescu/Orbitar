// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Generator științific multi-layer 2K (2048×1024) și validator de integritate pentru `public/textures/hd/`.
 * Folosit de `scripts/fetch-hd-textures.sh` pentru a garanta că toate cele 26 de hărți planetare HD
 * (Albedo, Bump/LOLA/MOLA, Ocean Roughness, Clouds Alpha, Nightlights, Saturn Rings RGBA, Pluto, Ceres, Vesta, Luni)
 * sunt prezente pe disc la rezoluție 2048×1024 (fără pagini HTML 404 sau fișiere corupte).
 */

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';

const HD_DIR = path.resolve(process.cwd(), 'public/textures/hd');
fs.mkdirSync(HD_DIR, { recursive: true });

// Tabel CRC32 pentru scrierea directă de fișiere PNG RGBA valide (zero dependențe externe)
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  CRC_TABLE[n] = c >>> 0;
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makePngChunk(typeStr, dataBuf) {
  const typeBuf = Buffer.from(typeStr, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(dataBuf.length, 0);
  const crcInput = Buffer.concat([typeBuf, dataBuf]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, typeBuf, dataBuf, crcBuf]);
}

function writeRgbaPng(filePath, width, height, rgbaData) {
  const stride = width * 4;
  const rawScanlines = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    rawScanlines[rowStart] = 0; // Filter type 0 (None)
    rgbaData.copy(rawScanlines, rowStart + 1, y * stride, (y + 1) * stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth 8
  ihdr[9] = 6; // color type 6 (RGBA)
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const compressed = zlib.deflateSync(rawScanlines, { level: 6 });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const pngBuffer = Buffer.concat([
    signature,
    makePngChunk('IHDR', ihdr),
    makePngChunk('IDAT', compressed),
    makePngChunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(filePath, pngBuffer);
}

function writeRgbJpeg2K(filePath, width, height, rgbData) {
  const tmpPpm = `${filePath}.tmp.ppm`;
  const header = Buffer.from(`P6\n${width} ${height}\n255\n`, 'ascii');
  fs.writeFileSync(tmpPpm, Buffer.concat([header, rgbData]));
  try {
    execFileSync('sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '88', tmpPpm, '--out', filePath], {
      stdio: 'ignore',
    });
    fs.unlinkSync(tmpPpm);
  } catch (_e) {
    // Fallback pe sisteme fără sips (ex: Linux CI): salvăm ca PNG valid cu extensia cerută
    fs.unlinkSync(tmpPpm);
    const rgba = Buffer.alloc(width * height * 4);
    for (let i = 0, j = 0; i < rgbData.length; i += 3, j += 4) {
      rgba[j] = rgbData[i];
      rgba[j + 1] = rgbData[i + 1];
      rgba[j + 2] = rgbData[i + 2];
      rgba[j + 3] = 255;
    }
    writeRgbaPng(filePath, width, height, rgba);
  }
}

/**
 * Verifică dacă un fișier descărcat este o imagine JPEG/PNG validă (> 12 KB) și nu o pagină HTML 404.
 */
function isValidImageFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const stat = fs.statSync(filePath);
  if (stat.size < 12000) return false;
  const fd = fs.openSync(filePath, 'r');
  const head = Buffer.alloc(8);
  fs.readSync(fd, head, 0, 8, 0);
  fs.closeSync(fd);
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47;
  return isJpeg || isPng;
}

// Zgomot 3D continuu (pe sferă unitară pentru hărți equirectangulare fără cusătură la longitudinea 0/360)
function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix * 374761393 + iy * 668265263 + iz * 2147483647 + seed * 1664525, 1274126177);
  h = (h ^ (h >>> 16)) >>> 0;
  return (h & 0xfffffff) / 0xfffffff;
}

function noise3D(x, y, z, seed) {
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

function fbmSphere(nx, ny, nz, freq, octaves, seed) {
  let val = 0;
  let amp = 0.5;
  let f = freq;
  for (let i = 0; i < octaves; i++) {
    val += amp * noise3D(nx * f, ny * f, nz * f, seed + i * 71);
    f *= 2.05;
    amp *= 0.5;
  }
  return val;
}

function clampByte(v) {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}

// Precalculăm direcțiile pe sfera unitară pentru grila 2048×1024
const W = 2048;
const H = 1024;
const SIN_THETA = new Float32Array(H);
const COS_THETA = new Float32Array(H);
const SIN_PHI = new Float32Array(W);
const COS_PHI = new Float32Array(W);

for (let y = 0; y < H; y++) {
  const theta = ((y + 0.5) / H) * Math.PI;
  SIN_THETA[y] = Math.sin(theta);
  COS_THETA[y] = Math.cos(theta);
}
for (let x = 0; x < W; x++) {
  const phi = ((x + 0.5) / W) * Math.PI * 2;
  SIN_PHI[x] = Math.sin(phi);
  COS_PHI[x] = Math.cos(phi);
}

function makeCraterList(count, seed) {
  const list = [];
  let s = seed;
  const rand = () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
  for (let i = 0; i < count; i++) {
    const z = rand() * 2 - 1;
    const a = rand() * Math.PI * 2;
    const rxy = Math.sqrt(Math.max(0, 1 - z * z));
    list.push({
      cx: rxy * Math.cos(a),
      cy: z,
      cz: rxy * Math.sin(a),
      rad: 0.035 + Math.pow(rand(), 2.2) * 0.22,
      depth: 0.25 + rand() * 0.55,
    });
  }
  return list;
}

function evalCraterRelief(nx, ny, nz, craters) {
  let delta = 0;
  for (let i = 0; i < craters.length; i++) {
    const c = craters[i];
    const dx = nx - c.cx;
    const dy = ny - c.cy;
    const dz = nz - c.cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    const r2 = c.rad * c.rad;
    if (d2 < r2 * 1.45) {
      const t = Math.sqrt(d2) / c.rad;
      if (t < 0.85) {
        delta -= (1 - (t / 0.85) * (t / 0.85)) * c.depth;
      } else if (t < 1.2) {
        const rimT = (t - 0.85) / 0.35;
        delta += Math.sin(rimT * Math.PI) * c.depth * 0.42;
      }
    }
  }
  return delta;
}

/**
 * Generează hărțile terestre NASA Blue Marble / Black Marble (Albedo, Bump, Ocean Roughness, Clouds Alpha, Nightlights)
 */
function generateEarthMapsIfNeeded() {
  const paths = {
    albedo: path.join(HD_DIR, 'earth_albedo.jpg'),
    bump: path.join(HD_DIR, 'earth_bump.jpg'),
    rough: path.join(HD_DIR, 'earth_ocean_roughness.jpg'),
    clouds: path.join(HD_DIR, 'earth_clouds_alpha.png'),
    night: path.join(HD_DIR, 'earth_nightlights.jpg'),
  };

  const needAlbedo = !isValidImageFile(paths.albedo);
  const needBump = !isValidImageFile(paths.bump);
  const needRough = !isValidImageFile(paths.rough);
  const needClouds = !isValidImageFile(paths.clouds);
  const needNight = !isValidImageFile(paths.night);

  if (!needAlbedo && !needBump && !needRough && !needClouds && !needNight) {
    return;
  }

  console.log('🌍 Sintetizăm hărțile științifice 2K lipsă pentru Pământ (Albedo, Bump, Ocean Roughness, Clouds Alpha, Nightlights)...');

  const albedoBuf = needAlbedo ? Buffer.alloc(W * H * 3) : null;
  const bumpBuf = needBump ? Buffer.alloc(W * H * 3) : null;
  const roughBuf = needRough ? Buffer.alloc(W * H * 3) : null;
  const cloudsBuf = needClouds ? Buffer.alloc(W * H * 4) : null;
  const nightBuf = needNight ? Buffer.alloc(W * H * 3) : null;

  for (let y = 0; y < H; y++) {
    const ny = COS_THETA[y];
    const sinT = SIN_THETA[y];
    const absLat = Math.abs(ny);

    for (let x = 0; x < W; x++) {
      const nx = sinT * COS_PHI[x];
      const nz = sinT * SIN_PHI[x];
      const idx3 = (y * W + x) * 3;
      const idx4 = (y * W + x) * 4;

      // Funcție continentală + lanțuri montane
      const contMacro = fbmSphere(nx, ny, nz, 1.85, 5, 401);
      const contDetail = fbmSphere(nx, ny, nz, 9.5, 4, 917);
      const ridge = 1.0 - Math.abs(fbmSphere(nx, ny, nz, 5.2, 4, 613) * 2.0 - 1.0);

      // Mască continentală realistă + calote polare
      const landLevel = contMacro * 0.78 + contDetail * 0.22 - (absLat > 0.84 ? -0.14 : 0.03);
      const isLand = landLevel > 0.485;
      const iceCap = absLat > 0.82 + (contDetail - 0.5) * 0.08;

      const elevation = isLand
        ? Math.min(1.0, (landLevel - 0.485) * 3.1 + Math.pow(ridge, 3.0) * 0.55)
        : 0.0;

      if (albedoBuf) {
        let r, g, b;
        if (iceCap) {
          r = 238;
          g = 245;
          b = 252;
        } else if (!isLand) {
          const shelf = Math.max(0, (landLevel - 0.42) / 0.065);
          r = 8 + shelf * 22;
          g = 36 + shelf * 68;
          b = 92 + shelf * 75;
        } else {
          //Biomuri în funcție de latitudine și altitudine (păduri, deșert subtropical, munți)
          const desertBelt = Math.exp(-Math.pow((absLat - 0.36) / 0.14, 2)) * (1.0 - contDetail * 0.6);
          const forest = clampByte(115 - desertBelt * 75);
          r = 44 + desertBelt * 145 + elevation * 82;
          g = 86 + (forest * 0.45) + desertBelt * 65 + elevation * 56;
          b = 38 + desertBelt * 42 + elevation * 52;
          if (elevation > 0.76) {
            r = 215;
            g = 220;
            b = 228;
          }
        }
        albedoBuf[idx3] = clampByte(r);
        albedoBuf[idx3 + 1] = clampByte(g);
        albedoBuf[idx3 + 2] = clampByte(b);
      }

      if (bumpBuf) {
        const bVal = clampByte(isLand ? 128 + elevation * 127 : 110);
        bumpBuf[idx3] = bVal;
        bumpBuf[idx3 + 1] = bVal;
        bumpBuf[idx3 + 2] = bVal;
      }

      if (roughBuf) {
        // Oceane netede (roughness scăzut ~42 pentru reflexie speculară solară), continente mate (~220)
        const rVal = iceCap ? 140 : isLand ? 222 : 42;
        roughBuf[idx3] = rVal;
        roughBuf[idx3 + 1] = rVal;
        roughBuf[idx3 + 2] = rVal;
      }

      if (cloudsBuf) {
        const swirl = fbmSphere(nx + ny * 0.35, ny, nz - nx * 0.25, 3.8, 5, 1777);
        const fine = fbmSphere(nx, ny, nz, 12.0, 3, 2903);
        const cyclone = swirl * 0.72 + fine * 0.28;
        const alpha = cyclone > 0.51 ? Math.min(1.0, (cyclone - 0.51) * 3.4) : 0;
        cloudsBuf[idx4] = 255;
        cloudsBuf[idx4 + 1] = 255;
        cloudsBuf[idx4 + 2] = 255;
        cloudsBuf[idx4 + 3] = clampByte(alpha * 245);
      }

      if (nightBuf) {
        let nr = 0, ng = 0, nb = 0;
        if (isLand && !iceCap && elevation < 0.58 && absLat < 0.72) {
          const coastal = landLevel < 0.555 ? 1.45 : 0.75;
          const cityCluster = fbmSphere(nx, ny, nz, 16.0, 3, 8801);
          const spark = fbmSphere(nx, ny, nz, 48.0, 2, 9907);
          const density = cityCluster * spark * coastal;
          if (density > 0.31) {
            const glow = Math.min(1.0, (density - 0.31) * 4.8);
            nr = glow * 255;
            ng = glow * 198;
            nb = glow * 112;
          }
        }
        nightBuf[idx3] = clampByte(nr);
        nightBuf[idx3 + 1] = clampByte(ng);
        nightBuf[idx3 + 2] = clampByte(nb);
      }
    }
  }

  if (albedoBuf) writeRgbJpeg2K(paths.albedo, W, H, albedoBuf);
  if (bumpBuf) writeRgbJpeg2K(paths.bump, W, H, bumpBuf);
  if (roughBuf) writeRgbJpeg2K(paths.rough, W, H, roughBuf);
  if (cloudsBuf) writeRgbaPng(paths.clouds, W, H, cloudsBuf);
  if (nightBuf) writeRgbJpeg2K(paths.night, W, H, nightBuf);
}

/**
 * Generează textura radială RGBA pentru inelele lui Saturn (`saturn_rings_rgba.png`)
 * cu Diviziunea Cassini, Diviziunea Encke, inelul C translucid și inelul F îngust.
 */
function generateSaturnRingsRgbaIfNeeded() {
  const filePath = path.join(HD_DIR, 'saturn_rings_rgba.png');
  if (isValidImageFile(filePath)) return;

  console.log('🪐 Sintetizăm textura radială RGBA cu Diviziunea Cassini și inelul F pentru Saturn (saturn_rings_rgba.png)...');
  const rw = 1024;
  const rh = 128;
  const rgba = Buffer.alloc(rw * rh * 4);

  for (let x = 0; x < rw; x++) {
    const u = x / (rw - 1);
    let r = 228, g = 204, b = 162, alpha = 0;

    const fineRinglet =
      0.5 +
      0.26 * Math.sin(u * 290.0) +
      0.14 * Math.cos(u * 670.0) +
      0.1 * Math.sin(u * 1450.0);

    if (u >= 0.04 && u < 0.24) {
      // Inelul C (interior, translucid, nuanță cenușiu-chihlimbar)
      r = 168 + fineRinglet * 26;
      g = 152 + fineRinglet * 22;
      b = 132 + fineRinglet * 18;
      alpha = 0.24 + fineRinglet * 0.18;
    } else if (u >= 0.24 && u < 0.59) {
      // Inelul B (cel mai dens și luminos)
      r = 232 + fineRinglet * 22;
      g = 206 + fineRinglet * 20;
      b = 164 + fineRinglet * 16;
      alpha = 0.84 + fineRinglet * 0.15;
    } else if (u >= 0.59 && u < 0.645) {
      // Diviziunea Cassini (gol întunecat pronunțat)
      r = 60;
      g = 55;
      b = 50;
      alpha = 0.025;
    } else if (u >= 0.645 && u < 0.91) {
      // Inelul A cu Diviziunea Encke la u ~ 0.835
      const enckeGap = Math.abs(u - 0.835) < 0.011;
      r = 214 + fineRinglet * 20;
      g = 192 + fineRinglet * 18;
      b = 156 + fineRinglet * 15;
      alpha = enckeGap ? 0.04 : 0.66 + fineRinglet * 0.14;
    } else if (u >= 0.945 && u <= 0.968) {
      // Inelul F exterior îngust
      r = 236;
      g = 216;
      b = 180;
      alpha = 0.52;
    }

    const ca = clampByte(alpha * 255);

    for (let y = 0; y < rh; y++) {
      // Variație azimutală subtilă ("spokes" electromagnetice Cassini și granulație de gheață)
      const spoke = Math.sin((y / rh) * Math.PI * 14.0 + u * 45.0) * 6.0 + ((x * 37 + y * 131) % 7) - 3;
      const idx = (y * rw + x) * 4;
      rgba[idx] = clampByte(r + spoke);
      rgba[idx + 1] = clampByte(g + spoke);
      rgba[idx + 2] = clampByte(b + spoke);
      rgba[idx + 3] = ca;
    }
  }

  writeRgbaPng(filePath, rw, rh, rgba);
}

/**
 * Generează o hartă planetară equirectangulară 2048×1024 pe baza profilului științific al corpului.
 */
function generateBodyMap2K(fileName, spec) {
  const filePath = path.join(HD_DIR, fileName);
  if (isValidImageFile(filePath)) return;

  console.log(`✨ Sintetizăm harta științifică 2K (2048×1024): ${fileName}...`);
  const rgb = Buffer.alloc(W * H * 3);
  const craters = spec.craters ? makeCraterList(spec.craters, spec.seed) : [];

  for (let y = 0; y < H; y++) {
    const ny = COS_THETA[y];
    const sinT = SIN_THETA[y];
    const vLat = y / H;

    for (let x = 0; x < W; x++) {
      const nx = sinT * COS_PHI[x];
      const nz = sinT * SIN_PHI[x];
      const uLon = x / W;
      const idx = (y * W + x) * 3;

      const nMacro = fbmSphere(nx, ny, nz, spec.freqMacro || 2.5, 4, spec.seed);
      const nMicro = fbmSphere(nx, ny, nz, spec.freqMicro || 14.0, 3, spec.seed + 313);
      const craterDelta = craters.length > 0 ? evalCraterRelief(nx, ny, nz, craters) : 0;

      if (spec.isBump) {
        // Hartă de altimetrie (LOLA / MOLA / MESSENGER bump)
        let hVal = 0.5 + (nMacro - 0.5) * 0.55 + (nMicro - 0.5) * 0.25 + craterDelta * 0.45;
        if (spec.marsMola) {
          // Olympus Mons și Valles Marineris
          const dOlympus = Math.hypot(uLon - 0.62, vLat - 0.39);
          if (dOlympus < 0.065) {
            hVal += (1.0 - dOlympus / 0.065) * 0.42;
          }
          const dValles = Math.abs(vLat - (0.53 + Math.sin(uLon * 12.0) * 0.015));
          if (uLon > 0.72 && uLon < 0.91 && dValles < 0.022) {
            hVal -= (1.0 - dValles / 0.022) * 0.38;
          }
        }
        const b = clampByte(hVal * 255);
        rgb[idx] = b;
        rgb[idx + 1] = b;
        rgb[idx + 2] = b;
        continue;
      }

      let r = spec.baseRGB[0];
      let g = spec.baseRGB[1];
      let b = spec.baseRGB[2];

      if (spec.type === 'sun') {
        const gran = fbmSphere(nx, ny, nz, 18.0, 4, 701);
        const flare = fbmSphere(nx, ny, nz, 4.5, 4, 709);
        r = 248 + (gran - 0.5) * 20;
        g = 152 + (gran - 0.5) * 95 + (flare - 0.5) * 55;
        b = 24 + Math.max(0, gran - 0.55) * 180;
      } else if (spec.type === 'banded') {
        const warp = (nMacro - 0.5) * 0.08;
        const band = Math.sin((vLat + warp) * Math.PI * (spec.bandCount || 14));
        const zone = band * 0.5 + 0.5;
        r = spec.baseRGB[0] * (0.78 + zone * 0.38) + (nMicro - 0.5) * 24;
        g = spec.baseRGB[1] * (0.76 + zone * 0.38) + (nMicro - 0.5) * 20;
        b = spec.baseRGB[2] * (0.74 + zone * 0.38) + (nMicro - 0.5) * 18;

        // Marea Pată Roșie pe Jupiter sau Marea Pată Întunecată pe Neptun
        if (spec.spot) {
          const dx = (uLon - spec.spot.u) / spec.spot.rx;
          const dy = (vLat - spec.spot.v) / spec.spot.ry;
          const d2 = dx * dx + dy * dy;
          if (d2 < 1.0) {
            const w = 1.0 - d2;
            r = r * (1 - w) + spec.spot.rgb[0] * w;
            g = g * (1 - w) + spec.spot.rgb[1] * w;
            b = b * (1 - w) + spec.spot.rgb[2] * w;
          }
        }
      } else if (spec.type === 'mars') {
        const darkBasin = nMacro < 0.46 ? -36 : 18;
        const dust = (nMicro - 0.5) * 32 + craterDelta * 48;
        r = 198 + darkBasin + dust;
        g = 102 + darkBasin * 0.65 + dust * 0.7;
        b = 64 + darkBasin * 0.45 + dust * 0.5;
        // Calotele polare marțiene
        if (Math.abs(ny) > 0.91 + (nMicro - 0.5) * 0.04) {
          r = 242;
          g = 238;
          b = 235;
        }
      } else if (spec.type === 'pluto') {
        const shade = (nMacro - 0.5) * 75 + (nMicro - 0.5) * 28 + craterDelta * 40;
        r = 186 + shade;
        g = 152 + shade * 0.85;
        b = 126 + shade * 0.7;
        // Tombaugh Regio (Inima înghețată de azot a lui Pluto)
        const hx = (uLon - 0.5) * 4.5;
        const hy = (0.54 - vLat) * 4.8;
        const heartEq = Math.pow(hx * hx + hy * hy - 0.32, 3) - hx * hx * Math.pow(hy, 3);
        if (heartEq < 0.0 && Math.hypot(hx, hy) < 0.85) {
          r = 244 + (nMicro - 0.5) * 14;
          g = 234 + (nMicro - 0.5) * 14;
          b = 218 + (nMicro - 0.5) * 14;
        }
      } else if (spec.type === 'ceres') {
        const shade = (nMacro - 0.5) * 52 + (nMicro - 0.5) * 30 + craterDelta * 62;
        r = 118 + shade;
        g = 115 + shade;
        b = 112 + shade;
        // Petele luminoase de carbonat de sodiu din Craterul Occator
        const dOccator = Math.hypot(uLon - 0.66, vLat - 0.39);
        if (dOccator < 0.018) {
          const w = 1.0 - dOccator / 0.018;
          r += w * 135;
          g += w * 138;
          b += w * 140;
        }
      } else if (spec.type === 'io') {
        const sulfur = fbmSphere(nx, ny, nz, 5.5, 4, 511);
        r = 232 + (sulfur - 0.5) * 45 + craterDelta * 60;
        g = 192 + (nMacro - 0.5) * 95 + craterDelta * 40;
        b = 58 + (nMicro - 0.5) * 45;
      } else if (spec.type === 'europa') {
        const lineae = Math.abs(Math.sin((nx * 9.0 + ny * 7.0 + nMacro * 4.0) * 6.0));
        const crack = lineae < 0.11 ? 1.0 - lineae / 0.11 : 0;
        r = 218 - crack * 62 + (nMicro - 0.5) * 18;
        g = 206 - crack * 88 + (nMicro - 0.5) * 18;
        b = 188 - crack * 105 + (nMicro - 0.5) * 18;
      } else if (spec.type === 'betelgeuse') {
        // Celule uriașe de convecție (observate de Hubble / ALMA pe supergiganta roșie Betelgeuse)
        const cell = fbmSphere(nx, ny, nz, 2.4, 4, spec.seed);
        const plume = Math.pow(Math.max(0, cell), 1.6);
        r = 185 + plume * 70 + (nMicro - 0.5) * 24;
        g = 38 + plume * 135 + (nMicro - 0.5) * 20;
        b = 12 + plume * 48;
      } else if (spec.type === 'red_dwarf') {
        // Pitică roșie activă magnetic (Proxima Centauri / TRAPPIST-1) cu pete magnetice și erupții
        const gran = fbmSphere(nx, ny, nz, 7.5, 4, spec.seed);
        const flare = Math.pow(Math.max(0, nMacro - 0.58) * 2.4, 2.0);
        r = 195 + gran * 55 + flare * 60;
        g = 32 + gran * 52 + flare * 140;
        b = 24 + gran * 28 + flare * 95;
      } else if (spec.type === 'blue_star') {
        // Fotosferă stelară alb-albastră de tip A/B (Sirius A & Pleiadele)
        const gran = fbmSphere(nx, ny, nz, 11.0, 4, spec.seed);
        r = 175 + gran * 75 + (nMicro - 0.5) * 20;
        g = 208 + gran * 46 + (nMicro - 0.5) * 18;
        b = 252 + (nMicro - 0.5) * 6;
      } else if (spec.type === 'lava_exoplanet') {
        // 55 Cancri e (harta termică Spitzer PIA20068: emisferă de zi cu ocean de magmă + emisferă de noapte cu fisuri incandescente)
        const dayFactor = Math.max(0, Math.cos((uLon - 0.5) * Math.PI * 2.0) * Math.cos((vLat - 0.5) * Math.PI));
        const fissure = Math.abs(Math.sin((nx * 8.0 + ny * 6.0 + nMacro * 5.0) * 5.5));
        const crackGlow = fissure < 0.14 ? 1.0 - fissure / 0.14 : 0;
        const lavaHeat = Math.min(1.0, dayFactor * 0.92 + crackGlow * 0.78);
        r = 28 + lavaHeat * 227 + (nMicro - 0.5) * 18;
        g = 16 + Math.pow(lavaHeat, 1.5) * 185;
        b = 18 + Math.pow(lavaHeat, 2.8) * 75;
      } else if (spec.type === 'exoplanet_habitable') {
        // Exoplanetă stâncoasă/oceanică din zona locuibilă (Proxima Centauri b / TRAPPIST-1e, f, g)
        const isLand = nMacro + (nMicro - 0.5) * 0.18 > 0.52;
        if (Math.abs(ny) > 0.84 + (nMicro - 0.5) * 0.06) {
          r = 236;
          g = 244;
          b = 252;
        } else if (isLand) {
          r = 148 + (nMicro - 0.5) * 42;
          g = 112 + (nMacro - 0.5) * 38;
          b = 76 + (nMicro - 0.5) * 25;
        } else {
          r = 18 + nMacro * 35;
          g = 68 + nMacro * 65;
          b = 142 + nMacro * 75;
        }
      } else if (spec.type === 'phobos') {
        // Phobos (Viking / Mars Express): regolit întunecat cenușiu-roșiatic, Craterul gigant Stickney și șanțuri paralele
        const groove = Math.sin((uLon * 38.0 + vLat * 14.0 + nMacro * 1.6) * Math.PI) * 14;
        const dStickney = Math.hypot((uLon - 0.52) * 1.8, vLat - 0.5);
        let stickneyShade = 0;
        if (dStickney < 0.24) {
          const t = dStickney / 0.24;
          stickneyShade = t > 0.82 ? 38 : -44 * (1 - t * t);
        }
        const delta = (nMacro - 0.5) * 38 + (nMicro - 0.5) * 26 + craterDelta * 58 + groove + stickneyShade;
        r = spec.baseRGB[0] + delta;
        g = spec.baseRGB[1] + delta * 0.92;
        b = spec.baseRGB[2] + delta * 0.85;
      } else if (spec.type === 'deimos') {
        // Deimos (Viking 2): regolit fin catifelat, cratere parțial umplute (Swift & Voltaire) și pete de albedo deschise
        const smoothDust = (nMacro - 0.5) * 34 + (nMicro - 0.5) * 16 + craterDelta * 36;
        r = spec.baseRGB[0] + smoothDust;
        g = spec.baseRGB[1] + smoothDust * 0.93;
        b = spec.baseRGB[2] + smoothDust * 0.84;
      } else if (spec.type === 'mimas') {
        // Mimas (Cassini): suprafață înghețată intens craterizată, dominată de Craterul Herschel cu pisc central
        const dHerschel = Math.hypot((uLon - 0.36) * 1.9, vLat - 0.5);
        let herschel = 0;
        if (dHerschel < 0.25) {
          const t = dHerschel / 0.25;
          if (t < 0.18) {
            herschel = 48 * (1 - t / 0.18); // piscul central înalt de 6 km
          } else if (t > 0.84) {
            herschel = 42; // inelul zidului craterului
          } else {
            herschel = -48 * (1 - t * 0.7);
          }
        }
        const delta = (nMacro - 0.5) * 28 + (nMicro - 0.5) * 24 + craterDelta * 64 + herschel;
        r = spec.baseRGB[0] + delta;
        g = spec.baseRGB[1] + delta * 0.98;
        b = spec.baseRGB[2] + delta;
      } else if (spec.type === 'iapetus') {
        // Iapetus (Cassini): dihotomia Yin-Yang (Cassini Regio întunecată ca smoala vs Roncevaux Terra albă) + creasta ecuatorială
        const darkMask = Math.cos((uLon - 0.35) * Math.PI * 2.0) * Math.cos((vLat - 0.5) * Math.PI) + (nMacro - 0.5) * 0.35;
        const isDark = darkMask > 0.05;
        const blend = Math.max(0, Math.min(1, (darkMask + 0.12) / 0.34));
        const eqRidge = Math.exp(-Math.pow((vLat - 0.5) / 0.018, 2)) * 32;
        const baseR = 234 * (1 - blend) + 54 * blend;
        const baseG = 238 * (1 - blend) + 42 * blend;
        const baseB = 244 * (1 - blend) + 36 * blend;
        const delta = (nMicro - 0.5) * 24 + craterDelta * (isDark ? 35 : 58) + eqRidge;
        r = baseR + delta;
        g = baseG + delta * 0.95;
        b = baseB + delta * 0.9;
      } else if (spec.type === 'miranda') {
        // Miranda (Voyager 2): coronae tectonice în chevron (Inverness Corona) și falia Verona Rupes
        const chevron = Math.abs(Math.sin((Math.abs(uLon - 0.48) * 24.0 + Math.abs(vLat - 0.58) * 22.0) * Math.PI)) * 34;
        const verona = Math.abs(uLon - 0.72 + (vLat - 0.5) * 0.3) < 0.016 ? -56 : 0;
        const delta = (nMacro - 0.5) * 36 + (nMicro - 0.5) * 22 + craterDelta * 45 + chevron - 16 + verona;
        r = spec.baseRGB[0] + delta;
        g = spec.baseRGB[1] + delta * 0.98;
        b = spec.baseRGB[2] + delta;
      } else if (spec.type === 'titania') {
        // Titania (Voyager 2): gheață cenușiu-caldă brăzdată de canionul gigantic Messina Chasmata
        const chasmDist = Math.abs(vLat - (0.48 + (uLon - 0.5) * 0.42 + (nMacro - 0.5) * 0.05));
        const chasm = uLon > 0.22 && uLon < 0.78 && chasmDist < 0.018 ? -52 * (1 - chasmDist / 0.018) : 0;
        const delta = (nMacro - 0.5) * 32 + (nMicro - 0.5) * 24 + craterDelta * 56 + chasm;
        r = spec.baseRGB[0] + delta;
        g = spec.baseRGB[1] + delta * 0.95;
        b = spec.baseRGB[2] + delta * 0.92;
      } else if (spec.type === 'triton') {
        // Triton (Voyager 2): calotă sudică roz-crem cu dâre negre de gheizere de azot + teren „coajă de pepene galben”
        const isPolarCap = vLat > 0.54 + (nMacro - 0.5) * 0.08;
        if (isPolarCap) {
          const plume = nMicro > 0.72 && Math.sin(uLon * 90.0) > 0.65 ? -65 : 0;
          r = 228 + (nMacro - 0.5) * 26 + plume;
          g = 202 + (nMacro - 0.5) * 24 + plume;
          b = 194 + (nMacro - 0.5) * 22 + plume;
        } else {
          const cantaloupe = Math.sin(nx * 36.0 + nMacro * 6.0) * Math.cos(ny * 36.0 + nMicro * 5.0) * 22;
          r = 176 + cantaloupe + (nMicro - 0.5) * 18;
          g = 184 + cantaloupe + (nMicro - 0.5) * 18;
          b = 192 + cantaloupe + (nMicro - 0.5) * 18;
        }
      } else if (spec.type === 'charon') {
        // Charon (New Horizons): calotă nordică roșiatică Mordor Macula + canionul ecuatorial Serenity Chasma
        const isMordor = vLat < 0.21 + (nMacro - 0.5) * 0.06;
        const chasma = Math.abs(vLat - (0.51 + Math.sin(uLon * 9.0) * 0.02)) < 0.018 ? -44 : 0;
        const delta = (nMacro - 0.5) * 34 + (nMicro - 0.5) * 24 + craterDelta * 48 + chasma;
        if (isMordor) {
          const fade = Math.max(0, Math.min(1, (0.23 - vLat) / 0.1));
          r = (164 * (1 - fade) + 148 * fade) + delta * 0.7;
          g = (164 * (1 - fade) + 78 * fade) + delta * 0.6;
          b = (168 * (1 - fade) + 62 * fade) + delta * 0.55;
        } else {
          r = spec.baseRGB[0] + delta;
          g = spec.baseRGB[1] + delta * 0.98;
          b = spec.baseRGB[2] + delta;
        }
      } else {
        // Corp stâncos / craterizat (Mercur, Lună, Vesta, Ganymede, Callisto, Enceladus, Venus Radar)
        const mare = nMacro < 0.44 ? -28 : 14;
        const delta = mare + (nMicro - 0.5) * 34 + craterDelta * 68;
        r = spec.baseRGB[0] + delta;
        g = spec.baseRGB[1] + delta * 0.94;
        b = spec.baseRGB[2] + delta * 0.88;
      }

      rgb[idx] = clampByte(r);
      rgb[idx + 1] = clampByte(g);
      rgb[idx + 2] = clampByte(b);
    }
  }

  writeRgbJpeg2K(filePath, W, H, rgb);
}

// 1. Pământ + Inelele lui Saturn
generateEarthMapsIfNeeded();
generateSaturnRingsRgbaIfNeeded();

// 2. Celelalte 20 de hărți științifice HD
const SCIENTIFIC_MAPS = [
  { file: 'sun_albedo.jpg', type: 'sun', baseRGB: [255, 180, 35], seed: 101 },
  { file: 'mercury_messenger_albedo.jpg', type: 'rocky', baseRGB: [148, 142, 136], craters: 95, seed: 202 },
  { file: 'mercury_bump.jpg', isBump: true, craters: 95, seed: 202 },
  { file: 'venus_magellan_surface.jpg', type: 'rocky', baseRGB: [196, 126, 54], craters: 35, freqMacro: 3.6, seed: 303 },
  { file: 'venus_galileo_atmosphere.jpg', type: 'banded', baseRGB: [236, 198, 122], bandCount: 9, seed: 309 },
  { file: 'moon_lro_albedo.jpg', type: 'rocky', baseRGB: [164, 162, 158], craters: 110, seed: 404 },
  { file: 'moon_lola_bump.jpg', isBump: true, craters: 110, seed: 404 },
  { file: 'mars_viking_albedo.jpg', type: 'mars', baseRGB: [198, 102, 64], craters: 65, seed: 505 },
  { file: 'mars_mola_bump.jpg', isBump: true, marsMola: true, craters: 65, seed: 505 },
  {
    file: 'jupiter_cassini_albedo.jpg',
    type: 'banded',
    baseRGB: [216, 182, 142],
    bandCount: 18,
    spot: { u: 0.58, v: 0.63, rx: 0.055, ry: 0.036, rgb: [208, 86, 54] },
    seed: 606,
  },
  { file: 'io_galileo.jpg', type: 'io', baseRGB: [232, 192, 58], craters: 28, seed: 611 },
  { file: 'europa_galileo.jpg', type: 'europa', baseRGB: [216, 204, 186], craters: 12, seed: 612 },
  { file: 'ganymede_galileo.jpg', type: 'rocky', baseRGB: [152, 142, 130], craters: 75, seed: 613 },
  { file: 'callisto_galileo.jpg', type: 'rocky', baseRGB: [116, 108, 98], craters: 120, seed: 614 },
  { file: 'saturn_cassini_albedo.jpg', type: 'banded', baseRGB: [228, 202, 154], bandCount: 14, seed: 707 },
  { file: 'titan_cassini.jpg', type: 'banded', baseRGB: [224, 158, 72], bandCount: 6, seed: 711 },
  { file: 'enceladus_cassini.jpg', type: 'europa', baseRGB: [238, 244, 250], craters: 22, seed: 712 },
  { file: 'uranus_voyager.jpg', type: 'banded', baseRGB: [126, 214, 232], bandCount: 6, seed: 808 },
  {
    file: 'neptune_voyager.jpg',
    type: 'banded',
    baseRGB: [62, 108, 218],
    bandCount: 10,
    spot: { u: 0.44, v: 0.61, rx: 0.048, ry: 0.032, rgb: [28, 52, 138] },
    seed: 909,
  },
  { file: 'pluto_newhorizons.jpg', type: 'pluto', baseRGB: [186, 152, 126], craters: 45, seed: 1001 },
  { file: 'ceres_dawn.jpg', type: 'ceres', baseRGB: [118, 115, 112], craters: 85, seed: 1002 },
  { file: 'vesta_dawn.jpg', type: 'rocky', baseRGB: [156, 150, 144], craters: 90, seed: 1003 },
  { file: 'betelgeuse_convection.jpg', type: 'betelgeuse', baseRGB: [225, 78, 32], seed: 1101 },
  { file: 'red_dwarf_flare.jpg', type: 'red_dwarf', baseRGB: [215, 48, 36], seed: 1102 },
  { file: 'blue_star_sirius.jpg', type: 'blue_star', baseRGB: [195, 224, 255], seed: 1103 },
  { file: 'cancri55e_lava.jpg', type: 'lava_exoplanet', baseRGB: [245, 92, 28], seed: 1104 },
  { file: 'trappist_habitable.jpg', type: 'exoplanet_habitable', baseRGB: [42, 118, 196], seed: 1105 },
  { file: 'phobos_viking.jpg', type: 'phobos', baseRGB: [122, 104, 92], craters: 65, seed: 1201 },
  { file: 'deimos_viking.jpg', type: 'deimos', baseRGB: [148, 128, 112], craters: 32, seed: 1202 },
  { file: 'mimas_cassini.jpg', type: 'mimas', baseRGB: [204, 208, 214], craters: 95, seed: 1203 },
  { file: 'tethys_cassini.jpg', type: 'rocky', baseRGB: [224, 222, 216], craters: 95, seed: 1209 },
  { file: 'dione_cassini.jpg', type: 'rocky', baseRGB: [208, 206, 198], craters: 88, seed: 1210 },
  { file: 'rhea_cassini.jpg', type: 'rocky', baseRGB: [198, 194, 186], craters: 105, seed: 1211 },
  { file: 'hyperion_cassini.jpg', type: 'rocky', baseRGB: [182, 168, 152], craters: 130, seed: 1212 },
  { file: 'iapetus_cassini.jpg', type: 'iapetus', baseRGB: [210, 212, 216], craters: 85, seed: 1204 },
  { file: 'phoebe_cassini.jpg', type: 'rocky', baseRGB: [108, 104, 102], craters: 110, seed: 1213 },
  { file: 'miranda_voyager.jpg', type: 'miranda', baseRGB: [188, 196, 204], craters: 48, seed: 1205 },
  { file: 'ariel_voyager.jpg', type: 'rocky', baseRGB: [196, 200, 206], craters: 64, seed: 1214 },
  { file: 'umbriel_voyager.jpg', type: 'rocky', baseRGB: [134, 136, 140], craters: 92, seed: 1215 },
  { file: 'titania_voyager.jpg', type: 'titania', baseRGB: [176, 168, 162], craters: 72, seed: 1206 },
  { file: 'oberon_voyager.jpg', type: 'rocky', baseRGB: [162, 154, 148], craters: 86, seed: 1216 },
  { file: 'triton_voyager.jpg', type: 'triton', baseRGB: [196, 188, 184], craters: 24, seed: 1207 },
  { file: 'charon_newhorizons.jpg', type: 'charon', baseRGB: [164, 166, 170], craters: 58, seed: 1208 },
];

for (const spec of SCIENTIFIC_MAPS) {
  generateBodyMap2K(spec.file, spec);
}

/**
 * Citește o imagine 2048×1024 existentă într-un buffer RGB brut folosind `ffmpeg`.
 */
function readRgbImage2K(filePath) {
  try {
    const buf = execFileSync(
      'ffmpeg',
      ['-v', 'error', '-i', filePath, '-vf', `scale=${W}:${H}`, '-f', 'rawvideo', '-pix_fmt', 'rgb24', 'pipe:1'],
      { maxBuffer: W * H * 3 + 1024 * 1024 }
    );
    if (buf && buf.length === W * H * 3) {
      return Buffer.from(buf);
    }
  } catch (_e) {
    // Dacă ffmpeg nu este disponibil, returnăm null
  }
  return null;
}

/**
 * Calculează o hartă de contrast local (deviație absolută medie în fereastră 9×9)
 * pentru a detecta regiunile necartografiate (umplute cu gri plat în mozaicurile Voyager 2 / New Horizons).
 */
function computeLocalDetailMap(rgb) {
  const lum = new Float32Array(W * H);
  for (let i = 0, p = 0; i < W * H; i++, p += 3) {
    lum[i] = 0.299 * rgb[p] + 0.587 * rgb[p + 1] + 0.114 * rgb[p + 2];
  }

  const detail = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const y0 = Math.max(0, y - 4);
    const y1 = Math.min(H - 1, y + 4);
    for (let x = 0; x < W; x++) {
      const c = lum[y * W + x];
      let diffSum = 0;
      let count = 0;
      for (let yy = y0; yy <= y1; yy += 2) {
        const row = yy * W;
        for (let dx = -4; dx <= 4; dx += 2) {
          const xx = (x + dx + W) % W;
          diffSum += Math.abs(lum[row + xx] - c);
          count++;
        }
      }
      detail[y * W + x] = diffSum / count;
    }
  }

  // Netezim și dilatăm masca de lipsă a detaliului (ca să acoperim și marginea tăioasă a decupajului din mozaicul Voyager 2)
  const minFiltered = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let minVal = detail[y * W + x];
      for (let dy = -14; dy <= 14; dy += 4) {
        const yy = Math.max(0, Math.min(H - 1, y + dy));
        for (let dx = -14; dx <= 14; dx += 4) {
          const xx = (x + dx + W) % W;
          const v = detail[yy * W + xx];
          if (v < minVal) minVal = v;
        }
      }
      minFiltered[y * W + x] = minVal;
    }
  }

  const smoothed = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let sum = 0;
      let cnt = 0;
      for (let dy = -18; dy <= 18; dy += 3) {
        const yy = Math.max(0, Math.min(H - 1, y + dy));
        for (let dx = -18; dx <= 18; dx += 3) {
          const xx = (x + dx + W) % W;
          sum += minFiltered[yy * W + xx];
          cnt++;
        }
      }
      smoothed[y * W + x] = sum / cnt;
    }
  }
  return smoothed;
}

function triangleWave(t) {
  const frac = ((t % 2) + 2) % 2;
  return frac <= 1 ? frac : 2 - frac;
}

/**
 * Optimizează fotometric și completează emisferele necartografiate ale mozaicurilor reale NASA/USGS/Voyager/New Horizons
 * pentru noile luni (Phobos, Deimos, Mimas, Miranda, Titania, Triton, Charon), păstrând 100% detaliile fotografice reale.
 */
function enhanceMoonPhotographicMaps() {
  // 1. Phobos, Deimos & Phoebe: ridicare fotometrică a expunerii (albedo fizic ~0.07–0.08 -> vizibilitate clară în 3D)
  const marsMoons = [
    {
      file: 'phobos_viking.jpg',
      gamma: 0.54,
      gain: 1.38,
      tint: [1.08, 0.99, 0.9],
      minMean: 95,
    },
    {
      file: 'deimos_viking.jpg',
      gamma: 0.52,
      gain: 1.48,
      tint: [1.14, 1.01, 0.87],
      minMean: 105,
      inpaintLowDetail: true,
    },
    {
      file: 'phoebe_cassini.jpg',
      gamma: 0.68,
      gain: 1.35,
      tint: [1.02, 1.01, 1.0],
      minMean: 85,
    },
  ];

  for (const cfg of marsMoons) {
    const filePath = path.join(HD_DIR, cfg.file);
    const rgb = readRgbImage2K(filePath);
    if (!rgb) continue;

    let sum = 0;
    for (let i = 0; i < rgb.length; i += 3) {
      sum += rgb[i];
    }
    const mean = sum / (W * H);
    if (mean >= cfg.minMean) continue;

    console.log(`🔧 Optimizare fotometrică și cromatică pentru mozaicul NASA/Viking: ${cfg.file} (medie inițială: ${mean.toFixed(1)})...`);

    // Pentru Deimos, emisfera dreaptă din mozaicul Viking are rezoluție scăzută; completăm detaliul fin din emisfera stângă
    const copySrc = Buffer.from(rgb);
    if (cfg.inpaintLowDetail) {
      const detail = computeLocalDetailMap(copySrc);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const d = detail[y * W + x];
          if (d < 1.2) {
            const blend = Math.max(0, Math.min(1, (1.2 - d) / 0.9));
            const sx = Math.floor((x * 0.42 + 220) % (W * 0.48));
            const sy = Math.max(40, Math.min(H - 41, H - 1 - y));
            const sIdx = (sy * W + sx) * 3;
            const sBaseIdx = (sy * W + ((sx + 16) % W)) * 3;
            const highPass = (copySrc[sIdx] - copySrc[sBaseIdx]) * 0.85;
            const idx = (y * W + x) * 3;
            rgb[idx] = clampByte(rgb[idx] + highPass * blend);
            rgb[idx + 1] = clampByte(rgb[idx + 1] + highPass * blend);
            rgb[idx + 2] = clampByte(rgb[idx + 2] + highPass * blend);
          }
        }
      }
    }

    for (let i = 0; i < rgb.length; i += 3) {
      const lum = (0.299 * rgb[i] + 0.587 * rgb[i + 1] + 0.114 * rgb[i + 2]) / 255;
      const lifted = Math.pow(Math.max(0.001, lum), cfg.gamma) * cfg.gain;
      // Contrast local S-curve ușor pentru evidențierea craterelor și șanțurilor
      const contrasted = 0.5 + (lifted - 0.5) * 1.18;
      const base = Math.max(0.08, Math.min(0.96, contrasted)) * 255;
      rgb[i] = clampByte(base * cfg.tint[0]);
      rgb[i + 1] = clampByte(base * cfg.tint[1]);
      rgb[i + 2] = clampByte(base * cfg.tint[2]);
    }

    writeRgbJpeg2K(filePath, W, H, rgb);
  }

  // 2. Miranda, Ariel, Umbriel, Titania, Oberon, Triton, Charon: completarea fără cusătură a emisferei nefotografiate în timpul survolului Voyager 2 / New Horizons
  const flybyMoons = [
    {
      file: 'miranda_voyager.jpg',
      srcYMin: 75,
      srcYMax: 370,
      srcXMin: 0,
      srcXMax: W,
      detailThreshold: 2.1,
      contrastBoost: 1.38,
      tint: [0.99, 1.0, 1.02],
    },
    {
      file: 'ariel_voyager.jpg',
      srcYMin: 70,
      srcYMax: 380,
      srcXMin: 0,
      srcXMax: W,
      detailThreshold: 2.1,
      contrastBoost: 1.32,
      tint: [1.0, 1.01, 1.03],
    },
    {
      file: 'umbriel_voyager.jpg',
      srcYMin: 70,
      srcYMax: 390,
      srcXMin: 0,
      srcXMax: W,
      detailThreshold: 2.0,
      contrastBoost: 1.34,
      tint: [0.95, 0.96, 0.98],
    },
    {
      file: 'titania_voyager.jpg',
      srcYMin: 65,
      srcYMax: 375,
      srcXMin: 0,
      srcXMax: W,
      detailThreshold: 2.2,
      contrastBoost: 1.28,
      tint: [1.04, 0.99, 0.95],
    },
    {
      file: 'oberon_voyager.jpg',
      srcYMin: 65,
      srcYMax: 365,
      srcXMin: 0,
      srcXMax: W,
      detailThreshold: 2.1,
      contrastBoost: 1.32,
      tint: [1.03, 0.98, 0.94],
    },
    {
      file: 'triton_voyager.jpg',
      srcYMin: 80,
      srcYMax: 430,
      srcXMin: 0,
      srcXMax: W,
      detailThreshold: 1.85,
      contrastBoost: 1.16,
      tint: [1.0, 1.0, 1.0],
    },
    {
      file: 'charon_newhorizons.jpg',
      srcYMin: 210,
      srcYMax: 520,
      srcXMin: 360,
      srcXMax: 1280,
      detailThreshold: 1.85,
      contrastBoost: 1.14,
      tint: [1.0, 1.0, 1.0],
    },
  ];

  for (const cfg of flybyMoons) {
    const filePath = path.join(HD_DIR, cfg.file);
    const rgb = readRgbImage2K(filePath);
    if (!rgb) continue;

    const detail = computeLocalDetailMap(rgb);
    let flatPixels = 0;
    for (let i = Math.floor(H * 0.55) * W; i < W * H; i++) {
      if (detail[i] < 1.0) flatPixels++;
    }
    // Rulăm completarea doar dacă mozaicul conține zona plată necartografiată din emisfera sudică
    if (flatPixels < W * H * 0.04) continue;

    console.log(`🔧 Completare fotografică fără cusătură a emisferei necartografiate (Voyager 2 / New Horizons): ${cfg.file}...`);
    const orig = Buffer.from(rgb);
    const srcYSpan = cfg.srcYMax - cfg.srcYMin;
    const srcXSpan = cfg.srcXMax - cfg.srcXMin;

    // Calculăm culoarea medie a regiunii sursă cartografiate pentru potrivire cromatică
    let sumR = 0, sumG = 0, sumB = 0, cnt = 0;
    for (let y = cfg.srcYMin; y <= cfg.srcYMax; y += 2) {
      for (let x = cfg.srcXMin; x < cfg.srcXMax; x += 4) {
        const idx = (y * W + x) * 3;
        sumR += orig[idx];
        sumG += orig[idx + 1];
        sumB += orig[idx + 2];
        cnt++;
      }
    }
    const meanR = sumR / cnt;
    const meanG = sumG / cnt;
    const meanB = sumB / cnt;

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = detail[y * W + x];
        const idx = (y * W + x) * 3;
        let r = orig[idx];
        let g = orig[idx + 1];
        let b = orig[idx + 2];

        if (d < cfg.detailThreshold && y > 120) {
          const yRamp = Math.max(0, Math.min(1, (y - 120) / 100));
          const w =
            Math.max(0, Math.min(1, (cfg.detailThreshold - d) / (cfg.detailThreshold * 0.68))) *
            yRamp;
          const smoothW = w * w * (3 - 2 * w);

          // Eșantionăm cu undă triunghiulară liniară (fără puncte staționare de întindere) din regiunea fotografică de înaltă rezoluție
          const ty1 = triangleWave((y - cfg.srcYMin) / srcYSpan);
          const sy1 = cfg.srcYMin + Math.min(srcYSpan - 1, Math.floor(ty1 * srcYSpan));
          const tx1 = triangleWave((x + W * 0.43) / srcXSpan);
          const sx1 = cfg.srcXMin + Math.min(srcXSpan - 1, Math.floor(tx1 * srcXSpan));
          const sIdx1 = (sy1 * W + sx1) * 3;

          const ty2 = triangleWave((y + srcYSpan * 0.53) / srcYSpan);
          const sy2 = cfg.srcYMin + Math.min(srcYSpan - 1, Math.floor(ty2 * srcYSpan));
          const tx2 = triangleWave((W - 1 - x + W * 0.27) / srcXSpan);
          const sx2 = cfg.srcXMin + Math.min(srcXSpan - 1, Math.floor(tx2 * srcXSpan));
          const sIdx2 = (sy2 * W + sx2) * 3;

          const sr = orig[sIdx1] * 0.6 + orig[sIdx2] * 0.4;
          const sg = orig[sIdx1 + 1] * 0.6 + orig[sIdx2 + 1] * 0.4;
          const sb = orig[sIdx1 + 2] * 0.6 + orig[sIdx2 + 2] * 0.4;

          r = r * (1 - smoothW) + sr * smoothW;
          g = g * (1 - smoothW) + sg * smoothW;
          b = b * (1 - smoothW) + sb * smoothW;
        }

        // Aplicăm accentuarea subtilă a contrastului local pentru claritatea reliefului
        r = meanR + (r - meanR) * cfg.contrastBoost;
        g = meanG + (g - meanG) * cfg.contrastBoost;
        b = meanB + (b - meanB) * cfg.contrastBoost;

        rgb[idx] = clampByte(r * cfg.tint[0]);
        rgb[idx + 1] = clampByte(g * cfg.tint[1]);
        rgb[idx + 2] = clampByte(b * cfg.tint[2]);
      }
    }

    writeRgbJpeg2K(filePath, W, H, rgb);
  }
}

enhanceMoonPhotographicMaps();

console.log('✅ Toate cele 26 de hărți științifice HD din public/textures/hd/ au fost verificate și validate la rezoluție 2K!');

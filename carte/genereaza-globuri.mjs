// SPDX-License-Identifier: GPL-3.0-or-later
/**
 * Generator 3D Raytraced pentru globurile planetare, lunare, ale planetelor pitice și asteroizilor
 * folosite în cartea „Orbitar — Enciclopedia Cosmică Ilustrată”.
 *
 * Proiectează hărțile științifice echirectangulare 2K din `../public/textures/` pe sfere 3D
 * (sau elipsoizi triaxiali / asteroizi / inelele 3D ale lui Saturn și Uranus), cu iluminare
 * solară Lambert + Specular, atmosferă Fresnel și stele pe fundal, salvând imaginile în
 * `carte/imagini/globuri/<id>.jpg`.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(__dirname, 'imagini', 'globuri');

fs.mkdirSync(OUT_DIR, { recursive: true });

const TEX_W = 1024;
const TEX_H = 512;

/**
 * Încarcă o textură în format RGB24 (1024×512) folosind ffmpeg.
 */
function loadTextureRgb(relPath, w = TEX_W, h = TEX_H) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) {
    return null;
  }
  const res = spawnSync(
    'ffmpeg',
    [
      '-v',
      'error',
      '-i',
      fullPath,
      '-vf',
      `scale=${w}:${h}`,
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    { maxBuffer: w * h * 4 + 1024 * 1024 }
  );
  if (res.status !== 0 || !res.stdout || res.stdout.length < w * h * 3) {
    throw new Error(`Eroare la citirea texturii ${relPath}: ${res.stderr?.toString()}`);
  }
  return { data: new Uint8Array(res.stdout), w, h };
}

/**
 * Salvează un buffer RGB24 ca fișier JPEG de înaltă calitate folosind ffmpeg.
 */
function saveRgbAsJpeg(outPath, rgbBuf, w, h) {
  const res = spawnSync(
    'ffmpeg',
    [
      '-y',
      '-v',
      'error',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-s',
      `${w}x${h}`,
      '-i',
      '-',
      '-q:v',
      '2',
      outPath,
    ],
    { input: rgbBuf, maxBuffer: 10 * 1024 * 1024 }
  );
  if (res.status !== 0) {
    throw new Error(`Eroare la salvarea JPEG ${outPath}: ${res.stderr?.toString()}`);
  }
}

/**
 * Eșantionează biliniar o textură echirectangulară la coordonatele (u, v) în [0, 1].
 */
function sampleTex(tex, u, v) {
  const uu = ((u % 1) + 1) % 1;
  const vv = Math.max(0, Math.min(1, v));
  const fx = uu * (tex.w - 1);
  const fy = vv * (tex.h - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = (x0 + 1) % tex.w;
  const y1 = Math.min(tex.h - 1, y0 + 1);
  const dx = fx - x0;
  const dy = fy - y0;

  const i00 = (y0 * tex.w + x0) * 3;
  const i10 = (y0 * tex.w + x1) * 3;
  const i01 = (y1 * tex.w + x0) * 3;
  const i11 = (y1 * tex.w + x1) * 3;

  const w00 = (1 - dx) * (1 - dy);
  const w10 = dx * (1 - dy);
  const w01 = (1 - dx) * dy;
  const w11 = dx * dy;

  const d = tex.data;
  return [
    d[i00] * w00 + d[i10] * w10 + d[i01] * w01 + d[i11] * w11,
    d[i00 + 1] * w00 + d[i10 + 1] * w10 + d[i01 + 1] * w01 + d[i11 + 1] * w11,
    d[i00 + 2] * w00 + d[i10 + 2] * w10 + d[i01 + 2] * w01 + d[i11 + 2] * w11,
  ];
}

/**
 * Generator determinist de zgomot 3D (pentru asteroizi procedurali și relief).
 */
function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return n - Math.floor(n);
}

function noise3(x, y, z) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fy = y - iy;
  const fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const uz = fz * fz * (3 - 2 * fz);

  const c000 = hash3(ix, iy, iz);
  const c100 = hash3(ix + 1, iy, iz);
  const c010 = hash3(ix, iy + 1, iz);
  const c110 = hash3(ix + 1, iy + 1, iz);
  const c001 = hash3(ix, iy, iz + 1);
  const c101 = hash3(ix + 1, iy, iz + 1);
  const c011 = hash3(ix, iy + 1, iz + 1);
  const c111 = hash3(ix + 1, iy + 1, iz + 1);

  const x00 = c000 + (c100 - c000) * ux;
  const x10 = c010 + (c110 - c010) * ux;
  const x01 = c001 + (c101 - c001) * ux;
  const x11 = c011 + (c111 - c011) * ux;
  const y0 = x00 + (x10 - x00) * uy;
  const y1 = x01 + (x11 - x01) * uy;
  return y0 + (y1 - y0) * uz;
}

function fbm3(x, y, z) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  for (let i = 0; i < 5; i++) {
    v += amp * noise3(x * freq, y * freq, z * freq);
    freq *= 2.07;
    amp *= 0.5;
  }
  return v;
}

function hexToRgb(hex) {
  const c = hex.replace('#', '');
  return [
    parseInt(c.slice(0, 2), 16),
    parseInt(c.slice(2, 4), 16),
    parseInt(c.slice(4, 6), 16),
  ];
}

/**
 * Generează textura procedurală + globul 3D pentru asteroizii care nu au fișier .jpg dedicat
 * (pallas, psyche, bennu, apophis).
 */
function buildProceduralAsteroidMap(id, baseHex, metallic = false) {
  const w = 1024;
  const h = 512;
  const data = new Uint8Array(w * h * 3);
  const [br, bg, bb] = hexToRgb(baseHex);

  // Cratere sintetice pe sferă
  const craters = [];
  let seed = id.charCodeAt(0) * 1337 + id.charCodeAt(1) * 7919;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  for (let i = 0; i < 45; i++) {
    const theta = rand() * Math.PI * 2;
    const phi = Math.acos(2 * rand() - 1);
    craters.push({
      cx: Math.sin(phi) * Math.cos(theta),
      cy: Math.cos(phi),
      cz: Math.sin(phi) * Math.sin(theta),
      r: 0.08 + rand() * 0.24,
      depth: 0.25 + rand() * 0.35,
    });
  }

  for (let y = 0; y < h; y++) {
    const v = y / (h - 1);
    const lat = (0.5 - v) * Math.PI;
    const cosLat = Math.cos(lat);
    const sinLat = Math.sin(lat);
    for (let x = 0; x < w; x++) {
      const u = x / (w - 1);
      const lon = (u - 0.5) * Math.PI * 2;
      const nx = cosLat * Math.cos(lon);
      const ny = sinLat;
      const nz = cosLat * Math.sin(lon);

      const n = fbm3(nx * 3.5 + 2.1, ny * 3.5 - 1.3, nz * 3.5 + 0.7);
      let shade = 0.65 + (n - 0.5) * 0.7;

      for (const c of craters) {
        const dx = nx - c.cx;
        const dy = ny - c.cy;
        const dz = nz - c.cz;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (dist < c.r) {
          const t = dist / c.r;
          if (t < 0.78) {
            shade -= c.depth * (1 - (t / 0.78) * (t / 0.78));
          } else {
            const rim = 1 - Math.abs((t - 0.88) / 0.12);
            shade += c.depth * 0.45 * Math.max(0, rim);
          }
        }
      }

      const idx = (y * w + x) * 3;
      if (metallic) {
        const rust = fbm3(nx * 7 + 5, ny * 7, nz * 7);
        data[idx] = Math.max(0, Math.min(255, Math.round((br * shade + rust * 35))));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round((bg * shade + rust * 18))));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round((bb * shade))));
      } else {
        data[idx] = Math.max(0, Math.min(255, Math.round(br * shade)));
        data[idx + 1] = Math.max(0, Math.min(255, Math.round(bg * shade)));
        data[idx + 2] = Math.max(0, Math.min(255, Math.round(bb * shade)));
      }
    }
  }

  const mapOutPath = path.join(OUT_DIR, `${id}_map.jpg`);
  saveRgbAsJpeg(mapOutPath, data, w, h);
  return { data, w, h };
}

/**
 * Randează un glob 3D sferic / triaxial / cu inele și salvează imaginea în `carte/imagini/globuri/<id>.jpg`.
 */
function renderGlobe(config) {
  const W = 720;
  const H = 540;
  const buf = new Uint8Array(W * H * 3);

  const tex = config.tex;
  const cloudsTex = config.cloudsTex || null;
  const [atmoR, atmoG, atmoB] = hexToRgb(config.glowColor || '#38bdf8');
  const isSun = config.id === 'sun';
  const hasSaturnRings = config.id === 'saturn';
  const hasUranusRings = config.id === 'uranus';

  // Raza sferei pe ecran (mai mică la Saturn pentru a încăpea inelele spectaculoase)
  const radiusPx = hasSaturnRings ? 128 : hasUranusRings ? 168 : 206;
  const cx = W * 0.5;
  const cy = H * 0.5;

  // Scala elipsoidală (pentru Haumea, Phobos, Deimos, Bennu, Apophis, Vesta)
  const [sx, sy, sz] = config.ellipsoidScale || [1.0, 1.0, 1.0];
  const irregularAmp = config.irregularAmp || 0;

  // Direcția luminii solare (dinspre stânga-sus-față)
  const lxRaw = -0.42;
  const lyRaw = 0.28;
  const lzRaw = 0.86;
  const lLen = Math.hypot(lxRaw, lyRaw, lzRaw);
  const lx = lxRaw / lLen;
  const ly = lyRaw / lLen;
  const lz = lzRaw / lLen;

  const lonOffsetRad = ((config.lonOffsetDeg || 0) * Math.PI) / 180;
  const tiltRad = ((config.tiltDeg || 12) * Math.PI) / 180;
  const cosTilt = Math.cos(tiltRad);
  const sinTilt = Math.sin(tiltRad);

  // Fundal cosmic cu stele discrete
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = (py * W + px) * 3;
      const dx = (px - cx) / radiusPx;
      const dy = (py - cy) / radiusPx;
      const rNorm = Math.hypot(dx * sx, dy * sy);

      // Gradient subtil de fundal + halou atmosferic/coronal în jurul globului
      let bgR = 8;
      let bgG = 13;
      let bgB = 26;

      if (isSun) {
        const glow = Math.exp(-Math.max(0, rNorm - 0.92) * 3.1);
        const corona = Math.exp(-Math.max(0, rNorm - 0.98) * 7.5);
        bgR = Math.min(255, bgR + glow * 235 + corona * 60);
        bgG = Math.min(255, bgG + glow * 135 + corona * 85);
        bgB = Math.min(255, bgB + glow * 28 + corona * 45);
      } else if (rNorm > 0.9 && rNorm < 1.45) {
        const halo = Math.exp(-Math.pow((rNorm - 1.0) * 6.5, 2)) * (config.atmoStrength ?? 0.45);
        bgR = Math.min(255, bgR + atmoR * halo);
        bgG = Math.min(255, bgG + atmoG * halo);
        bgB = Math.min(255, bgB + atmoB * halo);
      }

      buf[idx] = Math.round(bgR);
      buf[idx + 1] = Math.round(bgG);
      buf[idx + 2] = Math.round(bgB);
    }
  }

  // Adăugăm stele pe fundal (în afara discului planetar)
  let starSeed = 90123 + config.id.charCodeAt(0) * 313;
  const nextRand = () => {
    starSeed = (starSeed * 1664525 + 1013904223) % 4294967296;
    return starSeed / 4294967296;
  };
  for (let s = 0; s < 140; s++) {
    const sxPx = Math.floor(nextRand() * (W - 4)) + 2;
    const syPx = Math.floor(nextRand() * (H - 4)) + 2;
    const dCenter = Math.hypot((sxPx - cx) / radiusPx, (syPx - cy) / radiusPx);
    if (dCenter < 1.18) continue;
    const bright = Math.floor(130 + nextRand() * 125);
    const i = (syPx * W + sxPx) * 3;
    buf[i] = Math.min(255, buf[i] + bright);
    buf[i + 1] = Math.min(255, buf[i + 1] + bright);
    buf[i + 2] = Math.min(255, buf[i + 2] + Math.min(255, bright + 20));
  }

  // Funcție pentru calculul culorii inelelor lui Saturn sau Uranus într-un punct (px, py)
  const evalRing = (px, py) => {
    if (!hasSaturnRings && !hasUranusRings) return null;
    const rx = (px - cx) / radiusPx;
    const ry = (cy - py) / radiusPx;

    // Planul inelelor este înclinat
    const ringTilt = hasSaturnRings ? 0.44 : 1.15; // radiani
    const rotAngle = hasSaturnRings ? -0.14 : 1.35;
    const xr = rx * Math.cos(rotAngle) - ry * Math.sin(rotAngle);
    const yr = rx * Math.sin(rotAngle) + ry * Math.cos(rotAngle);

    const zRing = -yr / Math.sin(ringTilt);
    const yRing3D = yr;
    const xRing3D = xr;
    const rRing = Math.hypot(xRing3D, zRing * Math.cos(ringTilt));

    // Convertim în raza din planul ecuatorial al inelelor
    const eqZ = yr / Math.sin(ringTilt);
    const rEq = Math.hypot(xr, eqZ);

    if (hasSaturnRings) {
      if (rEq < 1.23 || rEq > 2.48) return null;
      const t = (rEq - 1.23) / (2.48 - 1.23); // 0..1

      // Diviziunea Cassini (~0.58..0.64) și Diviziunea Encke (~0.88..0.90)
      let alpha = 0.88;
      let colR = 228;
      let colG = 204;
      let colB = 166;

      if (t < 0.16) {
        // Inelul C (semitransparent, mai închis)
        alpha = 0.28 + t * 1.8;
        colR = 165;
        colG = 148;
        colB = 125;
      } else if (t < 0.57) {
        // Inelul B (cel mai strălucitor și dens)
        const wave = Math.sin(t * 95) * 12 + Math.cos(t * 210) * 7;
        alpha = 0.92;
        colR = Math.min(255, 236 + wave);
        colG = Math.min(255, 212 + wave * 0.9);
        colB = Math.min(255, 174 + wave * 0.8);
      } else if (t < 0.635) {
        // Diviziunea Cassini
        alpha = 0.08;
        colR = 60;
        colG = 55;
        colB = 50;
      } else if (t < 0.95) {
        // Inelul A
        const encke = t > 0.86 && t < 0.885 ? 0.22 : 1.0;
        const wave = Math.sin(t * 120) * 8;
        alpha = 0.72 * encke;
        colR = 212 + wave;
        colG = 192 + wave;
        colB = 160 + wave;
      } else {
        // Inelul F exterior
        alpha = 0.35 * (1 - (t - 0.95) / 0.05);
      }

      // Umbra planetei Saturn pe partea din spate-dreapta a inelelor
      if (eqZ < 0 && xr > 0.15) {
        const shadowDist = Math.abs(xr - eqZ * 0.45);
        if (shadowDist < 0.88) {
          const sh = shadowDist < 0.76 ? 0.14 : 0.14 + ((shadowDist - 0.76) / 0.12) * 0.86;
          colR *= sh;
          colG *= sh;
          colB *= sh;
        }
      }

      return {
        r: colR,
        g: colG,
        b: colB,
        alpha,
        inFront: eqZ > 0,
        rRing,
        yRing3D,
      };
    }

    if (hasUranusRings) {
      if (rEq < 1.38 || rEq > 1.72) return null;
      const t = (rEq - 1.38) / (1.72 - 1.38);
      const ringBand = Math.sin(t * Math.PI * 6);
      if (ringBand < 0) return null;
      const alpha = 0.32 * ringBand;
      return {
        r: 165,
        g: 225,
        b: 240,
        alpha,
        inFront: eqZ > 0,
        rRing,
        yRing3D,
      };
    }
    return null;
  };

  // Randăm mai întâi porțiunea din spate a inelelor, apoi sfera 3D, apoi porțiunea din față a inelelor
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const idx = (py * W + px) * 3;
      const ring = evalRing(px, py);

      // Coordonate normalizate pe sferă / elipsoid
      const x = ((px - cx) / radiusPx) * sx;
      const y = ((cy - py) / radiusPx) * sy;

      // Dacă este un asteroid neregulat (Bennu, Apophis, Phobos, Deimos), modulăm conturul
      let maxR = 1.0;
      if (irregularAmp > 0) {
        const ang = Math.atan2(y, x);
        const shapeMod =
          Math.sin(ang * 2 + 0.7) * 0.5 +
          Math.cos(ang * 3 - 1.1) * 0.3 +
          Math.sin(ang * 5 + 2.0) * 0.2;
        maxR = 1.0 + irregularAmp * shapeMod;
      }

      const r2 = (x * x + y * y) / (maxR * maxR);

      // Dacă avem inel în spate și suntem în afara sferei, îl desenăm
      if (ring && !ring.inFront && r2 > 1.0) {
        buf[idx] = Math.round(buf[idx] * (1 - ring.alpha) + ring.r * ring.alpha);
        buf[idx + 1] = Math.round(buf[idx + 1] * (1 - ring.alpha) + ring.g * ring.alpha);
        buf[idx + 2] = Math.round(buf[idx + 2] * (1 - ring.alpha) + ring.b * ring.alpha);
      }

      if (r2 <= 1.0) {
        const nx = x / maxR;
        const ny = y / maxR;
        const nz = Math.sqrt(Math.max(0, 1.0 - r2)) * sz;
        const nLen = Math.hypot(nx, ny, nz);
        const snx = nx / nLen;
        const sny = ny / nLen;
        const snz = nz / nLen;

        // Rotim vectorul normal cu înclinarea axei (tilt) pentru eșantionarea texturii
        const ty = sny * cosTilt - snz * sinTilt;
        const tz = sny * sinTilt + snz * cosTilt;
        const tx = snx;

        const lat = Math.asin(Math.max(-1, Math.min(1, ty)));
        const lon = Math.atan2(tx, tz) + lonOffsetRad;

        const u = 0.5 + lon / (Math.PI * 2);
        const v = 0.5 - lat / Math.PI;

        let [cr, cg, cb] = sampleTex(tex, u, v);

        // Pentru Pământ, accentuăm nuanța oceanului planetar
        if (config.id === 'earth' && cb > cr && cb > cg && cb < 95) {
          cr = cr * 0.85;
          cg = Math.min(255, cg * 1.35 + 14);
          cb = Math.min(255, cb * 2.15 + 38);
        }

        // Strat de nori pentru Pământ (doar vârfurile luminoase ale sistemelor frontale)
        if (cloudsTex) {
          const [clR, clG, clB] = sampleTex(cloudsTex, u + 0.04, v);
          const lum = (clR + clG + clB) / (3 * 255);
          const cloudAlpha = Math.pow(Math.max(0, (lum - 0.52) / 0.48), 1.8) * 0.55;
          cr = cr * (1 - cloudAlpha) + 252 * cloudAlpha;
          cg = cg * (1 - cloudAlpha) + 254 * cloudAlpha;
          cb = cb * (1 - cloudAlpha) + 255 * cloudAlpha;
        }

        if (isSun) {
          // Întunecare spre margine (limb darkening) solară autentică
          const mu = Math.max(0, snz);
          const limb = 0.42 + 0.68 * Math.pow(mu, 0.55);
          cr = Math.min(255, cr * limb * 1.12 + 25 * (1 - mu));
          cg = Math.min(255, cg * limb * 1.02);
          cb = Math.min(255, cb * limb * 0.85);
        } else {
          // Iluminare solară 3D (Lambert + ambient generos pentru vizibilitate clară la tipar)
          const ndotl = snx * lx + sny * ly + snz * lz;
          const diffuse = Math.max(0, ndotl);
          const softTerminator = Math.max(0, (ndotl + 0.25) / 1.25);
          const shade = 0.18 + 0.88 * Math.pow(softTerminator, 0.82);

          // Specular discret (pentru oceanele Pământului sau ghețarii de pe Europa/Enceladus/Pluto)
          const hx = lx;
          const hy = ly;
          const hz = lz + 1.0;
          const hLen = Math.hypot(hx, hy, hz);
          const ndoth = Math.max(0, (snx * hx + sny * hy + snz * hz) / hLen);
          const specStrength = config.specStrength ?? 0.12;
          const spec = Math.pow(ndoth, 28) * specStrength * diffuse * 255;

          // Efect Fresnel la marginea discului planetar
          const fresnel = Math.pow(1.0 - Math.max(0, snz), 3.2) * (config.fresnelStrength ?? 0.32);

          cr = cr * shade + spec + atmoR * fresnel * (0.35 + 0.65 * softTerminator);
          cg = cg * shade + spec + atmoG * fresnel * (0.35 + 0.65 * softTerminator);
          cb = cb * shade + spec + atmoB * fresnel * (0.35 + 0.65 * softTerminator);
        }

        // Anti-aliasing lin la marginea discului (ultimii 1.5 pixeli)
        const edgeDist = (1.0 - Math.sqrt(r2)) * radiusPx;
        const edgeAlpha = Math.max(0, Math.min(1, edgeDist / 1.5));

        buf[idx] = Math.round(buf[idx] * (1 - edgeAlpha) + Math.max(0, Math.min(255, cr)) * edgeAlpha);
        buf[idx + 1] = Math.round(
          buf[idx + 1] * (1 - edgeAlpha) + Math.max(0, Math.min(255, cg)) * edgeAlpha
        );
        buf[idx + 2] = Math.round(
          buf[idx + 2] * (1 - edgeAlpha) + Math.max(0, Math.min(255, cb)) * edgeAlpha
        );
      }

      // Dacă avem inel în față (sau în afara sferei), îl compunem peste sferă
      if (ring && ring.inFront) {
        buf[idx] = Math.round(buf[idx] * (1 - ring.alpha) + ring.r * ring.alpha);
        buf[idx + 1] = Math.round(buf[idx + 1] * (1 - ring.alpha) + ring.g * ring.alpha);
        buf[idx + 2] = Math.round(buf[idx + 2] * (1 - ring.alpha) + ring.b * ring.alpha);
      }
    }
  }

  const outPath = path.join(OUT_DIR, `${config.id}.jpg`);
  saveRgbAsJpeg(outPath, buf, W, H);
  return outPath;
}

const GLOBE_CONFIGS = [
  { id: 'sun', texPath: 'public/textures/hd/sun_albedo.jpg', glowColor: '#ffb703', tiltDeg: 7 },
  {
    id: 'mercury',
    texPath: 'public/textures/hd/mercury_messenger_albedo.jpg',
    glowColor: '#a8a29e',
    atmoStrength: 0.15,
    fresnelStrength: 0.1,
    tiltDeg: 2,
  },
  {
    id: 'venus',
    texPath: 'public/textures/hd/venus_galileo_atmosphere.jpg',
    glowColor: '#fbbf24',
    atmoStrength: 0.55,
    fresnelStrength: 0.45,
    tiltDeg: 3,
  },
  {
    id: 'earth',
    texPath: 'public/textures/hd/earth_albedo.jpg',
    cloudsPath: 'public/textures/earth_clouds.jpg',
    glowColor: '#38bdf8',
    atmoStrength: 0.6,
    fresnelStrength: 0.5,
    specStrength: 0.18,
    lonOffsetDeg: 18,
    tiltDeg: 16,
  },
  {
    id: 'mars',
    texPath: 'public/textures/hd/mars_viking_albedo.jpg',
    glowColor: '#f97316',
    atmoStrength: 0.38,
    fresnelStrength: 0.3,
    lonOffsetDeg: 75,
    tiltDeg: 20,
  },
  {
    id: 'jupiter',
    texPath: 'public/textures/hd/jupiter_cassini_albedo.jpg',
    glowColor: '#fdba74',
    atmoStrength: 0.4,
    fresnelStrength: 0.25,
    lonOffsetDeg: 35,
    tiltDeg: 5,
  },
  {
    id: 'saturn',
    texPath: 'public/textures/hd/saturn_cassini_albedo.jpg',
    glowColor: '#fde68a',
    atmoStrength: 0.35,
    fresnelStrength: 0.25,
    tiltDeg: 22,
  },
  {
    id: 'uranus',
    texPath: 'public/textures/hd/uranus_voyager.jpg',
    glowColor: '#67e8f9',
    atmoStrength: 0.5,
    fresnelStrength: 0.42,
    tiltDeg: 80,
  },
  {
    id: 'neptune',
    texPath: 'public/textures/hd/neptune_voyager.jpg',
    glowColor: '#3b82f6',
    atmoStrength: 0.55,
    fresnelStrength: 0.48,
    tiltDeg: 24,
  },
  //Cei 15 sateliți naturali
  {
    id: 'moon',
    texPath: 'public/textures/hd/moon_lro_albedo.jpg',
    glowColor: '#cbd5e1',
    atmoStrength: 0.15,
    fresnelStrength: 0.08,
    tiltDeg: 6,
  },
  {
    id: 'phobos',
    texPath: 'public/textures/hd/phobos_viking.jpg',
    glowColor: '#a8a29e',
    atmoStrength: 0.1,
    fresnelStrength: 0.06,
    ellipsoidScale: [0.86, 1.08, 1.0],
    irregularAmp: 0.06,
  },
  {
    id: 'deimos',
    texPath: 'public/textures/hd/deimos_viking.jpg',
    glowColor: '#d6d3d1',
    atmoStrength: 0.1,
    fresnelStrength: 0.06,
    ellipsoidScale: [0.88, 1.12, 1.0],
    irregularAmp: 0.07,
  },
  {
    id: 'io',
    texPath: 'public/textures/hd/io_galileo.jpg',
    glowColor: '#facc15',
    atmoStrength: 0.3,
    fresnelStrength: 0.2,
  },
  {
    id: 'europa',
    texPath: 'public/textures/hd/europa_galileo.jpg',
    glowColor: '#bae6fd',
    atmoStrength: 0.28,
    fresnelStrength: 0.22,
    specStrength: 0.25,
  },
  {
    id: 'ganymede',
    texPath: 'public/textures/hd/ganymede_galileo.jpg',
    glowColor: '#cbd5e1',
    atmoStrength: 0.2,
    fresnelStrength: 0.15,
  },
  {
    id: 'callisto',
    texPath: 'public/textures/hd/callisto_galileo.jpg',
    glowColor: '#a1a1aa',
    atmoStrength: 0.18,
    fresnelStrength: 0.12,
  },
  {
    id: 'mimas',
    texPath: 'public/textures/hd/mimas_cassini.jpg',
    glowColor: '#e2e8f0',
    atmoStrength: 0.15,
    fresnelStrength: 0.1,
    lonOffsetDeg: 180,
  },
  {
    id: 'enceladus',
    texPath: 'public/textures/hd/enceladus_cassini.jpg',
    glowColor: '#7dd3fc',
    atmoStrength: 0.42,
    fresnelStrength: 0.35,
    specStrength: 0.3,
  },
  {
    id: 'titan',
    texPath: 'public/textures/hd/titan_cassini.jpg',
    glowColor: '#f59e0b',
    atmoStrength: 0.62,
    fresnelStrength: 0.55,
  },
  {
    id: 'iapetus',
    texPath: 'public/textures/hd/iapetus_cassini.jpg',
    glowColor: '#cbd5e1',
    atmoStrength: 0.15,
    fresnelStrength: 0.1,
    lonOffsetDeg: 90,
  },
  {
    id: 'miranda',
    texPath: 'public/textures/hd/miranda_voyager.jpg',
    glowColor: '#cbd5e1',
    atmoStrength: 0.16,
    fresnelStrength: 0.12,
  },
  {
    id: 'titania',
    texPath: 'public/textures/hd/titania_voyager.jpg',
    glowColor: '#d1d5db',
    atmoStrength: 0.18,
    fresnelStrength: 0.12,
  },
  {
    id: 'triton',
    texPath: 'public/textures/hd/triton_voyager.jpg',
    glowColor: '#93c5fd',
    atmoStrength: 0.32,
    fresnelStrength: 0.25,
    specStrength: 0.22,
  },
  {
    id: 'charon',
    texPath: 'public/textures/hd/charon_newhorizons.jpg',
    glowColor: '#cbd5e1',
    atmoStrength: 0.16,
    fresnelStrength: 0.1,
    tiltDeg: 28,
  },
  // Planete pitice
  {
    id: 'ceres',
    texPath: 'public/textures/hd/ceres_dawn.jpg',
    glowColor: '#9ca3af',
    atmoStrength: 0.15,
    fresnelStrength: 0.1,
  },
  {
    id: 'pluto',
    texPath: 'public/textures/hd/pluto_newhorizons.jpg',
    glowColor: '#fda4af',
    atmoStrength: 0.32,
    fresnelStrength: 0.25,
    lonOffsetDeg: 170,
    tiltDeg: 18,
  },
  {
    id: 'haumea',
    texPath: 'public/textures/haumea.jpg',
    glowColor: '#e2e8f0',
    atmoStrength: 0.2,
    fresnelStrength: 0.15,
    ellipsoidScale: [0.76, 1.28, 1.0],
  },
  {
    id: 'makemake',
    texPath: 'public/textures/makemake.jpg',
    glowColor: '#fb923c',
    atmoStrength: 0.22,
    fresnelStrength: 0.16,
  },
  {
    id: 'eris',
    texPath: 'public/textures/eris.jpg',
    glowColor: '#f1f5f9',
    atmoStrength: 0.28,
    fresnelStrength: 0.22,
    specStrength: 0.28,
  },
  // Asteroizi
  {
    id: 'vesta',
    texPath: 'public/textures/hd/vesta_dawn.jpg',
    glowColor: '#a8a29e',
    atmoStrength: 0.12,
    fresnelStrength: 0.08,
    ellipsoidScale: [0.9, 1.12, 1.0],
    irregularAmp: 0.04,
  },
  {
    id: 'pallas',
    proceduralColor: '#94a3b8',
    glowColor: '#94a3b8',
    atmoStrength: 0.12,
    fresnelStrength: 0.08,
    ellipsoidScale: [0.94, 1.06, 1.0],
    irregularAmp: 0.04,
  },
  {
    id: 'psyche',
    proceduralColor: '#b49b78',
    metallic: true,
    glowColor: '#fbbf24',
    atmoStrength: 0.18,
    fresnelStrength: 0.15,
    specStrength: 0.42,
    ellipsoidScale: [0.88, 1.1, 1.0],
    irregularAmp: 0.05,
  },
  {
    id: 'bennu',
    proceduralColor: '#64748b',
    glowColor: '#64748b',
    atmoStrength: 0.1,
    fresnelStrength: 0.06,
    ellipsoidScale: [0.95, 1.02, 1.0],
    irregularAmp: 0.07,
  },
  {
    id: 'apophis',
    proceduralColor: '#a1887f',
    glowColor: '#a1887f',
    atmoStrength: 0.1,
    fresnelStrength: 0.06,
    ellipsoidScale: [0.78, 1.24, 1.0],
    irregularAmp: 0.09,
  },
];

console.log('🌍 Generare globuri 3D pentru cele 34 de corpuri din Sistemul Solar...');
for (const cfg of GLOBE_CONFIGS) {
  let tex = null;
  if (cfg.texPath) {
    tex = loadTextureRgb(cfg.texPath);
  } else {
    tex = buildProceduralAsteroidMap(cfg.id, cfg.proceduralColor, cfg.metallic);
  }
  const cloudsTex = cfg.cloudsPath ? loadTextureRgb(cfg.cloudsPath) : null;
  renderGlobe({ ...cfg, tex, cloudsTex });
}
console.log(`✅ Toate cele ${GLOBE_CONFIGS.length} globuri 3D au fost salvate în carte/imagini/globuri/!`);

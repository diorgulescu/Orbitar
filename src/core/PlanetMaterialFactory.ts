// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { CelestialBodyData } from '../types/celestial';

interface ProceduralMaps {
  colorMap: THREE.CanvasTexture;
  bumpMap: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
}

const TEXTURE_FILE_MAP: Record<string, string> = {
  sun: './textures/sun.jpg',
  mercury: './textures/mercury.jpg',
  venus: './textures/venus_atmosphere.jpg',
  earth: './textures/earth_daymap.jpg',
  moon: './textures/moon.jpg',
  mars: './textures/mars.jpg',
  jupiter: './textures/jupiter.jpg',
  saturn: './textures/saturn.jpg',
  uranus: './textures/uranus.jpg',
  neptune: './textures/neptune.jpg',
  ceres: './textures/ceres.jpg',
  eris: './textures/eris.jpg',
  haumea: './textures/haumea.jpg',
  makemake: './textures/makemake.jpg',
};

/**
 * PlanetMaterialFactory gestionează sistemul hibrid de texturi fotorealiste 2K și materiale PBR:
 * - Configurează anisotropia maximă a plăcii video (`renderer.capabilities.getMaxAnisotropy()`) și `SRGBColorSpace`.
 * - Generează instantaneu la pornire hărți procedurale 2048×1024 cu zgomot fractal multi-octavă + `bumpMap`
 *   pentru relief 3D autentic la terminatorul zi/noapte.
 * - Încarcă progresiv și asincron texturile foto 2K din `public/textures/` fără a bloca interfața.
 * - Construiește Pământul multi-strat (suprafață PBR + sferă de nori la 1.01x + halou Fresnel la 1.025x),
 *   inelele lui Saturn/Uranus cu UV-uri radiale recalculate și asteroizii sculptați cu zgomot 3D.
 */
export class PlanetMaterialFactory {
  private static maxAnisotropy = 8;
  private static readonly textureLoader = new THREE.TextureLoader();
  private static readonly proceduralCache = new Map<string, ProceduralMaps>();

  /**
   * Inițializează anisotropia maximă suportată de GPU-ul curent.
   */
  public static configureRenderer(renderer: THREE.WebGLRenderer): void {
    this.maxAnisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
  }

  public static getMaxAnisotropy(): number {
    return this.maxAnisotropy;
  }

  /**
   * Zgomot Perlin/Simplex 3D continuu și rapid pentru deformarea vertecșilor asteroizilor și relief
   */
  public static noise3D(x: number, y: number, z: number, seed = 1337): number {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    const fx = x - ix;
    const fy = y - iy;
    const fz = z - iz;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const uz = fz * fz * (3 - 2 * fz);

    const hash = (a: number, b: number, c: number): number => {
      let h = Math.imul(a * 374761393 + b * 668265263 + c * 2147483647 + seed * 1664525, 1274126177);
      h = (h ^ (h >>> 16)) >>> 0;
      return (h & 0xfffffff) / 0xfffffff;
    };

    const n000 = hash(ix, iy, iz);
    const n100 = hash(ix + 1, iy, iz);
    const n010 = hash(ix, iy + 1, iz);
    const n110 = hash(ix + 1, iy + 1, iz);
    const n001 = hash(ix, iy, iz + 1);
    const n101 = hash(ix + 1, iy, iz + 1);
    const n011 = hash(ix, iy + 1, iz + 1);
    const n111 = hash(ix + 1, iy + 1, iz + 1);

    const nx00 = n000 + (n100 - n000) * ux;
    const nx10 = n010 + (n110 - n010) * ux;
    const nx01 = n001 + (n101 - n001) * ux;
    const nx11 = n011 + (n111 - n011) * ux;
    const nxy0 = nx00 + (nx10 - nx00) * uy;
    const nxy1 = nx01 + (nx11 - nx01) * uy;

    return nxy0 + (nxy1 - nxy0) * uz;
  }

  public static fbm3D(x: number, y: number, z: number, seed: number, octaves = 4): number {
    let total = 0;
    let amp = 0.5;
    let freq = 1.0;
    for (let i = 0; i < octaves; i++) {
      total += amp * this.noise3D(x * freq, y * freq, z * freq, seed + i * 53);
      freq *= 2.07;
      amp *= 0.5;
    }
    return total;
  }

  /**
   * Încarcă asincron o textură din `public/textures/` cu anisotropie maximă și colorSpace configurat.
   */
  public static loadTextureAsync(
    url: string,
    isColorMap: boolean,
    onLoaded: (tex: THREE.Texture) => void
  ): void {
    this.textureLoader.load(
      url,
      (tex) => {
        tex.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tex.anisotropy = this.maxAnisotropy;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        onLoaded(tex);
      },
      undefined,
      () => {
        // Dacă un fișier lipsește, rămâne activă textura procedurală 2048×1024 de înaltă rezoluție
      }
    );
  }

  /**
   * Creează Soarele cu Shader GLSL animat + textură solară 2K + coroană radială pulsatorie.
   */
  public static createSunVisual(sphereGeo: THREE.SphereGeometry): {
    visualRoot: THREE.Object3D;
    updateShaderTime: (elapsed: number) => void;
  } {
    const group = new THREE.Group();
    const procMaps = this.getOrCreateProceduralMaps({
      id: 'sun',
      color: '#ffb703',
      category: 'star',
    } as CelestialBodyData);

    const uniforms = {
      uTime: { value: 0 },
      uSunMap: { value: procMaps.colorMap as THREE.Texture },
      uColorCore: { value: new THREE.Color(0xfff7cc) },
      uColorMid: { value: new THREE.Color(0xffb703) },
      uColorEdge: { value: new THREE.Color(0xea580c) },
    };

    this.loadTextureAsync('./textures/sun.jpg', true, (photoTex) => {
      uniforms.uSunMap.value = photoTex;
    });

    const sunShaderMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;
        void main() {
          vUv = uv;
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform sampler2D uSunMap;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorEdge;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;

        float plasmaNoise(vec3 p) {
          return sin(p.x * 7.5 + uTime * 1.15) * cos(p.y * 7.5 - uTime * 0.92) * sin(p.z * 7.5 + uTime * 0.78);
        }

        void main() {
          vec2 animUv = vec2(fract(vUv.x + uTime * 0.004), vUv.y);
          vec3 texCol = texture2D(uSunMap, animUv).rgb;
          float n1 = plasmaNoise(vPosition * 1.8);
          float n2 = plasmaNoise(vPosition * 4.2 + vec3(n1));
          float gran = clamp(0.5 + 0.32 * n1 + 0.24 * n2, 0.0, 1.0);

          float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          vec3 shaderCol = mix(uColorMid, uColorCore, gran);
          vec3 combined = mix(texCol * 1.22, shaderCol, 0.42);
          combined = mix(combined, uColorEdge, pow(fresnel, 1.75));
          gl_FragColor = vec4(combined, 1.0);
        }
      `,
    });

    const coreMesh = new THREE.Mesh(sphereGeo, sunShaderMat);
    group.add(coreMesh);

    // Coroană solară volumetrică (glow radial cu pulsație ușoară)
    const coronaUniforms = {
      uTime: { value: 0 },
      uGlowColor: { value: new THREE.Color(0xff9e00) },
    };

    const coronaMat = new THREE.ShaderMaterial({
      uniforms: coronaUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uGlowColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float intensity = pow(clamp(0.76 - dot(vNormal, vViewDir), 0.0, 1.0), 2.1);
          float pulse = 0.93 + 0.07 * sin(uTime * 2.1);
          gl_FragColor = vec4(uGlowColor * pulse, intensity * 0.88);
        }
      `,
    });

    const coronaMesh = new THREE.Mesh(sphereGeo, coronaMat);
    coronaMesh.scale.setScalar(1.34);
    group.add(coronaMesh);

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        uniforms.uTime.value = elapsed;
        coronaUniforms.uTime.value = elapsed;
      },
    };
  }

  /**
   * Creează un corp planetar PBR (inclusiv Pământul multi-layer, giganții cu inele UV radiale și atmosfera Fresnel).
   */
  public static createPlanetVisual(
    data: CelestialBodyData,
    sphereGeo: THREE.SphereGeometry
  ): { visualRoot: THREE.Object3D; updateShaderTime?: (elapsed: number) => void } {
    if (data.id === 'earth') {
      return this.createMultiLayerEarth(data, sphereGeo);
    }

    const group = new THREE.Group();
    const procMaps = this.getOrCreateProceduralMaps(data);

    const isGasOrIce = data.category === 'gas_giant' || data.category === 'ice_giant';
    const bumpScale = isGasOrIce ? 0.012 : data.id === 'mars' || data.id === 'moon' || data.id === 'mercury' ? 0.065 : 0.04;

    const mat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      bumpMap: procMaps.bumpMap,
      bumpScale,
      roughness: isGasOrIce ? 0.58 : 0.82,
      metalness: 0.05,
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.03,
    });

    // Încărcare progresivă a texturii 2K din public/textures/
    const texFile = TEXTURE_FILE_MAP[data.id];
    if (texFile) {
      this.loadTextureAsync(texFile, true, (photoTex) => {
        mat.map = photoTex;
        mat.needsUpdate = true;
      });
    }

    // Pentru Venus încărcăm și harta de suprafață ca bumpMap suplimentar
    if (data.id === 'venus') {
      this.loadTextureAsync('./textures/venus_surface.jpg', false, (surfTex) => {
        mat.bumpMap = surfTex;
        mat.bumpScale = 0.025;
        mat.needsUpdate = true;
      });
    }

    const mesh = new THREE.Mesh(sphereGeo, mat);
    if (data.id === 'haumea') {
      mesh.scale.set(1.34, 0.78, 0.96);
    }
    group.add(mesh);

    // Halou atmosferic Fresnel (THREE.BackSide, AdditiveBlending) pe planetele cu atmosferă
    if (data.id === 'venus') {
      group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0xfbbf24), 1.03, 0.58));
    } else if (data.id === 'mars') {
      group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0xf97316), 1.024, 0.42));
    } else if (data.id === 'jupiter') {
      group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0xfde68a), 1.02, 0.28));
    } else if (data.id === 'neptune' || data.id === 'uranus') {
      group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0x38bdf8), 1.025, 0.45));
    } else if (data.id === 'titan') {
      group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0xf59e0b), 1.045, 0.65));
    }

    // Sistemele de inele cu UV-uri recalculate radial
    if (data.id === 'saturn') {
      group.add(this.createRadialRingMesh(1.32, 2.45, 'saturn'));
    } else if (data.id === 'uranus') {
      group.add(this.createRadialRingMesh(1.38, 1.85, 'uranus'));
    } else if (data.id === 'haumea') {
      group.add(this.createRadialRingMesh(1.55, 1.74, 'haumea'));
    }

    return { visualRoot: group };
  }

  /**
   * Pământul Multi-Layer:
   * 1. Sfera de bază (1.0x) cu `map` (continente/oceane), `bumpMap` (relief montan) și `roughnessMap` (oceane lucioase, uscat mat).
   * 2. Sfera de nori (1.01x) cu `earth_clouds.jpg` (sau procedural), transparentă, cu rotație ușor diferențiată.
   * 3. Sfera atmosferică (1.025x) cu Custom Fresnel Atmosphere Shader (`THREE.BackSide`, `AdditiveBlending`).
   */
  private static createMultiLayerEarth(
    data: CelestialBodyData,
    sphereGeo: THREE.SphereGeometry
  ): { visualRoot: THREE.Object3D; updateShaderTime: (elapsed: number) => void } {
    const group = new THREE.Group();
    const procMaps = this.getOrCreateProceduralMaps(data);

    // 1. Sfera de bază PBR a Pământului
    const earthMat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      bumpMap: procMaps.bumpMap,
      bumpScale: 0.055,
      roughnessMap: procMaps.roughnessMap ?? procMaps.bumpMap,
      roughness: 0.85,
      metalness: 0.12,
    });

    this.loadTextureAsync('./textures/earth_daymap.jpg', true, (dayTex) => {
      earthMat.map = dayTex;
      earthMat.needsUpdate = true;
    });

    this.loadTextureAsync('./textures/earth_specular.jpg', false, (specTex) => {
      // Construim o hartă de rugozitate inversată (ocean = lucios / roughness mic, uscat = mat / roughness mare)
      const roughTex = this.invertSpecularToRoughnessTexture(specTex);
      earthMat.roughnessMap = roughTex;
      earthMat.needsUpdate = true;
    });

    const baseSphere = new THREE.Mesh(sphereGeo, earthMat);
    group.add(baseSphere);

    // 2. A doua sferă cu rază 1.01x pentru stratul de nori
    const procClouds = this.createProceduralCloudsTexture();
    const cloudsMat = new THREE.MeshStandardMaterial({
      map: procClouds,
      alphaMap: procClouds,
      transparent: true,
      opacity: 0.82,
      depthWrite: false,
      roughness: 0.9,
      metalness: 0.0,
    });

    this.loadTextureAsync('./textures/earth_clouds.jpg', true, (cloudTex) => {
      cloudsMat.map = cloudTex;
      cloudsMat.alphaMap = cloudTex;
      cloudsMat.needsUpdate = true;
    });

    const cloudsSphere = new THREE.Mesh(sphereGeo, cloudsMat);
    cloudsSphere.name = 'EarthCloudsLayer';
    cloudsSphere.scale.setScalar(1.01);
    group.add(cloudsSphere);

    // 3. A treia sferă cu rază 1.025x cu Custom Fresnel Atmosphere Shader (THREE.BackSide, AdditiveBlending)
    const atmosphereSphere = this.createFresnelAtmosphereMesh(
      sphereGeo,
      new THREE.Color(0x38bdf8),
      1.025,
      0.85
    );
    atmosphereSphere.name = 'EarthFresnelAtmosphere';
    group.add(atmosphereSphere);

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        // Rotație ușor diferențiată a stratului de nori față de globul terestru
        cloudsSphere.rotation.y = elapsed * 0.035;
      },
    };
  }

  /**
   * Custom Fresnel Atmosphere Shader (`THREE.BackSide`, `THREE.AdditiveBlending`)
   * care creează haloul subțire de atmosferă pe marginea planetei.
   */
  public static createFresnelAtmosphereMesh(
    sphereGeo: THREE.SphereGeometry,
    color: THREE.Color,
    scale: number,
    intensity: number
  ): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uAtmosphereColor: { value: color },
        uIntensity: { value: intensity },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uAtmosphereColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          // Pentru BackSide, produsul scalar este negativ în centru și tinde spre 0 pe contur (limb)
          float viewDot = abs(dot(vNormal, vViewDir));
          float rim = pow(clamp(1.0 - viewDot, 0.0, 1.0), 2.4);
          gl_FragColor = vec4(uAtmosphereColor, rim * uIntensity);
        }
      `,
    });

    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  /**
   * Geometrie `THREE.RingGeometry` cu UV-uri recalculate radial (de la raza interioară la cea exterioară)
   * pentru a afișa corect benzile fine ale inelelor și Diviziunea Cassini, cu `DoubleSide` și `transparent: true`.
   */
  public static createRadialRingMesh(
    innerRadius: number,
    outerRadius: number,
    ringType: 'saturn' | 'uranus' | 'haumea'
  ): THREE.Mesh {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 128, 4);
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    const v3 = new THREE.Vector3();

    for (let i = 0; i < pos.count; i++) {
      v3.fromBufferAttribute(pos, i);
      const radius = Math.hypot(v3.x, v3.y);
      const radialU = THREE.MathUtils.clamp(
        (radius - innerRadius) / (outerRadius - innerRadius),
        0,
        1
      );
      uv.setXY(i, radialU, 0.5);
    }
    uv.needsUpdate = true;
    geo.rotateX(Math.PI / 2);

    const procRingTex = this.createProceduralRingTexture(ringType);
    const mat = new THREE.MeshStandardMaterial({
      map: procRingTex,
      alphaMap: procRingTex,
      transparent: true,
      opacity: ringType === 'saturn' ? 0.94 : 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.65,
      metalness: 0.08,
    });

    if (ringType === 'saturn') {
      this.loadTextureAsync('./textures/saturn_ring_alpha.png', true, (ringTex) => {
        mat.map = ringTex;
        mat.alphaMap = ringTex;
        mat.needsUpdate = true;
      });
    }

    return new THREE.Mesh(geo, mat);
  }

  /**
   * Creează un asteroid sculptat 3D (`IcosahedronGeometry` subdivizată) deformat cu zgomot 3D multi-octavă
   * și cratere de impact ("cartof cosmic" / diamant orbital) cu `bumpMap` și `bumpScale` pronunțat.
   */
  public static createDeformedAsteroidMesh(data: CelestialBodyData): THREE.Mesh {
    const geo = new THREE.IcosahedronGeometry(1, 4);
    const posAttr = geo.attributes.position;
    const seed = data.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 37, 211);

    // Centre deterministe pentru craterele majore pe asteroid
    const craters: Array<{ dir: THREE.Vector3; radius: number; depth: number }> = [];
    for (let c = 0; c < 7; c++) {
      const theta = ((c * 137.5 + seed) % 360) * (Math.PI / 180);
      const phi = Math.acos(1 - 2 * (((c * 0.618034) + 0.2) % 1));
      const dir = new THREE.Vector3(
        Math.sin(phi) * Math.cos(theta),
        Math.cos(phi),
        Math.sin(phi) * Math.sin(theta)
      ).normalize();
      craters.push({
        dir,
        radius: 0.26 + (c % 3) * 0.08,
        depth: 0.12 + (c % 2) * 0.05,
      });
    }

    const v = new THREE.Vector3();
    const normDir = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      normDir.copy(v).normalize();

      // Forma globală de „cartof cosmic” sau titirez (Bennu) / bilobat (Apophis)
      if (data.id === 'apophis') {
        v.x *= 1.44;
        v.y *= 0.74;
        v.z *= 0.82;
      } else if (data.id === 'bennu') {
        const eqRidge = 1.0 + 0.25 * Math.pow(Math.max(0, 1.0 - Math.abs(normDir.y) * 1.4), 1.5);
        v.x *= eqRidge;
        v.z *= eqRidge;
      } else if (data.id === 'vesta') {
        v.x *= 1.18;
        v.y *= 0.86;
        v.z *= 1.06;
      } else {
        v.x *= 1.24;
        v.y *= 0.84;
        v.z *= 0.92;
      }

      // Zgomot 3D fractal pe vertecși
      const nLow = this.fbm3D(normDir.x * 1.8, normDir.y * 1.8, normDir.z * 1.8, seed, 4);
      const nHigh = this.fbm3D(normDir.x * 5.2, normDir.y * 5.2, normDir.z * 5.2, seed + 99, 3);
      let displacement = 0.82 + nLow * 0.34 + (nHigh - 0.5) * 0.09;

      // Adâncituri de cratere cu inel ridicat pe margine
      for (const crater of craters) {
        const dist = normDir.distanceTo(crater.dir);
        if (dist < crater.radius) {
          const t = dist / crater.radius;
          const bowl = (1 - t * t) * crater.depth;
          const rim = Math.exp(-Math.pow((t - 0.88) / 0.12, 2)) * crater.depth * 0.35;
          displacement = displacement - bowl + rim;
        }
      }

      v.multiplyScalar(displacement);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }

    geo.computeVertexNormals();

    const procMaps = this.getOrCreateProceduralMaps(data);
    const isMetallic = data.id === 'psyche';
    const mat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      bumpMap: procMaps.bumpMap,
      bumpScale: 0.095,
      roughness: isMetallic ? 0.42 : 0.9,
      metalness: isMetallic ? 0.72 : 0.12,
    });

    return new THREE.Mesh(geo, mat);
  }

  /**
   * Generează (și memorează în cache) textura procedurală High-Res 2048×1024 + `bumpMap` + `roughnessMap`
   * ca fallback instantaneu înainte de finalizarea încărcării fișierelor `.jpg` din `public/textures/`.
   */
  private static getOrCreateProceduralMaps(data: CelestialBodyData): ProceduralMaps {
    const cached = this.proceduralCache.get(data.id);
    if (cached) return cached;

    const width = 2048;
    const height = 1024;

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = width;
    colorCanvas.height = height;
    const cCtx = colorCanvas.getContext('2d');

    const bumpCanvas = document.createElement('canvas');
    bumpCanvas.width = width;
    bumpCanvas.height = height;
    const bCtx = bumpCanvas.getContext('2d');

    let roughnessMap: THREE.CanvasTexture | undefined;

    if (cCtx && bCtx) {
      const baseCol = new THREE.Color(data.color);
      const r0 = Math.round(baseCol.r * 255);
      const g0 = Math.round(baseCol.g * 255);
      const b0 = Math.round(baseCol.b * 255);

      // Fundal de bază
      cCtx.fillStyle = `rgb(${r0}, ${g0}, ${b0})`;
      cCtx.fillRect(0, 0, width, height);

      bCtx.fillStyle = 'rgb(128, 128, 128)';
      bCtx.fillRect(0, 0, width, height);

      const seed = data.id.split('').reduce((a, ch) => a + ch.charCodeAt(0) * 29, 101);

      // Benzi latitudinale detaliate și variație multi-octavă
      for (let y = 0; y < height; y += 2) {
        const v = y / height;
        const nBand =
          Math.sin(v * Math.PI * 16 + seed) * 0.5 +
          Math.cos(v * Math.PI * 38 - seed * 0.4) * 0.3 +
          Math.sin(v * Math.PI * 74 + seed * 1.2) * 0.2;
        const delta = Math.round(nBand * 28);
        cCtx.fillStyle = `rgba(${Math.min(255, Math.max(0, r0 + delta))}, ${Math.min(
          255,
          Math.max(0, g0 + delta)
        )}, ${Math.min(255, Math.max(0, b0 + delta))}, 0.55)`;
        cCtx.fillRect(0, y, width, 2);

        const bVal = Math.min(255, Math.max(0, 128 + Math.round(nBand * 45)));
        bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
        bCtx.fillRect(0, y, width, 2);
      }

      if (data.id === 'earth') {
        const roughCanvas = document.createElement('canvas');
        roughCanvas.width = width;
        roughCanvas.height = height;
        const rCtx = roughCanvas.getContext('2d');

        // Ocean albastru profund (lucios pe roughnessMap -> valoare mică ~35)
        cCtx.fillStyle = '#0c4a6e';
        cCtx.fillRect(0, 0, width, height);
        if (rCtx) {
          rCtx.fillStyle = 'rgb(38, 38, 38)';
          rCtx.fillRect(0, 0, width, height);
        }

        // Continente și lanțuri montane
        const continents = [
          [420, 310, 210, 155],
          [560, 580, 145, 210],
          [1020, 290, 175, 145],
          [1090, 520, 165, 195],
          [1420, 285, 295, 175],
          [1640, 660, 145, 105],
        ];
        cCtx.fillStyle = '#15803d';
        bCtx.fillStyle = 'rgb(215, 215, 215)';
        if (rCtx) rCtx.fillStyle = 'rgb(225, 225, 225)';

        for (const [cx, cy, rx, ry] of continents) {
          cCtx.beginPath();
          cCtx.ellipse(cx, cy, rx, ry, 0.2, 0, Math.PI * 2);
          cCtx.fill();

          bCtx.beginPath();
          bCtx.ellipse(cx, cy, rx * 0.85, ry * 0.85, 0.2, 0, Math.PI * 2);
          bCtx.fill();

          if (rCtx) {
            rCtx.beginPath();
            rCtx.ellipse(cx, cy, rx, ry, 0.2, 0, Math.PI * 2);
            rCtx.fill();
          }
        }

        // Calote polare
        cCtx.fillStyle = '#f8fafc';
        cCtx.fillRect(0, 0, width, 58);
        cCtx.fillRect(0, height - 58, width, 58);

        roughnessMap = new THREE.CanvasTexture(roughCanvas);
        roughnessMap.anisotropy = this.maxAnisotropy;
        roughnessMap.needsUpdate = true;
      } else if (data.id === 'mars') {
        // Valles Marineris, Olympus Mons și calotele polare pe Marte
        cCtx.fillStyle = '#7c2d12';
        cCtx.fillRect(620, 490, 420, 36);
        bCtx.fillStyle = 'rgb(40, 40, 40)';
        bCtx.fillRect(620, 490, 420, 36);

        // Olympus Mons
        cCtx.fillStyle = '#9a3412';
        cCtx.beginPath();
        cCtx.arc(460, 390, 78, 0, Math.PI * 2);
        cCtx.fill();
        bCtx.fillStyle = 'rgb(245, 245, 245)';
        bCtx.beginPath();
        bCtx.arc(460, 390, 78, 0, Math.PI * 2);
        bCtx.fill();

        // Calote polare de gheață
        cCtx.fillStyle = '#f8fafc';
        cCtx.fillRect(0, 0, width, 42);
        cCtx.fillRect(0, height - 42, width, 42);
      } else if (data.id === 'jupiter') {
        // Marea Pată Roșie și vârtejuri pe Jupiter
        cCtx.fillStyle = '#c2410c';
        cCtx.beginPath();
        cCtx.ellipse(1260, 640, 135, 72, 0, 0, Math.PI * 2);
        cCtx.fill();

        bCtx.fillStyle = 'rgb(210, 210, 210)';
        bCtx.beginPath();
        bCtx.ellipse(1260, 640, 135, 72, 0, 0, Math.PI * 2);
        bCtx.fill();
      } else if (data.id === 'pluto') {
        // Inima Tombaugh Regio pe Pluto
        cCtx.fillStyle = '#fff1f2';
        cCtx.beginPath();
        cCtx.ellipse(1020, 540, 155, 118, -0.2, 0, Math.PI * 2);
        cCtx.fill();
      }

      // Adăugăm cratere de relief pe lumile stâncoase / înghețate și asteroizi
      if (
        data.category === 'terrestrial' ||
        data.category === 'moon' ||
        data.category === 'dwarf' ||
        data.category === 'asteroid'
      ) {
        const craterCount = data.id === 'earth' ? 12 : 95;
        for (let i = 0; i < craterCount; i++) {
          const cx = ((i * 397 + seed * 17) % (width - 120)) + 60;
          const cy = ((i * 263 + seed * 31) % (height - 120)) + 60;
          const rad = 10 + ((i * 19 + seed) % 44);

          // Inel exterior luminos în bumpMap + interior adâncit
          bCtx.strokeStyle = 'rgb(235, 235, 235)';
          bCtx.lineWidth = 4;
          bCtx.beginPath();
          bCtx.arc(cx, cy, rad, 0, Math.PI * 2);
          bCtx.stroke();

          bCtx.fillStyle = 'rgb(52, 52, 52)';
          bCtx.beginPath();
          bCtx.arc(cx, cy, rad * 0.78, 0, Math.PI * 2);
          bCtx.fill();

          if (data.id !== 'earth') {
            cCtx.fillStyle = 'rgba(20, 20, 25, 0.16)';
            cCtx.beginPath();
            cCtx.arc(cx, cy, rad * 0.82, 0, Math.PI * 2);
            cCtx.fill();
          }
        }
      }
    }

    const colorMap = new THREE.CanvasTexture(colorCanvas);
    colorMap.colorSpace = THREE.SRGBColorSpace;
    colorMap.anisotropy = this.maxAnisotropy;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.ClampToEdgeWrapping;
    colorMap.needsUpdate = true;

    const bumpMap = new THREE.CanvasTexture(bumpCanvas);
    bumpMap.colorSpace = THREE.NoColorSpace;
    bumpMap.anisotropy = this.maxAnisotropy;
    bumpMap.wrapS = THREE.RepeatWrapping;
    bumpMap.wrapT = THREE.ClampToEdgeWrapping;
    bumpMap.needsUpdate = true;

    const result: ProceduralMaps = { colorMap, bumpMap, roughnessMap };
    this.proceduralCache.set(data.id, result);
    return result;
  }

  private static createProceduralCloudsTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      for (let i = 0; i < 160; i++) {
        const cx = (i * 173) % canvas.width;
        const cy = ((i * 97) % (canvas.height - 80)) + 40;
        const rx = 45 + (i % 7) * 22;
        const ry = 14 + (i % 5) * 8;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, (i % 4) * 0.15, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAnisotropy;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    return tex;
  }

  private static createProceduralRingTexture(
    ringType: 'saturn' | 'uranus' | 'haumea'
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      for (let x = 0; x < canvas.width; x++) {
        const t = x / canvas.width;
        const bands = 0.65 + 0.35 * Math.sin(t * 90) * Math.cos(t * 27);
        const edgeFade = Math.min(1, t / 0.07) * Math.min(1, (1 - t) / 0.07);
        const cassiniGap =
          ringType === 'saturn'
            ? 1.0 - 0.88 * Math.exp(-Math.pow((t - 0.67) / 0.026, 2))
            : 1.0;
        const alpha = Math.max(0, Math.min(1, bands * edgeFade * cassiniGap));

        if (ringType === 'saturn') {
          const r = Math.round(215 + 35 * bands);
          const g = Math.round(190 + 35 * bands);
          const b = Math.round(135 + 30 * bands);
          ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;
        } else if (ringType === 'uranus') {
          ctx.fillStyle = `rgba(125, 235, 250, ${(alpha * 0.55).toFixed(3)})`;
        } else {
          ctx.fillStyle = `rgba(216, 180, 254, ${(alpha * 0.5).toFixed(3)})`;
        }
        ctx.fillRect(x, 0, 1, canvas.height);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = this.maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  }

  private static invertSpecularToRoughnessTexture(specTex: THREE.Texture): THREE.Texture {
    const img = specTex.image as HTMLImageElement | HTMLCanvasElement | undefined;
    if (!img || !('width' in img) || !img.width) {
      return specTex;
    }
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(1024, img.width);
    canvas.height = Math.min(512, img.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) return specTex;

    ctx.drawImage(img as CanvasImageSource, 0, 0, canvas.width, canvas.height);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const d = imgData.data;
    for (let i = 0; i < d.length; i += 4) {
      // Specular mare (ocean) -> Roughness mic (lucios ~35); Specular mic (uscat) -> Roughness mare (mat ~225)
      const spec = d[i];
      const rough = Math.max(30, Math.min(235, 245 - Math.round(spec * 0.82)));
      d[i] = rough;
      d[i + 1] = rough;
      d[i + 2] = rough;
    }
    ctx.putImageData(imgData, 0, 0);

    const roughTex = new THREE.CanvasTexture(canvas);
    roughTex.colorSpace = THREE.NoColorSpace;
    roughTex.anisotropy = this.maxAnisotropy;
    roughTex.needsUpdate = true;
    return roughTex;
  }
}

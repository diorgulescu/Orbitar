// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { CelestialBodyData } from '../types/celestial';
import { QualityMode } from './QualityManager';

interface ProceduralMaps {
  colorMap: THREE.CanvasTexture;
  bumpMap?: THREE.CanvasTexture;
  roughnessMap?: THREE.CanvasTexture;
  nightMap?: THREE.CanvasTexture;
}

const HD_ALBEDO_MAP: Record<string, string> = {
  sun: './textures/hd/sun_albedo.jpg',
  mercury: './textures/hd/mercury_messenger_albedo.jpg',
  venus: './textures/hd/venus_magellan_surface.jpg',
  earth: './textures/hd/earth_albedo.jpg',
  moon: './textures/hd/moon_lro_albedo.jpg',
  mars: './textures/hd/mars_viking_albedo.jpg',
  phobos: './textures/hd/phobos_viking.jpg',
  deimos: './textures/hd/deimos_viking.jpg',
  jupiter: './textures/hd/jupiter_cassini_albedo.jpg',
  io: './textures/hd/io_galileo.jpg',
  europa: './textures/hd/europa_galileo.jpg',
  ganymede: './textures/hd/ganymede_galileo.jpg',
  callisto: './textures/hd/callisto_galileo.jpg',
  saturn: './textures/hd/saturn_cassini_albedo.jpg',
  mimas: './textures/hd/mimas_cassini.jpg',
  titan: './textures/hd/titan_cassini.jpg',
  enceladus: './textures/hd/enceladus_cassini.jpg',
  iapetus: './textures/hd/iapetus_cassini.jpg',
  uranus: './textures/hd/uranus_voyager.jpg',
  miranda: './textures/hd/miranda_voyager.jpg',
  titania: './textures/hd/titania_voyager.jpg',
  neptune: './textures/hd/neptune_voyager.jpg',
  triton: './textures/hd/triton_voyager.jpg',
  pluto: './textures/hd/pluto_newhorizons.jpg',
  charon: './textures/hd/charon_newhorizons.jpg',
  ceres: './textures/hd/ceres_dawn.jpg',
  vesta: './textures/hd/vesta_dawn.jpg',
  eris: './textures/eris.jpg',
  haumea: './textures/haumea.jpg',
  makemake: './textures/makemake.jpg',
};

const HD_BUMP_MAP: Record<string, string> = {
  mercury: './textures/hd/mercury_bump.jpg',
  venus: './textures/hd/venus_magellan_surface.jpg',
  earth: './textures/hd/earth_bump.jpg',
  moon: './textures/hd/moon_lola_bump.jpg',
  mars: './textures/hd/mars_mola_bump.jpg',
  phobos: './textures/hd/phobos_viking.jpg',
  deimos: './textures/hd/deimos_viking.jpg',
  mimas: './textures/hd/mimas_cassini.jpg',
  iapetus: './textures/hd/iapetus_cassini.jpg',
  miranda: './textures/hd/miranda_voyager.jpg',
  titania: './textures/hd/titania_voyager.jpg',
  triton: './textures/hd/triton_voyager.jpg',
  pluto: './textures/hd/pluto_newhorizons.jpg',
  charon: './textures/hd/charon_newhorizons.jpg',
  ceres: './textures/hd/ceres_dawn.jpg',
  vesta: './textures/hd/vesta_dawn.jpg',
};

const HD_BUMP_SCALE: Record<string, number> = {
  mercury: 0.035,
  venus: 0.04,
  earth: 0.03,
  moon: 0.045,
  mars: 0.045,
  phobos: 0.06,
  deimos: 0.032,
  mimas: 0.042,
  iapetus: 0.038,
  miranda: 0.048,
  titania: 0.035,
  triton: 0.028,
  pluto: 0.035,
  charon: 0.036,
  ceres: 0.04,
  vesta: 0.05,
  io: 0.025,
  europa: 0.02,
  ganymede: 0.03,
  callisto: 0.035,
  enceladus: 0.022,
};

const HD_USES_NORMAL_MAP = new Set<string>(['mercury', 'earth', 'moon', 'mars']);

/**
 * PlanetMaterialFactory gestionează sistemul hibrid de texturi științifice 2K, materiale Multi-Map PBR și modul Eco:
 * - În modul `hd` ("✨ Grafică: Realistă HD"):
 *   - Lazy-load pentru texturile științifice 2K din `public/textures/hd/` (NASA / USGS / JPL / Celestia / Solar System Scope)
 *   - `SRGBColorSpace` pentru hărțile de culoare (`albedo` / `emissive`) și `LinearSRGBColorSpace` pentru `bumpMap` și `roughnessMap`
 *   - Lună, Mercur, Marte, Pluto, Ceres, Vesta: `map` + `bumpMap` simultan pentru micro-umbre 3D la terminator
 *   - Venus Multi-Layer: suprafața vulcanică radar Magellan dedesubt + super-rotația norilor Galileo deasupra + mod "👁️ Vezi sub nori (Radar Magellan)"
 *   - Pământul cu 5 hărți (Albedo + Bump + Ocean Roughness + Nori cu umbră discretă + Luminile Orașelor Noaptea) + Halo Rayleigh/Fresnel
 *   - Saturn cu `saturn_rings_rgba.png` (`alphaTest: 0.01`, `transparent: true`) și umbra planetei proiectată peste inele
 * - În modul `eco` ("⚡ Grafică: Rapidă (Eco)"):
 *   - Zero descărcări externe din `public/textures/hd/`
 *   - Texturi procedurale ușoare `512×256`, geometrii `24×24` și eliberare completă VRAM (`.dispose()`).
 */
export class PlanetMaterialFactory {
  private static maxAnisotropy = 8;
  private static qualityMode: QualityMode = 'hd';
  private static readonly textureLoader = new THREE.TextureLoader();

  private static readonly ecoSphereGeo = new THREE.SphereGeometry(1, 24, 24);
  private static hdSphereGeo: THREE.SphereGeometry | null = null;

  private static readonly ecoProceduralCache = new Map<string, ProceduralMaps>();
  private static readonly hdProceduralCache = new Map<string, ProceduralMaps>();
  private static readonly loadedHdTextures = new Set<THREE.Texture>();
  private static readonly hdGeometries = new Set<THREE.BufferGeometry>();

  // Starea modului "👁️ Vezi sub nori (Radar Magellan)" pentru Venus
  private static venusRadarMode = false;
  private static venusCloudMaterial: THREE.MeshStandardMaterial | null = null;
  private static venusAtmosphereMaterial: THREE.ShaderMaterial | null = null;

  /**
   * Inițializează anisotropia maximă suportată de GPU-ul curent.
   */
  public static configureRenderer(renderer: THREE.WebGLRenderer): void {
    this.maxAnisotropy = Math.max(1, renderer.capabilities.getMaxAnisotropy());
  }

  public static setQualityMode(mode: QualityMode): void {
    const previous = this.qualityMode;
    this.qualityMode = mode;
    if (previous === 'hd' && mode === 'eco') {
      this.disposeHdResources();
    }
  }

  public static getQualityMode(): QualityMode {
    return this.qualityMode;
  }

  public static getSphereGeometry(mode: QualityMode = this.qualityMode): THREE.SphereGeometry {
    if (mode === 'eco') {
      return this.ecoSphereGeo;
    }
    if (!this.hdSphereGeo) {
      this.hdSphereGeo = new THREE.SphereGeometry(1, 64, 64);
      this.hdGeometries.add(this.hdSphereGeo);
    }
    return this.hdSphereGeo;
  }

  /**
   * Eliberează imediat memoria RAM și VRAM (texturi 2K, hărți procedurale 2048×1024 și geometrii 64×64)
   * atunci când utilizatorul sau Watchdog-ul FPS comută din `hd` în `eco`.
   */
  public static disposeHdResources(): void {
    for (const tex of this.loadedHdTextures) {
      tex.dispose();
    }
    this.loadedHdTextures.clear();

    for (const maps of this.hdProceduralCache.values()) {
      maps.colorMap.dispose();
      maps.bumpMap?.dispose();
      maps.roughnessMap?.dispose();
      maps.nightMap?.dispose();
    }
    this.hdProceduralCache.clear();

    for (const geo of this.hdGeometries) {
      geo.dispose();
    }
    this.hdGeometries.clear();
    this.hdSphereGeo = null;
    this.venusCloudMaterial = null;
    this.venusAtmosphereMaterial = null;
  }

  public static getLoadedHdTextureCount(): number {
    return this.loadedHdTextures.size;
  }

  /**
   * Comută sau setează modul "👁️ Vezi sub nori (Radar Magellan)" pentru Venus,
   * făcând stratul dens de nori de acid sulfuric semitransparent pentru a dezvălui relieful vulcanic radar.
   */
  public static setVenusRadarMode(enabled: boolean): void {
    this.venusRadarMode = enabled;
    if (this.venusCloudMaterial) {
      this.venusCloudMaterial.opacity = enabled ? 0.22 : 0.95;
      this.venusCloudMaterial.needsUpdate = true;
    }
    if (this.venusAtmosphereMaterial) {
      this.venusAtmosphereMaterial.uniforms.uIntensity.value = enabled ? 0.25 : 0.58;
    }
  }

  public static isVenusRadarMode(): boolean {
    return this.venusRadarMode;
  }

  public static toggleVenusRadarMode(): boolean {
    this.setVenusRadarMode(!this.venusRadarMode);
    return this.venusRadarMode;
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
   * Încarcă asincron (doar în modul `hd`) o textură 2K din `public/textures/hd/`.
   * Păstrează `SRGBColorSpace` pentru hărțile de culoare (`albedo`/`emissive`) și `LinearSRGBColorSpace` pentru `bumpMap`/`roughnessMap`.
   * În modul `eco` nu face niciun request de rețea.
   */
  public static loadTextureAsync(
    url: string,
    isColorMap: boolean,
    onLoaded: (tex: THREE.Texture) => void
  ): void {
    if (this.qualityMode === 'eco') {
      return;
    }

    this.textureLoader.load(
      url,
      (tex) => {
        if (this.qualityMode === 'eco') {
          tex.dispose();
          return;
        }
        tex.colorSpace = isColorMap ? THREE.SRGBColorSpace : THREE.LinearSRGBColorSpace;
        tex.anisotropy = this.maxAnisotropy;
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.ClampToEdgeWrapping;
        tex.needsUpdate = true;
        this.loadedHdTextures.add(tex);
        onLoaded(tex);
      },
      undefined,
      () => {
        // Dacă fișierul nu este disponibil, rămâne activă textura procedurală
      }
    );
  }

  /**
   * Creează Soarele adaptat la modul de calitate (`eco` vs `hd`).
   */
  public static createSunVisual(mode: QualityMode = this.qualityMode): {
    visualRoot: THREE.Object3D;
    updateShaderTime?: (elapsed: number) => void;
  } {
    const sphereGeo = this.getSphereGeometry(mode);
    const group = new THREE.Group();
    const procMaps = this.getOrCreateProceduralMaps(
      { id: 'sun', color: '#ffb703', category: 'star' } as CelestialBodyData,
      mode
    );

    if (mode === 'eco') {
      const ecoSunMat = new THREE.MeshBasicMaterial({
        map: procMaps.colorMap,
        color: 0xffe169,
      });
      const coreMesh = new THREE.Mesh(sphereGeo, ecoSunMat);
      group.add(coreMesh);
      return { visualRoot: group };
    }

    const uniforms = {
      uTime: { value: 0 },
      uSunMap: { value: procMaps.colorMap as THREE.Texture },
      uColorCore: { value: new THREE.Color(0xfff7cc) },
      uColorMid: { value: new THREE.Color(0xffb703) },
      uColorEdge: { value: new THREE.Color(0xea580c) },
    };

    this.loadTextureAsync(HD_ALBEDO_MAP.sun, true, (photoTex) => {
      uniforms.uSunMap.value = photoTex;
    });

    const sunShaderMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
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
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
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
          #include <logdepthbuf_fragment>
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
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float uTime;
        uniform vec3 uGlowColor;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          #include <logdepthbuf_fragment>
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
   * Creează un corp planetar adaptat la modul curent (`eco` vs `hd`).
   */
  public static createPlanetVisual(
    data: CelestialBodyData,
    mode: QualityMode = this.qualityMode
  ): { visualRoot: THREE.Object3D; updateShaderTime?: (elapsed: number) => void } {
    const sphereGeo = this.getSphereGeometry(mode);

    if (data.id === 'earth' && mode === 'hd') {
      return this.createMultiLayerEarthHd(data, sphereGeo);
    }

    if (data.id === 'venus' && mode === 'hd') {
      return this.createMultiLayerVenusHd(data, sphereGeo);
    }

    const group = new THREE.Group();
    const procMaps = this.getOrCreateProceduralMaps(data, mode);

    const isGasOrIce = data.category === 'gas_giant' || data.category === 'ice_giant';
    const calibratedBumpScale =
      mode === 'eco'
        ? 0
        : HD_BUMP_SCALE[data.id] ?? (isGasOrIce ? 0.012 : 0.045);

    const mat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      bumpMap: mode === 'hd' ? procMaps.bumpMap ?? null : null,
      bumpScale: calibratedBumpScale,
      roughness: isGasOrIce ? 0.62 : 0.84,
      metalness: 0.03,
      emissive: new THREE.Color(mode === 'eco' ? data.color : '#111111'),
      emissiveIntensity: mode === 'eco' ? 0.05 : 0.01,
    });

    if (mode === 'hd') {
      const albedoUrl = HD_ALBEDO_MAP[data.id];
      if (albedoUrl) {
        this.loadTextureAsync(albedoUrl, true, (photoTex) => {
          mat.map = photoTex;
          mat.needsUpdate = true;
        });
      }

      const bumpUrl = HD_BUMP_MAP[data.id];
      if (bumpUrl) {
        this.loadTextureAsync(bumpUrl, false, (bumpTex) => {
          if (HD_USES_NORMAL_MAP.has(data.id)) {
            mat.normalMap = bumpTex;
            mat.normalScale.set(0.55, 0.55);
            mat.bumpMap = null;
          } else {
            mat.bumpMap = bumpTex;
            mat.bumpScale = calibratedBumpScale;
          }
          mat.needsUpdate = true;
        });
      }
    }

    const mesh = new THREE.Mesh(sphereGeo, mat);
    mesh.name = `${data.id}_PrimarySphere`;
    if (data.id === 'haumea') {
      mesh.scale.set(1.34, 0.78, 0.96);
    }
    group.add(mesh);

    // În modul HD adăugăm haloul atmosferic Fresnel
    if (mode === 'hd') {
      if (data.id === 'mars') {
        group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0xf97316), 1.024, 0.42));
      } else if (data.id === 'jupiter') {
        group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0xfde68a), 1.02, 0.28));
      } else if (data.id === 'neptune' || data.id === 'uranus') {
        group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0x38bdf8), 1.025, 0.45));
      } else if (data.id === 'titan') {
        group.add(this.createFresnelAtmosphereMesh(sphereGeo, new THREE.Color(0xf59e0b), 1.045, 0.65));
      }
    }

    // Sistemele de inele cu UV-uri recalculate radial
    if (data.id === 'saturn') {
      group.add(this.createRadialRingMesh(1.32, 2.32, 'saturn', mode));
    } else if (data.id === 'uranus') {
      group.add(this.createRadialRingMesh(1.38, 1.85, 'uranus', mode));
    } else if (data.id === 'haumea') {
      group.add(this.createRadialRingMesh(1.55, 1.74, 'haumea', mode));
    }

    return { visualRoot: group };
  }

  /**
   * Venus Multi-Layer în modul `hd`:
   * 1. Sfera vulcanică de bază (`1.0x`) cu harta radar Magellan (`venus_magellan_surface.jpg`) + `bumpMap`.
   * 2. Sfera atmosferică densă de nori de acid sulfuric (`1.018x`, `venus_galileo_atmosphere.jpg`),
   *    care se rotește mai rapid (super-rotația atmosferei venusiene) și devine semitransparentă
   *    când copilul activează opțiunea "👁️ Vezi sub nori (Radar Magellan)".
   * 3. Haloul atmosferic Fresnel auriu (`1.032x`).
   */
  private static createMultiLayerVenusHd(
    data: CelestialBodyData,
    sphereGeo: THREE.SphereGeometry
  ): { visualRoot: THREE.Object3D; updateShaderTime: (elapsed: number) => void } {
    const group = new THREE.Group();
    const procMaps = this.getOrCreateProceduralMaps(data, 'hd');

    // 1. Suprafața vulcanică radar Magellan dedesubt
    const surfaceMat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      bumpMap: procMaps.bumpMap ?? null,
      bumpScale: HD_BUMP_SCALE.venus,
      roughness: 0.84,
      metalness: 0.08,
      emissive: new THREE.Color(0x7c2d12),
      emissiveIntensity: 0.04,
    });

    this.loadTextureAsync('./textures/hd/venus_magellan_surface.jpg', true, (surfColorTex) => {
      surfaceMat.map = surfColorTex;
      surfaceMat.needsUpdate = true;
    });

    this.loadTextureAsync('./textures/hd/venus_magellan_surface.jpg', false, (surfBumpTex) => {
      surfaceMat.bumpMap = surfBumpTex;
      surfaceMat.bumpScale = HD_BUMP_SCALE.venus;
      surfaceMat.needsUpdate = true;
    });

    const surfaceSphere = new THREE.Mesh(sphereGeo, surfaceMat);
    surfaceSphere.name = 'VenusMagellanSurfaceSphere';
    group.add(surfaceSphere);

    // 2. Stratul atmosferic dens de nori gălbui (Galileo) care se rotește separat (super-rotație)
    const cloudMat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      transparent: true,
      opacity: this.venusRadarMode ? 0.22 : 0.95,
      depthWrite: false,
      roughness: 0.68,
      metalness: 0.02,
    });
    this.venusCloudMaterial = cloudMat;

    this.loadTextureAsync('./textures/hd/venus_galileo_atmosphere.jpg', true, (atmoTex) => {
      cloudMat.map = atmoTex;
      cloudMat.needsUpdate = true;
    });

    const cloudSphere = new THREE.Mesh(sphereGeo, cloudMat);
    cloudSphere.name = 'VenusGalileoCloudLayer';
    cloudSphere.scale.setScalar(1.018);
    group.add(cloudSphere);

    // 3. Halo atmosferic Fresnel
    const atmoMesh = this.createFresnelAtmosphereMesh(
      sphereGeo,
      new THREE.Color(0xfbbf24),
      1.032,
      this.venusRadarMode ? 0.25 : 0.58
    );
    atmoMesh.name = 'VenusFresnelAtmosphere';
    this.venusAtmosphereMaterial = atmoMesh.material as THREE.ShaderMaterial;
    group.add(atmoMesh);

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        // Super-rotația atmosferei venusiene (vânturi de ~360 km/h care înconjoară planeta în 4 zile)
        cloudSphere.rotation.y = elapsed * 0.14;
      },
    };
  }

  /**
   * Pământul Multi-Layer în modul `hd` (5 hărți științifice + umbra norilor + halo Rayleigh/Fresnel):
   * 1. Sfera de bază (1.0x) cu `earth_albedo.jpg` (`SRGBColorSpace`), `earth_bump.jpg` (`LinearSRGBColorSpace`)
   *    și `earth_ocean_roughness.jpg` (`LinearSRGBColorSpace`) pentru reflexia speculară a Soarelui în oceane.
   * 2. Stratul Luminilor de Noapte (`1.002x`) cu `earth_nightlights.jpg` modulat de `dot(normal, sunDirection)`.
   * 3. Stratul discret de umbră a norilor (`1.004x`) proiectat pe suprafață.
   * 4. Sfera de nori (`1.012x`) cu `earth_clouds_alpha.png`, transparentă, cu rotație dinamică.
   * 5. Sfera atmosferică Rayleigh/Fresnel (`1.026x`) albastră pe margine (`THREE.BackSide`, `AdditiveBlending`).
   */
  private static createMultiLayerEarthHd(
    data: CelestialBodyData,
    sphereGeo: THREE.SphereGeometry
  ): { visualRoot: THREE.Object3D; updateShaderTime: (elapsed: number) => void } {
    const group = new THREE.Group();
    const procMaps = this.getOrCreateProceduralMaps(data, 'hd');

    // 1. Sfera de bază PBR a Pământului (Albedo + Topografie Bump + Ocean Roughness)
    const earthMat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      bumpMap: procMaps.bumpMap ?? null,
      bumpScale: HD_BUMP_SCALE.earth,
      roughnessMap: procMaps.roughnessMap ?? procMaps.bumpMap ?? null,
      roughness: 0.88,
      metalness: 0.14,
    });

    this.loadTextureAsync('./textures/hd/earth_albedo.jpg', true, (albedoTex) => {
      earthMat.map = albedoTex;
      earthMat.needsUpdate = true;
    });

    this.loadTextureAsync('./textures/hd/earth_bump.jpg', false, (bumpTex) => {
      earthMat.normalMap = bumpTex;
      earthMat.normalScale.set(0.5, 0.5);
      earthMat.bumpMap = null;
      earthMat.needsUpdate = true;
    });

    this.loadTextureAsync('./textures/hd/earth_ocean_roughness.jpg', false, (roughTex) => {
      earthMat.roughnessMap = roughTex;
      earthMat.needsUpdate = true;
    });

    const baseSphere = new THREE.Mesh(sphereGeo, earthMat);
    baseSphere.name = 'EarthBaseSphere';
    group.add(baseSphere);

    // 2. Luminile Orașelor pe Pământ Noaptea (modulate de dot(normal, sunDirection))
    const fallbackNightMap = procMaps.nightMap ?? this.createProceduralEarthNightTexture();
    const nightUniforms = {
      uNightMap: { value: fallbackNightMap as THREE.Texture },
      uSunWorldPos: { value: new THREE.Vector3(0, 0, 0) },
    };

    this.loadTextureAsync('./textures/hd/earth_nightlights.jpg', true, (nightTex) => {
      nightUniforms.uNightMap.value = nightTex;
    });

    const nightLightsMat = new THREE.ShaderMaterial({
      uniforms: nightUniforms,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vWorldNormal = normalize(mat3(modelMatrix) * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPos = worldPosition.xyz;
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform sampler2D uNightMap;
        uniform vec3 uSunWorldPos;
        varying vec2 vUv;
        varying vec3 vWorldNormal;
        varying vec3 vWorldPos;

        void main() {
          #include <logdepthbuf_fragment>
          vec3 sunDirection = normalize(uSunWorldPos - vWorldPos);
          float sunDot = dot(normalize(vWorldNormal), sunDirection);
          // Luminile orașelor se aprind DOAR pe emisfera de noapte (sunDot < 0.0) și se sting lin în zona de zi
          float nightFactor = 1.0 - smoothstep(-0.18, 0.06, sunDot);
          if (nightFactor <= 0.001) {
            discard;
          }
          vec3 texLights = texture2D(uNightMap, vUv).rgb;
          float intensity = max(texLights.r, max(texLights.g, texLights.b));
          vec3 cityGlow = texLights * vec3(1.35, 1.12, 0.78) * 1.55;
          gl_FragColor = vec4(cityGlow * nightFactor, clamp(intensity * 1.4, 0.0, 1.0) * nightFactor);
        }
      `,
    });

    const nightLightsSphere = new THREE.Mesh(sphereGeo, nightLightsMat);
    nightLightsSphere.name = 'EarthNightLightsLayer';
    nightLightsSphere.scale.setScalar(1.002);
    group.add(nightLightsSphere);

    // 3. Stratul de nori dinamici (earth_clouds_alpha.png) + Umbra discretă a norilor pe suprafață
    const procClouds = this.createProceduralCloudsTexture();
    const cloudShadowMat = new THREE.MeshBasicMaterial({
      map: procClouds,
      alphaMap: procClouds,
      color: 0x020617,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    });

    const cloudShadowsSphere = new THREE.Mesh(sphereGeo, cloudShadowMat);
    cloudShadowsSphere.name = 'EarthCloudShadowsLayer';
    cloudShadowsSphere.scale.setScalar(1.004);
    cloudShadowsSphere.rotation.z = 0.004;
    group.add(cloudShadowsSphere);

    const cloudsMat = new THREE.MeshStandardMaterial({
      map: procClouds,
      alphaMap: procClouds,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      roughness: 0.88,
      metalness: 0.0,
    });

    this.loadTextureAsync('./textures/hd/earth_clouds_alpha.png', true, (cloudTex) => {
      cloudsMat.map = cloudTex;
      cloudsMat.alphaMap = null;
      cloudsMat.needsUpdate = true;

      cloudShadowMat.map = cloudTex;
      cloudShadowMat.alphaMap = null;
      cloudShadowMat.needsUpdate = true;
    });

    const cloudsSphere = new THREE.Mesh(sphereGeo, cloudsMat);
    cloudsSphere.name = 'EarthCloudsLayer';
    cloudsSphere.scale.setScalar(1.012);
    group.add(cloudsSphere);

    // 4. Halo atmosferic Rayleigh/Fresnel albastru pe margine (`1.026x`)
    const atmosphereSphere = this.createFresnelAtmosphereMesh(
      sphereGeo,
      new THREE.Color(0x38bdf8),
      1.026,
      0.88
    );
    atmosphereSphere.name = 'EarthFresnelAtmosphere';
    group.add(atmosphereSphere);

    return {
      visualRoot: group,
      updateShaderTime: (elapsed: number) => {
        const angle = elapsed * 0.035;
        cloudsSphere.rotation.y = angle;
        cloudShadowsSphere.rotation.y = angle + 0.006;
      },
    };
  }

  /**
   * Custom Fresnel Atmosphere Shader (`THREE.BackSide`, `THREE.AdditiveBlending`)
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
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
          #include <logdepthbuf_vertex>
        }
      `,
      fragmentShader: /* glsl */ `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform vec3 uAtmosphereColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          #include <logdepthbuf_fragment>
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
   * Geometrie `THREE.RingGeometry` cu UV-uri recalculate radial (de la raza interioară la cea exterioară).
   * Pentru Saturn în modul `hd`, aplică `saturn_rings_rgba.png` cu `alphaTest: 0.01`, `transparent: true`
   * și proiectează umbra planetei Saturn peste partea din spate a inelelor.
   */
  public static createRadialRingMesh(
    innerRadius: number,
    outerRadius: number,
    ringType: 'saturn' | 'uranus' | 'haumea',
    mode: QualityMode = this.qualityMode
  ): THREE.Mesh {
    const segments = mode === 'eco' ? 48 : 128;
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, segments, mode === 'eco' ? 1 : 4);
    if (mode === 'hd') {
      this.hdGeometries.add(geo);
    }

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

    const procRingTex = this.createProceduralRingTexture(ringType, mode);

    if (mode === 'hd' && ringType === 'saturn') {
      const ringUniforms = {
        uRingMap: { value: procRingTex as THREE.Texture },
        uSunWorldPos: { value: new THREE.Vector3(0, 0, 0) },
      };

      this.loadTextureAsync('./textures/hd/saturn_rings_rgba.png', true, (ringTex) => {
        ringUniforms.uRingMap.value = ringTex;
      });

      const saturnRingShaderMat = new THREE.ShaderMaterial({
        uniforms: ringUniforms,
        transparent: true,
        alphaTest: 0.01,
        side: THREE.DoubleSide,
        depthWrite: false,
        vertexShader: /* glsl */ `
          #include <common>
          #include <logdepthbuf_pars_vertex>
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vPlanetCenter;
          varying float vPlanetRadius;
          void main() {
            vUv = uv;
            vec4 worldPos = modelMatrix * vec4(position, 1.0);
            vWorldPos = worldPos.xyz;
            vPlanetCenter = (modelMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
            vPlanetRadius = length(modelMatrix[0].xyz);
            gl_Position = projectionMatrix * viewMatrix * worldPos;
            #include <logdepthbuf_vertex>
          }
        `,
        fragmentShader: /* glsl */ `
          #include <common>
          #include <logdepthbuf_pars_fragment>
          uniform sampler2D uRingMap;
          uniform vec3 uSunWorldPos;
          varying vec2 vUv;
          varying vec3 vWorldPos;
          varying vec3 vPlanetCenter;
          varying float vPlanetRadius;

          void main() {
            #include <logdepthbuf_fragment>
            vec4 texSample = texture2D(uRingMap, vUv);
            if (texSample.a < 0.01) {
              discard;
            }

            // Calculăm umbra cilindrică/conică proiectată de sfera lui Saturn peste partea din spate a inelelor
            vec3 sunDir = normalize(uSunWorldPos - vPlanetCenter);
            vec3 relPos = vWorldPos - vPlanetCenter;
            float alongSun = dot(relPos, sunDir);
            float shadowFactor = 1.0;

            if (alongSun < 0.0) {
              vec3 perpVec = relPos - sunDir * alongSun;
              float normDist = length(perpVec) / max(vPlanetRadius, 0.0001);
              shadowFactor = mix(0.11, 1.0, smoothstep(0.92, 1.06, normDist));
            }

            gl_FragColor = vec4(texSample.rgb * shadowFactor, texSample.a);
          }
        `,
      });

      const saturnRingMesh = new THREE.Mesh(geo, saturnRingShaderMat);
      saturnRingMesh.name = 'SaturnRingsHdShadowMesh';
      return saturnRingMesh;
    }

    const mat = new THREE.MeshStandardMaterial({
      map: procRingTex,
      alphaMap: procRingTex,
      alphaTest: 0.01,
      transparent: true,
      opacity: ringType === 'saturn' ? 0.94 : 0.52,
      side: THREE.DoubleSide,
      depthWrite: false,
      roughness: 0.65,
      metalness: 0.08,
    });

    return new THREE.Mesh(geo, mat);
  }

  /**
   * Creează un asteroid sau satelit neregulat sculptat 3D pe baza unei `SphereGeometry`
   * cu coordonate UV echirectangulare fără cusături, deformat triaxial cu zgomot 3D continuu.
   */
  public static createDeformedAsteroidMesh(
    data: CelestialBodyData,
    mode: QualityMode = this.qualityMode
  ): THREE.Mesh {
    const segW = mode === 'eco' ? 32 : 72;
    const segH = mode === 'eco' ? 24 : 54;
    const geo = new THREE.SphereGeometry(1, segW, segH);
    if (mode === 'hd') {
      this.hdGeometries.add(geo);
    }

    const posAttr = geo.attributes.position;
    const seed = data.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 37, 211);
    const hasPhotographicMap =
      data.id === 'phobos' || data.id === 'deimos' || data.id === 'vesta';

    const craters: Array<{ dir: THREE.Vector3; radius: number; depth: number }> = [];
    if (data.id === 'phobos') {
      // Depresiunea reală a craterului gigant Stickney pe emisfera vestică a lui Phobos
      craters.push({
        dir: new THREE.Vector3(-0.88, 0.08, 0.46).normalize(),
        radius: 0.42,
        depth: 0.14,
      });
    } else if (!hasPhotographicMap) {
      for (let c = 0; c < 7; c++) {
        const theta = ((c * 137.5 + seed) % 360) * (Math.PI / 180);
        const phi = Math.acos(1 - 2 * ((c * 0.618034 + 0.2) % 1));
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
    }

    const v = new THREE.Vector3();
    const normDir = new THREE.Vector3();

    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      normDir.copy(v).normalize();

      if (data.id === 'apophis') {
        v.x *= 1.44;
        v.y *= 0.74;
        v.z *= 0.82;
      } else if (data.id === 'phobos') {
        // Proporțiile triaxiale reale ale lui Phobos (13.0 × 11.4 × 9.1 km)
        v.x *= 1.26;
        v.y *= 0.88;
        v.z *= 1.06;
      } else if (data.id === 'deimos') {
        // Proporțiile triaxiale reale ale lui Deimos (7.8 × 6.0 × 5.1 km)
        v.x *= 1.24;
        v.y *= 0.85;
        v.z *= 0.96;
      } else if (data.id === 'bennu') {
        const eqRidge = 1.0 + 0.25 * Math.pow(Math.max(0, 1.0 - Math.abs(normDir.y) * 1.4), 1.5);
        v.x *= eqRidge;
        v.z *= eqRidge;
      } else if (data.id === 'vesta') {
        v.x *= 1.15;
        v.y *= 0.88;
        v.z *= 1.05;
      } else {
        v.x *= 1.24;
        v.y *= 0.84;
        v.z *= 0.92;
      }

      const nLow = this.fbm3D(normDir.x * 1.8, normDir.y * 1.8, normDir.z * 1.8, seed, 4);
      const nHigh = this.fbm3D(normDir.x * 5.2, normDir.y * 5.2, normDir.z * 5.2, seed + 99, 3);
      let displacement = hasPhotographicMap
        ? 0.93 + nLow * 0.14 + (nHigh - 0.5) * 0.035
        : 0.82 + nLow * 0.34 + (nHigh - 0.5) * 0.09;

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

    const procMaps = this.getOrCreateProceduralMaps(data, mode);
    const isMetallic = data.id === 'psyche';
    const bumpScale = mode === 'hd' ? HD_BUMP_SCALE[data.id] ?? 0.095 : 0;

    const mat = new THREE.MeshStandardMaterial({
      map: procMaps.colorMap,
      bumpMap: mode === 'hd' ? procMaps.bumpMap ?? null : null,
      bumpScale,
      roughness: isMetallic ? 0.42 : 0.9,
      metalness: isMetallic ? 0.72 : 0.12,
    });

    if (mode === 'hd') {
      const albedoUrl = HD_ALBEDO_MAP[data.id];
      if (albedoUrl) {
        this.loadTextureAsync(albedoUrl, true, (photoTex) => {
          mat.map = photoTex;
          mat.needsUpdate = true;
        });
      }
      const bumpUrl = HD_BUMP_MAP[data.id];
      if (bumpUrl) {
        this.loadTextureAsync(bumpUrl, false, (bumpTex) => {
          mat.bumpMap = bumpTex;
          mat.bumpScale = bumpScale;
          mat.needsUpdate = true;
        });
      }
    }

    return new THREE.Mesh(geo, mat);
  }

  /**
   * Generează textura procedurală (`512×256` în modul `eco` sau `2048×1024` + `bumpMap` + `nightMap` în modul `hd`).
   */
  private static getOrCreateProceduralMaps(
    data: CelestialBodyData,
    mode: QualityMode
  ): ProceduralMaps {
    const cache = mode === 'eco' ? this.ecoProceduralCache : this.hdProceduralCache;
    const cached = cache.get(data.id);
    if (cached) return cached;

    const width = mode === 'eco' ? 512 : 2048;
    const height = mode === 'eco' ? 256 : 1024;
    const scaleX = width / 2048;
    const scaleY = height / 1024;

    const colorCanvas = document.createElement('canvas');
    colorCanvas.width = width;
    colorCanvas.height = height;
    const cCtx = colorCanvas.getContext('2d');

    let bumpCanvas: HTMLCanvasElement | undefined;
    let bCtx: CanvasRenderingContext2D | null = null;
    if (mode === 'hd') {
      bumpCanvas = document.createElement('canvas');
      bumpCanvas.width = width;
      bumpCanvas.height = height;
      bCtx = bumpCanvas.getContext('2d');
    }

    let roughnessMap: THREE.CanvasTexture | undefined;
    let nightMap: THREE.CanvasTexture | undefined;

    if (cCtx) {
      const baseCol = new THREE.Color(data.color);
      const r0 = Math.round(baseCol.r * 255);
      const g0 = Math.round(baseCol.g * 255);
      const b0 = Math.round(baseCol.b * 255);

      cCtx.fillStyle = `rgb(${r0}, ${g0}, ${b0})`;
      cCtx.fillRect(0, 0, width, height);

      if (bCtx) {
        bCtx.fillStyle = 'rgb(128, 128, 128)';
        bCtx.fillRect(0, 0, width, height);
      }

      const seed = data.id.split('').reduce((a, ch) => a + ch.charCodeAt(0) * 29, 101);
      const stepY = mode === 'eco' ? 2 : 2;

      for (let y = 0; y < height; y += stepY) {
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
        cCtx.fillRect(0, y, width, stepY);

        if (bCtx) {
          const bVal = Math.min(255, Math.max(0, 128 + Math.round(nBand * 45)));
          bCtx.fillStyle = `rgb(${bVal}, ${bVal}, ${bVal})`;
          bCtx.fillRect(0, y, width, stepY);
        }
      }

      if (data.id === 'earth') {
        let rCtx: CanvasRenderingContext2D | null = null;
        let roughCanvas: HTMLCanvasElement | undefined;
        if (mode === 'hd') {
          roughCanvas = document.createElement('canvas');
          roughCanvas.width = width;
          roughCanvas.height = height;
          rCtx = roughCanvas.getContext('2d');
        }

        cCtx.fillStyle = '#0c4a6e';
        cCtx.fillRect(0, 0, width, height);
        if (rCtx) {
          rCtx.fillStyle = 'rgb(38, 38, 38)';
          rCtx.fillRect(0, 0, width, height);
        }

        const continents = [
          [420, 310, 210, 155],
          [560, 580, 145, 210],
          [1090, 265, 195, 135], // Europa & bazinul Carpatic / România
          [1090, 520, 165, 195],
          [1420, 285, 295, 175],
          [1640, 660, 145, 105],
        ];
        cCtx.fillStyle = '#15803d';
        if (bCtx) bCtx.fillStyle = 'rgb(215, 215, 215)';
        if (rCtx) rCtx.fillStyle = 'rgb(225, 225, 225)';

        for (const [cx, cy, rx, ry] of continents) {
          cCtx.beginPath();
          cCtx.ellipse(cx * scaleX, cy * scaleY, rx * scaleX, ry * scaleY, 0.2, 0, Math.PI * 2);
          cCtx.fill();

          if (bCtx) {
            bCtx.beginPath();
            bCtx.ellipse(
              cx * scaleX,
              cy * scaleY,
              rx * 0.85 * scaleX,
              ry * 0.85 * scaleY,
              0.2,
              0,
              Math.PI * 2
            );
            bCtx.fill();
          }

          if (rCtx) {
            rCtx.beginPath();
            rCtx.ellipse(cx * scaleX, cy * scaleY, rx * scaleX, ry * scaleY, 0.2, 0, Math.PI * 2);
            rCtx.fill();
          }
        }

        cCtx.fillStyle = '#f8fafc';
        cCtx.fillRect(0, 0, width, Math.round(58 * scaleY));
        cCtx.fillRect(0, height - Math.round(58 * scaleY), width, Math.round(58 * scaleY));

        if (roughCanvas) {
          roughnessMap = new THREE.CanvasTexture(roughCanvas);
          roughnessMap.colorSpace = THREE.LinearSRGBColorSpace;
          roughnessMap.anisotropy = this.maxAnisotropy;
          roughnessMap.needsUpdate = true;
        }
        if (mode === 'hd') {
          nightMap = this.createProceduralEarthNightTexture();
        }
      } else if (data.id === 'mars') {
        cCtx.fillStyle = '#7c2d12';
        cCtx.fillRect(620 * scaleX, 490 * scaleY, 420 * scaleX, 36 * scaleY);
        if (bCtx) {
          bCtx.fillStyle = 'rgb(40, 40, 40)';
          bCtx.fillRect(620 * scaleX, 490 * scaleY, 420 * scaleX, 36 * scaleY);
        }

        cCtx.fillStyle = '#9a3412';
        cCtx.beginPath();
        cCtx.arc(460 * scaleX, 390 * scaleY, 78 * scaleX, 0, Math.PI * 2);
        cCtx.fill();
        if (bCtx) {
          bCtx.fillStyle = 'rgb(245, 245, 245)';
          bCtx.beginPath();
          bCtx.arc(460 * scaleX, 390 * scaleY, 78 * scaleX, 0, Math.PI * 2);
          bCtx.fill();
        }

        cCtx.fillStyle = '#f8fafc';
        cCtx.fillRect(0, 0, width, Math.round(42 * scaleY));
        cCtx.fillRect(0, height - Math.round(42 * scaleY), width, Math.round(42 * scaleY));
      } else if (data.id === 'jupiter') {
        cCtx.fillStyle = '#c2410c';
        cCtx.beginPath();
        cCtx.ellipse(1260 * scaleX, 640 * scaleY, 135 * scaleX, 72 * scaleY, 0, 0, Math.PI * 2);
        cCtx.fill();

        if (bCtx) {
          bCtx.fillStyle = 'rgb(210, 210, 210)';
          bCtx.beginPath();
          bCtx.ellipse(1260 * scaleX, 640 * scaleY, 135 * scaleX, 72 * scaleY, 0, 0, Math.PI * 2);
          bCtx.fill();
        }
      } else if (data.id === 'pluto') {
        cCtx.fillStyle = '#fff1f2';
        cCtx.beginPath();
        cCtx.ellipse(1020 * scaleX, 540 * scaleY, 155 * scaleX, 118 * scaleY, -0.2, 0, Math.PI * 2);
        cCtx.fill();
      } else if (data.id === 'iapetus') {
        // Dihotomia Yin-Yang a lui Iapetus (Cassini Regio întunecată cu tranziție difuză vs Roncevaux Terra luminoasă)
        const grad = cCtx.createRadialGradient(
          520 * scaleX,
          512 * scaleY,
          80 * scaleX,
          520 * scaleX,
          512 * scaleY,
          560 * scaleX
        );
        grad.addColorStop(0, 'rgba(56, 46, 38, 0.88)');
        grad.addColorStop(0.65, 'rgba(68, 56, 46, 0.72)');
        grad.addColorStop(1, 'rgba(68, 56, 46, 0)');
        cCtx.fillStyle = grad;
        cCtx.fillRect(0, 0, width, height);
      } else if (data.id === 'charon') {
        // Calota nordică roșiatică Mordor Macula de pe Charon cu tranziție graduală
        const grad = cCtx.createLinearGradient(0, 0, 0, Math.round(240 * scaleY));
        grad.addColorStop(0, 'rgba(132, 82, 64, 0.85)');
        grad.addColorStop(0.6, 'rgba(132, 82, 64, 0.45)');
        grad.addColorStop(1, 'rgba(132, 82, 64, 0)');
        cCtx.fillStyle = grad;
        cCtx.fillRect(0, 0, width, Math.round(240 * scaleY));
      } else if (data.id === 'mimas') {
        // Craterul gigant Herschel cu inel difuz și pisc central discret
        const hx = 430 * scaleX;
        const hy = 512 * scaleY;
        const hRad = 125 * scaleX;
        const grad = cCtx.createRadialGradient(hx, hy, hRad * 0.12, hx, hy, hRad);
        grad.addColorStop(0, 'rgba(248, 250, 252, 0.85)');
        grad.addColorStop(0.22, 'rgba(148, 163, 184, 0.55)');
        grad.addColorStop(0.82, 'rgba(100, 116, 139, 0.45)');
        grad.addColorStop(0.95, 'rgba(241, 245, 249, 0.65)');
        grad.addColorStop(1, 'rgba(241, 245, 249, 0)');
        cCtx.fillStyle = grad;
        cCtx.beginPath();
        cCtx.arc(hx, hy, hRad, 0, Math.PI * 2);
        cCtx.fill();
      } else if (data.id === 'triton') {
        // Calota sudică roz-crem de azot înghețat de pe Triton cu tranziție fină
        const grad = cCtx.createLinearGradient(0, Math.round(420 * scaleY), 0, height);
        grad.addColorStop(0, 'rgba(232, 210, 202, 0)');
        grad.addColorStop(0.45, 'rgba(232, 210, 202, 0.48)');
        grad.addColorStop(1, 'rgba(224, 198, 188, 0.78)');
        cCtx.fillStyle = grad;
        cCtx.fillRect(0, Math.round(420 * scaleY), width, height - Math.round(420 * scaleY));
      }

      if (
        data.category === 'terrestrial' ||
        data.category === 'moon' ||
        data.category === 'dwarf' ||
        data.category === 'asteroid'
      ) {
        const craterCount = data.id === 'earth' ? 8 : mode === 'eco' ? 28 : 95;
        for (let i = 0; i < craterCount; i++) {
          const cx = (((i * 397 + seed * 17) % 1920) + 60) * scaleX;
          const cy = (((i * 263 + seed * 31) % 900) + 60) * scaleY;
          const rad = (10 + ((i * 19 + seed) % 44)) * scaleX;

          if (bCtx) {
            bCtx.strokeStyle = 'rgb(235, 235, 235)';
            bCtx.lineWidth = 4;
            bCtx.beginPath();
            bCtx.arc(cx, cy, rad, 0, Math.PI * 2);
            bCtx.stroke();

            bCtx.fillStyle = 'rgb(52, 52, 52)';
            bCtx.beginPath();
            bCtx.arc(cx, cy, rad * 0.78, 0, Math.PI * 2);
            bCtx.fill();
          }

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
    colorMap.anisotropy = mode === 'eco' ? 1 : this.maxAnisotropy;
    colorMap.wrapS = THREE.RepeatWrapping;
    colorMap.wrapT = THREE.ClampToEdgeWrapping;
    colorMap.needsUpdate = true;

    let bumpMap: THREE.CanvasTexture | undefined;
    if (bumpCanvas) {
      bumpMap = new THREE.CanvasTexture(bumpCanvas);
      bumpMap.colorSpace = THREE.LinearSRGBColorSpace;
      bumpMap.anisotropy = this.maxAnisotropy;
      bumpMap.wrapS = THREE.RepeatWrapping;
      bumpMap.wrapT = THREE.ClampToEdgeWrapping;
      bumpMap.needsUpdate = true;
    }

    const result: ProceduralMaps = { colorMap, bumpMap, roughnessMap, nightMap };
    cache.set(data.id, result);
    return result;
  }

  /**
   * Fallback procedural pentru Luminile Orașelor pe Pământ Noaptea (`earth_nightmap.jpg`),
   * desenând puncte luminoase aurii pe conturul continentelor, cu vizibilitate clară pentru Europa și România.
   */
  private static createProceduralEarthNightTexture(): THREE.CanvasTexture {
    const width = 2048;
    const height = 1024;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      ctx.fillStyle = '#02040a';
      ctx.fillRect(0, 0, width, height);

      // Regiuni metropolitane și artere luminoase (inclusiv Europa și România la u≈0.57, v≈0.246)
      const clusters: Array<[number, number, number, number, number]> = [
        [1168, 252, 65, 42, 95], // România (București, Cluj, Timișoara, Iași, Constanța) & Sud-Estul Europei
        [1065, 238, 115, 65, 140], // Europa Centrală și de Vest
        [1195, 338, 45, 35, 65], // Mediterana de Est & Delta Nilului
        [530, 290, 120, 75, 130], // Coasta de Est a Americii de Nord
        [375, 310, 75, 60, 85], // Coasta de Vest a Americii de Nord
        [720, 640, 85, 95, 90], // America de Sud
        [1120, 560, 85, 95, 70], // Africa
        [1475, 365, 95, 70, 125], // India
        [1695, 305, 115, 85, 145], // Asia de Est (China, Coreea, Japonia)
        [1790, 710, 65, 45, 55], // Australia
      ];

      for (const [cx, cy, rx, ry, dotCount] of clusters) {
        const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, Math.max(rx, ry));
        grad.addColorStop(0, 'rgba(255, 205, 95, 0.55)');
        grad.addColorStop(0.5, 'rgba(255, 165, 45, 0.22)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx * 1.15, ry * 1.15, 0, 0, Math.PI * 2);
        ctx.fill();

        for (let i = 0; i < dotCount; i++) {
          const ang = (i * 137.508 * Math.PI) / 180;
          const dist = Math.sqrt((i + 0.5) / dotCount);
          const px = cx + Math.cos(ang) * rx * dist;
          const py = cy + Math.sin(ang) * ry * dist;
          const rad = i % 7 === 0 ? 3.2 : 1.8;
          ctx.fillStyle = i % 4 === 0 ? '#fffbeb' : '#ffb703';
          ctx.beginPath();
          ctx.arc(px, py, rad, 0, Math.PI * 2);
          ctx.fill();
        }
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
    this.loadedHdTextures.add(tex);
    return tex;
  }

  private static createProceduralRingTexture(
    ringType: 'saturn' | 'uranus' | 'haumea',
    mode: QualityMode
  ): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = mode === 'eco' ? 256 : 1024;
    canvas.height = mode === 'eco' ? 16 : 64;
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
    tex.anisotropy = mode === 'eco' ? 1 : this.maxAnisotropy;
    tex.needsUpdate = true;
    if (mode === 'hd') {
      this.loadedHdTextures.add(tex);
    }
    return tex;
  }
}

// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { BeltConfig, CelestialBodyData } from '../types/celestial';
import { ScaleManager } from './ScaleManager';

export interface InstancedBeltEntry {
  config: BeltConfig;
  mesh: THREE.InstancedMesh;
  orbitalPointsAu: THREE.Vector3[];
  rotations: THREE.Euler[];
  scales: number[];
}

/**
 * ProceduralModels construiește:
 * - Shadere GLSL procedurale pentru coroana și fotosfera solară, atmosfera terestră (efect Fresnel)
 *   și sistemele de inele planetare (Saturn, Uranus, Haumea).
 * - Modele 3D stilizate din primitive Three.js pentru ISS, JWST, Hubble, Voyager, sonde și rovere.
 * - Centura de Asteroizi și Centura Kuiper randate eficient cu THREE.InstancedMesh.
 */
export class ProceduralModels {
  private static readonly sharedSphereGeo = new THREE.SphereGeometry(1, 48, 32);

  /**
   * Creează grupul vizual 3D complet al unui corp ceresc sau al unei misiuni spațiale.
   */
  public static createCelestialVisual(
    data: CelestialBodyData
  ): { visualRoot: THREE.Object3D; updateShaderTime?: (elapsed: number) => void } {
    const modelType = data.modelType ?? 'sphere';

    if (data.id === 'sun') {
      return this.createSunWithShader();
    }

    if (modelType === 'iss') {
      return { visualRoot: this.createISSModel() };
    }
    if (modelType === 'jwst') {
      return { visualRoot: this.createJWSTModel() };
    }
    if (modelType === 'hubble') {
      return { visualRoot: this.createHubbleModel(data.color) };
    }
    if (modelType === 'voyager') {
      return { visualRoot: this.createVoyagerModel(data.color) };
    }
    if (modelType === 'probe') {
      return { visualRoot: this.createSpaceProbeModel(data) };
    }
    if (modelType === 'rover') {
      return { visualRoot: this.createMarsRoverModel(data.id === 'perseverance') };
    }
    if (modelType === 'asteroid') {
      return { visualRoot: this.createSculptedAsteroidMesh(data) };
    }

    // Corp sferic (planete, sateliți majori, planete pitice)
    const group = new THREE.Group();
    const texture = this.generateRichBodyTexture(data);
    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      roughness: data.category === 'gas_giant' || data.category === 'ice_giant' ? 0.6 : 0.8,
      metalness: 0.06,
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.08,
    });

    const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
    if (data.id === 'haumea') {
      // Forma elipsoidală caracteristică planetei pitice Haumea
      mesh.scale.set(1.32, 0.78, 0.96);
    }
    group.add(mesh);

    // Atmosferă procedurală cu shader Fresnel pentru Pământ, Venus, Marte și Titan
    if (data.id === 'earth') {
      group.add(this.createAtmosphereShaderMesh(new THREE.Color(0x38bdf8), 1.045, 0.68));
    } else if (data.id === 'venus') {
      group.add(this.createAtmosphereShaderMesh(new THREE.Color(0xfbbf24), 1.04, 0.52));
    } else if (data.id === 'mars') {
      group.add(this.createAtmosphereShaderMesh(new THREE.Color(0xf97316), 1.03, 0.32));
    } else if (data.id === 'titan') {
      group.add(this.createAtmosphereShaderMesh(new THREE.Color(0xf59e0b), 1.05, 0.6));
    }

    // Inele planetare cu shader radial
    if (data.id === 'saturn') {
      group.add(this.createRingShaderMesh(1.32, 2.42, new THREE.Color(0xfde047), true));
    } else if (data.id === 'uranus') {
      group.add(this.createRingShaderMesh(1.38, 1.82, new THREE.Color(0x67e8f9), false));
    } else if (data.id === 'haumea') {
      group.add(this.createRingShaderMesh(1.55, 1.72, new THREE.Color(0xd8b4fe), false));
    }

    return { visualRoot: group };
  }

  /**
   * Soarele cu shader GLSL animat pentru granulația fotosferei și coroana solară luminoasă.
   */
  private static createSunWithShader(): {
    visualRoot: THREE.Object3D;
    updateShaderTime: (elapsed: number) => void;
  } {
    const group = new THREE.Group();

    const uniforms = {
      uTime: { value: 0 },
      uColorCore: { value: new THREE.Color(0xfff5c0) },
      uColorMid: { value: new THREE.Color(0xffb703) },
      uColorEdge: { value: new THREE.Color(0xf97316) },
    };

    const sunShaderMat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;
        void main() {
          vPosition = position;
          vNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          vViewDir = normalize(-mvPos.xyz);
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: /* glsl */ `
        uniform float uTime;
        uniform vec3 uColorCore;
        uniform vec3 uColorMid;
        uniform vec3 uColorEdge;
        varying vec3 vNormal;
        varying vec3 vPosition;
        varying vec3 vViewDir;

        float plasmaNoise(vec3 p) {
          return sin(p.x * 7.0 + uTime * 1.1) * cos(p.y * 7.0 - uTime * 0.9) * sin(p.z * 7.0 + uTime * 0.7);
        }

        void main() {
          float n1 = plasmaNoise(vPosition * 1.6);
          float n2 = plasmaNoise(vPosition * 3.8 + vec3(n1));
          float gran = clamp(0.5 + 0.35 * n1 + 0.25 * n2, 0.0, 1.0);

          float fresnel = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          vec3 col = mix(uColorMid, uColorCore, gran);
          col = mix(col, uColorEdge, pow(fresnel, 1.8));
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });

    const coreMesh = new THREE.Mesh(this.sharedSphereGeo, sunShaderMat);
    group.add(coreMesh);

    // Coroană solară volumetrică (Fresnel inversat + pulsare)
    const coronaUniforms = {
      uTime: { value: 0 },
      uGlowColor: { value: new THREE.Color(0xffaa00) },
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
          float intensity = pow(clamp(0.72 - dot(vNormal, vViewDir), 0.0, 1.0), 2.2);
          float pulse = 0.92 + 0.08 * sin(uTime * 2.0);
          gl_FragColor = vec4(uGlowColor * pulse, intensity * 0.85);
        }
      `,
    });

    const coronaMesh = new THREE.Mesh(this.sharedSphereGeo, coronaMat);
    coronaMesh.scale.setScalar(1.32);
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
   * Shader Fresnel pentru atmosfera planetelor (halou atmosferic curat la orizont).
   */
  private static createAtmosphereShaderMesh(
    color: THREE.Color,
    scale: number,
    intensityFactor: number
  ): THREE.Mesh {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: color },
        uIntensity: { value: intensityFactor },
      },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
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
        uniform vec3 uColor;
        uniform float uIntensity;
        varying vec3 vNormal;
        varying vec3 vViewDir;
        void main() {
          float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
          float alpha = pow(rim, 2.6) * uIntensity;
          gl_FragColor = vec4(uColor, alpha);
        }
      `,
    });

    const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
    mesh.scale.setScalar(scale);
    return mesh;
  }

  /**
   * Shader procedural pentru inelele lui Saturn, Uranus și Haumea (cu Diviziunea Cassini pe Saturn).
   */
  private static createRingShaderMesh(
    innerRadius: number,
    outerRadius: number,
    baseColor: THREE.Color,
    hasCassiniDivision: boolean
  ): THREE.Mesh {
    const geo = new THREE.RingGeometry(innerRadius, outerRadius, 96);
    geo.rotateX(Math.PI / 2);

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: baseColor },
        uInner: { value: innerRadius },
        uOuter: { value: outerRadius },
        uCassini: { value: hasCassiniDivision ? 1.0 : 0.0 },
      },
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      vertexShader: /* glsl */ `
        varying vec3 vLocalPos;
        void main() {
          vLocalPos = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor;
        uniform float uInner;
        uniform float uOuter;
        uniform float uCassini;
        varying vec3 vLocalPos;
        void main() {
          float r = length(vLocalPos.xz);
          float t = clamp((r - uInner) / (uOuter - uInner), 0.0, 1.0);
          float bands = 0.65 + 0.35 * sin(t * 62.0) * cos(t * 19.0);
          float edgeFade = smoothstep(0.0, 0.08, t) * (1.0 - smoothstep(0.92, 1.0, t));
          float cassiniGap = 1.0 - uCassini * 0.82 * exp(-pow((t - 0.66) / 0.032, 2.0));
          float alpha = bands * edgeFade * cassiniGap * (uCassini > 0.5 ? 0.85 : 0.36);
          gl_FragColor = vec4(uColor * (0.8 + 0.25 * bands), alpha);
        }
      `,
    });

    return new THREE.Mesh(geo, mat);
  }

  /**
   * Model 3D stilizat pentru Stația Spațială Internațională (ISS) din primitive Three.js.
   */
  private static createISSModel(): THREE.Group {
    const group = new THREE.Group();

    const trussMat = new THREE.MeshStandardMaterial({ color: 0xd6d3d1, metalness: 0.6, roughness: 0.35 });
    const moduleMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, metalness: 0.4, roughness: 0.4 });
    const solarMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.22,
      metalness: 0.7,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.8, roughness: 0.25 });

    // Grinda centrală (Integrated Truss)
    const truss = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, 0.12), trussMat);
    group.add(truss);

    // Modulele presurizate centrale (Destiny, Harmony, Columbus, Zvezda)
    const mainModule = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.35, 16), moduleMat);
    mainModule.rotation.x = Math.PI / 2;
    group.add(mainModule);

    const crossModule = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.85, 16), moduleMat);
    crossModule.position.set(0, 0, 0.35);
    group.add(crossModule);

    const nodeSphere = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 16), goldMat);
    group.add(nodeSphere);

    // Cele 8 aripi solare fotovoltaice (4 perechi)
    const panelGeo = new THREE.BoxGeometry(0.26, 0.02, 1.55);
    const xPositions = [-1.15, -0.78, 0.78, 1.15];
    for (const xPos of xPositions) {
      const panel = new THREE.Mesh(panelGeo, solarMat);
      panel.position.set(xPos, 0, 0);
      group.add(panel);
    }

    return group;
  }

  /**
   * Model 3D stilizat pentru Telescopul Spațial James Webb (JWST):
   * scut termic în formă de romb + oglindă aurită segmentată + trepied secundar.
   */
  private static createJWSTModel(): THREE.Group {
    const group = new THREE.Group();

    const shieldMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      emissive: 0x9333ea,
      emissiveIntensity: 0.12,
      metalness: 0.85,
      roughness: 0.2,
      side: THREE.DoubleSide,
    });
    const goldMirrorMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: 0xffb703,
      emissiveIntensity: 0.28,
      metalness: 0.9,
      roughness: 0.15,
    });
    const strutMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.5, roughness: 0.4 });

    // Scutul termic în straturi (romb alungit)
    for (let i = 0; i < 3; i++) {
      const shieldGeo = new THREE.ConeGeometry(1.15 - i * 0.06, 0.04, 4);
      shieldGeo.scale(1.35, 1, 0.85);
      const shield = new THREE.Mesh(shieldGeo, shieldMat);
      shield.position.y = -0.25 - i * 0.07;
      group.add(shield);
    }

    // Oglinda primară hexagonală aurită
    const mirrorGeo = new THREE.CylinderGeometry(0.68, 0.68, 0.08, 6);
    mirrorGeo.rotateZ(Math.PI / 2);
    const mirror = new THREE.Mesh(mirrorGeo, goldMirrorMat);
    mirror.position.set(0, 0.35, 0);
    group.add(mirror);

    // Oglinda secundară și brațele de susținere
    const secMirror = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.05, 12), goldMirrorMat);
    secMirror.rotation.z = Math.PI / 2;
    secMirror.position.set(0.65, 0.35, 0);
    group.add(secMirror);

    const strut = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 8), strutMat);
    strut.rotation.z = Math.PI / 2.3;
    strut.position.set(0.32, 0.52, 0);
    group.add(strut);

    return group;
  }

  /**
   * Model 3D stilizat pentru Telescopul Hubble / Euclid (cilindru optic + panouri solare).
   */
  private static createHubbleModel(accentColor: string): THREE.Group {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.75, roughness: 0.25 });
    const panelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(accentColor),
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.25,
      metalness: 0.6,
      roughness: 0.3,
    });

    const mainTube = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 1.35, 20), bodyMat);
    mainTube.rotation.z = Math.PI / 2;
    group.add(mainTube);

    const apertureDoor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.45, 0.45), bodyMat);
    apertureDoor.position.set(0.72, 0.32, 0);
    apertureDoor.rotation.z = -0.35;
    group.add(apertureDoor);

    const wingGeo = new THREE.BoxGeometry(0.32, 0.03, 1.85);
    const wings = new THREE.Mesh(wingGeo, panelMat);
    group.add(wings);

    return group;
  }

  /**
   * Model 3D stilizat pentru sondele interstelare Voyager 1 și Voyager 2
   * (antenă parabolică albă + bus decagonal aurit + braț RTG și magnetometru).
   */
  private static createVoyagerModel(accentColor: string): THREE.Group {
    const group = new THREE.Group();
    const dishMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.3 });
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xffb703,
      emissive: new THREE.Color(accentColor),
      emissiveIntensity: 0.18,
      metalness: 0.7,
      roughness: 0.3,
    });
    const boomMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.4 });

    // Antena parabolică High-Gain
    const dish = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.28, 24, 1, true), dishMat);
    dish.material.side = THREE.DoubleSide;
    dish.position.y = 0.22;
    group.add(dish);

    // Corpul decagonal și Discul de Aur
    const bus = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.24, 10), busMat);
    group.add(bus);

    // Brațul lung al magnetometrului
    const magBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.65, 8), boomMat);
    magBoom.rotation.z = Math.PI / 2.6;
    magBoom.position.set(0.68, -0.25, 0);
    group.add(magBoom);

    // Brațul generatorului nuclear RTG
    const rtgBoom = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.95, 10), boomMat);
    rtgBoom.rotation.z = -Math.PI / 3;
    rtgBoom.position.set(-0.45, -0.2, 0);
    group.add(rtgBoom);

    return group;
  }

  /**
   * Model 3D stilizat pentru sonde interplanetare (New Horizons, Parker Solar Probe, Rosetta, JUICE).
   */
  private static createSpaceProbeModel(data: CelestialBodyData): THREE.Group {
    const group = new THREE.Group();
    const busMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.2,
      metalness: 0.75,
      roughness: 0.25,
    });
    const panelMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.color),
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.25,
      metalness: 0.6,
      roughness: 0.3,
    });
    const whiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.3, metalness: 0.3 });

    // Corpul central al sondei
    const bus = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.55), busMat);
    group.add(bus);

    // Antena sau scutul termic (pentru Parker Solar Probe)
    if (data.id === 'parker') {
      const shield = new THREE.Mesh(new THREE.CylinderGeometry(0.78, 0.78, 0.08, 6), whiteMat);
      shield.position.y = 0.36;
      group.add(shield);
    } else {
      const dish = new THREE.Mesh(new THREE.ConeGeometry(0.52, 0.2, 20), whiteMat);
      dish.position.y = 0.38;
      group.add(dish);
    }

    // Aripi solare extinse (pentru Rosetta și JUICE)
    if (data.id !== 'newhorizons') {
      const wings = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.04, 0.42), panelMat);
      group.add(wings);
      if (data.id === 'juice') {
        const crossWings = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.04, 2.2), panelMat);
        group.add(crossWings);
      }
    }

    return group;
  }

  /**
   * Model 3D stilizat pentru roverele marțiene Perseverance (cu Ingenuity) și Curiosity.
   */
  private static createMarsRoverModel(includeIngenuity: boolean): THREE.Group {
    const group = new THREE.Group();
    const chassisMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      emissive: 0xf97316,
      emissiveIntensity: 0.15,
      metalness: 0.5,
      roughness: 0.35,
    });
    const wheelMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.7, roughness: 0.4 });
    const laserMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });

    // Șasiul roverului
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.32, 0.65), chassisMat);
    chassis.position.y = 0.2;
    group.add(chassis);

    // Catargul și camera SuperCam / ChemCam
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.58, 10), chassisMat);
    mast.position.set(0.32, 0.55, 0);
    group.add(mast);

    const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.16, 0.28), chassisMat);
    head.position.set(0.32, 0.85, 0);
    group.add(head);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 12), laserMat);
    eye.position.set(0.41, 0.85, 0);
    group.add(eye);

    // Cele 6 roți Rocker-Bogie
    const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.12, 14);
    wheelGeo.rotateX(Math.PI / 2);
    const wheelX = [-0.38, 0, 0.38];
    const wheelZ = [-0.42, 0.42];
    for (const wx of wheelX) {
      for (const wz of wheelZ) {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(wx, 0, wz);
        group.add(w);
      }
    }

    // Elicopterul Ingenuity plutind deasupra roverului Perseverance
    if (includeIngenuity) {
      const heliGroup = new THREE.Group();
      heliGroup.position.set(-0.2, 1.25, 0);
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, 0.18), chassisMat);
      const rotor = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.02, 0.08), laserMat);
      rotor.position.y = 0.15;
      heliGroup.add(box, rotor);
      group.add(heliGroup);
    }

    return group;
  }

  /**
   * Creează un mesh poliedric neregulat și sculptat pentru asteroizii principali (Vesta, Pallas, Bennu, Apophis, Psyche).
   */
  private static createSculptedAsteroidMesh(data: CelestialBodyData): THREE.Mesh {
    const geo = new THREE.IcosahedronGeometry(1, 2);
    const posAttr = geo.attributes.position;
    let seed = data.id.split('').reduce((acc, ch) => acc + ch.charCodeAt(0) * 31, 137);

    const v = new THREE.Vector3();
    for (let i = 0; i < posAttr.count; i++) {
      v.fromBufferAttribute(posAttr, i);
      const wave =
        Math.sin(v.x * 3.2 + seed) * 0.14 +
        Math.cos(v.y * 2.7 - seed) * 0.12 +
        Math.sin(v.z * 3.5 + seed * 0.5) * 0.1;

      if (data.id === 'apophis') {
        // Formă bilobată (arahidă)
        v.x *= 1.38;
        v.y *= 0.78;
      } else if (data.id === 'bennu') {
        // Formă de titirez cu creastă ecuatorială
        const eqBulge = 1.0 + 0.22 * (1.0 - Math.abs(v.y));
        v.x *= eqBulge;
        v.z *= eqBulge;
      }

      v.multiplyScalar(1.0 + wave);
      posAttr.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(data.color),
      roughness: data.id === 'psyche' ? 0.38 : 0.88,
      metalness: data.id === 'psyche' ? 0.72 : 0.12,
      emissive: new THREE.Color(data.color),
      emissiveIntensity: 0.08,
    });

    return new THREE.Mesh(geo, mat);
  }

  /**
   * Construiește Centura de Asteroizi și Centura Kuiper folosind `THREE.InstancedMesh`
   * pentru randare la 60 FPS într-un singur draw call per centură.
   */
  public static createInstancedBelt(config: BeltConfig, scaleManager: ScaleManager): InstancedBeltEntry {
    const geo = new THREE.IcosahedronGeometry(1, 0);
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.color),
      roughness: 0.75,
      metalness: 0.15,
      emissive: new THREE.Color(config.color),
      emissiveIntensity: 0.18,
    });

    const mesh = new THREE.InstancedMesh(geo, mat, config.count);
    mesh.name = `Belt_${config.id}`;
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    const orbitalPointsAu: THREE.Vector3[] = [];
    const rotations: THREE.Euler[] = [];
    const scales: number[] = [];

    let seed = config.id === 'asteroid-belt' ? 77123 : 99451;
    const nextRand = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    };

    for (let i = 0; i < config.count; i++) {
      const rAu = config.innerRadiusAU + nextRand() * (config.outerRadiusAU - config.innerRadiusAU);
      const angle = nextRand() * Math.PI * 2;
      const yAu = (nextRand() - 0.5) * config.thicknessAU;

      orbitalPointsAu.push(new THREE.Vector3(rAu * Math.cos(angle), yAu, rAu * Math.sin(angle)));
      rotations.push(
        new THREE.Euler(nextRand() * Math.PI, nextRand() * Math.PI, nextRand() * Math.PI)
      );
      scales.push(0.45 + nextRand() * 0.85);
    }

    const entry: InstancedBeltEntry = {
      config,
      mesh,
      orbitalPointsAu,
      rotations,
      scales,
    };

    this.updateInstancedBeltTransforms(entry, scaleManager);
    return entry;
  }

  /**
   * Actualizează matricile instanțelor centurii atunci când utilizatorul comută între
   * Scara Didactică și Scara Reală.
   */
  public static updateInstancedBeltTransforms(
    entry: InstancedBeltEntry,
    scaleManager: ScaleManager
  ): void {
    const dummy = new THREE.Object3D();
    const isReal = scaleManager.getMode() === 'real';
    const baseSize = isReal ? 0.14 : entry.config.id === 'kuiper-belt' ? 0.34 : 0.22;

    for (let i = 0; i < entry.config.count; i++) {
      const pos3D = scaleManager.scaleHeliocentricPosition(entry.orbitalPointsAu[i]);
      dummy.position.copy(pos3D);
      dummy.rotation.copy(entry.rotations[i]);
      dummy.scale.setScalar(baseSize * entry.scales[i]);
      dummy.updateMatrix();
      entry.mesh.setMatrixAt(i, dummy.matrix);
    }
    entry.mesh.instanceMatrix.needsUpdate = true;
  }

  private static generateRichBodyTexture(data: CelestialBodyData): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      const baseColor = new THREE.Color(data.color);
      const r = Math.floor(baseColor.r * 255);
      const g = Math.floor(baseColor.g * 255);
      const b = Math.floor(baseColor.b * 255);

      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      for (let y = 0; y < canvas.height; y += 4) {
        const wave = Math.sin((y / canvas.height) * Math.PI * 10);
        const shade = Math.floor(wave * 24);
        ctx.fillStyle = `rgba(${Math.min(255, Math.max(0, r + shade))}, ${Math.min(
          255,
          Math.max(0, g + shade)
        )}, ${Math.min(255, Math.max(0, b + shade))}, 0.55)`;
        ctx.fillRect(0, y, canvas.width, 4);
      }

      if (data.id === 'earth') {
        ctx.fillStyle = 'rgba(34, 197, 94, 0.78)';
        const continents = [
          [110, 80, 55, 42],
          [140, 145, 38, 52],
          [260, 75, 45, 38],
          [275, 130, 42, 48],
          [350, 70, 75, 45],
          [410, 165, 36, 26],
        ];
        for (const [cx, cy, rx, ry] of continents) {
          ctx.beginPath();
          ctx.ellipse(cx, cy, rx, ry, 0.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(248, 250, 252, 0.88)';
        ctx.fillRect(0, 0, canvas.width, 15);
        ctx.fillRect(0, canvas.height - 15, canvas.width, 15);
      } else if (data.id === 'jupiter') {
        ctx.fillStyle = 'rgba(220, 68, 38, 0.85)';
        ctx.beginPath();
        ctx.ellipse(310, 158, 34, 18, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (data.id === 'pluto') {
        // Sputnik Planitia („Inima lui Pluto”)
        ctx.fillStyle = 'rgba(255, 250, 245, 0.85)';
        ctx.beginPath();
        ctx.ellipse(250, 135, 38, 28, -0.2, 0, Math.PI * 2);
        ctx.fill();
      } else if (data.id === 'io') {
        // Calderă vulcanică pe Io
        ctx.fillStyle = 'rgba(220, 38, 38, 0.75)';
        for (let i = 0; i < 14; i++) {
          ctx.beginPath();
          ctx.arc(((i * 97) % 460) + 25, ((i * 61) % 200) + 28, 7 + (i % 6), 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (data.id === 'europa' || data.id === 'enceladus') {
        // Fracturi glaciare (lineae / dungi de tigru)
        ctx.strokeStyle =
          data.id === 'europa' ? 'rgba(180, 83, 9, 0.45)' : 'rgba(56, 189, 248, 0.65)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 16; i++) {
          ctx.beginPath();
          ctx.moveTo((i * 45) % 512, 20);
          ctx.lineTo(((i * 75) + 180) % 512, 236);
          ctx.stroke();
        }
      }
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }
}

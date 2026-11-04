// SPDX-License-Identifier: GPL-3.0-or-later
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { setupTestDomEnvironment } from '../setup/dom-env';
import { PlanetMaterialFactory } from '../../src/core/PlanetMaterialFactory';
import { ProceduralModels } from '../../src/core/ProceduralModels';
import { ScaleManager } from '../../src/core/ScaleManager';
import { CelestialBodyData } from '../../src/types/celestial';

function makeTestBody(overrides: Partial<CelestialBodyData>): CelestialBodyData {
  return {
    id: 'earth',
    name: 'Pământul',
    subtitle: 'Planeta Albastră',
    category: 'terrestrial',
    color: '#00f0ff',
    radiusKm: 6371,
    massEarthRatio: 1.0,
    distanceFromSunAU: 1.0,
    orbitPeriodDays: 365.25,
    dayLengthHours: 24,
    gravityRatio: 1.0,
    meanTempC: 15,
    junior: {
      summary: 'Rezumat Junior',
      analogy: 'Analogie',
      funFact: 'Curiozitate',
      travelTime: { car: '170 ani', plane: '19 ani', rocket: '5 luni', light: '8 min' },
    },
    cadet: {
      summary: 'Rezumat Cadet',
      structure: [{ name: 'Nucleu', description: 'Fier-nichel' }],
      explorationHistory: 'Istoric',
      quiz: {
        question: 'Întrebare?',
        options: ['A', 'B', 'C'],
        correctIndex: 0,
        explanation: 'Explicație',
      },
    },
    ...overrides,
  };
}

describe('PlanetMaterialFactory — Unit Tests', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
    PlanetMaterialFactory.setQualityMode('hd');
  });

  it('include suportul pentru Logarithmic Depth Buffer în toate shaderele GLSL personalizate (Soare, Pământ, Inelele lui Saturn, Atmosferă)', () => {
    const sunHd = PlanetMaterialFactory.createSunVisual('hd');
    assert.ok(typeof sunHd.updateShaderTime === 'function');
    sunHd.updateShaderTime!(1.5);

    const earthHd = PlanetMaterialFactory.createPlanetVisual(
      makeTestBody({ id: 'earth' }),
      'hd'
    );
    assert.ok(typeof earthHd.updateShaderTime === 'function');
    earthHd.updateShaderTime!(2.0);

    const saturnHd = PlanetMaterialFactory.createPlanetVisual(
      makeTestBody({
        id: 'saturn',
        category: 'gas_giant',
      }),
      'hd'
    );

    const shaderMaterials: THREE.ShaderMaterial[] = [];
    for (const root of [sunHd.visualRoot, earthHd.visualRoot, saturnHd.visualRoot]) {
      root.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.material instanceof THREE.ShaderMaterial) {
          shaderMaterials.push(obj.material);
        }
      });
    }

    assert.ok(shaderMaterials.length >= 4, 'Trebuie să existe cel puțin 4 ShaderMaterials (Soare, Pământ, Atmosferă, Inele Saturn)');
    for (const mat of shaderMaterials) {
      assert.ok(
        mat.vertexShader.includes('#include <logdepthbuf_vertex>'),
        'Vertex shader-ul trebuie să includă #include <logdepthbuf_vertex>'
      );
      assert.ok(
        mat.fragmentShader.includes('#include <logdepthbuf_fragment>'),
        'Fragment shader-ul trebuie să includă #include <logdepthbuf_fragment>'
      );
    }
  });

  it('comută modul Radar Magellan pentru atmosfera planetei Venus', () => {
    const venusVisual = PlanetMaterialFactory.createPlanetVisual(
      makeTestBody({ id: 'venus' }),
      'hd'
    );
    assert.ok(venusVisual.visualRoot.children.length >= 2);

    const initialRadar = PlanetMaterialFactory.isVenusRadarMode();
    const toggledRadar = PlanetMaterialFactory.toggleVenusRadarMode();
    assert.equal(toggledRadar, !initialRadar);
    assert.equal(PlanetMaterialFactory.toggleVenusRadarMode(), initialRadar);
  });
});

describe('ProceduralModels — Unit Tests', () => {
  beforeEach(() => {
    setupTestDomEnvironment();
  });

  it('construiește modelele 3D cu texturi PBR detaliate în modul HD pentru ISS, JWST (18 segmente), Hubble, Voyager și Sonde', () => {
    const jwstHd = ProceduralModels.createCelestialVisual(
      makeTestBody({ id: 'jwst', category: 'telescope', modelType: 'jwst' }),
      'hd'
    );
    const jwstEco = ProceduralModels.createCelestialVisual(
      makeTestBody({ id: 'jwst', category: 'telescope', modelType: 'jwst' }),
      'eco'
    );
    assert.ok(
      jwstHd.visualRoot.children.length >= 25,
      `Modelul HD pentru JWST trebuie să conțină cele 5 straturi Kapton + 18 segmente hexagonale + trepied (are ${jwstHd.visualRoot.children.length})`
    );
    assert.ok(jwstHd.visualRoot.children.length > jwstEco.visualRoot.children.length);

    const issHd = ProceduralModels.createCelestialVisual(
      makeTestBody({ id: 'iss', category: 'station', modelType: 'iss' }),
      'hd'
    );
    assert.ok(issHd.visualRoot.children.length >= 16, 'ISS în modul HD conține modulele presurizate, radiatoarele și cele 8 aripi solare duble');

    const voyagerHd = ProceduralModels.createCelestialVisual(
      makeTestBody({ id: 'voyager1', category: 'probe', modelType: 'voyager' }),
      'hd'
    );
    assert.ok(voyagerHd.visualRoot.children.length >= 8, 'Voyager 1 în HD include antena, feedhorn-ul pe trepied și Discul de Aur');

    const roverVisual = ProceduralModels.createCelestialVisual(
      makeTestBody({ id: 'perseverance', category: 'rover', modelType: 'rover' }),
      'hd'
    );
    assert.equal(
      roverVisual.visualRoot.children.length,
      0,
      'Roverul nu mai randează un mesh orbital plutitor, fiind reprezentat prin pinul de suprafață de pe Marte'
    );
  });

  it('construiește centurile de asteroizi cu THREE.InstancedMesh și reduce numărul de instanțe la 25% în modul Eco', () => {
    const sm = new ScaleManager('didactic');
    const beltEntry = ProceduralModels.createInstancedBelt(
      {
        id: 'asteroid-belt',
        name: 'Centura Principală',
        innerRadiusAU: 2.1,
        outerRadiusAU: 3.3,
        thicknessAU: 0.3,
        count: 400,
        color: '#a8a29e',
        descriptionRo: 'Centura Principală de Asteroizi dintre Marte și Jupiter',
      },
      sm
    );

    ProceduralModels.updateInstancedBeltTransforms(beltEntry, sm, 'hd');
    assert.equal(beltEntry.mesh.count, 400);

    ProceduralModels.updateInstancedBeltTransforms(beltEntry, sm, 'eco');
    assert.equal(beltEntry.mesh.count, 100);
  });
});

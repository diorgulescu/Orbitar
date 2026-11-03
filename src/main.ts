// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager';
import { ScaleManager } from './core/ScaleManager';
import { CelestialBodyInstance, OrbitalEngine } from './core/OrbitalEngine';
import { CameraController } from './core/CameraController';
import { AgeTier, CelestialCategory } from './types/celestial';

interface OrbitarGlobalDebug {
  sceneManager: SceneManager;
  scaleManager: ScaleManager;
  orbitalEngine: OrbitalEngine;
  cameraController: CameraController;
}

declare global {
  interface Window {
    __orbitar?: OrbitarGlobalDebug;
  }
}

const STORAGE_KEY_AGE_TIER = 'orbitar_age_tier';
const STORAGE_KEY_BADGES = 'orbitar_badges';

type FilterGroup = 'planets' | 'moons' | 'dwarfs_asteroids' | 'missions';

function matchCategoryToFilter(cat: CelestialCategory, filter: FilterGroup): boolean {
  if (filter === 'planets') {
    return (
      cat === 'star' ||
      cat === 'terrestrial' ||
      cat === 'gas_giant' ||
      cat === 'ice_giant'
    );
  }
  if (filter === 'moons') {
    return cat === 'moon';
  }
  if (filter === 'dwarfs_asteroids') {
    return cat === 'dwarf' || cat === 'asteroid';
  }
  return (
    cat === 'station' ||
    cat === 'telescope' ||
    cat === 'probe' ||
    cat === 'rover'
  );
}

async function bootstrapOrbitar(): Promise<void> {
  const canvasContainer = document.getElementById('canvas-container');
  const labelsContainer = document.getElementById('labels-container');
  const loadingScreen = document.getElementById('loading-screen');
  const loadingBarFill = document.getElementById('loading-bar-fill');
  const loadingStatus = document.getElementById('loading-status');

  if (!canvasContainer || !labelsContainer) {
    throw new Error('Containerele DOM principale pentru Orbitar lipsesc din index.html.');
  }

  if (loadingBarFill) loadingBarFill.style.width = '50%';
  if (loadingStatus) {
    loadingStatus.textContent = 'Se construiește scena 3D și câmpul stelar procedural…';
  }

  const sceneManager = new SceneManager(canvasContainer);
  const scaleManager = new ScaleManager('didactic');
  const orbitalEngine = new OrbitalEngine(sceneManager.scene, scaleManager, new Date());
  const cameraController = new CameraController(
    sceneManager.camera,
    sceneManager.controls,
    sceneManager.renderer.domElement,
    orbitalEngine,
    scaleManager
  );

  if (loadingBarFill) loadingBarFill.style.width = '82%';
  if (loadingStatus) {
    loadingStatus.textContent =
      'Se încarcă baza de date didactică (planete, sateliți, asteroizi și misiuni)…';
  }

  await orbitalEngine.initialize();

  window.__orbitar = {
    sceneManager,
    scaleManager,
    orbitalEngine,
    cameraController,
  };

  // Starea nivelului de studiu (junior 6–8 ani vs cadet 9–12 ani)
  let currentTier: AgeTier =
    (window.localStorage.getItem(STORAGE_KEY_AGE_TIER) as AgeTier) === 'cadet'
      ? 'cadet'
      : 'junior';
  let currentFilter: FilterGroup = 'planets';

  // Crearea etichetelor 2D și a butoanelor rapide din HUD
  const labelElements = new Map<string, HTMLButtonElement>();
  const pillElements = new Map<string, HTMLButtonElement>();
  const bodiesListEl = document.getElementById('hud-bodies-list');

  for (const body of orbitalEngine.getBodies()) {
    const labelBtn = document.createElement('button');
    labelBtn.type = 'button';
    labelBtn.className = 'celestial-label';
    labelBtn.dataset.bodyId = body.data.id;
    labelBtn.innerHTML = `<span class="label-dot" style="background:${body.data.color}"></span>${body.data.name}`;
    labelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      cameraController.focusBody(body.data.id);
    });
    labelsContainer.appendChild(labelBtn);
    labelElements.set(body.data.id, labelBtn);

    if (bodiesListEl) {
      const pillBtn = document.createElement('button');
      pillBtn.type = 'button';
      pillBtn.className = 'body-pill';
      pillBtn.dataset.bodyId = body.data.id;
      pillBtn.innerHTML = `<span class="body-pill-dot" style="background:${body.data.color}"></span>${body.data.name}`;
      pillBtn.addEventListener('click', () => {
        cameraController.focusBody(body.data.id);
      });
      bodiesListEl.appendChild(pillBtn);
      pillElements.set(body.data.id, pillBtn);
    }
  }

  const applyFilterTabs = (): void => {
    for (const body of orbitalEngine.getBodies()) {
      const pill = pillElements.get(body.data.id);
      if (pill) {
        const visible = matchCategoryToFilter(body.data.category, currentFilter);
        pill.style.display = visible ? 'inline-flex' : 'none';
      }
    }
  };
  applyFilterTabs();

  const filterButtons = document.querySelectorAll<HTMLButtonElement>('[data-filter]');
  filterButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      currentFilter = (btn.dataset.filter as FilterGroup) || 'planets';
      filterButtons.forEach((b) => b.classList.remove('hud-btn-active'));
      btn.classList.add('hud-btn-active');
      applyFilterTabs();
    });
  });

  // Controale Nivel Studiu, Scară și Timp
  const btnTierJunior = document.getElementById('btn-tier-junior');
  const btnTierCadet = document.getElementById('btn-tier-cadet');
  const btnScaleToggle = document.getElementById('btn-scale-toggle');
  const btnTimePause = document.getElementById('btn-time-pause');
  const btnResetCamera = document.getElementById('btn-reset-camera');
  const simDateEl = document.getElementById('hud-sim-date');

  const targetNameEl = document.getElementById('hud-target-name');
  const targetSubtitleEl = document.getElementById('hud-target-subtitle');
  const targetCategoryEl = document.getElementById('hud-target-category');
  const targetDescEl = document.getElementById('hud-target-desc');
  const targetDistEl = document.getElementById('hud-target-dist');

  const juniorBox = document.getElementById('hud-junior-box');
  const cadetBox = document.getElementById('hud-cadet-box');
  const juniorAnalogyEl = document.getElementById('hud-junior-analogy');
  const juniorFactEl = document.getElementById('hud-junior-fact');
  const travelCarEl = document.getElementById('travel-car');
  const travelPlaneEl = document.getElementById('travel-plane');
  const travelRocketEl = document.getElementById('travel-rocket');
  const travelLightEl = document.getElementById('travel-light');

  const metricRadiusEl = document.getElementById('metric-radius');
  const metricGravityEl = document.getElementById('metric-gravity');
  const metricTempEl = document.getElementById('metric-temp');
  const metricOrbitEl = document.getElementById('metric-orbit');
  const cadetStructureEl = document.getElementById('hud-cadet-structure');
  const quizQuestionEl = document.getElementById('hud-quiz-question');
  const quizOptionsEl = document.getElementById('hud-quiz-options');
  const quizFeedbackEl = document.getElementById('hud-quiz-feedback');

  const updateSelectedBodyHud = (body: CelestialBodyInstance | null): void => {
    const activeBody = body ?? orbitalEngine.getBody('sun') ?? null;
    const activeId = activeBody?.data.id ?? 'sun';

    for (const [id, pill] of pillElements.entries()) {
      pill.classList.toggle('is-active', id === activeId);
    }
    for (const [id, lbl] of labelElements.entries()) {
      lbl.classList.toggle('is-selected', id === activeId);
    }

    if (!activeBody) return;
    const d = activeBody.data;

    if (targetNameEl) targetNameEl.textContent = d.name;
    if (targetSubtitleEl) targetSubtitleEl.textContent = d.subtitle;
    if (targetCategoryEl) targetCategoryEl.textContent = activeBody.meta.categoryNameRo;

    if (currentTier === 'junior') {
      if (targetDescEl) targetDescEl.textContent = d.junior.summary;
      juniorBox?.classList.remove('is-hidden-box');
      cadetBox?.classList.add('is-hidden-box');

      if (juniorAnalogyEl) juniorAnalogyEl.textContent = d.junior.analogy;
      if (juniorFactEl) juniorFactEl.textContent = d.junior.funFact;
      if (travelCarEl) travelCarEl.textContent = d.junior.travelTime.car;
      if (travelPlaneEl) travelPlaneEl.textContent = d.junior.travelTime.plane;
      if (travelRocketEl) travelRocketEl.textContent = d.junior.travelTime.rocket;
      if (travelLightEl) travelLightEl.textContent = d.junior.travelTime.light;
    } else {
      if (targetDescEl) targetDescEl.textContent = d.cadet.summary;
      juniorBox?.classList.add('is-hidden-box');
      cadetBox?.classList.remove('is-hidden-box');

      if (metricRadiusEl) metricRadiusEl.textContent = `${d.radiusKm.toLocaleString('ro-RO')} km`;
      if (metricGravityEl) metricGravityEl.textContent = `${d.gravityRatio} × Pământ`;
      if (metricTempEl) metricTempEl.textContent = `${d.meanTempC} °C`;
      if (metricOrbitEl) {
        metricOrbitEl.textContent =
          d.orbitPeriodDays > 0 ? `${d.orbitPeriodDays.toLocaleString('ro-RO')} zile` : 'Centru';
      }

      if (cadetStructureEl) {
        cadetStructureEl.innerHTML = d.cadet.structure
          .map(
            (layer) =>
              `<div class="structure-item"><strong>${layer.name}:</strong> ${layer.description}</div>`
          )
          .join('');
      }

      if (quizQuestionEl && quizOptionsEl && quizFeedbackEl) {
        quizQuestionEl.textContent = `Quiz Cadet: ${d.cadet.quiz.question}`;
        quizFeedbackEl.textContent = '';
        quizOptionsEl.innerHTML = '';

        d.cadet.quiz.options.forEach((optText, idx) => {
          const optBtn = document.createElement('button');
          optBtn.type = 'button';
          optBtn.className = 'quiz-opt-btn';
          optBtn.textContent = optText;
          optBtn.addEventListener('click', () => {
            const isCorrect = idx === d.cadet.quiz.correctIndex;
            optBtn.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
            quizFeedbackEl.textContent = isCorrect
              ? `✅ Corect! ${d.cadet.quiz.explanation}`
              : `❌ Mai încearcă! Indiciu: ${d.cadet.quiz.explanation}`;

            if (isCorrect) {
              try {
                const saved = JSON.parse(
                  window.localStorage.getItem(STORAGE_KEY_BADGES) || '[]'
                ) as string[];
                if (!saved.includes(d.id)) {
                  saved.push(d.id);
                  window.localStorage.setItem(STORAGE_KEY_BADGES, JSON.stringify(saved));
                }
              } catch {
                // Ignorăm eventualele restricții LocalStorage
              }
            }
          });
          quizOptionsEl.appendChild(optBtn);
        });
      }
    }
  };

  const syncTierButtons = (): void => {
    btnTierJunior?.classList.toggle('hud-btn-cyan', currentTier === 'junior');
    btnTierCadet?.classList.toggle('hud-btn-cyan', currentTier === 'cadet');
    updateSelectedBodyHud(cameraController.getTrackedBody());
  };

  btnTierJunior?.addEventListener('click', () => {
    currentTier = 'junior';
    window.localStorage.setItem(STORAGE_KEY_AGE_TIER, 'junior');
    syncTierButtons();
  });

  btnTierCadet?.addEventListener('click', () => {
    currentTier = 'cadet';
    window.localStorage.setItem(STORAGE_KEY_AGE_TIER, 'cadet');
    syncTierButtons();
  });

  const updateScaleButtonText = (): void => {
    if (!btnScaleToggle) return;
    btnScaleToggle.textContent = scaleManager.getModeLabelRo();
    btnScaleToggle.classList.toggle('hud-btn-cyan', scaleManager.getMode() === 'didactic');
    btnScaleToggle.classList.toggle('hud-btn-amber', scaleManager.getMode() === 'real');
  };
  updateScaleButtonText();

  btnScaleToggle?.addEventListener('click', () => {
    scaleManager.toggleMode();
    updateScaleButtonText();
  });

  btnTimePause?.addEventListener('click', () => {
    orbitalEngine.isPaused = !orbitalEngine.isPaused;
    btnTimePause.textContent = orbitalEngine.isPaused ? '▶' : '⏸';
    btnTimePause.classList.toggle('hud-btn-amber', orbitalEngine.isPaused);
  });

  const speedButtons = document.querySelectorAll<HTMLButtonElement>('[data-speed]');
  speedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const spd = Number(btn.dataset.speed || '86400');
      orbitalEngine.timeScale = spd;
      orbitalEngine.isPaused = false;
      if (btnTimePause) {
        btnTimePause.textContent = '⏸';
        btnTimePause.classList.remove('hud-btn-amber');
      }
      speedButtons.forEach((b) => b.classList.remove('hud-btn-active'));
      btn.classList.add('hud-btn-active');
    });
  });

  btnResetCamera?.addEventListener('click', () => {
    cameraController.resetToOverview();
  });

  cameraController.onSelect((body) => {
    updateSelectedBodyHud(body);
  });

  syncTierButtons();
  cameraController.resetToOverview();

  const tempProj = new THREE.Vector3();
  const dateFormatter = new Intl.DateTimeFormat('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  sceneManager.onUpdate((deltaSeconds) => {
    orbitalEngine.updatePositions(deltaSeconds);
    cameraController.update(deltaSeconds);

    if (simDateEl) {
      simDateEl.textContent = dateFormatter.format(orbitalEngine.simulationDate);
    }

    const tracked = cameraController.getTrackedBody();
    if (tracked && targetDistEl) {
      const distStr = tracked.distanceFromSunAu.toFixed(2).replace('.', ',');
      targetDistEl.textContent = `Distanță față de Soare: ${distStr} UA`;
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    const trackedId = tracked?.data.id;

    for (const body of orbitalEngine.getBodies()) {
      const labelEl = labelElements.get(body.data.id);
      if (!labelEl) continue;

      // Pentru sateliți/stații/rovere atașate de o planetă, afișăm eticheta când sunt în filtrul activ,
      // când sunt selectate sau când planeta-mamă este urmărită ori aproape de cameră
      if (body.data.parentId && body.data.id !== trackedId && body.data.parentId !== trackedId) {
        const distToCam = sceneManager.camera.position.distanceTo(body.worldPosition);
        if (distToCam > 55 && !matchCategoryToFilter(body.data.category, currentFilter)) {
          labelEl.style.display = 'none';
          continue;
        }
      }

      tempProj.copy(body.worldPosition);
      tempProj.y += body.visualRadius * 1.25;
      tempProj.project(sceneManager.camera);

      if (tempProj.z < -1 || tempProj.z > 1) {
        labelEl.style.display = 'none';
        continue;
      }

      const x = (tempProj.x * 0.5 + 0.5) * width;
      const y = (-tempProj.y * 0.5 + 0.5) * height;

      if (x < -80 || x > width + 80 || y < -40 || y > height + 40) {
        labelEl.style.display = 'none';
      } else {
        labelEl.style.display = 'block';
        labelEl.style.left = `${x.toFixed(1)}px`;
        labelEl.style.top = `${y.toFixed(1)}px`;
      }
    }
  });

  sceneManager.start();

  if (loadingBarFill) loadingBarFill.style.width = '100%';
  if (loadingStatus) loadingStatus.textContent = 'Gata de explorare!';
  window.setTimeout(() => {
    loadingScreen?.classList.add('is-hidden');
  }, 300);
}

bootstrapOrbitar().catch((err) => {
  console.error('Eroare la inițializarea planetariului Orbitar:', err);
});

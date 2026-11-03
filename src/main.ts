// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager';
import { ScaleManager } from './core/ScaleManager';
import { CelestialBodyInstance, OrbitalEngine } from './core/OrbitalEngine';
import { CameraController } from './core/CameraController';
import { SurfaceMarkers } from './core/SurfaceMarkers';
import { QualityManager } from './core/QualityManager';
import { PlanetMaterialFactory } from './core/PlanetMaterialFactory';
import { HeaderHud, LayerFilter, matchesLayerFilter } from './ui/HeaderHud';
import { StudyDrawer } from './ui/StudyDrawer';
import { BottomDock } from './ui/BottomDock';
import { LightSpeedRuler } from './ui/LightSpeedRuler';
import { LicenseModal } from './ui/LicenseModal';
import { OrbitarMissions } from './ui/OrbitarMissions';
import { PrintManager } from './ui/PrintManager';

interface OrbitarGlobalDebug {
  sceneManager: SceneManager;
  scaleManager: ScaleManager;
  qualityManager: QualityManager;
  orbitalEngine: OrbitalEngine;
  cameraController: CameraController;
  surfaceMarkers: SurfaceMarkers;
  headerHud: HeaderHud;
  studyDrawer: StudyDrawer;
  bottomDock: BottomDock;
  lightSpeedRuler: LightSpeedRuler;
  orbitarMissions: OrbitarMissions;
  printManager: PrintManager;
}

declare global {
  interface Window {
    __orbitar?: OrbitarGlobalDebug;
  }
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

  if (loadingBarFill) loadingBarFill.style.width = '45%';
  if (loadingStatus) {
    loadingStatus.textContent = 'Se construiește scena 3D și câmpul stelar procedural…';
  }

  // 1. Inițializarea nucleului 3D (src/core/) și a profilului de calitate (Eco vs HD)
  const qualityManager = new QualityManager();
  PlanetMaterialFactory.setQualityMode(qualityManager.getMode());

  const sceneManager = new SceneManager(canvasContainer);
  sceneManager.applyQualityProfile(qualityManager.getMode());
  const scaleManager = new ScaleManager('didactic');
  const orbitalEngine = new OrbitalEngine(sceneManager.scene, scaleManager, new Date());
  const cameraController = new CameraController(
    sceneManager.camera,
    sceneManager.controls,
    sceneManager.renderer.domElement,
    orbitalEngine,
    scaleManager
  );

  if (loadingBarFill) loadingBarFill.style.width = '80%';
  if (loadingStatus) {
    loadingStatus.textContent =
      'Se încarcă baza de date didactică, TLE-urile SGP4 și pini planetari…';
  }

  await orbitalEngine.initialize();

  // Inițializăm Markerele Planetare (Marte & Lună)
  const surfaceMarkers = new SurfaceMarkers(orbitalEngine, labelsContainer);

  // 2. Crearea etichetelor 2D și a pastilelor din Dock-ul Inferior
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

  // 3. Inițializarea modulelor UI Bento Dark Mode (src/ui/)
  let activeLayerFilter: LayerFilter = 'all';

  const applyLayerFilter = (filter: LayerFilter): void => {
    activeLayerFilter = filter;
    orbitalEngine.setCategoryVisibility((cat) => matchesLayerFilter(cat, filter));

    for (const body of orbitalEngine.getBodies()) {
      const pill = pillElements.get(body.data.id);
      if (pill) {
        const visible = matchesLayerFilter(body.data.category, filter);
        pill.style.display = visible ? 'inline-flex' : 'none';
      }
    }
  };

  const orbitarMissions = new OrbitarMissions(orbitalEngine, (bodyId) => {
    cameraController.focusBody(bodyId);
  });

  const studyDrawer = new StudyDrawer(
    orbitalEngine,
    'junior',
    () => {
      cameraController.resetToOverview();
    },
    (unlockedBodyId) => {
      orbitarMissions.unlockBadge(unlockedBodyId);
    }
  );

  const headerHud = new HeaderHud(orbitalEngine.getBodies(), {
    onSelectBody: (bodyId) => {
      cameraController.focusBody(bodyId);
    },
    onFilterChange: (filter) => {
      applyLayerFilter(filter);
    },
    onTierChange: (tier) => {
      studyDrawer.setTier(tier);
    },
  });

  studyDrawer.setTier(headerHud.getTier());

  const bottomDock = new BottomDock(orbitalEngine, scaleManager);
  const lightSpeedRuler = new LightSpeedRuler(sceneManager.scene, orbitalEngine);
  const printManager = new PrintManager(
    orbitalEngine,
    () => headerHud.getTier(),
    () => orbitarMissions.getUnlockedBadges()
  );
  new LicenseModal();

  orbitarMissions.setOnGenerateDiploma(() => {
    orbitarMissions.setOpen(false);
    printManager.openDiplomaBuilder(true);
  });

  studyDrawer.setPrintHandlers({
    onPrintStudy: (bodyId) => {
      printManager.printStudySheet(bodyId);
    },
    onPrintColoring: (bodyId) => {
      printManager.printColoringSheet(bodyId);
    },
    onSyncPrintPreview: (bodyId) => {
      printManager.populateStudySheet(bodyId);
    },
  });

  // Caseta de detalii pentru Markerele Planetare (Marte & Lună)
  const markerCardEl = document.getElementById('hud-surface-marker-card');
  const markerTitleEl = document.getElementById('marker-card-title');
  const markerRegionEl = document.getElementById('marker-card-region');
  const markerDescEl = document.getElementById('marker-card-desc');
  const btnMarkerClose = document.getElementById('btn-marker-card-close');

  btnMarkerClose?.addEventListener('click', () => {
    markerCardEl?.classList.add('is-hidden');
  });

  surfaceMarkers.onSelectMarker((marker) => {
    if (markerTitleEl) markerTitleEl.textContent = `📍 ${marker.titleRo}`;
    if (markerRegionEl) {
      markerRegionEl.textContent = `${marker.regionRo} • Anul ${marker.year}`;
    }
    if (markerDescEl) markerDescEl.textContent = marker.descriptionRo;
    markerCardEl?.classList.remove('is-hidden');

    if (marker.linkedBodyId) {
      const linkedBody = orbitalEngine.getBody(marker.linkedBodyId);
      if (linkedBody) {
        studyDrawer.showBody(linkedBody);
      }
    }
  });

  // 4. Conectarea selecției corpului ceresc cu Panoul de Studiu, Rigla și Misiunile Orbitar
  const handleBodySelection = (body: CelestialBodyInstance | null): void => {
    const selected = body ?? orbitalEngine.getBody('sun') ?? null;
    const activeId = selected?.data.id ?? 'sun';

    for (const [id, pill] of pillElements.entries()) {
      pill.classList.toggle('is-active', id === activeId);
    }
    for (const [id, lbl] of labelElements.entries()) {
      lbl.classList.toggle('is-selected', id === activeId);
    }

    if (selected) {
      studyDrawer.showBody(selected);
      lightSpeedRuler.handleBodySelectedInScene(selected);
      orbitarMissions.handleBodySelectedIn3D(selected);
    }
  };

  cameraController.onSelect((body) => {
    handleBodySelection(body);
  });

  cameraController.resetToOverview();

  // Comutator Grafică: Rapidă (Eco) <-> Realistă HD + Watchdog FPS
  const btnQualityToggle = document.getElementById('btn-quality-toggle');
  const qualityToastEl = document.getElementById('hud-quality-toast');
  let toastTimeoutId: number | null = null;

  const showQualityToast = (messageRo: string): void => {
    if (!qualityToastEl) return;
    qualityToastEl.textContent = messageRo;
    qualityToastEl.classList.remove('is-hidden');
    if (toastTimeoutId !== null) {
      window.clearTimeout(toastTimeoutId);
    }
    toastTimeoutId = window.setTimeout(() => {
      qualityToastEl.classList.add('is-hidden');
    }, 4500);
  };

  const syncQualityButtonUI = (): void => {
    if (!btnQualityToggle) return;
    const profile = qualityManager.getProfile();
    btnQualityToggle.textContent = profile.buttonTextRo;
    btnQualityToggle.title = profile.tooltipRo;
    btnQualityToggle.classList.toggle('hud-btn-active-cyan', profile.mode === 'hd');
    btnQualityToggle.classList.toggle('hud-btn-active-amber', profile.mode === 'eco');
  };

  syncQualityButtonUI();

  btnQualityToggle?.addEventListener('click', () => {
    qualityManager.toggleMode();
  });

  qualityManager.onChange((newMode, isAutoFallback) => {
    sceneManager.applyQualityProfile(newMode);
    orbitalEngine.applyQualityMode(newMode);
    syncQualityButtonUI();
    if (isAutoFallback) {
      showQualityToast('Am activat Modul Rapid pentru ca Orbitar să se miște lin pe dispozitivul tău!');
    }
  });

  window.__orbitar = {
    sceneManager,
    scaleManager,
    qualityManager,
    orbitalEngine,
    cameraController,
    surfaceMarkers,
    headerHud,
    studyDrawer,
    bottomDock,
    lightSpeedRuler,
    orbitarMissions,
    printManager,
  };

  // 5. Bucla de actualizare per cadru
  const tempProj = new THREE.Vector3();

  sceneManager.onUpdate((deltaSeconds) => {
    qualityManager.recordFrame(deltaSeconds);
    orbitalEngine.updatePositions(deltaSeconds);
    cameraController.update(deltaSeconds);
    lightSpeedRuler.update(deltaSeconds);
    bottomDock.updateDateReadout();

    const tracked = cameraController.getTrackedBody();
    studyDrawer.updateLiveDistance(tracked);
    surfaceMarkers.update(sceneManager.camera, tracked);

    const width = window.innerWidth;
    const height = window.innerHeight;
    const trackedId = tracked?.data.id;

    for (const body of orbitalEngine.getBodies()) {
      const labelEl = labelElements.get(body.data.id);
      if (!labelEl) continue;

      if (!body.rootGroup.visible) {
        labelEl.style.display = 'none';
        continue;
      }

      if (body.data.parentId && body.data.id !== trackedId && body.data.parentId !== trackedId) {
        const distToCam = sceneManager.camera.position.distanceTo(body.worldPosition);
        if (distToCam > 55 && activeLayerFilter === 'all') {
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

// Înregistrăm Service Worker-ul pentru funcționare 100% offline și instalare PWA pe tablete/laptopuri
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      // Ignorăm eventualele restricții în mediul de dev local
    });
  });
}

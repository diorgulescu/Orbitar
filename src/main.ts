// SPDX-License-Identifier: GPL-3.0-or-later
import { SceneManager } from './core/SceneManager';
import { ScaleManager } from './core/ScaleManager';
import { CelestialBodyInstance, OrbitalEngine } from './core/OrbitalEngine';
import { CameraController } from './core/CameraController';
import { SurfaceMarkers } from './core/SurfaceMarkers';
import { QualityManager } from './core/QualityManager';
import { PlanetMaterialFactory } from './core/PlanetMaterialFactory';
import { SpaceAmbientEngine } from './audio/SpaceAmbientEngine';
import { UiSoundEngine } from './audio/UiSoundEngine';
import { HeaderHud, LayerFilter, matchesLayerFilter } from './ui/HeaderHud';
import { StudyDrawer } from './ui/StudyDrawer';
import { BottomDock } from './ui/BottomDock';
import { LightSpeedRuler } from './ui/LightSpeedRuler';
import { LicenseModal } from './ui/LicenseModal';
import { OrbitarMissions } from './ui/OrbitarMissions';
import { PrintManager } from './ui/PrintManager';
import { SpacecraftPilot } from './game/SpacecraftPilot';
import { CockpitHUD } from './ui/CockpitHUD';
import { CosmicScaleNavigator } from './core/CosmicScaleNavigator';
import { LabelProjector } from './ui/LabelProjector';
import { ToolbarControls } from './ui/ToolbarControls';
import { OnboardingTutorial } from './ui/OnboardingTutorial';
import { getBuiltAppVersion } from './utils/UpdateChecker';

interface OrbitarGlobalDebug {
  sceneManager: SceneManager;
  scaleManager: ScaleManager;
  qualityManager: QualityManager;
  ambientEngine: SpaceAmbientEngine;
  uiSoundEngine: UiSoundEngine;
  orbitalEngine: OrbitalEngine;
  cameraController: CameraController;
  cosmicNavigator: CosmicScaleNavigator;
  surfaceMarkers: SurfaceMarkers;
  headerHud: HeaderHud;
  studyDrawer: StudyDrawer;
  bottomDock: BottomDock;
  lightSpeedRuler: LightSpeedRuler;
  orbitarMissions: OrbitarMissions;
  printManager: PrintManager;
  spacecraftPilot: SpacecraftPilot;
  cockpitHud: CockpitHUD;
  toolbar: ToolbarControls;
  labelProjector: LabelProjector;
  onboardingTutorial: OnboardingTutorial;
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
  const ambientEngine = SpaceAmbientEngine.getInstance();
  const uiSoundEngine = UiSoundEngine.getInstance();
  uiSoundEngine.installGlobalUiListeners(document);
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

  // Inițializăm Navigatorul celor 3 Orizonturi Cosmice (Sistemul Solar <-> Stele & Exoplanete <-> Calea Lactee & Galaxii)
  const cosmicNavigator = new CosmicScaleNavigator(
    orbitalEngine,
    sceneManager.camera,
    cameraController,
    labelsContainer
  );

  // 2. Crearea etichetelor 2D și a pastilelor din Dock-ul Inferior pentru toate cele 3 Orizonturi Cosmice
  const labelElements = new Map<string, HTMLButtonElement>();
  const pillElements = new Map<string, HTMLButtonElement>();
  const bodiesListEl = document.getElementById('hud-bodies-list');

  const focusBodyAcrossHorizons = (bodyId: string): void => {
    const body = orbitalEngine.getBody(bodyId);
    if (!body) return;
    const targetHorizon = body.data.horizon ?? 'solar';
    if (cosmicNavigator.getHorizon() !== targetHorizon) {
      cosmicNavigator.setHorizon(targetHorizon, { targetBodyId: bodyId });
      return;
    }
    cameraController.focusBody(bodyId);
  };

  for (const body of orbitalEngine.getAllBodies()) {
    const labelBtn = document.createElement('button');
    labelBtn.type = 'button';
    labelBtn.className = 'celestial-label';
    labelBtn.dataset.bodyId = body.data.id;
    labelBtn.dataset.horizon = body.data.horizon ?? 'solar';
    labelBtn.innerHTML = `<span class="label-dot" style="background:${body.data.color}"></span>${body.data.name}`;
    labelBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      focusBodyAcrossHorizons(body.data.id);
    });
    labelsContainer.appendChild(labelBtn);
    labelElements.set(body.data.id, labelBtn);

    if (bodiesListEl) {
      const pillBtn = document.createElement('button');
      pillBtn.type = 'button';
      pillBtn.className = 'body-pill';
      pillBtn.dataset.bodyId = body.data.id;
      pillBtn.dataset.horizon = body.data.horizon ?? 'solar';
      pillBtn.innerHTML = `<span class="body-pill-dot" style="background:${body.data.color}"></span>${body.data.name}`;
      pillBtn.addEventListener('click', () => {
        focusBodyAcrossHorizons(body.data.id);
      });
      bodiesListEl.appendChild(pillBtn);
      pillElements.set(body.data.id, pillBtn);
    }
  }

  // 3. Inițializarea modulelor UI Bento Dark Mode (src/ui/)
  let activeLayerFilter: LayerFilter = 'all';

  const applyLayerFilter = (filter: LayerFilter): void => {
    activeLayerFilter = filter;
    const activeHorizon = orbitalEngine.getActiveHorizon();
    orbitalEngine.setCategoryVisibility((cat) => matchesLayerFilter(cat, filter));

    for (const body of orbitalEngine.getAllBodies()) {
      const pill = pillElements.get(body.data.id);
      const bodyHorizon = body.data.horizon ?? 'solar';
      if (pill) {
        const visible =
          bodyHorizon === activeHorizon &&
          matchesLayerFilter(body.data.category, filter);
        pill.style.display = visible ? 'inline-flex' : 'none';
      }
    }
  };

  applyLayerFilter('all');

  // Proiecția etichetelor 2D este centralizată în LabelProjector: doar `transform` (fără layout),
  // iar vizibilitatea pe orizont este evaluată aici, în bucla de randare, ca unică sursă de adevăr.
  const labelProjector = new LabelProjector({
    labels: labelElements,
    getBodies: () => orbitalEngine.getAllBodies(),
    getActiveHorizon: () => orbitalEngine.getActiveHorizon(),
    getTrackedId: () => cameraController.getTrackedBody()?.data.id,
    getLayerFilter: () => activeLayerFilter,
  });

  const orbitarMissions = new OrbitarMissions(orbitalEngine, (bodyId) => {
    focusBodyAcrossHorizons(bodyId);
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

  const headerHud = new HeaderHud(orbitalEngine.getAllBodies(), {
    onSelectBody: (bodyId) => {
      if (spacecraftPilot.isActive()) {
        const body = orbitalEngine.getBody(bodyId);
        const targetHorizon = body?.data.horizon ?? 'solar';
        if (cosmicNavigator.getHorizon() !== targetHorizon) {
          cosmicNavigator.setHorizon(targetHorizon, { skipAutoFocus: true });
          applyLayerFilter(activeLayerFilter);
          cockpitHud.refreshForHorizon();
        }
        cockpitHud.handleFlyToTarget(bodyId);
      } else {
        focusBodyAcrossHorizons(bodyId);
      }
    },
    onFilterChange: (filter) => {
      applyLayerFilter(filter);
    },
    onTierChange: (tier) => {
      studyDrawer.setTier(tier);
      cameraController.setAgeTier(tier, true);
    },
  });

  studyDrawer.setTier(headerHud.getTier());
  cameraController.setAgeTier(headerHud.getTier(), false);

  const bottomDock = new BottomDock(orbitalEngine, scaleManager);
  const lightSpeedRuler = new LightSpeedRuler(sceneManager.scene, orbitalEngine);
  const printManager = new PrintManager(
    orbitalEngine,
    () => headerHud.getTier(),
    () => orbitarMissions.getUnlockedBadges()
  );
  new LicenseModal();
  const onboardingTutorial = new OnboardingTutorial(true);

  // Mini-jocul educativ la persoana întâi: "🚀 La Manșa Navei (Mod Pilot)"
  const spacecraftPilot = new SpacecraftPilot(
    sceneManager.scene,
    sceneManager.camera,
    orbitalEngine,
    scaleManager,
    cameraController
  );

  // Bara de controale din antet: calitate Eco/HD, fullscreen F11, muzică ambientală, Mod Pilot,
  // toast-uri și scurtăturile de tastatură (Q / F11 / P / M) — extrase în src/ui/ToolbarControls.ts
  const toolbar = new ToolbarControls({
    qualityManager,
    ambientEngine,
    spacecraftPilot,
    studyDrawer,
  });

  const cockpitHud = new CockpitHUD(
    sceneManager.camera,
    orbitalEngine,
    spacecraftPilot,
    {
      onOpenStudySheet: (body) => {
        studyDrawer.showBody(body);
      },
      onExitPilotMode: () => {
        toolbar.syncPilotToggleUI(false);
      },
    }
  );

  orbitarMissions.setOnGenerateDiploma(() => {
    orbitarMissions.setOpen(false);
    printManager.openDiplomaBuilder(true);
  });

  cosmicNavigator.onChange((newHorizon) => {
    applyLayerFilter(activeLayerFilter);
    if (newHorizon !== 'solar') {
      spacecraftPilot.selectShip('luceafarul');
    }
    if (spacecraftPilot.isActive()) {
      studyDrawer.stopSpeech();
      document.getElementById('hud-study-drawer')?.classList.add('is-collapsed');
    }
    cockpitHud.refreshForHorizon();
    const horizonToast =
      newHorizon === 'interstellar'
        ? '✨ Orizont Interstelar activat: Stele Vecine & Exoplanete (Scară în Ani-Lumină)'
        : newHorizon === 'galactic'
        ? '🌀 Orizont Galactic activat: Calea Lactee, Nebuloase & Galaxia Andromeda'
        : '☀️ Orizont Sistemul Solar activat (Acasă)';
    toolbar.showToast(horizonToast);
  });

  studyDrawer.setPrintHandlers({
    onPrintStudy: (bodyId) => {
      printManager.openModalForBody(bodyId, 'study');
      printManager.printStudySheet(bodyId);
    },
    onPrintColoring: (bodyId) => {
      printManager.openModalForBody(bodyId, 'coloring');
      printManager.printColoringSheet(bodyId);
    },
    onSyncPrintPreview: (bodyId) => {
      printManager.populateStudySheet(bodyId);
    },
  });

  // Caseta de detalii pentru Markerele Planetare și Rovere (Marte & Lună)
  const markerCardEl = document.getElementById('hud-surface-marker-card');
  const markerTitleEl = document.getElementById('marker-card-title');
  const markerRegionEl = document.getElementById('marker-card-region');
  const markerDescEl = document.getElementById('marker-card-desc');
  const markerMediaEl = document.getElementById('marker-card-media');
  const markerImgEl = document.getElementById('marker-card-img') as HTMLImageElement | null;
  const markerCaptionEl = document.getElementById('marker-card-img-caption');
  const btnMarkerClose = document.getElementById('btn-marker-card-close');

  const showSurfaceMarkerCard = (marker: ReturnType<SurfaceMarkers['getMarkers']>[number]): void => {
    const icon = marker.icon ?? '📍';
    if (markerTitleEl) markerTitleEl.textContent = `${icon} ${marker.titleRo}`;
    if (markerRegionEl) {
      markerRegionEl.textContent = `${marker.regionRo} • Anul ${marker.year}`;
    }
    if (markerDescEl) markerDescEl.textContent = marker.descriptionRo;

    if (markerMediaEl && markerImgEl && markerCaptionEl) {
      if (marker.imageUrl) {
        markerImgEl.src = marker.imageUrl;
        markerImgEl.alt = `${marker.titleRo} — Fotografie NASA`;
        markerCaptionEl.textContent = marker.imageCaptionRo ?? '';
        markerMediaEl.classList.remove('is-hidden');
      } else {
        markerMediaEl.classList.add('is-hidden');
      }
    }
    markerCardEl?.classList.remove('is-hidden');
  };

  btnMarkerClose?.addEventListener('click', () => {
    markerCardEl?.classList.add('is-hidden');
  });

  surfaceMarkers.onSelectMarker((marker) => {
    showSurfaceMarkerCard(marker);

    if (marker.linkedBodyId) {
      cameraController.focusBody(marker.linkedBodyId);
    }
  });

  // 4. Conectarea selecției corpului ceresc cu Panoul de Studiu, Rigla și Misiunile Orbitar
  const handleBodySelection = (body: CelestialBodyInstance | null): void => {
    const selected = body ?? orbitalEngine.getBody('sun') ?? null;
    const activeId = selected?.data.id ?? 'sun';

    for (const [id, pill] of pillElements.entries()) {
      const isActive = id === activeId;
      pill.classList.toggle('is-active', isActive);
      if (isActive && bodiesListEl && pill.style.display !== 'none') {
        const targetScrollLeft =
          pill.offsetLeft - bodiesListEl.clientWidth * 0.38 + pill.offsetWidth * 0.5;
        bodiesListEl.scrollTo({
          left: Math.max(0, targetScrollLeft),
          behavior: 'smooth',
        });
      }
    }
    for (const [id, lbl] of labelElements.entries()) {
      lbl.classList.toggle('is-selected', id === activeId);
    }

    if (selected) {
      if (!spacecraftPilot.isActive()) {
        studyDrawer.showBody(selected);
      }
      lightSpeedRuler.handleBodySelectedInScene(selected);
      orbitarMissions.handleBodySelectedIn3D(selected);

      if (selected.data.category === 'rover') {
        const linkedMarker = surfaceMarkers.getMarkerByLinkedBodyId(selected.data.id);
        if (linkedMarker) {
          showSurfaceMarkerCard(linkedMarker);
        }
      }
    }
  };

  cameraController.onSelect((body) => {
    handleBodySelection(body);
  });

  cameraController.resetToOverview(true);

  // La schimbarea modului grafic, doar re-aplicăm profilul pe scenă și pe corpuri;
  // butonul și toast-urile sunt gestionate de ToolbarControls (înregistrat mai sus).
  qualityManager.onChange((newMode) => {
    sceneManager.applyQualityProfile(newMode);
    orbitalEngine.applyQualityMode(newMode);
  });

  // Ajustare dinamică a variabilelor CSS --hud-header-offset și --hud-bottom-offset în funcție de înălțimea reală a barelor HUD
  // (aplicăm scrieri pe :root DOAR când valorile în pixeli se modifică efectiv, evitând recalcularea stilurilor în tot arborele DOM)
  const hudHeaderEl = document.querySelector('.hud-header') as HTMLElement | null;
  const hudBottomDockEl = document.getElementById('hud-bottom-dock');
  let lastHeaderOffsetPx = -1;
  let lastBottomOffsetPx = -1;
  const syncHeaderOffsetCssVar = (): void => {
    if (hudHeaderEl) {
      const rect = hudHeaderEl.getBoundingClientRect();
      if (rect.height > 0) {
        const offsetPx = Math.max(72, Math.ceil(rect.bottom + 10));
        if (offsetPx !== lastHeaderOffsetPx) {
          lastHeaderOffsetPx = offsetPx;
          document.documentElement.style.setProperty('--hud-header-offset', `${offsetPx}px`);
        }
      }
    }
    if (hudBottomDockEl) {
      const dockRect = hudBottomDockEl.getBoundingClientRect();
      if (dockRect.height > 0) {
        const bottomOffsetPx = Math.max(118, Math.ceil(window.innerHeight - dockRect.top + 10));
        if (bottomOffsetPx !== lastBottomOffsetPx) {
          lastBottomOffsetPx = bottomOffsetPx;
          document.documentElement.style.setProperty('--hud-bottom-offset', `${bottomOffsetPx}px`);
        }
      }
    }
  };
  syncHeaderOffsetCssVar();
  window.addEventListener('resize', syncHeaderOffsetCssVar);

  window.__orbitar = {
    sceneManager,
    scaleManager,
    qualityManager,
    ambientEngine,
    uiSoundEngine,
    orbitalEngine,
    cameraController,
    cosmicNavigator,
    surfaceMarkers,
    headerHud,
    studyDrawer,
    bottomDock,
    lightSpeedRuler,
    orbitarMissions,
    printManager,
    spacecraftPilot,
    cockpitHud,
    toolbar,
    labelProjector,
    onboardingTutorial,
  };

  // 5. Bucla de actualizare per cadru
  let elapsedCosmicSeconds = 0;

  sceneManager.onUpdate((deltaSeconds) => {
    elapsedCosmicSeconds += deltaSeconds;
    qualityManager.recordFrame(deltaSeconds);
    orbitalEngine.updatePositions(deltaSeconds);

    if (spacecraftPilot.isActive()) {
      spacecraftPilot.update(deltaSeconds);
      cockpitHud.update();
      return;
    }

    cameraController.update(deltaSeconds);
    cosmicNavigator.update(deltaSeconds, elapsedCosmicSeconds);
    lightSpeedRuler.update(deltaSeconds);
    bottomDock.updateDateReadout();

    const tracked = cameraController.getTrackedBody();
    studyDrawer.updateLiveDistance(tracked);
    surfaceMarkers.update(sceneManager.camera, tracked);

    // Proiecția etichetelor 2D (doar `transform`, fără layout) — vezi src/ui/LabelProjector.ts
    labelProjector.update(sceneManager.camera);
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
  // Afișăm eroarea în ecranul de încărcare în loc să lăsăm bara blocată — altfel utilizatorul nu înțelege ce s-a întâmplat
  const statusEl = document.getElementById('loading-status');
  if (statusEl) {
    statusEl.textContent =
      'A apărut o eroare la încărcarea planetariului. Reîncărcați pagina (Ctrl+R / Cmd+R) — dacă problema persistă, verificați conexiunea la internet.';
    statusEl.classList.add('is-error');
  }
  document.getElementById('loading-bar-fill')?.classList.add('is-error');
});

// Înregistrăm Service Worker-ul în producție; în dev local (localhost/127.0.0.1) dezactivăm SW-urile vechi
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    const host = window.location.hostname;
    const isLocalOrTauri =
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === 'tauri.localhost' ||
      window.location.protocol === 'tauri:' ||
      '__TAURI_INTERNALS__' in window;
    if (isLocalOrTauri) {
      navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => {
          reg.unregister().catch(() => {});
        });
      });
      if ('caches' in window) {
        caches.keys().then((keys) => {
          keys.forEach((key) => {
            caches.delete(key);
          });
        });
      }
      return;
    }

    navigator.serviceWorker
      .register(`./sw.js?v=${getBuiltAppVersion()}`, { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Ignorăm eventualele restricții în mediul de dev local
      });
  });
}

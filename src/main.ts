// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import { SceneManager } from './core/SceneManager';
import { ScaleManager } from './core/ScaleManager';
import { CelestialBodyInstance, OrbitalEngine } from './core/OrbitalEngine';
import { CameraController } from './core/CameraController';
import { SurfaceMarkers } from './core/SurfaceMarkers';
import { QualityManager } from './core/QualityManager';
import { PlanetMaterialFactory } from './core/PlanetMaterialFactory';
import { SpaceAmbientEngine } from './audio/SpaceAmbientEngine';
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
  ambientEngine: SpaceAmbientEngine;
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
      pill.classList.toggle('is-active', id === activeId);
    }
    for (const [id, lbl] of labelElements.entries()) {
      lbl.classList.toggle('is-selected', id === activeId);
    }

    if (selected) {
      studyDrawer.showBody(selected);
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

  cameraController.resetToOverview();

  // Comutator Grafică (#orbitar-quality-toggle): Rapidă (Eco) <-> Realistă HD + Tasta Q + Watchdog FPS
  let btnQualityToggle = document.getElementById('orbitar-quality-toggle') as HTMLButtonElement | null;
  if (!btnQualityToggle) {
    btnQualityToggle = document.createElement('button');
    btnQualityToggle.id = 'orbitar-quality-toggle';
    btnQualityToggle.type = 'button';
    btnQualityToggle.className = 'hud-btn quality-pill-switch';
    const btnCadet = document.getElementById('btn-tier-cadet');
    const tierContainer = document.querySelector('.header-tier-switch') ?? document.querySelector('.hud-header');
    if (btnCadet && btnCadet.parentElement) {
      btnCadet.insertAdjacentElement('afterend', btnQualityToggle);
    } else if (tierContainer) {
      tierContainer.appendChild(btnQualityToggle);
    } else {
      document.body.appendChild(btnQualityToggle);
    }
  }

  let qualityToastEl = document.getElementById('hud-quality-toast');
  if (!qualityToastEl) {
    qualityToastEl = document.createElement('div');
    qualityToastEl.id = 'hud-quality-toast';
    qualityToastEl.className = 'bento-card quality-toast is-hidden';
    qualityToastEl.setAttribute('role', 'status');
    qualityToastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(qualityToastEl);
  }

  let toastTimeoutId: number | null = null;

  const showQualityToast = (messageRo: string): void => {
    if (!qualityToastEl) return;
    qualityToastEl.textContent = messageRo;
    qualityToastEl.classList.remove('is-hidden');
    if (toastTimeoutId !== null) {
      window.clearTimeout(toastTimeoutId);
    }
    toastTimeoutId = window.setTimeout(() => {
      qualityToastEl?.classList.add('is-hidden');
    }, 3600);
  };

  const syncQualityButtonUI = (): void => {
    if (!btnQualityToggle) return;
    const profile = qualityManager.getProfile();
    btnQualityToggle.textContent =
      profile.mode === 'eco' ? '⚡ Grafică: Rapidă (Eco)' : '✨ Grafică: Realistă HD';
    btnQualityToggle.title = `${profile.tooltipRo} (Scurtătură: Tasta Q)`;
    btnQualityToggle.dataset.qualityMode = profile.mode;
    btnQualityToggle.classList.toggle('is-eco', profile.mode === 'eco');
    btnQualityToggle.classList.toggle('is-hd', profile.mode === 'hd');
  };

  syncQualityButtonUI();

  btnQualityToggle.addEventListener('click', () => {
    qualityManager.toggleMode();
  });

  // Buton Ecran Complet (#orbitar-fullscreen-toggle — ⛶ F11) pentru proiecția la clasă / Tauri Desktop
  let btnFullscreenToggle = document.getElementById(
    'orbitar-fullscreen-toggle'
  ) as HTMLButtonElement | null;
  if (!btnFullscreenToggle) {
    btnFullscreenToggle = document.createElement('button');
    btnFullscreenToggle.id = 'orbitar-fullscreen-toggle';
    btnFullscreenToggle.type = 'button';
    btnFullscreenToggle.className = 'hud-btn fullscreen-pill-btn';
    btnFullscreenToggle.setAttribute('aria-pressed', 'false');
    btnFullscreenToggle.title =
      'Mod Proiecție la Clasă pe tot ecranul pentru videoproiector sau tablă interactivă (Tasta F11)';
    btnFullscreenToggle.textContent = '⛶ F11';
    btnQualityToggle.insertAdjacentElement('afterend', btnFullscreenToggle);
  }

  let isTauriFullscreen = false;

  const syncFullscreenUI = (active: boolean): void => {
    if (!btnFullscreenToggle) return;
    btnFullscreenToggle.classList.toggle('is-fullscreen', active);
    btnFullscreenToggle.setAttribute('aria-pressed', active ? 'true' : 'false');
    btnFullscreenToggle.textContent = active ? '🗗 Ieșire F11' : '⛶ F11';
  };

  const toggleOrbitarFullscreen = async (): Promise<void> => {
    const tauriWindow = window as unknown as {
      __TAURI_INTERNALS__?: { invoke?: (cmd: string) => Promise<boolean> };
      __TAURI__?: { core?: { invoke?: (cmd: string) => Promise<boolean> } };
    };
    const tauriInvoke =
      tauriWindow.__TAURI_INTERNALS__?.invoke ?? tauriWindow.__TAURI__?.core?.invoke;

    if (typeof tauriInvoke === 'function') {
      try {
        isTauriFullscreen = await tauriInvoke('toggle_fullscreen');
        syncFullscreenUI(isTauriFullscreen);
        showQualityToast(
          isTauriFullscreen
            ? '🖥️ Mod Proiecție la Clasă: Ecran Complet Activat (F11)'
            : '🗗 Mod Fereastră Normală (F11)'
        );
        return;
      } catch (_e) {
        // Fallback la API-ul Fullscreen standard din browser
      }
    }

    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        syncFullscreenUI(true);
        showQualityToast('🖥️ Mod Proiecție la Clasă: Ecran Complet Activat (F11)');
      } else {
        await document.exitFullscreen();
        syncFullscreenUI(false);
        showQualityToast('🗗 Mod Fereastră Normală (F11)');
      }
    } catch (_e) {
      // Unele medii restricționează requestFullscreen
    }
  };

  btnFullscreenToggle.addEventListener('click', () => {
    toggleOrbitarFullscreen();
  });

  document.addEventListener('fullscreenchange', () => {
    syncFullscreenUI(Boolean(document.fullscreenElement));
  });

  // Modulul de Muzică Ambientală Generativă (#orbitar-audio-controls) + Tasta M
  const ambientEngine = SpaceAmbientEngine.getInstance();
  let audioControlsEl = document.getElementById('orbitar-audio-controls');
  if (!audioControlsEl) {
    audioControlsEl = document.createElement('div');
    audioControlsEl.id = 'orbitar-audio-controls';
    audioControlsEl.className = 'ambient-audio-controls';
    audioControlsEl.innerHTML = `
      <button id="orbitar-audio-toggle" type="button" class="hud-btn ambient-toggle-btn is-off" aria-pressed="false">
        <span class="ambient-wave" aria-hidden="true"><i></i><i></i><i></i></span>
        <span id="orbitar-audio-label">🔇 Ambiental: Oprit</span>
      </button>
      <input id="orbitar-audio-volume" class="ambient-volume-slider" type="range" min="0" max="100" step="1" value="35" aria-label="Volum muzică ambientală" />
      <span id="orbitar-audio-volume-label" class="ambient-volume-readout">35%</span>
    `;
    btnQualityToggle.insertAdjacentElement('afterend', audioControlsEl);
  }

  const btnAudioToggle = document.getElementById('orbitar-audio-toggle') as HTMLButtonElement | null;
  const audioLabelEl = document.getElementById('orbitar-audio-label');
  const audioVolumeSlider = document.getElementById('orbitar-audio-volume') as HTMLInputElement | null;
  const audioVolumeLabel = document.getElementById('orbitar-audio-volume-label');

  const syncAmbientAudioUI = (): void => {
    const enabled = ambientEngine.isEnabled();
    const vol = ambientEngine.getVolumePercent();
    if (btnAudioToggle) {
      btnAudioToggle.classList.toggle('is-on', enabled);
      btnAudioToggle.classList.toggle('is-off', !enabled);
      btnAudioToggle.setAttribute('aria-pressed', enabled ? 'true' : 'false');
    }
    if (audioLabelEl) {
      audioLabelEl.textContent = enabled ? '🎵 Ambiental: Pornit' : '🔇 Ambiental: Oprit';
    }
    if (audioVolumeSlider && document.activeElement !== audioVolumeSlider) {
      audioVolumeSlider.value = String(vol);
      audioVolumeSlider.title = `Volum muzică ambientală: ${vol}%`;
    }
    if (audioVolumeLabel) {
      audioVolumeLabel.textContent = `${vol}%`;
    }
  };

  syncAmbientAudioUI();
  ambientEngine.onChange(() => {
    syncAmbientAudioUI();
  });

  btnAudioToggle?.addEventListener('click', () => {
    const nowEnabled = ambientEngine.toggle();
    showQualityToast(
      nowEnabled
        ? `🎵 Muzică ambientală cosmică: Pornită (${ambientEngine.getVolumePercent()}%)`
        : '🔇 Muzică ambientală cosmică: Oprită'
    );
  });

  audioVolumeSlider?.addEventListener('input', () => {
    const val = Number(audioVolumeSlider.value);
    ambientEngine.setVolumePercent(val);
    if (audioVolumeLabel) {
      audioVolumeLabel.textContent = `${ambientEngine.getVolumePercent()}%`;
    }
  });

  // Scurtături de tastatură: Tasta Q (Quality) și Tasta M (Mute / Unmute Muzică Ambientală)
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const target = e.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable)
    ) {
      return;
    }
    if (e.key === 'F11' || e.code === 'F11') {
      e.preventDefault();
      toggleOrbitarFullscreen();
      return;
    }
    if (e.key === 'q' || e.key === 'Q' || e.code === 'KeyQ') {
      e.preventDefault();
      qualityManager.toggleMode();
    } else if (e.key === 'm' || e.key === 'M' || e.code === 'KeyM') {
      e.preventDefault();
      const nowEnabled = ambientEngine.toggle();
      showQualityToast(
        nowEnabled
          ? `🎵 Muzică ambientală cosmică: Pornită (${ambientEngine.getVolumePercent()}%)`
          : '🔇 Muzică ambientală cosmică: Oprită'
      );
    }
  });

  qualityManager.onChange((newMode, isAutoFallback) => {
    sceneManager.applyQualityProfile(newMode);
    orbitalEngine.applyQualityMode(newMode);
    syncQualityButtonUI();
    if (isAutoFallback) {
      showQualityToast('Am activat Modul Rapid pentru ca Orbitar să se miște lin pe dispozitivul tău!');
    } else if (newMode === 'eco') {
      showQualityToast('Mod Grafic activat: Rapid (Eco)');
    } else {
      showQualityToast('Mod Grafic activat: Realist HD (Texturi 2K)');
    }
  });

  // Ajustare dinamică a variabilelor CSS --hud-header-offset și --hud-bottom-offset în funcție de înălțimea reală a barelor HUD
  const hudHeaderEl = document.querySelector('.hud-header') as HTMLElement | null;
  const hudBottomDockEl = document.getElementById('hud-bottom-dock');
  const syncHeaderOffsetCssVar = (): void => {
    if (hudHeaderEl) {
      const rect = hudHeaderEl.getBoundingClientRect();
      if (rect.height > 0) {
        const offsetPx = Math.max(72, Math.ceil(rect.bottom + 10));
        document.documentElement.style.setProperty('--hud-header-offset', `${offsetPx}px`);
      }
    }
    if (hudBottomDockEl) {
      const dockRect = hudBottomDockEl.getBoundingClientRect();
      if (dockRect.height > 0) {
        const bottomOffsetPx = Math.max(118, Math.ceil(window.innerHeight - dockRect.top + 10));
        document.documentElement.style.setProperty('--hud-bottom-offset', `${bottomOffsetPx}px`);
      }
    }
  };
  syncHeaderOffsetCssVar();
  window.addEventListener('resize', syncHeaderOffsetCssVar);
  if ('ResizeObserver' in window) {
    const hudRo = new ResizeObserver(() => {
      syncHeaderOffsetCssVar();
    });
    if (hudHeaderEl) hudRo.observe(hudHeaderEl);
    if (hudBottomDockEl) hudRo.observe(hudBottomDockEl);
  }

  window.__orbitar = {
    sceneManager,
    scaleManager,
    qualityManager,
    ambientEngine,
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

      if (!body.rootGroup.visible || body.data.category === 'rover') {
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
      .register('./sw.js', { updateViaCache: 'none' })
      .then((reg) => {
        reg.update().catch(() => {});
      })
      .catch(() => {
        // Ignorăm eventualele restricții în mediul de dev local
      });
  });
}

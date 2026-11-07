# Jurnalul Modificărilor (Changelog) — Orbitar

Toate modificările, îmbunătățirile astronomice, adăugirile didactice și rafinamentele de interfață ale planetariului interactiv 3D **Orbitar** sunt documentate în acest fișier. Proiectul urmează versionarea semantică (`MAJOR.MINOR.PATCH`).

---

## [1.2.8] — 2026-11-07

### Proporții Fidele pentru ISS, Telescoape, Sonde și Sateliți & Încadrare Orbitală Fără Perspectivă Forțată
- **Eliminarea iluziei de perspectivă forțată la selectarea ISS și Hubble (`CameraController`)**:
  - La selectarea unui satelit artificial sau telescop (`ISS`, `Hubble`, `JWST`, `Euclid`), `CameraController.focusBody()` construiește o bază ortonormată locală (`localRadial`, `tangent`, `binormal`) raportată la planeta-mamă și poziționează camera la `10.5 × r`, privind tangențial și ușor spre exterior (`+15°` deasupra orizontului local, spre cerul înstelat), astfel încât `ISS` nu mai este niciodată suprapusă în prim-plan peste discul Pământului.
  - Sincronizat `controls.target.add(this.tempOrbitalDelta)` cu `camera.position.add(this.tempOrbitalDelta)` în `CameraController.update()` și adăugat repoziționare instantanee la comutarea `Scară Didactică <-> Scară Reală`.
- **Obiecte artificiale la scară micro și ierarhie fizică fidelă în Scara Didactică (`ScaleManager`, `SceneManager`, `SpacecraftPilot`, `BottomDock`)**:
  - Redus razele vizuale ale obiectelor artificiale (`ISS`, `Hubble`, `JWST`, `Euclid`, sonde, rovere) în **🔭 Scara Didactică** la scară micro (`0.0012` – `0.0031`, de peste 500–1.300× mai mici decât Pământul) și plasat `ISS` (`1.085 × R_Pământ`) și `Hubble` (`1.145 × R_Pământ`) pe orbita joasă LEO chiar deasupra atmosferei terestre.
  - Calibrat razele planetelor telurice, ale planetelor pitice și ale sateliților în **🔭 Scara Didactică** astfel încât să respecte exact rapoartele fizice (`Pământ / Lună = 3,667:1`, `Pământ / Marte = 1,88:1`, `Deimos < Phobos < Charon < Ceres < Pluto < Luna < Mercur < Ganymede < Marte < Venus < Pământ`).
  - Coborât `camera.near` la `1e-11` în `SceneManager`, eliminat pragul minim `0.35` din `SpacecraftPilot` și adăugat notificare vizuală la comutarea scării în `BottomDock`.

---

## [1.2.7] — 2026-11-07

### Performanță & Fluiditate 60/120 FPS (Eliminare Micro-Freeze Periodic)
- **Eliminarea invalidării layout-ului și a recalculării stilurilor `:root` la fiecare secundă (`BottomDock`, `main.ts`, `style.css`)**:
  - `BottomDock.updateDateReadout()` păstrează în cache referința `#hud-sim-date` și cheia minutului curent (`Math.floor(simDate.getTime() / 60000)`), formatând și actualizând DOM-ul exclusiv la schimbarea efectivă a minutului afișat (în loc de 60–120 rescrieri DOM/secundă).
  - `syncHeaderOffsetCssVar()` din `main.ts` actualizează variabilele CSS `--hud-header-offset` și `--hud-bottom-offset` pe `:root` doar atunci când înălțimea în pixeli a barelor HUD se schimbă efectiv, prevenind recalcularea stilurilor în tot arborele DOM la fiecare secundă.
  - Adăugat `contain: layout style` și `font-variant-numeric: tabular-nums` pe `.sim-date-readout` și `.target-dist-badge`, plus oprirea animației CSS din `#loading-screen.is-hidden`.
- **Eliminarea scrierilor DOM redundante și a alocărilor temporare pe heap în bucla de randare (`OrbitalEngine`, `ScaleManager`, `CameraController`, `StudyDrawer`, `SurfaceMarkers`, `CosmicScaleNavigator`, `LightSpeedRuler`)**:
  - Cache-uit calculul efemeridelor `Astronomy.JupiterMoons` per timestamp (o singură evaluare pe cadru în loc de 4) și listele `getAllBodies()` / `getBodiesForHorizon()`.
  - Reutilizat vectori pre-alocați `THREE.Vector3` în `OrbitalEngine.updatePositions()`, `ScaleManager` și `CameraController.update()` pentru a elimina pauzele periodice de Garbage Collection.

---

## [1.2.6] — 2026-11-06

### Corecții Astronomice & Scara Reală 1:1
- **Proporții fizice exacte (1:1) în Scara Reală (`ScaleManager`, `ProceduralModels`, `PlanetMaterialFactory`)**:
  - Eliminat pragul artificial de rază minimă care supra-dimensiona stația ISS, telescoapele, sondele și sateliții mici în modul **📏 Scară Reală**.
  - Toate corpurile din Sistemul Solar (Soarele, planetele, planetele pitice, sateliții naturali, asteroizii, ISS, Hubble, JWST, Euclid și sondele interplanetare) respectă acum matematic raportul fizic real `(radiusKm / KM_PER_AU) * REAL_UNITS_PER_AU` (ex: Soare/Pământ `109,3:1`, Pământ/Lună `3,67:1`, Marte/Phobos `300,8:1`, Marte/Deimos `546,7:1`, Pământ/ISS `~115.836:1`, ISS/JWST `5:1`).
  - Normalizat modelele 3D ale navelor și telescoapelor (`createISSModel`, `createJWSTModel`, `createHubbleModel`, `createVoyagerModel`, `createSpaceProbeModel`) la o sferă unitară de încadrare (`R = 1.0`), identic cu sferele planetare.
  - Calibrat precizia **Logarithmic Depth Buffer** în GLSL (`THREE.ShaderChunk.logdepthbuf_vertex` / `logdepthbuf_fragment`) și planul `camera.near = 1e-9`, permițând apropierea camerei până la nivel de metri fără artefacte de Z-fighting.
  - În **🔭 Scara Didactică**, ierarhia de mărimi este strict monotonă (`Sonde < Hubble < JWST < ISS < Deimos < Phobos < Mimas < Lună < Ganymede < Planete < Soare`).

### Experiență la Lansare & Persistența Preferințelor
- **Scara Didactică implicită și Zoom-Out adaptat vârstei (`CameraController`, `main.ts`)**:
  - La prima lansare, aplicația pornește implicit în **🔭 Scară Didactică** cu o încadrare apropiată și caldă pentru grupa **Micul Explorator (6–8 ani)**.
  - Pentru grupa **Cadet Orbitar (9–12+ ani)**, vederea panoramică aplică automat un **zoom-out amplu „de departe”**, cuprinzând întregul Sistem Solar până la Neptun, Pluto și Centura Kuiper.
- **Memorarea completă a ultimei sesiuni (`localStorage`)**:
  - La repornirea aplicației sunt restaurate automat toate cele 4 setări folosite la ultima rulare:
    1. **Scara de reprezentare** (`orbitar_scale_mode`: Didactică sau Reală);
    2. **Viteza simulării** (`orbitar_sim_speed`: de la `1× (Timp real)` până la `6 luni / sec`, cu sincronizare automată la momentul prezent dacă a fost lăsată pe `1×`);
    3. **Grupa de vârstă** (`orbitar_age_tier`: Micul Explorator 6–8 ani sau Cadet Orbitar 9–12 ani);
    4. **Modul de detaliu grafic** (`orbitar_quality_mode`: Rapid Eco sau Realist HD).

---

## [1.2.5] — 2026-11-06

### Adăugiri & Realism Astronomic
- **Poziționare și rotație în Timp Real (`1×`)**:
  - Când viteza simulării este setată pe **Timp Real (`1×`)**, planetele și sateliții lor sunt poziționate exact în configurația astronomică de la momentul prezent (`new Date()`), iar rotația în jurul axei proprii folosește viteza unghiulară siderală reală ($\omega = \frac{2\pi}{\text{dayLengthHours} \times 3600}$ rad/s), inclusiv rotațiile retrograde ale lui Venus și Uranus.
- **Luminile orașelor pe emisfera nocturnă a Pământului (`EarthNightLightsLayer`)**:
  - Adăugat stratul **NASA Black Marble** (`public/textures/hd/earth_nightlights.jpg`) și shaderul GLSL dedicat care aprinde luminile metropolelor (Europa, Valea Nilului, America de Nord, Japonia, India) exclusiv pe partea Pământului aflată în umbră/noapte și la terminatorul crepuscular.
- **Sistem automat de versionare și tag-uri GitHub (`scripts/bump-version.mjs`)**:
  - Sincronizare automată a versiunii în toate cele 6 fișiere ale proiectului (`package.json`, `src-tauri/tauri.conf.json`, `src-tauri/Cargo.toml`, `src/utils/UpdateChecker.ts`, `index.html`, `public/app-version.js`) și creare automată a tag-urilor `vX.Y.Z` în GitHub Actions.

---

## [1.2.0] — 2026-11-06

### Corpuri Cerești Noi, Sunete UI, Cursoare Cosmice & Tutorial
- **8 sateliți naturali noi cu texturi fotorealiste 2K și fișe didactice complete**:
  - Lunile lui Marte (**Phobos** cu craterul Stickney și **Deimos**), Saturn (**Mimas** cu craterul Herschel și **Iapetus** în două tonuri), Uranus (**Miranda** și **Titania**), Neptun (**Triton** cu gheizere de azot) și Pluto (**Charon** cu Mordor Macula).
- **Ghid interactiv la prima pornire (`OnboardingTutorial`)**:
  - Tutorial în 5 pași afișat doar la prima deschidere a aplicației, cu posibilitatea de a fi reluat oricând din caseta *Despre Orbitar*.
- **Sintetizator de efecte sonore UI (`UiSoundEngine`) & Cursoare SVG cosmice**:
  - Efecte sonore discrete generate procedural prin Web Audio API (click, hover, selecție corp, tranziție *fade-out / fade-in* a casetei de studiu la schimbarea corpului selectat, quiz) redate la volumul sistemului gazdă, independent de volumul muzicii ambientale.
- **Caseta „Despre Orbitar” (`Help -> About`) & Verificare actualizări GitHub (`UpdateChecker`)**:
  - Dialog clasic *Despre* cu informații despre versiune, arhitectură și verificare live a release-urilor noi pe GitHub pentru aplicațiile desktop (Windows, Linux, macOS).

---

## [1.1.0] — 2026-11-05

### Texturi Științifice HD & Culoare Orbitale Disjuncte
- **39 de hărți planetare și stelare HD (2048×1024) + 24 fotografii oficiale NASA/ESA/JWST/Hubble**:
  - Texturi autentice pentru toate planetele, planetele pitice, asteroizii principali și obiectele din Cosmosul Îndepărtat.
- **Regularizarea traiectoriilor în Scara Didactică (`DIDACTIC_ORBIT_AU`)**:
  - Calibrarea culoarelor orbitale astfel încât niciun corp ceresc, inel planetar sau satelit să nu se intersecteze în modul didactic.
- **Aplicații native Desktop (Tauri v2)** pentru Windows (`.exe` / `.msi`), Linux (`.AppImage` / `.deb`) și macOS Universal (`.dmg`) cu suport nativ de tipărire și salvare a planșelor A4 și diplomelor.

---

## [1.0.0] — 2026-11-01

### Lansarea Inițială Orbitar
- **Planetariu 3D interactiv în limba română** pe 3 Orizonturi Cosmice (*Sistemul Solar*, *Stele Vecine & Exoplanete*, *Calea Lactee & Galaxii*), cu narațiune vocală offline (132 fișiere audio neurale), *Laboratorul Orbitar*, *La Manșa Navei (Mod Pilot)*, *Misiuni Orbitar*, *Planșe de Colorat SVG A4* și *Generator de Diplome*.

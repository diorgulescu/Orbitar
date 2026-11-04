# 🪐 Orbitar — Planetariu Didactic Interactiv

[![Licență: GPL v3](https://img.shields.io/badge/Licen%C8%9B%C4%83-GPLv3-00f0ff.svg)](./LICENSE)
[![Limba: Română](https://img.shields.io/badge/Limba-Rom%C3%A2n%C4%83%20(6--12%20ani)-ffb703.svg)](#)
[![100% Offline PWA & Desktop](https://img.shields.io/badge/PWA%20%26%20Desktop-100%25%20Offline%20%26%20Zero%20Telemetrie-22c55e.svg)](#)
[![Teste Automate CI](https://img.shields.io/badge/Teste%20Automate-31%20Unit%20%26%20Functional%20(GitHub%20Actions)-00f0ff.svg)](./.github/workflows/ci-tests.yml)

**Orbitar** este un planetariu didactic interactiv 3D în limba română, conceput special pentru copiii cu vârste între **6 și 12 ani**, pentru orele de științe de la școală (la videoproiector sau tablă interactivă) și pentru explorare acasă pe tabletă, laptop sau PC.

Proiectul este **100% Open-Source**, licențiat sub **GNU General Public License v3.0 (`GPL-3.0-or-later`)**, funcționează **complet autonom și offline** (atât ca aplicație web PWA cu Service Worker, cât și ca aplicație nativă desktop pentru **Windows, macOS și Linux** prin Tauri v2) și nu conține niciun fel de telemetrie, reclame sau scripturi de pe CDN-uri externe.

---

## ✨ Funcționalități principale

1. **Simulare Astronomică 3D Autentică (`astronomy-engine` + `satellite.js` + `Three.js`):**
   - **Soarele + cele 8 planete** (*Mercur, Venus, Pământ, Marte, Jupiter, Saturn, Uranus, Neptun*) cu poziții heliocentrice 3D reale și viteză de simulare implicită la pornire de **`1 min / sec`** (ajustabilă de la timp real `1×` până la `1 lună / sec`).
   - **Sateliți naturali majori:** *Luna, Io, Europa, Ganymede, Callisto, Titan, Enceladus*.
   - **Planete pitice și asteroizi principali:** *Pluto, Ceres, Eris, Haumea, Makemake, Vesta, Pallas, Bennu, Apophis, Psyche*.
   - **Centura Principală de Asteroizi și Centura Kuiper:** mii de corpuri randate fluent la 60 FPS prin `THREE.InstancedMesh`.
   - **Misiuni, telescoape, sonde și rovere spațiale 3D:**
     - **Orbita Joasă a Pământului (LEO):** *Stația Spațială Internațională (ISS)* și *Telescopul Spațial Hubble* cu propagare orbitală SGP4 în timp real.
     - **Punctul Lagrange L2 (orbită exterioară în jurul Pământului):** *Telescopul Spațial James Webb (JWST)* și *Telescopul Spațial Euclid*.
     - **Sonde interplanetare:** *Voyager 1 & 2, New Horizons, Parker Solar Probe, Rosetta & Philae, JUICE*.
     - **Rovere ancorate pe suprafața rotitoare a planetei Marte:** *Perseverance (cu elicopterul Ingenuity)* în Craterul Jezero (`18,38° N, 77,58° E`) și *Curiosity (MSL)* în Craterul Gale (`4,58° S, 137,44° E`), afișate ca pinpoint-uri interactive dedicate pe globul marțian, cu urmărire sincronă a rotației planetei de către cameră.
   - **Modele 3D PBR detaliate în Modul HD & Fotografii Oficiale NASA:**
     - În modul HD, navele și telescoapele folosesc geometrii și texturi procedurale PBR de înaltă rezoluție: oglinda primară din **18 segmente hexagonale aurii** și scutul termic Kapton în 5 straturi pentru **JWST**, panouri fotovoltaice dublu-față și radiatoare termice pentru **ISS**, tub metalic multi-inelar cu clapetă de apertură pentru **Hubble** și folie termică aurie MLI pentru **Voyager** și sonde.
     - **12 fotografii și randări oficiale NASA / ESA (Public Domain)** stocate local în `public/textures/nasa/` (`npm run fetch:nasa-media`), afișate în sertarul de studiu și în casetele pinilor de pe Marte.

2. **Mini-Jocul Educațional „🚀 La Manșa Navei (Mod Pilot)” (`SpacecraftPilot.ts` + `CockpitHUD.ts`, Tasta `P`):**
   - Comută camera într-o **cabină de comandă spațială First-Person** (`#cockpit-hud-overlay`) desenată vectorial în SVG, cu parbriz panoramic, reticule HUD și efect dinamic de întindere a stelelor (*Starfield Warp*).
   - **3 nave spațiale didactice** care omagiază pionierii aviației românești și literatura română, ilustrând scara reală a timpului și a distanțelor cosmice:
     - **🚀 Racheta „Vlaicu-1” (Propulsie Chimică — `50.000 km/h`):** viteza sondelor actuale (*New Horizons / Apollo*); călătoria Pământ → Marte durează ~5 luni pe ceasul de bord, iar până la Neptun ~10 ani.
     - **⚡ Sonda „Coandă-X” (Propulsie Ionică & Fuziune — `1.500.000 km/h`):** tehnologia viitorului apropiat; Pământ → Marte în ~2 zile, iar până la Jupiter în ~18 zile.
     - **✨ Nava „Luceafărul” (Motor Fotonic — Viteza Luminii `1c`, `1.079.252.848 km/h`):** limita supremă a fizicii universului; ~8 minute și 20 secunde de la Soare la Pământ și ~4 ore până la Neptun în timp real!
   - **Două moduri de zbor:**
     - **Pilot Automat (`🔥 Zboară Acolo`):** rotește lin nava către ținta aleasă, accelerează de-a lungul traiectoriei 3D și frânează automat pe orbita de parcare în timp ce **Ceasul Pământesc de la Bord** derulează timpul real scurs pe Pământ.
     - **Zbor Liber din Tastatură / Mouse (`W/A/S/D`, săgeți, `Space`/`Shift`, `Q`/`E`):** explorare liberă prin Sistemul Solar.
   - **Etichete de Realitate Augmentată (AR) pe parbriz** cu distanța în UA și kilometri, indicator de poziție în Sistemul Solar și **Calculatorul de Bord Vorbitor** care rostește natural raportul misiunii la sosirea pe orbita destinației.

3. **Două niveluri de studiu comutabile în timp real (`orbitar_age_tier`) & Citire cu Voce Neurală în Română (`SpeechManager.ts` + `RomanianSpeechNormalizer.ts`):**
   - **Micul Explorator (6–8 ani):** explicații calde pe înțelesul copiilor, analogii vizuale, curiozități, tabel cu durata călătoriei (*cu mașina, avionul, racheta, viteza luminii*) și buton **„🔊 Citește-mi”**.
   - **Cadet Orbitar (9–12 ani):** date fizice exacte, structură internă pe straturi sau instrumente științifice la bord, istoricul explorării și întrebări grilă interactive (Quiz).
   - **🎙️ Arhitectură Hibridă de Redare Vocală în Română:** include 76 de fișiere audio neurale pre-generate (`public/audio/tts/<bodyId>_<tier>.mp3`) cu voce naturală românească de studio, plus **Normalizator Fonetic și Științific (`RomanianSpeechNormalizer.ts`)** care elimină emoji-urile și transformă automat temperaturile negative (`-110 °C` &rarr; *„minus 110 grade Celsius”*), numerele zecimale (`24.6` &rarr; *„24 virgulă 6”*), unitățile astronomice (`km/h`, `UA`, `1c`) și numele misiunilor/corpurilor cerești (*Voyager* &rarr; *„Voiager”*, *James Webb* &rarr; *„Geims Ueb”*, *Perseverance* &rarr; *„Perseverăns”*, *Enceladus* &rarr; *„Ențeladus”*).

4. **Scară Didactică vs. Scară Reală (`orbitar_scale_mode`) & Calitate Grafică Adaptivă (`orbitar_quality_mode`, Tasta `Q`):**
   - **Scara Didactică (implicită):** mărește logaritmic planetele și sondele pentru a fi ușor de găsit și selectat pe ecran tactil.
   - **Scara Reală:** respectă proporțiile fizice exacte dintre razele planetelor și distanțele în Unități Astronomice (UA).
   - **Incluziune Digitală & Comutator Grafic (`orbitar_quality_mode`):**
     - **⚡ Grafică: Rapidă (Eco):** zero descărcări externe din `public/textures/hd/`, texturi procedurale ușoare `512×256`, sfere `24×24`, `pixelRatio(1)`, 25% particule în centuri și eliberare imediată a memoriei VRAM (`.dispose()`) + **Watchdog FPS** care activează automat Modul Rapid dacă media scade sub 24 FPS.
     - **✨ Grafică: Realistă HD (Simulator Astronomic):** 26 de hărți planetare științifice 2K în `public/textures/hd/`, Tone Mapping fotografic `ACESFilmicToneMapping`, suport complet **Logarithmic Depth Buffer** în toate shaderele GLSL personalizate (pentru o ocluzie 3D impecabilă a inelelor lui Saturn, a atmosferelor Fresnel și a sondelor apropiate), relief topografic 3D (`bumpMap` LOLA/MOLA/MESSENGER/Magellan), Pământ pe 5 hărți simultane (`earth_albedo.jpg`, `earth_bump.jpg`, `earth_ocean_roughness.jpg`, `earth_clouds_alpha.png` cu umbră pe continente și `earth_nightlights.jpg`), Venus cu radarul vulcanic Magellan sub nori („👁️ Vezi sub nori (Radar Magellan)”) și umbra planetară proiectată pe inelele lui Saturn.

5. **Laboratorul Orbitar, Unelte Interactive & Ergonomie pentru Sala de Clasă:**
   - **⚖️ Cât cântăresc și cât de sus sar aici?** — calculator interactiv de greutate și săritură în funcție de gravitația locală.
   - **🎂 Câți ani am pe această lume?** — conversia vârstei în ani orbitali și zile solare locale.
   - **💿 Discul de Aur Voyager (1977):** redarea salutului istoric în limba română (*„Salutări la toată lumea!”*).
   - **🚀 Rigla cu Viteza Luminii:** măsoară distanța reală în UA și kilometri între oricare două corpuri și animează în 3D un foton/semnal radio călătorind între ele.
   - **🛰️ Tracker SGP4 pentru ISS & Hubble:** calculează 100% offline latitudinea, longitudinea, altitudinea (`~420 km`) și viteza (`~27.600 km/h`) din setul TLE local, cu opțiune de sincronizare live.
   - **📍 Markere Planetare și Pini Dedicați pentru Rovere pe Marte și Lună (`SurfaceMarkers.ts`):** pini interactivi pe glob pentru *Roverul Perseverance & Ingenuity*, *Roverul Curiosity (MSL)*, *Craterul Jezero*, *Craterul Gale*, *Chryse Planitia (Viking 1)*, *Olympus Mons* și *Marea Liniștii (Apollo 11)*.
   - **🎯 Misiunile Orbitar & Jurnalul de Bord (`orbitar_badges`):** joc de tip „Vânătoare de Comori Cosmică” în care copiii caută ținte în Sistemul Solar și deblochează insigne.
   - **⛶ Mod Proiecție la Clasă (`F11`) & Navigație Auto-Scroll:** buton dedicat Fullscreen în antet pentru videoproiector/tablă interactivă și derulare orizontală automată a listei de corpuri din bara inferioară (`#hud-bodies-list`) la selectarea oricărui corp în scena 3D.
   - **🎵 Motor de Muzică Ambientală Cosmică Generativă (`SpaceAmbientEngine.ts`, Tasta `M`):** sintetizator polifonic în timp real bazat 100% pe Web Audio API nativ (drone analogic cald în Re Lydian / Si Minor, arpegii stelare *Mystery Shimmer*, Stereo Ping-Pong Delay + Reverb Catedratic de 6 secunde, vânt cosmic și **Auto-Ducking** automat la 25% în timpul sintezei vocale).

6. **Fișe de Studiu A4, Planșe de Colorat & Diplomă de Cadet (`ColoringSvgGenerator.ts` + `DiplomaGenerator.ts` + `PrintManager.ts`):**
   - **Generator vectorial SVG „line-art” (Eco-Print Alb-Negru):** ilustrații cu contururi negre clare pe fundal alb (`#ffffff`), fără degradeuri gri, ideale pentru imprimare cu consum minim de toner și pentru a fi colorate cu creioane sau carioci.
   - **4 Șabloane A4 în limba română (`@media print`):**
     - *Șablonul A („Fișă de Studiu & Colorat”)*: antet cu câmpuri pentru numele elevului și dată, tabel cu datele rapide, rezumat adaptiv, ilustrația SVG de colorat și întrebarea Quiz cu căsuțe de bifat cu creionul.
     - *Șablonul B („Planșă de Colorat A4 — Doar Desen Mare”)*: 85% din pagină dedicată desenului de colorat (pentru orice corp/sondă sau **Harta Sistemului Solar de Colorat A4 Landscape**), cu titlu în litere conturate de colorat și curiozități în subsol.
     - *Șablonul C („Jurnal de Misiune — Tabelul Comparativ al Planetelor”)*: sinteză cu toate planetele pe o singură pagină + mini-harta de colorat.
     - *Șablonul D („Diplomă de Explorator / Cadet Spațial Orbitar — A4 Landscape”)*: diplomă oficială de Academie Spațială cu bordură decorativă în line-art, numele copilului (sau linie punctată pentru completare cu stiloul), insignele cucerite în Jurnalul de Bord și ștampila oficială *„Ad Astra — Prin Știință către Stele”*.
   - **Export local:** descărcare directă în format `.svg` sau `.png` de înaltă rezoluție.

---

## ⌨️ Scurtături Rapide din Tastatură

| Tastă | Acțiune |
| :--- | :--- |
| **`P`** | Activează / dezactivează mini-jocul **„🚀 La Manșa Navei (Mod Pilot)”** |
| **`W` / `S` / `A` / `D`** (sau Săgeți) | Propulsie înainte/înapoi și viraj stânga/dreapta în Modul Pilot |
| **`Space` / `Shift`** | Ascensiune / coborâre verticală în Modul Pilot |
| **`Q` / `E`** (în Modul Pilot) | Înclinare laterală (Roll) stânga / dreapta a navei |
| **`Q`** (în vederea orbitală) | Comută rapid între **✨ Grafică: Realistă HD** și **⚡ Grafică: Rapidă (Eco)** |
| **`M`** | Pornește / oprește muzica ambientală cosmică generativă |
| **`F11`** | Comută modul **Proiecție la Clasă (Fullscreen)** |
| **`Escape`** | Închide ferestrele modale active sau oprește Pilotul Automat |

---

## 👩‍🏫 Ghid pentru Profesori și Părinți: Editarea Datelor Didactice (`public/data/`)

Toate textele, explicațiile, analogiile și întrebările de quiz din **Orbitar** sunt stocate în fișiere JSON statice în folderul `public/data/`, astfel încât profesorii, astronomii amatori sau părinții le pot actualiza ori îmbogăți fără să modifice codul TypeScript:

| Fișier | Conținut |
| :--- | :--- |
| `public/data/solar-system-ro.json` | Soarele, cele 8 planete, cei 7 sateliți majori, cele 5 planete pitice, cei 5 asteroizi principali și configurarea centurilor de asteroizi (`belts`). |
| `public/data/missions-ro.json` | Cele 12 misiuni spațiale (ISS, Hubble, JWST, Euclid, Voyager 1 & 2, New Horizons, Parker Solar Probe, Rosetta, JUICE, Perseverance, Curiosity). |
| `public/data/tle-iss.json` | Seturile de elemente orbitale NORAD Two-Line Element (TLE) pentru propagarea SGP4 a Stației Spațiale Internaționale și a Telescopului Hubble. |

### Structura unei intrări în `solar-system-ro.json` sau `missions-ro.json`

Pentru a modifica un text sau o întrebare de quiz, deschideți fișierul într-un editor de text (cu codificare UTF-8 și diacritice românești `ă, â, î, ș, ț`):

```json
{
  "id": "mars",
  "name": "Marte",
  "category": "terrestrial",
  "subtitle": "Planeta Roșie a vulcanilor giganți și a roverelor exploratoare",
  "color": "#f97316",
  "radiusKm": 3389.5,
  "massEarthRatio": 0.107,
  "gravityRatio": 0.38,
  "orbitPeriodDays": 686.98,
  "dayLengthHours": 24.623,
  "meanTempC": -63,
  "distanceFromSunAU": 1.524,
  "junior": {
    "summary": "Textul pe înțelesul copiilor de 6–8 ani...",
    "analogy": "Comparația vizuală intuitivă...",
    "funFact": "Curiozitatea «Știai că?»...",
    "travelTime": {
      "car": "62 de ani",
      "plane": "7 ani",
      "rocket": "7 luni",
      "light": "între 3 și 22 de minute"
    }
  },
  "cadet": {
    "summary": "Descrierea științifică detaliată pentru 9–12 ani...",
    "structure": [
      { "name": "Nucleu metalic", "description": "Compus din fier, nichel și sulf." }
    ],
    "explorationHistory": "Istoricul sondelor și roverelor care au vizitat corpul ceresc...",
    "quiz": {
      "question": "Cum se numește cel mai înalt vulcan de pe Marte?",
      "options": ["Mauna Kea", "Olympus Mons", "Valles Marineris", "Maxwell Montes"],
      "correctIndex": 1,
      "explanation": "Explicația afișată copilului după alegerea răspunsului."
    }
  }
}
```

---

## 🛠️ Instrucțiuni de Instalare, Dezvoltare, Testare și Compilare

### Cerințe preliminare
- **Node.js** (versiunea 20+ recomandată) și **npm**.
- *(Opțional, pentru compilarea aplicației desktop native Tauri)*: **Rust toolchain** (`rustup`).

### 1. Instalarea dependențelor
```bash
npm install
```

### 2. Pornirea serverului local de dezvoltare (pentru testare în browser)
```bash
npm run dev
```
Aplicația va porni la adresa `http://localhost:5173/` (sau `http://127.0.0.1:5173/`).

### 3. Rularea suitei de teste automate (Unitare & Funcționale)
```bash
npm test
```
Suita execută **31 de teste automate grupate în 11 suite** (`tests/unit/` și `tests/functional/`), rulată automat și în **GitHub Actions** (`.github/workflows/ci-tests.yml`, `deploy.yml` și `release-desktop.yml`):
- **`ScaleManager` & `QualityManager`:** transformări de scară Didactică/Reală, detecție hardware HD/Eco și Watchdog FPS;
- **`OrbitalEngine` & `ISSTracker`:** efemeride 3D, propagare SGP4 (`satellite.js`), ancorarea roverelor marțiene pe suprafața rotitoare a lui Marte, orbita L2 pentru JWST/Euclid și filtrele pe straturi;
- **`PlanetMaterialFactory` & `ProceduralModels`:** suport Logarithmic Depth Buffer în shaderele GLSL, Radarul Magellan pe Venus, modelele PBR HD (JWST cu 18 segmente hexagonale, ISS, Hubble, Voyager) și centurile `THREE.InstancedMesh`;
- **`SpacecraftPilot` & `CockpitHUD`:** cele 3 nave spațiale (*Vlaicu-1, Coandă-X, Luceafărul*), fizica timpului pe ceasul pământesc, activarea Scuturilor Deflectoare în centurile de asteroizi și raportul Calculatorului de Bord la sosire;
- **`SpaceAmbientEngine`, `ColoringSvgGenerator` & `DiplomaGenerator`:** sintetizatorul Web Audio API, planșele SVG alb-negru A4 și diplomele personalizate;
- **`SurfaceMarkers`, `CameraController`, `StudyDrawer`, `OrbitarLab`, `HeaderHud`, `BottomDock`, `LightSpeedRuler`, `OrbitarMissions`, `PrintManager` & `LicenseModal`:** teste funcționale de integrare UI/DOM/3D;
- **Integritatea proiectului & Conformitate GPLv3:** verificarea antetului `SPDX-License-Identifier: GPL-3.0-or-later` pe toate fișierele sursă, validitatea bazelor de date JSON, prezența celor 12 fotografii oficiale NASA (`public/textures/nasa/`) și a celor 26 de hărți planetare HD (`public/textures/hd/`).

### 4. Compilarea versiunii de producție (`orbitar.ro` & `planetariu.orbitar.ro`)
```bash
npm run build:all
```
Comanda generează două directoare curate, gata de publicare pe cPanel (Apache/LiteSpeed) sau GitHub Pages:
- `dist-landing/` — site-ul oficial de prezentare pentru rădăcina `orbitar.ro` (include `index.html`, `style.css`, `orbitar-icon.svg` și `.htaccess`).
- `dist/` — aplicația 3D completă pentru subdomeniul `planetariu.orbitar.ro` (include `CNAME`, `.htaccess` cu reguli de cache pentru `/textures/` și `/audio/`, PWA `sw.js` și bundle-urile optimizate).

Pentru a testa local versiunea de producție compilată:
```bash
npm run preview
```

### 5. Compilarea aplicației Desktop Native 100% Offline (Windows, macOS, Linux — Tauri v2)
```bash
npm run tauri:dev     # Rulare în fereastră nativă de dezvoltare
npm run tauri:build   # Împachetare instalatoare native (.exe/.msi, .dmg, .deb/.rpm/.AppImage)
```
La crearea unui tag de versiune (ex. `v1.0.0`), workflow-ul GitHub Actions `.github/workflows/release-desktop.yml` rulează suita de teste și construiește automat pachetele native pentru Windows, macOS Universal și Linux.

### 6. Actualizarea hărților științifice HD și a fotografiilor NASA (opțional)
```bash
npm run fetch:hd-textures   # Descarcă/regenerează cele 26 de hărți planetare 2K în public/textures/hd/
npm run fetch:nasa-media    # Descarcă cele 12 fotografii oficiale NASA (Public Domain) în public/textures/nasa/
```

---

## 👥 Contribuitori & Atribuiri Resurse

- **Dragoş Iorgulescu** (`@diorgulescu`) — Concept, arhitectură și coordonare proiect
- **Google Antigravity (Gemini)** — Dezvoltare asistată în pereche (Pair Programming)
- **Atribuire Hărți Științifice, Fototeca NASA și Texturi Planetare HD (2K):** **NASA / JPL-Caltech / USGS Astrogeology / SDO / LRO / MOLA / Magellan / Cassini / New Horizons / Dawn / ESA (Public Domain), CelestiaContent (GNU GPLv2+) & Solar System Scope (CC-BY 4.0)** (`npm run fetch:hd-textures` & `npm run fetch:nasa-media`)

---

## ⚖️ Licență — GNU General Public License v3.0 (GPL-3.0-or-later)

Acest proiect este software liber: îl puteți redistribui și/sau modifica în conformitate cu termenii **Licenței Publice Generale GNU (GNU General Public License)** așa cum este publicată de Free Software Foundation, fie versiunea 3 a Licenței, fie (la alegerea dumneavoastră) orice versiune ulterioară.

Consultați fișierul [LICENSE](./LICENSE) pentru textul integral al licenței GNU GPLv3.

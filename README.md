# 🪐 Orbitar — Planetariu Didactic Interactiv

[![Licență: GPL v3](https://img.shields.io/badge/Licen%C8%9B%C4%83-GPLv3-00f0ff.svg)](./LICENSE)
[![Limba: Română](https://img.shields.io/badge/Limba-Rom%C3%A2n%C4%83%20(6--12%20ani)-ffb703.svg)](#)
[![100% Offline PWA & Desktop](https://img.shields.io/badge/PWA%20%26%20Desktop-100%25%20Offline%20%26%20Zero%20Telemetrie-22c55e.svg)](#)
[![Teste Automate CI](https://img.shields.io/badge/Teste%20Automate-48%20Unit%20%26%20Functional%20(GitHub%20Actions)-00f0ff.svg)](./.github/workflows/ci-tests.yml) [![Release Orbitar Desktop (Windows, macOS, Linux)](https://github.com/diorgulescu/Orbitar/actions/workflows/release-desktop.yml/badge.svg)](https://github.com/diorgulescu/Orbitar/actions/workflows/release-desktop.yml)

**Orbitar** este un planetariu didactic interactiv 3D în limba română, conceput special pentru copiii cu vârste între **6 și 12 ani**, pentru orele de științe de la școală (la videoproiector sau tablă interactivă) și pentru explorare acasă pe tabletă, laptop sau PC.

Proiectul este **100% Open-Source**, licențiat sub **GNU General Public License v3.0 (`GPL-3.0-or-later`)**, funcționează **complet autonom și offline** (atât ca aplicație web PWA cu Service Worker, cât și ca aplicație nativă desktop pentru **Windows, macOS și Linux** prin Tauri v2) și nu conține niciun fel de telemetrie, reclame sau scripturi de pe CDN-uri externe.

---

## ✨ Funcționalități principale

1. **Simulare Astronomică 3D pe 3 Orizonturi Cosmice — 66 de Corpuri Cerești, Misiuni, Stele, Nebuloase și Galaxii (`astronomy-engine` + `satellite.js` + `Three.js` + `CosmicScaleNavigator.ts`):**
   - **Orizontul 1 — `☀️ Sistemul Solar` (46 de corpuri cerești și misiuni):**
     - **Soarele + cele 8 planete** (*Mercur, Venus, Pământ, Marte, Jupiter, Saturn, Uranus, Neptun*) cu poziții heliocentrice 3D reale și viteză de simulare implicită la pornire de **`1 min / sec`** (ajustabilă de la timp real `1×` până la `1 lună / sec`).
     - **15 sateliți naturali majori:** *Luna (Pământ); Phobos și Deimos (lunile cu formă de asteroid ale lui Marte); Io, Europa, Ganymede și Callisto (sateliții galileeni ai lui Jupiter); Mimas, Enceladus, Titan și Iapetus (lunile lui Saturn); Miranda și Titania (lunile lui Uranus); Triton (luna cu orbită retrogradă a lui Neptun); Charon (satelitul binar al lui Pluto)*.
     - **Planete pitice și asteroizi principali:** *Pluto, Ceres, Eris, Haumea, Makemake, Vesta, Pallas, Bennu, Apophis, Psyche*.
     - **Centura Principală de Asteroizi și Centura Kuiper:** mii de corpuri randate fluent la 60 FPS prin `THREE.InstancedMesh`.
     - **Misiuni, telescoape, sonde și rovere spațiale 3D (12 misiuni):**
       - **Orbita Joasă a Pământului (LEO):** *Stația Spațială Internațională (ISS)* și *Telescopul Spațial Hubble* cu propagare orbitală SGP4 în timp real.
       - **Punctul Lagrange L2 (orbită exterioară în jurul Pământului):** *Telescopul Spațial James Webb (JWST)* și *Telescopul Spațial Euclid*.
       - **Sonde interplanetare:** *Voyager 1 & 2, New Horizons, Parker Solar Probe, Rosetta & Philae, JUICE*.
       - **Rovere ancorate pe suprafața rotitoare a planetei Marte:** *Perseverance (cu elicopterul Ingenuity)* în Craterul Jezero (`18,38° N, 77,58° E`) și *Curiosity (MSL)* în Craterul Gale (`4,58° S, 137,44° E`), afișate ca pinpoint-uri interactive dedicate pe globul marțian, cu urmărire sincronă a rotației planetei de către cameră.
   - **Orizontul 2 — `✨ Stele și exoplanete` (7 sisteme în Vecinătatea Stelară în ani-lumină):**
     - Tranziție 3D logaritmică lină dincolo de heliosferă, pe fundal negru autentic al spațiului profund, cu farul interactiv **„📍 Aici este Sistemul nostru Solar (Acasă)”** în origine pentru revenire instantanee acasă.
     - Obiecte explorabile: *Norul lui Oort*, *Proxima Centauri & Exoplaneta Proxima b* (`4,24 ani-lumină`), *Sirius A & Pitica Albă Sirius B* (`8,6 ani-lumină`), *Sistemul TRAPPIST-1 cu 7 exoplanete stâncoase* (`40 ani-lumină`), *Super-Pământul de lavă și diamant 55 Cancri e* (`41 ani-lumină`), *Roiul Pleiadele („Cloșca cu Pui”, M45)* și *Supergiganta Roșie Betelgeuse* (`640 ani-lumină`).
   - **Orizontul 3 — `🌀 Calea Lactee și galaxii` (13 Nebuloase, Roiuri Globulare și Galaxii la Scară Extragalactică):**
     - **Nebuloase și roiuri stelare:** *Nebuloasa Orion (M42 — maternitatea de stele)*, *Stâlpii Creației (Nebuloasa Vulturul M16)*, *Nebuloasa Carina (NGC 3372)*, *Nebuloasa Crabului (M1 — rămășiță de supernovă cu pulsar)*, *Nebuloasa Inelul (M57)*, *Nebuloasa Helix („Ochiul lui Dumnezeu”, NGC 7293)* și *Roiul Globular Omega Centauri (10 milioane de stele)*.
     - **Nucleul galactic și galaxii:** *Gaura Neagră Supermasivă Sagittarius A\** (cu disc de acreție incandescent și inel fotonic relativist), *Galaxia noastră Calea Lactee* (cu brațele spirale și poziția Soarelui marcată în Brațul Orion), *Marele Nor al lui Magellan (LMC)*, *Galaxia Andromeda (M31)* la `2,5 milioane de ani-lumină`, *Galaxia Triangulum (M33)*, *Galaxia Vârtejul (Whirlpool M51)* și *Galaxia Sombrero (M104)*.
   - **Modele 3D PBR detaliate în Modul HD, 39 de Texturi Științifice 2K Fidele & 24 de Fotografii Oficiale NASA / ESA / JWST / Hubble / EHT:**
     - În modul HD, navele, planetele, lunile, stelele și galaxiile folosesc geometrii și texturi PBR fidele realității astronomice: oglinda primară din **18 segmente hexagonale aurii** și scutul termic Kapton în 5 straturi pentru **JWST**, panouri fotovoltaice dublu-față pentru **ISS**, tub metalic multi-inelar pentru **Hubble**, folie termică aurie MLI pentru **Voyager**, geometrie triaxială deformată pentru lunile marțiene **Phobos** (cu craterul Stickney) și **Deimos**, plus **39 de hărți echirectangulare științifice 2K** (`public/textures/hd/`, inclusiv benzile autentice Cassini și Marea Pată Roșie pe Jupiter, azuriul Voyager 2 pe Neptun, contrastul Yin-Yang pe Iapetus, Mordor Macula pe Charon, granulația convectivă pe Betelgeuse, erupțiile pe Proxima Centauri, oceanele de lavă pe 55 Cancri e și suprafața locuibilă TRAPPIST-1e).
     - **24 de fotografii oficiale NASA / ESA / JWST / Hubble / Event Horizon Telescope (Public Domain / CC-BY)** stocate local în `public/textures/nasa/` (`npm run fetch:nasa-media`), afișate în sertarul de studiu.

2. **Mini-Jocul Educațional „🚀 La Manșa Navei (Mod Pilot)” (`SpacecraftPilot.ts` + `CockpitHUD.ts`, Tasta `P`):**
   - Comută camera într-o **cabină de comandă spațială First-Person** (`#cockpit-hud-overlay`) desenată vectorial în SVG, cu parbriz panoramic, reticule HUD și efect dinamic de întindere a stelelor (*Starfield Warp*).
   - **3 nave spațiale didactice** care omagiază pionierii aviației românești și literatura română, ilustrând scara reală a timpului și a distanțelor cosmice:
     - **🚀 Racheta „Vlaicu-1” (Propulsie Chimică — `50.000 km/h`):** viteza sondelor actuale (*New Horizons / Apollo*); călătoria Pământ → Marte durează ~5 luni pe ceasul de bord, iar până la Neptun ~10 ani.
     - **⚡ Sonda „Coandă-X” (Propulsie Ionică & Fuziune — `1.500.000 km/h`):** tehnologia viitorului apropiat; Pământ → Marte în ~2 zile, iar până la Jupiter în ~18 zile.
     - **✨ Nava „Luceafărul” (Motor Fotonic — Viteza Luminii `1c` + `⚡ Salt Hiperspațial`):** ~8 minute și 20 secunde de la Soare la Pământ și ~4 ore până la Neptun; pentru țintele din afara Sistemului Solar, activează automat **Motorul Hiperspațial (Warp)** pentru a parcurge zeci sau milioane de ani-lumină în câteva secunde și explică în ce epocă istorică a plecat lumina de la acea stea sau galaxie!
   - **Două moduri de zbor:**
     - **Pilot Automat Intuitiv (pornire instantanee la selectarea destinației din listă sau prin butonul `🔥 Zboară Acolo` / `⚡ Salt Hiperspațial`):** îndată ce copilul alege o planetă, lună, stea sau galaxie din listă, nava se orientează automat spre ea, accelerează lin de-a lungul traiectoriei 3D și frânează pe orbita de parcare în timp ce **Ceasul Pământesc de la Bord** derulează timpul real scurs pe Pământ.
     - **Zbor Liber din Tastatură / Mouse (`W/A/S/D`, săgeți, `Space`/`Shift`, `Q`/`E`):** explorare liberă prin univers.
   - **Etichete de Realitate Augmentată (AR) pe parbriz** cu distanța în UA / kilometri / ani-lumină și **Calculatorul de Bord la Sosire** cu formulare naturală în limba română (*„Am ajuns la Soare!”*, *„Am ajuns la planeta Pământ!”*, *„Am ajuns la Lună!”*) și citire vocală opțională la cerere (**„🔊 Ascultă Raportul”**).

3. **Două niveluri de studiu comutabile în timp real (`orbitar_age_tier`) & Citire cu Voce Neurală în Română (`SpeechManager.ts` + `RomanianSpeechNormalizer.ts`):**
   - **Micul Explorator (6–8 ani):** explicații calde pe înțelesul copiilor, analogii vizuale, curiozități, tabel cu durata călătoriei (*cu mașina, avionul, racheta, viteza luminii*), cardul interactiv **„💡 Ce este un An-Lumină?”** & comparatorul de mărime față de Soare/Pământ (pentru obiectele Deep Space) și buton **„🔊 Citește-mi”**.
   - **Cadet Orbitar (9–12 ani):** date fizice exacte, structură internă pe straturi sau instrumente științifice la bord, istoricul explorării și întrebări grilă interactive (Quiz).
   - **🎙️ Arhitectură Hibridă de Redare Vocală în Română:** include **132 de fișiere audio neurale pre-generate** (`public/audio/tts/<bodyId>_<tier>.mp3`, acoperind toate cele 66 de corpuri cerești, luni, misiuni și obiecte Deep Space × 2 categorii de vârstă) cu voce naturală românească (`google-neural-ro` / `msedge-neural-ro`), redate instantaneu printr-un canal HTML5 `<audio>` persistent, plus **Normalizator Fonetic și Științific (`RomanianSpeechNormalizer.ts`)** care elimină punctele separatoare de mii (`6.500` &rarr; `6500`), emoji-urile și transformă automat temperaturile negative (`-110 °C` &rarr; *„minus 110 grade Celsius”*), numerele zecimale (`24.6` &rarr; *„24 virgulă 6”*), unitățile astronomice (`km/h`, `UA`, `ani-lumină`, `1c`) și numele misiunilor/corpurilor cerești (*Voyager* &rarr; *„Voiager”*, *James Webb* &rarr; *„Geims Ueb”*, *Perseverance* &rarr; *„Perseverăns”*, *Enceladus* &rarr; *„Ențeladus”*, *Betelgeuse* &rarr; *„Betelgeuz”*, *Stickney* &rarr; *„Sticni”*, *Herschel* &rarr; *„Herșăl”*).

4. **Scară Didactică cu Culoare Orbitale Disjuncte vs. Scară Reală (`orbitar_scale_mode`), Antet Compact & Calitate Grafică Adaptivă (`orbitar_quality_mode`, Tasta `Q`):**
   - **Bara superioară compactă pe un singur rând (`.hud-header`):** optimizată pentru laptopuri, tablete și videoproiectoare `1366×768`, cu buton discret `ⓘ` lângă sigla **ORBITAR** către `orbitar.ro`, selector dropdown pentru cele **3 Orizonturi Cosmice** (`#hud-horizon-select`), selector dropdown pentru **filtrele de categorii** (`#hud-layer-filter-select`), căutare rapidă (`Caută`) și comutatoare compacte de vârstă, scară și grafică.
   - **Scara Didactică (implicită, cu culoare orbitale disjuncte):** mărește logaritmic planetele, lunile și sondele pentru a fi ușor de găsit și selectat pe ecran tactil, calibrând automat distanțele radiale astfel încât niciun corp ceresc, inel planetar sau satelit să nu treacă prin altul.
   - **Scara Reală:** respectă proporțiile fizice exacte dintre razele planetelor și distanțele în Unități Astronomice (UA).
   - **Incluziune Digitală & Comutator Grafic (`orbitar_quality_mode`):**
     - **⚡ Grafică: Rapidă (`⚡ Eco`):** zero descărcări externe din `public/textures/hd/`, texturi procedurale ușoare `512×256`, sfere `24×24`, `pixelRatio(1)`, 25% particule în centuri și eliberare imediată a memoriei VRAM (`.dispose()`) + **Watchdog FPS** care activează automat Modul Rapid dacă media scade sub 24 FPS.
     - **✨ Grafică: Realistă HD (`✨ HD`):** **39 de hărți planetare, ale lunilor și stelare științifice 2K** în `public/textures/hd/`, Tone Mapping fotografic `ACESFilmicToneMapping`, suport complet **Logarithmic Depth Buffer** în toate shaderele GLSL personalizate (pentru o ocluzie 3D impecabilă a inelelor lui Saturn, a atmosferelor Fresnel și a sondelor apropiate), relief topografic 3D (`bumpMap` LOLA/MOLA/MESSENGER/Magellan), Pământ pe 5 hărți simultane (`earth_albedo.jpg`, `earth_bump.jpg`, `earth_ocean_roughness.jpg`, `earth_clouds_alpha.png` cu umbră pe continente și `earth_nightlights.jpg`), Venus cu radarul vulcanic Magellan sub nori („👁️ Vezi sub nori (Radar Magellan)”) și umbra planetară proiectată pe inelele lui Saturn.

5. **Tutorial Succint la Prima Pornire (`OnboardingTutorial.ts`), Caseta „Despre Orbitar” (`Help -> About`, Tasta `F1`) & Verificare Actualizări GitHub (`UpdateChecker.ts`):**
   - **🎓 Tutorial Interactiv la Prima Pornire (`orbitar_onboarding_seen_v1`):** un ghid vizual succint în 4 pași (Navigare 3D & Studiu, Orizonturi Cosmice & Timp, Mod Pilot & Misiuni, Niveluri de Vârstă & Planșe A4) care se afișează automat **o singură dată**, la prima pornire a programului sau prima accesare a site-ului, și poate fi redeschis oricând la cerere din caseta „Despre Orbitar” (**„🎓 Ghid Interfață”**).
   - **🪐 Caseta „Despre Orbitar” (`Help -> About`, butonul `ⓘ Despre / GPLv3` sau tasta `F1`) & Verificare Versiuni Noi pe GitHub:** afișează versiunea curentă, platforma rulată (*Windows / macOS / Linux / Web*) și include un verificator de actualizări conectat la GitHub Releases (`api.github.com`). Dacă pe GitHub există o versiune mai nouă decât cea instalată pe calculator, afișează noutățile versiunii și un buton care deschide direct pagina oficială de descărcare în browserul sistemului.

6. **Laboratorul Orbitar, Unelte Interactive & Ergonomie pentru Sala de Clasă:**
   - **⚖️ Cât cântăresc și cât de sus sar aici?** — calculator interactiv de greutate și săritură în funcție de gravitația locală.
   - **🎂 Câți ani am pe această lume?** — conversia vârstei în ani orbitali și zile solare locale.
   - **💿 Discul de Aur Voyager (1977):** redarea salutului istoric în limba română (*„Salutări la toată lumea!”*).
   - **🚀 Rigla cu Viteza Luminii:** măsoară distanța reală în UA și kilometri între oricare două corpuri și animează în 3D un foton/semnal radio călătorind între ele.
   - **🛰️ Tracker SGP4 pentru ISS & Hubble:** calculează 100% offline latitudinea, longitudinea, altitudinea (`~420 km`) și viteza (`~27.600 km/h`) din setul TLE local, cu opțiune de sincronizare live.
   - **📍 Markere Planetare și Pini Dedicați pentru Rovere pe Marte și Lună (`SurfaceMarkers.ts`):** pini interactivi pe glob pentru *Roverul Perseverance & Ingenuity*, *Roverul Curiosity (MSL)*, *Craterul Jezero*, *Craterul Gale*, *Chryse Planitia (Viking 1)*, *Olympus Mons* și *Marea Liniștii (Apollo 11)*.
   - **🎯 Misiunile Orbitar & Jurnalul de Bord (`orbitar_badges`):** joc de tip „Vânătoare de Comori Cosmică” în care copiii caută ținte în Sistemul Solar și deblochează insigne.
   - **⛶ Mod Proiecție la Clasă (`F11`) & Navigație Auto-Scroll:** buton dedicat Fullscreen în antet pentru videoproiector/tablă interactivă și derulare orizontală automată a listei de corpuri din bara inferioară (`#hud-bodies-list`) la selectarea oricărui corp în scena 3D.
   - **🎵 Motor de Muzică Ambientală Cosmică Generativă (`SpaceAmbientEngine.ts`, Tasta `M`):** sintetizator polifonic în timp real bazat 100% pe Web Audio API nativ (drone analogic cald în Re Lydian / Si Minor, arpegii stelare *Mystery Shimmer*, Stereo Ping-Pong Delay + Reverb Catedratic de 6 secunde, vânt cosmic și **Auto-Ducking** automat la 25% în timpul sintezei vocale).

7. **Fișe de Studiu A4, Planșe de Colorat & Diplomă de Cadet (`ColoringSvgGenerator.ts` + `DiplomaGenerator.ts` + `PrintManager.ts`):**
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
| **`F1`** | Deschide caseta **„🪐 Despre Orbitar” (`Help -> About`)**, verificarea de actualizări GitHub, licența GPLv3 și Ghidul Interfeței |
| **`Escape`** | Închide ferestrele modale active sau oprește Pilotul Automat |

---

## 👩‍🏫 Ghid pentru Profesori și Părinți: Editarea Datelor Didactice (`public/data/`)

Toate textele, explicațiile, analogiile și întrebările de quiz din **Orbitar** sunt stocate în fișiere JSON statice în folderul `public/data/`, astfel încât profesorii, astronomii amatori sau părinții le pot actualiza ori îmbogăți fără să modifice codul TypeScript:

| Fișier | Conținut |
| :--- | :--- |
| `public/data/solar-system-ro.json` | Cele **34 de corpuri cerești din Sistemul Solar**: Soarele, cele 8 planete, cei **15 sateliți naturali majori** (*Luna, Phobos, Deimos, Io, Europa, Ganymede, Callisto, Mimas, Enceladus, Titan, Iapetus, Miranda, Titania, Triton, Charon*), cele 5 planete pitice, cei 5 asteroizi principali și configurarea centurilor de asteroizi (`belts`). |
| `public/data/missions-ro.json` | Cele **12 misiuni spațiale** (ISS, Hubble, JWST, Euclid, Voyager 1 & 2, New Horizons, Parker Solar Probe, Rosetta, JUICE, Perseverance, Curiosity). |
| `public/data/deep-space-ro.json` | Cele **20 de obiecte din afara Sistemului Solar** (*Norul lui Oort, Proxima Centauri & b, Sirius A & B, TRAPPIST-1, 55 Cancri e, Pleiadele M45, Betelgeuse, Nebuloasa Orion M42, Stâlpii Creației M16, Nebuloasa Carina, Nebuloasa Crabului M1, Nebuloasa Inelul M57, Nebuloasa Helix, Roiul Omega Centauri, Sagittarius A\*, Calea Lactee, Marele Nor al lui Magellan, Galaxia Andromeda M31, Galaxia Triangulum M33, Galaxia Vârtejul M51, Galaxia Sombrero M104*). |
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
- **Node.js** (versiunea 22+ LTS recomandată) și **npm**.
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
npm test            # 48 de teste în 14 suite (node:test + DOM shim, cross-platform)
npm run lint        # Lint Biome (correctness/suspicious/security/performance) pe src, tests, scripts, public
npm run test:smoke  # Smoke test în browser real (Chromium headless via playwright-core, după `npm run build`)
```
Suita execută **48 de teste automate grupate în 14 suite** (`tests/unit/` și `tests/functional/` prin runner-ul cross-platform `scripts/run-tests.mjs`), rulată automat și în **GitHub Actions** (`.github/workflows/ci-tests.yml`, `deploy.yml` și `release-desktop.yml`), împreună cu lint-ul Biome, build-ul de producție și smoke test-ul în browser:
- **`ScaleManager` & `QualityManager`:** transformări de scară Didactică/Reală, detecție hardware HD/Eco și Watchdog FPS;
- **`OrbitalEngine`, `CosmicScaleNavigator` & `ISSTracker`:** efemeride 3D pentru cele 66 de corpuri, propagare SGP4 (`satellite.js`), ancorarea roverelor marțiene pe suprafața rotitoare a lui Marte, orbita L2 pentru JWST/Euclid, culoare orbitale disjuncte în Scara Didactică, filtrele pe categorii și tranziția 3D între cele 3 orizonturi cosmice (*Sistemul Solar, Stele și exoplanete, Calea Lactee și galaxii*);
- **`PlanetMaterialFactory` & `ProceduralModels`:** suport Logarithmic Depth Buffer în shaderele GLSL, Radarul Magellan pe Venus, modelele PBR HD (JWST cu 18 segmente hexagonale, ISS, Hubble, Voyager, galaxii spirale, găuri negre și nebuloase) și centurile `THREE.InstancedMesh`;
- **`SpacecraftPilot` & `CockpitHUD`:** cele 3 nave spațiale (*Vlaicu-1, Coandă-X, Luceafărul*), pornirea automată a zborului la selectarea destinației din listă, fizica timpului pe ceasul pământesc, **Saltul Hiperspațial (`⚡ Salt Hiperspațial`)** către stele și galaxii și raportul Calculatorului de Bord la sosire;
- **`RomanianSpeechNormalizer` & `SpeechManager`:** normalizarea numerelor cu separator de mii, a temperaturilor negative și a termenilor astronomici + verificarea celor 132 de fișiere MP3 neurale pre-generate;
- **`SpaceAmbientEngine`, `ColoringSvgGenerator` & `DiplomaGenerator`:** sintetizatorul Web Audio API, planșele SVG alb-negru A4 (inclusiv pentru noile luni, exoplanete, găuri negre și galaxii) și diplomele personalizate;
- **`LabelProjector`:** proiecția optimizată a etichetelor 2D (doar `translate3d`, fără layout per frame; scrieri DOM doar la schimbare; vizibilitatea pe orizont centralizată);
- **`SurfaceMarkers`, `CameraController`, `StudyDrawer`, `OrbitarLab`, `HeaderHud`, `BottomDock`, `LightSpeedRuler`, `OrbitarMissions`, `PrintManager`, `LicenseModal` (`UpdateChecker`) & `OnboardingTutorial`:** teste funcționale de integrare UI/DOM/3D, verificarea actualizărilor pe GitHub Releases și tutorialul interactiv la prima pornire;
- **Integritatea proiectului, Tauri v2 & Conformitate GPLv3:** verificarea antetului `SPDX-License-Identifier: GPL-3.0-or-later` pe toate fișierele sursă, validitatea schemei `src-tauri/tauri.conf.json`, a bazelor de date JSON, prezența celor **24 de fotografii oficiale NASA / ESA / JWST / Hubble / EHT** (`public/textures/nasa/`), a celor **39 de hărți științifice 2K HD** (`public/textures/hd/`) și a celor **132 de fișiere audio neurale** (`public/audio/tts/`).

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

> **Notă de securitate:** aplicația desktop Tauri rulează cu un **CSP restrictiv** (vezi `app.security.csp` în `src-tauri/tauri.conf.json`): `default-src 'self'`, `data:`/`blob:` pentru texturi, audio și exporturi, protocoalele interne Tauri/IPC (`ipc:`, `tauri:`, `http://tauri.localhost`, `http://ipc.localhost`) și `https://api.github.com` în `connect-src` strict pentru verificarea opțională la cerere a versiunilor noi în caseta „Despre Orbitar”. Întreaga aplicație funcționează 100% autonom și offline.

### 6. Actualizarea hărților științifice HD, a fotografiilor NASA și a vocii neurale (opțional)
```bash
npm run fetch:hd-textures   # Descarcă/regenerează cele 39 de hărți planetare, ale lunilor și stelare 2K în public/textures/hd/
npm run fetch:nasa-media    # Descarcă cele 24 de fotografii oficiale NASA / ESA / JWST / Hubble / EHT în public/textures/nasa/
npm run generate:tts        # Generează cele 132 de fișiere audio neurale în limba română în public/audio/tts/
```

---

## 👥 Contribuitori & Atribuiri Resurse

- **Dragoş Iorgulescu** (`@diorgulescu`) — Concept, arhitectură și coordonare proiect
- **Google Antigravity (Gemini)** — Dezvoltare asistată în pereche (Pair Programming)
- **Mistral Vibe (Mistral AI)** — Revizuire arhitecturală a doua opinie, optimizări de performanță (proiecția etichetelor 2D), hardening PWA/Tauri (CSP, cache unic) și tooling (lint Biome, smoke test în browser)
- **Atribuire Hărți Științifice, Fototeca NASA / ESA / JWST și Texturi Planetare HD (2K):** **NASA / JPL-Caltech / STScI / JWST / Hubble / Event Horizon Telescope (EHT) / ESO / USGS Astrogeology / SDO / LRO / MOLA / Magellan / Cassini / New Horizons / Dawn / ESA (Public Domain & CC-BY 4.0), CelestiaContent (GNU GPLv2+) & Solar System Scope (CC-BY 4.0)** (`npm run fetch:hd-textures` & `npm run fetch:nasa-media`)

---

## ⚖️ Licență — GNU General Public License v3.0 (GPL-3.0-or-later)

Acest proiect este software liber: îl puteți redistribui și/sau modifica în conformitate cu termenii **Licenței Publice Generale GNU (GNU General Public License)** așa cum este publicată de Free Software Foundation, fie versiunea 3 a Licenței, fie (la alegerea dumneavoastră) orice versiune ulterioară.

Consultați fișierul [LICENSE](./LICENSE) pentru textul integral al licenței GNU GPLv3.

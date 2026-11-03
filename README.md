# 🪐 Orbitar — Planetariu Didactic Interactiv

[![Licență: GPL v3](https://img.shields.io/badge/Licen%C8%9B%C4%83-GPLv3-00f0ff.svg)](./LICENSE)
[![Limba: Română](https://img.shields.io/badge/Limba-Rom%C3%A2n%C4%83%20(6--12%20ani)-ffb703.svg)](#)
[![100% Offline PWA](https://img.shields.io/badge/PWA-100%25%20Offline%20%26%20Zero%20Telemetrie-22c55e.svg)](#)

**Orbitar** este un planetariu didactic interactiv 3D în limba română, conceput special pentru copiii cu vârste între **6 și 12 ani**, pentru orele de științe de la școală și pentru explorare acasă pe tabletă sau laptop.

Proiectul este **100% Open-Source**, licențiat sub **GNU General Public License v3.0 (`GPL-3.0-or-later`)**, funcționează **complet autonom și offline** după încărcare (PWA cu Service Worker) și nu conține niciun fel de telemetrie, reclame sau scripturi de pe CDN-uri externe.

---

## ✨ Funcționalități principale

1. **Simulare Astronomică 3D Autentică (`astronomy-engine` + `satellite.js` + `Three.js`):**
   - **Soarele + cele 8 planete** (*Mercur, Venus, Pământ, Marte, Jupiter, Saturn, Uranus, Neptun*) cu poziții heliocentrice 3D reale.
   - **Sateliți naturali majori:** *Luna, Io, Europa, Ganymede, Callisto, Titan, Enceladus*.
   - **Planete pitice și asteroizi principali:** *Pluto, Ceres, Eris, Haumea, Makemake, Vesta, Pallas, Bennu, Apophis, Psyche*.
   - **Centura de Asteroizi și Centura Kuiper:** mii de corpuri randate fluent la 60 FPS prin `THREE.InstancedMesh`.
   - **Misiuni și sonde spațiale 3D:** *Stația Spațială Internațională (ISS), Telescopul Hubble, James Webb (JWST), Euclid, Voyager 1 & 2, New Horizons, Parker Solar Probe, Rosetta, JUICE* și roverele marțiene *Perseverance (cu elicopterul Ingenuity)* și *Curiosity*.

2. **Două niveluri de studiu comutabile în timp real (`orbitar_age_tier`):**
   - **Micul Explorator (6–8 ani):** explicații calde pe înțelesul copiilor, analogii vizuale, curiozități, tabel cu durata călătoriei (*cu mașina, avionul, racheta, viteza luminii*) și buton **„🔊 Citește-mi”** (sinteză vocală nativă în limba română `ro-RO`).
   - **Cadet Orbitar (9–12 ani):** date fizice exacte, structură internă pe straturi sau instrumente științifice la bord, istoricul explorării și întrebări grilă interactive (Quiz).

3. **Scară Didactică vs. Scară Reală (`orbitar_scale_mode`):**
   - **Scara Didactică (implicită):** mărește logaritmic planetele și sondele pentru a fi ușor de găsit și selectat pe ecran tactil.
   - **Scara Reală:** respectă proporțiile fizice exacte dintre razele planetelor și distanțele în Unități Astronomice (UA).

4. **Laboratorul Orbitar & Unelte Interactive:**
   - **⚖️ Cât cântăresc și cât de sus sar aici?** — calculator interactiv de greutate și săritură în funcție de gravitația locală.
   - **🎂 Câți ani am pe această lume?** — conversia vârstei în ani orbitali și zile solare locale.
   - **💿 Discul de Aur Voyager (1977):** redarea salutului istoric în limba română (*„Salutări la toată lumea!”*).
   - **🚀 Rigla cu Viteza Luminii:** măsoară distanța reală în UA și kilometri între oricare două corpuri și animează în 3D un foton/semnal radio călătorind între ele.
   - **🛰️ Tracker SGP4 pentru ISS & Hubble:** calculează 100% offline latitudinea, longitudinea, altitudinea (`~420 km`) și viteza (`~27.600 km/h`) din setul TLE local, cu opțiune de sincronizare live.
   - **📍 Markere Planetare pe Marte și Lună:** pini interactivi pe glob pentru *Craterul Jezero (Perseverance)*, *Craterul Gale (Curiosity)*, *Chryse Planitia (Viking 1)* și *Marea Liniștii (Apollo 11)*.
   - **🎯 Misiunile Orbitar & Jurnalul de Bord (`orbitar_badges`):** joc de tip „Vânătoare de Comori Cosmică” în care copiii caută ținte în Sistemul Solar și deblochează insigne.

5. **Fișe de Studiu A4 & Planșe de Colorat Vectoriale (`ColoringSvgGenerator.ts` + `PrintManager.ts`):**
   - **Generator vectorial SVG „line-art” (Eco-Print Alb-Negru):** ilustrații cu contururi negre clare pe fundal alb (`#ffffff`), fără degradeuri gri, ideale pentru imprimare cu consum minim de toner și pentru a fi colorate cu creioane sau carioci.
   - **3 Șabloane A4 în limba română (`@media print`):**
     - *Șablonul A („Fișă de Studiu & Colorat”)*: antet cu câmpuri pentru numele elevului și dată, tabel cu datele rapide, rezumat adaptiv, ilustrația SVG de colorat și întrebarea Quiz cu căsuțe de bifat cu creionul.
     - *Șablonul B („Planșă de Colorat A4 — Doar Desen Mare”)*: 85% din pagină dedicată desenului de colorat (pentru orice corp/sondă sau **Harta Sistemului Solar de Colorat A4 Landscape**), cu titlu în litere conturate de colorat și curiozități în subsol.
     - *Șablonul C („Jurnal de Misiune — Tabelul Comparativ al Planetelor”)*: sinteză cu toate planetele pe o singură pagină + mini-harta de colorat.
   - **Export local:** descărcare directă în format `.svg` sau `.png` de înaltă rezoluție.

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

## 🛠️ Instrucțiuni de Instalare, Dezvoltare și Compilare

### Cerințe preliminare
- **Node.js** (versiunea 18+ sau 20+) și **npm**.

### 1. Instalarea dependențelor
```bash
npm install
```

### 2. Pornirea serverului local de dezvoltare
```bash
npm run dev
```
Aplicația va porni la adresa `http://localhost:5173/`.

### 3. Compilarea versiunii de producție (pentru GitHub Pages / server static)
```bash
npm run build
```
Fișierele optimizate și pregătite pentru utilizare offline sunt generate în directorul `dist/` (cu căi relative `base: './'` configurate în `vite.config.ts`).

Pentru a testa local versiunea de producție compilată:
```bash
npm run preview
```

---

## 👥 Contribuitori

- **Dragoş Iorgulescu** (`@diorgulescu`) — Concept, arhitectură și coordonare proiect
- **Google Antigravity (Gemini)** — Dezvoltare asistată în pereche (Pair Programming)

---

## ⚖️ Licență — GNU General Public License v3.0 (GPL-3.0-or-later)

Acest proiect este software liber: îl puteți redistribui și/sau modifica în conformitate cu termenii **Licenței Publice Generale GNU (GNU General Public License)** așa cum este publicată de Free Software Foundation, fie versiunea 3 a Licenței, fie (la alegerea dumneavoastră) orice versiune ulterioară.

Consultați fișierul [LICENSE](./LICENSE) pentru textul integral al licenței GNU GPLv3.

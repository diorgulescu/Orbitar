# 📖 Orbitar — Enciclopedia Cosmică Ilustrată (Ediția LaTeX & PDF)

[![Licență: GPL v3](https://img.shields.io/badge/Licen%C8%9B%C4%83-GPLv3-00f0ff.svg)](./LICENSE)
[![Format: LaTeX & PDF](https://img.shields.io/badge/Format-LaTeX%20%26%20PDF%20A4-ffb703.svg)](./orbitar-carte.pdf)

Acest director (`carte/`) conține codul sursă **LaTeX**, scripturile de sincronizare și ediția compilată **PDF** (`orbitar-carte.pdf`) a cărții didactice **„Orbitar — Enciclopedia Cosmică Ilustrată: Sistemul Solar, Misiuni Spațiale, Exoplanete și Galaxii”**, bazată pe întreaga bază de cunoștințe a planetariului interactiv 3D **Orbitar**.

Întreaga lucrare (codul sursă `.tex`, diagramele vectoriale TikZ, scripturile de generare și cartea `.pdf`) este distribuită sub licența liberă **GNU General Public License v3.0 (`GPL-3.0-or-later`)**, putând fi folosită, tipărită, distribuită și adaptată liber în școli, biblioteci, cluburi de astronomie sau acasă.

---

## 📚 Ce conține cartea (`orbitar-carte.pdf` — 176 de pagini A4, calibrată pentru Print-on-Demand)

Cartea acoperă toate cele **66 de corpuri cerești, sateliți naturali, planete pitice, asteroizi, misiuni spațiale, stele, exoplanete, nebuloase și galaxii** din **Orbitar**, redactate într-o proză enciclopedică accesibilă și fluentă, însoțite de **casete cu repere astrofizice esențiale**, **globuri 3D randate sferic/elipsoidal cu iluminare și inele** + **hărți științifice (planigloburi desfășurate) și fotografii oficiale NASA / ESA / JWST / Hubble / EHT**, diagrame vectoriale TikZ, tabele astrofizice și **66 de întrebări grilă (Quiz)** cu barem complet.

Ediția PDF este structurată conform standardelor editoriale **Print-on-Demand** (precum **Blurb.com PDF-to-Book**), având numărul total de pagini multiplu de 4 ($176 = 44 \times 4\text{ pagini}$) și incluzând:
- **Coperta I (Coperta-față)** aerisită, cu titlul *ORBITAR*, caseta neagră *Enciclopedia Cosmică Ilustrată* și ilustrația sistemului orbital.
- **Paginile preliminare de interior (*Frontmatter*):** Coperta a II-a interioară albă, Pagina de gardă (*Semititlu*), Frontispiciu ilustrat, Pagina de titlu interioară completă, Caseta tehnică / CIP & Specificații de tipar, Pagina de dedicație, Cuprinsul și pagina intermediară de gardă înainte de Capitolul 1.
- **Paginile finale și Coperta a IV-a (*Coperta-spate*):** Jurnalul Astronomic al Cititorului (fișă de observații), Colofonul tipografic, paginile de gardă finale (Coperta a III-a interioară albă) și **Coperta a IV-a (Coperta-spate)** complet ilustrată, cu sinopsisul lucrării.

### Structura pe capitole:

1. **Capitolul 1 — Introducere în Universul Orbitar (`capitole/00-introducere.tex`):**
   - Cum este organizată fiecare fișă enciclopedică a cărții.
   - Cele **3 Orizonturi Cosmice** din Orbitar (*Sistemul Solar*, *Stele și Exoplanete*, *Calea Lactee și Galaxii*).
   - Unitățile de măsură ale astronomilor ($1\text{ UA}$, viteza luminii $1c$, anul-lumină, masa $M_\oplus$ și gravitația $g_\oplus$) și diferența dintre *Scara Didactică* și *Scara Reală*.
2. **Capitolul 2 — Steaua Noastră, Planetele și Sateliții Lor Naturali (`capitole/01-planetele-sistemului-solar.tex`):**
   - Diagrama arhitecturii Sistemului Solar și tabelele sinoptice comparative pentru Soare, cele 8 planete și cei 15 sateliți naturali majori.
   - Fiecare corp ceresc este ilustrat atât printr-o **vedere 3D cu formă de planetă/glob (inclusiv inelele 3D pentru Saturn și Uranus)**, cât și prin **planiglobul său desfășurat**.
   - Fișe enciclopedice complete pentru **Soare** și cele **8 planete**, fiecare însoțită direct în subsecțiunile sale de **sateliții săi naturali (lunile)**:
     - **Soarele**, **Mercur**, **Venus** (*cu explicația cartografierii sub nori prin Radarul Magellan*),
     - **Pământul** + *Luna (împreună cu reperele istorice ale aselenizărilor Apollo 11, 15 și 17)*,
     - **Marte** + *Phobos și Deimos*,
     - **Jupiter** + *Io, Europa, Ganymede și Callisto*,
     - **Saturn** + *Mimas, Enceladus, Titan și Iapetus*,
     - **Uranus** + *Miranda și Titania*,
     - **Neptun** + *Triton*.
3. **Capitolul 3 — Centuri Cosmice, Planete Pitice și Asteroizi (`capitole/02-corpuri-ceresti-sistem-solar.tex`):**
   - **Centura Principală de Asteroizi** ($2{,}15\text{–}3{,}25\text{ UA}$) și **Centura Kuiper** ($30{,}5\text{–}49\text{ UA}$).
   - **Cele 5 planete pitice și satelitul binar Charon:** *Ceres, Pluto + Charon (asociat direct cu Pluto), Haumea, Makemake și Eris*.
   - **Cei 5 asteroizi principali:** *4 Vesta, 2 Pallas, 16 Psyche, 101955 Bennu și 99942 Apophis*.
4. **Capitolul 4 — Obiecte Lansate de Om: Stații Spațiale, Telescoape, Sonde și Rovere (`capitole/03-misiuni-spatiale.tex`):**
   - Orbitele speciale: Orbita Joasă a Pământului (LEO) cu propagarea SGP4 / NORAD TLE și **Punctul Lagrange L2** ($1{,}5\text{ mil. km}$).
   - Fișele complete pentru cele **12 misiuni spațiale**: *Stația Spațială Internațională (ISS), Telescopul Spațial Hubble, Telescopul Spațial James Webb (JWST), Telescopul Spațial Euclid, Voyager 1, Voyager 2 (inclusiv povestea Discului de Aur din 1977 și salutul în limba română „Salutări la toată lumea!”), New Horizons, Parker Solar Probe, Rosetta & Philae, JUICE, Roverul Perseverance & Ingenuity și Roverul Curiosity (MSL)*.
   - **Atlasul Reperelor Geografice de pe Marte:** *Craterul Jezero, Craterul Gale & Muntele Sharp, Vulcanul Olympus Mons ($21{,}9\text{ km}$) și Chryse Planitia (Viking 1)*.
5. **Capitolul 5 — Dincolo de Soare: Stele Apropiate și Exoplanete (`capitole/04-stele-si-exoplanete.tex`):**
   - Cum descoperă astronomii exoplanetele (*Metoda Tranzitului* și *Metoda Vitezei Radiale*), ce este *Zona Locuibilă (Goldilocks)* și cum funcționează „mașina timpului cu viteza luminii” (*în ce an sau epocă istorică a plecat lumina spre Pământ*).
   - Fișele complete pentru: *Norul lui Oort, Proxima Centauri & Exoplaneta Proxima b ($4{,}24\text{ a.l.}$), Sirius A & Pitica Albă Sirius B ($8{,}6\text{ a.l.}$), Sistemul TRAPPIST-1 cu 7 exoplanete stâncoase ($40\text{ a.l.}$), Super-Pământul de lavă 55 Cancri e ($41\text{ a.l.}$), Roiul Stelar Pleiadele M45 („Cloșca cu Pui”, $444\text{ a.l.}$) și Supergiganta Roșie Betelgeuse ($640\text{ a.l.}$)*.
6. **Capitolul 6 — Nebuloase, Găuri Negre și Galaxii (`capitole/05-nebuloase-si-galaxii.tex`):**
   - Ciclul de viață al stelelor și structura galaxiei noastre (cu poziția Sistemului Solar în Brațul Orion la $26.000\text{ de ani-lumină}$ de centru).
   - Fișele complete pentru: *Nebuloasa Orion (M42), Stâlpii Creației din Nebuloasa Vulturului (M16), Nebuloasa Carina (NGC 3372), Nebuloasa Crabului (M1), Nebuloasa Inelul (M57), Nebuloasa Helix (NGC 7293), Gaura Neagră Supermasivă Sagittarius A\*, Calea Lactee, Marele Nor al lui Magellan (LMC), Galaxia Andromeda (M31), Galaxia Triunghiului (M33), Galaxia Vâltoarea (M51) și Galaxia Sombrero (M104)*.
7. **Capitolul 7 — Laboratorul Orbitar, La Manșa Navei și Misiunile Cadetului (`capitole/06-laborator-nave-si-activitati.tex`):**
   - **La Manșa Navei (Mod Pilot):** cele 3 astronave românești (*Racheta „Vlaicu-1”*, *Nava „Coandă-X”* și *Astronava „Luceafărul”*) și tabelul comparativ al duratelor de zbor în Sistemul Solar și către stele.
   - **Laboratorul Orbitar:** tabelul complet al greutății și înălțimii săriturii pe toate cele 34 de corpuri din Sistemul Solar (pentru un copil de $35\text{ kg}$ care sare $40\text{ cm}$ pe Pământ) și tabelul vârstei în ani și zile locale (pentru un copil de $10\text{ ani}$).
   - **Misiunile Orbitar & Jurnalul de Bord:** cele 6 provocări și insigne oficiale.
   - **Ghidul Fonetic de Pronunție Astronomică în Limba Română.**
8. **Capitolul 8 — Baremul Complet al celor 66 de Întrebări Quiz și Glosar Astronomic (`capitole/07-barem-quiz-si-glosar.tex`):**
   - Tabelul centralizat cu toate răspunsurile corecte și explicațiile pentru cele 66 de întrebări grilă.
   - Glosarul termenilor astronomici și spațiali.

---

## 🗂️ Structura Directorului `carte/`

```text
carte/
├── orbitar-carte.pdf             # Cartea finală compilată în format PDF (A4, gata de citit/tipărit)
├── orbitar-carte.tex             # Documentul LaTeX principal (preambul, stiluri, copertă TikZ, cuprins)
├── capitole/                     # Fișierele sursă LaTeX modulare pe capitole
│   ├── 00-introducere.tex
│   ├── 01-planetele-sistemului-solar.tex
│   ├── 02-corpuri-ceresti-sistem-solar.tex
│   ├── 03-misiuni-spatiale.tex
│   ├── 04-stele-si-exoplanete.tex
│   ├── 05-nebuloase-si-galaxii.tex
│   ├── 06-laborator-nave-si-activitati.tex
│   └── 07-barem-quiz-si-glosar.tex
├── genereaza-capitole.mjs        # Script Node.js care sincronizează capitolele .tex din ../public/data/*.json
├── genereaza-globuri.mjs         # Raytracer 3D Node.js care randează globurile sferice/elipsoidale cu inele în imagini/globuri/
├── imagini/                      # Hărțile științifice, fotografiile NASA/ESA și globurile 3D (imagini/globuri/*.jpg)
├── build.sh                      # Script automat de regenerare + compilare PDF (2 treceri pdflatex)
├── Makefile                      # Reguli Make standard (make, make regen, make clean)
├── LICENSE                       # Textul integral al licenței GNU General Public License v3.0
└── README.md                     # Acest ghid de prezentare și reconstrucție
```

---

## 🛠️ Cum să reconstruiești cartea PDF la nevoie

### Cerințe preliminare
1. O distribuție **LaTeX** instalată pe sistem care să ofere comanda `pdflatex` și pachetele standard (`tcolorbox`, `tikz`, `babel-romanian`, `lmodern`, `geometry`, `booktabs`, `longtable`, `tabularx`, `hyperref`):
   - **macOS:** [MacTeX](https://www.tug.org/mactex/) sau prin Homebrew: `brew install texlive`
   - **Ubuntu / Debian:** `sudo apt install texlive-latex-base texlive-latex-recommended texlive-latex-extra texlive-pictures texlive-lang-european texlive-fonts-recommended`
   - **Windows:** [TeX Live](https://www.tug.org/texlive/) sau [MiKTeX](https://miktex.org/)
2. *(Opțional, doar dacă ai modificat bazele de date JSON din `../public/data/` și vrei regenerarea automată a fișierelor `.tex`)*: **Node.js** (v18+).

### Varianta 1 — Din rădăcina proiectului (prin `npm`)
```bash
npm run build:book
```

### Varianta 2 — Direct din directorul `carte/` (cu `build.sh` sau `make`)
```bash
cd carte
./build.sh
# sau:
make
```
Scriptul `build.sh`:
1. Rulează `node ./genereaza-capitole.mjs` (dacă Node.js este disponibil) pentru a prelua eventualele actualizări din `../public/data/solar-system-ro.json`, `../public/data/missions-ro.json`, `../public/data/deep-space-ro.json` și `../public/data/tle-iss.json`.
2. Execută două treceri succesive de `pdflatex` asupra fișierului `orbitar-carte.tex` (pentru generarea corectă a Cuprinsului și a referințelor încrucișate).
3. Șterge fișierele temporare de compilare (`.aux`, `.log`, `.out`, `.toc`), păstrând directorul curat.

### Varianta 3 — Compilare manuală exclusiv din fișierele `.tex` (fără Node.js)
Dacă ai editat manual fișierele din `carte/capitole/*.tex` și vrei doar să recompilezi PDF-ul fără a le suprascrie din JSON:
```bash
cd carte
./build.sh --no-regen
# sau direct cu pdflatex:
pdflatex orbitar-carte.tex
pdflatex orbitar-carte.tex
```

---

## ⚖️ Licență — GNU General Public License v3.0 (`GPL-3.0-or-later`)

Această carte și toate fișierele sale sursă sunt software și documentație liberă, licențiate sub **GNU General Public License v3.0 (`GPL-3.0-or-later`)**. Consultați fișierul [LICENSE](./LICENSE) pentru termenii compleți.

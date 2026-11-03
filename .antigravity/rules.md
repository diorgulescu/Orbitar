# Reguli de Sistem și Arhitectură — ORBITAR (Planetariu Didactic Interactiv)

## 1. Identitatea Proiectului
- **Nume oficial:** Orbitar
- **Subtitlu UI:** Planetariu Didactic Interactiv
- **Nume pachet / slug:** `orbitar`
- **Public țintă:** Copii cu vârste între 6 și 12 ani (limba română).
- **Chei LocalStorage:** Toate datele salvate local (progres quiz, insigne, preferințe scară/vârstă) vor folosi prefixul `orbitar_` (ex: `orbitar_age_tier`, `orbitar_badges`).

## 2. Licențiere și Etică Open-Source (STRICT)
- Proiectul **Orbitar** este licențiat integral sub **GNU General Public License v3.0 (GPL-3.0-or-later)**.
- Fiecare fișier sursă (`.ts`, `.css`, `.sh`) TREBUIE să înceapă cu antetul SPDX:
  `// SPDX-License-Identifier: GPL-3.0-or-later`
- Toate dependențele din `package.json` trebuie să fie strict Open-Source (MIT, BSD, Apache-2.0, ISC, MPL-2.0, LGPL sau GPLv3).
- **ZERO TELEMETRIE & ZERO CDN-URI EXTERNE:** Nu încărca fonturi de pe Google Fonts, nu folosi scripturi de pe CDN-uri terțe și nu adăuga analytics. Orbitar trebuie să funcționeze 100% autonom și offline după încărcare.

## 3. Arhitectură Tehnică
- **Stack:** Vite + TypeScript (strict mode) + Three.js + `astronomy-engine` + `satellite.js`.
- **UI / HUD:** Vanilla TypeScript modular + CSS nativ (Bento Grid HUD, Dark Mode nativ, accente Cyan `#00f0ff` și Chihlimbar `#ffb703`). Fără React, Vue sau Tailwind.
- **Date didactice:** Stocate exclusiv în fișiere JSON statice în `/public/data/` pentru a putea fi editate ușor.
- **Deployment:** Aplicație statică configurată pentru GitHub Pages (`base: './'` în `vite.config.ts`).

## 4. Standarde Lingvistice și Didactice (6–12 ani)
- Toată interfața și toate datele sunt în **limba română corectă**, cu diacritice obligatorii (ă, â, î, ș, ț).
- Niveluri de studiu comutabile în timp real:
  - `junior` (**Micul Explorator: 6–8 ani**): analogii vizuale, propoziții scurte, suport Text-to-Speech (`ro-RO`).
  - `cadet` (**Cadet Orbitar: 9–12 ani**): date fizice reale, structură internă, mecanică orbitală, calculatoare interactive.


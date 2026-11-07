# SPDX-License-Identifier: GPL-3.0-or-later
#!/usr/bin/env bash
# =============================================================================
# Script de reconstrucție pentru cartea „Orbitar — Enciclopedia Cosmică Ilustrată”
# 1. Sincronizează (opțional, dacă Node.js este instalat) capitolele .tex din ../public/data/
# 2. Compilează orbitar-carte.tex în orbitar-carte.pdf (2 treceri pdflatex pentru Cuprins)
# 3. Curăță fișierele auxiliare temporare (.aux, .log, .out, .toc)
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [[ "${1:-}" != "--no-regen" ]] && command -v node >/dev/null 2>&1; then
  if [[ ! -f "imagini/globuri/saturn.jpg" ]] || [[ "${1:-}" == "--regen-globes" ]]; then
    echo "🪐 [0/3] Randare globuri 3D pentru planete și corpuri cerești (genereaza-globuri.mjs)..."
    node ./genereaza-globuri.mjs
  fi
  echo "🔄 [1/3] Regenerare fișiere sursă LaTeX din bazele de date Orbitar (genereaza-capitole.mjs)..."
  node ./genereaza-capitole.mjs
else
  echo "ℹ️  [1/3] Se utilizează fișierele sursă .tex existente din carte/..."
fi

if ! command -v pdflatex >/dev/null 2>&1; then
  echo "❌ Eroare: comanda 'pdflatex' nu a fost găsită în PATH." >&2
  echo "   Instalați o distribuție TeX Live / MacTeX / MiKTeX și reîncercați." >&2
  exit 1
fi

echo "📄 [2/3] Compilare LaTeX -> PDF (trecerea 1/2 pentru colectarea referințelor și a cuprinsului)..."
pdflatex -interaction=nonstopmode -halt-on-error orbitar-carte.tex >/dev/null

echo "📄 [3/3] Compilare LaTeX -> PDF (trecerea 2/2 pentru paginarea finală a cuprinsului)..."
pdflatex -interaction=nonstopmode -halt-on-error orbitar-carte.tex >/dev/null

if [[ "${1:-}" != "--keep-temp" ]]; then
  rm -f orbitar-carte.aux orbitar-carte.log orbitar-carte.out orbitar-carte.toc \
        orbitar-carte.lof orbitar-carte.lot orbitar-carte.fls orbitar-carte.fdb_latexmk \
        orbitar-carte.synctex.gz capitole/*.aux
fi

echo "✅ Cartea a fost generată cu succes: $SCRIPT_DIR/orbitar-carte.pdf"

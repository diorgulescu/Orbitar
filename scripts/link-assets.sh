# SPDX-License-Identifier: GPL-3.0-or-later
#!/usr/bin/env bash
# ==============================================================================
# Orbitar — Script de legare (symlink) a texturilor PBR 2K / 4K / HD către Godot 4
# Leagă fără duplicare în Git fișierele din public/textures/ către game/assets/textures/
# astfel încât atât aplicația web, cât și proiectul Godot 4 să partajeze aceleași resurse.
# ==============================================================================

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_TEX_DIR="${ROOT_DIR}/public/textures"
DST_TEX_DIR="${ROOT_DIR}/game/assets/textures"

mkdir -p "${DST_TEX_DIR}" "${DST_TEX_DIR}/hd" "${DST_TEX_DIR}/2k" "${DST_TEX_DIR}/4k" "${DST_TEX_DIR}/nasa"

count_2k=0
count_hd=0
count_4k=0
count_nasa=0

# 1. Legăm texturile de bază (public/textures/*.jpg, *.png) în game/assets/textures/ și game/assets/textures/2k/
for src_file in "${SRC_TEX_DIR}"/*.jpg "${SRC_TEX_DIR}"/*.png; do
  [ -e "${src_file}" ] || continue
  fname="$(basename "${src_file}")"
  ln -sfn "../../../public/textures/${fname}" "${DST_TEX_DIR}/${fname}"
  ln -sfn "../../../../public/textures/${fname}" "${DST_TEX_DIR}/2k/${fname}"
  ln -sfn "../../../../public/textures/${fname}" "${DST_TEX_DIR}/4k/${fname}"
  count_2k=$((count_2k + 1))
done

# 2. Legăm texturile științifice PBR HD / 2K / 4K (public/textures/hd/*)
if [ -d "${SRC_TEX_DIR}/hd" ]; then
  for src_file in "${SRC_TEX_DIR}/hd"/*.jpg "${SRC_TEX_DIR}/hd"/*.png; do
    [ -e "${src_file}" ] || continue
    fname="$(basename "${src_file}")"
    ln -sfn "../../../../public/textures/hd/${fname}" "${DST_TEX_DIR}/hd/${fname}"
    ln -sfn "../../../../public/textures/hd/${fname}" "${DST_TEX_DIR}/2k/${fname}"
    ln -sfn "../../../../public/textures/hd/${fname}" "${DST_TEX_DIR}/4k/${fname}"
    count_hd=$((count_hd + 1))
    count_4k=$((count_4k + 1))
  done
fi

# 3. Dacă există un subdirector dedicat public/textures/4k, suprascriem symlink-urile din 4k/ cu variantele 4K native
if [ -d "${SRC_TEX_DIR}/4k" ]; then
  for src_file in "${SRC_TEX_DIR}/4k"/*.jpg "${SRC_TEX_DIR}/4k"/*.png; do
    [ -e "${src_file}" ] || continue
    fname="$(basename "${src_file}")"
    ln -sfn "../../../../public/textures/4k/${fname}" "${DST_TEX_DIR}/4k/${fname}"
  done
fi

# 4. Legăm imaginile NASA de referință (public/textures/nasa/*)
if [ -d "${SRC_TEX_DIR}/nasa" ]; then
  for src_file in "${SRC_TEX_DIR}/nasa"/*.jpg "${SRC_TEX_DIR}/nasa"/*.png; do
    [ -e "${src_file}" ] || continue
    fname="$(basename "${src_file}")"
    ln -sfn "../../../../public/textures/nasa/${fname}" "${DST_TEX_DIR}/nasa/${fname}"
    count_nasa=$((count_nasa + 1))
  done
fi

echo "🔗 [Orbitar] Texturile PBR au fost legate cu succes în game/assets/textures/:"
echo "   • Texturi 2K de bază: ${count_2k}"
echo "   • Hărți științifice PBR HD/2K: ${count_hd}"
echo "   • Profiluri 4K: ${count_4k}"
echo "   • Imagini NASA: ${count_nasa}"

# SPDX-License-Identifier: GPL-3.0-or-later
#!/usr/bin/env bash
# ==============================================================================
# Orbitar — Pipeline de Descărcare și Optimizare Texturi Științifice HD (2K)
# Surse: NASA / USGS / JPL (Public Domain) via CelestiaContent (GNU GPL)
#        + Generator Științific Multi-Layer 2K (fallback offline)
# ==============================================================================

set -u

HD_DIR="public/textures/hd"
ECO_DIR="public/textures"
mkdir -p "$HD_DIR" "$ECO_DIR"

FORCE_UPDATE="${1:-}"
CELESTIA_HIRES="https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/hires"
CELESTIA_MEDRES="https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres"

echo "🪐 Inițializare pipeline texturi științifice NASA/USGS/Celestia HD în $HD_DIR/ ..."

fetch_and_convert() {
  local filename="$1"
  local url="$2"
  local max_dim="${3:-2048}"
  local target="$HD_DIR/$filename"
  local ext="${filename##*.}"
  local src_ext="${url##*.}"
  local tmp="${target}.download.${src_ext}"

  if [ "$FORCE_UPDATE" != "--force" ] && [ -f "$target" ]; then
    local existing_size
    existing_size=$(wc -c < "$target" 2>/dev/null | tr -d ' ')
    if [ "${existing_size:-0}" -gt 15000 ]; then
      echo "  [OK] $filename există deja (${existing_size} bytes)."
      return 0
    fi
  fi

  if command -v curl >/dev/null 2>&1; then
    if curl -fsSL --connect-timeout 8 --max-time 45 -A "Orbitar-Planetarium/1.0 (GNU GPLv3; Educational)" "$url" -o "$tmp" 2>/dev/null; then
      local size
      size=$(wc -c < "$tmp" 2>/dev/null | tr -d ' ')
      if [ "${size:-0}" -gt 8000 ] && file "$tmp" 2>/dev/null | grep -qiE "jpeg|png|image"; then
        if [ "$ext" = "jpg" ] && [ "$src_ext" = "png" ] && command -v ffmpeg >/dev/null 2>&1; then
          # Păstrăm canalele RGB intacte fără a compune canalul Alpha (masca speculară Celestia) pe alb
          ffmpeg -y -i "$tmp" -vf "lutrgb=a=255,scale=${max_dim}:-1" -frames:v 1 -q:v 2 "$target" >/dev/null 2>&1 || mv "$tmp" "$target"
          if [ "$filename" = "earth_albedo.jpg" ]; then
            # Extragem din canalul Alpha al Pământului harta exactă de rugozitate ocean/uscat (ocean=negru lucios, continente=alb mat)
            ffmpeg -y -i "$tmp" -vf "alphaextract,negate,scale=${max_dim}:-1" -frames:v 1 -q:v 3 "$HD_DIR/earth_ocean_roughness.jpg" >/dev/null 2>&1 || true
          fi
          rm -f "$tmp"
        elif command -v sips >/dev/null 2>&1; then
          if [ "$ext" = "jpg" ]; then
            sips -s format jpeg -s formatOptions 85 -Z "$max_dim" "$tmp" --out "$target" >/dev/null 2>&1 || mv "$tmp" "$target"
          elif [ "$ext" = "png" ]; then
            sips -s format png -Z "$max_dim" "$tmp" --out "$target" >/dev/null 2>&1 || mv "$tmp" "$target"
          else
            mv "$tmp" "$target"
          fi
          rm -f "$tmp"
        else
          mv "$tmp" "$target"
        fi
        local final_size
        final_size=$(wc -c < "$target" 2>/dev/null | tr -d ' ')
        echo "  [DESCĂRCAT & OPTIMIZAT] $filename (${final_size} bytes)"
        return 0
      fi
    fi
  fi

  rm -f "$tmp"
  return 1
}

# 1. Soare (Fotosferă G2V)
fetch_and_convert "sun_albedo.jpg" "$CELESTIA_HIRES/gstar.jpg" 2048 || true

# 2. Mercur (MESSENGER Albedo & Bump)
fetch_and_convert "mercury_messenger_albedo.jpg" "$CELESTIA_HIRES/mercury.jpg" 2048 || true
fetch_and_convert "mercury_bump.jpg" "$CELESTIA_HIRES/mercury-normal.png" 2048 || true

# 3. Venus (Magellan Radar Surface & Galileo Atmosphere)
fetch_and_convert "venus_magellan_surface.jpg" "$CELESTIA_HIRES/venuslike.jpg" 2048 || true
fetch_and_convert "venus_galileo_atmosphere.jpg" "$CELESTIA_HIRES/venus.jpg" 2048 || true

# 4. Pământ (NASA Blue Marble, Normal/Bump, Clouds Alpha, Black Marble Nightlights)
fetch_and_convert "earth_albedo.jpg" "$CELESTIA_HIRES/earth.png" 2048 || true
fetch_and_convert "earth_bump.jpg" "$CELESTIA_HIRES/earth-normal.png" 2048 || true
fetch_and_convert "earth_clouds_alpha.png" "$CELESTIA_HIRES/earth-clouds.png" 2048 || true
fetch_and_convert "earth_nightlights.jpg" "$CELESTIA_HIRES/earth-night.jpg" 2048 || true

# 5. Lună (NASA LRO / Clementine Albedo & Bump)
fetch_and_convert "moon_lro_albedo.jpg" "$CELESTIA_HIRES/moon.jpg" 2048 || true
fetch_and_convert "moon_lola_bump.jpg" "$CELESTIA_HIRES/moon-normal.png" 2048 || true

# 6. Marte & Sateliții Phobos și Deimos (USGS Viking / MGS Albedo & MOLA Bump)
fetch_and_convert "mars_viking_albedo.jpg" "$CELESTIA_HIRES/mars.jpg" 2048 || true
fetch_and_convert "mars_mola_bump.jpg" "$CELESTIA_HIRES/mars-normal.png" 2048 || true
fetch_and_convert "phobos_viking.jpg" "$CELESTIA_HIRES/phobos.jpg" 2048 || fetch_and_convert "phobos_viking.jpg" "$CELESTIA_MEDRES/phobos.jpg" 2048 || true
fetch_and_convert "deimos_viking.jpg" "$CELESTIA_HIRES/deimos.jpg" 2048 || fetch_and_convert "deimos_viking.jpg" "$CELESTIA_MEDRES/deimos.jpg" 2048 || true

# 7. Jupiter & Sateliții Galileeni (Cassini, Juno & Galileo)
fetch_and_convert "jupiter_cassini_albedo.jpg" "$CELESTIA_HIRES/jupiter.jpg" 2048 || true
fetch_and_convert "io_galileo.jpg" "$CELESTIA_HIRES/io.png" 2048 || true
fetch_and_convert "europa_galileo.jpg" "$CELESTIA_HIRES/europa.jpg" 2048 || true
fetch_and_convert "ganymede_galileo.jpg" "$CELESTIA_HIRES/ganymede.jpg" 2048 || true
fetch_and_convert "callisto_galileo.jpg" "$CELESTIA_HIRES/callisto.jpg" 2048 || true

# 8. Saturn, Inelele RGBA & Sateliți (Cassini: Mimas, Enceladus, Titan, Iapetus)
fetch_and_convert "saturn_cassini_albedo.jpg" "$CELESTIA_HIRES/saturn.jpg" 2048 || true
fetch_and_convert "saturn_rings_rgba.png" "$CELESTIA_HIRES/saturn-rings.png" 2048 || true
fetch_and_convert "mimas_cassini.jpg" "$CELESTIA_HIRES/mimas.jpg" 2048 || fetch_and_convert "mimas_cassini.jpg" "$CELESTIA_MEDRES/mimas.jpg" 2048 || true
fetch_and_convert "titan_cassini.jpg" "$CELESTIA_HIRES/titan-clouds.jpg" 2048 || true
fetch_and_convert "enceladus_cassini.jpg" "$CELESTIA_HIRES/enceladus.jpg" 2048 || true
fetch_and_convert "iapetus_cassini.jpg" "$CELESTIA_HIRES/iapetus.jpg" 2048 || fetch_and_convert "iapetus_cassini.jpg" "$CELESTIA_MEDRES/iapetus.jpg" 2048 || true

# 9. Uranus, Neptun & Sateliți (Voyager 2: Miranda, Titania, Triton)
fetch_and_convert "uranus_voyager.jpg" "$CELESTIA_HIRES/uranus.jpg" 2048 || true
fetch_and_convert "miranda_voyager.jpg" "$CELESTIA_HIRES/miranda.jpg" 2048 || fetch_and_convert "miranda_voyager.jpg" "$CELESTIA_MEDRES/miranda.jpg" 2048 || true
fetch_and_convert "titania_voyager.jpg" "$CELESTIA_HIRES/titania.jpg" 2048 || fetch_and_convert "titania_voyager.jpg" "$CELESTIA_MEDRES/titania.jpg" 2048 || true
fetch_and_convert "neptune_voyager.jpg" "$CELESTIA_HIRES/neptune.jpg" 2048 || true
fetch_and_convert "triton_voyager.jpg" "$CELESTIA_HIRES/triton.jpg" 2048 || fetch_and_convert "triton_voyager.jpg" "$CELESTIA_MEDRES/triton.jpg" 2048 || true

# 10. Planete Pitice, Charon & Asteroizi (New Horizons & Dawn)
fetch_and_convert "pluto_newhorizons.jpg" "$CELESTIA_HIRES/pluto.jpg" 2048 || true
fetch_and_convert "charon_newhorizons.jpg" "$CELESTIA_HIRES/charon.jpg" 2048 || fetch_and_convert "charon_newhorizons.jpg" "$CELESTIA_MEDRES/charon.jpg" 2048 || true
fetch_and_convert "ceres_dawn.jpg" "$CELESTIA_HIRES/ceres.jpg" 2048 || true
fetch_and_convert "vesta_dawn.jpg" "$CELESTIA_HIRES/vesta.jpg" 2048 || true

# Sincronizăm și copiile 1K în public/textures/ pentru modul Eco
if command -v sips >/dev/null 2>&1; then
  [ -f "$HD_DIR/sun_albedo.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/sun_albedo.jpg" --out "$ECO_DIR/sun.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/mercury_messenger_albedo.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/mercury_messenger_albedo.jpg" --out "$ECO_DIR/mercury.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/venus_magellan_surface.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/venus_magellan_surface.jpg" --out "$ECO_DIR/venus_surface.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/venus_galileo_atmosphere.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/venus_galileo_atmosphere.jpg" --out "$ECO_DIR/venus_atmosphere.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/earth_albedo.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/earth_albedo.jpg" --out "$ECO_DIR/earth_daymap.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/earth_nightlights.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/earth_nightlights.jpg" --out "$ECO_DIR/earth_nightmap.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/moon_lro_albedo.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/moon_lro_albedo.jpg" --out "$ECO_DIR/moon.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/mars_viking_albedo.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/mars_viking_albedo.jpg" --out "$ECO_DIR/mars.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/jupiter_cassini_albedo.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/jupiter_cassini_albedo.jpg" --out "$ECO_DIR/jupiter.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/saturn_cassini_albedo.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/saturn_cassini_albedo.jpg" --out "$ECO_DIR/saturn.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/uranus_voyager.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/uranus_voyager.jpg" --out "$ECO_DIR/uranus.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/neptune_voyager.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/neptune_voyager.jpg" --out "$ECO_DIR/neptune.jpg" >/dev/null 2>&1 || true
  [ -f "$HD_DIR/ceres_dawn.jpg" ] && sips -s format jpeg -s formatOptions 82 -Z 1024 "$HD_DIR/ceres_dawn.jpg" --out "$ECO_DIR/ceres.jpg" >/dev/null 2>&1 || true
fi

# Generăm hărțile suplimentare (ex: earth_ocean_roughness.jpg sau hărțile exoplanetare/stelare)
node scripts/generate-hd-maps.mjs

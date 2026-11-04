# SPDX-License-Identifier: GPL-3.0-or-later // SPDX-License-Identifier: GPL-3.0-or-later
#!/usr/bin/env bash
# ==============================================================================
# Orbitar — Pipeline de Descărcare și Optimizare Texturi Științifice HD (2K/4K)
# Surse: NASA / USGS / JPL (Public Domain), CelestiaContent (GNU GPL),
#        Solar System Scope (CC-BY 4.0) + Generator Științific Multi-Layer 2K
# ==============================================================================

set -u

HD_DIR="public/textures/hd"
mkdir -p "$HD_DIR"

echo "🪐 Inițializare pipeline texturi științifice HD în $HD_DIR/ ..."

fetch_and_verify() {
  local filename="$1"
  local url="$2"
  local target="$HD_DIR/$filename"
  local tmp="${target}.download.tmp"

  if [ -f "$target" ]; then
    local existing_size
    existing_size=$(wc -c < "$target" 2>/dev/null | tr -d ' ')
    if [ "${existing_size:-0}" -gt 15000 ]; then
      echo "  [OK] $filename există deja (${existing_size} bytes)."
      return 0
    fi
  fi

  if command -v curl >/dev/null 2>&1; then
    if curl -fsSL --connect-timeout 5 --max-time 20 -A "Orbitar-Planetarium/1.0 (GNU GPLv3; Educational)" "$url" -o "$tmp" 2>/dev/null; then
      local size
      size=$(wc -c < "$tmp" 2>/dev/null | tr -d ' ')
      if [ "${size:-0}" -gt 12000 ] && file "$tmp" 2>/dev/null | grep -qiE "jpeg|png|image"; then
        mv "$tmp" "$target"
        echo "  [DESCĂRCAT] $filename (${size} bytes)"
        return 0
      fi
    fi
  fi

  rm -f "$tmp"
  return 1
}

# 1. Soare (SDO AIA 304 Å / Fotosferă)
fetch_and_verify "sun_albedo.jpg" "https://www.solarsystemscope.com/textures/download/2k_sun.jpg" || true

# 2. Mercur (MESSENGER Albedo & Bump)
fetch_and_verify "mercury_messenger_albedo.jpg" "https://www.solarsystemscope.com/textures/download/2k_mercury.jpg" || true
fetch_and_verify "mercury_bump.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/mercury.jpg" || true

# 3. Venus (Magellan Radar Surface & Galileo Sulfuric Acid Atmosphere)
fetch_and_verify "venus_magellan_surface.jpg" "https://www.solarsystemscope.com/textures/download/2k_venus_surface.jpg" || true
fetch_and_verify "venus_galileo_atmosphere.jpg" "https://www.solarsystemscope.com/textures/download/2k_venus_atmosphere.jpg" || true

# 4. Pământ (NASA Blue Marble, Topografie, Ocean Roughness, Clouds Alpha, Black Marble Nightlights)
fetch_and_verify "earth_albedo.jpg" "https://www.solarsystemscope.com/textures/download/2k_earth_daymap.jpg" || true
fetch_and_verify "earth_bump.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/earth.png" || true
fetch_and_verify "earth_ocean_roughness.jpg" "https://www.solarsystemscope.com/textures/download/2k_earth_specular_map.tif" || true
fetch_and_verify "earth_clouds_alpha.png" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/earth-clouds.png" || true
fetch_and_verify "earth_nightlights.jpg" "https://www.solarsystemscope.com/textures/download/2k_earth_nightmap.jpg" || true

# 5. Lună (NASA LRO CGI Moon Kit Albedo & LOLA Laser Altimetry Bump)
fetch_and_verify "moon_lro_albedo.jpg" "https://www.solarsystemscope.com/textures/download/2k_moon.jpg" || true
fetch_and_verify "moon_lola_bump.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/moonbump.jpg" || true

# 6. Marte (USGS Viking Albedo & MOLA Altimetry Bump)
fetch_and_verify "mars_viking_albedo.jpg" "https://www.solarsystemscope.com/textures/download/2k_mars.jpg" || true
fetch_and_verify "mars_mola_bump.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/marsbump.jpg" || true

# 7. Jupiter & Sateliții Galileeni (Cassini & Galileo)
fetch_and_verify "jupiter_cassini_albedo.jpg" "https://www.solarsystemscope.com/textures/download/2k_jupiter.jpg" || true
fetch_and_verify "io_galileo.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/io.jpg" || true
fetch_and_verify "europa_galileo.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/europa.jpg" || true
fetch_and_verify "ganymede_galileo.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/ganymede.jpg" || true
fetch_and_verify "callisto_galileo.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/callisto.jpg" || true

# 8. Saturn, Inelele RGBA & Sateliți (Cassini)
fetch_and_verify "saturn_cassini_albedo.jpg" "https://www.solarsystemscope.com/textures/download/2k_saturn.jpg" || true
fetch_and_verify "saturn_rings_rgba.png" "https://www.solarsystemscope.com/textures/download/2k_saturn_ring_alpha.png" || true
fetch_and_verify "titan_cassini.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/titan-clouds.jpg" || true
fetch_and_verify "enceladus_cassini.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/enceladus.jpg" || true

# 9. Uranus & Neptun (Voyager 2)
fetch_and_verify "uranus_voyager.jpg" "https://www.solarsystemscope.com/textures/download/2k_uranus.jpg" || true
fetch_and_verify "neptune_voyager.jpg" "https://www.solarsystemscope.com/textures/download/2k_neptune.jpg" || true

# 10. Planete Pitice & Asteroizi (New Horizons & Dawn)
fetch_and_verify "pluto_newhorizons.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/pluto.jpg" || true
fetch_and_verify "ceres_dawn.jpg" "https://www.solarsystemscope.com/textures/download/2k_ceres_fictional.jpg" || true
fetch_and_verify "vesta_dawn.jpg" "https://raw.githubusercontent.com/CelestiaProject/CelestiaContent/master/textures/medres/vesta.jpg" || true

# 11. Verificare integritate și generare 2048×1024 multi-layer pentru orice fișier lipsă sau indisponibil offline
node scripts/generate-hd-maps.mjs

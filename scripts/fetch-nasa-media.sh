# SPDX-License-Identifier: GPL-3.0-or-later
#!/usr/bin/env bash
# ==============================================================================
# Orbitar — Descărcare Fotografii și Randări Oficiale NASA/JPL-Caltech & ESA
# (Domeniu Public) pentru Roverele Marțiene, Stația Spațială și Sonde/Telescoape
# ==============================================================================

set -u

NASA_DIR="public/textures/nasa"
mkdir -p "$NASA_DIR"

fetch_by_nasa_id() {
  local id="$1"
  local nasa_id="$2"
  local target="$NASA_DIR/${id}.jpg"
  if [ "${ORBITAR_FORCE_FETCH:-0}" != "1" ] && [ -f "$target" ]; then
    local existing_sz
    existing_sz=$(wc -c < "$target" 2>/dev/null | tr -d ' ')
    if [ "${existing_sz:-0}" -gt 10000 ]; then
      echo "  [NASA] ${id}.jpg există deja (${existing_sz} bytes)"
      return 0
    fi
  fi
  local tmp="${target}.tmp"
  local img_url="https://images-assets.nasa.gov/image/${nasa_id}/${nasa_id}~medium.jpg"
  local orig_url="https://images-assets.nasa.gov/image/${nasa_id}/${nasa_id}~orig.jpg"
  local small_url="https://images-assets.nasa.gov/image/${nasa_id}/${nasa_id}~small.jpg"

  if curl -fsSL --connect-timeout 8 --max-time 25 "$img_url" -o "$tmp" 2>/dev/null \
    || curl -fsSL --connect-timeout 8 --max-time 25 "$orig_url" -o "$tmp" 2>/dev/null \
    || curl -fsSL --connect-timeout 8 --max-time 25 "$small_url" -o "$tmp" 2>/dev/null; then
    if command -v sips >/dev/null 2>&1; then
      sips -s format jpeg -s formatOptions 84 -Z 860 "$tmp" --out "$target" >/dev/null 2>&1 || mv "$tmp" "$target"
      rm -f "$tmp"
    else
      mv "$tmp" "$target"
    fi
    local sz
    sz=$(wc -c < "$target" 2>/dev/null | tr -d ' ')
    if [ "${sz:-0}" -gt 8000 ]; then
      echo "  [NASA] ${id}.jpg (${nasa_id}) -> ${sz} bytes"
      return 0
    fi
  fi
  rm -f "$tmp"
  return 1
}

search_and_fetch_spacecraft() {
  local id="$1"
  local query="$2"
  local must_match="$3"
  local target="$NASA_DIR/${id}.jpg"
  if [ "${ORBITAR_FORCE_FETCH:-0}" != "1" ] && [ -f "$target" ]; then
    local existing_sz
    existing_sz=$(wc -c < "$target" 2>/dev/null | tr -d ' ')
    if [ "${existing_sz:-0}" -gt 10000 ]; then
      echo "  [NASA] ${id}.jpg există deja (${existing_sz} bytes)"
      return 0
    fi
  fi
  local tmp="${target}.tmp"

  local api_url="https://images-api.nasa.gov/search?q=${query}&media_type=image"
  local result
  result=$(curl -fsSL --connect-timeout 8 --max-time 20 "$api_url" 2>/dev/null \
    | python3 -c "
import sys, json
must = '${must_match}'.lower()
try:
    data = json.load(sys.stdin)
    items = data.get('collection', {}).get('items', [])
    for item in items:
        d = (item.get('data') or [{}])[0]
        title = (d.get('title') or '').lower()
        desc = (d.get('description') or '').lower()
        nid = d.get('nasa_id') or ''
        if must and must not in title and must not in desc:
            continue
        for link in item.get('links', []):
            href = link.get('href', '')
            if href.endswith('.jpg') or href.endswith('.jpeg'):
                print(nid + '|' + href)
                sys.exit(0)
except Exception:
    pass
" 2>/dev/null)

  if [ -n "${result:-}" ]; then
    local nid="${result%%|*}"
    local href="${result#*|}"
    if fetch_by_nasa_id "$id" "$nid"; then
      return 0
    fi
    if curl -fsSL --connect-timeout 8 --max-time 25 "$href" -o "$tmp" 2>/dev/null; then
      if command -v sips >/dev/null 2>&1; then
        sips -s format jpeg -s formatOptions 84 -Z 860 "$tmp" --out "$target" >/dev/null 2>&1 || mv "$tmp" "$target"
        rm -f "$tmp"
      else
        mv "$tmp" "$target"
      fi
      echo "  [NASA] ${id}.jpg (${nid}) descărcat"
      return 0
    fi
  fi
  rm -f "$tmp"
  return 1
}

echo "📸 Descărcare fotografii și randări oficiale NASA/JPL-Caltech în $NASA_DIR/ ..."

# 1. Perseverance & Ingenuity (Selfie oficial în Craterul Jezero PIA24542)
fetch_by_nasa_id "perseverance" "PIA24542" || true

# 2. Curiosity (Selfie oficial în Craterul Gale PIA16239)
fetch_by_nasa_id "curiosity" "PIA16239" || true

# 3. Stația Spațială Internațională (Fotografiată pe orbită de Expediția 56 iss056e201248)
fetch_by_nasa_id "iss" "iss056e201248" || true

# 4. Telescopul Spațial Hubble pe orbita terestră (GSFC_20171208_Archive_e002151)
fetch_by_nasa_id "hubble" "GSFC_20171208_Archive_e002151" || true

# 5. Telescopul Spațial James Webb (Observatorul cu oglinda aurită și scutul termic)
search_and_fetch_spacecraft "jwst" "James%20Webb%20Space%20Telescope%20observatory%20sunshield" "webb" || true

# 6. Sondele Voyager 1 & Voyager 2 (Randare oficială NASA/JPL a sondei Voyager în spațiu)
search_and_fetch_spacecraft "voyager1" "Voyager%20spacecraft%20artist%20concept%20interstellar" "voyager" || true
cp -f "$NASA_DIR/voyager1.jpg" "$NASA_DIR/voyager2.jpg" 2>/dev/null || true

# 7. Sonda New Horizons la Pluto (Randare oficială a sondei New Horizons)
search_and_fetch_spacecraft "newhorizons" "New%20Horizons%20spacecraft%20Pluto%20artist%20concept" "new horizons" || true

# 8. Parker Solar Probe (Randare oficială a sondei lângă Soare)
search_and_fetch_spacecraft "parker" "Parker%20Solar%20Probe%20approaching%20Sun%20artist%20concept" "parker" || true

# 9. Sonda Rosetta la cometa 67P
search_and_fetch_spacecraft "rosetta" "Rosetta%20spacecraft%20comet%20artist" "rosetta" || true

# 10. Telescopul Spațial Euclid
search_and_fetch_spacecraft "euclid" "Euclid%20spacecraft%20telescope%20ESA" "euclid" || true

# 11. Sonda JUICE (Jupiter Icy Moons Explorer)
fetch_by_nasa_id "juice" "PIA24024" || search_and_fetch_spacecraft "juice" "JUICE%20Jupiter%20spacecraft%20ESA" "juice" || true

echo "🌌 Descărcare fotografii oficiale NASA/ESA/JWST/Hubble pentru Cosmosul Îndepărtat ..."

# 12. Stâlpii Creației (Nebuloasa Vulturului M16 — Telescopul James Webb / Hubble)
search_and_fetch_spacecraft "pillars_of_creation" "Pillars%20of%20Creation%20Webb%20Eagle%20Nebula" "pillars" \
  || fetch_by_nasa_id "pillars_of_creation" "GSFC_20171208_Archive_e000842" || true

# 13. Nebuloasa Orion (M42 — Hubble & Spitzer PIA08653)
fetch_by_nasa_id "orion_nebula" "PIA08653" \
  || search_and_fetch_spacecraft "orion_nebula" "Orion%20Nebula%20Hubble%20M42" "orion" || true

# 14. Galaxia Andromeda (M31 — GALEX / Spitzer / Hubble PIA15416)
fetch_by_nasa_id "andromeda" "PIA15416" \
  || fetch_by_nasa_id "andromeda" "PIA04921" \
  || search_and_fetch_spacecraft "andromeda" "Andromeda%20Galaxy%20M31" "andromeda" || true

# 15. Calea Lactee (Harta științifică NASA/JPL-Caltech Spitzer PIA19341 / PIA03654)
fetch_by_nasa_id "milky_way" "PIA19341" \
  || fetch_by_nasa_id "milky_way" "PIA03654" \
  || search_and_fetch_spacecraft "milky_way" "Milky%20Way%20spiral%20arms%20Sun%20artist%20concept" "milky way" || true

# 16. Sagittarius A* (Gaura Neagră Supermasivă din centrul Căii Lactee — EHT / NASA)
search_and_fetch_spacecraft "sagittarius_a" "Sagittarius%20A%20black%20hole%20Event%20Horizon" "sagittarius" \
  || fetch_by_nasa_id "sagittarius_a" "PIA25440" \
  || fetch_by_nasa_id "sagittarius_a" "PIA16695" || true

# 17. Sistemul Exoplanetar TRAPPIST-1 (Cele 7 planete stâncoase — NASA/JPL PIA21422 / PIA22093)
fetch_by_nasa_id "trappist1" "PIA21422" \
  || fetch_by_nasa_id "trappist1" "PIA22093" \
  || search_and_fetch_spacecraft "trappist1" "TRAPPIST-1%20seven%20planets" "trappist" || true

# 18. Proxima Centauri & Proxima Centauri b (NASA/ESA Hubble / ESO)
search_and_fetch_spacecraft "proxima_centauri" "Proxima%20Centauri%20Hubble" "proxima" \
  || fetch_by_nasa_id "proxima_centauri" "potw1343a" || true

# 19. Sirius A și Pitica Albă Sirius B (Telescopul Spațial Hubble)
search_and_fetch_spacecraft "sirius" "Sirius%20white%20dwarf%20Hubble" "sirius" \
  || fetch_by_nasa_id "sirius" "STScI-PRC05-36a" || true

# 20. Supergiganta Roșie Betelgeuse (Telescopul Spațial Hubble)
search_and_fetch_spacecraft "betelgeuse" "Betelgeuse%20supergiant%20Hubble" "betelgeuse" \
  || fetch_by_nasa_id "betelgeuse" "GSFC_20171208_Archive_e001283" || true

# 21. Exoplaneta 55 Cancri e ("Planeta de Lavă și Diamant" — NASA/JPL PIA20068)
fetch_by_nasa_id "cancri55e" "PIA20068" \
  || fetch_by_nasa_id "cancri55e" "PIA15622" \
  || search_and_fetch_spacecraft "cancri55e" "55%20Cancri%20e%20lava%20planet" "cancri" || true

# 22. Roiul Stelar Pleiadele ("Cloșca cu Pui" M45 — NASA/JPL PIA04225 / Hubble)
fetch_by_nasa_id "pleiades" "PIA04225" \
  || fetch_by_nasa_id "pleiades" "PIA09262" \
  || search_and_fetch_spacecraft "pleiades" "Pleiades%20Seven%20Sisters%20star%20cluster" "pleiades" || true

# 23. Norul lui Oort (Granița Sistemului Solar — NASA/JPL PIA17046)
fetch_by_nasa_id "oort_cloud" "PIA17046" \
  || search_and_fetch_spacecraft "oort_cloud" "Oort%20Cloud%20solar%20system" "oort" || true


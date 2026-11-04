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

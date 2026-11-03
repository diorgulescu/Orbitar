// SPDX-License-Identifier: GPL-3.0-or-later
import { CelestialBodyInstance } from '../core/OrbitalEngine';
import { AgeTier, CelestialCategory } from '../types/celestial';

export type LayerFilter = 'all' | 'planets_moons' | 'dwarfs_asteroids' | 'probes_telescopes';

const STORAGE_KEY_AGE_TIER = 'orbitar_age_tier';

export function matchesLayerFilter(cat: CelestialCategory, filter: LayerFilter): boolean {
  if (filter === 'all') return true;
  if (filter === 'planets_moons') {
    return (
      cat === 'star' ||
      cat === 'terrestrial' ||
      cat === 'gas_giant' ||
      cat === 'ice_giant' ||
      cat === 'moon'
    );
  }
  if (filter === 'dwarfs_asteroids') {
    return cat === 'dwarf' || cat === 'asteroid';
  }
  return (
    cat === 'station' ||
    cat === 'telescope' ||
    cat === 'probe' ||
    cat === 'rover'
  );
}

export interface HeaderHudCallbacks {
  onSelectBody: (bodyId: string) => void;
  onFilterChange: (filter: LayerFilter) => void;
  onTierChange: (tier: AgeTier) => void;
}

/**
 * HeaderHud gestionează bara superioară Bento Dark Mode a aplicației Orbitar:
 * - Sigla/Titlul "ORBITAR // Planetariu Didactic" în stânga sus
 * - Bara de căutare rapidă cu rezultate instantanee
 * - Filtrele rapide pe straturi: [Toate] [Planete & Luni] [Pitice & Asteroizi] [Sonde & Telescoape]
 * - Comutatorul de nivel salvat în localStorage (orbitar_age_tier): [Micul Explorator: 6-8 ani] vs [Cadet Orbitar: 9-12 ani]
 */
export class HeaderHud {
  private currentTier: AgeTier;
  private currentFilter: LayerFilter = 'all';
  private readonly bodies: CelestialBodyInstance[];
  private readonly callbacks: HeaderHudCallbacks;

  constructor(bodies: CelestialBodyInstance[], callbacks: HeaderHudCallbacks) {
    this.bodies = bodies;
    this.callbacks = callbacks;
    this.currentTier = this.readSavedTier();
    this.bindEvents();
    this.syncUiState();
  }

  private readSavedTier(): AgeTier {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY_AGE_TIER);
      if (saved === 'junior' || saved === 'cadet') {
        return saved;
      }
    } catch {
      // Ignorăm eventualele restricții LocalStorage
    }
    return 'junior';
  }

  private saveTier(tier: AgeTier): void {
    try {
      window.localStorage.setItem(STORAGE_KEY_AGE_TIER, tier);
    } catch {
      // Ignorăm eventualele restricții LocalStorage
    }
  }

  public getTier(): AgeTier {
    return this.currentTier;
  }

  public getFilter(): LayerFilter {
    return this.currentFilter;
  }

  private bindEvents(): void {
    // 1. Comutator nivel studiu (Micul Explorator 6–8 ani vs Cadet Orbitar 9–12 ani)
    const btnJunior = document.getElementById('btn-tier-junior');
    const btnCadet = document.getElementById('btn-tier-cadet');

    btnJunior?.addEventListener('click', () => {
      if (this.currentTier === 'junior') return;
      this.currentTier = 'junior';
      this.saveTier('junior');
      this.syncUiState();
      this.callbacks.onTierChange('junior');
    });

    btnCadet?.addEventListener('click', () => {
      if (this.currentTier === 'cadet') return;
      this.currentTier = 'cadet';
      this.saveTier('cadet');
      this.syncUiState();
      this.callbacks.onTierChange('cadet');
    });

    // 2. Filtre rapide pe straturi
    const filterBtns = document.querySelectorAll<HTMLButtonElement>('[data-layer-filter]');
    filterBtns.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextFilter = (btn.dataset.layerFilter as LayerFilter) || 'all';
        this.currentFilter = nextFilter;
        this.syncUiState();
        this.callbacks.onFilterChange(nextFilter);
      });
    });

    // 3. Bară de căutare rapidă cu sugestii interactive
    const searchInput = document.getElementById('hud-search-input') as HTMLInputElement | null;
    const searchResults = document.getElementById('hud-search-results');

    if (searchInput && searchResults) {
      const renderSearchResults = (query: string) => {
        const clean = this.normalizeRo(query.trim());
        if (!clean) {
          searchResults.classList.add('is-hidden');
          searchResults.innerHTML = '';
          return;
        }

        const matches = this.bodies.filter((b) => {
          const hay = this.normalizeRo(
            `${b.data.name} ${b.data.subtitle} ${b.meta.categoryNameRo} ${b.data.id}`
          );
          return hay.includes(clean);
        });

        if (matches.length === 0) {
          searchResults.innerHTML = `<div class="search-empty">Niciun corp găsit pentru „${query}”</div>`;
          searchResults.classList.remove('is-hidden');
          return;
        }

        searchResults.innerHTML = matches
          .slice(0, 8)
          .map(
            (m) => `
            <button type="button" class="search-result-item" data-search-id="${m.data.id}">
              <span class="search-dot" style="background:${m.data.color}"></span>
              <span class="search-name">${m.data.name}</span>
              <span class="search-cat">${m.meta.categoryNameRo}</span>
            </button>
          `
          )
          .join('');
        searchResults.classList.remove('is-hidden');

        searchResults.querySelectorAll<HTMLButtonElement>('[data-search-id]').forEach((itemBtn) => {
          itemBtn.addEventListener('click', () => {
            const id = itemBtn.dataset.searchId;
            if (id) {
              this.callbacks.onSelectBody(id);
              searchInput.value = '';
              searchResults.classList.add('is-hidden');
            }
          });
        });
      };

      searchInput.addEventListener('input', () => {
        renderSearchResults(searchInput.value);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          const firstBtn = searchResults.querySelector<HTMLButtonElement>('[data-search-id]');
          if (firstBtn?.dataset.searchId) {
            this.callbacks.onSelectBody(firstBtn.dataset.searchId);
            searchInput.value = '';
            searchResults.classList.add('is-hidden');
          }
        } else if (e.key === 'Escape') {
          searchResults.classList.add('is-hidden');
        }
      });

      document.addEventListener('click', (e) => {
        if (
          !searchInput.contains(e.target as Node) &&
          !searchResults.contains(e.target as Node)
        ) {
          searchResults.classList.add('is-hidden');
        }
      });
    }
  }

  private normalizeRo(str: string): string {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  private syncUiState(): void {
    const btnJunior = document.getElementById('btn-tier-junior');
    const btnCadet = document.getElementById('btn-tier-cadet');
    btnJunior?.classList.toggle('hud-btn-active-cyan', this.currentTier === 'junior');
    btnCadet?.classList.toggle('hud-btn-active-amber', this.currentTier === 'cadet');

    const filterBtns = document.querySelectorAll<HTMLButtonElement>('[data-layer-filter]');
    filterBtns.forEach((btn) => {
      btn.classList.toggle(
        'hud-btn-active-cyan',
        btn.dataset.layerFilter === this.currentFilter
      );
    });
  }
}

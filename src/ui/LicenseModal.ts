// SPDX-License-Identifier: GPL-3.0-or-later
import {
  checkGitHubLatestRelease,
  DesktopAppInfo,
  getBuiltAppVersion,
  isDesktopTauriApp,
  openUrlInSystemBrowser,
  ORBITAR_GITHUB_REPO_URL,
  ORBITAR_GITHUB_RELEASES_URL,
  ORBITAR_OFFICIAL_SITE_URL,
  resolveDesktopAppInfo,
  UpdateCheckResult,
} from '../utils/UpdateChecker';

export interface LicenseModalOptions {
  fetchImpl?: typeof fetch;
}

/**
 * LicenseModal gestionează fereastra „Despre Orbitar” (Help -> About), afișarea versiunii și a platformei,
 * verificarea actualizărilor pe GitHub Releases pentru clienții desktop (Linux, Windows, macOS)
 * și informațiile despre licența liberă GNU General Public License v3.0.
 */
export class LicenseModal {
  private readonly fetchImpl?: typeof fetch;
  private appInfo: DesktopAppInfo = {
    name: 'Orbitar',
    version: getBuiltAppVersion(),
    os: 'Desktop',
    arch: '',
    isDesktop: isDesktopTauriApp(),
    platformLabelRo: isDesktopTauriApp() ? 'Aplicație Desktop' : 'Aplicație Web / PWA',
    repository: ORBITAR_GITHUB_REPO_URL,
    releasesUrl: ORBITAR_GITHUB_RELEASES_URL,
  };
  private latestReleaseUrl: string = ORBITAR_GITHUB_RELEASES_URL;
  private isChecking = false;

  constructor(options?: LicenseModalOptions) {
    this.fetchImpl = options?.fetchImpl;
    this.bindEvents();
    void this.initAppMetadata();
  }

  /**
   * Încarcă informațiile despre versiune și platformă (din comanda Rust `get_app_info` pe Desktop
   * sau din metadatele build-ului curent).
   */
  public async initAppMetadata(): Promise<DesktopAppInfo> {
    this.appInfo = await resolveDesktopAppInfo();
    this.renderAppIdentity();
    return this.appInfo;
  }

  private renderAppIdentity(): void {
    const versionEl = document.getElementById('about-app-version');
    const platformEl = document.getElementById('about-app-platform');
    if (versionEl) {
      versionEl.textContent = `Versiune: v${this.appInfo.version}`;
    }
    if (platformEl) {
      platformEl.textContent = `Platformă: ${this.appInfo.platformLabelRo}`;
    }
  }

  /**
   * Deschide fereastra „Despre Orbitar” (Help -> About) și opțional declanșează verificarea actualizărilor.
   */
  public openModal(autoCheckUpdates = false): void {
    const modalBackdrop = document.getElementById('hud-gpl-modal');
    modalBackdrop?.classList.remove('is-hidden');
    this.renderAppIdentity();
    if (autoCheckUpdates) {
      void this.checkForUpdates();
    }
  }

  /**
   * Închide fereastra „Despre Orbitar”.
   */
  public closeModal(): void {
    const modalBackdrop = document.getElementById('hud-gpl-modal');
    modalBackdrop?.classList.add('is-hidden');
  }

  /**
   * Interoghează GitHub Releases pentru a verifica dacă există o versiune mai nouă decât cea instalată
   * și actualizează starea din fereastra „Despre Orbitar”.
   */
  public async checkForUpdates(): Promise<UpdateCheckResult | null> {
    if (this.isChecking) return null;
    this.isChecking = true;

    const badgeEl = document.getElementById('about-update-badge');
    const statusEl = document.getElementById('about-update-status');
    const bannerEl = document.getElementById('about-update-banner');
    const releaseTitleEl = document.getElementById('about-update-release-title');
    const releaseNotesEl = document.getElementById('about-update-release-notes');
    const btnCheck = document.getElementById('btn-check-updates') as HTMLButtonElement | null;
    const btnOpenModal = document.getElementById('btn-gpl-modal');

    if (badgeEl) {
      badgeEl.textContent = '⏳ Se verifică…';
    }
    if (statusEl) {
      statusEl.textContent =
        'Se interoghează GitHub Releases pentru a verifica cea mai recentă versiune Orbitar…';
    }
    if (btnCheck) {
      btnCheck.disabled = true;
    }

    try {
      await this.initAppMetadata();
      const result = await checkGitHubLatestRelease(this.appInfo.version, this.fetchImpl);
      this.latestReleaseUrl = result.releaseUrl || ORBITAR_GITHUB_RELEASES_URL;

      if (statusEl) {
        statusEl.textContent = result.messageRo;
      }

      if (result.status === 'update-available') {
        if (badgeEl) {
          badgeEl.textContent = `🎉 Versiune nouă: v${result.latestVersion}`;
        }
        if (releaseTitleEl) {
          const dateSuffix = result.publishedDateRo ? ` • lansată pe ${result.publishedDateRo}` : '';
          releaseTitleEl.textContent = `🚀 ${result.releaseTitle} (v${result.latestVersion}${dateSuffix})`;
        }
        if (releaseNotesEl) {
          releaseNotesEl.textContent =
            result.releaseNotesSummary ||
            'O versiune nouă cu îmbunătățiri și actualizări este disponibilă pe pagina oficială GitHub Releases.';
        }
        bannerEl?.classList.remove('is-hidden');
        if (btnOpenModal) {
          btnOpenModal.classList.add('hud-btn-active-amber');
          btnOpenModal.textContent = `ⓘ Despre (v${result.latestVersion} nou!)`;
        }
      } else if (result.status === 'up-to-date') {
        if (badgeEl) {
          badgeEl.textContent = `✅ La zi (v${result.currentVersion})`;
        }
        bannerEl?.classList.add('is-hidden');
      } else {
        if (badgeEl) {
          badgeEl.textContent = '📡 Mod Offline';
        }
        bannerEl?.classList.add('is-hidden');
      }

      return result;
    } finally {
      this.isChecking = false;
      if (btnCheck) {
        btnCheck.disabled = false;
      }
    }
  }

  private bindEvents(): void {
    const btnOpen = document.getElementById('btn-gpl-modal');
    const btnAboutHeader = document.getElementById('btn-about-orbitar');
    const btnClose = document.getElementById('btn-gpl-close');
    const modalBackdrop = document.getElementById('hud-gpl-modal');
    const btnCheckUpdates = document.getElementById('btn-check-updates');
    const btnOpenReleaseBrowser = document.getElementById('btn-open-release-browser');
    const btnOpenGithubReleases = document.getElementById('btn-open-github-releases');
    const btnOpenOfficialSite = document.getElementById('btn-open-official-site');

    // Expunem handler global pentru deschiderea casetei „Despre Orbitar”
    if (typeof window !== 'undefined') {
      (
        window as unknown as {
          __orbitarOpenAboutModal?: (autoCheckUpdates?: boolean) => void;
        }
      ).__orbitarOpenAboutModal = (autoCheckUpdates = false) => {
        this.openModal(autoCheckUpdates);
      };
    }

    btnOpen?.addEventListener('click', () => {
      this.openModal(false);
    });

    // În aplicația desktop Tauri, butonul ⓘ din stânga-sus deschide caseta „Despre Orbitar” (Help -> About)
    btnAboutHeader?.addEventListener('click', (e) => {
      if (isDesktopTauriApp()) {
        e.preventDefault();
        this.openModal(false);
      }
    });

    btnClose?.addEventListener('click', () => {
      this.closeModal();
    });

    modalBackdrop?.addEventListener('click', (e) => {
      if (e.target === modalBackdrop) {
        this.closeModal();
      }
    });

    btnCheckUpdates?.addEventListener('click', () => {
      void this.checkForUpdates();
    });

    btnOpenReleaseBrowser?.addEventListener('click', () => {
      void openUrlInSystemBrowser(this.latestReleaseUrl);
    });

    btnOpenGithubReleases?.addEventListener('click', () => {
      void openUrlInSystemBrowser(ORBITAR_GITHUB_RELEASES_URL);
    });

    btnOpenOfficialSite?.addEventListener('click', () => {
      void openUrlInSystemBrowser(ORBITAR_OFFICIAL_SITE_URL);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      } else if (e.key === 'F1') {
        e.preventDefault();
        this.openModal(false);
      }
    });
  }
}

// SPDX-License-Identifier: GPL-3.0-or-later

declare const __ORBITAR_APP_VERSION__: string | undefined;

export const ORBITAR_DEFAULT_VERSION = '1.2.6';
export const ORBITAR_GITHUB_REPO = 'diorgulescu/Orbitar';
export const ORBITAR_GITHUB_REPO_URL = 'https://github.com/diorgulescu/Orbitar';
export const ORBITAR_GITHUB_RELEASES_URL = 'https://github.com/diorgulescu/Orbitar/releases';
export const ORBITAR_GITHUB_API_LATEST_URL =
  'https://api.github.com/repos/diorgulescu/Orbitar/releases/latest';
export const ORBITAR_GITHUB_API_LIST_URL =
  'https://api.github.com/repos/diorgulescu/Orbitar/releases?per_page=5';
export const ORBITAR_OFFICIAL_SITE_URL = 'https://orbitar.ro';

export interface DesktopAppInfo {
  name: string;
  version: string;
  os: string;
  arch: string;
  isDesktop: boolean;
  platformLabelRo: string;
  repository: string;
  releasesUrl: string;
}

export type UpdateCheckStatus = 'up-to-date' | 'update-available' | 'error';

export interface UpdateCheckResult {
  status: UpdateCheckStatus;
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseTitle: string;
  releaseUrl: string;
  publishedDateRo: string;
  releaseNotesSummary: string;
  messageRo: string;
}

interface GitHubReleasePayload {
  tag_name?: string;
  name?: string;
  html_url?: string;
  published_at?: string;
  body?: string;
  draft?: boolean;
}

type TauriInvokeFn = <T = unknown>(
  cmd: string,
  args?: Record<string, unknown>
) => Promise<T>;

/**
 * Returnează funcția `invoke` din runtime-ul Tauri v2 dacă aplicația rulează în modul Desktop.
 */
export function getTauriInvoke(): TauriInvokeFn | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    __TAURI_INTERNALS__?: { invoke?: TauriInvokeFn };
    __TAURI__?: { core?: { invoke?: TauriInvokeFn } };
  };
  const fn = w.__TAURI_INTERNALS__?.invoke ?? w.__TAURI__?.core?.invoke;
  if (typeof fn === 'function') {
    return fn.bind(w.__TAURI_INTERNALS__ ?? w.__TAURI__?.core);
  }
  return null;
}

/**
 * Detectează dacă aplicația rulează în containerul nativ Desktop (Tauri: Linux, Windows, macOS).
 */
export function isDesktopTauriApp(): boolean {
  if (typeof window === 'undefined') return false;
  if (getTauriInvoke() !== null) return true;
  const protocol = window.location?.protocol ?? '';
  const host = window.location?.hostname ?? '';
  return protocol === 'tauri:' || host === 'tauri.localhost';
}

/**
 * Returnează versiunea aplicației compilată în build-ul curent (din package.json / Vite define).
 */
export function getBuiltAppVersion(): string {
  try {
    if (typeof __ORBITAR_APP_VERSION__ === 'string' && __ORBITAR_APP_VERSION__.trim().length > 0) {
      return cleanVersionTag(__ORBITAR_APP_VERSION__);
    }
  } catch (_e) {
    // În mediul de test Node fără transformare Vite, folosim versiunea implicită
  }
  return ORBITAR_DEFAULT_VERSION;
}

/**
 * Curăță un tag de versiune (ex: "v1.2.0" -> "1.2.0", "orbitar-v1.0.2" -> "1.0.2").
 */
export function cleanVersionTag(raw: string): string {
  const trimmed = String(raw ?? '').trim();
  const match = /(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)/.exec(trimmed);
  if (match) {
    return match[1];
  }
  const twoPart = /(\d+\.\d+)/.exec(trimmed);
  if (twoPart) {
    return `${twoPart[1]}.0`;
  }
  return ORBITAR_DEFAULT_VERSION;
}

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string;
}

export function parseSemver(versionStr: string): ParsedSemver {
  const cleaned = cleanVersionTag(versionStr);
  const [core, prerelease = ''] = cleaned.split('-', 2);
  const parts = core.split('.').map((n) => Number.parseInt(n, 10) || 0);
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0,
    prerelease,
  };
}

/**
 * Compară două versiuni SemVer:
 * - returnează `-1` dacă `currentVersion < candidateVersion` (există o versiune mai nouă)
 * - returnează `0` dacă sunt egale
 * - returnează `1` dacă `currentVersion > candidateVersion`
 */
export function compareSemver(currentVersion: string, candidateVersion: string): number {
  const a = parseSemver(currentVersion);
  const b = parseSemver(candidateVersion);

  if (a.major !== b.major) return a.major < b.major ? -1 : 1;
  if (a.minor !== b.minor) return a.minor < b.minor ? -1 : 1;
  if (a.patch !== b.patch) return a.patch < b.patch ? -1 : 1;

  // Conform SemVer, o versiune stabilă (fără prerelease) este mai nouă decât un prerelease cu același X.Y.Z
  if (!a.prerelease && !b.prerelease) return 0;
  if (!a.prerelease && b.prerelease) return 1;
  if (a.prerelease && !b.prerelease) return -1;

  return a.prerelease.localeCompare(b.prerelease);
}

/**
 * Returnează `true` dacă `latestVersion` (de pe GitHub) este strict mai nouă decât `currentVersion`.
 */
export function isNewerVersionAvailable(currentVersion: string, latestVersion: string): boolean {
  return compareSemver(currentVersion, latestVersion) < 0;
}

/**
 * Formatează numele platformei și arhitecturii în limba română pentru caseta „Despre Orbitar”.
 */
export function formatPlatformLabelRo(os: string, arch: string, isDesktop: boolean): string {
  const osNorm = os.toLowerCase();
  const archNorm = arch.toLowerCase();

  let osLabel = 'Sistem Desktop';
  if (osNorm.includes('windows') || osNorm === 'win32') {
    osLabel = 'Windows';
  } else if (osNorm.includes('macos') || osNorm.includes('darwin') || osNorm.includes('mac')) {
    osLabel = 'macOS';
  } else if (osNorm.includes('linux')) {
    osLabel = 'Linux';
  } else if (os.trim().length > 0) {
    osLabel = os;
  }

  let archLabel = '';
  if (archNorm === 'aarch64' || archNorm === 'arm64') {
    archLabel = osLabel === 'macOS' ? 'Apple Silicon (ARM64)' : 'ARM64 (aarch64)';
  } else if (archNorm === 'x86_64' || archNorm === 'amd64' || archNorm === 'x64') {
    archLabel = '64-biți (x86_64)';
  } else if (archNorm === 'x86' || archNorm === 'i686') {
    archLabel = '32-biți (x86)';
  } else if (arch.trim().length > 0) {
    archLabel = arch;
  }

  if (!isDesktop) {
    return `${osLabel} — Aplicație Web / PWA`;
  }
  return archLabel
    ? `${osLabel} (${archLabel}) — Aplicație Desktop`
    : `${osLabel} — Aplicație Desktop`;
}

function detectFallbackOsFromNavigator(): string {
  if (typeof navigator === 'undefined') return 'Desktop';
  const ua = navigator.userAgent ?? '';
  if (/Windows/i.test(ua)) return 'windows';
  if (/Macintosh|Mac OS X/i.test(ua)) return 'macos';
  if (/Linux/i.test(ua)) return 'linux';
  return 'Desktop';
}

/**
 * Obține informațiile despre aplicație (din comanda nativă Rust `get_app_info` pe Desktop
 * sau din metadatele de build în browser).
 */
export async function resolveDesktopAppInfo(): Promise<DesktopAppInfo> {
  const invoke = getTauriInvoke();
  const isDesktop = isDesktopTauriApp();
  const fallbackVersion = getBuiltAppVersion();
  const fallbackOs = detectFallbackOsFromNavigator();

  if (invoke) {
    try {
      const info = await invoke<{
        name?: string;
        version?: string;
        os?: string;
        arch?: string;
        repository?: string;
        releasesUrl?: string;
      }>('get_app_info');
      if (info && typeof info === 'object') {
        const version = cleanVersionTag(info.version ?? fallbackVersion);
        const os = info.os ?? fallbackOs;
        const arch = info.arch ?? '';
        return {
          name: info.name ?? 'Orbitar',
          version,
          os,
          arch,
          isDesktop: true,
          platformLabelRo: formatPlatformLabelRo(os, arch, true),
          repository: info.repository ?? ORBITAR_GITHUB_REPO_URL,
          releasesUrl: info.releasesUrl ?? ORBITAR_GITHUB_RELEASES_URL,
        };
      }
    } catch (_e) {
      // Fallback dacă comanda get_app_info nu este disponibilă în mediul de test
    }
  }

  return {
    name: 'Orbitar',
    version: fallbackVersion,
    os: fallbackOs,
    arch: '',
    isDesktop,
    platformLabelRo: formatPlatformLabelRo(fallbackOs, '', isDesktop),
    repository: ORBITAR_GITHUB_REPO_URL,
    releasesUrl: ORBITAR_GITHUB_RELEASES_URL,
  };
}

function formatIsoDateRo(isoStr?: string): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return '';
  try {
    return d.toLocaleDateString('ro-RO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch (_e) {
    return d.toISOString().slice(0, 10);
  }
}

function summarizeReleaseBody(body?: string): string {
  if (!body) return '';
  const cleaned = body
    .replace(/#{1,6}\s+/g, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (cleaned.length === 0) return '';
  const firstLines = cleaned.slice(0, 2).join(' • ');
  return firstLines.length > 200 ? `${firstLines.slice(0, 197)}…` : firstLines;
}

/**
 * Verifică pe GitHub Releases dacă a apărut o versiune mai nouă decât `currentVersion`.
 */
export async function checkGitHubLatestRelease(
  currentVersion: string,
  fetchImpl: typeof fetch = fetch
): Promise<UpdateCheckResult> {
  const cleanCurrent = cleanVersionTag(currentVersion);

  try {
    let releaseData: GitHubReleasePayload | null = null;
    const response = await fetchImpl(ORBITAR_GITHUB_API_LATEST_URL, {
      headers: {
        Accept: 'application/vnd.github+json',
      },
    });

    if (response.ok) {
      releaseData = (await response.json()) as GitHubReleasePayload;
    } else if (response.status === 404) {
      // Dacă nu există un release marcat „latest” (ex: doar pre-release sau încă niciun release),
      // interogăm lista de release-uri.
      const listResponse = await fetchImpl(ORBITAR_GITHUB_API_LIST_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
        },
      });
      if (listResponse.ok) {
        const list = (await listResponse.json()) as GitHubReleasePayload[];
        if (Array.isArray(list)) {
          releaseData = list.find((item) => item && !item.draft && item.tag_name) ?? null;
        }
      }
      if (!releaseData) {
        return {
          status: 'up-to-date',
          hasUpdate: false,
          currentVersion: cleanCurrent,
          latestVersion: cleanCurrent,
          releaseTitle: `Orbitar v${cleanCurrent}`,
          releaseUrl: ORBITAR_GITHUB_RELEASES_URL,
          publishedDateRo: '',
          releaseNotesSummary: '',
          messageRo: `Folosești cea mai recentă versiune disponibilă (v${cleanCurrent}).`,
        };
      }
    } else {
      throw new Error(`HTTP ${response.status}`);
    }

    if (!releaseData || !releaseData.tag_name) {
      return {
        status: 'up-to-date',
        hasUpdate: false,
        currentVersion: cleanCurrent,
        latestVersion: cleanCurrent,
        releaseTitle: `Orbitar v${cleanCurrent}`,
        releaseUrl: ORBITAR_GITHUB_RELEASES_URL,
        publishedDateRo: '',
        releaseNotesSummary: '',
        messageRo: `Folosești cea mai recentă versiune Orbitar (v${cleanCurrent}).`,
      };
    }

    const latestVersion = cleanVersionTag(releaseData.tag_name);
    const hasUpdate = isNewerVersionAvailable(cleanCurrent, latestVersion);
    const rawUrl = releaseData.html_url ?? ORBITAR_GITHUB_RELEASES_URL;
    const safeReleaseUrl = rawUrl.startsWith('https://github.com/')
      ? rawUrl
      : ORBITAR_GITHUB_RELEASES_URL;
    const publishedDateRo = formatIsoDateRo(releaseData.published_at);
    const releaseTitle = releaseData.name?.trim() || `Orbitar v${latestVersion}`;
    const releaseNotesSummary = summarizeReleaseBody(releaseData.body);

    if (hasUpdate) {
      return {
        status: 'update-available',
        hasUpdate: true,
        currentVersion: cleanCurrent,
        latestVersion,
        releaseTitle,
        releaseUrl: safeReleaseUrl,
        publishedDateRo,
        releaseNotesSummary,
        messageRo: `Este disponibilă o versiune nouă: Orbitar v${latestVersion} (versiunea instalată: v${cleanCurrent}). Deschide pagina de descărcare în browser pentru a descărca și instala noua versiune.`,
      };
    }

    return {
      status: 'up-to-date',
      hasUpdate: false,
      currentVersion: cleanCurrent,
      latestVersion,
      releaseTitle,
      releaseUrl: safeReleaseUrl,
      publishedDateRo,
      releaseNotesSummary,
      messageRo: `Excelent! Folosești deja cea mai recentă versiune Orbitar (v${cleanCurrent}).`,
    };
  } catch (_err) {
    return {
      status: 'error',
      hasUpdate: false,
      currentVersion: cleanCurrent,
      latestVersion: cleanCurrent,
      releaseTitle: '',
      releaseUrl: ORBITAR_GITHUB_RELEASES_URL,
      publishedDateRo: '',
      releaseNotesSummary: '',
      messageRo:
        'Nu s-a putut contacta serverul GitHub (verifică conexiunea la internet). Orbitar funcționează 100% offline — poți deschide manual pagina de release-uri în browser când ești conectat.',
    };
  }
}

/**
 * Deschide o adresă URL oficială (`https://github.com/diorgulescu/Orbitar...` sau `https://orbitar.ro`)
 * în browserul implicit al sistemului de operare.
 * - În aplicația desktop Tauri (Linux, Windows, macOS), apelează comanda nativă Rust `open_external_url`.
 * - În browser (sau ca fallback), apelează `window.open(..., '_blank', 'noopener,noreferrer')`.
 */
export async function openUrlInSystemBrowser(url: string): Promise<boolean> {
  if (!url || !url.startsWith('https://')) {
    return false;
  }

  const invoke = getTauriInvoke();
  if (invoke) {
    try {
      await invoke('open_external_url', { url });
      return true;
    } catch (_e) {
      // Fallback către window.open dacă apelul IPC eșuează
    }
  }

  if (typeof window !== 'undefined' && typeof window.open === 'function') {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }

  return false;
}

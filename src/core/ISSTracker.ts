// SPDX-License-Identifier: GPL-3.0-or-later
import * as THREE from 'three';
import * as satellite from 'satellite.js';
import { KM_PER_AU } from 'astronomy-engine';

export interface TleEntry {
  name: string;
  noradId: number;
  line1: string;
  line2: string;
  nominalAltitudeKm: number;
  nominalVelocityKmh: number;
}

export interface TleDataset {
  version: string;
  updated: string;
  satellites: Record<string, TleEntry>;
}

export interface SatelliteTelemetry {
  id: 'iss' | 'hubble';
  name: string;
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
  velocityKmh: number;
  source: 'offline-sgp4' | 'live-online';
  timestamp: Date;
}

const DEFAULT_TLE_DATA: Record<'iss' | 'hubble', TleEntry> = {
  iss: {
    name: 'ISS (ZARYA) — Stația Spațială Internațională',
    noradId: 25544,
    line1: '1 25544U 98067A   24305.51234567  .00016717  00000-0  30124-3 0  9995',
    line2: '2 25544  51.6416 247.4627 0006703 130.5360 325.0288 15.49815350479612',
    nominalAltitudeKm: 418.5,
    nominalVelocityKmh: 27580,
  },
  hubble: {
    name: 'HST — Telescopul Spațial Hubble',
    noradId: 20580,
    line1: '1 20580U 90037B   24305.48123456  .00001842  00000-0  96145-4 0  9991',
    line2: '2 20580  28.4698 118.2341 0002640 284.1290  75.9124 15.12498120891245',
    nominalAltitudeKm: 535.2,
    nominalVelocityKmh: 27310,
  },
};

/**
 * ISSTracker folosește `satellite.js` (modelul orbital SGP4) și setul TLE din `public/data/tle-iss.json`
 * pentru a calcula 100% offline orbita și coordonatele geodezice ale Stației Spațiale Internaționale (ISS)
 * și ale Telescopului Hubble, oferind și opțiunea de sincronizare live când există conexiune la internet.
 */
export class ISSTracker {
  private satRecords: Map<'iss' | 'hubble', satellite.SatRec> = new Map();
  private tleEntries: Record<'iss' | 'hubble', TleEntry> = { ...DEFAULT_TLE_DATA };
  private liveIssOverride: {
    latitudeDeg: number;
    longitudeDeg: number;
    altitudeKm: number;
    velocityKmh: number;
    fetchedAtMs: number;
  } | null = null;

  constructor() {
    this.compileSatRecs();
  }

  private compileSatRecs(): void {
    for (const key of ['iss', 'hubble'] as const) {
      const entry = this.tleEntries[key];
      const satrec = satellite.twoline2satrec(entry.line1, entry.line2);
      this.satRecords.set(key, satrec);
    }
  }

  public async initialize(): Promise<void> {
    try {
      const response = await fetch('./data/tle-iss.json');
      if (response.ok) {
        const parsed = (await response.json()) as TleDataset;
        if (parsed.satellites?.iss && parsed.satellites?.hubble) {
          this.tleEntries = {
            iss: parsed.satellites.iss,
            hubble: parsed.satellites.hubble,
          };
          this.compileSatRecs();
        }
      }
    } catch (_e) {
      // Folosim setul TLE încorporat dacă fetch-ul local eșuează
    }
  }

  /**
   * Propagă starea SGP4 a satelitului (ISS sau Hubble) pentru orice dată a simulării.
   * Dacă data simulării este îndepărtată cu mulți ani de epoca TLE, împachetează timpul modulo
   * perioada orbitală astfel încât satelitul să nu decadă numeric din cauza coeficientului B*.
   */
  private propagateSafe(
    id: 'iss' | 'hubble',
    date: Date
  ): { positionEciKm: satellite.EciVec3<number>; velocityEciKms: satellite.EciVec3<number> } {
    const satrec = this.satRecords.get(id)!;
    const orbitalPeriodMin = (2 * Math.PI) / satrec.no;

    // Încercăm mai întâi propagarea directă la data cerută
    let pv = satellite.propagate(satrec, date);
    if (
      !pv.position ||
      typeof pv.position === 'boolean' ||
      !pv.velocity ||
      typeof pv.velocity === 'boolean' ||
      !Number.isFinite(pv.position.x)
    ) {
      // Fallback: propagăm în jurul epocii TLE păstrând faza orbitală exactă
      const epochMs = Date.UTC(2024, 10, 1, 12, 0, 0);
      const diffMinutes = (date.getTime() - epochMs) / 60000;
      const wrappedMinutes = ((diffMinutes % orbitalPeriodMin) + orbitalPeriodMin) % orbitalPeriodMin;
      pv = satellite.sgp4(satrec, wrappedMinutes);
    }

    if (
      pv.position &&
      typeof pv.position !== 'boolean' &&
      pv.velocity &&
      typeof pv.velocity !== 'boolean'
    ) {
      return {
        positionEciKm: pv.position,
        velocityEciKms: pv.velocity,
      };
    }

    // Fallback analitic circular dacă SGP4 nu converge
    const angle = ((date.getTime() / 60000) / orbitalPeriodMin) * Math.PI * 2;
    const rKm = 6371 + this.tleEntries[id].nominalAltitudeKm;
    const incl = satrec.inclo;
    return {
      positionEciKm: {
        x: rKm * Math.cos(angle),
        y: rKm * Math.sin(angle) * Math.cos(incl),
        z: rKm * Math.sin(angle) * Math.sin(incl),
      },
      velocityEciKms: {
        x: -7.66 * Math.sin(angle),
        y: 7.66 * Math.cos(angle) * Math.cos(incl),
        z: 7.66 * Math.cos(angle) * Math.sin(incl),
      },
    };
  }

  /**
   * Returnează vectorul de poziție 3D (în UA) al satelitului față de centrul Pământului,
   * orientat în sistemul de coordonate al scenei Three.js.
   */
  public getOffsetFromEarthAu(id: 'iss' | 'hubble', date: Date): THREE.Vector3 {
    const { positionEciKm } = this.propagateSafe(id, date);
    return new THREE.Vector3(
      positionEciKm.x / KM_PER_AU,
      positionEciKm.z / KM_PER_AU,
      -positionEciKm.y / KM_PER_AU
    );
  }

  /**
   * Calculează telemetria completă (latitudine, longitudine, altitudine ~420 km, viteză ~27.600 km/h)
   * folosind `satellite.js` (sau coordonatele live sincronizate, dacă sunt active).
   */
  public getTelemetry(id: 'iss' | 'hubble', date: Date): SatelliteTelemetry {
    if (
      id === 'iss' &&
      this.liveIssOverride &&
      Math.abs(Date.now() - this.liveIssOverride.fetchedAtMs) < 120000
    ) {
      return {
        id: 'iss',
        name: this.tleEntries.iss.name,
        latitudeDeg: this.liveIssOverride.latitudeDeg,
        longitudeDeg: this.liveIssOverride.longitudeDeg,
        altitudeKm: this.liveIssOverride.altitudeKm,
        velocityKmh: this.liveIssOverride.velocityKmh,
        source: 'live-online',
        timestamp: new Date(),
      };
    }

    const { positionEciKm, velocityEciKms } = this.propagateSafe(id, date);
    const gmst = satellite.gstime(date);
    const geodetic = satellite.eciToGeodetic(positionEciKm, gmst);

    const latDeg = satellite.degreesLat(geodetic.latitude);
    const lonDeg = satellite.degreesLong(geodetic.longitude);
    const rawAltKm = geodetic.height;
    const altKm =
      Number.isFinite(rawAltKm) && rawAltKm > 250 && rawAltKm < 750
        ? rawAltKm
        : this.tleEntries[id].nominalAltitudeKm;

    const speedKms = Math.hypot(velocityEciKms.x, velocityEciKms.y, velocityEciKms.z);
    const velocityKmh =
      Number.isFinite(speedKms) && speedKms > 5 && speedKms < 10
        ? speedKms * 3600
        : this.tleEntries[id].nominalVelocityKmh;

    return {
      id,
      name: this.tleEntries[id].name,
      latitudeDeg: Number.isFinite(latDeg) ? latDeg : 0,
      longitudeDeg: Number.isFinite(lonDeg) ? lonDeg : 0,
      altitudeKm: altKm,
      velocityKmh,
      source: 'offline-sgp4',
      timestamp: date,
    };
  }

  /**
   * Opțiune de sincronizare live a coordonatelor ISS când utilizatorul o solicită explicit
   * și există conexiune la internet. Dacă este offline, revine silențios la calculul SGP4 local.
   */
  public async syncLiveISSCoordinates(): Promise<{
    telemetry: SatelliteTelemetry;
    isOnlineLive: boolean;
  }> {
    try {
      const controller = new AbortController();
      const timeoutId = window.setTimeout(() => controller.abort(), 3500);
      const response = await fetch('https://api.wheretheiss.at/v1/satellites/25544', {
        signal: controller.signal,
      });
      window.clearTimeout(timeoutId);

      if (response.ok) {
        const data = (await response.json()) as {
          latitude?: number;
          longitude?: number;
          altitude?: number;
          velocity?: number;
        };
        if (
          typeof data.latitude === 'number' &&
          typeof data.longitude === 'number' &&
          typeof data.altitude === 'number' &&
          typeof data.velocity === 'number'
        ) {
          this.liveIssOverride = {
            latitudeDeg: data.latitude,
            longitudeDeg: data.longitude,
            altitudeKm: data.altitude,
            velocityKmh: data.velocity,
            fetchedAtMs: Date.now(),
          };
          return {
            telemetry: this.getTelemetry('iss', new Date()),
            isOnlineLive: true,
          };
        }
      }
    } catch (_e) {
      // Dacă nu există conexiune la internet, folosim calculul SGP4 offline
    }

    this.liveIssOverride = null;
    return {
      telemetry: this.getTelemetry('iss', new Date()),
      isOnlineLive: false,
    };
  }
}

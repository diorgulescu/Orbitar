// SPDX-License-Identifier: GPL-3.0-or-later

export type AgeTier = 'junior' | 'cadet';

export type CosmicHorizon = 'solar' | 'interstellar' | 'galactic';

export type CelestialCategory =
  | 'star'
  | 'terrestrial'
  | 'gas_giant'
  | 'ice_giant'
  | 'dwarf'
  | 'moon'
  | 'asteroid'
  | 'station'
  | 'telescope'
  | 'probe'
  | 'rover'
  | 'oort_cloud'
  | 'exoplanet'
  | 'star_cluster'
  | 'nebula'
  | 'black_hole'
  | 'galaxy';

export interface TravelTimeInfo {
  car: string;
  plane: string;
  rocket: string;
  light: string;
}

export interface JuniorContent {
  summary: string;
  analogy: string;
  funFact: string;
  travelTime: TravelTimeInfo;
}

export interface StructureLayerOrInstrument {
  name: string;
  description: string;
}

export interface QuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface CadetContent {
  summary: string;
  structure: StructureLayerOrInstrument[];
  explorationHistory: string;
  quiz: QuizItem;
}

export interface KeplerianElements {
  semiMajorAxisAU: number;
  eccentricity: number;
  inclinationDeg: number;
  ascendingNodeDeg: number;
  argPerihelionDeg: number;
  meanAnomalyDeg: number;
}

export interface CelestialBodyData {
  id: string;
  name: string;
  category: CelestialCategory;
  subtitle: string;
  color: string;
  orbitColor?: string;
  parentId?: string;
  radiusKm: number;
  massEarthRatio: number;
  gravityRatio: number;
  orbitPeriodDays: number;
  dayLengthHours: number;
  meanTempC: number;
  distanceFromSunAU: number;
  axialTiltDeg?: number;
  localOrbitOrder?: number;
  keplerian?: KeplerianElements;
  modelType?:
    | 'sphere'
    | 'asteroid'
    | 'iss'
    | 'hubble'
    | 'jwst'
    | 'voyager'
    | 'probe'
    | 'rover'
    | 'oort_cloud'
    | 'star_system'
    | 'trappist_system'
    | 'lava_exoplanet'
    | 'star_cluster'
    | 'nebula'
    | 'black_hole'
    | 'spiral_galaxy';
  horizon?: CosmicHorizon;
  distanceLightYears?: number;
  distanceLightYearsLabelRo?: string;
  sizeComparisonRo?: string;
  sizeRatioToSun?: number;
  lightDepartureHistoryRo?: string;
  deepSpacePosition?: [number, number, number];
  junior: JuniorContent;
  cadet: CadetContent;
}

export interface BeltConfig {
  id: string;
  name: string;
  innerRadiusAU: number;
  outerRadiusAU: number;
  thicknessAU: number;
  count: number;
  color: string;
  descriptionRo: string;
}

export interface SolarSystemDataset {
  version: string;
  language: 'ro';
  belts: BeltConfig[];
  bodies: CelestialBodyData[];
}

export interface MissionsDataset {
  version: string;
  language: 'ro';
  missions: CelestialBodyData[];
}

export interface DeepSpaceDataset {
  version: string;
  language: 'ro';
  objects: CelestialBodyData[];
}

// SPDX-License-Identifier: GPL-3.0-or-later

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::orbital::{
    default_keplerian_for_body, scale_moon_orbit_distance, scale_orbit_distance_logarithmic,
    scale_radius_didactic,
};

const SOLAR_SYSTEM_RO_JSON: &str = include_str!("../../../public/data/solar-system-ro.json");
const MISSIONS_RO_JSON: &str = include_str!("../../../public/data/missions-ro.json");
const DEEP_SPACE_RO_JSON: &str = include_str!("../../../public/data/deep-space-ro.json");

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CelestialCategory {
    Star,
    Terrestrial,
    GasGiant,
    IceGiant,
    Dwarf,
    Moon,
    Asteroid,
    Station,
    Telescope,
    Probe,
    Rover,
    OortCloud,
    Exoplanet,
    StarCluster,
    Nebula,
    BlackHole,
    Galaxy,
}

impl CelestialCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Star => "star",
            Self::Terrestrial => "terrestrial",
            Self::GasGiant => "gas_giant",
            Self::IceGiant => "ice_giant",
            Self::Dwarf => "dwarf",
            Self::Moon => "moon",
            Self::Asteroid => "asteroid",
            Self::Station => "station",
            Self::Telescope => "telescope",
            Self::Probe => "probe",
            Self::Rover => "rover",
            Self::OortCloud => "oort_cloud",
            Self::Exoplanet => "exoplanet",
            Self::StarCluster => "star_cluster",
            Self::Nebula => "nebula",
            Self::BlackHole => "black_hole",
            Self::Galaxy => "galaxy",
        }
    }

    pub fn label_ro(&self) -> &'static str {
        match self {
            Self::Star => "Stea",
            Self::Terrestrial => "Planetă Telurică",
            Self::GasGiant => "Gigant Gazos",
            Self::IceGiant => "Gigant de Gheață",
            Self::Dwarf => "Planetă Pitică",
            Self::Moon => "Satelit Natural",
            Self::Asteroid => "Asteroid",
            Self::Station => "Stație Spațială",
            Self::Telescope => "Telescop Spațial",
            Self::Probe => "Sondă Interplanetară",
            Self::Rover => "Rover Planetar",
            Self::OortCloud => "Granița Sistemului Solar",
            Self::Exoplanet => "Sistem Exoplanetar",
            Self::StarCluster => "Roi Stelar Deschis",
            Self::Nebula => "Nebuloasă / Maternitate Stelară",
            Self::BlackHole => "Gaură Neagră Supermasivă",
            Self::Galaxy => "Galaxie Spirală",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TravelTimeInfo {
    pub car: String,
    pub plane: String,
    pub rocket: String,
    pub light: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JuniorContent {
    pub summary: String,
    pub analogy: String,
    pub fun_fact: String,
    pub travel_time: TravelTimeInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StructureLayerOrInstrument {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizItem {
    pub question: String,
    pub options: Vec<String>,
    pub correct_index: usize,
    pub explanation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CadetContent {
    pub summary: String,
    pub structure: Vec<StructureLayerOrInstrument>,
    pub exploration_history: String,
    pub quiz: QuizItem,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct KeplerianElements {
    #[serde(rename = "semiMajorAxisAU")]
    pub semi_major_axis_au: f64,
    pub eccentricity: f64,
    #[serde(rename = "inclinationDeg")]
    pub inclination_deg: f64,
    #[serde(rename = "ascendingNodeDeg")]
    pub ascending_node_deg: f64,
    #[serde(rename = "argPerihelionDeg")]
    pub arg_perihelion_deg: f64,
    #[serde(rename = "meanAnomalyDeg")]
    pub mean_anomaly_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CelestialBodyData {
    pub id: String,
    pub name: String,
    pub category: CelestialCategory,
    pub subtitle: String,
    pub color: String,
    #[serde(rename = "orbitColor")]
    pub orbit_color: Option<String>,
    #[serde(rename = "parentId")]
    pub parent_id: Option<String>,
    #[serde(rename = "radiusKm")]
    pub radius_km: f64,
    #[serde(rename = "massEarthRatio")]
    pub mass_earth_ratio: f64,
    #[serde(rename = "gravityRatio")]
    pub gravity_ratio: f64,
    #[serde(rename = "orbitPeriodDays")]
    pub orbit_period_days: f64,
    #[serde(rename = "dayLengthHours")]
    pub day_length_hours: f64,
    #[serde(rename = "meanTempC")]
    pub mean_temp_c: f64,
    #[serde(rename = "distanceFromSunAU")]
    pub distance_from_sun_au: f64,
    #[serde(rename = "axialTiltDeg")]
    pub axial_tilt_deg: Option<f64>,
    #[serde(rename = "localOrbitOrder")]
    pub local_orbit_order: Option<u32>,
    pub keplerian: Option<KeplerianElements>,
    #[serde(rename = "modelType")]
    pub model_type: Option<String>,
    pub horizon: Option<String>,
    #[serde(rename = "distanceLightYears")]
    pub distance_light_years: Option<f64>,
    #[serde(rename = "distanceLightYearsLabelRo")]
    pub distance_light_years_label_ro: Option<String>,
    #[serde(rename = "sizeComparisonRo")]
    pub size_comparison_ro: Option<String>,
    #[serde(rename = "sizeRatioToSun")]
    pub size_ratio_to_sun: Option<f64>,
    #[serde(rename = "lightDepartureHistoryRo")]
    pub light_departure_history_ro: Option<String>,
    #[serde(rename = "deepSpacePosition")]
    pub deep_space_position: Option<[f64; 3]>,
    pub junior: JuniorContent,
    pub cadet: CadetContent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BeltConfig {
    pub id: String,
    pub name: String,
    #[serde(rename = "innerRadiusAU")]
    pub inner_radius_au: f64,
    #[serde(rename = "outerRadiusAU")]
    pub outer_radius_au: f64,
    #[serde(rename = "thicknessAU")]
    pub thickness_au: f64,
    pub count: u32,
    pub color: String,
    #[serde(rename = "descriptionRo")]
    pub description_ro: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolarSystemDataset {
    pub version: String,
    pub language: String,
    pub belts: Vec<BeltConfig>,
    pub bodies: Vec<CelestialBodyData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MissionsDataset {
    pub version: String,
    pub language: String,
    pub missions: Vec<CelestialBodyData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeepSpaceDataset {
    pub version: String,
    pub language: String,
    pub objects: Vec<CelestialBodyData>,
}

/// Căile resurselor PBR 2K și 4K pentru Godot 4 (`res://assets/textures/...`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlanetTexturePaths {
    pub albedo_2k: String,
    pub albedo_4k: String,
    pub bump_map: Option<String>,
    pub roughness_map: Option<String>,
    pub clouds_map: Option<String>,
    pub night_map: Option<String>,
    pub ring_map: Option<String>,
}

/// Configurația haloului atmosferic Fresnel / Rim lighting pentru un corp ceresc.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AtmosphereConfig {
    pub has_atmosphere: bool,
    pub color_hex: String,
    pub rim_intensity: f32,
    pub outer_scale: f32,
}

/// Intrare completă în catalogul nativ Orbitar (date astronomice + scalare pentru gameplay + texturi + conținut didactic RO).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogBodyEntry {
    pub data: CelestialBodyData,
    pub category_label_ro: String,
    pub scaled_radius: f64,
    pub scaled_orbit_distance: f64,
    pub effective_keplerian: Option<KeplerianElements>,
    pub textures: PlanetTexturePaths,
    pub atmosphere: AtmosphereConfig,
}

/// Returnează configurația atmosferei Fresnel (Rim lighting) pentru planetele și sateliții cu atmosferă.
pub fn resolve_atmosphere_config(body_id: &str) -> AtmosphereConfig {
    match body_id {
        "earth" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#38bdf8".to_string(),
            rim_intensity: 0.78,
            outer_scale: 1.032,
        },
        "venus" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#fbbf24".to_string(),
            rim_intensity: 0.72,
            outer_scale: 1.035,
        },
        "mars" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#f97316".to_string(),
            rim_intensity: 0.48,
            outer_scale: 1.025,
        },
        "jupiter" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#fde68a".to_string(),
            rim_intensity: 0.35,
            outer_scale: 1.022,
        },
        "saturn" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#fef08a".to_string(),
            rim_intensity: 0.34,
            outer_scale: 1.022,
        },
        "uranus" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#67e8f9".to_string(),
            rim_intensity: 0.52,
            outer_scale: 1.028,
        },
        "neptune" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#38bdf8".to_string(),
            rim_intensity: 0.58,
            outer_scale: 1.028,
        },
        "titan" => AtmosphereConfig {
            has_atmosphere: true,
            color_hex: "#f59e0b".to_string(),
            rim_intensity: 0.70,
            outer_scale: 1.045,
        },
        _ => AtmosphereConfig {
            has_atmosphere: false,
            color_hex: "#000000".to_string(),
            rim_intensity: 0.0,
            outer_scale: 1.0,
        },
    }
}

/// Returnează căile texturilor PBR 2K și 4K (în format `res://assets/textures/...`) pentru un corp ceresc.
pub fn resolve_texture_paths(body_id: &str) -> PlanetTexturePaths {
    let hd_file = match body_id {
        "sun" => Some("hd/sun_albedo.jpg"),
        "mercury" => Some("hd/mercury_messenger_albedo.jpg"),
        "venus" => Some("hd/venus_magellan_surface.jpg"),
        "earth" => Some("hd/earth_albedo.jpg"),
        "moon" => Some("hd/moon_lro_albedo.jpg"),
        "mars" => Some("hd/mars_viking_albedo.jpg"),
        "phobos" => Some("hd/phobos_viking.jpg"),
        "deimos" => Some("hd/deimos_viking.jpg"),
        "jupiter" => Some("hd/jupiter_cassini_albedo.jpg"),
        "io" => Some("hd/io_galileo.jpg"),
        "europa" => Some("hd/europa_galileo.jpg"),
        "ganymede" => Some("hd/ganymede_galileo.jpg"),
        "callisto" => Some("hd/callisto_galileo.jpg"),
        "saturn" => Some("hd/saturn_cassini_albedo.jpg"),
        "mimas" => Some("hd/mimas_cassini.jpg"),
        "enceladus" => Some("hd/enceladus_cassini.jpg"),
        "tethys" => Some("hd/tethys_cassini.jpg"),
        "dione" => Some("hd/dione_cassini.jpg"),
        "rhea" => Some("hd/rhea_cassini.jpg"),
        "titan" => Some("hd/titan_cassini.jpg"),
        "hyperion" => Some("hd/hyperion_cassini.jpg"),
        "iapetus" => Some("hd/iapetus_cassini.jpg"),
        "phoebe" => Some("hd/phoebe_cassini.jpg"),
        "uranus" => Some("hd/uranus_voyager.jpg"),
        "miranda" => Some("hd/miranda_voyager.jpg"),
        "ariel" => Some("hd/ariel_voyager.jpg"),
        "umbriel" => Some("hd/umbriel_voyager.jpg"),
        "titania" => Some("hd/titania_voyager.jpg"),
        "oberon" => Some("hd/oberon_voyager.jpg"),
        "neptune" => Some("hd/neptune_voyager.jpg"),
        "triton" => Some("hd/triton_voyager.jpg"),
        "pluto" => Some("hd/pluto_newhorizons.jpg"),
        "charon" => Some("hd/charon_newhorizons.jpg"),
        "ceres" => Some("hd/ceres_dawn.jpg"),
        "vesta" => Some("hd/vesta_dawn.jpg"),
        "eris" => Some("eris.jpg"),
        "haumea" => Some("haumea.jpg"),
        "makemake" => Some("makemake.jpg"),
        _ => None,
    };

    let base_2k_rel = match body_id {
        "sun" => "2k/sun.jpg",
        "mercury" => "2k/mercury.jpg",
        "venus" => "2k/venus_surface.jpg",
        "earth" => "2k/earth_daymap.jpg",
        "moon" => "2k/moon.jpg",
        "mars" => "2k/mars.jpg",
        "jupiter" => "2k/jupiter.jpg",
        "saturn" => "2k/saturn.jpg",
        "uranus" => "2k/uranus.jpg",
        "neptune" => "2k/neptune.jpg",
        "ceres" => "2k/ceres.jpg",
        "eris" => "2k/eris.jpg",
        "haumea" => "2k/haumea.jpg",
        "makemake" => "2k/makemake.jpg",
        _ => hd_file.unwrap_or("2k/mercury.jpg"),
    };

    let base_4k_rel = match hd_file {
        Some(f) if f.starts_with("hd/") => {
            let bare = f.trim_start_matches("hd/");
            format!("4k/{bare}")
        }
        Some(f) => format!("4k/{f}"),
        None => base_2k_rel.replace("2k/", "4k/"),
    };

    let bump_rel = match body_id {
        "mercury" => Some("hd/mercury_bump.jpg"),
        "venus" => Some("hd/venus_magellan_surface.jpg"),
        "earth" => Some("hd/earth_bump.jpg"),
        "moon" => Some("hd/moon_lola_bump.jpg"),
        "mars" => Some("hd/mars_mola_bump.jpg"),
        "phobos" => Some("hd/phobos_viking.jpg"),
        "deimos" => Some("hd/deimos_viking.jpg"),
        "mimas" => Some("hd/mimas_cassini.jpg"),
        "tethys" => Some("hd/tethys_cassini.jpg"),
        "dione" => Some("hd/dione_cassini.jpg"),
        "rhea" => Some("hd/rhea_cassini.jpg"),
        "hyperion" => Some("hd/hyperion_cassini.jpg"),
        "iapetus" => Some("hd/iapetus_cassini.jpg"),
        "phoebe" => Some("hd/phoebe_cassini.jpg"),
        "miranda" => Some("hd/miranda_voyager.jpg"),
        "ariel" => Some("hd/ariel_voyager.jpg"),
        "umbriel" => Some("hd/umbriel_voyager.jpg"),
        "titania" => Some("hd/titania_voyager.jpg"),
        "oberon" => Some("hd/oberon_voyager.jpg"),
        "triton" => Some("hd/triton_voyager.jpg"),
        "pluto" => Some("hd/pluto_newhorizons.jpg"),
        "charon" => Some("hd/charon_newhorizons.jpg"),
        "ceres" => Some("hd/ceres_dawn.jpg"),
        "vesta" => Some("hd/vesta_dawn.jpg"),
        _ => None,
    };

    let roughness_map = if body_id == "earth" {
        Some("res://assets/textures/hd/earth_ocean_roughness.jpg".to_string())
    } else {
        None
    };

    let clouds_map = match body_id {
        "earth" => Some("res://assets/textures/hd/earth_clouds_alpha.png".to_string()),
        "venus" => Some("res://assets/textures/hd/venus_galileo_atmosphere.jpg".to_string()),
        _ => None,
    };

    let night_map = if body_id == "earth" {
        Some("res://assets/textures/hd/earth_nightlights.jpg".to_string())
    } else {
        None
    };

    let ring_map = if body_id == "saturn" {
        Some("res://assets/textures/hd/saturn_rings_rgba.png".to_string())
    } else {
        None
    };

    PlanetTexturePaths {
        albedo_2k: format!("res://assets/textures/{base_2k_rel}"),
        albedo_4k: format!("res://assets/textures/{base_4k_rel}"),
        bump_map: bump_rel.map(|p| format!("res://assets/textures/{p}")),
        roughness_map,
        clouds_map,
        night_map,
        ring_map,
    }
}

/// Catalogul central al corpurilor cerești din Orbitar (Planete, Sateliți, Planete Pitice, Asteroizi, Soare).
#[derive(Debug, Clone)]
pub struct OrbitarCatalog {
    entries: Vec<CatalogBodyEntry>,
    index_by_id: HashMap<String, usize>,
    belts: Vec<BeltConfig>,
}

impl Default for OrbitarCatalog {
    fn default() -> Self {
        Self::load_embedded()
    }
}

impl OrbitarCatalog {
    /// Încarcă și construiește catalogul complet din baza de date didactică în limba română.
    pub fn load_embedded() -> Self {
        let solar_ds: SolarSystemDataset = serde_json::from_str(SOLAR_SYSTEM_RO_JSON)
            .expect("JSON valid în public/data/solar-system-ro.json");

        // Pre-calculăm razele scalate pentru părinți (necesare la orbitele locale ale sateliților)
        let mut parent_radii: HashMap<String, f64> = HashMap::new();
        for body in &solar_ds.bodies {
            let r = scale_radius_didactic(body.radius_km, body.category);
            parent_radii.insert(body.id.clone(), r);
        }

        let mut entries = Vec::with_capacity(solar_ds.bodies.len());
        let mut index_by_id = HashMap::with_capacity(solar_ds.bodies.len());

        for body in solar_ds.bodies {
            let scaled_radius = scale_radius_didactic(body.radius_km, body.category);
            let effective_keplerian = body
                .keplerian
                .or_else(|| default_keplerian_for_body(&body.id));

            let scaled_orbit_distance = if body.id == "sun" {
                0.0
            } else if let Some(ref parent_id) = body.parent_id {
                let parent_r = parent_radii.get(parent_id).copied().unwrap_or(2.0);
                scale_moon_orbit_distance(
                    &body.id,
                    parent_r,
                    body.local_orbit_order.unwrap_or(1),
                    body.category,
                )
            } else {
                scale_orbit_distance_logarithmic(&body.id, body.distance_from_sun_au)
            };

            let textures = resolve_texture_paths(&body.id);
            let atmosphere = resolve_atmosphere_config(&body.id);
            let category_label_ro = body.category.label_ro().to_string();
            let id = body.id.clone();

            let idx = entries.len();
            entries.push(CatalogBodyEntry {
                data: body,
                category_label_ro,
                scaled_radius,
                scaled_orbit_distance,
                effective_keplerian,
                textures,
                atmosphere,
            });
            index_by_id.insert(id, idx);
        }

        Self {
            entries,
            index_by_id,
            belts: solar_ds.belts,
        }
    }

    /// Încarcă opțional și misiunile spațiale (`missions-ro.json`).
    pub fn load_missions_dataset() -> MissionsDataset {
        serde_json::from_str(MISSIONS_RO_JSON)
            .expect("JSON valid în public/data/missions-ro.json")
    }

    /// Încarcă opțional și obiectele Deep Space (`deep-space-ro.json`).
    pub fn load_deep_space_dataset() -> DeepSpaceDataset {
        serde_json::from_str(DEEP_SPACE_RO_JSON)
            .expect("JSON valid în public/data/deep-space-ro.json")
    }

    pub fn entries(&self) -> &[CatalogBodyEntry] {
        &self.entries
    }

    pub fn belts(&self) -> &[BeltConfig] {
        &self.belts
    }

    pub fn get(&self, id: &str) -> Option<&CatalogBodyEntry> {
        self.index_by_id.get(id).and_then(|&idx| self.entries.get(idx))
    }

    pub fn len(&self) -> usize {
        self.entries.len()
    }

    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

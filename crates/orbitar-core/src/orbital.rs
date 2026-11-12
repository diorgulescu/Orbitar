// SPDX-License-Identifier: GPL-3.0-or-later

use glam::{DVec3, Vec3};
use std::f64::consts::{PI, TAU};

use crate::catalog::{CelestialCategory, KeplerianElements, OrbitarCatalog};

/// 1 Unitate Astronomică în kilometri (IAU 2012).
pub const KM_PER_AU: f64 = 149_597_870.7;

/// Viteza luminii în vid exprimată în km/h.
pub const SPEED_OF_LIGHT_KMH: f64 = 1_079_252_848.8;

/// Înclinația eclipticii la epoca J2000 (în radiani).
pub const J2000_OBLIQUITY_RAD: f64 = 23.4392911 * PI / 180.0;

/// Factorul de scară în modul Real (1 UA = 100 unități 3D).
pub const REAL_UNITS_PER_AU: f64 = 100.0;

/// Orizontul optic anti-clipping în spațiul Godot (`120.000` unități, sub `camera.far = 250.000`).
pub const OPTICAL_HORIZON: f64 = 120_000.0;

/// Multiplicatorul razei planetare pentru Frânarea Gravitațională Automată (`Hyper-Drop` la `2.2 * R`).
pub const HYPER_DROP_RADIUS_MULTIPLIER: f64 = 2.2;

/// Multiplicatorul razei planetare pentru activarea Scannerului Științific (`3.5 * R`).
pub const SCANNER_RADIUS_MULTIPLIER: f64 = 3.5;

/// Multiplicatorul scării interplanetare în `f64` (distanțe de zeci și sute de milioane de unități).
pub const ORBIT_DISTANCE_SCALE_FACTOR: f64 = 2_500_000.0;

/// Culoare orbitale radiale calibrate didactic (în UA echivalente) pentru evitarea intersecțiilor vizuale.
pub fn didactic_orbit_au(body_id: &str) -> Option<f64> {
    match body_id {
        "parker" => Some(0.12),
        "mercury" => Some(0.26),
        "venus" => Some(0.46),
        "apophis" => Some(0.60),
        "earth" => Some(1.00),
        "bennu" => Some(1.46),
        "mars" => Some(1.88),
        "vesta" => Some(2.36),
        "ceres" => Some(2.66),
        "pallas" => Some(2.96),
        "psyche" => Some(3.26),
        "juice" => Some(3.60),
        "rosetta" => Some(3.96),
        "jupiter" => Some(5.45),
        "saturn" => Some(9.582),
        "uranus" => Some(19.218),
        "neptune" => Some(30.11),
        "pluto" => Some(36.5),
        "haumea" => Some(41.2),
        "makemake" => Some(45.8),
        "newhorizons" => Some(50.5),
        "voyager2" => Some(55.5),
        "voyager1" => Some(61.0),
        "eris" => Some(67.86),
        _ => None,
    }
}

/// Elemente kepleriene J2000 (NASA JPL) pentru planetele principale și Pluto.
pub fn default_keplerian_for_body(body_id: &str) -> Option<KeplerianElements> {
    match body_id {
        "mercury" => Some(KeplerianElements {
            semi_major_axis_au: 0.387098,
            eccentricity: 0.205630,
            inclination_deg: 7.0049,
            ascending_node_deg: 48.33167,
            arg_perihelion_deg: 29.12478,
            mean_anomaly_deg: 174.7948,
        }),
        "venus" => Some(KeplerianElements {
            semi_major_axis_au: 0.723332,
            eccentricity: 0.006772,
            inclination_deg: 3.39471,
            ascending_node_deg: 76.68069,
            arg_perihelion_deg: 54.85229,
            mean_anomaly_deg: 50.4161,
        }),
        "earth" => Some(KeplerianElements {
            semi_major_axis_au: 1.00000011,
            eccentricity: 0.01671022,
            inclination_deg: 0.00005,
            ascending_node_deg: -11.26064,
            arg_perihelion_deg: 114.20783,
            mean_anomaly_deg: 357.51716,
        }),
        "mars" => Some(KeplerianElements {
            semi_major_axis_au: 1.52366231,
            eccentricity: 0.09341233,
            inclination_deg: 1.85061,
            ascending_node_deg: 49.57854,
            arg_perihelion_deg: 286.4623,
            mean_anomaly_deg: 19.41248,
        }),
        "jupiter" => Some(KeplerianElements {
            semi_major_axis_au: 5.20336301,
            eccentricity: 0.04839266,
            inclination_deg: 1.30530,
            ascending_node_deg: 100.55615,
            arg_perihelion_deg: 274.1977,
            mean_anomaly_deg: 20.0202,
        }),
        "saturn" => Some(KeplerianElements {
            semi_major_axis_au: 9.53707032,
            eccentricity: 0.05415060,
            inclination_deg: 2.48446,
            ascending_node_deg: 113.71504,
            arg_perihelion_deg: 338.7169,
            mean_anomaly_deg: 317.0207,
        }),
        "uranus" => Some(KeplerianElements {
            semi_major_axis_au: 19.19126393,
            eccentricity: 0.04716771,
            inclination_deg: 0.76986,
            ascending_node_deg: 74.22988,
            arg_perihelion_deg: 96.73436,
            mean_anomaly_deg: 142.2386,
        }),
        "neptune" => Some(KeplerianElements {
            semi_major_axis_au: 30.06896348,
            eccentricity: 0.00858587,
            inclination_deg: 1.76917,
            ascending_node_deg: 131.72169,
            arg_perihelion_deg: 273.24966,
            mean_anomaly_deg: 259.8832,
        }),
        "pluto" => Some(KeplerianElements {
            semi_major_axis_au: 39.48168677,
            eccentricity: 0.24880766,
            inclination_deg: 17.14175,
            ascending_node_deg: 110.30347,
            arg_perihelion_deg: 113.76329,
            mean_anomaly_deg: 14.53,
        }),
        _ => None,
    }
}

/// Calculează raza 3D scalată didactic la scară monolitică / colosală (în unități de scenă),
/// păstrând nava la ~10–15m și transformând planetele în giganți curbați imensi:
/// - Pământul (`6.371 km`): `75.000` unități (în intervalul `50.000` – `100.000`)
/// - Jupiter (`69.911 km`): `~579.680` unități (`> 500.000`)
/// - Soarele (`696.340 km`): `2.400.000` unități (`> 2.000.000`)
pub fn scale_radius_didactic(radius_km: f64, category: CelestialCategory) -> f64 {
    match category {
        CelestialCategory::Galaxy => 6_500_000.0,
        CelestialCategory::OortCloud => 4_200_000.0,
        CelestialCategory::Nebula | CelestialCategory::StarCluster => 3_500_000.0,
        CelestialCategory::BlackHole => 2_800_000.0,
        CelestialCategory::Exoplanet => 180_000.0,
        CelestialCategory::Star => {
            if radius_km > 10_000_000.0 {
                3_200_000.0
            } else {
                2_400_000.0
            }
        }
        CelestialCategory::Rover => 4.5,
        CelestialCategory::Probe | CelestialCategory::Station | CelestialCategory::Telescope => {
            let craft_log = radius_km.max(0.001).log10();
            12.0 + ((craft_log + 3.0) / 1.8).max(0.0) * 18.0
        }
        CelestialCategory::Moon => {
            if radius_km >= 1000.0 {
                75_000.0 * (radius_km / 6371.0)
            } else if radius_km >= 100.0 {
                4_200.0 + ((radius_km - 100.0) / 900.0) * 10_800.0
            } else {
                850.0 + (radius_km.max(1.0) / 100.0) * 2_600.0
            }
        }
        CelestialCategory::Dwarf => 9_500.0 + ((radius_km - 400.0) / 800.0).max(0.0) * 11_000.0,
        CelestialCategory::Asteroid => {
            let clamped = radius_km.clamp(0.1, 300.0);
            1_100.0 + (clamped / 300.0).powf(0.45) * 6_800.0
        }
        CelestialCategory::Terrestrial => 75_000.0 * (radius_km / 6371.0),
        CelestialCategory::GasGiant | CelestialCategory::IceGiant => {
            let giant_norm =
                ((radius_km.max(20_000.0).log10() - 4.30) / (4.845 - 4.30)).max(0.0);
            220_000.0 + giant_norm * 360_000.0
        }
    }
}

/// Calculează distanța orbitală în `f64` la scară vastă interplanetară (zeci și sute de milioane de unități),
/// astfel încât în zbor sub-luminic să fie imposibil de parcurs, iar în modul HYPER (`500.000` – `20.000.000` u/s)
/// traversarea dintre două planete să dureze 12–25 de secunde.
pub fn scale_orbit_distance_logarithmic(body_id: &str, distance_from_sun_au: f64) -> f64 {
    if body_id == "sun" || distance_from_sun_au <= 0.0 {
        return 0.0;
    }
    let effective_au = didactic_orbit_au(body_id).unwrap_or(distance_from_sun_au);
    let log_component = 22.0 * (1.0 + effective_au * 3.5).ln();
    let power_component = 12.0 + 44.0 * effective_au.powf(0.65);
    0.5 * (log_component + power_component) * ORBIT_DISTANCE_SCALE_FACTOR
}

/// Scalează distanța orbitală locală a unui satelit natural în jurul planetei-mamă.
pub fn scale_moon_orbit_distance(
    _moon_id: &str,
    parent_scaled_radius: f64,
    local_orbit_order: u32,
    category: CelestialCategory,
) -> f64 {
    let order = local_orbit_order.max(1) as f64;
    if category == CelestialCategory::Rover {
        return parent_scaled_radius * 1.18;
    }
    let base_multiplier = if matches!(
        category,
        CelestialCategory::Station | CelestialCategory::Telescope
    ) {
        if local_orbit_order == 1 {
            1.085
        } else if local_orbit_order == 2 {
            1.145
        } else {
            1.47 + order * 0.57
        }
    } else {
        3.20 + (order - 1.0) * 0.72
    };
    parent_scaled_radius * base_multiplier
}

/// Rezolvă ecuația lui Kepler `E - e * sin(E) = M` în `f64` folosind iterații Newton-Raphson.
pub fn solve_kepler_equation_f64(mean_anomaly_rad: f64, eccentricity: f64) -> f64 {
    let mut e_anom = mean_anomaly_rad;
    for _ in 0..6 {
        let f = e_anom - eccentricity * e_anom.sin() - mean_anomaly_rad;
        let f_prime = 1.0 - eccentricity * e_anom.cos();
        if f_prime.abs() > 1e-12 {
            e_anom -= f / f_prime;
        }
    }
    e_anom
}

/// Calculează poziția heliocentrică 3D în Unități Astronomice (`DVec3` în `f64`) la `time_days` zile de la J2000.
pub fn keplerian_to_heliocentric_au_f64(
    kep: &KeplerianElements,
    orbit_period_days: f64,
    time_days: f64,
) -> DVec3 {
    let n_deg_per_day = if orbit_period_days > 0.0 {
        360.0 / orbit_period_days
    } else {
        0.9856 / kep.semi_major_axis_au.max(0.01).powf(1.5)
    };

    let m_deg = (kep.mean_anomaly_deg + n_deg_per_day * time_days).rem_euclid(360.0);
    let m_rad = m_deg.to_radians();
    let e = kep.eccentricity;

    let e_anom = solve_kepler_equation_f64(m_rad, e);
    let xv = kep.semi_major_axis_au * (e_anom.cos() - e);
    let yv = kep.semi_major_axis_au * (1.0 - e * e).max(0.0).sqrt() * e_anom.sin();

    let v = yv.atan2(xv);
    let r = xv.hypot(yv);

    let i_rad = kep.inclination_deg.to_radians();
    let omega_rad = kep.ascending_node_deg.to_radians();
    let w_rad = kep.arg_perihelion_deg.to_radians();
    let u = v + w_rad;

    let x_ecl = r * (omega_rad.cos() * u.cos() - omega_rad.sin() * u.sin() * i_rad.cos());
    let y_ecl = r * (omega_rad.sin() * u.cos() + omega_rad.cos() * u.sin() * i_rad.cos());
    let z_ecl = r * (u.sin() * i_rad.sin());

    // Coordonate 3D (X-Z plan ecliptic, Y verticală)
    DVec3::new(x_ecl, z_ecl, -y_ecl)
}

/// Calculează poziția absolută 3D scalată (`DVec3` în `f64`) a unui corp ceresc din catalog la momentul `time` (în zile simulate).
pub fn compute_body_absolute_position_f64(
    catalog: &OrbitarCatalog,
    body_id: &str,
    time_days: f64,
) -> Option<DVec3> {
    let entry = catalog.get(body_id)?;
    if entry.data.id == "sun" {
        return Some(DVec3::ZERO);
    }

    // Dacă este satelit (are `parent_id`), calculăm poziția planetei-mamă + offsetul orbital local în f64
    if let Some(ref parent_id) = entry.data.parent_id {
        let parent_pos = compute_body_absolute_position_f64(catalog, parent_id, time_days)
            .unwrap_or(DVec3::ZERO);
        let raw_period = if entry.data.orbit_period_days.abs() > 1e-5 {
            entry.data.orbit_period_days
        } else {
            1.0
        };
        let orbit_dir = if raw_period < 0.0 { -1.0 } else { 1.0 };
        let period_days = raw_period.abs().max(0.05);
        let order = entry.data.local_orbit_order.unwrap_or(1) as f64;
        let angle = orbit_dir * (((time_days / period_days) * TAU + order * 1.7) % TAU);

        let incl: f64 = match entry.data.id.as_str() {
            "triton" => -0.35,
            "phoebe" => -0.28,
            "iapetus" => 0.24,
            _ if (order as u32) % 2 == 1 => 0.08,
            _ => -0.14,
        };

        let local_r = entry.scaled_orbit_distance;
        let offset = DVec3::new(
            angle.cos() * local_r,
            angle.sin() * incl.sin() * local_r,
            -angle.sin() * local_r,
        );
        return Some(parent_pos + offset);
    }

    // Corp heliocentric (planetă, planetă pitică, asteroid)
    if let Some(ref kep) = entry.effective_keplerian {
        let pos_au = keplerian_to_heliocentric_au_f64(kep, entry.data.orbit_period_days, time_days);
        let raw_len = pos_au.length();
        if raw_len <= 1e-12 {
            return Some(DVec3::ZERO);
        }
        let dir = pos_au / raw_len;
        let nominal_au = if kep.semi_major_axis_au > 0.0 {
            kep.semi_major_axis_au
        } else {
            entry.data.distance_from_sun_au.max(raw_len)
        };
        let raw_ratio = if nominal_au > 0.0 {
            raw_len / nominal_au
        } else {
            1.0
        };
        let damped_ratio = 1.0 + (raw_ratio - 1.0).clamp(-0.015, 0.015);
        return Some(dir * (entry.scaled_orbit_distance * damped_ratio));
    }

    // Fallback circular în planul ecliptic
    let period = entry.data.orbit_period_days.abs().max(1.0);
    let angle = (time_days / period) * TAU;
    let r = entry.scaled_orbit_distance;
    Some(DVec3::new(angle.cos() * r, 0.0, -angle.sin() * r))
}

/// Sistem de **Floating Origin în `f64`** pentru eliminarea jitter-ului de precizie `f32` la distanțe interplanetare.
/// Nava rămâne în originea scenei Godot `(0, 0, 0)`, în timp ce poziția ei absolută este acumulată în `DVec3` (`f64`),
/// iar pozițiile planetelor sunt calculate în `f64` relativ la navă înainte de conversia la `f32` (`Vec3`).
#[derive(Debug, Clone)]
pub struct FloatingOrigin {
    ship_position: DVec3,
}

impl Default for FloatingOrigin {
    fn default() -> Self {
        Self::new()
    }
}

impl FloatingOrigin {
    pub fn new() -> Self {
        Self {
            ship_position: DVec3::ZERO,
        }
    }

    pub fn with_initial_position(pos: DVec3) -> Self {
        Self { ship_position: pos }
    }

    /// Returnează poziția absolută a navei în `f64` (`DVec3`).
    pub fn ship_position(&self) -> DVec3 {
        self.ship_position
    }

    /// Setează direct poziția absolută a navei în `f64`.
    pub fn set_ship_position(&mut self, pos: DVec3) {
        self.ship_position = pos;
    }

    /// Actualizează poziția absolută în `f64` a navei cu vectorul de deplasare `delta_pos` (`f32` din fizica frame-ului curent).
    pub fn update_ship_displacement(&mut self, delta_pos: Vec3) {
        let delta_f64 = DVec3::new(
            delta_pos.x as f64,
            delta_pos.y as f64,
            delta_pos.z as f64,
        );
        self.ship_position += delta_f64;
    }

    /// Actualizează poziția absolută direct în `f64`.
    pub fn update_ship_displacement_f64(&mut self, delta_pos: DVec3) {
        self.ship_position += delta_pos;
    }

    /// Calculează în `f64` poziția planetei minus poziția navei (`planet_pos_f64 - ship_pos_f64`).
    pub fn get_relative_planet_position_f64(
        &self,
        catalog: &OrbitarCatalog,
        planet_id: &str,
        time: f64,
    ) -> Option<DVec3> {
        let planet_pos_f64 = compute_body_absolute_position_f64(catalog, planet_id, time)?;
        Some(planet_pos_f64 - self.ship_position)
    }

    /// Calculează Proiecția Optică Anti-Clipping în `f64` pentru o planetă relativ la navă:
    /// - Calculează `rel_pos = planet_pos_f64 - ship_pos_f64` și `dist = rel_pos.length()`.
    /// - Dacă `dist > OPTICAL_HORIZON (120.000)`: plasează poziția 3D la distanța fixă `OPTICAL_HORIZON`
    ///   pe direcția `rel_pos.normalized()` și returnează `apparent_scale = OPTICAL_HORIZON / dist`.
    /// - Dacă `dist <= OPTICAL_HORIZON`: returnează poziția relativă directă și `apparent_scale = 1.0`.
    pub fn get_optical_planet_projection(
        &self,
        catalog: &OrbitarCatalog,
        planet_id: &str,
        time: f64,
    ) -> Option<OpticalProjectionState> {
        let rel_f64 = self.get_relative_planet_position_f64(catalog, planet_id, time)?;
        let dist = rel_f64.length();
        let dir_f64 = if dist > 1e-9 {
            rel_f64 / dist
        } else {
            DVec3::NEG_Z
        };
        let direction = Vec3::new(dir_f64.x as f32, dir_f64.y as f32, dir_f64.z as f32);

        if dist > OPTICAL_HORIZON {
            let proj_f64 = dir_f64 * OPTICAL_HORIZON;
            let apparent_scale = (OPTICAL_HORIZON / dist) as f32;
            Some(OpticalProjectionState {
                projected_position: Vec3::new(
                    proj_f64.x as f32,
                    proj_f64.y as f32,
                    proj_f64.z as f32,
                ),
                true_relative_position: rel_f64,
                direction,
                true_distance: dist,
                apparent_scale,
                is_projected: true,
            })
        } else {
            Some(OpticalProjectionState {
                projected_position: Vec3::new(
                    rel_f64.x as f32,
                    rel_f64.y as f32,
                    rel_f64.z as f32,
                ),
                true_relative_position: rel_f64,
                direction,
                true_distance: dist,
                apparent_scale: 1.0,
                is_projected: false,
            })
        }
    }

    /// Calculează în `f64` poziția proiectată optic a planetei relativ la navă și returnează rezultatul în `f32` (`Vec3`).
    pub fn get_relative_planet_position(
        &self,
        catalog: &OrbitarCatalog,
        planet_id: &str,
        time: f64,
    ) -> Option<Vec3> {
        self.get_optical_planet_projection(catalog, planet_id, time)
            .map(|proj| proj.projected_position)
    }

    /// Avansează nava în modul HYPER cu `delta_pos` (`DVec3` în `f64`) și detectează precis (inclusiv prin
    /// intersecție segment-sferă anti-tunneling la viteze de până la `20.000.000 u/s`) momentul în care
    /// distanța reală `dist` față de o planetă scade sub `2.2 * raza_planetei` (`HYPER_DROP_RADIUS_MULTIPLIER`).
    pub fn advance_ship_in_hyper(
        &mut self,
        catalog: &OrbitarCatalog,
        delta_pos: DVec3,
        time: f64,
    ) -> Option<HyperDropInterception> {
        let start_pos = self.ship_position;
        let step_len_sq = delta_pos.length_squared();
        if step_len_sq <= 1e-12 {
            return None;
        }

        let mut earliest_t: f64 = 2.0;
        let mut hit_info: Option<HyperDropInterception> = None;

        for entry in catalog.entries() {
            let Some(planet_pos) =
                compute_body_absolute_position_f64(catalog, &entry.data.id, time)
            else {
                continue;
            };
            let r = entry.scaled_radius.max(1.0);
            let drop_r = r * HYPER_DROP_RADIUS_MULTIPLIER;

            // Vectorul de la centrul planetei la poziția de start a navei
            let m = start_pos - planet_pos;
            let start_dist = m.length();

            // Verificăm doar corpurile către care nava se apropie (unghi ascuțit între direcția de zbor și planetă)
            let b_half = m.dot(delta_pos);
            if b_half >= 0.0 {
                continue;
            }

            if start_dist <= drop_r {
                // Nava se află deja sub 2.2 * R și zboară spre planetă -> declanșare imediată
                if 0.0 < earliest_t {
                    earliest_t = 0.0;
                    hit_info = Some(HyperDropInterception {
                        body_id: entry.data.id.clone(),
                        body_name: entry.data.name.clone(),
                        body_radius: r,
                        drop_distance: start_dist,
                        clamped_ship_position: start_pos,
                    });
                }
            } else {
                // Rezolvăm intersecția segmentului P(t) = start_pos + t * delta_pos cu sfera de rază `drop_r`
                let a = step_len_sq;
                let c = start_dist * start_dist - drop_r * drop_r;
                let disc_quarter = b_half * b_half - a * c;
                if disc_quarter >= 0.0 {
                    let t_hit = (-b_half - disc_quarter.sqrt()) / a;
                    if (0.0..=1.0).contains(&t_hit) && t_hit < earliest_t {
                        earliest_t = t_hit;
                        let clamped_pos = start_pos + delta_pos * t_hit;
                        let final_dist = (planet_pos - clamped_pos).length();
                        hit_info = Some(HyperDropInterception {
                            body_id: entry.data.id.clone(),
                            body_name: entry.data.name.clone(),
                            body_radius: r,
                            drop_distance: final_dist,
                            clamped_ship_position: clamped_pos,
                        });
                    }
                }
            }
        }

        if let Some(ref info) = hit_info {
            self.ship_position = info.clamped_ship_position;
        } else {
            self.ship_position = start_pos + delta_pos;
        }

        hit_info
    }

    /// Evaluează în `f64` bula de siguranță planetară pentru poziția curentă a navei:
    /// - Determină cel mai apropiat corp ceresc (după altitudinea normalizată la raza corpului).
    /// - Raza Scannerului Științific este calibrată la `3.5 * raza_planetei`.
    /// - Pragul de Frânare Gravitațională Automată (Hyper-Drop) este la `2.2 * raza_planetei`.
    /// - Previne penetrarea geometriei sferelor planetare aplicând o corecție radială lină.
    pub fn evaluate_proximity_safety(
        &mut self,
        catalog: &OrbitarCatalog,
        time: f64,
    ) -> ProximitySafetyState {
        let mut best_norm_alt = f64::INFINITY;
        let mut nearest_id = String::from("sun");
        let mut nearest_name = String::from("Soarele");
        let mut nearest_center_dist = f64::INFINITY;
        let mut nearest_radius = 1.0_f64;
        let mut nearest_rel_f64 = DVec3::ZERO;

        for entry in catalog.entries() {
            let Some(planet_pos) =
                compute_body_absolute_position_f64(catalog, &entry.data.id, time)
            else {
                continue;
            };
            let rel = planet_pos - self.ship_position;
            let dist = rel.length();
            let r = entry.scaled_radius.max(0.05);
            let norm_alt = (dist - r) / r;

            if norm_alt < best_norm_alt {
                best_norm_alt = norm_alt;
                nearest_id = entry.data.id.clone();
                nearest_name = entry.data.name.clone();
                nearest_center_dist = dist;
                nearest_radius = r;
                nearest_rel_f64 = rel;
            }
        }

        let scan_radius = (nearest_radius * SCANNER_RADIUS_MULTIPLIER).max(nearest_radius + 500.0);
        let hyper_drop_radius = (nearest_radius * HYPER_DROP_RADIUS_MULTIPLIER).max(nearest_radius + 250.0);
        let bubble_outer_radius = scan_radius;
        let min_safe_radius = (nearest_radius * 1.15).max(nearest_radius + 50.0);

        // Dacă nava a pătruns sub plafonul minim de siguranță, o împingem lin înapoi pe sfera de siguranță în f64
        let mut pushout = Vec3::ZERO;
        if nearest_center_dist < min_safe_radius {
            let away_dir = if nearest_center_dist > 1e-6 {
                -nearest_rel_f64 / nearest_center_dist
            } else {
                DVec3::Y
            };
            let penetration = min_safe_radius - nearest_center_dist;
            let correction_f64 = away_dir * penetration;
            self.ship_position += correction_f64;
            nearest_center_dist = min_safe_radius;
            pushout = Vec3::new(
                correction_f64.x as f32,
                correction_f64.y as f32,
                correction_f64.z as f32,
            );
        }

        let altitude = (nearest_center_dist - nearest_radius).max(0.0);
        let in_proximity_bubble = nearest_center_dist <= bubble_outer_radius;
        let in_hyper_drop_zone = nearest_center_dist <= hyper_drop_radius;

        let speed_limit_factor = if !in_proximity_bubble {
            1.0_f32
        } else {
            let span = (bubble_outer_radius - min_safe_radius).max(0.001);
            let t = ((nearest_center_dist - min_safe_radius) / span).clamp(0.0, 1.0) as f32;
            // Smoothstep între 0.12 (lângă atmosferă/suprafață) și 1.0 (la ieșirea din bula planetară)
            let smooth = t * t * (3.0 - 2.0 * t);
            0.12 + 0.88 * smooth
        };

        ProximitySafetyState {
            nearest_body_id: nearest_id,
            nearest_body_name: nearest_name,
            center_distance: nearest_center_dist,
            body_radius: nearest_radius,
            altitude,
            bubble_radius: bubble_outer_radius,
            hyper_drop_radius,
            scan_radius,
            in_proximity_bubble,
            in_hyper_drop_zone,
            warp_allowed: nearest_center_dist > min_safe_radius * 1.04,
            speed_limit_factor,
            pushout_vector: pushout,
        }
    }
}

/// Starea Proiecției Optice Anti-Clipping pentru un corp ceresc relativ la navă.
#[derive(Debug, Clone, Copy)]
pub struct OpticalProjectionState {
    pub projected_position: Vec3,
    pub true_relative_position: DVec3,
    pub direction: Vec3,
    pub true_distance: f64,
    pub apparent_scale: f32,
    pub is_projected: bool,
}

/// Informațiile returnate la interceptarea automată a pragului `Hyper-Drop` (`dist <= 2.2 * raza_planetei`).
#[derive(Debug, Clone)]
pub struct HyperDropInterception {
    pub body_id: String,
    pub body_name: String,
    pub body_radius: f64,
    pub drop_distance: f64,
    pub clamped_ship_position: DVec3,
}

/// Rezultatul evaluării în `f64` a bulei de siguranță planetară.
#[derive(Debug, Clone)]
pub struct ProximitySafetyState {
    pub nearest_body_id: String,
    pub nearest_body_name: String,
    pub center_distance: f64,
    pub body_radius: f64,
    pub altitude: f64,
    pub bubble_radius: f64,
    pub hyper_drop_radius: f64,
    pub scan_radius: f64,
    pub in_proximity_bubble: bool,
    pub in_hyper_drop_zone: bool,
    pub warp_allowed: bool,
    pub speed_limit_factor: f32,
    pub pushout_vector: Vec3,
}

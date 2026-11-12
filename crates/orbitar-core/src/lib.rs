// SPDX-License-Identifier: GPL-3.0-or-later

pub mod catalog;
pub mod orbital;
pub mod profile;

pub use catalog::{
    AtmosphereConfig, BeltConfig, CadetContent, CatalogBodyEntry, CelestialBodyData,
    CelestialCategory, DeepSpaceDataset, JuniorContent, KeplerianElements, MissionsDataset,
    OrbitarCatalog, PlanetTexturePaths, QuizItem, SolarSystemDataset, StructureLayerOrInstrument,
    TravelTimeInfo, resolve_atmosphere_config, resolve_texture_paths,
};
pub use glam::{DVec3, Vec3};
pub use orbital::{
    FloatingOrigin, HYPER_DROP_RADIUS_MULTIPLIER, HyperDropInterception, J2000_OBLIQUITY_RAD,
    KM_PER_AU, OPTICAL_HORIZON, ORBIT_DISTANCE_SCALE_FACTOR, OpticalProjectionState,
    ProximitySafetyState, REAL_UNITS_PER_AU, SCANNER_RADIUS_MULTIPLIER, SPEED_OF_LIGHT_KMH,
    compute_body_absolute_position_f64, default_keplerian_for_body, didactic_orbit_au,
    keplerian_to_heliocentric_au_f64, scale_moon_orbit_distance, scale_orbit_distance_logarithmic,
    scale_radius_didactic, solve_kepler_equation_f64,
};
pub use profile::{
    AgeTier, PilotSpec, PlayerProfile, SpacecraftSpec, available_hangar_ship_archetypes,
    available_pilot_specs, available_spacecraft_specs, generate_pilot_reaction_ro,
    get_pilot_spec_by_id, get_ship_spec_by_id,
};

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_catalog_loads_all_bodies_and_didactic_ro() {
        let catalog = OrbitarCatalog::load_embedded();
        assert_eq!(catalog.len(), 42);

        let earth = catalog.get("earth").expect("Pământul trebuie să existe în catalog");
        assert_eq!(earth.data.name, "Pământul");
        assert!(
            (50_000.0..=100_000.0).contains(&earth.scaled_radius),
            "Raza Pământului trebuie să fie între 50.000 și 100.000 unități, dar este {}",
            earth.scaled_radius
        );
        assert!(earth.scaled_orbit_distance > 50_000_000.0);

        let jupiter = catalog.get("jupiter").expect("Jupiter trebuie să existe în catalog");
        assert!(
            jupiter.scaled_radius > 500_000.0,
            "Raza lui Jupiter trebuie să depășească 500.000 unități, dar este {}",
            jupiter.scaled_radius
        );

        let sun = catalog.get("sun").expect("Soarele trebuie să existe în catalog");
        assert!(
            sun.scaled_radius > 2_000_000.0,
            "Raza Soarelui trebuie să depășească 2.000.000 unități, dar este {}",
            sun.scaled_radius
        );

        assert!(earth.textures.albedo_2k.starts_with("res://assets/textures/"));
        assert!(earth.textures.albedo_4k.starts_with("res://assets/textures/"));
        assert!(!earth.data.junior.summary.is_empty());
        assert!(!earth.data.cadet.quiz.question.is_empty());

        let moon = catalog.get("moon").expect("Luna trebuie să existe în catalog");
        assert_eq!(moon.data.parent_id.as_deref(), Some("earth"));
        assert!(moon.scaled_orbit_distance > earth.scaled_radius);
    }

    #[test]
    fn test_floating_origin_f64_precision() {
        let catalog = OrbitarCatalog::load_embedded();
        let mut floating = FloatingOrigin::new();

        // La distanță mare (> OPTICAL_HORIZON), proiecția optică plasează planeta la 120.000 u
        let proj_far = floating
            .get_optical_planet_projection(&catalog, "earth", 0.0)
            .expect("Proiecție optică validă pentru Pământ");
        assert!(proj_far.is_projected);
        assert!(proj_far.true_distance > 50_000_000.0);
        assert!((proj_far.projected_position.length() - OPTICAL_HORIZON as f32).abs() < 2.0);
        assert!(proj_far.apparent_scale > 0.0 && proj_far.apparent_scale < 0.01);

        // Deplasăm nava exact în poziția Pământului la t=0 în f64
        let earth_pos_f64 = floating
            .get_relative_planet_position_f64(&catalog, "earth", 0.0)
            .expect("Poziție f64 validă pentru Pământ");
        floating.update_ship_displacement_f64(earth_pos_f64);

        let proj_near = floating
            .get_optical_planet_projection(&catalog, "earth", 0.0)
            .expect("Proiecție după deplasare");
        assert!(!proj_near.is_projected);
        assert!((proj_near.apparent_scale - 1.0).abs() < 1e-6);
        assert!(
            proj_near.projected_position.length() < 1e-3,
            "După deplasarea navei la Pământ, poziția relativă trebuie să fie ~0, dar este {:?}",
            proj_near.projected_position
        );
    }

    #[test]
    fn test_player_profile_json_persistence() {
        let temp_path = std::env::temp_dir().join("orbitar_test_player_profile.json");
        let _ = std::fs::remove_file(&temp_path);

        let mut profile = PlayerProfile::new("pilot_ro", "Comandant Ana", "coandax");
        assert!(profile.mark_body_scanned("mars"));
        assert!(!profile.mark_body_scanned("mars"));
        assert!(profile.is_body_scanned("earth"));
        assert!(profile.is_body_scanned("mars"));

        profile
            .save_to_path(&temp_path)
            .expect("Salvarea profilului JSON trebuie să reușească");

        let loaded = PlayerProfile::load_from_path(&temp_path)
            .expect("Încărcarea profilului JSON trebuie să reușească");
        assert_eq!(loaded.pilot_id, "pilot_ro");
        assert_eq!(loaded.pilot_name, "Comandant Ana");
        assert_eq!(loaded.selected_ship_id, "coandax");
        assert_eq!(loaded.scanned_bodies, vec!["earth", "mars"]);

        let _ = std::fs::remove_file(&temp_path);
    }

    #[test]
    fn test_planetary_safety_bubble_and_pushout() {
        let catalog = OrbitarCatalog::load_embedded();
        let mut floating = FloatingOrigin::new();

        // Plasăm nava exact în centrul Pământului la t=0
        let earth_pos = compute_body_absolute_position_f64(&catalog, "earth", 0.0).unwrap();
        floating.set_ship_position(earth_pos);

        let safety = floating.evaluate_proximity_safety(&catalog, 0.0);
        assert_eq!(safety.nearest_body_id, "earth");
        assert!(safety.in_proximity_bubble);
        assert!(!safety.warp_allowed);
        assert!(safety.speed_limit_factor <= 0.15);
        assert!(
            safety.pushout_vector.length() > 1.0,
            "Nava trebuie împinsă în afara sferei de coliziune a Pământului"
        );
    }
}

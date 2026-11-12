// SPDX-License-Identifier: GPL-3.0-or-later

use godot::classes::{INode, Node};
use godot::prelude::*;
use orbitar_core::{
    CatalogBodyEntry, DVec3, FloatingOrigin, OPTICAL_HORIZON, OrbitarCatalog, PilotSpec,
    PlayerProfile, SpacecraftSpec, Vec3 as CoreVec3, available_hangar_ship_archetypes,
    available_pilot_specs, available_spacecraft_specs, generate_pilot_reaction_ro,
    get_pilot_spec_by_id, get_ship_spec_by_id,
};
use std::path::PathBuf;

struct OrbitarExtension;

#[gdextension]
unsafe impl ExtensionLibrary for OrbitarExtension {}

/// Nodul nativ `OrbitarSpaceCore` expus către Godot 4 (GDScript) prin GDExtension.
/// Gestionează:
/// 1. Catalogul complet al planetelor, sateliților, planetelor pitice și asteroizilor din Orbitar.
/// 2. Sistemul de **Floating Origin în `f64`** (`DVec3`) pentru eliminarea jitter-ului la scară interplanetară.
/// 3. Profilul local al jucătorului (pilotul ales, nava aleasă, corpurile cerești scanate), salvat în JSON.
#[derive(GodotClass)]
#[class(base=Node)]
pub struct OrbitarSpaceCore {
    base: Base<Node>,
    catalog: OrbitarCatalog,
    floating_origin: FloatingOrigin,
    player_profile: PlayerProfile,
    profile_path: PathBuf,
    quality_mode: String,
}

#[godot_api]
impl INode for OrbitarSpaceCore {
    fn init(base: Base<Node>) -> Self {
        let profile_path = PlayerProfile::default_storage_path();
        let player_profile = PlayerProfile::load_or_default(&profile_path);
        Self {
            base,
            catalog: OrbitarCatalog::load_embedded(),
            floating_origin: FloatingOrigin::new(),
            player_profile,
            profile_path,
            quality_mode: "hd".to_string(),
        }
    }

    fn ready(&mut self) {
        let _ = self.player_profile.save_to_path(&self.profile_path);
    }
}

#[godot_api]
impl OrbitarSpaceCore {
    // =========================================================================
    // A. Catalogul Planetelor și Sateliților (Nume, Rază Scalată, Distanță Logaritmică, Texturi 2K/4K, Date Didactice RO)
    // =========================================================================

    /// Returnează catalogul complet al planetelor, sateliților și corpurilor din Sistemul Solar.
    #[func]
    pub fn get_celestial_catalog(&self) -> Array<Dictionary> {
        let mut array = Array::new();
        for entry in self.catalog.entries() {
            array.push(&Self::entry_to_dict(entry));
        }
        array
    }

    /// Returnează dicționarul complet al unui singur corp ceresc după `planet_id` (ex. `"earth"`, `"mars"`, `"moon"`).
    #[func]
    pub fn get_celestial_body(&self, planet_id: GString) -> Dictionary {
        let id_str = planet_id.to_string();
        match self.catalog.get(&id_str) {
            Some(entry) => Self::entry_to_dict(entry),
            None => Dictionary::new(),
        }
    }

    /// Returnează lista tuturor ID-urilor corpurilor cerești din catalog.
    #[func]
    pub fn get_planet_ids(&self) -> PackedStringArray {
        let mut ids = PackedStringArray::new();
        for entry in self.catalog.entries() {
            ids.push(&GString::from(&entry.data.id));
        }
        ids
    }

    /// Returnează numărul total de corpuri cerești din catalogul principal.
    #[func]
    pub fn get_body_count(&self) -> i32 {
        self.catalog.len() as i32
    }

    // =========================================================================
    // B. Sistemul de Floating Origin în f64 (DVec3)
    // =========================================================================

    /// Actualizează poziția absolută a navei în `f64` (`DVec3`) adăugând deplasarea din cadrul curent (`delta_pos: Vector3`).
    #[func]
    pub fn update_ship_displacement(&mut self, delta_pos: Vector3) {
        self.floating_origin
            .update_ship_displacement(CoreVec3::new(delta_pos.x, delta_pos.y, delta_pos.z));
    }

    /// Avansează nava în modul HYPER în `f64` și verifică dacă traiectoria atinge pragul de
    /// Frânare Gravitațională Automată (`Hyper-Drop` la `2.2 * raza_planetei`).
    #[func]
    pub fn advance_ship_in_hyper(&mut self, delta_pos: Vector3, time: f64) -> Dictionary {
        let delta_f64 = DVec3::new(delta_pos.x as f64, delta_pos.y as f64, delta_pos.z as f64);
        let mut dict = Dictionary::new();
        if let Some(hit) = self
            .floating_origin
            .advance_ship_in_hyper(&self.catalog, delta_f64, time)
        {
            dict.set("intercepted", true);
            dict.set("body_id", GString::from(&hit.body_id));
            dict.set("body_name", GString::from(&hit.body_name));
            dict.set("body_radius", hit.body_radius);
            dict.set("drop_distance", hit.drop_distance);
        } else {
            dict.set("intercepted", false);
        }
        dict
    }

    /// Returnează distanța orizontului optic anti-clipping (`OPTICAL_HORIZON = 120.000`).
    #[func]
    pub fn get_optical_horizon(&self) -> f64 {
        OPTICAL_HORIZON
    }

    /// Calculează Proiecția Optică Anti-Clipping în `f64` pentru corpul ceresc `planet_id` relativ la navă:
    /// - Dacă `dist > OPTICAL_HORIZON (120.000)`: plasează nodul la `OPTICAL_HORIZON` pe direcția `rel_pos.normalized()`
    ///   și returnează `apparent_scale = OPTICAL_HORIZON / dist`.
    /// - Dacă `dist <= OPTICAL_HORIZON`: folosește poziția relativă directă și scara `1.0`.
    #[func]
    pub fn get_planet_optical_projection(&self, planet_id: GString, time: f64) -> Dictionary {
        let id_str = planet_id.to_string();
        let mut d = Dictionary::new();
        if let Some(proj) = self
            .floating_origin
            .get_optical_planet_projection(&self.catalog, &id_str, time)
        {
            d.set(
                "position",
                Vector3::new(
                    proj.projected_position.x,
                    proj.projected_position.y,
                    proj.projected_position.z,
                ),
            );
            d.set("apparent_scale", proj.apparent_scale);
            d.set("true_distance", proj.true_distance);
            d.set(
                "direction",
                Vector3::new(proj.direction.x, proj.direction.y, proj.direction.z),
            );
            d.set("is_projected", proj.is_projected);
        } else {
            d.set("position", Vector3::ZERO);
            d.set("apparent_scale", 1.0_f32);
            d.set("true_distance", 0.0_f64);
            d.set("direction", Vector3::FORWARD);
            d.set("is_projected", false);
        }
        d
    }

    /// Returnează factorul de scalare optică `apparent_scale` (`1.0` sub `OPTICAL_HORIZON`, sau `OPTICAL_HORIZON / dist` peste).
    #[func]
    pub fn get_planet_apparent_scale(&self, planet_id: GString, time: f64) -> f32 {
        let id_str = planet_id.to_string();
        self.floating_origin
            .get_optical_planet_projection(&self.catalog, &id_str, time)
            .map(|p| p.apparent_scale)
            .unwrap_or(1.0)
    }

    /// Returnează direcția unitară reală în `f64` de la navă către corpul ceresc (neafectată de proiecția optică,
    /// utilizată pentru `DirectionalLight3D`, shaderele planetare și busola 3D Mini-Orrery).
    #[func]
    pub fn get_true_planet_direction(&self, planet_id: GString, time: f64) -> Vector3 {
        let id_str = planet_id.to_string();
        self.floating_origin
            .get_optical_planet_projection(&self.catalog, &id_str, time)
            .map(|p| Vector3::new(p.direction.x, p.direction.y, p.direction.z))
            .unwrap_or(Vector3::FORWARD)
    }

    /// Calculează în `f64` poziția proiectată optic a corpului ceresc relativ la navă la timpul `time`
    /// și returnează rezultatul în `f32` (`Vector3`) pentru poziționarea în scena Godot fără clipping și fără jitter.
    #[func]
    pub fn get_relative_planet_position(&self, planet_id: GString, time: f64) -> Vector3 {
        let id_str = planet_id.to_string();
        match self
            .floating_origin
            .get_relative_planet_position(&self.catalog, &id_str, time)
        {
            Some(rel) => Vector3::new(rel.x, rel.y, rel.z),
            None => Vector3::ZERO,
        }
    }

    /// Returnează poziția absolută a navei în `f64` sub formă de `[x, y, z]` (`PackedFloat64Array`).
    #[func]
    pub fn get_ship_absolute_position_f64(&self) -> PackedFloat64Array {
        let pos: DVec3 = self.floating_origin.ship_position();
        let mut arr = PackedFloat64Array::new();
        arr.push(pos.x);
        arr.push(pos.y);
        arr.push(pos.z);
        arr
    }

    /// Setează direct poziția absolută în `f64` a navei.
    #[func]
    pub fn set_ship_absolute_position(&mut self, x: f64, y: f64, z: f64) {
        self.floating_origin
            .set_ship_position(DVec3::new(x, y, z));
    }

    /// Resetează poziția absolută a navei în origine `(0.0, 0.0, 0.0)`.
    #[func]
    pub fn reset_ship_position(&mut self) {
        self.floating_origin.set_ship_position(DVec3::ZERO);
    }

    /// Calculează în `f64` distanța euclidiană exactă dintre navă și corpul ceresc `planet_id` la momentul `time`.
    #[func]
    pub fn get_planet_distance_to_ship(&self, planet_id: GString, time: f64) -> f64 {
        let id_str = planet_id.to_string();
        self.floating_origin
            .get_relative_planet_position_f64(&self.catalog, &id_str, time)
            .map(|rel| rel.length())
            .unwrap_or(0.0)
    }

    /// Plasează poziția absolută `f64` a navei pe o orbită panoramică în jurul planetei `planet_id`
    /// (ex: `"earth"` cu `distance_multiplier = 2.35`), păstrând nava în `(0, 0, 0)` în scena Godot.
    #[func]
    pub fn station_ship_near_planet(
        &mut self,
        planet_id: GString,
        time: f64,
        distance_multiplier: f64,
    ) -> Vector3 {
        let id_str = planet_id.to_string();
        if let Some(entry) = self.catalog.get(&id_str) {
            if let Some(planet_pos) =
                orbitar_core::compute_body_absolute_position_f64(&self.catalog, &id_str, time)
            {
                let r = entry.scaled_radius.max(0.5);
                let mult = distance_multiplier.max(1.35);
                let offset = DVec3::new(0.0, r * 0.22, r * mult);
                let ship_pos = planet_pos + offset;
                self.floating_origin.set_ship_position(ship_pos);
                return self.get_relative_planet_position(planet_id, time);
            }
        }
        Vector3::ZERO
    }

    /// Evaluează în `f64` bula de siguranță planetară pentru poziția curentă a navei:
    /// returnează cel mai apropiat corp, altitudinea, razele de `Hyper-Drop` (`2.2 * R`) și `Scanner` (`3.5 * R`),
    /// factorul de limitare a vitezei (`0.12..=1.0`), `warp_allowed` și vectorul de respingere anti-coliziune (`pushout`).
    #[func]
    pub fn evaluate_planetary_safety_bubble(&mut self, time: f64) -> Dictionary {
        let safety = self
            .floating_origin
            .evaluate_proximity_safety(&self.catalog, time);
        let mut d = Dictionary::new();
        d.set("nearest_body_id", GString::from(&safety.nearest_body_id));
        d.set(
            "nearest_body_name",
            GString::from(&safety.nearest_body_name),
        );
        d.set("center_distance", safety.center_distance);
        d.set("body_radius", safety.body_radius);
        d.set("altitude", safety.altitude);
        d.set("bubble_radius", safety.bubble_radius);
        d.set("hyper_drop_radius", safety.hyper_drop_radius);
        d.set("scan_radius", safety.scan_radius);
        d.set("in_proximity_bubble", safety.in_proximity_bubble);
        d.set("in_hyper_drop_zone", safety.in_hyper_drop_zone);
        d.set("warp_allowed", safety.warp_allowed);
        d.set("speed_limit_factor", safety.speed_limit_factor);
        d.set(
            "pushout",
            Vector3::new(
                safety.pushout_vector.x,
                safety.pushout_vector.y,
                safety.pushout_vector.z,
            ),
        );
        d
    }

    /// Returnează modul curent de calitate a texturilor (`"eco"` = 2K sau `"hd"` = 4K).
    #[func]
    pub fn get_quality_mode(&self) -> GString {
        GString::from(&self.quality_mode)
    }

    /// Setează modul de calitate (`"eco"` pentru texturi 2K sau `"hd"` pentru texturi 4K).
    #[func]
    pub fn set_quality_mode(&mut self, mode: GString) -> GString {
        let m = mode.to_string().to_lowercase();
        if m == "eco" {
            self.quality_mode = "eco".to_string();
        } else {
            self.quality_mode = "hd".to_string();
        }
        GString::from(&self.quality_mode)
    }

    /// Comută între Modul Eco (2K) și Modul HD (4K) și returnează noul mod activ.
    #[func]
    pub fn toggle_quality_mode(&mut self) -> GString {
        if self.quality_mode == "hd" {
            self.quality_mode = "eco".to_string();
        } else {
            self.quality_mode = "hd".to_string();
        }
        GString::from(&self.quality_mode)
    }

    /// Generează determinist în Rust transformările 3D (`Array<Transform3D>`) pentru câmpul de gheață/asteroizi
    /// (`MultiMeshInstance3D`) din jurul inelelor lui Saturn, incluzând Diviziunea Cassini.
    #[func]
    pub fn generate_saturn_ring_transforms(
        &self,
        count: i32,
        inner_radius: f32,
        outer_radius: f32,
        thickness: f32,
    ) -> Array<Transform3D> {
        let mut transforms = Array::new();
        let safe_count = count.clamp(1, 20_000) as u32;
        let r_min = inner_radius.max(0.5);
        let r_max = outer_radius.max(r_min + 0.5);
        let mut seed: u64 = 0x5A70_2026_1337;

        let mut next_f32 = || -> f32 {
            seed = seed
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            ((seed >> 40) as u32 as f32) / ((1u32 << 24) as f32)
        };

        for _ in 0..safe_count {
            let mut u = next_f32();
            // Evităm Diviziunea Cassini (~0.64..0.70 din lățimea inelului)
            if (0.64..=0.70).contains(&u) {
                u = if u < 0.67 {
                    u - 0.05
                } else {
                    u + 0.05
                };
            }
            let radius = r_min + u * (r_max - r_min);
            let angle = next_f32() * std::f32::consts::TAU;
            let y_offset = (next_f32() - 0.5) * thickness;

            let origin = Vector3::new(angle.cos() * radius, y_offset, angle.sin() * radius);

            let ring_span = (r_max - r_min).max(1.0);
            let rock_base = (ring_span * 0.005).max(0.018);
            let sx = rock_base * (0.4 + next_f32() * 1.1);
            let sy = sx * (0.55 + next_f32() * 0.65);
            let sz = sx * (0.65 + next_f32() * 0.70);

            let yaw = next_f32() * std::f32::consts::TAU;
            let pitch = (next_f32() - 0.5) * 1.2;
            let roll = (next_f32() - 0.5) * 1.2;

            let basis = Basis::from_euler(EulerOrder::YXZ, Vector3::new(pitch, yaw, roll))
                .scaled(Vector3::new(sx, sy, sz));
            transforms.push(Transform3D::new(basis, origin));
        }

        transforms
    }

    // =========================================================================
    // C. Gestionarea Profilului Local al Jucătorului (Salvare JSON pe disc)
    // =========================================================================

    /// Returnează starea completă a profilului jucătorului ca `Dictionary`.
    #[func]
    pub fn get_player_profile(&self) -> Dictionary {
        let mut dict = Dictionary::new();
        dict.set("cadet_name", GString::from(&self.player_profile.cadet_name));
        dict.set("pilot_id", GString::from(&self.player_profile.pilot_id));
        dict.set("pilot_name", GString::from(&self.player_profile.pilot_name));
        dict.set("age_tier", GString::from(self.player_profile.age_tier.as_str()));
        dict.set(
            "selected_ship_id",
            GString::from(&self.player_profile.selected_ship_id),
        );
        dict.set(
            "ship_color_hex",
            GString::from(&self.player_profile.ship_color_hex),
        );
        dict.set(
            "quality_mode",
            GString::from(&self.player_profile.quality_mode),
        );
        dict.set("audio_volume", self.player_profile.audio_volume);
        dict.set(
            "default_camera_mode",
            GString::from(&self.player_profile.default_camera_mode),
        );
        dict.set("scanned_bodies", self.get_scanned_bodies());
        dict.set("save_path", self.get_profile_save_path());
        dict
    }

    /// Returnează `true` dacă există un profil salvat local pe disc.
    #[func]
    pub fn has_saved_profile(&self) -> bool {
        self.profile_path.exists()
    }

    #[func]
    pub fn set_cadet_name(&mut self, cadet_name: GString) -> bool {
        self.player_profile.set_cadet_name(cadet_name.to_string());
        self.save_player_profile()
    }

    #[func]
    pub fn get_cadet_name(&self) -> GString {
        GString::from(&self.player_profile.cadet_name)
    }

    #[func]
    pub fn set_ship_color_hex(&mut self, color_hex: GString) -> bool {
        self.player_profile.set_ship_color(color_hex.to_string());
        self.save_player_profile()
    }

    #[func]
    pub fn get_ship_color_hex(&self) -> GString {
        GString::from(&self.player_profile.ship_color_hex)
    }

    #[func]
    pub fn set_audio_volume(&mut self, volume: f32) -> bool {
        self.player_profile.audio_volume = volume.clamp(0.0, 1.0);
        self.save_player_profile()
    }

    #[func]
    pub fn get_audio_volume(&self) -> f32 {
        self.player_profile.audio_volume
    }

    #[func]
    pub fn set_default_camera_mode(&mut self, mode: GString) -> bool {
        let m = mode.to_string().to_lowercase();
        self.player_profile.default_camera_mode = if m == "cockpit" {
            "cockpit".to_string()
        } else {
            "chase".to_string()
        };
        self.save_player_profile()
    }

    #[func]
    pub fn get_default_camera_mode(&self) -> GString {
        GString::from(&self.player_profile.default_camera_mode)
    }

    /// Setează pilotul ales și salvează automat profilul în JSON pe disc.
    #[func]
    pub fn set_selected_pilot(&mut self, pilot_id: GString, pilot_name: GString) -> bool {
        self.player_profile
            .set_pilot(pilot_id.to_string(), pilot_name.to_string());
        self.save_player_profile()
    }

    #[func]
    pub fn get_selected_pilot(&self) -> GString {
        GString::from(&self.player_profile.pilot_id)
    }

    #[func]
    pub fn get_selected_pilot_name(&self) -> GString {
        GString::from(&self.player_profile.pilot_name)
    }

    /// Setează nava aleasă (`"sonda_lacusta"`, `"naveta_vulturul"`, `"cargobot_stanca"`, `"vlaicu1"`, `"coandax"`, `"luceafarul"`)
    /// și salvează profilul în JSON pe disc.
    #[func]
    pub fn set_selected_ship(&mut self, ship_id: GString) -> bool {
        let id_str = ship_id.to_string();
        if self.player_profile.set_ship(&id_str) {
            self.save_player_profile()
        } else {
            false
        }
    }

    #[func]
    pub fn get_selected_ship(&self) -> GString {
        GString::from(&self.player_profile.selected_ship_id)
    }

    /// Returnează specificația navei selectate curent în profilul jucătorului.
    #[func]
    pub fn get_selected_ship_spec(&self) -> Dictionary {
        let spec = get_ship_spec_by_id(&self.player_profile.selected_ship_id);
        Self::ship_spec_to_dict(&spec)
    }

    /// Returnează cele 3 arhetipuri de nave 3D modulare din Hangarul Orbital
    /// (*Sonda „Lăcusta”*, *Naveta „Vulturul”*, *Cargobotul „Stânca”*).
    #[func]
    pub fn get_hangar_ships(&self) -> Array<Dictionary> {
        let mut ships = Array::new();
        for spec in available_hangar_ship_archetypes() {
            ships.push(&Self::ship_spec_to_dict(&spec));
        }
        ships
    }

    /// Returnează catalogul tuturor navelor spațiale disponibile în Orbitar.
    #[func]
    pub fn get_available_ships(&self) -> Array<Dictionary> {
        let mut ships = Array::new();
        for spec in available_spacecraft_specs() {
            ships.push(&Self::ship_spec_to_dict(&spec));
        }
        ships
    }

    /// Returnează lista celor 3 piloți din Hangarul Orbital (*Cadetul Explorator*, *Inginerul Robot*, *Comandantul Veteran*).
    #[func]
    pub fn get_available_pilots(&self) -> Array<Dictionary> {
        let mut pilots = Array::new();
        for p in available_pilot_specs() {
            pilots.push(&Self::pilot_spec_to_dict(&p));
        }
        pilots
    }

    /// Returnează dicționarul complet al pilotului selectat curent.
    #[func]
    pub fn get_selected_pilot_spec(&self) -> Dictionary {
        let p = get_pilot_spec_by_id(&self.player_profile.pilot_id);
        Self::pilot_spec_to_dict(&p)
    }

    /// Generează în limba română replica reactivă a pilotului ales pentru un eveniment din zbor
    /// (`"approach_planet"`, `"warp_engage"`, `"warp_blocked"`, `"scan_complete"`, `"photo_mode"`, `"launch"`).
    #[func]
    pub fn get_pilot_reaction(&self, event_type: GString, body_id: GString) -> GString {
        let ev_str = event_type.to_string();
        let b_id = body_id.to_string();
        let body_name = self
            .catalog
            .get(&b_id)
            .map(|e| e.data.name.as_str())
            .unwrap_or("");
        let line = generate_pilot_reaction_ro(&self.player_profile.pilot_id, &ev_str, body_name, &b_id);
        GString::from(&line)
    }

    /// Returnează directorul de pe disc unde sunt salvate capturile din Modul Foto (`P`).
    #[func]
    pub fn get_photos_save_dir(&self) -> GString {
        let dir = PlayerProfile::default_photos_dir();
        GString::from(&dir.to_string_lossy().to_string())
    }

    fn ship_spec_to_dict(spec: &SpacecraftSpec) -> Dictionary {
        let mut d = Dictionary::new();
        d.set("id", GString::from(&spec.id));
        d.set("name_ro", GString::from(&spec.name_ro));
        d.set("short_name_ro", GString::from(&spec.short_name_ro));
        d.set("propulsion_ro", GString::from(&spec.propulsion_ro));
        d.set("speed_kmh", spec.speed_kmh);
        d.set("light_speed_percent", spec.light_speed_percent);
        d.set("accent_color_hex", GString::from(&spec.accent_color_hex));
        d.set(
            "secondary_color_hex",
            GString::from(&spec.secondary_color_hex),
        );
        d.set(
            "didactic_summary_ro",
            GString::from(&spec.didactic_summary_ro),
        );
        d.set("manual_scene_speed", spec.manual_scene_speed);
        d.set("boost_multiplier", spec.boost_multiplier);
        d.set("warp_speed_multiplier", spec.warp_speed_multiplier);
        d.set("turn_rate_multiplier", spec.turn_rate_multiplier);
        d.set("roll_stability_multiplier", spec.roll_stability_multiplier);
        d.set("scan_speed_multiplier", spec.scan_speed_multiplier);
        d.set("scan_range_multiplier", spec.scan_range_multiplier);
        d.set("cockpit_fov", spec.cockpit_fov);
        d.set("rating_agility", spec.rating_agility);
        d.set("rating_warp", spec.rating_warp);
        d.set("rating_scanner", spec.rating_scanner);
        d.set("rating_stability", spec.rating_stability);
        d
    }

    fn pilot_spec_to_dict(p: &PilotSpec) -> Dictionary {
        let mut d = Dictionary::new();
        d.set("id", GString::from(&p.id));
        d.set("name_ro", GString::from(&p.name_ro));
        d.set("role_ro", GString::from(&p.role_ro));
        d.set("personality_ro", GString::from(&p.personality_ro));
        d.set("badge_symbol", GString::from(&p.badge_symbol));
        d.set("primary_color_hex", GString::from(&p.primary_color_hex));
        d.set("secondary_color_hex", GString::from(&p.secondary_color_hex));
        d.set("greeting_ro", GString::from(&p.greeting_ro));
        d
    }

    /// Marchează un corp ceresc drept scanat și salvează profilul în JSON pe disc.
    #[func]
    pub fn mark_body_scanned(&mut self, body_id: GString) -> bool {
        let id_str = body_id.to_string();
        let added = self.player_profile.mark_body_scanned(&id_str);
        let _ = self.save_player_profile();
        added
    }

    /// Verifică dacă un corp ceresc a fost deja scanat.
    #[func]
    pub fn is_body_scanned(&self, body_id: GString) -> bool {
        self.player_profile.is_body_scanned(&body_id.to_string())
    }

    /// Returnează lista ID-urilor corpurilor cerești deja scanate.
    #[func]
    pub fn get_scanned_bodies(&self) -> PackedStringArray {
        let mut list = PackedStringArray::new();
        for id in &self.player_profile.scanned_bodies {
            list.push(&GString::from(id));
        }
        list
    }

    /// Salvează profilul jucătorului în format JSON pe disc.
    #[func]
    pub fn save_player_profile(&self) -> bool {
        self.player_profile.save_to_path(&self.profile_path).is_ok()
    }

    /// Reîncarcă profilul jucătorului din fișierul JSON de pe disc.
    #[func]
    pub fn load_player_profile(&mut self) -> bool {
        match PlayerProfile::load_from_path(&self.profile_path) {
            Ok(loaded) => {
                self.player_profile = loaded;
                true
            }
            Err(_) => false,
        }
    }

    #[func]
    pub fn get_profile_save_path(&self) -> GString {
        GString::from(&self.profile_path.to_string_lossy().to_string())
    }

    #[func]
    pub fn set_profile_save_path(&mut self, path: GString) {
        self.profile_path = PathBuf::from(path.to_string());
    }

    // =========================================================================
    // Conversie internă CatalogBodyEntry -> Godot Dictionary
    // =========================================================================
    fn entry_to_dict(entry: &CatalogBodyEntry) -> Dictionary {
        let b = &entry.data;
        let mut dict = Dictionary::new();

        dict.set("id", GString::from(&b.id));
        dict.set("name", GString::from(&b.name));
        dict.set("category", GString::from(b.category.as_str()));
        dict.set("category_label_ro", GString::from(&entry.category_label_ro));
        dict.set("subtitle", GString::from(&b.subtitle));
        dict.set(
            "parent_id",
            GString::from(b.parent_id.as_deref().unwrap_or("")),
        );
        dict.set("color", GString::from(&b.color));
        dict.set(
            "orbit_color",
            GString::from(b.orbit_color.as_deref().unwrap_or(&b.color)),
        );

        // Parametri fizici și scalați pentru gameplay
        dict.set("radius_km", b.radius_km);
        dict.set("scaled_radius", entry.scaled_radius);
        dict.set("distance_from_sun_au", b.distance_from_sun_au);
        dict.set("scaled_orbit_distance", entry.scaled_orbit_distance);
        dict.set("orbit_period_days", b.orbit_period_days);
        dict.set("day_length_hours", b.day_length_hours);
        dict.set("mean_temp_c", b.mean_temp_c);
        dict.set("mass_earth_ratio", b.mass_earth_ratio);
        dict.set("gravity_ratio", b.gravity_ratio);
        dict.set("axial_tilt_deg", b.axial_tilt_deg.unwrap_or(0.0));
        dict.set("local_orbit_order", b.local_orbit_order.unwrap_or(0) as i32);

        // Căi către texturile PBR 2K și 4K
        dict.set("texture_2k", GString::from(&entry.textures.albedo_2k));
        dict.set("texture_4k", GString::from(&entry.textures.albedo_4k));

        // Configurația atmosferei Fresnel / Rim lighting
        dict.set("has_atmosphere", entry.atmosphere.has_atmosphere);
        dict.set(
            "atmosphere_color",
            GString::from(&entry.atmosphere.color_hex),
        );
        dict.set(
            "atmosphere_rim_intensity",
            entry.atmosphere.rim_intensity,
        );
        dict.set("atmosphere_outer_scale", entry.atmosphere.outer_scale);

        let mut tex_dict = Dictionary::new();
        tex_dict.set("albedo_2k", GString::from(&entry.textures.albedo_2k));
        tex_dict.set("albedo_4k", GString::from(&entry.textures.albedo_4k));
        tex_dict.set(
            "bump_map",
            GString::from(entry.textures.bump_map.as_deref().unwrap_or("")),
        );
        tex_dict.set(
            "roughness_map",
            GString::from(entry.textures.roughness_map.as_deref().unwrap_or("")),
        );
        tex_dict.set(
            "clouds_map",
            GString::from(entry.textures.clouds_map.as_deref().unwrap_or("")),
        );
        tex_dict.set(
            "night_map",
            GString::from(entry.textures.night_map.as_deref().unwrap_or("")),
        );
        tex_dict.set(
            "ring_map",
            GString::from(entry.textures.ring_map.as_deref().unwrap_or("")),
        );
        dict.set("textures", tex_dict);

        // Date didactice în limba română (Junior 6-8 ani & Cadet 9-12 ani)
        let mut travel_dict = Dictionary::new();
        travel_dict.set("car", GString::from(&b.junior.travel_time.car));
        travel_dict.set("plane", GString::from(&b.junior.travel_time.plane));
        travel_dict.set("rocket", GString::from(&b.junior.travel_time.rocket));
        travel_dict.set("light", GString::from(&b.junior.travel_time.light));

        let mut junior_dict = Dictionary::new();
        junior_dict.set("summary", GString::from(&b.junior.summary));
        junior_dict.set("analogy", GString::from(&b.junior.analogy));
        junior_dict.set("fun_fact", GString::from(&b.junior.fun_fact));
        junior_dict.set("travel_time", travel_dict);

        let mut structure_arr = Array::new();
        for layer in &b.cadet.structure {
            let mut layer_dict = Dictionary::new();
            layer_dict.set("name", GString::from(&layer.name));
            layer_dict.set("description", GString::from(&layer.description));
            structure_arr.push(&layer_dict);
        }

        let mut quiz_options = PackedStringArray::new();
        for opt in &b.cadet.quiz.options {
            quiz_options.push(&GString::from(opt));
        }

        let mut quiz_dict = Dictionary::new();
        quiz_dict.set("question", GString::from(&b.cadet.quiz.question));
        quiz_dict.set("options", quiz_options);
        quiz_dict.set("correct_index", b.cadet.quiz.correct_index as i32);
        quiz_dict.set("explanation", GString::from(&b.cadet.quiz.explanation));

        let mut cadet_dict = Dictionary::new();
        cadet_dict.set("summary", GString::from(&b.cadet.summary));
        cadet_dict.set(
            "exploration_history",
            GString::from(&b.cadet.exploration_history),
        );
        cadet_dict.set("structure", structure_arr);
        cadet_dict.set("quiz", quiz_dict);

        let mut didactic_dict = Dictionary::new();
        didactic_dict.set("junior", junior_dict);
        didactic_dict.set("cadet", cadet_dict);
        dict.set("didactic", didactic_dict);

        // Câmpuri didactice rapide la nivel superior
        dict.set("junior_summary", GString::from(&b.junior.summary));
        dict.set("junior_analogy", GString::from(&b.junior.analogy));
        dict.set("junior_fun_fact", GString::from(&b.junior.fun_fact));
        dict.set("cadet_summary", GString::from(&b.cadet.summary));

        dict
    }
}

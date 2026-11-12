// SPDX-License-Identifier: GPL-3.0-or-later

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use crate::orbital::SPEED_OF_LIGHT_KMH;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgeTier {
    Junior,
    Cadet,
}

impl AgeTier {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Junior => "junior",
            Self::Cadet => "cadet",
        }
    }
}

/// Specificațiile celor 3 piloți selectabili în Hangarul Orbital.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PilotSpec {
    pub id: String,
    pub name_ro: String,
    pub role_ro: String,
    pub personality_ro: String,
    pub badge_symbol: String,
    pub primary_color_hex: String,
    pub secondary_color_hex: String,
    pub greeting_ro: String,
}

pub fn available_pilot_specs() -> Vec<PilotSpec> {
    vec![
        PilotSpec {
            id: "cadet_explorator".to_string(),
            name_ro: "Cadetul Explorator".to_string(),
            role_ro: "Tânăr Explorator Cosmic".to_string(),
            personality_ro: "Curios și entuziast — se bucură la fiecare lume nouă și pune întrebări fascinante!".to_string(),
            badge_symbol: "★".to_string(),
            primary_color_hex: "#38bdf8".to_string(),
            secondary_color_hex: "#fbbf24".to_string(),
            greeting_ro: "Uau, privește câte lumi ne așteaptă! Abia aștept să decolăm și să le scanăm pe toate!".to_string(),
        },
        PilotSpec {
            id: "inginer_robot".to_string(),
            name_ro: "Inginerul Robot".to_string(),
            role_ro: "Unitate Cibernetică Astro-Tehnică".to_string(),
            personality_ro: "Analitic, oferă detalii tehnice amuzante și calculează totul la milimetru!".to_string(),
            badge_symbol: "⚙".to_string(),
            primary_color_hex: "#22c55e".to_string(),
            secondary_color_hex: "#00f0ff".to_string(),
            greeting_ro: "Bip-bup! Toate circuitele mele vibrează de curiozitate! Senzorii sunt calibrați la 100,00%!".to_string(),
        },
        PilotSpec {
            id: "comandant_veteran".to_string(),
            name_ro: "Comandantul Veteran".to_string(),
            role_ro: "Căpitan de Flotă Interplanetară".to_string(),
            personality_ro: "Calm și înțelept — ghidează manevrele cu răbdare și siguranță.".to_string(),
            badge_symbol: "❖".to_string(),
            primary_color_hex: "#ffb703".to_string(),
            secondary_color_hex: "#f97316".to_string(),
            greeting_ro: "Sistemele de bord sunt verzi, tânărul meu co-pilot. Ține mâna ferm pe manșă, pornim spre stele!".to_string(),
        },
    ]
}

/// Generează în limba română replica reactivă a pilotului ales în funcție de evenimentul din timpul zborului.
pub fn generate_pilot_reaction_ro(
    pilot_id: &str,
    event_type: &str,
    body_name_ro: &str,
    body_id: &str,
) -> String {
    let target = if body_name_ro.is_empty() {
        "această lume"
    } else {
        body_name_ro
    };

    match (pilot_id, event_type) {
        // Replici la apropierea de o planetă / intrarea în bula de proximitate
        ("inginer_robot", "approach_planet") => match body_id {
            "saturn" => "Bip-bup! Detectez miliarde de bulgări de gheață în inelele lui Saturn! Ține apăsat Click Dreapta pentru scanare!".to_string(),
            "jupiter" => "Senzori în alertă! Jupiter este atât de masiv încât ar încăpea 1.300 de Pământuri în el! Să activăm Scannerul!".to_string(),
            "mars" => "Analiză spectrală: oxid de fier pe Marte — practic planeta a ruginit! Ține apăsat Click Dreapta ca să o scanăm!".to_string(),
            "sun" => "Atenție la scuturile termice! Fotosfera Soarelui are 5.505 °C! Putem scana coroana de la distanță sigură!".to_string(),
            _ => format!("Bip-bup! Am intrat în orbita de proximitate a corpului {target}. Ține apăsat Click Dreapta sau Trigger Stânga pentru scanare!"),
        },
        ("comandant_veteran", "approach_planet") => format!(
            "Am ajuns în siguranță lângă {target}. Bula planetară ne reduce lin viteza — ține apăsat Click Dreapta pentru a porni Scannerul Științific."
        ),
        (_, "approach_planet") => format!(
            "Uau, ce aproape suntem de {target}! Ține apăsat Click Dreapta (sau Trigger Stânga) ca să scanăm planeta!"
        ),

        // Replici la activarea Mini-Warp-ului
        ("inginer_robot", "warp_engage") => "Propulsorul Mini-Warp la capacitate maximă! Fotonii se alungesc pe lângă carcasă — ține-te bine de antene!".to_string(),
        ("comandant_veteran", "warp_engage") => "Salt Mini-Warp activat. Păstrează direcția înainte, traversăm spațiul interplanetar!".to_string(),
        (_, "warp_engage") => "Uhuuu! Zburăm în Mini-Warp printre stele! Privește cum se întind luminile!".to_string(),

        // Replici când Warp-ul este blocat de bula de siguranță planetară
        ("inginer_robot", "warp_blocked") => format!(
            "Bip! Protocolul de siguranță blochează Mini-Warp-ul atât de aproape de {target}! Îndepărtează-te puțin de planetă!"
        ),
        ("comandant_veteran", "warp_blocked") => format!(
            "Suntem prea aproape de {target} pentru Mini-Warp. Folosește propulsia de manevră sau Boost (Shift) până ieșim din orbită."
        ),
        (_, "warp_blocked") => format!(
            "Ups! Suntem chiar lângă {target} — bula de siguranță oprește Warp-ul ca să nu ne ciocnim!"
        ),

        // Replici la Frânarea Gravitațională Automată (Hyper-Drop la 2.2 * raza_planetei)
        ("inginer_robot", "hyper_drop") => format!(
            "Bip-bup! Câmp gravitațional colosal detectat la 2,2 raze de {target}! Am declanșat frânarea automată Hyper-Drop!"
        ),
        ("comandant_veteran", "hyper_drop") => format!(
            "Ieșire automată din HYPER lângă {target}. Frânare gravitațională completă — privește cât de impunătoare este planeta pe parbriz!"
        ),
        (_, "hyper_drop") => format!(
            "Uauuu! Am ieșit din HYPER chiar în fața gigantului {target}! Umple tot parbrizul!"
        ),

        // Replici la finalizarea scanării 100%
        ("inginer_robot", "scan_complete") => format!(
            "Scanare 100% completă pentru {target}! Am arhivat toate datele în Jurnalul Cadetului!"
        ),
        ("comandant_veteran", "scan_complete") => format!(
            "Excelentă muncă de cercetare! {target} a fost înregistrată oficial în Jurnalul de Bord."
        ),
        (_, "scan_complete") => format!(
            "Bravo! Am descoperit {target}! Hai să citim secretele ei în fișa de pe bord!"
        ),

        // Replici la intrarea în Modul Foto (P)
        ("inginer_robot", "photo_mode") => "Drona optică activată! Rotește camera cu mouse-ul și apasă Enter sau F12 pentru a salva fotografia!".to_string(),
        ("comandant_veteran", "photo_mode") => "Mod Foto activ. Alege cel mai frumos unghi cu planeta pe fundal și imortalizează momentul!".to_string(),
        (_, "photo_mode") => "Zâmbește! Suntem în Modul Foto — rotește camera în jurul navei și fă o poză grozavă!".to_string(),

        // Replici la pornirea / oprirea motoarelor (tasta E)
        ("inginer_robot", "power_up") => "Bip-bup! Reactorul principal a pornit — ecranele și proiectorul holografic sunt la 100% putere!".to_string(),
        ("comandant_veteran", "power_up") => "Motoare repornite, toate instrumentele de bord sunt online. Suntem gata de manevră!".to_string(),
        (_, "power_up") => "Ura! Motoarele au pornit și toate luminile din cabină s-au aprins!".to_string(),

        ("inginer_robot", "power_down") => format!(
            "Motoare oprite! Am trecut bordul în modul albastru de veghe pentru plutire silențioasă lângă {target}."
        ),
        ("comandant_veteran", "power_down") => format!(
            "Am oprit propulsoarele. Plutim în liniște cosmică în fața corpului {target} — admiră priveliștea pe geamul cabinei!"
        ),
        (_, "power_down") => format!(
            "Șșșt... am oprit motoarele! Plutim în imponderabilitate chiar în fața corpului {target}!"
        ),

        // Replici implicite la decolare
        ("inginer_robot", _) => "Motoare calibrate! Zboară cu WASD, Shift pentru Boost, Space pentru Mini-Warp și Click Dreapta pentru Scanner!".to_string(),
        ("comandant_veteran", _) => "Am părăsit hangarul orbital. Alege o planetă la orizont și zboară spre ea!".to_string(),
        (_, _) => "Am decolat în Sistemul Solar! Hai să zburăm spre o planetă și să o scanăm!".to_string(),
    }
}

/// Specificațiile celor 3 arhetipuri de nave 3D modulare din Hangarul Orbital,
/// plus navele didactice din Orbitar.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpacecraftSpec {
    pub id: String,
    pub name_ro: String,
    pub short_name_ro: String,
    pub propulsion_ro: String,
    pub speed_kmh: f64,
    pub light_speed_percent: f64,
    pub accent_color_hex: String,
    pub secondary_color_hex: String,
    pub didactic_summary_ro: String,
    pub manual_scene_speed: f32,
    pub boost_multiplier: f32,
    pub warp_speed_multiplier: f32,
    pub turn_rate_multiplier: f32,
    pub roll_stability_multiplier: f32,
    pub scan_speed_multiplier: f32,
    pub scan_range_multiplier: f32,
    pub cockpit_fov: f32,
    pub rating_agility: i32,
    pub rating_warp: i32,
    pub rating_scanner: i32,
    pub rating_stability: i32,
}

/// Returnează cele 3 arhetipuri de nave 3D modulare pentru Hangarul jocului Godot 4.
pub fn available_hangar_ship_archetypes() -> Vec<SpacecraftSpec> {
    vec![
        SpacecraftSpec {
            id: "sonda_lacusta".to_string(),
            name_ro: "Sonda „Lăcusta”".to_string(),
            short_name_ro: "Lăcusta".to_string(),
            propulsion_ro: "Micro-Propulsoare Ionice Agile & Scanner Rapid".to_string(),
            speed_kmh: 95_000.0,
            light_speed_percent: (95_000.0 / SPEED_OF_LIGHT_KMH) * 100.0,
            accent_color_hex: "#fbbf24".to_string(),
            secondary_color_hex: "#38bdf8".to_string(),
            didactic_summary_ro: "Viteză de rotație mare, vizibilitate panoramică maximă din cockpit și scanner științific ultra-rapid pentru cercetare de aproape.".to_string(),
            manual_scene_speed: 550.0,
            boost_multiplier: 5.0,
            warp_speed_multiplier: 1.0,
            turn_rate_multiplier: 1.45,
            roll_stability_multiplier: 1.15,
            scan_speed_multiplier: 1.65,
            scan_range_multiplier: 1.05,
            cockpit_fov: 76.0,
            rating_agility: 5,
            rating_warp: 3,
            rating_scanner: 5,
            rating_stability: 3,
        },
        SpacecraftSpec {
            id: "naveta_vulturul".to_string(),
            name_ro: "Naveta „Vulturul”".to_string(),
            short_name_ro: "Vulturul".to_string(),
            propulsion_ro: "Propulsor cu Fuziune, Warp Rapid & Dronă Foto".to_string(),
            speed_kmh: 1_500_000.0,
            light_speed_percent: (1_500_000.0 / SPEED_OF_LIGHT_KMH) * 100.0,
            accent_color_hex: "#00f0ff".to_string(),
            secondary_color_hex: "#f8fafc".to_string(),
            didactic_summary_ro: "Navetă echilibrată de explorare interplanetară, echipată cu propulsor Mini-Warp rapid și dronă foto panoramică.".to_string(),
            manual_scene_speed: 500.0,
            boost_multiplier: 6.0,
            warp_speed_multiplier: 1.40,
            turn_rate_multiplier: 1.10,
            roll_stability_multiplier: 1.25,
            scan_speed_multiplier: 1.20,
            scan_range_multiplier: 1.20,
            cockpit_fov: 68.0,
            rating_agility: 4,
            rating_warp: 5,
            rating_scanner: 4,
            rating_stability: 4,
        },
        SpacecraftSpec {
            id: "cargobot_stanca".to_string(),
            name_ro: "Cargobotul „Stânca”".to_string(),
            short_name_ro: "Stânca".to_string(),
            propulsion_ro: "Propulsie Grea cu Plasmă & Radar de Rază Lungă".to_string(),
            speed_kmh: 650_000.0,
            light_speed_percent: (650_000.0 / SPEED_OF_LIGHT_KMH) * 100.0,
            accent_color_hex: "#f97316".to_string(),
            secondary_color_hex: "#94a3b8".to_string(),
            didactic_summary_ro: "Navă robustă și ultra-stabilă, cu amortizoare giroscopice puternice și antenă parabolică pentru scanare de la distanță mare.".to_string(),
            manual_scene_speed: 420.0,
            boost_multiplier: 5.2,
            warp_speed_multiplier: 1.12,
            turn_rate_multiplier: 0.82,
            roll_stability_multiplier: 1.85,
            scan_speed_multiplier: 1.10,
            scan_range_multiplier: 1.75,
            cockpit_fov: 64.0,
            rating_agility: 2,
            rating_warp: 4,
            rating_scanner: 5,
            rating_stability: 5,
        },
    ]
}

pub fn available_spacecraft_specs() -> Vec<SpacecraftSpec> {
    let mut specs = available_hangar_ship_archetypes();
    specs.extend([
        SpacecraftSpec {
            id: "vlaicu1".to_string(),
            name_ro: "Racheta \"Vlaicu-1\"".to_string(),
            short_name_ro: "Vlaicu-1".to_string(),
            propulsion_ro: "Propulsie Chimică".to_string(),
            speed_kmh: 50_000.0,
            light_speed_percent: (50_000.0 / SPEED_OF_LIGHT_KMH) * 100.0,
            accent_color_hex: "#ffb703".to_string(),
            secondary_color_hex: "#e2e8f0".to_string(),
            didactic_summary_ro: "Arată cât durează în realitate călătoriile de azi (3 zile până la Lună, ~7 luni până la Marte, ~5-6 ani până la Jupiter, ~12 ani până la Neptun).".to_string(),
            manual_scene_speed: 450.0,
            boost_multiplier: 5.5,
            warp_speed_multiplier: 1.0,
            turn_rate_multiplier: 1.0,
            roll_stability_multiplier: 1.0,
            scan_speed_multiplier: 1.0,
            scan_range_multiplier: 1.0,
            cockpit_fov: 68.0,
            rating_agility: 3,
            rating_warp: 3,
            rating_scanner: 3,
            rating_stability: 4,
        },
        SpacecraftSpec {
            id: "coandax".to_string(),
            name_ro: "Nava \"Coandă-X\"".to_string(),
            short_name_ro: "Coandă-X".to_string(),
            propulsion_ro: "Propulsie cu Fuziune & Plasmă".to_string(),
            speed_kmh: 1_500_000.0,
            light_speed_percent: (1_500_000.0 / SPEED_OF_LIGHT_KMH) * 100.0,
            accent_color_hex: "#00f0ff".to_string(),
            secondary_color_hex: "#f8fafc".to_string(),
            didactic_summary_ro: "Tehnologia viitorului apropiat (ore până la Lună, câteva zile până la Marte, săptămâni până la giganții gazoși).".to_string(),
            manual_scene_speed: 520.0,
            boost_multiplier: 5.8,
            warp_speed_multiplier: 1.3,
            turn_rate_multiplier: 1.15,
            roll_stability_multiplier: 1.2,
            scan_speed_multiplier: 1.2,
            scan_range_multiplier: 1.2,
            cockpit_fov: 68.0,
            rating_agility: 4,
            rating_warp: 5,
            rating_scanner: 4,
            rating_stability: 4,
        },
        SpacecraftSpec {
            id: "luceafarul".to_string(),
            name_ro: "Astronava \"Luceafărul\"".to_string(),
            short_name_ro: "Luceafărul".to_string(),
            propulsion_ro: "Propulsie Fotonică / Cuantică (1c)".to_string(),
            speed_kmh: SPEED_OF_LIGHT_KMH.round(),
            light_speed_percent: 100.0,
            accent_color_hex: "#c084fc".to_string(),
            secondary_color_hex: "#f8fafc".to_string(),
            didactic_summary_ro: "Călătorește cu viteza luminii (8 minute de la Soare la Pământ, ~43 minute până la Jupiter, ~4 ore până la Neptun).".to_string(),
            manual_scene_speed: 600.0,
            boost_multiplier: 5.0,
            warp_speed_multiplier: 1.6,
            turn_rate_multiplier: 1.25,
            roll_stability_multiplier: 1.4,
            scan_speed_multiplier: 1.5,
            scan_range_multiplier: 1.5,
            cockpit_fov: 72.0,
            rating_agility: 5,
            rating_warp: 5,
            rating_scanner: 5,
            rating_stability: 5,
        },
    ]);
    specs
}

pub fn get_ship_spec_by_id(ship_id: &str) -> SpacecraftSpec {
    available_spacecraft_specs()
        .into_iter()
        .find(|s| s.id == ship_id)
        .unwrap_or_else(|| available_hangar_ship_archetypes().remove(1))
}

pub fn get_pilot_spec_by_id(pilot_id: &str) -> PilotSpec {
    available_pilot_specs()
        .into_iter()
        .find(|p| p.id == pilot_id)
        .unwrap_or_else(|| available_pilot_specs().remove(0))
}

/// Starea profilului local al jucătorului (numele de cadet, pilotul ales, nava aleasă,
/// culoarea fuzelajului, setările și lista corpurilor cerești deja scanate),
/// salvată local pe disc în format JSON.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct PlayerProfile {
    pub cadet_name: String,
    pub pilot_id: String,
    pub pilot_name: String,
    pub age_tier: AgeTier,
    pub selected_ship_id: String,
    pub ship_color_hex: String,
    pub quality_mode: String,
    pub audio_volume: f32,
    pub default_camera_mode: String,
    pub scanned_bodies: Vec<String>,
}

impl Default for PlayerProfile {
    fn default() -> Self {
        Self {
            cadet_name: "Cadetul Cosmin".to_string(),
            pilot_id: "cadet_explorator".to_string(),
            pilot_name: "Cadetul Explorator".to_string(),
            age_tier: AgeTier::Junior,
            selected_ship_id: "naveta_vulturul".to_string(),
            ship_color_hex: "#38bdf8".to_string(),
            quality_mode: "hd".to_string(),
            audio_volume: 0.85,
            default_camera_mode: "chase".to_string(),
            scanned_bodies: vec!["earth".to_string()],
        }
    }
}

impl PlayerProfile {
    pub fn new(pilot_id: impl Into<String>, pilot_name: impl Into<String>, ship_id: impl Into<String>) -> Self {
        let p_name = pilot_name.into();
        Self {
            cadet_name: p_name.clone(),
            pilot_id: pilot_id.into(),
            pilot_name: p_name,
            age_tier: AgeTier::Junior,
            selected_ship_id: ship_id.into(),
            ship_color_hex: "#38bdf8".to_string(),
            quality_mode: "hd".to_string(),
            audio_volume: 0.85,
            default_camera_mode: "chase".to_string(),
            scanned_bodies: vec!["earth".to_string()],
        }
    }

    pub fn set_cadet_name(&mut self, cadet_name: impl Into<String>) {
        let trimmed = cadet_name.into().trim().to_string();
        if !trimmed.is_empty() {
            self.cadet_name = trimmed;
        }
    }

    pub fn set_ship_color(&mut self, color_hex: impl Into<String>) {
        let hex = color_hex.into().trim().to_string();
        if !hex.is_empty() {
            self.ship_color_hex = hex;
        }
    }

    pub fn set_pilot(&mut self, pilot_id: impl Into<String>, pilot_name: impl Into<String>) {
        self.pilot_id = pilot_id.into();
        self.pilot_name = pilot_name.into();
    }

    pub fn set_ship(&mut self, ship_id: &str) -> bool {
        let valid = matches!(
            ship_id,
            "sonda_lacusta"
                | "naveta_vulturul"
                | "cargobot_stanca"
                | "vlaicu1"
                | "coandax"
                | "luceafarul"
        );
        if valid {
            self.selected_ship_id = ship_id.to_string();
        }
        valid
    }

    /// Marchează un corp ceresc ca fiind scanat. Returnează `true` dacă a fost scanat în premieră.
    pub fn mark_body_scanned(&mut self, body_id: &str) -> bool {
        let clean = body_id.trim();
        if clean.is_empty() {
            return false;
        }
        if !self.scanned_bodies.iter().any(|b| b == clean) {
            self.scanned_bodies.push(clean.to_string());
            true
        } else {
            false
        }
    }

    pub fn is_body_scanned(&self, body_id: &str) -> bool {
        self.scanned_bodies.iter().any(|b| b == body_id)
    }

    /// Determină calea implicită de salvare a profilului pe discul local.
    pub fn default_storage_path() -> PathBuf {
        let base_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::temp_dir());

        #[cfg(target_os = "macos")]
        let app_dir = base_dir
            .join("Library")
            .join("Application Support")
            .join("Orbitar");

        #[cfg(target_os = "windows")]
        let app_dir = std::env::var("APPDATA")
            .map(PathBuf::from)
            .unwrap_or_else(|_| base_dir.join("AppData").join("Roaming"))
            .join("Orbitar");

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let app_dir = std::env::var("XDG_DATA_HOME")
            .map(PathBuf::from)
            .unwrap_or_else(|_| base_dir.join(".local").join("share"))
            .join("orbitar");

        if fs::create_dir_all(&app_dir).is_ok() {
            app_dir.join("player_profile.json")
        } else {
            std::env::temp_dir()
                .join("orbitar")
                .join("player_profile.json")
        }
    }

    /// Determină directorul pentru salvarea capturilor din Modul Foto (`P`).
    pub fn default_photos_dir() -> PathBuf {
        let base_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map(PathBuf::from)
            .unwrap_or_else(|_| std::env::temp_dir());

        let pictures_dir = base_dir.join("Pictures").join("Orbitar");
        if fs::create_dir_all(&pictures_dir).is_ok() {
            return pictures_dir;
        }

        let downloads_dir = base_dir.join("Downloads").join("Orbitar");
        if fs::create_dir_all(&downloads_dir).is_ok() {
            return downloads_dir;
        }

        let fallback = std::env::temp_dir().join("orbitar").join("photos");
        let _ = fs::create_dir_all(&fallback);
        fallback
    }

    /// Salvează profilul jucătorului în format JSON pe disc la calea specificată.
    pub fn save_to_path(&self, path: &Path) -> Result<(), String> {
        if let Some(parent) = path.parent() {
            if !parent.as_os_str().is_empty() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
        }
        let json = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, json).map_err(|e| e.to_string())
    }

    /// Încarcă profilul jucătorului din fișierul JSON de la calea specificată.
    pub fn load_from_path(path: &Path) -> Result<Self, String> {
        let content = fs::read_to_string(path).map_err(|e| e.to_string())?;
        serde_json::from_str(&content).map_err(|e| e.to_string())
    }

    /// Încarcă profilul de la calea specificată sau returnează profilul implicit dacă nu există.
    pub fn load_or_default(path: &Path) -> Self {
        Self::load_from_path(path).unwrap_or_default()
    }
}

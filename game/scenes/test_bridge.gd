# SPDX-License-Identifier: GPL-3.0-or-later
extends Node3D

@onready var space_core: OrbitarSpaceCore = $OrbitarSpaceCore

func _ready() -> void:
	print("=================================================================")
	print("🚀 [Orbitar 3D] Verificare Punte Nativă Rust (Faza 1 + Faza 2)")
	print("=================================================================")

	if space_core == null:
		push_error("[Orbitar 3D] Eroare: Nodul OrbitarSpaceCore nu a putut fi instanțiat!")
		return

	var catalog: Array = space_core.get_celestial_catalog()
	print("🪐 Număr total corpuri cerești încărcate din Rust (orbitar-core): %d" % catalog.size())
	print("-----------------------------------------------------------------")

	for body in catalog:
		var id: String = body.get("id", "")
		var name_ro: String = body.get("name", "")
		var category_ro: String = body.get("category_label_ro", "")
		var parent_id: String = body.get("parent_id", "")
		var scaled_r: float = body.get("scaled_radius", 0.0)
		var scaled_orbit: float = body.get("scaled_orbit_distance", 0.0)
		var tex_2k: String = body.get("texture_2k", "")
		var tex_4k: String = body.get("texture_4k", "")
		var parent_info: String = " [Satelit -> %s]" % parent_id if parent_id != "" else ""

		print("  • %-10s | %-22s (%s)%s | Rază=%.3f | Orbită=%.2f | 2K=%s | 4K=%s" % [
			id, name_ro, category_ro, parent_info, scaled_r, scaled_orbit, tex_2k, tex_4k
		])

	print("-----------------------------------------------------------------")
	# Verificare Floating Origin în f64 (DVec3 -> Vector3)
	var earth_rel_t0: Vector3 = space_core.get_relative_planet_position("earth", 0.0)
	print("🧭 [Floating Origin f64] Poziția relativă a Pământului la t=0 (navă în origine): %s" % str(earth_rel_t0))

	space_core.update_ship_displacement(Vector3(10.0, 0.0, -5.0))
	var ship_abs_f64: PackedFloat64Array = space_core.get_ship_absolute_position_f64()
	var earth_rel_after: Vector3 = space_core.get_relative_planet_position("earth", 0.0)
	print("🧭 [Floating Origin f64] Poziția absolută navă (DVec3 f64): [%.2f, %.2f, %.2f] | Pământ relativ: %s" % [
		ship_abs_f64[0], ship_abs_f64[1], ship_abs_f64[2], str(earth_rel_after)
	])

	# Verificare Profil Jucător (JSON pe disc)
	space_core.set_selected_pilot("cadet_ro", "Cadet Dumitru")
	space_core.set_selected_ship("coandax")
	space_core.mark_body_scanned("mars")
	var profile: Dictionary = space_core.get_player_profile()
	print("👨‍🚀 [Profil Jucător JSON] Pilot: %s (%s) | Navă: %s | Corpuri scanate: %s" % [
		profile.get("pilot_name", ""),
		profile.get("pilot_id", ""),
		profile.get("selected_ship_id", ""),
		str(profile.get("scanned_bodies", []))
	])

	# Verificare Faza 2: SpaceWorld + PlayerShip (6DOF, Eco/HD, Saturn MultiMesh, Safety Bubble)
	var space_world_scene: PackedScene = load("res://scenes/solar_system/space_world.tscn")
	var space_world: Node3D = space_world_scene.instantiate()
	add_child(space_world)

	var saturn_mmi: MultiMeshInstance3D = space_world.saturn_asteroids_multimesh
	var hd_instances: int = saturn_mmi.multimesh.instance_count if saturn_mmi != null else 0
	space_world.set_quality_mode("eco")
	var eco_instances: int = saturn_mmi.multimesh.instance_count if saturn_mmi != null else 0
	space_world.set_quality_mode("hd")

	var ship: Node3D = space_world.player_ship
	ship.velocity = Vector3(0.0, 0.0, -15.0)
	ship._physics_process(0.1)
	var ship_pos_after_step: Vector3 = ship.position
	ship.toggle_camera_mode(false)

	# Verificare Sistem Dual de Camere (ShipCameraRig), Cabină 3D Interactivă (CockpitInterior) & Audio (ShipAudioController)
	var cam_rig: Node3D = ship.camera_rig
	var cockpit_3d: Node3D = cam_rig.cockpit_interior_root
	var audio_ctrl: Node3D = ship.audio_controller

	# Testăm Free-Look în Cockpit (±85° orizontal, ±55° vertical)
	cam_rig.set_freelook_override(true)
	cam_rig.apply_freelook_input_degrees(120.0, -90.0)
	var clamped_yaw: float = cam_rig.cockpit_look_yaw_deg
	var clamped_pitch: float = cam_rig.cockpit_look_pitch_deg
	cam_rig.set_freelook_override(false)

	# Testăm oprirea / repornirea motoarelor pe tasta E (Power-Down / Power-Up + Mod Veghe Albastru + Plutire Mascotă)
	ship.toggle_engine_power()
	for _i in range(10):
		ship._physics_process(0.1)
	var power_off_level: float = cam_rig.dashboard_power_level
	var mascot_float_off: float = cockpit_3d.mascot_zero_g_float_offset
	var standby_blue_off: bool = cockpit_3d.standby_blue_mode

	ship.toggle_engine_power()
	for _i in range(10):
		audio_ctrl.update_audio_state(0.12, 0.92, 1, Vector3(0.5, -0.9, 0.3), true, true)
		cam_rig.update_rig(
			0.12,
			Vector3(0.0, 0.0, -76.0),
			Vector3(0.5, -0.9, 0.3),
			1,
			20.0,
			"Pământul",
			8.4,
			audio_ctrl.engine_power_progress,
			space_world.space_core,
			space_world.simulation_time_days,
			true,
			"earth",
			false,
			1.0
		)
	var power_on_level: float = cam_rig.dashboard_power_level

	print("🪐 [Faza 2 SpaceWorld] Saturn MultiMesh: HD=%d instanțe | Eco=%d instanțe" % [hd_instances, eco_instances])
	print("🛸 [Faza 2 PlayerShip] Poziție scenă (Floating Origin): %s | Bulă siguranță: %s (factor viteză=%.2f) | Cameră activă: %d" % [
		str(ship_pos_after_step),
		ship.nearest_body_name,
		ship.safety_speed_limit_factor,
		ship.camera_mode
	])
	print("🎥 [Faza 2 ShipCameraRig] Free-Look Cockpit limitat: Yaw=%.1f° Pitch=%.1f° | G-Force Offset=%s | Chase Boost FOV=%.1f°" % [
		clamped_yaw,
		clamped_pitch,
		str(cam_rig.g_force_offset),
		cam_rig._current_chase_fov
	])
	print("🕹️ [Cabină 3D Interactivă] Mascotă Arc (Float Zero-G=%.3f, Tilt=%s) | Mini-Orrery: %d sfere holografice | Veghe Albastră(Off)=%s" % [
		mascot_float_off,
		str(cockpit_3d.mascot_tilt_deg),
		cockpit_3d.orrery_planet_meshes.size(),
		str(standby_blue_off)
	])
	print("🔊 [Faza 2 ShipAudioController] Bus activ (Cockpit): %s | Thruster pitch=%.2f | RCS=%s | Radio Squelch=%d | Power: %.2f -> %.2f" % [
		String(audio_ctrl.active_bus_name),
		audio_ctrl.current_thruster_pitch_scale,
		str(audio_ctrl.rcs_active),
		audio_ctrl.radio_squelch_count,
		power_off_level,
		power_on_level
	])

	# Verificare Faza 3: Meniul Principal SF în Hangar (main_menu_hangar.tscn) + HUD + Scanner + Mod Foto
	var menu_packed: PackedScene = load("res://scenes/menu/main_menu_hangar.tscn")
	var main_menu: Node3D = menu_packed.instantiate()
	add_child(main_menu)

	main_menu.open_expedition_selector()
	main_menu.set_cadet_name_text("Cadetul Mihai")
	main_menu.select_pilot_by_id("inginer_robot")
	main_menu.cycle_ship(1)
	main_menu.select_ship_by_id("cargobot_stanca", true)
	main_menu.select_hull_color("#10b981")
	main_menu.set_camera_focus(main_menu.CameraFocus.COCKPIT_INSPECT, false)
	var launch_saved: bool = main_menu.launch_into_space(false)

	var hud: CanvasLayer = space_world.space_hud
	# Legăm SpaceWorld și HUD la nucleul actualizat din Meniul Hangar pentru a reflecta selecția
	ship.bind_space_core(main_menu.space_core)
	hud.bind_systems(main_menu.space_core, ship)

	print("🛠️ [Faza 3 Sci-Fi Hangar Menu] Cadet: %s | Pilot: %s | Rachetă: %s (%s) | Culoare: %s | Hidraulic=%d | PowerUp=%d | Salvat JSON: %s" % [
		main_menu.space_core.get_cadet_name(),
		main_menu.space_core.get_selected_pilot_name(),
		ship.active_ship_name_ro,
		ship.active_ship_id,
		main_menu.space_core.get_ship_color_hex(),
		main_menu.hydraulic_play_count,
		main_menu.powerup_play_count,
		str(launch_saved)
	])

	# Apropiem nava în bula de proximitate a Pământului și efectuăm o scanare științifică 100%
	main_menu.space_core.station_ship_near_planet("earth", space_world.simulation_time_days, 2.2)
	ship._physics_process(0.1)
	ship.perform_instant_scan("earth")

	var earth_scanned: bool = main_menu.space_core.is_body_scanned("earth")
	var card_is_open: bool = hud._discovery_card_panel != null and hud._discovery_card_panel.visible
	var pilot_line_warp: String = main_menu.space_core.get_pilot_reaction("warp_engage", "earth")

	# Verificare Mod Foto (P)
	ship.set_photo_mode(true)
	var hud_hidden_in_photo: bool = hud._main_hud_root != null and not hud._main_hud_root.visible
	var saved_photo_path: String = ship.capture_photo_to_disk()
	ship.set_photo_mode(false)

	print("🔬 [Faza 3 Scanner & Jurnal] Pământ scanat 100%% în Rust: %s | Fișă deschisă: %s | Replică pilot: \"%s\"" % [
		str(earth_scanned),
		str(card_is_open),
		pilot_line_warp
	])
	print("📸 [Faza 3 Mod Foto] HUD oprit în Mod Foto: %s | Captură salvată în: %s" % [
		str(hud_hidden_in_photo),
		saved_photo_path
	])

	# Verificare Upgrade Scară Colosală + Proiecție Optică Anti-Clipping + HYPER & Hyper-Drop
	var optical_horizon: float = main_menu.space_core.get_optical_horizon()
	var jupiter_proj_far: Dictionary = main_menu.space_core.get_planet_optical_projection("jupiter", space_world.simulation_time_days)
	var earth_proj_near: Dictionary = main_menu.space_core.get_planet_optical_projection("earth", space_world.simulation_time_days)
	print("🔭 [Proiecție Optică Anti-Clipping] Orizont=%.0f | Camera near=%.2f far=%.0f | Jupiter (departe): dist_real=%.0f, pos_len=%.1f, scale=%.6f | Pământ (aproape): dist_real=%.0f, scale=%.2f" % [
		optical_horizon,
		cam_rig.cockpit_camera.near,
		cam_rig.cockpit_camera.far,
		float(jupiter_proj_far.get("true_distance", 0.0)),
		(jupiter_proj_far.get("position", Vector3.ZERO) as Vector3).length(),
		float(jupiter_proj_far.get("apparent_scale", 0.0)),
		float(earth_proj_near.get("true_distance", 0.0)),
		float(earth_proj_near.get("apparent_scale", 0.0))
	])

	# Testăm Hyper-Drop automat la 2.2 * raza_planetei (frânare gravitațională 1.5s + sunet de bas profund)
	main_menu.space_core.station_ship_near_planet("earth", space_world.simulation_time_days, 3.0)
	var earth_pos_vec: Vector3 = main_menu.space_core.get_relative_planet_position("earth", space_world.simulation_time_days)
	var dir_to_earth: Vector3 = earth_pos_vec.normalized()
	var hyper_step: Dictionary = main_menu.space_core.advance_ship_in_hyper(dir_to_earth * 250000.0, space_world.simulation_time_days)
	var drop_triggered_rust: bool = bool(hyper_step.get("intercepted", false))
	var drop_dist_after: float = float(hyper_step.get("drop_distance", 0.0))
	ship.trigger_hyper_drop("earth", "Pământul", 75000.0)
	print("⚡ [Mod HYPER & Hyper-Drop] Frânare gravitațională la 2.2*R declanșată: %s | Distanță oprire panoramică: %.0f u (2.2*R=165000 u) | Decelerare activă: %s (1.5s)" % [
		str(drop_triggered_rust),
		drop_dist_after,
		str(ship.hyper_drop_active)
	])
	print("=================================================================")

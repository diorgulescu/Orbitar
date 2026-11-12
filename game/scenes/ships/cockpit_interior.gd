# SPDX-License-Identifier: GPL-3.0-or-later
class_name CockpitInterior
extends Node3D

## Cabina 3D Interactivă a Pilotului (`cockpit_interior.tscn`) pentru Orbitar 3D:
## 1. Geometrie 3D curată cu vizibilitate panoramică mare (montanți subțiri) și diferențe vizuale
##    între cele 3 arhetipuri de nave:
##    - `sonda_lacusta`   — Cupolă de sticlă panoramică și montanți ultra-subțiri aurii
##    - `naveta_vulturul` — Bord ergonomic curbat cu fibră optică cyan
##    - `cargobot_stanca` — Cadru industrial robust cu traverse portocalii
## 2. Figurină-mascotă pe arc (`MascotSpringPivot`) care reacționează fizic la accelerație,
##    frânare, viraje și plutește în imponderabilitate când motoarele sunt oprite.
## 3. Cele 3 Zone de Instrumente Diegetice pe Bord:
##    - Central: Proiectorul Holografic 3D Mini-Orrery (`ShaderMaterial` holografic + săgeată țintă)
##    - Stânga: Navigator & Scanner Planetar via `SubViewport` (viteză, propulsie, progres scanare + card didactic)
##    - Dreapta: Comunicații Pilot via `SubViewport` (portretul pilotului din Hangar + replici contextuale)

const PilotPortraitBuilderScript = preload("res://scenes/ui/pilot_portrait_builder.gd")
const HOLO_ORRERY_SHADER_PATH := "res://assets/shaders/holo_orrery.gdshader"

const ORRERY_BODY_IDS: Array[String] = [
	"sun", "mercury", "venus", "earth", "mars",
	"jupiter", "saturn", "uranus", "neptune", "moon"
]

@export var mascot_spring_stiffness: float = 52.0
@export var mascot_spring_damping: float = 6.2
@export var orrery_max_radius: float = 0.135

var active_ship_variant_id: String = "naveta_vulturul"
var dashboard_power_level: float = 1.0 # 1.0 = Online, 0.0 = Mod Albastru de Veghe (Power-Down)
var standby_blue_mode: bool = false

# Starea fizică a figurinei-mascotă de pe bord (sistem masă-arc-amortizor)
var mascot_displacement: Vector3 = Vector3.ZERO
var mascot_velocity: Vector3 = Vector3.ZERO
var mascot_tilt_deg: Vector3 = Vector3.ZERO
var mascot_zero_g_float_offset: float = 0.0
var _mascot_float_time: float = 0.0

# Noduri 3D pentru variantele de navă
var _variant_lacusta_dome: Node3D = null
var _variant_vulturul_ergonomic: Node3D = null
var _variant_stanca_industrial: Node3D = null
var _frame_material: StandardMaterial3D = null
var _accent_trim_material: StandardMaterial3D = null
var _cockpit_light: OmniLight3D = null
var _dashboard_leds: Array[StandardMaterial3D] = []

# Noduri Mascotă pe Arc
var mascot_mount: Node3D = null
var mascot_spring_pivot: Node3D = null
var mascot_figure_head: Node3D = null

# Noduri Proiector Holografic Central (3D Mini-Orrery)
var holo_orrery_root: Node3D = null
var orrery_planet_meshes: Dictionary = {} # body_id -> MeshInstance3D
var orrery_planet_materials: Dictionary = {} # body_id -> ShaderMaterial
var target_direction_arrow: Node3D = null
var _arrow_shader_mat: ShaderMaterial = null
var _holo_shader: Shader = null

# Noduri Ecran Stâng (Navigator & Scanner via SubViewport)
@onready var left_subviewport: SubViewport = $LeftNavSubViewport
@onready var left_screen_mesh: MeshInstance3D = $DashboardRoot/LeftNavScreenQuad
var _left_screen_mat: StandardMaterial3D = null
var _left_bg_panel: ColorRect = null
var _nav_header_label: Label = null
var _nav_target_label: Label = null
var _nav_propulsion_label: Label = null
var _nav_speed_bar: ProgressBar = null
var _nav_scan_bar: ProgressBar = null
var _nav_scan_status_label: Label = null
var _nav_didactic_title_label: Label = null
var _nav_didactic_body_label: Label = null
var _last_displayed_card_body_id: String = ""

# Noduri Ecran Drept (Comunicații Pilot via SubViewport)
@onready var right_subviewport: SubViewport = $RightCommsSubViewport
@onready var right_screen_mesh: MeshInstance3D = $DashboardRoot/RightCommsScreenQuad
var _right_screen_mat: StandardMaterial3D = null
var _right_bg_panel: ColorRect = null
var _comms_header_label: Label = null
var _comms_portrait_rect: TextureRect = null
var _comms_pilot_name_label: Label = null
var _comms_pilot_role_label: Label = null
var _comms_speech_label: Label = null
var _comms_status_footer_label: Label = null
var current_pilot_id: String = "cadet_explorator"
var current_pilot_line_ro: String = ""

func _ready() -> void:
	if ResourceLoader.exists(HOLO_ORRERY_SHADER_PATH):
		_holo_shader = load(HOLO_ORRERY_SHADER_PATH) as Shader

	_build_3d_cockpit_structure()
	_build_mascot_on_spring()
	_build_central_holo_orrery()
	_build_left_navigator_subviewport_ui()
	_build_right_comms_subviewport_ui()
	_bind_subviewport_screen_materials()
	apply_ship_cockpit_variant(active_ship_variant_id)

func _exit_tree() -> void:
	_dashboard_leds.clear()
	orrery_planet_meshes.clear()
	orrery_planet_materials.clear()

## Adaptează geometria și stilul cabinei 3D în funcție de nava selectată în Hangar:
## - `sonda_lacusta`   — Cupolă de sticlă panoramică + montanți subțiri aurii
## - `naveta_vulturul` — Bord ergonomic curbat + fibră optică cyan
## - `cargobot_stanca` — Cadru industrial robust + traverse portocalii
func apply_ship_cockpit_variant(ship_id: String) -> void:
	active_ship_variant_id = ship_id if not ship_id.is_empty() else "naveta_vulturul"

	if _variant_lacusta_dome != null:
		_variant_lacusta_dome.visible = (active_ship_variant_id == "sonda_lacusta")
	if _variant_vulturul_ergonomic != null:
		_variant_vulturul_ergonomic.visible = (
			active_ship_variant_id != "sonda_lacusta" and active_ship_variant_id != "cargobot_stanca"
		)
	if _variant_stanca_industrial != null:
		_variant_stanca_industrial.visible = (active_ship_variant_id == "cargobot_stanca")

	if _accent_trim_material != null:
		match active_ship_variant_id:
			"sonda_lacusta":
				_accent_trim_material.albedo_color = Color("#fbbf24")
				_accent_trim_material.emission = Color("#fbbf24")
			"cargobot_stanca":
				_accent_trim_material.albedo_color = Color("#f97316")
				_accent_trim_material.emission = Color("#f97316")
			_:
				_accent_trim_material.albedo_color = Color("#00f0ff")
				_accent_trim_material.emission = Color("#00f0ff")

## Configurează portretul, numele de cadet și datele pilotului pe Ecranul Drept de Comunicații (`SubViewport`).
func set_pilot_profile(pilot_spec: Dictionary, cadet_name: String = "") -> void:
	current_pilot_id = str(pilot_spec.get("id", "cadet_explorator"))
	var name_ro: String = str(pilot_spec.get("name_ro", "Cadetul Explorator"))
	var role_ro: String = str(pilot_spec.get("role_ro", "Tânăr Explorator"))
	var badge: String = str(pilot_spec.get("badge_symbol", "★"))
	var greeting: String = str(pilot_spec.get("greeting_ro", "Gata de zbor!"))

	if _comms_portrait_rect != null:
		_comms_portrait_rect.texture = PilotPortraitBuilderScript.get_portrait_texture(current_pilot_id)
	if _comms_pilot_name_label != null:
		_comms_pilot_name_label.text = "%s %s" % [badge, name_ro]
	if _comms_pilot_role_label != null:
		var cadet_suffix := " | Echipaj: %s" % cadet_name if not cadet_name.is_empty() else ""
		_comms_pilot_role_label.text = role_ro + cadet_suffix

	set_pilot_comms_message(greeting)

## Afișează o replică nouă pe Ecranul Drept (`RightCommsSubViewport`).
func set_pilot_comms_message(message_ro: String) -> void:
	if message_ro.is_empty():
		return
	current_pilot_line_ro = message_ro
	if _comms_speech_label != null:
		_comms_speech_label.text = "„%s”" % message_ro

## Populează cardul didactic de pe Ecranul Stâng (`LeftNavSubViewport`) cu datele în română din Orbitar.
func show_didactic_card_on_left_screen(body_data: Dictionary) -> void:
	if body_data.is_empty():
		return
	var b_id: String = str(body_data.get("id", ""))
	_last_displayed_card_body_id = b_id
	var name_ro: String = str(body_data.get("name", ""))
	var cat_ro: String = str(body_data.get("category_label_ro", ""))
	var radius_km: float = float(body_data.get("radius_km", 0.0))
	var temp_c: float = float(body_data.get("mean_temp_c", 0.0))
	var didactic: Dictionary = body_data.get("didactic", {})
	var junior: Dictionary = didactic.get("junior", {})
	var summary_ro: String = str(junior.get("summary", body_data.get("subtitle", "")))
	var fun_fact_ro: String = str(junior.get("fun_fact", ""))

	if _nav_didactic_title_label != null:
		_nav_didactic_title_label.text = "📖 FIȘĂ: %s (%s) | %.0f km | %.0f °C" % [
			name_ro.to_upper(), cat_ro, radius_km, temp_c
		]
	if _nav_didactic_body_label != null:
		_nav_didactic_body_label.text = "%s\n💡 %s" % [summary_ro, fun_fact_ro]

## Actualizează la fiecare cadru:
## - Fizica pe arc a figurinei-mascotă (inerție la accelerare/frânare/viraje + plutire Zero-G când motoarele sunt oprite)
## - Proiectorul Holografic Central (3D Mini-Orrery + săgeata direcțională către planeta țintă)
## - Ecranul Stâng (`SubViewport` Navigator & Scanner) și Ecranul Drept (`SubViewport` Comunicații)
## - Starea de Power-Up / Power-Down (modul albastru de veghe când motoarele sunt oprite)
func update_cockpit_instruments(
	delta: float,
	space_core: OrbitarSpaceCore,
	sim_time_days: float,
	local_accel: Vector3,
	angular_vel: Vector3,
	speed_len: float,
	max_maneuver_speed: float,
	propulsion_tier: int,
	engines_online: bool,
	power_progress: float,
	nearest_body_id: String,
	nearest_body_name: String,
	nearest_altitude: float,
	is_scanning: bool,
	scan_progress: float
) -> void:
	if delta <= 0.0:
		return

	dashboard_power_level = clampf(power_progress, 0.0, 1.0)
	standby_blue_mode = (not engines_online or dashboard_power_level < 0.25)

	_update_mascot_spring_physics(delta, local_accel, angular_vel, engines_online)
	_update_central_holo_orrery(space_core, sim_time_days, nearest_body_id, dashboard_power_level)
	_update_left_navigator_screen(
		space_core,
		speed_len,
		max_maneuver_speed,
		propulsion_tier,
		engines_online,
		nearest_body_id,
		nearest_body_name,
		nearest_altitude,
		is_scanning,
		scan_progress
	)
	_update_power_and_standby_lighting(dashboard_power_level, standby_blue_mode)

func _update_mascot_spring_physics(
	delta: float,
	local_accel: Vector3,
	angular_vel: Vector3,
	engines_online: bool
) -> void:
	if mascot_spring_pivot == null:
		return

	# Forța externă aplicată pe arcul mascotei de accelerație, frânare și viraje
	var external_force := Vector3(
		clampf(-local_accel.x * 0.015 - angular_vel.y * 0.35, -0.45, 0.45),
		clampf(-local_accel.y * 0.012 + angular_vel.x * 0.22, -0.35, 0.35),
		clampf(-local_accel.z * 0.018, -0.50, 0.50)
	)

	var spring_force: Vector3 = -mascot_spring_stiffness * mascot_displacement - mascot_spring_damping * mascot_velocity
	var total_accel: Vector3 = spring_force + external_force * 18.0
	mascot_velocity += total_accel * delta
	mascot_displacement += mascot_velocity * delta
	mascot_displacement = mascot_displacement.clamp(Vector3(-0.08, -0.06, -0.08), Vector3(0.08, 0.06, 0.08))

	# Când motoarele sunt oprite, mascota plutește ușor în imponderabilitate pe arc
	if not engines_online:
		_mascot_float_time += delta * 2.2
		var target_float: float = 0.024 + 0.010 * sin(_mascot_float_time)
		mascot_zero_g_float_offset = lerpf(mascot_zero_g_float_offset, target_float, clampf(delta * 4.0, 0.0, 1.0))
	else:
		mascot_zero_g_float_offset = lerpf(mascot_zero_g_float_offset, 0.0, clampf(delta * 5.0, 0.0, 1.0))

	var float_wobble_deg: float = sin(_mascot_float_time * 1.3) * 8.5 if not engines_online else 0.0
	mascot_tilt_deg = Vector3(
		clampf(mascot_displacement.z * 420.0 + float_wobble_deg * 0.6, -38.0, 38.0),
		float_wobble_deg,
		clampf(-mascot_displacement.x * 420.0 + float_wobble_deg * 0.8, -38.0, 38.0)
	)

	mascot_spring_pivot.position = Vector3(
		mascot_displacement.x * 0.35,
		0.032 + mascot_zero_g_float_offset + mascot_displacement.y * 0.25,
		mascot_displacement.z * 0.35
	)
	mascot_spring_pivot.rotation_degrees = mascot_tilt_deg

func _update_central_holo_orrery(
	space_core: OrbitarSpaceCore,
	sim_time_days: float,
	target_body_id: String,
	power_level: float
) -> void:
	if space_core == null or holo_orrery_root == null:
		return

	var target_rel_pos := Vector3(0.0, 0.0, -1.0)

	for body_id in ORRERY_BODY_IDS:
		if not orrery_planet_meshes.has(body_id):
			continue
		var dir_world: Vector3 = space_core.get_true_planet_direction(body_id, sim_time_days)
		var true_dist: float = float(space_core.get_planet_distance_to_ship(body_id, sim_time_days))
		if body_id == target_body_id:
			target_rel_pos = dir_world

		var mapped_pos := Vector3.ZERO
		if true_dist > 1.0 and dir_world.length_squared() > 0.001:
			# Compresie logaritmică în volumul proiectorului holografic (pentru scara de zeci/sute de milioane u)
			var norm_r: float = clampf(log(1.0 + true_dist / 50000.0) / log(1.0 + 700000000.0 / 50000.0), 0.10, 1.0)
			mapped_pos = dir_world.normalized() * (norm_r * orrery_max_radius)
			mapped_pos.y = clampf(mapped_pos.y * 0.5, -0.04, 0.05)

		var sphere_inst: MeshInstance3D = orrery_planet_meshes[body_id]
		sphere_inst.position = Vector3(0.0, 0.055, 0.0) + mapped_pos
		var base_scale: float = float(sphere_inst.get_meta("base_scale", 1.0))
		var highlight_mult: float = 1.45 if body_id == target_body_id else 1.0
		sphere_inst.scale = Vector3.ONE * (base_scale * highlight_mult)

		if orrery_planet_materials.has(body_id):
			var smat: ShaderMaterial = orrery_planet_materials[body_id]
			smat.set_shader_parameter("power_level", power_level)

	# Orientăm săgeata direcțională holografică 3D către planeta țintă
	if target_direction_arrow != null and target_rel_pos.length_squared() > 0.0001:
		var dir_to_target: Vector3 = target_rel_pos.normalized()
		var up_vec: Vector3 = Vector3.UP if absf(dir_to_target.dot(Vector3.UP)) < 0.95 else Vector3.RIGHT
		target_direction_arrow.transform.basis = Basis.looking_at(dir_to_target, up_vec)
		if _arrow_shader_mat != null:
			_arrow_shader_mat.set_shader_parameter("power_level", power_level)

func _update_left_navigator_screen(
	space_core: OrbitarSpaceCore,
	speed_len: float,
	max_maneuver_speed: float,
	propulsion_tier: int,
	engines_online: bool,
	nearest_body_id: String,
	nearest_body_name: String,
	nearest_altitude: float,
	is_scanning: bool,
	scan_progress: float
) -> void:
	# 1.0 c = 2.500.000 u/s (500.000 u/s = 0.2 c, 3.750.000 u/s = 1.5 c, 20.000.000 u/s = 8.0 c)
	var speed_c: float = speed_len / 2500000.0
	var million_km: float = nearest_altitude / 750000.0
	var dist_au: float = million_km / 149.6

	if _nav_target_label != null:
		if propulsion_tier == 2 or nearest_altitude >= 750000.0:
			_nav_target_label.text = "🪐 ȚINTĂ: %s   |   DISTANȚĂ: %.1f mil. km (%.2f UA)" % [
				nearest_body_name.to_upper(),
				million_km,
				dist_au
			]
		else:
			var alt_km: float = nearest_altitude * (6371.0 / 75000.0)
			_nav_target_label.text = "🪐 ȚINTĂ: %s   |   ALTITUDINE: %.0f km (%.2f mil. km)" % [
				nearest_body_name.to_upper(),
				alt_km,
				million_km
			]

	var tier_label_ro := "MANEVRĂ"
	if not engines_online:
		tier_label_ro = "OPRIT (MOD VEGHE ALBASTRU)"
	elif propulsion_tier == 2:
		tier_label_ro = "HYPER INTERPLANETAR"
	elif propulsion_tier == 1:
		tier_label_ro = "IMPULS / BOOST"

	if _nav_propulsion_label != null:
		var motor_state := "ONLINE [E]" if engines_online else "VEGHE SILENȚIOASĂ [E]"
		if propulsion_tier == 2:
			_nav_propulsion_label.text = "⚡ Viteză HYPER: %.1f c | Treaptă: %s | Motoare: %s" % [
				speed_c, tier_label_ro, motor_state
			]
		else:
			_nav_propulsion_label.text = "🚀 Viteză: %.0f m/s | Treaptă: %s | Motoare: %s" % [
				speed_len, tier_label_ro, motor_state
			]

	if _nav_speed_bar != null:
		if propulsion_tier == 2:
			_nav_speed_bar.value = clampf((speed_c / 8.0) * 100.0, 0.0, 100.0)
		else:
			_nav_speed_bar.value = clampf((speed_len / maxf(max_maneuver_speed * 6.0, 3000.0)) * 100.0, 0.0, 100.0)

	var body_scanned: bool = space_core.is_body_scanned(nearest_body_id) if space_core != null else false
	if _nav_scan_bar != null:
		if is_scanning:
			_nav_scan_bar.value = clampf(scan_progress * 100.0, 0.0, 100.0)
		elif body_scanned:
			_nav_scan_bar.value = 100.0
		else:
			_nav_scan_bar.value = clampf(scan_progress * 100.0, 0.0, 100.0)

	if _nav_scan_status_label != null:
		if is_scanning:
			_nav_scan_status_label.text = "📡 SCANARE ȘTIINȚIFICĂ ÎN CURS: %d%%..." % int(round(scan_progress * 100.0))
			_nav_scan_status_label.modulate = Color("#00f0ff")
		elif body_scanned:
			_nav_scan_status_label.text = "✅ CORP CERESC SCANAT (100%) — FIȘĂ DIDACTICĂ ACTIVĂ:"
			_nav_scan_status_label.modulate = Color("#22c55e")
		else:
			_nav_scan_status_label.text = "🔍 Apropie-te și ține apăsat [F] / Trigger Stânga pentru Scanare"
			_nav_scan_status_label.modulate = Color("#fde68a")

	if body_scanned and space_core != null and _last_displayed_card_body_id != nearest_body_id:
		show_didactic_card_on_left_screen(space_core.get_celestial_body(nearest_body_id))

func _update_power_and_standby_lighting(power_level: float, is_standby: bool) -> void:
	# Când motoarele sunt oprite (Power-Down pe tasta E), ecranele trec în modul albastru de veghe
	var active_bg := Color(0.03, 0.09, 0.16, 1.0)
	var standby_bg := Color(0.02, 0.12, 0.34, 1.0)
	var blended_bg: Color = standby_bg.lerp(active_bg, power_level)

	if _left_bg_panel != null:
		_left_bg_panel.color = blended_bg
	if _right_bg_panel != null:
		_right_bg_panel.color = blended_bg

	if _comms_status_footer_label != null:
		_comms_status_footer_label.text = (
			"💤 MOD ALBASTRU DE VEGHE — PLUTIRE SILENȚIOASĂ [Apasă E pentru Power-Up]"
			if is_standby
			else "🟢 SISTEME DE BORD ACTIVE — [C] Comută Camera | [Alt/Click Dreapta] Free-Look | [E] Motoare"
		)
		_comms_status_footer_label.modulate = Color("#60a5fa") if is_standby else Color("#34d399")

	var led_count: int = _dashboard_leds.size()
	for i in range(led_count):
		var threshold: float = float(i + 1) / float(led_count)
		var seg_on: float = clampf((power_level - (threshold - 0.2)) * 5.0, 0.0, 1.0)
		var mat: StandardMaterial3D = _dashboard_leds[i]
		var standby_col := Color(0.08, 0.36, 0.88)
		var active_col := Color(0.0, 0.94, 1.0)
		mat.albedo_color = standby_col.lerp(active_col, seg_on)
		mat.emission = standby_col.lerp(active_col, seg_on)
		mat.emission_energy_multiplier = 0.25 + seg_on * 1.65

	if _cockpit_light != null:
		_cockpit_light.light_color = Color(0.14, 0.42, 0.95).lerp(Color(0.22, 0.85, 1.0), power_level)
		_cockpit_light.light_energy = 0.22 + power_level * 0.55

	for screen_mat in [_left_screen_mat, _right_screen_mat]:
		if screen_mat != null:
			screen_mat.albedo_color = Color(0.45, 0.72, 1.0).lerp(Color.WHITE, power_level)
			screen_mat.emission_energy_multiplier = 0.35 + power_level * 0.55

func _build_3d_cockpit_structure() -> void:
	var dash_root: Node3D = get_node_or_null("DashboardRoot") as Node3D
	if dash_root == null:
		dash_root = Node3D.new()
		dash_root.name = "DashboardRoot"
		add_child(dash_root)

	_frame_material = StandardMaterial3D.new()
	_frame_material.albedo_color = Color(0.11, 0.14, 0.20, 1.0)
	_frame_material.metallic = 0.68
	_frame_material.roughness = 0.34

	_accent_trim_material = StandardMaterial3D.new()
	_accent_trim_material.albedo_color = Color("#00f0ff")
	_accent_trim_material.emission_enabled = true
	_accent_trim_material.emission = Color("#00f0ff")
	_accent_trim_material.emission_energy_multiplier = 0.55

	# Consola centrală de bază
	var main_console := MeshInstance3D.new()
	main_console.name = "MainDashboardConsole"
	var c_box := BoxMesh.new()
	c_box.size = Vector3(1.24, 0.24, 0.46)
	c_box.material = _frame_material
	main_console.mesh = c_box
	main_console.position = Vector3(0.0, -0.07, -0.88)
	main_console.rotation_degrees = Vector3(14.0, 0.0, 0.0)
	dash_root.add_child(main_console)

	# Montanții frontali și laterali subțiri (nu blochează priveliștea planetelor)
	for side in [-1.0, 1.0]:
		var pillar_a := MeshInstance3D.new()
		pillar_a.name = "ThinCanopyPillarLeft" if side < 0.0 else "ThinCanopyPillarRight"
		var cyl := CylinderMesh.new()
		cyl.top_radius = 0.015
		cyl.bottom_radius = 0.021
		cyl.height = 0.86
		cyl.material = _frame_material
		pillar_a.mesh = cyl
		pillar_a.position = Vector3(side * 0.62, 0.35, -0.74)
		pillar_a.rotation_degrees = Vector3(30.0, 0.0, -side * 15.0)
		dash_root.add_child(pillar_a)

		var side_rail := MeshInstance3D.new()
		side_rail.name = "SideWindowRailLeft" if side < 0.0 else "SideWindowRailRight"
		var r_box := BoxMesh.new()
		r_box.size = Vector3(0.04, 0.09, 0.90)
		r_box.material = _frame_material
		side_rail.mesh = r_box
		side_rail.position = Vector3(side * 0.68, -0.02, -0.44)
		dash_root.add_child(side_rail)

	# Varianta 1: Sonda „Lăcusta” — Cupolă de sticlă sferică cu inel subțire superior
	_variant_lacusta_dome = Node3D.new()
	_variant_lacusta_dome.name = "VariantLacustaGlassDome"
	dash_root.add_child(_variant_lacusta_dome)
	var dome_ring := MeshInstance3D.new()
	var torus := TorusMesh.new()
	torus.inner_radius = 0.66
	torus.outer_radius = 0.68
	torus.material = _accent_trim_material
	dome_ring.mesh = torus
	dome_ring.position = Vector3(0.0, 0.58, -0.48)
	_variant_lacusta_dome.add_child(dome_ring)

	# Varianta 2: Naveta „Vulturul” — Bord ergonomic cu cozoroc aerodinamic
	_variant_vulturul_ergonomic = Node3D.new()
	_variant_vulturul_ergonomic.name = "VariantVulturulErgonomic"
	dash_root.add_child(_variant_vulturul_ergonomic)
	var glare_hood := MeshInstance3D.new()
	var hood_box := BoxMesh.new()
	hood_box.size = Vector3(1.14, 0.024, 0.22)
	hood_box.material = _accent_trim_material
	glare_hood.mesh = hood_box
	glare_hood.position = Vector3(0.0, 0.06, -0.82)
	glare_hood.rotation_degrees = Vector3(8.0, 0.0, 0.0)
	_variant_vulturul_ergonomic.add_child(glare_hood)

	# Varianta 3: Cargobotul „Stânca” — Cadru industrial superior și mânere laterale
	_variant_stanca_industrial = Node3D.new()
	_variant_stanca_industrial.name = "VariantStancaIndustrialFrame"
	dash_root.add_child(_variant_stanca_industrial)
	var top_beam := MeshInstance3D.new()
	var beam_box := BoxMesh.new()
	beam_box.size = Vector3(1.16, 0.045, 0.055)
	beam_box.material = _accent_trim_material
	top_beam.mesh = beam_box
	top_beam.position = Vector3(0.0, 0.68, -0.56)
	_variant_stanca_industrial.add_child(top_beam)

	# Cele 5 LED-uri progresive de Power-Up pe bord
	_dashboard_leds.clear()
	for i in range(5):
		var led := MeshInstance3D.new()
		led.name = "DashboardPowerLed_%d" % i
		var l_box := BoxMesh.new()
		l_box.size = Vector3(0.038, 0.012, 0.012)
		var l_mat := StandardMaterial3D.new()
		l_mat.albedo_color = Color(0.0, 0.94, 1.0)
		l_mat.emission_enabled = true
		l_mat.emission = Color(0.0, 0.94, 1.0)
		l_mat.emission_energy_multiplier = 1.6
		l_box.material = l_mat
		led.mesh = l_box
		led.position = Vector3((float(i) - 2.0) * 0.055, 0.042, -0.74)
		dash_root.add_child(led)
		_dashboard_leds.append(l_mat)

	_cockpit_light = OmniLight3D.new()
	_cockpit_light.name = "CockpitInteriorOmniLight"
	_cockpit_light.position = Vector3(0.0, 0.24, -0.64)
	_cockpit_light.light_color = Color(0.22, 0.85, 1.0)
	_cockpit_light.light_energy = 0.72
	_cockpit_light.omni_range = 2.0
	dash_root.add_child(_cockpit_light)

## Construiește figurina-mascotă prinsă pe un arc (`MascotMount` -> `MascotSpringPivot`) pe bord.
func _build_mascot_on_spring() -> void:
	mascot_mount = Node3D.new()
	mascot_mount.name = "MascotBaseMount"
	mascot_mount.position = Vector3(0.19, 0.045, -0.74)
	add_child(mascot_mount)

	# Baza și arcul spiralat
	var base_pedestal := MeshInstance3D.new()
	var ped_cyl := CylinderMesh.new()
	ped_cyl.top_radius = 0.022
	ped_cyl.bottom_radius = 0.026
	ped_cyl.height = 0.012
	ped_cyl.material = _frame_material
	base_pedestal.mesh = ped_cyl
	mascot_mount.add_child(base_pedestal)

	var spring_coil := MeshInstance3D.new()
	spring_coil.name = "SpringCoilMesh"
	var coil_cyl := CylinderMesh.new()
	coil_cyl.top_radius = 0.006
	coil_cyl.bottom_radius = 0.006
	coil_cyl.height = 0.032
	coil_cyl.material = _accent_trim_material
	spring_coil.mesh = coil_cyl
	spring_coil.position = Vector3(0.0, 0.018, 0.0)
	mascot_mount.add_child(spring_coil)

	# Pivotul mobil al figurinei-mascotă (mic astronaut cosmic)
	mascot_spring_pivot = Node3D.new()
	mascot_spring_pivot.name = "MascotSpringPivot"
	mascot_spring_pivot.position = Vector3(0.0, 0.032, 0.0)
	mascot_mount.add_child(mascot_spring_pivot)

	var suit_mat := StandardMaterial3D.new()
	suit_mat.albedo_color = Color("#f8fafc")
	suit_mat.roughness = 0.35

	var visor_mat := StandardMaterial3D.new()
	visor_mat.albedo_color = Color("#fbbf24")
	visor_mat.metallic = 0.85
	visor_mat.roughness = 0.12
	visor_mat.emission_enabled = true
	visor_mat.emission = Color("#38bdf8")
	visor_mat.emission_energy_multiplier = 0.45

	var body_mesh := MeshInstance3D.new()
	body_mesh.name = "MascotBodyMesh"
	var b_caps := CapsuleMesh.new()
	b_caps.radius = 0.016
	b_caps.height = 0.042
	b_caps.material = suit_mat
	body_mesh.mesh = b_caps
	body_mesh.position = Vector3(0.0, 0.018, 0.0)
	mascot_spring_pivot.add_child(body_mesh)

	mascot_figure_head = Node3D.new()
	mascot_figure_head.name = "MascotHelmetHead"
	mascot_figure_head.position = Vector3(0.0, 0.048, 0.0)
	mascot_spring_pivot.add_child(mascot_figure_head)

	var head_sphere := MeshInstance3D.new()
	var h_sph := SphereMesh.new()
	h_sph.radius = 0.020
	h_sph.height = 0.040
	h_sph.material = suit_mat
	head_sphere.mesh = h_sph
	mascot_figure_head.add_child(head_sphere)

	var visor_mesh := MeshInstance3D.new()
	var v_sph := SphereMesh.new()
	v_sph.radius = 0.015
	v_sph.height = 0.024
	v_sph.material = visor_mat
	visor_mesh.mesh = v_sph
	visor_mesh.position = Vector3(0.0, 0.002, 0.008)
	mascot_figure_head.add_child(visor_mesh)

## Construiește Proiectorul Holografic Central (`3D Mini-Orrery`) cu `ShaderMaterial` holografic
## și săgeată direcțională către planeta țintă.
func _build_central_holo_orrery() -> void:
	holo_orrery_root = Node3D.new()
	holo_orrery_root.name = "CentralHoloOrrery"
	holo_orrery_root.position = Vector3(0.0, 0.055, -0.74)
	add_child(holo_orrery_root)

	# Disc emițător pe consola centrală
	var emitter_disc := MeshInstance3D.new()
	emitter_disc.name = "HoloEmitterBaseDisc"
	var e_cyl := CylinderMesh.new()
	e_cyl.top_radius = 0.12
	e_cyl.bottom_radius = 0.14
	e_cyl.height = 0.014
	e_cyl.material = _frame_material
	emitter_disc.mesh = e_cyl
	holo_orrery_root.add_child(emitter_disc)

	var planet_colors := {
		"sun": Color("#fbbf24"),
		"mercury": Color("#94a3b8"),
		"venus": Color("#fde68a"),
		"earth": Color("#38bdf8"),
		"mars": Color("#ef4444"),
		"jupiter": Color("#f97316"),
		"saturn": Color("#eab308"),
		"uranus": Color("#22d3ee"),
		"neptune": Color("#3b82f6"),
		"moon": Color("#e2e8f0"),
	}
	var planet_radii := {
		"sun": 0.014,
		"mercury": 0.0045,
		"venus": 0.006,
		"earth": 0.0065,
		"mars": 0.005,
		"jupiter": 0.010,
		"saturn": 0.0095,
		"uranus": 0.0075,
		"neptune": 0.0075,
		"moon": 0.0035,
	}

	var unit_sphere := SphereMesh.new()
	unit_sphere.radius = 1.0
	unit_sphere.height = 2.0
	unit_sphere.radial_segments = 16
	unit_sphere.rings = 8

	for body_id in ORRERY_BODY_IDS:
		var p_inst := MeshInstance3D.new()
		p_inst.name = "HoloBody_" + body_id
		p_inst.mesh = unit_sphere
		var r_scale: float = float(planet_radii.get(body_id, 0.005))
		p_inst.scale = Vector3.ONE * r_scale
		p_inst.set_meta("base_scale", r_scale)

		var col: Color = planet_colors.get(body_id, Color("#00f0ff"))
		var smat := _create_holo_shader_material(col)
		p_inst.material_override = smat
		holo_orrery_root.add_child(p_inst)
		orrery_planet_meshes[body_id] = p_inst
		orrery_planet_materials[body_id] = smat

	# Săgeata direcțională 3D către planeta țintă în centrul proiectorului
	target_direction_arrow = Node3D.new()
	target_direction_arrow.name = "TargetDirectionArrow3D"
	target_direction_arrow.position = Vector3(0.0, 0.055, 0.0)
	holo_orrery_root.add_child(target_direction_arrow)

	var arrow_mesh := MeshInstance3D.new()
	arrow_mesh.name = "ArrowConeMesh"
	var cone := CylinderMesh.new()
	cone.top_radius = 0.0
	cone.bottom_radius = 0.010
	cone.height = 0.042
	arrow_mesh.mesh = cone
	# Orientăm vârful conului pe axa -Z (direcția look_at)
	arrow_mesh.rotation_degrees = Vector3(-90.0, 0.0, 0.0)
	arrow_mesh.position = Vector3(0.0, 0.0, -0.025)
	_arrow_shader_mat = _create_holo_shader_material(Color("#00ffaa"))
	arrow_mesh.material_override = _arrow_shader_mat
	target_direction_arrow.add_child(arrow_mesh)

func _create_holo_shader_material(col: Color) -> ShaderMaterial:
	var smat := ShaderMaterial.new()
	if _holo_shader != null:
		smat.shader = _holo_shader
		smat.set_shader_parameter("holo_color", Color(col.r, col.g, col.b, 0.85))
		smat.set_shader_parameter("power_level", 1.0)
	return smat

func _build_left_navigator_subviewport_ui() -> void:
	if left_subviewport == null:
		return

	var root := Control.new()
	root.name = "LeftNavRoot"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	left_subviewport.add_child(root)

	_left_bg_panel = ColorRect.new()
	_left_bg_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_left_bg_panel.color = Color(0.03, 0.09, 0.16, 1.0)
	root.add_child(_left_bg_panel)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 10)
	root.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 6)
	margin.add_child(vbox)

	_nav_header_label = Label.new()
	_nav_header_label.text = "🧭 NAVIGATOR & SCANNER PLANETAR"
	_nav_header_label.modulate = Color("#38bdf8")
	_nav_header_label.add_theme_font_size_override("font_size", 16)
	vbox.add_child(_nav_header_label)

	_nav_target_label = Label.new()
	_nav_target_label.text = "🪐 ȚINTĂ: PĂMÂNTUL   |   DISTANȚĂ: 10.0 u"
	_nav_target_label.modulate = Color("#fde68a")
	_nav_target_label.add_theme_font_size_override("font_size", 15)
	vbox.add_child(_nav_target_label)

	_nav_propulsion_label = Label.new()
	_nav_propulsion_label.text = "🚀 Viteză: 0.0 u/s | Treaptă: MANEVRĂ | Motoare: ONLINE [E]"
	_nav_propulsion_label.add_theme_font_size_override("font_size", 13)
	vbox.add_child(_nav_propulsion_label)

	_nav_speed_bar = ProgressBar.new()
	_nav_speed_bar.custom_minimum_size = Vector2(0, 16)
	_nav_speed_bar.max_value = 100.0
	_nav_speed_bar.value = 0.0
	vbox.add_child(_nav_speed_bar)

	_nav_scan_status_label = Label.new()
	_nav_scan_status_label.text = "🔍 Apropie-te de o planetă pentru Scanare Științifică"
	_nav_scan_status_label.add_theme_font_size_override("font_size", 13)
	vbox.add_child(_nav_scan_status_label)

	_nav_scan_bar = ProgressBar.new()
	_nav_scan_bar.custom_minimum_size = Vector2(0, 16)
	_nav_scan_bar.max_value = 100.0
	_nav_scan_bar.value = 0.0
	vbox.add_child(_nav_scan_bar)

	_nav_didactic_title_label = Label.new()
	_nav_didactic_title_label.text = "📖 FIȘĂ ȘTIINȚIFICĂ ORBITAR"
	_nav_didactic_title_label.modulate = Color("#00f0ff")
	_nav_didactic_title_label.add_theme_font_size_override("font_size", 14)
	vbox.add_child(_nav_didactic_title_label)

	_nav_didactic_body_label = Label.new()
	_nav_didactic_body_label.text = "Scanează corpul ceresc apropiat pentru a afișa datele didactice în limba română direct pe bord!"
	_nav_didactic_body_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_nav_didactic_body_label.add_theme_font_size_override("font_size", 12)
	vbox.add_child(_nav_didactic_body_label)

func _build_right_comms_subviewport_ui() -> void:
	if right_subviewport == null:
		return

	var root := Control.new()
	root.name = "RightCommsRoot"
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	right_subviewport.add_child(root)

	_right_bg_panel = ColorRect.new()
	_right_bg_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_right_bg_panel.color = Color(0.03, 0.09, 0.16, 1.0)
	root.add_child(_right_bg_panel)

	var margin := MarginContainer.new()
	margin.set_anchors_preset(Control.PRESET_FULL_RECT)
	margin.add_theme_constant_override("margin_left", 14)
	margin.add_theme_constant_override("margin_top", 10)
	margin.add_theme_constant_override("margin_right", 14)
	margin.add_theme_constant_override("margin_bottom", 10)
	root.add_child(margin)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 8)
	margin.add_child(vbox)

	_comms_header_label = Label.new()
	_comms_header_label.text = "📻 COMUNICAȚII PILOT — STAȚIA DE BORD"
	_comms_header_label.modulate = Color("#38bdf8")
	_comms_header_label.add_theme_font_size_override("font_size", 16)
	vbox.add_child(_comms_header_label)

	var hbox := HBoxContainer.new()
	hbox.add_theme_constant_override("separation", 12)
	vbox.add_child(hbox)

	_comms_portrait_rect = TextureRect.new()
	_comms_portrait_rect.custom_minimum_size = Vector2(92, 92)
	_comms_portrait_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_comms_portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	_comms_portrait_rect.texture = PilotPortraitBuilderScript.get_portrait_texture(current_pilot_id)
	hbox.add_child(_comms_portrait_rect)

	var bio_vbox := VBoxContainer.new()
	bio_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hbox.add_child(bio_vbox)

	_comms_pilot_name_label = Label.new()
	_comms_pilot_name_label.text = "★ Cadetul Explorator"
	_comms_pilot_name_label.modulate = Color("#fde68a")
	_comms_pilot_name_label.add_theme_font_size_override("font_size", 16)
	bio_vbox.add_child(_comms_pilot_name_label)

	_comms_pilot_role_label = Label.new()
	_comms_pilot_role_label.text = "Tânăr Explorator"
	_comms_pilot_role_label.modulate = Color("#38bdf8")
	_comms_pilot_role_label.add_theme_font_size_override("font_size", 13)
	bio_vbox.add_child(_comms_pilot_role_label)

	_comms_speech_label = Label.new()
	_comms_speech_label.text = "„Sistemele de bord sunt gata! Să explorăm Sistemul Solar!”"
	_comms_speech_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_comms_speech_label.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_comms_speech_label.add_theme_font_size_override("font_size", 14)
	vbox.add_child(_comms_speech_label)

	_comms_status_footer_label = Label.new()
	_comms_status_footer_label.text = "🟢 SISTEME DE BORD ACTIVE"
	_comms_status_footer_label.modulate = Color("#34d399")
	_comms_status_footer_label.add_theme_font_size_override("font_size", 12)
	vbox.add_child(_comms_status_footer_label)

func _bind_subviewport_screen_materials() -> void:
	var is_headless: bool = (DisplayServer.get_name() == "headless")

	_left_screen_mat = StandardMaterial3D.new()
	_left_screen_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_left_screen_mat.albedo_color = Color.WHITE
	_left_screen_mat.emission_enabled = true
	_left_screen_mat.emission = Color(0.06, 0.22, 0.38)
	_left_screen_mat.emission_energy_multiplier = 0.85

	_right_screen_mat = StandardMaterial3D.new()
	_right_screen_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_right_screen_mat.albedo_color = Color.WHITE
	_right_screen_mat.emission_enabled = true
	_right_screen_mat.emission = Color(0.06, 0.22, 0.38)
	_right_screen_mat.emission_energy_multiplier = 0.85

	if not is_headless:
		if left_subviewport != null:
			left_subviewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
			var l_tex: ViewportTexture = left_subviewport.get_texture()
			_left_screen_mat.albedo_texture = l_tex
			_left_screen_mat.emission_texture = l_tex
		if right_subviewport != null:
			right_subviewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
			var r_tex: ViewportTexture = right_subviewport.get_texture()
			_right_screen_mat.albedo_texture = r_tex
			_right_screen_mat.emission_texture = r_tex
	else:
		if left_subviewport != null:
			left_subviewport.render_target_update_mode = SubViewport.UPDATE_DISABLED
		if right_subviewport != null:
			right_subviewport.render_target_update_mode = SubViewport.UPDATE_DISABLED

	if left_screen_mesh != null:
		left_screen_mesh.material_override = _left_screen_mat
	if right_screen_mesh != null:
		right_screen_mesh.material_override = _right_screen_mat

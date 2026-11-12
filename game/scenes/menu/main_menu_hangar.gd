# SPDX-License-Identifier: GPL-3.0-or-later
class_name MainMenuHangar
extends Node3D

## Meniul Principal SF în Hangarul Orbital 3D (`main_menu_hangar.tscn`) pentru Orbitar 3D:
## 1. Fundal 3D Live:
##    - Platformă circulară cu lumini de ghidaj, structură metalică și fereastră panoramică uriașă
##      prin care se vede Pământul rotindu-se lent în spațiu.
##    - Schimbarea rachetei declanșează o animație scurtă de rotație/ridicare (`Tween`) + sunet hidraulic.
##    - Cameră de prezentare (`MenuCamera`) care orbitează lent și comută pe unghiuri dedicate
##      (Prezentare Generală, Inspecție Rachetă, Detaliu Cabină, Secvență Decolare).
## 2. Interfață SF (`res://assets/ui/sci_fi_theme.tres`) cu sunete la hover și click:
##    - Ecran Inițial: `EXPEDIȚIE NOUĂ`, `CONTINUĂ ZBORUL`, `SETĂRI`, `IEȘIRE`.
##    - Selector Personaj (Stânga): 3 piloți + câmp `LineEdit` pentru Numele de Cadet.
##    - Selector Rachete (Dreapta): navigare `<` / `>`, 3 bare grafice (`ProgressBar` pentru Viteză,
##      Manevrabilitate, Rază Scanner) și 3 butoane de culoare pentru fuzelaj.
##    - `DECOLARE ÎN SPAȚIU`: salvează profilul în `OrbitarSpaceCore` (Rust), aprinde propulsoarele
##      pe platformă cu sunet de Power-Up și încarcă `space_world.tscn`.

const ShipModelBuilderScript = preload("res://scenes/ships/ship_model_builder.gd")
const PilotPortraitBuilderScript = preload("res://scenes/ui/pilot_portrait_builder.gd")
const SCI_FI_THEME_PATH := "res://assets/ui/sci_fi_theme.tres"
const SPACE_WORLD_SCENE_PATH := "res://scenes/solar_system/space_world.tscn"
const ATMOSPHERE_SHADER_PATH := "res://assets/shaders/atmosphere_fresnel.gdshader"

enum CameraFocus {
	OVERVIEW_ORBIT = 0,
	SHIP_INSPECT = 1,
	COCKPIT_INSPECT = 2,
	LAUNCH_IGNITION = 3,
}

const HULL_COLOR_OPTIONS := [
	{"hex": "#38bdf8", "label_ro": "Albastru Cosmic"},
	{"hex": "#fbbf24", "label_ro": "Auriu Solar"},
	{"hex": "#10b981", "label_ro": "Smarald Galactic"},
]

@export var earth_rotation_speed: float = 0.08
@export var platform_idle_spin_speed: float = 0.42
@export var camera_orbit_speed: float = 0.18

@onready var space_core: OrbitarSpaceCore = $OrbitarSpaceCore
@onready var hangar_env: Node3D = $HangarEnvironment3D
@onready var turntable_platform: Node3D = $HangarEnvironment3D/TurntablePlatform
@onready var ship_preview_pivot: Node3D = $HangarEnvironment3D/TurntablePlatform/ShipPreviewPivot
@onready var earth_vista_pivot: Node3D = $HangarEnvironment3D/PanoramicWindowVista/EarthVistaPivot
@onready var menu_camera_rig: Node3D = $HangarEnvironment3D/MenuCameraRig
@onready var menu_camera: Camera3D = $HangarEnvironment3D/MenuCameraRig/MenuCamera
@onready var ui_layer: CanvasLayer = $MenuUI

var pilots_list: Array = []
var ships_list: Array = []
var selected_pilot_idx: int = 0
var selected_ship_idx: int = 1
var selected_color_hex: String = "#38bdf8"
var cadet_name_input_text: String = "Cadetul Cosmin"

var current_camera_focus: CameraFocus = CameraFocus.OVERVIEW_ORBIT
var _camera_orbit_angle: float = 0.35
var _camera_tween: Tween = null
var _platform_tween: Tween = null
var _launch_tween: Tween = null
var is_launching: bool = false

var _active_ship_model: Node3D = null
var _earth_sphere_mesh: MeshInstance3D = null
var _launch_pad_light: OmniLight3D = null

# Playere audio procedurale pentru meniu (hover, click, hidraulic, power-up)
var _is_headless: bool = false
var _ui_hover_player: AudioStreamPlayer = null
var _ui_click_player: AudioStreamPlayer = null
var _hydraulic_player: AudioStreamPlayer = null
var _launch_powerup_player: AudioStreamPlayer = null
var hydraulic_play_count: int = 0
var powerup_play_count: int = 0

# Sub-ecrane UI
var _theme_root: Control = null
var _initial_screen_panel: Control = null
var _selector_screen_root: Control = null
var _settings_modal_panel: PanelContainer = null

# Controale Ecran Inițial
var _continue_button: Button = null
var _saved_profile_hint_label: Label = null

# Controale Panou Stâng (Selector Personaj & Nume Cadet)
var _cadet_name_edit: LineEdit = null
var _pilot_portrait_rect: TextureRect = null
var _pilot_name_label: Label = null
var _pilot_role_label: Label = null
var _pilot_desc_label: Label = null
var _pilot_buttons: Array[Button] = []

# Controale Panou Drept (Selector Rachetă `<` / `>`, Bare ProgressBar, Culori)
var _ship_title_label: Label = null
var _ship_propulsion_label: Label = null
var _ship_desc_label: Label = null
var _speed_bar: ProgressBar = null
var _agility_bar: ProgressBar = null
var _scanner_bar: ProgressBar = null
var _color_buttons: Array[Button] = []
var _launch_button: Button = null

# Controale Panou Setări
var _quality_toggle_btn: Button = null
var _camera_default_btn: Button = null
var _volume_slider: HSlider = null
var _volume_value_label: Label = null

func _ready() -> void:
	_is_headless = (DisplayServer.get_name() == "headless")
	if space_core == null:
		push_error("[MainMenuHangar] OrbitarSpaceCore nu este prezent în scenă!")
		return

	pilots_list = space_core.get_available_pilots()
	ships_list = space_core.get_hangar_ships()

	_sync_from_saved_profile()
	_build_3d_hangar_details_and_earth_vista()
	_setup_procedural_menu_audio()
	_build_sci_fi_menu_ui()
	_refresh_pilot_ui()
	_refresh_ship_ui_and_3d_model(false)
	_refresh_settings_ui()

	print("🛸 [MainMenuHangar] Meniul Principal SF este pregătit: Cadet=%s | Pilot=%s | Rachetă=%s | Culoare=%s" % [
		cadet_name_input_text,
		space_core.get_selected_pilot(),
		space_core.get_selected_ship(),
		selected_color_hex
	])

func _exit_tree() -> void:
	for tw in [_camera_tween, _platform_tween, _launch_tween]:
		if tw != null and tw.is_valid():
			tw.kill()
	_pilot_buttons.clear()
	_color_buttons.clear()
	for p in [_ui_hover_player, _ui_click_player, _hydraulic_player, _launch_powerup_player]:
		if p != null:
			p.stop()
			p.stream = null

func _process(delta: float) -> void:
	if earth_vista_pivot != null:
		earth_vista_pivot.rotate_y(earth_rotation_speed * delta)

	if ship_preview_pivot != null and not is_launching:
		ship_preview_pivot.rotate_y(platform_idle_spin_speed * delta)

	# Camera de prezentare orbitează lent în modul OVERVIEW_ORBIT
	if current_camera_focus == CameraFocus.OVERVIEW_ORBIT and menu_camera_rig != null and not is_launching:
		_camera_orbit_angle = wrapf(_camera_orbit_angle + camera_orbit_speed * delta, -PI, PI)
		menu_camera_rig.rotation.y = sin(_camera_orbit_angle) * 0.32

func _sync_from_saved_profile() -> void:
	cadet_name_input_text = space_core.get_cadet_name()
	selected_color_hex = space_core.get_ship_color_hex()

	var saved_pilot: String = space_core.get_selected_pilot()
	for i in range(pilots_list.size()):
		if str(pilots_list[i].get("id", "")) == saved_pilot:
			selected_pilot_idx = i
			break

	var saved_ship: String = space_core.get_selected_ship()
	for i in range(ships_list.size()):
		if str(ships_list[i].get("id", "")) == saved_ship:
			selected_ship_idx = i
			break

## Deschide selectorul de Personaj și Rachetă (`EXPEDIȚIE NOUĂ`).
func open_expedition_selector() -> void:
	play_ui_click_sfx()
	if _initial_screen_panel != null:
		_initial_screen_panel.visible = false
	if _settings_modal_panel != null:
		_settings_modal_panel.visible = false
	if _selector_screen_root != null:
		_selector_screen_root.visible = true
	set_camera_focus(CameraFocus.SHIP_INSPECT)

## Revine la ecranul inițial cu titlul ORBITAR.
func show_initial_screen() -> void:
	play_ui_click_sfx()
	if _selector_screen_root != null:
		_selector_screen_root.visible = false
	if _settings_modal_panel != null:
		_settings_modal_panel.visible = false
	if _initial_screen_panel != null:
		_initial_screen_panel.visible = true
	set_camera_focus(CameraFocus.OVERVIEW_ORBIT)

## Continuă zborul direct cu profilul salvat în `OrbitarSpaceCore` (`CONTINUĂ ZBORUL`).
func continue_saved_flight(change_scene: bool = true) -> bool:
	play_ui_click_sfx()
	if not space_core.has_saved_profile():
		return false
	if change_scene and get_tree() != null:
		get_tree().change_scene_to_file(SPACE_WORLD_SCENE_PATH)
	return true

## Deschide / închide panoul de `SETĂRI` (Calitate Eco 2K / HD 4K, Volum Audio, Cameră Implicită).
func toggle_settings_panel(open: bool = true) -> void:
	play_ui_click_sfx()
	if _settings_modal_panel != null:
		_settings_modal_panel.visible = open
	_refresh_settings_ui()

func quit_game() -> void:
	play_ui_click_sfx()
	if get_tree() != null:
		get_tree().quit()

## Mută lin `MenuCamera` pe un unghi dedicat (Overview, Inspecție Rachetă, Detaliu Cabină, Lansare).
func set_camera_focus(focus: CameraFocus, animate: bool = true) -> void:
	current_camera_focus = focus
	if menu_camera == null or menu_camera_rig == null:
		return

	var target_rig_rot := Vector3.ZERO
	var target_cam_pos := Vector3(0.0, 2.15, 5.4)
	var target_cam_rot_deg := Vector3(-13.5, 0.0, 0.0)
	var target_fov: float = 54.0

	match focus:
		CameraFocus.OVERVIEW_ORBIT:
			target_cam_pos = Vector3(0.0, 2.25, 5.6)
			target_cam_rot_deg = Vector3(-14.0, 0.0, 0.0)
			target_fov = 55.0
		CameraFocus.SHIP_INSPECT:
			target_rig_rot = Vector3(0.0, 0.22, 0.0)
			target_cam_pos = Vector3(0.0, 1.65, 4.35)
			target_cam_rot_deg = Vector3(-11.0, 0.0, 0.0)
			target_fov = 50.0
		CameraFocus.COCKPIT_INSPECT:
			target_rig_rot = Vector3(0.0, -0.35, 0.0)
			target_cam_pos = Vector3(0.0, 1.32, 2.45)
			target_cam_rot_deg = Vector3(-8.0, 0.0, 0.0)
			target_fov = 44.0
		CameraFocus.LAUNCH_IGNITION:
			target_rig_rot = Vector3(0.0, 0.0, 0.0)
			target_cam_pos = Vector3(0.0, 1.25, 4.9)
			target_cam_rot_deg = Vector3(-6.0, 0.0, 0.0)
			target_fov = 62.0

	if _camera_tween != null and _camera_tween.is_valid():
		_camera_tween.kill()

	if not animate or not is_inside_tree():
		menu_camera_rig.rotation = target_rig_rot
		menu_camera.position = target_cam_pos
		menu_camera.rotation_degrees = target_cam_rot_deg
		menu_camera.fov = target_fov
		return

	_camera_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_camera_tween.tween_property(menu_camera_rig, "rotation", target_rig_rot, 0.45)
	_camera_tween.tween_property(menu_camera, "position", target_cam_pos, 0.45)
	_camera_tween.tween_property(menu_camera, "rotation_degrees", target_cam_rot_deg, 0.45)
	_camera_tween.tween_property(menu_camera, "fov", target_fov, 0.45)

## Selectează personajul (pilotul) după index sau ID și focalizează scurt spre cabină.
func select_pilot_by_index(index: int) -> void:
	if index < 0 or index >= pilots_list.size():
		return
	play_ui_click_sfx()
	selected_pilot_idx = index
	var p: Dictionary = pilots_list[selected_pilot_idx]
	space_core.set_selected_pilot(str(p.get("id", "")), str(p.get("name_ro", "")))
	_refresh_pilot_ui()

func select_pilot_by_id(pilot_id: String) -> bool:
	for i in range(pilots_list.size()):
		if str(pilots_list[i].get("id", "")) == pilot_id:
			select_pilot_by_index(i)
			return true
	return false

func set_cadet_name_text(new_name: String) -> void:
	var clean: String = new_name.strip_edges()
	if not clean.is_empty():
		cadet_name_input_text = clean
		if _cadet_name_edit != null and _cadet_name_edit.text != clean:
			_cadet_name_edit.text = clean
		space_core.set_cadet_name(clean)

## Navighează cu `<` (-1) sau `>` (+1) între cele 3 rachete de pe platforma centrală.
func cycle_ship(step: int) -> void:
	if ships_list.is_empty():
		return
	var next_idx: int = posmod(selected_ship_idx + step, ships_list.size())
	select_ship_by_index(next_idx, true)

func select_ship_by_index(index: int, animate_platform: bool = true) -> void:
	if index < 0 or index >= ships_list.size():
		return
	selected_ship_idx = index
	var s: Dictionary = ships_list[selected_ship_idx]
	space_core.set_selected_ship(str(s.get("id", "")))
	_refresh_ship_ui_and_3d_model(animate_platform)

func select_ship_by_id(ship_id: String, animate_platform: bool = true) -> bool:
	for i in range(ships_list.size()):
		if str(ships_list[i].get("id", "")) == ship_id:
			select_ship_by_index(i, animate_platform)
			return true
	return false

## Personalizează culoarea fuzelajului rachetei selectate.
func select_hull_color(color_hex: String) -> void:
	play_ui_click_sfx()
	selected_color_hex = color_hex
	space_core.set_ship_color_hex(selected_color_hex)
	_refresh_ship_ui_and_3d_model(false)

## Salvează numele cadetului, personajul, racheta și culoarea în `OrbitarSpaceCore` (Rust),
## aprinde propulsoarele pe platformă cu sunet de Power-Up și face tranziția către `space_world.tscn`.
func launch_into_space(change_scene: bool = true) -> bool:
	if space_core == null:
		return false

	if _cadet_name_edit != null and not _cadet_name_edit.text.strip_edges().is_empty():
		cadet_name_input_text = _cadet_name_edit.text.strip_edges()

	space_core.set_cadet_name(cadet_name_input_text)
	space_core.set_ship_color_hex(selected_color_hex)

	if selected_pilot_idx >= 0 and selected_pilot_idx < pilots_list.size():
		var p: Dictionary = pilots_list[selected_pilot_idx]
		space_core.set_selected_pilot(str(p.get("id", "")), str(p.get("name_ro", "")))

	if selected_ship_idx >= 0 and selected_ship_idx < ships_list.size():
		var s: Dictionary = ships_list[selected_ship_idx]
		space_core.set_selected_ship(str(s.get("id", "")))

	var saved: bool = space_core.save_player_profile()
	is_launching = true
	play_launch_powerup_sfx()
	set_camera_focus(CameraFocus.LAUNCH_IGNITION, change_scene)

	# Aprindem conul de propulsie 3D și lumina rampei de lansare
	if _active_ship_model != null:
		var plume := _active_ship_model.get_node_or_null("EngineLaunchPlume") as Node3D
		if plume != null:
			plume.visible = true
	if _launch_pad_light != null:
		_launch_pad_light.light_color = Color(0.15, 0.92, 1.0)
		_launch_pad_light.light_energy = 4.2

	print("🚀 [MainMenuHangar] DECOLARE ÎN SPAȚIU! Cadet=%s | Pilot=%s | Rachetă=%s | Culoare=%s | Salvat=%s" % [
		space_core.get_cadet_name(),
		space_core.get_selected_pilot_name(),
		space_core.get_selected_ship(),
		space_core.get_ship_color_hex(),
		str(saved)
	])

	if change_scene and is_inside_tree() and get_tree() != null:
		if _launch_tween != null and _launch_tween.is_valid():
			_launch_tween.kill()
		_launch_tween = create_tween().set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
		if ship_preview_pivot != null:
			_launch_tween.tween_property(ship_preview_pivot, "position:y", 1.35, 0.55)
		_launch_tween.finished.connect(_transition_to_space_world)

	return saved

func _transition_to_space_world() -> void:
	if get_tree() != null:
		get_tree().change_scene_to_file(SPACE_WORLD_SCENE_PATH)

func _refresh_pilot_ui() -> void:
	if pilots_list.is_empty():
		return
	var p: Dictionary = pilots_list[selected_pilot_idx]
	var p_id: String = str(p.get("id", "cadet_explorator"))

	if _pilot_portrait_rect != null:
		_pilot_portrait_rect.texture = PilotPortraitBuilderScript.get_portrait_texture(p_id)
	if _pilot_name_label != null:
		_pilot_name_label.text = "%s %s" % [str(p.get("badge_symbol", "★")), str(p.get("name_ro", ""))]
	if _pilot_role_label != null:
		_pilot_role_label.text = str(p.get("role_ro", ""))
	if _pilot_desc_label != null:
		_pilot_desc_label.text = "%s\n„%s”" % [
			str(p.get("personality_ro", "")),
			str(p.get("greeting_ro", ""))
		]

	for i in range(_pilot_buttons.size()):
		_pilot_buttons[i].button_pressed = (i == selected_pilot_idx)

func _refresh_ship_ui_and_3d_model(animate_platform: bool) -> void:
	if ships_list.is_empty():
		return
	var s: Dictionary = ships_list[selected_ship_idx]
	var ship_id: String = str(s.get("id", "naveta_vulturul"))

	if ship_preview_pivot != null:
		if _active_ship_model != null:
			ship_preview_pivot.remove_child(_active_ship_model)
			_active_ship_model.free()
		_active_ship_model = ShipModelBuilderScript.build_ship_visual(ship_id, selected_color_hex)
		ship_preview_pivot.add_child(_active_ship_model)

	# Animație scurtă de rotație/ridicare (`Tween`) pe platformă + sunet mecanic hidraulic
	if animate_platform:
		play_hydraulic_lift_sfx()
		if turntable_platform != null and is_inside_tree():
			if _platform_tween != null and _platform_tween.is_valid():
				_platform_tween.kill()
			turntable_platform.position.y = -0.28
			var start_rot_y: float = turntable_platform.rotation.y
			_platform_tween = create_tween().set_parallel(true).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
			_platform_tween.tween_property(turntable_platform, "position:y", 0.0, 0.38)
			_platform_tween.tween_property(turntable_platform, "rotation:y", start_rot_y + PI * 0.5, 0.38)

	if _ship_title_label != null:
		_ship_title_label.text = "🛸 %s (%d / %d)" % [
			str(s.get("name_ro", "")),
			selected_ship_idx + 1,
			ships_list.size()
		]
	if _ship_propulsion_label != null:
		_ship_propulsion_label.text = str(s.get("propulsion_ro", ""))
	if _ship_desc_label != null:
		_ship_desc_label.text = str(s.get("didactic_summary_ro", ""))

	# Cele 3 bare grafice SF (`ProgressBar`) preluate din statisticile Rust
	var speed_rating: int = int(s.get("rating_warp", 3))
	var agility_rating: int = int(s.get("rating_agility", 3))
	var scanner_rating: int = int(s.get("rating_scanner", 3))

	if _speed_bar != null:
		_speed_bar.value = clampf(float(speed_rating) * 20.0, 20.0, 100.0)
	if _agility_bar != null:
		_agility_bar.value = clampf(float(agility_rating) * 20.0, 20.0, 100.0)
	if _scanner_bar != null:
		_scanner_bar.value = clampf(float(scanner_rating) * 20.0, 20.0, 100.0)

	for i in range(_color_buttons.size()):
		var c_hex: String = HULL_COLOR_OPTIONS[i]["hex"]
		_color_buttons[i].button_pressed = (c_hex.to_lower() == selected_color_hex.to_lower())

func _refresh_settings_ui() -> void:
	if space_core == null:
		return
	var q_mode: String = space_core.get_quality_mode()
	if _quality_toggle_btn != null:
		_quality_toggle_btn.text = (
			"🌟 Texturi: MOD HD (4K Maxim)"
			if q_mode == "hd"
			else "🌿 Texturi: MOD ECO (2K VRAM Redus)"
		)
	var def_cam: String = space_core.get_default_camera_mode()
	if _camera_default_btn != null:
		_camera_default_btn.text = (
			"🎥 Cameră Implicită: CABINĂ 3D (Cockpit 1st-Person)"
			if def_cam == "cockpit"
			else "🛸 Cameră Implicită: EXTERIOR (Third-Person Chase)"
		)
	var vol: float = space_core.get_audio_volume()
	if _volume_slider != null:
		_volume_slider.set_value_no_signal(vol * 100.0)
	if _volume_value_label != null:
		_volume_value_label.text = "🔊 Volum Audio: %d%%" % int(round(vol * 100.0))

func _on_toggle_quality_pressed() -> void:
	play_ui_click_sfx()
	var next_mode := "eco" if space_core.get_quality_mode() == "hd" else "hd"
	space_core.set_quality_mode(next_mode)
	_refresh_settings_ui()

func _on_toggle_default_camera_pressed() -> void:
	play_ui_click_sfx()
	var next_cam := "cockpit" if space_core.get_default_camera_mode() == "chase" else "chase"
	space_core.set_default_camera_mode(next_cam)
	_refresh_settings_ui()

func _on_volume_slider_changed(val: float) -> void:
	var norm_vol: float = clampf(val / 100.0, 0.0, 1.0)
	space_core.set_audio_volume(norm_vol)
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(norm_vol, 0.02)))
	if _volume_value_label != null:
		_volume_value_label.text = "🔊 Volum Audio: %d%%" % int(round(val))

# =========================================================================
# Construirea Detaliilor 3D ale Hangarului & Fereastra Panoramică cu Pământul
# =========================================================================

func _build_3d_hangar_details_and_earth_vista() -> void:
	if hangar_env == null:
		return

	# 1. Cele 8 lumini de ghidaj pe marginea platformei circulare de lansare
	if turntable_platform != null:
		var guide_mat := StandardMaterial3D.new()
		guide_mat.albedo_color = Color("#00f0ff")
		guide_mat.emission_enabled = true
		guide_mat.emission = Color("#00f0ff")
		guide_mat.emission_energy_multiplier = 2.2

		for i in range(8):
			var angle: float = float(i) * TAU / 8.0
			var guide_lamp := MeshInstance3D.new()
			guide_lamp.name = "PlatformGuideLight_%d" % i
			var l_box := BoxMesh.new()
			l_box.size = Vector3(0.26, 0.06, 0.12)
			l_box.material = guide_mat
			guide_lamp.mesh = l_box
			guide_lamp.position = Vector3(cos(angle) * 2.55, 0.14, sin(angle) * 2.55)
			guide_lamp.rotation.y = -angle
			turntable_platform.add_child(guide_lamp)

		_launch_pad_light = OmniLight3D.new()
		_launch_pad_light.name = "LaunchPadCenterLight"
		_launch_pad_light.position = Vector3(0.0, 0.45, 0.0)
		_launch_pad_light.light_color = Color(0.18, 0.78, 1.0)
		_launch_pad_light.light_energy = 1.6
		_launch_pad_light.omni_range = 6.5
		turntable_platform.add_child(_launch_pad_light)

	# 2. Arcadele metalice ale Hangarului și cadrul ferestrei panoramice uriașe
	var steel_mat := StandardMaterial3D.new()
	steel_mat.albedo_color = Color(0.12, 0.16, 0.24, 1.0)
	steel_mat.metallic = 0.72
	steel_mat.roughness = 0.32

	var neon_mat := StandardMaterial3D.new()
	neon_mat.albedo_color = Color(0.0, 0.88, 1.0, 1.0)
	neon_mat.emission_enabled = true
	neon_mat.emission = Color(0.0, 0.88, 1.0, 1.0)
	neon_mat.emission_energy_multiplier = 1.4

	for side_x in [-6.8, 6.8]:
		var column := MeshInstance3D.new()
		var col_box := BoxMesh.new()
		col_box.size = Vector3(0.65, 8.5, 0.85)
		col_box.material = steel_mat
		column.mesh = col_box
		column.position = Vector3(side_x, 3.8, -5.8)
		hangar_env.add_child(column)

		var strip := MeshInstance3D.new()
		var st_box := BoxMesh.new()
		st_box.size = Vector3(0.08, 7.6, 0.08)
		st_box.material = neon_mat
		strip.mesh = st_box
		strip.position = Vector3(side_x * 0.92, 3.8, -5.3)
		hangar_env.add_child(strip)

	# 3. Pământul 3D care se rotește lent în spațiu dincolo de fereastra panoramică
	if earth_vista_pivot != null:
		_earth_sphere_mesh = MeshInstance3D.new()
		_earth_sphere_mesh.name = "EarthVistaSphere"
		var sph := SphereMesh.new()
		sph.radius = 6.2
		sph.height = 12.4
		sph.radial_segments = 48
		sph.rings = 24
		_earth_sphere_mesh.mesh = sph

		var earth_mat := StandardMaterial3D.new()
		earth_mat.albedo_color = Color(0.22, 0.58, 0.96)
		earth_mat.roughness = 0.75
		earth_mat.rim_enabled = true
		earth_mat.rim = 0.55
		earth_mat.rim_tint = 0.35

		var earth_tex_path := "res://assets/textures/2k/earth_daymap.jpg"
		var earth_tex := _load_texture_safe(earth_tex_path)
		if earth_tex != null:
			earth_mat.albedo_texture = earth_tex
			earth_mat.albedo_color = Color.WHITE
		_earth_sphere_mesh.material_override = earth_mat
		earth_vista_pivot.add_child(_earth_sphere_mesh)

		if ResourceLoader.exists(ATMOSPHERE_SHADER_PATH):
			var atmo_mesh := MeshInstance3D.new()
			atmo_mesh.name = "EarthVistaAtmosphere"
			atmo_mesh.mesh = sph
			atmo_mesh.scale = Vector3.ONE * 1.035
			var smat := ShaderMaterial.new()
			smat.shader = load(ATMOSPHERE_SHADER_PATH) as Shader
			smat.set_shader_parameter("atmosphere_color", Color("#38bdf8"))
			smat.set_shader_parameter("rim_intensity", 0.78)
			smat.set_shader_parameter("rim_power", 3.0)
			atmo_mesh.material_override = smat
			earth_vista_pivot.add_child(atmo_mesh)

func _load_texture_safe(res_path: String) -> Texture2D:
	if ResourceLoader.exists(res_path):
		var res = load(res_path)
		if res is Texture2D:
			return res
	var global_path: String = ProjectSettings.globalize_path(res_path)
	if FileAccess.file_exists(global_path):
		var img := Image.load_from_file(global_path)
		if img != null and not img.is_empty():
			return ImageTexture.create_from_image(img)
	return null

# =========================================================================
# Sinteză Audio Procedurală pentru Meniul SF (Hover, Click, Hidraulic, Power-Up)
# =========================================================================

func _setup_procedural_menu_audio() -> void:
	_ui_hover_player = AudioStreamPlayer.new()
	_ui_hover_player.name = "UiHoverSfx"
	_ui_hover_player.stream = _generate_tone_burst_wav(0.045, 980.0, 1240.0, 0.25)
	_ui_hover_player.volume_db = -16.0
	add_child(_ui_hover_player)

	_ui_click_player = AudioStreamPlayer.new()
	_ui_click_player.name = "UiClickSfx"
	_ui_click_player.stream = _generate_tone_burst_wav(0.08, 1320.0, 1980.0, 0.45)
	_ui_click_player.volume_db = -12.0
	add_child(_ui_click_player)

	_hydraulic_player = AudioStreamPlayer.new()
	_hydraulic_player.name = "PlatformHydraulicSfx"
	_hydraulic_player.stream = _generate_hydraulic_servo_wav(0.38)
	_hydraulic_player.volume_db = -10.0
	add_child(_hydraulic_player)

	_launch_powerup_player = AudioStreamPlayer.new()
	_launch_powerup_player.name = "LaunchPowerUpSfx"
	_launch_powerup_player.stream = _generate_tone_burst_wav(0.65, 95.0, 620.0, 0.72)
	_launch_powerup_player.volume_db = -7.5
	add_child(_launch_powerup_player)

func play_ui_hover_sfx() -> void:
	if _ui_hover_player != null and not _is_headless:
		_ui_hover_player.play()

func play_ui_click_sfx() -> void:
	if _ui_click_player != null and not _is_headless:
		_ui_click_player.play()

func play_hydraulic_lift_sfx() -> void:
	hydraulic_play_count += 1
	if _hydraulic_player != null and not _is_headless:
		_hydraulic_player.play()

func play_launch_powerup_sfx() -> void:
	powerup_play_count += 1
	if _launch_powerup_player != null and not _is_headless:
		_launch_powerup_player.play()

func _wire_button_sfx(btn: Button) -> void:
	if btn != null:
		btn.mouse_entered.connect(play_ui_hover_sfx)

func _generate_tone_burst_wav(duration_sec: float, f_start: float, f_end: float, amp: float) -> AudioStreamWAV:
	var rate: int = 22050
	var count: int = int(duration_sec * float(rate))
	var bytes := PackedByteArray()
	bytes.resize(count * 2)
	var phase: float = 0.0
	for i in range(count):
		var p: float = float(i) / float(max(count, 1))
		var freq: float = lerpf(f_start, f_end, p)
		phase = fmod(phase + freq / float(rate), 1.0)
		var env: float = sin(p * PI)
		var sample: float = sin(phase * TAU) * env * amp
		bytes.encode_s16(i * 2, clampi(int(sample * 24000.0), -32767, 32767))
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = rate
	wav.data = bytes
	return wav

func _generate_hydraulic_servo_wav(duration_sec: float) -> AudioStreamWAV:
	var rate: int = 22050
	var count: int = int(duration_sec * float(rate))
	var bytes := PackedByteArray()
	bytes.resize(count * 2)
	var phase: float = 0.0
	for i in range(count):
		var p: float = float(i) / float(max(count, 1))
		var servo_freq: float = lerpf(110.0, 215.0, sin(p * PI))
		phase = fmod(phase + servo_freq / float(rate), 1.0)
		var env: float = sin(p * PI)
		var sig: float = (sin(phase * TAU) * 0.65 + sin(phase * TAU * 2.5) * 0.35) * env * 0.55
		bytes.encode_s16(i * 2, clampi(int(sig * 22000.0), -32767, 32767))
	var wav := AudioStreamWAV.new()
	wav.format = AudioStreamWAV.FORMAT_16_BITS
	wav.mix_rate = rate
	wav.data = bytes
	return wav

# =========================================================================
# Construirea Interfeței SF (`sci_fi_theme.tres`)
# =========================================================================

func _build_sci_fi_menu_ui() -> void:
	if ui_layer == null:
		return

	_theme_root = Control.new()
	_theme_root.name = "SciFiThemeRoot"
	_theme_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	if ResourceLoader.exists(SCI_FI_THEME_PATH):
		_theme_root.theme = load(SCI_FI_THEME_PATH) as Theme
	ui_layer.add_child(_theme_root)

	_build_initial_title_screen()
	_build_expedition_selector_screen()
	_build_settings_modal()

func _build_initial_title_screen() -> void:
	_initial_screen_panel = Control.new()
	_initial_screen_panel.name = "InitialTitleScreen"
	_initial_screen_panel.set_anchors_preset(Control.PRESET_FULL_RECT)
	_theme_root.add_child(_initial_screen_panel)

	var card := PanelContainer.new()
	card.position = Vector2(42, 64)
	card.size = Vector2(460, 520)
	_initial_screen_panel.add_child(card)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 14)
	card.add_child(vbox)

	var title_lbl := Label.new()
	title_lbl.text = "🌌 ORBITAR"
	title_lbl.add_theme_font_size_override("font_size", 42)
	title_lbl.modulate = Color("#00f0ff")
	vbox.add_child(title_lbl)

	var sub_lbl := Label.new()
	sub_lbl.text = "EXPLORATORUL SPAȚIAL 3D ÎN LIMBA ROMÂNĂ\nHangarul Orbital — Misiune pentru Cadeți (6–12 ani)"
	sub_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub_lbl.modulate = Color("#fde68a")
	vbox.add_child(sub_lbl)

	var btn_new := Button.new()
	btn_new.name = "NewExpeditionButton"
	btn_new.text = "🚀 EXPEDIȚIE NOUĂ"
	btn_new.add_theme_font_size_override("font_size", 20)
	btn_new.pressed.connect(open_expedition_selector)
	_wire_button_sfx(btn_new)
	vbox.add_child(btn_new)

	_continue_button = Button.new()
	_continue_button.name = "ContinueFlightButton"
	_continue_button.text = "🪐 CONTINUĂ ZBORUL"
	_continue_button.add_theme_font_size_override("font_size", 19)
	_continue_button.disabled = not space_core.has_saved_profile()
	_continue_button.pressed.connect(continue_saved_flight.bind(true))
	_wire_button_sfx(_continue_button)
	vbox.add_child(_continue_button)

	_saved_profile_hint_label = Label.new()
	var scanned_count: int = space_core.get_scanned_bodies().size()
	_saved_profile_hint_label.text = "👨‍🚀 Profil activ: %s (%d corpuri cerești descoperite)" % [
		cadet_name_input_text, scanned_count
	]
	_saved_profile_hint_label.modulate = Color("#38bdf8")
	_saved_profile_hint_label.add_theme_font_size_override("font_size", 13)
	vbox.add_child(_saved_profile_hint_label)

	var btn_settings := Button.new()
	btn_settings.name = "SettingsButton"
	btn_settings.text = "⚙️ SETĂRI (GRAFICĂ 2K/4K, AUDIO, CAMERĂ)"
	btn_settings.pressed.connect(toggle_settings_panel.bind(true))
	_wire_button_sfx(btn_settings)
	vbox.add_child(btn_settings)

	var btn_quit := Button.new()
	btn_quit.name = "QuitGameButton"
	btn_quit.text = "✖ IEȘIRE"
	btn_quit.pressed.connect(quit_game)
	_wire_button_sfx(btn_quit)
	vbox.add_child(btn_quit)

func _build_expedition_selector_screen() -> void:
	_selector_screen_root = Control.new()
	_selector_screen_root.name = "ExpeditionSelectorScreen"
	_selector_screen_root.visible = false
	_selector_screen_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_theme_root.add_child(_selector_screen_root)

	# Bara de sus
	var top_bar := PanelContainer.new()
	top_bar.set_anchors_preset(Control.PRESET_TOP_WIDE)
	top_bar.offset_left = 24
	top_bar.offset_top = 14
	top_bar.offset_right = -24
	top_bar.offset_bottom = 70
	_selector_screen_root.add_child(top_bar)

	var top_hbox := HBoxContainer.new()
	top_bar.add_child(top_hbox)

	var btn_back := Button.new()
	btn_back.text = "◀ ÎNAPOI LA MENIU"
	btn_back.pressed.connect(show_initial_screen)
	_wire_button_sfx(btn_back)
	top_hbox.add_child(btn_back)

	var header_lbl := Label.new()
	header_lbl.text = "🌌 PREGĂTIREA EXPEDIȚIEI SPAȚIALE — HANGARUL ORBITAR"
	header_lbl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	header_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header_lbl.add_theme_font_size_override("font_size", 20)
	header_lbl.modulate = Color("#00f0ff")
	top_hbox.add_child(header_lbl)

	var btn_cam_ship := Button.new()
	btn_cam_ship.text = "🔭 Vezi Racheta"
	btn_cam_ship.pressed.connect(set_camera_focus.bind(CameraFocus.SHIP_INSPECT, true))
	_wire_button_sfx(btn_cam_ship)
	top_hbox.add_child(btn_cam_ship)

	var btn_cam_cockpit := Button.new()
	btn_cam_cockpit.text = "🪟 Vezi Cabina"
	btn_cam_cockpit.pressed.connect(set_camera_focus.bind(CameraFocus.COCKPIT_INSPECT, true))
	_wire_button_sfx(btn_cam_cockpit)
	top_hbox.add_child(btn_cam_cockpit)

	# Panoul Stâng: Selector de Personaj (Pilot) + Nume de Cadet (LineEdit)
	var left_panel := PanelContainer.new()
	left_panel.name = "PilotSelectorPanel"
	left_panel.position = Vector2(24, 84)
	left_panel.size = Vector2(390, 520)
	_selector_screen_root.add_child(left_panel)

	var left_vbox := VBoxContainer.new()
	left_vbox.add_theme_constant_override("separation", 8)
	left_panel.add_child(left_vbox)

	var p_title := Label.new()
	p_title.text = "👨‍🚀 1. NUMELE DE CADET & PERSONAJUL"
	p_title.modulate = Color("#00f0ff")
	p_title.add_theme_font_size_override("font_size", 17)
	left_vbox.add_child(p_title)

	var name_prompt := Label.new()
	name_prompt.text = "Scrie numele tău de Cadet Spațial (apare pe bord și pe Diplomă):"
	name_prompt.add_theme_font_size_override("font_size", 13)
	left_vbox.add_child(name_prompt)

	_cadet_name_edit = LineEdit.new()
	_cadet_name_edit.name = "CadetNameLineEdit"
	_cadet_name_edit.placeholder_text = "Ex: Cadetul Andrei / Cadetul Maria"
	_cadet_name_edit.text = cadet_name_input_text
	_cadet_name_edit.text_changed.connect(set_cadet_name_text)
	left_vbox.add_child(_cadet_name_edit)

	for i in range(pilots_list.size()):
		var p: Dictionary = pilots_list[i]
		var btn := Button.new()
		btn.toggle_mode = true
		btn.text = "%s %s" % [str(p.get("badge_symbol", "★")), str(p.get("name_ro", ""))]
		btn.pressed.connect(select_pilot_by_index.bind(i))
		_wire_button_sfx(btn)
		left_vbox.add_child(btn)
		_pilot_buttons.append(btn)

	var portrait_hbox := HBoxContainer.new()
	portrait_hbox.add_theme_constant_override("separation", 12)
	left_vbox.add_child(portrait_hbox)

	_pilot_portrait_rect = TextureRect.new()
	_pilot_portrait_rect.custom_minimum_size = Vector2(96, 96)
	_pilot_portrait_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_pilot_portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	portrait_hbox.add_child(_pilot_portrait_rect)

	var bio_vbox := VBoxContainer.new()
	bio_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	portrait_hbox.add_child(bio_vbox)

	_pilot_name_label = Label.new()
	_pilot_name_label.add_theme_font_size_override("font_size", 17)
	_pilot_name_label.modulate = Color("#fde68a")
	bio_vbox.add_child(_pilot_name_label)

	_pilot_role_label = Label.new()
	_pilot_role_label.modulate = Color("#38bdf8")
	_pilot_role_label.add_theme_font_size_override("font_size", 14)
	bio_vbox.add_child(_pilot_role_label)

	_pilot_desc_label = Label.new()
	_pilot_desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_pilot_desc_label.add_theme_font_size_override("font_size", 13)
	left_vbox.add_child(_pilot_desc_label)

	# Panoul Drept: Selector de Rachete (`<` / `>`), 3 Bare ProgressBar și 3 Culori Fuzelaj
	var right_panel := PanelContainer.new()
	right_panel.name = "ShipSelectorPanel"
	right_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	right_panel.offset_left = -414
	right_panel.offset_top = 84
	right_panel.offset_right = -24
	right_panel.offset_bottom = 604
	_selector_screen_root.add_child(right_panel)

	var right_vbox := VBoxContainer.new()
	right_vbox.add_theme_constant_override("separation", 8)
	right_panel.add_child(right_vbox)

	var s_header := Label.new()
	s_header.text = "🛸 2. ALEGE RACHETA & CULOAREA"
	s_header.modulate = Color("#00f0ff")
	s_header.add_theme_font_size_override("font_size", 17)
	right_vbox.add_child(s_header)

	var nav_hbox := HBoxContainer.new()
	nav_hbox.add_theme_constant_override("separation", 10)
	right_vbox.add_child(nav_hbox)

	var btn_prev := Button.new()
	btn_prev.name = "PrevShipButton"
	btn_prev.text = "◀ <"
	btn_prev.pressed.connect(cycle_ship.bind(-1))
	_wire_button_sfx(btn_prev)
	nav_hbox.add_child(btn_prev)

	_ship_title_label = Label.new()
	_ship_title_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_ship_title_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ship_title_label.add_theme_font_size_override("font_size", 17)
	_ship_title_label.modulate = Color("#fde68a")
	nav_hbox.add_child(_ship_title_label)

	var btn_next := Button.new()
	btn_next.name = "NextShipButton"
	btn_next.text = "> ▶"
	btn_next.pressed.connect(cycle_ship.bind(1))
	_wire_button_sfx(btn_next)
	nav_hbox.add_child(btn_next)

	_ship_propulsion_label = Label.new()
	_ship_propulsion_label.modulate = Color("#38bdf8")
	_ship_propulsion_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_ship_propulsion_label.add_theme_font_size_override("font_size", 14)
	right_vbox.add_child(_ship_propulsion_label)

	_ship_desc_label = Label.new()
	_ship_desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_ship_desc_label.add_theme_font_size_override("font_size", 13)
	right_vbox.add_child(_ship_desc_label)

	# Cele 3 bare grafice SF (`ProgressBar`) pentru Viteză, Manevrabilitate și Rază Scanner
	var lbl_spd := Label.new()
	lbl_spd.text = "⚡ Viteză & Propulsor Mini-Warp:"
	lbl_spd.add_theme_font_size_override("font_size", 13)
	right_vbox.add_child(lbl_spd)

	_speed_bar = ProgressBar.new()
	_speed_bar.custom_minimum_size = Vector2(0, 18)
	_speed_bar.max_value = 100.0
	right_vbox.add_child(_speed_bar)

	var lbl_agi := Label.new()
	lbl_agi.text = "🎯 Manevrabilitate & Rotație 6DOF:"
	lbl_agi.add_theme_font_size_override("font_size", 13)
	right_vbox.add_child(lbl_agi)

	_agility_bar = ProgressBar.new()
	_agility_bar.custom_minimum_size = Vector2(0, 18)
	_agility_bar.max_value = 100.0
	right_vbox.add_child(_agility_bar)

	var lbl_scn := Label.new()
	lbl_scn.text = "📡 Rază Scanner Științific:"
	lbl_scn.add_theme_font_size_override("font_size", 13)
	right_vbox.add_child(lbl_scn)

	_scanner_bar = ProgressBar.new()
	_scanner_bar.custom_minimum_size = Vector2(0, 18)
	_scanner_bar.max_value = 100.0
	right_vbox.add_child(_scanner_bar)

	# Cele 3 butoane de culoare pentru personalizarea fuzelajului rachetei
	var col_lbl := Label.new()
	col_lbl.text = "🎨 Culoare Fuzelaj Rachetă:"
	col_lbl.add_theme_font_size_override("font_size", 14)
	right_vbox.add_child(col_lbl)

	var col_hbox := HBoxContainer.new()
	col_hbox.add_theme_constant_override("separation", 8)
	right_vbox.add_child(col_hbox)

	for i in range(HULL_COLOR_OPTIONS.size()):
		var opt: Dictionary = HULL_COLOR_OPTIONS[i]
		var c_btn := Button.new()
		c_btn.toggle_mode = true
		c_btn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		c_btn.text = "● " + str(opt["label_ro"])
		c_btn.modulate = Color(str(opt["hex"])).lerp(Color.WHITE, 0.35)
		c_btn.pressed.connect(select_hull_color.bind(str(opt["hex"])))
		_wire_button_sfx(c_btn)
		col_hbox.add_child(c_btn)
		_color_buttons.append(c_btn)

	# Butonul central jos: DECOLARE ÎN SPAȚIU
	_launch_button = Button.new()
	_launch_button.name = "LaunchButton"
	_launch_button.text = "🚀 DECOLARE ÎN SPAȚIU"
	_launch_button.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_launch_button.offset_left = 435
	_launch_button.offset_top = -78
	_launch_button.offset_right = -435
	_launch_button.offset_bottom = -18
	_launch_button.add_theme_font_size_override("font_size", 22)
	_launch_button.pressed.connect(launch_into_space.bind(true))
	_wire_button_sfx(_launch_button)
	_selector_screen_root.add_child(_launch_button)

func _build_settings_modal() -> void:
	_settings_modal_panel = PanelContainer.new()
	_settings_modal_panel.name = "SettingsModalPanel"
	_settings_modal_panel.visible = false
	_settings_modal_panel.set_anchors_preset(Control.PRESET_CENTER)
	_settings_modal_panel.offset_left = -260
	_settings_modal_panel.offset_top = -170
	_settings_modal_panel.offset_right = 260
	_settings_modal_panel.offset_bottom = 170
	_theme_root.add_child(_settings_modal_panel)

	var vbox := VBoxContainer.new()
	vbox.add_theme_constant_override("separation", 12)
	_settings_modal_panel.add_child(vbox)

	var title := Label.new()
	title.text = "⚙️ SETĂRI SISTEM ORBITAR"
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.modulate = Color("#00f0ff")
	title.add_theme_font_size_override("font_size", 20)
	vbox.add_child(title)

	_quality_toggle_btn = Button.new()
	_quality_toggle_btn.pressed.connect(_on_toggle_quality_pressed)
	_wire_button_sfx(_quality_toggle_btn)
	vbox.add_child(_quality_toggle_btn)

	_camera_default_btn = Button.new()
	_camera_default_btn.pressed.connect(_on_toggle_default_camera_pressed)
	_wire_button_sfx(_camera_default_btn)
	vbox.add_child(_camera_default_btn)

	_volume_value_label = Label.new()
	vbox.add_child(_volume_value_label)

	_volume_slider = HSlider.new()
	_volume_slider.min_value = 0.0
	_volume_slider.max_value = 100.0
	_volume_slider.step = 1.0
	_volume_slider.value_changed.connect(_on_volume_slider_changed)
	vbox.add_child(_volume_slider)

	var btn_close := Button.new()
	btn_close.text = "✓ SALVEAZĂ ȘI ÎNCHIDE"
	btn_close.pressed.connect(toggle_settings_panel.bind(false))
	_wire_button_sfx(btn_close)
	vbox.add_child(btn_close)

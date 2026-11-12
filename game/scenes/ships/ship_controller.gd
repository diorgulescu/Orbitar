# SPDX-License-Identifier: GPL-3.0-or-later
class_name ShipController
extends Node3D

## Controlerul „Arcade-Assisted 6DOF” al navei spațiale pentru copii (6–12 ani).
## Coordonează:
## - Sistemul de Floating Origin în f64 din `OrbitarSpaceCore` (Rust)
## - Sistemul Dual de Camere (`ShipCameraRig` — Cockpit 3D cu indicatoare diegetice, Free-Look ±80°/±50°,
##   G-force offset, Chase SpringArm3D cu FOV 70°->85° la Boost și tranziție Tween de 0.35s pe tasta `C`)
## - Sistemul Audio Reactiv & Acustica de Cabină (`ShipAudioController` — sub-bus-uri `ShipExterior` /
##   `ShipCockpit`, Power-Up/Power-Down pe tasta `E`, Idle Hum, Main Thrusters 0.8->1.8, RCS și Mini-Warp)

const ShipModelBuilderScript = preload("res://scenes/ships/ship_model_builder.gd")

signal camera_mode_changed(mode_name: String)
signal propulsion_tier_changed(tier_name: String)
signal warp_blocked_by_proximity(planet_name: String)
signal hyper_drop_triggered(body_id: String, body_name: String)
signal nearby_planet_entered(body_id: String, body_name: String)
signal scan_progress_updated(progress: float, body_id: String, body_name: String)
signal planet_scan_completed(body_id: String, body_data: Dictionary)
signal photo_mode_toggled(enabled: bool)
signal photo_saved(file_path: String)
signal engine_power_changed(engines_online: bool)

const HYPER_DROP_RADIUS_MULT: float = 2.2
const SCANNER_RADIUS_MULT: float = 3.5
const HYPER_DROP_DURATION_SEC: float = 1.5
const UNITS_PER_SPEED_OF_LIGHT_C: float = 2500000.0

enum PropulsionTier {
	MANEUVER = 0,
	BOOST = 1,
	MINI_WARP = 2,
}

enum CameraMode {
	CHASE_THIRD_PERSON = 0,
	COCKPIT_FIRST_PERSON = 1,
}

@export_group("Rotație 6DOF & Auto-Stabilizare")
@export var pitch_speed: float = 1.65
@export var yaw_speed: float = 1.65
@export var roll_speed: float = 2.15
@export var rotation_smoothing: float = 10.0
@export var mouse_sensitivity: float = 0.0022
@export var gamepad_deadzone: float = 0.16
@export var auto_stabilize_roll: bool = true
@export var roll_stabilize_speed: float = 2.4

@export_group("Propulsie în 3 Trepte (Sub-Luminic 50..3000 m/s & HYPER 0.2c..8.0c)")
@export var maneuver_min_speed: float = 50.0
@export var maneuver_max_speed: float = 500.0
@export var boost_max_speed: float = 3000.0
@export var warp_min_speed: float = 500000.0
@export var warp_max_speed: float = 20000000.0
@export var hyper_exp_growth_rate: float = 0.38
@export var maneuver_acceleration: float = 950.0
@export var boost_acceleration: float = 4200.0
@export var warp_acceleration: float = 3500000.0

@export_group("Inertial Dampeners")
@export var inertial_dampeners_enabled: bool = true
@export var dampener_drag: float = 5.8
@export var dampener_stop_deceleration: float = 650.0

@export_group("Scanner Științific & Mod Foto")
@export var base_scan_duration_sec: float = 2.0
@export var photo_orbit_sensitivity: float = 0.005

@export_group("Camere & Efecte Vizuale")
@export var base_fov: float = 70.0
@export var boost_fov: float = 85.0
@export var warp_fov: float = 92.0

# Referință către nucleul nativ Rust (setată de SpaceWorld)
var space_core: OrbitarSpaceCore = null
var simulation_time_days: float = 0.0

# Statistici preluate din Rust pentru arhetipul navei alese în Hangar
var active_ship_id: String = "naveta_vulturul"
var active_ship_name_ro: String = "Naveta „Vulturul”"
var turn_rate_multiplier: float = 1.0
var warp_speed_multiplier: float = 1.0
var roll_stability_multiplier: float = 1.0
var scan_speed_multiplier: float = 1.0
var scan_range_multiplier: float = 1.0

# Starea curentă a zborului și a motoarelor
var engines_online: bool = true
var current_throttle: float = 0.0
var velocity: Vector3 = Vector3.ZERO
var angular_velocity: Vector3 = Vector3.ZERO
var current_tier: PropulsionTier = PropulsionTier.MANEUVER
var camera_mode: CameraMode = CameraMode.CHASE_THIRD_PERSON

# Telemetria bulei de siguranță planetare (preluată din Rust f64)
var nearest_body_id: String = "earth"
var nearest_body_name: String = "Pământul"
var nearest_body_radius: float = 75000.0
var nearest_altitude: float = 100000.0
var nearest_center_distance: float = 175000.0
var nearest_bubble_radius: float = 262500.0
var nearest_hyper_drop_radius: float = 165000.0
var nearest_scan_radius: float = 262500.0
var in_proximity_bubble: bool = false
var in_hyper_drop_zone: bool = false
var can_scan_nearest_body: bool = false
var warp_allowed: bool = true
var safety_speed_limit_factor: float = 1.0
var _last_announced_proximity_body: String = ""

# Starea modului HYPER & Frânarea Gravitațională Automată (Hyper-Drop la 2.2 * raza_planetei)
var hyper_elapsed_sec: float = 0.0
var hyper_drop_active: bool = false
var hyper_drop_timer: float = 0.0
var _hyper_drop_initial_dir: Vector3 = Vector3.FORWARD
var _hyper_drop_initial_speed: float = 0.0
var _hyper_drop_lock_until_release: bool = false
var hyper_drop_count: int = 0

# Starea Scannerului Științific (Click Dreapta / Trigger Stânga pe Gamepad / tasta F)
var is_scanning: bool = false
var scan_progress: float = 0.0 # 0.0 .. 1.0
var _scan_completed_lock: bool = false

# Starea Modului Foto (tasta P)
var photo_mode_active: bool = false
var photo_cam_yaw: float = 0.45
var photo_cam_pitch: float = -0.22
var photo_cam_distance: float = 5.2

# Input acumulat de la mouse
var _mouse_look_delta: Vector2 = Vector2.ZERO
var _warp_streak_phase: float = 0.0
var _holo_scan_phase: float = 0.0
var _custom_ship_mesh: Node3D = null

# Noduri interne ale navei
@onready var visual_pivot: Node3D = $ShipVisualPivot
@onready var camera_rig: Node3D = $ShipCameraRig
@onready var chase_cam_pivot: Node3D = $ShipCameraRig/ChaseCameraPivot
@onready var chase_camera: Camera3D = $ShipCameraRig/ChaseCameraPivot/ChaseSpringArm3D/ChaseCamera3D
@onready var cockpit_camera: Camera3D = $ShipCameraRig/CockpitHeadPivot/CockpitCamera3D
@onready var audio_controller: Node3D = $ShipAudioController
@onready var photo_cam_pivot: Node3D = $PhotoCameraPivot
@onready var photo_camera: Camera3D = $PhotoCameraPivot/PhotoCamera3D
@onready var boost_particles: CPUParticles3D = $ShipVisualPivot/BoostParticles
@onready var warp_streaks: MultiMeshInstance3D = $WarpStreaksEffect
@onready var holo_scanner_wave: MeshInstance3D = $HoloScannerWave

func _ready() -> void:
	_setup_warp_streaks_multimesh()
	_apply_camera_mode(false)

func bind_space_core(core: OrbitarSpaceCore) -> void:
	space_core = core
	if space_core != null:
		apply_ship_archetype_from_rust(space_core.get_selected_ship_spec())
		if camera_rig != null and camera_rig.cockpit_interior_root != null:
			camera_rig.cockpit_interior_root.set_pilot_profile(
				space_core.get_selected_pilot_spec(),
				space_core.get_cadet_name()
			)
		var def_cam: String = space_core.get_default_camera_mode()
		camera_mode = CameraMode.COCKPIT_FIRST_PERSON if def_cam == "cockpit" else CameraMode.CHASE_THIRD_PERSON
		_apply_camera_mode(false)
		var vol: float = space_core.get_audio_volume()
		AudioServer.set_bus_volume_db(0, linear_to_db(clampf(vol, 0.02, 1.0)))

## Aplică statisticile și modelul 3D modular al navei selectate în Hangar (preluate din Rust).
func apply_ship_archetype_from_rust(spec: Dictionary) -> void:
	if spec.is_empty():
		return
	active_ship_id = str(spec.get("id", "naveta_vulturul"))
	active_ship_name_ro = str(spec.get("name_ro", "Naveta „Vulturul”"))
	maneuver_max_speed = clampf(float(spec.get("manual_scene_speed", 500.0)), 50.0, 1200.0)
	var boost_mult: float = clampf(float(spec.get("boost_multiplier", 5.5)), 2.0, 8.0)
	boost_max_speed = clampf(maneuver_max_speed * boost_mult, 1500.0, 3000.0)
	turn_rate_multiplier = float(spec.get("turn_rate_multiplier", 1.0))
	warp_speed_multiplier = float(spec.get("warp_speed_multiplier", 1.0))
	roll_stability_multiplier = float(spec.get("roll_stability_multiplier", 1.0))
	scan_speed_multiplier = float(spec.get("scan_speed_multiplier", 1.0))
	scan_range_multiplier = float(spec.get("scan_range_multiplier", 1.0))

	if camera_rig != null and camera_rig.cockpit_interior_root != null:
		camera_rig.cockpit_interior_root.apply_ship_cockpit_variant(active_ship_id)

	var custom_col: String = space_core.get_ship_color_hex() if space_core != null else ""

	if visual_pivot != null:
		for child in visual_pivot.get_children():
			if child != boost_particles:
				child.visible = false
		if _custom_ship_mesh != null:
			visual_pivot.remove_child(_custom_ship_mesh)
			_custom_ship_mesh.free()
		_custom_ship_mesh = ShipModelBuilderScript.build_ship_visual(active_ship_id, custom_col)
		visual_pivot.add_child(_custom_ship_mesh)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventMouseMotion:
		if photo_mode_active:
			photo_cam_yaw -= event.relative.x * photo_orbit_sensitivity
			photo_cam_pitch = clampf(photo_cam_pitch - event.relative.y * photo_orbit_sensitivity, -1.35, 1.35)
			_update_photo_camera_transform()
		elif camera_rig != null and camera_rig.has_method("is_freelook_held") and camera_rig.is_freelook_held():
			camera_rig.apply_freelook_input_degrees(
				-event.relative.x * camera_rig.freelook_mouse_sensitivity,
				-event.relative.y * camera_rig.freelook_mouse_sensitivity
			)
		elif Input.get_mouse_mode() == Input.MOUSE_MODE_CAPTURED:
			_mouse_look_delta += event.relative

	elif event is InputEventMouseButton and photo_mode_active and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			photo_cam_distance = clampf(photo_cam_distance - 0.45, 2.2, 16.0)
			_update_photo_camera_transform()
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			photo_cam_distance = clampf(photo_cam_distance + 0.45, 2.2, 16.0)
			_update_photo_camera_transform()

	elif event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_P:
			toggle_photo_mode()
		elif event.keycode == KEY_C and not photo_mode_active:
			toggle_camera_mode(true)
		elif event.keycode == KEY_E and not photo_mode_active:
			toggle_engine_power()
		elif event.keycode == KEY_R and not photo_mode_active:
			auto_stabilize_roll = not auto_stabilize_roll
		elif (event.keycode == KEY_ENTER or event.keycode == KEY_F12) and photo_mode_active:
			capture_photo_to_disk()

	elif event is InputEventJoypadButton and event.pressed:
		if event.button_index == JOY_BUTTON_RIGHT_STICK and not photo_mode_active:
			toggle_camera_mode(true)

## Comută între Chase View (Third-Person) și Cockpit View (First-Person) cu tranziție Tween (0.35s)
## și adaptează automat acustica (`ShipExterior` vs `ShipCockpit`).
func toggle_camera_mode(animate: bool = true) -> void:
	if camera_mode == CameraMode.CHASE_THIRD_PERSON:
		camera_mode = CameraMode.COCKPIT_FIRST_PERSON
	else:
		camera_mode = CameraMode.CHASE_THIRD_PERSON
	_apply_camera_mode(animate)

func _apply_camera_mode(animate: bool = true) -> void:
	if photo_mode_active:
		if chase_camera:
			chase_camera.current = false
		if cockpit_camera:
			cockpit_camera.current = false
		if photo_camera:
			photo_camera.current = true
		if visual_pivot:
			visual_pivot.visible = true
		if camera_rig != null and camera_rig.cockpit_interior_root != null:
			camera_rig.cockpit_interior_root.visible = false
		return

	if photo_camera:
		photo_camera.current = false

	var is_cockpit: bool = (camera_mode == CameraMode.COCKPIT_FIRST_PERSON)
	if camera_rig != null and camera_rig.has_method("set_view_mode"):
		camera_rig.set_view_mode(int(camera_mode), animate)
	elif chase_camera and cockpit_camera:
		chase_camera.current = not is_cockpit
		cockpit_camera.current = is_cockpit

	if visual_pivot:
		visual_pivot.visible = not is_cockpit

	if audio_controller != null and audio_controller.has_method("set_acoustic_environment"):
		audio_controller.set_acoustic_environment(is_cockpit)

	var label := "Chase 3rd-Person" if not is_cockpit else "Cockpit 1st-Person"
	camera_mode_changed.emit(label)

## Pornește sau oprește motoarele navei pe tasta `E` (secvență Power-Up / Power-Down + lumini bord 3D).
func toggle_engine_power() -> bool:
	set_engine_power(not engines_online)
	return engines_online

func set_engine_power(online: bool) -> void:
	engines_online = online
	if audio_controller != null and audio_controller.has_method("set_engine_power"):
		audio_controller.set_engine_power(online)
	_broadcast_pilot_comms("power_up" if engines_online else "power_down", nearest_body_id)
	engine_power_changed.emit(engines_online)

func _broadcast_pilot_comms(event_type: String, body_id: String) -> void:
	if space_core == null:
		return
	var line: String = space_core.get_pilot_reaction(event_type, body_id)
	if camera_rig != null and camera_rig.cockpit_interior_root != null:
		camera_rig.cockpit_interior_root.set_pilot_comms_message(line)
	if audio_controller != null and audio_controller.has_method("play_radio_comms_squelch"):
		audio_controller.play_radio_comms_squelch()

## Activează / dezactivează Modul Foto (`P`): oprește HUD-ul și permite rotirea camerei în jurul navei.
func toggle_photo_mode() -> bool:
	set_photo_mode(not photo_mode_active)
	return photo_mode_active

func set_photo_mode(enabled: bool) -> void:
	if photo_mode_active == enabled:
		return
	photo_mode_active = enabled
	if photo_mode_active:
		velocity = Vector3.ZERO
		angular_velocity = Vector3.ZERO
		if holo_scanner_wave:
			holo_scanner_wave.visible = false
		_update_photo_camera_transform()
	_apply_camera_mode(false)
	photo_mode_toggled.emit(photo_mode_active)

func _update_photo_camera_transform() -> void:
	if photo_cam_pivot == null or photo_camera == null:
		return
	photo_cam_pivot.rotation = Vector3(photo_cam_pitch, photo_cam_yaw, 0.0)
	photo_camera.position = Vector3(0.0, 0.0, photo_cam_distance)
	photo_camera.look_at(global_position, Vector3.UP)

## Salvează o captură de ecran (.png) în folderul utilizatorului.
func capture_photo_to_disk() -> String:
	var save_dir: String = "/tmp/orbitar/photos"
	if space_core != null:
		save_dir = space_core.get_photos_save_dir()
	DirAccess.make_dir_recursive_absolute(save_dir)

	var timestamp: int = int(Time.get_unix_time_from_system())
	var file_path: String = "%s/orbitar_foto_%s_%d.png" % [save_dir, nearest_body_id, timestamp]

	var img: Image = null
	if DisplayServer.get_name() != "headless":
		var vp := get_viewport()
		if vp != null and vp.get_texture() != null:
			img = vp.get_texture().get_image()

	if img == null or img.is_empty():
		img = Image.create(640, 360, false, Image.FORMAT_RGBA8)
		img.fill(Color(0.02, 0.05, 0.12, 1.0))

	var err: Error = img.save_png(file_path)
	if err == OK:
		print("📸 [Mod Foto] Captură salvată cu succes în: %s" % file_path)
		photo_saved.emit(file_path)
		return file_path
	return ""

func _physics_process(delta: float) -> void:
	if delta <= 0.0:
		return

	if photo_mode_active:
		var orbit_x: float = 0.0
		var orbit_y: float = 0.0
		if Input.is_key_pressed(KEY_LEFT) or Input.is_key_pressed(KEY_A):
			orbit_x -= 1.5
		if Input.is_key_pressed(KEY_RIGHT) or Input.is_key_pressed(KEY_D):
			orbit_x += 1.5
		if Input.is_key_pressed(KEY_UP) or Input.is_key_pressed(KEY_W):
			orbit_y += 1.2
		if Input.is_key_pressed(KEY_DOWN) or Input.is_key_pressed(KEY_S):
			orbit_y -= 1.2
		if absf(orbit_x) > 0.01 or absf(orbit_y) > 0.01:
			photo_cam_yaw += orbit_x * delta
			photo_cam_pitch = clampf(photo_cam_pitch - orbit_y * delta, -1.35, 1.35)
			_update_photo_camera_transform()
		return

	# 1. Evaluăm bula de siguranță planetară în f64 prin OrbitarSpaceCore (Rust)
	if space_core != null:
		var safety: Dictionary = space_core.evaluate_planetary_safety_bubble(simulation_time_days)
		nearest_body_id = str(safety.get("nearest_body_id", "earth"))
		nearest_body_name = str(safety.get("nearest_body_name", "Pământul"))
		nearest_body_radius = maxf(float(safety.get("body_radius", 75000.0)), 1.0)
		nearest_altitude = float(safety.get("altitude", 100000.0))
		nearest_center_distance = float(safety.get("center_distance", 175000.0))
		nearest_bubble_radius = float(safety.get("bubble_radius", nearest_body_radius * SCANNER_RADIUS_MULT))
		nearest_hyper_drop_radius = float(safety.get("hyper_drop_radius", nearest_body_radius * HYPER_DROP_RADIUS_MULT))
		nearest_scan_radius = float(safety.get("scan_radius", nearest_body_radius * SCANNER_RADIUS_MULT))
		in_proximity_bubble = bool(safety.get("in_proximity_bubble", false))
		in_hyper_drop_zone = bool(safety.get("in_hyper_drop_zone", false))
		warp_allowed = bool(safety.get("warp_allowed", true))
		safety_speed_limit_factor = float(safety.get("speed_limit_factor", 1.0))

		# Raza de activare a Scannerului Științific: 3.5 * raza_planetei (scalată cu bonusul navei)
		can_scan_nearest_body = (
			nearest_center_distance <= nearest_body_radius * SCANNER_RADIUS_MULT * maxf(scan_range_multiplier, 1.0)
		)

		if in_proximity_bubble and nearest_body_id != _last_announced_proximity_body:
			_last_announced_proximity_body = nearest_body_id
			_scan_completed_lock = false
			_broadcast_pilot_comms("approach_planet", nearest_body_id)
			nearby_planet_entered.emit(nearest_body_id, nearest_body_name)
		elif not in_proximity_bubble and not can_scan_nearest_body:
			_last_announced_proximity_body = ""
			_scan_completed_lock = false

		var pushout: Vector3 = safety.get("pushout", Vector3.ZERO)
		if pushout.length_squared() > 1e-6:
			var outward_dir: Vector3 = pushout.normalized()
			var inward_speed: float = velocity.dot(-outward_dir)
			if inward_speed > 0.0:
				velocity += outward_dir * inward_speed

	# 2. Rotație 6DOF lină (Tastatură + Mouse + Gamepad)
	_update_rotation_6dof(delta)

	# 3. Propulsie în 3 trepte (Sub-Luminic 50..3000 m/s & HYPER 500k..20M u/s) + Hyper-Drop
	_update_propulsion_and_dampeners(delta)

	# 4. Scannerul Științific (rază 3.5 * raza_planetei)
	_update_scientific_scanner(delta)

	# 5. Transmitem deplasarea navei către sistemul Floating Origin în f64 (Rust)
	var delta_pos: Vector3 = velocity * delta
	if space_core != null and delta_pos.length_squared() > 0.0:
		if current_tier == PropulsionTier.MINI_WARP and not hyper_drop_active:
			var drop_hit: Dictionary = space_core.advance_ship_in_hyper(delta_pos, simulation_time_days)
			if bool(drop_hit.get("intercepted", false)):
				trigger_hyper_drop(
					str(drop_hit.get("body_id", nearest_body_id)),
					str(drop_hit.get("body_name", nearest_body_name)),
					float(drop_hit.get("body_radius", nearest_body_radius))
				)
		else:
			space_core.update_ship_displacement(delta_pos)
	position = Vector3.ZERO

	# 6. Actualizăm Sistemul Audio Reactiv și Sistemul Dual de Camere
	var want_warp: bool = Input.is_key_pressed(KEY_SPACE) or Input.is_joy_button_pressed(0, JOY_BUTTON_Y)
	var power_progress: float = 1.0 if engines_online else 0.0
	if audio_controller != null and audio_controller.has_method("update_audio_state"):
		audio_controller.update_audio_state(
			delta,
			current_throttle,
			int(current_tier),
			angular_velocity,
			want_warp,
			warp_allowed
		)
		power_progress = audio_controller.engine_power_progress

	var local_vel: Vector3 = global_transform.basis.inverse() * velocity
	if camera_rig != null and camera_rig.has_method("update_rig"):
		camera_rig.update_rig(
			delta,
			local_vel,
			angular_velocity,
			int(current_tier),
			maneuver_max_speed,
			nearest_body_name,
			nearest_altitude,
			power_progress,
			space_core,
			simulation_time_days,
			engines_online,
			nearest_body_id,
			is_scanning,
			scan_progress
		)

	_update_visual_effects(delta)

func _update_scientific_scanner(delta: float) -> void:
	var trigger_left: float = Input.get_joy_axis(0, JOY_AXIS_TRIGGER_LEFT)
	var scan_held: bool = (
		Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)
		or trigger_left > 0.35
		or Input.is_key_pressed(KEY_F)
	)

	if can_scan_nearest_body and scan_held and not _scan_completed_lock:
		is_scanning = true
		var scan_rate: float = (1.0 / maxf(base_scan_duration_sec, 0.25)) * scan_speed_multiplier
		scan_progress = clampf(scan_progress + scan_rate * delta, 0.0, 1.0)
		scan_progress_updated.emit(scan_progress, nearest_body_id, nearest_body_name)

		if holo_scanner_wave != null:
			holo_scanner_wave.visible = true
			_holo_scan_phase = fmod(_holo_scan_phase + delta * 3.2, 1.0)
			var pulse_scale: float = 1.0 + _holo_scan_phase * 2.4
			holo_scanner_wave.scale = Vector3(pulse_scale, pulse_scale, 1.0)
			holo_scanner_wave.position = Vector3(0.0, 0.0, -1.5 - _holo_scan_phase * 3.5)

		if scan_progress >= 1.0:
			_complete_current_planet_scan()
	else:
		if is_scanning and scan_progress < 1.0:
			scan_progress = maxf(0.0, scan_progress - delta * 0.8)
			scan_progress_updated.emit(scan_progress, nearest_body_id, nearest_body_name)
		is_scanning = false
		if holo_scanner_wave != null:
			holo_scanner_wave.visible = false

func _complete_current_planet_scan() -> void:
	_scan_completed_lock = true
	is_scanning = false
	scan_progress = 1.0
	if holo_scanner_wave != null:
		holo_scanner_wave.visible = false

	var body_data: Dictionary = {}
	if space_core != null:
		space_core.mark_body_scanned(nearest_body_id)
		body_data = space_core.get_celestial_body(nearest_body_id)

	if camera_rig != null and camera_rig.cockpit_interior_root != null:
		camera_rig.cockpit_interior_root.show_didactic_card_on_left_screen(body_data)
	_broadcast_pilot_comms("scan_complete", nearest_body_id)

	scan_progress_updated.emit(1.0, nearest_body_id, nearest_body_name)
	planet_scan_completed.emit(nearest_body_id, body_data)

func perform_instant_scan(target_body_id: String = "") -> Dictionary:
	var id_to_scan: String = target_body_id if not target_body_id.is_empty() else nearest_body_id
	nearest_body_id = id_to_scan
	if space_core != null:
		var b: Dictionary = space_core.get_celestial_body(id_to_scan)
		nearest_body_name = str(b.get("name", id_to_scan))
	_complete_current_planet_scan()
	return space_core.get_celestial_body(id_to_scan) if space_core != null else {}

func _update_rotation_6dof(delta: float) -> void:
	var target_pitch_input: float = 0.0
	var target_yaw_input: float = 0.0
	var target_roll_input: float = 0.0

	if Input.is_key_pressed(KEY_UP):
		target_pitch_input += 1.0
	if Input.is_key_pressed(KEY_DOWN):
		target_pitch_input -= 1.0
	if Input.is_key_pressed(KEY_LEFT):
		target_yaw_input += 1.0
	if Input.is_key_pressed(KEY_RIGHT):
		target_yaw_input -= 1.0

	# Roll pe Q / Z (deoarece tasta E pornește/oprește motoarele) + umerii pe Gamepad
	if Input.is_key_pressed(KEY_Q):
		target_roll_input += 1.0
	if Input.is_key_pressed(KEY_Z) or Input.is_key_pressed(KEY_X):
		target_roll_input -= 1.0

	if _mouse_look_delta.length_squared() > 0.0:
		target_yaw_input -= _mouse_look_delta.x * mouse_sensitivity / max(delta, 0.001)
		target_pitch_input -= _mouse_look_delta.y * mouse_sensitivity / max(delta, 0.001)
		_mouse_look_delta = Vector2.ZERO

	var freelook_held: bool = camera_rig != null and camera_rig.has_method("is_freelook_held") and camera_rig.is_freelook_held()
	if not freelook_held:
		var joy_rx: float = Input.get_joy_axis(0, JOY_AXIS_RIGHT_X)
		var joy_ry: float = Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
		if absf(joy_rx) > gamepad_deadzone:
			target_yaw_input -= joy_rx
		if absf(joy_ry) > gamepad_deadzone:
			target_pitch_input -= joy_ry

	if Input.is_joy_button_pressed(0, JOY_BUTTON_LEFT_SHOULDER):
		target_roll_input += 1.0
	if Input.is_joy_button_pressed(0, JOY_BUTTON_RIGHT_SHOULDER):
		target_roll_input -= 1.0

	var power_factor: float = 1.0 if engines_online else 0.0
	var desired_ang := Vector3(
		clampf(target_pitch_input, -2.5, 2.5) * pitch_speed * turn_rate_multiplier * power_factor,
		clampf(target_yaw_input, -2.5, 2.5) * yaw_speed * turn_rate_multiplier * power_factor,
		clampf(target_roll_input, -2.5, 2.5) * roll_speed * turn_rate_multiplier * power_factor
	)

	angular_velocity = angular_velocity.lerp(desired_ang, clampf(rotation_smoothing * delta, 0.0, 1.0))

	rotate_object_local(Vector3.RIGHT, angular_velocity.x * delta)
	rotate_object_local(Vector3.UP, angular_velocity.y * delta)
	rotate_object_local(Vector3.BACK, angular_velocity.z * delta)

	if auto_stabilize_roll and absf(target_roll_input) < 0.01:
		var current_euler: Vector3 = global_transform.basis.get_euler()
		if absf(current_euler.z) > 0.002:
			current_euler.z = move_toward(
				current_euler.z,
				0.0,
				roll_stabilize_speed * roll_stability_multiplier * delta
			)
			global_transform.basis = Basis.from_euler(current_euler).orthonormalized()
	else:
		global_transform.basis = global_transform.basis.orthonormalized()

## Declanșează Frânarea Gravitațională Automată (`Hyper-Drop`) când distanța reală `dist` față de o planetă
## scade sub `2.2 * raza_planetei`: scoate automat nava din HYPER cu o decelerare rapidă și sigură (1.5 secunde),
## sunet profund de bas și oprire la o altitudine panoramică unde planeta gigant domină tot parbrizul.
func trigger_hyper_drop(
	body_id: String = "",
	body_name: String = "",
	body_radius: float = -1.0
) -> void:
	var target_id: String = body_id if not body_id.is_empty() else nearest_body_id
	var target_name: String = body_name if not body_name.is_empty() else nearest_body_name
	var target_r: float = body_radius if body_radius > 0.0 else nearest_body_radius

	hyper_drop_active = true
	hyper_drop_timer = HYPER_DROP_DURATION_SEC
	_hyper_drop_lock_until_release = true
	hyper_elapsed_sec = 0.0
	hyper_drop_count += 1
	current_tier = PropulsionTier.MANEUVER

	var fwd: Vector3 = -global_transform.basis.z
	if velocity.length_squared() > 1.0:
		fwd = velocity.normalized()
	_hyper_drop_initial_dir = fwd.normalized()
	# Glisare controlată pe durata celor 1.5s astfel încât nava să se oprească la altitudine panoramică (~1.9 * R)
	_hyper_drop_initial_speed = clampf(target_r * 0.45, 1200.0, 36000.0)
	velocity = _hyper_drop_initial_dir * _hyper_drop_initial_speed

	if audio_controller != null and audio_controller.has_method("play_hyper_drop_bass"):
		audio_controller.play_hyper_drop_bass()

	_broadcast_pilot_comms("hyper_drop", target_id)
	propulsion_tier_changed.emit(get_propulsion_tier_name_ro())
	hyper_drop_triggered.emit(target_id, target_name)

func _update_propulsion_and_dampeners(delta: float) -> void:
	# Dacă nava se află în secvența de 1.5 secunde de Frânare Gravitațională Automată (Hyper-Drop):
	if hyper_drop_active:
		hyper_drop_timer = maxf(0.0, hyper_drop_timer - delta)
		var rem_ratio: float = hyper_drop_timer / HYPER_DROP_DURATION_SEC
		# Decelerare parabolică lină până la oprire completă (0 m/s) la finalul celor 1.5 secunde
		velocity = _hyper_drop_initial_dir * (_hyper_drop_initial_speed * rem_ratio * rem_ratio)
		current_throttle = rem_ratio * 0.5
		if hyper_drop_timer <= 0.0:
			hyper_drop_active = false
			velocity = Vector3.ZERO
			current_throttle = 0.0
			propulsion_tier_changed.emit(get_propulsion_tier_name_ro())
		return

	var local_input := Vector3.ZERO

	if engines_online:
		if Input.is_key_pressed(KEY_W):
			local_input.z -= 1.0
		if Input.is_key_pressed(KEY_S):
			local_input.z += 1.0
		if Input.is_key_pressed(KEY_A):
			local_input.x -= 1.0
		if Input.is_key_pressed(KEY_D):
			local_input.x += 1.0
		if Input.is_key_pressed(KEY_CTRL):
			local_input.y -= 1.0

		var joy_lx: float = Input.get_joy_axis(0, JOY_AXIS_LEFT_X)
		var joy_ly: float = Input.get_joy_axis(0, JOY_AXIS_LEFT_Y)
		if absf(joy_lx) > gamepad_deadzone:
			local_input.x += joy_lx
		if absf(joy_ly) > gamepad_deadzone:
			local_input.z += joy_ly

	var raw_want_warp: bool = engines_online and (Input.is_key_pressed(KEY_SPACE) or Input.is_joy_button_pressed(0, JOY_BUTTON_Y))
	if not raw_want_warp:
		_hyper_drop_lock_until_release = false
	var want_warp: bool = raw_want_warp and not _hyper_drop_lock_until_release
	var want_boost: bool = engines_online and (Input.is_key_pressed(KEY_SHIFT) or Input.is_joy_button_pressed(0, JOY_BUTTON_A))

	if want_warp and local_input.length_squared() < 0.01:
		local_input.z = -1.0

	if local_input.length_squared() > 1.0:
		local_input = local_input.normalized()

	var world_input_dir: Vector3 = (global_transform.basis * local_input)
	if world_input_dir.length_squared() > 0.001:
		world_input_dir = world_input_dir.normalized()

	# Verificăm dacă nava este sub 2.2 * raza_planetei și orientată spre planetă
	var approaching_nearest: bool = false
	if space_core != null and nearest_center_distance <= nearest_body_radius * HYPER_DROP_RADIUS_MULT:
		var dir_to_planet: Vector3 = space_core.get_true_planet_direction(nearest_body_id, simulation_time_days)
		var check_dir: Vector3 = world_input_dir if world_input_dir.length_squared() > 0.001 else -global_transform.basis.z
		approaching_nearest = (dir_to_planet.dot(check_dir) > 0.15)

	var prev_tier: PropulsionTier = current_tier
	if want_warp:
		if current_tier == PropulsionTier.MINI_WARP and nearest_center_distance <= nearest_body_radius * HYPER_DROP_RADIUS_MULT and approaching_nearest:
			trigger_hyper_drop(nearest_body_id, nearest_body_name, nearest_body_radius)
			return
		elif warp_allowed and not approaching_nearest:
			current_tier = PropulsionTier.MINI_WARP
		else:
			current_tier = PropulsionTier.BOOST if want_boost else PropulsionTier.MANEUVER
			_broadcast_pilot_comms("warp_blocked", nearest_body_id)
			warp_blocked_by_proximity.emit(nearest_body_name)
	elif want_boost and local_input.length_squared() > 0.001:
		current_tier = PropulsionTier.BOOST
	else:
		current_tier = PropulsionTier.MANEUVER

	if current_tier != prev_tier:
		if current_tier == PropulsionTier.MINI_WARP:
			hyper_elapsed_sec = 0.0
			_broadcast_pilot_comms("warp_engage", nearest_body_id)
		else:
			hyper_elapsed_sec = 0.0
		propulsion_tier_changed.emit(get_propulsion_tier_name_ro())

	if current_tier == PropulsionTier.MINI_WARP:
		# Accelerație exponențială în HYPER: de la 500.000 u/s (0.2 c) până la 20.000.000 u/s (8.0 c)
		hyper_elapsed_sec += delta
		var exp_speed: float = warp_min_speed * exp(hyper_exp_growth_rate * hyper_elapsed_sec)
		var max_hyper: float = warp_max_speed * maxf(warp_speed_multiplier, 1.0)
		var target_hyper_speed: float = clampf(exp_speed, warp_min_speed, max_hyper)
		var hyper_dir: Vector3 = world_input_dir if world_input_dir.length_squared() > 0.001 else -global_transform.basis.z
		velocity = hyper_dir.normalized() * target_hyper_speed
		current_throttle = clampf(target_hyper_speed / max_hyper, 0.2, 1.0)
		return

	# Zbor sub-luminic (Manevră: 50 .. 500 m/s | Boost: până la 3.000 m/s)
	var raw_max_speed: float = maneuver_max_speed
	var active_accel: float = maneuver_acceleration

	if current_tier == PropulsionTier.BOOST:
		raw_max_speed = boost_max_speed
		active_accel = boost_acceleration

	var effective_max_speed: float = maxf(raw_max_speed * safety_speed_limit_factor, maneuver_min_speed)

	if engines_online and world_input_dir.length_squared() > 0.001:
		var target_velocity: Vector3 = world_input_dir * effective_max_speed
		if velocity.length() < maneuver_min_speed:
			velocity = world_input_dir * maneuver_min_speed
		velocity = velocity.move_toward(target_velocity, active_accel * delta)
	else:
		if inertial_dampeners_enabled:
			velocity = velocity.lerp(Vector3.ZERO, clampf(dampener_drag * delta, 0.0, 1.0))
			velocity = velocity.move_toward(Vector3.ZERO, dampener_stop_deceleration * delta)

	if velocity.length() > boost_max_speed:
		velocity = velocity.normalized() * boost_max_speed

	current_throttle = clampf(velocity.length() / maxf(effective_max_speed, 1.0), 0.0, 1.0) if engines_online else 0.0

func _update_visual_effects(delta: float) -> void:
	if visual_pivot != null:
		# Înclinare dinamică a navei în cadru la viraje
		var target_bank_z: float = clampf(-angular_velocity.y * 0.34 - angular_velocity.z * 0.24, -0.60, 0.60)
		var target_bank_x: float = clampf(angular_velocity.x * 0.18, -0.35, 0.35)
		visual_pivot.rotation.z = lerpf(visual_pivot.rotation.z, target_bank_z, clampf(delta * 8.5, 0.0, 1.0))
		visual_pivot.rotation.x = lerpf(visual_pivot.rotation.x, target_bank_x, clampf(delta * 8.5, 0.0, 1.0))

	if boost_particles != null:
		var is_thrusting: bool = engines_online and velocity.length() > 0.4
		boost_particles.emitting = is_thrusting
		if current_tier == PropulsionTier.MINI_WARP:
			boost_particles.initial_velocity_min = 18.0
			boost_particles.initial_velocity_max = 28.0
		elif current_tier == PropulsionTier.BOOST:
			boost_particles.initial_velocity_min = 10.0
			boost_particles.initial_velocity_max = 16.0
		else:
			boost_particles.initial_velocity_min = 4.0
			boost_particles.initial_velocity_max = 7.5

	if warp_streaks != null:
		var warp_active: bool = (engines_online and current_tier == PropulsionTier.MINI_WARP and velocity.length() > boost_max_speed * 0.6)
		warp_streaks.visible = warp_active
		if warp_active:
			_warp_streak_phase = fmod(_warp_streak_phase + delta * 36.0, 40.0)
			warp_streaks.position.z = _warp_streak_phase * 0.5

func _setup_warp_streaks_multimesh() -> void:
	if warp_streaks == null:
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	var streak_mesh := BoxMesh.new()
	streak_mesh.size = Vector3(0.025, 0.025, 3.8)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.35, 0.92, 1.0, 0.85)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	streak_mesh.material = mat
	mm.mesh = streak_mesh

	var streak_count: int = 160
	mm.instance_count = streak_count
	var rng := RandomNumberGenerator.new()
	rng.seed = 20261112
	for i in range(streak_count):
		var angle: float = rng.randf_range(0.0, TAU)
		var radius: float = rng.randf_range(2.2, 11.5)
		var z_pos: float = rng.randf_range(-42.0, 4.0)
		var pos := Vector3(cos(angle) * radius, sin(angle) * radius * 0.75, z_pos)
		var basis := Basis.IDENTITY.scaled(Vector3(1.0, 1.0, rng.randf_range(0.8, 2.2)))
		mm.set_instance_transform(i, Transform3D(basis, pos))

	warp_streaks.multimesh = mm
	warp_streaks.visible = false

func get_propulsion_tier_name_ro() -> String:
	if not engines_online:
		return "Motoare Oprite — Plutire Silențioasă [E]"
	if hyper_drop_active:
		return "HYPER-DROP — Frânare Gravitațională Automată!"
	match current_tier:
		PropulsionTier.MANEUVER:
			return "Manevră Sub-Luminică (WASD)"
		PropulsionTier.BOOST:
			return "Impuls / Boost (Shift)"
		PropulsionTier.MINI_WARP:
			return "HYPER Interplanetar (Space)"
	return "Manevră"

## Returnează viteza curentă exprimată în multiplii vitezei luminii (`c`), unde `2.500.000 u/s = 1.0 c`
## (`500.000 u/s = 0.2 c`, `3.750.000 u/s = 1.5 c`, `20.000.000 u/s = 8.0 c`).
func get_speed_in_c() -> float:
	return velocity.length() / UNITS_PER_SPEED_OF_LIGHT_C

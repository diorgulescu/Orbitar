# SPDX-License-Identifier: GPL-3.0-or-later
class_name ShipCameraRig
extends Node3D

## Sistemul Dual de Camere al Navei (`ShipCameraRig`) pentru Orbitar 3D:
## 1. Cockpit View (First-Person):
##    - Instanțiază și coordonează scena cabinei 3D (`res://scenes/ships/cockpit_interior.tscn`)
##      cu suport pentru cele 3 nave (Lăcusta / Vulturul / Stânca), mascota pe arc,
##      Proiectorul Holografic Central (3D Mini-Orrery), Ecranul Stâng (`SubViewport` Navigator & Scanner)
##      și Ecranul Drept (`SubViewport` Comunicații Pilot).
##    - Free-Look în cabină (Alt / Click Dreapta / Stick Dreapta): ±85° orizontal, ±55° vertical,
##      cu revenire lină la centru la eliberare.
##    - Inerție subtilă (G-force camera offset) la accelerare, frânare și viraje.
## 2. Chase View (Third-Person):
##    - Pivot cu `SpringArm3D` în spatele și ușor deasupra navei.
##    - Urmărire elastică (smooth damping pe rotație și poziție), înclinare dinamică în cadru
##      și creșterea FOV-ului la Boost de la 70° la 85°.
##    - Rotire liberă la 360° în jurul navei când este ținut apăsat Free-Look.
## 3. Tranziție interpolată prin `Tween` de 0.35 secunde pe tasta `C`.

signal camera_view_changed(mode_index: int, mode_name_ro: String)
signal transition_finished(mode_index: int)

enum ViewMode {
	CHASE_THIRD_PERSON = 0,
	COCKPIT_FIRST_PERSON = 1,
}

const COCKPIT_SCENE_PATH := "res://scenes/ships/cockpit_interior.tscn"
const TRANSITION_DURATION_SEC: float = 0.35
const COCKPIT_FREELOOK_MAX_YAW_DEG: float = 85.0
const COCKPIT_FREELOOK_MAX_PITCH_DEG: float = 55.0
const CHASE_FREELOOK_MAX_PITCH_DEG: float = 75.0

const CHASE_BASE_FOV: float = 70.0
const CHASE_BOOST_FOV: float = 85.0
const CHASE_WARP_FOV: float = 92.0
const COCKPIT_BASE_FOV: float = 70.0
const COCKPIT_BOOST_FOV: float = 80.0
const COCKPIT_WARP_FOV: float = 88.0

@export var spring_arm_length: float = 4.6
@export var chase_pivot_height: float = 1.25
@export var chase_pitch_angle_deg: float = -10.0
@export var chase_position_damping: float = 9.0
@export var chase_rotation_damping: float = 8.5
@export var freelook_mouse_sensitivity: float = 0.22
@export var freelook_return_speed: float = 7.5
@export var g_force_smoothing: float = 10.0
@export var g_force_max_offset: Vector3 = Vector3(0.065, 0.045, 0.085)

var current_view_mode: ViewMode = ViewMode.CHASE_THIRD_PERSON
var transition_blend: float = 0.0
var is_transitioning: bool = false
var _active_tween: Tween = null

# Starea Free-Look (±85° orizontal, ±55° vertical în Cockpit; 360° în Chase View)
var freelook_active: bool = false
var _manual_freelook_override: bool = false
var cockpit_look_yaw_deg: float = 0.0
var cockpit_look_pitch_deg: float = 0.0
var chase_orbit_yaw_deg: float = 0.0
var chase_orbit_pitch_deg: float = 0.0

# Starea G-force & Damping
var _prev_local_velocity: Vector3 = Vector3.ZERO
var g_force_offset: Vector3 = Vector3.ZERO
var g_force_roll_rad: float = 0.0
var _damped_chase_lag_offset: Vector3 = Vector3.ZERO
var _damped_chase_rot_offset: Vector3 = Vector3.ZERO
var _current_chase_fov: float = CHASE_BASE_FOV
var _current_cockpit_fov: float = COCKPIT_BASE_FOV

var dashboard_power_level: float = 1.0
var cockpit_interior_root: Node3D = null

# Nodurile de cameră
var chase_pivot: Node3D = null
var spring_arm: SpringArm3D = null
var chase_camera: Camera3D = null
var cockpit_head_pivot: Node3D = null
var cockpit_camera: Camera3D = null

func _ready() -> void:
	_setup_camera_nodes()
	_setup_cockpit_interior_scene()
	_apply_instant_mode_state(current_view_mode)

func _exit_tree() -> void:
	if _active_tween != null and _active_tween.is_valid():
		_active_tween.kill()
	_active_tween = null

func _setup_camera_nodes() -> void:
	chase_pivot = get_node_or_null("ChaseCameraPivot") as Node3D
	if chase_pivot == null:
		chase_pivot = Node3D.new()
		chase_pivot.name = "ChaseCameraPivot"
		add_child(chase_pivot)
	chase_pivot.position = Vector3(0.0, chase_pivot_height, 0.0)

	spring_arm = chase_pivot.get_node_or_null("ChaseSpringArm3D") as SpringArm3D
	if spring_arm == null:
		spring_arm = SpringArm3D.new()
		spring_arm.name = "ChaseSpringArm3D"
		chase_pivot.add_child(spring_arm)
	spring_arm.spring_length = spring_arm_length
	spring_arm.margin = 0.25
	spring_arm.rotation_degrees = Vector3(chase_pitch_angle_deg, 0.0, 0.0)

	chase_camera = spring_arm.get_node_or_null("ChaseCamera3D") as Camera3D
	if chase_camera == null:
		chase_camera = Camera3D.new()
		chase_camera.name = "ChaseCamera3D"
		spring_arm.add_child(chase_camera)

	chase_camera.position = Vector3(0.0, 0.0, spring_arm_length)
	chase_camera.rotation = Vector3.ZERO
	chase_camera.fov = CHASE_BASE_FOV
	chase_camera.near = 0.1
	chase_camera.far = 250000.0

	cockpit_head_pivot = get_node_or_null("CockpitHeadPivot") as Node3D
	if cockpit_head_pivot == null:
		cockpit_head_pivot = Node3D.new()
		cockpit_head_pivot.name = "CockpitHeadPivot"
		add_child(cockpit_head_pivot)
	cockpit_head_pivot.position = Vector3(0.0, 0.24, -0.42)

	cockpit_camera = cockpit_head_pivot.get_node_or_null("CockpitCamera3D") as Camera3D
	if cockpit_camera == null:
		cockpit_camera = Camera3D.new()
		cockpit_camera.name = "CockpitCamera3D"
		cockpit_head_pivot.add_child(cockpit_camera)

	cockpit_camera.position = Vector3.ZERO
	cockpit_camera.rotation = Vector3.ZERO
	cockpit_camera.fov = COCKPIT_BASE_FOV
	cockpit_camera.near = 0.1
	cockpit_camera.far = 250000.0

func _setup_cockpit_interior_scene() -> void:
	cockpit_interior_root = get_node_or_null("CockpitInterior") as Node3D
	if cockpit_interior_root == null and ResourceLoader.exists(COCKPIT_SCENE_PATH):
		var packed: PackedScene = load(COCKPIT_SCENE_PATH) as PackedScene
		if packed != null:
			cockpit_interior_root = packed.instantiate() as Node3D
			cockpit_interior_root.name = "CockpitInterior"
			add_child(cockpit_interior_root)

func toggle_view_mode(animate: bool = true) -> ViewMode:
	var target: ViewMode = (
		ViewMode.COCKPIT_FIRST_PERSON
		if current_view_mode == ViewMode.CHASE_THIRD_PERSON
		else ViewMode.CHASE_THIRD_PERSON
	)
	set_view_mode(target, animate)
	return current_view_mode

func set_view_mode(target_mode: ViewMode, animate: bool = true) -> void:
	current_view_mode = target_mode
	var target_blend: float = 1.0 if target_mode == ViewMode.COCKPIT_FIRST_PERSON else 0.0

	if _active_tween != null and _active_tween.is_valid():
		_active_tween.kill()

	if not animate or not is_inside_tree():
		_apply_instant_mode_state(target_mode)
		camera_view_changed.emit(int(current_view_mode), get_view_mode_name_ro())
		transition_finished.emit(int(current_view_mode))
		return

	is_transitioning = true
	if cockpit_interior_root != null:
		cockpit_interior_root.visible = true

	var start_xform: Transform3D = (
		cockpit_camera.global_transform
		if target_mode == ViewMode.CHASE_THIRD_PERSON
		else chase_camera.global_transform
	)
	var start_fov: float = (
		cockpit_camera.fov
		if target_mode == ViewMode.CHASE_THIRD_PERSON
		else chase_camera.fov
	)

	var dest_cam: Camera3D = cockpit_camera if target_mode == ViewMode.COCKPIT_FIRST_PERSON else chase_camera
	var other_cam: Camera3D = chase_camera if target_mode == ViewMode.COCKPIT_FIRST_PERSON else cockpit_camera
	if other_cam != null:
		other_cam.current = false
	if dest_cam != null:
		dest_cam.current = true

	_active_tween = create_tween()
	_active_tween.set_trans(Tween.TRANS_CUBIC)
	_active_tween.set_ease(Tween.EASE_IN_OUT)
	_active_tween.tween_method(
		func(alpha: float) -> void:
			transition_blend = lerpf(1.0 - target_blend, target_blend, alpha)
			if dest_cam != null and is_inside_tree():
				var end_xform: Transform3D = _get_ideal_camera_global_transform(target_mode)
				var end_fov: float = _current_cockpit_fov if target_mode == ViewMode.COCKPIT_FIRST_PERSON else _current_chase_fov
				dest_cam.global_transform = start_xform.interpolate_with(end_xform, alpha)
				dest_cam.fov = lerpf(start_fov, end_fov, alpha)
	, 0.0, 1.0, TRANSITION_DURATION_SEC)

	_active_tween.finished.connect(func() -> void:
		is_transitioning = false
		_apply_instant_mode_state(target_mode)
		transition_finished.emit(int(current_view_mode))
	)

	camera_view_changed.emit(int(current_view_mode), get_view_mode_name_ro())

func _apply_instant_mode_state(mode: ViewMode) -> void:
	transition_blend = 1.0 if mode == ViewMode.COCKPIT_FIRST_PERSON else 0.0
	is_transitioning = false
	if chase_camera != null:
		chase_camera.current = (mode == ViewMode.CHASE_THIRD_PERSON)
		chase_camera.position = Vector3(0.0, 0.0, spring_arm_length)
		chase_camera.rotation = Vector3.ZERO
	if cockpit_camera != null:
		cockpit_camera.current = (mode == ViewMode.COCKPIT_FIRST_PERSON)
		cockpit_camera.position = Vector3.ZERO
		cockpit_camera.rotation = Vector3.ZERO
	if cockpit_interior_root != null:
		cockpit_interior_root.visible = (mode == ViewMode.COCKPIT_FIRST_PERSON)

func _get_ideal_camera_global_transform(mode: ViewMode) -> Transform3D:
	if mode == ViewMode.COCKPIT_FIRST_PERSON and cockpit_head_pivot != null:
		return cockpit_head_pivot.global_transform
	if spring_arm != null:
		return spring_arm.global_transform.translated_local(Vector3(0.0, 0.0, spring_arm.get_hit_length()))
	return global_transform

## Rotește privirea în Free-Look:
## În Cockpit: ±85° orizontal și ±55° vertical.
## În Chase View: 360° în jurul navei.
func apply_freelook_input_degrees(delta_yaw_deg: float, delta_pitch_deg: float) -> void:
	if current_view_mode == ViewMode.COCKPIT_FIRST_PERSON:
		cockpit_look_yaw_deg = clampf(
			cockpit_look_yaw_deg + delta_yaw_deg,
			-COCKPIT_FREELOOK_MAX_YAW_DEG,
			COCKPIT_FREELOOK_MAX_YAW_DEG
		)
		cockpit_look_pitch_deg = clampf(
			cockpit_look_pitch_deg + delta_pitch_deg,
			-COCKPIT_FREELOOK_MAX_PITCH_DEG,
			COCKPIT_FREELOOK_MAX_PITCH_DEG
		)
	else:
		chase_orbit_yaw_deg = wrapf(chase_orbit_yaw_deg + delta_yaw_deg, -180.0, 180.0)
		chase_orbit_pitch_deg = clampf(
			chase_orbit_pitch_deg + delta_pitch_deg,
			-CHASE_FREELOOK_MAX_PITCH_DEG,
			CHASE_FREELOOK_MAX_PITCH_DEG
		)

func set_freelook_override(enabled: bool) -> void:
	_manual_freelook_override = enabled
	freelook_active = enabled

func is_freelook_held() -> bool:
	if _manual_freelook_override:
		return true
	return Input.is_key_pressed(KEY_ALT) or Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT)

func update_rig(
	delta: float,
	local_velocity: Vector3,
	angular_vel: Vector3,
	propulsion_tier: int,
	max_maneuver_speed: float,
	nearest_planet_name: String,
	nearest_altitude: float,
	engine_power_progress: float,
	space_core: OrbitarSpaceCore = null,
	sim_time_days: float = 0.0,
	engines_online: bool = true,
	nearest_body_id: String = "earth",
	is_scanning: bool = false,
	scan_progress: float = 0.0
) -> void:
	if delta <= 0.0:
		return

	dashboard_power_level = clampf(engine_power_progress, 0.0, 1.0)
	freelook_active = is_freelook_held()

	if freelook_active:
		var joy_rx: float = Input.get_joy_axis(0, JOY_AXIS_RIGHT_X)
		var joy_ry: float = Input.get_joy_axis(0, JOY_AXIS_RIGHT_Y)
		if absf(joy_rx) > 0.15 or absf(joy_ry) > 0.15:
			apply_freelook_input_degrees(-joy_rx * 110.0 * delta, -joy_ry * 85.0 * delta)
	else:
		var return_t: float = clampf(freelook_return_speed * delta, 0.0, 1.0)
		cockpit_look_yaw_deg = lerpf(cockpit_look_yaw_deg, 0.0, return_t)
		cockpit_look_pitch_deg = lerpf(cockpit_look_pitch_deg, 0.0, return_t)
		chase_orbit_yaw_deg = lerpf(chase_orbit_yaw_deg, 0.0, return_t)
		chase_orbit_pitch_deg = lerpf(chase_orbit_pitch_deg, 0.0, return_t)

	# 1. Inerție G-force la accelerare, frânare și viraje
	var local_accel: Vector3 = (local_velocity - _prev_local_velocity) / maxf(delta, 0.001)
	_prev_local_velocity = local_velocity

	var target_g_offset := Vector3(
		clampf(-local_accel.x * 0.0018 - angular_vel.y * 0.025, -g_force_max_offset.x, g_force_max_offset.x),
		clampf(-local_accel.y * 0.0015 + angular_vel.x * 0.018, -g_force_max_offset.y, g_force_max_offset.y),
		clampf(-local_accel.z * 0.0022, -g_force_max_offset.z, g_force_max_offset.z)
	)
	g_force_offset = g_force_offset.lerp(target_g_offset, clampf(g_force_smoothing * delta, 0.0, 1.0))
	g_force_roll_rad = lerpf(
		g_force_roll_rad,
		clampf(-angular_vel.y * 0.045 - angular_vel.z * 0.035, -0.12, 0.12),
		clampf(g_force_smoothing * delta, 0.0, 1.0)
	)

	if cockpit_head_pivot != null:
		cockpit_head_pivot.position = Vector3(0.0, 0.24, -0.42) + g_force_offset
		cockpit_head_pivot.rotation = Vector3(
			deg_to_rad(cockpit_look_pitch_deg),
			deg_to_rad(cockpit_look_yaw_deg),
			g_force_roll_rad
		)

	# 2. Urmărire elastică (smooth damping) în Chase View (SpringArm3D)
	var speed_len: float = local_velocity.length()
	var desired_chase_lag := Vector3(
		clampf(angular_vel.y * 0.38, -0.75, 0.75),
		clampf(-angular_vel.x * 0.26, -0.50, 0.50),
		clampf((speed_len / maxf(max_maneuver_speed * 3.0, 1.0)) * 0.65, 0.0, 0.85)
	)
	_damped_chase_lag_offset = _damped_chase_lag_offset.lerp(
		desired_chase_lag,
		clampf(chase_position_damping * delta, 0.0, 1.0)
	)

	var desired_chase_rot := Vector3(
		deg_to_rad(chase_pitch_angle_deg + chase_orbit_pitch_deg) - angular_vel.x * 0.08,
		deg_to_rad(chase_orbit_yaw_deg) + angular_vel.y * 0.10,
		-angular_vel.y * 0.14 - angular_vel.z * 0.10
	)
	_damped_chase_rot_offset = _damped_chase_rot_offset.lerp(
		desired_chase_rot,
		clampf(chase_rotation_damping * delta, 0.0, 1.0)
	)

	if chase_pivot != null:
		chase_pivot.position = Vector3(0.0, chase_pivot_height, 0.0) + _damped_chase_lag_offset
	if spring_arm != null:
		spring_arm.rotation = _damped_chase_rot_offset

	# 3. FOV dinamic (70° -> 85° în Boost, 92° în Mini-Warp)
	var target_chase_fov: float = CHASE_BASE_FOV
	var target_cockpit_fov: float = COCKPIT_BASE_FOV
	if propulsion_tier == 2:
		target_chase_fov = CHASE_WARP_FOV
		target_cockpit_fov = COCKPIT_WARP_FOV
	elif propulsion_tier == 1:
		target_chase_fov = CHASE_BOOST_FOV
		target_cockpit_fov = COCKPIT_BOOST_FOV
	elif speed_len > 0.5:
		var speed_ratio: float = clampf(speed_len / maxf(max_maneuver_speed, 1.0), 0.0, 1.0)
		target_chase_fov = lerpf(CHASE_BASE_FOV, 74.0, speed_ratio)
		target_cockpit_fov = lerpf(COCKPIT_BASE_FOV, 73.0, speed_ratio)

	_current_chase_fov = lerpf(_current_chase_fov, target_chase_fov, clampf(delta * 7.0, 0.0, 1.0))
	_current_cockpit_fov = lerpf(_current_cockpit_fov, target_cockpit_fov, clampf(delta * 7.0, 0.0, 1.0))

	if not is_transitioning:
		if chase_camera != null:
			chase_camera.fov = _current_chase_fov
		if cockpit_camera != null:
			cockpit_camera.fov = _current_cockpit_fov

	# 4. Actualizăm Cabina 3D Interactivă (Mascota pe arc, Proiectorul 3D Mini-Orrery, SubViewport-urile)
	if cockpit_interior_root != null and cockpit_interior_root.has_method("update_cockpit_instruments"):
		cockpit_interior_root.update_cockpit_instruments(
			delta,
			space_core,
			sim_time_days,
			local_accel,
			angular_vel,
			speed_len,
			max_maneuver_speed,
			propulsion_tier,
			engines_online,
			dashboard_power_level,
			nearest_body_id,
			nearest_planet_name,
			nearest_altitude,
			is_scanning,
			scan_progress
		)

func get_view_mode_name_ro() -> String:
	return (
		"Cockpit 1st-Person (Cabină 3D)"
		if current_view_mode == ViewMode.COCKPIT_FIRST_PERSON
		else "Chase 3rd-Person (SpringArm3D)"
	)

# SPDX-License-Identifier: GPL-3.0-or-later
class_name SpaceWorld
extends Node3D

## Generatorul Sistemului Solar 3D din Orbitar (Faza 2).
## Construiește dinamic Soarele, planetele, sateliții, atmosferele Fresnel și câmpul MultiMeshInstance3D
## al inelelor lui Saturn pe baza datelor din `OrbitarSpaceCore` (Rust), menținând nava jucătorului în
## originea scenei (0, 0, 0) prin sistemul Floating Origin în f64.

signal quality_mode_changed(new_mode: String)

const ATMOSPHERE_SHADER_PATH := "res://assets/shaders/atmosphere_fresnel.gdshader"
const SUN_SHADER_PATH := "res://assets/shaders/sun_plasma.gdshader"

@export var simulation_days_per_second: float = 0.02
@export var initial_spawn_planet_id: String = "earth"
@export var initial_spawn_distance_multiplier: float = 2.35
@export var saturn_ring_asteroids_hd: int = 1600
@export var saturn_ring_asteroids_eco: int = 500

@onready var space_core: OrbitarSpaceCore = $OrbitarSpaceCore
@onready var bodies_root: Node3D = $CelestialBodiesRoot
@onready var sun_light: DirectionalLight3D = $SunDirectionalLight
@onready var player_ship: Node3D = $PlayerShip
@onready var space_hud: CanvasLayer = $SpaceHud

# Dicționar id -> Node3D pentru fiecare corp ceresc instanțiat în scenă
var body_nodes: Dictionary = {}
# Dicționar id -> Dictionary (metadatele din Rust)
var body_catalog_map: Dictionary = {}
# Referințe pentru comutarea în timp real între Modul Eco (2K) și Modul HD (4K)
var body_primary_meshes: Dictionary = {}
var body_cloud_meshes: Dictionary = {}
var body_atmosphere_materials: Dictionary = {}
var saturn_asteroids_multimesh: MultiMeshInstance3D = null

var simulation_time_days: float = 0.0
var quality_mode: String = "hd"

var _sphere_mesh_hd: SphereMesh = null
var _sphere_mesh_eco: SphereMesh = null
var _atmosphere_shader: Shader = null
var _sun_shader: Shader = null
var _texture_cache: Dictionary = {}

func _ready() -> void:
	_init_shared_resources()

	if space_core == null:
		push_error("[SpaceWorld] Eroare critică: OrbitarSpaceCore lipsește din scenă!")
		return

	quality_mode = space_core.get_quality_mode()
	_build_solar_system_from_rust()

	# Ancorăm poziția inițială f64 a navei în apropierea Pământului, cu nava stabilă în (0, 0, 0)
	space_core.station_ship_near_planet(
		initial_spawn_planet_id,
		simulation_time_days,
		initial_spawn_distance_multiplier
	)

	if player_ship != null:
		player_ship.bind_space_core(space_core)
		player_ship.simulation_time_days = simulation_time_days

	if space_hud != null and space_hud.has_method("bind_systems"):
		space_hud.bind_systems(space_core, player_ship)

	_update_all_planet_positions_from_rust(0.0)

	# Orientăm inițial nava către Pământ ca jucătorul să îl vadă imediat în față
	if player_ship != null and body_nodes.has(initial_spawn_planet_id):
		var earth_node: Node3D = body_nodes[initial_spawn_planet_id]
		if earth_node.position.length_squared() > 0.01:
			player_ship.look_at(earth_node.position, Vector3.UP)

	print("🌌 [SpaceWorld] Sistemul Solar 3D a fost generat: %d corpuri active | Mod Grafic: %s | Floating Origin f64: ACTIV" % [
		body_nodes.size(), quality_mode.to_upper()
	])

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_F2:
			toggle_quality_mode()

func _init_shared_resources() -> void:
	_sphere_mesh_hd = SphereMesh.new()
	_sphere_mesh_hd.radius = 1.0
	_sphere_mesh_hd.height = 2.0
	_sphere_mesh_hd.radial_segments = 64
	_sphere_mesh_hd.rings = 32

	_sphere_mesh_eco = SphereMesh.new()
	_sphere_mesh_eco.radius = 1.0
	_sphere_mesh_eco.height = 2.0
	_sphere_mesh_eco.radial_segments = 28
	_sphere_mesh_eco.rings = 14

	if ResourceLoader.exists(ATMOSPHERE_SHADER_PATH):
		_atmosphere_shader = load(ATMOSPHERE_SHADER_PATH) as Shader
	if ResourceLoader.exists(SUN_SHADER_PATH):
		_sun_shader = load(SUN_SHADER_PATH) as Shader

func _build_solar_system_from_rust() -> void:
	var catalog: Array = space_core.get_celestial_catalog()
	for entry in catalog:
		var body_id: String = entry.get("id", "")
		if body_id.is_empty():
			continue
		body_catalog_map[body_id] = entry
		var body_root := _create_celestial_body_node(entry)
		bodies_root.add_child(body_root)
		body_nodes[body_id] = body_root

func _create_celestial_body_node(entry: Dictionary) -> Node3D:
	var body_id: String = entry.get("id", "")
	var body_name: String = entry.get("name", body_id)
	var scaled_r: float = maxf(float(entry.get("scaled_radius", 1.0)), 0.02)
	var tilt_deg: float = float(entry.get("axial_tilt_deg", 0.0))

	var root := Node3D.new()
	root.name = "Body_" + body_id
	root.set_meta("body_id", body_id)
	root.set_meta("body_name", body_name)

	var tilt_pivot := Node3D.new()
	tilt_pivot.name = "AxialTiltPivot"
	tilt_pivot.rotation.z = deg_to_rad(tilt_deg)
	root.add_child(tilt_pivot)

	var primary_mesh := MeshInstance3D.new()
	primary_mesh.name = "PrimarySphere"
	primary_mesh.mesh = _sphere_mesh_hd if quality_mode == "hd" else _sphere_mesh_eco
	primary_mesh.scale = Vector3.ONE * scaled_r
	if body_id == "haumea":
		primary_mesh.scale = Vector3(1.34, 0.78, 0.96) * scaled_r

	primary_mesh.material_override = _build_body_material(entry, quality_mode)
	tilt_pivot.add_child(primary_mesh)
	body_primary_meshes[body_id] = primary_mesh

	# Strat de nori pentru Pământ / Venus
	var textures_dict: Dictionary = entry.get("textures", {})
	var clouds_path: String = textures_dict.get("clouds_map", "")
	if not clouds_path.is_empty():
		var cloud_mesh := _create_cloud_layer_mesh(body_id, clouds_path, scaled_r)
		tilt_pivot.add_child(cloud_mesh)
		body_cloud_meshes[body_id] = cloud_mesh

	# Atmosferă Fresnel / Rim lighting pe planetele cu atmosferă + coroana solară
	if body_id == "sun":
		var corona_mesh := _create_atmosphere_mesh(
			scaled_r * 1.28,
			Color(1.0, 0.62, 0.05),
			0.95
		)
		corona_mesh.name = "SolarCoronaFresnel"
		tilt_pivot.add_child(corona_mesh)
	elif bool(entry.get("has_atmosphere", false)):
		var atmo_col := Color.from_string(str(entry.get("atmosphere_color", "#38bdf8")), Color(0.22, 0.74, 0.97))
		var rim_int: float = float(entry.get("atmosphere_rim_intensity", 0.65))
		var outer_scale: float = float(entry.get("atmosphere_outer_scale", 1.03))
		var atmo_mesh := _create_atmosphere_mesh(scaled_r * outer_scale, atmo_col, rim_int)
		atmo_mesh.name = "AtmosphereFresnel"
		tilt_pivot.add_child(atmo_mesh)

	# Inelele lui Saturn + câmpul 3D de gheață/asteroizi (MultiMeshInstance3D)
	if body_id == "saturn":
		var ring_disc := _create_saturn_ring_disc(entry, scaled_r)
		tilt_pivot.add_child(ring_disc)

		saturn_asteroids_multimesh = _create_saturn_ring_asteroids_multimesh(scaled_r)
		tilt_pivot.add_child(saturn_asteroids_multimesh)

	return root

func _build_body_material(entry: Dictionary, mode: String) -> Material:
	var body_id: String = entry.get("id", "")
	var tex_path: String = entry.get("texture_4k", "") if mode == "hd" else entry.get("texture_2k", "")
	var albedo_tex: Texture2D = _load_texture_cached(tex_path)

	# Soarele folosește ShaderMaterial dedicat cu granulație de plasmă
	if body_id == "sun" and _sun_shader != null:
		var sun_mat := ShaderMaterial.new()
		sun_mat.shader = _sun_shader
		if albedo_tex != null:
			sun_mat.set_shader_parameter("sun_texture", albedo_tex)
		return sun_mat

	var mat := StandardMaterial3D.new()
	var fallback_col := Color.from_string(str(entry.get("color", "#cccccc")), Color.WHITE)

	if body_id == "sun":
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.albedo_color = Color(1.0, 0.92, 0.55)
		if albedo_tex != null:
			mat.albedo_texture = albedo_tex
		return mat

	var category: String = entry.get("category", "terrestrial")
	var is_giant: bool = (category == "gas_giant" or category == "ice_giant")

	mat.roughness = 0.64 if is_giant else 0.85
	mat.metallic = 0.04
	if albedo_tex != null:
		mat.albedo_texture = albedo_tex
		mat.albedo_color = Color.WHITE
	else:
		mat.albedo_color = fallback_col

	# Efect Rim nativ suplimentar în StandardMaterial3D pentru planetele cu atmosferă
	if bool(entry.get("has_atmosphere", false)):
		mat.rim_enabled = true
		mat.rim = 0.42
		mat.rim_tint = 0.35

	# În Modul HD (4K) încărcăm și hărțile secundare PBR (bump/normal, ocean roughness, nightlights)
	if mode == "hd":
		var textures_dict: Dictionary = entry.get("textures", {})
		var bump_path: String = textures_dict.get("bump_map", "")
		if not bump_path.is_empty():
			var bump_tex: Texture2D = _load_texture_cached(bump_path)
			if bump_tex != null:
				mat.normal_enabled = true
				mat.normal_texture = bump_tex
				mat.normal_scale = 0.35

		var rough_path: String = textures_dict.get("roughness_map", "")
		if not rough_path.is_empty():
			var rough_tex: Texture2D = _load_texture_cached(rough_path)
			if rough_tex != null:
				mat.roughness_texture = rough_tex

		var night_path: String = textures_dict.get("night_map", "")
		if not night_path.is_empty():
			var night_tex: Texture2D = _load_texture_cached(night_path)
			if night_tex != null:
				mat.emission_enabled = true
				mat.emission_texture = night_tex
				mat.emission_energy_multiplier = 0.55

	return mat

func _create_cloud_layer_mesh(body_id: String, clouds_path: String, scaled_r: float) -> MeshInstance3D:
	var cloud_mesh := MeshInstance3D.new()
	cloud_mesh.name = "CloudLayer"
	cloud_mesh.mesh = _sphere_mesh_hd if quality_mode == "hd" else _sphere_mesh_eco
	var mult: float = 1.015 if body_id == "earth" else 1.018
	cloud_mesh.scale = Vector3.ONE * (scaled_r * mult)

	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.cull_mode = BaseMaterial3D.CULL_BACK
	mat.roughness = 0.75
	var cloud_tex: Texture2D = _load_texture_cached(clouds_path)
	if cloud_tex != null:
		mat.albedo_texture = cloud_tex
	mat.albedo_color = Color(1.0, 1.0, 1.0, 0.86 if body_id == "venus" else 0.72)
	cloud_mesh.material_override = mat
	cloud_mesh.visible = (quality_mode == "hd")
	return cloud_mesh

func _create_atmosphere_mesh(atmo_radius: float, col: Color, intensity: float) -> MeshInstance3D:
	var mesh_inst := MeshInstance3D.new()
	mesh_inst.mesh = _sphere_mesh_hd if quality_mode == "hd" else _sphere_mesh_eco
	mesh_inst.scale = Vector3.ONE * atmo_radius
	mesh_inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

	if _atmosphere_shader != null:
		var smat := ShaderMaterial.new()
		smat.shader = _atmosphere_shader
		smat.set_shader_parameter("atmosphere_color", col)
		smat.set_shader_parameter("rim_intensity", intensity)
		smat.set_shader_parameter("rim_power", 3.1)
		mesh_inst.material_override = smat
		body_atmosphere_materials[mesh_inst.get_instance_id()] = smat
	else:
		var fallback := StandardMaterial3D.new()
		fallback.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		fallback.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		fallback.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		fallback.albedo_color = Color(col.r, col.g, col.b, 0.25)
		mesh_inst.material_override = fallback

	return mesh_inst

func _create_saturn_ring_disc(entry: Dictionary, saturn_radius: float) -> MeshInstance3D:
	var ring_mesh_inst := MeshInstance3D.new()
	ring_mesh_inst.name = "SaturnRingDisc"
	var torus := CylinderMesh.new()
	torus.top_radius = saturn_radius * 2.35
	torus.bottom_radius = saturn_radius * 2.35
	torus.height = maxf(saturn_radius * 0.003, 0.015)
	torus.radial_segments = 64
	ring_mesh_inst.mesh = torus

	var mat := StandardMaterial3D.new()
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	mat.roughness = 0.78
	mat.albedo_color = Color(0.94, 0.86, 0.68, 0.78)

	var textures_dict: Dictionary = entry.get("textures", {})
	var ring_path: String = textures_dict.get("ring_map", "")
	if not ring_path.is_empty():
		var ring_tex: Texture2D = _load_texture_cached(ring_path)
		if ring_tex != null:
			mat.albedo_texture = ring_tex
	ring_mesh_inst.material_override = mat
	return ring_mesh_inst

func _create_saturn_ring_asteroids_multimesh(saturn_radius: float) -> MultiMeshInstance3D:
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "SaturnRingAsteroids"

	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D

	var rock_mesh := SphereMesh.new()
	rock_mesh.radius = 1.0
	rock_mesh.height = 1.8
	rock_mesh.radial_segments = 8
	rock_mesh.rings = 5

	var rock_mat := StandardMaterial3D.new()
	rock_mat.albedo_color = Color(0.88, 0.84, 0.74, 1.0)
	rock_mat.roughness = 0.55
	rock_mat.metallic = 0.15
	rock_mesh.material = rock_mat
	mm.mesh = rock_mesh

	mmi.multimesh = mm
	_populate_saturn_ring_multimesh(mmi, saturn_radius)
	return mmi

func _populate_saturn_ring_multimesh(mmi: MultiMeshInstance3D, saturn_radius: float) -> void:
	if mmi == null or mmi.multimesh == null or space_core == null:
		return
	var count: int = saturn_ring_asteroids_hd if quality_mode == "hd" else saturn_ring_asteroids_eco
	var inner_r: float = saturn_radius * 1.34
	var outer_r: float = saturn_radius * 2.32
	var thickness: float = saturn_radius * 0.06

	var transforms: Array = space_core.generate_saturn_ring_transforms(count, inner_r, outer_r, thickness)
	mmi.multimesh.instance_count = transforms.size()
	for i in range(transforms.size()):
		mmi.multimesh.set_instance_transform(i, transforms[i])

## Comută în timp real între Modul Eco (texturi 2K) și Modul HD (texturi 4K),
## eliberând cache-ul de texturi 4K pentru protejarea memoriei VRAM pe sistemele mai slabe.
func set_quality_mode(new_mode: String) -> void:
	var clean_mode: String = "eco" if new_mode.to_lower() == "eco" else "hd"
	if clean_mode == quality_mode:
		return

	quality_mode = space_core.set_quality_mode(clean_mode)
	if quality_mode == "eco":
		# Eliberăm referințele către texturile 4K/HD din cache pentru a elibera VRAM
		_texture_cache.clear()

	for body_id in body_catalog_map.keys():
		var entry: Dictionary = body_catalog_map[body_id]
		if body_primary_meshes.has(body_id):
			var mesh_inst: MeshInstance3D = body_primary_meshes[body_id]
			mesh_inst.mesh = _sphere_mesh_hd if quality_mode == "hd" else _sphere_mesh_eco
			mesh_inst.material_override = _build_body_material(entry, quality_mode)
		if body_cloud_meshes.has(body_id):
			var cloud_inst: MeshInstance3D = body_cloud_meshes[body_id]
			cloud_inst.visible = (quality_mode == "hd")

	if saturn_asteroids_multimesh != null and body_catalog_map.has("saturn"):
		var sat_r: float = float(body_catalog_map["saturn"].get("scaled_radius", 3.58))
		_populate_saturn_ring_multimesh(saturn_asteroids_multimesh, sat_r)

	print("✨ [SpaceWorld] Mod grafic comutat în timp real: %s" % quality_mode.to_upper())
	quality_mode_changed.emit(quality_mode)

func toggle_quality_mode() -> String:
	var target := "eco" if quality_mode == "hd" else "hd"
	set_quality_mode(target)
	return quality_mode

func _load_texture_cached(res_path: String) -> Texture2D:
	if res_path.is_empty():
		return null
	if _texture_cache.has(res_path):
		return _texture_cache[res_path]

	# În caz că fișierul nu a fost încă importat ca CompressedTexture2D de editorul Godot,
	# îl încărcăm direct din Image pe disc pentru funcționare 100% autonomă și în mod headless.
	if ResourceLoader.exists(res_path):
		var res = load(res_path)
		if res is Texture2D:
			_texture_cache[res_path] = res
			return res

	var global_path: String = ProjectSettings.globalize_path(res_path)
	if FileAccess.file_exists(global_path):
		var img := Image.load_from_file(global_path)
		if img != null and not img.is_empty():
			var tex := ImageTexture.create_from_image(img)
			_texture_cache[res_path] = tex
			return tex

	return null

func _physics_process(delta: float) -> void:
	simulation_time_days += delta * simulation_days_per_second
	if player_ship != null:
		player_ship.simulation_time_days = simulation_time_days

	_update_all_planet_positions_from_rust(delta)

func _update_all_planet_positions_from_rust(delta: float) -> void:
	if space_core == null:
		return

	for body_id in body_nodes.keys():
		var node: Node3D = body_nodes[body_id]
		# Proiecție Optică Anti-Clipping în f64:
		# - Sub OPTICAL_HORIZON (120.000 u): poziție 1:1 și scară 1:1
		# - Peste OPTICAL_HORIZON: poziționare pe sfera 120.000 u și scalare cu OPTICAL_HORIZON / dist
		var proj: Dictionary = space_core.get_planet_optical_projection(body_id, simulation_time_days)
		node.position = proj.get("position", Vector3.ZERO)
		var app_scale: float = maxf(float(proj.get("apparent_scale", 1.0)), 1e-6)
		node.scale = Vector3.ONE * app_scale

		# Rotație axială lină a sferei planetare și a câmpului de inele
		if delta > 0.0 and body_primary_meshes.has(body_id):
			var p_mesh: MeshInstance3D = body_primary_meshes[body_id]
			var entry: Dictionary = body_catalog_map.get(body_id, {})
			var day_hours: float = float(entry.get("day_length_hours", 24.0))
			if absf(day_hours) > 0.01:
				var rot_dir: float = -1.0 if day_hours < 0.0 else 1.0
				var spin_speed: float = clampf(24.0 / absf(day_hours), 0.15, 4.0) * 0.12
				p_mesh.rotate_y(rot_dir * spin_speed * delta)

	if saturn_asteroids_multimesh != null and delta > 0.0:
		saturn_asteroids_multimesh.rotate_y(delta * 0.08)

	# Lumina Soarelui (DirectionalLight3D și shaderele planetare) folosește direcția reală f64,
	# complet neafectată de proiecția optică a nodurilor!
	var true_sun_dir: Vector3 = space_core.get_true_planet_direction("sun", simulation_time_days)
	if true_sun_dir.length_squared() < 0.001:
		true_sun_dir = Vector3(1.0, 0.0, 0.0)
	else:
		true_sun_dir = true_sun_dir.normalized()

	if sun_light != null:
		sun_light.position = Vector3.ZERO
		var up_axis: Vector3 = Vector3.UP if absf(true_sun_dir.dot(Vector3.UP)) < 0.98 else Vector3.RIGHT
		sun_light.look_at(-true_sun_dir, up_axis)

	for smat in body_atmosphere_materials.values():
		if smat is ShaderMaterial:
			smat.set_shader_parameter("sun_direction", true_sun_dir)

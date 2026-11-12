# SPDX-License-Identifier: GPL-3.0-or-later
class_name ShipModelBuilder
extends RefCounted

## Generator procedural modular 3D pentru cele 3 arhetipuri de nave din Orbitar:
## 1. `sonda_lacusta`   — Sonda „Lăcusta” (cupolă panoramică sferică, 4 brațe ionice agile, scanner rapid)
## 2. `naveta_vulturul` — Naveta „Vulturul” (aripi delta, motoare Warp duble, dronă foto pe fuselaj)
## 3. `cargobot_stanca` — Cargobotul „Stânca” (șasiu blindat robust, stabilizatoare grele, antenă radar)

static func build_ship_visual(ship_id: String, custom_color_hex: String = "") -> Node3D:
	var root := Node3D.new()
	root.name = "ModularShipMesh_" + ship_id

	match ship_id:
		"sonda_lacusta":
			_build_sonda_lacusta(root, custom_color_hex)
		"cargobot_stanca":
			_build_cargobot_stanca(root, custom_color_hex)
		_:
			_build_naveta_vulturul(root, custom_color_hex)

	# Adăugăm conul luminos al propulsoarelor pentru secvența de DECOLARE ÎN SPAȚIU din Hangar
	var plume := MeshInstance3D.new()
	plume.name = "EngineLaunchPlume"
	plume.visible = false
	var cone := CylinderMesh.new()
	cone.top_radius = 0.04
	cone.bottom_radius = 0.34
	cone.height = 1.45
	var plume_mat := _make_mat(Color(0.15, 0.92, 1.0, 0.85), 0.1, 0.1, 2.8)
	cone.material = plume_mat
	plume.mesh = cone
	plume.rotation_degrees = Vector3(90.0, 0.0, 0.0)
	plume.position = Vector3(0.0, 0.0, 1.35)
	root.add_child(plume)

	return root

static func _make_mat(col: Color, metallic: float = 0.5, roughness: float = 0.3, emissive_energy: float = 0.0) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = col
	m.metallic = metallic
	m.roughness = roughness
	if col.a < 0.99:
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if emissive_energy > 0.0:
		m.emission_enabled = true
		m.emission = Color(col.r, col.g, col.b, 1.0)
		m.emission_energy_multiplier = emissive_energy
	return m

static func _build_sonda_lacusta(root: Node3D, custom_color_hex: String = "") -> void:
	var primary_col := Color.from_string(custom_color_hex, Color("#fbbf24")) if not custom_color_hex.is_empty() else Color("#fbbf24")
	var gold_mat := _make_mat(primary_col, 0.65, 0.25)
	var dark_mat := _make_mat(Color("#1e293b"), 0.7, 0.35)
	var glass_mat := _make_mat(Color(0.22, 0.85, 1.0, 0.62), 0.85, 0.1, 0.25)
	var sensor_mat := _make_mat(Color("#00f0ff"), 0.3, 0.2, 1.4)

	# Cupolă centrală sferică panoramică (vizibilitate maximă)
	var core := MeshInstance3D.new()
	var core_sphere := SphereMesh.new()
	core_sphere.radius = 0.58
	core_sphere.height = 1.05
	core.mesh = core_sphere
	core.material_override = glass_mat
	root.add_child(core)

	# Inel ecuatorial auriu
	var ring := MeshInstance3D.new()
	var ring_cyl := CylinderMesh.new()
	ring_cyl.top_radius = 0.64
	ring_cyl.bottom_radius = 0.64
	ring_cyl.height = 0.14
	ring.mesh = ring_cyl
	ring.material_override = gold_mat
	root.add_child(ring)

	# 4 brațe articulate „Lăcusta” cu micro-propulsoare ionice
	var offsets := [
		Vector3(-0.68, 0.24, 0.38),
		Vector3(0.68, 0.24, 0.38),
		Vector3(-0.74, -0.26, 0.42),
		Vector3(0.74, -0.26, 0.42),
	]
	for off in offsets:
		var leg := MeshInstance3D.new()
		var leg_box := BoxMesh.new()
		leg_box.size = Vector3(0.55, 0.10, 0.75)
		leg.mesh = leg_box
		leg.position = off
		leg.material_override = gold_mat
		root.add_child(leg)

		var thruster := MeshInstance3D.new()
		var thr_cyl := CylinderMesh.new()
		thr_cyl.top_radius = 0.11
		thr_cyl.bottom_radius = 0.14
		thr_cyl.height = 0.26
		thruster.mesh = thr_cyl
		thruster.rotation.x = PI * 0.5
		thruster.position = off + Vector3(0.0, 0.0, 0.42)
		thruster.material_override = sensor_mat
		root.add_child(thruster)

	# Scanner frontal rapid cu 3 lentile holografice
	var scanner_bar := MeshInstance3D.new()
	var s_box := BoxMesh.new()
	s_box.size = Vector3(0.75, 0.12, 0.18)
	scanner_bar.mesh = s_box
	scanner_bar.position = Vector3(0.0, -0.18, -0.62)
	scanner_bar.material_override = dark_mat
	root.add_child(scanner_bar)

	for lx in [-0.24, 0.0, 0.24]:
		var lens := MeshInstance3D.new()
		var l_sphere := SphereMesh.new()
		l_sphere.radius = 0.075
		l_sphere.height = 0.15
		lens.mesh = l_sphere
		lens.position = Vector3(lx, -0.18, -0.71)
		lens.material_override = sensor_mat
		root.add_child(lens)

static func _build_naveta_vulturul(root: Node3D, custom_color_hex: String = "") -> void:
	var primary_col := Color.from_string(custom_color_hex, Color("#0284c7")) if not custom_color_hex.is_empty() else Color("#0284c7")
	var hull_mat := _make_mat(Color("#f1f5f9"), 0.50, 0.28)
	var wing_mat := _make_mat(primary_col, 0.60, 0.25)
	var glow_mat := _make_mat(Color("#00f0ff"), 0.30, 0.20, 1.35)
	var canopy_mat := _make_mat(Color(0.18, 0.86, 1.0, 0.68), 0.85, 0.12)

	# Fuselaj aerodinamic în săgeată
	var hull := MeshInstance3D.new()
	var prism := PrismMesh.new()
	prism.size = Vector3(1.15, 2.1, 0.44)
	hull.mesh = prism
	hull.rotation.x = -PI * 0.5
	hull.material_override = hull_mat
	root.add_child(hull)

	# Aripi delta „Vulturul”
	var wings := MeshInstance3D.new()
	var w_box := BoxMesh.new()
	w_box.size = Vector3(2.65, 0.08, 0.78)
	wings.mesh = w_box
	wings.position = Vector3(0.0, -0.04, 0.26)
	wings.material_override = wing_mat
	root.add_child(wings)

	# Cupolă cockpit
	var canopy := MeshInstance3D.new()
	var c_sphere := SphereMesh.new()
	c_sphere.radius = 0.27
	c_sphere.height = 0.46
	canopy.mesh = c_sphere
	canopy.scale = Vector3(1.0, 0.82, 1.55)
	canopy.position = Vector3(0.0, 0.17, -0.22)
	canopy.material_override = canopy_mat
	root.add_child(canopy)

	# 2 Nacele Warp gemene
	for side_x in [-0.68, 0.68]:
		var nacelle := MeshInstance3D.new()
		var n_cyl := CylinderMesh.new()
		n_cyl.top_radius = 0.16
		n_cyl.bottom_radius = 0.20
		n_cyl.height = 1.05
		nacelle.mesh = n_cyl
		nacelle.rotation.x = PI * 0.5
		nacelle.position = Vector3(side_x, 0.04, 0.36)
		nacelle.material_override = glow_mat
		root.add_child(nacelle)

	# Dronă foto montată dorsal
	var drone := MeshInstance3D.new()
	var d_sphere := SphereMesh.new()
	d_sphere.radius = 0.15
	d_sphere.height = 0.30
	drone.mesh = d_sphere
	drone.position = Vector3(0.0, 0.34, 0.35)
	drone.material_override = glow_mat
	root.add_child(drone)

static func _build_cargobot_stanca(root: Node3D, custom_color_hex: String = "") -> void:
	var primary_col := Color.from_string(custom_color_hex, Color("#f97316")) if not custom_color_hex.is_empty() else Color("#f97316")
	var armor_mat := _make_mat(primary_col, 0.55, 0.38)
	var steel_mat := _make_mat(Color("#64748b"), 0.72, 0.32)
	var radar_mat := _make_mat(Color("#38bdf8"), 0.35, 0.22, 1.25)
	var visor_mat := _make_mat(Color(0.98, 0.82, 0.25, 0.75), 0.8, 0.15, 0.4)

	# Corp central blindat
	var body := MeshInstance3D.new()
	var b_box := BoxMesh.new()
	b_box.size = Vector3(1.25, 0.68, 1.95)
	body.mesh = b_box
	body.material_override = armor_mat
	root.add_child(body)

	# 2 pontoane stabilizatoare laterale grele
	for side_x in [-0.95, 0.95]:
		var pontoon := MeshInstance3D.new()
		var p_box := BoxMesh.new()
		p_box.size = Vector3(0.48, 0.52, 1.75)
		pontoon.mesh = p_box
		pontoon.position = Vector3(side_x, -0.05, 0.08)
		pontoon.material_override = steel_mat
		root.add_child(pontoon)

	# Vizieră blindată frontală
	var visor := MeshInstance3D.new()
	var v_box := BoxMesh.new()
	v_box.size = Vector3(0.88, 0.24, 0.22)
	visor.mesh = v_box
	visor.position = Vector3(0.0, 0.14, -0.92)
	visor.material_override = visor_mat
	root.add_child(visor)

	# Dom radar parabolic de rază lungă pe puntea superioară
	var mast := MeshInstance3D.new()
	var m_cyl := CylinderMesh.new()
	m_cyl.top_radius = 0.10
	m_cyl.bottom_radius = 0.14
	m_cyl.height = 0.32
	mast.mesh = m_cyl
	mast.position = Vector3(0.0, 0.48, 0.18)
	mast.material_override = steel_mat
	root.add_child(mast)

	var dish := MeshInstance3D.new()
	var d_cyl := CylinderMesh.new()
	d_cyl.top_radius = 0.52
	d_cyl.bottom_radius = 0.22
	d_cyl.height = 0.12
	dish.mesh = d_cyl
	dish.position = Vector3(0.0, 0.66, 0.18)
	dish.material_override = radar_mat
	root.add_child(dish)

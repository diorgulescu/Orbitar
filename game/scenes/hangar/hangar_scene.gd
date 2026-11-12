# SPDX-License-Identifier: GPL-3.0-or-later
extends Node3D

## Scena Hangarului Orbital din Orbitar (Faza 3).
## Permite copiilor (6–12 ani) să își aleagă Pilotul (3 personaje cu portret și personalitate)
## și Nava Spațială 3D modulară (Sonda „Lăcusta”, Naveta „Vulturul”, Cargobotul „Stânca”) pe o
## platformă rotativă iluminată, salvând selecția în Rust (`OrbitarSpaceCore`) înainte de decolare.

const ShipModelBuilderScript = preload("res://scenes/ships/ship_model_builder.gd")
const PilotPortraitBuilderScript = preload("res://scenes/ui/pilot_portrait_builder.gd")
const SPACE_WORLD_SCENE_PATH := "res://scenes/solar_system/space_world.tscn"

@export var turntable_rotation_speed: float = 0.65

@onready var space_core: OrbitarSpaceCore = $OrbitarSpaceCore
@onready var turntable_pivot: Node3D = $HangarEnvironment3D/TurntablePlatform/ShipPreviewPivot

# Referințe UI (construite curat și responsiv în CanvasLayer)
var pilots_list: Array = []
var ships_list: Array = []
var selected_pilot_idx: int = 0
var selected_ship_idx: int = 1

var _pilot_portrait_rect: TextureRect = null
var _pilot_name_label: Label = null
var _pilot_role_label: Label = null
var _pilot_desc_label: Label = null
var _pilot_greeting_label: Label = null
var _pilot_buttons: Array[Button] = []

var _ship_name_label: Label = null
var _ship_propulsion_label: Label = null
var _ship_summary_label: Label = null
var _ship_stats_label: Label = null
var _ship_buttons: Array[Button] = []
var _launch_button: Button = null

var _active_ship_model: Node3D = null

func _ready() -> void:
	if space_core == null:
		push_error("[HangarScene] OrbitarSpaceCore nu este prezent în scenă!")
		return

	pilots_list = space_core.get_available_pilots()
	ships_list = space_core.get_hangar_ships()

	# Sincronizăm selecția inițială cu profilul salvat în Rust (JSON)
	var saved_pilot_id: String = space_core.get_selected_pilot()
	for i in range(pilots_list.size()):
		if str(pilots_list[i].get("id", "")) == saved_pilot_id:
			selected_pilot_idx = i
			break

	var saved_ship_id: String = space_core.get_selected_ship()
	for i in range(ships_list.size()):
		if str(ships_list[i].get("id", "")) == saved_ship_id:
			selected_ship_idx = i
			break

	_build_hangar_ui()
	_refresh_pilot_selection_ui()
	_refresh_ship_selection_and_3d_preview()

	print("🛠️ [HangarScene] Hangarul Orbital este pregătit: %d piloți | %d nave modulare 3D" % [
		pilots_list.size(), ships_list.size()
	])

func _process(delta: float) -> void:
	if turntable_pivot != null:
		turntable_pivot.rotate_y(turntable_rotation_speed * delta)

func _exit_tree() -> void:
	_pilot_buttons.clear()
	_ship_buttons.clear()

func select_pilot_by_index(index: int) -> void:
	if index < 0 or index >= pilots_list.size():
		return
	selected_pilot_idx = index
	var p: Dictionary = pilots_list[selected_pilot_idx]
	space_core.set_selected_pilot(str(p.get("id", "")), str(p.get("name_ro", "")))
	_refresh_pilot_selection_ui()

func select_ship_by_index(index: int) -> void:
	if index < 0 or index >= ships_list.size():
		return
	selected_ship_idx = index
	var s: Dictionary = ships_list[selected_ship_idx]
	space_core.set_selected_ship(str(s.get("id", "")))
	_refresh_ship_selection_and_3d_preview()

func select_pilot_by_id(pilot_id: String) -> bool:
	for i in range(pilots_list.size()):
		if str(pilots_list[i].get("id", "")) == pilot_id:
			select_pilot_by_index(i)
			return true
	return false

func select_ship_by_id(ship_id: String) -> bool:
	for i in range(ships_list.size()):
		if str(ships_list[i].get("id", "")) == ship_id:
			select_ship_by_index(i)
			return true
	return false

## Salvează configurația aleasă (Pilot + Navă) în `OrbitarSpaceCore` (Rust JSON) și lansează `space_world.tscn`.
func launch_into_space(change_scene: bool = true) -> bool:
	if space_core == null:
		return false

	if selected_pilot_idx >= 0 and selected_pilot_idx < pilots_list.size():
		var p: Dictionary = pilots_list[selected_pilot_idx]
		space_core.set_selected_pilot(str(p.get("id", "")), str(p.get("name_ro", "")))

	if selected_ship_idx >= 0 and selected_ship_idx < ships_list.size():
		var s: Dictionary = ships_list[selected_ship_idx]
		space_core.set_selected_ship(str(s.get("id", "")))

	var saved: bool = space_core.save_player_profile()
	print("🚀 [HangarScene] DECOLARE ÎN SPAȚIU! Pilot=%s | Navă=%s | Salvat JSON=%s" % [
		space_core.get_selected_pilot_name(),
		space_core.get_selected_ship(),
		str(saved)
	])

	if change_scene and get_tree() != null:
		get_tree().change_scene_to_file(SPACE_WORLD_SCENE_PATH)
	return saved

func _refresh_pilot_selection_ui() -> void:
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
		_pilot_desc_label.text = str(p.get("personality_ro", ""))
	if _pilot_greeting_label != null:
		_pilot_greeting_label.text = "„%s”" % str(p.get("greeting_ro", ""))

	for i in range(_pilot_buttons.size()):
		var btn: Button = _pilot_buttons[i]
		btn.button_pressed = (i == selected_pilot_idx)

func _refresh_ship_selection_and_3d_preview() -> void:
	if ships_list.is_empty():
		return
	var s: Dictionary = ships_list[selected_ship_idx]
	var ship_id: String = str(s.get("id", "naveta_vulturul"))

	# Reconstruim modelul 3D modular pe platforma rotativă a hangarului
	if turntable_pivot != null:
		if _active_ship_model != null:
			turntable_pivot.remove_child(_active_ship_model)
			_active_ship_model.free()
		_active_ship_model = ShipModelBuilderScript.build_ship_visual(ship_id)
		turntable_pivot.add_child(_active_ship_model)

	if _ship_name_label != null:
		_ship_name_label.text = "🛸 " + str(s.get("name_ro", ""))
	if _ship_propulsion_label != null:
		_ship_propulsion_label.text = str(s.get("propulsion_ro", ""))
	if _ship_summary_label != null:
		_ship_summary_label.text = str(s.get("didactic_summary_ro", ""))
	if _ship_stats_label != null:
		var agi: int = int(s.get("rating_agility", 3))
		var wrp: int = int(s.get("rating_warp", 3))
		var scn: int = int(s.get("rating_scanner", 3))
		var stb: int = int(s.get("rating_stability", 3))
		_ship_stats_label.text = (
			"• Agilitate & Rotație:  %s\n" % _format_stars(agi) +
			"• Propulsor Mini-Warp: %s\n" % _format_stars(wrp) +
			"• Scanner Științific:  %s\n" % _format_stars(scn) +
			"• Stabilizare & Raza:  %s" % _format_stars(stb)
		)

	for i in range(_ship_buttons.size()):
		var btn: Button = _ship_buttons[i]
		btn.button_pressed = (i == selected_ship_idx)

func _format_stars(rating: int) -> String:
	var clamped: int = clampi(rating, 1, 5)
	return "★".repeat(clamped) + "☆".repeat(5 - clamped)

func _build_hangar_ui() -> void:
	var canvas: CanvasLayer = $HangarUI
	if canvas == null:
		return

	# Titlu sus
	var header_panel := PanelContainer.new()
	header_panel.set_anchors_preset(Control.PRESET_TOP_WIDE)
	header_panel.offset_left = 24
	header_panel.offset_top = 16
	header_panel.offset_right = -24
	header_panel.offset_bottom = 76
	canvas.add_child(header_panel)

	var header_title := Label.new()
	header_title.text = "🌌 ORBITAR 3D — HANGARUL ORBITAL DE PREGĂTIRE A MISIUNII"
	header_title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	header_title.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	header_title.add_theme_font_size_override("font_size", 22)
	header_panel.add_child(header_title)

	# Panoul Stânga: Selecția Pilotului
	var left_panel := PanelContainer.new()
	left_panel.position = Vector2(24, 92)
	left_panel.size = Vector2(360, 480)
	canvas.add_child(left_panel)

	var left_vbox := VBoxContainer.new()
	left_vbox.add_theme_constant_override("separation", 10)
	left_panel.add_child(left_vbox)

	var pilot_header := Label.new()
	pilot_header.text = "👨‍🚀 1. ALEGE PILOTUL MISIUNII"
	pilot_header.add_theme_font_size_override("font_size", 17)
	left_vbox.add_child(pilot_header)

	for i in range(pilots_list.size()):
		var p: Dictionary = pilots_list[i]
		var btn := Button.new()
		btn.toggle_mode = true
		btn.text = "%s %s" % [str(p.get("badge_symbol", "★")), str(p.get("name_ro", ""))]
		var idx: int = i
		btn.pressed.connect(select_pilot_by_index.bind(idx))
		left_vbox.add_child(btn)
		_pilot_buttons.append(btn)

	_pilot_portrait_rect = TextureRect.new()
	_pilot_portrait_rect.custom_minimum_size = Vector2(112, 112)
	_pilot_portrait_rect.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_pilot_portrait_rect.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	left_vbox.add_child(_pilot_portrait_rect)

	_pilot_name_label = Label.new()
	_pilot_name_label.add_theme_font_size_override("font_size", 18)
	left_vbox.add_child(_pilot_name_label)

	_pilot_role_label = Label.new()
	_pilot_role_label.modulate = Color("#38bdf8")
	left_vbox.add_child(_pilot_role_label)

	_pilot_desc_label = Label.new()
	_pilot_desc_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	left_vbox.add_child(_pilot_desc_label)

	_pilot_greeting_label = Label.new()
	_pilot_greeting_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_pilot_greeting_label.modulate = Color("#fde68a")
	left_vbox.add_child(_pilot_greeting_label)

	# Panoul Dreapta: Selecția Navei 3D
	var right_panel := PanelContainer.new()
	right_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	right_panel.offset_left = -384
	right_panel.offset_top = 92
	right_panel.offset_right = -24
	right_panel.offset_bottom = 572
	canvas.add_child(right_panel)

	var right_vbox := VBoxContainer.new()
	right_vbox.add_theme_constant_override("separation", 10)
	right_panel.add_child(right_vbox)

	var ship_header := Label.new()
	ship_header.text = "🛸 2. ALEGE NAVA SPAȚIALĂ 3D"
	ship_header.add_theme_font_size_override("font_size", 17)
	right_vbox.add_child(ship_header)

	for i in range(ships_list.size()):
		var s: Dictionary = ships_list[i]
		var btn := Button.new()
		btn.toggle_mode = true
		btn.text = str(s.get("name_ro", ""))
		var idx: int = i
		btn.pressed.connect(select_ship_by_index.bind(idx))
		right_vbox.add_child(btn)
		_ship_buttons.append(btn)

	_ship_name_label = Label.new()
	_ship_name_label.add_theme_font_size_override("font_size", 18)
	right_vbox.add_child(_ship_name_label)

	_ship_propulsion_label = Label.new()
	_ship_propulsion_label.modulate = Color("#38bdf8")
	_ship_propulsion_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	right_vbox.add_child(_ship_propulsion_label)

	_ship_summary_label = Label.new()
	_ship_summary_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	right_vbox.add_child(_ship_summary_label)

	_ship_stats_label = Label.new()
	_ship_stats_label.modulate = Color("#fbbf24")
	right_vbox.add_child(_ship_stats_label)

	# Butonul central jos: DECOLARE ÎN SPAȚIU
	_launch_button = Button.new()
	_launch_button.name = "LaunchButton"
	_launch_button.text = "🚀 DECOLARE ÎN SPAȚIU"
	_launch_button.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_launch_button.offset_left = 340
	_launch_button.offset_top = -76
	_launch_button.offset_right = -340
	_launch_button.offset_bottom = -20
	_launch_button.add_theme_font_size_override("font_size", 22)
	_launch_button.pressed.connect(launch_into_space.bind(true))
	canvas.add_child(_launch_button)

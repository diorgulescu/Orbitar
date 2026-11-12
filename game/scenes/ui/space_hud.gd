# SPDX-License-Identifier: GPL-3.0-or-later
class_name SpaceHud
extends CanvasLayer

## HUD-ul de Zbor, Scannerul Științific și Jurnalul Cadetului în limba română (Faza 3).
## Afișează:
## - Portretul pilotului ales și replicile sale reactive în română
## - Telemetria navei, treapta de propulsie și proximitatea planetară
## - Inelul holografic circular de scanare (Click Dreapta / Trigger Stânga)
## - Fișa Științifică Interactivă pe bordul navei (Junior 6-8 ani / Cadet 9-12 ani + Quiz)
## - Modul Foto (`P`) care ascunde HUD-ul și salvează captura în folderul utilizatorului

const PilotPortraitBuilderScript = preload("res://scenes/ui/pilot_portrait_builder.gd")
const CircularScannerRingScript = preload("res://scenes/ui/circular_scanner_ring.gd")
const HANGAR_SCENE_PATH := "res://scenes/menu/main_menu_hangar.tscn"
const SCI_FI_THEME_PATH := "res://assets/ui/sci_fi_theme.tres"

var space_core: OrbitarSpaceCore = null
var player_ship: Node3D = null

var current_age_tier: String = "junior"
var current_inspected_body: Dictionary = {}

# Referințe UI
var _main_hud_root: Control = null
var _pilot_portrait: TextureRect = null
var _pilot_name_label: Label = null
var _pilot_speech_label: Label = null
var _telemetry_label: Label = null
var _scan_prompt_label: Label = null
var _scanner_ring: Control = null
var _discovery_card_panel: PanelContainer = null
var _card_title_label: Label = null
var _card_subtitle_label: Label = null
var _card_stats_label: Label = null
var _card_content_label: Label = null
var _card_quiz_question_label: Label = null
var _card_quiz_feedback_label: Label = null
var _card_quiz_buttons: Array[Button] = []
var _journal_counter_label: Label = null
var _photo_toast_label: Label = null

func _ready() -> void:
	_build_hud_interface()

func _exit_tree() -> void:
	_card_quiz_buttons.clear()

func bind_systems(core: OrbitarSpaceCore, ship: Node3D) -> void:
	space_core = core
	player_ship = ship

	if space_core != null:
		var pilot_spec: Dictionary = space_core.get_selected_pilot_spec()
		var p_id: String = str(pilot_spec.get("id", "cadet_explorator"))
		var cadet_name: String = space_core.get_cadet_name()
		if _pilot_portrait != null:
			_pilot_portrait.texture = PilotPortraitBuilderScript.get_portrait_texture(p_id)
		if _pilot_name_label != null:
			_pilot_name_label.text = "%s %s — Co-pilot: %s" % [
				str(pilot_spec.get("badge_symbol", "★")),
				str(pilot_spec.get("name_ro", "Cadetul Explorator")),
				cadet_name
			]
		show_pilot_reaction("launch", "earth")
		_update_journal_counter()

	if player_ship != null:
		if player_ship.has_signal("nearby_planet_entered") and not player_ship.is_connected("nearby_planet_entered", _on_nearby_planet_entered):
			player_ship.connect("nearby_planet_entered", _on_nearby_planet_entered)
		if player_ship.has_signal("propulsion_tier_changed") and not player_ship.is_connected("propulsion_tier_changed", _on_propulsion_tier_changed):
			player_ship.connect("propulsion_tier_changed", _on_propulsion_tier_changed)
		if player_ship.has_signal("warp_blocked_by_proximity") and not player_ship.is_connected("warp_blocked_by_proximity", _on_warp_blocked_by_proximity):
			player_ship.connect("warp_blocked_by_proximity", _on_warp_blocked_by_proximity)
		if player_ship.has_signal("hyper_drop_triggered") and not player_ship.is_connected("hyper_drop_triggered", _on_hyper_drop_triggered):
			player_ship.connect("hyper_drop_triggered", _on_hyper_drop_triggered)
		if player_ship.has_signal("scan_progress_updated") and not player_ship.is_connected("scan_progress_updated", _on_scan_progress_updated):
			player_ship.connect("scan_progress_updated", _on_scan_progress_updated)
		if player_ship.has_signal("planet_scan_completed") and not player_ship.is_connected("planet_scan_completed", _on_planet_scan_completed):
			player_ship.connect("planet_scan_completed", _on_planet_scan_completed)
		if player_ship.has_signal("photo_mode_toggled") and not player_ship.is_connected("photo_mode_toggled", _on_photo_mode_toggled):
			player_ship.connect("photo_mode_toggled", _on_photo_mode_toggled)
		if player_ship.has_signal("photo_saved") and not player_ship.is_connected("photo_saved", _on_photo_saved):
			player_ship.connect("photo_saved", _on_photo_saved)

func _unhandled_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode == KEY_ESCAPE and _discovery_card_panel != null and _discovery_card_panel.visible:
			_discovery_card_panel.visible = false
		elif event.keycode == KEY_J and not (player_ship != null and player_ship.photo_mode_active):
			# Deschide/închide fișa ultimei planete apropiate sau Pământul
			if _discovery_card_panel != null and _discovery_card_panel.visible:
				_discovery_card_panel.visible = false
			elif space_core != null:
				var target_id: String = player_ship.nearest_body_id if player_ship != null else "earth"
				open_scientific_card(space_core.get_celestial_body(target_id))
		elif event.keycode == KEY_H and not (player_ship != null and player_ship.photo_mode_active):
			if get_tree() != null:
				get_tree().change_scene_to_file(HANGAR_SCENE_PATH)

func _process(_delta: float) -> void:
	if player_ship == null or _main_hud_root == null or not _main_hud_root.visible:
		return

	var spd: float = player_ship.velocity.length()
	var tier_ro: String = player_ship.get_propulsion_tier_name_ro()
	var near_name: String = player_ship.nearest_body_name
	var alt: float = player_ship.nearest_altitude
	var ship_name: String = player_ship.active_ship_name_ro

	if _telemetry_label != null:
		var is_hyper: bool = (player_ship.current_tier == 2)
		var speed_str: String = "%.1f c" % (spd / 2500000.0) if is_hyper else "%.0f m/s" % spd
		var mil_km: float = alt / 750000.0
		var dist_au: float = mil_km / 149.6
		var dist_str: String = (
			"%.1f mil. km (%.2f UA)" % [mil_km, dist_au]
			if (is_hyper or alt >= 750000.0)
			else "%.0f km" % (alt * (6371.0 / 75000.0))
		)
		_telemetry_label.text = (
			"🛸 %s | Propulsie: %s | Viteză: %s\n" % [ship_name, tier_ro, speed_str] +
			"🪐 Corp apropiat: %s (Distanță: %s) | [C] Cameră | [P] Mod Foto | [J] Jurnal | [H] Hangar" % [near_name, dist_str]
		)

	if _scan_prompt_label != null:
		var near_id: String = player_ship.nearest_body_id
		var already_scanned: bool = space_core.is_body_scanned(near_id) if space_core != null else false
		if player_ship.is_scanning:
			var pct: int = int(round(player_ship.scan_progress * 100.0))
			_scan_prompt_label.text = "📡 SCANARE HOLOGRAFICĂ ÎN CURS: %s (%d%%)..." % [near_name.to_upper(), pct]
			_scan_prompt_label.modulate = Color("#00f0ff")
		elif player_ship.can_scan_nearest_body:
			var status_tag := " [✓ DESCOPERITĂ]" if already_scanned else " [NOUĂ!]"
			_scan_prompt_label.text = "🔍 Țintă în rază: %s%s — Ține apăsat Click Dreapta / Trigger Stânga (sau [F]) pentru Scanare" % [
				near_name, status_tag
			]
			_scan_prompt_label.modulate = Color("#22c55e") if already_scanned else Color("#fbbf24")
		else:
			_scan_prompt_label.text = "🧭 Apropie-te de o planetă sau satelit pentru a activa Scannerul Științific"
			_scan_prompt_label.modulate = Color("#94a3b8")

func show_pilot_reaction(event_type: String, body_id: String) -> void:
	if space_core == null or _pilot_speech_label == null:
		return
	var line: String = space_core.get_pilot_reaction(event_type, body_id)
	_pilot_speech_label.text = "„%s”" % line

func _on_nearby_planet_entered(body_id: String, _body_name: String) -> void:
	show_pilot_reaction("approach_planet", body_id)

func _on_propulsion_tier_changed(_tier_name: String) -> void:
	if player_ship != null and player_ship.current_tier == 2:
		show_pilot_reaction("warp_engage", player_ship.nearest_body_id)

func _on_warp_blocked_by_proximity(_planet_name: String) -> void:
	if player_ship != null:
		show_pilot_reaction("warp_blocked", player_ship.nearest_body_id)

func _on_hyper_drop_triggered(body_id: String, _body_name: String) -> void:
	show_pilot_reaction("hyper_drop", body_id)

func _on_scan_progress_updated(progress: float, _body_id: String, body_name: String) -> void:
	if _scanner_ring != null:
		_scanner_ring.progress = progress
		_scanner_ring.active_scanning = (progress > 0.001 and progress < 1.0)
		_scanner_ring.target_name_ro = body_name

func _on_planet_scan_completed(body_id: String, body_data: Dictionary) -> void:
	show_pilot_reaction("scan_complete", body_id)
	_update_journal_counter()
	open_scientific_card(body_data)

func _on_photo_mode_toggled(enabled: bool) -> void:
	if _main_hud_root != null:
		# În Modul Foto (P) oprim întregul HUD pentru o imagine curată cu nava și planeta pe fundal
		_main_hud_root.visible = not enabled
	if _photo_toast_label != null:
		_photo_toast_label.visible = enabled
		if enabled:
			_photo_toast_label.text = "📷 MOD FOTO ACTIV — Rotește camera (Mouse/WASD) | [Enter / F12] Salvează Captura | [P] Înapoi la Zbor"
	if not enabled and player_ship != null:
		show_pilot_reaction("photo_mode", player_ship.nearest_body_id)

func _on_photo_saved(file_path: String) -> void:
	if _photo_toast_label != null:
		_photo_toast_label.visible = true
		_photo_toast_label.text = "✅ Fotografie salvată în: %s" % file_path

func _update_journal_counter() -> void:
	if space_core == null or _journal_counter_label == null:
		return
	var scanned: PackedStringArray = space_core.get_scanned_bodies()
	var total: int = space_core.get_body_count()
	_journal_counter_label.text = "📖 Jurnalul Cadetului: %d / %d corpuri cerești descoperite" % [scanned.size(), total]

## Deschide Fișa Științifică Interactivă pe bordul navei cu datele în limba română din Orbitar.
func open_scientific_card(body_data: Dictionary) -> void:
	if body_data.is_empty() or _discovery_card_panel == null:
		return
	current_inspected_body = body_data
	_discovery_card_panel.visible = true
	_refresh_scientific_card_content()

func set_card_age_tier(tier: String) -> void:
	current_age_tier = "cadet" if tier == "cadet" else "junior"
	_refresh_scientific_card_content()

func _refresh_scientific_card_content() -> void:
	if current_inspected_body.is_empty():
		return
	var name_ro: String = str(current_inspected_body.get("name", ""))
	var cat_ro: String = str(current_inspected_body.get("category_label_ro", ""))
	var subtitle: String = str(current_inspected_body.get("subtitle", ""))
	var radius_km: float = float(current_inspected_body.get("radius_km", 0.0))
	var temp_c: float = float(current_inspected_body.get("mean_temp_c", 0.0))
	var dist_au: float = float(current_inspected_body.get("distance_from_sun_au", 0.0))

	if _card_title_label != null:
		_card_title_label.text = "🪐 DESCOPERIRE ȘTIINȚIFICĂ: %s (%s)" % [name_ro.to_upper(), cat_ro]
	if _card_subtitle_label != null:
		_card_subtitle_label.text = subtitle
	if _card_stats_label != null:
		_card_stats_label.text = "📏 Rază fizică: %.0f km   |   🌡️ Temperatură medie: %.0f °C   |   ☀️ Distanță față de Soare: %.2f UA" % [
			radius_km, temp_c, dist_au
		]

	var didactic: Dictionary = current_inspected_body.get("didactic", {})
	var junior: Dictionary = didactic.get("junior", {})
	var cadet: Dictionary = didactic.get("cadet", {})

	if _card_content_label != null:
		if current_age_tier == "junior":
			var travel: Dictionary = junior.get("travel_time", {})
			_card_content_label.text = (
				"👶 [MOD JUNIOR 6–8 ANI]\n" +
				"• Povestea Lumii: %s\n\n" % str(junior.get("summary", "")) +
				"• Pe înțelesul tău: %s\n\n" % str(junior.get("analogy", "")) +
				"• Știai că? %s\n\n" % str(junior.get("fun_fact", "")) +
				"• Cât durează călătoria? Cu racheta: %s | Cu viteza luminii: %s" % [
					str(travel.get("rocket", "-")), str(travel.get("light", "-"))
				]
			)
		else:
			_card_content_label.text = (
				"🧑‍🚀 [MOD CADET 9–12 ANI]\n" +
				"• Sinteză Astrofizică: %s\n\n" % str(cadet.get("summary", "")) +
				"• Istoria Explorării: %s" % str(cadet.get("exploration_history", ""))
			)

	# Quiz interactiv din baza de date Orbitar
	var quiz: Dictionary = cadet.get("quiz", {})
	var question: String = str(quiz.get("question", ""))
	var options: PackedStringArray = quiz.get("options", PackedStringArray())
	var correct_idx: int = int(quiz.get("correct_index", 0))
	var explanation: String = str(quiz.get("explanation", ""))

	if _card_quiz_question_label != null:
		_card_quiz_question_label.text = "❓ Provocarea Cadetului: " + question
	if _card_quiz_feedback_label != null:
		_card_quiz_feedback_label.text = ""

	for i in range(_card_quiz_buttons.size()):
		var btn: Button = _card_quiz_buttons[i]
		if i < options.size():
			btn.visible = true
			btn.text = options[i]
			# Reconectăm curat handlerul de răspuns
			for conn in btn.pressed.get_connections():
				btn.pressed.disconnect(conn.callable)
			btn.pressed.connect(_on_quiz_option_chosen.bind(i, correct_idx, explanation))
		else:
			btn.visible = false

func _on_quiz_option_chosen(chosen: int, correct_idx: int, explanation: String) -> void:
	if _card_quiz_feedback_label != null:
		if chosen == correct_idx:
			_card_quiz_feedback_label.modulate = Color("#22c55e")
			_card_quiz_feedback_label.text = "✅ Corect! " + explanation
		else:
			_card_quiz_feedback_label.modulate = Color("#f97316")
			_card_quiz_feedback_label.text = "💡 Mai încearcă! Indiciu: " + explanation

func _close_discovery_card() -> void:
	if _discovery_card_panel != null:
		_discovery_card_panel.visible = false

func _build_hud_interface() -> void:
	_main_hud_root = Control.new()
	_main_hud_root.name = "MainHudRoot"
	_main_hud_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	_main_hud_root.mouse_filter = Control.MOUSE_FILTER_PASS
	if ResourceLoader.exists(SCI_FI_THEME_PATH):
		_main_hud_root.theme = load(SCI_FI_THEME_PATH) as Theme
	add_child(_main_hud_root)

	# 1. Colțul Stânga-Sus: Portretul Pilotului + Bula de Dialog în Limba Română
	var pilot_panel := PanelContainer.new()
	pilot_panel.name = "PilotCommsPanel"
	pilot_panel.position = Vector2(20, 18)
	pilot_panel.size = Vector2(540, 110)
	_main_hud_root.add_child(pilot_panel)

	var pilot_hbox := HBoxContainer.new()
	pilot_hbox.add_theme_constant_override("separation", 12)
	pilot_panel.add_child(pilot_hbox)

	_pilot_portrait = TextureRect.new()
	_pilot_portrait.custom_minimum_size = Vector2(86, 86)
	_pilot_portrait.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	_pilot_portrait.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	pilot_hbox.add_child(_pilot_portrait)

	var pilot_text_vbox := VBoxContainer.new()
	pilot_text_vbox.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pilot_hbox.add_child(pilot_text_vbox)

	_pilot_name_label = Label.new()
	_pilot_name_label.text = "★ Cadetul Explorator"
	_pilot_name_label.modulate = Color("#38bdf8")
	_pilot_name_label.add_theme_font_size_override("font_size", 16)
	pilot_text_vbox.add_child(_pilot_name_label)

	_pilot_speech_label = Label.new()
	_pilot_speech_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_pilot_speech_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pilot_text_vbox.add_child(_pilot_speech_label)

	# 2. Colțul Dreapta-Sus: Contorul Jurnalului Cadetului
	var journal_panel := PanelContainer.new()
	journal_panel.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	journal_panel.offset_left = -380
	journal_panel.offset_top = 18
	journal_panel.offset_right = -20
	journal_panel.offset_bottom = 66
	_main_hud_root.add_child(journal_panel)

	_journal_counter_label = Label.new()
	_journal_counter_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_journal_counter_label.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_journal_counter_label.modulate = Color("#fde68a")
	journal_panel.add_child(_journal_counter_label)

	# 3. Centru: Inelul Circular al Scannerului Științific Holografic
	_scanner_ring = CircularScannerRingScript.new()
	_scanner_ring.name = "CircularScannerRing"
	_scanner_ring.set_anchors_preset(Control.PRESET_CENTER)
	_scanner_ring.offset_left = -110
	_scanner_ring.offset_top = -110
	_scanner_ring.offset_right = 110
	_scanner_ring.offset_bottom = 110
	_scanner_ring.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_main_hud_root.add_child(_scanner_ring)

	# 4. Bara Jos: Telemetrie Zbor & Prompt Scanner Științific
	var bottom_panel := PanelContainer.new()
	bottom_panel.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	bottom_panel.offset_left = 20
	bottom_panel.offset_top = -94
	bottom_panel.offset_right = -20
	bottom_panel.offset_bottom = -16
	_main_hud_root.add_child(bottom_panel)

	var bottom_vbox := VBoxContainer.new()
	bottom_panel.add_child(bottom_vbox)

	_scan_prompt_label = Label.new()
	_scan_prompt_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_scan_prompt_label.add_theme_font_size_override("font_size", 16)
	bottom_vbox.add_child(_scan_prompt_label)

	_telemetry_label = Label.new()
	_telemetry_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bottom_vbox.add_child(_telemetry_label)

	# 5. Fișa Științifică Interactivă / Jurnalul Cadetului (deschisă la 100% Scanare sau tasta J)
	_discovery_card_panel = PanelContainer.new()
	_discovery_card_panel.name = "DiscoveryCardPanel"
	_discovery_card_panel.visible = false
	_discovery_card_panel.set_anchors_preset(Control.PRESET_CENTER)
	_discovery_card_panel.offset_left = -380
	_discovery_card_panel.offset_top = -240
	_discovery_card_panel.offset_right = 380
	_discovery_card_panel.offset_bottom = 240
	_main_hud_root.add_child(_discovery_card_panel)

	var card_vbox := VBoxContainer.new()
	card_vbox.add_theme_constant_override("separation", 8)
	_discovery_card_panel.add_child(card_vbox)

	_card_title_label = Label.new()
	_card_title_label.add_theme_font_size_override("font_size", 20)
	_card_title_label.modulate = Color("#00f0ff")
	card_vbox.add_child(_card_title_label)

	_card_subtitle_label = Label.new()
	_card_subtitle_label.modulate = Color("#fde68a")
	card_vbox.add_child(_card_subtitle_label)

	_card_stats_label = Label.new()
	card_vbox.add_child(_card_stats_label)

	var tier_hbox := HBoxContainer.new()
	tier_hbox.add_theme_constant_override("separation", 10)
	card_vbox.add_child(tier_hbox)

	var btn_junior := Button.new()
	btn_junior.text = "👶 Poveste Junior (6–8 ani)"
	btn_junior.pressed.connect(set_card_age_tier.bind("junior"))
	tier_hbox.add_child(btn_junior)

	var btn_cadet := Button.new()
	btn_cadet.text = "🧑‍🚀 Dosar Cadet (9–12 ani)"
	btn_cadet.pressed.connect(set_card_age_tier.bind("cadet"))
	tier_hbox.add_child(btn_cadet)

	var btn_close := Button.new()
	btn_close.text = "✖ Închide Fișa [Esc]"
	btn_close.pressed.connect(_close_discovery_card)
	tier_hbox.add_child(btn_close)

	_card_content_label = Label.new()
	_card_content_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card_vbox.add_child(_card_content_label)

	_card_quiz_question_label = Label.new()
	_card_quiz_question_label.modulate = Color("#fbbf24")
	_card_quiz_question_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card_vbox.add_child(_card_quiz_question_label)

	var quiz_grid := GridContainer.new()
	quiz_grid.columns = 2
	card_vbox.add_child(quiz_grid)

	for i in range(4):
		var qbtn := Button.new()
		qbtn.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		quiz_grid.add_child(qbtn)
		_card_quiz_buttons.append(qbtn)

	_card_quiz_feedback_label = Label.new()
	_card_quiz_feedback_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	card_vbox.add_child(_card_quiz_feedback_label)

	# 6. Etichetă discretă doar pentru Modul Foto (când _main_hud_root este oprit)
	_photo_toast_label = Label.new()
	_photo_toast_label.visible = false
	_photo_toast_label.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	_photo_toast_label.offset_top = -42
	_photo_toast_label.offset_bottom = -12
	_photo_toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_photo_toast_label.modulate = Color(1.0, 0.95, 0.75, 0.85)
	add_child(_photo_toast_label)

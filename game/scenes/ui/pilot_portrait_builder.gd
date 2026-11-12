# SPDX-License-Identifier: GPL-3.0-or-later
class_name PilotPortraitBuilder
extends RefCounted

## Generează portrete grafice clare și prietenoase (ImageTexture 128x128) pentru cei 3 piloți:
## 1. `cadet_explorator`  — Cadetul Explorator (cască spațială azurie, vizieră luminoasă, zâmbet entuziast)
## 2. `inginer_robot`     — Inginerul Robot (cap cibernetic verde-smarald, ochi LED cyan, antene laterale)
## 3. `comandant_veteran` — Comandantul Veteran (uniformă aurie de amiral, vizor tactic chihlimbar)

static func get_portrait_texture(pilot_id: String) -> ImageTexture:
	var size: int = 128
	var img := Image.create(size, size, false, Image.FORMAT_RGBA8)

	match pilot_id:
		"inginer_robot":
			_draw_robot_portrait(img, size)
		"comandant_veteran":
			_draw_commander_portrait(img, size)
		_:
			_draw_cadet_portrait(img, size)

	return ImageTexture.create_from_image(img)

static func _fill_circle(img: Image, cx: float, cy: float, r: float, col: Color) -> void:
	var x0: int = maxi(0, int(cx - r - 1))
	var x1: int = mini(img.get_width() - 1, int(cx + r + 1))
	var y0: int = maxi(0, int(cy - r - 1))
	var y1: int = mini(img.get_height() - 1, int(cy + r + 1))
	var r2: float = r * r
	for y in range(y0, y1 + 1):
		for x in range(x0, x1 + 1):
			var dx: float = float(x) - cx
			var dy: float = float(y) - cy
			if dx * dx + dy * dy <= r2:
				img.set_pixel(x, y, col)

static func _fill_rect(img: Image, rx: int, ry: int, rw: int, rh: int, col: Color) -> void:
	for y in range(maxi(0, ry), mini(img.get_height(), ry + rh)):
		for x in range(maxi(0, rx), mini(img.get_width(), rx + rw)):
			img.set_pixel(x, y, col)

static func _draw_cadet_portrait(img: Image, size: int) -> void:
	img.fill(Color("#0c192c"))
	_fill_circle(img, 64, 64, 58, Color("#0284c7"))
	_fill_circle(img, 64, 64, 52, Color("#0f172a"))
	# Umeri costum spațial alb-azuriu
	_fill_circle(img, 64, 118, 42, Color("#e2e8f0"))
	_fill_rect(img, 48, 96, 32, 24, Color("#38bdf8"))
	# Cască spațială rotundă
	_fill_circle(img, 64, 58, 34, Color("#f8fafc"))
	_fill_circle(img, 64, 58, 27, Color("#fde68a"))
	# Ochi curioși + zâmbet
	_fill_circle(img, 54, 54, 4.2, Color("#0f172a"))
	_fill_circle(img, 74, 54, 4.2, Color("#0f172a"))
	_fill_circle(img, 55, 52, 1.5, Color("#ffffff"))
	_fill_circle(img, 75, 52, 1.5, Color("#ffffff"))
	_fill_rect(img, 56, 66, 16, 4, Color("#ea580c"))
	# Stea aurie pe cască
	_fill_circle(img, 64, 28, 5.0, Color("#fbbf24"))

static func _draw_robot_portrait(img: Image, size: int) -> void:
	img.fill(Color("#091e1a"))
	_fill_circle(img, 64, 64, 58, Color("#10b981"))
	_fill_circle(img, 64, 64, 52, Color("#0f172a"))
	# Antene laterale + antenă centrală
	_fill_rect(img, 61, 14, 6, 18, Color("#94a3b8"))
	_fill_circle(img, 64, 14, 6.5, Color("#00f0ff"))
	_fill_rect(img, 20, 48, 10, 20, Color("#10b981"))
	_fill_rect(img, 98, 48, 10, 20, Color("#10b981"))
	# Șasiu cap cibernetic
	_fill_rect(img, 30, 30, 68, 58, Color("#334155"))
	_fill_rect(img, 36, 38, 56, 26, Color("#020617"))
	# Ochi LED cyan
	_fill_circle(img, 50, 51, 7.5, Color("#00f0ff"))
	_fill_circle(img, 78, 51, 7.5, Color("#00f0ff"))
	# Grilă vocală luminoasă
	for gx in [44, 54, 64, 74, 82]:
		_fill_rect(img, gx, 72, 5, 9, Color("#22c55e"))
	# Umeri metalici
	_fill_rect(img, 26, 92, 76, 28, Color("#475569"))

static func _draw_commander_portrait(img: Image, size: int) -> void:
	img.fill(Color("#1f1608"))
	_fill_circle(img, 64, 64, 58, Color("#f59e0b"))
	_fill_circle(img, 64, 64, 52, Color("#0f172a"))
	# Uniformă de comandant cu epoleți aurii
	_fill_circle(img, 64, 118, 44, Color("#1e293b"))
	_fill_rect(img, 24, 96, 20, 10, Color("#fbbf24"))
	_fill_rect(img, 84, 96, 20, 10, Color("#fbbf24"))
	# Chip calm + păr grizonat
	_fill_circle(img, 64, 56, 28, Color("#fcd34d"))
	_fill_rect(img, 36, 26, 56, 14, Color("#cbd5e1"))
	# Vizor tactic aurit
	_fill_rect(img, 40, 46, 48, 12, Color("#0284c7"))
	_fill_rect(img, 42, 48, 44, 4, Color("#38bdf8"))
	# Zâmbet calm
	_fill_rect(img, 54, 68, 20, 3, Color("#78350f"))

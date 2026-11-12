# SPDX-License-Identifier: GPL-3.0-or-later
class_name CircularScannerRing
extends Control

## Reticul holografic central și bară circulară de progres (0% -> 100%)
## pentru Scannerul Științific din Orbitar 3D.

var progress: float = 0.0:
	set(val):
		progress = clampf(val, 0.0, 1.0)
		queue_redraw()

var active_scanning: bool = false:
	set(val):
		active_scanning = val
		queue_redraw()

var target_name_ro: String = ""
var _pulse_angle: float = 0.0

func _process(delta: float) -> void:
	if active_scanning or progress > 0.001:
		_pulse_angle = fmod(_pulse_angle + delta * 3.6, TAU)
		queue_redraw()

func _draw() -> void:
	if not active_scanning and progress <= 0.001:
		return

	var center: Vector2 = size * 0.5
	var base_radius: float = minf(size.x, size.y) * 0.38

	# Inel exterior holografic
	draw_arc(center, base_radius + 10.0, 0.0, TAU, 64, Color(0.0, 0.94, 1.0, 0.25), 2.0, true)

	# Segmente rotative de scanare holografică
	for i in range(4):
		var a0: float = _pulse_angle + float(i) * (PI * 0.5)
		draw_arc(center, base_radius + 16.0, a0, a0 + 0.45, 16, Color(0.22, 0.85, 1.0, 0.65), 3.0, true)

	# Fundalul barei circulare
	draw_arc(center, base_radius, 0.0, TAU, 64, Color(0.08, 0.16, 0.28, 0.75), 8.0, true)

	# Arcul de progres (0% -> 100%) pornind de sus (-PI/2)
	var end_angle: float = -PI * 0.5 + TAU * progress
	var arc_col := Color("#00f0ff").lerp(Color("#22c55e"), progress)
	draw_arc(center, base_radius, -PI * 0.5, end_angle, 64, arc_col, 8.5, true)

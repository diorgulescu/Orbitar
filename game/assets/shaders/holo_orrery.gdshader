// SPDX-License-Identifier: GPL-3.0-or-later
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_back, unshaded;

uniform vec4 holo_color : source_color = vec4(0.0, 0.94, 1.0, 0.78);
uniform float rim_power : hint_range(0.5, 6.0) = 2.1;
uniform float scanline_density : hint_range(10.0, 200.0) = 85.0;
uniform float pulse_speed : hint_range(0.5, 8.0) = 2.8;
uniform float power_level : hint_range(0.0, 1.0) = 1.0;

void fragment() {
	float ndotv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float fresnel = pow(1.0 - ndotv, rim_power);
	float scanline = 0.72 + 0.28 * sin(UV.y * scanline_density - TIME * pulse_speed * 4.0);
	float pulse = 0.88 + 0.12 * sin(TIME * pulse_speed);

	// În modul de veghe (power_level scăzut), holograma trece într-o nuanță albastră calmă
	vec3 standby_blue = vec3(0.08, 0.35, 0.85);
	vec3 active_col = mix(standby_blue, holo_color.rgb, clamp(power_level, 0.0, 1.0));
	float intensity = mix(0.28, 1.0, clamp(power_level, 0.0, 1.0));

	ALBEDO = active_col * (0.35 + fresnel * 0.95) * scanline * pulse;
	ALPHA = clamp((0.25 + fresnel * 0.75) * holo_color.a * intensity, 0.05, 0.95);
}

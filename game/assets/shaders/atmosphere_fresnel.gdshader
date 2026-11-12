// SPDX-License-Identifier: GPL-3.0-or-later
shader_type spatial;
render_mode blend_add, depth_draw_never, cull_back, unshaded;

uniform vec4 atmosphere_color : source_color = vec4(0.22, 0.74, 0.97, 1.0);
uniform float rim_power : hint_range(1.0, 8.0) = 3.2;
uniform float rim_intensity : hint_range(0.0, 3.0) = 0.85;
uniform vec3 sun_direction = vec3(1.0, 0.0, 0.0);

void fragment() {
	float ndotv = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float fresnel = pow(1.0 - ndotv, rim_power);

	// Modulare subtilă după direcția Soarelui (mai luminos pe emisfera diurnă și la terminator)
	vec3 world_normal = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	float sun_factor = clamp(dot(world_normal, normalize(sun_direction)) * 0.45 + 0.65, 0.22, 1.15);

	ALBEDO = atmosphere_color.rgb * rim_intensity * sun_factor;
	ALPHA = clamp(fresnel * rim_intensity * sun_factor, 0.0, 0.92);
}

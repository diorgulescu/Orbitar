// SPDX-License-Identifier: GPL-3.0-or-later
shader_type spatial;
render_mode unshaded, cull_back;

uniform sampler2D sun_texture : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 core_color : source_color = vec3(1.0, 0.97, 0.80);
uniform vec3 mid_color : source_color = vec3(1.0, 0.72, 0.05);
uniform vec3 edge_color : source_color = vec3(0.92, 0.34, 0.04);
uniform float emission_energy : hint_range(0.5, 8.0) = 2.2;

float plasma_wave(vec3 p, float t) {
	return sin(p.x * 7.5 + t * 1.15) * cos(p.y * 7.5 - t * 0.92) * sin(p.z * 7.5 + t * 0.78);
}

void fragment() {
	vec2 anim_uv = vec2(fract(UV.x + TIME * 0.004), UV.y);
	vec3 tex_col = texture(sun_texture, anim_uv).rgb;

	vec3 local_dir = normalize((INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz);
	float n1 = plasma_wave(local_dir * 2.2, TIME);
	float n2 = plasma_wave(local_dir * 4.5 + vec3(n1), TIME);
	float gran = clamp(0.5 + 0.30 * n1 + 0.22 * n2, 0.0, 1.0);

	float fresnel = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	vec3 plasma_col = mix(mid_color, core_color, gran);
	vec3 combined = mix(tex_col * 1.25, plasma_col, 0.38);
	combined = mix(combined, edge_color, pow(fresnel, 1.75));

	ALBEDO = combined * emission_energy;
}

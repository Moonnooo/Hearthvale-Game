shader_type spatial;
render_mode cull_disabled, unshaded;
varying float height;
void vertex() {
	NORMAL = vec3(0.0, 1.0, 0.0);
	height = clamp(VERTEX.y * 6.0, 0.0, 1.0);
	VERTEX.x += sin(TIME * 1.7 + MODEL_MATRIX[3].x * 0.8 + MODEL_MATRIX[3].z) * 0.025 * height;
}
void fragment() {
	ALBEDO = mix(vec3(0.19,0.28,0.10), vec3(0.35,0.46,0.17), height);
	ROUGHNESS = 1.0;
}

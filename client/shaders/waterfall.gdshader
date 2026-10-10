shader_type spatial;
render_mode cull_disabled;
void fragment() {
	float stream = sin(UV.x*70.0 + sin(UV.x*17.0)*2.0 + UV.y*9.0-TIME*12.0);
	float foam = smoothstep(0.45,1.0,stream)*0.35 + pow(1.0-UV.y,7.0)*0.30;
	ALBEDO = mix(vec3(0.12,0.39,0.45),vec3(0.72,0.89,0.88),foam);
	ROUGHNESS = 0.28;
	EMISSION = vec3(0.03,0.07,0.07)*foam;
}

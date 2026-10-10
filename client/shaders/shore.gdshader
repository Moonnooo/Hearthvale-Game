shader_type spatial;
render_mode cull_disabled;
varying vec3 world_position;
uniform sampler2D soil_texture : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D stone_texture : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
void vertex() { world_position=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz; }
void fragment() {
 vec3 soil=pow(texture(soil_texture,world_position.xz/5.0).rgb,vec3(2.2));
 vec3 stone=pow(texture(stone_texture,vec2(world_position.x+world_position.z,world_position.y)/4.0).rgb,vec3(2.2));
 float lower=1.0-COLOR.g;
 ALBEDO=mix(soil,stone,0.25+lower*0.45)*(1.0-lower*0.25);
 ROUGHNESS=mix(0.96,0.62,lower);
}

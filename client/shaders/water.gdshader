shader_type spatial;
render_mode cull_disabled;
uniform vec4 water_colour : source_color = vec4(0.035,0.16,0.19,1.0);
uniform sampler2D wave_texture : filter_linear_mipmap, repeat_enable;
// Keep vertices on their authored level; all waves are shading-only.
void fragment() {
 vec2 flow=normalize(COLOR.gb*2.0-1.0+vec2(0.0001));
 float speed=mix(0.025,0.20,COLOR.a);
 // Two short advection phases crossfade; spatial flow differences cannot
 // stretch UVs further and further as the session runs.
 float phase=fract(TIME/4.0);
 float other=fract(phase+0.5);
 float weight=abs(phase*2.0-1.0);
 vec2 uv_a=UV-flow*(phase-0.5)*speed*4.0;
 vec2 uv_b=UV-flow*(other-0.5)*speed*4.0;
 float broad=mix(texture(wave_texture,uv_a/4.0).r,texture(wave_texture,uv_b/4.0).r,weight);
 float fine=mix(texture(wave_texture,uv_a/1.5).g,texture(wave_texture,uv_b/1.5).g,weight);
 float glint=smoothstep(0.84,0.99,fine)*0.035;
 float edge=smoothstep(0.68,1.0,COLOR.r);
 float foam=edge*smoothstep(0.44,0.76,fine)*0.22;
 vec3 deep=water_colour.rgb*(0.83+broad*0.22);
 vec3 shallow=vec3(0.10,0.21,0.18);
 ALBEDO=mix(mix(deep,shallow,edge*0.42)+vec3(glint),vec3(0.56,0.66,0.59),foam);
 ROUGHNESS=0.27+foam*0.25;
 METALLIC=0.04;
 NORMAL_MAP=normalize(vec3((broad-0.5)*0.075,(fine-0.5)*0.09,1.0))*0.5+0.5;
 NORMAL_MAP_DEPTH=0.6;
}

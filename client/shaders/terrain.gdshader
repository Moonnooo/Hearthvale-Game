shader_type spatial;
render_mode cull_disabled;
uniform vec4 base_colour : source_color = vec4(0.20, 0.30, 0.13, 1.0);
uniform bool grass = true;
uniform sampler2D path_mask : filter_linear, repeat_disable;
uniform vec2 mask_origin = vec2(0.0);
uniform vec2 mask_size = vec2(1.0);
uniform bool blend_paths = false;
uniform bool gravel_only = false;
uniform sampler2D grass_texture : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D woodland_texture : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D gravel_texture : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D rock_texture : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
varying vec3 world_normal;
varying vec3 world_position;
vec3 pigment(vec3 c) { return pow(c,vec3(2.2)); }
float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p) {
 vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
 return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
}
void vertex() {
 world_normal=normalize(MODEL_NORMAL_MATRIX*NORMAL);
 world_position=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;
}
void fragment() {
 float broad=noise(UV*0.25);
 float forest=smoothstep(0.06,0.9,COLOR.r+0.13*(noise(UV*1.6)-0.5));
 float slope=smoothstep(0.16,0.5,1.0-abs(normalize(world_normal).y));
 vec3 colour=base_colour.rgb*(0.92+broad*0.16);
 if(grass || blend_paths || gravel_only || COLOR.g>0.001) {
  vec3 meadow=pigment(texture(grass_texture,UV/7.0).rgb);
  vec3 litter=pigment(texture(woodland_texture,UV/6.0).rgb);
  vec3 ground_colour=mix(meadow,litter,forest*0.94)*(0.9+broad*0.2);
  if(slope>0.01 && !gravel_only) {
   vec3 weights=pow(abs(world_normal),vec3(4.0));weights/=max(dot(weights,vec3(1.0)),0.0001);
   vec3 rock=pigment(texture(rock_texture,world_position.yz/5.0).rgb)*weights.x+pigment(texture(rock_texture,world_position.xz/5.0).rgb)*weights.y+pigment(texture(rock_texture,world_position.xy/5.0).rgb)*weights.z;
   ground_colour=mix(ground_colour,rock,slope*0.92);
  }
  if(!grass && !blend_paths && !gravel_only) { ground_colour=colour; }
  float bank=clamp(COLOR.g+(noise(UV*4.5)-0.5)*0.16*COLOR.g,0.0,1.0);
  if(bank>0.001) {
  vec3 soil=pigment(texture(woodland_texture,UV/5.0).rgb);
  vec3 stone=pigment(texture(rock_texture,vec2(world_position.x+world_position.z,world_position.y)/4.0).rgb);
  vec3 earth=mix(soil,stone,0.25);
  ground_colour=mix(ground_colour,earth,smoothstep(0.0,0.95,bank));
  }
  colour=ground_colour;
  if(blend_paths || gravel_only) {
   float field=texture(path_mask,(UV-mask_origin+vec2(0.5))/mask_size).r;
   float edge=max(0.0,1.0-abs(field-0.5)*2.0);
   float wear=(noise(UV*5.0)-0.5)*0.25+(noise(UV*19.0)-0.5)*0.13;
   float coverage=smoothstep(0.37,0.66,field+edge*wear);
   vec3 gravel=pigment(texture(gravel_texture,UV/5.0).rgb)*(0.88+broad*0.22);
   colour=gravel_only ? gravel : mix(ground_colour,gravel,coverage);
  }
 }
 ALBEDO=colour;
 ROUGHNESS=0.94;
}

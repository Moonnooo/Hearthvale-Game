shader_type spatial;
render_mode cull_disabled;
uniform sampler2D atlas : source_color,filter_linear_mipmap_anisotropic,repeat_disable;
uniform vec2 quadrant=vec2(0.0,0.5);
uniform float tile_size=1.5;
varying vec3 world_position;
varying vec3 world_normal;
void vertex(){world_position=(MODEL_MATRIX*vec4(VERTEX,1.0)).xyz;world_normal=normalize(MODEL_NORMAL_MATRIX*NORMAL);}
void fragment(){vec3 n=abs(world_normal);vec2 uv=world_position.xy;if(n.x>n.y&&n.x>n.z){uv=world_position.zy;}else if(n.y>n.z){uv=world_position.xz;}uv=quadrant+vec2(.01)+fract(uv/tile_size)*.48;ALBEDO=texture(atlas,uv).rgb;ROUGHNESS=.88;}

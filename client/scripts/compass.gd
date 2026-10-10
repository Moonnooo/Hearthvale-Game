extends Button
signal north_requested
var heading := 0.0:
	set(v): heading=v; queue_redraw()
func _ready():
	custom_minimum_size=Vector2(52,52)
	focus_mode=Control.FOCUS_NONE
	tooltip_text="Compass · click to face north"
	for state in ["normal","hover","pressed","focus"]: add_theme_stylebox_override(state,StyleBoxEmpty.new())
	pressed.connect(func(): north_requested.emit())
func _draw():
	var c := size*.5
	draw_circle(c,24,Color("161b17"))
	draw_arc(c,24,0,TAU,64,Color("bca16a"),2,true)
	for i in range(16):
		var direction := Vector2(0,-1).rotated(i*TAU/16-heading)
		draw_line(c+direction*19,c+direction*(15 if i%4==0 else 17),Color("827657"),1,true)
	var north := Vector2(0,-1).rotated(-heading)
	var side := north.orthogonal()
	draw_colored_polygon(PackedVector2Array([c+north*14,c+side*4,c-north*2]),Color("ce6655"))
	draw_colored_polygon(PackedVector2Array([c-north*14,c+side*4,c+north*2]),Color("ded0ad"))
	var font := ThemeDB.fallback_font
	draw_string(font,c+north*19+Vector2(-4,4),"N",HORIZONTAL_ALIGNMENT_LEFT,-1,11,Color("fff1d3"))

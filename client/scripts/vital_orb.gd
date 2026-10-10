extends Button
var value := 100.0:
	set(v): value = v; queue_redraw()
var max_value := 100.0:
	set(v): max_value = maxf(1,v); queue_redraw()
var accent := Color("caa357")
var glyph := "♥"
var caption := "Health"
var regen_fraction := 0.0
func _ready() -> void:
	custom_minimum_size = Vector2(76,70)
	focus_mode = Control.FOCUS_NONE
	mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND
	for state in ["normal","hover","pressed","focus","disabled"]: add_theme_stylebox_override(state,StyleBoxEmpty.new())
	mouse_entered.connect(queue_redraw)
	mouse_exited.connect(queue_redraw)
	toggled.connect(func(_pressed): queue_redraw())
func _draw() -> void:
	var centre := Vector2(size.x*.5,31)
	draw_circle(centre,28,Color("100f0d"))
	draw_circle(centre,24,Color("272a24"))
	draw_arc(centre,27,0,TAU,64,Color("b69558") if is_hovered() else Color("65543a"),2,true)
	draw_arc(centre,23,-PI*.5,-PI*.5+TAU*clampf((value+regen_fraction)/max_value,0,1),64,accent,4,true)
	var font := ThemeDB.fallback_font
	if caption=="Stamina":
		for i in range(2 if button_pressed else 1):
			var x := centre.x-8+i*9
			draw_polyline(PackedVector2Array([Vector2(x-3,18),Vector2(x+3,23),Vector2(x-3,28)]),accent,3,true)
	else:
		var width := font.get_string_size(glyph,HORIZONTAL_ALIGNMENT_LEFT,-1,21).x
		draw_string(font,Vector2(centre.x-width*.5,28),glyph,HORIZONTAL_ALIGNMENT_LEFT,-1,21,accent)
	var number := str(int(value))
	var width := font.get_string_size(number,HORIZONTAL_ALIGNMENT_LEFT,-1,14).x
	draw_string(font,Vector2(centre.x-width*.5,45),number,HORIZONTAL_ALIGNMENT_LEFT,-1,14,Color("f3e6c8"))
	var title := ("RUN" if button_pressed else "WALK") if caption=="Stamina" else caption.to_upper()
	width = font.get_string_size(title,HORIZONTAL_ALIGNMENT_LEFT,-1,10).x
	draw_string(font,Vector2(centre.x-width*.5,68),title,HORIZONTAL_ALIGNMENT_LEFT,-1,10,Color("cbbb98"))

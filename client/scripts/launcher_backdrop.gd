extends Control

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	resized.connect(queue_redraw)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color("10241f"))
	for band in range(48):
		var t := band / 47.0
		draw_rect(Rect2(0, size.y*t, size.x, size.y/47.0+1), Color("263e3c").lerp(Color("0c1c17"), t))
	var moon := Vector2(size.x*0.83, size.y*0.19)
	draw_circle(moon, 74, Color("d3c79915"))
	draw_circle(moon, 52, Color("d3c79924"))
	draw_circle(moon, 34, Color("dfd6b4"))
	for layer in range(3):
		var points := PackedVector2Array([Vector2(0,size.y)])
		for i in range(65):
			var x := size.x*i/64.0
			var y := size.y*(0.48+layer*0.15)+sin(i*0.12+layer*2.0)*size.y*0.07+cos(i*0.27)*size.y*0.025
			points.append(Vector2(x,y))
		points.append(Vector2(size.x,size.y))
		draw_colored_polygon(points, [Color("29443b"),Color("1b342b"),Color("10271f")][layer])
	for i in range(45):
		var x := size.x*i/44.0
		var base := size.y*(0.87+sin(i*1.7)*0.07)
		var height := size.y*(0.12+0.08*(sin(i*2.4)*0.5+0.5))
		var width := height*0.3
		draw_rect(Rect2(x-3,base-height,6,height),Color("091b16"))
		for tier in range(3):
			var y := base-height+tier*height*0.19
			draw_colored_polygon(PackedVector2Array([Vector2(x,y),Vector2(x-width,y+height*0.5),Vector2(x+width,y+height*0.5)]),Color("0b211a"))
	for i in range(30):
		var spot := Vector2(fmod(i*173.3+53,size.x),fmod(i*89.7+17,size.y*0.5))
		draw_circle(spot,1.2,Color("e2d7a850"))

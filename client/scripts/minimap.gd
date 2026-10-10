extends Control

var full_map := false
var dragging := false
var player_position := Vector2.ZERO
var world: Node3D
var centre := Vector2.ZERO
var heading := 0.0
var texture: ImageTexture
var bounds := Rect2()
var markers: Array = []
var map_scale := 3.6
var generation := -1

func _ready() -> void:
	custom_minimum_size = Vector2(300, 150)
	mouse_filter = Control.MOUSE_FILTER_STOP
	tooltip_text = "Local map · north is up · wheel to zoom"

func rebuild(source: Node3D) -> void:
	world = source
	generation = world.generation
	if world.tiles.is_empty():
		return
	var low := Vector2i(100000, 100000)
	var high := Vector2i(-100000, -100000)
	for p in world.tiles:
		low = Vector2i(mini(low.x, p.x), mini(low.y, p.y))
		high = Vector2i(maxi(high.x, p.x), maxi(high.y, p.y))
	bounds = Rect2(Vector2(low) - Vector2.ONE * 0.5, Vector2(high - low + Vector2i.ONE))
	var image := Image.create(high.x-low.x+1, high.y-low.y+1, false, Image.FORMAT_RGBA8)
	image.fill(Color("17252a"))
	for p in world.tiles:
		image.set_pixel(p.x-low.x, p.y-low.y, {"grass":Color("69864c"), "water":Color("346c85"), "path":Color("b8a282"), "field":Color("aa9446"), "quarry":Color("77766e")}.get(world.tiles[p], Color("748053")))
	texture = ImageTexture.create_from_image(image)
	markers.clear()
	for key in ["buildings", "bridges", "boundaries", "nodes", "stations", "npcs"]:
		for item in world.document.get(key, []):
			markers.append({"p":Vector2(item.x, item.y), "kind":key, "data":item})
	queue_redraw()

func point(p: Vector2) -> Vector2:
	return size * 0.5 + (p - centre) * map_scale

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO,size), Color("17252a"))
	if texture:
		draw_texture_rect(texture, Rect2(point(bounds.position),bounds.size*map_scale),false)
	for marker in markers:
		var p := point(marker.p)
		var item: Dictionary = marker.data
		match marker.kind:
			"buildings": draw_rect(Rect2(p-Vector2.ONE*map_scale*0.5,Vector2(item.width,item.height)*map_scale),Color("b2a790"))
			"bridges":
				var direction := Vector2.RIGHT.rotated(deg_to_rad(float(item.get("rotation",0))))
				draw_line(p-direction*map_scale*1.5,p+direction*map_scale*1.5,Color("d4b982"),map_scale)
			"boundaries": draw_rect(Rect2(p-Vector2.ONE,Vector2(2,2)),Color("c1aa80"))
			"stations": draw_circle(p,3,Color("ffc66c"))
			"npcs": draw_circle(p,2,Color("ffff73"))
			"nodes":
				if item.get("kind") != "tree": draw_circle(p,2,Color("c0c4ca"))
	if full_map and is_instance_valid(world):
		for region in world.document.get("regions",[]):
			var label_point := point(Vector2(region.x+region.width*.5,region.y+region.height*.5))
			draw_string(ThemeDB.fallback_font,label_point,str(region.get("name","")),HORIZONTAL_ALIGNMENT_CENTER,-1,16,Color("ffead1"))
	if is_instance_valid(world):
		for actor in world.mobiles.values():
			draw_circle(point(Vector2(actor.position.x,actor.position.z)),2,Color("ffad72"))
	draw_circle(point(player_position) if full_map else size*0.5,4,Color.WHITE)
	if not full_map: draw_line(size*0.5,size*0.5+Vector2(-sin(heading),-cos(heading))*13,Color.WHITE,2)
	draw_rect(Rect2(Vector2.ZERO,size),Color("d5b57b"),false,2)
	if full_map: draw_string(ThemeDB.fallback_font,Vector2(9,20),"N",HORIZONTAL_ALIGNMENT_LEFT,-1,16,Color.WHITE)

func _gui_input(event: InputEvent) -> void:
	if full_map and event is InputEventMouseButton and event.button_index in [MOUSE_BUTTON_LEFT,MOUSE_BUTTON_RIGHT]:
		dragging = event.pressed
		accept_event()
	if full_map and event is InputEventMouseMotion and dragging:
		centre -= event.relative/map_scale
		queue_redraw()
		accept_event()
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP: map_scale = minf(128 if full_map else 8,map_scale*1.15)
		if event.button_index == MOUSE_BUTTON_WHEEL_DOWN: map_scale = maxf(.08 if full_map else 1,map_scale/1.15)
		if event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]: accept_event()
		queue_redraw()

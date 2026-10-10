extends Node3D

var bar: Sprite3D
var numbers: Dictionary = {}
var signature := ""
var previous_hp := -1
var combat_until := -100000.0

func _ready() -> void:
	bar = Sprite3D.new()
	bar.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	bar.no_depth_test = true
	bar.pixel_size = 0.009
	bar.position.y = 1.95
	add_child(bar)
	bar.hide()

func update_state(state: Dictionary, now: float) -> void:
	var hp := int(state.get("hp",0))
	var maximum := maxi(1,int(state.get("maxHp",10)))
	var hits: Array = state.get("hits",[])
	if previous_hp >= 0 and hp < previous_hp: combat_until = now+4500
	previous_hp = hp
	for hit in hits: combat_until = maxf(combat_until,float(hit.get("at",-100000))+4500)
	combat_until = maxf(combat_until,float(state.get("swingAt",-100000))+4500)
	bar.visible = hp>0 and (state.get("action","")=="Fighting" or now<combat_until)
	var next := str(hp)+":"+str(maximum)
	if next != signature:
		signature = next
		var image := Image.create(66,10,false,Image.FORMAT_RGBA8)
		image.fill(Color("18241a"))
		for y in range(2,8):
			for x in range(2,64):
				image.set_pixel(x,y,Color("53b853") if x-2<roundi(62.0*hp/maximum) else Color("a93232"))
		bar.texture = ImageTexture.create_from_image(image)
	for hit in hits:
		var id := str(hit.id)
		if not numbers.has(id):
			var label := Label3D.new()
			label.text = str(hit.damage)
			label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			label.no_depth_test = true
			label.font_size = 40
			label.outline_size = 12
			label.outline_modulate = Color("345e91") if int(hit.damage)==0 else Color("af8426") if hit.get("strong",false) else Color("922d2d")
			label.position = Vector3((numbers.size()%3-1)*0.15,1.65,0)
			add_child(label)
			numbers[id] = {"node":label,"at":float(hit.at)}
	for id in numbers.keys():
		var entry: Dictionary = numbers[id]
		var age: float = (now-entry.at)/1000.0
		if age>=2:
			entry.node.queue_free()
			numbers.erase(id)
		else:
			entry.node.position.y = 1.65+maxf(0,age)*0.18
			entry.node.modulate.a = clampf(2-age,0,1)

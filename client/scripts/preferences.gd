extends Node
signal changed(values: Dictionary)
const FILE = "user://preferences.cfg"
const DEFAULTS = {"master":0.8,"effects":0.8,"ambience":0.45,"quality":1,"fps":60,"ui_scale":1.0,"sensitivity":1.0}
const KEYS = {"camera_left":KEY_LEFT,"camera_right":KEY_RIGHT,"camera_up":KEY_UP,"camera_down":KEY_DOWN,"world_map":KEY_M,"run_toggle":KEY_R,"settings":KEY_ESCAPE,"fullscreen":KEY_F11}
var values: Dictionary = DEFAULTS.duplicate()
var bindings: Dictionary = KEYS.duplicate()
var storage_path := FILE
var rebinding := ""
var bind_button: Button
var panel: Control
var binding_buttons: Dictionary = {}

func _ready() -> void:
	var config := ConfigFile.new()
	if config.load(storage_path) == OK:
		for key in DEFAULTS:
			var value = config.get_value("settings", key, DEFAULTS[key])
			if value is float or value is int: values[key] = value
		for key in KEYS:
			var value = config.get_value("keys",key,KEYS[key])
			if value is int and value>0: bindings[key] = value
	for key in ["master","effects","ambience"]: values[key] = clampf(float(values[key]),0,1)
	values.quality = clampi(int(values.quality),0,2)
	values.ui_scale = clampf(float(values.ui_scale),0.8,1.25)
	values.sensitivity = clampf(float(values.sensitivity),0.5,2)
	if int(values.fps) not in [30,60,120]: values.fps = 60
	apply_bindings()

func apply_bindings() -> void:
	for action in bindings:
		if not InputMap.has_action(action): InputMap.add_action(action)
		InputMap.action_erase_events(action)
		var event := InputEventKey.new()
		event.physical_keycode = int(bindings[action])
		InputMap.action_add_event(action,event)

func set_value(key: String, value: Variant) -> void:
	values[key] = value
	save()
	changed.emit(values)

func save() -> void:
	var config := ConfigFile.new()
	for key in values: config.set_value("settings",key,values[key])
	for key in bindings: config.set_value("keys",key,bindings[key])
	config.save(storage_path)

func show_settings(hud: Control) -> void:
	binding_buttons.clear()
	var box: VBoxContainer = hud.create_modal("Settings")
	panel = hud.modal
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(600,330)
	box.add_child(scroll)
	var content := VBoxContainer.new()
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(content)
	for entry in [["master","Master volume",0.0,1.0,0.05],["effects","Action sounds",0.0,1.0,0.05],["ambience","World ambience",0.0,1.0,0.05],["ui_scale","Game panel scale",0.8,1.25,0.05],["sensitivity","Camera sensitivity",0.5,2.0,0.1]]:
		var row := HBoxContainer.new()
		content.add_child(row)
		var label := Label.new()
		label.text = entry[1]
		label.custom_minimum_size.x = 220
		row.add_child(label)
		var slider := HSlider.new()
		slider.min_value = entry[2]
		slider.max_value = entry[3]
		slider.step = entry[4]
		slider.value = values[entry[0]]
		slider.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var track := StyleBoxFlat.new()
		track.bg_color = Color("20251d")
		track.set_corner_radius_all(4)
		track.content_margin_top = 3
		track.content_margin_bottom = 3
		slider.add_theme_stylebox_override("slider",track)
		var fill := track.duplicate()
		fill.bg_color = Color("b49761")
		slider.add_theme_stylebox_override("grabber_area",fill)
		row.add_child(slider)
		var reading := Label.new()
		reading.custom_minimum_size.x = 55
		reading.text = "%d%%" % int(slider.value*100)
		row.add_child(reading)
		slider.value_changed.connect(func(value):
			reading.text = "%d%%" % int(value*100)
			set_value(entry[0],value))
	for entry in [["quality","Graphics",["Low","Balanced","High"]],["fps","Frame limit",["30","60","120"]]]:
		var row := HBoxContainer.new()
		content.add_child(row)
		var label := Label.new()
		label.text = entry[1]
		label.custom_minimum_size.x = 220
		row.add_child(label)
		var option := OptionButton.new()
		for choice in entry[2]: option.add_item(choice)
		option.select(int(values.quality) if entry[0]=="quality" else [30,60,120].find(int(values.fps)))
		option.item_selected.connect(func(index): set_value(entry[0],index if entry[0]=="quality" else [30,60,120][index]))
		row.add_child(option)
	var note := Label.new()
	note.text = "Controls · select a button, then press a new key"
	content.add_child(note)
	for action in KEYS:
		var button := Button.new()
		binding_buttons[action] = button
		button.text = action.replace("_"," ").capitalize()+" · "+OS.get_keycode_string(int(bindings[action]))
		button.pressed.connect(func():
			rebinding = action
			bind_button = button
			button.text = "Press a key… (Escape cancels)")
		content.add_child(button)
	var reset := Button.new()
	reset.text = "Restore defaults"
	reset.pressed.connect(func():
		values = DEFAULTS.duplicate()
		bindings = KEYS.duplicate()
		apply_bindings()
		save()
		changed.emit(values)
		show_settings(hud))
	box.add_child(reset)

func _input(event: InputEvent) -> void:
	if rebinding.is_empty(): return
	if not is_instance_valid(panel):
		rebinding = ""
		return
	if event is InputEventKey and event.pressed and not event.echo:
		if event.keycode != KEY_ESCAPE:
			var code := int(event.physical_keycode if event.physical_keycode else event.keycode)
			# Swap duplicate bindings rather than causing two actions at once.
			for action in bindings:
				if action!=rebinding and bindings[action]==code: bindings[action] = bindings[rebinding]
			bindings[rebinding] = code
			apply_bindings()
			save()
		for action in binding_buttons:
			binding_buttons[action].text = action.replace("_"," ").capitalize()+" · "+OS.get_keycode_string(int(bindings[action]))
		changed.emit(values)
		rebinding = ""
		get_viewport().set_input_as_handled()

extends PanelContainer

signal command(data: Dictionary)
signal leave_requested
signal fullscreen_requested
signal settings_requested
signal layout_requested
signal north_requested
var catalog: Dictionary = {}
var tabs: TabContainer
var inventory_grid: GridContainer
var skills_grid: GridContainer
var equipment_grid: GridContainer
var inventory_label: Label
var skill_label: Label
var cells: Array[Button] = []
var skill_cells: Dictionary = {}
var equipment_cells: Dictionary = {}
var last_signature := ""
var player: Dictionary = {}
var item_menu: PopupMenu
var selected_item := ""
var selected_operation := "deposit"
var modal: Control
var modal_box: VBoxContainer
var bank_grid: GridContainer
var deposit_grid: GridContainer
var transfer_amount: SpinBox
var transfer_all: CheckBox
var bank_open := false
var font: SystemFont
var minimap: Control
var vitals: Label
var vital_bars: Array[Control] = []
var run_button: Button
var collapse_button: Button
var compass: Control
var server_time := 0.0
var xp_badge: PanelContainer
var xp_title: Label
var xp_detail: Label
var xp_progress: ProgressBar
var previous_xp: Dictionary = {}
var xp_badge_until := 0.0
var xp_skill := ""
var xp_gain := 0
const SKILL_ICONS = {"attack": "⚔", "strength": "✊", "defence": "🛡", "hitpoints": "♥", "mining": "⛏", "smithing": "⚒", "woodcutting": "♣", "fishing": "♓", "cooking": "♨", "prayer": "✦", "magic": "★", "ranged": "➶", "agility": "➟", "herblore": "⚗", "thieving": "♧", "crafting": "✂", "firemaking": "♨", "fletching": "➶", "runecraft": "◈", "slayer": "☠", "farming": "♣", "construction": "⌂", "hunter": "♧", "sailing": "⚓"}

func _ready() -> void:
	apply_game_theme()
	catalog = JSON.parse_string(FileAccess.get_file_as_string("res://catalog.json"))
	font = SystemFont.new()
	font.font_names = PackedStringArray(["Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI"])
	var layout := VBoxContainer.new()
	add_child(layout)
	var title_row := HBoxContainer.new()
	layout.add_child(title_row)
	vitals = Label.new()
	vitals.text = "Combat level —"
	vitals.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vitals.add_theme_color_override("font_color",Color("dfc18a"))
	title_row.add_child(vitals)
	collapse_button = Button.new()
	collapse_button.text = "▴"
	collapse_button.tooltip_text = "Collapse inventory, skills and equipment"
	title_row.add_child(collapse_button)
	collapse_button.pressed.connect(func():
		tabs.visible = not tabs.visible
		collapse_button.text = "▴" if tabs.visible else "▾"
		collapse_button.tooltip_text = "Collapse inventory" if tabs.visible else "Expand inventory"
		anchor_bottom = 1.0 if tabs.visible else 0.0
		offset_bottom = -20 if tabs.visible else 385
		layout_requested.emit())
	var map_header := HBoxContainer.new()
	layout.add_child(map_header)
	compass = preload("res://scripts/compass.gd").new()
	map_header.add_child(compass)
	compass.north_requested.connect(func(): north_requested.emit())
	var map_title := Label.new()
	map_title.text = "HEARTHVALE\nLocal map"
	map_title.add_theme_font_size_override("font_size",13)
	map_title.add_theme_color_override("font_color",Color("cbbb98"))
	map_header.add_child(map_title)
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	map_header.add_child(spacer)
	for entry in [["◎","World map (M)",show_world_map],["⌂","Leave to main menu",func(): leave_requested.emit()],["⛶","Fullscreen (F11)",func(): fullscreen_requested.emit()],["⚙","Settings",func(): settings_requested.emit()]]:
		var control := Button.new()
		control.text = entry[0]
		control.tooltip_text = entry[1]
		if str(entry[1]).begins_with("World map"): control.set_meta("binding","world_map")
		elif str(entry[1]).begins_with("Fullscreen"): control.set_meta("binding","fullscreen")
		elif str(entry[1])=="Settings": control.set_meta("binding","settings")
		control.focus_mode = Control.FOCUS_NONE
		control.custom_minimum_size = Vector2(35,32)
		control.pressed.connect(entry[2])
		map_header.add_child(control)
	minimap = preload("res://scripts/minimap.gd").new()
	minimap.clip_contents = true
	layout.add_child(minimap)
	var meters := HBoxContainer.new()
	meters.alignment = BoxContainer.ALIGNMENT_CENTER
	meters.add_theme_constant_override("separation",24)
	layout.add_child(meters)
	for i in range(3):
		var orb := preload("res://scripts/vital_orb.gd").new()
		orb.accent = [Color("b6534b"),Color("78aac4"),Color("d0b462")][i]
		orb.glyph = ["♥","✦",""][i]
		orb.caption = ["Health","Prayer","Stamina"][i]
		meters.add_child(orb)
		vital_bars.append(orb)
		if i==2:
			run_button = orb
			run_button.toggle_mode = true
			run_button.pressed.connect(func():
				run_button.set_pressed_no_signal(bool(player.get("runEnabled",false)))
				command.emit({"type":"runToggle"}))
	tabs = TabContainer.new()
	tabs.size_flags_vertical = Control.SIZE_EXPAND_FILL
	layout.add_child(tabs)
	var pack := VBoxContainer.new()
	pack.name = "Backpack"
	tabs.add_child(pack)
	inventory_label = Label.new()
	inventory_label.text = "0 / 28 slots"
	pack.add_child(inventory_label)
	inventory_grid = GridContainer.new()
	inventory_grid.columns = 4
	inventory_grid.add_theme_constant_override("h_separation", 6)
	inventory_grid.add_theme_constant_override("v_separation", 6)
	scroll_grid(pack,inventory_grid)
	for i in range(28):
		var cell := make_cell("", 0)
		inventory_grid.add_child(cell)
		cells.append(cell)
	var skills := VBoxContainer.new()
	skills.name = "Skills"
	tabs.add_child(skills)
	skill_label = Label.new()
	skills.add_child(skill_label)
	skills_grid = GridContainer.new()
	skills_grid.columns = 3
	skills_grid.add_theme_constant_override("h_separation", 4)
	skills_grid.add_theme_constant_override("v_separation", 4)
	scroll_grid(skills,skills_grid)
	for entry in catalog.skills:
		var card := Button.new()
		card.custom_minimum_size = Vector2(99, 46)
		card.focus_mode = Control.FOCUS_NONE
		card.add_theme_font_size_override("font_size", 13)
		card.add_theme_font_override("font", font)
		card.text = str(entry[1]) + "\n1 / 99"
		skills_grid.add_child(card)
		skill_cells[entry[0]] = card
	var equip := VBoxContainer.new()
	equip.name = "Equipment"
	tabs.add_child(equip)
	var note := Label.new()
	note.text = "Click an equipped item to remove it."
	note.add_theme_font_size_override("font_size", 13)
	equip.add_child(note)
	equipment_grid = GridContainer.new()
	equipment_grid.columns = 2
	scroll_grid(equip,equipment_grid)
	for slot in catalog.equipmentSlots:
		var card := Button.new()
		card.custom_minimum_size = Vector2(152, 70)
		card.focus_mode = Control.FOCUS_NONE
		card.add_theme_font_size_override("font_size", 14)
		card.add_theme_font_override("font", font)
		card.text = str(slot[1]) + "\nEmpty"
		card.pressed.connect(func(): command.emit({"type": "unequip", "slot": slot[0]}))
		equipment_grid.add_child(card)
		equipment_cells[slot[0]] = card
	item_menu = PopupMenu.new()
	add_child(item_menu)
	item_menu.id_pressed.connect(item_action)
	create_xp_badge()

func make_cell(item: String, count: int) -> Button:
	var cell := Button.new()
	cell.custom_minimum_size = Vector2(72, 54)
	cell.focus_mode = Control.FOCUS_NONE
	cell.add_theme_font_override("font", font)
	cell.add_theme_font_size_override("font_size", 20)
	for state in ["normal", "disabled", "hover", "pressed"]:
		var style := StyleBoxFlat.new()
		style.bg_color = Color("292720") if state != "hover" else Color("403a2b")
		style.border_color = Color("66563c") if state != "hover" else Color("c4ac71")
		style.set_border_width_all(1)
		style.set_corner_radius_all(4)
		cell.add_theme_stylebox_override(state, style)
	cell.gui_input.connect(func(event):
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_RIGHT:
			open_item_menu(str(cell.get_meta("item", "")), str(cell.get_meta("operation", "deposit")))
			cell.accept_event())
	cell.pressed.connect(func(): click_item(str(cell.get_meta("item", ""))))
	set_cell(cell, item, count)
	return cell

func set_cell(cell: Button, item: String, count: int) -> void:
	cell.set_meta("item", item)
	cell.disabled = item.is_empty()
	var definition: Dictionary = catalog.get("items", {}).get(item, {})
	cell.text = str(definition.get("icon", "◆")) + "\n" + str(count) if not item.is_empty() else ""
	cell.tooltip_text = str(definition.get("label", item)) + " · " + str(count) if not item.is_empty() else "Empty slot"
	if definition.has("color"):
		cell.add_theme_color_override("font_color", Color.hex((int(definition.color) << 8) | 255))
	cell.mouse_default_cursor_shape = Control.CURSOR_POINTING_HAND

func update_player(data: Dictionary) -> void:
	vitals.text = "Combat level %d" % int(data.get("combatLevel", 3))
	var values := [[data.get("hp",10),data.get("maxHp",10)], [data.get("prayerPoints",1),data.get("maxPrayer",1)], [data.get("energy",100),100]]
	for i in range(3):
		vital_bars[i].max_value = maxf(1,float(values[i][1]))
		vital_bars[i].value = float(values[i][0])
		vital_bars[i].tooltip_text = ["Health", "Prayer", "Stamina"][i] + " %d/%d" % [int(values[i][0]), int(values[i][1])]
	run_button.set_pressed_no_signal(bool(data.get("runEnabled",false)))
	run_button.tooltip_text = ("Running" if data.get("runEnabled",false) else "Walking")+" · click to toggle. Stamina recovers faster while standing."
	track_xp(data.get("xp", {}))
	player = data
	var signature := JSON.stringify([data.get("inventory", {}), data.get("levels", {}), data.get("equipment", {}), data.get("bank", {}), data.get("xp", {})])
	if signature == last_signature:
		return
	last_signature = signature
	var held: Array = []
	for item in data.get("inventory", {}):
		if float(data.inventory[item]) > 0:
			held.append(item)
	for i in range(28):
		var item: String = held[i] if i < held.size() else ""
		set_cell(cells[i], item, int(data.inventory[item]) if not item.is_empty() else 0)
	inventory_label.text = str(held.size()) + " / 28 slots"
	var total := 0
	for entry in catalog.skills:
		var level := int(data.get("levels", {}).get(entry[0], 1))
		total += level
		var card: Button = skill_cells[entry[0]]
		card.text = str(SKILL_ICONS.get(entry[0], "✦")) + " " + str(entry[1]) + "\n" + str(level) + " / 99"
		card.tooltip_text = str(entry[1]) + " · " + str(data.get("xp", {}).get(entry[0], 0)) + " XP"
	skill_label.text = "Combat " + str(int(data.get("combatLevel", 3))) + "   ·   Total level " + str(total)
	for entry in catalog.equipmentSlots:
		var item = data.get("equipment", {}).get(entry[0])
		var definition: Dictionary = catalog.items.get(item, {}) if item else {}
		var card: Button = equipment_cells[entry[0]]
		card.text = str(entry[1]) + "\n" + str(definition.get("icon", "—"))
		card.tooltip_text = str(definition.get("label", "Empty"))
	if bank_open:
		refresh_bank()

func click_item(item: String) -> void:
	if item.is_empty():
		return
	if bank_open:
		transfer(item, "deposit")
	elif catalog.items.get(item, {}).has("equipmentSlot"):
		command.emit({"type": "equip", "item": item})
	else:
		open_item_menu(item)

func open_item_menu(item: String, operation := "deposit") -> void:
	if item.is_empty():
		return
	selected_item = item
	selected_operation = operation
	item_menu.clear()
	if bank_open or catalog.items.get(item, {}).has("equipmentSlot"):
		item_menu.add_item(operation.capitalize() if bank_open else "Equip", 1)
	if item == "bones":
		item_menu.add_item("Bury", 4)
	if catalog.items.get(item, {}).has("heal"):
		item_menu.add_item("Eat", 5)
	item_menu.add_item("Drop 1", 2)
	item_menu.add_item("Drop all", 3)
	item_menu.position = Vector2i(get_viewport().get_mouse_position())
	item_menu.popup()

func item_action(id: int) -> void:
	match id:
		1:
			if bank_open:
				transfer(selected_item, selected_operation)
			else:
				click_item(selected_item)
		2, 3: command.emit({"type": "drop", "item": selected_item, "amount": 1 if id == 2 else "all"})
		4: command.emit({"type": "bury", "item": selected_item})
		5: command.emit({"type": "eat", "item": selected_item})

func create_modal(title: String) -> VBoxContainer:
	close_modal()
	modal = Control.new()
	modal.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	get_parent().add_child(modal)
	var shade := ColorRect.new()
	shade.color = Color(0.02, 0.03, 0.025, 0.22)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	shade.gui_input.connect(func(event):
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
			close_modal())
	modal.add_child(shade)
	var panel := PanelContainer.new()
	panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	panel.offset_left = -340
	panel.offset_right = 340
	panel.offset_top = -260
	panel.offset_bottom = 260
	var style := StyleBoxFlat.new()
	style.bg_color = Color("182a22")
	style.border_color = Color("99865e")
	style.set_border_width_all(2)
	style.set_content_margin_all(20)
	style.set_corner_radius_all(10)
	panel.add_theme_stylebox_override("panel", style)
	modal.add_child(panel)
	modal_box = VBoxContainer.new()
	modal_box.add_theme_constant_override("separation", 12)
	panel.add_child(modal_box)
	var heading := Label.new()
	heading.text = title
	heading.add_theme_font_size_override("font_size", 26)
	modal_box.add_child(heading)
	var close := Button.new()
	close.text = "Close"
	close.focus_mode = Control.FOCUS_NONE
	close.pressed.connect(close_modal)
	modal_box.add_child(close)
	return modal_box

func close_modal() -> void:
	bank_open = false
	if is_instance_valid(modal):
		modal.queue_free()
	modal = null

func show_dialog(title: String, text: String) -> void:
	var box := create_modal(title)
	var body := RichTextLabel.new()
	body.custom_minimum_size = Vector2(600, 350)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.selection_enabled = false
	body.text = text.replace("•", "\n•")
	box.add_child(body)

func show_bank() -> void:
	var box := create_modal("Bank")
	bank_open = true
	# Keep the regular backpack above the backdrop so it can deposit too.
	get_parent().move_child(modal, get_index())
	var note := Label.new()
	note.text = "Click backpack items to deposit. Click bank items to withdraw."
	note.add_theme_font_size_override("font_size", 14)
	box.add_child(note)
	var amounts := HBoxContainer.new()
	box.add_child(amounts)
	var amount_label := Label.new()
	amount_label.text = "Transfer amount"
	amounts.add_child(amount_label)
	transfer_amount = SpinBox.new()
	transfer_amount.min_value = 1
	transfer_amount.max_value = 999999999
	transfer_amount.value = 1
	amounts.add_child(transfer_amount)
	transfer_all = CheckBox.new()
	transfer_all.text = "All"
	amounts.add_child(transfer_all)
	var columns := HBoxContainer.new()
	box.add_child(columns)
	var bank_column := VBoxContainer.new()
	columns.add_child(bank_column)
	var bank_title := Label.new()
	bank_title.text = "Bank · click to withdraw"
	bank_column.add_child(bank_title)
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(300, 280)
	bank_column.add_child(scroll)
	bank_grid = GridContainer.new()
	bank_grid.columns = 4
	scroll.add_child(bank_grid)
	var pack_scroll := ScrollContainer.new()
	var pack_column := VBoxContainer.new()
	columns.add_child(pack_column)
	var pack_title := Label.new()
	pack_title.text = "Backpack · click to deposit"
	pack_column.add_child(pack_title)
	pack_scroll.custom_minimum_size = Vector2(300, 280)
	pack_column.add_child(pack_scroll)
	deposit_grid = GridContainer.new()
	deposit_grid.columns = 4
	pack_scroll.add_child(deposit_grid)
	refresh_bank()

func refresh_bank() -> void:
	for child in bank_grid.get_children():
		bank_grid.remove_child(child)
		child.queue_free()
	for item in player.get("bank", {}):
		if float(player.bank[item]) <= 0:
			continue
		var cell := make_cell(item, int(player.bank[item]))
		cell.set_meta("operation", "withdraw")
		for callback in cell.pressed.get_connections():
			cell.pressed.disconnect(callback.callable)
		cell.pressed.connect(func(): transfer(item, "withdraw"))
		bank_grid.add_child(cell)
	for child in deposit_grid.get_children():
		deposit_grid.remove_child(child)
		child.queue_free()
	for item in player.get("inventory", {}):
		if float(player.inventory[item]) > 0:
			deposit_grid.add_child(make_cell(item, int(player.inventory[item])))

func transfer(item: String, operation: String) -> void:
	if transfer_amount.get_line_edit().has_focus():
		transfer_amount.apply()
	command.emit({"type": "bank", "operation": operation, "item": item, "amount": "all" if transfer_all.button_pressed else int(transfer_amount.value)})

func show_crafting(kind: String, message: Dictionary) -> void:
	var group := "smelting" if kind == "smelteryOpen" else "workbench" if kind == "workbenchOpen" else "anvil"
	var box := create_modal("Smeltery" if group == "smelting" else "Woodworking workbench" if group == "workbench" else "Anvil")
	var scroll := ScrollContainer.new()
	scroll.custom_minimum_size = Vector2(600, 350)
	box.add_child(scroll)
	var recipes := VBoxContainer.new()
	recipes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.add_child(recipes)
	for recipe in catalog.get(group, []):
		var row := HBoxContainer.new()
		var name_label := Label.new()
		name_label.text = str(catalog.items.get(recipe.get("output", ""), {}).get("label", recipe.get("id", "Recipe")))
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		name_label.custom_minimum_size.x = 250
		row.add_child(name_label)
		for amount in ["one", "all"]:
			var make := Button.new()
			make.text = "Make 1" if amount == "one" else "Make all"
			make.focus_mode = Control.FOCUS_NONE
			make.pressed.connect(func(): command.emit({"type": "smelt" if group == "smelting" else "craft" if group == "workbench" else "smith", "station": message.get("station", "smeltery"), "recipe": recipe.id, "amount": amount}))
			row.add_child(make)
		recipes.add_child(row)

func show_shop(message: Dictionary) -> void:
	var box := create_modal("Town merchant")
	var purse := Label.new()
	purse.text = "Backpack coins: " + str(player.get("inventory", {}).get("coins", 0))
	box.add_child(purse)
	for stock in catalog.get("shopStock", []):
		var buy := Button.new()
		buy.text = "Buy " + str(catalog.items[stock.item].label) + " · " + str(stock.price) + " coins"
		buy.focus_mode = Control.FOCUS_NONE
		buy.pressed.connect(func(): command.emit({"type": "shop", "merchant": message.merchant, "operation": "buy", "item": stock.item, "amount": 1}))
		box.add_child(buy)
	for item in catalog.get("shopBuys", {}):
		var sell := Button.new()
		sell.text = "Sell 1 " + str(catalog.items[item].label) + " · " + str(catalog.shopBuys[item]) + " coins"
		sell.focus_mode = Control.FOCUS_NONE
		sell.pressed.connect(func(): command.emit({"type": "shop", "merchant": message.merchant, "operation": "sell", "item": item, "amount": 1}))
		box.add_child(sell)

func show_travel(message: Dictionary) -> void:
	var box := create_modal("Choose a port" if message.get("method") == "port" else "Choose a teleport destination")
	for destination in message.get("destinations", []):
		var travel := Button.new()
		travel.text = str(destination.name)
		travel.focus_mode = Control.FOCUS_NONE
		travel.pressed.connect(func():
			command.emit({"type": "travel", "method": message.method, "source": message.get("source"), "destination": destination.id})
			close_modal())
		box.add_child(travel)
	if message.get("destinations", []).is_empty():
		var empty := Label.new()
		empty.text = "No destinations are available yet."
		box.add_child(empty)


func show_world_map() -> void:
	if not is_instance_valid(minimap.world): return
	if is_instance_valid(modal) and modal.get_meta("world_map",false):
		close_modal()
		return
	var box := create_modal("World map · drag to pan · wheel to zoom")
	modal.set_meta("world_map",true)
	var panel: Control = box.get_parent()
	panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	panel.offset_left = 36
	panel.offset_top = 36
	panel.offset_right = -36
	panel.offset_bottom = -36
	var map := preload("res://scripts/minimap.gd").new()
	map.full_map = true
	map.clip_contents = true
	map.size_flags_vertical = Control.SIZE_EXPAND_FILL
	box.add_child(map)
	map.rebuild(minimap.world)
	map.player_position = minimap.centre
	await get_tree().process_frame
	map.centre = map.bounds.get_center()
	map.map_scale = minf(map.size.x/map.bounds.size.x,map.size.y/map.bounds.size.y)*.93
	map.queue_redraw()

func scroll_grid(parent: Control,grid: Control) -> void:
	var scroll := ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	parent.add_child(scroll)
	scroll.add_child(grid)

func _process(_delta: float) -> void:
	if is_instance_valid(xp_badge):
		xp_badge.scale = scale
		xp_badge.position = Vector2(global_position.x - 330*scale.x, 12)
		xp_badge.visible = Time.get_ticks_msec() / 1000.0 < xp_badge_until
	if vital_bars.size()<3: return
	var regen: Dictionary = player.get("hpRegen") if player.get("hpRegen") is Dictionary else {}
	var fraction := 0.0
	if not regen.is_empty() and not regen.get("paused",false) and regen.get("readyAt")!=null:
		fraction = clampf(1-(float(regen.readyAt)-(Time.get_ticks_msec()+server_time))/maxf(1,float(regen.get("duration",10000))),0,1)
	vital_bars[0].regen_fraction = fraction
	vital_bars[0].queue_redraw()

func apply_game_theme() -> void:
	var skin := Theme.new()
	for state in ["normal","hover","pressed","disabled","focus"]:
		var style := StyleBoxFlat.new()
		style.bg_color = Color("433b2e") if state=="hover" else Color("211f1a") if state=="pressed" else Color("302c23")
		style.border_color = Color("bc985b") if state=="hover" else Color("66553a")
		style.set_border_width_all(1)
		style.set_corner_radius_all(5)
		style.content_margin_left = 8
		style.content_margin_right = 8
		style.content_margin_top = 6
		style.content_margin_bottom = 6
		skin.set_stylebox(state,"Button",style)
		skin.set_color("font_color","Button",Color("ecdfc1"))
	for state in ["tab_selected","tab_unselected","tab_hovered"]:
		var style := StyleBoxFlat.new()
		style.bg_color = Color("514330") if state=="tab_selected" else Color("24221c")
		style.border_color = Color("9d7b45")
		style.set_border_width_all(1)
		style.content_margin_left = 9
		style.content_margin_right = 9
		style.content_margin_top = 7
		style.content_margin_bottom = 7
		skin.set_stylebox(state,"TabContainer",style)
	theme = skin

func create_xp_badge() -> void:
	xp_badge = PanelContainer.new()
	xp_badge.set_as_top_level(true)
	xp_badge.mouse_filter = Control.MOUSE_FILTER_IGNORE
	xp_badge.custom_minimum_size = Vector2(310, 110)
	var style := StyleBoxFlat.new()
	style.bg_color = Color("252a21")
	style.border_color = Color("bc985b")
	style.set_border_width_all(1)
	style.set_corner_radius_all(8)
	style.set_content_margin_all(12)
	xp_badge.add_theme_stylebox_override("panel", style)
	add_child(xp_badge)
	var content := VBoxContainer.new()
	content.mouse_filter = Control.MOUSE_FILTER_IGNORE
	xp_badge.add_child(content)
	xp_title = Label.new()
	xp_title.add_theme_font_override("font", font)
	xp_title.add_theme_color_override("font_color", Color("f0d58e"))
	content.add_child(xp_title)
	xp_progress = ProgressBar.new()
	xp_progress.custom_minimum_size.y = 12
	xp_progress.show_percentage = false
	var fill := StyleBoxFlat.new()
	fill.bg_color = Color("bc985b")
	fill.set_corner_radius_all(5)
	xp_progress.add_theme_stylebox_override("fill", fill)
	xp_progress.mouse_filter = Control.MOUSE_FILTER_IGNORE
	content.add_child(xp_progress)
	xp_detail = Label.new()
	xp_detail.add_theme_font_size_override("font_size", 13)
	content.add_child(xp_detail)
	xp_badge.hide()

static func xp_threshold(level: int) -> int:
	var points := 0
	for n in range(1, clampi(level, 1, 99)):
		points += int(floor(n + 300 * pow(2, n / 7.0)))
	return int(floor(points / 4.0))

func track_xp(current: Dictionary) -> void:
	if current.is_empty():
		previous_xp.clear()
		xp_badge_until = 0
		return
	for skill in current:
		var value := int(current[skill])
		var gained := value - int(previous_xp.get(skill, value))
		if gained <= 0: continue
		var now := Time.get_ticks_msec() / 1000.0
		xp_gain = xp_gain + gained if xp_skill == skill and now < xp_badge_until else gained
		xp_skill = skill
		xp_badge_until = now + 7.0
		var level := 1
		while level < 99 and value >= xp_threshold(level + 1): level += 1
		var next := xp_threshold(level + 1)
		var start := xp_threshold(level)
		var skill_name := str(skill).capitalize()
		for entry in catalog.skills:
			if entry[0] == skill: skill_name = str(entry[1])
		xp_title.text = "%s %s  +%d XP" % [SKILL_ICONS.get(skill, "✦"), skill_name, xp_gain]
		xp_progress.value = 100.0 if level == 99 else 100.0 * (value - start) / (next - start)
		xp_detail.text = "%d total XP · Level %d" % [value, level]
		xp_detail.text += " · Maximum level" if level == 99 else " → %d\n%d XP to next level" % [level + 1, next - value]
	previous_xp = current.duplicate(true)

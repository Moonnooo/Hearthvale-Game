extends Node3D

const Server = preload("res://scripts/server.gd")
const World = preload("res://scripts/world.gd")
const Rig = preload("res://scripts/rig.gd")
const GameHUD = preload("res://scripts/game_hud.gd")
const Overhead = preload("res://scripts/overhead.gd")
var server: Node
var world: Node3D
var camera: Camera3D
var ui: CanvasLayer
var menu: PanelContainer
var menu_box: VBoxContainer
var status: Label
var loading: Label
var username: LineEdit
var password: LineEdit
var world_picker: OptionButton
var sidebar: PanelContainer
var hud: Label
var destination: MeshInstance3D
var destination_tile := Vector2.ZERO
var destination_started := -100000
var interaction_click: Label
var interaction_at := -100000
var hover_hint: Label
var chat: RichTextLabel
var login_button: Button
var account_captions: Array[Label] = []
var account_notice: Label
var login_busy := false
var menu_message: Label
var session_character: Dictionary = {}
var self_id := ""
var playing := false
var preview := false
var loading_world := false
var focus_point := Vector3(17, 0, 26)
var yaw := 0.0
var pitch := 0.72
var distance := 19.0
var snapshots: Array = []
var clock_offset := 0.0
var actors: Dictionary = {}
var prepared_player: Node3D
var phase := 0.0
var last_activity := 0
var smoke := false
var preferences: Node
var feedback: Node3D
var benchmark := "--benchmark" in OS.get_cmdline_user_args()

func _ready() -> void:
	Engine.max_fps = 60
	smoke = "--smoke-test" in OS.get_cmdline_user_args()
	get_window().title = "Hearthvale · Godot Prototype"
	server = Server.new()
	add_child(server)
	server.packet.connect(receive)
	server.disconnected.connect(func(reason):
		if playing or loading_world:
			return_to_menu(reason))
	world = World.new()
	add_child(world)
	world.progress.connect(func(message): loading.text = message)
	feedback = preload("res://scripts/feedback.gd").new()
	add_child(feedback)
	preferences = preload("res://scripts/preferences.gd").new()
	add_child(preferences)
	create_environment()
	create_ui()
	preferences.changed.connect(apply_preferences)
	get_viewport().size_changed.connect(layout_sidebar)
	apply_preferences(preferences.values)
	await get_tree().process_frame
	await get_tree().process_frame
	layout_launcher()
	get_window().grab_focus()
	var reply: Dictionary = await server.request("/api/worlds")
	populate_worlds(reply)
	if not smoke and not "--action-network-test" in OS.get_cmdline_user_args() and not "--network-test" in OS.get_cmdline_user_args():
		login_busy = true
		login_button.disabled = true
		var remembered: Dictionary = await server.restore_session()
		if remembered.get("character") is Dictionary:
			session_character = remembered.character
			menu_message.text = "Welcome back, " + str(session_character.name) + ". Choose a world."
		login_busy = false
		login_button.disabled = false
		update_account_menu()
	if smoke:
		var output := OS.get_environment("HEARTHVALE_GODOT_TEST_OUTPUT")
		if output.is_empty():
			output = "res://test-results"
		DirAccess.make_dir_recursive_absolute(output)
		var city_test := "--city-proposal" in OS.get_cmdline_user_args()
		await open_preview(true,false,city_test)
		if city_test:
			assert(world.stairs.size()>0 and world.model_errors==0)
			for b in world.document.buildings:
				if b.id!="crown-hall": continue
				var centre: Vector2=world.building_centre(b)
				for level in range(3):
					var point:=Vector3(centre.x,world.ground(centre.x,centre.y)+level*3.2,centre.y)
					world.update_roofs(point,level,b.id)
					for entry in world.storey_groups:
						if entry.building.id==b.id and not entry.get("collision",false): assert(entry.node.visible==(entry.level<=level))
					if level<2:
						var link: Dictionary=world.stair_links(b,level)[0]
						var landing: Vector3=world.preview_stair(link.id)
						assert(world.active_floor==level+1 and is_equal_approx(landing.y,world.ground(centre.x,centre.y)+(level+1)*3.2))
			world.active_floor=0;world.active_building=""
			print("PACKAGED_CITY_PROPOSAL_PASS: embedded document, models, stairs and every floor cutaway")
		await get_tree().create_timer(2.0).timeout
		var hero := actor_for("visual-test", "player", 1.7)
		var closest := INF
		for p in world.tiles:
			if world.tiles[p] == "path" and not world.occupied(p.x, p.y):
				var d := Vector2(p.x - focus_point.x, p.y - focus_point.z).length()
				if d < closest:
					closest = d
					focus_point = Vector3(p.x, world.ground(p.x, p.y), p.y)
		hero.position = focus_point
		Rig.animate(hero, true, 0.15)
		world.update_equipment(hero, {"weapon":"bronzeAxe","shield":"woodenShield"})
		sidebar.update_player({"inventory": {"logs": 9, "ore": 10, "bronzePickaxe": 1, "tin": 0}, "levels": {"woodcutting": 4, "mining": 3, "hitpoints": 10}, "combatLevel": 4})
		assert(sidebar.cells.size() == 28 and sidebar.inventory_label.text == "3 / 28 slots")
		assert(sidebar.skill_cells.size() == 24)
		distance = 9
		yaw = 0.8
		update_camera()
		if DisplayServer.get_name() != "headless":
			await get_tree().create_timer(0.3).timeout
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(output.path_join("godot-preview.png"))
			sidebar.tabs.current_tab = 1
			await get_tree().create_timer(0.3).timeout
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(output.path_join("godot-skills.png"))
			for p in world.tiles:
				if world.tiles[p] == "field" and not world.occupied(p.x, p.y):
					focus_point = Vector3(p.x + 2, world.ground(p.x, p.y), p.y + 2)
					break
			distance = 17
			update_camera()
			await get_tree().create_timer(0.3).timeout
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png(output.path_join("godot-wheat.png"))
		if benchmark:
			var samples: Array[float] = []
			var draw_calls := 0.0
			for frame in range(180):
				var start := Time.get_ticks_usec()
				await get_tree().process_frame
				samples.append((Time.get_ticks_usec()-start)/1000.0)
				draw_calls += Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
			samples.sort()
			print("HEARTHVALE_BENCHMARK ",JSON.stringify({"medianMs":samples[90],"p95Ms":samples[171],"drawCalls":draw_calls/180.0,"renderer":RenderingServer.get_current_rendering_method()}))
		var result := {"regions": world.region_count, "models": world.templates.size(), "worlds": world_picker.item_count, "preview": preview, "engine": Engine.get_version_info().string, "grassInstances": world.grass_instances, "wheatInstances": world.wheat_instances, "bridges": world.bridge_models.size(), "gates":world.gate_models.size(), "waterfallFaces": world.waterfall_faces, "bankFaces": world.bank_faces, "backpackSlots": sidebar.cells.size(), "skillCards": sidebar.skill_cells.size()}
		var report := FileAccess.open(output.path_join("smoke.json"), FileAccess.WRITE)
		if report:
			report.store_string(JSON.stringify(result, "  "))
		print("HEARTHVALE_SMOKE ", JSON.stringify(result))
		var exit_code := 0 if preview and world.region_count > 0 and world.templates.size() > 0 else 1
		preview = false
		set_process(false)
		for child in get_children(): child.queue_free()
		for frame in range(4): await get_tree().process_frame
		get_tree().quit(exit_code)
	elif "--action-network-test" in OS.get_cmdline_user_args() and server.origin.begins_with("http://127.0.0.1:"):
		await action_network_test()
	elif "--network-test" in OS.get_cmdline_user_args() and server.origin.begins_with("http://127.0.0.1:"):
		username.text = "test-player"
		password.text = "local-test-only"
		await login()
		await join_selected()
		await get_tree().create_timer(4).timeout
		if not playing or loading_world:
			get_tree().quit(1)
			return
		server.send({"type": "move", "x": 18, "y": 26})
		await get_tree().create_timer(1).timeout
		var passed: bool = snapshots[-1].players[0].x == 18 and snapshots[-1].players[0].y == 26 and actors.has(self_id)
		passed = passed and sidebar.inventory_label.text == "2 / 28 slots"
		var target := ""
		var best_distance := INF
		for id in world.pickables:
			var npc: Dictionary = world.pickables[id]
			if npc.kind == "npc":
				var d := Vector2(npc.x - focus_point.x, npc.y - focus_point.z).length()
				if d < best_distance:
					best_distance = d
					target = id
		if not target.is_empty():
			var npc: Dictionary = world.pickables[target]
			var click := InputEventMouseButton.new()
			click.button_index = MOUSE_BUTTON_LEFT
			click.pressed = true
			click.position = camera.unproject_position(Vector3(npc.x, world.ground(npc.x, npc.y) + 0.8, npc.y))
			_unhandled_input(click)
			await get_tree().create_timer(0.5).timeout
			passed = passed and is_instance_valid(sidebar.modal)
		else:
			passed = false
		print("HEARTHVALE_NETWORK_TEST ", passed)
		server.leave()
		await get_tree().create_timer(0.3).timeout
		get_tree().quit(0 if passed else 1)

func create_environment() -> void:
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_SKY
	var sky := Sky.new()
	var sky_material := ProceduralSkyMaterial.new()
	sky_material.sky_top_color = Color("6292b4")
	sky_material.sky_horizon_color = Color("cbd9d3")
	sky_material.ground_horizon_color = Color("cbd9d3")
	sky.sky_material = sky_material
	environment.environment.sky = sky
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("d6dfd1")
	environment.environment.ambient_light_energy = 0.42
	environment.environment.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	environment.environment.glow_enabled = true
	environment.environment.glow_intensity = 0.35
	environment.environment.fog_enabled = true
	environment.environment.fog_light_color = Color("c0d1d5")
	environment.environment.fog_density = 0.002
	if RenderingServer.get_current_rendering_method()=="forward_plus":
		environment.environment.ssr_enabled = false
		environment.environment.ssao_enabled = false
	add_child(environment)
	var probe := ReflectionProbe.new()
	probe.name = "WaterReflections"
	probe.size = Vector3(80,24,80)
	probe.position = focus_point+Vector3.UP*4
	probe.max_distance = 90
	probe.intensity = 0.55
	add_child(probe)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -30, 0)
	sun.light_color = Color("fff0d6")
	sun.light_energy = 0.82
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 42
	add_child(sun)
	camera = Camera3D.new()
	camera.fov = 45
	camera.far = 250
	add_child(camera)
	update_camera()

func style_panel(colour: Color) -> StyleBoxFlat:
	var style := StyleBoxFlat.new()
	style.bg_color = colour
	style.border_color = Color("71684e")
	style.set_border_width_all(1)
	style.set_corner_radius_all(10)
	style.content_margin_left = 24
	style.content_margin_right = 24
	style.content_margin_top = 20
	style.content_margin_bottom = 20
	return style

func label(text: String, size := 18) -> Label:
	var node := Label.new()
	node.text = text
	node.add_theme_font_size_override("font_size", size)
	node.add_theme_color_override("font_color", Color("ece7d5"))
	return node

func button(text: String, callback: Callable) -> Button:
	var node := Button.new()
	node.text = text
	node.custom_minimum_size.y = 44
	node.focus_mode = Control.FOCUS_NONE
	node.pressed.connect(callback)
	return node

func create_ui() -> void:
	ui = CanvasLayer.new()
	add_child(ui)
	var full := Control.new()
	full.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	full.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(full)
	var background := preload("res://scripts/launcher_backdrop.gd").new()
	background.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	background.name = "MenuBackground"
	full.add_child(background)
	menu = PanelContainer.new()
	menu.add_theme_stylebox_override("panel", style_panel(Color("13251ff2")))
	full.add_child(menu)
	var theme := Theme.new()
	for type in ["Button", "OptionButton", "LineEdit"]:
		theme.set_font_size("font_size", type, 18)
		for state in ["normal", "hover", "pressed", "focus"]:
			var box := style_panel(Color("293d32") if state == "hover" else Color("1b3028"))
			box.content_margin_top = 10
			box.content_margin_bottom = 10
			box.content_margin_left = 16
			box.content_margin_right = 16
			box.border_color = Color("c5aa70") if state in ["hover", "focus"] else Color("526451")
			theme.set_stylebox(state, type, box)
		theme.set_color("font_color", type, Color("eee8d7"))
	menu.theme = theme
	menu_box = VBoxContainer.new()
	menu_box.add_theme_constant_override("separation", 18)
	menu.add_child(menu_box)
	var title := label("H E A R T H V A L E", 38)
	title.add_theme_color_override("font_color", Color("e0c58c"))
	menu_box.add_child(title)
	menu_box.add_child(label("A world to discover. A story to make your own.", 17))
	menu_box.add_child(HSeparator.new())
	var columns := HBoxContainer.new()
	columns.add_theme_constant_override("separation", 40)
	menu_box.add_child(columns)
	var account := VBoxContainer.new()
	account.custom_minimum_size.x = 360
	account.add_theme_constant_override("separation", 12)
	columns.add_child(account)
	account.add_child(label("01  /  YOUR ACCOUNT", 19))
	var username_caption := label("Username",15)
	account_captions.append(username_caption)
	account.add_child(username_caption)
	username = LineEdit.new()
	username.placeholder_text = "Enter your username"
	username.custom_minimum_size.y = 46
	account.add_child(username)
	var password_caption := label("Password",15)
	account_captions.append(password_caption)
	account.add_child(password_caption)
	password = LineEdit.new()
	password.placeholder_text = "Enter your password"
	password.secret = true
	password.custom_minimum_size.y = 46
	password.text_submitted.connect(func(_text): login())
	account.add_child(password)
	account_notice = label("",18)
	account_notice.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	account.add_child(account_notice)
	account_notice.hide()
	login_button = button("Log in",func():
		if session_character.is_empty(): login()
		else: logout())
	account.add_child(login_button)
	var worlds := VBoxContainer.new()
	worlds.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	worlds.add_theme_constant_override("separation", 12)
	columns.add_child(worlds)
	worlds.add_child(label("02  /  CHOOSE YOUR WORLD", 19))
	var note := label("Your character, equipment and bank travel with you.", 16)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	worlds.add_child(note)
	world_picker = OptionButton.new()
	world_picker.fit_to_longest_item = false
	world_picker.add_item("Finding available worlds…")
	world_picker.set_item_disabled(0, true)
	world_picker.custom_minimum_size.y = 48
	worlds.add_child(world_picker)
	worlds.add_child(label("World name · players online / capacity", 14))
	var play := button("Enter Hearthvale  →", join_selected)
	var gold := style_panel(Color("b3985c"))
	gold.content_margin_top = 12
	gold.content_margin_bottom = 12
	play.add_theme_stylebox_override("normal", gold)
	play.add_theme_color_override("font_color", Color("18241d"))
	worlds.add_child(play)
	worlds.add_child(button("Explore world without logging in", open_preview))
	worlds.add_child(button("Preview my saved editor draft", open_draft_preview))
	if FileAccess.file_exists("res://city-proposal.json"):
		worlds.add_child(button("Preview proposed city (local)", open_city_proposal))
	menu_message = label("Finding available worlds…", 16)
	menu_message.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	menu_message.custom_minimum_size.y = 45
	menu_message.add_theme_color_override("font_color", Color("d8bf89"))
	menu_box.add_child(menu_message)
	menu_box.add_child(HSeparator.new())
	var footer := HBoxContainer.new()
	footer.add_theme_constant_override("separation", 12)
	menu_box.add_child(footer)
	footer.add_child(button("Settings", show_settings))
	var spacer := Control.new()
	spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	footer.add_child(spacer)
	footer.add_child(label("DESKTOP CLIENT", 13))
	footer.add_child(button("Quit", func(): get_tree().quit()))
	get_viewport().size_changed.connect(layout_launcher)
	layout_launcher()
	menu.visibility_changed.connect(func(): layout_launcher.call_deferred())
	menu_box.minimum_size_changed.connect(func(): layout_launcher.call_deferred())
	layout_launcher.call_deferred()
	loading = label("", 24)
	loading.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	loading.offset_left = 24
	loading.offset_right = 800
	loading.offset_top = -64
	loading.offset_bottom = -24
	loading.visible = false
	full.add_child(loading)
	hud = label("", 18)
	hud.position = Vector2(24, 20)
	full.add_child(hud)
	hud.hide()
	var controls := HBoxContainer.new()
	controls.position = Vector2(24, 58)
	controls.add_child(button("Leave / main menu", func():
		server.leave()
		return_to_menu("Choose another world or explore the preview.")))
	controls.add_child(button("Fullscreen · F11", toggle_fullscreen))
	controls.visible = false
	controls.name = "GameControls"
	full.add_child(controls)
	var side := GameHUD.new()
	side.set_anchors_and_offsets_preset(Control.PRESET_RIGHT_WIDE)
	side.offset_left = -408
	side.offset_right = -20
	side.offset_top = 20
	side.offset_bottom = -20
	side.add_theme_stylebox_override("panel", style_panel(Color(0.10, 0.105, 0.085, 0.96)))
	side.name = "Sidebar"
	side.visible = false
	full.add_child(side)
	destination = MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = .27
	ring.outer_radius = .35
	ring.rings = 24
	ring.ring_segments = 8
	destination.mesh = ring
	var ring_material := StandardMaterial3D.new()
	ring_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ring_material.albedo_color = Color("ffda78")
	destination.material_override = ring_material
	add_child(destination)
	destination.hide()
	interaction_click = Label.new()
	interaction_click.text = "×"
	interaction_click.mouse_filter = Control.MOUSE_FILTER_IGNORE
	interaction_click.add_theme_font_size_override("font_size",36)
	interaction_click.add_theme_color_override("font_color",Color("ff644d"))
	interaction_click.add_theme_constant_override("outline_size",4)
	full.add_child(interaction_click)
	interaction_click.hide()
	hover_hint = Label.new()
	hover_hint.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hover_hint.add_theme_color_override("font_color",Color("ffe3a5"))
	hover_hint.add_theme_color_override("font_outline_color",Color("101b16"))
	hover_hint.add_theme_constant_override("outline_size",5)
	full.add_child(hover_hint)
	sidebar = side
	side.leave_requested.connect(func():
		server.leave()
		return_to_menu("Choose a world to continue."))
	side.fullscreen_requested.connect(toggle_fullscreen)
	side.north_requested.connect(func(): yaw = 0.0)
	side.settings_requested.connect(show_settings)
	side.layout_requested.connect(layout_sidebar)
	side.command.connect(func(data):
		if playing:
			server.send(data))
	status = label("", 16)
	status.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	status.position = Vector2(24, 846)
	status.mouse_filter = Control.MOUSE_FILTER_IGNORE
	full.add_child(status)
	chat = RichTextLabel.new()
	chat.position = Vector2(24, 650)
	chat.size = Vector2(480, 150)
	chat.selection_enabled = false
	chat.mouse_filter = Control.MOUSE_FILTER_IGNORE
	full.add_child(chat)

func layout_launcher() -> void:
	if not is_instance_valid(menu): return
	menu.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	var viewport_size := get_viewport().get_visible_rect().size
	var factor: float = minf(1.0, minf((viewport_size.x - 48.0) / 900.0, (viewport_size.y - 48.0) / 600.0))
	factor = maxf(0.3, factor)
	menu.scale = Vector2.ONE * factor
	menu.size = Vector2(900, 600)
	menu.position = (viewport_size - menu.size * factor) / 2.0

func populate_worlds(reply: Dictionary) -> void:
	world_picker.clear()
	for entry in reply.get("worlds", []):
		if not entry.get("available", true):
			continue
		world_picker.add_item(str(entry.name) + " · " + str(entry.online) + " / " + str(entry.capacity), int(entry.id))
	menu_message.text = reply.get("error", "Select a world, or explore without joining a server.")

func login() -> void:
	if login_busy: return
	if username.text.strip_edges().is_empty() or password.text.is_empty():
		menu_message.text = "Enter your username and password to continue."
		return
	login_busy = true
	login_button.disabled = true
	menu_message.text = "Logging in…"
	var response: Dictionary = await server.request("/api/login", HTTPClient.METHOD_POST, {"username": username.text, "password": password.text})
	password.clear()
	if response.has("character"):
		session_character = response.character
		menu_message.text = "Logged in as " + str(session_character.name) + ". Choose a world."
		var remembered: bool = await server.remember_session()
		if not remembered and server.origin == server.ORIGIN:
			menu_message.text = "Logged in. This PC could not save your session; you may need to log in next time."
	else:
		menu_message.text = response.get("error", "Login failed.")
	login_busy = false
	login_button.disabled = false
	update_account_menu()

func update_account_menu() -> void:
	var signed_in := not session_character.is_empty()
	for caption in account_captions: caption.visible = not signed_in
	username.visible = not signed_in
	password.visible = not signed_in
	account_notice.visible = signed_in
	account_notice.text = "Signed in as " + str(session_character.get("name","")) + "\nYour account is ready."
	login_button.text = "Log out" if signed_in else "Log in"
	layout_launcher.call_deferred()

func logout() -> void:
	if login_busy: return
	login_busy = true
	login_button.disabled = true
	session_character.clear()
	password.clear()
	update_account_menu()
	menu_message.text = "Signing out…"
	await server.logout_session()
	menu_message.text = "Logged out. Enter your account details to play."
	login_busy = false
	login_button.disabled = false

func show_loading() -> void:
	loading_world = true
	world.visible = false
	menu.hide()
	loading.show()
	loading.text = "Loading published world…"

func load_world(use_draft := false, use_proposal := false) -> bool:
	var doc: Dictionary
	if use_proposal:
		doc=JSON.parse_string(FileAccess.get_file_as_string("res://city-proposal.json"))
	else:
		doc=await server.request("/api/editor/world" if use_draft else "/world-data.mjs")
	if doc.has("error"):
		return_to_menu(doc.error)
		return false
	if use_draft:
		if not doc.get("draft") is Dictionary:
			return_to_menu("Your account has no saved editor draft.")
			return false
		doc=doc.draft.world
	var ready: bool = await world.build(doc)
	var probe := get_node("WaterReflections") as ReflectionProbe
	probe.position = focus_point+Vector3.UP*4
	probe.update_mode = ReflectionProbe.UPDATE_ALWAYS
	await get_tree().process_frame
	await get_tree().process_frame
	probe.update_mode = ReflectionProbe.UPDATE_ONCE
	if not ready:
		return_to_menu("A required model failed to load.")
	elif DisplayServer.get_name()!="headless":
		await prepare_graphics()
	return ready

func join_selected() -> void:
	if session_character.is_empty():
		menu_message.text = "Log in with your existing account first."
		return
	if world_picker.item_count == 0:
		menu_message.text = "No worlds are available."
		return
	show_loading()
	if not await load_world():
		return
	loading.text = "Joining world…"
	var result: Error = server.join_world(world_picker.get_selected_id())
	if result != OK:
		return_to_menu("Could not join the selected world.")

func open_draft_preview() -> void:
	await open_preview(false,true)

func open_city_proposal() -> void:
	await open_preview(false,false,true)

func open_preview(_test := false, use_draft := false, use_proposal := false) -> void:
	show_loading()
	if use_draft: loading.text="Loading your saved editor draft…"
	if use_proposal: loading.text="Loading the local city proposal…"
	if not await load_world(use_draft,use_proposal):
		return
	var spawn: Dictionary = world.document.get("spawn", {"x": 17, "y": 26})
	focus_point = Vector3(spawn.x, world.ground(spawn.x, spawn.y), spawn.y)
	preview = true
	activate_world()
	hud.text = ("Local city proposal" if use_proposal else "Editor draft preview" if use_draft else "Published world preview")+" · arrow keys pan · right-drag orbit · click stairs to change floor"
	sidebar.update_player({"inventory": {}, "levels": {}})

func activate_world() -> void:
	loading_world = false
	loading.hide()
	menu.hide()
	world.show()
	apply_preferences(preferences.values)
	var full := ui.get_child(0)
	full.get_node("MenuBackground").hide()
	full.get_node("GameControls").hide()
	full.get_node("Sidebar").show()
	var owner_control := get_viewport().gui_get_focus_owner()
	if owner_control:
		owner_control.release_focus()
	get_window().grab_focus()
	update_camera()

func return_to_menu(message := "") -> void:
	if is_instance_valid(sidebar):
		sidebar.close_modal()
		sidebar.track_xp({})
	playing = false
	preview = false
	loading_world = false
	self_id = ""
	snapshots.clear()
	for actor in actors.values():
		actor.queue_free()
	actors.clear()
	world.hide()
	feedback.reset()
	loading.hide()
	menu.show()
	var full := ui.get_child(0)
	full.get_node("MenuBackground").show()
	full.get_node("GameControls").hide()
	full.get_node("Sidebar").hide()
	hud.text = ""
	status.text = ""
	chat.clear()
	menu_message.text = message

func receive(data: Dictionary) -> void:
	match data.get("type", ""):
		"assetsRequired":
			server.send({"type": "clientReady"})
		"welcome":
			self_id = str(data.id)
			playing = true
			preview = false
			loading.text = "Waiting for world state…"
		"state":
			var now := Time.get_ticks_msec()
			var measured_offset := float(data.at) - now
			clock_offset = measured_offset if snapshots.is_empty() else lerpf(clock_offset, measured_offset, 0.05)
			snapshots.append(data)
			while snapshots.size() > 20:
				snapshots.pop_front()
			for item in data.get("nodes", []): world.apply_resource_state(item)
			world.update_gates(data.get("gates",[]))
			world.update_drops(data.get("drops",[]))
			update_sidebar(data.get("self", {}))
			update_mobiles(data)
			if loading_world:
				activate_world()
		"dialog":
			sidebar.show_dialog(str(data.get("npc", "NPC")), str(data.get("text", "")))
		"chat":
			chat.append_text(str(data.get("name", "")) + ": " + str(data.get("text", "")) + "\n")
		"worldChanged":
			server.leave()
			return_to_menu("World updated. Rejoin to load the latest map.")
		"idleLogout":
			return_to_menu("You were logged out for inactivity.")
		"notice":
			status.text = str(data.get("text", ""))
		"bankOpen":
			sidebar.show_bank()
		"smelteryOpen", "anvilOpen", "workbenchOpen":
			sidebar.show_crafting(data.type, data)
		"shopOpen":
			sidebar.show_shop(data)
		"travelOpen":
			sidebar.show_travel(data)
		"travelArrived":
			snapshots.clear()
			sidebar.close_modal()
			focus_point = Vector3(data.x, world.ground(data.x, data.y), data.y)
		"cookingOpen":
			status.text = "This workstation's full interface is still being migrated to Godot."

func update_mobiles(data: Dictionary) -> void:
	for item in data.get("enemies", []) + data.get("npcs", []):
		if not world.mobiles.has(item.id):
			continue
		var actor: Node3D = world.mobiles[item.id]
		actor.visible = item.get("available", true)
		world.set_pick_active(actor,item.get("available",true))
		actor.set_meta("state", item)

func update_sidebar(player: Dictionary) -> void:
	hud.text = str(session_character.get("name", "Player"))
	sidebar.update_player(player)

func actor_for(id: String, file: String, height: float) -> Node3D:
	if actors.has(id):
		return actors[id]
	var model: Node3D
	if file=="player" and is_instance_valid(prepared_player):
		model = prepared_player
		prepared_player = null
		model.show()
	else:
		model = world.fitted(file,height)
		if not model: return null
		add_child(model)
		model.set_meta("terrain_world",world)
		Rig.prepare(model)
		var overhead := Overhead.new()
		overhead.name = "CombatOverhead"
		model.add_child(overhead)
	actors[id] = model
	return model

func _process(delta: float) -> void:
	feedback.listener.global_basis = camera.global_basis
	feedback.ambience(world,focus_point,delta,(playing or preview) and not loading_world)
	update_hover()
	update_click_indicators()
	world.animate_gates(delta)
	phase += delta
	if not playing and not preview:
		return
	if get_window().has_focus() and not get_viewport().gui_get_focus_owner() and not is_instance_valid(sidebar.modal):
		var horizontal := float(Input.is_action_pressed("camera_right")) - float(Input.is_action_pressed("camera_left"))
		var vertical := float(Input.is_action_pressed("camera_down")) - float(Input.is_action_pressed("camera_up"))
		if preview:
			focus_point += Vector3(horizontal, 0, vertical).rotated(Vector3.UP, yaw) * delta * 12
		else:
			yaw += horizontal * delta * 1.5 * float(preferences.values.sensitivity)
			pitch = clampf(pitch + vertical * delta * float(preferences.values.sensitivity), 0.3, 1.25)
	if playing and not snapshots.is_empty():
		var render_at := Time.get_ticks_msec() + clock_offset - 150.0
		var a: Dictionary = snapshots[0]
		var b: Dictionary = snapshots[-1]
		for frame in snapshots:
			if frame.at <= render_at:
				a = frame
			if frame.at >= render_at:
				b = frame
				break
		var fraction := clampf((render_at - a.at) / maxf(float(b.at) - float(a.at), 1), 0, 1)
		var present: Dictionary = {}
		for player in b.get("players", []):
			var id := str(player.id)
			present[id] = true
			var previous: Dictionary = player
			for candidate in a.get("players", []):
				if candidate.id == player.id:
					previous = candidate
					break
			var actor := actor_for(id, "player", 1.7)
			if not actor:
				continue
			var pos := motion_point(previous, render_at).lerp(motion_point(player, render_at), fraction)
			var old_position := actor.position
			actor.position = Vector3(pos.x, world.player_height(pos.x, pos.y,player), pos.y)
			var velocity := actor.position - old_position
			if velocity.length() > 0.005 and velocity.length() < 2.0:
				actor.rotation.y = lerp_angle(actor.rotation.y, atan2(velocity.x, velocity.z), minf(1, delta * 12))
			actor.set_meta("floor_state",player)
			actor.visible=int(player.get("floorLevel",0))<=int(snapshots[-1].self.get("floorLevel",0)) or id==self_id
			world.update_equipment(actor, player.get("equipment", {}))
			face_action(actor,player,delta)
			var gait_speed := clampf(Vector2(velocity.x,velocity.z).length()/maxf(delta,0.001)/2.4,0.65,1.25)
			var elapsed: float = delta if id==self_id else world.animation_delta(actor,focus_point,delta)
			if elapsed>0: Rig.animate(actor,player.get("action", "Idle") in ["Walking", "Running"],elapsed,gait_speed,player,render_at)
			feedback.actor_feedback(id,actor,player,world,focus_point,render_at,delta)
			actor.get_node("CombatOverhead").update_state(player,render_at)
			if id == self_id:
				focus_point = actor.position
		for id in actors.keys():
			if not present.has(id):
				feedback.histories.erase(id)
				actors[id].queue_free()
				actors.erase(id)
	for id in world.mobiles:
		var actor: Node3D = world.mobiles[id]
		var state: Dictionary = actor.get_meta("state", {})
		var moving := false
		if not state.is_empty():
			var pos := motion_point(state, Time.get_ticks_msec() + clock_offset - 100)
			if world.navigation and actor.position.distance_to(focus_point)<25: pos = world.navigation.refine(state,Time.get_ticks_msec()+clock_offset-100,pos)
			var movement := Vector3(pos.x, world.walk_height(pos.x, pos.y), pos.y) - actor.position
			moving = state.get("motion") is Dictionary
			actor.position += movement * minf(1.0, delta * 15)
			if movement.length() > 0.002 and moving:
				actor.rotation.y = lerp_angle(actor.rotation.y, atan2(movement.x, movement.z), minf(1, delta * 8))
			if world.pickables.has(id):
				world.pickables[id].x = actor.position.x
				world.pickables[id].y = actor.position.z
		feedback.actor_feedback("npc:"+str(id),actor,state,world,focus_point,Time.get_ticks_msec()+clock_offset,delta)
		if actor.get_meta("kind", "") == "cow":
			Rig.animate_cow(actor,moving,world.animation_delta(actor,focus_point,delta))
		else:
			var now := Time.get_ticks_msec()+clock_offset
			face_action(actor,state,delta)
			var animation_delta: float = world.animation_delta(actor,focus_point,delta)
			if animation_delta>0: Rig.animate(actor,moving,animation_delta,1.0,state,now)
			if not actor.has_node("CombatOverhead"):
				var overhead := Overhead.new()
				overhead.name = "CombatOverhead"
				actor.add_child(overhead)
			actor.get_node("CombatOverhead").update_state(state,now)
	for id in world.humanoids:
		if not world.mobiles.has(id):
			var elapsed: float = world.animation_delta(world.humanoids[id],focus_point,delta)
			if elapsed>0: Rig.animate(world.humanoids[id],false,elapsed)
	if preview and world.active_floor>0:
		for building in world.document.get("buildings",[]):
			if building.id==world.active_building and not world.inside_building(focus_point,building):
				world.active_floor=0;world.active_building="";focus_point.y=world.ground(focus_point.x,focus_point.z)
	world.update_roofs(focus_point,int(snapshots[-1].self.get("floorLevel",0)) if playing and not snapshots.is_empty() else world.active_floor,str(snapshots[-1].self.get("floorBuilding","")) if playing and not snapshots.is_empty() else world.active_building)
	world.update_scenery(focus_point,delta)
	world.update_lighting(snapshots[-1].get("players",[]) if not snapshots.is_empty() else [],focus_point,Time.get_ticks_msec()+clock_offset)
	if sidebar.minimap.world != world or sidebar.minimap.generation != world.generation or not sidebar.minimap.texture:
		sidebar.minimap.rebuild(world)
	sidebar.minimap.centre = Vector2(focus_point.x, focus_point.z)
	sidebar.minimap.heading = yaw
	sidebar.compass.heading = yaw
	sidebar.server_time = clock_offset
	sidebar.minimap.queue_redraw()
	update_camera()

func motion_point(player: Dictionary, at: float) -> Vector2:
	var motion = player.get("motion")
	if not motion is Dictionary:
		return Vector2(player.x, player.y)
	var start := Vector2(motion.fromX, motion.fromY)
	var target := Vector2(motion.toX, motion.toY)
	var duration := float(motion.duration)
	var elapsed := at - float(motion.startedAt)
	if elapsed <= duration:
		return start.lerp(target, clampf(elapsed / maxf(duration, 1), 0, 1))
	var step_duration := duration / maxf(start.distance_to(target), 0.01)
	elapsed -= duration
	for point in player.get("route", []):
		var next := Vector2(point[0], point[1])
		var next_duration := step_duration * target.distance_to(next)
		if elapsed < next_duration:
			return target.lerp(next, clampf(elapsed / maxf(next_duration, 1), 0, 1))
		elapsed -= next_duration
		target = next
	return target

func animate_actor(actor: Node3D, moving: bool, delta: float) -> void:
	Rig.animate(actor, moving, delta)

func face_action(actor: Node3D, state: Dictionary, delta: float) -> void:
	if state.get("motion") is Dictionary: return
	if not state.get("gathering") is Dictionary and state.get("action","")!="Fighting" and Time.get_ticks_msec()+clock_offset-float(state.get("swingAt",-100000))>850: return
	var target = state.get("gathering") if state.get("gathering") is Dictionary else state.get("facing")
	if target is Dictionary:
		var direction := Vector2(float(target.x)-actor.position.x,float(target.y)-actor.position.z)
		if direction.length()>0.01:
			actor.rotation.y = lerp_angle(actor.rotation.y,atan2(direction.x,direction.y),1-exp(-delta*12))

func click_test_model(id: String) -> bool:
	var target: Node3D = world.resources[id].root if world.resources.has(id) else world.mobiles.get(id,world.ground_drops.get(id))
	if not target: return false
	focus_point = target.position
	yaw = 0.4
	distance = 12
	update_camera()
	var candidates: Array[Vector3] = [target.position+Vector3.UP*0.2]
	var parts: Array = []
	world.collect_meshes(target,Transform3D.IDENTITY,parts)
	for part in parts:
		var faces: PackedVector3Array = part.mesh.get_faces()
		for i in range(0,faces.size()-2,60):
			candidates.append(part.transform*((faces[i]+faces[i+1]+faces[i+2])/3))
	for point in candidates:
		var hit := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(camera.global_position,point+(point-camera.global_position).normalized()*0.1,2))
		if not hit.is_empty() and hit.collider.get_meta("interact_id","")==id:
			var click := InputEventMouseButton.new()
			click.button_index = MOUSE_BUTTON_LEFT
			click.pressed = true
			click.position = camera.unproject_position(hit.position)
			_unhandled_input(click)
			return true
	return false

func action_network_test() -> void:
	username.text = "test-player"
	password.text = "local-test-only"
	await login()
	await join_selected()
	await get_tree().create_timer(2).timeout
	assert(playing and not loading_world)
	var targets := {"tree":"", "rock":""}
	for id in world.pickables:
		var kind: String = world.pickables[id].kind
		if targets.has(kind) and targets[kind]=="": targets[kind]=id
	for kind in ["tree","rock"]:
		if kind=="rock":
			server.send({"type":"equip","item":"bronzePickaxe"})
			await get_tree().create_timer(0.3).timeout
		assert(click_test_model(targets[kind]))
		assert(interaction_click.visible and not destination.visible)
		var gathered := false
		for i in range(70):
			await get_tree().create_timer(0.1).timeout
			if not world.resources[targets[kind]].canopy.visible and not world.ground_drops.is_empty():
				gathered = true
				break
		assert(gathered,"Clicking resource must complete gathering")
		await get_tree().physics_frame
		await get_tree().physics_frame
		var drop_id: String = world.ground_drops.keys()[0]
		assert(click_test_model(drop_id))
		await get_tree().create_timer(0.7).timeout
		assert(world.ground_drops.is_empty(),"Clicking ground loot must pick it up")
	assert(int(sidebar.player.inventory.get("logs",0))>0)
	assert(int(sidebar.player.inventory.get("ore",0))>0)
	var enemy := ""
	for id in world.mobiles:
		if world.mobiles[id].get_meta("kind","")=="enemy":
			enemy = id
			break
	assert(not enemy.is_empty() and click_test_model(enemy))
	await get_tree().create_timer(0.6).timeout
	assert(actors[self_id].get_node("CombatOverhead").bar.visible)
	assert(world.mobiles[enemy].get_node("CombatOverhead").bar.visible)
	assert(world.mobiles[enemy].get_meta("animation_mode","")=="combat")
	print("HEARTHVALE_GATHERING_NETWORK: model clicks gathered logs and ore, picked up drops, awarded XP, and initiated animated combat with health bars")
	server.leave()
	await get_tree().create_timer(0.2).timeout
	get_tree().quit()

func find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node
	for child in node.get_children():
		var found := find_skeleton(child)
		if found:
			return found
	return null

func update_camera() -> void:
	camera.position = focus_point + Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * distance
	camera.look_at(focus_point + Vector3.UP * 0.7)

func toggle_fullscreen() -> void:
	get_window().mode = Window.MODE_WINDOWED if get_window().mode == Window.MODE_FULLSCREEN else Window.MODE_FULLSCREEN

func _input(event: InputEvent) -> void:
	if not is_instance_valid(preferences) or not preferences.rebinding.is_empty(): return
	var typing: bool = get_viewport().gui_get_focus_owner() is LineEdit
	if event is InputEventKey and event.pressed and not event.echo and not typing:
		if event.is_action_pressed("settings"):
			if is_instance_valid(sidebar.modal): sidebar.close_modal()
			else: show_settings()
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("world_map") and (playing or preview):
			sidebar.show_world_map()
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("fullscreen"):
			toggle_fullscreen()
			get_viewport().set_input_as_handled()
		elif event.is_action_pressed("run_toggle") and playing and not is_instance_valid(sidebar.modal):
			server.send({"type":"runToggle"})
			get_viewport().set_input_as_handled()
	if playing and Time.get_ticks_msec() - last_activity > 15000 and (event is InputEventKey or event is InputEventMouseButton):
		server.send({"type": "activity"})
		last_activity = Time.get_ticks_msec()

func _unhandled_input(event: InputEvent) -> void:
	if is_instance_valid(sidebar.modal): return
	if not playing and not preview:
		return
	if event is InputEventMouseMotion and Input.is_mouse_button_pressed(MOUSE_BUTTON_RIGHT):
		yaw -= event.relative.x * 0.006 * float(preferences.values.sensitivity)
		pitch = clampf(pitch + event.relative.y * 0.004 * float(preferences.values.sensitivity), 0.3, 1.25)
	if event is InputEventMouseButton and event.pressed:
		if event.button_index == MOUSE_BUTTON_WHEEL_UP:
			distance = maxf(8, distance - 1.5)
		elif event.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			distance = minf(50, distance + 1.5)
		elif event.button_index == MOUSE_BUTTON_LEFT:
			var origin := camera.project_ray_origin(event.position)
			var direction := camera.project_ray_normal(event.position)
			var npc_query := PhysicsRayQueryParameters3D.create(origin, origin + direction * 250, 2)
			var npc_hit := get_world_3d().direct_space_state.intersect_ray(npc_query)
			if not npc_hit.is_empty():
				var id: String = npc_hit.collider.get_meta("interact_id", "")
				show_interaction_click(event.position)
				if playing:
					server.send({"type": npc_hit.collider.get_meta("command_type","interact"), "id": id})
				elif preview:
					if world.stairs.has(id):
						focus_point=world.preview_stair(id)
						return
					var info: Dictionary = world.pickables.get(id, {})
					sidebar.show_dialog(str(info.get("name", "NPC")), "This is a map preview. Log in and join a world to speak to this NPC.")
				return
			var hit := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(origin, origin + direction * 250))
			if hit.is_empty():
				return
			var point: Vector3 = hit.position
			if preview:
				focus_point = point
			else:
				var nearest := ""
				var best := 0.75
				for id in world.pickables:
					var item: Dictionary = world.pickables[id]
					if int(item.get("floorLevel",0))!=world.active_floor: continue
					var d := Vector2(point.x - item.x, point.z - item.y).length()
					if d < best:
						best = d
						nearest = id
				if nearest.is_empty(): show_destination(Vector2(roundi(point.x),roundi(point.z)))
				else: show_interaction_click(event.position)
				server.send({"type": "stairs" if world.stairs.has(nearest) else "interact", "id": nearest} if not nearest.is_empty() else {"type": "move", "x": roundi(point.x), "y": roundi(point.z)})





func update_hover() -> void:
	if not is_instance_valid(hover_hint): return
	hover_hint.hide()
	if is_instance_valid(feedback): feedback.hover_ring.hide()
	if not (playing or preview) or is_instance_valid(sidebar.modal): return
	var mouse := get_viewport().get_mouse_position()
	if sidebar.get_global_rect().has_point(mouse): return
	var origin := camera.project_ray_origin(mouse)
	var direction := camera.project_ray_normal(mouse)
	var hit := get_world_3d().direct_space_state.intersect_ray(PhysicsRayQueryParameters3D.create(origin,origin+direction*250,2))
	if hit.is_empty(): return
	var id := str(hit.collider.get_meta("interact_id",""))
	var info: Dictionary = world.pickables.get(id,{})
	if info.is_empty(): return
	feedback.highlight(Vector3(info.x,world.walk_height(info.x,info.y),info.y),0.6 if info.get("kind")=="npc" else 0.75)
	hover_hint.text = str(info.get("name","NPC"))+ (" · Level %d" % int(info.get("combatLevel",5)) if info.get("role")=="enemy" else " · "+str(info.get("role",info.get("kind","object"))).replace("guide-","").capitalize())
	hover_hint.position = Vector2(minf(mouse.x+18,get_viewport().get_visible_rect().size.x-hover_hint.get_minimum_size().x-12),maxf(10,mouse.y-30))
	hover_hint.show()

func show_destination(tile: Vector2) -> void:
	destination_tile = tile
	destination_started = Time.get_ticks_msec()
	destination.position = Vector3(tile.x,world.walk_height(tile.x,tile.y)+.055,tile.y)
	destination.show()
	interaction_click.hide()

func show_interaction_click(point: Vector2) -> void:
	destination.hide()
	interaction_at = Time.get_ticks_msec()
	interaction_click.position = point-Vector2(12,22)
	interaction_click.modulate.a = 1
	interaction_click.show()

func update_click_indicators() -> void:
	if not is_instance_valid(destination): return
	if not (playing or preview):
		destination.hide()
		interaction_click.hide()
		return
	var now := Time.get_ticks_msec()
	if interaction_click.visible:
		interaction_click.modulate.a = clampf(1-(now-interaction_at)/650.0,0,1)
		if now-interaction_at>=650: interaction_click.hide()
	if destination.visible:
		if now-destination_started>30000: destination.hide()
		if actors.has(self_id):
			var actor: Node3D = actors[self_id]
			if Vector2(actor.position.x,actor.position.z).distance_to(destination_tile)<.35: destination.hide()
		if now-destination_started>1000 and not snapshots.is_empty():
			for player in snapshots[-1].get("players",[]):
				if str(player.id)==self_id and player.get("action","") not in ["Walking","Running"]: destination.hide()

# Render representative skinned/material variants behind the opaque loading UI.
# This completes before joining, so the test actor cannot be attacked or lose items.
func prepare_graphics() -> void:
	loading.text = "Preparing character and scenery graphics…"
	var spawn: Dictionary = world.document.get("spawn",{"x":17,"y":26})
	focus_point = Vector3(spawn.x,world.walk_height(spawn.x,spawn.y),spawn.y)
	update_camera()
	world.show()
	if is_instance_valid(prepared_player): prepared_player.queue_free()
	var actor: Node3D = world.fitted("player",1.7)
	prepared_player = actor
	add_child(actor)
	# Close to the camera, so buildings cannot occlude the warmup draw.
	actor.position = camera.global_position-camera.global_basis.z*4-Vector3.UP*0.8
	var overhead := Overhead.new()
	overhead.name = "CombatOverhead"
	actor.add_child(overhead)
	actor.set_meta("terrain_world",world)
	Rig.prepare(actor)
	world.update_equipment(actor,{"weapon":"bronzeAxe","shield":"woodenShield"})
	Rig.animate(actor,true,0.1)
	for frame in range(8):
		await RenderingServer.frame_post_draw
		await get_tree().process_frame
	actor.hide()
	world.hide()

func show_settings() -> void:
	preferences.show_settings(sidebar)

func layout_sidebar() -> void:
	if not is_instance_valid(sidebar): return
	var factor := float(preferences.values.ui_scale)
	var viewport := get_viewport().get_visible_rect().size
	sidebar.set_anchors_and_offsets_preset(Control.PRESET_TOP_LEFT)
	sidebar.scale = Vector2.ONE*factor
	sidebar.position = Vector2(viewport.x-388*factor-20,20)
	sidebar.size = Vector2(388,(viewport.y-40)/factor if sidebar.tabs.visible else 365)

func apply_preferences(values: Dictionary) -> void:
	for control in sidebar.find_children("*","Button",true,false):
		if control.has_meta("binding"):
			var action := str(control.get_meta("binding"))
			control.tooltip_text = action.replace("_"," ").capitalize()+" ("+OS.get_keycode_string(int(preferences.bindings[action]))+")"
	Engine.max_fps = int(values.fps)
	feedback.apply_settings(values)
	world.apply_quality(int(values.quality))
	get_viewport().mesh_lod_threshold = [3.0,1.5,1.0][int(values.quality)]
	for sun in find_children("*","DirectionalLight3D",false,false): sun.shadow_enabled = int(values.quality)>0
	layout_sidebar()

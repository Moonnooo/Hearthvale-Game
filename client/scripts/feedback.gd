extends Node3D
# Presentation only: never changes server movement, inventory, damage or XP.
const VOICES = 12
const MAX_EFFECTS = 16
var sounds: Dictionary = {}
var voices: Array[AudioStreamPlayer3D] = []
var effects: Array = []
var histories: Dictionary = {}
var hover_ring: MeshInstance3D
var wind: AudioStreamPlayer
var water: AudioStreamPlayer
var furnace: AudioStreamPlayer3D
var listener: AudioListener3D
var ambience_clock := 0.0
var bird_clock := 0.0
var rng := RandomNumberGenerator.new()
var enabled := true
var visuals := true
var settings := {"master":0.8,"effects":0.8,"ambience":0.45}
var event_count := 0

func _ready() -> void:
	rng.seed = 81147
	for name in ["Effects","Ambience"]:
		if AudioServer.get_bus_index(name)<0:
			AudioServer.add_bus()
			AudioServer.set_bus_name(AudioServer.bus_count-1,name)
	for kind in ["grass","gravel","wood","chop","mine","splash","hit","bird","moo","wind","water","fire"]:
		sounds[kind] = load_recorded_sound(kind)
	for i in range(VOICES):
		var voice := AudioStreamPlayer3D.new()
		voice.bus = "Effects"
		voice.max_distance = 28
		voice.unit_size = 3
		add_child(voice)
		voices.append(voice)
	wind = AudioStreamPlayer.new()
	wind.bus = "Ambience"
	wind.stream = sounds.wind
	add_child(wind)
	water = AudioStreamPlayer.new()
	water.bus = "Ambience"
	water.stream = sounds.water
	add_child(water)
	furnace = AudioStreamPlayer3D.new()
	furnace.bus = "Ambience"
	furnace.stream = sounds.fire
	furnace.max_distance = 16
	furnace.volume_db = -13
	add_child(furnace)
	listener = AudioListener3D.new()
	add_child(listener)
	listener.make_current()
	hover_ring = MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = 0.43
	ring.outer_radius = 0.48
	ring.rings = 24
	ring.ring_segments = 8
	hover_ring.mesh = ring
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color("edce7b")
	hover_ring.material_override = material
	add_child(hover_ring)
	hover_ring.hide()
	apply_settings(settings)

func apply_settings(values: Dictionary) -> void:
	settings = values.duplicate()
	for entry in [["Master","master"],["Effects","effects"],["Ambience","ambience"]]:
		var index := AudioServer.get_bus_index(entry[0])
		if index<0: continue
		var volume := float(values.get(entry[1],0.8))
		AudioServer.set_bus_mute(index,volume<=0)
		AudioServer.set_bus_volume_db(index,linear_to_db(maxf(volume,0.0001)))
	visuals = int(values.get("quality",1))>0

# External files beside the executable override bundled recordings.
# Missing recordings retain the temporary sound until a replacement is supplied.
var audio_directory := ""
var recorded_sources: Dictionary = {}
var footstep_players: Dictionary = {}
const SOUND_FOLDERS = {"grass":"footsteps", "gravel":"footsteps", "wood":"footsteps", "chop":"actions", "mine":"actions", "splash":"actions", "hit":"combat", "bird":"creatures", "moo":"creatures", "wind":"ambience", "water":"ambience", "fire":"ambience"}

func load_recorded_sound(kind: String) -> AudioStream:
	var folders: Array[String] = []
	if not audio_directory.is_empty(): folders.append(audio_directory)
	if not OS.has_feature("editor"):
		folders.append(OS.get_executable_path().get_base_dir().path_join("audio"))
	folders.append("res://audio")
	for folder in folders:
		for extension in ["wav", "ogg", "mp3"]:
			var path: String = folder.path_join(str(SOUND_FOLDERS[kind])).path_join(kind + "." + extension)
			var clip: AudioStream
			if folder.begins_with("res://") and ResourceLoader.exists(path):
				clip = load(path) as AudioStream
			elif FileAccess.file_exists(path):
				match extension:
					"wav": clip = AudioStreamWAV.load_from_file(path)
					"ogg": clip = AudioStreamOggVorbis.load_from_file(path)
					"mp3": clip = AudioStreamMP3.load_from_file(path)
			if clip == null: continue
			clip = clip.duplicate() as AudioStream
			var looping: bool = kind in ["wind", "water", "fire", "grass", "gravel", "wood"]
			if clip is AudioStreamWAV:
				clip.loop_mode = AudioStreamWAV.LOOP_FORWARD if looping else AudioStreamWAV.LOOP_DISABLED
				if looping:
					clip.loop_begin = 0
					clip.loop_end = int(round(clip.get_length() * clip.mix_rate))
			elif clip is AudioStreamOggVorbis or clip is AudioStreamMP3:
				clip.loop = looping
				clip.loop_offset = 0.0
			recorded_sources[kind] = path
			return clip
	return synthesize(kind)

func synthesize(kind: String) -> AudioStreamWAV:
	var loop := kind in ["wind","water","fire"]
	var duration := 2.0 if loop else 0.5 if kind in ["moo","bird"] else 0.22
	var rate := 22050
	var count := int(rate*duration)
	var bytes := PackedByteArray()
	bytes.resize(count*2)
	var smooth := 0.0
	for i in range(count):
		var t := i/float(rate)
		var noise := rng.randf_range(-1,1)
		smooth = lerpf(smooth,noise,0.04 if kind=="wind" else 0.28)
		var envelope := minf(1,t*100)*exp(-t*(14 if not loop else 0))
		var value := 0.0
		match kind:
			"wind": value = smooth*0.25
			"water": value = smooth*0.35 + noise*0.025
			"fire": value = smooth*0.18+noise*0.025+(0.2 if noise>0.985 else 0.0)
			"grass": value = (smooth*0.3+sin(t*TAU*85)*0.17)*envelope
			"gravel": value = (noise*0.35+sin(t*TAU*100)*0.1)*envelope
			"wood": value = (sin(t*TAU*160)*0.35+noise*0.12)*envelope
			"chop": value = (sin(t*TAU*125)*0.45+noise*0.25)*envelope
			"mine": value = (sin(t*TAU*1700)*0.3+sin(t*TAU*2450)*0.14+noise*0.18)*envelope
			"splash": value = smooth*0.7*envelope
			"hit": value = (sin(t*TAU*65)*0.45+noise*0.2)*envelope
			"bird": value = sin(TAU*(1700*t+500*t*t))*pow(sin(PI*i/count),2)*0.17
			"moo": value = (sin(TAU*95*t)+sin(TAU*190*t)*0.3)*pow(sin(PI*i/count),2)*0.2
		bytes.encode_s16(i*2,int(clampf(value,-1,1)*32767))
	var stream := AudioStreamWAV.new()
	stream.format = AudioStreamWAV.FORMAT_16_BITS
	stream.mix_rate = rate
	stream.data = bytes
	if loop:
		stream.loop_mode = AudioStreamWAV.LOOP_FORWARD
		stream.loop_end = count
	return stream

func stop_footsteps(id: String) -> void:
	if not footstep_players.has(id): return
	footstep_players[id].player.queue_free()
	footstep_players.erase(id)

func continuous_footsteps(id: String, kind: String, point: Vector3, running: bool) -> void:
	if not enabled: return
	if not footstep_players.has(id):
		if footstep_players.size() >= VOICES: return
		var player := AudioStreamPlayer3D.new()
		player.bus = "Effects"
		player.max_distance = 28
		player.unit_size = 3
		player.volume_db = -8
		add_child(player)
		footstep_players[id] = {"player":player, "kind":"", "touched":0}
	var entry: Dictionary = footstep_players[id]
	var player: AudioStreamPlayer3D = entry.player
	player.position = point
	player.pitch_scale = 1.2 if running else 1.0
	if entry.kind != kind:
		player.stop()
		player.stream = sounds[kind]
		entry.kind = kind
	if not player.playing: player.play()
	entry.touched = Time.get_ticks_msec()

func sound(kind: String, point: Vector3, ambience := false) -> void:
	if not enabled or not sounds.has(kind): return
	for voice in voices:
		if voice.playing: continue
		voice.position = point
		voice.bus = "Ambience" if ambience else "Effects"
		voice.stream = sounds[kind]
		voice.pitch_scale = rng.randf_range(0.92,1.08)
		voice.volume_db = -8
		voice.play()
		return

func burst(point: Vector3, colour: Color, ripple := false) -> void:
	if not enabled or not visuals or effects.size()>=MAX_EFFECTS: return
	var node: Node3D
	if ripple:
		var ring := MeshInstance3D.new()
		var mesh := TorusMesh.new()
		mesh.inner_radius = 0.13
		mesh.outer_radius = 0.16
		mesh.rings = 16
		mesh.ring_segments = 6
		ring.mesh = mesh
		var material := StandardMaterial3D.new()
		material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		material.albedo_color = colour
		ring.material_override = material
		node = ring
	else:
		var chips := CPUParticles3D.new()
		chips.amount = 9
		chips.lifetime = 0.55
		chips.one_shot = true
		chips.explosiveness = 1
		chips.direction = Vector3.UP
		chips.spread = 65
		chips.initial_velocity_min = 0.8
		chips.initial_velocity_max = 1.8
		chips.gravity = Vector3(0,-4,0)
		var mesh := BoxMesh.new()
		mesh.size = Vector3(0.035,0.025,0.04)
		var material := StandardMaterial3D.new()
		material.albedo_color = colour
		mesh.material = material
		chips.mesh = mesh
		node = chips
	add_child(node)
	node.position = point
	effects.append({"node":node,"age":0.0,"ripple":ripple})
	event_count += 1

func highlight(point: Vector3, radius := 0.6) -> void:
	hover_ring.position = point+Vector3.UP*0.06
	hover_ring.scale = Vector3.ONE*radius/0.48
	hover_ring.show()

func reset() -> void:
	for entry in footstep_players.values(): entry.player.queue_free()
	footstep_players.clear()
	histories.clear()
	for voice in voices: voice.stop()
	wind.stop()
	water.stop()
	furnace.stop()
	for effect in effects: effect.node.queue_free()
	effects.clear()
	hover_ring.hide()

func ambience(world: Node3D, focus: Vector3, delta: float, active: bool) -> void:
	for id in footstep_players.keys():
		if not active or Time.get_ticks_msec() - footstep_players[id].touched > 180:
			footstep_players[id].player.queue_free()
			footstep_players.erase(id)
	enabled = active
	listener.position = focus+Vector3.UP
	if not active:
		if wind.playing: reset()
		return
	if not wind.playing: wind.play()
	if not water.playing: water.play()
	ambience_clock += delta
	bird_clock += delta
	if ambience_clock>=0.3:
		ambience_clock = 0
		var nearest := 99.0
		# Bounded local tile sampling, regardless of world size.
		for z in range(-9,10,2):
			for x in range(-9,10,2):
				if world.tiles.get(Vector2i(roundi(focus.x)+x,roundi(focus.z)+z))=="water": nearest = minf(nearest,Vector2(x,z).length())
		water.volume_db = lerpf(water.volume_db,-12.0-nearest*3.0,0.4)
		wind.volume_db = -15
		var closest: OmniLight3D
		var furnace_distance := 16.0
		for light in world.furnace_lights:
			var distance: float = light.position.distance_to(focus)
			if distance<furnace_distance: closest = light; furnace_distance = distance
		if closest:
			furnace.position = closest.global_position
			if not furnace.playing: furnace.play()
		else: furnace.stop()
	if bird_clock>7.0 and world.woodland(focus.x,focus.z)>0.15:
		bird_clock = 0
		sound("bird",focus+Vector3(rng.randf_range(-8,8),3,rng.randf_range(-8,8)),true)
	for i in range(effects.size()-1,-1,-1):
		var effect: Dictionary = effects[i]
		effect.age += delta
		if effect.ripple:
			effect.node.scale = Vector3.ONE*(1+effect.age*2)
			effect.node.material_override.albedo_color.a = maxf(0,1-effect.age)
		if effect.age>1:
			effect.node.queue_free()
			effects.remove_at(i)

func actor_feedback(id: String, actor: Node3D, state: Dictionary, world: Node3D, focus: Vector3, now: float, delta: float) -> void:
	if actor.position.distance_squared_to(focus)>900:
		stop_footsteps(id)
		return
	var old: Dictionary = histories.get(id,{"position":actor.position,"distance":0.0,"cycle":-1,"swing":state.get("swingAt",-1),"hits":{}})
	var travel: float = actor.position.distance_to(old.position)
	if travel<1: old.distance += travel
	else: old.distance = 0.0
	old.position = actor.position
	var moving: bool = state.get("action","") in ["Walking","Running"] or state.get("motion") is Dictionary
	var surface := "grass"
	for bridge in world.document.get("bridges",[]):
		var local: Vector2 = world.bridge_local(bridge,actor.position.x,actor.position.z)
		if absf(local.x)<1.6 and absf(local.y)<0.7: surface = "wood"; break
	if surface != "wood" and world.tiles.get(Vector2i(roundi(actor.position.x),roundi(actor.position.z))) == "path": surface = "gravel"
	if moving and recorded_sources.has(surface):
		continuous_footsteps(id, surface, actor.position, state.get("action") == "Running")
	else:
		stop_footsteps(id)
		if moving and old.distance > (1.4 if state.get("action") == "Running" else 1.1):
			old.distance = 0.0
			sound(surface, actor.position)
	var gather: Dictionary = state.get("gathering") if state.get("gathering") is Dictionary else {}
	if not moving and not gather.is_empty():
		var kind := str(gather.get("kind","rock"))
		var duration := 1250.0 if kind=="tree" else 2200.0 if kind=="fishing" else 1450.0
		var cycle := floori(now/duration-0.65)
		if cycle!=old.cycle:
			if old.cycle!=-1:
				var point := Vector3(gather.x,world.walk_height(gather.x,gather.y),gather.y)
				if kind=="fishing": point.y = float(world.water_levels.get(Vector2i(roundi(gather.x),roundi(gather.y)),point.y))-0.13
				sound("chop" if kind=="tree" else "splash" if kind=="fishing" else "mine",point)
				burst(point+Vector3.UP*(0.06 if kind=="fishing" else 0.65),Color("83cce1") if kind=="fishing" else Color("917046") if kind=="tree" else Color("dfc78e"),kind=="fishing")
			old.cycle = cycle
	else: old.cycle = -1
	if actor.get_meta("kind","")=="cow":
		if not old.has("moo_at"): old.moo_at = now+rng.randf_range(12000,24000)
		if now>float(old.moo_at):
			sound("moo",actor.position,true)
			old.moo_at = now+rng.randf_range(16000,30000)
	var swing: float = float(state.get("swingAt",-1))
	if swing!=old.swing:
		if now-swing<850: sound("hit",actor.position+Vector3.UP)
		old.swing = swing
	for hit in state.get("hits",[]):
		var key := str(hit.get("id",str(hit.get("at",0))+":"+str(hit.get("damage",0))))
		if not old.hits.has(key):
			old.hits[key] = now
			if now-float(hit.get("at",0))<1000 and float(hit.get("damage",0))>0: burst(actor.position+Vector3.UP,Color("af5550"))
	for key in old.hits.keys():
		if now-float(old.hits[key])>2500: old.hits.erase(key)
	histories[id] = old

extends Node3D

signal progress(message: String)
var document: Dictionary = {}
var templates: Dictionary = {}
var regions: Array = []
var resources: Dictionary = {}
var roofs: Array = []
var storey_groups: Array = []
var stairs: Dictionary = {}
var fortress_transforms: Dictionary = {}
var active_floor := 0
var active_building := ""
var tiles: Dictionary = {}
var heights: Dictionary = {}
var water_levels: Dictionary = {}
var actors: Dictionary = {}
var pickables: Dictionary = {}
var region_count := 0
var mobiles: Dictionary = {}
var model_errors := 0
var tree_bins: Dictionary = {}
var grass_mesh: ArrayMesh
var wheat_instances := 0
var grass_instances := 0
var bridge_models: Array = []
var path_mask: ImageTexture
var mask_origin := Vector2.ZERO
var mask_size := Vector2.ONE
var water_vertex_cache: Dictionary = {}
var water_motion_cache: Dictionary = {}
var shoreline_candidates: Dictionary = {}
var bank_faces := 0
var waterfall_faces := 0
var bridge_template: PackedScene
var generation := 0
var humanoids: Dictionary = {}
var pick_shapes: Dictionary = {}
var ground_drops: Dictionary = {}
var gate_models: Dictionary = {}
var gpu_texture_index: Dictionary = {}
var pending_resources: Array = []
var resource_availability: Dictionary = {}
var lod_meshes := 0
var furnace_lights: Array = []
var navigation: Node3D
var scenery_clock := 0.0
var animation_clocks: Dictionary = {}
var resource_documents: Dictionary = {}
var pending_buildings: Array = []
var streamed_buildings: Dictionary = {}
var gate_states: Dictionary = {}
var detail_radius := 90.0

func build(doc: Dictionary) -> bool:
	generation += 1
	document = doc
	regions = doc.get("regions", [])
	for child in get_children():
		child.queue_free()
	resources.clear()
	resource_documents.clear()
	pending_buildings.clear()
	streamed_buildings.clear()
	gate_states.clear()
	animation_clocks.clear()
	pending_resources.clear()
	resource_availability.clear()
	roofs.clear()
	storey_groups.clear()
	stairs.clear()
	fortress_transforms.clear()
	active_floor=0
	active_building=""
	actors.clear()
	pickables.clear()
	mobiles.clear()
	humanoids.clear()
	ground_drops.clear()
	gate_models.clear()
	furnace_lights.clear()
	tiles.clear()
	heights.clear()
	water_levels.clear()
	water_motion_cache.clear()
	water_vertex_cache.clear()
	shoreline_candidates.clear()
	region_count = 0
	model_errors = 0
	wheat_instances = 0
	grass_instances = 0
	bridge_models.clear()
	tree_bins.clear()
	for tree in doc.get("nodes", []):
		if tree.get("kind") != "tree":
			continue
		var bin := Vector2i(floori(tree.x / 4.0), floori(tree.y / 4.0))
		if not tree_bins.has(bin):
			tree_bins[bin] = []
		tree_bins[bin].append(Vector2(tree.x, tree.y))
	for region in regions:
		if not region.get("published", true):
			continue
		region_count += 1
		for z in range(int(region.height)):
			for x in range(int(region.width)):
				var key := str(x) + "," + str(z)
				var p := Vector2i(int(region.x) + x, int(region.y) + z)
				tiles[p] = region.get("tiles", {}).get(key, region.get("terrain", "grass"))
				heights[p] = float(region.get("heights", {}).get(key, 0))
				water_levels[p] = float(region.get("waterLevels", {}).get(key, 0))
	make_path_mask()
	for region in regions:
		if not region.get("published", true):
			continue
		progress.emit("Building terrain · " + str(region.name))
		await get_tree().process_frame
		for cz in range(0, int(region.height), 16):
			for cx in range(0, int(region.width), 16):
				make_chunk(region, cx, cz)
				add_grass_chunk(region, cx, cz)
	add_water_edges()
	progress.emit("Planting wheat fields…")
	await add_wheat()
	var spawn: Dictionary = doc.get("spawn",{"x":17,"y":26})
	for building in doc.get("buildings", []):
		progress.emit("Loading building models…")
		load_template(building_file(building))
		if building_centre(building).distance_to(Vector2(spawn.x,spawn.y))<detail_radius+20: add_building(building)
		else: pending_buildings.append(building)
		await get_tree().process_frame
	for item in doc.get("nodes", []):
		resource_documents[item.id] = item
		# All templates load before joining; distant instances arrive on demand.
		for file in [str(item.get("species","oak"))+"-tree",str(item.get("species","oak"))+"-stump"] if item.get("kind")=="tree" else ["mining-rock","ore-cluster"]:
			load_template(file)
		if Vector2(item.x-spawn.x,item.y-spawn.y).length()<detail_radius: add_resource(item)
		else: pending_resources.append(item)
	for bridge in doc.get("bridges", []):
		var model := normalized_bridge()
		if model:
			add_child(model)
			model.position = Vector3(bridge.x, ground(bridge.x, bridge.y), bridge.y)
			# Source bridge runs along Z; the server's zero-degree crossing runs along X.
			model.rotation.y = -deg_to_rad(float(bridge.get("rotation", 0)))
			bridge_models.append(model)
			add_bridge_approaches(bridge)
	for npc in doc.get("npcs", []):
		var role: String = npc.get("type", "resident")
		if role == "guide" and str(npc.id).begins_with("guide-"):
			role = npc.id
		var file := "cow" if role == "cow" else "forest-goblin" if role == "enemy" else "npc-" + role
		if not FileAccess.file_exists("res://assets/models/" + file + ".glb"):
			file = "npc-resident"
		var model := fitted(file, 1.05 if file == "cow" else 1.7)
		if model:
			add_child(model)
			model.position = Vector3(npc.x, ground(npc.x, npc.y), npc.y)
			var home: Dictionary = {}
			for building in doc.get("buildings",[]):
				if npc.id in building.get("occupants",[]): home = building; break
			model.position += Vector3(home.get("offsetX",0),0,home.get("offsetY",0))
			model.position.y = ground(model.position.x,model.position.z)
			if role=="banker" and not home.is_empty():
				var colleagues: Array = doc.get("npcs",[]).filter(func(n): return n.get("type")=="banker" and n.id in home.get("occupants",[]))
				if colleagues.size()>1:
					var centre := Vector2.ZERO
					for clerk in colleagues: centre += Vector2(clerk.x,clerk.y)
					centre /= colleagues.size()
					var spacing := (float(colleagues.size()-1)*.5-colleagues.find(npc))*minf(1.35,(float(home.width)-2)/maxi(1,colleagues.size()-1))
					var point := centre+Vector2(spacing,0).rotated(deg_to_rad(float(home.get("rotation",0))))
					model.position.x = point.x+home.get("offsetX",0)
					model.position.z = point.y+home.get("offsetY",0)
			var facing := float(npc.get("rotation",(0 if role=="banker" else 180)+home.get("rotation",0)))
			model.rotation.y = deg_to_rad(180-facing)
			if role != "cow":
				model.set_meta("terrain_world",self)
				preload("res://scripts/rig.gd").prepare(model)
				humanoids[npc.id] = model
			if role in ["cow", "enemy"]:
				mobiles[npc.id] = model
				model.set_meta("kind", role)
			add_pick_body(model, str(npc.id), 1.05 if role == "cow" else 1.7, 0.48)
		pickables[npc.id] = {"x": npc.x, "y": npc.y, "kind": "npc", "name": npc.get("name", "NPC"), "role":role, "combatLevel":npc.get("combatLevel",5)}
		await get_tree().process_frame
	for station in doc.get("stations", []):
		pickables[station.id] = {"x": station.x, "y": station.y, "kind": "station", "name": station.get("name", "Workstation")}
	for rope in doc.get("barriers", []):
		add_queue_rope(rope)
	for boundary in doc.get("boundaries", []):
		add_boundary(boundary)
	build_fortress_walls()
	# Preload dynamic character models before the clientReady handshake.
	for file in ["player", "forest-goblin", "cow", "bronze-axe", "bronze-pickaxe"]:
		progress.emit("Preparing " + file.replace("-", " ") + "…")
		load_template(file)
		await get_tree().process_frame
	progress.emit("Preparing native navigation…")
	navigation = preload("res://scripts/navigation.gd").new()
	add_child(navigation)
	await navigation.build(self)
	return not templates.is_empty() and model_errors == 0

func add_pick_body(root: Node3D, id: String, height: float, radius: float) -> void:
	var body := StaticBody3D.new()
	body.collision_layer = 2
	body.collision_mask = 0
	body.set_meta("interact_id", id)
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = radius
	shape.height = maxf(height, radius * 2)
	collision.shape = shape
	collision.position.y = height / 2.0
	body.add_child(collision)
	root.add_child(body)

func add_model_pick(node: Node3D, id: String) -> void:
	if not node.visible: return
	if node is MeshInstance3D and node.mesh:
		var key: int = node.mesh.get_instance_id()
		if not pick_shapes.has(key):
			pick_shapes[key] = node.mesh.create_trimesh_shape()
			pick_shapes[key].backface_collision = true
		var body := StaticBody3D.new()
		body.collision_layer = 2
		body.collision_mask = 0
		body.set_meta("interact_id",id)
		var shape := CollisionShape3D.new()
		shape.shape = pick_shapes[key]
		body.add_child(shape)
		node.add_child(body)
	for child in node.get_children():
		if child is Node3D and not child is StaticBody3D: add_model_pick(child,id)

func woodland(x: float, z: float) -> float:
	var bin := Vector2i(floori(x / 4.0), floori(z / 4.0))
	var total := 0.0
	for dz in range(-1, 2):
		for dx in range(-1, 2):
			for tree in tree_bins.get(bin + Vector2i(dx, dz), []):
				total += maxf(0, 1.0 - Vector2(x, z).distance_to(tree) / 3.0) * 0.8
	return minf(1, total)

func occupied(x: float, z: float) -> bool:
	for b in document.get("buildings", []):
		if x >= b.x+float(b.get("offsetX",0)) - 0.5 and z >= b.y+float(b.get("offsetY",0)) - 0.5 and x <= b.x+float(b.get("offsetX",0)) + b.width - 0.5 and z <= b.y+float(b.get("offsetY",0)) + b.height - 0.5:
			return true
	return false

func make_grass_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for angle in [0.0, PI / 3, PI * 2 / 3]:
		for p in [Vector3(-0.035, 0, 0), Vector3(0, 0.18, 0.025), Vector3(0.035, 0, 0)]:
			st.set_color(Color.WHITE)
			st.add_vertex(p.rotated(Vector3.UP, angle))
	st.generate_normals()
	return st.commit()

func add_grass_chunk(region: Dictionary, cx: int, cz: int) -> void:
	if not grass_mesh:
		grass_mesh = make_grass_mesh()
	var transforms: Array[Transform3D] = []
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(str(region.id) + ":" + str(cx) + ":" + str(cz))
	for z in range(cz, mini(cz + 16, int(region.height))):
		for x in range(cx, mini(cx + 16, int(region.width))):
			var px := int(region.x) + x
			var pz := int(region.y) + z
			if tiles.get(Vector2i(px, pz)) != "grass" or occupied(px, pz):
				continue
			for i in range(3):
				var xx := px + rng.randf_range(-0.44, 0.44)
				var zz := pz + rng.randf_range(-0.44, 0.44)
				if occupied(xx,zz) or rng.randf() < woodland(xx, zz) * 0.8:
					continue
				var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.65, 1.4))
				transforms.append(Transform3D(basis, Vector3(xx, ground(xx, zz) - 0.01, zz)))
	if transforms.is_empty():
		return
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = grass_mesh
	mm.instance_count = transforms.size()
	var origin := Vector3(float(region.x) + cx + 7.5, 0, float(region.y) + cz + 7.5)
	for i in range(transforms.size()):
		var transform := transforms[i]
		transform.origin -= origin
		mm.set_instance_transform(i, transform)
	var node := MultiMeshInstance3D.new()
	node.position = origin
	node.multimesh = mm
	node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	node.visibility_range_end = 45
	node.visibility_range_end_margin = 5
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/grass.gdshader")
	node.material_override = material
	add_child(node)
	grass_instances += transforms.size()

func add_wheat() -> void:
	var template := load_template("wheat")
	if not template:
		return
	var source: Node3D = template.instantiate()
	var parts: Array = []
	collect_meshes(source, Transform3D.IDENTITY, parts)
	var chunks: Dictionary = {}
	for p in tiles:
		if tiles[p] != "field" or occupied(p.x, p.y):
			continue
		var key := Vector2i(floori(p.x / 16.0), floori(p.y / 16.0))
		if not chunks.has(key):
			chunks[key] = []
		var rng := RandomNumberGenerator.new()
		rng.seed = hash(str(p))
		for row in range(3):
			for col in range(3):
				var x: float = p.x + (col - 1) * 0.29 + rng.randf_range(-0.035, 0.035)
				var z: float = p.y + (row - 1) * 0.29 + rng.randf_range(-0.035, 0.035)
				var basis := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.8, 1.1))
				chunks[key].append(Transform3D(basis, Vector3(x, ground(x, z) - 0.02, z)))
				wheat_instances += 1
	for key in chunks:
		for part in parts:
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = part.mesh
			mm.instance_count = chunks[key].size()
			for i in range(chunks[key].size()):
				mm.set_instance_transform(i, chunks[key][i] * part.transform)
			var node := MultiMeshInstance3D.new()
			node.multimesh = mm
			node.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			node.visibility_range_end = 65
			node.visibility_range_end_margin = 8
			add_child(node)
		await get_tree().process_frame
	source.free()

func collect_meshes(node: Node3D, parent: Transform3D, result: Array) -> void:
	var transform := parent * node.transform
	if node is MeshInstance3D and node.mesh:
		result.append({"mesh": node.mesh, "transform": transform, "node":node})
	for child in node.get_children():
		if child is Node3D:
			collect_meshes(child, transform, result)

func add_boundary(b: Dictionary) -> void:
	if b.get("type","")=="fortressWall":
		add_fortress_wall(b)
		return
	if b.get("type","")=="gate":
		add_farm_gate(b)
		return
	var root := Node3D.new()
	add_child(root)
	root.position = Vector3(b.x, ground(b.x, b.y), b.y)
	var stone: bool = b.get("type", "fence") in ["wall","romanWall"]
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("8b897f") if stone else Color("795334")
	var post := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.20, 1.1, 0.20)
	post.mesh = box
	post.position.y = 0.55
	post.material_override = material
	root.add_child(post)
	for step in [Vector2i(1, 0), Vector2i(0, 1), Vector2i(-1, 0), Vector2i(0, -1)]:
		var neighbour := false
		for other in document.get("boundaries", []):
			if other.x == b.x + step.x and other.y == b.y + step.y:
				neighbour = true
				break
		if not neighbour:
			continue
		for elevation in ([0.5] if stone else [0.35, 0.75]):
			var rail := MeshInstance3D.new()
			var rail_box := BoxMesh.new()
			rail_box.size = Vector3(0.5 if step.x else 0.10, 0.95 if stone else 0.12, 0.5 if step.y else 0.10)
			rail.mesh = rail_box
			rail.position = Vector3(step.x * 0.25, elevation, step.y * 0.25)
			rail.material_override = material
			root.add_child(rail)

# Native shoreline shaping: samples the map without rewriting saved heights.
# Buildings and bridge foundations keep their authored elevations.
func ground(x: float, z: float) -> float:
	var elevation := authored_ground(x,z)
	var center := Vector2i(roundi(x),roundi(z))
	var waters := shore_candidates(center)
	if waters.is_empty(): return elevation
	if tiles.get(center,"") not in ["grass","path","sand","quarry"]:
		var edge_land := false
		for dz in range(-1,2):
			for dx in range(-1,2):
				var p := center+Vector2i(dx,dz)
				if tiles.get(p,"") in ["grass","path","sand","quarry"] and absf(x-p.x)<=0.5001 and absf(z-p.y)<=0.5001: edge_land = true
		if not edge_land: return elevation
	var nearest := 1.15
	var water_height := elevation
	for p in waters:
		var gap := Vector2(maxf(0,absf(x-p.x)-0.5),maxf(0,absf(z-p.y)-0.5)).length()
		if gap < nearest:
			nearest = gap
			water_height = float(water_levels.get(p,0))-0.13
	if nearest >= 1.15 or occupied(x,z): return elevation
	var bridge_preserve := 0.0
	for bridge in document.get("bridges",[]):
		var local: Vector2 = bridge_local(bridge,x,z)
		bridge_preserve = maxf(bridge_preserve,1.0-smoothstep(1.5,2.15,maxf(absf(local.x),absf(local.y))))
	var shore_height := minf(elevation,maxf(water_height+0.08,elevation-1.2))
	var blend := smoothstep(0.0,1.15,nearest)
	return lerpf(lerpf(shore_height,elevation,blend),elevation,bridge_preserve)

func shore_candidates(center: Vector2i) -> Array:
	if shoreline_candidates.has(center): return shoreline_candidates[center]
	var result: Array = []
	for z in range(-2,3):
		for x in range(-2,3):
			var p := center+Vector2i(x,z)
			if tiles.get(p,"") == "water": result.append(p)
	shoreline_candidates[center] = result
	return result

func authored_ground(x: float, z: float) -> float:
	var ix := int(floor(x))
	var iz := int(floor(z))
	var fx := x - ix
	var fz := z - iz
	return lerpf(lerpf(heights.get(Vector2i(ix, iz), 0.0), heights.get(Vector2i(ix + 1, iz), 0.0), fx), lerpf(heights.get(Vector2i(ix, iz + 1), 0.0), heights.get(Vector2i(ix + 1, iz + 1), 0.0), fx), fz)

func land_subdivisions(p: Vector2i) -> int:
	# Flat/planar edges need no extra vertices. Retain every actual height bend.
	var corners: Array[Vector2] = [Vector2(p)+Vector2(-0.5,-0.5),Vector2(p)+Vector2(0.5,-0.5),Vector2(p)+Vector2(0.5,0.5),Vector2(p)+Vector2(-0.5,0.5)]
	var ys: Array[float] = []
	for point in corners: ys.append(ground(point.x,point.y))
	for i in range(4):
		var mid := corners[i].lerp(corners[(i+1)%4],0.5)
		if absf(ground(mid.x,mid.y)-(ys[i]+ys[(i+1)%4])*0.5)>0.00001: return 2
	if absf(ground(p.x,p.y)-(ys[0]+ys[2])*0.5)>0.00001: return 2
	return 1

func make_chunk(region: Dictionary, cx: int, cz: int) -> void:
	var groups: Dictionary = {}
	for z in range(cz, mini(cz + 16, int(region.height))):
		for x in range(cx, mini(cx + 16, int(region.width))):
			var p := Vector2i(int(region.x) + x, int(region.y) + z)
			var kind: String = tiles.get(p, "grass")
			if not groups.has(kind):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				groups[kind] = st
			var st: SurfaceTool = groups[kind]
			var subdivisions := 4 if kind in ["grass","path","sand","quarry"] and not shore_candidates(p).is_empty() else (1 if kind == "water" else land_subdivisions(p))
			for sz in range(subdivisions):
				for sx in range(subdivisions):
					var points: Array[Vector3] = []
					for corner in [Vector2(-0.5, -0.5), Vector2(0.5, -0.5), Vector2(0.5, 0.5), Vector2(-0.5, 0.5)]:
						var xx: float = p.x - 0.5 + (sx + corner.x + 0.5) / subdivisions
						var zz: float = p.y - 0.5 + (sz + corner.y + 0.5) / subdivisions
						var yy := float(water_levels.get(p, 0.0)) - 0.13 if kind == "water" else ground(xx, zz)
						points.append(Vector3(xx, yy, zz))
					for index in [0, 1, 2, 0, 2, 3]:
						if kind=="water":
							st.set_color(water_vertex_colour(Vector2(points[index].x,points[index].z),p))
						else: st.set_color(Color(woodland(points[index].x, points[index].z), shore_wear(points[index].x,points[index].z) if kind in ["grass","sand"] else 0.0, 0, 1))
						st.set_uv(Vector2(points[index].x, points[index].z))
						st.add_vertex(points[index])

	for kind in groups:
		var st: SurfaceTool = groups[kind]
		st.generate_normals()
		if kind == "water": st.generate_tangents()
		var mesh := MeshInstance3D.new()
		mesh.mesh = st.commit()
		if kind == "water":
			var water := ShaderMaterial.new()
			water.shader = load("res://shaders/water.gdshader")
			water.set_shader_parameter("wave_texture",load("res://terrain-textures/waves.png"))
			mesh.material_override = water
		else:
			var material := ShaderMaterial.new()
			material.shader = load("res://shaders/terrain.gdshader")
			for texture_kind in ["grass", "woodland", "gravel", "rock"]:
				material.set_shader_parameter(texture_kind + "_texture", load("res://terrain-textures/" + texture_kind + ".png"))
			material.set_shader_parameter("base_colour", {"grass": Color("5f7940"), "path": Color("aa9a80"), "sand": Color("bba875"), "field": Color("756448"), "quarry": Color("87837a"), "floor": Color("8d806a")}.get(kind, Color("728552")))
			material.set_shader_parameter("path_mask", path_mask)
			material.set_shader_parameter("mask_origin", mask_origin)
			material.set_shader_parameter("mask_size", mask_size)
			material.set_shader_parameter("blend_paths", kind in ["path", "grass"])
			material.set_shader_parameter("grass", kind in ["grass","sand"])
			mesh.material_override = material
		add_child(mesh)
		mesh.create_trimesh_collision()

func load_template(file: String) -> PackedScene:
	if templates.has(file):
		return templates[file]
	var gltf := GLTFDocument.new()
	var state := GLTFState.new()
	if gltf.append_from_file("res://assets/models/" + file + ".glb", state) != OK:
		model_errors += 1
		push_error("Could not load model: " + file)
		return null
	# GPU-ready resources are built ahead of time, deduplicated across models.
	# Raw GLBs remain intact; source dimensions and material channels are preserved.
	if gpu_texture_index.is_empty() and FileAccess.file_exists("res://gpu-textures/index.json"):
		gpu_texture_index = JSON.parse_string(FileAccess.get_file_as_string("res://gpu-textures/index.json"))
	var current_hash := FileAccess.get_sha256("res://assets/models/"+file+".glb")
	var mappings: Dictionary = gpu_texture_index.get(file,{}) if gpu_texture_index.get("_source_hashes",{}).get(file,"")==current_hash else {}
	var materials := state.get_materials()
	for key in mappings:
		var parts: PackedStringArray = key.split(":")
		var material := materials[int(parts[0])] as StandardMaterial3D
		if material: material.set_texture(int(parts[1]),load(mappings[key]))
	var model := gltf.generate_scene(state)
	if not preload("res://scripts/rig.gd").find_skeleton(model) and file != "wooden-bridge":
		optimize_meshes(model)
	var packed := PackedScene.new()
	packed.pack(model)
	model.free()
	templates[file] = packed
	return packed

func fitted(file: String, height: float, max_width := 0.0) -> Node3D:
	var template := load_template(file)
	if not template:
		return null
	var model: Node3D = template.instantiate()
	var box := bounds(model, Transform3D.IDENTITY)
	var scale_factor := height / maxf(box.size.y, 0.01)
	if max_width > 0:
		scale_factor = minf(scale_factor, max_width / maxf(maxf(box.size.x, box.size.z), 0.01))
	var wrapper := Node3D.new()
	model.scale *= scale_factor
	model.position = Vector3(-box.get_center().x, -box.position.y, -box.get_center().z) * scale_factor
	wrapper.add_child(model)
	return wrapper

func bounds(node: Node3D, parent_transform: Transform3D) -> AABB:
	var transform := parent_transform * node.transform
	var result := AABB()
	var has_box := false
	if node is MeshInstance3D and node.mesh:
		result = transform * node.get_aabb()
		has_box = true
	for child in node.get_children():
		if child is Node3D:
			var child_box := bounds(child, transform)
			if child_box.size.length() > 0:
				result = result.merge(child_box) if has_box else child_box
				has_box = true
	return result

func add_fortress_wall(b: Dictionary) -> void:
	var template := load_template("fortress-wall")
	if not template: return
	if b.get("tower",false):
		var tower: Node3D=load_template("fortress-tower").instantiate()
		tower.position=Vector3(b.x,ground(b.x,b.y),b.y);add_child(tower)
	var arms: Array = []
	for step in [Vector2i.RIGHT,Vector2i.LEFT,Vector2i.UP,Vector2i.DOWN]:
		for other in document.get("boundaries",[]):
			if other.get("type")=="fortressWall" and int(other.x)==int(b.x)+step.x and int(other.y)==int(b.y)+step.y:
				arms.append(step)
				break
	if arms.is_empty(): arms.append(Vector2i.RIGHT); arms.append(Vector2i.LEFT)
	var key := Vector2i(int(b.x)/16,int(b.y)/16)
	if not fortress_transforms.has(key): fortress_transforms[key]=[]
	for step in arms:
		var basis := Basis(Vector3.UP,PI/2 if step.y else 0).scaled(Vector3(.5,1,1))
		fortress_transforms[key].append(Transform3D(basis,Vector3(b.x+step.x*.25,ground(b.x,b.y),b.y+step.y*.25)))

func build_fortress_walls() -> void:
	if fortress_transforms.is_empty(): return
	var source := load_template("fortress-wall").instantiate() as Node3D
	var parts: Array=[];collect_meshes(source,Transform3D.IDENTITY,parts)
	for key in fortress_transforms:
		for part in parts:
			var mm := MultiMesh.new();mm.transform_format=MultiMesh.TRANSFORM_3D;mm.mesh=part.mesh
			mm.instance_count=fortress_transforms[key].size()
			for i in range(mm.instance_count): mm.set_instance_transform(i,fortress_transforms[key][i]*part.transform)
			var node := MultiMeshInstance3D.new();node.multimesh=mm;node.visibility_range_end=170;node.visibility_range_end_margin=10;add_child(node)
	source.free()

func storey_count(b: Dictionary) -> int:
	return 2 if b.get("model") in ["cityTownhouse","castleRampart","castleGatehouse"] else 3 if b.get("model")=="cityCivicHall" else 1

func storey_point(b: Dictionary, x: int, z: int) -> Vector2:
	var turn := int(b.get("rotation",0))/90
	var w := int(b.height if turn%2 else b.width)
	var h := int(b.width if turn%2 else b.height)
	var p := Vector2(x,z)
	match turn:
		1: p=Vector2(h-1-z,x)
		2: p=Vector2(w-1-x,h-1-z)
		3: p=Vector2(z,w-1-x)
	return p+Vector2(b.x,b.y)

func stair_links(b: Dictionary, level: int) -> Array:
	var swap := int(b.get("rotation",0))%180!=0
	var w := int(b.height if swap else b.width)
	var h := int(b.width if swap else b.height)
	var x := maxi(1,roundi((w-1)/2.0-.375*(w-.76)))
	if b.get("model") in ["castleRampart","castleGatehouse"]:
		var bottom:=storey_point(b,x,h);var top:=storey_point(b,x,int((h-1)/2));return [{"id":"stairs:%s:%d:%s"%[b.id,level,"down" if level else "up"],"building":"castle-ramparts","level":level,"toLevel":0 if level else 1,"point":top if level else bottom,"landing":bottom if level else top}]
	var bottom := storey_point(b,x,mini(h-2,roundi((h-1)/2.0+.192*(h-.76))))
	var top := storey_point(b,x,maxi(1,roundi((h-1)/2.0-.4*(h-.76))))
	var result: Array = []
	if level+1<storey_count(b): result.append({"id":"stairs:%s:%d:up"%[b.id,level],"building":b.id,"level":level,"toLevel":level+1,"point":bottom,"landing":top})
	if level>0: result.append({"id":"stairs:%s:%d:down"%[b.id,level],"building":b.id,"level":level,"toLevel":level-1,"point":top,"landing":bottom})
	return result

func player_height(x: float,z: float,state: Dictionary) -> float:
	if state.get("floorBuilding")=="castle-ramparts":
		for b in document.get("buildings",[]):
			if b.get("model") in ["castleRampart","castleGatehouse"] and inside_building(Vector3(x,0,z),b):
				var c:=building_centre(b);return ground(c.x,c.y)+3.3
	if int(state.get("floorLevel",0))>0:
		for b in document.get("buildings",[]):
			if b.id==state.get("floorBuilding"):
				var c := building_centre(b)
				return ground(c.x,c.y)+.10+int(state.floorLevel)*3.2
	return walk_height(x,z)

func building_file(b: Dictionary) -> String:
	return {"castleGatehouse":"castle-gatehouse","castleRampart":"castle-rampart","townFountain":"town-fountain","cityTownhouse":"city-townhouse", "cityCivicHall":"city-civic-hall", "medievalHouse": "medieval-house", "medievalWorkshop": "medieval-workshop", "medievalSmithy": "medieval-smithy", "medievalBank": "medieval-bank", "medievalBankVault": "medieval-bank-vault", "medievalCottage": "medieval-cottage", "medievalTownhouse": "medieval-townhouse", "medievalMill": "medieval-mill", "medievalCookhouse": "medieval-cookhouse", "medievalMilitary": "medieval-military", "medievalChapel": "medieval-chapel", "medievalStorehouse": "medieval-storehouse", "medievalWatchtower": "medieval-watchtower"}.get(b.get("model", ""), "medieval-cottage")

func building_centre(b: Dictionary) -> Vector2:
	return Vector2(b.x+(b.width-1)/2.0+b.get("offsetX",0),b.y+(b.height-1)/2.0+b.get("offsetY",0))

func add_building(b: Dictionary) -> void:
	var file := building_file(b)
	var template := load_template(file)
	if not template:
		return
	var group := Node3D.new()
	add_child(group)
	streamed_buildings[str(b.id)] = {"node":group,"document":b}
	var model: Node3D = template.instantiate()
	var angle := float(b.get("rotation", 0))
	var swapped := int(angle) % 180 != 0
	model.scale = Vector3(float(b.height if swapped else b.width) - 0.76, 1, float(b.width if swapped else b.height) - 0.76)
	if b.get("model") in ["castleRampart","castleGatehouse"]: model.scale=Vector3(float(b.height if swapped else b.width),1,float(b.width if swapped else b.height))
	if b.get("model")=="townFountain": model.scale=Vector3.ONE
	model.rotation.y = -deg_to_rad(angle)
	var x: float = b.x + (b.width - 1.0) / 2.0 + b.get("offsetX", 0)
	var z: float = b.y + (b.height - 1.0) / 2.0 + b.get("offsetY", 0)
	model.position = Vector3(x, ground(x, z)+0.10, z)
	if b.get("model") in ["cityCivicHall","cityTownhouse","castleRampart","castleGatehouse","townFountain"]: apply_building_atlas(model)
	group.add_child(model)
	if not b.get("model") in ["castleRampart","castleGatehouse","townFountain"]:
		var underfloor:=MeshInstance3D.new();var slab:=BoxMesh.new();slab.size=Vector3(b.width-1.0,.04,b.height-1.0);underfloor.mesh=slab
		var timber:=StandardMaterial3D.new();timber.albedo_color=Color("493521");timber.roughness=.95;underfloor.material_override=timber
		underfloor.position=Vector3(x,ground(x,z)+.06,z);group.add_child(underfloor)
	add_entrance_door(b,group,model)
	if b.get("model")=="townFountain": add_fountain_water(model)
	add_occluders(model)
	for furnace in model.find_children("Furnace_*","Node3D",true,false):
		if not furnace is MeshInstance3D:
			var light := OmniLight3D.new()
			group.add_child(light)
			light.position = furnace.global_position+Vector3.UP*0.7
			light.light_color = Color("ffac53")
			light.omni_range = 3.5
			light.light_energy = 0.16
			furnace_lights.append(light)
	var rear := model.find_child("RearDoor",true,false) as Node3D
	if rear:
		var pivot := Node3D.new()
		group.add_child(pivot)
		pivot.global_transform = Transform3D(Basis(Vector3.UP,-deg_to_rad(angle)),rear.global_position)
		rear.reparent(pivot,true)
		var id := "door:"+str(b.id)
		gate_models[id] = {"pivot":pivot,"closed":pivot.rotation.y,"open":gate_states.get(id,false)}
		add_model_pick(rear,id)
		var swap := int(angle)%180!=0
		var w := int(b.height if swap else b.width)
		var h := int(b.width if swap else b.height)
		var centre_x := clampi(roundi((w-1)/2.0),1,w-2)
		var tile := Vector2(centre_x,0)
		match int(angle)%360:
			90: tile = Vector2(h-1,centre_x)
			180: tile = Vector2(w-1-centre_x,h-1)
			270: tile = Vector2(0,w-1-centre_x)
		pickables[id] = {"x":b.x+tile.x,"y":b.y+tile.y,"kind":"gate","name":"Mill rear door"}
	if storey_count(b)>1:
		for level in range(storey_count(b)):
			var floor_root := model.find_child("Storey"+str(level),true,false) as Node3D
			if floor_root: storey_groups.append({"node":floor_root,"building":b,"level":level})
			for link in stair_links(b,level):
				var body := StaticBody3D.new()
				body.collision_layer=2;body.collision_mask=0
				body.set_meta("interact_id",link.id);body.set_meta("command_type","stairs")
				group.add_child(body)
				body.position=Vector3(link.point.x,model.position.y+level*3.2+.4,link.point.y)
				var collider := CollisionShape3D.new();var shape := BoxShape3D.new()
				shape.size=Vector3(.85,.8,.85);collider.shape=shape;body.add_child(collider)
				stairs[link.id]={"body":body,"link":link,"building":b}
				pickables[link.id]={"x":link.point.x,"y":link.point.y,"kind":"stairs","name":"Climb stairs " + ("up" if link.toLevel>level else "down"),"floorLevel":level,"building":b.id}
			if level>0:
				var floor_body := StaticBody3D.new();floor_body.collision_layer=0;floor_body.collision_mask=0
				group.add_child(floor_body)
				floor_body.position=Vector3(x,model.position.y+level*3.2-.06,z)
				var collision := CollisionShape3D.new();var floor_shape := BoxShape3D.new()
				floor_shape.size=Vector3(b.width if b.get("model") in ["castleRampart","castleGatehouse"] else b.width-1.5,.12,b.height-1 if b.get("model") in ["castleRampart","castleGatehouse"] else b.height-1.5);collision.shape=floor_shape;floor_body.add_child(collision)
				storey_groups.append({"node":floor_body,"building":b,"level":level,"collision":true})
	var roof := model.find_child("HouseRoof", true, false)
	if roof:
		roofs.append({"node": roof, "building": b})

func tint(node: Node, colour: Color) -> void:
	if node is MeshInstance3D:
		for i in range(node.mesh.get_surface_count()):
			var source = node.get_active_material(i)
			if source is StandardMaterial3D:
				var material = source.duplicate()
				material.albedo_color = colour
				node.set_surface_override_material(i, material)
	for child in node.get_children():
		tint(child, colour)

func ore_colour(item: String) -> Color:
	return {"copper": Color("be7846"), "tin": Color("acb5b8"), "ironOre": Color("815c50"), "coal": Color("292c31"), "zinc": Color("bec6ba"), "silverOre": Color("d4dce2"), "goldOre": Color("d5af48")}.get(item, Color("a0adb4"))

func update_roofs(point: Vector3, level: int = 0, building_id: String = "") -> void:
	active_floor=level;active_building=building_id
	for entry in roofs:
		if not is_instance_valid(entry.node): continue
		var b: Dictionary = entry.building
		entry.node.visible = not inside_building(point,b)
	for entry in storey_groups:
		if not is_instance_valid(entry.node): continue
		var castle:bool=entry.building.get("model") in ["castleRampart","castleGatehouse"]
		var current: bool = inside_building(point,entry.building) and (level==0 or building_id==entry.building.id or castle and building_id=="castle-ramparts")
		if entry.get("collision",false):
			entry.node.collision_layer=1 if current and level==entry.level else 0
		else: entry.node.visible=castle or not current or entry.level<=level
	for id in stairs:
		var entry: Dictionary=stairs[id]
		if not is_instance_valid(entry.body): continue
		entry.body.collision_layer=2 if level==int(entry.link.level) and (level==0 or building_id==entry.building.id or entry.building.get("model") in ["castleRampart","castleGatehouse"] and building_id=="castle-ramparts") else 0

func inside_building(point: Vector3,b: Dictionary) -> bool:
	var c := building_centre(b)
	return absf(point.x-c.x)<(b.width-.76)/2 and absf(point.z-c.y)<(b.height-.76)/2

func preview_stair(id: String) -> Vector3:
	var entry: Dictionary=stairs[id];var link: Dictionary=entry.link
	active_floor=int(link.toLevel);active_building=str(link.building) if active_floor>0 else ""
	var c := building_centre(entry.building)
	return Vector3(link.landing.x,ground(c.x,c.y)+active_floor*3.2,link.landing.y)
func make_path_mask() -> void:
	var low := Vector2i(100000,100000)
	var high := Vector2i(-100000,-100000)
	for p in tiles:
		low = Vector2i(mini(low.x,p.x),mini(low.y,p.y))
		high = Vector2i(maxi(high.x,p.x),maxi(high.y,p.y))
	mask_origin = Vector2(low)
	mask_size = Vector2(high-low+Vector2i.ONE)
	var image := Image.create(int(mask_size.x),int(mask_size.y),false,Image.FORMAT_R8)
	image.fill(Color.BLACK)
	for p in tiles:
		if tiles[p] == "path": image.set_pixel(p.x-low.x,p.y-low.y,Color.WHITE)
	path_mask = ImageTexture.create_from_image(image)

func add_quad(st: SurfaceTool, points: Array) -> void:
	for i in [0,1,2,0,2,3]:
		st.set_uv([Vector2(0,1),Vector2(1,1),Vector2(1,0),Vector2(0,0)][i])
		st.add_vertex(points[i])

func water_vertex_colour(point: Vector2, tile: Vector2i) -> Color:
	var key := Vector3(point.x,float(water_levels.get(tile,0)),point.y)
	if water_vertex_cache.has(key): return water_vertex_cache[key]
	var corner := Vector2i(floori(point.x),floori(point.y))
	var direction := Vector2.ZERO
	var shore := 0.0
	var speed := 0.0
	var count := 0
	for z in range(2):
		for x in range(2):
			var p := corner+Vector2i(x,z)
			if not tiles.has(p): continue
			if tiles[p] != "water": shore = 1.0; continue
			if absf(float(water_levels.get(p,0))-key.y)>0.01: continue
			var motion := water_motion(p)
			direction += Vector2(motion.x,motion.y)
			speed += motion.z
			count += 1
	direction = direction.normalized()*0.5+Vector2.ONE*0.5
	var result := Color(shore,direction.x,direction.y,speed/maxi(count,1))
	water_vertex_cache[key] = result
	return result

func shore_wear(x: float, z: float) -> float:
	var waters := shore_candidates(Vector2i(roundi(x),roundi(z)))
	var nearest := 1.35
	for p in waters:
		nearest = minf(nearest,Vector2(maxf(0,absf(x-p.x)-0.5),maxf(0,absf(z-p.y)-0.5)).length())
	return 1.0-smoothstep(0.02,1.35,nearest)

func water_motion(p: Vector2i) -> Vector3:
	if water_motion_cache.is_empty(): build_water_flow()
	return water_motion_cache.get(p,Vector3(0,1,0))

func build_water_flow() -> void:
	# Route whole level reaches to their outlets; never infer an unsigned axis.
	var visited: Dictionary = {}
	var directions := [Vector2i(1,0),Vector2i(-1,0),Vector2i(0,1),Vector2i(0,-1)]
	for start in tiles:
		if tiles[start] != "water" or visited.has(start): continue
		var reach: Array[Vector2i] = [start]
		visited[start] = true
		var cursor := 0
		var level := float(water_levels.get(start,0))
		var outlets: Dictionary = {}
		var incoming := Vector2.ZERO
		while cursor < reach.size():
			var p := reach[cursor]
			cursor += 1
			for d in directions:
				var next: Vector2i = p+d
				if tiles.get(next,"") != "water": continue
				var next_level := float(water_levels.get(next,0))
				if next_level < level-0.01:
					outlets[p] = Vector2(outlets.get(p,Vector2.ZERO))+Vector2(d)
				elif next_level > level+0.01: incoming -= Vector2(d)
				elif not visited.has(next):
					visited[next] = true
					reach.append(next)
		var distances: Dictionary = {}
		var queue: Array[Vector2i] = []
		for p in outlets:
			distances[p] = 0
			queue.append(p)
		cursor = 0
		while cursor < queue.size():
			var p := queue[cursor]
			cursor += 1
			for d in directions:
				var next: Vector2i = p+d
				if tiles.get(next,"") != "water" or distances.has(next): continue
				if absf(float(water_levels.get(next,0))-level)>0.01: continue
				distances[next] = int(distances[p])+1
				queue.append(next)
		for p in reach:
			var flow: Vector2 = outlets.get(p,Vector2.ZERO)
			if flow == Vector2.ZERO and distances.has(p):
				for d in directions:
					if distances.has(p+d) and int(distances[p+d])<int(distances[p]): flow += Vector2(d)
			if flow == Vector2.ZERO: flow = incoming
			var moving := flow.length_squared()>0.0001
			if not moving: flow = Vector2(0,1)
			flow = flow.normalized()
			var neighbours := 0
			for z in range(-2,3):
				for x in range(-2,3):
					if tiles.get(p+Vector2i(x,z),"") == "water": neighbours += 1
			water_motion_cache[p] = Vector3(flow.x,flow.y,(0.12 if neighbours>=21 else 0.8) if moving else 0.0)

func shore_foot(point: Vector2, water_tile: Vector2i) -> Vector2:
	var inward := Vector2.ZERO
	var center := Vector2i(floori(point.x),floori(point.y))
	for z in range(2):
		for x in range(2):
			var tile := center+Vector2i(x,z)
			if tiles.get(tile,"") == "water": inward += Vector2(tile)-point
	if inward.length_squared()<0.0001: inward = Vector2(water_tile)-point
	var corner_level := float(water_levels.get(water_tile,0))-0.13
	for z in range(2):
		for x in range(2):
			var tile := center+Vector2i(x,z)
			if tiles.get(tile,"") == "water": corner_level = minf(corner_level,float(water_levels.get(tile,0))-0.13)
	var drop := maxf(0,ground(point.x,point.y)-corner_level)
	var width := clampf(0.3+drop*0.22,0.32,0.68)+0.07*sin(point.x*3.7+point.y*2.1)
	var direction := inward.normalized()
	var check := point+direction*0.85
	if tiles.get(Vector2i(roundi(check.x),roundi(check.y)),"") != "water": width = minf(width,0.32)
	return point+inward.normalized()*width

func add_water_edges() -> void:
	bank_faces = 0
	waterfall_faces = 0
	var banks := SurfaceTool.new()
	banks.begin(Mesh.PRIMITIVE_TRIANGLES)
	var falls := SurfaceTool.new()
	falls.begin(Mesh.PRIMITIVE_TRIANGLES)
	for p in tiles:
		if tiles[p] != "water": continue
		var level := float(water_levels.get(p,0))-0.13
		for d in [Vector2i(1,0),Vector2i(-1,0),Vector2i(0,1),Vector2i(0,-1)]:
			var next: Vector2i = p+d
			if not tiles.has(next): continue
			var mid := Vector2(p)+Vector2(d)*0.5
			var a := mid+Vector2(-d.y,d.x)*0.5
			var b := mid-Vector2(-d.y,d.x)*0.5
			if tiles[next] == "water":
				var lower := float(water_levels.get(next,0))-0.13
				if level-lower > 0.15:
					add_quad(falls,[Vector3(a.x,level,a.y),Vector3(b.x,level,b.y),Vector3(b.x,lower,b.y),Vector3(a.x,lower,a.y)])
					waterfall_faces += 1
					# Close the wedge where a cascade meets an inset shoreline.
					for endpoint in [a,b]:
						var corner := Vector2i(floori(endpoint.x),floori(endpoint.y))
						var land := false
						for dz in range(2):
							for dx in range(2):
								if tiles.has(corner+Vector2i(dx,dz)) and tiles[corner+Vector2i(dx,dz)] != "water": land = true
						if not land: continue
						var foot := shore_foot(endpoint,p)
						var top := ground(endpoint.x,endpoint.y)
						# Join every band of the upper and lower bank profiles.
						for band in range(3):
							var points: Array[Vector3] = []
							for pair in [Vector2(band/3.0,level),Vector2((band+1)/3.0,level),Vector2((band+1)/3.0,lower),Vector2(band/3.0,lower)]:
								var ring: Vector2 = endpoint.lerp(foot,pair.x)
								points.append(Vector3(ring.x,lerpf(top,minf(pair.y-0.35,top-0.25),smoothstep(0.0,1.0,pair.x)),ring.y))
							for index in [0,1,2,0,2,3]:
								banks.set_uv(Vector2(points[index].x,points[index].z))
								banks.set_color(Color(0,1.0-(band+int(index==2 or index==3))/3.0,0,1))
								banks.add_vertex(points[index])

					add_water_mist(Vector3(mid.x,lower+0.05,mid.y))
			else:
				for segment in range(4):
					var start := a.lerp(b,segment/4.0)
					var end := a.lerp(b,(segment+1)/4.0)
					var foot_a := shore_foot(start,p)
					var foot_b := shore_foot(end,p)
					var top_a := ground(start.x,start.y)
					var top_b := ground(end.x,end.y)
					for band in range(3):
						var t0 := band/3.0
						var t1 := (band+1)/3.0
						var ring_a0 := start.lerp(foot_a,t0)
						var ring_b0 := end.lerp(foot_b,t0)
						var ring_a1 := start.lerp(foot_a,t1)
						var ring_b1 := end.lerp(foot_b,t1)
						var bottom_a := minf(level-0.35,top_a-0.25)
						var bottom_b := minf(level-0.35,top_b-0.25)
						var points := [Vector3(ring_a0.x,lerpf(top_a,bottom_a,smoothstep(0.0,1.0,t0)),ring_a0.y),Vector3(ring_b0.x,lerpf(top_b,bottom_b,smoothstep(0.0,1.0,t0)),ring_b0.y),Vector3(ring_b1.x,lerpf(top_b,bottom_b,smoothstep(0.0,1.0,t1)),ring_b1.y),Vector3(ring_a1.x,lerpf(top_a,bottom_a,smoothstep(0.0,1.0,t1)),ring_a1.y)]
						for index in [0,1,2,0,2,3]:
							banks.set_uv(Vector2(points[index].x,points[index].z))
							banks.set_color(Color(0,1.0-(t0 if index<2 else t1),0,1))
							banks.add_vertex(points[index])
				bank_faces += 1

	for entry in [[banks,bank_faces,false],[falls,waterfall_faces,true]]:
		if entry[1] == 0: continue
		var st: SurfaceTool = entry[0]
		st.generate_normals()
		var mesh := MeshInstance3D.new()
		mesh.mesh = st.commit()
		if entry[2]:
			var material := ShaderMaterial.new()
			material.shader = load("res://shaders/waterfall.gdshader")
			mesh.material_override = material
		else:
			var material := ShaderMaterial.new()
			material.shader = load("res://shaders/shore.gdshader")
			material.set_shader_parameter("soil_texture",load("res://terrain-textures/woodland.png"))
			material.set_shader_parameter("stone_texture",load("res://terrain-textures/rock.png"))
			mesh.material_override = material
		add_child(mesh)

func normalized_bridge() -> Node3D:
	if bridge_template: return bridge_template.instantiate()
	var source := load_template("wooden-bridge").instantiate() as Node3D
	source.rotation.y = PI/2
	var box := bounds(source,Transform3D.IDENTITY)
	var wrapper := Node3D.new()
	wrapper.add_child(source)
	var sizing := Vector3(3/box.size.x,3/maxf(box.size.x,box.size.z),3/box.size.z)
	source.position = -box.get_center()
	wrapper.scale = sizing
	var parts: Array = []
	collect_meshes(wrapper,Transform3D.IDENTITY,parts)
	var faces := PackedVector3Array()
	for part in parts:
		for vertex in part.mesh.get_faces(): faces.append(part.transform*vertex)
	var triangles := TriangleMesh.new()
	triangles.create_from_faces(faces)
	var profile: Array[float] = []
	for i in range(27):
		var hit := triangles.intersect_ray(Vector3(-1.3+i*0.1,10,0),Vector3.DOWN)
		profile.append(float(hit.position.y) if not hit.is_empty() else 0.0)
	var smooth: Array[float] = []
	for i in range(27):
		var sum := 0.0
		var count := 0
		for j in range(maxi(0,i-2),mini(27,i+3)):
			sum += profile[j]
			count += 1
		smooth.append(sum/count)
	var result := Node3D.new()
	for part in parts:
		var mesh := ArrayMesh.new()
		var baked := MeshInstance3D.new()
		for surface in range(part.mesh.get_surface_count()):
			var arrays: Array = part.mesh.surface_get_arrays(surface)
			var vertices: PackedVector3Array = arrays[Mesh.ARRAY_VERTEX]
			for i in range(vertices.size()):
				var point: Vector3 = part.transform*vertices[i]
				var sample := clampf((point.x+1.3)/0.1,0,26)
				var index := floori(sample)
				point.y -= lerpf(smooth[index],smooth[mini(26,index+1)],sample-index)-0.025
				vertices[i] = point
			arrays[Mesh.ARRAY_VERTEX] = vertices
			mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES,arrays)
			mesh.surface_set_material(surface,part.mesh.surface_get_material(surface))
		baked.mesh = mesh
		result.add_child(baked)
		baked.owner = result
	bridge_template = PackedScene.new()
	wrapper.free()
	bridge_template.pack(result)
	result.free()
	return bridge_template.instantiate()

func bridge_local(b: Dictionary, x: float, z: float) -> Vector2:
	return (Vector2(x,z)-Vector2(b.x,b.y)).rotated(-deg_to_rad(float(b.get("rotation",0))))

func bridge_height(b: Dictionary, x: float, z: float) -> float:
	var p := bridge_local(b,x,z)
	if absf(p.x) <= 1.5 and absf(p.y) <= 0.55: return ground(b.x,b.y)+0.025
	var sign_x := signf(p.x)
	var far := Vector2(sign_x*1.8,p.y).rotated(deg_to_rad(float(b.get("rotation",0))))+Vector2(b.x,b.y)
	var t := clampf((absf(p.x)-1.05)/0.75,0,1)
	return lerpf(ground(b.x,b.y)+0.025,ground(far.x,far.y),t*t*(3-2*t))

func walk_height(x: float, z: float) -> float:
	for b in document.get("bridges",[]):
		var p := bridge_local(b,x,z)
		if absf(p.x) <= 1.8 and absf(p.y) <= 0.55: return bridge_height(b,x,z)
	for b in document.get("buildings",[]):
		if b.get("model") not in ["castleRampart","castleGatehouse","townFountain"] and inside_building(Vector3(x,0,z),b): return ground(x,z)+.10
	return ground(x,z)

func add_bridge_approaches(b: Dictionary) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for side in [-1,1]:
		var edge := Vector2(side*2,0).rotated(deg_to_rad(float(b.get("rotation",0))))+Vector2(b.x,b.y)
		if tiles.get(Vector2i(roundi(edge.x),roundi(edge.y)),"water") == "water": continue
		for i in range(8):
			var points: Array = []
			for pair in [Vector2(i,-1),Vector2(i+1,-1),Vector2(i+1,1),Vector2(i,1)]:
				var distance: float = 1.05+pair.x*0.75/8
				var local := Vector2(side*distance,pair.y*(0.55+(distance-1.05)*0.2))
				var p := local.rotated(deg_to_rad(float(b.get("rotation",0))))+Vector2(b.x,b.y)
				points.append(Vector3(p.x,bridge_height(b,p.x,p.y)+0.004,p.y))
			for index in [0,1,2,0,2,3]:
				st.set_uv(Vector2(points[index].x,points[index].z))
				st.add_vertex(points[index])
	st.generate_normals()
	var mesh := MeshInstance3D.new()
	mesh.mesh = st.commit()
	var material := ShaderMaterial.new()
	material.shader = load("res://shaders/terrain.gdshader")
	for texture_kind in ["grass", "woodland", "gravel", "rock"]:
		material.set_shader_parameter(texture_kind + "_texture", load("res://terrain-textures/" + texture_kind + ".png"))
	material.set_shader_parameter("grass",false)
	material.set_shader_parameter("gravel_only",true)
	material.set_shader_parameter("base_colour",Color("aa9a80"))
	mesh.material_override = material
	add_child(mesh)
func update_equipment(actor: Node3D, equipment: Dictionary) -> void:
	actor.set_meta("equipment",equipment)
	var signature := JSON.stringify(equipment)
	if actor.get_meta("equipment_signature", "") == signature: return
	actor.set_meta("equipment_signature",signature)
	var skeleton := preload("res://scripts/rig.gd").find_skeleton(actor)
	if not skeleton: return
	for child in skeleton.get_children():
		if child is BoneAttachment3D and child.name.begins_with("Held"):
			skeleton.remove_child(child)
			child.queue_free()
	for slot in ["weapon","shield"]:
		var item := str(equipment.get(slot, ""))
		if item.is_empty() or item == "<null>": continue
		var bone := skeleton.find_bone("Hand.L" if slot == "weapon" else "Hand.R")
		if bone < 0: continue
		var attachment := BoneAttachment3D.new()
		attachment.name = "Held"+slot
		attachment.bone_idx = bone
		skeleton.add_child(attachment)
		var socket := Node3D.new()
		attachment.add_child(socket)
		# The wrist modifier supplies orientation; sockets remove only model scale
		# and the palm correction. Do not freeze an inverse animated hand rotation.
		var sizing := skeleton.global_basis.get_scale()
		socket.scale = Vector3(1/absf(sizing.x),1/absf(sizing.y),1/absf(sizing.z))
		socket.rotation.z = PI
		var model := held_item(item)
		if model:
			socket.add_child(model)

func held_item(item: String) -> Node3D:
	if "Pickaxe" in item or "Axe" in item:
		var source := load_template("bronze-pickaxe" if "Pickaxe" in item else "bronze-axe").instantiate() as Node3D
		var box := bounds(source,Transform3D.IDENTITY)
		var parts: Array = []
		collect_meshes(source,Transform3D.IDENTITY,parts)
		var grip_box := AABB()
		var found := false
		for part in parts:
			var points: PackedVector3Array = part.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
			for point in points:
				var p: Vector3 = part.transform*point
				if p.y<box.position.y+box.size.y*0.2:
					if not found: grip_box = AABB(p,Vector3.ZERO)
					else: grip_box = grip_box.expand(p)
					found = true
		var factor := 0.6/maxf(0.01,box.size.y)
		var centre := grip_box.get_center() if found else box.get_center()
		source.scale *= factor
		source.position = Vector3(-centre.x*factor,-box.position.y*factor-0.18,-centre.z*factor)
		var tool := Node3D.new()
		tool.add_child(source)
		if not item.begins_with("bronze"):
			tint(tool,Color("b5b9ba") if item.begins_with("iron") or item.begins_with("steel") else Color("b78148"))
		return tool
	var root := Node3D.new()
	if "Sword" in item:
		item_box(root,Vector3(0.05,0.49,0.025),Vector3(0,0.28,0),Color("b7804c"))
		item_box(root,Vector3(0.19,0.035,0.07),Vector3(0,0.02,0),Color("9a743e"))
		item_box(root,Vector3(0.04,0.14,0.04),Vector3(0,-0.065,0),Color("5e3d24"))
	elif "Shield" in item:
		item_box(root,Vector3(0.32,0.40,0.07),Vector3(0,0.03,0.06),Color("785334"))
		item_box(root,Vector3(0.035,0.40,0.08),Vector3(0,0.03,0.06),Color("c2a369"))
	elif "Bucket" in item:
		var bucket := MeshInstance3D.new()
		var cylinder := CylinderMesh.new()
		cylinder.top_radius = 0.13
		cylinder.bottom_radius = 0.09
		cylinder.height = 0.23
		bucket.mesh = cylinder
		bucket.position.y = -0.07
		var mat := StandardMaterial3D.new()
		mat.albedo_color = Color("929ca1") if "iron" in item else Color("896038")
		bucket.material_override = mat
		root.add_child(bucket)
		item_box(root,Vector3(0.25,0.025,0.025),Vector3(0,0.14,0),Color("5d5040"))
	elif item == "fishingRod" or item == "fishingNet":
		item_box(root,Vector3(0.025,0.8,0.025),Vector3(0,0.3,0),Color("926942"))
		if item == "fishingNet": item_box(root,Vector3(0.22,0.22,0.02),Vector3(0,0.7,0),Color("b7ab80"))
	else:
		item_box(root,Vector3(0.09,0.09,0.09),Vector3.ZERO,Color("947e57"))
	return root

func item_box(root: Node3D, size: Vector3, location: Vector3, colour: Color) -> void:
	var node := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = size
	node.mesh = box
	node.position = location
	var material := StandardMaterial3D.new()
	material.albedo_color = colour
	node.material_override = material
	root.add_child(node)


func set_pick_active(node: Node, enabled: bool) -> void:
	if node is StaticBody3D and node.has_meta("interact_id"):
		var layer := 2 if enabled else 0
		if node.collision_layer!=layer: node.collision_layer = layer
	for child in node.get_children(): set_pick_active(child,enabled)

func update_drops(drops: Array) -> void:
	var present := {}
	for drop in drops:
		var id := str(drop.id)
		present[id] = true
		if not ground_drops.has(id):
			var root := Node3D.new()
			add_child(root)
			root.position = Vector3(drop.x,player_height(drop.x,drop.y,drop)+0.03,drop.y)
			var item := str(drop.item)
			if item in ["ore","tin","iron","coal","zinc","nickel"]:
				var model := fitted("ore-cluster",0.18,0.30)
				root.add_child(model)
				tint(model,ore_colour(item))
			else:
				var model := MeshInstance3D.new()
				var cylinder := CylinderMesh.new()
				cylinder.top_radius = 0.10
				cylinder.bottom_radius = 0.10
				cylinder.height = 0.045 if item=="coins" else 0.30
				model.mesh = cylinder
				model.position.y = 0.04
				if item!="coins": model.rotation.z = PI/2
				var material := StandardMaterial3D.new()
				material.albedo_color = Color("d2b152") if item=="coins" else Color("e3dfcd") if item=="bones" else Color("88633d")
				model.material_override = material
				root.add_child(model)
			var label := Label3D.new()
			label.name = "ItemLabel"
			label.font_size = 22
			label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			label.position.y = 0.35
			root.add_child(label)
			add_pick_body(root,id,0.35,0.20)
			for child in root.get_children():
				if child is StaticBody3D: child.set_meta("command_type","pickup")
			ground_drops[id] = root
		var root: Node3D = ground_drops[id]
		root.get_node("ItemLabel").text = str(drop.item).capitalize()+" ×"+str(int(drop.get("quantity",1)))
	for id in ground_drops.keys():
		if not present.has(id):
			ground_drops[id].queue_free()
			ground_drops.erase(id)



func add_queue_rope(r: Dictionary) -> void:
	var a := Vector2(float(r.get("x1",r.get("x",0))),float(r.get("y1",r.get("y",0))))
	var b := Vector2(float(r.get("x2",r.get("x",0))),float(r.get("y2",r.get("y",0))))
	for building in document.get("buildings",[]):
		var rect := Rect2(Vector2(building.x-.5,building.y-.5),Vector2(building.width,building.height))
		if rect.has_point(a) and rect.has_point(b):
			var offset := Vector2(building.get("offsetX",0),building.get("offsetY",0))
			a += offset
			b += offset
			break
	for point in [a,b]:
		var post := MeshInstance3D.new()
		var cylinder := CylinderMesh.new()
		cylinder.top_radius = .045
		cylinder.bottom_radius = .06
		cylinder.height = .8
		post.mesh = cylinder
		var material := StandardMaterial3D.new()
		material.albedo_color = Color("b39a60")
		post.material_override = material
		post.position = Vector3(point.x,ground(point.x,point.y)+.4,point.y)
		add_child(post)
	var line := MeshInstance3D.new()
	var mesh := ImmediateMesh.new()
	var material := StandardMaterial3D.new()
	material.albedo_color = Color("952d3d")
	mesh.surface_begin(Mesh.PRIMITIVE_TRIANGLES,material)
	for i in range(16):
		var t := i/16.0
		var u := (i+1)/16.0
		var p := a.lerp(b,t)
		var q := a.lerp(b,u)
		var v := Vector3(p.x,ground(p.x,p.y)+.77-sin(t*PI)*.16,p.y)
		var w := Vector3(q.x,ground(q.x,q.y)+.77-sin(u*PI)*.16,q.y)
		for shift in [Vector3.UP*.035,Vector3((b-a).y,0,-(b-a).x).normalized()*.035]:
			for vertex in [v-shift,w-shift,w+shift,v-shift,w+shift,v+shift]: mesh.surface_add_vertex(vertex)
	mesh.surface_end()
	line.mesh = mesh
	add_child(line)

func add_gate_box(parent: Node3D, position: Vector3, size: Vector3, colour: Color) -> MeshInstance3D:
	var mesh := MeshInstance3D.new()
	var shape := BoxMesh.new()
	shape.size = size
	mesh.mesh = shape
	var material := StandardMaterial3D.new()
	material.albedo_color = colour
	mesh.material_override = material
	mesh.position = position
	parent.add_child(mesh)
	return mesh

func add_farm_gate(b: Dictionary) -> void:
	var root := Node3D.new()
	add_child(root)
	root.position = Vector3(b.x,ground(b.x,b.y),b.y)
	var horizontal := false
	for other in document.get("boundaries",[]):
		if other.y==b.y and absf(float(other.x)-float(b.x))==1: horizontal = true
	root.rotation.y = 0 if horizontal else PI/2
	for x in [-.5,.5]: add_gate_box(root,Vector3(x,.5,0),Vector3(.13,1,.13),Color("765638"))
	var leaf := Node3D.new()
	root.add_child(leaf)
	leaf.position.x = -.46
	for y in [.28,.54,.8]: add_gate_box(leaf,Vector3(.46,y,0),Vector3(.92,.11,.09),Color("b48b59"))
	for x in [.08,.84]: add_gate_box(leaf,Vector3(x,.54,0),Vector3(.09,.72,.1),Color("a78050"))
	var brace := add_gate_box(leaf,Vector3(.46,.54,0),Vector3(.86,.075,.11),Color("896240"))
	brace.rotation.z = .55
	add_gate_box(leaf,Vector3(.83,.6,.075),Vector3(.12,.07,.04),Color("4c504b"))
	var id := "gate:%d,%d" % [int(b.x),int(b.y)]
	gate_models[id] = {"pivot":leaf,"closed":0.0,"open":gate_states.get(id,false)}
	pickables[id] = {"x":b.x,"y":b.y,"kind":"gate","name":"Farm gate"}
	add_model_pick(root,id)

func update_gates(states: Array) -> void:
	for state in states: gate_states[str(state.id)] = bool(state.get("open",false))
	for gate in states:
		if gate_models.has(gate.id): gate_models[gate.id].open = gate.get("open",false)

func animate_gates(delta: float) -> void:
	for entry in gate_models.values():
		entry.pivot.rotation.y = lerp_angle(entry.pivot.rotation.y,float(entry.closed)+(-PI*.48 if entry.open else 0.0),1-exp(-delta*9))

# LODs share the original surface and materials; picking uses the full-detail mesh.
func optimize_meshes(node: Node) -> void:
	if node is MeshInstance3D and node.mesh is ArrayMesh:
		var source: ArrayMesh = node.mesh
		if source.get_surface_count()>0 and source.surface_get_array_len(0)>900:
			var importer := ImporterMesh.new()
			for i in range(source.get_surface_count()):
				importer.add_surface(source.surface_get_primitive_type(i),source.surface_get_arrays(i),[],{},source.surface_get_material(i))
			importer.generate_lods(25,60,[])
			node.mesh = importer.get_mesh()
			lod_meshes += 1
		node.visibility_range_end = 110
		node.visibility_range_end_margin = 8
	for child in node.get_children(): optimize_meshes(child)

func update_scenery(focus: Vector3, delta: float) -> void:
	scenery_clock += delta
	if scenery_clock<0.15: return
	scenery_clock = 0
	var began := Time.get_ticks_usec()
	var point := Vector2(focus.x,focus.z)
	# Hysteresis avoids rebuilding repeatedly near the load boundary.
	for id in resources.keys():
		var entry: Dictionary = resources[id]
		if entry.root.position.distance_squared_to(focus)>pow(detail_radius+35,2):
			entry.root.queue_free()
			resources.erase(id)
			pickables.erase(id)
			pending_resources.append(resource_documents[id])
	for id in streamed_buildings.keys():
		var entry: Dictionary = streamed_buildings[id]
		if building_centre(entry.document).distance_to(point)>detail_radius+55:
			var group: Node3D = entry.node
			roofs = roofs.filter(func(r): return not group.is_ancestor_of(r.node))
			furnace_lights = furnace_lights.filter(func(light): return not group.is_ancestor_of(light))
			for gate in gate_models.keys():
				if group.is_ancestor_of(gate_models[gate].pivot): gate_models.erase(gate); pickables.erase(gate)
			group.queue_free()
			streamed_buildings.erase(id)
			pending_buildings.append(entry.document)
	for i in range(pending_buildings.size()-1,-1,-1):
		if building_centre(pending_buildings[i]).distance_to(point)<detail_radius+20:
			add_building(pending_buildings[i])
			pending_buildings.remove_at(i)
			return # One complex building per update; resources wait until next update.
	for i in range(pending_resources.size()-1,-1,-1):
		var item: Dictionary = pending_resources[i]
		if Vector2(item.x-focus.x,item.y-focus.z).length()<detail_radius:
			add_resource(item)
			pending_resources.remove_at(i)
			if Time.get_ticks_usec()-began>2500: break
	for entry in resources.values():
		var visible_now: bool = entry.root.position.distance_squared_to(focus)<pow(detail_radius+10,2)
		if entry.root.visible!=visible_now:
			entry.root.visible = visible_now
			set_pick_active(entry.root,visible_now)
			if not entry.canopy.visible: set_pick_active(entry.canopy,false)

func apply_quality(quality: int) -> void:
	detail_radius = [65.0,90.0,115.0][clampi(quality,0,2)]
	for mist in find_children("*","GPUParticles3D",true,false): mist.emitting = quality>0
	for node in find_children("*","MultiMeshInstance3D",true,false):
		if not node.has_meta("default_range"): node.set_meta("default_range",node.visibility_range_end)
		node.visibility_range_end = float(node.get_meta("default_range"))*[0.65,1.0,1.3][clampi(quality,0,2)]

func animation_delta(actor: Node3D, focus: Vector3, delta: float) -> float:
	var key := actor.get_instance_id()
	var elapsed := float(animation_clocks.get(key,0))+delta
	animation_clocks[key] = elapsed
	var distance := actor.position.distance_to(focus)
	var interval := 0.0 if distance<25 else 0.067 if distance<55 else 0.25
	if elapsed<interval: return 0
	animation_clocks[key] = 0.0
	return minf(elapsed,0.3)

func add_resource(item: Dictionary) -> void:
	resource_documents[item.id] = item
	var kind: String = item.get("kind", "")
	var root := Node3D.new()
	add_child(root)
	root.position = Vector3(item.x, ground(item.x, item.y), item.y)
	if kind == "tree":
		var species: String = item.get("species", "oak")
		var tree := fitted(species + "-tree", 3.25 if species == "pine" else 2.9)
		if tree:
			root.add_child(tree)
			root.rotation.y = -deg_to_rad(float(item.get("rotation", hash(item.id) % 360)))
			root.position.y -= 0.045
			resources[item.id] = {"canopy": tree, "root": root}
			var stump_template := load_template(species + "-stump")
			var stump: Node3D = stump_template.instantiate() if stump_template else null
			if stump:
				# Stumps were exported at the original browser tree size already.
				var raw_tree := tree.get_child(0) as Node3D
				var raw_box := bounds(raw_tree,raw_tree.transform.affine_inverse())
				var original_scale := minf((2.9 if species=="pine" else 2.6)/raw_box.size.y,2.3/maxf(raw_box.size.x,raw_box.size.z))
				var growth := raw_tree.scale.x/original_scale
				stump.scale = Vector3.ONE*growth
				root.add_child(stump)
				stump.hide()
				resources[item.id]["stump"] = stump
	elif kind == "ore" or kind == "rock":
		var rock := fitted("mining-rock", 0.68, 0.95)
		var ore := fitted("ore-cluster", 0.36, 0.57)
		root.position.y -= 0.10
		if rock:
			root.add_child(rock)
		if ore:
			root.add_child(ore)
			ore.position.y = 0.50
			tint(ore, ore_colour(item.get("item", "copper")))
			resources[item.id] = {"canopy": ore, "root": root}
	pickables[item.id] = {"x": item.x, "y": item.y, "kind": kind, "name": item.get("name", item.get("item", kind))}
	add_model_pick(root,str(item.id))
	if resources.has(item.id):
		var entry: Dictionary = resources[item.id]
		var available: bool = resource_availability.get(item.id,item.get("available",true))
		resource_availability[item.id] = available
		entry.canopy.visible = available
		if entry.has("stump"): entry.stump.visible = not available
		set_pick_active(entry.canopy,available)

func add_occluders(node: Node) -> void:
	# Actual opaque triangles retain doors and windows; bounding boxes would seal them.
	if node is MeshInstance3D and node.mesh:
		var vertices := PackedVector3Array()
		var indices := PackedInt32Array()
		for surface in range(node.mesh.get_surface_count()):
			var material = node.get_active_material(surface)
			if not material is StandardMaterial3D or material.transparency!=BaseMaterial3D.TRANSPARENCY_DISABLED: continue
			var arrays: Array = node.mesh.surface_get_arrays(surface)
			var offset := vertices.size()
			vertices.append_array(arrays[Mesh.ARRAY_VERTEX])
			if arrays[Mesh.ARRAY_INDEX] and arrays[Mesh.ARRAY_INDEX].size()>0:
				for index in arrays[Mesh.ARRAY_INDEX]: indices.append(offset+index)
			else:
				for i in range(arrays[Mesh.ARRAY_VERTEX].size()): indices.append(offset+i)
		if vertices.size()>0:
			var shape := ArrayOccluder3D.new()
			shape.set_arrays(vertices,indices)
			var occluder := OccluderInstance3D.new()
			occluder.occluder = shape
			node.add_child(occluder)
	for child in node.get_children():
		if not child is OccluderInstance3D: add_occluders(child)

func add_water_mist(point: Vector3) -> void:
	var mist := GPUParticles3D.new()
	mist.position = point
	mist.amount = 12
	mist.lifetime = 1.2
	mist.visibility_aabb = AABB(Vector3(-1,-0.3,-1),Vector3(2,2,2))
	var process := ParticleProcessMaterial.new()
	process.direction = Vector3.UP
	process.spread = 55
	process.initial_velocity_min = 0.25
	process.initial_velocity_max = 0.6
	process.gravity = Vector3(0,-0.2,0)
	process.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	process.emission_box_extents = Vector3(0.4,0.04,0.2)
	mist.process_material = process
	var quad := QuadMesh.new()
	quad.size = Vector2(0.14,0.14)
	var material := StandardMaterial3D.new()
	material.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	material.albedo_color = Color(0.8,0.9,0.92,0.12)
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	quad.material = material
	mist.draw_pass_1 = quad
	mist.visibility_range_end = 40
	add_child(mist)

func update_lighting(players: Array, focus: Vector3, at: float) -> void:
	for light in furnace_lights:
		light.visible = light.position.distance_to(focus)<45
		var active := false
		for player in players:
			if player.get("action","")=="Smelting" and Vector2(player.x-light.position.x,player.y-light.position.z).length()<5: active = true; break
		light.light_energy = (0.75 if active else 0.16)*(0.95+0.05*sin(at*0.007))

func apply_resource_state(item: Dictionary) -> void:
	var available: bool = item.get("available",true)
	if resource_availability.has(item.id) and resource_availability[item.id]==available: return
	resource_availability[item.id] = available
	if not resources.has(item.id): return
	var entry: Dictionary = resources[item.id]
	entry.canopy.visible = available
	if entry.has("stump"): entry.stump.visible = not available
	set_pick_active(entry.canopy,available and entry.root.visible)

func apply_building_atlas(model: Node3D) -> void:
	for node in model.find_children("*","MeshInstance3D",true,false):
		for surface in range(node.mesh.get_surface_count()):
			var original=node.get_active_material(surface)
			if not original is StandardMaterial3D or not original.albedo_texture: continue
			var name:String=original.resource_name.to_lower()
			if not ("stone" in name or "plaster" in name): continue
			var material:=ShaderMaterial.new();material.shader=load("res://shaders/building_atlas.gdshader")
			material.set_shader_parameter("atlas",original.albedo_texture);material.set_shader_parameter("quadrant",Vector2.ZERO if "stone" in name else Vector2(0,.5))
			node.set_surface_override_material(surface,material)

func add_entrance_door(b: Dictionary,group: Node3D,model: Node3D) -> void:
	if not b.has("door") or b.get("model") in ["castleRampart","castleGatehouse","townFountain"]: return
	var template:=load_template("medieval-door")
	if not template: return
	var door:Node3D=template.instantiate();var pivot:=Node3D.new();group.add_child(pivot)
	var angle:float=deg_to_rad(float(b.get("rotation",0)))
	var swap:=int(b.get("rotation",0))%180!=0
	var w:float=b.height if swap else b.width;var h:float=b.width if swap else b.height
	var bank:bool=b.get("model") in ["medievalBank","medievalBankVault"]
	var fraction:=.25 if bank else .175 if b.get("model") in ["medievalCottage","medievalHouse","medievalWorkshop","medievalSmithy"] else -.175 if b.get("model")=="medievalTownhouse" else 0.0
	var offset:=Vector3(fraction*(w-.76),0,(-1 if bank else 1)*(h-.76)/2).rotated(Vector3.UP,-angle)
	var width:float=(w-.76)*(.2 if b.get("model") in ["cityCivicHall","cityTownhouse"] else .25 if bank else .2125)
	var right:=Vector3.RIGHT.rotated(Vector3.UP,-angle)
	pivot.position=model.position+offset-right*(-1 if bank else 1)*width/2
	pivot.rotation.y=-angle+(PI if bank else 0)
	pivot.add_child(door);door.position.x=width/2;door.scale.x=width
	var opening_height:float=2.55 if b.get("model") in ["cityCivicHall","cityTownhouse"] else 2.1 if bank else 1.552 if b.get("model")=="medievalHouse" else 1.96 if b.get("model") in ["medievalWorkshop","medievalSmithy"] else 1.8435
	door.scale.y=opening_height/2.3
	var id:="door:front:"+str(b.id)
	gate_models[id]={"pivot":pivot,"closed":pivot.rotation.y,"open":gate_states.get(id,false)}
	add_model_pick(door,id);pickables[id]={"x":b.door[0],"y":b.door[1],"kind":"gate","name":"Entrance door"}

func add_fountain_water(model: Node3D) -> void:
	for water in model.find_children("FountainWater","MeshInstance3D",true,false):
		var surface:=StandardMaterial3D.new();surface.albedo_color=Color("367d91");surface.roughness=.3;water.material_override=surface
	var drops:=CPUParticles3D.new();model.add_child(drops);drops.position=Vector3(0,2.08,0)
	drops.amount=55;drops.lifetime=1.15;drops.direction=Vector3.UP;drops.spread=18;drops.gravity=Vector3(0,-5,0);drops.initial_velocity_min=1.1;drops.initial_velocity_max=1.5
	var mesh:=SphereMesh.new();mesh.radius=.022;mesh.height=.06
	var material:=StandardMaterial3D.new();material.albedo_color=Color("6ebfd7");material.roughness=.2;material.emission_enabled=true;material.emission=Color("1e7288");mesh.material=material;drops.mesh=mesh;drops.cast_shadow=GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

extends Node3D
# Native navigation is constrained by server-authored terrain and blockers.
# It refines presentation only: destinations, timing and AI remain authoritative.
var world: Node3D
var map: RID
var cache: Dictionary = {}
var query_count := 0

func build(source: Node3D) -> void:
	world = source
	map = NavigationServer3D.map_create()
	NavigationServer3D.map_set_active(map,true)
	NavigationServer3D.map_set_cell_size(map,0.1)
	NavigationServer3D.map_set_use_edge_connections(map,false)
	var blocked := {}
	for key in ["nodes","stations","boundaries","npcs"]:
		for item in world.document.get(key,[]):
			if key=="npcs" and item.get("type") in ["cow","enemy"]: continue
			blocked[Vector2i(item.x,item.y)] = true
			if key=="boundaries" and item.get("tower",false):
				for dy in range(-1,2):
					for dx in range(-1,2): blocked[Vector2i(item.x+dx,item.y+dy)]=true
	for building in world.document.get("buildings",[]):
		var open := {}
		for point in building.get("open",[]): open[Vector2i(point[0],point[1])] = true
		for y in range(int(building.y),int(building.y+building.height)):
			for x in range(int(building.x),int(building.x+building.width)):
				if not open.has(Vector2i(x,y)): blocked[Vector2i(x,y)] = true
	var mesh := NavigationMesh.new()
	mesh.cell_size = 0.1
	var vertices := PackedVector3Array()
	var indices := {}
	for p in world.tiles:
		if blocked.has(p): continue
		var valid: bool = world.tiles[p] in ["grass","path","sand","floor","quarry","field"]
		for bridge in world.document.get("bridges",[]):
			var local: Vector2 = world.bridge_local(bridge,p.x,p.y)
			if absf(local.x)<=1.5 and absf(local.y)<0.5: valid = true
		if not valid: continue
		var polygon := PackedInt32Array()
		for corner in [Vector2(-0.5,-0.5),Vector2(-0.5,0.5),Vector2(0.5,0.5),Vector2(0.5,-0.5)]:
			var point := Vector3(p.x+corner.x,0,p.y+corner.y)
			point.y = world.ground(point.x,point.z)
			if not indices.has(point):
				indices[point] = vertices.size()
				vertices.append(point)
			polygon.append(indices[point])
		mesh.add_polygon(polygon)
	mesh.vertices = vertices
	var region := NavigationRegion3D.new()
	add_child(region)
	region.set_navigation_map(map)
	region.navigation_mesh = mesh
	# NavigationServer synchronization is asynchronous; the first map iteration
	# can contain the map itself before its mesh has been uploaded.
	if not vertices.is_empty():
		for frame in range(120):
			await get_tree().physics_frame
			if NavigationServer3D.map_get_iteration_id(map)>0 and NavigationServer3D.map_get_closest_point_owner(map,vertices[0]).is_valid(): break

func refine(state: Dictionary, at: float, fallback: Vector2) -> Vector2:
	if NavigationServer3D.map_get_iteration_id(map)==0: return fallback
	var motion = state.get("motion")
	if not motion is Dictionary: return fallback
	if at>float(motion.startedAt)+float(motion.duration): return fallback
	var id := str(state.get("id",""))
	var stamp := float(motion.startedAt)
	var from := Vector3(motion.fromX,world.ground(motion.fromX,motion.fromY),motion.fromY)
	var to := Vector3(motion.toX,world.ground(motion.toX,motion.toY),motion.toY)
	if not cache.has(id) or cache[id].stamp!=stamp:
		query_count += 1
		var path := NavigationServer3D.map_get_path(map,from,to,true)
		cache[id] = {"stamp":stamp,"path":path}
	var path: PackedVector3Array = cache[id].path
	if path.size()<2 or path[0].distance_to(from)>0.12 or path[-1].distance_to(to)>0.12: return fallback
	var total := 0.0
	for i in range(1,path.size()): total += Vector2(path[i].x-path[i-1].x,path[i].z-path[i-1].z).length()
	if total>Vector2(to.x-from.x,to.z-from.z).length()*1.15: return fallback
	var remaining := total*clampf((at-stamp)/maxf(float(motion.duration),1),0,1)
	for i in range(1,path.size()):
		var a := Vector2(path[i-1].x,path[i-1].z)
		var b := Vector2(path[i].x,path[i].z)
		var length := a.distance_to(b)
		if remaining<=length:
			var result := a.lerp(b,remaining/maxf(length,0.0001))
			return result if result.distance_to(fallback)<0.25 else fallback
		remaining -= length
	return fallback

func _exit_tree() -> void:
	if map.is_valid(): NavigationServer3D.free_rid(map)

extends RefCounted

static func find_skeleton(node: Node) -> Skeleton3D:
	if node is Skeleton3D:
		return node
	for child in node.get_children():
		var found := find_skeleton(child)
		if found:
			return found
	return null

static func prepare(actor: Node3D) -> void:
	if actor.has_meta("rig"):
		return
	var skeleton := find_skeleton(actor)
	var bones: Array = []
	if skeleton:
		for i in range(skeleton.get_bone_count()):
			var global_basis := skeleton.get_bone_global_pose(i).basis.orthonormalized()
			bones.append({"name": skeleton.get_bone_name(i).to_lower(), "rotation": skeleton.get_bone_pose_rotation(i), "axis": (global_basis.inverse() * Vector3.RIGHT).normalized(), "turn_axis":(global_basis.inverse()*Vector3.UP).normalized()})
	var rig := {"skeleton": skeleton, "bones": bones, "phase": 0.0, "weight": 0.0, "targets":[], "grip":null, "tree":null, "playback":null, "mode":"", "feet":[], "foot_ik":null}
	actor.set_meta("rig",rig)
	if skeleton:
		build_motion_tree(actor,rig)
		if actor.has_meta("terrain_world"): prepare_feet(actor,rig)
	if skeleton and skeleton.find_bone("UpperArm.L")>=0:
		var ik := TwoBoneIK3D.new()
		ik.name = "NativeArmIK"
		skeleton.add_child(ik)
		ik.setting_count = 2
		for i in range(2):
			var side := "L" if i==0 else "R"
			var target := Node3D.new()
			target.name = "HandTarget"+side
			actor.add_child(target)
			var hand := skeleton.find_bone("Hand."+side)
			target.global_position = skeleton.to_global(skeleton.get_bone_global_pose(hand).origin)
			var pole := Node3D.new()
			pole.name = "ElbowPole"+side
			actor.add_child(pole)
			pole.position = Vector3(0.8 if i==0 else -0.8,1.0,-0.35)
			ik.set_root_bone_name(i,"UpperArm."+side)
			ik.set_middle_bone_name(i,"Forearm."+side)
			ik.set_end_bone_name(i,"Hand."+side)
			ik.set_target_node(i,ik.get_path_to(target))
			ik.set_pole_node(i,ik.get_path_to(pole))
			ik.set_pole_direction_vector(i,Vector3.RIGHT)
			rig.targets.append(target)
		var grip := preload("res://scripts/grip_modifier.gd").new()
		grip.name = "NativeWristGrip"
		grip.actor = actor
		skeleton.add_child(grip)
		rig.grip = grip

static func animate(actor: Node3D, moving: bool, delta: float, speed := 1.0, state: Dictionary = {}, now := 0.0) -> void:
	prepare(actor)
	var rig: Dictionary = actor.get_meta("rig")
	var skeleton: Skeleton3D = rig.skeleton
	if not skeleton:
		return
	rig.phase += delta * 6.2 * speed
	rig.weight = lerpf(rig.weight, 1.0 if moving else 0.0, 1.0 - exp(-delta * 10.0))
	var stride: float = sin(rig.phase) * rig.weight
	var gathering: Dictionary = state.get("gathering") if state.get("gathering") is Dictionary else {}
	var attacking: bool = state.get("action", "") == "Fighting" or now-float(state.get("swingAt",-100000))>=0 and now-float(state.get("swingAt",-100000))<850
	var mode := "Walk" if moving else "Combat" if attacking else "Gather" if not gathering.is_empty() else "Idle"
	if moving and state.get("action","")=="Running": mode = "Run"
	if state.get("action","")=="Burying bones": mode = "Bury"
	if rig.mode!=mode:
		rig.playback.travel(mode)
		rig.mode = mode
	rig.tree.advance(delta * clampf(speed,0.65,1.25) if moving else delta)
	update_feet(actor,rig,delta)
	if rig.targets.size()==2:
		update_action_pose(actor, rig, state, now, delta, stride)

static func stroke(t: float) -> float:
	t = fposmod(t,1.0)
	return smoothstep(0,0.48,t) if t<0.48 else 1-smoothstep(0.48,0.70,t) if t<0.70 else 0.0

static func update_action_pose(actor: Node3D, rig: Dictionary, state: Dictionary, now: float, delta: float, stride: float) -> void:
	var equipment: Dictionary = state.get("equipment", actor.get_meta("equipment",{}))
	var held := str(equipment.get("weapon", ""))
	var has_item := held not in ["", "<null>"]
	var has_shield := equipment.get("shield") != null and str(equipment.get("shield","")) != ""
	var left := Vector3(0.24,0.59,0.12) if has_item else Vector3(0.27,0.43,0.025)
	var right := Vector3(-0.24,0.66,0.16) if has_shield else Vector3(-0.27,0.43,0.025)
	var axis := Vector3(0,0.72,0.69)
	var edge := Vector3(-0.85,-0.2,0.65) if "Axe" in held else Vector3.RIGHT
	left.z += stride*0.08
	right.z -= stride*0.12
	var gathering: Dictionary = state.get("gathering") if state.get("gathering") is Dictionary else {}
	var swing_age := now-float(state.get("swingAt",-100000))
	var combat: bool = state.get("action", "") == "Fighting" or swing_age>=0 and swing_age<850
	if not gathering.is_empty() and float(rig.weight)<0.2:
		if gathering.get("kind") == "tree":
			var s := stroke(now/1250.0)
			left = Vector3(0.12,0.66,0.32).lerp(Vector3(0.40,0.88,-0.10),s)
			right = Vector3(-0.16,0.66,0.15).lerp(Vector3(-0.12,0.72,0.21),s)
			axis = Vector3(-0.34,0.50,0.80).lerp(Vector3(0.35,0.82,-0.45),s)
			edge = Vector3(-0.85,-0.2,0.65)
		elif gathering.get("kind") == "fishing":
			left = Vector3(0.20,0.68,0.28)
			right = Vector3(-0.15,0.64,0.23)
			axis = Vector3(0,0.5,0.86)
		else:
			var s := stroke(now/1450.0)
			left = Vector3(0.10,0.65,0.34).lerp(Vector3(0.12,1.0,0.28),s)
			axis = Vector3(0,-0.12,0.99).lerp(Vector3(0,0.97,0.24),s)
			right = left-axis.normalized()*0.12
	elif combat and float(rig.weight)<0.2:
		var t := clampf(swing_age/760.0,0,1)
		var s := smoothstep(0,0.26,t) if t<0.26 else 1-smoothstep(0.26,0.51,t) if t<0.51 else 0.0
		left = Vector3(0.22,0.75,0.21).lerp(Vector3(0.17,0.73,0.58),s)
		right = Vector3(-0.21,0.76,0.24) if has_shield else Vector3(-0.18,0.77,0.26)
		axis = Vector3(0.1,0.88,0.46).lerp(Vector3(0.05,0.25,0.97),s)
		if has_item:
			left = Vector3(0.3,0.9,-0.18).lerp(Vector3(0.08,0.65,0.58),s)
	var blend := 1-exp(-delta*18)
	for i in range(2):
		var target: Node3D = rig.targets[i]
		target.position = target.position.lerp((left if i==0 else right)*1.54,blend)
	var y := axis.normalized()
	var x := (edge-y*edge.dot(y)).normalized()
	var grip = rig.grip
	var desired := Basis(x,y,x.cross(y).normalized())
	grip.desired_basis = Basis(grip.desired_basis.get_rotation_quaternion().slerp(desired.get_rotation_quaternion(),blend))
	grip.left_grip = has_item
	grip.right_grip = has_shield
	actor.set_meta("animation_mode","gathering" if not gathering.is_empty() else "combat" if combat else "walk" if float(rig.weight)>0.2 else "idle")

static func find_animation(node: Node) -> AnimationPlayer:
	if node is AnimationPlayer:
		return node
	for child in node.get_children():
		var found := find_animation(child)
		if found:
			return found
	return null

static func animate_cow(actor: Node3D, moving: bool, delta := -1.0) -> void:
	var animator := find_animation(actor)
	if not animator:
		return
	if delta>=0: animator.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	var desired := "Walk" if moving else "Idle"
	for clip in animator.get_animation_list():
		if str(clip).get_file().to_lower() == desired.to_lower():
			if animator.current_animation != clip:
				animator.get_animation(clip).loop_mode = Animation.LOOP_LINEAR
				animator.play(clip, 0.22)
			if delta>0: animator.advance(delta)
			return


# Native state-machine crossfades preserve imported bind rotations.
static func build_motion_tree(actor: Node3D, rig: Dictionary) -> void:
	var player := AnimationPlayer.new()
	player.name = "BodyMotionLibrary"
	actor.add_child(player)
	var library := AnimationLibrary.new()
	var machine := AnimationNodeStateMachine.new()
	var modes := ["Idle","Walk","Run","Gather","Combat","Bury"]
	for mode in modes:
		var clip := Animation.new()
		clip.length = 4.0 if mode=="Idle" else 1.02 if mode=="Walk" else 0.74 if mode=="Run" else 1.25 if mode=="Gather" else 1.5 if mode=="Bury" else 0.85
		clip.loop_mode = Animation.LOOP_LINEAR
		for i in range(rig.bones.size()):
			var bone: Dictionary = rig.bones[i]
			var track := clip.add_track(Animation.TYPE_ROTATION_3D)
			clip.track_set_path(track,NodePath(str(actor.get_path_to(rig.skeleton))+":"+rig.skeleton.get_bone_name(i)))
			for frame in range(25):
				var phase := TAU*frame/24.0
				var side := 1.0 if bone.name.ends_with("l") else -1.0
				var angle := 0.0
				var turn := 0.0
				if mode in ["Walk","Run"]:
					var stride := sin(phase)*side
					if "thigh" in bone.name: angle = stride*(0.42 if mode=="Walk" else 0.47)
					elif "shin" in bone.name: angle = maxf(0,-stride)*0.55
					elif "foot" in bone.name: angle = -maxf(0,-stride)*0.16
					elif "upperarm" in bone.name: angle = -stride*0.20
					elif "chest" in bone.name: turn = -stride*0.035
				elif mode=="Bury":
					if "chest" in bone.name: angle = (1-cos(phase))*0.22
					elif "shin" in bone.name: angle = (1-cos(phase))*0.20
				elif "chest" in bone.name:
					angle = sin(phase)*0.014 if mode=="Idle" else 0.08
					turn = sin(phase)*0.075 if mode!="Idle" else 0.0
				elif "upperarm" in bone.name and mode=="Idle": angle = sin(phase)*side*0.012
				elif "head" in bone.name and mode=="Idle": turn = sin(phase)*0.015
				elif "shin" in bone.name and mode!="Idle": angle = 0.10
				clip.rotation_track_insert_key(track,clip.length*frame/24.0,(bone.rotation*Quaternion(bone.axis,angle)*Quaternion(bone.turn_axis,turn)).normalized())
		library.add_animation(mode,clip)
		var node := AnimationNodeAnimation.new()
		node.animation = mode
		machine.add_node(mode,node)
	for source in modes:
		for target in modes:
			if source==target: continue
			var transition := AnimationNodeStateMachineTransition.new()
			transition.xfade_time = 0.20
			machine.add_transition(source,target,transition)
	player.add_animation_library("",library)
	var tree := AnimationTree.new()
	tree.name = "NativeBodyAnimation"
	actor.add_child(tree)
	tree.anim_player = tree.get_path_to(player)
	tree.tree_root = machine
	tree.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	tree.active = true
	rig.tree = tree
	rig.playback = tree.get("parameters/playback")
	rig.playback.start("Idle")

static func prepare_feet(actor: Node3D, rig: Dictionary) -> void:
	var skeleton: Skeleton3D = rig.skeleton
	if skeleton.find_bone("Thigh.L")<0: return
	var ik := TwoBoneIK3D.new()
	ik.name = "NativeTerrainFootIK"
	skeleton.add_child(ik)
	ik.setting_count = 2
	for i in range(2):
		var side := "L" if i==0 else "R"
		var bone := skeleton.find_bone("Foot."+side)
		var target := Node3D.new()
		actor.add_child(target)
		var position := skeleton.to_global(skeleton.get_bone_global_pose(bone).origin)
		target.global_position = position
		var clearance := actor.to_local(position).y
		var pole := Node3D.new()
		actor.add_child(pole)
		pole.position = Vector3(0.12 if i==0 else -0.12,0.8,0.8)
		ik.set_root_bone_name(i,"Thigh."+side)
		ik.set_middle_bone_name(i,"Shin."+side)
		ik.set_end_bone_name(i,"Foot."+side)
		ik.set_target_node(i,ik.get_path_to(target))
		ik.set_pole_node(i,ik.get_path_to(pole))
		ik.set_pole_direction_vector(i,Vector3.RIGHT)
		rig.feet.append({"bone":bone,"target":target,"clearance":clearance})
	rig.foot_ik = ik

static func update_feet(actor: Node3D, rig: Dictionary, delta: float) -> void:
	if rig.feet.is_empty(): return
	var world = actor.get_meta("terrain_world")
	for foot in rig.feet:
		var pose: Transform3D = rig.skeleton.global_transform*rig.skeleton.get_bone_global_pose(foot.bone)
		var base: float = world.player_height(pose.origin.x,pose.origin.z,actor.get_meta("floor_state",{}))
		var difference := clampf(base-actor.global_position.y,-0.22,0.22)
		# Retain the animated swing height and limit reach on steep ledges.
		pose.origin.y += difference
		foot.target.global_transform = pose

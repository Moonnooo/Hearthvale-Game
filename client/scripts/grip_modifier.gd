extends SkeletonModifier3D

var actor: Node3D
var desired_basis := Basis.IDENTITY
var left_grip := false
var right_grip := false

func _process_modification() -> void:
	var skeleton := get_skeleton()
	if not skeleton or not is_instance_valid(actor): return
	# Preserve the skin's wrist pose. Align the prop socket after native arm IK.
	for child in skeleton.get_children():
		if not child is BoneAttachment3D or not child.name.begins_with("Held") or child.get_child_count()==0: continue
		var pose := skeleton.get_bone_global_pose(child.bone_idx)
		var wrist_world := skeleton.global_basis * pose.basis
		var target := actor.global_basis.orthonormalized() * (desired_basis if child.name=="Heldweapon" else Basis.IDENTITY)
		child.get_child(0).basis = wrist_world.inverse() * target

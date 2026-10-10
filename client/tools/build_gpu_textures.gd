extends SceneTree
func _initialize(): call_deferred("build")
func build():
	DirAccess.make_dir_recursive_absolute("res://gpu-textures")
	var index := {"_source_hashes":{}}
	var seen := {}
	var unique := 0
	var original_bytes := 0
	var compressed_bytes := 0
	var slots := [BaseMaterial3D.TEXTURE_ALBEDO,BaseMaterial3D.TEXTURE_METALLIC,BaseMaterial3D.TEXTURE_ROUGHNESS,BaseMaterial3D.TEXTURE_NORMAL,BaseMaterial3D.TEXTURE_AMBIENT_OCCLUSION,BaseMaterial3D.TEXTURE_EMISSION]
	for file in DirAccess.get_files_at("res://assets/models"):
		if not file.ends_with(".glb"): continue
		var gltf := GLTFDocument.new()
		var state := GLTFState.new()
		assert(gltf.append_from_file("res://assets/models/"+file,state)==OK)
		var mappings := {}
		var materials := state.get_materials()
		for i in range(materials.size()):
			var material := materials[i] as StandardMaterial3D
			if not material: continue
			for slot in slots:
				var texture := material.get_texture(slot)
				if not texture: continue
				var image := texture.get_image()
				if not image or image.get_width()<256: continue
				var mode := Image.COMPRESS_SOURCE_NORMAL if slot==BaseMaterial3D.TEXTURE_NORMAL else Image.COMPRESS_SOURCE_SRGB if slot in [BaseMaterial3D.TEXTURE_ALBEDO,BaseMaterial3D.TEXTURE_EMISSION] else Image.COMPRESS_SOURCE_GENERIC
				var hash := HashingContext.new()
				hash.start(HashingContext.HASH_SHA256)
				hash.update(image.get_data())
				var key := hash.finish().hex_encode()+"-"+str(mode)
				var path := "res://gpu-textures/"+key+".res"
				original_bytes += image.get_data_size()
				if not seen.has(key):
					seen[key] = true
					if image.is_compressed(): assert(image.decompress()==OK)
					if not image.has_mipmaps(): assert(image.generate_mipmaps(mode==Image.COMPRESS_SOURCE_NORMAL)==OK)
					assert(image.compress(Image.COMPRESS_S3TC,mode)==OK)
					assert(image.is_compressed())
					compressed_bytes += image.get_data_size()
					assert(ResourceSaver.save(ImageTexture.create_from_image(image),path,ResourceSaver.FLAG_COMPRESS)==OK)
					unique += 1
				mappings[str(i)+":"+str(slot)] = path
		index[file.trim_suffix(".glb")] = mappings
		index._source_hashes[file.trim_suffix(".glb")] = FileAccess.get_sha256("res://assets/models/"+file)
		print("GPU_TEXTURE_BUILD ",file," unique=",unique)
		await process_frame
	var handle := FileAccess.open("res://gpu-textures/index.json",FileAccess.WRITE)
	handle.store_string(JSON.stringify(index))
	print("GPU_TEXTURE_TOTAL ",JSON.stringify({"unique":unique,"originalMiB":original_bytes/1048576.0,"compressedUniqueMiB":compressed_bytes/1048576.0}))
	quit()

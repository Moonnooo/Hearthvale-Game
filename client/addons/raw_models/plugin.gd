@tool
extends EditorPlugin
var exporter: EditorExportPlugin

class ModelExport extends EditorExportPlugin:
	func _get_name() -> String:
		return "HearthvaleModels"
	func _export_begin(_features: PackedStringArray, _is_debug: bool, _path: String, _flags: int) -> void:
		var files := DirAccess.get_files_at("res://assets/models")
		var count := 0
		for file in files:
			if file.ends_with(".glb"):
				var path := "res://assets/models/" + file
				add_file(path, FileAccess.get_file_as_bytes(path), false)
				count += 1
		print("Bundled native model assets: ", count)

func _enter_tree() -> void:
	exporter = ModelExport.new()
	add_export_plugin(exporter)

func _exit_tree() -> void:
	remove_export_plugin(exporter)

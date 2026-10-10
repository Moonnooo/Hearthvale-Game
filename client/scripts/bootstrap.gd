extends Node
func _ready() -> void:
 if OS.has_feature("world_editor") or "--editor-app" in OS.get_cmdline_user_args():
  add_child(load("res://scripts/editor_app.gd").new())
 else:
  add_child(load("res://scripts/main.gd").new())

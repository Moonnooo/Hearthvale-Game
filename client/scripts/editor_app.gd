extends Control
const Document=preload("res://scripts/editor_document.gd")
const Canvas=preload("res://scripts/editor_canvas.gd")
var doc=Document.new()
var server=preload("res://scripts/server.gd").new()
var canvas
var status: Label
var coords: Label
var inspector: VBoxContainer
var region_menu: OptionButton
var variant: OptionButton
var login_panel: Control
var username: LineEdit
var password: LineEdit
var selection: Array=[]
var clipboard: Array=[]
var tool:="select"
var brush_size:=3
var height_step:=.5
var height_target:=0.0
var show_heights:=false
var show_names:=false
var edit_water:=false
var closing:=false
var region_id:=""
var revision:=""
var draft_version:=0
var saved_serial:=0
var saving:=false
var conflict:=false
var can_publish:=false
var autosave: Timer
var json_editor: TextEdit
var preview_panel: Control
var preview_world
var preview_camera: Camera3D
var preview_focus:=Vector3.ZERO
var preview_yaw:=.6
var preview_pitch:=.75
var preview_distance:=24.0
var preview_pan:=false
var preview_floor:=-1
var floor_picker:OptionButton
var preview_busy:=false
var building_model:="medievalCottage"
var object_type:="oak"
var file_dialog: FileDialog
const MODELS=["castleRampart","castleGatehouse","townFountain","cityTownhouse","cityCivicHall","medievalCottage","medievalTownhouse","medievalStorehouse","medievalChapel","medievalWatchtower","medievalCookhouse","medievalMilitary","medievalMill","medievalHouse","medievalWorkshop","medievalSmithy","medievalBank","medievalBankVault"]
func button(parent: Node,text: String,action: Callable) -> Button:
 var b:=Button.new();b.text=text;b.pressed.connect(action);parent.add_child(b);return b
func label(parent: Node,text: String) -> Label:
 var l:=Label.new();l.text=text;l.autowrap_mode=TextServer.AUTOWRAP_WORD_SMART if parent==inspector else TextServer.AUTOWRAP_OFF;parent.add_child(l);return l
func _ready() -> void:
 set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
 DisplayServer.window_set_title("Hearthvale · World Studio")
 add_child(server);server.session_path="user://editor-session.cfg"
 var theme:=Theme.new();theme.default_font_size=15
 var style:=StyleBoxFlat.new();style.bg_color=Color("25333b");style.border_color=Color("587484");style.set_border_width_all(1);style.set_corner_radius_all(5);style.set_content_margin_all(8)
 theme.set_stylebox("normal","Button",style);theme.set_stylebox("normal","LineEdit",style);theme.set_color("font_color","Label",Color("dce6e8"));self.theme=theme
 var bg:=ColorRect.new();bg.color=Color("15232a");bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);add_child(bg)
 var margin:=MarginContainer.new();margin.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);margin.add_theme_constant_override("margin_left",12);margin.add_theme_constant_override("margin_right",12);margin.add_theme_constant_override("margin_top",10);margin.add_theme_constant_override("margin_bottom",10);add_child(margin)
 var root:=VBoxContainer.new();margin.add_child(root)
 var bar:=HBoxContainer.new();root.add_child(bar)
 label(bar,"WORLD STUDIO")
 button(bar,"Save draft",save_draft)
 button(bar,"Check",validate_world)
 button(bar,"Publish…",confirm_publish)
 button(bar,"Reload…",confirm_reload)
 button(bar,"Export backup",export_backup)
 button(bar,"Import…",import_backup)
 button(bar,"3D preview",open_preview)
 button(bar,"Undo",undo)
 button(bar,"Redo",redo)
 var body:=HSplitContainer.new();body.size_flags_vertical=Control.SIZE_EXPAND_FILL;root.add_child(body)
 var left:=VBoxContainer.new();left.custom_minimum_size.x=195;body.add_child(left)
 label(left,"REGION")
 region_menu=OptionButton.new();left.add_child(region_menu);region_menu.item_selected.connect(func(i): region_id=doc.world.regions[i].id;canvas.fit_region(doc.world.regions[i]))
 var region_buttons:=HBoxContainer.new();left.add_child(region_buttons)
 button(region_buttons,"Add…",add_region_dialog);button(region_buttons,"Remove…",remove_region_dialog)
 button(left,"Rename region…",rename_region)
 var scroll:=ScrollContainer.new();scroll.size_flags_vertical=Control.SIZE_EXPAND_FILL;left.add_child(scroll)
 var toolbox:=VBoxContainer.new();toolbox.size_flags_horizontal=Control.SIZE_EXPAND_FILL;scroll.add_child(toolbox)
 for category in [{"Edit":["select","borders","areas","spawn","erase"]},{"Terrain":["grass","path","dirt","water","field","quarry","raise","lower","smooth","flatten"]},{"Objects":["tree","rock","fishing","npc","building","fence","romanWall","gate","bridge","anvil","furnace","workbench"]}]:
  for name in category:
   label(toolbox,str(name).to_upper())
   var grid:=GridContainer.new();grid.columns=2;toolbox.add_child(grid)
   for value in category[name]: button(grid,str(value).capitalize(),choose_tool.bind(value))
 label(left,"Placement type")
 variant=OptionButton.new();left.add_child(variant);variant.item_selected.connect(func(i): object_type=variant.get_item_text(i);if tool=="building": building_model=object_type)
 var brush:=SpinBox.new();brush.min_value=1;brush.max_value=15;brush.step=2;brush.value=3;brush.prefix="Brush ";left.add_child(brush);brush.value_changed.connect(func(v): brush_size=int(v);canvas.queue_redraw())
 var strength:=SpinBox.new();strength.min_value=.1;strength.max_value=5;strength.step=.1;strength.value=.5;strength.prefix="Height step ";left.add_child(strength);strength.value_changed.connect(func(v): height_step=v)
 var target:=SpinBox.new();target.min_value=-20;target.max_value=20;target.step=.1;target.prefix="Flatten to ";left.add_child(target);target.value_changed.connect(func(v): height_target=v)
 var water_toggle:=CheckBox.new();water_toggle.text="Edit water height";left.add_child(water_toggle);water_toggle.toggled.connect(func(v): edit_water=v)
 for name in ["Terrain heights","Tree names"]:
  var toggle:=CheckBox.new();toggle.text=name;left.add_child(toggle)
  if name=="Terrain heights": toggle.toggled.connect(func(v): show_heights=v;canvas.queue_redraw())
  else: toggle.toggled.connect(func(v): show_names=v;canvas.queue_redraw())
 canvas=Canvas.new();canvas.app=self;canvas.size_flags_horizontal=Control.SIZE_EXPAND_FILL;body.add_child(canvas)
 var right_scroll:=ScrollContainer.new();right_scroll.custom_minimum_size.x=310;right_scroll.horizontal_scroll_mode=ScrollContainer.SCROLL_MODE_DISABLED;body.add_child(right_scroll)
 inspector=VBoxContainer.new();inspector.size_flags_horizontal=Control.SIZE_EXPAND_FILL;right_scroll.add_child(inspector)
 var footer:=HBoxContainer.new();root.add_child(footer);status=label(footer,"Sign in to load your database draft.");status.size_flags_horizontal=Control.SIZE_EXPAND_FILL;coords=label(footer,"0, 0");coords.custom_minimum_size.x=120
 label(root,"Right-drag / arrows: pan    Wheel: zoom    Shift: multi-select / box / snap    Ctrl C/V: copy/paste    R: rotate    Delete: remove    Ctrl Z/Y: undo/redo")
 autosave=Timer.new();autosave.one_shot=true;autosave.wait_time=2;autosave.timeout.connect(save_draft);add_child(autosave)
 choose_tool("select");inspect();show_login()
 get_tree().auto_accept_quit=false
 if "--editor-smoke" in OS.get_cmdline_user_args():
  print("WORLD_STUDIO_READY native_canvas=1 database_version_checks=1")
  return
 if "--editor-package-smoke" in OS.get_cmdline_user_args():
  assert(OS.has_feature("world_editor"))
  assert(JSON.parse_string(FileAccess.get_file_as_string("res://editor-catalog.json")) is Dictionary)
  print("WORLD_STUDIO_PACKAGE_PASS native_canvas=1 standalone_editor=1 catalog=1")
  await get_tree().create_timer(2).timeout
  await RenderingServer.frame_post_draw
  get_viewport().get_texture().get_image().save_png(ProjectSettings.globalize_path("user://editor-launcher-smoke.png"))
  get_tree().quit();return
 var session:Dictionary=await server.restore_session()
 if session.get("character") is Dictionary: await load_draft()
func say(text: String) -> void: status.text=text
func show_login() -> void:
 login_panel=PanelContainer.new();login_panel.set_anchors_and_offsets_preset(Control.PRESET_CENTER);login_panel.position=Vector2(-215,-130);login_panel.custom_minimum_size=Vector2(430,260);add_child(login_panel)
 var box:=VBoxContainer.new();login_panel.add_child(box);label(box,"Sign in to Hearthvale World Studio")
 label(box,"Uses your existing account and database draft.")
 username=LineEdit.new();username.placeholder_text="Username";box.add_child(username)
 password=LineEdit.new();password.placeholder_text="Password";password.secret=true;box.add_child(password)
 button(box,"Sign in",login);password.text_submitted.connect(func(_t): login())
func login() -> void:
 say("Signing in…")
 var result:Dictionary=await server.request("/api/login",HTTPClient.METHOD_POST,{"username":username.text,"password":password.text})
 password.text=""
 if result.has("error"): say(result.error);return
 await server.remember_session();await load_draft()
func load_draft() -> void:
 say("Loading account database draft…")
 var result:Dictionary=await server.request("/api/editor/world")
 if result.has("error"): say(result.error);return
 var draft:Dictionary=result.get("draft",{}) if result.get("draft") is Dictionary else {}
 doc.world=draft.get("world",result.world).duplicate(true)
 revision=str(draft.get("revision",result.revision));draft_version=int(draft.get("version",0));can_publish=result.get("canPublish",false)
 doc.undo_stack.clear();doc.redo_stack.clear();doc.changed();saved_serial=doc.serial;conflict=false;selection=[]
 region_id=doc.world.regions[0].id;refresh_regions();canvas.fit_region(doc.world.regions[0]);inspect()
 if is_instance_valid(login_panel): login_panel.queue_free()
 say("Database draft loaded · "+str(result.username)+" · version "+str(draft_version))
func edited() -> void:
 doc.changed();canvas.queue_redraw();autosave.start();say("Unsaved draft changes…")
func save_draft() -> void:
 if doc.world.is_empty() or saving or conflict or saved_serial==doc.serial: return
 saving=true;var captured:int=doc.serial
 say("Saving database draft…")
 var result:Dictionary=await server.request("/api/editor/draft",HTTPClient.METHOD_POST,{"world":doc.world.duplicate(true),"revision":revision,"version":draft_version})
 saving=false
 if result.has("error"):
  conflict=result.get("_status",0)==409
  say(str(result.error)+(" Export a backup before reloading. Your edits remain here." if conflict else " Your edits remain here; click Save to retry."));return
 draft_version=int(result.version);saved_serial=captured
 say("Draft saved to database · version "+str(draft_version))
 if doc.serial!=saved_serial: autosave.start()
func validate_world() -> void:
 if doc.world.is_empty(): return
 say("Checking paths, terrain and objects…")
 var result:Dictionary=await server.request("/api/editor/validate",HTTPClient.METHOD_POST,{"world":doc.world.duplicate(true)})
 say(str(result.get("error",result.get("message","Checked."))))
func confirm_dialog(title: String,text: String,action: Callable) -> void:
 var dialog:=ConfirmationDialog.new();dialog.title=title;dialog.dialog_text=text;add_child(dialog);dialog.confirmed.connect(action);dialog.canceled.connect(dialog.queue_free);dialog.confirmed.connect(dialog.queue_free);dialog.popup_centered(Vector2i(540,200))
func confirm_publish() -> void:
 if not can_publish: say("Only appointed world administrators can publish.");return
 confirm_dialog("Publish live world?","This replaces the published map and reloads connected players. Your draft will be saved and validated first.",publish)
func publish() -> void:
 await save_draft()
 if saving or conflict or saved_serial!=doc.serial: say("Save your draft successfully before publishing.");return
 var result:Dictionary=await server.request("/api/editor/publish",HTTPClient.METHOD_POST,{"world":doc.world.duplicate(true),"revision":revision,"draftVersion":draft_version})
 if result.has("error"): say(result.error);return
 revision=result.revision;draft_version=int(result.draftVersion);say("World published.")
func confirm_reload() -> void:
 confirm_dialog("Reload database draft?","Unsaved local edits will be discarded. Export a backup first if you need them.",load_draft)
func refresh_regions() -> void:
 region_menu.clear()
 for r in doc.world.get("regions",[]):
  region_menu.add_item(r.name)
  if r.id==region_id: region_menu.select(region_menu.item_count-1)
 canvas.queue_redraw()
func current_region() -> Dictionary:
 for r in doc.world.get("regions",[]):
  if r.id==region_id: return r
 return {}
func choose_tool(value: String) -> void:
 tool=value;variant.clear()
 var values:Array=[]
 match tool:
  "tree": values=["oak","pine"]
  "rock": values=["copperOre","tinOre","ironOre","coal","zincOre","silverOre","goldOre","mithrilOre","adamantiteOre","runiteOre"]
  "npc": values=["resident","guide","banker","enemy","cow","merchant","smith","smelter","portmaster","mage"]
  "fishing": values=["net","rod"]
  "building": values=MODELS
 for v in values: variant.add_item(v)
 if not values.is_empty(): object_type=values[0]
 canvas.queue_redraw()
func selected_object() -> Dictionary:
 if selection.size()!=1: return {}
 var ref=selection[0];return doc.world[ref.collection][ref.index]
func inspect() -> void:
 for child in inspector.get_children(): child.queue_free()
 label(inspector,"INSPECTOR · "+str(selection.size())+" selected")
 if selection.is_empty(): label(inspector,"Select an object or edit an area border.");return
 var row:=HBoxContainer.new();inspector.add_child(row);button(row,"Rotate 90°",rotate_selection);button(row,"Delete",delete_selection)
 if selection.size()!=1: return
 var n=selected_object()
 if selection[0].collection=="buildings":
  if not n.has("offsetX"): n.offsetX=0
  if not n.has("offsetY"): n.offsetY=0
 if selection[0].collection=="buildings": furnishings_inspector(n)
 label(inspector,str(n.get("name",n.get("type",n.get("id","Object")))))
 for key in ["name","type","model","species","item","tool","dialogue","combatZone"]:
  if not n.has(key): continue
  label(inspector,key.capitalize())
  var field:=LineEdit.new();field.text=str(n[key]);inspector.add_child(field)
  field.text_submitted.connect(func(value): doc.checkpoint();n[key]=value;edited();inspect())
 for key in ["x","y","width","height","offsetX","offsetY","combatLevel"]:
  if not n.has(key): continue
  var spin:=SpinBox.new();spin.min_value=-2048;spin.max_value=2048;spin.step=.1 if key in ["offsetX","offsetY","x","y"] else 1;spin.value=float(n[key]);spin.prefix=key+" ";inspector.add_child(spin)
  spin.value_changed.connect(func(value):
   doc.checkpoint()
   if key in ["x","y"]:
    var delta:=Vector2(value-float(n[key]),0) if key=="x" else Vector2(0,value-float(n[key]));doc.translate(n,delta,selection[0].collection)
   else:
    n[key]=value
    if key in ["width","height"] and selection[0].collection=="buildings": doc.floor_plan(n)
   edited())
 label(inspector,"Complete properties / furnishings (JSON)")
 json_editor=TextEdit.new();json_editor.custom_minimum_size=Vector2(260,260);json_editor.text=JSON.stringify(n,"  ");inspector.add_child(json_editor)
 button(inspector,"Apply properties",apply_properties)
func apply_properties() -> void:
 var parsed=JSON.parse_string(json_editor.text)
 if not parsed is Dictionary: say("Invalid JSON; properties unchanged.");return
 if selection[0].collection=="regions": say("Region borders are fixed squares.");return
 doc.checkpoint();var ref=selection[0];doc.world[ref.collection][ref.index]=parsed;edited();inspect()
func paint(p: Vector2) -> void:
 var r=doc.region_at(p)
 if r.is_empty(): say("Choose a tile inside a region.");return
 if tool in ["grass","path","dirt","water","field","quarry","raise","lower","smooth","flatten"]:
  var radius:int=brush_size/2
  var height_key:="waterLevels" if edit_water else "heights"
  var old:Dictionary=r.get(height_key,{}).duplicate()
  for y in range(int(p.y)-radius,int(p.y)+radius+1):
   for x in range(int(p.x)-radius,int(p.x)+radius+1):
    var region=doc.region_at(Vector2(x,y))
    if region.is_empty(): continue
    var key:=str(x-int(region.x))+","+str(y-int(region.y))
    if not region.has(height_key): region[height_key]={}
    var h:float=region[height_key].get(key,0)
    match tool:
     "raise": region[height_key][key]=clampf(h+height_step,-20,20)
     "lower": region[height_key][key]=clampf(h-height_step,-20,20)
     "flatten": region[height_key][key]=height_target
     "smooth":
      var sum:=0.0;var count:=0
      for yy in range(y-1,y+2):
       for xx in range(x-1,x+2):
        var rr=doc.region_at(Vector2(xx,yy))
        if rr.is_empty(): continue
        var heights:Dictionary=old if rr==r else rr.get(height_key,{})
        sum+=float(heights.get(str(xx-int(rr.x))+","+str(yy-int(rr.y)),0));count+=1
      region[height_key][key]=snappedf(sum/maxi(1,count),.1)
     _:
      region.tiles[key]="path" if tool=="dirt" else tool
      if not region.has("pathMaterials"): region.pathMaterials={}
      if tool=="dirt": region.pathMaterials[key]="dirt"
      else: region.pathMaterials.erase(key)
 elif tool=="erase":
  var ref=doc.hit(p)
  if not ref.is_empty(): selection=[ref];delete_selection(false);return
 elif tool=="spawn": doc.world.spawn={"x":p.x,"y":p.y}
 else:
  if doc.occupied(p): say("An object already occupies this tile.");return
  var k:="";var n:Dictionary={"id":doc.unique_id(tool),"x":p.x,"y":p.y}
  match tool:
   "tree": k="nodes";n.merge({"kind":"tree","species":object_type,"name":object_type.capitalize()+" tree","item":"logs","rotation":randf()*360})
   "rock": k="nodes";n.merge({"kind":"rock","name":object_type+" rock","item":object_type})
   "fishing":
    if r.tiles.get(str(int(p.x-r.x))+","+str(int(p.y-r.y)))!="water": say("Fishing spots belong on water.");return
    k="nodes";n.merge({"kind":"fishing","name":"Fishing spot","tool":object_type,"fish":["rawShrimp" if object_type=="net" else "rawTrout"],"item":"rawShrimp" if object_type=="net" else "rawTrout"})
   "npc": k="npcs";n.merge({"name":object_type.capitalize(),"type":object_type,"dialogue":"Welcome, traveller.","rotation":0});if object_type=="enemy": n.combatLevel=5
   "anvil","furnace","workbench": k="stations";n.merge({"name":tool.capitalize(),"type":tool})
   "fence","romanWall","gate": k="boundaries";n={"x":p.x,"y":p.y,"type":tool}
   "bridge": k="bridges";n={"x":p.x,"y":p.y,"width":3,"length":3,"rotation":0,"surface":true}
   "building": k="buildings";n.merge({"name":"New building","model":object_type,"width":3 if object_type=="townFountain" else 9 if object_type=="medievalWorkshop" else 8,"height":3 if object_type in ["castleRampart","castleGatehouse","townFountain"] else 14 if object_type=="medievalBankVault" else 9 if object_type=="medievalSmithy" else 8,"rotation":0,"roofColor":9013368,"occupants":[],"open":[]});doc.floor_plan(n)
  if k.is_empty(): return
  if k=="stations" and tool=="furnace" and not doc.world.stations.any(func(st): return st.id=="smeltery"): n.id="smeltery"
  if k=="buildings":
   for b in doc.world.buildings:
    if doc.footprint(b,k).intersects(doc.footprint(n,k)): say("A building already occupies this space.");return
  doc.world[k].append(n);selection=[{"collection":k,"index":doc.world[k].size()-1}];inspect()
 edited()
func select_area(p: Vector2) -> void:
 for i in range(doc.world.areas.size()):
  if Geometry2D.is_point_in_polygon(p,doc.polygon(doc.world.areas[i])): selection=[{"collection":"areas","index":i}];inspect();canvas.queue_redraw();return
func create_area(p: Vector2) -> void:
 var r=doc.region_at(p)
 if r.is_empty(): return
 doc.checkpoint();var size:=6.0
 var n={"name":"New area","regionId":r.id,"x":p.x,"y":p.y,"combatZone":"pve","polygon":[[p.x-size,p.y-size],[p.x+size,p.y-size],[p.x+size,p.y+size],[p.x-size,p.y+size]]}
 for xy in n.polygon: xy[0]=clampf(xy[0],float(r.x)-.5,float(r.x)+63.5);xy[1]=clampf(xy[1],float(r.y)-.5,float(r.y)+63.5)
 doc.sync_area(n);doc.world.areas.append(n);selection=[{"collection":"areas","index":doc.world.areas.size()-1}];tool="borders";edited();inspect()
func box_select(rect: Rect2) -> void:
 for k in ["buildings","nodes","npcs","stations","bridges","boundaries"]:
  for i in range(doc.world[k].size()):
   var ref={"collection":k,"index":i}
   if rect.intersects(doc.footprint(doc.world[k][i],k)) and not selection.has(ref): selection.append(ref)
 inspect();canvas.queue_redraw()
func delete_selection(checkpoint:=true) -> void:
 if selection.is_empty(): return
 if checkpoint: doc.checkpoint()
 for k in Document.COLLECTIONS:
  var indices:Array=[]
  for ref in selection:
   if ref.collection==k: indices.append(ref.index)
  indices.sort();indices.reverse()
  for i in indices: doc.world[k].remove_at(i)
 selection=[];edited();inspect()
func rotate_selection() -> void:
 if selection.is_empty(): return
 doc.checkpoint()
 for ref in selection:
  var n:Dictionary=doc.world[ref.collection][ref.index]
  if ref.collection=="buildings": doc.rotate_building(n)
  else: n.rotation=posmod(int(n.get("rotation",0))+90,360)
 edited();inspect()
func copy_selection() -> void:
 clipboard=[]
 for ref in selection: clipboard.append({"collection":ref.collection,"object":doc.world[ref.collection][ref.index].duplicate(true)})
 say(str(clipboard.size())+" objects copied.")
func paste() -> void:
 if clipboard.is_empty(): doc.checkpoint();paint(canvas.cursor.round());return
 doc.checkpoint();selection=[];var anchor=doc.point(clipboard[0].object);var delta=canvas.cursor.round()-anchor
 for item in clipboard:
  var n:Dictionary=item.object.duplicate(true);doc.translate(n,delta,item.collection)
  if doc.occupied(doc.point(n)): say("Paste blocked: occupied tile.");doc.undo();selection=[];return
  if n.has("id"): n.id=doc.unique_id(item.collection)
  if item.collection=="buildings": n.occupants=[]
  doc.world[item.collection].append(n);selection.append({"collection":item.collection,"index":doc.world[item.collection].size()-1})
 edited();inspect()
func undo() -> void:
 if doc.undo(): selection=[];edited();refresh_regions();inspect()
func redo() -> void:
 if doc.redo(): selection=[];edited();refresh_regions();inspect()
func _unhandled_key_input(e: InputEvent) -> void:
 if not e is InputEventKey or not e.pressed or e.echo: return
 var focus=get_viewport().gui_get_focus_owner()
 if focus is LineEdit or focus is TextEdit or preview_busy: return
 if e.ctrl_pressed:
  match e.keycode:
   KEY_C: copy_selection()
   KEY_V: paste()
   KEY_Z: undo()
   KEY_Y: redo()
   KEY_S: save_draft()
 else:
  if e.keycode==KEY_DELETE: delete_selection()
  if e.keycode==KEY_R: rotate_selection()
 canvas.queue_redraw()
func add_region_dialog() -> void:
 if doc.world.is_empty(): return
 var dialog:=ConfirmationDialog.new();dialog.title="Add neighbouring region";add_child(dialog)
 var direction:=OptionButton.new();for v in ["North","East","South","West"]: direction.add_item(v)
 dialog.add_child(direction);dialog.confirmed.connect(func(): add_region(direction.selected);dialog.queue_free());dialog.popup_centered(Vector2i(400,160))
func add_region(side: int) -> void:
 if doc.world.regions.size()>=16: say("Maximum 16 regions supported by the server.");return
 var r=current_region();var p:Vector2=Vector2(r.x,r.y)+[Vector2(0,-64),Vector2(64,0),Vector2(0,64),Vector2(-64,0)][side]
 if not doc.region_at(p+Vector2.ONE).is_empty(): say("That region already exists.");return
 doc.checkpoint();var n={"id":doc.unique_id("region"),"name":"New frontier","x":p.x,"y":p.y,"width":64,"height":64,"published":true,"terrain":"grass","tiles":{}}
 for y in range(64):
  for x in range(64): n.tiles[str(x)+","+str(y)]="grass"
 doc.world.regions.append(n);region_id=n.id;refresh_regions();canvas.fit_region(n);edited()
func remove_region_dialog() -> void:
 if doc.world.get("regions",[]).size()<=1: say("Keep at least one region.");return
 var r=current_region();confirm_dialog("Remove "+str(r.name)+"?","All objects and terrain in this region will be removed. Remaining islands may need ports or teleports. This is undoable and affects the draft only.",func():
  doc.checkpoint();var rect:=Rect2(r.x-.5,r.y-.5,64,64)
  for k in Document.COLLECTIONS:
   for i in range(doc.world[k].size()-1,-1,-1):
    var n:Dictionary=doc.world[k][i]
    if rect.intersects(doc.footprint(n,k)) or (k=="areas" and n.get("regionId")==r.id): doc.world[k].remove_at(i)
  doc.world.regions.erase(r);region_id=doc.world.regions[0].id;selection=[];refresh_regions();edited();inspect())
func rename_region() -> void:
 if doc.world.is_empty(): return
 var dialog:=ConfirmationDialog.new();dialog.title="Rename region";add_child(dialog)
 var field:=LineEdit.new();field.text=current_region().name;dialog.add_child(field)
 dialog.confirmed.connect(func(): doc.checkpoint();current_region().name=field.text;refresh_regions();edited();dialog.queue_free());dialog.popup_centered(Vector2i(400,160))
func export_backup() -> void:
 if doc.world.is_empty(): return
 file_dialog=FileDialog.new();file_dialog.access=FileDialog.ACCESS_FILESYSTEM;file_dialog.file_mode=FileDialog.FILE_MODE_SAVE_FILE;file_dialog.filters=PackedStringArray(["*.json ; World backup"]);file_dialog.current_file="hearthvale-draft.json";add_child(file_dialog)
 file_dialog.file_selected.connect(func(path): var f=FileAccess.open(path,FileAccess.WRITE);if f: f.store_string(JSON.stringify(doc.world));say("Backup exported. Database remains authoritative."))
 file_dialog.popup_centered_ratio(.7)
func import_backup() -> void:
 file_dialog=FileDialog.new();file_dialog.access=FileDialog.ACCESS_FILESYSTEM;file_dialog.file_mode=FileDialog.FILE_MODE_OPEN_FILE;file_dialog.filters=PackedStringArray(["*.json ; World backup"]);add_child(file_dialog)
 file_dialog.file_selected.connect(func(path):
  var data=JSON.parse_string(FileAccess.get_file_as_string(path))
  if not data is Dictionary or data.get("version")!=1 or not data.get("regions") is Array: say("Invalid world backup.");return
  for k in Document.COLLECTIONS:
   if not data.get(k) is Array: say("Missing collection: "+k);return
  doc.checkpoint();doc.world=data;selection=[];region_id=data.regions[0].id;refresh_regions();edited();inspect())
 file_dialog.popup_centered_ratio(.7)
func open_preview() -> void:
 if doc.world.is_empty() or preview_busy: return
 preview_floor=-1;preview_pan=false;preview_busy=true;preview_panel=PanelContainer.new();preview_panel.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT);add_child(preview_panel)
 var box:=VBoxContainer.new();preview_panel.add_child(box)
 var panel_style:=StyleBoxFlat.new();panel_style.bg_color=Color("15232a");preview_panel.add_theme_stylebox_override("panel",panel_style)
 var row:=HBoxContainer.new();box.add_child(row);var back:=button(row,"Back to editor",func(): preview_panel.queue_free();preview_busy=false;preview_pan=false);back.disabled=true
 floor_picker=OptionButton.new();floor_picker.add_item("Exterior / automatic",-1)
 for level in range(3): floor_picker.add_item("Ground floor" if level==0 else "Floor "+str(level),level)
 row.add_child(floor_picker);floor_picker.item_selected.connect(func(i): preview_floor=-1 if i==0 else i-1;update_preview_floor();update_preview_camera())
 var progress_text:=label(row,"Loading models…")
 var container:=SubViewportContainer.new();container.stretch=true;container.size_flags_vertical=Control.SIZE_EXPAND_FILL;container.size_flags_horizontal=Control.SIZE_EXPAND_FILL;box.add_child(container)
 var viewport:=SubViewport.new();viewport.size=Vector2i(1100,700);viewport.render_target_update_mode=SubViewport.UPDATE_ALWAYS;container.add_child(viewport)
 preview_world=preload("res://scripts/world.gd").new();viewport.add_child(preview_world)
 var light:=DirectionalLight3D.new();light.rotation_degrees=Vector3(-45,-35,0);light.light_energy=1.4;viewport.add_child(light)
 var env:=WorldEnvironment.new();env.environment=Environment.new();env.environment.background_mode=Environment.BG_COLOR;env.environment.background_color=Color("9dbbc6");env.environment.ambient_light_source=Environment.AMBIENT_SOURCE_COLOR;env.environment.ambient_light_color=Color.WHITE;env.environment.ambient_light_energy=.65;viewport.add_child(env)
 preview_camera=Camera3D.new();preview_camera.current=true;viewport.add_child(preview_camera)
 preview_focus=Vector3(canvas.cursor.x,0,canvas.cursor.y)
 if doc.region_at(canvas.cursor).is_empty(): var r=current_region();preview_focus=Vector3(float(r.x)+32,0,float(r.y)+32)
 var data=doc.world.duplicate(true);data.spawn={"x":preview_focus.x,"y":preview_focus.z}
 preview_world.progress.connect(func(message): say(message);progress_text.text=message);await preview_world.build(data)
 if not is_instance_valid(preview_panel): return
 back.disabled=false;progress_text.text="Arrows / right drag: look around · Wheel: zoom · Preview uses unsaved draft"
 preview_focus.y=preview_world.ground(preview_focus.x,preview_focus.z);update_preview_camera();say("3D preview ready.")
 container.gui_input.connect(func(event):
  if event is InputEventMouseButton:
   if event.button_index==MOUSE_BUTTON_RIGHT: preview_pan=event.pressed
   if event.pressed and event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN]: preview_distance=clampf(preview_distance*(.9 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 1.1),5,100)
  if event is InputEventMouseMotion and preview_pan: preview_yaw-=event.relative.x*.008;preview_pitch=clampf(preview_pitch+event.relative.y*.006,.25,1.45)
  update_preview_camera();container.accept_event())
func update_preview_camera() -> void:
 if not is_instance_valid(preview_camera): return
 preview_camera.position=preview_focus+Vector3(sin(preview_yaw)*cos(preview_pitch),sin(preview_pitch),cos(preview_yaw)*cos(preview_pitch))*preview_distance;preview_camera.look_at(preview_focus)
func _process(delta: float) -> void:
 if not is_instance_valid(preview_world) or not is_instance_valid(preview_panel): return
 var v:=Vector2(Input.get_axis("ui_left","ui_right"),Input.get_axis("ui_up","ui_down"))
 if v!=Vector2.ZERO:
  preview_focus+=camera_movement(v,preview_yaw)*delta*15
  update_preview_floor();update_preview_camera()
 preview_world.update_scenery(preview_focus,delta);update_preview_floor();apply_preview_interiors()

func furnishings_inspector(b: Dictionary) -> void:
 label(inspector,"INTERIOR OBJECTS")
 var catalog:Dictionary=JSON.parse_string(FileAccess.get_file_as_string("res://editor-catalog.json"))
 var parts:Array=[]
 var swap:=int(b.get("rotation",0))%180!=0
 var w:float=b.height if swap else b.width
 var h:float=b.width if swap else b.height
 for entry in catalog.get(b.get("model",""),{}).get("furnishings",[]):
  var part:Dictionary=entry.duplicate(true);part.x*= (w-1+.24)/8.24;part.y*= (h-1+.24)/8.24;parts.append(part)
 for override in b.get("furnishings",[]):
  var found:=-1
  for i in range(parts.size()):
   if parts[i].id==override.id: found=i;break
  if found>=0: parts[found].merge(override,true)
  else: parts.append(override.duplicate(true))
 parts=parts.filter(func(part): return not part.get("deleted",false))
 if parts.is_empty(): label(inspector,"Default objects are built into this model.\nUse Complete properties for overrides.");return
 var menu:=OptionButton.new();inspector.add_child(menu)
 for part in parts: menu.add_item(str(part.get("id",part.get("source","Object"))))
 var controls:=VBoxContainer.new();inspector.add_child(controls)
 var render=func(index):
  for child in controls.get_children(): child.queue_free()
  var part:Dictionary=parts[index]
  for key in ["x","y","height","rotation"]:
   var spin:=SpinBox.new();spin.min_value=-100;spin.max_value=360;spin.step=.1;spin.value=part.get(key,0);spin.prefix=key+" ";controls.add_child(spin)
   spin.value_changed.connect(func(value): doc.checkpoint();part[key]=value;b.furnishings=parts;edited())
  button(controls,"Place on floor",func(): doc.checkpoint();part.height=0;b.furnishings=parts;edited();inspect())
  button(controls,"Duplicate interior object",func(): doc.checkpoint();var copy=part.duplicate(true);copy.id=doc.unique_id(str(part.get("source","prop"))).replace("-","_");copy.x+=.5;parts.append(copy);b.furnishings=parts;edited();inspect())
 menu.item_selected.connect(render);render.call(0)
func _notification(what: int) -> void:
 if what==NOTIFICATION_WM_CLOSE_REQUEST and not closing:
  if saved_serial!=doc.serial or saving:
   confirm_dialog("Unsaved changes","Save to the database before closing? If saving fails, this window will stay open so you can export a backup.",func():
    await save_draft()
    if saved_serial==doc.serial and not saving: closing=true;get_tree().quit())
  else: closing=true;get_tree().quit()

func apply_preview_interiors() -> void:
 if not is_instance_valid(preview_world): return
 for entry in preview_world.streamed_buildings.values():
  var group:Node3D=entry.node
  if group.has_meta("editor_interiors"): continue
  group.set_meta("editor_interiors",true)
  var b:Dictionary=entry.document
  var centre=preview_world.building_centre(b)
  for part in b.get("furnishings",[]):
   var node=group.find_child(str(part.get("id","")),true,false) as Node3D
   if not node:
    var source=group.find_child(str(part.get("source","")),true,false) as Node3D
    if source:
     node=source.duplicate();node.name=str(part.id);group.add_child(node);node.global_transform=source.global_transform
   if not node: continue
   node.visible=not part.get("deleted",false)
   node.global_position=Vector3(centre.x+float(part.get("x",0)),preview_world.ground(centre.x,centre.y)+float(part.get("height",0)),centre.y+float(part.get("y",0)))
   var rotation=node.global_rotation;rotation.y=-deg_to_rad(float(part.get("rotation",0)));node.global_rotation=rotation

static func camera_movement(keys: Vector2,angle: float) -> Vector3:
 # Horizontal camera right and backward vectors; Up moves toward the view.
 var right:=Vector3(cos(angle),0,-sin(angle))
 var backward:=Vector3(sin(angle),0,cos(angle))
 return (right*keys.x+backward*keys.y).limit_length(1.0)
func update_preview_floor() -> void:
 if not is_instance_valid(preview_world): return
 var selected_building:Dictionary={}
 for b in preview_world.document.get("buildings",[]):
  if preview_world.inside_building(preview_focus,b): selected_building=b;break
 var level:=0
 var building_id:=""
 if preview_floor>=0 and not selected_building.is_empty():
  level=mini(preview_floor,preview_world.storey_count(selected_building)-1);building_id=str(selected_building.id)
 preview_focus.y=preview_world.ground(preview_focus.x,preview_focus.z)+level*3.2
 preview_world.update_roofs(preview_focus,level,building_id)

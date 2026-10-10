extends Control
var app
var zoom:=12.0
var origin:=Vector2(30,30)
var cursor:=Vector2.ZERO
var panning:=false
var painting:=false
var moving:=false
var boxing:=false
var box_start:=Vector2.ZERO
var drag_start:=Vector2.ZERO
var moved:=false
var originals: Array=[]
var node_index:=-1
var node_drag:=false
var last_tile:=Vector2(-99999,-99999)
const COLORS={"grass":Color("547b46"),"path":Color("af9872"),"water":Color("367b99"),"field":Color("967b3b"),"quarry":Color("797974"),"sand":Color("bfa978"),"floor":Color("b29b7e"),"wall":Color("636b6b")}
func _ready() -> void:
 mouse_filter=Control.MOUSE_FILTER_STOP
 clip_contents=true
 focus_mode=Control.FOCUS_ALL
func world_point(p: Vector2) -> Vector2: return (p-origin)/zoom-Vector2(.5,.5)
func screen(p: Vector2) -> Vector2: return origin+(p+Vector2(.5,.5))*zoom
func fit_region(r: Dictionary) -> void:
 zoom=clampf(minf(size.x/float(r.width+6),size.y/float(r.height+6)),2,40)
 origin=(size-Vector2(r.width,r.height)*zoom)/2-Vector2(r.x,r.y)*zoom
 queue_redraw()
func _draw() -> void:
 draw_rect(Rect2(Vector2.ZERO,size),Color("101b20"))
 if not app or app.doc.world.is_empty(): return
 var d=app.doc
 var bounds:=Rect2(world_point(Vector2.ZERO)-Vector2.ONE, size/zoom+Vector2(2,2))
 for r in d.world.regions:
  if not Rect2(r.x,r.y,r.width,r.height).intersects(bounds): continue
  for y in range(maxi(0,int(floor(bounds.position.y-r.y))),mini(int(r.height),int(ceil(bounds.end.y-r.y))+1)):
   for x in range(maxi(0,int(floor(bounds.position.x-r.x))),mini(int(r.width),int(ceil(bounds.end.x-r.x))+1)):
    var key:=str(x)+","+str(y)
    var t:String=r.get("tiles",{}).get(key,r.get("terrain","grass"))
    var color:Color=COLORS.get(t,Color("445449"))
    var h:float=r.get("heights",{}).get(key,0)
    color=color.lightened(clampf(h/40,0,.35)).darkened(clampf(-h/40,0,.35))
    if t=="path" and r.get("pathMaterials",{}).get(key)=="dirt": color=Color("816449")
    var pos:=origin+Vector2(float(r.x)+x,float(r.y)+y)*zoom
    draw_rect(Rect2(pos,Vector2(zoom+.3,zoom+.3)),color)
    if app.show_heights and zoom>=20:
     draw_string(ThemeDB.fallback_font,pos+Vector2(zoom-18,10),str(snappedf(h,.1)),HORIZONTAL_ALIGNMENT_LEFT,-1,10,Color.WHITE)
  draw_rect(Rect2(origin+Vector2(r.x,r.y)*zoom,Vector2(r.width,r.height)*zoom),Color("40dcff") if r.id==app.region_id else Color("81998d"),false,3 if r.id==app.region_id else 1)
 for k in ["buildings","bridges","boundaries","stations","nodes","npcs"]:
  var list:Array=d.world.get(k,[])
  for i in range(list.size()):
   var n:Dictionary=list[i];var rect:Rect2=d.footprint(n,k)
   if not rect.intersects(bounds): continue
   var sr:=Rect2(screen(rect.position),rect.size*zoom)
   var selected=app.selection.has({"collection":k,"index":i})
   var color:=Color("b6aa8f")
   var text:String=str(n.get("name",n.get("type",n.get("kind",k))))
   if k=="buildings":
    draw_rect(sr,Color("c3ae87"));draw_rect(sr,Color("473c2b"),false,maxf(1,zoom*.13))
    if n.has("door"): draw_circle(screen(Vector2(n.door[0],n.door[1])),maxf(2,zoom*.28),Color("54c8db"))
   elif k=="bridges": draw_rect(sr,Color("a08b65"));draw_line(sr.position,sr.end,Color("d9c7a1"),2)
   else:
    if k=="nodes": color=Color("2f5627") if n.get("kind")=="tree" else Color("c99053") if n.get("kind")=="rock" else Color("60caed")
    if k=="npcs": color=Color("ed6c61") if n.get("type")=="enemy" else Color("f4d888")
    if k=="boundaries": color=Color("bdb6a6") if n.get("type")!="fence" else Color("aa7b48")
    draw_rect(sr,color) if k=="boundaries" else draw_circle(screen(d.point(n)),maxf(2,zoom*.32),color)
   if selected: draw_rect(sr.grow(2),Color("ffe28a"),false,2)
   if zoom>=12 and ((k=="nodes" and app.show_names) or selected): draw_string(ThemeDB.fallback_font,sr.position-Vector2(0,4),text,HORIZONTAL_ALIGNMENT_LEFT,-1,12,Color.WHITE)
 for i in range(d.world.get("areas",[]).size()):
  var a:Dictionary=d.world.areas[i];var poly=d.polygon(a)
  var mapped:=PackedVector2Array()
  for v in poly: mapped.append(screen(v))
  if mapped.size()<3: continue
  mapped.append(mapped[0]);draw_polyline(mapped,Color("70b7e0"),1.5)
  draw_string(ThemeDB.fallback_font,screen(d.point(a)),str(a.get("name","Area")),HORIZONTAL_ALIGNMENT_CENTER,-1,13,Color("e4eff6"))
  if app.selection.has({"collection":"areas","index":i}):
   draw_polyline(mapped,Color("ffe28a"),3)
   for v in mapped: draw_rect(Rect2(v-Vector2(5,5),Vector2(10,10)),Color("ffe28a"))
 var spawn:Dictionary=d.world.get("spawn",{})
 if not spawn.is_empty(): draw_circle(screen(d.point(spawn)),7,Color("eb97f5"))
 if boxing: draw_rect(Rect2(box_start,get_local_mouse_position()-box_start).abs(),Color(0.4,.8,1,.2));draw_rect(Rect2(box_start,get_local_mouse_position()-box_start).abs(),Color("60d9ff"),false,2)
 if app.tool in ["grass","water","path","dirt","field","raise","lower","smooth","flatten"]:
  var tile:=cursor.round();var radius:int=app.brush_size/2
  draw_rect(Rect2(screen(tile-Vector2(radius+.5,radius+.5)),Vector2(app.brush_size,app.brush_size)*zoom),Color("eeeeaa"),false,2)
func nearest_node(p: Vector2) -> int:
 if app.selection.size()!=1 or app.selection[0].collection!="areas": return -1
 var a:Dictionary=app.selected_object();var poly=app.doc.polygon(a)
 for i in range(poly.size()):
  if screen(poly[i]).distance_to(p)<10: return i
 return -1
func _gui_input(event: InputEvent) -> void:
 if app.doc.world.is_empty(): return
 if event is InputEventMouseMotion:
  cursor=world_point(event.position)
  app.coords.text="%.1f, %.1f"%[cursor.x,cursor.y]
  if panning: origin+=event.relative
  elif node_drag:
   var p=cursor.round() if event.shift_pressed else cursor
   var a=app.selected_object()
   for other in app.doc.world.areas:
    if other==a: continue
    for xy in other.get("polygon",[]):
     var v:=Vector2(xy[0],xy[1])
     if v.distance_to(p)*zoom<9: p=v
   a.polygon[node_index]=[p.x,p.y];app.doc.sync_area(a);moved=true
  elif moving:
   var delta:=cursor-drag_start
   if event.shift_pressed: delta=delta.round()
   for i in range(app.selection.size()):
    var ref=app.selection[i];var target:Dictionary=app.doc.world[ref.collection][ref.index]
    var desired:Vector2=app.doc.point(originals[i])+delta
    app.doc.translate(target,desired-app.doc.point(target),ref.collection)
   moved=true
  elif painting and cursor.round()!=last_tile:
   app.paint(cursor.round());last_tile=cursor.round()
  queue_redraw()
 elif event is InputEventMouseButton:
  grab_focus();cursor=world_point(event.position)
  if event.button_index in [MOUSE_BUTTON_WHEEL_UP,MOUSE_BUTTON_WHEEL_DOWN] and event.pressed:
   var before:=world_point(event.position);zoom=clampf(zoom*(1.18 if event.button_index==MOUSE_BUTTON_WHEEL_UP else 1/1.18),2,70);origin=event.position-(before+Vector2(.5,.5))*zoom;queue_redraw()
  elif event.button_index==MOUSE_BUTTON_RIGHT:
   if event.pressed and app.tool=="borders" and nearest_node(event.position)>=0:
    var a=app.selected_object();var index=nearest_node(event.position)
    if a.polygon.size()>3: app.doc.checkpoint();a.polygon.remove_at(index);app.doc.sync_area(a);app.edited()
   else: panning=event.pressed
  elif event.button_index==MOUSE_BUTTON_LEFT:
   if not event.pressed:
    if node_drag or moving:
     if moved: app.edited()
    if boxing: app.box_select(Rect2(world_point(box_start),cursor-world_point(box_start)).abs())
    painting=false;moving=false;boxing=false;node_drag=false;app.inspect();queue_redraw();return
   moved=false
   if app.tool=="borders":
    node_index=nearest_node(event.position)
    if node_index>=0: app.doc.checkpoint();node_drag=true
    elif app.selection.size()==1 and app.selection[0].collection=="areas":
     var a=app.selected_object();var poly=app.doc.polygon(a);var nearest:=-1;var distance:=99999.0
     for i in range(poly.size()):
      var v=Geometry2D.get_closest_point_to_segment(cursor,poly[i],poly[(i+1)%poly.size()]);var dist=v.distance_to(cursor)*zoom
      if dist<distance: distance=dist;nearest=i
     if distance<14: app.doc.checkpoint();a.polygon.insert(nearest+1,[cursor.x,cursor.y]);app.doc.sync_area(a);app.edited()
     else: app.select_area(cursor)
    else: app.select_area(cursor)
   elif app.tool=="select":
    var hit=app.doc.hit(cursor)
    if event.shift_pressed and hit.is_empty(): boxing=true;box_start=event.position
    elif not hit.is_empty():
     if event.shift_pressed and not app.selection.has(hit): app.selection.append(hit)
     elif not app.selection.has(hit): app.selection=[hit]
     app.doc.checkpoint();moving=true;drag_start=cursor;originals=[]
     for ref in app.selection: originals.append(app.doc.world[ref.collection][ref.index].duplicate(true))
     app.inspect()
    else:
     app.selection=[];var r=app.doc.region_at(cursor)
     if not r.is_empty(): app.region_id=r.id;app.refresh_regions()
     app.inspect()
   elif app.tool=="areas": app.create_area(cursor)
   else:
    app.doc.checkpoint();app.paint(cursor.round());painting=app.tool in ["grass","water","path","dirt","field","raise","lower","smooth","flatten","fence","romanWall"]
    last_tile=cursor.round()
   queue_redraw()
  accept_event()
func _process(delta: float) -> void:
 if not has_focus(): return
 var v:=Vector2(Input.get_axis("ui_right","ui_left"),Input.get_axis("ui_down","ui_up"))
 if v!=Vector2.ZERO: origin+=v*500*delta;queue_redraw()

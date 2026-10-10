extends RefCounted
const COLLECTIONS = ["buildings","nodes","npcs","stations","bridges","boundaries","areas","barriers"]
var world: Dictionary = {}
var undo_stack: Array = []
var redo_stack: Array = []
var serial := 0
func checkpoint() -> void:
 undo_stack.append(world.duplicate(true))
 if undo_stack.size()>40: undo_stack.pop_front()
 redo_stack.clear()
func changed() -> void: serial+=1
func undo() -> bool:
 if undo_stack.is_empty(): return false
 redo_stack.append(world.duplicate(true));world=undo_stack.pop_back();changed();return true
func redo() -> bool:
 if redo_stack.is_empty(): return false
 undo_stack.append(world.duplicate(true));world=redo_stack.pop_back();changed();return true
func region_at(p: Vector2) -> Dictionary:
 for r in world.get("regions",[]):
  if Rect2(r.x,r.y,r.width,r.height).has_point(p): return r
 return {}
func point(n: Dictionary) -> Vector2: return Vector2(float(n.get("x",0))+float(n.get("offsetX",0)),float(n.get("y",0))+float(n.get("offsetY",0)))
func translate(n: Dictionary,delta: Vector2,collection: String) -> void:
 if collection=="buildings":
  var old:=Vector2(n.x,n.y);var desired:=point(n)+delta;var anchor:=desired.round();var change:=anchor-old
  for rope in world.get("barriers",[]):
   var ends:=rope_ends(rope)
   if Rect2(old-Vector2(.5,.5),Vector2(n.width,n.height)).has_point(ends[0]) and Rect2(old-Vector2(.5,.5),Vector2(n.width,n.height)).has_point(ends[1]):
    if rope.get("axis")=="horizontal": rope.x1+=change.x;rope.x2+=change.x;rope.y+=change.y
    else: rope.x+=change.x;rope.y1+=change.y;rope.y2+=change.y
  n.x=anchor.x;n.y=anchor.y;n.offsetX=desired.x-anchor.x;n.offsetY=desired.y-anchor.y
  for xy in n.get("open",[]): xy[0]+=change.x;xy[1]+=change.y
  if n.has("door"): n.door[0]+=change.x;n.door[1]+=change.y
  for k in ["npcs","stations"]:
   for obj in world.get(k,[]):
    if obj.get("id","") in n.get("occupants",[]): obj.x+=change.x;obj.y+=change.y
  return
 var desired:=point(n)+delta
 if collection!="areas": desired=desired.round()
 var change:=desired-point(n);n.x=desired.x;n.y=desired.y
 if collection=="areas":
  for xy in n.get("polygon",[]): xy[0]+=change.x;xy[1]+=change.y
func polygon(n: Dictionary) -> PackedVector2Array:
 var result := PackedVector2Array()
 for xy in n.get("polygon",[]): result.append(Vector2(xy[0],xy[1]))
 return result
func sync_area(n: Dictionary) -> void:
 var poly=polygon(n)
 if poly.is_empty(): return
 var centre:=Vector2.ZERO
 for v in poly: centre+=v
 centre/=poly.size();n.x=centre.x;n.y=centre.y
func footprint(n: Dictionary,k: String) -> Rect2:
 if k=="barriers":
  var ends:=rope_ends(n);return Rect2(ends[0],ends[1]-ends[0]).abs().grow(.3)
 if k=="buildings": return Rect2(float(n.x)+float(n.get("offsetX",0))-.5,float(n.y)+float(n.get("offsetY",0))-.5,n.width,n.height)
 if k=="bridges": return Rect2(float(n.x)-1.5,float(n.y)-1.5,3,3)
 return Rect2(point(n)-Vector2(.45,.45),Vector2(.9,.9))
func hit(p: Vector2) -> Dictionary:
 for k in ["boundaries","nodes","npcs","stations","bridges","buildings"]:
  var list: Array=world.get(k,[])
  for i in range(list.size()-1,-1,-1):
   if footprint(list[i],k).has_point(p): return {"collection":k,"index":i}
 return {}
func unique_id(prefix: String) -> String:
 return prefix+"-"+str(Time.get_unix_time_from_system()).replace(".","-")+"-"+str(randi()%100000)
func occupied(p: Vector2) -> bool:
 for k in ["nodes","npcs","stations","boundaries"]:
  for n in world.get(k,[]):
   if point(n).distance_to(p)<.65: return true
 return false
func floor_plan(b: Dictionary) -> void:
 b.open=[]
 if b.get("model") in ["castleRampart","castleGatehouse"]:
  var links=load("res://scripts/world.gd").new();var link=links.stair_links(b,0)[0];links.free();b.erase("door");b.open=[]
  if b.model=="castleGatehouse":
   var swap:=int(b.get("rotation",0))%180!=0;var w:int=b.height if swap else b.width;var h:int=b.width if swap else b.height
   var geometry=load("res://scripts/world.gd").new()
   for y in range(h):
    for x in range(int(ceil((w-1)/2.0-(w-.76)/4.0)),int(floor((w-1)/2.0+(w-.76)/4.0))+1):
     var point:Vector2=geometry.storey_point(b,x,y);b.open.append([point.x,point.y])
   geometry.free()
  return
 if b.get("model")=="townFountain":
  for y in range(int(b.height)):
   for x in range(int(b.width)):
    if Vector2(x-int(b.width)/2,y-int(b.height)/2).length()>1.3: b.open.append([b.x+x,b.y+y])
  b.erase("door");return
 for y in range(1,int(b.height)-1):
  for x in range(1,int(b.width)-1): b.open.append([b.x+x,b.y+y])
 var quarter:=posmod(int(b.get("rotation",0))/90,4)
 var fraction:=0.0
 var model:String=b.get("model","")
 if model in ["medievalCottage","medievalHouse","medievalWorkshop","medievalSmithy"]: fraction=.175
 if model=="medievalTownhouse": fraction=-.175
 var bank:=model in ["medievalBank","medievalBankVault"]
 if bank: fraction=.25
 var pos:=Vector2(round((float(b.width)-1)/2+fraction*(float(b.width)-1+.24)),0 if bank else float(b.height)-1)
 if quarter==1: pos=Vector2(float(b.width)-1 if bank else 0,round((float(b.height)-1)/2+fraction*(float(b.height)-1+.24)))
 if quarter==2: pos=Vector2(round((float(b.width)-1)/2-fraction*(float(b.width)-1+.24)),float(b.height)-1 if bank else 0)
 if quarter==3: pos=Vector2(0 if bank else float(b.width)-1,round((float(b.height)-1)/2-fraction*(float(b.height)-1+.24)))
 b.door=[b.x+round(pos.x),b.y+round(pos.y)];b.open.append(b.door)
func rotate_building(b: Dictionary) -> void:
 var centre:=point(b)+Vector2((float(b.width)-1)/2,(float(b.height)-1)/2)
 var w=float(b.width);b.width=b.height;b.height=w
 var new_centre:=Vector2(b.x,b.y)+Vector2((float(b.width)-1)/2,(float(b.height)-1)/2)
 for part in b.get("furnishings",[]):
  var x:float=part.x;part.x=-float(part.y);part.y=x;part.rotation=posmod(int(part.get("rotation",0))-90,360)
 for rope in world.get("barriers",[]):
  var ends:=rope_ends(rope)
  if Rect2(b.x-.5,b.y-.5,w,float(b.width)).has_point(ends[0]) and Rect2(b.x-.5,b.y-.5,w,float(b.width)).has_point(ends[1]):
   for i in range(2):
    var rel:=ends[i]-centre;ends[i]=new_centre+Vector2(-rel.y,rel.x)
   var clearance:float=rope.get("clearance",.35);rope.clear()
   if absf(ends[0].y-ends[1].y)<.001: rope.merge({"axis":"horizontal","x1":minf(ends[0].x,ends[1].x),"x2":maxf(ends[0].x,ends[1].x),"y":ends[0].y,"clearance":clearance})
   else: rope.merge({"x":ends[0].x,"y1":minf(ends[0].y,ends[1].y),"y2":maxf(ends[0].y,ends[1].y),"clearance":clearance})
 for xy in b.get("open",[]):
  var rel:=Vector2(xy[0],xy[1])-centre;var v:=new_centre+Vector2(-rel.y,rel.x);xy[0]=v.x;xy[1]=v.y
 if b.has("door"):
  var rel:=Vector2(b.door[0],b.door[1])-centre;var v:=new_centre+Vector2(-rel.y,rel.x);b.door=[v.x,v.y]
 for k in ["npcs","stations"]:
  for n in world.get(k,[]):
   if n.get("id","") in b.get("occupants",[]):
    var rel:=point(n)-centre;var v:=new_centre+Vector2(-rel.y,rel.x);n.x=v.x;n.y=v.y;n.rotation=posmod(int(n.get("rotation",0))+90,360)
 b.rotation=posmod(int(b.get("rotation",0))+90,360)

func rope_ends(rope: Dictionary) -> Array[Vector2]:
 if rope.get("axis")=="horizontal": return [Vector2(rope.x1,rope.y),Vector2(rope.x2,rope.y)]
 return [Vector2(rope.get("x",0),rope.get("y1",0)),Vector2(rope.get("x",0),rope.get("y2",0))]

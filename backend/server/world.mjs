import {bridgeRotation,bridgeWorldOffset,bridgeCrossing} from './bridge-layout.mjs';
import {assertEditorPlacement} from './editor-placement.mjs';
import {VILLAGE_MODELS,buildingOffset} from './building-catalog.mjs';
import {workshopFurnishings,buildingDimensions,rotateBuildingPoint,workshopBlocked,WORKSHOP_PARTS,FURNISHING_PARTS,furnishingStationType,linkWorkshopBenches} from './workshop.mjs';
import {terrainHeight,heightAt,validateElevations} from './elevation.mjs';
import {levelForXp,xpForLevel} from './experience.mjs';
import authoredWorld from './world-data.mjs';
export const MAP_ICONS={};
export const SIZE = 16384;
export const REGION_SIZE=64;
// Only published regions are playable. Unauthored coordinates have no terrain allocation.
export const WORLD_REGIONS=[{id:'hearthvale',name:'Hearthvale frontier',x:0,y:0,width:REGION_SIZE,height:REGION_SIZE,published:true,terrain:'starter'}];
const regionIndex=new Map(WORLD_REGIONS.map(r=>[`${r.x/REGION_SIZE},${r.y/REGION_SIZE}`,r]));
export function groundHeight(x,y){const b=BUILDINGS.find(b=>x>=b.x-.5&&y>=b.y-.5&&x<=b.x+b.width-.5&&y<=b.y+b.height-.5);return b?terrainHeight(WORLD_REGIONS,b.x+(b.width-1)/2,b.y+(b.height-1)/2):terrainHeight(WORLD_REGIONS,x,y);}
export const waterHeight=(x,y)=>heightAt(WORLD_REGIONS,x,y,true);
export const publishedRegions=()=>WORLD_REGIONS.filter(r=>r.published);
export function inWorld(x,y){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&y>=0&&x<SIZE&&y<SIZE;}
export function worldRegionAt(x,y){if(!inWorld(x,y))return;const region=regionIndex.get(`${Math.floor(x/REGION_SIZE)},${Math.floor(y/REGION_SIZE)}`);return region?.published?region:undefined;}
export const BRIDGES=[3,34].flatMap(x=>[16,43].map(y=>({x:x+1,y,length:3,width:3})));
// Queue ropes occupy edges between walkable lanes, rather than whole floor tiles.
export const BANK_QUEUE_BARRIERS=[10.5,11.5].map(x=>({x,y1:20,y2:22,clearance:.35}));
export const TREE_RADIUS=1.05,TREE_BUILDING_GAP=.5;
const pointRectDistance=(x,y,left,top,right,bottom)=>Math.hypot(Math.max(left-x,0,x-right),Math.max(top-y,0,y-bottom));
const ROAD_LINES=[
  {width:3,points:[[15,1],[15,28],[16,33],[15,43],[19,54],[22,62]]},
  {width:3,points:[[1,16],[62,16]]},{width:3,points:[[1,43],[42,43],[44,41],[60,41]]},
  {width:1,points:[[20,14],[20,15]]},{width:1,points:[[20,17],[20,18]]},{width:1,points:[[26,14],[26,15]]},
  {width:1,points:[[15,29],[28,29],[29,30]]},
  {width:1,points:[[16,33],[30,33],[30,40]]},
  {width:1,points:[[45,16],[45,29],[47,32],[53,32],[56,36],[56,41]]},
  {width:1,points:[[45,19],[46,19]]},{width:1,points:[[51,34],[51,33],[53,33]]},
  {width:1,points:[[11,44],[11,45]]},{width:1,points:[[22,44],[22,45]]},
  {width:1,points:[[41,43],[41,56],[46,58],[57,59]]},
  {width:1,points:[[41,48],[43,48]]}
];
const roadCells=new Set();for(const line of ROAD_LINES)for(let i=1;i<line.points.length;i++){
 const [ax,ay]=line.points[i-1],[bx,by]=line.points[i],steps=Math.max(Math.abs(bx-ax),Math.abs(by-ay)),radius=(line.width-1)/2;
 for(let t=0;t<=steps;t++){const x=Math.round(ax+(bx-ax)*t/steps),y=Math.round(ay+(by-ay)*t/steps);for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++)roadCells.add(`${x+dx},${y+dy}`);}
}
export function roadAt(x,y){const r=worldRegionAt(x,y);return customWorld?r?.tiles?.[`${x-r.x},${y-r.y}`]==='path':roadCells.has(`${x},${y}`);}
function house(id,x,y,width,height,door,roofColor=0x826149){return {id,x,y,width,height,roofColor,door,open:[door,...Array.from({length:height-2},(_,dy)=>Array.from({length:width-2},(_,dx)=>[x+dx+1,y+dy+1])).flat()],occupants:[]};}
export const BUILDINGS=[
  {id:'bank',x:9,y:18,width:5,height:7,open:[[12,18],...[19,20,21,22,23].flatMap(y=>[10,11,12].map(x=>[x,y]))],occupants:['banker','banker-ellis','banker-tess']},
  {id:'smeltery',x:18,y:10,width:5,height:4,open:[[19,11],[20,11],[21,11],[19,12],[20,12],[21,12],[20,13]],occupants:['smeltery','workshop-anvil']},
  {id:'old-watch',x:43,y:33,width:4,height:4,ruin:true,occupants:[]},
  house('village-cottage',6,18,3,4,[7,18]),
  house('hearthvale-inn',18,19,5,4,[20,19],0x915b48),
  house('north-cottage',24,9,4,5,[26,13],0x60745e),
  house('village-home',24,18,4,4,[25,18]),
  house('farmhouse',19,34,5,4,[21,34],0x7b6745),
  house('eastmere-lodge',47,18,5,5,[47,19],0x686b83),
  house('eastmere-store',49,35,5,4,[51,35],0x876a47),
  house('willow-cottage',9,46,4,4,[11,46],0x736455),
  house('willow-chapel',21,46,4,5,[22,46],0x647780),
  house('quarry-store',44,47,4,4,[44,48],0x766554)
];
BUILDINGS.find(b=>b.id==='quarry-store').occupants.push('quarry-anvil');
export const REGIONS = [
  {name:'Hearthvale',x:15,y:15}, {name:'Northwood',x:22,y:7},
  {name:'Willowbank',x:14,y:43}, {name:'Eastmere',x:49,y:19},
  {name:'Old Watch',x:45,y:34}, {name:'Copper Highlands',x:52,y:49},
  {name:'Harvest Fields',x:25,y:36}, {name:'North Quarry',x:27,y:25}
];
export function areaSurface(p){return Math.abs(p.reduce((n,a,i)=>{const b=p[(i+1)%p.length];return n+a[0]*b[1]-b[0]*a[1];},0))/2;}
export function regionAt(x,y){const region=worldRegionAt(x,y);if(!region)return 'Unbuilt frontier';const areas=REGIONS.filter(a=>a.polygon?pointInArea(x,y,a.polygon):a.x>=region.x&&a.y>=region.y&&a.x<region.x+region.width&&a.y<region.y+region.height);const bounded=areas.filter(a=>a.polygon&&pointInArea(x,y,a.polygon)).sort((a,b)=>areaSurface(a.polygon)-areaSurface(b.polygon))[0];if(bounded)return bounded.name;const legacy=areas.filter(a=>!a.polygon);return legacy.length?legacy.reduce((best,a)=>Math.hypot(x-a.x,y-a.y)<Math.hypot(x-best.x,y-best.y)?a:best,legacy[0]).name:region.name;}
export const ITEMS = {
  ashes:{label:'Ashes',icon:'▧',color:0x858079},
  bones:{label:'Bones',icon:'🦴',color:0xe6ddc3,prayerXp:5},
  coins:{label:'Coins',icon:'🪙',color:0xe5bd50,stackable:true},
  woodenBench:{label:'Wooden bench',icon:'▰',color:0x947044},
  logs:{label:'Logs',skill:'woodcutting',icon:'🪵',color:0x806340},
  ore:{label:'Copper ore',skill:'mining',icon:'◆',color:0xc39056},
  tin:{label:'Tin ore',skill:'mining',icon:'◆',color:0xbfcbd0},
  iron:{label:'Iron ore',skill:'mining',icon:'◆',color:0x925e49},
  coal:{label:'Coal',skill:'mining',icon:'◆',color:0x343b42},
  zinc:{label:'Zinc ore',skill:'mining',icon:'◆',color:0x829bab},
  nickel:{label:'Nickel ore',skill:'mining',icon:'◆',color:0xa1b780},
  copperBar:{label:'Copper bar',icon:'▰',color:0xc39056},bronzeBar:{label:'Bronze bar',icon:'▰',color:0xab8250},
  ironBar:{label:'Iron bar',icon:'▰',color:0xa0a6ac},steelBar:{label:'Steel bar',icon:'▰',color:0xc2d0dc},
  brassBar:{label:'Brass bar',icon:'▰',color:0xd5b05f},cupronickelBar:{label:'Cupronickel bar',icon:'▰',color:0xbac5a4}
};
export const METALS=[
 {id:'copper',label:'Copper',bar:'copperBar',tier:1,xp:20},{id:'bronze',label:'Bronze',bar:'bronzeBar',tier:2,xp:30},
 {id:'iron',label:'Iron',bar:'ironBar',tier:3,xp:40},{id:'steel',label:'Steel',bar:'steelBar',tier:4,xp:60},
 {id:'brass',label:'Brass',bar:'brassBar',tier:3,xp:40},{id:'cupronickel',label:'Cupronickel',bar:'cupronickelBar',tier:4,xp:60}
];
export const SMITHING_RECIPES=METALS.flatMap(m=>['axe','pickaxe'].map(tool=>{
 const output=m.id+(tool==='axe'?'Axe':'Pickaxe');ITEMS[output]={label:m.label+' '+tool,icon:tool==='axe'?'\u2692':'\u26cf',color:ITEMS[m.bar].color,equipmentSlot:'weapon',toolSkill:tool==='axe'?'woodcutting':'mining',tier:m.tier};
 return {id:m.id+'-'+tool,output,inputs:{[m.bar]:1,logs:1},xp:m.xp};
}));
for(const material of ['wooden','iron'])for(const contents of ['empty','water','milk']){const key=material+'Bucket'+(contents==='empty'?'':contents[0].toUpperCase()+contents.slice(1));ITEMS[key]={label:(material==='wooden'?'Wooden':'Iron')+' bucket'+(contents==='empty'?'':' of '+contents),icon:'🪣',color:material==='wooden'?0x987044:0xa0a6ac,equipmentSlot:'weapon',bucketMaterial:material,contents};}
export const BUCKET_RECIPES=[{id:'wooden-bucket',output:'woodenBucket',inputs:{logs:2},xp:20,skill:'crafting'},{id:'iron-bucket',output:'ironBucket',inputs:{ironBar:2},xp:40,skill:'smithing'}];
export const FISH={rawShrimp:{label:'Raw shrimp',tool:'net',level:1,xp:10,color:0xdb9b87},rawAnchovies:{label:'Raw anchovies',tool:'net',level:15,xp:40,color:0x98b4bf},rawSardine:{label:'Raw sardine',tool:'rod',level:1,xp:20,color:0xa1b7c7},rawHerring:{label:'Raw herring',tool:'rod',level:10,xp:30,color:0x849faa},rawTrout:{label:'Raw trout',tool:'rod',level:20,xp:50,color:0xb1bc8c},rawSalmon:{label:'Raw salmon',tool:'rod',level:30,xp:70,color:0xd8958c}};
for(const [id,fish] of Object.entries(FISH))ITEMS[id]={label:fish.label,skill:'fishing',icon:'🐟',color:fish.color};
ITEMS.fishingRod={label:'Fishing rod',icon:'🎣',color:0x96704a,equipmentSlot:'weapon',toolSkill:'fishing',fishingTool:'rod',tier:1};
ITEMS.fishingNet={label:'Fishing net',icon:'▦',color:0xc3b28c,equipmentSlot:'weapon',toolSkill:'fishing',fishingTool:'net',tier:1};
ITEMS.tinderbox={label:'Tinderbox',icon:'🔥',color:0xc59b62};
ITEMS.burntFish={label:'Burnt fish',icon:'🐟',color:0x45413c,burnt:true};
export const COOKING_RECIPES=Object.entries({rawShrimp:[1,30,3,34],rawAnchovies:[1,30,1,34],rawSardine:[1,40,4,35],rawHerring:[5,50,5,41],rawTrout:[15,70,7,50],rawSalmon:[25,90,9,58]}).map(([raw,[level,xp,heal,noBurn]])=>{const output=raw.replace('raw','cooked');ITEMS[output]={label:FISH[raw].label.replace('Raw','Cooked'),icon:'🐟',color:0xd2aa73,heal};return {raw,output,level,xp,heal,noBurn};});
export const burnChance=(recipe,cookingLevel)=>Math.max(0,.45*(recipe.noBurn-cookingLevel)/(recipe.noBurn-recipe.level));
export const FISHING_RECIPES=[{id:'fishing-rod',output:'fishingRod',inputs:{logs:2},xp:20,skill:'crafting'},{id:'fishing-net',output:'fishingNet',inputs:{logs:2},xp:20,skill:'crafting'}];
ITEMS.copperSword={label:'Copper sword',icon:'⚔',color:0xc39056,equipmentSlot:'weapon',melee:true,attackBonus:6,strengthBonus:4};
ITEMS.woodenShield={label:'Wooden shield',icon:'⬟',color:0x967044,equipmentSlot:'shield',defenceBonus:6};
export const WORKBENCH_RECIPES=[{id:'wooden-shield',output:'woodenShield',inputs:{logs:3},xp:30,skill:'crafting'},BUCKET_RECIPES[0],...FISHING_RECIPES,{id:'wooden-bench',output:'woodenBench',inputs:{logs:6},xp:40,skill:'construction'}];
export const ANVIL_RECIPES=[{id:'copper-sword',output:'copperSword',inputs:{copperBar:2,logs:1},xp:30,skill:'smithing'},...SMITHING_RECIPES,BUCKET_RECIPES[1]];
export const SHOP_STOCK=[{item:'tinderbox',price:1},{item:'woodenBucket',price:20},{item:'ironBucket',price:50},{item:'woodenBench',price:80},{item:'fishingRod',price:25},{item:'fishingNet',price:25}];
export const SHOP_BUYS={logs:2};
// The backpack displays one stack per item type, so capacity uses those same slots.
for(const item of Object.values(ITEMS))item.stackable=true;
export const itemSlots=(item,quantity)=>ITEMS[item]?.stackable?(quantity>0?1:0):quantity;
export const receiveCapacity=(p,item)=>ITEMS[item]?.stackable?(p.inventory[item]>0||inventoryCount(p)<28?Number.MAX_SAFE_INTEGER-p.inventory[item]:0):28-inventoryCount(p);
export const bucketItem=(material,contents='empty')=>material+'Bucket'+(contents==='empty'?'':contents[0].toUpperCase()+contents.slice(1));
export function bestTool(inventory,skill){return Object.keys(ITEMS).filter(key=>ITEMS[key].toolSkill===skill&&inventory[key]>0).sort((a,b)=>ITEMS[b].tier-ITEMS[a].tier)[0];}
export function gatheringDuration(inventory,skill){const tool=bestTool(inventory,skill);return tool?1600-ITEMS[tool].tier*120:1600;}
export const RECIPES = [
  {id:'copper',output:'copperBar',inputs:{ore:1},xp:15},
  {id:'bronze',output:'bronzeBar',inputs:{ore:1,tin:1},xp:25},
  {id:'iron',output:'ironBar',inputs:{iron:1},xp:20},
  {id:'steel',output:'steelBar',inputs:{iron:1,coal:2},xp:40},
  {id:'brass',output:'brassBar',inputs:{ore:1,zinc:1},xp:30},
  {id:'cupronickel',output:'cupronickelBar',inputs:{ore:1,nickel:1},xp:35}
];
export const STATIONS=[{id:'smeltery',name:'Village smeltery',x:20,y:11},{id:'workshop-anvil',type:'anvil',name:'Workshop anvil',x:18,y:11},{id:'quarry-anvil',type:'anvil',name:'Quarry anvil',x:45,y:49}];
export const emptyItems=()=>Object.fromEntries(Object.keys(ITEMS).map(key=>[key,0]));
export const SKILLS=[["attack", "Attack"], ["hitpoints", "Hitpoints"], ["mining", "Mining"], ["strength", "Strength"], ["agility", "Agility"], ["smithing", "Smithing"], ["defence", "Defence"], ["herblore", "Herblore"], ["fishing", "Fishing"], ["ranged", "Ranged"], ["thieving", "Thieving"], ["cooking", "Cooking"], ["prayer", "Prayer"], ["crafting", "Crafting"], ["firemaking", "Firemaking"], ["magic", "Magic"], ["fletching", "Fletching"], ["woodcutting", "Woodcutting"], ["runecraft", "Runecraft"], ["slayer", "Slayer"], ["farming", "Farming"], ["construction", "Construction"], ["hunter", "Hunter"], ["sailing", "Sailing"]];
export const EQUIPMENT_SLOTS=[['head','Head'],['body','Body'],['legs','Leggings'],['boots','Boots'],['weapon','Main hand'],['shield','Shield']];
export function equippedTool(p,skill){const item=p.equipment?.weapon;return ITEMS[item]?.toolSkill===skill?item:null;}
export function normalizePlayer(p){const counts=source=>Object.fromEntries(Object.keys(ITEMS).map(key=>[key,Number.isSafeInteger(source?.[key])&&source[key]>0?source[key]:0]));return {...p,energy:Number.isFinite(p.energy)?Math.max(0,Math.min(100,p.energy)):100,runEnabled:p.runEnabled===true&&(p.energy??100)>0,prayerPoints:Number.isFinite(p.prayerPoints)?Math.max(0,Math.min(level(p.xp?.prayer||0),p.prayerPoints)):level(p.xp?.prayer||0),hp:Number.isInteger(p.hp)&&p.hp>=0?Math.min(p.hp,Math.min(99,level(p.xp?.hitpoints??xpForLevel(10)))):Math.min(99,level(p.xp?.hitpoints??xpForLevel(10))),combatStyle:['controlled','attack','strength','defence'].includes(p.combatStyle)?p.combatStyle:'attack',equipment:Object.fromEntries(EQUIPMENT_SLOTS.map(([slot])=>[slot,ITEMS[p.equipment?.[slot]]?.equipmentSlot===slot?p.equipment[slot]:null])),inventory:counts(p.inventory),bank:counts(p.bank),xp:Object.fromEntries(SKILLS.map(([key])=>[key,Number.isFinite(p.xp?.[key])&&p.xp[key]>=0&&p.xp[key]<=Number.MAX_SAFE_INTEGER?p.xp[key]:key==='hitpoints'?xpForLevel(10):0]))};}
export const NPCS = [{id:'guide',name:'Rowan \u00b7 Guide',x:15,y:13},{id:'banker',name:'Bank clerk',type:'banker',x:12,y:23},{id:'banker-ellis',name:'Bank clerk',type:'banker',x:11,y:23},{id:'banker-tess',name:'Bank clerk',type:'banker',x:10,y:23},{id:'farm-cow',name:'Cow',type:'cow',x:27,y:37}];
export const NODE_DEFS = [
  {"id":"tree-0","kind":"tree","name":"Oak tree","item":"logs","x":8,"y":9},
  {"id":"tree-1","kind":"tree","name":"Oak tree","item":"logs","x":10,"y":8},
  {"id":"tree-2","kind":"tree","name":"Oak tree","item":"logs","x":7,"y":12},
  {"id":"tree-3","kind":"tree","name":"Oak tree","item":"logs","x":9,"y":13},
  {"id":"tree-4","kind":"tree","name":"Oak tree","item":"logs","x":21,"y":7},
  {"id":"tree-5","kind":"tree","name":"Oak tree","item":"logs","x":23,"y":4},
  {"id":"tree-6","kind":"tree","name":"Oak tree","item":"logs","x":31,"y":13},
  {"id":"tree-7","kind":"tree","name":"Oak tree","item":"logs","x":20,"y":27},
  {"id":"tree-8","kind":"tree","name":"Oak tree","item":"logs","x":9,"y":27},
  {"id":"rock-0","kind":"rock","name":"Copper rock","item":"ore","x":26,"y":24},
  {"id":"rock-1","kind":"rock","name":"Copper rock","item":"ore","x":26,"y":22},
  {"id":"rock-2","kind":"rock","name":"Copper rock","item":"ore","x":24,"y":24},
  {"id":"rock-3","kind":"rock","name":"Copper rock","item":"ore","x":28,"y":24},
  {"id":"tree-extra-0","kind":"tree","name":"Oak tree","item":"logs","x":12,"y":6},
  {"id":"tree-extra-1","kind":"tree","name":"Oak tree","item":"logs","x":18,"y":4},
  {"id":"tree-extra-2","kind":"tree","name":"Oak tree","item":"logs","x":18,"y":7},
  {"id":"tree-extra-3","kind":"tree","name":"Oak tree","item":"logs","x":20,"y":5},
  {"id":"tree-extra-4","kind":"tree","name":"Oak tree","item":"logs","x":24,"y":6},
  {"id":"tree-extra-5","kind":"tree","name":"Oak tree","item":"logs","x":28,"y":7},
  {"id":"tree-extra-6","kind":"tree","name":"Oak tree","item":"logs","x":30,"y":6},
  {"id":"tree-extra-7","kind":"tree","name":"Oak tree","item":"logs","x":30,"y":11},
  {"id":"tree-extra-8","kind":"tree","name":"Oak tree","item":"logs","x":31,"y":9},
  {"id":"tree-extra-9","kind":"tree","name":"Oak tree","item":"logs","x":24,"y":2},
  {"id":"tree-extra-10","kind":"tree","name":"Oak tree","item":"logs","x":8,"y":31},
  {"id":"tree-extra-11","kind":"tree","name":"Oak tree","item":"logs","x":10,"y":34},
  {"id":"tree-extra-12","kind":"tree","name":"Oak tree","item":"logs","x":12,"y":32},
  {"id":"tree-extra-13","kind":"tree","name":"Oak tree","item":"logs","x":13,"y":35},
  {"id":"tree-extra-14","kind":"tree","name":"Oak tree","item":"logs","x":19,"y":31},
  {"id":"tree-extra-15","kind":"tree","name":"Oak tree","item":"logs","x":21,"y":40},
  {"id":"tree-extra-16","kind":"tree","name":"Oak tree","item":"logs","x":24,"y":31},
  {"id":"tree-extra-17","kind":"tree","name":"Oak tree","item":"logs","x":36,"y":36},
  {"id":"tree-extra-18","kind":"tree","name":"Oak tree","item":"logs","x":8,"y":40},
  {"id":"tree-extra-19","kind":"tree","name":"Oak tree","item":"logs","x":8,"y":51},
  {"id":"tree-extra-20","kind":"tree","name":"Oak tree","item":"logs","x":14,"y":50},
  {"id":"tree-extra-21","kind":"tree","name":"Oak tree","item":"logs","x":15,"y":52},
  {"id":"tree-extra-22","kind":"tree","name":"Oak tree","item":"logs","x":22,"y":53},
  {"id":"tree-extra-23","kind":"tree","name":"Oak tree","item":"logs","x":27,"y":46},
  {"id":"tree-extra-24","kind":"tree","name":"Oak tree","item":"logs","x":29,"y":48},
  {"id":"tree-extra-25","kind":"tree","name":"Oak tree","item":"logs","x":28,"y":50},
  {"id":"tree-extra-26","kind":"tree","name":"Oak tree","item":"logs","x":30,"y":46},
  {"id":"tree-extra-27","kind":"tree","name":"Oak tree","item":"logs","x":40,"y":19},
  {"id":"tree-extra-28","kind":"tree","name":"Oak tree","item":"logs","x":43,"y":20},
  {"id":"tree-extra-29","kind":"tree","name":"Oak tree","item":"logs","x":47,"y":25},
  {"id":"tree-extra-30","kind":"tree","name":"Oak tree","item":"logs","x":50,"y":25},
  {"id":"tree-extra-31","kind":"tree","name":"Oak tree","item":"logs","x":54,"y":19},
  {"id":"tree-extra-32","kind":"tree","name":"Oak tree","item":"logs","x":56,"y":23},
  {"id":"tree-extra-33","kind":"tree","name":"Oak tree","item":"logs","x":59,"y":20},
  {"id":"tree-extra-34","kind":"tree","name":"Oak tree","item":"logs","x":60,"y":27},
  {"id":"tree-extra-35","kind":"tree","name":"Oak tree","item":"logs","x":39,"y":47},
  {"id":"tree-extra-36","kind":"tree","name":"Oak tree","item":"logs","x":35,"y":54},
  {"id":"tree-extra-37","kind":"tree","name":"Oak tree","item":"logs","x":35,"y":57},
  {"id":"tree-extra-38","kind":"tree","name":"Oak tree","item":"logs","x":40,"y":40},
  {"id":"tree-extra-39","kind":"tree","name":"Oak tree","item":"logs","x":58,"y":37},
  {"id":"tree-extra-40","kind":"tree","name":"Oak tree","item":"logs","x":60,"y":36},
  {"id":"tree-extra-41","kind":"tree","name":"Oak tree","item":"logs","x":59,"y":34},
  {"id":"rock-extra-0","kind":"rock","name":"Copper rock","item":"ore","x":26,"y":26},
  {"id":"rock-extra-1","kind":"rock","name":"Copper rock","item":"ore","x":24,"y":22},
  {"id":"rock-extra-2","kind":"rock","name":"Copper rock","item":"ore","x":28,"y":22},
  {"id":"rock-extra-3","kind":"rock","name":"Copper rock","item":"ore","x":28,"y":26},
  {"id":"rock-extra-4","kind":"rock","name":"Copper rock","item":"ore","x":23,"y":26},
  {"id":"rock-extra-5","kind":"rock","name":"Copper rock","item":"ore","x":22,"y":24},
  {"id":"rock-extra-6","kind":"rock","name":"Copper rock","item":"ore","x":53,"y":49},
  {"id":"rock-extra-7","kind":"rock","name":"Copper rock","item":"ore","x":53,"y":51},
  {"id":"rock-extra-8","kind":"rock","name":"Copper rock","item":"ore","x":51,"y":50},
  {"id":"rock-extra-9","kind":"rock","name":"Copper rock","item":"ore","x":55,"y":50},
  {"id":"rock-extra-10","kind":"rock","name":"Copper rock","item":"ore","x":51,"y":48},
  {"id":"rock-extra-11","kind":"rock","name":"Copper rock","item":"ore","x":55,"y":48},
  {"id":"rock-extra-12","kind":"rock","name":"Copper rock","item":"ore","x":51,"y":52},
  {"id":"rock-extra-13","kind":"rock","name":"Copper rock","item":"ore","x":55,"y":52},
  {"id":"rock-extra-14","kind":"rock","name":"Copper rock","item":"ore","x":53,"y":47},
  {"id":"rock-extra-15","kind":"rock","name":"Copper rock","item":"ore","x":53,"y":53},
  {"id":"rock-extra-16","kind":"rock","name":"Copper rock","item":"ore","x":49,"y":50},
  {"id":"rock-extra-17","kind":"rock","name":"Copper rock","item":"ore","x":57,"y":50},
  {"id":"rock-extra-18","kind":"rock","name":"Copper rock","item":"ore","x":51,"y":46},
  {"id":"tin-0","kind":"rock","name":"Tin ore rock","item":"tin","x":30,"y":24},
  {"id":"tin-1","kind":"rock","name":"Tin ore rock","item":"tin","x":26,"y":28},
  {"id":"tin-2","kind":"rock","name":"Tin ore rock","item":"tin","x":28,"y":20},
  {"id":"tin-3","kind":"rock","name":"Tin ore rock","item":"tin","x":24,"y":28},
  {"id":"iron-0","kind":"rock","name":"Iron ore rock","item":"iron","x":30,"y":22},
  {"id":"iron-1","kind":"rock","name":"Iron ore rock","item":"iron","x":55,"y":46},
  {"id":"iron-2","kind":"rock","name":"Iron ore rock","item":"iron","x":49,"y":48},
  {"id":"iron-3","kind":"rock","name":"Iron ore rock","item":"iron","x":57,"y":48},
  {"id":"iron-4","kind":"rock","name":"Iron ore rock","item":"iron","x":57,"y":52},
  {"id":"coal-0","kind":"rock","name":"Coal rock","item":"coal","x":51,"y":54},
  {"id":"coal-1","kind":"rock","name":"Coal rock","item":"coal","x":55,"y":54},
  {"id":"coal-2","kind":"rock","name":"Coal rock","item":"coal","x":53,"y":45},
  {"id":"coal-3","kind":"rock","name":"Coal rock","item":"coal","x":49,"y":53},
  {"id":"coal-4","kind":"rock","name":"Coal rock","item":"coal","x":53,"y":55},
  {"id":"zinc-0","kind":"rock","name":"Zinc ore rock","item":"zinc","x":49,"y":46},
  {"id":"zinc-1","kind":"rock","name":"Zinc ore rock","item":"zinc","x":57,"y":46},
  {"id":"zinc-2","kind":"rock","name":"Zinc ore rock","item":"zinc","x":57,"y":54},
  {"id":"zinc-3","kind":"rock","name":"Zinc ore rock","item":"zinc","x":47,"y":51},
  {"id":"nickel-0","kind":"rock","name":"Nickel ore rock","item":"nickel","x":51,"y":56},
  {"id":"nickel-1","kind":"rock","name":"Nickel ore rock","item":"nickel","x":55,"y":56},
  {"id":"nickel-2","kind":"rock","name":"Nickel ore rock","item":"nickel","x":49,"y":55},
  {"id":"nickel-3","kind":"rock","name":"Nickel ore rock","item":"nickel","x":53,"y":57},
  {"id":"forest-tree-0","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":15,"y":56},
  {"id":"forest-tree-1","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":14,"y":54},
  {"id":"forest-tree-2","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":7,"y":7},
  {"id":"forest-tree-3","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":7,"y":4},
  {"id":"forest-tree-4","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":10,"y":11},
  {"id":"forest-tree-5","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":9,"y":6},
  {"id":"forest-tree-6","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":8,"y":2},
  {"id":"forest-tree-7","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":24,"y":57},
  {"id":"forest-tree-8","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":10,"y":4},
  {"id":"forest-tree-9","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":11,"y":2},
  {"id":"forest-tree-10","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":26,"y":56},
  {"id":"forest-tree-11","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":12,"y":12},
  {"id":"forest-tree-12","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":28,"y":57},
  {"id":"forest-tree-13","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":12,"y":9},
  {"id":"forest-tree-14","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":29,"y":55},
  {"id":"forest-tree-15","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":29,"y":52},
  {"id":"forest-tree-16","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":27,"y":54},
  {"id":"forest-tree-17","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":26,"y":51},
  {"id":"forest-tree-18","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":19,"y":2},
  {"id":"forest-tree-19","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":25,"y":53},
  {"id":"forest-tree-20","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":23,"y":55},
  {"id":"forest-tree-21","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":21,"y":3},
  {"id":"forest-tree-22","kind":"tree","name":"Pine tree","species":"pine","item":"logs","x":32,"y":7},
  {"id":"forest-tree-23","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":39,"y":28},
  {"id":"forest-tree-24","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":41,"y":29},
  {"id":"forest-tree-25","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":43,"y":28},
  {"id":"forest-tree-26","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":43,"y":25},
  {"id":"forest-tree-27","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":42,"y":22},
  {"id":"forest-tree-28","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":33,"y":48},
  {"id":"forest-tree-29","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":41,"y":26},
  {"id":"forest-tree-30","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":40,"y":23},
  {"id":"forest-tree-31","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":33,"y":52},
  {"id":"forest-tree-32","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":31,"y":49},
  {"id":"forest-tree-33","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":32,"y":54},
  {"id":"forest-tree-34","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":39,"y":21},
  {"id":"forest-tree-35","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":39,"y":25},
  {"id":"forest-tree-36","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":31,"y":56},
  {"id":"forest-tree-37","kind":"tree","name":"Oak tree","species":"oak","item":"logs","x":48,"y":27}
];
export let SPAWN={x:15,y:15};
let customWorld=false;
export const BOUNDARIES=[];
const towerBlocked=new Set();
const blocked=new Set([...NODE_DEFS,...NPCS,...STATIONS].map(n=>`${n.x},${n.y}`));
function riverCentre(y,points){for(let i=1;i<points.length;i++){const [ay,ax]=points[i-1],[by,bx]=points[i];if(y<=by)return ax+(bx-ax)*(y-ay)/(by-ay);}return points.at(-1)[1];}
const westRiver=[[0,4],[18,4],[27,6],[36,4],[45,4],[63,7]],eastRiver=[[0,35],[18,35],[28,32],[36,33],[41,35],[45,35],[55,38],[63,39]];
export const LAND_AREAS=[{id:'north-quarry',kind:'quarry',cx:26,cy:24,rx:5,ry:5},{id:'highland-quarry',kind:'quarry',cx:53,cy:50,rx:10,ry:8},{id:'harvest-fields',kind:'field',x:25,y:34,width:5,height:6}];
export function landUseAt(x,y){return LAND_AREAS.find(a=>a.kind==='field'?x>=a.x&&x<a.x+a.width&&y>=a.y&&y<a.y+a.height:((x-a.cx)/a.rx)**2+((y-a.cy)/a.ry)**2<1)?.kind;}
function terrainAt(x,y) {
  if(x===0||y===0||x===63||y===63||y>61+Math.sin(x*.18))return 'water';
  const river=Math.abs(x-riverCentre(y,westRiver))<=1.25||Math.abs(x-riverCentre(y,eastRiver))<=1.25;
  const lake=((x-50)/8)**2+((y-9)/5)**2;
  if(lake<1)return 'water';
  if(river&&!BRIDGES.some(b=>Math.abs(x-b.x)<=1&&Math.abs(y-b.y)<=1))return 'water';
  if(roadAt(x,y))return 'path';
  if(lake<1.4||y>=59||x===1)return 'sand';
  if(((x-57)/5)**2+((y-50)/8)**2<1&&x>=59)return 'cliff';
  const landUse=landUseAt(x,y);if(landUse)return landUse;
  return 'grass';
}
export function biomeAt(x,y){const t=tile(x,y);if(['water','sand','quarry','cliff','field'].includes(t))return t;if(((x-23)/11)**2+((y-6)/7)**2<1||((x-9)/5)**2+((y-8)/7)**2<1)return 'forest';if(((x-23)/10)**2+((y-50)/9)**2<1)return 'grove';return 'meadow';}
export function tile(x,y){
  if(!inWorld(x,y))return 'void';const region=worldRegionAt(x,y);if(!region)return 'unbuilt';
  const base=baseTerrainAt(region,x,y);
  const building=BUILDINGS.find(b=>x>=b.x&&y>=b.y&&x<b.x+b.width&&y<b.y+b.height);
  if(!building)return base;
  if(building.ruin)return y===building.y||x===building.x||x===building.x+building.width-1?'wall':base;
  return building.open.some(([tx,ty])=>tx===x&&ty===y)?'floor':'wall';
}
// Navigation tiles describe walls and interiors; model buildings supply their own visible floors.
export function visibleTerrainAt(x,y){
 const building=BUILDINGS.find(b=>x>=b.x&&y>=b.y&&x<b.x+b.width&&y<b.y+b.height);
 if(!building||building.ruin||!(building.model||building.id==='bank'))return tile(x,y);
 const region=worldRegionAt(x,y);return region?baseTerrainAt(region,x,y):tile(x,y);
}
export function bridgeAt(x,y){return BRIDGES.find(b=>Math.abs(x-b.x)<=1&&Math.abs(y-b.y)<=1);}
function baseTerrainAt(region,x,y){const value=region.tiles?.[`${x-region.x},${y-region.y}`]??(region.terrain==='starter'?terrainAt(x,y):'grass'),bridge=bridgeAt(x,y);return value==='path'&&bridge&&bridge.surface!==true?(bridge.underlay?.find(t=>t.x===x&&t.y===y)?.terrain||'water'):value;}
export function normalizeBridgeTerrain(doc){for(const b of doc.bridges){if(b.surface===true)continue;for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){const x=b.x+dx,y=b.y+dy,r=doc.regions.find(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height);if(r&&r.tiles[`${x-r.x},${y-r.y}`]==='path')r.tiles[`${x-r.x},${y-r.y}`]=b.underlay?.find(t=>t.x===x&&t.y===y)?.terrain||'water';}b.surface=true;}return doc;}

export function validateBuildingPlacement(building,others=BUILDINGS){
  if(!building||!Number.isInteger(building.x)||!Number.isInteger(building.y)||!Number.isInteger(building.width)||!Number.isInteger(building.height)||building.width<1||building.height<1||building.width>REGION_SIZE||building.height>REGION_SIZE)return {ok:false,error:'Invalid building footprint.'};
  for(let y=building.y;y<building.y+building.height;y++)for(let x=building.x;x<building.x+building.width;x++){
    const region=worldRegionAt(x,y);if(!region)return {ok:false,error:'Buildings must be placed in a published region.'};
    const ground=baseTerrainAt(region,x,y);
    if(ground==='path'&&!(building.model==='castleGatehouse'&&building.open.some(p=>p[0]===x&&p[1]===y)))return {ok:false,error:'Building overlaps a road.'};
    if(!['grass','sand','floor','quarry',...(building.model==='castleGatehouse'?['path']:[])].includes(ground))return {ok:false,error:'Building needs dry land.'};
    if(others.some(b=>b!==building&&!(["castleRampart","castleGatehouse"].includes(building.model)&&["castleRampart","castleGatehouse"].includes(b.model))&&x>=b.x&&y>=b.y&&x<b.x+b.width&&y<b.y+b.height))return {ok:false,error:'Building overlaps another building.'};
    if([...NODE_DEFS,...NPCS,...STATIONS].some(n=>n.x===x&&n.y===y&&!building.occupants?.includes(n.id)))return {ok:false,error:'Building overlaps a resource or character.'};
  }
  if(NODE_DEFS.some(n=>n.kind==='tree'&&pointRectDistance(n.x,n.y,building.x-.5,building.y-.5,building.x+building.width-.5,building.y+building.height-.5)<TREE_RADIUS+TREE_BUILDING_GAP))return {ok:false,error:'Building is too close to a tree canopy.'};
  return {ok:true};
}
export function validateTreePlacement(tree,others=NODE_DEFS){
  if(!tree||!Number.isInteger(tree.x)||!Number.isInteger(tree.y)||tile(tree.x,tree.y)!=='grass')return {ok:false,error:'Trees must be on published grass.'};
  if(BUILDINGS.some(b=>pointRectDistance(tree.x,tree.y,b.x-.5,b.y-.5,b.x+b.width-.5,b.y+b.height-.5)<TREE_RADIUS+TREE_BUILDING_GAP))return {ok:false,error:'Tree is too close to a building.'};
  // Validate the canopy footprint, not just the trunk's tile.
  for(let y=tree.y-2;y<=tree.y+2;y++)for(let x=tree.x-2;x<=tree.x+2;x++)if(pointRectDistance(tree.x,tree.y,x-.5,y-.5,x+.5,y+.5)<TREE_RADIUS&&tile(x,y)!=='grass')return {ok:false,error:'Tree canopy overlaps non-grass terrain.'};
  if([...others,...NPCS,...STATIONS].some(n=>n!==tree&&Math.hypot(n.x-tree.x,n.y-tree.y)<TREE_RADIUS+(n.kind==='tree'?TREE_RADIUS:.5)))return {ok:false,error:'Tree overlaps another object.'};
  return {ok:true};
}
export function validateWorld(){
  for(const key of customWorld?[]:roadCells){const [x,y]=key.split(',').map(Number);if(landUseAt(x,y))throw Error('Road crosses field or quarry: '+key);}
  const ids=new Set();for(const r of WORLD_REGIONS){if(ids.has(r.id)||!inWorld(r.x,r.y)||r.x%REGION_SIZE||r.y%REGION_SIZE||r.width!==REGION_SIZE||r.height!==REGION_SIZE||r.x+r.width>SIZE||r.y+r.height>SIZE)throw Error('Invalid world region: '+r.id);ids.add(r.id);if(WORLD_REGIONS.some(other=>other!==r&&r.x<other.x+other.width&&r.x+r.width>other.x&&r.y<other.y+other.height&&r.y+r.height>other.y))throw Error('Overlapping world region: '+r.id);}
  regionIndex.clear();for(const r of WORLD_REGIONS)regionIndex.set(`${r.x/REGION_SIZE},${r.y/REGION_SIZE}`,r);
  for(const b of BUILDINGS){const result=validateBuildingPlacement(b);if(!result.ok)throw Error(b.id+': '+result.error);}
  for(const tree of NODE_DEFS.filter(n=>n.kind==='tree')){const result=validateTreePlacement(tree);if(!result.ok)throw Error(tree.id+': '+result.error);}
}
linkWorkshopBenches({buildings:BUILDINGS,stations:STATIONS});
validateWorld();
if(authoredWorld)applyWorldDocument(authoredWorld);
export function walkable(x,y) {const bridge=bridgeAt(x,y);return !towerBlocked.has(`${x},${y}`)&&!BUILDINGS.some(b=>workshopBlocked(b,x,y))&&!blocked.has(`${x},${y}`)&&(bridge?bridgeCrossing(bridge,x,y)&&!['wall','cliff','void','unbuilt'].includes(tile(x,y)):['grass','path','sand','floor','quarry','field'].includes(tile(x,y)));}
export function clearMovementEdge(x,y,nx,ny){
  const bridge=bridgeAt(x,y)||bridgeAt(nx,ny);if(bridge&&(!bridgeCrossing(bridge,x,y)||!bridgeCrossing(bridge,nx,ny)))return false;
  return !BANK_QUEUE_BARRIERS.some(r=>{const b=positionedQueueRope(r);
    if(b.axis==='horizontal'){if((y<b.y)===(ny<b.y))return false;const crossingX=x+(nx-x)*(b.y-y)/(ny-y);return crossingX>=b.x1-b.clearance&&crossingX<=b.x2+b.clearance;}if((x<b.x)===(nx<b.x))return false;
    const crossingY=y+(ny-y)*(b.x-x)/(nx-x);
    return crossingY>=b.y1-b.clearance&&crossingY<=b.y2+b.clearance;
  });
}
export function canStep(x,y,nx,ny){
  const dx=nx-x,dy=ny-y;
  return Math.abs(dx)<=1&&Math.abs(dy)<=1&&(dx!==0||dy!==0)&&walkable(nx,ny)&&Math.abs(groundHeight(nx,ny)-groundHeight(x,y))<=1.25*Math.hypot(dx,dy)&&clearMovementEdge(x,y,nx,ny)&&
    (!dx||!dy||(walkable(x+dx,y)&&walkable(x,y+dy)&&clearMovementEdge(x,y,x+dx,y)&&clearMovementEdge(x,y,x,y+dy)&&clearMovementEdge(x+dx,y,nx,ny)&&clearMovementEdge(x,y+dy,nx,ny)));
}

export function pathTo(sx,sy,tx,ty) {
  if (!walkable(sx,sy)||!walkable(tx,ty)) return null;
  const start=`${sx},${sy}`,end=`${tx},${ty}`,parents=new Map([[start,null]]),costs=new Map([[start,0]]),heap=[];
  const heuristic=(x,y)=>{const dx=Math.abs(tx-x),dy=Math.abs(ty-y);return Math.max(dx,dy)+(Math.SQRT2-1)*Math.min(dx,dy);};
  function push(node){heap.push(node);let i=heap.length-1;while(i>0){const p=(i-1)>>1;if(heap[p].f<=node.f)break;heap[i]=heap[p];i=p;}heap[i]=node;}
  function pop(){const first=heap[0],last=heap.pop();if(heap.length){let i=0;while(2*i+1<heap.length){let c=2*i+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return first;}
  push({x:sx,y:sy,g:0,f:heuristic(sx,sy)});
  let examined=0;while(heap.length) {
    const {x,y,g}=pop(),key=`${x},${y}`;if(g!==costs.get(key))continue;
    if(++examined>8192)return null;
    if(key===end){const path=[];let k=end;while(k!==start){path.push(k.split(',').map(Number));k=parents.get(k);}return path.reverse();}
    for(const [dx,dy] of [[1,1],[-1,-1],[1,-1],[-1,1],[1,0],[-1,0],[0,1],[0,-1]]) {const nx=x+dx,ny=y+dy,k=`${nx},${ny}`,cost=g+Math.hypot(dx,dy);if(canStep(x,y,nx,ny)&&cost<(costs.get(k)??Infinity)){costs.set(k,cost);parents.set(k,key);push({x:nx,y:ny,g:cost,f:cost+heuristic(nx,ny)});}}
  }
  return null;
}
// Indoor model furniture can extend beyond a station's integer interaction tile.
export function interactionApproaches(target){
 const directions=[[1,0],[-1,0],[0,1],[0,-1]],points=directions.map(([dx,dy])=>({x:target.x+dx,y:target.y+dy}));
 const station=['workbench','anvil','furnace','mill'].includes(target.type)||STATIONS.some(n=>n.id===target.id),npc=NPCS.some(n=>n.id===target.id)&&!['cow','enemy'].includes(target.type);if(!station&&!npc)return points;
 const bank=BUILDINGS.find(b=>b.occupants?.includes(target.id)||target.x>=b.x&&target.y>=b.y&&target.x<b.x+b.width&&target.y<b.y+b.height);
 if(!bank||target.type==='banker'&&!workshopFurnishings(bank).some(p=>p.source==='BankCounter'))return points;
 const interior=(x,y)=>x>=bank.x&&y>=bank.y&&x<bank.x+bank.width&&y<bank.y+bank.height&&tile(x,y)==='floor';
 for(const [dx,dy]of directions){const x=target.x+dx*2,y=target.y+dy*2;if(interior(x,y)&&interior(target.x+dx,target.y+dy))points.push({x,y});}
 return points.filter(p=>interior(p.x,p.y));
}
export function inInteractionRange(player,target){return interactionApproaches(target).some(p=>p.x===player.x&&p.y===player.y);}
export function adjacentPath(player,target) {
  const cost=path=>{let x=player.x,y=player.y,total=0;for(const [nx,ny] of path){total+=Math.hypot(nx-x,ny-y);x=nx;y=ny;}return total;};
  const approaches=interactionApproaches(target);for(const range of [1,2]){const routes=approaches.filter(p=>Math.abs(p.x-target.x)+Math.abs(p.y-target.y)===range).map(p=>pathTo(player.x,player.y,p.x,p.y)).filter(p=>p!==null);if(routes.length)return routes.sort((a,b)=>cost(a)-cost(b))[0];}return null;
}
export const distance=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
export const level=levelForXp;
export const inventoryCount=p=>Object.entries(p.inventory).reduce((a,[item,n])=>a+itemSlots(item,n),0);

// World documents contain data only; never executable source.
export function exportWorldDocument(){return {version:1,mapIcons:structuredClone(MAP_ICONS),spawn:{...SPAWN},regions:WORLD_REGIONS.map(r=>({...structuredClone(r),terrain:'grass',tiles:Object.fromEntries(Array.from({length:4096},(_,i)=>{const x=i%64,y=Math.floor(i/64);return [`${x},${y}`,baseTerrainAt(r,r.x+x,r.y+y)];}))})),buildings:BUILDINGS.map(b=>({...structuredClone(b),open:b.open||[],roofColor:b.roofColor??0x826149})),areas:areaPolygons(REGIONS,WORLD_REGIONS),nodes:structuredClone(NODE_DEFS),npcs:NPCS.map(n=>({...structuredClone(n),type:n.type||(n.id==='guide'?'guide':'resident')})),stations:structuredClone(STATIONS),bridges:BRIDGES.map(b=>({...structuredClone(b),surface:true})),barriers:structuredClone(BANK_QUEUE_BARRIERS),boundaries:structuredClone(BOUNDARIES)};}
function checkDocument(d){
 if(!d||d.version!==1)throw Error('Unsupported world document.');
 d.boundaries??=[];
 for(const [key,max] of [['regions',16],['buildings',200],['areas',200],['nodes',1000],['npcs',200],['stations',200],['bridges',100],['barriers',200],['boundaries',2000]])if(!Array.isArray(d[key])||d[key].length>max)throw Error('Invalid '+key+' list.');
 if(!d.regions.length||!d.areas.length)throw Error('Keep at least one region and named area.');
 const coord=n=>n&&Number.isInteger(n.x)&&Number.isInteger(n.y)&&inWorld(n.x,n.y);
 const name=n=>typeof n==='string'&&n.trim().length>0&&n.length<=80&&!/[\u0000-\u001f]/.test(n);
 const id=n=>typeof n==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(n)&&!['constructor','prototype','__proto__'].includes(n);
 if(d.mapIcons!==undefined&&(d.mapIcons===null||Array.isArray(d.mapIcons)||typeof d.mapIcons!=='object'||Object.keys(d.mapIcons).length>1000||Object.entries(d.mapIcons).some(([key,value])=>['__proto__','constructor','prototype'].includes(key)||key.length>200||!coord(value))))throw Error('Invalid map icon position.');
 if(!coord(d.spawn))throw Error('Invalid starting square.');
 for(const n of d.npcs)if(n.rotation!==undefined&&(!Number.isFinite(n.rotation)||n.rotation<0||n.rotation>=360))throw Error('NPC facing must be between 0 and 360 degrees.');
 for(const n of d.npcs)if(n.type==='cow'&&n.variant!==undefined&&!['holstein','brown','jersey','black'].includes(n.variant))throw Error('Invalid cow variant.');
 for(const n of d.npcs)if(n.type==='enemy'&&n.combatLevel!==undefined&&(!Number.isInteger(n.combatLevel)||n.combatLevel<1||n.combatLevel>99))throw Error('Enemy level must be 1–99.');
 const cells=new Set();for(const b of d.boundaries){const key=b.x+','+b.y;if(b.tower!==undefined&&(typeof b.tower!=="boolean"||b.type!=="fortressWall"))throw Error("Only fortress walls can have corner towers.");if(!coord(b)||!['fence','romanWall','fortressWall','gate'].includes(b.type)||cells.has(key))throw Error('Invalid or overlapping fence / wall segment.');cells.add(key);}
 const ids=new Set();for(const n of [...d.buildings,...d.nodes,...d.npcs,...d.stations]){if(!coord(n)||!id(n.id)||ids.has((d.buildings.includes(n)?'building:':'object:')+n.id))throw Error('Invalid or duplicate object: '+n?.id);ids.add((d.buildings.includes(n)?'building:':'object:')+n.id);}
 for(const r of d.regions){validateElevations(r);if(!id(r.id)||!name(r.name)||!coord(r)||r.width!==64||r.height!==64||typeof r.published!=='boolean'||!r.tiles||typeof r.tiles!=='object'||Object.keys(r.tiles).length!==4096)throw Error('Invalid region '+r.id);for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(!['grass','path','sand','water','quarry','field','cliff'].includes(r.tiles[`${x},${y}`]))throw Error('Invalid terrain in '+r.id);}
 for(const a of d.areas){if(a.combatZone!==undefined&&!['pve','pvp'].includes(a.combatZone))throw Error('Invalid combat zone.');if(!coord(a)||!name(a.name))throw Error('Invalid area name or location.');if(a.polygon&&(!Array.isArray(a.polygon)||a.polygon.length<3||a.polygon.length>64||a.polygon.some(p=>!Array.isArray(p)||p.length!==2||p.some(v=>!Number.isFinite(v)||v<-.5||v>SIZE-.5))||!simpleAreaPolygon(a.polygon)))throw Error('Invalid area border: '+a.name);}
 for(const b of d.buildings){if(['offsetX','offsetY'].some(k=>b[k]!==undefined&&(!Number.isFinite(b[k])||Math.abs(b[k])>.5)))throw Error('Building fine offsets must be between -0.5 and 0.5 tiles.');if(b.rotation!==undefined&&![0,90,180,270].includes(b.rotation))throw Error('Invalid building rotation.');const dims=buildingDimensions(b);if(['cityTownhouse','cityCivicHall'].includes(b.model)&&(dims.width<6||dims.height<6))throw Error('Multi-storey buildings need at least 6 by 6 tiles.');if(b.model!==undefined&&!['','medievalHouse','medievalWorkshop','medievalSmithy','medievalBank','medievalBankVault',...Object.keys(VILLAGE_MODELS)].includes(b.model))throw Error('Unknown building model.');if(b.model==='medievalBankVault'&&(dims.width<7||dims.height<14))throw Error('Vault banks need at least 7 by 14 tiles.');if(b.model==='medievalBank'&&(dims.width<5||dims.height<7))throw Error('Banks need at least 5 by 7 tiles.');if(b.model==='medievalHouse'&&(dims.width<5||dims.height<4))throw Error('Medieval houses need at least 5 by 4 tiles.');if(b.model==='medievalWorkshop'&&(dims.width<8||dims.height<8))throw Error('Workshops need at least 8 by 8 tiles.');if(b.model==='medievalSmithy'&&(dims.width<6||dims.height<8))throw Error('Smithies need at least 6 by 8 tiles.');if(b.furnishings!==undefined&&(!Array.isArray(b.furnishings)||b.furnishings.length>200||new Set(b.furnishings.map(p=>p.id)).size!==b.furnishings.length||b.furnishings.some(p=>!(FURNISHING_PARTS.some(a=>a[0]===p.id)||typeof p.id==='string'&&/^[A-Za-z0-9_]{1,100}$/.test(p.id)&&FURNISHING_PARTS.some(a=>a[0]===p.source))||p.stationId!==undefined&&(!b.occupants.includes(p.stationId)||!d.stations.some(n=>n.id===p.stationId&&(n.type||'furnace')===furnishingStationType(p.source||p.id)))||!['x','y','height','rotation'].every(k=>Number.isFinite(p[k]))||Math.abs(p.x)>(b.width-1)/2||Math.abs(p.y)>(b.height-1)/2||p.height<0||p.height>4||Math.abs(p.rotation)>360)))throw Error('Invalid workshop furnishing.');if(b.name!==undefined&&(typeof b.name!=='string'||b.name.length>80||/[\u0000-\u001f]/.test(b.name)))throw Error('Invalid building name.');if(b.showName!==undefined&&typeof b.showName!=='boolean')throw Error('Invalid building name visibility.');if(!Array.isArray(b.open)||b.open.length>4096||!Array.isArray(b.occupants)||b.occupants.some(v=>!ids.has('object:'+v))||!Number.isInteger(b.roofColor??0)||b.roofColor<0||b.roofColor>0xffffff)throw Error('Invalid building '+b.id);for(const v of b.open)if(!Array.isArray(v)||v.length!==2||!v.every(Number.isInteger)||v[0]<b.x||v[1]<b.y||v[0]>=b.x+b.width||v[1]>=b.y+b.height)throw Error('Floor is outside '+b.id);if(b.door&&!b.open.some(v=>v[0]===b.door[0]&&v[1]===b.door[1]))throw Error('Door needs an open floor square.');}
 for(const n of d.nodes){if(n.kind==='tree'&&n.rotation!==undefined&&(!Number.isFinite(n.rotation)||n.rotation<0||n.rotation>=360))throw Error('Invalid tree rotation '+n.id);if(!name(n.name)||!['tree','rock','fishing'].includes(n.kind)||(n.kind==='tree'?n.item!=='logs':n.kind==='rock'?!['ore','tin','iron','coal','zinc','nickel'].includes(n.item):!FISH[n.item])||(n.species&&!['oak','pine'].includes(n.species)))throw Error('Invalid resource '+n.id);if(n.kind==='fishing'&&(!['rod','net'].includes(n.tool)||!Array.isArray(n.fish)||!n.fish.length||n.fish.length>6||new Set(n.fish).size!==n.fish.length||n.fish.some(id=>FISH[id]?.tool!==n.tool)||!n.fish.includes(n.item)))throw Error('Invalid fishing tool / fish selection: '+n.id);}
 for(const n of d.npcs)if(!name(n.name)||!['guide','banker','smith','smelter','resident','cow','portmaster','mage','merchant','enemy'].includes(n.type||'guide')||typeof (n.dialogue||'')!=='string'||(n.dialogue||'').length>1000)throw Error('Invalid NPC '+n.id);
 for(const n of d.npcs)if(n.destinationName!==undefined&&!name(n.destinationName))throw Error('Invalid travel destination name: '+n.id);
 for(const n of d.stations)if(!name(n.name)||!['anvil','furnace','workbench'].includes(n.type||'furnace'))throw Error('Invalid station '+n.id);
 if(!d.stations.some(n=>n.id==='smeltery'&&(!n.type||n.type==='furnace')))throw Error('Keep the primary smeltery station.');
 for(const b of d.bridges)if(!coord(b)||![0,90,180,270].includes(bridgeRotation(b))||b.width!==3||b.length!==3||(b.underlay&&(!Array.isArray(b.underlay)||b.underlay.length>15||b.underlay.some(t=>!coord(t)||!['grass','path','sand','water','quarry','field','cliff'].includes(t.terrain)))))throw Error('Bridges must be centered three-by-three decks.');
 for(const b of d.barriers)if((b.axis==='horizontal'?(!Number.isFinite(b.y)||!Number.isFinite(b.x1)||!Number.isFinite(b.x2)||b.x1>b.x2):(!Number.isFinite(b.x)||!Number.isFinite(b.y1)||!Number.isFinite(b.y2)||b.y1>b.y2))||b.clearance!==.35)throw Error('Invalid queue rope.');
}
function assignDocument(d){
 linkWorkshopBenches(d);
 for(const key of Object.keys(MAP_ICONS))delete MAP_ICONS[key];Object.assign(MAP_ICONS,structuredClone(d.mapIcons||{}));
 for(const [target,key] of [[WORLD_REGIONS,'regions'],[BUILDINGS,'buildings'],[REGIONS,'areas'],[NODE_DEFS,'nodes'],[NPCS,'npcs'],[STATIONS,'stations'],[BRIDGES,'bridges'],[BANK_QUEUE_BARRIERS,'barriers'],[BOUNDARIES,'boundaries']])target.splice(0,target.length,...structuredClone(d[key]));
 SPAWN={...d.spawn};customWorld=true;regionIndex.clear();for(const r of WORLD_REGIONS)regionIndex.set(`${r.x/64},${r.y/64}`,r);blocked.clear();towerBlocked.clear();for(const b of BOUNDARIES)if(b.tower)for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)towerBlocked.add(`${b.x+dx},${b.y+dy}`);for(const n of [...NODE_DEFS,...NPCS.filter(n=>!['cow','enemy'].includes(n.type)),...STATIONS,...BOUNDARIES.filter(n=>n.type!=='gate')])blocked.add(`${n.x},${n.y}`);
}
function unreachableBuildingFloors(b,seen){
 const points=new Map(b.open.filter(([x,y])=>walkable(x,y)&&!seen.has(`${x},${y}`)).map(p=>[p.join(','),p])),bad=[];
 while(points.size){const first=points.values().next().value,component=[first];points.delete(first.join(','));for(let i=0;i<component.length;i++){const [x,y]=component[i];for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const key=`${x+dx},${y+dy}`;if(points.has(key)&&canStep(x,y,x+dx,y+dy)){component.push(points.get(key));points.delete(key);}}}
  // A single empty grid pocket beside model furniture is not a usable room or workstation.
  const [x,y]=first,tiny=component.length===1&&[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>workshopBlocked(b,x+dx,y+dy));
  const staff=workshopFurnishings(b).some(p=>p.source==='BankCounter')&&component.every(([x,y])=>NPCS.some(n=>n.type==='banker'&&b.occupants.includes(n.id)&&Math.abs(n.x-x)+Math.abs(n.y-y)===1));
  if(!tiny&&!staff)bad.push(...component);
 }
 return bad;
}
function reachableWorldTiles(){
 const seen=new Set(),queue=[];const add=(x,y)=>{const key=x+','+y;if(!seen.has(key)){seen.add(key);queue.push([x,y]);}};add(SPAWN.x,SPAWN.y);
 const ports=NPCS.filter(n=>n.type==='portmaster'),mages=NPCS.filter(n=>n.type==='mage');for(const n of [...ports,...mages])if(!travelLanding(n))throw Error('Travel destination needs a clear arrival tile: '+n.name);
 for(const n of mages){const landing=travelLanding(n);add(landing.x,landing.y);}let portsConnected=false;
 for(let i=0;i<queue.length;i++){const [x,y]=queue[i];for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(canStep(x,y,nx,ny))add(nx,ny);}if(!portsConnected&&ports.some(n=>Math.abs(n.x-x)+Math.abs(n.y-y)===1)){portsConnected=true;for(const n of ports){const landing=travelLanding(n);add(landing.x,landing.y);}}}

 return seen;
}
export function applyWorldDocument(input){
 const d=JSON.parse(JSON.stringify(input));checkDocument(d);normalizeBridgeTerrain(d);const old=exportWorldDocument(),wasCustom=customWorld;
 try{assignDocument(d);validateWorld();for(const b of BOUNDARIES){if(!['grass','sand','quarry','field',...(b.type==='gate'?['path']:[])].includes(tile(b.x,b.y))||BUILDINGS.some(n=>b.x>=n.x&&b.y>=n.y&&b.x<n.x+n.width&&b.y<n.y+n.height)||[...NODE_DEFS,...NPCS,...STATIONS].some(n=>Math.hypot(n.x-b.x,n.y-b.y)<1))throw Error('Fence / wall overlaps a road, building, water or object at '+b.x+', '+b.y);}for(const b of BRIDGES)for(let dx=-1;dx<=1;dx++)if(!walkable(b.x+bridgeWorldOffset(b,dx,0)[0],b.y+bridgeWorldOffset(b,dx,0)[1]))throw Error('Bridge deck needs clear crossing tiles at '+b.x+', '+b.y);if(!walkable(SPAWN.x,SPAWN.y))throw Error('Starting square must be clear walkable land.');
 const seen=reachableWorldTiles();

 for(const n of millStations())if(!interactionApproaches(n).some(p=>seen.has(`${p.x},${p.y}`)))throw Error('Unreachable mill workstation: '+n.building);
 const occupied=new Set();for(const n of [...NODE_DEFS,...NPCS,...STATIONS]){const key=`${n.x},${n.y}`;if(occupied.has(key))throw Error('Objects overlap at '+key);occupied.add(key);const t=tile(n.x,n.y);if(n.kind==='fishing'&&t!=='water')throw Error('Fishing spot must be on water: '+n.name);if(n.kind==='rock'&&!['grass','quarry','sand'].includes(t))throw Error('Ore must be on dry land: '+n.name);if(NPCS.includes(n)&&!['grass','path','sand','floor','quarry','field'].includes(t))throw Error('NPC needs open land or floor: '+n.name);if(!interactionApproaches(n).some(p=>seen.has(`${p.x},${p.y}`)))throw Error('Unreachable object: '+n.name);}
 for(const b of BUILDINGS)if(!b.ruin&&b.model!=="castleRampart"){if(!b.open.some(([x,y])=>walkable(x,y)))throw Error('Building needs an open interior: '+b.id);const missing=unreachableBuildingFloors(b,seen);if(missing.length)throw Error('Unreachable building floor: '+b.id+' at '+missing[0].join(', '));}

 return exportWorldDocument();
 }catch(e){assignDocument(old);customWorld=wasCustom;throw e;}
}

export function mapLandmarks(doc){
 const stations=doc?.stations||STATIONS,npcs=doc?.npcs||NPCS,buildings=doc?.buildings||BUILDINGS,nodes=doc?.nodes||NODE_DEFS,areas=doc?.areas||REGIONS,regions=doc?.regions||publishedRegions();
 const areaName=(x,y)=>{if(!doc)return regionAt(x,y);const r=regions.find(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height),a=areas.find(a=>a.polygon&&pointInArea(x,y,a.polygon));return a?.name||r?.name||'Unknown area';};
 const places=stations.map(n=>({id:'station:'+n.id,name:n.name,symbol:n.type==='workbench'?'W':n.type==='anvil'?'⚒':'♨',x:n.x,y:n.y,detail:n.type==='workbench'?'Woodworking · Buckets, fishing gear and furniture':n.type==='anvil'?'Smithing · Metal tools and buckets':'Smelting · Six metal recipes'}));
 places.push(...buildings.filter(b=>b.model==='medievalMilitary').map(b=>({id:'building:'+b.id,name:b.name||'Military barracks',symbol:'⚔',x:b.x+(b.width-1)/2,y:b.y+(b.height-1)/2,tx:b.door?.[0]??b.x,ty:b.door?.[1]??b.y,detail:'Military barracks / training hall'})));
 places.push(...buildings.filter(b=>['medievalCookhouse','medievalMill'].includes(b.model)).map(b=>({id:'building:'+b.id,name:b.name||VILLAGE_MODELS[b.model].name,symbol:b.model==='medievalCookhouse'?'🍞':'🌾',x:b.x+(b.width-1)/2,y:b.y+(b.height-1)/2,tx:b.door?.[0]??b.x,ty:b.door?.[1]??b.y,detail:b.model==='medievalCookhouse'?'Cooking house / bakery':'Grain mill'})));
 const travel=npcs.filter(n=>['portmaster','mage'].includes(n.type)).map(n=>({id:'npc:'+n.id,name:n.destinationName||n.name,symbol:n.type==='portmaster'?'P':'✦',x:n.x,y:n.y,detail:n.type==='portmaster'?'Port · Travel to other ports':'Magic · Teleport destination'}));places.push(...travel);
 places.push(...npcs.filter(n=>n.type==='merchant').map(n=>({id:'npc:'+n.id,name:n.name,symbol:'S',x:n.x,y:n.y,detail:'Workshop shop · Buy items or sell logs'})));
 const banks=new Map();for(const n of npcs.filter(n=>n.type==='banker')){const b=buildings.find(b=>n.x>=b.x&&n.x<b.x+b.width&&n.y>=b.y&&n.y<b.y+b.height),id=b?.id||n.id;if(!banks.has(id))banks.set(id,{id:'bank:'+id,name:b?.name||areaName(n.x,n.y)+' Bank',symbol:'B',x:n.x,y:n.y,detail:'Bank clerk · Store items'});}places.push(...banks.values());
 const groups=new Map();for(const n of nodes){const area=areas.reduce((a,b)=>Math.hypot(n.x-a.x,n.y-a.y)<Math.hypot(n.x-b.x,n.y-b.y)?a:b,areas[0]),key=n.kind+':'+area.name;if(!groups.has(key))groups.set(key,{area,kind:n.kind,nodes:[]});groups.get(key).nodes.push(n);}
 for(const n of nodes.filter(n=>n.kind==='fishing'))places.push({id:'fishing:'+n.id,name:n.name,symbol:'🎣',x:n.x,y:n.y,tx:n.x,ty:n.y,detail:(n.tool==='rod'?'Fishing rod':'Fishing net')+' · '+n.fish.map(id=>FISH[id].label+' (level '+FISH[id].level+')').join(', ')});
 for(const g of groups.values()){if(g.kind==='fishing')continue;if(g.kind==='tree'&&g.nodes.length<6)continue;places.push({id:'resource:'+g.kind+':'+g.nodes.map(n=>n.id).sort()[0],name:g.area.name+(g.kind==='tree'?' Woodland':''),symbol:g.kind==='tree'?'♠':'⛏',x:Math.round(g.nodes.reduce((s,n)=>s+n.x,0)/g.nodes.length),y:Math.round(g.nodes.reduce((s,n)=>s+n.y,0)/g.nodes.length),tx:g.nodes[0].x,ty:g.nodes[0].y,detail:(g.kind==='tree'?'Woodcutting · ':'Mining · ')+[...new Set(g.nodes.map(n=>ITEMS[n.item].label))].join(', ')});}
 const herds=[];for(const cow of npcs.filter(n=>n.type==='cow')){let herd=herds.find(h=>h.some(n=>Math.hypot(n.x-cow.x,n.y-cow.y)<=8));if(!herd){herd=[];herds.push(herd);}herd.push(cow);}
 for(const herd of herds){const x=Math.round(herd.reduce((sum,n)=>sum+n.x,0)/herd.length),y=Math.round(herd.reduce((sum,n)=>sum+n.y,0)/herd.length);places.push({id:'cows:'+herd.map(n=>n.id).sort()[0],name:areaName(x,y)+' · Cows',symbol:'🐄',x,y,detail:'Cows · Milk with an equipped empty bucket'});}
 const fields=new Map();for(const r of regions.filter(r=>r.published))for(let y=r.y;y<r.y+64;y++)for(let x=r.x;x<r.x+64;x++)if((doc?r.tiles[(x-r.x)+','+(y-r.y)]:tile(x,y))==='field'){const name=areaName(x,y);if(!fields.has(name))fields.set(name,{id:'field:'+r.id+':'+name,name,symbol:'F',x,y,detail:'Farmland · Fields'});}places.push(...fields.values());
 return places.map(p=>({...p,tx:p.tx??p.x,ty:p.ty??p.y,...((doc?(doc.mapIcons||{}):MAP_ICONS)[p.id]||{})}));
}

export function placeEditorBridge(doc,x,y,rotation=0){
 if(![0,90,180,270].includes(rotation))throw Error("Bridge rotation must use quarter turns.");const orientation={rotation},vertical=rotation%180===90,hx=vertical?1:2,hy=vertical?2:1;
 const r=doc.regions.find(r=>x>=r.x+hx&&x<r.x+64-hx&&y>=r.y+hy&&y<r.y+64-hy);
 if(!r)throw Error('Keep the bridge and its approaches inside a region.');
 if(doc.bridges.some(b=>Math.abs(b.x-x)<=2&&Math.abs(b.y-y)<=2))throw Error('This bridge overlaps another bridge.');
 const underlay=[];for(let dy=-1;dy<=1;dy++)for(let dx=-2;dx<=2;dx++){const [wx,wy]=bridgeWorldOffset(orientation,dx,dy),xx=x+wx,yy=y+wy,key=`${xx-r.x},${yy-r.y}`;underlay.push({x:xx,y:yy,terrain:r.tiles[key]});}
 const b={x,y,width:3,length:3,underlay,surface:true,rotation};doc.bridges.push(b);for(const t of underlay)if((vertical?Math.abs(t.y-y):Math.abs(t.x-x))===2&&t.terrain!=='water')r.tiles[`${t.x-r.x},${t.y-r.y}`]='path';return b;
}
export function removeEditorBridge(doc,index){
 const b=doc.bridges[index];if(!b)return;
 const tiles=b.underlay||Array.from({length:9},(_,i)=>({x:b.x+i%3-1,y:b.y+Math.floor(i/3)-1,terrain:'water'}));
 for(const t of tiles){const r=doc.regions.find(r=>t.x>=r.x&&t.x<r.x+64&&t.y>=r.y&&t.y<r.y+64);if(r&&Math.abs(t.x-b.x)<=2&&Math.abs(t.y-b.y)<=2&&['grass','path','sand','water','quarry','field','cliff'].includes(t.terrain))r.tiles[`${t.x-r.x},${t.y-r.y}`]=t.terrain;}
 doc.bridges.splice(index,1);
}

// Combat uses the existing game XP curve, with Hitpoints starting at level 10.
export function playerLevels(xp){return Object.fromEntries(Object.entries(xp).map(([key,value])=>[key,Math.min(99,level(value))]));}
export function playerRating(xp){const l=playerLevels(xp);const base=.25*(l.defence+l.hitpoints+Math.floor(l.prayer/2));const style=.325*Math.max(l.attack+l.strength,Math.floor(l.ranged*1.5),Math.floor(l.magic*1.5));return {combatLevel:Math.floor(base+style),totalLevel:Object.values(l).reduce((a,b)=>a+b,0)};}

export function copyEditorSelection(doc,refs){
 const entries=refs.filter(r=>r.collection!=='regions').map(r=>({collection:r.collection,object:doc[r.collection]?.[r.index]})).filter(e=>e.object);
 for(const e of [...entries])if(e.collection==='buildings')for(const key of ['npcs','stations'])for(const n of doc[key])if(e.object.occupants?.includes(n.id)&&!entries.some(v=>v.collection===key&&v.object===n))entries.push({collection:key,object:n});
 if(!entries.length)return null;return {x:Math.min(...entries.map(e=>e.object.x)),y:Math.min(...entries.map(e=>e.object.y)),entries:structuredClone(entries)};
}
function stagePasteEditorSelection(doc,clip,x,y,newId){
 if(!clip)return [];const dx=x-clip.x,dy=y-clip.y,refs=[],ids=new Map();for(const e of clip.entries)if(e.object.id)ids.set(e.object.id,newId(e.collection));
 for(const e of clip.entries){const n=structuredClone(e.object);n.x+=dx;n.y+=dy;if(n.polygon){n.polygon=n.polygon.map(([x,y])=>[x+dx,y+dy]);if(n.polygon.some(p=>p.some(v=>v<-.5||v>SIZE-.5)))throw Error('Keep the entire area border inside the world. Use Move area for precise adjustment.');}if(n.id)n.id=ids.get(n.id);if(e.collection==='buildings'){n.open=n.open.map(([a,b])=>[a+dx,b+dy]);if(n.door)n.door=[n.door[0]+dx,n.door[1]+dy];n.occupants=(n.occupants||[]).map(id=>ids.get(id)||id);if(n.furnishings)for(const p of n.furnishings)if(p.stationId)p.stationId=ids.get(p.stationId)||p.stationId;}if(e.collection==='bridges'){placeEditorBridge(doc,n.x,n.y,n.rotation||0);refs.push({collection:'bridges',index:doc.bridges.length-1});}else{doc[e.collection]??=[];doc[e.collection].push(n);refs.push({collection:e.collection,index:doc[e.collection].length-1});}}
 for(const ref of refs)assertEditorPlacement(doc,ref.collection,doc[ref.collection][ref.index]);
 return refs;
}
export function pasteEditorSelection(doc,clip,x,y,newId){const next=structuredClone(doc),refs=stagePasteEditorSelection(next,clip,x,y,newId);Object.assign(doc,next);return refs;}
export function deleteEditorSelection(doc,refs){
 const unique=[...new Map(refs.map(r=>[r.collection+':'+r.index,r])).values()];
 if(unique.some(r=>r.collection==='regions'||r.collection==='stations'&&doc.stations[r.index]?.id==='smeltery'))throw Error('Keep regions and the primary furnace; move them instead.');
 if(unique.filter(r=>r.collection==='areas').length>=doc.areas.length)throw Error('Keep at least one named area.');
 for(const r of unique.sort((a,b)=>b.index-a.index))if(doc[r.collection]?.[r.index]){if(r.collection==='bridges')removeEditorBridge(doc,r.index);else doc[r.collection].splice(r.index,1);}
}
export function editorWorldIssues(input){
 const issues=[],old=exportWorldDocument(),wasCustom=customWorld;let d;
 const mark=(collection,index,message)=>{if(!issues.some(i=>i.collection===collection&&i.index===index))issues.push({collection,index,message});};
 try{d=structuredClone(input);for(const key of ['buildings','nodes','npcs','stations','boundaries','bridges'])if(Array.isArray(d[key]))d[key].forEach((n,i)=>{if(!Number.isInteger(n.x)||!Number.isInteger(n.y)||!inWorld(n.x,n.y))mark(key,i,'Invalid coordinates.');if(key==='boundaries'&&!['fence','romanWall','fortressWall','gate'].includes(n.type))mark(key,i,'Unknown fence / wall model.');if(key==='boundaries')d[key].forEach((b,j)=>{if(i!==j&&n.x===b.x&&n.y===b.y)mark(key,i,'Overlapping wall segments.');});});checkDocument(d);try{applyWorldDocument(d);}catch(e){const match=/at (\d+), (\d+)/.exec(e.message);let found=false;for(const key of ['buildings','nodes','npcs','stations','boundaries'])d[key].forEach((n,i)=>{if(n.id&&e.message.includes(n.id)||n.name&&e.message.endsWith(': '+n.name)||match&&n.x===Number(match[1])&&n.y===Number(match[2])){mark(key,i,e.message);found=true;}});if(!found)issues.push({collection:'spawn',index:0,message:e.message});}
 assignDocument(d);
 const seen=reachableWorldTiles();
 for(const key of ['nodes','npcs','stations'])d[key].forEach((n,i)=>{if(!interactionApproaches(n).some(p=>seen.has(`${p.x},${p.y}`)))mark(key,i,'Unreachable object: '+n.name);});
 for(const n of millStations())if(!interactionApproaches(n).some(p=>seen.has(`${p.x},${p.y}`)))mark('buildings',d.buildings.findIndex(b=>b.id===n.building),'Unreachable mill workstation.');
 d.buildings.forEach((b,i)=>{const result=validateBuildingPlacement(BUILDINGS[i]);if(!result.ok)mark('buildings',i,result.error);const missing=unreachableBuildingFloors(BUILDINGS[i],seen);if(missing.length)mark('buildings',i,'Unreachable building floor: '+b.id+' at '+missing[0].join(', '));});
 const all=['nodes','npcs','stations','boundaries'];for(const key of all)d[key].forEach((n,i)=>{
  if(key==='nodes'&&n.kind==='tree'){const result=validateTreePlacement(NODE_DEFS[i]);if(!result.ok)mark(key,i,result.error);}
  else if(n.kind==='fishing'){if(tile(n.x,n.y)!=='water')mark(key,i,'Fishing spot must be on water.');}else if(!['grass','path','sand','floor','quarry','field'].includes(tile(n.x,n.y))&&!(key==='stations'&&BUILDINGS.some(b=>b.occupants.includes(n.id))))mark(key,i,'Object needs playable land.');
  if(key==='boundaries'&&(!['grass','sand','quarry','field',...(n.type==='gate'?['path']:[])].includes(tile(n.x,n.y))||BUILDINGS.some(b=>n.x>=b.x&&n.y>=b.y&&n.x<b.x+b.width&&n.y<b.y+b.height)))mark(key,i,'Fence / wall overlaps road, water or building.');
  for(const other of all)d[other].forEach((b,j)=>{if(key===other&&i===j)return;const distance=Math.hypot(n.x-b.x,n.y-b.y);if(distance<1){mark(key,i,'Objects overlap.');mark(other,j,'Objects overlap.');}});
 });
 d.bridges.forEach((b,i)=>{for(let dx=-1;dx<=1;dx++)if(!walkable(b.x+bridgeWorldOffset(b,dx,0)[0],b.y+bridgeWorldOffset(b,dx,0)[1]))mark('bridges',i,'Bridge crossing is obstructed.');});
 }catch(e){issues.push({collection:'spawn',index:0,message:e.message});}finally{assignDocument(old);customWorld=wasCustom;}
 return issues;
}

export function moveEditorSelection(input,refs,dx,dy){
 const doc=structuredClone(input),objects=new Set(),bridges=[];
 for(const r of refs){if(r.collection==='regions')throw Error('Region positions are fixed.');const n=doc[r.collection]?.[r.index];if(!n)continue;if(r.collection==='bridges')bridges.push({index:r.index,n:structuredClone(n)});else{objects.add(n);if(r.collection==='buildings')for(const o of [...doc.npcs,...doc.stations])if(n.occupants?.includes(o.id))objects.add(o);}}
 for(const n of objects){n.x+=dx;n.y+=dy;if(n.polygon){n.polygon=n.polygon.map(([x,y])=>[x+dx,y+dy]);if(n.polygon.some(p=>p.some(v=>v<-.5||v>SIZE-.5)))throw Error('Keep the entire area border inside the world. Use Move area for precise adjustment.');}if(n.open){n.open=n.open.map(([x,y])=>[x+dx,y+dy]);if(n.door)n.door=[n.door[0]+dx,n.door[1]+dy];if(n.id==='bank')doc.barriers=doc.barriers.map(b=>moveQueueRope(b,dx,dy));}}
 for(const b of [...bridges].sort((a,b)=>b.index-a.index))removeEditorBridge(doc,b.index);
 for(const b of bridges){const moved=placeEditorBridge(doc,b.n.x+dx,b.n.y+dy,b.n.rotation||0);doc.bridges.splice(doc.bridges.indexOf(moved),1);doc.bridges.splice(b.index,0,moved);}
 return doc;
}

export function pointInArea(x,y,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const [ax,ay]=polygon[j],[bx,by]=polygon[i],cross=(x-ax)*(by-ay)-(y-ay)*(bx-ax);if(Math.abs(cross)<1e-7&&x>=Math.min(ax,bx)-1e-7&&x<=Math.max(ax,bx)+1e-7&&y>=Math.min(ay,by)-1e-7&&y<=Math.max(ay,by)+1e-7)return true;if((ay>y)!==(by>y)&&x<(bx-ax)*(y-ay)/(by-ay)+ax)inside=!inside;}return inside;}
export function simpleAreaPolygon(p){let area=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];area+=a[0]*b[1]-b[0]*a[1];for(let j=i+2;j<p.length;j++){if(i===0&&j===p.length-1)continue;const c=p[j],d=p[(j+1)%p.length],side=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if(side(a,b,c)*side(a,b,d)<0&&side(c,d,a)*side(c,d,b)<0)return false;}}return Math.abs(area)>1e-6;}
export function areaPolygons(areas,regions){return structuredClone(areas).map(a=>{if(a.polygon)return a;const r=regions.find(r=>a.x>=r.x&&a.y>=r.y&&a.x<r.x+r.width&&a.y<r.y+r.height);if(!r)return a;let p=[[r.x-.5,r.y-.5],[r.x+r.width-.5,r.y-.5],[r.x+r.width-.5,r.y+r.height-.5],[r.x-.5,r.y+r.height-.5]];for(const b of areas){if(b===areas.find(v=>v.x===a.x&&v.y===a.y&&v.name===a.name)||b.x<r.x||b.y<r.y||b.x>=r.x+r.width||b.y>=r.y+r.height)continue;const nx=b.x-a.x,ny=b.y-a.y,k=(b.x*b.x+b.y*b.y-a.x*a.x-a.y*a.y)/2;if(!nx&&!ny)continue;const out=[];for(let i=0;i<p.length;i++){const u=p[i],v=p[(i+1)%p.length],du=nx*u[0]+ny*u[1]-k,dv=nx*v[0]+ny*v[1]-k;if(du<=1e-8)out.push(u);if((du<=0)!==(dv<=0)){const t=du/(du-dv);out.push([u[0]+(v[0]-u[0])*t,u[1]+(v[1]-u[1])*t]);}}p=out;if(!p.length)break;}if(p.length>=3)a.polygon=p;return a;});}
export function moveAreaBorder(doc,index,vertices,dx,dy){const source=doc.areas[index]?.polygon;if(!source)throw Error('Select an area border first.');const points=vertices.map(i=>source[i]);for(const area of doc.areas)if(area.polygon){const joined=[];for(let i=0;i<area.polygon.length;i++){const a=area.polygon[i],b=area.polygon[(i+1)%area.polygon.length],length=Math.hypot(b[0]-a[0],b[1]-a[1]);joined.push(a);if(length>1e-8){const additions=points.filter(p=>Math.hypot(p[0]-a[0],p[1]-a[1])>1e-6&&Math.hypot(p[0]-b[0],p[1]-b[1])>1e-6&&Math.abs((p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]))/length<1e-6&&Math.hypot(p[0]-a[0],p[1]-a[1])+Math.hypot(p[0]-b[0],p[1]-b[1])<length+1e-6).sort((p,q)=>Math.hypot(p[0]-a[0],p[1]-a[1])-Math.hypot(q[0]-a[0],q[1]-a[1]));joined.push(...additions);}}area.polygon=joined.map(p=>points.some(q=>Math.hypot(p[0]-q[0],p[1]-q[1])<1e-6)?[Math.max(-.5,Math.min(SIZE-.5,p[0]+dx)),Math.max(-.5,Math.min(SIZE-.5,p[1]+dy))]:p);}if(doc.areas.some(a=>a.polygon&&!simpleAreaPolygon(a.polygon)))throw Error('That move would fold an area border across itself.');}

function clipAreaHalfPlane(poly,nx,ny,k){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=nx*a[0]+ny*a[1]-k,db=nx*b[0]+ny*b[1]-k;if(da<=1e-8)out.push(a);if((da<=0)!==(db<=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
export function addEditorArea(doc,x,y){doc.areas=areaPolygons(doc.areas,doc.regions);const host=doc.areas.find(a=>a.polygon&&pointInArea(x,y,a.polygon)),a={name:'New area',x,y};if(host){const nx=x-host.x,ny=y-host.y;if(!nx&&!ny)throw Error('Place the new area away from an existing name marker.');const k=(x*x+y*y-host.x*host.x-host.y*host.y)/2;a.polygon=clipAreaHalfPlane(host.polygon,-nx,-ny,-k);const remainder=clipAreaHalfPlane(host.polygon,nx,ny,k);if(a.polygon.length<3||remainder.length<3||!simpleAreaPolygon(a.polygon)||!simpleAreaPolygon(remainder))throw Error('Choose a position inside the area to split its border.');host.polygon=remainder;}doc.areas.push(a);doc.areas=areaPolygons(doc.areas,doc.regions);return doc.areas.length-1;}

export function editorNeighbourPosition(world,region,direction){
 const offset={north:[0,-64],east:[64,0],south:[0,64],west:[-64,0]}[direction];if(!offset)throw Error('Choose north, east, south or west.');
 const x=region.x+offset[0],y=region.y+offset[1];if(x<0||y<0||x+64>SIZE||y+64>SIZE)throw Error('That side is outside the reserved world boundary. Choose another direction.');
 if(world.regions.some(r=>r.x===x&&r.y===y))throw Error('There is already a region on that side. Select it to edit it, or choose another direction.');
 if(world.regions.length>=16)throw Error('The current 16-region editor limit has been reached.');return [x,y];
}

export function travelLanding(n){if(!n||!['portmaster','mage'].includes(n.type))return null;for(const [dx,dy] of [[0,1],[1,0],[-1,0],[0,-1]]){const x=n.x+dx,y=n.y+dy;if(walkable(x,y))return {x,y};}return null;}
export function travelDestinations(type){return NPCS.filter(n=>n.type===type&&travelLanding(n)).map(n=>({id:n.id,name:n.destinationName||n.name,...travelLanding(n)}));}

export function editorRegionRemoval(input,index){
 const region=input.regions[index];if(!region)throw Error('Select a region first.');if(input.regions.length<=1)throw Error('You cannot remove the last region.');
 const doc=structuredClone(input),inside=n=>n.x>=region.x&&n.x<region.x+region.width&&n.y>=region.y&&n.y<region.y+region.height;
 const overlaps=(x,y,w,h)=>x<region.x+region.width&&x+w>region.x&&y<region.y+region.height&&y+h>region.y;
 const buildings=doc.buildings.filter(b=>overlaps(b.x,b.y,b.width,b.height)),occupants=new Set(buildings.flatMap(b=>b.occupants||[]));
 const counts={paths:Object.values(region.tiles).filter(t=>t==='path').length,terrain:Object.values(region.tiles).filter(t=>t!=='grass').length,buildings:buildings.length};
 const primaryFurnaceRemoved=doc.stations.some(n=>n.id==='smeltery'&&(inside(n)||occupants.has(n.id))),spawnRemoved=inside(doc.spawn);
 for(const key of ['nodes','npcs','stations','boundaries','areas']){const removed=doc[key].filter(n=>inside(n)||occupants.has(n.id));counts[key]=removed.length;doc[key]=doc[key].filter(n=>!removed.includes(n));}
 const removedIds=new Set([...input.npcs,...input.stations].filter(n=>inside(n)||occupants.has(n.id)).map(n=>n.id));doc.buildings=doc.buildings.filter(b=>!buildings.includes(b));for(const b of doc.buildings)b.occupants=b.occupants.filter(id=>!removedIds.has(id));
 const bridges=doc.bridges.map((b,i)=>({b,i})).filter(({b})=>overlaps(b.x-1,b.y-1,b.width,b.length));counts.bridges=bridges.length;for(const {i} of bridges.reverse())removeEditorBridge(doc,i);
 const ropes=doc.barriers.filter(b=>{const [a,z]=queueRopeEnds(b);return overlaps(Math.min(a[0],z[0])-.35,Math.min(a[1],z[1])-.35,Math.abs(z[0]-a[0])+.7,Math.abs(z[1]-a[1])+.7)||buildings.some(n=>a[0]>=n.x&&a[0]<n.x+n.width&&a[1]>=n.y&&a[1]<n.y+n.height);});counts.barriers=ropes.length;doc.barriers=doc.barriers.filter(b=>!ropes.includes(b));doc.regions.splice(index,1);if(doc.mapIcons)doc.mapIcons=Object.fromEntries(Object.entries(doc.mapIcons).filter(([,p])=>doc.regions.some(r=>p.x>=r.x&&p.y>=r.y&&p.x<r.x+r.width&&p.y<r.y+r.height)));
 if(!doc.areas.length){const r=doc.regions[0];doc.areas.push({name:r.name,x:r.x+Math.floor(r.width/2),y:r.y+Math.floor(r.height/2)});}
 const adjacent=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y)===64,neighbours=input.regions.filter(r=>r!==region&&adjacent(r,region)).map(r=>r.name);
 const start=doc.regions.find(r=>insideRegion(doc.spawn,r)&&r.published),connected=new Set(start?[start.id]:[]),queue=start?[start]:[];for(let i=0;i<queue.length;i++)for(const r of doc.regions.filter(r=>r.published))if(!connected.has(r.id)&&adjacent(queue[i],r)){connected.add(r.id);queue.push(r);}
 const detached=doc.regions.filter(r=>r.published&&!connected.has(r.id)).map(r=>r.name);
 return {world:doc,region:structuredClone(region),counts,neighbours,detached,spawnRemoved,primaryFurnaceRemoved};
}
function insideRegion(n,r){return n.x>=r.x&&n.x<r.x+r.width&&n.y>=r.y&&n.y<r.y+r.height;}

export function editAreaNode(doc,index,mode,nodeIndex,point){
 const next=structuredClone(doc),polygon=next.areas[index]?.polygon;
 if(!polygon)throw Error('Select an area first.');
 const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<1e-6;
 if(mode==='add'){
  const a=polygon[nodeIndex],b=polygon[(nodeIndex+1)%polygon.length];
  if(!a||!point||same(point,a)||same(point,b))throw Error('Choose a point between the corners.');
  const length=Math.hypot(b[0]-a[0],b[1]-a[1]);
  if(Math.abs((point[0]-a[0])*(b[1]-a[1])-(point[1]-a[1])*(b[0]-a[0]))>length*1e-6)throw Error('Choose a point on the border.');
  for(const area of next.areas){if(!area.polygon)continue;for(let i=0;i<area.polygon.length;i++){const u=area.polygon[i],v=area.polygon[(i+1)%area.polygon.length],len=Math.hypot(v[0]-u[0],v[1]-u[1]);if(len&& !same(point,u)&&!same(point,v)&&Math.abs((point[0]-u[0])*(v[1]-u[1])-(point[1]-u[1])*(v[0]-u[0]))<len*1e-6&&Math.hypot(point[0]-u[0],point[1]-u[1])+Math.hypot(point[0]-v[0],point[1]-v[1])<len+1e-6){area.polygon.splice(i+1,0,[...point]);break;}}}
 }else{
  const point=polygon[nodeIndex];if(!point)throw Error('Choose a corner node.');
  const owners=next.areas.filter(a=>a.polygon?.some(p=>same(p,point)));
  if(owners.length>2)throw Error('This node joins three or more areas. Move it instead to keep their borders connected.');
  if(owners.length===2){const neighbours=owners.map(a=>{const i=a.polygon.findIndex(p=>same(p,point)),p=a.polygon;return [p[(i+p.length-1)%p.length],p[(i+1)%p.length]];});if(!neighbours[0].every(p=>neighbours[1].some(q=>same(p,q))))throw Error('This node joins different border edges. Move it instead.');}
  for(const area of owners)area.polygon=area.polygon.filter(p=>!same(p,point));
 }
 if(next.areas.some(a=>a.polygon&&(a.polygon.length<3||a.polygon.length>64||!simpleAreaPolygon(a.polygon))))throw Error('Keep at least three nodes and a border that does not cross itself (maximum 64 nodes).');
 doc.areas=next.areas;
}

export function editorBoxSelection(doc,start,end,existing=[]){
 const left=Math.min(start.x,end.x),right=Math.max(start.x,end.x),top=Math.min(start.y,end.y),bottom=Math.max(start.y,end.y),refs=existing.filter(r=>!['regions','areas'].includes(r.collection)&&doc[r.collection]?.[r.index]).map(r=>({...r}));
 for(const collection of ['buildings','nodes','npcs','stations','boundaries','bridges'])for(const [index,n] of (doc[collection]||[]).entries()){
  const x=collection==='bridges'?n.x-1:n.x,y=collection==='bridges'?n.y-1:n.y,w=collection==='buildings'||collection==='bridges'?n.width||1:1,h=collection==='buildings'?n.height:collection==='bridges'?n.length||3:1;
  if(x<=right&&y<=bottom&&x+w-1>=left&&y+h-1>=top&&!refs.some(r=>r.collection===collection&&r.index===index))refs.push({collection,index});
 }return refs;
}

export function combatZoneAt(x,y){return REGIONS.filter(a=>a.polygon&&pointInArea(x,y,a.polygon)).sort((a,b)=>areaSurface(a.polygon)-areaSurface(b.polygon))[0]?.combatZone==='pvp'?'pvp':'pve';}
export const maxHitpoints=p=>level(p.xp.hitpoints);

export function combatOptions(item){const w=ITEMS[item];const rows=w?.melee?[['chop','Chop','slash','attack'],['slash','Slash','slash','strength'],['lunge','Lunge','stab','controlled'],['block','Block','slash','defence']]:w?.toolSkill==='woodcutting'?[['chop','Chop','slash','attack'],['hack','Hack','slash','strength'],['smash','Smash','crush','strength'],['block','Block','slash','defence']]:w?.toolSkill==='mining'?[['spike','Spike','stab','attack'],['impale','Impale','stab','strength'],['smash','Smash','crush','strength'],['block','Block','stab','defence']]:[['punch','Punch','crush','attack'],['kick','Kick','crush','strength'],['block','Block','crush','defence']];return rows.map(([id,label,type,skill])=>({id,label,type,skill,stance:skill==='attack'?'Accurate':skill==='strength'?'Aggressive':skill==='defence'?'Defensive':'Controlled'}));}
export function activeCombatOption(p){const options=combatOptions(p.equipment?.weapon);return options.find(o=>o.id===p.combatOption&&o.skill===p.combatStyle)||options.find(o=>o.skill===p.combatStyle)||options[0];}

// Retain the northwest tile anchor so four turns restore every coordinate exactly.
export function rotateEditorBuilding(input,index,turn=1){
 const doc=structuredClone(input),b=doc.buildings[index];if(!b)throw Error('Select a building first.');
 const turns=((turn%4)+4)%4;for(let i=0;i<turns;i++){
 const w=b.width,h=b.height,cx=b.x+(w-1)/2,cy=b.y+(h-1)/2;
 const nx=b.x,ny=b.y,ncx=nx+(h-1)/2,ncy=ny+(w-1)/2;
 const point=(x,y)=>[ncx-(y-cy),ncy+(x-cx)];
 b.furnishings=workshopFurnishings(b).map(p=>({id:p.id,source:p.source,...(p.stationId?{stationId:p.stationId}:{}),x:-p.y,y:p.x,height:p.height,rotation:((p.rotation-90)%360+360)%360}));
 b.open=b.open.map(p=>point(...p));if(b.door)b.door=point(...b.door);
 for(const n of [...doc.npcs,...doc.stations])if(b.occupants.includes(n.id)){[n.x,n.y]=point(n.x,n.y);if(n.rotation!==undefined)n.rotation=(n.rotation+90)%360;}
 doc.barriers=doc.barriers.map(r=>{const [a,z]=queueRopeEnds(r);if(a[0]<b.x-.5||a[0]>b.x+w-.5||a[1]<b.y-.5||a[1]>b.y+h-.5||z[0]<b.x-.5||z[0]>b.x+w-.5||z[1]<b.y-.5||z[1]>b.y+h-.5)return r;return queueRopeFromEnds(point(...a),point(...z),r.clearance);});
 b.x=nx;b.y=ny;b.width=h;b.height=w;b.rotation=((b.rotation||0)+90)%360;
 }
 const inside=(x,y)=>doc.regions.some(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height);
 if(!inside(b.x,b.y)||!inside(b.x+b.width-1,b.y+b.height-1))throw Error('Rotated building would extend outside the regions.');
 return doc;
}
export function queueRopeEnds(r){return r.axis==='horizontal'?[[r.x1,r.y],[r.x2,r.y]]:[[r.x,r.y1],[r.x,r.y2]];}
export function queueRopeFromEnds(a,b,clearance=.35){return Math.abs(a[1]-b[1])<1e-6?{axis:'horizontal',x1:Math.min(a[0],b[0]),x2:Math.max(a[0],b[0]),y:a[1],clearance}:{x:a[0],y1:Math.min(a[1],b[1]),y2:Math.max(a[1],b[1]),clearance};}
export function positionedQueueRope(r){const [a,z]=queueRopeEnds(r),b=BUILDINGS.find(b=>a[0]>=b.x-.5&&a[0]<b.x+b.width-.5&&a[1]>=b.y-.5&&a[1]<b.y+b.height-.5&&z[0]>=b.x-.5&&z[0]<b.x+b.width-.5&&z[1]>=b.y-.5&&z[1]<b.y+b.height-.5);const o=buildingOffset(b||{});return moveQueueRope(r,o.x,o.y);}
export function moveQueueRope(r,dx,dy){return queueRopeFromEnds(...queueRopeEnds(r).map(([x,y])=>[x+dx,y+dy]),r.clearance);}

export function expandEditorBank(input,index){
 const doc=structuredClone(input),b=doc.buildings[index];if(!b)throw Error('Select a bank first.');
 if(b.model==='medievalBankVault')return doc;
 const old={...b},dims=buildingDimensions(b),width=Math.max(7,dims.width),height=Math.max(14,dims.height),rotation=b.rotation||0;
 b.model='medievalBankVault';b.width=rotation%180?height:width;b.height=rotation%180?width:height;
 const cx=b.x+(b.width-1)/2,cy=b.y+(b.height-1)/2,point=(x,y)=>{const p=rotateBuildingPoint(x-(width-1)/2,y-(height-1)/2,rotation);return [cx+p[0],cy+p[1]];};
 b.open=[];const partition=Math.round((height-1)/2+(height-1+.24)*5/26),vaultDoor=Math.round((width-1)/2-(width-1+.24)*2.25/8);
 for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++)if(y!==partition||x===vaultDoor)b.open.push(point(x,y));
 b.door=point(Math.round((width-1)*.75),0);b.open.push(b.door);
 // Rebuild banking furniture for the larger lobby; retain any unrelated custom props.
 b.furnishings=(b.furnishings||[]).filter(p=>!p.id.startsWith('Bank')&&!p.id.startsWith('Vault'));
 if(rotation)for(const p of workshopFurnishings(b)){if(b.furnishings.some(n=>n.id===p.id))continue;const q=rotateBuildingPoint(p.x,p.y,rotation);b.furnishings.push({id:p.id,source:p.source,x:q[0],y:q[1],height:p.height,rotation:(360-rotation)%360});}
 const clerks=doc.npcs.filter(n=>b.occupants.includes(n.id)&&n.type==='banker');clerks.forEach((n,i)=>{[n.x,n.y]=point(Math.round((width-1)/2+1-i),Math.round((height-1)/2+1.5));});
 doc.barriers=doc.barriers.filter(r=>!queueRopeEnds(r).every(([x,y])=>x>=old.x-.5&&y>=old.y-.5&&x<=old.x+old.width-.5&&y<=old.y+old.height-.5));
 for(const offset of [-.5,.5])doc.barriers.push(queueRopeFromEnds(point((width-1)/2+offset,3),point((width-1)/2+offset,6)));
 return doc;
}

export function millStations(){return BUILDINGS.filter(b=>b.model==='medievalMill').map(b=>{const part=workshopFurnishings(b).find(p=>p.source==='Millstone');return part?{id:'mill:'+b.id,building:b.id,type:'mill',name:'Mill grinding mechanism',x:Math.round(b.x+(b.width-1)/2+part.x),y:Math.round(b.y+(b.height-1)/2+part.y)}:null;}).filter(Boolean);}

export function rotateEditorBridge(doc,index,turn=1){const b=doc.bridges[index];if(!b)throw Error("Select a bridge.");const rotation=((bridgeRotation(b)+turn*90)%360+360)%360;if(![0,90,180,270].includes(rotation))throw Error("Invalid bridge rotation.");const vertical=rotation%180===90,hx=vertical?1:2,hy=vertical?2:1;if(!doc.regions.some(r=>b.x>=r.x+hx&&b.x<r.x+64-hx&&b.y>=r.y+hy&&b.y<r.y+64-hy))throw Error("Keep the bridge and its approaches inside a region.");b.rotation=rotation;return b;}

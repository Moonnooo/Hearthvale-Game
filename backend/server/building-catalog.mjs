// Blender-authored architecture; roof and furnishing roots remain independent.
export const VILLAGE_MODELS={
 castleGatehouse:{file:"castle-gatehouse",name:"Castle gatehouse",door:0,roofColor:0x788179},
 castleRampart:{file:"castle-rampart",name:"Walkable castle rampart",door:0,roofColor:0x788179},
 townFountain:{file:"town-fountain",name:"Town fountain",door:0,roofColor:0x788179},
 cityTownhouse:{file:"city-townhouse",name:"Two-storey timber townhouse",door:0,roofColor:0x829997},
 cityCivicHall:{file:"city-civic-hall",name:"Three-storey stone civic hall",door:0,roofColor:0x798da7},
 medievalCottage:{file:'medieval-cottage',name:'Timber cottage',door:.175,roofColor:0xb38365},
 medievalTownhouse:{file:'medieval-townhouse',name:'Town house · hipped roof',door:-.175,roofColor:0x829997},
 medievalStorehouse:{file:'medieval-storehouse',name:'Stone and timber storehouse',door:0,roofColor:0x898878},
 medievalChapel:{file:'medieval-chapel',name:'Stone chapel · steep roof',door:0,roofColor:0x798da7},
 medievalWatchtower:{file:'medieval-watchtower',name:'Stone watchtower',door:0,roofColor:0x717e84},
 medievalCookhouse:{file:'medieval-cookhouse',name:'Cooking house / bakery',door:0,roofColor:0xc18a69},
 medievalMilitary:{file:'medieval-military',name:'Military barracks / training hall',door:0,roofColor:0x596b75},
 medievalMill:{file:'medieval-mill',name:'Grain mill',door:0,rearDoor:0,roofColor:0x8d937b}
};
export const VILLAGE_MODEL_OPTIONS=Object.entries(VILLAGE_MODELS).map(([id,v])=>[id,v.name]);
export const KITCHEN_PARTS=[['BakingOven',2.45,2,0,2.15,1.55],['PrepTable',-1.8,.8,0,2.5,1.15],['KitchenShelf',-3.2,1.8,0,.85,2],['FlourSack_1',-3.2,1.2,.28,.65,.65]];
export const MILITARY_PARTS=[['WeaponRack_1',-3.2,1.35,0,.8,2.2],['WeaponRack_2',3.2,1.35,0,.8,2.2],['ArmourShelf',0,2.45,0,2.8,.75],['TrainingDummy_1',-1.0,-.15,0,.8,.8],['TrainingDummy_2',1.6,-.15,0,.8,.8],['MilitaryTable',-1.5,-1.75,0,2.0,.85],['BarracksCrate',-3.0,-1.9,0,.7,.7],['DisplaySword_1',-3.15,.85,.3,.18,.4],['DisplaySword_2',-3.15,1.65,.3,.18,.4],['DisplayShield_1',3.05,.65,.35,.18,.72],['DisplayShield_2',3.05,1.6,.35,.18,.72],['ShelfHelmet',-.7,2.45,1.05,.4,.4],['ShelfShield',.6,2.45,1.05,.65,.45]];
export const MILL_PARTS=[['Millstone',1.6,1.1,0,1.78,1.78],['GrainHopper',1.6,1.1,1.8,1.3,1.2],...Array.from({length:3},(_,i)=>['GrainSack_'+(i+1),-2.9+i*.8,2.3,0,.64,.64])];
export function modelFloor(b){if(["castleRampart","castleGatehouse"].includes(b.model)){const turn=(b.rotation||0)/90,w=turn%2?b.height:b.width,h=turn%2?b.width:b.height,x=Math.max(1,Math.round((w-1)/2-.375*(w-.76)));const p=turn===1?[h-1-(h-1),x]:turn===2?[w-1-x,0]:turn===3?[h-1,w-1-x]:[x,h-1];delete b.door;b.open=[];if(b.model==="castleGatehouse"){for(let y=0;y<h;y++)for(let x=Math.ceil((w-1)/2-(w-.76)/4);x<=Math.floor((w-1)/2+(w-.76)/4);x++){const p=turn===1?[h-1-y,x]:turn===2?[w-1-x,h-1-y]:turn===3?[y,w-1-x]:[x,y];b.open.push([b.x+p[0],b.y+p[1]]);}}return true;}if(b.model==="townFountain"){b.open=[];for(let y=0;y<b.height;y++)for(let x=0;x<b.width;x++)if(Math.hypot(x-Math.floor(b.width/2),y-Math.floor(b.height/2))>1.3)b.open.push([b.x+x,b.y+y]);delete b.door;return true;}const c=VILLAGE_MODELS[b.model];if(!c)return false;const turn=(b.rotation||0)/90,swap=turn%2,w=swap?b.height:b.width,h=swap?b.width:b.height;const rotate=(x,y)=>turn===1?[h-1-y,x]:turn===2?[w-1-x,h-1-y]:turn===3?[y,w-1-x]:[x,y];b.open=[];for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const p=rotate(x,y);b.open.push([b.x+p[0],b.y+p[1]]);}const dx=Math.max(1,Math.min(w-2,Math.round((w-1)/2+c.door*(w-1+.24))));const p=rotate(dx,h-1);b.door=[b.x+p[0],b.y+p[1]];b.open.push(b.door);const rear=modelRearDoor(b);if(rear)b.open.push(rear);return true;}

export function upgradeVillageBuildings(input){
 const doc=structuredClone(input);let replaced=0;
 for(const b of doc.buildings){if(b.model)continue;if(b.id==='bank'){b.model='medievalBank';replaced++;continue;}const type=/watch/i.test(b.id)?'medievalWatchtower':/chapel/i.test(b.id)?'medievalChapel':/store/i.test(b.id)?'medievalStorehouse':/inn|lodge/i.test(b.id)?'medievalTownhouse':'medievalCottage';b.model=type;b.ruin=false;b.roofColor=VILLAGE_MODELS[type].roofColor;
 const previous=b.rotation||0;
 for(const rotation of [...new Set([previous,0,90,180,270])]){b.rotation=rotation;modelFloor(b);const [dx,dy]=rotation===90?[-1,0]:rotation===180?[0,-1]:rotation===270?[1,0]:[0,1],x=b.door[0]+dx,y=b.door[1]+dy,r=doc.regions.find(r=>x>=r.x&&y>=r.y&&x<r.x+64&&y<r.y+64);
 if(r&&['grass','path','sand','quarry','field'].includes(r.tiles?.[(x-r.x)+','+(y-r.y)]??r.terrain??'grass')&&!doc.buildings.some(o=>o!==b&&x>=o.x&&x<o.x+o.width&&y>=o.y&&y<o.y+o.height)&&![...doc.nodes,...doc.npcs,...doc.stations,...doc.boundaries].some(o=>Math.hypot(o.x-x,o.y-y)<.8))break;
 }replaced++;}
 const created=[];
 const regions=doc.regions.filter(r=>r.published!==false).sort((a,b)=>b.x-a.x);
 for(const [id,model,name,width,height,desired]of [['village-cookhouse','medievalCookhouse','Cooking house',8,7,14],['village-grain-mill','medievalMill','Grain mill',7,7,28]]){
  if(doc.buildings.some(b=>b.model===model))continue;let location;
  for(const r of regions){const options=[];for(let y=r.y+3;y<r.y+r.height-height-3;y++)for(let x=r.x+3;x<r.x+r.width-width-3;x++)options.push({x,y,d:Math.hypot(x-r.x-desired,y-r.y-25)});options.sort((a,b)=>a.d-b.d);
   location=options.find(({x,y})=>{
    if(doc.buildings.some(b=>x<b.x+b.width+2&&x+width+2>b.x&&y<b.y+b.height+2&&y+height+2>b.y))return false;
    if([...doc.nodes,...doc.npcs,...doc.stations,...doc.boundaries,...doc.bridges].some(n=>n.x>=x-3&&n.x<=x+width+2&&n.y>=y-3&&n.y<=y+height+2))return false;
    for(let yy=y-1;yy<y+height+1;yy++)for(let xx=x-1;xx<x+width+1;xx++)if(!['grass','sand','floor','quarry'].includes(r.tiles?.[(xx-r.x)+','+(yy-r.y)]??r.terrain??'grass'))return false;
    return !(doc.spawn.x>=x-1&&doc.spawn.x<x+width+1&&doc.spawn.y>=y-1&&doc.spawn.y<y+height+1);
   });if(location)break;
  }
  if(!location)throw Error('No clear site for '+name+'.');
  const b={id,model,name,x:location.x,y:location.y,width,height,rotation:0,roofColor:VILLAGE_MODELS[model].roofColor,occupants:[],open:[]};modelFloor(b);doc.buildings.push(b);created.push({id,x:b.x,y:b.y});
 }
 return {world:doc,replaced,created};
}
export function buildingOffset(b){return {x:b.offsetX||0,y:b.offsetY||0};}
export function buildingCentre(b){const o=buildingOffset(b);return {x:b.x+(b.width-1)/2+o.x,y:b.y+(b.height-1)/2+o.y};}
export function buildingEntrance(b){
 const swap=(b.rotation||0)%180,w=swap?b.height:b.width,h=swap?b.width:b.height,sx=w-1+.24,sy=h-1+.24;
 const bank=['medievalBank','medievalBankVault'].includes(b.model)||b.id==='bank'&&!b.model;
 let x=(bank?.25:(VILLAGE_MODELS[b.model]?.door??.175))*sx,y=(bank?-1:1)*sy/2,nx=0,ny=bank?-1:1;
 if(!b.model&&!bank&&b.door){const c=buildingCentre(b);return {x:b.door[0]+(b.offsetX||0),y:b.door[1]+(b.offsetY||0),nx:b.door[0]===b.x?-1:b.door[0]===b.x+b.width-1?1:0,ny:b.door[1]===b.y?-1:b.door[1]===b.y+b.height-1?1:0};}
 for(let i=0;i<(b.rotation||0)/90;i++){[x,y]=[-y,x];[nx,ny]=[-ny,nx];}const c=buildingCentre(b);return {x:c.x+x,y:c.y+y,nx,ny};
}
export function alignBuildingEntrance(world,b){
 const door=buildingEntrance(b),tx=door.ny,ty=-door.nx,options=[];
 for(const r of world.regions)for(const [key,t]of Object.entries(r.tiles||{})){if(t!=='path')continue;const [u,v]=key.split(',').map(Number),x=r.x+u,y=r.y+v,normal=(x-door.x)*door.nx+(y-door.y)*door.ny,lateral=(x-door.x)*tx+(y-door.y)*ty,offsetX=(b.offsetX||0)+lateral*tx,offsetY=(b.offsetY||0)+lateral*ty;if(normal>=.15&&normal<=2&&Math.abs(offsetX)<=.5&&Math.abs(offsetY)<=.5)options.push({offsetX,offsetY,score:normal+Math.abs(lateral)*.2});}
 options.sort((a,b)=>a.score-b.score);if(!options.length)throw Error('Place a path just outside the entrance first, or use the fine-position controls.');return {offsetX:Number(options[0].offsetX.toFixed(4)),offsetY:Number(options[0].offsetY.toFixed(4))};
}

export function modelRearDoor(b){
 const rear=VILLAGE_MODELS[b.model]?.rearDoor;if(rear===undefined)return null;
 const turn=(b.rotation||0)/90,swap=turn%2,w=swap?b.height:b.width,h=swap?b.width:b.height,x=Math.max(1,Math.min(w-2,Math.round((w-1)/2+rear*(w-1+.24))));
 const p=turn===1?[h-1,x]:turn===2?[w-1-x,h-1]:turn===3?[0,w-1-x]:[x,0];return [b.x+p[0],b.y+p[1]];
}

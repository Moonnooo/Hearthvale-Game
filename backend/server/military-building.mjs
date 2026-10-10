import {modelFloor} from './building-catalog.mjs';
// Add a separate barracks while preserving every existing building and its model.
export function addMilitaryBuilding(input){
 const world=structuredClone(input);if(world.buildings.some(b=>b.id==='military-barracks'))return {world,created:false};
 const old=world.buildings.find(b=>b.id==='old-watch')||world.buildings[0],width=9,height=8;
 const candidates=[];
 for(const r of world.regions.filter(r=>r.published!==false))for(let y=r.y+2;y<r.y+r.height-height-2;y++)for(let x=r.x+2;x<r.x+r.width-width-2;x++)candidates.push({x,y,r,d:Math.hypot(x+width/2-(old.x+old.width/2),y+height/2-(old.y+old.height/2))});
 candidates.sort((a,b)=>a.d-b.d);
 const site=candidates.find(({x,y,r})=>{
  if(world.buildings.some(b=>x<b.x+b.width+1&&x+width+1>b.x&&y<b.y+b.height+1&&y+height+1>b.y))return false;
  if([...world.nodes,...world.npcs,...world.stations,...world.boundaries,...world.bridges].some(n=>n.x>=x-1&&n.x<=x+width&&n.y>=y-1&&n.y<=y+height+1))return false;
  for(let yy=y;yy<=y+height;yy++)for(let xx=x;xx<x+width;xx++)if(!['grass','sand','quarry'].includes(r.tiles?.[(xx-r.x)+','+(yy-r.y)]??r.terrain??'grass'))return false;
  return !(world.spawn.x>=x-1&&world.spawn.x<=x+width&&world.spawn.y>=y-1&&world.spawn.y<=y+height);
 });
 if(!site)throw Error('No clear location for the military barracks.');
 const building={id:'military-barracks',name:'Hearthvale barracks',model:'medievalMilitary',x:site.x,y:site.y,width,height,rotation:0,roofColor:0x596b75,occupants:[],open:[]};modelFloor(building);world.buildings.push(building);
 const guide=world.npcs.find(n=>n.id==='guide-combat');if(guide){guide.x=building.door[0]-2;guide.y=building.door[1]+1;guide.rotation=180;}
 return {world,created:true,building};
}

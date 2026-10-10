import {buildingWallPlan} from './furnishing-placement.mjs';
import {buildingCentre} from './building-catalog.mjs';
export function boundaryArms(world,b){
 const arms=[];
 for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
  const neighbour=world.boundaries?.find(n=>n.x===b.x+dx&&n.y===b.y+dy);
  if(neighbour&&(neighbour.type===b.type||[b.type,neighbour.type].every(t=>['fence','gate'].includes(t)))){arms.push({dx,dy,length:.5});continue;}
  let closest;
  for(const building of world.buildings||[]){
   const c=buildingCentre(building);
   for(const wall of buildingWallPlan(building).walls){
    const minX=c.x+wall.minX,maxX=c.x+wall.maxX,minY=c.y+wall.minY,maxY=c.y+wall.maxY;
    if(dx&&(b.y<minY||b.y>maxY)||dy&&(b.x<minX||b.x>maxX))continue;
    const distance=dx?dx*((dx>0?minX:maxX)-b.x):dy*((dy>0?minY:maxY)-b.y);
    if(distance<.45||distance>1.45)continue;
    if(!closest||distance<closest.length)closest={dx,dy,length:distance,buildingId:building.id};
   }
  }
  if(closest)arms.push(closest);
 }
 return arms.length?arms:[{dx:1,dy:0,length:.5},{dx:-1,dy:0,length:.5}];
}

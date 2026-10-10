// Shared model/navigation contract. Coordinates rotate with the complete building.
export const STOREY_MODELS={cityTownhouse:2,cityCivicHall:3,castleRampart:2,castleGatehouse:2};
export const STOREY_HEIGHT=3.2;
export function storeyCount(b){return STOREY_MODELS[b?.model]||1;}
export function storeyPoint(b,x,y){
 const turn=(b.rotation||0)/90,swap=turn%2,w=swap?b.height:b.width,h=swap?b.width:b.height;
 const p=turn===1?[h-1-y,x]:turn===2?[w-1-x,h-1-y]:turn===3?[y,w-1-x]:[x,y];
 return {x:b.x+p[0],y:b.y+p[1]};
}
export function stairLinks(b,level){
 if(!Number.isInteger(level)||level<0||level>=storeyCount(b)||storeyCount(b)===1)return [];
 const swap=(b.rotation||0)%180,w=swap?b.height:b.width,h=swap?b.width:b.height;
 if(["castleRampart","castleGatehouse"].includes(b.model)){const x=Math.max(1,Math.round((w-1)/2-.375*(w-.76))),bottom=storeyPoint(b,x,h),top=storeyPoint(b,x,Math.floor((h-1)/2));return [{id:`stairs:${b.id}:${level}:${level?"down":"up"}`,building:"castle-ramparts",level,toLevel:level?0:1,...(level?top:bottom),landing:level?bottom:top}];}
 const x=Math.max(1,Math.round((w-1)/2-.375*(w-.76)));
 const bottom=storeyPoint(b,x,Math.min(h-2,Math.round((h-1)/2+.192*(h-.76)))),top=storeyPoint(b,x,Math.max(1,Math.round((h-1)/2-.4*(h-.76))));
 const links=[];
 if(level+1<storeyCount(b))links.push({id:`stairs:${b.id}:${level}:up`,building:b.id,level,toLevel:level+1,...bottom,landing:top});
 if(level>0)links.push({id:`stairs:${b.id}:${level}:down`,building:b.id,level,toLevel:level-1,...top,landing:bottom});
 return links;
}
export function storeyTiles(b,level){
 if(b?.model==="castleNetwork")return b.walls.flatMap(w=>storeyTiles(w,level));
 if(!b||!Number.isInteger(level)||level<1||level>=storeyCount(b))return [];
 const swap=(b.rotation||0)%180,w=swap?b.height:b.width,h=swap?b.width:b.height,result=[];
 if(["castleRampart","castleGatehouse"].includes(b.model)){const result=[];for(let x=0;x<w;x++)for(let y=1;y<h-1;y++)result.push(storeyPoint(b,x,y));return result;}
 const stairX=Math.max(1,Math.round((w-1)/2-.375*(w-.76))),top=Math.max(1,Math.round((h-1)/2-.4*(h-.76))),bottom=Math.min(h-2,Math.round((h-1)/2+.192*(h-.76)));
 for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
  if(x===stairX&&y>top&&y<=bottom&&!(level+1<storeyCount(b)&&y===bottom))continue;
  result.push(storeyPoint(b,x,y));
 }
 return result;
}
export function storeyPath(b,level,sx,sy,tx,ty){
 const cells=new Set(storeyTiles(b,level).map(p=>`${p.x},${p.y}`));
 const start=`${sx},${sy}`,end=`${tx},${ty}`;if(!cells.has(start)||!cells.has(end))return null;
 const queue=[[sx,sy]],parents=new Map([[start,null]]);
 for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i],key=`${x},${y}`;
  if(key===end){const path=[];let k=end;while(k!==start){path.push(k.split(',').map(Number));k=parents.get(k);}return path.reverse();}
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
   const k=`${x+dx},${y+dy}`;
   if(!cells.has(k)||parents.has(k)||dx&&dy&&(!cells.has(`${x+dx},${y}`)||!cells.has(`${x},${y+dy}`)))continue;
   parents.set(k,key);queue.push([x+dx,y+dy]);
  }
 }
 return null;
}
export function sameStorey(a,b){return (a.floorLevel||0)===(b.floorLevel||0)&&(!(a.floorLevel||0)||a.floorBuilding===b.floorBuilding);}

export function floorBuilding(buildings,id){return id==="castle-ramparts"?{model:"castleNetwork",walls:buildings.filter(b=>["castleRampart","castleGatehouse"].includes(b.model))}:buildings.find(b=>b.id===id);}

// Sparse tile-centre elevations; missing data keeps existing worlds flat.
export function regionFor(regions,x,y){return regions.find(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height);}
export function heightAt(regions,x,y,water=false){const r=regionFor(regions,Math.round(x),Math.round(y));return r?.[water?'waterLevels':'heights']?.[`${Math.round(x)-r.x},${Math.round(y)-r.y}`]??0;}
export function terrainHeight(regions,x,y){const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;const at=(xx,yy)=>regionFor(regions,xx,yy)?heightAt(regions,xx,yy):heightAt(regions,Math.round(x),Math.round(y));return at(ix,iy)*(1-fx)*(1-fy)+at(ix+1,iy)*fx*(1-fy)+at(ix,iy+1)*(1-fx)*fy+at(ix+1,iy+1)*fx*fy;}
export function elevationBrush(doc,cx,cy,{mode,size=3,strength=.25,target=0,water=false,regionId}={}){
 const radius=(size-1)/2,snapshot=structuredClone(doc.regions),changes=[];
 for(let y=cy-radius;y<=cy+radius;y++)for(let x=cx-radius;x<=cx+radius;x++){const r=regionFor(doc.regions,x,y);if(!r||regionId&&r.id!==regionId)continue;const key=`${x-r.x},${y-r.y}`;if(water&&r.tiles[key]!=='water')continue;
 const distance=Math.hypot(x-cx,y-cy);if(distance>radius+.5)continue;const weight=Math.max(.1,1-distance/(radius+1)),old=heightAt(snapshot,x,y,water);let value=old;
 if(mode==='raise')value+=strength*weight;if(mode==='lower')value-=strength*weight;if(mode==='flatten')value=target;
 if(mode==='smooth'){let sum=0,count=0;for(let yy=y-1;yy<=y+1;yy++)for(let xx=x-1;xx<=x+1;xx++){const neighbour=regionFor(snapshot,xx,yy);if(neighbour&&(!water||neighbour.tiles[`${xx-neighbour.x},${yy-neighbour.y}`]==='water')){sum+=heightAt(snapshot,xx,yy,water);count++;}}value=old+(sum/count-old)*Math.min(1,strength)*weight;}
 value=Math.round(Math.max(-16,Math.min(32,value))*1000)/1000;r[water?'waterLevels':'heights']??={};if(value===0)delete r[water?'waterLevels':'heights'][key];else r[water?'waterLevels':'heights'][key]=value;changes.push([x,y,value]);
 }return changes;
}
export function waterfallEdges(cells,terrain,level){const edges=[];for(const [x,y] of cells){if(terrain(x,y)!=='water')continue;const high=level(x,y);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy;if(terrain(nx,ny)!=='water')continue;const low=level(nx,ny);if(high-low>.15)edges.push({x,y,dx,dy,high,low});}}return edges;}
export function validateElevations(r){for(const field of ['heights','waterLevels']){if(r[field]===undefined)continue;const values=r[field];if(!values||typeof values!=='object'||Array.isArray(values)||Object.keys(values).length>4096)throw Error('Invalid '+field+' in '+r.id);for(const [key,value] of Object.entries(values)){const parts=key.split(',').map(Number);if(parts.length!==2||!parts.every(n=>Number.isInteger(n)&&n>=0&&n<64)||key!==parts.join(',')||!Number.isFinite(value)||value<-16||value>32)throw Error('Invalid elevation in '+r.id);}}}

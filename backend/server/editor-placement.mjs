const sameTile=(a,b)=>a.x===b.x&&a.y===b.y;
const physical=['nodes','npcs','stations','boundaries'];
const rect=n=>({left:n.x-.5+(n.offsetX||0),top:n.y-.5+(n.offsetY||0),right:n.x+(n.width||1)-.5+(n.offsetX||0),bottom:n.y+(n.height||1)-.5+(n.offsetY||0)});
const intersects=(a,b)=>a.left<b.right-1e-6&&a.right>b.left+1e-6&&a.top<b.bottom-1e-6&&a.bottom>b.top+1e-6;
export function assertEditorPlacement(world,collection,n){
 if(![...physical,'buildings','bridges'].includes(collection))return;
 const others=physical.flatMap(k=>(world[k]||[]).filter(o=>o!==n).map(o=>({collection:k,object:o})));
 if(collection==='buildings'){
  const box=rect(n);
  if((world.buildings||[]).some(b=>b!==n&&intersects(box,rect(b))))throw Error('A building already occupies that space.');
  if(others.some(({object:o})=>!n.occupants?.includes(o.id)&&intersects(box,rect(o))))throw Error('An object already occupies that building site.');
  if((world.bridges||[]).some(b=>intersects(box,rect({x:b.x-1,y:b.y-1,width:3,height:3}))))throw Error('A bridge already occupies that building site.');
 }else if(physical.includes(collection)){
  if(others.some(({object:o})=>sameTile(n,o)))throw Error('That tile already has an object. Delete or move it first.');
  for(const b of world.buildings||[]){
   const box=rect(b);
   if(collection==='boundaries'?(n.x<=box.left||n.x>=box.right||n.y<=box.top||n.y>=box.bottom):!intersects(rect(n),box))continue;
   const inside=n.x>=b.x&&n.x<b.x+b.width&&n.y>=b.y&&n.y<b.y+b.height;
   if(['npcs','stations'].includes(collection)&&inside&&(b.occupants?.includes(n.id)||b.open?.some(([x,y])=>x===n.x&&y===n.y)))continue;
   throw Error('That tile is occupied by a building. Place beside its wall.');
  }
  if((world.bridges||[]).some(b=>Math.abs(n.x-b.x)<=1&&Math.abs(n.y-b.y)<=1))throw Error('That tile is occupied by a bridge.');
 }
}

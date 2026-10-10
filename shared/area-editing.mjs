/** Translate one named area without changing terrain, objects or neighbouring borders. */
export function translateArea(area,dx,dy,size=16384){
 if(!area?.polygon?.length||!Number.isFinite(dx)||!Number.isFinite(dy))throw Error('Select a named area first.');
 const xs=area.polygon.map(p=>p[0]),ys=area.polygon.map(p=>p[1]);
 dx=Math.max(-.5-Math.min(...xs),Math.min(size-.5-Math.max(...xs),dx));
 dy=Math.max(-.5-Math.min(...ys),Math.min(size-.5-Math.max(...ys),dy));
 return {...structuredClone(area),x:Math.max(0,Math.min(size-1,Math.round(area.x+dx))),y:Math.max(0,Math.min(size-1,Math.round(area.y+dy))),polygon:area.polygon.map(([x,y])=>[x+dx,y+dy])};
}

export function areaRegion(doc,area){
 const points=area.polygon||[[area.x,area.y]],x=points.reduce((n,p)=>n+p[0],0)/points.length,y=points.reduce((n,p)=>n+p[1],0)/points.length;return doc.regions.find(r=>r.id===area.regionId)||doc.regions.find(r=>x>=r.x-.5&&y>=r.y-.5&&x<r.x+r.width-.5&&y<r.y+r.height-.5)||doc.regions.find(r=>area.x>=r.x&&area.y>=r.y&&area.x<r.x+r.width&&area.y<r.y+r.height);
}
export function snapAreaPoint(doc,index,point,radius){
 const region=areaRegion(doc,doc.areas[index]);let best=radius,target=null;
 for(const [i,a] of doc.areas.entries())if(i!==index&&areaRegion(doc,a)?.id===region?.id)for(const q of a.polygon||[]){const d=Math.hypot(point[0]-q[0],point[1]-q[1]);if(d<best){best=d;target=[...q];}}if(target)return target;
 for(const [i,a] of doc.areas.entries())if(i!==index&&areaRegion(doc,a)?.id===region?.id)for(const [j,u]of (a.polygon||[]).entries()){
  const v=a.polygon[(j+1)%a.polygon.length],dx=v[0]-u[0],dy=v[1]-u[1],len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((point[0]-u[0])*dx+(point[1]-u[1])*dy)/len)):0;
  for(const q of [u,[u[0]+t*dx,u[1]+t*dy]]){const d=Math.hypot(point[0]-q[0],point[1]-q[1]);if(d<best){best=d;target=[...q];}}
 }
 return target||point;
}
export function moveSubAreaNode(doc,index,node,point,{radius=0,snap=true,tile=false,validate}={}){
 const a=doc.areas[index],r=areaRegion(doc,a);if(!r)throw Error('This sub-area needs a parent region.');
 let p=tile?point.map(Math.round):point;
 if(snap&&!tile)p=snapAreaPoint(doc,index,p,radius);
 p=[Math.max(r.x-.5,Math.min(r.x+r.width-.5,p[0])),Math.max(r.y-.5,Math.min(r.y+r.height-.5,p[1]))];
 const polygon=a.polygon.map((q,i)=>i===node?p:[...q]);
 if(validate&&!validate(polygon))throw Error('That move would cross this sub-area’s border.');
 if([polygon[(node+polygon.length-1)%polygon.length],polygon[(node+1)%polygon.length]].some(q=>Math.hypot(q[0]-p[0],q[1]-p[1])<1e-6))throw Error('Keep neighbouring border nodes apart.');
 a.polygon=polygon;a.regionId=r.id;return p;
}
export function createSubArea(doc,x,y){
 const r=doc.regions.find(r=>x>=r.x&&y>=r.y&&x<r.x+r.width&&y<r.y+r.height);if(!r)throw Error('Place a sub-area inside a region.');
 const left=Math.max(r.x-.5,x-3),right=Math.min(r.x+r.width-.5,x+3),top=Math.max(r.y-.5,y-3),bottom=Math.min(r.y+r.height-.5,y+3);
 doc.areas.push({name:'New sub-area',regionId:r.id,x,y,polygon:[[left,top],[right,top],[right,bottom],[left,bottom]]});return doc.areas.length-1;
}
export function translateSubArea(doc,index,source,dx,dy){
 const r=areaRegion(doc,source);if(!r)throw Error('This sub-area needs a parent region.');
 const xs=source.polygon.map(p=>p[0]),ys=source.polygon.map(p=>p[1]);
 dx=Math.max(r.x-.5-Math.min(...xs),Math.min(r.x+r.width-.5-Math.max(...xs),dx));dy=Math.max(r.y-.5-Math.min(...ys),Math.min(r.y+r.height-.5-Math.max(...ys),dy));
 const result=translateArea(source,dx,dy);result.regionId=r.id;return result;
}

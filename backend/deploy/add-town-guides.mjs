import {applyWorldDocument,exportWorldDocument,tile,walkable,adjacentPath,SPAWN} from '../server/world.mjs';
import {TOWN_GUIDES} from '../server/tutorials.mjs';
import {documentRevision} from '../server/world-revision.mjs';
import {Store} from '../server/store.mjs';
export function addTownGuides(input){applyWorldDocument(input);const d=exportWorldDocument();
 for(const guide of TOWN_GUIDES){const existing=d.npcs.find(n=>n.id===guide.id);if(existing){if(guide.id==='guide'){existing.name=guide.name;existing.dialogue=guide.text;}continue;}
  let anchor=d.stations.find(n=>n.id===guide.anchor)||d.nodes.find(n=>guide.anchor==='fishing'&&n.kind==='fishing'),building=d.buildings.find(b=>b.id===guide.anchor||anchor&&anchor.x>=b.x&&anchor.x<b.x+b.width&&anchor.y>=b.y&&anchor.y<b.y+b.height);
  if(building)anchor={x:building.x+(building.width-1)/2,y:building.id==='bank'?building.y-1:building.y+building.height};
  if(!anchor)anchor=SPAWN;
  const candidates=[];for(let y=Math.round(anchor.y)-8;y<=Math.round(anchor.y)+8;y++)for(let x=Math.round(anchor.x)-8;x<=Math.round(anchor.x)+8;x++){
   if(Math.hypot(x-SPAWN.x,y-SPAWN.y)<2||!['grass','sand','path'].includes(tile(x,y))||!walkable(x,y)||d.buildings.some(b=>x>=b.x&&x<b.x+b.width&&y>=b.y&&y<b.y+b.height)||[...d.nodes,...d.npcs,...d.stations,...d.boundaries].some(n=>Math.hypot(n.x-x,n.y-y)<(n.kind==='tree'?1.7:1.5)))continue;
   if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>tile(x+dx,y+dy)==='floor'))continue;
   if([[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>walkable(x+dx,y+dy)).length<3||adjacentPath(SPAWN,{x,y})===null)continue;
   const nearPath=[[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>tile(x+dx,y+dy)==='path');candidates.push({x,y,cost:Math.hypot(x-anchor.x,y-anchor.y)+(nearPath?0:2)});
  }
  candidates.sort((a,b)=>a.cost-b.cost||a.y-b.y||a.x-b.x);if(!candidates.length)throw Error('No clear reachable location for '+guide.name);
  const {x,y}=candidates[0];d.npcs.push({id:guide.id,name:guide.name,type:'guide',x,y,dialogue:guide.text});applyWorldDocument(d);
 }
 applyWorldDocument(d);return exportWorldDocument();
}
if(process.argv[2]){const store=new Store(process.argv[2]);try{if(process.argv[3])store.db.exec("VACUUM INTO '"+process.argv[3].replace(/'/g,"''")+"'");const previous=store.authoredWorld(),next=addTownGuides(previous),drafts=store.db.prepare('SELECT * FROM editor_drafts').all().map(row=>({...row,world:addTownGuides(JSON.parse(row.state))}));store.db.exec('BEGIN IMMEDIATE');try{store.saveWorld(previous,'authored:previous');store.saveWorld(next,'authored:live');for(const row of drafts)store.db.prepare('UPDATE editor_drafts SET state=?,base_revision=?,version=version+1,updated_at=? WHERE account_id=?').run(JSON.stringify(row.world),row.base_revision===documentRevision(previous)?documentRevision(next):row.base_revision,Date.now(),row.account_id);store.db.exec('COMMIT');}catch(e){store.db.exec('ROLLBACK');throw e;}console.log(JSON.stringify(next.npcs.filter(n=>TOWN_GUIDES.some(g=>g.id===n.id)).map(({id,name,x,y})=>({id,name,x,y}))));}finally{store.close();}}

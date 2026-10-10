import {modelRearDoor} from './building-catalog.mjs';
import {BOUNDARIES,BUILDINGS,NPCS,walkable} from './world.mjs';
export const GATE_OPEN_MS=6000;
export const COW_CLEARANCE=1.9;
function pointSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
// Reserve the entire step, including other cows' in-flight steps, rather than just its destination.
export function cowStepClear(cow,x,y,other){const a={x:cow.x,y:cow.y},b={x,y},c={x:other.x,y:other.y},d=other.motion?{x:other.motion.toX,y:other.motion.toY}:c;return Math.min(pointSegment(a,c,d),pointSegment(b,c,d),pointSegment(c,a,b),pointSegment(d,a,b))>=COW_CLEARANCE;}
// Gate tiles remain available to player route planning; animals always treat them as walls.
export function enclosureAt(cow){const walls=new Set(BOUNDARIES.map(b=>`${b.x},${b.y}`)),seen=new Set(),queue=[[cow.x,cow.y]];for(let i=0;i<queue.length;i++){const [x,y]=queue[i],key=`${x},${y}`;if(seen.has(key))continue;if(seen.size>=512)return null;seen.add(key);for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const nx=x+dx,ny=y+dy,k=`${nx},${ny}`;if(!seen.has(k)&&!walls.has(k)&&walkable(nx,ny))queue.push([nx,ny]);}}return seen;}
export class Livestock {
 constructor(){this.cows=NPCS.filter(n=>n.type==='cow').map(n=>({...n,motion:null,nextAt:0,enclosure:enclosureAt(n)}));this.gates=BOUNDARIES.filter(b=>b.type==='gate').map(b=>({...b,id:`gate:${b.x},${b.y}`,name:'Farm gate',openUntil:0}));for(const b of BUILDINGS){if(b.door&&!["castleRampart","castleGatehouse","townFountain"].includes(b.model))this.gates.push({id:"door:front:"+b.id,x:b.door[0],y:b.door[1],type:"gate",name:"Entrance door",buildingId:b.id,openUntil:0});const rear=modelRearDoor(b);if(b.model==='medievalMill'&&rear)this.gates.push({id:'door:'+b.id,x:rear[0],y:rear[1],type:'gate',name:'Mill rear door',buildingId:b.id,openUntil:0});}}
 open(gate,now){gate.openUntil=now+GATE_OPEN_MS;}
 tick(now,players){for(const gate of this.gates)if(gate.openUntil&&gate.openUntil<=now){if(players.some(p=>p.x===gate.x&&p.y===gate.y||p.motion&&((p.motion.fromX===gate.x&&p.motion.fromY===gate.y)||(p.motion.toX===gate.x&&p.motion.toY===gate.y))))gate.openUntil=now+500;else gate.openUntil=0;}
 for(const cow of this.cows){if(cow.motion&&now>=cow.motion.startedAt+cow.motion.duration){cow.x=cow.motion.toX;cow.y=cow.motion.toY;cow.motion=null;cow.nextAt=now+1500+Math.random()*3000;}if(cow.motion||now<cow.nextAt||!cow.enclosure||players.some(p=>p.action?.target===cow.id))continue;const candidates=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[cow.x+dx,cow.y+dy]).filter(([x,y])=>cow.enclosure.has(`${x},${y}`)&&walkable(x,y)&&!this.cows.some(n=>n!==cow&&!cowStepClear(cow,x,y,n))&&!players.some(p=>p.x===x&&p.y===y||p.motion?.toX===x&&p.motion?.toY===y));if(!candidates.length){cow.nextAt=now+2000;continue;}const [x,y]=candidates[Math.floor(Math.random()*candidates.length)];cow.motion={fromX:cow.x,fromY:cow.y,toX:x,toY:y,startedAt:now,duration:1000};}}
 freeze(cow){if(cow.motion){cow.x=cow.motion.toX;cow.y=cow.motion.toY;cow.motion=null;}}
 snapshot(now){return {npcs:this.cows.map(({enclosure,nextAt,...cow})=>cow),gates:this.gates.map(({openUntil,...g})=>({...g,open:openUntil>now}))};}
}

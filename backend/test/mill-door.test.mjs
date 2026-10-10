import test from 'node:test';
import assert from 'node:assert/strict';
import {BUILDINGS} from '../server/world.mjs';
import {modelRearDoor} from '../server/building-catalog.mjs';
import {Livestock,GATE_OPEN_MS} from '../server/livestock.mjs';
test('mill rear door uses rotated doorway coordinates and closes safely after the gate timeout',()=>{
 const length=BUILDINGS.length;try{for(const rotation of [0,90,180,270]){
  const b={id:'test-door-'+rotation,model:'medievalMill',x:30,y:30,width:7,height:7,open:[],rotation};BUILDINGS.push(b);
  const livestock=new Livestock(),door=livestock.gates.find(g=>g.id==='door:'+b.id),p=modelRearDoor(b);assert.deepEqual([door.x,door.y],p);assert.equal(livestock.snapshot(100).gates.find(g=>g.id===door.id).open,false);
  livestock.open(door,100);assert.equal(livestock.snapshot(101).gates.find(g=>g.id===door.id).open,true);
  livestock.tick(100+GATE_OPEN_MS,[{x:door.x,y:door.y}]);assert.ok(door.openUntil>100+GATE_OPEN_MS);
  livestock.tick(100+GATE_OPEN_MS+501,[]);assert.equal(door.openUntil,0);
 }}finally{BUILDINGS.splice(length);}
});

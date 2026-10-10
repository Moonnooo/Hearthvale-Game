import test from 'node:test';import assert from 'node:assert/strict';
import {BUILDINGS,NODE_DEFS,ITEMS,STATIONS,tile,pathTo,walkable,validateWorld} from '../server/world.mjs';
test('settlements have reachable doorways and open interiors without overlapping roads or resources',()=>{
 validateWorld();assert.equal(BUILDINGS.length,13);
 for(const b of BUILDINGS.filter(b=>b.door)){assert.ok(pathTo(15,15,...b.door),b.id+' doorway');for(const [x,y] of b.open){if(STATIONS.some(n=>n.x===x&&n.y===y)){assert.equal(walkable(x,y),false);continue;}assert.ok(walkable(x,y),b.id+' floor');assert.notEqual(pathTo(...b.door,x,y),null,b.id+' interior');}}
});
test('resource geography clusters ores in quarries and keeps forests harvestable',()=>{
 for(const node of NODE_DEFS.filter(n=>n.kind==='rock')){assert.equal(tile(node.x,node.y),'quarry',node.id);assert.ok(ITEMS[node.item]);}
 assert.ok(NODE_DEFS.some(n=>n.species==='pine'));assert.ok(NODE_DEFS.filter(n=>n.kind==='tree').length>80);
 assert.equal(new Set(NODE_DEFS.map(n=>n.id)).size,NODE_DEFS.length);
});
test('winding rivers, farmland and cliffs have the correct movement behavior',()=>{
 assert.equal(tile(6,27),'water');assert.equal(tile(32,28),'water');assert.equal(walkable(6,27),false);
 assert.equal(tile(29,3),'grass');assert.equal(walkable(29,3),true);
 assert.equal(tile(25,34),'field');assert.ok(pathTo(15,15,25,34));assert.ok(pathTo(25,34,15,15));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {areaLabelPosition} from '../server/area-label.mjs';
import {pointInArea,exportWorldDocument,applyWorldDocument,walkable} from '../server/world.mjs';
import {Store} from '../server/store.mjs';
import {Combat} from '../server/combat.mjs';
test('labels follow border centres and stay inside concave sub-areas',()=>{
 const rectangle={x:100,y:100,polygon:[[0,0],[10,0],[10,6],[0,6]]};assert.deepEqual(areaLabelPosition(rectangle),{x:5,y:3});
 rectangle.polygon=rectangle.polygon.map(([x,y])=>[x+20,y+10]);assert.deepEqual(areaLabelPosition(rectangle),{x:25,y:13});
 const a={polygon:[[0,0],[10,0],[10,10],[7,10],[7,3],[3,3],[3,10],[0,10]]},p=areaLabelPosition(a);assert.equal(pointInArea(p.x,p.y,a.polygon),true);
});
test('new characters and defeated players use the published spawn',()=>{
 const old=exportWorldDocument(),db=new Store(':memory:');try{const d=structuredClone(old);let destination;for(let y=1;y<63&&!destination;y++)for(let x=1;x<63;x++)if(walkable(x,y)&&(x!==old.spawn.x||y!==old.spawn.y)){destination={x,y};break;}d.spawn=destination;applyWorldDocument(d);
 const p=db.create('Spawn test').player;assert.equal(p.x,destination.x);assert.equal(p.y,destination.y);
 const game={store:db,notice(){},players:new Map()},combat=new Combat(game);p.x=old.spawn.x;p.y=old.spawn.y;p.hp=0;combat.death(p,Date.now());assert.equal(p.x,destination.x);assert.equal(p.y,destination.y);assert.ok(p.hp>0);
 }finally{db.db.close();applyWorldDocument(old);}
});

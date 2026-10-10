import {fillSlots} from './inventory-fixture.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {Store} from '../server/store.mjs';import {Game} from '../server/game.mjs';
import {STATIONS,SMITHING_RECIPES,ITEMS,adjacentPath,inventoryCount,bestTool,gatheringDuration,NODE_DEFS,roadAt,landUseAt,tile} from '../server/world.mjs';
function setup(){const store=new Store(':memory:'),game=new Game(store),saved=store.create('Toolsmith'),events=[],p=game.join(saved.player,m=>events.push(m));return {store,game,p,events,token:saved.token};}
function stand(p,station){const path=adjacentPath({x:15,y:15},station);[p.x,p.y]=path.at(-1);p.motion=null;p.path=[];}
test('fields and quarries are clear of roads and northern wood has no decorative cliff cluster',()=>{
 for(let y=0;y<64;y++)for(let x=0;x<64;x++)if(landUseAt(x,y))assert.equal(roadAt(x,y),false,`${x},${y}`);
 for(let y=1;y<=4;y++)for(let x=26;x<=31;x++)assert.notEqual(tile(x,y),'cliff');
});
test('both anvils are reachable and every metal can be forged into an axe and pickaxe',()=>{
 const anvils=STATIONS.filter(n=>n.type==='anvil');assert.equal(anvils.length,2);assert.equal(SMITHING_RECIPES.length,12);
 for(const station of anvils)for(const recipe of SMITHING_RECIPES){const {store,game,p,events}=setup();try{stand(p,station);game.command(p,{type:'interact',id:station.id});game.tick(1000);assert.ok(events.some(m=>m.type==='anvilOpen'&&m.station===station.id));Object.assign(p.inventory,recipe.inputs);game.command(p,{type:'smith',station:station.id,recipe:recipe.id,amount:'one',output:'steelPickaxe',count:999},1000);assert.equal(game.snapshot(p).self.smelting,null);assert.equal(game.snapshot(p).players[0].action,'Smithing');game.tick(3999);assert.equal(p.inventory[recipe.output],0);game.tick(4000);assert.equal(p.inventory[recipe.output],1);for(const key of Object.keys(recipe.inputs))assert.equal(p.inventory[key],0);assert.equal(p.xp.smithing,recipe.xp);game.tick(8000);assert.equal(p.inventory[recipe.output],1);}finally{store.close();}}
});
test('forging rejects remote, forged, missing-material and duplicate requests, and movement cancels unfinished work',()=>{
 const {store,game,p}=setup(),station=STATIONS.find(n=>n.type==='anvil');try{p.inventory.steelBar=2;p.inventory.logs=3;
 game.command(p,{type:'smith',station:station.id,recipe:'steel-axe',amount:'one'},1000);assert.equal(p.action,null);stand(p,station);
 for(const request of [{recipe:'__proto__',amount:'one'},{recipe:'steel-axe',amount:999},{recipe:'steel-axe',amount:'one',station:'fake'}]){game.command(p,{type:'smith',station:station.id,...request},1000);assert.equal(p.action,null);}
 game.command(p,{type:'smith',station:station.id,recipe:'bronze-axe',amount:'one'},1000);assert.equal(p.action,null);
 game.command(p,{type:'smith',station:station.id,recipe:'steel-axe',amount:'all'},1000);const active=p.action;game.command(p,{type:'smith',station:station.id,recipe:'steel-axe',amount:'all'},1500);assert.equal(p.action,active);game.tick(4000);assert.equal(p.inventory.steelAxe,1);assert.equal(p.action.remaining,1);
 game.command(p,{type:'move',x:20,y:14},4500);game.tick(9000);assert.equal(p.inventory.steelAxe,1);assert.equal(p.inventory.steelBar,1);assert.equal(p.inventory.logs,2);
 }finally{store.close();}
});
test('tools persist, can be banked, and can be forged from a full backpack',()=>{
 const {store,game,p,token}=setup(),station=STATIONS.find(n=>n.type==='anvil');try{stand(p,station);p.inventory.logs=27;p.inventory.copperBar=1;fillSlots(p,Object.keys(ITEMS).filter(k=>ITEMS[k].toolSkill==='mining'));assert.equal(inventoryCount(p),28);game.command(p,{type:'smith',station:station.id,recipe:'copper-pickaxe',amount:'all'},1000);game.tick(4000);assert.equal(p.inventory.copperPickaxe,1);assert.equal(inventoryCount(p),28);p.x=12;p.y=22;game.command(p,{type:'bank',operation:'deposit',item:'copperPickaxe'});assert.equal(p.bank.copperPickaxe,1);assert.equal(bestTool(p.inventory,'mining'),undefined);game.command(p,{type:'bank',operation:'withdraw',item:'copperPickaxe'});game.leave(p);const restored=store.session(token);assert.equal(restored.inventory.copperPickaxe,1);assert.equal(restored.xp.smithing,20);}finally{store.close();}
});
test('equipped tool speeds up its matching gathering skill without changing rewards',()=>{
 const {store,game,p}=setup();try{assert.equal(gatheringDuration(p.inventory,'mining'),1600);p.inventory.copperPickaxe=1;p.inventory.steelPickaxe=1;p.inventory.bronzeAxe=1;assert.equal(bestTool(p.inventory,'mining'),'steelPickaxe');assert.equal(bestTool(p.inventory,'woodcutting'),'bronzeAxe');assert.equal(gatheringDuration(p.inventory,'mining'),1120);
 game.command(p,{type:'equip',item:'steelPickaxe'});assert.equal(p.inventory.steelPickaxe,0);const node=NODE_DEFS.find(n=>n.kind==='rock'),destination=adjacentPath(p,node).at(-1);[p.x,p.y]=destination;game.command(p,{type:'interact',id:node.id});game.tick(1000);assert.equal(p.action.finishAt,2120);game.tick(2119);assert.equal(p.inventory[node.item],0);game.tick(2120);assert.equal(p.inventory[node.item],0);game.command(p,{type:'pickup',id:game.drops[0].id},2120);game.tick(2120);assert.equal(p.inventory[node.item],1);assert.equal(p.xp.mining,25);assert.equal(ITEMS.steelPickaxe.toolSkill,'mining');
 }finally{store.close();}
});

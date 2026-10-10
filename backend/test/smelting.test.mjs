import {fillSlots} from './inventory-fixture.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Store} from '../server/store.mjs';
import {Game} from '../server/game.mjs';
import {ITEMS,RECIPES,STATIONS,NODE_DEFS,adjacentPath,pathTo,normalizePlayer,inventoryCount,walkable} from '../server/world.mjs';
function setup(){const store=new Store(':memory:');const game=new Game(store);const created=store.create('Smith');const events=[];const p=game.join(created.player,m=>events.push(m));return {store,game,p,events,token:created.token};}
function atFurnace(p){p.x=20;p.y=12;}
test('every ore deposit and the smeltery are reachable and yield their own material',()=>{
 const positions=new Set();for(const n of NODE_DEFS){const key=`${n.x},${n.y}`;assert.ok(!positions.has(key),key);positions.add(key);assert.notEqual(adjacentPath({x:15,y:15},n),null,n.id);}
 assert.deepEqual(adjacentPath({x:15,y:15},STATIONS[0]).at(-1),[20,12]);assert.equal(walkable(20,11),false);assert.equal(pathTo(15,15,18,12),null);
 for(const item of ['ore','tin','iron','coal','zinc','nickel']){const {store,game,p}=setup();try{p.equipment.weapon='bronzePickaxe';const node=NODE_DEFS.find(n=>n.item===item);const destination=adjacentPath(p,node).at(-1);[p.x,p.y]=destination;game.command(p,{type:'interact',id:node.id});game.tick(1000);game.tick(2600);assert.equal(p.inventory[item],0);game.command(p,{type:'pickup',id:game.drops[0].id},2600);game.tick(2600);assert.equal(p.inventory[item],1);assert.equal(inventoryCount(p),1);assert.equal(p.xp.mining,25);}finally{store.close();}}
});
test('smelting validates ingredients and proximity, takes time, and grants exactly one output',()=>{
 for(const recipe of RECIPES){const {store,game,p}=setup();try{Object.assign(p.inventory,recipe.inputs);game.command(p,{type:'smelt',recipe:recipe.id,amount:'one'},1000);assert.equal(p.action,null);atFurnace(p);const before={...p.inventory};game.command(p,{type:'smelt',recipe:recipe.id,amount:'one',output:'steelBar',count:999},1000);game.tick(2999);assert.deepEqual(p.inventory,before);game.tick(3000);assert.equal(p.inventory[recipe.output],1);assert.equal(p.xp.smithing,recipe.xp);for(const key of Object.keys(recipe.inputs))assert.equal(p.inventory[key],0);game.tick(5000);assert.equal(p.inventory[recipe.output],1);assert.equal(p.action,null);}finally{store.close();}}
});
test('batch smelting is bounded, rejects duplicate commands, cancels on movement, and persists bars and XP',()=>{
 const {store,game,p,token}=setup();try{atFurnace(p);p.inventory.ore=3;p.inventory.tin=2;game.command(p,{type:'smelt',recipe:'bronze',amount:'all'},1000);const action=p.action;game.command(p,{type:'smelt',recipe:'bronze',amount:'all'},1500);assert.equal(p.action,action);game.tick(3000);assert.equal(p.inventory.bronzeBar,1);game.tick(5000);assert.equal(p.inventory.bronzeBar,2);assert.equal(p.inventory.ore,1);assert.equal(p.inventory.tin,0);assert.equal(p.action,null);assert.equal(p.xp.smithing,50);
 p.inventory.tin=1;game.command(p,{type:'smelt',recipe:'bronze',amount:'one'},6000);game.command(p,{type:'move',x:20,y:14},6500);game.tick(9000);assert.equal(p.inventory.bronzeBar,2);assert.equal(p.inventory.tin,1);
 game.leave(p);const restored=store.session(token);assert.equal(restored.inventory.bronzeBar,2);assert.equal(restored.xp.smithing,50);
 }finally{store.close();}
});
test('missing ingredients and forged recipes never grant items; a full backpack can be smelted and bars banked',()=>{
 const {store,game,p}=setup();try{atFurnace(p);p.inventory.ore=1;game.command(p,{type:'smelt',recipe:'bronze',amount:'one'},1000);assert.equal(p.action,null);game.command(p,{type:'smelt',recipe:'__proto__',amount:'one'},1000);assert.equal(p.action,null);game.command(p,{type:'smelt',recipe:'copper',amount:999},1000);assert.equal(p.action,null);
 p.inventory.logs=26;p.inventory.tin=1;fillSlots(p,['bronzeBar']);assert.equal(inventoryCount(p),28);game.command(p,{type:'smelt',recipe:'bronze',amount:'one'},1000);game.tick(3000);assert.equal(inventoryCount(p),27);assert.equal(p.inventory.bronzeBar,1);
 p.x=12;p.y=22;game.command(p,{type:'bank',operation:'deposit',item:'bronzeBar'});assert.equal(p.inventory.bronzeBar,0);assert.equal(p.bank.bronzeBar,1);game.command(p,{type:'bank',operation:'withdraw',item:'bronzeBar'});assert.equal(p.inventory.bronzeBar,1);assert.equal(p.bank.bronzeBar,0);
 }finally{store.close();}
});
test('old saved characters gain new item fields without losing progress',()=>{const p=normalizePlayer({id:'old',name:'Old',x:15,y:15,inventory:{logs:3,ore:7},bank:{ore:12},xp:{mining:150,woodcutting:25}});assert.equal(p.inventory.ore,7);assert.equal(p.bank.ore,12);assert.equal(p.xp.mining,150);assert.equal(p.xp.smithing,0);for(const key of Object.keys(ITEMS))assert.equal(typeof p.inventory[key],'number');});

import test from 'node:test';import assert from 'node:assert/strict';
import {healthRecovery} from '../../shared/health-orb.mjs';
import {Store} from '../server/store.mjs';import {Game} from '../server/game.mjs';
test('orb fills for each single hitpoint, resets afterwards, and stays full at maximum HP',()=>{
 const s={hp:5,maxHp:10,hpRegen:{readyAt:11000,duration:10000,paused:false}};
 assert.equal(healthRecovery(s,1000).fill,0);assert.equal(healthRecovery(s,6000).fill,50);
 assert.equal(healthRecovery(s,11000).fill,100);s.hp=6;s.hpRegen.readyAt=21000;assert.equal(healthRecovery(s,11000).fill,0);
 s.hpRegen.paused=true;assert.equal(healthRecovery(s,18000).fill,0);s.hp=10;assert.equal(healthRecovery(s,18000).fill,100);
});
test('server restores one HP per recovery cycle and publishes the same deadline to the orb',()=>{
 const store=new Store(':memory:'),game=new Game(store),p=game.join(store.create('Recovery').player,()=>{});
 try{p.hp=7;game.combat.tick(1000);assert.equal(p.hp,7);assert.equal(game.snapshot(p,1000).self.hpRegen.readyAt,11000);
 game.combat.tick(10999);assert.equal(p.hp,7);game.combat.tick(11000);assert.equal(p.hp,8);assert.equal(p.nextHeal,21000);
 game.combat.tick(21000);assert.equal(p.hp,9);game.combat.tick(31000);assert.equal(p.hp,10);assert.equal(game.snapshot(p,31000).self.hpRegen,null);
 }finally{store.close();}
});

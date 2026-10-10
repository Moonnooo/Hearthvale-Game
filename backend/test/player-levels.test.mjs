import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizePlayer,playerLevels,playerRating} from '../server/world.mjs';
import {Store} from '../server/store.mjs';
import {Game} from '../server/game.mjs';
test('legacy characters gain starting combat skills without losing existing progress',()=>{
 const p=normalizePlayer({xp:{mining:225,smithing:100,woodcutting:0}});
 assert.equal(p.xp.mining,225);assert.equal(playerLevels(p.xp).hitpoints,10);
 assert.equal(playerRating(p.xp).combatLevel,3);assert.equal(playerRating(p.xp).totalLevel,36);
 const before=playerRating(p.xp);p.xp.smithing=2500;assert.equal(playerRating(p.xp).combatLevel,before.combatLevel);assert.ok(playerRating(p.xp).totalLevel>before.totalLevel);
});
test('combat styles affect rating and combat skills cap at 99',()=>{
 const p=normalizePlayer({});p.xp.attack=2500;assert.ok(playerRating(p.xp).combatLevel>3);
 p.xp.attack=0;p.xp.magic=2500;assert.ok(playerRating(p.xp).combatLevel>3);
 for(const key of ['attack','strength','defence','hitpoints','ranged','magic','prayer'])p.xp[key]=13034431;
 assert.equal(playerRating(p.xp).combatLevel,126);
});
test('public snapshots expose ratings while skill XP remains private and persists',()=>{
 const store=new Store(':memory:');try{const game=new Game(store),saved=store.create('Level One'),a=game.join(saved.player,()=>{}),b=game.join(store.create('Level Two').player,()=>{});a.xp.attack=2500;
 const snap=game.snapshot(b),publicA=snap.players.find(p=>p.id===a.id);assert.equal(publicA.combatLevel,playerRating(a.xp).combatLevel);assert.equal(publicA.totalLevel,playerRating(a.xp).totalLevel);assert.equal(publicA.xp,undefined);
 game.leave(a);const loaded=store.session(saved.token);assert.equal(loaded.xp.attack,2500);
 }finally{store.close();}
});

test('all 24 skills initialize, persist and contribute to total without changing combat',()=>{
 const store=new Store(':memory:');try{const saved=store.create('Full Skills'),p=saved.player;assert.equal(Object.keys(p.xp).length,24);assert.equal(playerRating(p.xp).totalLevel,33);
 p.xp.sailing=225;p.xp.herblore=100;p.xp.fletching=25;store.save(p);const loaded=store.session(saved.token);assert.equal(loaded.xp.sailing,225);assert.equal(loaded.xp.herblore,100);assert.equal(loaded.xp.fletching,25);assert.equal(playerRating(loaded.xp).combatLevel,3);assert.equal(playerRating(loaded.xp).totalLevel,36);
 }finally{store.close();}
});

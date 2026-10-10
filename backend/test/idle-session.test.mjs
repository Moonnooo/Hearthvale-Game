import test from 'node:test';
import assert from 'node:assert/strict';
import {idleStatus,IDLE_LIMIT_MS,checkIdleConnection} from '../server/idle-session.mjs';
import {Store} from '../server/store.mjs';
import {Worlds} from '../server/worlds.mjs';
test('idle sessions warn during the final minute and expire at ten minutes',()=>{
 assert.deepEqual(idleStatus(0,8*60000),{remainingMs:120000,expired:false,warn:false});
 assert.deepEqual(idleStatus(0,9*60000),{remainingMs:60000,expired:false,warn:true});
 assert.deepEqual(idleStatus(0,IDLE_LIMIT_MS),{remainingMs:0,expired:true,warn:false});
 assert.equal(idleStatus(0,IDLE_LIMIT_MS+1).expired,true);
});
test('fresh player activity resets the warning and timeout',()=>{
 const now=9*60000;
 assert.equal(idleStatus(0,now).warn,true);
 assert.deepEqual(idleStatus(now,now+30000),{remainingMs:570000,expired:false,warn:false});
});
test('timeout saves/removes the player before revoking login, and never kicks a loading client',()=>{
 const events=[],player={id:'test'};
 const ws={OPEN:1,readyState:1,player,lastActivityAt:0,sessionToken:'test-session',world:{game:{leave:p=>events.push(['leave',p])}},send:s=>events.push(JSON.parse(s)),close:(code)=>events.push(['close',code])};
 const store={revoke:t=>events.push(['revoke',t])};
 checkIdleConnection(ws,store,9*60000);checkIdleConnection(ws,store,9*60000+5000);
 assert.equal(events.length,1);assert.equal(events[0].type,'idleWarning');events.length=0;
 checkIdleConnection(ws,store,IDLE_LIMIT_MS);
 assert.deepEqual(events,[['leave',player],['revoke','test-session'],{type:'idleLogout'},['close',4001]]);
 assert.equal(ws.player,null);events.length=0;
 checkIdleConnection(ws,store,IDLE_LIMIT_MS+10000);assert.equal(events.length,0);
});
test('AFK logout releases world membership, preserves items and skills, and revokes the session',()=>{
 const store=new Store(':memory:');
 try{
  const account=store.create('Idle Traveller'),worlds=new Worlds(store),c=worlds.join(account.player,()=>{});
  c.player.inventory.logs=8;c.player.bank.coins=42;c.player.xp.mining=150;
  const ws={OPEN:1,readyState:1,player:c.player,world:c.world,lastActivityAt:0,sessionToken:account.token,send:()=>{},close:()=>{}};
  checkIdleConnection(ws,store,IDLE_LIMIT_MS);
  assert.equal(worlds.has(account.player.id),false);assert.equal(store.session(account.token),null);
  const saved=store.session(store.newSession(account.player.id));
  assert.equal(saved.inventory.logs,8);assert.equal(saved.bank.coins,42);assert.equal(saved.xp.mining,150);
 }finally{store.close();}
});

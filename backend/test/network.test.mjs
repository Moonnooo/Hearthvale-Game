import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { WebSocket } from 'ws';
import { Store } from '../server/store.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
test('two clients share movement, chat and resources; progress survives restart',{timeout:30000},async()=>{
  const dir=mkdtempSync(join(tmpdir(),'realmgame-test-')),port=18081,base=`http://127.0.0.1:${port}`;
  let child;const clients=[];
  async function start(){child=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),HOST:'127.0.0.1',PUBLIC_ORIGIN:base,DATABASE_PATH:join(dir,'world.sqlite')},stdio:'ignore'});for(let i=0;i<80;i++){try{if((await fetch(base+'/health')).ok)return;}catch{}await delay(100);}throw Error('Test server did not start.');}
  async function stop(){const ended=once(child,'exit');child.kill('SIGTERM');await ended;}
  async function session(name){const r=await fetch(base+'/api/register',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:name.replaceAll(' ',''),email:name.replaceAll(' ','')+'@example.com',password:'Only for automated testing!'})});assert.equal(r.status,201);return {cookie:r.headers.get('set-cookie').split(';')[0],character:(await r.json()).character};}
  async function socket(cookie,loading=false){const ws=new WebSocket(base.replace('http','ws')+'/ws'+(loading?'?loading=1':''),{headers:{Origin:base,Cookie:cookie}});ws.messages=[];ws.on('message',raw=>ws.messages.push(JSON.parse(raw)));clients.push(ws);await once(ws,'open');return ws;}
  async function wait(ws,predicate){for(let i=0;i<100;i++){const found=ws.messages.find(predicate);if(found)return found;await delay(80);}throw Error('Expected network event did not arrive.');}
  async function rejected(cookie,origin,status){const ws=new WebSocket(base.replace('http','ws')+'/ws',{headers:{Origin:origin,Cookie:cookie}});ws.on('error',()=>{});const code=await new Promise((resolve,reject)=>{ws.on('unexpected-response',(_,res)=>{res.resume();ws.terminate();resolve(res.statusCode);});ws.on('open',()=>{ws.close();reject(Error('Unexpected connection'));});});assert.equal(code,status);}
  try{
    await start();const a=await session('Test Alice'),b=await session('Test Bob');
    assert.equal((await fetch(base+'/api/session',{method:'POST',headers:{Origin:'http://evil.invalid'},body:'{}'})).status,403);
    await rejected('',base,401);await rejected(a.cookie,'http://evil.invalid',403);
    const wa=await socket(a.cookie,true);
    await wait(wa,m=>m.type==='assetsRequired');
    wa.send(JSON.stringify({type:'equip',item:'bronzeAxe'}));
    wa.send(JSON.stringify({type:'move',x:15,y:15}));
    await delay(400);
    assert.equal(wa.messages.some(m=>m.type==='welcome'||m.type==='state'),false,'Loading clients must stay outside the active world');
    assert.deepEqual((await fetch(base+'/api/worlds').then(r=>r.json())).worlds.map(w=>w.online),[0,0,0]);
    wa.send(JSON.stringify({type:'clientReady'}));
    const ready=await wait(wa,m=>m.type==='state');
    assert.equal(ready.self.equipment.weapon,null,'Actions while loading must be ignored');
    const wb=await socket(b.cookie);
    await wait(wa,m=>m.type==='state'&&m.players.length===2);await rejected(a.cookie,base,409);
    wa.send(JSON.stringify({type:'chat',text:'Hello from Alice'}));assert.equal((await wait(wb,m=>m.type==='chat'&&m.text==='Hello from Alice')).name,'TestAlice');
    wa.send(JSON.stringify({type:'equip',item:'bronzeAxe'}));
    wa.send(JSON.stringify({type:'interact',id:'tree-0'}));const dropped=await wait(wa,m=>m.type==='state'&&m.drops?.length===1);assert.equal(dropped.self.inventory.logs,0);wa.send(JSON.stringify({type:'pickup',id:dropped.drops[0].id}));const gathered=await wait(wa,m=>m.type==='state'&&m.self.inventory.logs===1);assert.equal(gathered.self.xp.woodcutting,25);
    await wait(wb,m=>m.type==='state'&&m.nodes.find(n=>n.id==='tree-0').available===false);
    wa.messages=[];wa.send(JSON.stringify({type:'switchWorld',worldId:2}));await wait(wa,m=>m.type==='welcome'&&m.worldId===2);const hopped=await wait(wa,m=>m.type==='state'&&m.players.length===1);assert.equal(hopped.self.inventory.logs,1);assert.equal(hopped.self.xp.woodcutting,25);assert.equal(hopped.nodes.find(n=>n.id==='tree-0').available,true);await rejected(a.cookie,base,409);const listing=await fetch(base+'/api/worlds').then(r=>r.json());assert.deepEqual(listing.worlds.map(w=>w.online),[1,1,0]);wa.messages=[];wa.send(JSON.stringify({type:'switchWorld',worldId:1}));await wait(wa,m=>m.type==='welcome'&&m.worldId===1);await wait(wa,m=>m.type==='state'&&m.players.length===2);
    wa.send(JSON.stringify({type:'move',x:-123,y:999}));await wait(wa,m=>m.type==='notice'&&m.text==='You cannot walk there.');
    wa.send(JSON.stringify({type:'bank',operation:'deposit',item:'logs'}));await wait(wa,m=>m.type==='notice'&&m.text.includes('Speak to a bank clerk'));
    for(const ws of clients)ws.close();await stop();await start();
    const restored=await fetch(base+'/api/session',{headers:{Cookie:a.cookie}});assert.equal((await restored.json()).character.id,a.character.id);
    const invalid=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'TestAlice',password:'Wrong password for this test'})});assert.equal(invalid.status,401);
    const login=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'testalice',password:'Only for automated testing!'})});assert.equal(login.status,200);const newCookie=login.headers.get('set-cookie').split(';')[0];assert.ok(login.headers.get('set-cookie').includes('HttpOnly'));assert.notEqual(newCookie,a.cookie);
    const resumed=await socket(newCookie);const saved=await wait(resumed,m=>m.type==='state');assert.equal(saved.self.inventory.logs,1);assert.equal(saved.self.xp.woodcutting,25);
    const logout=await fetch(base+'/api/logout',{method:'POST',headers:{Origin:base,Cookie:newCookie}});assert.equal(logout.status,200);assert.ok(logout.headers.get('set-cookie').includes('Max-Age=0'));const signedOut=await fetch(base+'/api/session',{headers:{Cookie:newCookie}});assert.equal((await signedOut.json()).character,null);await rejected(newCookie,base,401);
    const resetStore=new Store(join(dir,'world.sqlite'));const reset=resetStore.requestReset('testalice@example.com');resetStore.close();
    const changed=await fetch(base+'/api/reset-password',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token:reset.token,password:'A changed password for automated tests!'})});assert.equal(changed.status,200);
    await rejected(a.cookie,base,401);
    const reused=await fetch(base+'/api/reset-password',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({token:reset.token,password:'Another changed automated password!'})});assert.equal(reused.status,400);
    const oldLogin=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'TestAlice',password:'Only for automated testing!'})});assert.equal(oldLogin.status,401);
    const newLogin=await fetch(base+'/api/login',{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify({username:'TestAlice',password:'A changed password for automated tests!'})});assert.equal(newLogin.status,200);assert.equal((await newLogin.json()).character.id,a.character.id);
  }finally{for(const ws of clients)ws.terminate();if(child?.exitCode===null)await stop();rmSync(dir,{recursive:true,force:true});}
});

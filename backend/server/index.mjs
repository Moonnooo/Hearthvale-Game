import {checkIdleConnection} from './idle-session.mjs';
import {VILLAGE_MODELS} from './building-catalog.mjs';
import {Combat} from './combat.mjs';
import {Livestock} from './livestock.mjs';
import {documentRevision} from './world-revision.mjs';
import {dirname} from 'node:path';
import {exportWorldDocument,applyWorldDocument,areaPolygons} from './world.mjs';
import http from 'node:http';
import { readFile,writeFile,rename,mkdir }  from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { Store } from './store.mjs';
import { Worlds } from './worlds.mjs';
import { resetMailer } from './mail.mjs';
const mail=resetMailer();

const port=Number(process.env.PORT||8080),host=process.env.HOST||'127.0.0.1',origin=process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${port}`;
const worldPath=process.env.WORLD_PATH||'data/authored-world.json';
const store=new Store(process.env.DATABASE_PATH||'data/world.sqlite');
const databaseWorld=store.authoredWorld();if(databaseWorld)applyWorldDocument(databaseWorld);else{let previous=null;try{applyWorldDocument(JSON.parse(await readFile(worldPath,'utf8')));}catch(e){if(e.code!=='ENOENT')throw e;}try{previous=store.authoredWorld('authored:previous')||JSON.parse(await readFile(worldPath+'.previous','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}store.saveAuthoredWorld(exportWorldDocument(),previous);}
const worldRevision=()=>documentRevision(exportWorldDocument());
const editorAdmins=(process.env.GAME_EDITOR_ADMINS||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
let worldPublishing=false;
const worlds=new Worlds(store,Math.max(1,Math.min(10,Math.floor(Number(process.env.GAME_WORLD_COUNT)||3))));
const attempts=new Map(),sockets=new Map();let authPending=0;
const cookie=(value,maxAge=2592000)=>`realm_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${origin.startsWith('https:')?'; Secure':''}`;
const token=req=>/\brealm_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie||'')?.[1];
const address=req=>process.env.TRUST_PROXY==='1'?String(req.headers['x-real-ip']||req.socket.remoteAddress):req.socket.remoteAddress;
function json(res,status,data,extra={}){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store',...extra});res.end(JSON.stringify(data));}
const server=http.createServer(async(req,res)=>{
  const isPreview=new URL(req.url,'http://local').pathname==='/editor-preview';
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Frame-Options',isPreview?'SAMEORIGIN':'DENY');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self' blob:; img-src 'self' data: blob:; object-src 'none'; base-uri 'none'; frame-ancestors "+(isPreview?"'self'":"'none'"));
  const path=new URL(req.url,'http://local').pathname;
  try {

    if(req.method==='GET'&&path==='/world-data.mjs'){res.writeHead(200,{'Content-Type':'text/javascript','Cache-Control':'no-store'});return res.end('export default '+JSON.stringify(exportWorldDocument())+';');}
    if(path.startsWith('/api/editor/')){
      const player=store.authenticatedSession(token(req)),account=player&&store.accountFor(player.id);
      if(!account)return json(res,401,{error:'Log in to the game first, then return to the editor.'});
      const canPublish=process.env.GAME_ALLOW_EDITOR_PUBLISH==='1'&&editorAdmins.includes(account.username.toLowerCase());
      if(req.method==='GET'&&path==='/api/editor/world')return json(res,200,{world:exportWorldDocument(),revision:worldRevision(),canPublish,username:account.username,draft:store.editorDraft(account.id)});
      if(req.method!=='POST'||!['/api/editor/validate','/api/editor/publish','/api/editor/rollback','/api/editor/draft'].includes(path))return json(res,404,{error:'Not found.'});
      if(req.headers.origin!==origin)return json(res,403,{error:'Invalid origin.'});
      if(process.env.REQUIRE_TLS==='1'&&req.headers['x-forwarded-proto']!=='https')return json(res,400,{error:'Use HTTPS.'});
      if(!['/api/editor/validate','/api/editor/draft'].includes(path)&&!canPublish)return json(res,403,{error:'Only an appointed world administrator can publish.'});
      if(worldPublishing)return json(res,409,{error:'A world update is already in progress.'});
      let body='',bytes=0;for await(const chunk of req){bytes+=chunk.length;if(bytes>2097152)return json(res,413,{error:'World file exceeds 2 MB.'});body+=chunk;}
      let data;try{data=JSON.parse(body);}catch{return json(res,400,{error:'Invalid JSON world file.'});}
      if(!data||typeof data!=='object')return json(res,400,{error:'Invalid request.'});
      if(worldPublishing)return json(res,409,{error:'A world update is already in progress.'});
      if(path==='/api/editor/draft'){
        const d=data.world;if(!d||d.version!==1||!Array.isArray(d.regions)||!d.regions.length||d.regions.length>16||!['buildings','nodes','npcs','stations','areas','boundaries','bridges','barriers'].every(k=>Array.isArray(d[k]))||typeof data.revision!=='string'||data.revision.length>128||!Number.isSafeInteger(data.version)||data.version<0)return json(res,400,{error:'Invalid editor draft.'});
        try{return json(res,200,{ok:true,...store.saveEditorDraft(account.id,d,data.revision,data.version)});}catch(e){return json(res,e.status||400,{error:e.message});}
      }
      const now=Date.now(),rateKey='editor:'+account.id,recent=(attempts.get(rateKey)||[]).filter(t=>now-t<60000);if(recent.length>=20)return json(res,429,{error:'Please wait a minute before checking again.'});recent.push(now);attempts.set(rateKey,recent);
      const previous=exportWorldDocument();let next;const accountDraft=store.editorDraft(account.id);if(path!=='/api/editor/validate'&&data.draftVersion!==undefined&&data.draftVersion!==(accountDraft?.version||0))return json(res,409,{error:'Your database draft changed in another browser. Reload it before publishing.'});
      if(path!=='/api/editor/validate'&&data.revision!==worldRevision())return json(res,409,{error:'The live world changed. Download your draft, reload the live world, then merge your edits.'});
      try{const input=path==='/api/editor/rollback'?store.authoredWorld('authored:previous')||JSON.parse(await readFile(worldPath+'.previous','utf8')):data.world;next=applyWorldDocument(input);applyWorldDocument(previous);}catch(e){applyWorldDocument(previous);return json(res,400,{error:e.code==='ENOENT'?'No previous published world is available.':e.message});}
      if(path==='/api/editor/validate')return json(res,200,{ok:true,message:'World is valid. All resources and interiors are reachable.'});
      worldPublishing=true;
      try{await mkdir(dirname(worldPath),{recursive:true});await writeFile(worldPath+'.previous.tmp',JSON.stringify(previous),{mode:0o600});await rename(worldPath+'.previous.tmp',worldPath+'.previous');await writeFile(worldPath+'.tmp',JSON.stringify(next),{mode:0o600});await rename(worldPath+'.tmp',worldPath);worlds.save();const savedDraft=store.publishEditorWorld(next,previous,account.id,documentRevision(next),accountDraft?.version||0);applyWorldDocument(next);for(const w of worlds.worlds.values()){w.game.nodes=next.nodes.map(n=>({...n,readyAt:0}));w.game.livestock=new Livestock();w.game.combat=new Combat(w.game);}for(const ws of wss.clients){if(ws.player)ws.world.game.leave(ws.player);if(ws.readyState===ws.OPEN)ws.send(JSON.stringify({type:'worldChanged'}));ws.close(1012,'World updated. Reload the game.');}return json(res,200,{ok:true,revision:worldRevision(),draftVersion:savedDraft.version,world:next,message:'World published. Players will reload into the updated world.'});}
      finally{worldPublishing=false;}
    }

    if(req.method==='GET'&&path==='/api/worlds')return json(res,200,{worlds:worlds.list()});
    if(req.method==='GET'&&path==='/health'){return json(res,200,{status:'ok',online:worlds.list().reduce((n,w)=>n+w.online,0),capacity:worlds.list().reduce((n,w)=>n+w.capacity,0),worlds:worlds.list(),version:'0.1.0',uptime:Math.floor(process.uptime())});}
    if(req.method==='GET'&&path==='/api/session'){
      const p=store.authenticatedSession(token(req));
      return json(res,200,{character:p?{id:p.id,name:p.name}:null,account:p?store.accountFor(p.id):null,passwordResetAvailable:mail.configured});
    }
    if(req.method==='POST'&&['/api/register','/api/login','/api/logout','/api/session','/api/forgot-password','/api/reset-password'].includes(path)){
      if(req.headers.origin!==origin)return json(res,403,{error:'Invalid origin.'});
      if(process.env.REQUIRE_TLS==='1'&&req.headers['x-forwarded-proto']!=='https')return json(res,400,{error:'Use the HTTPS game address.'});
      if(path==='/api/session')return json(res,410,{error:'Create an account or log in to play.'});
      if(path==='/api/logout'){
        const sessionToken=token(req);store.revoke(sessionToken);
        for(const ws of wss.clients)if(ws.sessionToken===sessionToken){if(ws.player)ws.world.game.leave(ws.player);ws.close(1000,'Logged out.');}
        return json(res,200,{ok:true},{'Set-Cookie':cookie('',0)});
      }
      const ip=address(req),now=Date.now(),key='auth:'+ip,times=(attempts.get(key)||[]).filter(t=>now-t<900000);
      if(times.length>=20)return json(res,429,{error:'Too many attempts. Please wait 15 minutes.'},{'Retry-After':'900'});
      times.push(now);attempts.set(key,times);
      let body='';for await(const chunk of req){body+=chunk;if(body.length>2048)return json(res,413,{error:'Request too large.'});}
      let data;try{data=JSON.parse(body);}catch{return json(res,400,{error:'Invalid request.'});}
      if(!data||typeof data!=='object')return json(res,400,{error:'Invalid request.'});
      if(path==='/api/forgot-password'){
        if(!mail.configured)return json(res,503,{error:'Password reset email is not configured yet. Please contact the game administrator.'});
        const reset=store.requestReset(data.email);
        // Respond before delivery, with identical content for every email address.
        json(res,200,{message:'If an account exists for that email, a reset link will be sent. Check your inbox and spam folder.'});
        if(reset)mail.send(reset.email,reset.token,origin).catch(()=>console.error('Password reset email delivery failed.'));return;
      }
      if(authPending>=4)return json(res,503,{error:'Login is busy. Please try again shortly.'});
      authPending++;
      try{
        if(path==='/api/reset-password'){const playerId=await store.resetPassword(data.token,data.password);for(const ws of wss.clients)if(ws.player?.id===playerId){ws.world.game.leave(ws.player);ws.close(1000,'Password changed. Please log in.');}return json(res,200,{message:'Your password has been changed. Log in with your new password.'},{'Set-Cookie':cookie('',0)});}
        const result=path==='/api/register'?await store.register(data.username,data.password,data.email):await store.login(data.username,data.password);
        // Rotate any session from this browser, without disconnecting other devices.
        store.revoke(token(req));
        return json(res,path==='/api/register'?201:200,{character:{id:result.player.id,name:result.player.name},account:{username:result.username}},{'Set-Cookie':cookie(result.token)});
      }catch(error){return json(res,path==='/api/login'?401:400,{error:error.message});}finally{authPending--;}
    }

    json(res,404,{error:'Not found.'});
  }catch(error){console.error('HTTP request failed:',error.message);if(!res.headersSent)json(res,500,{error:'The server could not complete the request.'});else res.end();}
});
const wss=new WebSocketServer({noServer:true,maxPayload:2048,perMessageDeflate:false});
server.on('upgrade',(req,socket,head)=>{
  const reject=(code,text)=>{socket.end(`HTTP/1.1 ${code} ${text}\r\nConnection: close\r\n\r\n`);};
  const url=new URL(req.url,'http://local'),worldId=Number(url.searchParams.get('world')||1),world=worlds.worlds.get(worldId);
  if(url.pathname!=='/ws'||req.headers.origin!==origin)return reject(403,'Forbidden');
  const saved=store.authenticatedSession(token(req)),ip=address(req);
  if(!saved)return reject(401,'Unauthorized');
  if(worlds.has(saved.id))return reject(409,'Conflict');
  if(!world||world.game.players.size>=world.capacity||(sockets.get(ip)||0)>=8)return reject(503,'Unavailable');
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,saved,ip,token(req),worldId,url.searchParams.get('loading')==='1'));
});
wss.on('connection',(ws,saved,ip,sessionToken,worldId,loading=false)=>{
  ws.sessionToken=sessionToken;
  sockets.set(ip,(sockets.get(ip)||0)+1);ws.alive=true;ws.on('pong',()=>ws.alive=true);
  const emit=message=>{if(ws.readyState===ws.OPEN)ws.send(JSON.stringify(message));};
  let p,connection;const join=()=>{try{connection=worlds.join(saved,emit,worldId);p=connection.player;ws.player=p;ws.world=connection.world;ws.lastActivityAt=Date.now();ws.idleWarned=false;}catch(error){ws.close(1008,error.message);}};if(!loading)join();else emit({type:'assetsRequired'});
  let windowAt=Date.now(),count=0;
  ws.on('message',(raw,isBinary)=>{
    if(Date.now()-windowAt>1000){windowAt=Date.now();count=0;}if(++count>25){ws.close(1008,'Too many actions.');return;}
    if(isBinary){ws.close(1003,'Text messages required.');return;}
    try{const msg=JSON.parse(raw.toString());if(!p){if(msg.type==='clientReady')join();return;}if(msg.type==='clientReady')return;ws.lastActivityAt=Date.now();if(ws.idleWarned){ws.idleWarned=false;emit({type:'idleActive'});}if(msg.type==='activity')return;if(msg.type==='switchWorld'){try{connection=worlds.switch(connection,msg.worldId,emit);p=connection.player;ws.player=p;ws.world=connection.world;}catch(error){emit({type:'notice',text:error.message});emit({type:'worldSwitchFailed'});}return;}ws.world.game.command(p,msg);}catch(error){console.error('Command rejected:',error.message);ws.close(1008,'Invalid command.');}
  });
  ws.on('error',error=>console.warn('Socket error:',error.message));
  ws.on('close',()=>{if(p&&ws.player)ws.world.game.leave(p);const left=(sockets.get(ip)||1)-1;if(left)sockets.set(ip,left);else sockets.delete(ip);});
  ws.player=p;
});
const tick=setInterval(()=>{worlds.tick();for(const ws of wss.clients){if(ws.readyState===ws.OPEN&&ws.player){if(ws.bufferedAmount>262144){ws.close(1013,'Connection too slow.');continue;}ws.send(JSON.stringify(ws.world.game.snapshot(ws.player)));}}},100);
const save=setInterval(()=>worlds.save(),10000);
const idleCheck=setInterval(()=>{for(const ws of wss.clients)checkIdleConnection(ws,store);},5000);
const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(!ws.alive||!store.authenticatedSession(ws.sessionToken)){if(ws.player)ws.world.game.leave(ws.player);ws.terminate();continue;}ws.alive=false;ws.ping();}},30000);
const cleanup=setInterval(()=>{const now=Date.now();for(const [ip,times] of attempts){const recent=times.filter(t=>now-t<3600000);if(recent.length)attempts.set(ip,recent);else attempts.delete(ip);}},60000);
server.listen(port,host,()=>console.log(`Realmgame listening on ${host}:${port}, origin ${origin}`));
function shutdown(){clearInterval(tick);clearInterval(save);clearInterval(idleCheck);clearInterval(heartbeat);clearInterval(cleanup);worlds.save();for(const ws of wss.clients)ws.close(1001,'Server restarting.');server.close(()=>{store.close();process.exit(0);});setTimeout(()=>process.exit(0),5000).unref();}
process.once('SIGTERM',shutdown);process.once('SIGINT',shutdown);

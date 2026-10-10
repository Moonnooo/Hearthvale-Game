export const IDLE_LIMIT_MS=10*60*1000;
export const IDLE_WARNING_MS=60*1000;
export function idleStatus(lastActivityAt,now=Date.now()){
 const remainingMs=Math.max(0,IDLE_LIMIT_MS-(now-lastActivityAt));
 return {remainingMs,expired:remainingMs===0,warn:remainingMs>0&&remainingMs<=IDLE_WARNING_MS};
}
export function checkIdleConnection(ws,store,now=Date.now()){
 if(ws.readyState!==ws.OPEN||!ws.player)return;
 const idle=idleStatus(ws.lastActivityAt,now);
 if(idle.expired){
  ws.world.game.leave(ws.player);ws.player=null;store.revoke(ws.sessionToken);
  ws.send(JSON.stringify({type:'idleLogout'}));ws.close(4001,'Inactive for ten minutes.');
 }else if(idle.warn&&!ws.idleWarned){
  ws.idleWarned=true;ws.send(JSON.stringify({type:'idleWarning',remainingMs:idle.remainingMs}));
 }
}

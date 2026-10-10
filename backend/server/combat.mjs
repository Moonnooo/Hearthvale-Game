import {sameStorey} from './storeys.mjs';
import {activeCombatOption,NPCS,ITEMS,SPAWN,playerLevels,playerRating,maxHitpoints,combatZoneAt,adjacentPath,pathTo,canStep,biomeAt} from './world.mjs';
import {randomUUID} from 'node:crypto';
const range=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
export function meleeStats(p){const style=activeCombatOption(p).skill,boost=skill=>style===skill?3:style==='controlled'?1:0,l=playerLevels(p.xp),w=ITEMS[p.equipment.weapon],weapon=w?.melee?w:null,protection=Object.entries(p.equipment).filter(([slot])=>slot!=='weapon').reduce((sum,[,id])=>sum+(ITEMS[id]?.defenceBonus||0),0);return {attack:l.attack+boost('attack')+(weapon?.attackBonus||0),defence:l.defence+boost('defence')+protection,protection,maxHit:Math.max(1,Math.floor((l.strength+boost('strength')+(weapon?.strengthBonus||0))/(weapon?3:6))+1)};}
export class Combat{
 constructor(game,random=Math.random){this.game=game;this.random=random;this.enemies=NPCS.filter(n=>n.type==='enemy').map(n=>({...n,home:{x:n.x,y:n.y},combatLevel:n.combatLevel||5,maxHp:8+(n.combatLevel||5)*2,hp:8+(n.combatLevel||5)*2,motion:null,nextMove:0,nextHit:0,target:null,returning:false,deadUntil:0}));}
 target(id){return this.enemies.find(n=>n.id===id)||this.game.players.get(id);}
 attack(p,id,now){const t=this.target(id);if(!t||!sameStorey(p,t)||t===p||t.deadUntil||t.hp<=0||p.immuneUntil>now||t.immuneUntil>now)return;
  if(!t.home&&(combatZoneAt(p.x,p.y)!=='pvp'||combatZoneAt(t.x,t.y)!=='pvp')){this.game.notice(p,'Player combat is allowed only when both players are in a PvP zone.');return;}
  if(range(p,t)>12||adjacentPath(p,t)===null){this.game.notice(p,'You cannot reach that target.');return;}
  p.action=null;p.combat={target:id};p.nextHit=Math.max(p.nextHit||0,now);if(t.home)t.target=p.id;
 }
 damage(a,b,stats,defence,now,protection=0){a.swingAt=now;a.facing={x:b.x,y:b.y};const accuracy=Math.max(.15,Math.min(.92,(stats.attack+8)/(stats.attack+defence+16)));const damage=Math.min(b.hp,this.random()<accuracy?Math.max(1,Math.floor((1+Math.floor(this.random()*stats.maxHit))*20/(20+protection))):0);b.hp=Math.max(0,b.hp-damage);const maximum=Math.max(1,Math.floor(stats.maxHit*20/(20+protection)));b.lastHit={id:randomUUID(),damage,at:now,x:b.x,y:b.y,strong:damage>1&&damage>=maximum};b.hits=[...(b.hits||[]).filter(h=>now-h.at<2000),b.lastHit].slice(-8);return damage;}
 death(p,now){p.floorLevel=0;p.floorBuilding=null;p.hp=maxHitpoints(p);p.x=SPAWN.x;p.y=SPAWN.y;p.motion=null;p.path=[];p.action=null;p.combat=null;p.combatUntil=0;p.immuneUntil=now+15000;for(const e of this.enemies)if(e.target===p.id){e.target=null;e.returning=true;}this.game.store.save(p);this.game.notice(p,'You were defeated and returned to the starting area. Your items are safe.');}
 kill(e,p,now){e.hp=0;e.diedAt=now;e.motion=null;e.deadUntil=now+15000;e.target=null;e.motion=null;p.combat=null;this.game.drops.push({id:randomUUID(),item:'coins',quantity:5+Math.floor(this.random()*8),x:e.x,y:e.y,owner:p.id,createdAt:now,publicAt:now+60000,expiresAt:now+180000});this.game.drops.push({id:randomUUID(),item:'bones',quantity:1,x:e.x,y:e.y,owner:p.id,createdAt:now,publicAt:now+60000,expiresAt:now+180000});this.game.persistLoot(p);}
 tick(now){const players=[...this.game.players.values()];
 for(const e of this.enemies){if(e.deadUntil){if(now<e.deadUntil)continue;e.deadUntil=0;e.diedAt=0;e.hp=e.maxHp;e.x=e.home.x;e.y=e.home.y;e.returning=false;}
  if(e.motion){if(now<e.motion.startedAt+e.motion.duration)continue;e.x=e.motion.toX;e.y=e.motion.toY;e.motion=null;}
  let target=this.game.players.get(e.target);if(target&&(range(e,target)>8||range(target,e.home)>10||!sameStorey(e,target)||target.immuneUntil>now)){e.target=null;target=null;e.returning=true;}
  if(e.returning){if(range(e,e.home)<.1){e.returning=false;e.hp=e.maxHp;e.nextMove=now+2000;}else{const path=pathTo(e.x,e.y,e.home.x,e.home.y);if(path?.length)this.step(e,path[0],now);else{e.x=e.home.x;e.y=e.home.y;e.returning=false;}}continue;}
  if(!target){target=players.find(p=>sameStorey(e,p)&&!(p.immuneUntil>now)&&e.combatLevel>playerRating(p.xp).combatLevel&&range(e,p)<=3&&range(e.home,p)<=10);if(target)e.target=target.id;}
  if(target){if(range(e,target)<=1.5&&canStep(e.x,e.y,target.x,target.y)){if(now>=e.nextHit){e.nextHit=now+2400;target.combatUntil=now+10000;this.damage(e,target,{attack:e.combatLevel+2,maxHit:Math.max(2,1+Math.floor(e.combatLevel/3))},meleeStats(target).defence,now,meleeStats(target).protection);if(target.hp<=0){this.death(target,now);continue;}this.game.store.save(target);if(!target.combat&&!target.motion&&!target.path.length)target.combat={target:e.id};}}else{const path=adjacentPath(e,{x:target.motion?.toX??target.x,y:target.motion?.toY??target.y});if(path?.length)this.step(e,path[0],now);}continue;}
  if(now>=e.nextMove){e.nextMove=now+2000+this.random()*2500;const options=[[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>[e.x+dx,e.y+dy]).filter(([x,y])=>range({x,y},e.home)<=4&&canStep(e.x,e.y,x,y)&&biomeAt(x,y)==='forest'&&!players.some(p=>p.x===x&&p.y===y));if(options.length)this.step(e,options[Math.floor(this.random()*options.length)],now);}
 }
 for(const p of players){if(p.hp>=maxHitpoints(p))p.nextHeal=null;else if(p.combat)p.nextHeal=now+10000;else p.nextHeal=Math.max(p.nextHeal||now+10000,p.combatUntil||0);if(!p.combat){if(!(p.combatUntil>now)&&p.hp<maxHitpoints(p)&&now>=(p.nextHeal||0)){p.hp++;p.nextHeal=now+10000;this.game.store.save(p);}continue;}
  const t=this.target(p.combat.target);if(!t||!sameStorey(p,t)||t.deadUntil||t.hp<=0||p.immuneUntil>now||t.immuneUntil>now||range(p,t)>12||!t.home&&(combatZoneAt(p.x,p.y)!=='pvp'||combatZoneAt(t.x,t.y)!=='pvp')){p.combat=null;continue;}
  if(p.motion||p.path.length)continue;
  if(range(p,t)>1.5||!canStep(p.x,p.y,t.x,t.y)){const path=adjacentPath(p,{x:t.motion?.toX??t.x,y:t.motion?.toY??t.y});if(path===null)p.combat=null;else p.path=path.slice(0,1);continue;}
  if(now<(p.nextHit||0))continue;p.nextHit=now+1800;p.combatUntil=now+10000;if(!t.home)t.combatUntil=now+10000;
  const damage=this.damage(p,t,meleeStats(p),t.home?t.combatLevel:meleeStats(t).defence,now,t.home?0:meleeStats(t).protection);if(damage){const skill=activeCombatOption(p).skill;for(const key of skill==='controlled'?['attack','strength','defence']:[skill])p.xp[key]=Math.round((p.xp[key]+damage*(skill==='controlled'?1.33:4))*100)/100;p.xp.hitpoints=Math.round((p.xp.hitpoints+damage*1.33)*100)/100;}
  if(t.hp<=0){if(t.home)this.kill(t,p,now);else this.death(t,now);}else if(t.home)t.target=p.id;else if(!t.combat&&!t.motion&&!t.path.length)t.combat={target:p.id};this.game.store.save(p);if(!t.home)this.game.store.save(t);
 }
 }
 step(e,[x,y],now){e.motion={fromX:e.x,fromY:e.y,toX:x,toY:y,startedAt:now,duration:800*Math.hypot(x-e.x,y-e.y)};}
 snapshot(){return this.enemies.map(({home,nextHit,nextMove,target,returning,...n})=>({...n,available:!n.deadUntil}));}
}

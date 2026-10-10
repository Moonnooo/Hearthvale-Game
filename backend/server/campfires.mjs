import {randomUUID} from 'node:crypto';
import {BUILDINGS,ITEMS,COOKING_RECIPES,burnChance,level,walkable,tile,inventoryCount,maxHitpoints} from './world.mjs';
export const FIRE_LIFETIME=120000;
export class Campfires {
 constructor(game,random=Math.random){this.game=game;this.random=random;this.fires=[];}
 near(p,f){return f&&Math.hypot(p.x-f.x,p.y-f.y)<=1.5;}
 clear(p){return walkable(p.x,p.y)&&['grass','path','sand','quarry'].includes(tile(p.x,p.y))&&!BUILDINGS.some(b=>p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height)&&!this.fires.some(f=>f.x===p.x&&f.y===p.y);}
 command(p,m,now){const g=this.game;
  if(m.type==='eat'){const food=ITEMS[m.item];if(!food?.heal||!p.inventory[m.item])return true;if(p.hp>=maxHitpoints(p)){g.notice(p,'You already have full health.');return true;}if(now<(p.eatAt||0))return true;p.inventory[m.item]--;p.hp=Math.min(maxHitpoints(p),p.hp+food.heal);p.eatAt=now+1800;g.store.save(p);return true;}
  if(m.type==='discardBurnt'){if(p.inventory.burntFish){p.inventory.burntFish--;g.store.save(p);}return true;}
  if(m.type==='lightFire'){if(p.motion||p.path.length||p.combat||!p.inventory.logs||!p.inventory.tinderbox||!this.clear(p)||this.fires.length>=200){g.notice(p,'Stand on clear outdoor ground with logs and a tinderbox to light a fire.');return true;}p.action={firemaking:true,x:p.x,y:p.y,finishAt:now+2000};return true;}
  if(m.type==='cook'){const f=this.fires.find(f=>f.id===m.fire&&f.expiresAt>now),r=COOKING_RECIPES.find(r=>r.raw===m.item);if(!this.near(p,f)||p.motion||p.path.length||p.combat||!r||level(p.xp.cooking)<r.level||!p.inventory[r.raw]){g.notice(p,'Stand beside a lit campfire with suitable raw fish and the required Cooking level.');return true;}p.action={cooking:true,target:f.id,raw:r.raw,remaining:m.amount==='all'?p.inventory[r.raw]:1,finishAt:now+2000};return true;}
  return false;
 }
 tick(p,now){const a=p.action,g=this.game;if(a?.firemaking){if(now<a.finishAt)return true;p.action=null;if(p.x!==a.x||p.y!==a.y||!p.inventory.logs||!p.inventory.tinderbox||!this.clear(p)||this.fires.length>=200)return true;p.inventory.logs--;p.xp.firemaking+=40;this.fires.push({id:'campfire-'+randomUUID(),name:'Campfire',type:'campfire',owner:p.id,x:p.x,y:p.y,expiresAt:now+FIRE_LIFETIME});g.store.save(p);return true;}
  const f=this.fires.find(f=>f.id===a?.target&&f.expiresAt>now);if(a?.target?.startsWith('campfire-')&&!a.cooking){p.action=null;if(this.near(p,f))g.send(p,{type:'cookingOpen',fire:f.id});return true;}
  if(!a?.cooking)return false;
  const r=COOKING_RECIPES.find(r=>r.raw===a.raw);if(!this.near(p,f)||!r||!p.inventory[r.raw]||level(p.xp.cooking)<r.level){p.action=null;g.notice(p,'Cooking stopped: check the fire and your raw fish.');return true;}if(now<a.finishAt)return true;
  const output=this.random()<burnChance(r,level(p.xp.cooking))?'burntFish':r.output;
  const inventory={...p.inventory,[r.raw]:p.inventory[r.raw]-1,[output]:(p.inventory[output]||0)+1};if(inventoryCount({inventory})>28){p.action=null;g.notice(p,'Make room in your backpack for cooked or burnt fish.');return true;}
  p.inventory=inventory;if(output!=='burntFish')p.xp.cooking+=r.xp;else g.notice(p,'You accidentally burn the fish.');g.store.save(p);if(--a.remaining>0&&p.inventory[r.raw])a.finishAt=now+2000;else p.action=null;return true;
 }
 prune(now){let changed=false;for(const f of this.fires)if(f.expiresAt<=now&&f.expiresAt+180000>now){this.game.drops.push({id:randomUUID(),item:'ashes',quantity:1,x:f.x,y:f.y,owner:f.owner,createdAt:f.expiresAt,publicAt:f.expiresAt+60000,expiresAt:f.expiresAt+180000});changed=true;}this.fires=this.fires.filter(f=>f.expiresAt>now);if(changed)this.game.store.saveDrops?.(this.game.drops);}
}

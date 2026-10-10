import {floorBuilding,storeyCount,stairLinks,storeyPath,sameStorey} from './storeys.mjs';
import {millStations} from './world.mjs';
import {TOWN_GUIDES} from './tutorials.mjs';
import {advanceEnergy,RUN_SPEED} from './stamina.mjs';
import {Campfires} from './campfires.mjs';
import {Combat} from './combat.mjs';
import {Livestock} from './livestock.mjs';
import { BUILDINGS,combatOptions,activeCombatOption,SPAWN,NODE_DEFS,NPCS,STATIONS,RECIPES,SMITHING_RECIPES,BUCKET_RECIPES,ANVIL_RECIPES,WORKBENCH_RECIPES,SHOP_STOCK,SHOP_BUYS,receiveCapacity,itemSlots,FISH,FISHING_RECIPES,bucketItem,travelLanding,travelDestinations,gatheringDuration,bestTool,equippedTool,ITEMS,SIZE,pathTo,adjacentPath,inInteractionRange,distance,level,playerLevels,playerRating,inventoryCount,walkable,normalizePlayer,publishedRegions,tile,maxHitpoints,combatZoneAt } from './world.mjs';
import {randomUUID} from 'node:crypto';
export const DROP_PRIVATE_MS=60000,DROP_LIFETIME_MS=180000;
import { WALK_MS } from './motion.mjs';
export class Game {
  constructor(store) {
    this.campfires=new Campfires(this);this.combat=new Combat(this);this.livestock=new Livestock();this.store=store;this.players=new Map();this.nodes=NODE_DEFS.map(n=>({...n,readyAt:0}));this.chat=[];this.drops=(store.loadDrops?.()||[]).filter(d=>d.expiresAt>Date.now());
    for(const saved of store.loadWorld()){const n=this.nodes.find(n=>n.id===saved.id);if(n)n.readyAt=saved.readyAt;}
  }
  visibleDrop(d,p,now){return sameStorey(d,p)&&d.expiresAt>now&&(d.owner===p.id||d.publicAt<=now);}
  dropStacks(p,now){const stacks=new Map();for(const d of [...this.drops].sort((a,b)=>a.expiresAt-b.expiresAt)){if(!this.visibleDrop(d,p,now))continue;const privateDrop=d.publicAt>now,key=[d.x,d.y,d.item,privateDrop,d.floorLevel||0,d.floorBuilding||""].join(':');const stack=stacks.get(key);if(stack)stack.quantity+=d.quantity||1;else stacks.set(key,{id:d.id,item:d.item,x:d.x,y:d.y,floorLevel:d.floorLevel||0,floorBuilding:d.floorBuilding||null,private:privateDrop,expiresAt:d.expiresAt,quantity:d.quantity||1});}return [...stacks.values()];}
  persistLoot(p,nodes){if(this.store.persistLoot)this.store.persistLoot(p,this.drops,nodes);else{this.store.save(p);this.store.saveDrops?.(this.drops);if(nodes)this.store.saveWorld(nodes);}}
  send(p,message){p.emit(message);}
  notice(p,text){this.send(p,{type:'notice',text});}
  join(saved,emit){
    if(this.players.has(saved.id)) throw new Error('This character is already playing in another tab.');
    if(this.players.size>=100) throw new Error('The test world is full.');
    const p={...normalizePlayer(saved),path:[],motion:null,action:null,lastChat:0,emit};if(!walkable(p.x,p.y)){p.x=SPAWN.x;p.y=SPAWN.y;}
    if(!Number.isInteger(p.floorLevel)||p.floorLevel<1||storeyPath(floorBuilding(BUILDINGS,p.floorBuilding),p.floorLevel,p.x,p.y,p.x,p.y)===null){p.floorLevel=0;p.floorBuilding=null;}
    this.players.set(p.id,p);this.send(p,{type:'welcome',id:p.id,size:SIZE,regions:publishedRegions(),npcs:NPCS,chat:this.chat});this.notice(p,'Welcome to Hearthvale. Click the ground to walk; click trees or coloured ore rocks to gather. Mix ores at the village smeltery, then use an anvil to make axes and pickaxes.');return p;
  }
  leave(p){if(this.players.get(p.id)!==p)return;this.store.save(p);this.players.delete(p.id);}
  command(p,msg,now=Date.now()) {
    if(!msg||typeof msg!=='object')return;
    if(msg.type==='stairs'){
      const b=BUILDINGS.find(b=>stairLinks(b,p.floorLevel||0).some(s=>s.id===msg.id));
      const link=b&&stairLinks(b,p.floorLevel||0).find(s=>s.id===msg.id);
      if(!link||p.floorLevel&&p.floorBuilding!==link.building||p.combatUntil>now)return;
      const origin={x:p.motion?.toX??p.x,y:p.motion?.toY??p.y};
      const route=p.floorLevel?storeyPath(link.building==="castle-ramparts"?floorBuilding(BUILDINGS,link.building):b,p.floorLevel,origin.x,origin.y,link.x,link.y):pathTo(origin.x,origin.y,link.x,link.y);
      if(route===null){this.notice(p,'You cannot reach those stairs.');return;}
      p.path=route;p.action={stairs:link};p.combat=null;return;
    }
    // Ground-floor stations cannot be used through an upper floor.
    if(p.floorLevel&&['interact','attack','collectWater','bury','lightFire','cook','smelt','smith','craft','buy','sell','bank','travel'].includes(msg.type)){this.notice(p,'Use the stairs to return downstairs first.');return;}
    if(this.campfires.command(p,msg,now))return;
    if(msg.type==='bury'){if(BUILDINGS.some(b=>p.x>=b.x&&p.x<b.x+b.width&&p.y>=b.y&&p.y<b.y+b.height)){this.notice(p,'You can only bury bones outdoors.');return;}if(msg.item!=='bones'||!(p.inventory.bones>0)||p.motion||p.path.length||now<(p.buryAt||0))return;p.inventory.bones--;p.xp.prayer+=ITEMS.bones.prayerXp;p.buryStartedAt=now;p.buryAt=now+1500;this.store.save(p);return;}
    if(msg.type==='runToggle'){p.runEnabled=p.energy>0&&!p.runEnabled;this.store.save(p);return;}if(msg.type==='attack'){this.combat.attack(p,msg.id,now);return;}if(msg.type==='combatStyle'){const option=combatOptions(p.equipment.weapon).find(o=>msg.option?o.id===msg.option:o.skill===msg.style);if(option){p.combatOption=option.id;p.combatStyle=option.skill;this.store.save(p);}return;}
    if(msg.type==='move') {
      const path=p.floorLevel?storeyPath(floorBuilding(BUILDINGS,p.floorBuilding),p.floorLevel,p.motion?.toX??p.x,p.motion?.toY??p.y,msg.x,msg.y):pathTo(p.motion?.toX??p.x,p.motion?.toY??p.y,msg.x,msg.y);if(path===null){this.notice(p,tile(msg.x,msg.y)==='unbuilt'?'That area is not open yet.':'You cannot walk there.');return;}p.path=path;p.action=null;p.combat=null;
    }else if(msg.type==='interact'){
      if(this.combat.enemies.some(n=>n.id===msg.id)){this.combat.attack(p,msg.id,now);return;}p.combat=null;
      const target=millStations().find(n=>n.id===msg.id)||this.campfires.fires.find(n=>n.id===msg.id&&n.expiresAt>now)||this.nodes.find(n=>n.id===msg.id)||this.livestock.cows.find(n=>n.id===msg.id)||NPCS.find(n=>n.id===msg.id)||STATIONS.find(n=>n.id===msg.id)||this.livestock.gates.find(n=>n.id===msg.id);if(!target)return;
      const path=adjacentPath({x:p.motion?.toX??p.x,y:p.motion?.toY??p.y},target.type==='cow'&&target.motion?{...target,x:target.motion.toX,y:target.motion.toY}:target);if(path===null){this.notice(p,'You cannot reach that.');return;}p.path=path;p.action={target:target.id,finishAt:null};
    }else if(msg.type==='magicMenu'){
      this.send(p,{type:'travelOpen',method:'magic',destinations:travelDestinations('mage')});
    }else if(msg.type==='travel'){
      if(p.combatUntil>now){this.notice(p,'Wait until you are out of combat before travelling.');return;}if(!['port','magic'].includes(msg.method))return;
      const destination=NPCS.find(n=>n.id===msg.destination&&n.type===(msg.method==='port'?'portmaster':'mage')),landing=travelLanding(destination);if(!destination||!landing){this.notice(p,'That destination is not available.');return;}
      let source;if(msg.method==='port'){source=NPCS.find(n=>n.id===msg.source&&n.type==='portmaster');if(!source||source.id===destination.id||p.motion||p.path.length||!inInteractionRange(p,source)){this.notice(p,'Speak to a port master before travelling.');return;}}
      if(p.action?.travel){this.notice(p,'Your journey is already starting.');return;}if(msg.method==='magic'&&p.motion){this.notice(p,'Stop walking before casting a teleport.');return;}
      p.path=[];p.action={travel:{method:msg.method,destination:destination.id,source:source?.id,fromX:p.x,fromY:p.y},finishAt:now+2000};this.notice(p,msg.method==='port'?'Preparing to sail…':'Casting teleport…');
    }else if(msg.type==='collectWater'){
      if(!Number.isInteger(msg.x)||!Number.isInteger(msg.y)||msg.x<0||msg.y<0||msg.x>=SIZE||msg.y>=SIZE||tile(msg.x,msg.y)!=='water')return;
      const origin={x:p.motion?.toX??p.x,y:p.motion?.toY??p.y},queue=[{x:msg.x,y:msg.y}],seen=new Set([msg.x+','+msg.y]);let target,path=null;
      for(let i=0;i<queue.length&&i<4096;i++){const q=queue[i];if([[1,0],[-1,0],[0,1],[0,-1]].some(([dx,dy])=>walkable(q.x+dx,q.y+dy))){path=adjacentPath(origin,q);if(path!==null){target=q;break;}}for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const x=q.x+dx,y=q.y+dy,key=x+','+y;if(x>=0&&y>=0&&x<SIZE&&y<SIZE&&!seen.has(key)&&tile(x,y)==='water'){seen.add(key);queue.push({x,y});}}}
      if(path===null){this.notice(p,'You cannot reach this water.');return;}p.path=path;p.action={water:target,finishAt:null};
    }else if(msg.type==='emptyBucket'){
      const item=msg.equipped?p.equipment.weapon:msg.item,def=ITEMS[item];if(!def?.bucketMaterial||def.contents==='empty')return;
      const empty=bucketItem(def.bucketMaterial);if(msg.equipped)p.equipment.weapon=empty;else{if(!(p.inventory[item]>0))return;const after={...p.inventory};after[item]--;after[empty]++;if(inventoryCount({inventory:after})>28){this.notice(p,'Your backpack is full. Make room before emptying the bucket.');return;}p.inventory[item]--;p.inventory[empty]++;}p.action=null;this.store.save(p);this.notice(p,'Emptied the bucket.');
    }else if(msg.type==='drop'){
      if(!ITEMS[msg.item]||!(p.inventory[msg.item]>0))return;
      const requested=msg.amount==='all'?p.inventory[msg.item]:msg.amount;
      if(!Number.isSafeInteger(requested)||requested<=0)return;
      const quantity=Math.min(requested,p.inventory[msg.item]);
      p.inventory[msg.item]-=quantity;
      this.drops.push({id:randomUUID(),item:msg.item,quantity,x:p.x,y:p.y,floorLevel:p.floorLevel||0,floorBuilding:p.floorBuilding||null,owner:p.id,createdAt:now,publicAt:now+DROP_PRIVATE_MS,expiresAt:now+DROP_LIFETIME_MS});
      this.persistLoot(p);
    }else if(msg.type==='pickup'){
      const drop=this.drops.find(d=>d.id===msg.id);if(!drop||!this.visibleDrop(drop,p,now)){this.notice(p,'That item is no longer available.');return;}
      const path=p.floorLevel?storeyPath(floorBuilding(BUILDINGS,p.floorBuilding),p.floorLevel,p.motion?.toX??p.x,p.motion?.toY??p.y,drop.x,drop.y):pathTo(p.motion?.toX??p.x,p.motion?.toY??p.y,drop.x,drop.y);if(path===null){this.notice(p,'You cannot reach that item.');return;}p.path=path;p.action={pickup:drop.id};
    }else if(msg.type==='equip'){
      const item=ITEMS[msg.item],slot=item?.equipmentSlot;if(!slot||!Object.hasOwn(p.equipment,slot)||!(p.inventory[msg.item]>0))return;
      const old=p.equipment[slot],after={...p.inventory};after[msg.item]--;if(old)after[old]++;if(inventoryCount({inventory:after})>28){this.notice(p,'Your backpack is full. Make room before swapping equipment.');return;}p.inventory[msg.item]--;if(old)p.inventory[old]++;p.equipment[slot]=msg.item;p.action=null;this.store.save(p);this.notice(p,`Equipped ${item.label}.`);
    }else if(msg.type==='unequip'){
      if(!Object.hasOwn(p.equipment,msg.slot)||!p.equipment[msg.slot])return;
      if(receiveCapacity(p,p.equipment[msg.slot])<1){this.notice(p,'Your backpack is full. Make room before unequipping.');return;}
      const item=p.equipment[msg.slot];p.inventory[item]++;p.equipment[msg.slot]=null;p.action=null;this.store.save(p);this.notice(p,`Unequipped ${ITEMS[item].label}.`);
    }else if(msg.type==='chat') {
      if(typeof msg.text!=='string'||now-p.lastChat<1200)return; const text=msg.text.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,160);if(!text)return;
      p.lastChat=now;const entry={name:p.name,text,at:now};this.chat.push(entry);this.chat=this.chat.slice(-40);for(const q of this.players.values())this.send(q,{type:'chat',...entry});
    }else if(msg.type==='smelt') {
      const station=STATIONS.find(n=>n.id===msg.station&&(!n.type||n.type==='furnace'))||STATIONS.find(n=>n.id==='smeltery'),recipe=RECIPES.find(r=>r.id===msg.recipe);
      if(!recipe||!['one','all'].includes(msg.amount))return;
      if(p.motion||p.path.length||!inInteractionRange(p,station)){this.notice(p,'Stand at the furnace inside the smeltery first.');return;}
      if(p.action?.recipe){this.notice(p,'You are already smelting. Walk away to cancel.');return;}
      const available=Math.min(...Object.entries(recipe.inputs).map(([key,n])=>Math.floor(p.inventory[key]/n)));
      if(!available){this.notice(p,'You do not have the required ores in your backpack.');return;}
      p.action={target:station.id,recipe:recipe.id,remaining:msg.amount==='all'?available:1,finishAt:now+2000};
    }else if(msg.type==='smith'||msg.type==='craft') {
      const station=STATIONS.find(n=>n.id===msg.station&&n.type===(msg.type==='craft'?'workbench':'anvil')),recipe=(msg.type==='craft'?WORKBENCH_RECIPES:ANVIL_RECIPES).find(r=>r.id===msg.recipe);
      if(!station||!recipe||!['one','all'].includes(msg.amount))return;
      if(p.motion||p.path.length||!inInteractionRange(p,station)){this.notice(p,'Stand beside the matching workstation before crafting.');return;}
      if(p.action?.recipe){this.notice(p,'You are already working. Walk away to stop.');return;}
      const available=Math.min(...Object.entries(recipe.inputs).map(([key,n])=>Math.floor(p.inventory[key]/n)));
      if(!available){this.notice(p,'You do not have the materials required for this recipe.');return;}
      p.action={target:station.id,recipe:recipe.id,remaining:msg.amount==='all'?available:1,finishAt:now+3000};
    }else if(msg.type==='shop'){
      const merchant=NPCS.find(n=>n.id===msg.merchant&&n.type==='merchant');
      if(!merchant||p.motion||p.path.length||!inInteractionRange(p,merchant)){this.notice(p,'Speak to the workshop merchant first.');return;}
      if(!['buy','sell'].includes(msg.operation)||!Number.isSafeInteger(msg.amount)||msg.amount<1||msg.amount>10000)return;
      const price=msg.operation==='buy'?SHOP_STOCK.find(n=>n.item===msg.item)?.price:SHOP_BUYS[msg.item];if(!price)return;
      const total=price*msg.amount;if(!Number.isSafeInteger(total))return;
      if(msg.operation==='buy'){
        if(p.inventory.coins<total){this.notice(p,'You need more coins in your backpack.');return;}
        const after={...p,inventory:{...p.inventory,coins:p.inventory.coins-total}};
        if(receiveCapacity(after,msg.item)<msg.amount){this.notice(p,'Your backpack is full.');return;}
        p.inventory.coins-=total;p.inventory[msg.item]+=msg.amount;
      }else{
        if(p.inventory[msg.item]<msg.amount)return;
        const after={...p,inventory:{...p.inventory,[msg.item]:p.inventory[msg.item]-msg.amount}};
        if(receiveCapacity(after,'coins')<total){this.notice(p,'Make room for your coins.');return;}
        p.inventory[msg.item]-=msg.amount;p.inventory.coins+=total;
      }
      p.action=null;this.store.save(p);this.notice(p,(msg.operation==='buy'?'Bought ':'Sold ')+msg.amount+' '+ITEMS[msg.item].label.toLowerCase()+' for '+total+' coins.');
    }else if(msg.type==='bank') {
      if(p.motion||p.path.length||!NPCS.some(n=>n.type==='banker'&&inInteractionRange(p,n))){this.notice(p,'Speak to a bank clerk at the counter inside the bank first.');return;}
      if(!Object.hasOwn(ITEMS,msg.item)||!['deposit','withdraw'].includes(msg.operation))return;
      const from=msg.operation==='deposit'?p.inventory:p.bank,to=msg.operation==='deposit'?p.bank:p.inventory;
      const requested=msg.amount===undefined||msg.amount==='all'?from[msg.item]:msg.amount;
      if(!Number.isSafeInteger(requested)||requested<=0){this.notice(p,'Choose a positive whole number of items to transfer.');return;}
      const amount=Math.min(requested,from[msg.item],msg.operation==='deposit'?Number.MAX_SAFE_INTEGER-to[msg.item]:receiveCapacity(p,msg.item));
      if(amount<=0){this.notice(p,'Nothing to transfer, or your backpack is full.');return;}
      from[msg.item]-=amount;to[msg.item]+=amount;this.store.save(p);this.notice(p,`${msg.operation==='deposit'?'Deposited':'Withdrew'} ${amount} ${ITEMS[msg.item].label.toLowerCase()}.`);
    }
  }
  tick(now=Date.now()) {
    this.campfires.prune(now);this.livestock.tick(now,[...this.players.values()]);
    const remaining=this.drops.filter(d=>d.expiresAt>now);if(remaining.length!==this.drops.length){this.drops=remaining;this.store.saveDrops?.(this.drops);}
    for(const p of this.players.values()){
      if(!p.motion)advanceEnergy(p,now,'idle');let startedAt=now;
      while(true){
        if(p.motion){const end=p.motion.startedAt+p.motion.duration;advanceEnergy(p,Math.min(now,end),p.motion.running?'run':'walk');if(now<end)break;[p.x,p.y]=[p.motion.toX,p.motion.toY];p.motion=null;startedAt=end;}
        if(!p.path.length){advanceEnergy(p,now,'idle');break;}
        const [x,y]=p.path.shift();const gate=this.livestock.gates.find(g=>g.x===x&&g.y===y);if(gate)this.livestock.open(gate,now);p.motion={fromX:p.x,fromY:p.y,toX:x,toY:y,startedAt,running:p.runEnabled&&p.energy>0,duration:WALK_MS*Math.hypot(x-p.x,y-p.y)/(p.runEnabled&&p.energy>0?RUN_SPEED:1)};
      }
      if(p.motion||p.path.length||!p.action)continue;
      if(p.action.stairs){const s=p.action.stairs;p.action=null;if(p.x!==s.x||p.y!==s.y)continue;p.x=s.landing.x;p.y=s.landing.y;p.floorLevel=s.toLevel;p.floorBuilding=s.toLevel?s.building:null;p.motion=null;p.path=[];this.store.save(p);continue;}
      if(this.campfires.tick(p,now))continue;
      if(p.action.travel){if(now<p.action.finishAt)continue;const journey=p.action.travel,destination=NPCS.find(n=>n.id===journey.destination&&n.type===(journey.method==='port'?'portmaster':'mage')),landing=travelLanding(destination),source=NPCS.find(n=>n.id===journey.source&&n.type==='portmaster');p.action=null;if(!landing||journey.method==='port'&&(!source||!inInteractionRange(p,source))||p.x!==journey.fromX||p.y!==journey.fromY){this.notice(p,'Your journey was cancelled.');continue;}p.x=landing.x;p.y=landing.y;p.path=[];p.motion=null;this.store.save(p);this.send(p,{type:'travelArrived',method:journey.method,destination:destination.destinationName||destination.name,x:p.x,y:p.y});this.notice(p,'Arrived at '+(destination.destinationName||destination.name)+'.');continue;}
      if(p.action.pickup){const drop=this.drops.find(d=>d.id===p.action.pickup);p.action=null;if(!drop||!this.visibleDrop(drop,p,now)||drop.x!==p.x||drop.y!==p.y){this.notice(p,'That item is no longer available.');continue;}if(receiveCapacity(p,drop.item)<(drop.quantity||1)){this.notice(p,'Your backpack is full. Make room before picking up items.');continue;}p.inventory[drop.item]+=drop.quantity||1;this.drops=this.drops.filter(d=>d!==drop);this.persistLoot(p);continue;}
      const target=p.action.water?{...p.action.water,type:'water'}:millStations().find(n=>n.id===p.action.target)||this.nodes.find(n=>n.id===p.action.target)||this.livestock.cows.find(n=>n.id===p.action.target)||NPCS.find(n=>n.id===p.action.target)||STATIONS.find(n=>n.id===p.action.target)||this.livestock.gates.find(n=>n.id===p.action.target);
      if(target?.type==='cow'&&target.motion)continue;
      if(!target||!inInteractionRange(p,target)){p.action=null;continue;}
      if(target.type==='mill'){if(p.action.finishAt===null){p.action.finishAt=now+12000;p.action.mill=target.building;}if(now>=p.action.finishAt)p.action=null;continue;}
      if(target.type==='gate'){this.livestock.open(target,now);p.action=null;this.notice(p,'Opened '+target.name.toLowerCase()+'. It closes automatically.');continue;}
      if(target.type==='cow'||target.type==='water'){
        const bucket=ITEMS[p.equipment.weapon];if(!bucket?.bucketMaterial){this.notice(p,'Equip an empty bucket in your main hand first.');p.action=null;continue;}if(bucket.contents!=='empty'){this.notice(p,'Your bucket is already full. Empty it before collecting more.');p.action=null;continue;}
        if(target.type==='water'&&tile(target.x,target.y)!=='water'){p.action=null;continue;}
        if(p.action.finishAt===null)p.action.finishAt=now+2000;if(now<p.action.finishAt)continue;
        const contents=target.type==='cow'?'milk':'water';p.equipment.weapon=bucketItem(bucket.bucketMaterial,contents);p.action=null;this.store.save(p);this.notice(p,'Filled your bucket with '+contents+'.');continue;
      }
      if(STATIONS.includes(target)){
        const woodworking=target.type==='workbench',smithing=target.type==='anvil'||woodworking,verb=woodworking?'Made':smithing?'Forged':'Smelted',duration=smithing?3000:2000;
        if(!p.action.recipe){this.send(p,woodworking?{type:'workbenchOpen',station:target.id}:smithing?{type:'anvilOpen',station:target.id}:{type:'smelteryOpen',station:target.id});p.action=null;continue;}
        if(now<p.action.finishAt)continue;
        const recipe=(woodworking?WORKBENCH_RECIPES:smithing?ANVIL_RECIPES:RECIPES).find(r=>r.id===p.action.recipe),ingredients=recipe&&Object.entries(recipe.inputs);
        if(!recipe||ingredients.some(([key,n])=>p.inventory[key]<n)){this.notice(p,smithing?'Smithing stopped: required bars or handles are missing.':'Smelting stopped: required ores are missing.');p.action=null;continue;}
        const after={...p.inventory};for(const [key,n] of ingredients)after[key]-=n;after[recipe.output]++;if(inventoryCount({inventory:after})>28){this.notice(p,'Your backpack is full.');p.action=null;continue;}
        for(const [key,n] of ingredients)p.inventory[key]-=n;
        p.inventory[recipe.output]++;p.xp[recipe.skill||'smithing']+=recipe.xp;
        if(--p.action.remaining<=0)p.action=null;else p.action.finishAt=now+duration;
        this.store.save(p);this.notice(p,`${verb} ${ITEMS[recipe.output].label.toLowerCase()} (+${recipe.xp} ${recipe.skill==='construction'?'Construction':recipe.skill==='crafting'?'Crafting':'Smithing'} XP).`);continue;
      }
      if(target.type==='portmaster'||target.type==='mage'){const port=target.type==='portmaster';this.send(p,{type:'travelOpen',method:port?'port':'magic',source:port?target.id:undefined,destinations:travelDestinations(port?'portmaster':'mage').filter(n=>!port||n.id!==target.id)});p.action=null;continue;}
      if(target.type==='guide'||target.id==='guide'){this.send(p,{type:'dialog',npc:target.name,text:target.dialogue||TOWN_GUIDES[0].text});p.action=null;continue;}
      if(target.type==='merchant'){this.send(p,{type:'shopOpen',merchant:target.id});p.action=null;continue;}
      if(target.type==='banker'){this.send(p,{type:'bankOpen'});this.notice(p,'Bank clerk: Your supplies are safe here. Select a resource to deposit or withdraw.');p.action=null;continue;}
      if(NPCS.includes(target)){if(['smith','smelter'].includes(target.type)){const station=STATIONS.filter(n=>target.type==='smith'?n.type==='anvil':(!n.type||n.type==='furnace')).sort((a,b)=>distance(target,a)-distance(target,b))[0];if(station){this.command(p,{type:'interact',id:station.id},now);continue;}}this.send(p,{type:'dialog',npc:target.name,text:target.dialogue||'Welcome, traveller.'});p.action=null;continue;}
      if(target.kind==='fishing'){
        const tool=ITEMS[p.equipment.weapon];if(tool?.fishingTool!==target.tool){this.notice(p,'Equip a fishing '+(target.tool==='rod'?'rod':'net')+' to fish here.');p.action=null;continue;}
        const eligible=target.fish.filter(id=>FISH[id].level<=level(p.xp.fishing));if(!eligible.length){this.notice(p,'Fishing level '+Math.min(...target.fish.map(id=>FISH[id].level))+' is required here.');p.action=null;continue;}
        if(p.action.finishAt===null)p.action.finishAt=now+3000;if(now<p.action.finishAt)continue;
        const item=eligible[Math.floor(Math.random()*eligible.length)];this.drops.push({id:randomUUID(),item,x:p.x,y:p.y,owner:p.id,createdAt:now,publicAt:now+DROP_PRIVATE_MS,expiresAt:now+DROP_LIFETIME_MS});p.xp.fishing+=FISH[item].xp;p.action.finishAt=now+3000;this.persistLoot(p);continue;
      }
      if(target.readyAt>now){this.notice(p,'Someone has gathered this resource. It will return soon.');p.action=null;continue;}
      const tool=equippedTool(p,ITEMS[target.item].skill);if(!tool){this.notice(p,`Equip ${target.kind==='tree'?'an axe':'a pickaxe'} in your main hand first.`);p.action=null;continue;}
      if(p.action.finishAt===null)p.action.finishAt=now+gatheringDuration({[tool]:1},ITEMS[target.item].skill);
      if(now>=p.action.finishAt){
        target.readyAt=now+20000;this.drops.push({id:randomUUID(),item:target.item,x:p.x,y:p.y,owner:p.id,createdAt:now,publicAt:now+DROP_PRIVATE_MS,expiresAt:now+DROP_LIFETIME_MS});p.xp[ITEMS[target.item].skill]+=25;p.action=null;
        this.persistLoot(p,this.nodes.map(({id,readyAt})=>({id,readyAt})));
      }
    }
      this.combat.tick(now);
  }
  snapshot(p,now=Date.now()) {return {type:'state',at:now,fires:this.campfires.fires,enemies:this.combat.snapshot(),...this.livestock.snapshot(now),drops:this.dropStacks(p,now),players:[...this.players.values()].map(q=>({id:q.id,name:q.name,hits:(q.hits||[]).filter(h=>now-h.at<2000),hp:q.hp,maxHp:maxHitpoints(q),swingAt:q.swingAt,buryStartedAt:q.buryStartedAt,combatOption:activeCombatOption(q).id,attackType:activeCombatOption(q).type,facing:q.facing,combatZone:combatZoneAt(q.x,q.y),...playerRating(q.xp),x:q.x,y:q.y,floorLevel:q.floorLevel||0,floorBuilding:q.floorBuilding||null,equipment:q.equipment,gathering:q.action?.finishAt&&!q.action?.recipe&&!q.motion&&!q.path.length?(()=>{const n=this.nodes.find(n=>n.id===q.action.target);return n?{target:n.id,x:n.x,y:n.y,kind:n.kind,tool:equippedTool(q,ITEMS[n.item].skill)}:null;})():null,motion:q.motion,route:q.path.slice(0,8),mill:q.action?.mill&&!q.motion&&!q.path.length?q.action.mill:null,action:q.motion||q.path.length?(q.motion?.running?'Running':'Walking'):q.combat?'Fighting':now-(q.buryStartedAt??-Infinity)<1500?'Burying bones':q.action?.mill?'Operating mill':q.action?.firemaking?'Lighting fire':q.action?.cooking?'Cooking':q.action?.travel?(q.action.travel.method==='port'?'Preparing to sail':'Casting teleport'):q.action?(q.action.recipe?(STATIONS.find(n=>n.id===q.action.target)?.type==='workbench'?'Woodworking':STATIONS.find(n=>n.id===q.action.target)?.type==='anvil'?'Smithing':'Smelting'):q.action.pickup?'Picking up':q.action.water?'Collecting water':NPCS.find(n=>n.id===q.action.target)?.type==='cow'?'Milking':this.nodes.find(n=>n.id===q.action.target)?.kind==='fishing'?'Fishing':q.action.finishAt?'Gathering':'Walking'):'Idle'})),nodes:this.nodes.map(n=>({...n,available:n.readyAt<=now})),self:{floorLevel:p.floorLevel||0,floorBuilding:p.floorBuilding||null,hpRegen:p.hp<maxHitpoints(p)?{readyAt:p.nextHeal||null,duration:10000,paused:Boolean(p.combat)}:null,energy:p.energy,runEnabled:p.runEnabled,prayerPoints:p.prayerPoints,maxPrayer:level(p.xp.prayer),hp:p.hp,maxHp:maxHitpoints(p),combatOption:activeCombatOption(p).id,combatOptions:combatOptions(p.equipment.weapon),combatStyle:activeCombatOption(p).skill,combatZone:combatZoneAt(p.x,p.y),...playerRating(p.xp),smelting:p.action?.recipe&&(!STATIONS.find(n=>n.id===p.action.target)?.type||STATIONS.find(n=>n.id===p.action.target)?.type==='furnace')?{recipe:p.action.recipe,remaining:p.action.remaining}:null,smithing:p.action?.recipe&&['anvil','workbench'].includes(STATIONS.find(n=>n.id===p.action.target)?.type)?{recipe:p.action.recipe,remaining:p.action.remaining,station:p.action.target}:null,tools:Object.fromEntries(['mining','woodcutting'].map(skill=>[skill,equippedTool(p,skill)||null])),equipment:p.equipment,inventory:p.inventory,bank:p.bank,xp:p.xp,levels:playerLevels(p.xp),count:inventoryCount(p)}};}
  save(){this.store.saveDrops?.(this.drops);for(const p of this.players.values())this.store.save(p);this.store.saveWorld(this.nodes.map(({id,readyAt})=>({id,readyAt})));}
}

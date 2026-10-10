import {Game} from './game.mjs';
export class Worlds {
 constructor(store,count=3){this.store=store;this.worlds=new Map();for(let id=1;id<=count;id++){const game=new Game({loadWorld:()=>store.loadWorld(id===1?'nodes':`nodes:${id}`),saveWorld:n=>store.saveWorld(n,id===1?'nodes':`nodes:${id}`),save:p=>store.save(p),loadDrops:()=>store.loadDrops(`drops:${id}`),saveDrops:d=>store.saveDrops(d,`drops:${id}`),persistLoot:(p,d,n)=>store.persistLoot(p,d,n,`drops:${id}`,id===1?'nodes':`nodes:${id}`)});this.worlds.set(id,{id,name:`World ${id}`,capacity:100,game});}}
 list(){return [...this.worlds.values()].map(({id,name,capacity,game})=>({id,name,capacity,online:game.players.size}));}
 has(id){return [...this.worlds.values()].some(w=>w.game.players.has(id));}
 join(saved,emit,id=1){const world=this.worlds.get(id);if(!world)throw new Error('That world is offline.');if(this.has(saved.id))throw new Error('This character is already connected to a world.');if(world.game.players.size>=world.capacity)throw new Error('That world is full.');return {world,player:world.game.join(saved,m=>emit(m.type==='welcome'?{...m,worldId:id,worldName:world.name}:m))};}
 switch(connection,id,emit){if(connection.player.combatUntil>Date.now())throw Error('Wait until you are out of combat before changing worlds.');if(connection.world.id===id)return connection;const target=this.worlds.get(id);if(!target)throw new Error('That world is offline.');if(target.game.players.size>=target.capacity)throw new Error('That world is full.');connection.world.game.leave(connection.player);return this.join(connection.player,emit,id);}
 save(){for(const w of this.worlds.values())w.game.save();}
 tick(){for(const w of this.worlds.values())w.game.tick();}
}

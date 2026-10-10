export function healthRecovery(self,at){
 if(self.hp>=self.maxHp)return {fill:100,text:'Hitpoints: '+self.hp+' / '+self.maxHp+' · Fully recovered'};
 const r=self.hpRegen;
 if(!r?.readyAt||r.paused)return {fill:0,text:'Hitpoints: '+self.hp+' / '+self.maxHp+' · Recovery paused during combat'};
 const left=Math.max(0,r.readyAt-at),fill=Math.max(0,Math.min(100,(1-left/r.duration)*100));
 return {fill,text:'Hitpoints: '+self.hp+' / '+self.maxHp+' · Next hitpoint in '+Math.ceil(left/1000)+'s'};
}

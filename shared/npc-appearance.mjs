// NPC outfits have their own garment geometry and materials on the shared player rig.
export const NPC_OUTFITS = {
 resident: [123,111,82], guide:[81,127,74], banker:[53,77,121],
 guard:[147,158,172], merchant:[133,63,74], smith:[92,103,114],
 smelter:[156,82,43], portmaster:[43,117,132], mage:[120,72,156],
 'guide-banking':[64,107,152], 'guide-smelting':[180,92,45],
 'guide-forging':[118,130,145], 'guide-woodworking':[123,99,53],
 'guide-fishing':[43,140,127], 'guide-cooking':[187,164,113],
 'guide-combat':[132,56,48]
};
export function npcOutfit(n) {
 if(n.type==='cow'||n.type==='enemy')return null;
 if(n.type==='guide'&&NPC_OUTFITS[n.id])return n.id;
 if(n.type==='guard'||/\bguard\b/i.test(n.name||'')||/^guard(?:-|$)/i.test(n.id||''))return 'guard';
 return Object.hasOwn(NPC_OUTFITS,n.type)?n.type:n.id==='guide'?'guide':'resident';
}
export const npcModelUrl=role=>'/models/npc-'+role+'.glb?v=20261009-wardrobe-1';

// Compass degrees clockwise from north; old worlds retain their original facing.
export function npcRotation(n,buildings=[]){
 const angle=n.rotation??((n.type==='banker'?0:180)+(buildings.find(b=>b.occupants?.includes(n.id))?.rotation||0));
 return ((angle%360)+360)%360;
}
export function npcYaw(n,buildings=[]){return (180-npcRotation(n,buildings))*Math.PI/180;}

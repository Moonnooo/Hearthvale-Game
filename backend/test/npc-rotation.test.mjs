import test from 'node:test';
import assert from 'node:assert/strict';
import {npcRotation,npcYaw} from '../../shared/npc-appearance.mjs';
import {exportWorldDocument,applyWorldDocument,rotateEditorBuilding} from '../server/world.mjs';
test('NPC compass facing preserves legacy orientation and explicit angles',()=>{
 const buildings=[{rotation:90,occupants:['clerk']}];
 assert.equal(npcRotation({id:'clerk',type:'banker'},buildings),90);
 assert.equal(npcRotation({id:'guide',type:'guide'},buildings),180);
 for(const angle of [0,45,90,180,270]){const n={id:'clerk',type:'banker',rotation:angle};assert.equal(npcRotation(n,buildings),angle);assert.equal(npcYaw(n,buildings),(180-angle)*Math.PI/180);}
});
test('authored facing persists and follows whole-building turns',()=>{
 const original=exportWorldDocument();try{
 const doc=structuredClone(original),i=doc.buildings.findIndex(b=>b.id==='bank'),n=doc.npcs.find(n=>doc.buildings[i].occupants.includes(n.id));n.rotation=315;
 applyWorldDocument(doc);assert.equal(exportWorldDocument().npcs.find(p=>p.id===n.id).rotation,315);
 const turned=rotateEditorBuilding(doc,i);assert.equal(turned.npcs.find(p=>p.id===n.id).rotation,45);
 n.rotation=-1;assert.throws(()=>applyWorldDocument(doc),/NPC facing/);n.rotation=Infinity;assert.throws(()=>applyWorldDocument(doc),/NPC facing/);
 }finally{applyWorldDocument(original);}
});

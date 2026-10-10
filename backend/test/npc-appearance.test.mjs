import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {NPC_OUTFITS,npcOutfit,npcModelUrl} from '../../shared/npc-appearance.mjs';
test('human jobs and specialist guides receive outfits while other models remain intact',()=>{
 for(const type of ['resident','guide','banker','guard','merchant','smith','smelter','portmaster','mage'])assert.equal(npcOutfit({id:'custom',type}),type);
 for(const role of Object.keys(NPC_OUTFITS).filter(n=>n.startsWith('guide-')))assert.equal(npcOutfit({id:role,type:'guide'}),role);
 assert.equal(npcOutfit({id:'town-guard',type:'resident',name:'Town Guard'}),'guard');
 assert.equal(npcOutfit({id:'guide'}),'guide');
 assert.equal(npcOutfit({type:'future-job'}),'resident');
 assert.equal(npcOutfit({type:'cow'}),null);assert.equal(npcOutfit({type:'enemy'}),null);
 assert.equal(new Set(Object.values(NPC_OUTFITS).map(v=>JSON.stringify(v))).size,Object.keys(NPC_OUTFITS).length);
});
test('each role exports new garment geometry, materials and a complete compatible skeleton',()=>{

 const signatures=new Set();
 for(const role of Object.keys(NPC_OUTFITS)){
  const raw=readFileSync(new URL('../../client/assets/models/npc-'+role+'.glb',import.meta.url));
  assert.equal(raw.subarray(0,4).toString(),'glTF');
  const gltf=JSON.parse(raw.subarray(20,20+raw.readUInt32LE(12)));
  assert.ok(gltf.skins.length);const joints=gltf.skins[0].joints.map(i=>gltf.nodes[i].name);
  for(const bone of ['Head','Chest','Hips','Hand.L','Hand.R','Thigh.L','Thigh.R'])assert.ok(joints.includes(bone),role+' missing '+bone);
  assert.ok(gltf.nodes.some(n=>n.name==='Original face and hands'));
  assert.ok(gltf.nodes.some(n=>n.extras?.characterHeight>0));
  const garments=gltf.nodes.filter(n=>n.mesh!==undefined&&n.name!=='Original face and hands');assert.ok(garments.length>=18);
  for(const node of garments){assert.ok(Number.isInteger(node.skin),role+' unbound garment '+node.name);for(const p of gltf.meshes[node.mesh].primitives)assert.ok(p.attributes.WEIGHTS_0!==undefined);}
  signatures.add(garments.map(n=>n.name).sort().join(','));
  assert.ok(gltf.materials.some(m=>m.name==='Natural skin and facial details'));
  assert.ok(gltf.materials.some(m=>m.name==='Worn brown leather'));
  assert.ok(npcModelUrl(role).includes('npc-'+role+'.glb'));
 }
 assert.ok(signatures.size>=9,'Roles must differ by garment geometry, not merely colours');
});

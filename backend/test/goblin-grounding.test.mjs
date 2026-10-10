import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {groundGoblin} from '../../shared/goblin-grounding.mjs';import {goblinPose} from '../../shared/goblin-pose.mjs';
test('the actual skinned goblin stays above the floor throughout kneeling and falling',async()=>{
 const source=readFileSync(new URL('../../client/assets/models/forest-goblin.glb',import.meta.url)),jsonLength=source.readUInt32LE(12),json=JSON.parse(source.subarray(20,20+jsonLength)),binary=source.subarray(28+jsonLength);
 // Textures are irrelevant to this geometry test; omit them for the Node loader.
 delete json.images;delete json.textures;delete json.materials;for(const mesh of json.meshes)for(const p of mesh.primitives)delete p.material;
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);const b=Buffer.alloc(28+padded.length+binary.length);
 b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(padded.length,12);b.writeUInt32LE(0x4e4f534a,16);padded.copy(b,20);b.writeUInt32LE(binary.length,20+padded.length);b.writeUInt32LE(0x004e4942,24+padded.length);binary.copy(b,28+padded.length);
 const {scene:model}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 const bounds=new THREE.Box3().setFromObject(model);model.scale.setScalar(1.15/bounds.getSize(new THREE.Vector3()).y);const bones=[];model.traverse(o=>{if(o.isBone)bones.push({bone:o,rest:o.quaternion.clone(),position:o.position.clone()});});
 const v=new THREE.Vector3();
 for(let age=0;age<=2500;age+=50){
  const p=goblinPose({deathAge:age});for(const r of bones){r.bone.quaternion.copy(r.rest);r.bone.position.copy(r.position);if(r.bone.name.startsWith('Shin'))r.bone.rotateX(p.knees[0]);if(r.bone.name.startsWith('Thigh'))r.bone.rotateX(p.legs[0]);}
  model.rotation.x=p.rootTilt;model.position.y=p.rootLift-p.hipsDrop;
  groundGoblin(model);let lowest=Infinity;model.traverse(mesh=>{if(!mesh.isMesh)return;mesh.skeleton?.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v).applyMatrix4(mesh.matrixWorld);lowest=Math.min(lowest,v.y);}});
  assert.ok(Math.abs(lowest-.012)<1e-5,`Ground contact at ${age}ms: ${lowest}`);
 }
});

import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {normalizeBridge,bridgeDeckHeight} from '../../shared/bridge-model.mjs';
async function load(file){
 const source=readFileSync(new URL('../../client/assets/models/'+file,import.meta.url)),jsonLength=source.readUInt32LE(12),json=JSON.parse(source.subarray(20,20+jsonLength)),binary=source.subarray(28+jsonLength);
 // Textures are irrelevant to this geometry test; omit them for the Node loader.
 delete json.images;delete json.textures;delete json.materials;for(const mesh of json.meshes)for(const p of mesh.primitives)delete p.material;
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);const b=Buffer.alloc(28+padded.length+binary.length);
 b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(padded.length,12);b.writeUInt32LE(0x4e4f534a,16);padded.copy(b,20);b.writeUInt32LE(binary.length,20+padded.length);b.writeUInt32LE(0x004e4942,24+padded.length);binary.copy(b,28+padded.length);
 const {scene:model}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 return model;
}
test('imported bridge fits a three-by-three footprint with an aligned walkable deck',async()=>{
 const template=normalizeBridge(THREE,await load('wooden-bridge.glb')),bounds=new THREE.Box3().setFromObject(template),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3());
 assert.ok(Math.abs(size.x-3)<1e-5);assert.ok(Math.abs(size.z-3)<1e-5);assert.ok(Math.abs(centre.x)<1e-5&&Math.abs(centre.z)<1e-5);
 const profile=template.userData.deckProfile;assert.equal(profile.length,27);assert.ok(profile.every(Number.isFinite));assert.ok(Math.min(...profile)>-.1);assert.ok(Math.max(...profile)<.65);
 assert.ok(profile.every(height=>height===.025),'The walking surface stays level');
 const ray=new THREE.Raycaster(),deck=[];template.updateMatrixWorld(true);for(let x=-1.2;x<=1.2;x+=.2){ray.set(new THREE.Vector3(x,3,0),new THREE.Vector3(0,-1,0));deck.push(ray.intersectObject(template,true)[0].point.y);}assert.ok(Math.max(...deck)-Math.min(...deck)<.15,'The mesh deck is level apart from plank detail');
 assert.equal(bridgeDeckHeight(profile,-1.5),0);assert.equal(bridgeDeckHeight(profile,1.5),0);
 assert.ok(Math.abs(bridgeDeckHeight(profile,0)-profile[13])<1e-6);
 const clone=template.clone(true);assert.equal(clone.children[0].children[0].geometry,template.children[0].children[0].geometry);
});

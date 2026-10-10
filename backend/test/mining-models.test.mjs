import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as THREE from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';import {normalizeMiningModel,createMiningResource} from '../../shared/mining-models.mjs';
async function load(file){
 const source=readFileSync(new URL('../../client/assets/models/'+file,import.meta.url)),jsonLength=source.readUInt32LE(12),json=JSON.parse(source.subarray(20,20+jsonLength)),binary=source.subarray(28+jsonLength);
 // Textures are irrelevant to this geometry test; omit them for the Node loader.
 delete json.images;delete json.textures;delete json.materials;for(const mesh of json.meshes)for(const p of mesh.primitives)delete p.material;
 const text=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(text.length/4)*4,32);text.copy(padded);const b=Buffer.alloc(28+padded.length+binary.length);
 b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(padded.length,12);b.writeUInt32LE(0x4e4f534a,16);padded.copy(b,20);b.writeUInt32LE(binary.length,20+padded.length);b.writeUInt32LE(0x004e4942,24+padded.length);binary.copy(b,28+padded.length);
 const {scene:model}=await new GLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');
 return model;
}
test('actual ore cluster is embedded in the rock, remains visible above it, and tints independently',async()=>{
 const rock=normalizeMiningModel(THREE,await load('mining-rock.glb'),'rock'),ore=normalizeMiningModel(THREE,await load('ore-cluster.glb'),'ore');
 const copper=createMiningResource(THREE,rock,ore,0xc39056),coal=createMiningResource(THREE,rock,ore,0x343b42);
 copper.ore.updateMatrixWorld(true);copper.rock.updateMatrixWorld(true);const rb=new THREE.Box3().setFromObject(copper.rock),ob=new THREE.Box3().setFromObject(copper.ore);
 assert.ok(rb.min.y>=.0049);assert.ok(ob.min.y<rb.max.y&&ob.max.y>rb.max.y,'Ore must overlap the rock and protrude above it');assert.ok(ob.max.x<=rb.max.x&&ob.min.x>=rb.min.x);
 let copperMesh,coalMesh;copper.ore.traverse(o=>{if(o.isMesh)copperMesh=o;});coal.ore.traverse(o=>{if(o.isMesh)coalMesh=o;});assert.equal(copperMesh.material.color.getHex(),0xc39056);assert.equal(coalMesh.material.color.getHex(),0x343b42);assert.equal(copperMesh.geometry,coalMesh.geometry);
 copper.ore.visible=false;assert.equal(copper.rock.visible,true);coal.ore.visible=true;assert.equal(coal.ore.visible,true);
});

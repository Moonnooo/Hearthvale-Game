import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createBridgeApproaches,bridgeApproachHeight} from '../../shared/bridge-approaches.mjs';
test('bridge banks overlap the deck and land, with a smooth walking transition',()=>{
 const bridge={x:10,y:20},height=(x,y)=>Math.abs(x-10)*.1;
 const group=createBridgeApproaches(THREE,bridge,height,()=>true,new THREE.MeshStandardMaterial());
 assert.equal(group.children.length,4);
 for(const side of [-1,1]){
  assert.ok(Math.abs(bridgeApproachHeight(bridge,10+side*1.05,20,height)-.015)<1e-6);
  assert.ok(Math.abs(bridgeApproachHeight(bridge,10+side*1.8,20,height)-height(10+side*1.8,20))<1e-6);
 }
 assert.equal(bridgeApproachHeight(bridge,10,20,height),undefined);
 assert.equal(bridgeApproachHeight(bridge,11.5,21,height),undefined);
 const bounds=new THREE.Box3().setFromObject(group);
 assert.ok(Math.abs(bounds.min.x+1.8)<1e-6&&Math.abs(bounds.max.x-1.8)<1e-6);
 assert.equal(createBridgeApproaches(THREE,bridge,height,()=>false,new THREE.MeshStandardMaterial()).children.length,0);
});

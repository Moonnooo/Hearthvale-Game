import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';
import {fitTreeRoots} from '../../shared/tree-appearance.mjs';
test('roots fit sloping terrain in the saved rotation while the upper tree and shared template stay unchanged',()=>{
 const template=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));mesh.position.y=.5;template.add(mesh);const original=Array.from(mesh.geometry.attributes.position.array),tree={x:12,y:8,rotation:90},height=(x,y)=>3+(x-12)*.6+(y-8)*.2;
 const fitted=template.clone(true);fitTreeRoots(THREE,fitted,tree,height);fitted.updateMatrixWorld(true);const child=fitted.children[0],positions=child.geometry.attributes.position,point=new THREE.Vector3();
 for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(child.matrixWorld);const oldY=original[i*3+1]+.5;if(oldY===1)assert.equal(point.y,1);else{const worldX=12+point.z,worldY=8-point.x;assert.ok(Math.abs(point.y-(height(worldX,worldY)-3-.035))<1e-6);}}
 assert.deepEqual(Array.from(mesh.geometry.attributes.position.array),original);assert.notEqual(child.geometry,mesh.geometry);
});
test('flat ground embeds roots slightly without tilting the trunk',()=>{const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1));mesh.position.y=.5;root.add(mesh);fitTreeRoots(THREE,root,{x:0,y:0,rotation:0},()=>0);assert.ok(Math.abs(mesh.geometry.boundingBox.min.y+.535)<1e-6);assert.equal(mesh.geometry.boundingBox.max.y,.5);assert.equal(root.rotation.x,0);});

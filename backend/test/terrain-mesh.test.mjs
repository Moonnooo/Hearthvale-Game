import test from 'node:test';import assert from 'node:assert/strict';import * as THREE from 'three';import {terrainGeometries} from '../../shared/terrain-mesh.mjs';
const cells=Array.from({length:4096},(_,i)=>[i%64,Math.floor(i/64)]);
test('flat terrain uses two triangles per tile and bounds small chunks',()=>{
 const geometries=terrainGeometries(THREE,cells,()=>0),triangles=geometries.reduce((sum,g)=>sum+g.index.count/3,0),vertices=geometries.reduce((sum,g)=>sum+g.attributes.position.count,0);
 assert.equal(geometries.length,16);assert.equal(triangles,8192);assert.ok(vertices<5000);
 for(const g of geometries){const size=g.boundingBox.getSize(new THREE.Vector3());assert.ok(size.x<=16&&size.z<=16);}
 console.log(JSON.stringify({oldTriangles:4096*32,newTriangles:triangles,oldVertices:4096*96,newVertices:vertices}));
});
test('edited terrain retains quarter-tile height samples and UV alignment',()=>{
 const height=(x,z)=>Math.sin(x)*Math.cos(z),geometries=terrainGeometries(THREE,cells,height,(x,z)=>[x/64,z/64]);
 for(const g of geometries){const p=g.attributes.position,uv=g.attributes.uv;for(let i=0;i<p.count;i++){assert.ok(Math.abs(p.getY(i)-height(p.getX(i),p.getZ(i)))<1e-6);assert.ok(Math.abs(uv.getX(i)-p.getX(i)/64)<1e-6);}}
 const triangles=geometries.reduce((sum,g)=>sum+g.index.count/3,0),vertices=geometries.reduce((sum,g)=>sum+g.attributes.position.count,0);assert.equal(triangles,4096*32);assert.ok(vertices<4096*96*.2);
 console.log(JSON.stringify({hillyTriangles:triangles,oldVertices:4096*96,newVertices:vertices}));
 const meshes=geometries.map(g=>new THREE.Mesh(g,new THREE.MeshBasicMaterial()));for(const m of meshes)m.updateMatrixWorld();const ray=new THREE.Raycaster(new THREE.Vector3(17,5,23),new THREE.Vector3(0,-1,0));const hit=ray.intersectObjects(meshes)[0];assert.ok(Math.abs(hit.point.y-height(17,23))<1e-6);
});

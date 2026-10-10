import test from 'node:test';import assert from 'node:assert/strict';
import {assertEditorPlacement} from '../server/editor-placement.mjs';
import {boundaryArms} from '../server/boundary-layout.mjs';
import {modelFloor,modelRearDoor} from '../server/building-catalog.mjs';
import {copyEditorSelection,pasteEditorSelection,exportWorldDocument} from '../server/world.mjs';
const empty=()=>({nodes:[],npcs:[],stations:[],boundaries:[],buildings:[],bridges:[]});
test('fences and objects cannot occupy each other’s tiles, but adjacent trees stay allowed',()=>{
 const w=empty();w.nodes.push({x:10,y:10,kind:'tree'});
 assert.throws(()=>assertEditorPlacement(w,'boundaries',{x:10,y:10,type:'fence'}),/already/);
 assert.doesNotThrow(()=>assertEditorPlacement(w,'boundaries',{x:11,y:10,type:'fence'}));
 w.boundaries.push({x:11,y:10,type:'fence'});
 for(const type of ['fence','gate','romanWall'])assert.throws(()=>assertEditorPlacement(w,'boundaries',{x:11,y:10,type}),/already/);
 for(const k of ['nodes','npcs','stations'])assert.throws(()=>assertEditorPlacement(w,k,{x:11,y:10}),/already/);
});
test('rejected pasted overlap is atomic',()=>{
 const w=exportWorldDocument();w.boundaries=[{x:60,y:60,type:'fence'}];
 const clip=copyEditorSelection(w,[{collection:'boundaries',index:0}]),before=structuredClone(w);
 assert.throws(()=>pasteEditorSelection(w,clip,60,60,()=> 'copy'),/already/);assert.deepEqual(w,before);
});
test('fences reach the actual wall with fine building offsets, but do not span extra tiles or doors',()=>{
 const w=empty(),b={id:'house',model:'medievalCottage',x:10,y:10,width:7,height:7,offsetX:.4,rotation:0};modelFloor(b);w.buildings=[b];
 const a=boundaryArms(w,{x:9,y:13,type:'fence'}).find(a=>a.buildingId==='house');
 assert.ok(a);assert.ok(a.length>.5&&a.length<1.45);
 assert.ok(!boundaryArms(w,{x:8,y:13,type:'fence'}).some(a=>a.buildingId));
 const mill={id:'mill',model:'medievalMill',x:10,y:10,width:7,height:7};modelFloor(mill);w.buildings=[mill];
 assert.ok(!boundaryArms(w,{x:13,y:9,type:'fence'}).some(a=>a.buildingId));
});
test('the mill rear doorway remains opposite the front entrance in every rotation',()=>{
 for(const rotation of [0,90,180,270]){
  const b={model:'medievalMill',x:10,y:10,width:7,height:7,rotation};modelFloor(b);const rear=modelRearDoor(b);
  assert.ok(b.open.some(p=>p[0]===rear[0]&&p[1]===rear[1]));
  assert.equal(Math.abs(rear[0]-b.door[0])+Math.abs(rear[1]-b.door[1]),6);
 }
});

import test from 'node:test';import assert from 'node:assert/strict';
import {treeRotation,woodlandSampler} from '../../shared/tree-appearance.mjs';
import {exportWorldDocument,applyWorldDocument} from '../server/world.mjs';
test('tree rotation survives moves, world serialization and resource availability changes',()=>{
 const original=exportWorldDocument(),doc=structuredClone(original),tree=doc.nodes.find(n=>n.kind==='tree');tree.rotation=127.5;
 try{applyWorldDocument(doc);const saved=exportWorldDocument().nodes.find(n=>n.id===tree.id);assert.equal(saved.rotation,127.5);assert.equal(treeRotation(saved),127.5*Math.PI/180);assert.equal(treeRotation({...saved,x:saved.x+1,available:false}),treeRotation(saved));const legacy={id:'tree-fixed',x:1,y:2};assert.equal(treeRotation({...legacy,x:9,y:12}),treeRotation(legacy));tree.rotation=Infinity;assert.throws(()=>applyWorldDocument(doc),/Invalid tree rotation/);}finally{applyWorldDocument(original);}
});
test('woodland ground is concentrated beneath trees and denser among groups',()=>{const lone=woodlandSampler([{x:0,y:0}]),dense=woodlandSampler([{x:0,y:0},{x:1,y:0},{x:0,y:1}]);assert.equal(lone(10,10),0);assert.ok(lone(0,0)>lone(2,0));assert.ok(dense(1,1)>lone(1,1));});

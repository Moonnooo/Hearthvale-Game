import test from 'node:test';import assert from 'node:assert/strict';
import {exportWorldDocument,applyWorldDocument,tile,walkable,pathTo,canStep,placeEditorBridge,removeEditorBridge,normalizeBridgeTerrain} from '../server/world.mjs';
test('water stays beneath a bridge while its deck provides a route; removing it closes the crossing',()=>{
 const original=exportWorldDocument(),doc=structuredClone(original),b=doc.bridges[0];
 try{for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)doc.regions[0].tiles[`${b.x+dx},${b.y+dy}`]='water';applyWorldDocument(doc);
 for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){assert.equal(tile(b.x+dx,b.y+dy),'water');assert.equal(walkable(b.x+dx,b.y+dy),dy===0);}
 assert.equal(walkable(b.x,b.y+2),false);assert.ok(pathTo(b.x-2,b.y,b.x+2,b.y));
 assert.equal(canStep(b.x-2,b.y-1,b.x-1,b.y),false,'Cannot enter diagonally through the side logs');
 assert.ok(canStep(b.x-2,b.y,b.x-1,b.y));assert.equal(walkable(b.x,b.y-1),false);
 const without=structuredClone(doc);removeEditorBridge(without,0);applyWorldDocument(without);assert.equal(tile(b.x,b.y),'water');assert.equal(walkable(b.x,b.y),false);
 }finally{applyWorldDocument(original);}
});
test('new bridge placement preserves water; legacy road decks restore their saved underlay once',()=>{
 const doc=exportWorldDocument(),r=doc.regions[0];for(let y=28;y<=30;y++)for(let x=19;x<=21;x++)r.tiles[`${x},${y}`]='water';
 const bridge=placeEditorBridge(doc,20,29);assert.equal(bridge.surface,true);assert.equal(r.tiles['20,29'],'water');removeEditorBridge(doc,doc.bridges.length-1);assert.equal(r.tiles['20,29'],'water');
 const old=doc.bridges[0];delete old.surface;r.tiles[`${old.x},${old.y}`]='path';normalizeBridgeTerrain(doc);assert.equal(r.tiles[`${old.x},${old.y}`],'water');assert.equal(old.surface,true);
 r.tiles[`${old.x},${old.y}`]='sand';normalizeBridgeTerrain(doc);assert.equal(r.tiles[`${old.x},${old.y}`],'sand');
});

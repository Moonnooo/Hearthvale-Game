import test from 'node:test';
import assert from 'node:assert/strict';
import {translateArea} from '../../shared/area-editing.mjs';
import {moveEditorSelection} from '../server/world.mjs';
const area={name:'Test',x:5,y:5,polygon:[[0,0],[10,0],[10,10],[0,10]]};
test('whole-area fine movement preserves shape, source and unrelated objects',()=>{const before=structuredClone(area),moved=translateArea(area,.25,2);assert.deepEqual(area,before);assert.deepEqual(moved.polygon,[[.25,2],[10.25,2],[10.25,12],[.25,12]]);assert.equal(moved.x,5);assert.equal(moved.y,7);});
test('moving to an outer boundary clamps the entire polygon together',()=>{const moved=translateArea(area,-4,-20,64);assert.deepEqual(moved.polygon,[[-.5,-.5],[9.5,-.5],[9.5,9.5],[-.5,9.5]]);assert.deepEqual(translateArea(area,100,100,64).polygon,[[53.5,53.5],[63.5,53.5],[63.5,63.5],[53.5,63.5]]);});
test('legacy object movement rejects an area border outside the world atomically',()=>{const doc={areas:[structuredClone(area)],npcs:[],stations:[],bridges:[],barriers:[]};assert.throws(()=>moveEditorSelection(doc,[{collection:'areas',index:0}],0,-3),/entire area border/);assert.deepEqual(doc.areas[0],area);});

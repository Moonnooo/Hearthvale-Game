import test from 'node:test';import assert from 'node:assert/strict';import {advancePlayerGait} from '../../shared/player-gait.mjs';
const motion={fromX:0,fromY:0,toX:1,toY:0,duration:300};
test('short movement-update pauses do not freeze the gait',()=>{
 let gait;for(let i=0;i<40;i++)gait=advancePlayerGait(gait,{distance:1/18,dt:1000/60,motion,action:'Walking'});
 const phase=gait.phase;for(let i=0;i<6;i++){const previous=gait.phase;gait=advancePlayerGait(gait,{distance:0,dt:1000/60,motion,action:'Walking'});assert.ok(gait.phase!==previous);assert.ok(gait.weight>.99);}
 assert.notEqual(gait.phase,phase);
});
test('gait cadence is independent of frame rate and packet spacing',()=>{
 const run=(fps,jitter=false)=>{let gait;for(let i=0;i<fps;i++)gait=advancePlayerGait(gait,{distance:jitter?(i%5===0?5/(fps*.3):0):1/(fps*.3),dt:1000/fps,motion,action:'Walking'});return gait;};
 const regular=run(60),jitter=run(60,true);assert.ok(Math.abs(regular.phase-jitter.phase)<1e-6);
 assert.ok(Math.abs(regular.phase-run(30).phase)<.15);assert.ok(Math.abs(regular.phase-run(144).phase)<.15);
});
test('stopping settles the body, and a stale walking state cannot animate forever',()=>{
 let gait;for(let i=0;i<30;i++)gait=advancePlayerGait(gait,{distance:.055,dt:16.67,motion,action:'Walking'});
 for(let i=0;i<60;i++)gait=advancePlayerGait(gait,{distance:0,dt:16.67,motion,action:'Idle'});
 assert.ok(gait.weight<.001);assert.ok(gait.speed<.001);
 for(let i=0;i<30;i++)gait=advancePlayerGait(gait,{distance:.055,dt:16.67,motion,action:'Walking'});
 for(let i=0;i<60;i++)gait=advancePlayerGait(gait,{distance:0,dt:16.67,motion,action:'Walking'});
 assert.ok(gait.weight<.001);assert.ok(gait.speed<.001);
});

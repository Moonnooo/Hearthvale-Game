import test from 'node:test';import assert from 'node:assert/strict';import {goblinPose,GOBLIN_DEATH_MS} from '../../shared/goblin-pose.mjs';
test('goblin death kneels before falling, remains visible, then fades away',()=>{
 const kneel=goblinPose({deathAge:800}),fall=goblinPose({deathAge:1900});
 assert.ok(kneel.hipsDrop>.3);assert.ok(kneel.knees[0]>1.5);assert.equal(kneel.rootTilt,0);
 assert.equal(fall.rootTilt,Math.PI/2);assert.equal(fall.opacity,1);assert.equal(fall.visible,true);
 assert.ok(goblinPose({deathAge:2800}).opacity<1);assert.equal(goblinPose({deathAge:GOBLIN_DEATH_MS}).visible,false);
});
test('goblin movement and attacks articulate limbs without nonfinite poses',()=>{
 const walk=goblinPose({phase:1,weight:1});assert.equal(walk.legs[0],-walk.legs[1]);assert.ok(walk.arms[0][0]>0);assert.ok(walk.arms[1][0]<0);
 for(let t=0;t<=3500;t+=10)for(const p of [goblinPose({swingAge:t}),goblinPose({deathAge:t})])for(const key of ['chest','head','legs','knees','feet','elbows'])assert.ok(p[key].every(Number.isFinite));
 assert.notDeepEqual(goblinPose({swingAge:200}).arms,goblinPose({swingAge:2000}).arms);
});

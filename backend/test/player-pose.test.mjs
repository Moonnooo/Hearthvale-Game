import test from 'node:test';
import assert from 'node:assert/strict';
import {armTargets,playerPose,stroke} from '../../shared/player-pose.mjs';
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
test('arm solver preserves bone lengths and reaches reachable targets without stretching',()=>{
 const start=[.166,.864,0],elbow=[.275,.672,0],wrist=[.352,.518,.006];
 for(const target of [[.20,.75,.25],[0,0,4],start,[.4,.5,0]]){
  const solved=armTargets(start,elbow,wrist,target,'L');
  assert.ok(Math.abs(distance(start,solved.elbow)-distance(start,elbow))<1e-7);
  assert.ok(Math.abs(distance(solved.elbow,solved.wrist)-distance(elbow,wrist))<1e-7);
  if(target[0]===.20)assert.ok(distance(solved.wrist,target)<1e-7);
  assert.ok([...solved.elbow,...solved.wrist].every(Number.isFinite));
 }
});
test('mining, chopping and combat poses remain finite through their complete strokes',()=>{
 for(const kind of ['tree','ore','fishing',undefined])for(const attackType of ['stab','slash','crush'])for(let t=0;t<=2000;t+=10){
  const p=playerPose({kind,action:'Fighting',weapon:'copperSword',attackType,time:t,age:t,phase:t*.01,weight:0});
  for(const k of ['left','right','axis','edge','chest','hips','legs','knees','head'])assert.ok(p[k].every(Number.isFinite));
  assert.ok(Math.hypot(...p.axis)>.4);
 }
 assert.ok(Math.abs(stroke(1-.000001)-stroke(0))<.0001);
 assert.ok(Math.abs(stroke(.48-.000001)-stroke(.48+.000001))<.0001);
});
test('stab differs from slash and a free mining hand supports the handle',()=>{
 const stab=playerPose({action:'Fighting',weapon:'copperSword',attackType:'stab',age:100});
 const slash=playerPose({action:'Fighting',weapon:'copperSword',attackType:'slash',age:100});
 assert.notDeepEqual(stab.left,slash.left);
 const mine=playerPose({kind:'ore',time:500}),shield=playerPose({kind:'ore',hasShield:true,time:500});
 assert.ok(distance(mine.left,mine.right)<.15);assert.ok(distance(shield.left,shield.right)>.2);
 const walk=playerPose({action:'Walking',weight:1,phase:Math.PI/2});assert.equal(walk.legs[0],-walk.legs[1]);
});
test('an axe keeps the same blade facing when held, walking and chopping',()=>{
 const idle=playerPose({weapon:'bronzeAxe'}),walk=playerPose({weapon:'bronzeAxe',action:'Walking',phase:1,weight:1}),chop=playerPose({weapon:'bronzeAxe',kind:'tree',time:600});
 assert.deepEqual(idle.edge,chop.edge);assert.deepEqual(walk.edge,chop.edge);
});

test('empty hands relax, equipped hands grip, and idle breathing varies gently',()=>{const empty=playerPose({time:0}),held=playerPose({weapon:'bronzeAxe',time:0}),bucket=playerPose({hasItem:true}),shield=playerPose({hasShield:true});assert.equal(empty.leftGrip,false);assert.equal(empty.rightGrip,false);assert.ok(empty.left[1]<held.left[1]);assert.deepEqual(held.right,empty.right);assert.equal(bucket.leftGrip,true);assert.equal(shield.rightGrip,true);const later=playerPose({time:1000});assert.notDeepEqual(later.chest,empty.chest);assert.ok(Math.abs(later.hips[1])<.01);assert.ok(Math.abs(later.hips[2])<.02);});

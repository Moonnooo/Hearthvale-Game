import test from 'node:test';
import assert from 'node:assert/strict';
import { PlaybackClock } from '../../shared/playback.mjs';
import { motionPosition } from '../server/motion.mjs';
test('uneven packet arrival cannot reset or reverse animation time',()=>{
  const clock=new PlaybackClock();clock.receive(10000,0);let previous=clock.advance(0);
  const arrivals=new Map([[137,10100],[190,10200],[360,10300],[410,10400],[510,10500],[720,10600],[725,10700]]);
  for(let t=1;t<900;t++){if(arrivals.has(t))clock.receive(arrivals.get(t),t);const current=clock.advance(t);assert.ok(current>previous);assert.ok(current-previous>=.94-1e-8&&current-previous<=1.06+1e-8);previous=current;}
});
test('approved queued segments stay continuous across packet gaps and stop at the destination',()=>{
  const player={x:15,y:15,motion:{fromX:15,fromY:15,toX:16,toY:15,startedAt:1000,duration:300},route:[[17,15],[18,16]]};
  assert.deepEqual(motionPosition(player,1450),{x:16.5,y:15});
  let previous=motionPosition(player,1000);for(let t=1010;t<2000;t+=10){const current=motionPosition(player,t);assert.ok(Math.hypot(current.x-previous.x,current.y-previous.y)<=10/300+1e-8);previous=current;}
  assert.deepEqual(motionPosition(player,9999),{x:18,y:16});
});

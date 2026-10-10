import test from 'node:test';import assert from 'node:assert/strict';import {miningGroundHeight} from '../../shared/mining-models.mjs';
test('mining rocks embed slightly on flat ground and follow the low side of slopes with a depth cap',()=>{assert.equal(miningGroundHeight(()=>2,0,0),1.945);assert.ok(Math.abs(miningGroundHeight(x=>2+x*.2,0,0)-1.869)<1e-9);assert.equal(miningGroundHeight(x=>2+x*10,0,0),1.745);});

test('authored burial depth preserves slope grounding and caps excessive embedding',()=>{assert.ok(Math.abs(miningGroundHeight(()=>2,0,0,.14)-1.86)<1e-9);assert.equal(miningGroundHeight(()=>2,0,0,100),1.75);assert.equal(miningGroundHeight(()=>2,0,0,NaN),1.945);});

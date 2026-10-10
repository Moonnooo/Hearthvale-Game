export const RUN_SPEED=1.6;export const ENERGY_RATES={run:-4,walk:.5,idle:1.5};
export function advanceEnergy(p,now,mode){if(p.energyAt===undefined){p.energyAt=now;return;}const elapsed=Math.max(0,now-p.energyAt)/1000;p.energyAt=Math.max(p.energyAt,now);p.energy=Math.max(0,Math.min(100,p.energy+elapsed*ENERGY_RATES[mode]));if(p.energy<=0)p.runEnabled=false;}

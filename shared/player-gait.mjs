// Advance body animation from a stable clock, rather than individual position updates.
export function advancePlayerGait(state,{distance=0,dt=16,motion,action='Idle'}={}){
 const seconds=Math.max(0,Math.min(100,dt))/1000;
 state??={phase:0,weight:0,speed:0,quiet:1000,lastSpeed:0};
 const displaced=distance>1e-5&&distance<=Math.max(1,seconds*12),travelling=['Walking','Running'].includes(action);
 state.quiet=displaced?0:state.quiet+seconds*1000;
 const nominal=motion?.duration>0?Math.hypot(motion.toX-motion.fromX,motion.toY-motion.fromY)*1000/motion.duration:0;
 if(displaced)state.lastSpeed=nominal||Math.min(8,distance/Math.max(seconds,.001));
 const moving=displaced||(travelling&&state.quiet<180);
 const target=moving?(nominal||state.lastSpeed):0,blend=1-Math.exp(-seconds/.085);
 state.speed+=(target-state.speed)*blend;
 state.weight+=((moving?1:0)-state.weight)*(1-Math.exp(-seconds/.11));
 state.phase=(state.phase+state.speed*seconds*3.6)%(Math.PI*2);
 return {...state,moving};
}

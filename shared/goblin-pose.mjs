const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>{v=clamp(v);return v*v*(3-2*v);};
export const GOBLIN_DEATH_MS=3200;
export function goblinPose({phase=0,weight=0,swingAge=10000,deathAge=null}){
 const stride=Math.sin(phase)*weight,pose={visible:true,opacity:1,rootTilt:0,rootLift:0,hipsDrop:0,chest:[.05,-stride*.08,0],head:[0,0,0],arms:[[stride*.25,0,-.65],[-stride*.25,0,.65]],elbows:[.12,.12],legs:[stride*.45,-stride*.45],knees:[Math.max(0,-stride)*.55,Math.max(0,stride)*.55],feet:[0,0]};
 if(deathAge!==null){
  const kneel=ease(deathAge/800),fall=ease((deathAge-950)/850),relax=ease((deathAge-1350)/650);
  pose.rootTilt=fall*Math.PI/2;pose.rootLift=fall*.20;pose.hipsDrop=kneel*.31*(1-fall);pose.chest=[kneel*.20*(1-fall),0,0];pose.head=[kneel*.22*(1-fall),0,0];
  pose.legs=[-1.10*kneel*(1-relax),-1.10*kneel*(1-relax)];pose.knees=[2.67*kneel*(1-relax),2.67*kneel*(1-relax)];pose.feet=[1.57*kneel*(1-relax),1.57*kneel*(1-relax)];
  pose.arms=[[-.35*kneel-fall*.8,0,-.65+fall*.25],[-.35*kneel-fall*.8,0,.65-fall*.25]];pose.elbows=[.2*(1-fall),.2*(1-fall)];pose.opacity=1-clamp((deathAge-2500)/700);pose.visible=deathAge<GOBLIN_DEATH_MS;return pose;
 }
 if(swingAge>=0&&swingAge<850){const t=swingAge/850,wind=ease(t/.28),strike=ease((t-.28)/.24),recover=ease((t-.52)/.48),s=wind*(1-recover);pose.arms[0]=[-1.25*s,.55*s-strike*.8*(1-recover),-.65+s*.3];pose.elbows[0]=.12+s*.55;pose.arms[1]=[-.45*s,0,.55];pose.chest=[.05+strike*.14*(1-recover),-.20*s+.32*strike*(1-recover),0];pose.head=[-.04*s,-pose.chest[1]*.4,0];}
 return pose;
}

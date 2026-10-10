const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t);
const ease=t=>t*t*(3-2*t);
export function armTargets(start,elbow,wrist,target,side){
 const sub=(a,b)=>a.map((v,i)=>v-b[i]),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),length=a=>Math.hypot(...a),scaled=(a,n)=>a.map(v=>v*n),add=(a,b)=>a.map((v,i)=>v+b[i]);
 const l1=length(sub(elbow,start)),l2=length(sub(wrist,elbow)),delta=sub(target,start),distance=length(delta),direction=distance>1e-8?scaled(delta,1/distance):[0,-1,0],d=Math.max(Math.abs(l1-l2)+.005,Math.min(l1+l2-.008,distance));
 let pole=[side==='L'?1:-1,-.25,-.35];pole=sub(pole,scaled(direction,dot(pole,direction)));if(length(pole)<1e-6){pole=[0,0,1];pole=sub(pole,scaled(direction,dot(pole,direction)));}pole=scaled(pole,1/length(pole));
 const along=(l1*l1-l2*l2+d*d)/(2*d),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
 return {elbow:add(add(start,scaled(direction,along)),scaled(pole,bend)),wrist:add(start,scaled(direction,d))};
}
// A slow wind-up, a decisive contact stroke, then a relaxed return.
export function stroke(t){t=((t%1)+1)%1;return t<.48?ease(t/.48):t<.7?1-ease((t-.48)/.22):0;}
export function playerPose({action='Idle',kind,weapon,hasItem=Boolean(weapon),hasShield=false,attackType,option,age=10000,buryAge=10000,time=0,phase=0,weight=0}){
 const stride=Math.sin(phase)*weight,run=action==='Running';
 const pose={left:hasItem?[.24,.59,.12]:[.27,.43,.025],right:hasShield?[-.24,.66,.16]:[-.27,.43,.025],axis:[0,.72,.69],edge:[1,0,0],chest:[0,0,0],hips:[0,0,0],legs:[stride*.48,-stride*.48],knees:[Math.max(0,-stride)*.6,Math.max(0,stride)*.6],feet:[0,0],head:[0,0,0],shield:hasShield,leftGrip:hasItem,rightGrip:hasShield,mode:'idle'};
 const idle=Math.max(0,1-weight),breath=Math.sin(time*.0018),sway=Math.sin(time*.0011);pose.hips[1]=breath*.004*idle;pose.hips[2]=sway*.012*idle;pose.chest=[breath*.009*idle,sway*.012*idle,-sway*.012*idle];pose.head=[-breath*.004*idle,-sway*.007*idle,0];pose.left[1]+=breath*.003*idle;pose.right[1]+=breath*.003*idle;
 if(weight>.01){pose.mode=run?'running':'walking';pose.right[2]-=stride*.12;pose.left[2]+=stride*.08;pose.hips[1]=Math.cos(phase*2)*weight*(run?.018:.009);pose.chest=[run?.09:.025,-stride*.06,-stride*.025];pose.knees=pose.knees.map(v=>v*(run?1.25:1));}
 if(kind==='tree'&&weight<.1){
  const s=stroke(time/1250);pose.mode='chopping';pose.left=mix([.12,.66,.32],[.40,.88,-.10],s);pose.right=mix([-.16,.66,.15],[-.12,.72,.21],s);pose.axis=mix([-.34,.50,.80],[.35,.82,-.45],s);pose.edge=[-.85,-.2,.65];pose.chest=[.07,.12-s*.38,-.02];pose.head=[-.03,-pose.chest[1]*.55,0];pose.knees=[.13,.08];
 }else if(kind&&kind!=='fishing'&&weight<.1){
  const s=stroke(time/1450);pose.mode='mining';pose.left=mix([.10,.65,.34],[.12,1.0,.28],s);pose.right=mix([-.19,.60,.18],[-.09,.87,.26],s);pose.axis=mix([0,-.12,.99],[0,.97,.24],s);if(!hasShield){pose.rightGrip=true;pose.right=pose.left.map((v,i)=>v-pose.axis[i]*.12);}pose.chest=[.17-s*.19,-.04,0];pose.head=[.07,0,0];pose.knees=[.14,.14];
 }else if(kind==='fishing'&&weight<.1){pose.mode='fishing';pose.left=[.20,.68,.28];pose.right=[-.15,.64,.23];pose.axis=[0,.5,.86];pose.chest=[.06,Math.sin(time*.001)*.015,0];}
 else if(action==='Fighting'&&weight<.1){
  pose.mode='combat';pose.right=pose.shield?[-.21,.76,.24]:[-.18,.77,.26];pose.left=[.22,.75,.21];pose.knees=[.15,.12];pose.chest=[.04,-.10,0];pose.axis=[.10,.88,.46];
  const t=Math.max(0,Math.min(1,age/760)),hit=t<.26?ease(t/.26):t<.51?1-ease((t-.26)/.25):0;
  if(age>=0&&age<760){
   const thrust=attackType==='stab',unarmed=!weapon;
   if(option==='kick'&&unarmed){pose.legs[0]=-.9*Math.sin(t*Math.PI);pose.knees[0]=.5*(1-hit);pose.chest[0]=-.12*Math.sin(t*Math.PI);}
   else if(thrust||unarmed){pose.left=mix([.12,.76,.35],[.28,.79,.03],hit);pose.axis=[0,.12,.99];pose.chest[1]=-.16+hit*.22;}
   else if(attackType==='crush'){pose.left=mix([.12,.68,.34],[.30,1.01,.04],hit);pose.axis=mix([0,.15,.99],[0,.94,-.34],hit);pose.chest[0]=.14-hit*.17;}
   else{pose.left=mix([-.02,.72,.35],[.39,.91,-.05],hit);pose.axis=mix([-.5,.4,.77],[.45,.83,-.34],hit);pose.edge=[-.85,-.2,.65];pose.chest[1]=.16-hit*.36;}
  }
 }else if(['Smithing','Woodworking'].includes(action)&&weight<.1){const s=stroke(time/1100);pose.mode='crafting';pose.left=mix([.19,.64,.30],[.27,.94,.12],s);pose.axis=mix([0,.1,.99],[0,.95,.3],s);pose.chest[0]=.10;}
 else if(['Cooking','Lighting fire','Picking up','Milking','Collecting water'].includes(action)&&weight<.1){pose.mode='working';pose.left=[.21,.51,.29];pose.right=[-.18,.54,.23];pose.chest[0]=.18;pose.knees=[.22,.22];}
 if(action==='Burying bones'&&weight<.1&&buryAge>=0&&buryAge<1500){
  const t=buryAge/1500,bend=t<.3?ease(t/.3):t<.68?1:1-ease((t-.68)/.32),dig=t>.3&&t<.68?Math.sin((t-.3)/.38*Math.PI*4)*.035:0;
  pose.mode='burying';pose.chest=[bend*.85,0,0];pose.head=[-bend*.18,0,0];pose.hips[1]=-bend*.045;pose.legs=[-bend*.12,-bend*.12];pose.knees=[bend*.3,bend*.3];
  pose.right=mix(pose.right,[-.13,.25+dig,.40],bend);pose.left=mix(pose.left,[.20,.36,.26],bend);pose.rightGrip=bend>.5;pose.axis=mix(pose.axis,[0,.9,.3],bend);
 }
 if(/Axe$/.test(weapon||''))pose.edge=[-.85,-.2,.65];
 return pose;
}

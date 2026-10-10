export const bridgeRotation=b=>b.rotation||0;
export function bridgeWorldOffset(b,x,y){switch(bridgeRotation(b)){case 90:return [-y,x];case 180:return [-x,-y];case 270:return [y,-x];default:return [x,y];}}
export function bridgeLocalOffset(b,x,y){return bridgeWorldOffset({rotation:(360-bridgeRotation(b))%360},x-b.x,y-b.y);}
export function bridgeCrossing(b,x,y){return bridgeLocalOffset(b,x,y)[1]===0;}

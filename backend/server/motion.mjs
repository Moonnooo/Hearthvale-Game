export const WALK_MS=300;
export function motionPosition(player,now){
  const m=player.motion;if(!m)return {x:player.x,y:player.y};
  const t=Math.max(0,Math.min(1,(now-m.startedAt)/m.duration));
  if(t<1||!player.route?.length)return {x:m.fromX+(m.toX-m.fromX)*t,y:m.fromY+(m.toY-m.fromY)*t};
  let x=m.toX,y=m.toY,at=m.startedAt+m.duration;
  for(const [nx,ny] of player.route){const stepMs=m.duration/Math.hypot(m.toX-m.fromX,m.toY-m.fromY);const duration=stepMs*Math.hypot(nx-x,ny-y);if(now<at+duration){const fraction=Math.max(0,(now-at)/duration);return {x:x+(nx-x)*fraction,y:y+(ny-y)*fraction};}at+=duration;x=nx;y=ny;}
  return {x,y};
}

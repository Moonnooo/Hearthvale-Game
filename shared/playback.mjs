// Network packets update the clock estimate, never reset the animation timeline.
export class PlaybackClock {
  constructor(delay=180){this.delay=delay;this.offset=null;this.time=null;this.last=null;}
  receive(serverAt,receivedAt){const estimate=serverAt-receivedAt;if(this.offset===null){this.offset=estimate;this.time=serverAt-this.delay;this.last=receivedAt;}else if(estimate>this.offset)this.offset+=(estimate-this.offset)*.1;}
  advance(now){if(this.time===null)return 0;const dt=Math.max(0,now-this.last);this.last=now;const target=now+this.offset-this.delay,error=target-this.time;const rate=Math.max(.94,Math.min(1.06,1+error/2000));this.time+=dt*rate;return this.time;}
}

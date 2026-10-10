// Blend neighbouring painted cells; global coordinates keep region borders seamless.
export function gravelCoverage(x,y,terrain){
 const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
 const own=terrain(Math.round(x),Math.round(y));
 const sample=(a,b)=>{const t=terrain(a,b);return t==='path'||own==='path'&&t!=='grass'?1:0;};
 const a=sample(ix,iy),b=sample(ix+1,iy),c=sample(ix,iy+1),d=sample(ix+1,iy+1);
 const field=(a*(1-fx)+b*fx)*(1-fy)+(c*(1-fx)+d*fx)*fy;
 const edge=Math.max(0,1-Math.abs(field-.5)*2);
 const rough=edge*(.11*Math.sin(x*8.3+y*3.7)*Math.cos(y*7.1-x*2.9)+.065*Math.sin(x*29-y*23)+.035*Math.sin(x*71+y*67));
 const t=Math.max(0,Math.min(1,(field+rough-.40)/.24));return t*t*(3-2*t);
}

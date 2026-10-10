// Area labels follow geometry, independently of old manually positioned name markers.
export function areaLabelPosition(area){
 const p=area.polygon;if(!p?.length)return {x:area.x,y:area.y};
 let twice=0,x=0,y=0;for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length],cross=a[0]*b[1]-b[0]*a[1];twice+=cross;x+=(a[0]+b[0])*cross;y+=(a[1]+b[1])*cross;}
 const centre=Math.abs(twice)>1e-8?{x:x/(3*twice),y:y/(3*twice)}:{x:p.reduce((n,q)=>n+q[0],0)/p.length,y:p.reduce((n,q)=>n+q[1],0)/p.length};
 const inside=(x,y)=>{let hit=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;};
 if(inside(centre.x,centre.y))return centre;
 // A concave shape's centroid can sit outside it. Find a central interior span.
 const ys=[...new Set(p.map(q=>q[1]))].sort((a,b)=>a-b),rows=[centre.y,...ys.slice(1).map((v,i)=>(v+ys[i])/2)];let best=null,score=Infinity;
 for(const cy of rows){const xs=[];for(let i=0;i<p.length;i++){const a=p[i],b=p[(i+1)%p.length];if((a[1]>cy)!==(b[1]>cy))xs.push(a[0]+(cy-a[1])*(b[0]-a[0])/(b[1]-a[1]));}xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2){const cx=(xs[i]+xs[i+1])/2,d=(cx-centre.x)**2+(cy-centre.y)**2;if(d<score){score=d;best={x:cx,y:cy};}}}
 return best||centre;
}

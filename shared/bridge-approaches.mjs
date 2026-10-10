import {bridgeRotation,bridgeWorldOffset,bridgeLocalOffset} from './bridge-layout.mjs';
// Small bank extensions overlap the deck ends without stretching the bridge.
export function bridgeApproachHeight(bridge,x,y,height){
 const actualHeight=height;const local=bridgeLocalOffset(bridge,x,y);x=bridge.x+local[0];y=bridge.y+local[1];height=(a,b)=>{const [dx,dy]=bridgeWorldOffset(bridge,a-bridge.x,b-bridge.y);return actualHeight(bridge.x+dx,bridge.y+dy);};
 const distance=Math.abs(x-bridge.x);if(distance<1.05-1e-8||distance>1.8+1e-8||Math.abs(y-bridge.y)>.55)return;
 const sign=x<bridge.x?-1:1,t=(distance-1.05)/.75,s=t*t*(3-2*t),inner=height(bridge.x,bridge.y)+.015,outer=height(bridge.x+sign*1.8,y);
 return inner+(outer-inner)*s;
}
export function createBridgeApproaches(THREE,bridge,height,land,material){
 const actualHeight=height,actualLand=land;const world=(a,b)=>{const [dx,dy]=bridgeWorldOffset(bridge,a-bridge.x,b-bridge.y);return [bridge.x+dx,bridge.y+dy];};height=(a,b)=>actualHeight(...world(a,b));land=(a,b)=>actualLand(...world(a,b));
 const group=new THREE.Group(),base=height(bridge.x,bridge.y);
 for(const sign of [-1,1]){if(!land(bridge.x+sign*2,bridge.y))continue;const positions=[],uv=[],sides=[];
  for(let i=0;i<8;i++){const a=1.05+i*.75/8,b=1.05+(i+1)*.75/8,aw=.55+(a-1.05)*.2,bw=.55+(b-1.05)*.2;
   for(const side of [-1,1]){const ax=sign*a,bx=sign*b,az=side*aw,bz=side*bw,ah=base+.015+(height(bridge.x+sign*1.8,bridge.y+az)-base-.015)*(i/8)**2*(3-2*i/8),bh=base+.015+(height(bridge.x+sign*1.8,bridge.y+bz)-base-.015)*((i+1)/8)**2*(3-2*(i+1)/8);for(const v of [[ax,ah-base,az],[ax,-.2,az],[bx,bh-base,bz],[bx,bh-base,bz],[ax,-.2,az],[bx,-.2,bz]])sides.push(...v);}
   for(const [distance,z] of [[a,-aw],[b,-bw],[a,aw],[a,aw],[b,-bw],[b,bw]]){const x=sign*distance,wx=bridge.x+x,wy=bridge.y+z,t=(distance-1.05)/.75,s=t*t*(3-2*t),h=base+.015+(height(bridge.x+sign*1.8,wy)-base-.015)*s;positions.push(x,h-base,z);uv.push(wx/8,-wy/8);}
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,material);mesh.receiveShadow=true;group.add(mesh);const skirtGeometry=new THREE.BufferGeometry();skirtGeometry.setAttribute('position',new THREE.Float32BufferAttribute(sides,3));skirtGeometry.computeVertexNormals();group.add(new THREE.Mesh(skirtGeometry,new THREE.MeshStandardMaterial({color:0x726148,roughness:1,side:THREE.DoubleSide})));
 }
 group.rotation.y=-bridgeRotation(bridge)*Math.PI/180;return group;
}

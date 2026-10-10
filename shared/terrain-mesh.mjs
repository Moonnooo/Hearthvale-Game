// Small terrain chunks let Three.js cull land outside the camera view.
export function terrainGeometries(THREE,cells,height,uvAt=(x,z)=>[x,z],chunkSize=16,detail=4){
 const chunks=new Map(),samples=new Map();
 const sample=(x,z)=>{const key=x+','+z;if(!samples.has(key))samples.set(key,height(x,z));return samples.get(key);};
 for(const [x,z] of cells){
  const key=Math.floor(x/chunkSize)+','+Math.floor(z/chunkSize);
  if(!chunks.has(key))chunks.set(key,{positions:[],uv:[],indices:[],vertices:new Map()});
  const chunk=chunks.get(key),base=sample(x,z);let flat=true;
  for(let j=0;j<=detail&&flat;j++)for(let i=0;i<=detail;i++)if(Math.abs(sample(x-.5+i/detail,z-.5+j/detail)-base)>1e-6){flat=false;break;}
  const steps=flat?1:detail;
  const vertex=(vx,vz)=>{const k=vx+','+vz;if(chunk.vertices.has(k))return chunk.vertices.get(k);const index=chunk.positions.length/3;chunk.vertices.set(k,index);chunk.positions.push(vx,sample(vx,vz),vz);chunk.uv.push(...uvAt(vx,vz));return index;};
  for(let j=0;j<steps;j++)for(let i=0;i<steps;i++){
   const left=x-.5+i/steps,right=x-.5+(i+1)/steps,top=z-.5+j/steps,bottom=z-.5+(j+1)/steps;
   const a=vertex(left,top),b=vertex(left,bottom),c=vertex(right,top),d=vertex(right,bottom);chunk.indices.push(a,b,c,c,b,d);
  }
 }
 return [...chunks.values()].map(chunk=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(chunk.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(chunk.uv,2));geometry.setIndex(chunk.indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;});
}
// Opaque sides only where real land meets water; never seal an unbuilt region edge.
export function shorelineGeometries(THREE,cells,terrain,ground,water,chunkSize=16){
 const chunks=new Map();
 for(const [x,z] of cells){if(terrain(x,z)==='water')continue;
 for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){if(terrain(x+dx,z+dz)!=='water')continue;
 const key=Math.floor(x/chunkSize)+','+Math.floor(z/chunkSize);if(!chunks.has(key))chunks.set(key,{positions:[],uv:[]});const chunk=chunks.get(key),cx=x+dx*.5,cz=z+dz*.5,steps=['grass','path'].includes(terrain(x,z))?4:1;
 for(let i=0;i<steps;i++){const a=i/steps-.5,b=(i+1)/steps-.5,ax=cx-dz*a,az=cz+dx*a,bx=cx-dz*b,bz=cz+dx*b,ah=ground(ax,az),bh=ground(bx,bz),bottom=Math.min(ah,bh,water(x+dx,z+dz)-.075)-.2;
 for(const [vx,vy,vz,u] of [[ax,ah,az,a],[ax,bottom,az,a],[bx,bh,bz,b],[bx,bh,bz,b],[ax,bottom,az,a],[bx,bottom,bz,b]]){chunk.positions.push(vx,vy,vz);chunk.uv.push((dx?z:x)+u,vy);}
 }}
 }
 return [...chunks.values()].map(chunk=>{const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(chunk.positions,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(chunk.uv,2));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;});
}

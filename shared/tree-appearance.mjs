export function treeRotation(tree){
 if(Number.isFinite(tree.rotation))return tree.rotation*Math.PI/180;
 let hash=2166136261;for(const c of tree.id||'tree'){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}return (hash>>>0)/4294967296*Math.PI*2;
}
export function woodlandSampler(trees){
 const bins=new Map();for(const t of trees){const k=Math.floor(t.x/4)+','+Math.floor(t.y/4);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(t);}
 return (x,y)=>{let sum=0;const bx=Math.floor(x/4),by=Math.floor(y/4);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)for(const t of bins.get((bx+dx)+','+(by+dy))||[]){const d=Math.hypot(x-t.x,y-t.y);if(d<3.2)sum+=Math.pow(1-d/3.2,1.3)*.85;}return Math.min(1,sum);};
}

// Fit only the roots to the slope, leaving the trunk and canopy upright.
// Each placed tree gets its own geometry; the shared model stays unchanged.
export function fitTreeRoots(THREE,model,tree,height){
 model.updateMatrixWorld(true);const rootInverse=model.matrixWorld.clone().invert(),angle=treeRotation(tree),cos=Math.cos(angle),sin=Math.sin(angle),anchor=height(tree.x,tree.y);
 model.traverse(mesh=>{if(!mesh.isMesh)return;const geometry=mesh.geometry.clone(),positions=geometry.getAttribute('position'),toRoot=rootInverse.clone().multiply(mesh.matrixWorld),toMesh=toRoot.clone().invert(),point=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(toRoot);const weight=Math.max(0,Math.min(1,(.55-point.y)/.48));if(!weight)continue;const x=tree.x+point.x*cos+point.z*sin,y=tree.y-point.x*sin+point.z*cos;point.y+=(height(x,y)-anchor-.035)*weight;point.applyMatrix4(toMesh);positions.setXYZ(i,point.x,point.y,point.z);}
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 });return model;
}

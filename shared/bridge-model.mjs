export function normalizeBridge(THREE,model){
 // The source model runs along Z; crossings in this world run along X.
 model.rotation.y+=Math.PI/2;model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),centre=bounds.getCenter(new THREE.Vector3()),root=new THREE.Group();
 root.scale.set(3/size.x,3/Math.max(size.x,size.z),3/size.z);
 model.position.x-=centre.x;model.position.z-=centre.z;root.add(model);root.updateMatrixWorld(true);
 const ray=new THREE.Raycaster(),sample=x=>{ray.set(new THREE.Vector3(x,4,0),new THREE.Vector3(0,-1,0));return ray.intersectObject(root,true)[0]?.point.y;};
 const deckBase=Math.min(sample(-1.3)??0,sample(1.3)??0);root.position.y=-deckBase+.025;root.updateMatrixWorld(true);
 const profile=Array.from({length:27},(_,i)=>sample(-1.3+i*.1)??.025);
 // Remove the long rise from the complete model, keeping rails and supports
 // attached to their planks. A smoothed profile preserves the worn timber detail.
 const smooth=profile.map((_,i)=>{let sum=0,count=0;for(let j=Math.max(0,i-2);j<=Math.min(profile.length-1,i+2);j++){sum+=profile[j];count++;}return sum/count;});
 const at=x=>{const p=Math.max(0,Math.min(26,(x+1.3)/.1)),i=Math.floor(p),f=p-i;return smooth[i]*(1-f)+smooth[Math.min(26,i+1)]*f;};
 model.traverse(mesh=>{if(!mesh.isMesh)return;const geometry=mesh.geometry.clone(),positions=geometry.attributes.position,inverse=mesh.matrixWorld.clone().invert(),point=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){point.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld);point.y-=at(point.x)-.025;point.applyMatrix4(inverse);positions.setXYZ(i,point.x,point.y,point.z);}
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();mesh.geometry=geometry;
 });
 root.userData.deckProfile=profile.map(()=>.025);
 return root;
}
export function bridgeDeckHeight(profile,x){
 if(!profile)return 0;const position=Math.max(0,Math.min(profile.length-1,(x+1.3)/.1)),i=Math.floor(position),f=position-i;
 // Blend the short entrance section into the adjoining path.
 const value=profile[i]*(1-f)+(profile[Math.min(i+1,profile.length-1)]??profile[i])*f;
 return value*Math.max(0,Math.min(1,(1.5-Math.abs(x))/.2));
}

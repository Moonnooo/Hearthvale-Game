export function normalizeMiningModel(THREE,model,kind){
 model.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(model),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
 const width=kind==='rock'?.95:.57,height=kind==='rock'?.68:.36,scale=Math.min(width/Math.max(size.x,size.z),height/size.y);
 const root=new THREE.Group();model.scale.multiplyScalar(scale);model.position.set(-center.x*scale,-bounds.min.y*scale,-center.z*scale);root.add(model);root.updateMatrixWorld(true);return root;
}
export function createMiningResource(THREE,rockTemplate,oreTemplate,color){
 const rock=rockTemplate.clone(true),ore=oreTemplate.clone(true);rock.position.y=.005;rock.updateMatrixWorld(true);ore.updateMatrixWorld(true);
 const rockBounds=new THREE.Box3().setFromObject(rock),oreBounds=new THREE.Box3().setFromObject(ore),height=oreBounds.max.y-oreBounds.min.y;
 const ray=new THREE.Raycaster(new THREE.Vector3(0,rockBounds.max.y+1,0),new THREE.Vector3(0,-1,0));const hit=ray.intersectObject(rock,true)[0];
 ore.position.y=(hit?.point.y??rockBounds.max.y)-height*.36;
 ore.traverse(o=>{if(o.isMesh){const materials=(Array.isArray(o.material)?o.material:[o.material]).map(source=>{const m=source.clone();m.color.setHex(color);m.metalness=.12;m.roughness=.78;return m;});o.material=Array.isArray(o.material)?materials:materials[0];}});
 return {rock,ore};
}

// Keep the base just below the low side of the ground without tilting the ore.
export function miningGroundHeight(heightAt,x,z,burialDepth=.055){
 const center=heightAt(x,z),samples=[center];
 for(let i=0;i<8;i++){const angle=i*Math.PI/4;samples.push(heightAt(x+Math.cos(angle)*.38,z+Math.sin(angle)*.38));}
 return Math.max(center-.20,Math.min(...samples))-Math.max(.025,Math.min(.25,Number.isFinite(burialDepth)?burialDepth:.055));
}

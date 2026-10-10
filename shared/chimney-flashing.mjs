// Smithy roof height in building-local game coordinates; flashing follows moved chimneys.
export function smithyRoofHeight(x,width){const extent=(width-1+.24)*.54,eave=3.01*1.15*2.4/3.45,ridge=4.55*1.15*2.4/3.45;return ridge-(ridge-eave)*Math.min(1,Math.abs(x)/extent)+.028;}
export function fitChimneyFlashing(THREE,model,part,b){
 if(b.model!=='medievalSmithy')return;
 model.updateMatrixWorld(true);const inverseModel=model.matrixWorld.clone().invert(),point=new THREE.Vector3();
 part.traverse(mesh=>{if(!mesh.isMesh||!/^Lead[ _]/.test(mesh.name))return;let original=mesh.userData.flashingVertices;
 if(!original){mesh.geometry=mesh.geometry.clone();original=mesh.userData.flashingVertices=Float32Array.from(mesh.geometry.attributes.position.array);}
 const a=mesh.geometry.attributes.position,inverseMesh=mesh.matrixWorld.clone().invert(),heights=[];
 for(let i=0;i<a.count;i++){point.fromArray(original,i*3).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseModel);heights.push(point.y);}
 const low=Math.min(...heights),high=Math.max(...heights),collar=mesh.name.includes('collar');
 for(let i=0;i<a.count;i++){point.fromArray(original,i*3).applyMatrix4(mesh.matrixWorld).applyMatrix4(inverseModel);const f=(point.y-low)/Math.max(1e-6,high-low);point.y=smithyRoofHeight((b.rotation? (Math.cos(b.rotation*Math.PI/180)*point.x*(b.width-1+.24)+Math.sin(b.rotation*Math.PI/180)*point.z*(b.height-1+.24))/(((b.rotation||0)%180?b.height:b.width)-1+.24):point.x),(b.rotation||0)%180?b.height:b.width)+.006+f*(collar?.20:.018);point.applyMatrix4(model.matrixWorld).applyMatrix4(inverseMesh);a.setXYZ(i,point.x,point.y,point.z);}
 a.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();
 });
}

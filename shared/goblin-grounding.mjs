// Test the posed skin, rather than the standing model's bounds: bent knees and
// the face become the contact points as the goblin collapses.
export function groundGoblin(model,groundY=.012){
 model.updateWorldMatrix(true,true);model.updateMatrixWorld(true);
 const point=model.position.clone();let minimum=Infinity;
 model.traverse(mesh=>{
  if(!mesh.isMesh)return;
  mesh.skeleton?.update();
  const count=mesh.geometry.getAttribute('position').count;
  for(let i=0;i<count;i++){
   mesh.getVertexPosition(i,point).applyMatrix4(mesh.matrixWorld);
   minimum=Math.min(minimum,point.y);
  }
 });
 if(!Number.isFinite(minimum))return 0;
 const correction=groundY-minimum;
 model.position.y+=correction;model.updateWorldMatrix(true,true);model.updateMatrixWorld(true);
 return correction;
}

import {waterfallEdges} from '../backend/server/elevation.mjs';
export function waterProfile(x,y,terrain){
 const ix=Math.round(x),iy=Math.round(y);let horizontal=1,vertical=1;
 for(const sign of [-1,1])for(let d=1;d<=8;d++){if(terrain(ix+sign*d,iy)!=='water')break;horizontal++;}
 for(const sign of [-1,1])for(let d=1;d<=8;d++){if(terrain(ix,iy+sign*d)!=='water')break;vertical++;}
 const wide=Math.min(horizontal,vertical),waves=Math.max(0,Math.min(1,(wide-4)/6));
 return {flow:horizontal>vertical?[1,0]:[0,1],waves};
}
export function createWaterEnvironment(THREE,renderer,scene,terrain,level=()=>0){
 const images=[];for(let face=0;face<6;face++){const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d'),image=ctx.createImageData(512,512);
  for(let y=0;y<512;y++)for(let x=0;x<512;x++){const u=(x+.5)/256-1,v=(y+.5)/256-1,dir=[[1,-v,-u],[-1,-v,u],[u,1,v],[u,-1,-v],[u,-v,1],[-u,-v,-1]][face],len=Math.hypot(...dir),height=dir[1]/len,t=Math.max(0,Math.min(1,height)),cloudField=Math.sin(dir[0]/len*13+dir[2]/len*7)+Math.sin(dir[0]/len*21-dir[2]/len*17)*.45,cloud=height>.05&&height<.75?Math.max(0,Math.min(.65,(cloudField-.3)*.7))*Math.sin((height-.05)/.7*Math.PI):0,offset=(y*512+x)*4;
   const horizon=[205,223,222],zenith=[91,151,204],ground=[100,129,109];for(let channel=0;channel<3;channel++){const colour=height<0?horizon[channel]+(ground[channel]-horizon[channel])*Math.min(1,-height*3):horizon[channel]+(zenith[channel]-horizon[channel])*Math.sqrt(t);image.data[offset+channel]=colour+(244-colour)*cloud;}image.data[offset+3]=255;
  }ctx.putImageData(image,0,0);images.push(c);
 }
 const sky=new THREE.CubeTexture(images);sky.colorSpace=THREE.SRGBColorSpace;sky.needsUpdate=true;scene.background=sky;scene.fog=new THREE.Fog(0xcddfde,38,105);
 const waterCanvas=document.createElement('canvas');waterCanvas.width=waterCanvas.height=4096;const c=waterCanvas.getContext('2d');c.fillStyle='#438b9b';c.fillRect(0,0,4096,4096);
 let seed=4217;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<5500;i++){const x=random()*4096,y=random()*4096,length=12+random()*170,amplitude=2+random()*7;for(const ox of [x,x-4096,x+4096])for(const oy of [y,y-4096,y+4096]){c.strokeStyle=i%3?'rgba(183,229,231,.32)':'rgba(21,87,105,.22)';c.lineWidth=1+random()*3;c.beginPath();c.moveTo(ox,oy);c.bezierCurveTo(ox+length*.3,oy-amplitude,ox+length*.7,oy+amplitude,ox+length,oy);c.stroke();}}
 const texture=new THREE.CanvasTexture(waterCanvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=Math.min(16,renderer.capabilities.getMaxAnisotropy());
 const time={value:0};const material=new THREE.MeshStandardMaterial({color:0xd8eff0,map:texture,envMap:sky,envMapIntensity:.55,metalness:.18,roughness:.24});
 material.onBeforeCompile=shader=>{shader.uniforms.waterTime=time;shader.vertexShader='uniform float waterTime;attribute vec2 waterFlow;attribute float waterWaves;varying vec2 waterPosition;varying vec2 surfaceFlow;varying float surfaceWaves;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 waterPosition=position.xz;surfaceFlow=waterFlow;surfaceWaves=waterWaves;
 transformed.y+=(sin(position.x*1.7+position.z*.7-waterTime*1.1)*.012+sin(position.z*2.8-position.x*.4-waterTime*.8)*.009)*(0.3+waterWaves);`);
 shader.fragmentShader='uniform float waterTime;varying vec2 waterPosition;varying vec2 surfaceFlow;varying float surfaceWaves;\n'+shader.fragmentShader;
 shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`vec2 flowUv=waterPosition/6.0-surfaceFlow*waterTime*(0.018*(1.0-surfaceWaves)+.005);
 vec3 waterA=texture2D(map,flowUv).rgb;vec3 waterB=texture2D(map,waterPosition/4.1+vec2(waterTime*.003,-waterTime*.006)).rgb;
 diffuseColor.rgb*=mix(waterA,waterB,.35);`);
 shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
 normal=normalize(normal+vec3(sin(waterPosition.x*4.1-waterTime*1.5),cos(waterPosition.y*3.8-waterTime*1.2),0.0)*(.075+surfaceWaves*.095));`);
 };material.customProgramCacheKey=()=> 'flowing-water-v1';
 function surface(cells){const positions=[],flows=[],waves=[];for(const [x,z] of cells)for(let row=0;row<4;row++)for(let col=0;col<4;col++){const left=x-.5+col/4,top=z-.5+row/4;for(const [vx,vz] of [[left,top],[left,top+.25],[left+.25,top],[left+.25,top],[left,top+.25],[left+.25,top+.25]]){const p=waterProfile(vx,vz,terrain);positions.push(vx,level(x,z)-.075,vz);flows.push(...p.flow);waves.push(p.waves);}}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('waterFlow',new THREE.Float32BufferAttribute(flows,2));geometry.setAttribute('waterWaves',new THREE.Float32BufferAttribute(waves,1));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(positions.filter((_,i)=>i%3!==1),2));geometry.computeVertexNormals();const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;mesh.dispose=()=>geometry.dispose();const group=new THREE.Group();group.add(mesh);
  const fallPositions=[],fallUvs=[];for(const e of waterfallEdges(cells,terrain,level)){const cx=e.x+e.dx*.5,cz=e.y+e.dy*.5,ax=cx-e.dy*.5,az=cz+e.dx*.5,bx=cx+e.dy*.5,bz=cz-e.dx*.5;for(const [x,h,z,u,v] of [[ax,e.high-.075,az,0,1],[bx,e.high-.075,bz,1,1],[ax,e.low-.075,az,0,0],[ax,e.low-.075,az,0,0],[bx,e.high-.075,bz,1,1],[bx,e.low-.075,bz,1,0]]){fallPositions.push(x,h,z);fallUvs.push(u,v);}}
  if(fallPositions.length){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(fallPositions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(fallUvs,2));geo.computeVertexNormals();const fallMaterial=new THREE.MeshStandardMaterial({map:texture,color:0xaadbe1,roughness:.5,emissive:0x448d9b,emissiveIntensity:.45,side:THREE.DoubleSide,transparent:true,opacity:.94});fallMaterial.onBeforeCompile=shader=>{shader.uniforms.waterTime=time;shader.fragmentShader='uniform float waterTime;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','vec2 fallingUv=vec2(vMapUv.x*.15,vMapUv.y*.4+waterTime*.35);vec3 fallingColour=texture2D(map,fallingUv).rgb;float streak=pow(.5+.5*sin(vMapUv.x*47.0+sin(vMapUv.y*8.0+waterTime*5.0)*.7),8.0);float foam=pow(1.0-vMapUv.y,9.0)*.6;diffuseColor.rgb=mix(fallingColour,vec3(.85,.97,1.0),streak*.5+foam);');};const fall=new THREE.Mesh(geo,fallMaterial);group.add(fall);group.dispose=()=>{geometry.dispose();geo.dispose();fallMaterial.dispose();};}else group.dispose=()=>geometry.dispose();return group;
 }
 return {surface,update:now=>{time.value=now/1000;},texture};
}

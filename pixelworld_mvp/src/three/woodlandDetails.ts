import * as T from 'three';
import type {WorldDefinition} from '../world/types';
import {riverSamples} from '../player/villageCollision';
/** Small shared meshes enrich the cottage edges without adding hidden obstacles. */
export function woodlandDetails(world:WorldDefinition){
 const group=new T.Group(),dummy=new T.Object3D();
 const patches: {x:number;z:number}[]=[];
 for(const b of world.buildings)for(const side of [-1,1])patches.push({x:b.entrance.outside.x+side*1.65,z:b.entrance.outside.y+.1});
 for(const [i,p] of riverSamples(world).entries())if(i%12===0&&p.z>1&&p.z<world.height-1&&!world.scenery.bridges.some(b=>Math.abs(b.y-p.z)<1.1))patches.push({x:p.x+(i%24?-1:1)*1.9,z:p.z});
 const flowerCount=patches.length*5;
 const petalMaterial=new T.MeshStandardMaterial({color:0xffeed0,roughness:.9});
 const leaves=new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({color:0x849859,roughness:1}),flowerCount*2);
 const petals=new T.InstancedMesh(new T.SphereGeometry(1,8,6),petalMaterial,flowerCount*5);
 const centers=new T.InstancedMesh(new T.SphereGeometry(.032,8,6),new T.MeshStandardMaterial({color:0xd5ad54,roughness:.8}),flowerCount);
 let seed=431;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 let f=0;for(const p of patches)for(let n=0;n<5;n++){
  const x=p.x+(random()-.5)*1.05,z=p.z+(random()-.5)*.70,h=.10+random()*.16;
  for(let l=0;l<2;l++){dummy.position.set(x+(l?-.06:.06),h*.45,z);dummy.scale.set(.09,.035,.15);dummy.rotation.set(0,l*.9,.3);dummy.updateMatrix();leaves.setMatrixAt(f*2+l,dummy.matrix);}
  for(let k=0;k<5;k++){const a=k*Math.PI*2/5;dummy.position.set(x+Math.cos(a)*.044,h,z+Math.sin(a)*.044);dummy.scale.set(.045,.018,.026);dummy.rotation.set(0,-a,0);dummy.updateMatrix();petals.setMatrixAt(f*5+k,dummy.matrix);}
  dummy.position.set(x,h+.007,z);dummy.scale.setScalar(1);dummy.rotation.set(0,0,0);dummy.updateMatrix();centers.setMatrixAt(f,dummy.matrix);f++;
 }
 for(const mesh of [leaves,petals,centers]){mesh.receiveShadow=true;mesh.castShadow=true;mesh.computeBoundingSphere();group.add(mesh);}
 // Soft grounding remains readable even in the software renderer without shadow maps.
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const ctx=canvas.getContext('2d')!,gradient=ctx.createRadialGradient(32,32,2,32,32,32);gradient.addColorStop(0,'rgba(45,52,34,.30)');gradient.addColorStop(.65,'rgba(45,52,34,.12)');gradient.addColorStop(1,'rgba(45,52,34,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
 const shadows=new T.InstancedMesh(new T.PlaneGeometry(1,1),new T.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}),world.buildings.length+world.scenery.trees.length);
 let index=0;for(const b of world.buildings){dummy.position.set(b.bounds.x+(b.bounds.width-1)/2,.037,b.bounds.y+(b.bounds.height-1)/2);dummy.rotation.set(-Math.PI/2,0,0);dummy.scale.set(b.bounds.width+1.3,b.bounds.height+1.3,1);dummy.updateMatrix();shadows.setMatrixAt(index++,dummy.matrix);}
 for(const t of world.scenery.trees){dummy.position.set(t.trunk.x,.038,t.trunk.y);dummy.scale.set(2.6,2.1,1);dummy.updateMatrix();shadows.setMatrixAt(index++,dummy.matrix);}
 shadows.computeBoundingSphere();group.add(shadows);return group;
}

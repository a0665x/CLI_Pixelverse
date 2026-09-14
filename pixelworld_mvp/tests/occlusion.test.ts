import {it,expect,vi} from 'vitest';
import * as T from 'three';
import {house,tree,batchStatic} from '../src/three/models';
import {WORLD_DEFINITION as w} from '../src/world/worldDefinition';
import {viewOccluded} from '../src/three/occlusion';
it('bounds occlusion query work while orbiting the populated village',()=>{
 const raw=new T.Group();w.buildings.forEach((b,i)=>house(raw,b,i));w.scenery.trees.forEach((t,i)=>tree(raw,t.trunk.x,t.trunk.y,i));
 const scene=new T.Group();scene.add(batchStatic(raw));scene.updateMatrixWorld(true);
 let triangles=0;const original=T.Ray.prototype.intersectTriangle;
 const probe=vi.spyOn(T.Ray.prototype,'intersectTriangle').mockImplementation(function(this:T.Ray,...args){triangles++;return original.apply(this,args);});
 const begin=performance.now();
 try {for(let i=0;i<12;i++){const target=new T.Vector3(22,.5,14),eye=new T.Vector3(22+Math.sin(i)*12,8,14+Math.cos(i)*12);viewOccluded(scene,new T.Raycaster(eye,target.clone().sub(eye).normalize(),.05,eye.distanceTo(target)-.2));}}
 finally{probe.mockRestore();}
 console.log(`Occlusion: ${triangles} triangle tests; ${(performance.now()-begin).toFixed(1)} ms for 12 orbit samples`);
 expect(triangles).toBe(0);
});
it('detects canopy-sized occluders but excludes objects beyond the inspector',()=>{
 const scene=new T.Group();const canopy=new T.Mesh(new T.SphereGeometry(2),new T.MeshBasicMaterial());canopy.position.set(0,2,0);scene.add(canopy);scene.updateMatrixWorld(true);
 expect(viewOccluded(scene,new T.Raycaster(new T.Vector3(0,2,5),new T.Vector3(0,0,-1),.05,8))).toBe(true);
 expect(viewOccluded(scene,new T.Raycaster(new T.Vector3(0,2,5),new T.Vector3(0,0,-1),.05,2))).toBe(false);
 expect(viewOccluded(scene,new T.Raycaster(new T.Vector3(6,2,5),new T.Vector3(0,0,-1),.05,8))).toBe(false);
});

// @ts-ignore Node is available in Vitest.
import {readFileSync} from 'node:fs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {describe,it,expect} from 'vitest';
import {bindHoneyPose,applyHoneyPose,sampleHoneyPose} from '../src/three/honeyMotion';
import {RABBIT_SCALE} from '../src/three/people';
const load=async()=>{
 const bytes=readFileSync(new URL('../public/assets/honey-meshy/honey-rigged.glb',import.meta.url));
 // Node verifies real geometry / skin. Browser review verifies embedded PBR images.
 const loader=new GLTFLoader();loader.register(()=>({name:'headless-textures',loadTexture:()=>Promise.resolve(new T.Texture())}));
 return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
};
describe('Honey skinned Meshy asset',()=>{
 it('loads 25 joints, normalized weights and compact game scale',async()=>{
 const {scene}=await load();let triangles=0,bones=0,skins=0;scene.traverse(o=>{if(o instanceof T.Bone)bones++;if(o instanceof T.SkinnedMesh){skins++;triangles+=(o.geometry.index?.count??0)/3;const w=o.geometry.getAttribute('skinWeight');for(let i=0;i<w.count;i++)expect(w.getX(i)+w.getY(i)+w.getZ(i)+w.getW(i)).toBeCloseTo(1,4);}});
 expect(bones).toBe(25);expect(skins).toBe(1);expect(triangles).toBeLessThanOrEqual(52000);expect(new T.Box3().setFromObject(scene).getSize(new T.Vector3()).y*RABBIT_SCALE).toBeLessThan(.75);
 });
 it('keeps the resting silhouette and produces finite deformed vertices for every gait',async()=>{
 const {scene}=await load();const bindings=bindHoneyPose(scene);let mesh:T.SkinnedMesh|undefined;scene.traverse(o=>{if(o instanceof T.SkinnedMesh)mesh=o;});const original=new T.Box3().setFromObject(scene);
 for(const mode of ['walk','hop','bound'] as const)for(const phase of [0,.25,.5,.75]){applyHoneyPose(bindings,sampleHoneyPose(phase,mode));scene.updateMatrixWorld(true);mesh!.skeleton.update();mesh!.computeBoundingBox();const box=new T.Box3().setFromObject(scene);expect(box.min.toArray().every(Number.isFinite)).toBe(true);expect(box.getSize(new T.Vector3()).length()).toBeLessThan(3);}
 applyHoneyPose(bindings,sampleHoneyPose(0,'walk',0));scene.updateMatrixWorld(true);mesh!.skeleton.update();mesh!.computeBoundingBox();const idle=new T.Box3().setFromObject(scene);expect(idle.getSize(new T.Vector3()).distanceTo(original.getSize(new T.Vector3()))).toBeLessThan(.08);
 });
});

import {rabbitIdentity,RABBIT_COATS} from '../../../public/agent_identity.mjs';
import * as T from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'three/addons/utils/SkeletonUtils.js';
import {applyHoneyPose,bindHoneyPose,sampleHoneyPose,type RabbitGait,type HoneyPose} from './honeyMotion';
const coats=RABBIT_COATS.map(c=>Number.parseInt(c.slice(1),16));
import {RABBIT_SCALE,GAIT_FREQUENCY} from '../player/rabbitGait';
export {RABBIT_SCALE} from '../player/rabbitGait';
export const humanVariant=(id:string,inspector=false)=>{const hash=[...id].reduce((n,c)=>(n*31+c.charCodeAt(0))>>>0,0),index=rabbitIdentity(id).index;return {body:inspector?'honey-inspector':`honey-${index}`,tint:inspector?0xffffff:coats[index]!,phase:hash%100/100};};
let template:T.Group|undefined,loading:Promise<void>|undefined,outlineMaterial:T.MeshBasicMaterial|undefined;
const coatMaterials=new Map<number,T.MeshStandardMaterial>();
export async function loadPeopleAssets(){
 if(template)return;
 loading??=(async()=>{const asset=await new GLTFLoader().loadAsync(new URL('assets/honey-meshy/honey-rigged.glb',document.baseURI).href);asset.scene.traverse(o=>{if(o instanceof T.Mesh){o.castShadow=true;o.receiveShadow=true;}});template=asset.scene;})().catch(error=>{loading=undefined;throw error;});return loading;
}
export function createHuman(id:string,inspector=false):T.Group{
 if(!template)throw new Error('Honey asset has not loaded');
 const root=new T.Group(),visual=cloneSkeleton(template),variant=humanVariant(id,inspector);root.add(visual);
 // Capture bind transforms in asset coordinates before assigning its game scale.
 const bindings=bindHoneyPose(visual);visual.scale.setScalar(RABBIT_SCALE);
 const outlines:T.SkinnedMesh[]=[];const meshes:T.SkinnedMesh[]=[];
 visual.traverse(o=>{if(o instanceof T.SkinnedMesh){meshes.push(o);o.frustumCulled=false;
  if(!inspector&&variant.tint!==0xffffff){let material=coatMaterials.get(variant.tint);if(!material){material=(o.material as T.MeshStandardMaterial).clone();material.color.set(variant.tint);coatMaterials.set(variant.tint,material);}o.material=material;}
 }});
 if(inspector){outlineMaterial??=new T.MeshBasicMaterial({color:0xffe5ab,transparent:true,opacity:.38,depthTest:true,depthWrite:false,depthFunc:T.GreaterDepth,toneMapped:false,stencilWrite:true,stencilRef:1,stencilFunc:T.NotEqualStencilFunc,stencilZPass:T.ReplaceStencilOp});
  for(const mesh of meshes){const outline=new T.SkinnedMesh(mesh.geometry,outlineMaterial);outline.bindMode=mesh.bindMode;outline.bind(mesh.skeleton,mesh.bindMatrix);outline.frustumCulled=false;outline.renderOrder=10000;outline.visible=false;mesh.add(outline);outlines.push(outline);}
 }
 root.userData={rabbit:true,inspector,visual,bindings,outlines,variant:variant.body,hand:bindings.find(b=>b.name==='handR')!.bone,walk:0,work:0,sit:0,cycle:variant.phase,gait:'walk',weights:{walk:1,hop:0,bound:0}};
 root.updateMatrixWorld(true);root.userData.height=new T.Box3().setFromObject(root).getSize(new T.Vector3()).y;return root;
}
function mixPose(a:HoneyPose,b:HoneyPose,t:number){for(const name of Object.keys(a.positions)){a.positions[name]!.lerp(b.positions[name]!,t);a.rotations[name]!.slerp(b.rotations[name]!,t);}return a;}
export function animateHuman(root:T.Group,time:number,walking:boolean,working:boolean,seated=false,dt=.016,gait:RabbitGait='walk'){
 const d=root.userData;if(!d.rabbit||!d.bindings)return;const delta=T.MathUtils.clamp(dt,0,.1),blend=1-Math.exp(-delta*12);
 d.walk=T.MathUtils.lerp(d.walk,walking?1:0,blend);d.work=T.MathUtils.lerp(d.work,working&&!walking?1:0,blend);d.sit=T.MathUtils.lerp(d.sit,seated&&!walking?1:0,blend);d.gait=gait;
 d.cycle=(d.cycle+delta*GAIT_FREQUENCY[gait]*d.walk)%1;
 let pose:HoneyPose|undefined,total=0;
 for(const mode of ['walk','hop','bound'] as const){d.weights[mode]=T.MathUtils.lerp(d.weights[mode],mode===gait?1:0,1-Math.exp(-delta*9));const weight=d.weights[mode];if(weight<.001)continue;const next=sampleHoneyPose(d.cycle,mode,d.walk,time,d.work,d.sit);total+=weight;pose=pose?mixPose(pose,next,weight/total):next;}
 if(pose){applyHoneyPose(d.bindings,pose);d.contacts=pose.contacts;}
}
export function setRabbitOccluded(root:T.Group,occluded:boolean){for(const mesh of root.userData.outlines??[])mesh.visible=occluded;}
export function disposeHuman(root:T.Group){const skeletons=new Set<T.Skeleton>();root.traverse(o=>{if(o instanceof T.SkinnedMesh)skeletons.add(o.skeleton);});skeletons.forEach(s=>s.dispose());root.removeFromParent();}
export function disposePeopleAssets(){
 const geometries=new Set<T.BufferGeometry>(),materials=new Set<T.Material>(),textures=new Set<T.Texture>();template?.traverse(o=>{if(o instanceof T.Mesh){geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});
 for(const m of materials){for(const value of Object.values(m))if(value instanceof T.Texture)textures.add(value);m.dispose();}textures.forEach(t=>t.dispose());geometries.forEach(g=>g.dispose());coatMaterials.forEach(m=>m.dispose());coatMaterials.clear();outlineMaterial?.dispose();outlineMaterial=undefined;template=undefined;loading=undefined;
}

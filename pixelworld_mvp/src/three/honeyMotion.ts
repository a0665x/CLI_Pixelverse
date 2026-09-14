import * as T from 'three';
import rig from '../../public/assets/honey-meshy/honey-rig.json';
import {GAIT_STRIDE,type RabbitGait} from '../player/rabbitGait';
export {GAIT_SPEED,type RabbitGait} from '../player/rabbitGait';
export interface HoneyPose {positions:Record<string,T.Vector3>;rotations:Record<string,T.Quaternion>;contacts:{left:boolean;right:boolean;hands:boolean}}
const rest=Object.fromEntries(Object.entries(rig.joints).map(([name,j])=>[name,new T.Vector3(...j.position as [number,number,number])]));
const X=new T.Vector3(1,0,0),UP=new T.Vector3(0,1,0);
const qx=(angle:number)=>new T.Quaternion().setFromAxisAngle(X,angle);
/** Analytic two-segment limb: never stretches bones to reach an impossible target. */
export function solveLimb(a:T.Vector3,target:T.Vector3,l1:number,l2:number,hint:T.Vector3){
 const axis=target.clone().sub(a),length=T.MathUtils.clamp(axis.length(),Math.abs(l1-l2)+.0001,l1+l2-.0001);if(axis.lengthSq()<1e-12)axis.copy(UP);else axis.normalize();
 const end=a.clone().addScaledVector(axis,length),along=(l1*l1-l2*l2+length*length)/(2*length);
 const bend=hint.clone().sub(a);bend.addScaledVector(axis,-bend.dot(axis));if(bend.lengthSq()<.00001)bend.copy(UP).addScaledVector(axis,-UP.dot(axis));if(bend.lengthSq()<.00001)bend.set(1,0,0).addScaledVector(axis,-axis.x);bend.normalize();
 return {middle:a.clone().addScaledVector(axis,along).addScaledVector(bend,Math.sqrt(Math.max(0,l1*l1-along*along))),end};
}
/** +Z is forward: planted limbs travel backward, airborne limbs recover forward. */
export function contactCycle(phase:number,duty:number,stride:number,lift:number){
 const q=((phase%1)+1)%1,planted=q<duty;
 const t=planted?q/duty:(q-duty)/(1-duty),smooth=t*t*(3-2*t);
 return {z:planted?stride*(.5-t):stride*(smooth-.5),y:planted?0:Math.sin(Math.PI*t)*lift,planted};
}
export function gaitContact(phase:number,gait:RabbitGait,fore=false){
 const duty=gait==='walk'?.6:gait==='hop'?.3:fore?.18:.25;
 const offset=gait==='bound'?(fore?.1:.55):.5;
 return contactCycle(phase+offset,duty,GAIT_STRIDE[gait]*(fore&&gait==='bound'?.72:1),gait==='walk'?.075:gait==='hop'?.19:.13);
}
/** Local actor-space poses; root translation remains owned by collision/movement. */
export function sampleHoneyPose(phase:number,gait:RabbitGait,strength=1,time=0,working=0,seated=0):HoneyPose{
 const p=phase-Math.floor(phase),wave=Math.sin(p*Math.PI*2),positions:Record<string,T.Vector3>={},rotations:Record<string,T.Quaternion>={};
 const amount=T.MathUtils.clamp(strength,0,1),bound=gait==='bound'?amount:0,hop=gait==='hop'?amount:0;
 const hind=gaitContact(p,gait),fore=gaitContact(p,gait,true);
 const lean=1.0*bound+.16*hop,rotation=qx(lean),bob=(gait==='walk'?Math.abs(wave)*.018:gait==='hop'?hind.y*.75:(hind.planted||fore.planted?0:.04))*amount;
 const pelvis=rest.pelvis!.clone().add(new T.Vector3(0,-.13*bound-.045*amount*(1-bound)+bob+Math.sin(time*2)*.003*(1-amount),0));
 const bodyPoint=(v:T.Vector3)=>v.clone().sub(rest.pelvis!).applyQuaternion(rotation).add(pelvis);
 for(const name of Object.keys(rest)){positions[name]=bodyPoint(rest[name]!);rotations[name]=rotation.clone();}
 positions.body=new T.Vector3();rotations.body=new T.Quaternion();positions.pelvis=pelvis;rotations.pelvis=new T.Quaternion();rotations.spine=qx(lean*.55);rotations.tail=new T.Quaternion();
 // Keep the face readable as the shoulders lean over the forepaws.
 positions.head!.y+=.12*bound;
 const headRotation=qx(lean*.16);rotations.head=headRotation;rotations.neck=qx(lean*.48);
 for(const side of ['L','R']){
  const sign=side==='L'?-1:1;
  for(const [i,name] of ['ear','earMid','earTip'].entries()){
   const anchor=rest['ear'+side]!.clone().sub(rest.head!).applyQuaternion(headRotation).add(positions.head!);
   const delta=rest[name+side]!.clone().sub(rest['ear'+side]!),earQ=headRotation.clone().multiply(qx(Math.sin(p*6.28-i*.2)*(.01+.035*amount)*(1-bound)));
   positions[name+side]=delta.applyQuaternion(earQ).add(anchor);positions[name+side]!.y=Math.max(.09,positions[name+side]!.y);rotations[name+side]=earQ;
  }
  const phaseSide=p+(gait==='walk'&&side==='R'?.5:0),step=Math.sin(phaseSide*6.28),contact=gaitContact(phaseSide,gait),foot=rest['foot'+side]!.clone();
  foot.z+=(-.08+contact.z)*amount;foot.y+=contact.y*amount;
  foot.z+=seated*.17;
  const limb=(aName:string,bName:string,cName:string,target:T.Vector3,hint:T.Vector3)=>{
   const a=positions[aName]!,l1=rest[aName]!.distanceTo(rest[bName]!),l2=rest[bName]!.distanceTo(rest[cName]!);const solved=solveLimb(a,target,l1,l2,hint);positions[bName]=solved.middle;positions[cName]=solved.end;
   rotations[aName]=new T.Quaternion().setFromUnitVectors(rest[bName]!.clone().sub(rest[aName]!).normalize(),solved.middle.clone().sub(a).normalize());
   rotations[bName]=new T.Quaternion().setFromUnitVectors(rest[cName]!.clone().sub(rest[bName]!).normalize(),solved.end.clone().sub(solved.middle).normalize());rotations[cName]=rotations[bName]!.clone();
  };
  limb('leg'+side,'shin'+side,'foot'+side,foot,new T.Vector3(sign*.21,.22,.42));rotations['foot'+side]=qx(-Math.max(0,step)*.14*amount*(1-bound));
  const hand=bodyPoint(rest['hand'+side]!);hand.z+=-step*.04*amount*(1-bound);hand.y+=working*.035*Math.sin(time*7+(side==='L'?0:Math.PI));
  if(bound){const runHand=new T.Vector3(sign*.28,.085+fore.y,positions['arm'+side]!.z+.04+fore.z);hand.lerp(runHand,bound);}
  limb('arm'+side,'forearm'+side,'hand'+side,hand,new T.Vector3(sign*.42,positions['arm'+side]!.y-.06,positions['arm'+side]!.z-.18));
  rotations['hand'+side]=qx(lean*.5);
  if(amount<1){for(const prefix of ['arm','forearm','hand','leg','shin','foot']){const n=prefix+side;positions[n]!.lerp(rest[n]!,(1-amount)*(1-Math.max(working,seated)));rotations[n]!.slerp(new T.Quaternion(),(1-amount)*(1-Math.max(working,seated)));}}
 }
 return {positions,rotations,contacts:{left:positions.footL!.y<.095,right:positions.footR!.y<.095,hands:bound>.95&&positions.handL!.y<.11&&positions.handR!.y<.11}};
}
export interface HoneyBinding {bone:T.Bone;name:string;parent:string|null;restRotation:T.Quaternion;parentInverse:T.Matrix4}
export function bindHoneyPose(visual:T.Object3D):HoneyBinding[]{
 visual.updateMatrixWorld(true);const frame=visual.matrixWorld.clone().invert(),bones:Record<string,T.Bone>={};visual.traverse(o=>{if(o instanceof T.Bone)bones[o.name]=o;});
 return Object.entries(rig.joints).map(([name,spec])=>{const bone=bones[name];if(!bone)throw new Error(`Honey rig missing ${name}`);const matrix=frame.clone().multiply(bone.matrixWorld);return {bone,name,parent:spec.parent,restRotation:new T.Quaternion().setFromRotationMatrix(matrix.extractRotation(matrix)),parentInverse:frame.clone().multiply(bone.parent!.matrixWorld).invert()};});
}
const unit=new T.Vector3(1,1,1),matrices=new Map<string,T.Matrix4>(),local=new T.Matrix4();
export function applyHoneyPose(bindings:HoneyBinding[],pose:HoneyPose){
 for(const b of bindings){let m=matrices.get(b.name);if(!m){m=new T.Matrix4();matrices.set(b.name,m);}m.compose(pose.positions[b.name]!,pose.rotations[b.name]!.clone().multiply(b.restRotation),unit);local.copy(b.parent?matrices.get(b.parent)!:b.parentInverse);if(b.parent)local.invert();local.multiply(m).decompose(b.bone.position,b.bone.quaternion,b.bone.scale);}
}

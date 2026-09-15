import type {FurnitureDefinition,InteriorDefinition} from '../world/types';
import {workstationYaw,integratedScreenKinds} from '../three/workstations';
import type {PlayerPoint} from './playerMotion';
export const BODY_RADIUS=.33;
export function furnitureBody(f:FurnitureDefinition){
 const k=f.kind;
 let size:readonly number[]|undefined;
 if(['desk','computer','workbench','repair-table','reading-desk','response-desk','dispatch-pod','radio-console','meeting-table','map-table'].includes(k))size=k==='desk'?[.99,.68]:[1.8,.85];
 else if(k==='chair'||k==='office-chair')size=[.66,.65];
 else if(k==='sofa')size=[1.98,.9];else if(k==='bed')size=[1.3,2];
 else if(k==='bookcase'||k==='cabinet'){if(f.layer==='surface')return;size=[(k==='cabinet'||f.assetId===180)?1.058:1.43,.6];}
 else if(k==='plant')size=[.5,.5];else if(k==='printer'||k==='beverage-station')size=[.8,.65];
 else if(k==='television')size=[1.2,.48];
 else if(k==='decor'&&!['floor','surface','wall'].includes(f.layer??'')&&!f.supportedByIds?.length)size=[.78,.56];
 if(!size)return;
 const yaw=['chair','office-chair',...integratedScreenKinds].includes(k)?workstationYaw(f):(f.rotation||0)*Math.PI/180;
 return {id:f.id,x:f.point.x,z:f.point.y,w:size[0]!,d:size[1]!,yaw};
}
export function bodyOverlaps(p:PlayerPoint,b:NonNullable<ReturnType<typeof furnitureBody>>,radius=BODY_RADIUS){
 const dx=p.x-b.x,dz=p.y-b.z,x=dx*Math.cos(b.yaw)-dz*Math.sin(b.yaw),z=dx*Math.sin(b.yaw)+dz*Math.cos(b.yaw);
 return Math.hypot(Math.max(Math.abs(x)-b.w/2,0),Math.max(Math.abs(z)-b.d/2,0))<radius;
}
export function roomBodyAllowed(room:InteriorDefinition,p:PlayerPoint,ignore?:string){
 if(p.x<-.5+BODY_RADIUS||p.y<-.5+BODY_RADIUS||p.x>room.width-.5-BODY_RADIUS||p.y>room.height-.5-BODY_RADIUS)return false;
 return !room.furniture.some(f=>{const b=furnitureBody(f);return b&&f.id!==ignore&&bodyOverlaps(p,b);});
}
function landingPoint(f:FurnitureDefinition){const b=furnitureBody(f)!;const offset=f.kind==='bed'?.2:f.kind==='sofa'?.08:-.12;return {x:f.point.x+Math.sin(b.yaw)*offset,y:f.point.y+Math.cos(b.yaw)*offset};}
export function perchTarget(room:InteriorDefinition,p:PlayerPoint){
 return room.furniture.filter(f=>['bed','chair','office-chair','sofa'].includes(f.kind)).map(f=>({id:f.id,point:landingPoint(f),height:f.kind==='bed'?.76:f.kind==='sofa'?.72:.56,distance:Math.hypot(p.x-f.point.x,p.y-f.point.y)})).filter(t=>t.distance<=1.8&&t.distance>.25&&Array.from({length:21},(_,i)=>({x:p.x+(t.point.x-p.x)*i/20,y:p.y+(t.point.y-p.y)*i/20})).every(q=>roomBodyAllowed(room,q,t.id))).sort((a,b)=>a.distance-b.distance)[0];
}

export function restSurfaceAt(room:InteriorDefinition,p:PlayerPoint){
 return room.furniture.find(f=>['bed','sofa'].includes(f.kind)&&bodyOverlaps(p,furnitureBody(f)!, .05));
}
export function room2DBodyAllowed(room:InteriorDefinition,p:PlayerPoint,restId='*'){
 const furniture=room.furniture.filter(f=>!(['bed','sofa'].includes(f.kind)&&(restId==='*'||f.id===restId)));
 return roomBodyAllowed({...room,furniture},p);
}

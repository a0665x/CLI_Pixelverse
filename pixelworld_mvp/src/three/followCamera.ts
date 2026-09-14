import * as T from 'three';
import type {WorldDefinition,InteriorDefinition} from '../world/types';
export const FOLLOW_MIN=2,FOLLOW_MAX=60;
export function zoomFollow(distance:number,delta:number){return T.MathUtils.clamp(distance*Math.exp(T.MathUtils.clamp(delta,-500,500)*.001),FOLLOW_MIN,FOLLOW_MAX);}
/** Preserve the player's framing; occlusion is indicated by a screen-space position marker. */
export function resolveFollowPosition(target:T.Vector3,desired:T.Vector3,_world:WorldDefinition,_room?:InteriorDefinition){
 const offset=desired.clone().sub(target),distance=T.MathUtils.clamp(offset.length(),FOLLOW_MIN,FOLLOW_MAX);
 return desired.copy(target).add(offset.normalize().multiplyScalar(distance));
}

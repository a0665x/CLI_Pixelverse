import type {PlayerPoint} from './playerMotion';
export interface CharacterBody extends PlayerPoint { id:string; roomId:string; height?:number; radius?:number }
export const CHARACTER_RADIUS=.34;
/** Swept horizontal cylinders; separate rooms and non-overlapping heights never collide.
 * Existing overlaps may separate, but cannot deepen or cross through a body. */
export function characterMoveAllowed(from:CharacterBody,to:PlayerPoint,bodies:readonly CharacterBody[]):boolean {
 return bodies.every(other=>{
  if(other.id===from.id||other.roomId!==from.roomId||Math.abs((other.height??0)-(from.height??0))>=.95)return true;
  const radius=(from.radius??CHARACTER_RADIUS)+(other.radius??CHARACTER_RADIUS);
  const before=Math.hypot(from.x-other.x,from.y-other.y),after=Math.hypot(to.x-other.x,to.y-other.y);
  if(before<radius-.00001)return after>before+.000001;
  const dx=to.x-from.x,dy=to.y-from.y,length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,((other.x-from.x)*dx+(other.y-from.y)*dy)/length)):0;
  return Math.hypot(from.x+dx*t-other.x,from.y+dy*t-other.y)>=radius-.00001;
 });
}

/** The top of another body is a support surface when descending from above. */
export function characterSupport(body:CharacterBody,previousHeight:number,bodies:readonly CharacterBody[]):number {
 return bodies.reduce((floor,other)=>{
  const top=(other.height??0)+.95;
  return other.id!==body.id&&other.roomId===body.roomId&&previousHeight>=top-.015&&Math.hypot(body.x-other.x,body.y-other.y)<(body.radius??CHARACTER_RADIUS)+(other.radius??CHARACTER_RADIUS)?Math.max(floor,top):floor;
 },0);
}

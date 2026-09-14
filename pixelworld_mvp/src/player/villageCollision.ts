import {CatmullRomCurve3,Vector3} from 'three';
import type {WorldDefinition,InteriorDefinition} from '../world/types';
import type {PlayerPoint} from './playerMotion';
import type {NavigationGrid} from '../navigation/navigationGrid';
export const PLAYER_RADIUS=.30;
const rivers=new WeakMap<WorldDefinition,Vector3[]>();
export function riverSamples(world:WorldDefinition){
 let points=rivers.get(world);if(points)return points;
 const centers=world.scenery.river.map(r=>new Vector3(r.x+(r.width-1)/2,.024,r.y));
 centers.unshift(centers[0]!.clone().setZ(-1));centers.push(centers.at(-1)!.clone().setZ(world.height));
 points=new CatmullRomCurve3(centers,false,'centripetal').getPoints(240);rivers.set(world,points);return points;
}
function overlaps(p:PlayerPoint,minX:number,minY:number,maxX:number,maxY:number,r=PLAYER_RADIUS){
 return Math.hypot(Math.max(minX-p.x,0,p.x-maxX),Math.max(minY-p.y,0,p.y-maxY))<r;
}
/** Continuous body collision with objects actually rendered in the 3D village. */
export function villagePlayerAllowed(world:WorldDefinition,_grid:NavigationGrid,p:PlayerPoint){
 const r=PLAYER_RADIUS;
 if(p.x<-.5+r||p.y<-.5+r||p.x>world.width-.5-r||p.y>world.height-.5-r)return false;
 for(const {bounds:b} of world.buildings)if(overlaps(p,b.x-.5,b.y-.5,b.x+b.width-.5,b.y+b.height-.5))return false;
 for(const {trunk:t} of world.scenery.trees)if(Math.hypot(p.x-t.x,p.y-t.y)<r+.24)return false;
 for(const d of world.scenery.decorations){
  const half=d.kind==='bench'?[.7,.25]:d.kind==='crate'?[.325,.325]:d.kind==='rock'?[.4,.4]:undefined;
  if(half&&overlaps(p,d.point.x-half[0]!,d.point.y-half[1]!,d.point.x+half[0]!,d.point.y+half[1]!))return false;
 }
 for(const f of world.scenery.cropFields)if(overlaps(p,f.x-.5,f.y-.5,f.x+f.width-.5,f.y+f.height-.5))return false;
 for(const b of world.buildings)if(Math.hypot(p.x-b.entrance.outside.x-1.05,p.y-b.entrance.outside.y)<r+.07)return false;
 const samples=riverSamples(world);
 for(let i=1;i<samples.length;i++){const a=samples[i-1]!,b=samples[i]!;if(p.y<a.z||p.y>b.z)continue;
  const x=a.x+(b.x-a.x)*(p.y-a.z)/(b.z-a.z||1);
  if(Math.abs(p.x-x)<1.425+r){return world.scenery.bridges.some(bridge=>p.x>=bridge.x-1.1&&p.x<=bridge.x+bridge.width+.1&&Math.abs(p.y-bridge.y)<=.56-r);}
  break;
 }
 return true;
}
/** Body-sized room boundary and inflated furniture cells; no point-sized wall tests. */
export function roomPlayerAllowed(room:InteriorDefinition,blocked:ReadonlySet<string>,p:PlayerPoint){
 if(p.x<-.5+PLAYER_RADIUS||p.y<-.5+PLAYER_RADIUS||p.x>room.width-.5-PLAYER_RADIUS||p.y>room.height-.5-PLAYER_RADIUS)return false;
 for(let y=Math.floor(p.y-1);y<=Math.ceil(p.y+1);y++)for(let x=Math.floor(p.x-1);x<=Math.ceil(p.x+1);x++)
  if(blocked.has(`${x},${y}`)&&overlaps(p,x-.5,y-.5,x+.5,y+.5))return false;
 return true;
}

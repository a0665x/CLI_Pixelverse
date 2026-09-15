import {clearSight,type PlayerPoint} from './playerMotion';
import type {InspectorFood} from './foodEffects';
export interface FoodDrop extends PlayerPoint{id:number;food:InspectorFood;born:number;lands:number;expires:number}
export class FoodDrops {
 items:FoodDrop[]=[];private serial=0;
 scatter(origin:PlayerPoint,width:number,height:number,allowed:(p:PlayerPoint)=>boolean,now:number,random= Math.random){
  this.expire(now);if(this.items.length)return;
  const seeds:PlayerPoint[]=[];for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)seeds.push({x:Math.round(origin.x)+x,y:Math.round(origin.y)+y});
  const start=seeds.filter(p=>allowed(p)&&clearSight(origin,p,allowed)).sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y))[0]??origin;
  const queue=[start],seen=new Set([`${start.x},${start.y}`]),candidates:PlayerPoint[]=[];
  for(let i=0;i<queue.length;i++){const p=queue[i]!;if(allowed(p)&&Math.hypot(p.x-origin.x,p.y-origin.y)>=1)candidates.push(p);
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n={x:p.x+dx!,y:p.y+dy!},key=`${n.x},${n.y}`;if(n.x<0||n.y<0||n.x>=width||n.y>=height||seen.has(key)||!allowed(n)||!clearSight(p,n,allowed))continue;seen.add(key);queue.push(n);}}
  candidates.sort((a,b)=>Math.hypot(a.x-origin.x,a.y-origin.y)-Math.hypot(b.x-origin.x,b.y-origin.y));
  const selected:PlayerPoint[]=[];if(candidates.length)selected.push(candidates.shift()!);
  for(let i=candidates.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[candidates[i],candidates[j]]=[candidates[j]!,candidates[i]!];}
  for(const p of candidates){if(selected.length>=10)break;if(selected.every(q=>Math.hypot(q.x-p.x,q.y-p.y)>=1.2))selected.push(p);}
  this.items=selected.map((p,i)=>{const born=now+i*90,lands=born+1400;return {...p,id:++this.serial,food:i===0?(random()<.5?'carrot':'hay'):i%2?'carrot':'hay',born,lands,expires:lands+60000};});
 }
 expire(now:number){this.items=this.items.filter(d=>now<d.expires);}
 collect(point:PlayerPoint,now:number){this.expire(now);const eaten=this.items.filter(d=>now>=d.lands&&Math.hypot(point.x-d.x,point.y-d.y)<.65);const ids=new Set(eaten.map(d=>d.id));this.items=this.items.filter(d=>!ids.has(d.id));return eaten;}
}
export function foodDropHeight(drop:FoodDrop,now:number){const t=Math.max(0,Math.min(1,(now-drop.born)/(drop.lands-drop.born)));return 12*(1-t*t);}

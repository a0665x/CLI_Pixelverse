import {clearSight,movePlayer,type PlayerPoint} from './playerMotion';
/** Shared body collision sampled into a navigation graph, independent of 2D art cells. */
export class ActorNavigation {
 private nodes:PlayerPoint[]=[];
 private cells=new Map<string,number>();
 constructor(width:number,height:number,readonly allowed:(p:PlayerPoint)=>boolean){
  for(let y=0;y<height*2;y++)for(let x=0;x<width*2;x++){const p={x:x/2,y:y/2};if(allowed(p)){this.cells.set(`${x},${y}`,this.nodes.length);this.nodes.push(p);}}
 }
 nearest(p:PlayerPoint):PlayerPoint {return this.nodes.reduce((best,q)=>Math.hypot(q.x-p.x,q.y-p.y)<Math.hypot(best.x-p.x,best.y-p.y)?q:best,this.nodes[0]??p);}
 route(from:PlayerPoint,to:PlayerPoint):PlayerPoint[]{
  const start=this.nearest(from),goal=this.nearest(to);
  const id=(p:PlayerPoint)=>this.cells.get(`${Math.round(p.x*2)},${Math.round(p.y*2)}`)!;
  const a=id(start),b=id(goal);if(a===undefined||b===undefined)return [];
  const parents=new Map<number,number>([[a,-1]]),queue=[a];
  for(let i=0;i<queue.length&&!parents.has(b);i++){const current=queue[i]!,p=this.nodes[current]!;
   for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const n=this.cells.get(`${Math.round(p.x*2)+dx!},${Math.round(p.y*2)+dy!}`);if(n===undefined||parents.has(n)||!clearSight(p,this.nodes[n]!,this.allowed))continue;parents.set(n,current);queue.push(n);}
  }
  if(!parents.has(b))return [];
  const path:PlayerPoint[]=[];for(let i=b;i!==a;i=parents.get(i)!)path.unshift(this.nodes[i]!);
  if(Math.hypot(from.x-start.x,from.y-start.y)>.01)path.unshift(start);
  return path;
 }
}
export class ActorWalker {
 point:PlayerPoint;private path:PlayerPoint[]=[];private elapsed=1;private goal='';
 constructor(private nav:ActorNavigation,start:PlayerPoint){this.point={...nav.nearest(start)};}
 step(target:PlayerPoint,dt:number){
  this.elapsed+=dt;const key=`${Math.round(target.x*2)},${Math.round(target.y*2)}`;
  if(this.elapsed>=.5&&key!==this.goal){this.goal=key;this.path=this.nav.route(this.point,target);this.elapsed=0;}
  const before={...this.point};let budget=Math.min(dt,.1)*1.8;
  while(budget>0&&this.path.length){const p=this.path[0]!,distance=Math.hypot(p.x-this.point.x,p.y-this.point.y);if(distance<.01){this.path.shift();continue;}
   const step=Math.min(budget,distance),next=movePlayer(this.point,p.x-this.point.x,p.y-this.point.y,step,this.nav.allowed);
   if(Math.hypot(next.x-this.point.x,next.y-this.point.y)<.00001)break;
   this.point=next;budget-=step;
  }
  const dx=this.point.x-before.x,dy=this.point.y-before.y;return {point:this.point,moving:Math.hypot(dx,dy)>.0001,heading:Math.atan2(dx,dy)};
 }
}

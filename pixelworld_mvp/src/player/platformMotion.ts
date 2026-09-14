import type {InteriorDefinition} from '../world/types';
import {BODY_RADIUS,bodyOverlaps,furnitureBody} from './furniturePhysics';
import {movePlayer,type PlayerPoint} from './playerMotion';
type Body=NonNullable<ReturnType<typeof furnitureBody>>;
type Solid=Body & {height:number;stand:boolean};
const GRAVITY=12,JUMP_SPEED=5.7;
/** One continuous height/velocity state. Landing never swaps to a separate animation. */
export class PlatformMotion {
 point:PlayerPoint;groundPoint:PlayerPoint;height=0;velocity=0;grounded=true;support='';
 private solids:Solid[]=[];
 constructor(private room:InteriorDefinition,point:PlayerPoint){
  this.point={...point};this.groundPoint={...point};
  for(const f of room.furniture){const b=furnitureBody(f);if(!b)continue;
   const height=f.kind==='bed'?.69:f.kind==='sofa'?.69:['chair','office-chair'].includes(f.kind)?.56:['bookcase','cabinet'].includes(f.kind)?1.95:2;
   const stand=['bed','sofa','chair','office-chair','bookcase','cabinet'].includes(f.kind);
   this.solids.push({...b,height:stand?height:100,stand});
   const part=(x:number,z:number,w:number,d:number,h:number)=>this.solids.push({...b,id:b.id+'-edge',x:b.x+x*Math.cos(b.yaw)+z*Math.sin(b.yaw),z:b.z-x*Math.sin(b.yaw)+z*Math.cos(b.yaw),w,d,height:h,stand:true});
   if(f.kind==='sofa'){part(0,-.34,1.8,.18,1.1);part(-.83,0,.18,.9,.825);part(.83,0,.18,.9,.825);}
   if(['chair','office-chair'].includes(f.kind))part(0,.26,.66,.12,1.2);
  }
 }
 private contains(p:PlayerPoint,b:Body){return bodyOverlaps(p,b,.01);}
 private allowed=(p:PlayerPoint)=>p.x>=-.5+BODY_RADIUS&&p.y>=-.5+BODY_RADIUS&&p.x<=this.room.width-.5-BODY_RADIUS&&p.y<=this.room.height-.5-BODY_RADIUS&&!this.solids.some(b=>this.height<b.height-.015&&bodyOverlaps(p,b)&&!(bodyOverlaps(this.point,b)&&Math.hypot(p.x-b.x,p.y-b.z)>Math.hypot(this.point.x-b.x,this.point.y-b.z)+.000001));
 step(dx:number,dy:number,speed:number,seconds:number,jump:boolean){
  if(jump&&this.grounded){this.velocity=JUMP_SPEED;this.grounded=false;}
  let left=Math.min(seconds,.15);
  while(left>0){const dt=Math.min(left,1/120);left-=dt;
   const previous=this.height;this.velocity-=GRAVITY*dt;this.height+=this.velocity*dt;
   let floor=0,support='';
   for(const b of this.solids)if(b.stand&&this.contains(this.point,b)&&previous>=b.height-.015&&b.height>floor){floor=b.height;support=b.id;}
   if(this.height<=floor&&this.velocity<=0){this.height=floor;this.velocity=0;this.grounded=true;this.support=support;}else{this.grounded=false;this.support='';}
   this.point=movePlayer(this.point,dx,dy,speed*dt,this.allowed);
  }
  if(this.grounded&&this.height===0)this.groundPoint={...this.point};
  return this;
 }
}

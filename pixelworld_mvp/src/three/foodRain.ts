import * as T from 'three';
import {cylinder,disposeGroup,batchStatic} from './models';
import {foodDropHeight,type FoodDrop} from '../player/foodDrops';
export class FoodRain {
 group=new T.Group();private meshes=new Map<number,T.Group>();
 update(drops:FoodDrop[],now:number,ground:(x:number,y:number)=>number){
  const ids=new Set(drops.map(d=>d.id));for(const [id,g] of this.meshes)if(!ids.has(id)){disposeGroup(g);g.removeFromParent();this.meshes.delete(id);}
  for(const d of drops){let g=this.meshes.get(d.id);if(!g){g=new T.Group();if(d.food==='carrot'){
   cylinder(g,0,.39,0,.055,.72,0xe69a44,.19);for(let i=0;i<4;i++){const leaf=cylinder(g,(i-1.5)*.05,.85,0,.025,.26,0x6d9853);leaf.rotation.z=(i-1.5)*.24;}
  }else{for(let i=0;i<16;i++){const stalk=cylinder(g,(i%4-1.5)*.11,.43,(Math.floor(i/4)-1.5)*.1,.045,.70+(i%3)*.04,0xcbbb76);stalk.rotation.z=(i%4-1.5)*.06;}const band=cylinder(g,0,.4,0,.26,.10,0x916f42);band.scale.z=.85;}
  g=batchStatic(g);this.meshes.set(d.id,g);this.group.add(g);}
  g.visible=now>=d.born;g.position.set(d.x,ground(d.x,d.y)+foodDropHeight(d,now),d.y);g.rotation.y=d.id*2.4;}
 }
 dispose(){for(const g of this.meshes.values())disposeGroup(g);this.meshes.clear();this.group.clear();}
}

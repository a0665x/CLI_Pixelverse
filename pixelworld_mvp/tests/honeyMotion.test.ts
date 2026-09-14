import * as T from 'three';
import {describe,it,expect} from 'vitest';
import {sampleHoneyPose,solveLimb} from '../src/three/honeyMotion';
import {nextRabbitGait,GAIT_SPEED} from '../src/player/rabbitGait';
import {movePlayer} from '../src/player/playerMotion';
describe('Honey three gaits',()=>{
 it('alternates feet walking, synchronizes feet hopping',()=>{const walk=sampleHoneyPose(.25,'walk'),hop=sampleHoneyPose(.25,'hop');expect(walk.positions.footL!.y-walk.positions.footR!.y).toBeGreaterThan(.04);expect(hop.positions.footL!.y).toBeCloseTo(hop.positions.footR!.y,3);expect(hop.positions.pelvis!.y).toBeGreaterThan(walk.positions.pelvis!.y+.08);});
 it('plants forepaws during bounding and raises them during recovery',()=>{const poses=Array.from({length:40},(_,i)=>sampleHoneyPose(i/40,'bound'));expect(poses.some(p=>p.contacts.hands)).toBe(true);expect(Math.max(...poses.map(p=>p.positions.handL!.y))-Math.min(...poses.map(p=>p.positions.handL!.y))).toBeGreaterThan(.07);expect(poses[0]!.positions.chest!.z).toBeGreaterThan(.3);});
 it('respects limb lengths for unreachable targets',()=>{const a=new T.Vector3(),p=solveLimb(a,new T.Vector3(0,5,0),.2,.15,new T.Vector3(1,1,0));expect(a.distanceTo(p.middle)).toBeCloseTo(.2);expect(p.middle.distanceTo(p.end)).toBeCloseTo(.15);});
 it('maps modifiers and prevents tunneling at all speeds',()=>{expect(nextRabbitGait('walk')).toBe('hop');expect(nextRabbitGait('hop')).toBe('bound');expect(nextRabbitGait('bound')).toBe('walk');for(const speed of Object.values(GAIT_SPEED)){const p=movePlayer({x:0,y:0},1,0,speed,x=>Math.round(x.x)!==1);expect(p.x).toBeLessThan(.5);}});
});

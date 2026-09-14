import {it,expect} from 'vitest';
import {sampleHoneyPose,gaitContact} from '../src/three/honeyMotion';
it('pushes backward relative to the body while the walking foot is planted',()=>{
 const a=sampleHoneyPose(.65,'walk'),b=sampleHoneyPose(.70,'walk');
 expect(a.contacts.left&&b.contacts.left).toBe(true);
 expect(b.positions.footL!.z).toBeLessThan(a.positions.footL!.z);
});


for(const mode of ['walk','hop','bound'] as const)for(const fore of (mode==='bound'?[false,true]:[false])){
 it(`${mode} ${fore?'forepaws':'hind feet'} push back on ground and recover forward in air`,()=>{
  let stance=0,recovery=0;
  for(let i=0;i<999;i++){
   const a=gaitContact(i/1000,mode,fore),b=gaitContact((i+1)/1000,mode,fore);
   if(a.planted&&b.planted){expect(b.z).toBeLessThan(a.z);expect(a.y).toBe(0);expect(b.y).toBe(0);stance++;}
   if(!a.planted&&!b.planted){expect(b.z).toBeGreaterThan(a.z);recovery++;}
  }
  expect(stance).toBeGreaterThan(100);expect(recovery).toBeGreaterThan(300);
 });
}
it('keeps the solved walking support foot grounded and moving backward',()=>{
 const a=sampleHoneyPose(.65,'walk'),b=sampleHoneyPose(.66,'walk');
 expect(b.positions.footL!.z).toBeLessThan(a.positions.footL!.z);expect(b.positions.footL!.y).toBeCloseTo(a.positions.footL!.y,3);
});

import {it,expect} from 'vitest';
import {PlatformMotion} from '../src/player/platformMotion';
import type {InteriorDefinition} from '../src/world/types';
const room={width:12,height:10,furniture:[{id:'sofa',kind:'sofa',point:{x:4,y:5}},{id:'shelf',kind:'bookcase',point:{x:4,y:3.5}}]} as InteriorDefinition;
it('lands on a sofa, jumps from its height, climbs higher and settles without jitter',()=>{
 const p=new PlatformMotion(room,{x:4,y:6.3});
 p.step(0,-1,2,.01,true);
 for(let i=0;i<50;i++)p.step(0,-1,2,.01,false);
 for(let i=0;i<70;i++)p.step(0,0,2,.01,false);
 expect(p.support).toBe('sofa');expect(p.height).toBe(.69);
 p.step(0,-1,2,.01,true);let peak=p.height;
 for(let i=0;i<90;i++){p.step(0,p.point.y>3.55?-1:0,3.4,.01,false);peak=Math.max(peak,p.height);}
 expect(peak).toBeGreaterThan(2);expect(p.support).toBe('shelf');expect(p.height).toBe(1.95);
 for(let i=0;i<100;i++){p.step(0,0,0,.016,false);expect(p.height).toBe(1.95);}
});
it('rejects air jumps and maintains stable height over frame subdivisions',()=>{
 const a=new PlatformMotion(room,{x:8,y:8}),b=new PlatformMotion(room,{x:8,y:8});
 a.step(0,0,0,0,true);b.step(0,0,0,0,true);
 for(let i=0;i<42;i++)a.step(0,0,0,1/60,true);
 for(let i=0;i<84;i++)b.step(0,0,0,1/120,false);
 expect(Math.abs(a.height-b.height)).toBeLessThan(.1);
});
it('walks off a platform and falls to the floor without trapping movement',()=>{
 const p=new PlatformMotion(room,{x:4,y:5.15});p.height=.69;p.support='sofa';
 for(let i=0;i<200;i++)p.step(0,1,2,.01,false);
 expect(p.height).toBe(0);expect(p.point.y).toBeGreaterThan(8);expect(p.grounded).toBe(true);
});

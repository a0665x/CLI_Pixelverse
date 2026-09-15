import {describe,it,expect} from 'vitest';
import {characterMoveAllowed} from '../src/player/characterCollision';
import {PathFollower} from '../src/agents/pathFollower';
import {movePlayer} from '../src/player/playerMotion';
describe('solid character bodies',()=>{
 const inspector={id:'inspector',roomId:'',x:0,y:0};
 const agent={id:'rabbit',roomId:'',x:1,y:0};
 it('blocks swept crossings at every gait and permits tangent sliding',()=>{
  for(const distance of [.1,1,5,20]){
   const p=movePlayer(inspector,1,0,distance,q=>characterMoveAllowed(inspector,q,[agent]));
   expect(p.x).toBeLessThanOrEqual(.321);
  }
  expect(characterMoveAllowed({...inspector,x:.32},{x:.32,y:1},[agent])).toBe(true);
 });
 it('separates existing overlaps without trapping or allowing deeper penetration',()=>{
  expect(characterMoveAllowed({...inspector,x:.5},{x:.4,y:0},[agent])).toBe(true);
  expect(characterMoveAllowed({...inspector,x:.5},{x:.6,y:0},[agent])).toBe(false);
 });
 it('isolates different rooms and height layers',()=>{
  expect(characterMoveAllowed(inspector,{x:2,y:0},[{...agent,roomId:'house'}])).toBe(true);
  expect(characterMoveAllowed({...inspector,height:1.1},{x:2,y:0},[agent])).toBe(true);
 });
 it('does not advance agent route or fire arrival through the inspector',()=>{
  const f=new PathFollower(16,48);f.setPath([{x:0,y:0},{x:4,y:0}]);
  const block=(a:{x:number;y:number},b:{x:number;y:number})=>characterMoveAllowed({id:'rabbit',roomId:'',x:a.x/16-.5,y:a.y/16-.5},{x:b.x/16-.5,y:b.y/16-.5},[{...inspector,x:2}]);
  for(let i=0;i<20;i++){const result=f.update(100,block);expect(result.arrived).toBe(false);expect(result.position.x/16-.5).toBeLessThanOrEqual(1.321);}
  expect(f.update(2000).arrived).toBe(true);
 });
});

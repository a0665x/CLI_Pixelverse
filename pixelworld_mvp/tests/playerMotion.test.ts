import { describe,it,expect } from 'vitest';
import { movePlayer,clearSight,choiceIndex } from '../src/player/playerMotion';
describe('player controls',()=>{
  it('cannot tunnel through a one-cell wall on a long frame',()=>{
    const p=movePlayer({x:0,y:0},1,0,10,p=>Math.round(p.x)!==2);
    expect(p.x).toBeLessThan(1.5);
  });
  it('normalizes diagonal input and slides along blocked axes',()=>{
    const p=movePlayer({x:0,y:0},1,1,1,()=>true);
    expect(Math.hypot(p.x,p.y)).toBeCloseTo(1);
    expect(movePlayer({x:0,y:0},1,1,1,p=>p.x<=0).y).toBeGreaterThan(.6);
  });
  it('does not interact through a wall',()=>{
    expect(clearSight({x:0,y:0},{x:2,y:0},p=>Math.round(p.x)!==1)).toBe(false);
  });
  it('wraps all three choices in either direction',()=>{
    expect(choiceIndex(0,-1)).toBe(2);expect(choiceIndex(2,1)).toBe(0);
  });
});

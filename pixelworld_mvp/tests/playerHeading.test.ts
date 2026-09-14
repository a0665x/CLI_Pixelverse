import {it,expect} from 'vitest';
import {playerHeading} from '../src/player/playerHeading';
it('faces all four WASD directions without requiring position changes',()=>{
 expect(playerHeading(0,0,-1,0)).toBe(Math.PI);
 expect(playerHeading(0,-1,0,0)).toBe(-Math.PI/2);
 expect(playerHeading(Math.PI,0,1,0)).toBe(0);
 expect(playerHeading(0,1,0,0)).toBe(Math.PI/2);
});
it('uses camera-relative diagonals and retains facing on release',()=>{
 expect(playerHeading(0,1,-1,0)).toBeCloseTo(Math.PI*.75);
 expect(playerHeading(0,0,-1,Math.PI/2)).toBeCloseTo(-Math.PI/2);
 expect(playerHeading(1.25,0,0,2)).toBe(1.25);
});

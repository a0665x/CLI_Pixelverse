import {describe,it,expect} from 'vitest';
import {ActorNavigation,ActorWalker} from '../src/player/actorNavigation';
import {roomBodyAllowed} from '../src/player/furniturePhysics';
import {interiorDefinitionForBuilding} from '../src/world/interiorDefinitions';
import {WORLD_DEFINITION as world} from '../src/world/worldDefinition';
describe('3D Agent body navigation',()=>{
 it('routes around a table instead of copying a path through it',()=>{
  const allowed=(p:{x:number;y:number})=>p.x>=0&&p.y>=0&&p.x<8&&p.y<8&&!(p.x>2&&p.x<5&&p.y>2&&p.y<5);
  const nav=new ActorNavigation(8,8,allowed),walker=new ActorWalker(nav,{x:1,y:3});
  for(let i=0;i<400;i++){const before={...walker.point},result=walker.step({x:6,y:3},.016);expect(allowed(result.point)).toBe(true);if(result.moving)expect(Math.abs(Math.atan2(result.point.x-before.x,result.point.y-before.y)-result.heading)).toBeLessThan(.0001);}
  expect(walker.point.x).toBeCloseTo(6);expect(walker.point.y).toBeCloseTo(3);
 });
 it('places workstation targets on free floor in actual rooms',()=>{
  for(const b of world.buildings){const room=interiorDefinitionForBuilding(b),allowed=(p:{x:number;y:number})=>roomBodyAllowed(room,p),nav=new ActorNavigation(room.width,room.height,allowed);
   for(const furniture of room.furniture){const walker=new ActorWalker(nav,furniture.point);expect(allowed(walker.point)).toBe(true);for(let i=0;i<20;i++)expect(allowed(walker.step(furniture.point,.016).point)).toBe(true);}
  }
 });
});

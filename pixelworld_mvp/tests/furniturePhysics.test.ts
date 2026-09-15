import {it,expect} from 'vitest';
import {roomBodyAllowed,room2DBodyAllowed,restSurfaceAt,perchTarget,furnitureBody} from '../src/player/furniturePhysics';
import {movePlayer} from '../src/player/playerMotion';
import {WORLD_DEFINITION} from '../src/world/worldDefinition';
import {interiorDefinitionForBuilding} from '../src/world/interiorDefinitions';
import type {FurnitureDefinition} from '../src/world/types';
import {GAIT_SPEED} from '../src/player/rabbitGait';
const item=(kind:FurnitureDefinition['kind'],x=5,y=5):FurnitureDefinition=>({id:kind,kind,point:{x,y},facing:'up',supportedActions:[],icon:'rest'});
const room=(...furniture:FurnitureDefinition[])=>({...interiorDefinitionForBuilding(WORLD_DEFINITION.buildings[0]!),width:16,height:12,furniture});
it('uses rendered dimensions rather than inherited 2D furniture cells',()=>{const r=room(item('bed'));expect(roomBodyAllowed(r,{x:5.8,y:5})).toBe(false);expect(roomBodyAllowed(r,{x:6.1,y:5})).toBe(true);expect(roomBodyAllowed(r,{x:5,y:6.2})).toBe(false);});
it('rotates an asymmetric collision body with its model',()=>{const f={...item('bed'),rotation:90 as const};const r=room(f);expect(roomBodyAllowed(r,{x:6.2,y:5})).toBe(false);expect(roomBodyAllowed(r,{x:5,y:6.1})).toBe(true);});
it('prevents fast traversal tunneling through a desk or a wall',()=>{const r=room(item('computer'));for(const speed of Object.values(GAIT_SPEED)){const p=movePlayer({x:3,y:5},1,0,speed*2,q=>roomBodyAllowed(r,q));expect(p.x).toBeLessThan(3.78);}});
it('offers only reachable beds and seats, never desks or cabinets',()=>{for(const kind of ['bed','chair','sofa'] as const){const t=perchTarget(room(item(kind)),{x:3.5,y:5});expect(t?.id).toBe(kind);expect(t!.height).toBeGreaterThan(.5);}for(const kind of ['computer','bookcase','cabinet'] as const)expect(perchTarget(room(item(kind)),{x:3.5,y:5})).toBeUndefined();});
it('refuses jumps across another obstacle or outside the room',()=>{expect(perchTarget(room(item('bed'),item('computer',3.9,5)),{x:3.3,y:5})).toBeUndefined();expect(roomBodyAllowed(room(),{x:-.25,y:3})).toBe(false);});
it('matches the new requested travel speed tiers',()=>{expect(GAIT_SPEED.walk).toBeGreaterThanOrEqual(1.75);expect(GAIT_SPEED.hop).toBeGreaterThan(GAIT_SPEED.walk);expect(GAIT_SPEED.bound).toBeGreaterThan(GAIT_SPEED.hop);});

it('2D allows resting on beds and sofas while desks and neighbouring obstacles remain solid',()=>{
 for(const kind of ['bed','sofa'] as const){const r=room(item(kind),item('computer',7,5));expect(room2DBodyAllowed(r,{x:5,y:5})).toBe(true);expect(restSurfaceAt(r,{x:5,y:5})?.kind).toBe(kind);expect(room2DBodyAllowed(r,{x:7,y:5})).toBe(false);expect(room2DBodyAllowed(r,{x:5,y:5},'')).toBe(false);expect(room2DBodyAllowed(r,{x:5,y:5},kind)).toBe(true);const exit=movePlayer({x:5,y:5},0,1,3,p=>room2DBodyAllowed(r,p));expect(exit.y).toBeGreaterThan(7);}
});

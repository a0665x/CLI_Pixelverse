import {describe,it,expect} from 'vitest';
import * as T from 'three';
import {WORLD_DEFINITION as world} from '../src/world/worldDefinition';
import {NavigationGrid} from '../src/navigation/navigationGrid';
import {villagePlayerAllowed,roomPlayerAllowed,riverSamples} from '../src/player/villageCollision';
import {resolveFollowPosition,zoomFollow} from '../src/three/followCamera';
import {interiorDefinitionForBuilding} from '../src/world/interiorDefinitions';
const grid=NavigationGrid.fromWorld(world);
describe('visible 3D world matches player and camera',()=>{
 it('lets the inspector cross grass with no visible fence',()=>{expect(villagePlayerAllowed(world,grid,{x:34,y:17})).toBe(true);});
 it('keeps the player body clear of a house side wall',()=>{const b=world.buildings[0]!;expect(villagePlayerAllowed(world,grid,{x:b.bounds.x-.6,y:b.bounds.y+2})).toBe(false);});
 it('does not shorten the player camera into a closeup behind a house',()=>{const b=world.buildings[0]!,target=new T.Vector3(b.bounds.x-1,1,b.bounds.y+2),desired=target.clone().add(new T.Vector3(7,2,0));expect(resolveFollowPosition(target,desired,world).distanceTo(target)).toBeGreaterThan(5);});
 it('preserves zoom distance beside an indoor wall',()=>{const room=interiorDefinitionForBuilding(world.buildings[0]!),target=new T.Vector3(.4,1,2),desired=target.clone().add(new T.Vector3(-7,2,0));expect(resolveFollowPosition(target,desired,world,room).distanceTo(target)).toBeGreaterThan(5);});
});

it('keeps zoom reversible even after large wheel events',()=>{let distance=7;for(let i=0;i<20;i++)distance=zoomFollow(distance,-100000);expect(distance).toBe(2);distance=zoomFollow(distance,500);expect(distance).toBeGreaterThan(2);for(let i=0;i<20;i++)distance=zoomFollow(distance,100000);expect(distance).toBe(60);expect(zoomFollow(distance,-500)).toBeLessThan(60);});
it('blocks water but keeps every bridge centre walkable',()=>{for(const b of world.scenery.bridges)expect(villagePlayerAllowed(world,grid,{x:b.x+(b.width-1)/2,y:b.y})).toBe(true);const p=riverSamples(world).find(p=>p.z>1&&p.z<2)!;expect(villagePlayerAllowed(world,grid,{x:p.x,y:p.z})).toBe(false);});
it('prevents the body overlapping room walls or furniture',()=>{const room=interiorDefinitionForBuilding(world.buildings[0]!);expect(roomPlayerAllowed(room,new Set(),{x:-.3,y:2})).toBe(false);expect(roomPlayerAllowed(room,new Set(['2,2']),{x:1.3,y:2})).toBe(false);expect(roomPlayerAllowed(room,new Set(['2,2']),{x:1.1,y:2})).toBe(true);});
it('crosses each bridge continuously from bank to bank',()=>{for(const b of world.scenery.bridges){for(let x=b.x-1.1;x<=b.x+b.width+.1;x+=.08)expect(villagePlayerAllowed(world,grid,{x,y:b.y}),`bridge ${b.y} at ${x}`).toBe(true);}});

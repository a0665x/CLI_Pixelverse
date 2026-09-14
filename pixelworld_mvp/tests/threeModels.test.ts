import { describe,it,expect } from 'vitest';
import * as T from 'three';
import { batchStatic,roomModel,character,animateCharacter,house,box } from '../src/three/models';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { interiorDefinitionForBuilding } from '../src/world/interiorDefinitions';

describe('3D view geometry',()=>{
  it('builds every shared room and batches dense furnishings into a bounded number of meshes',()=>{
    for(const [i,b] of WORLD_DEFINITION.buildings.entries()){
      const source=roomModel(interiorDefinitionForBuilding(b),i);
      let before=0;source.traverse(n=>{if(n instanceof T.Mesh)before++;});
      const batched=batchStatic(source);
      expect(before).toBeGreaterThan(50);
      expect(batched.children.length).toBeLessThan(before);
      expect(batched.children.length).toBeLessThan(70);
      const bounds=new T.Box3().setFromObject(batched);
      expect(bounds.min.x).toBeGreaterThan(-2);
      expect(bounds.max.y).toBeLessThan(4);
    }
  });
  it('places each house on its authored plot instead of assigning a new grid',()=>{
    for(const [i,b] of WORLD_DEFINITION.buildings.entries()){
      const model=house(new T.Group(),b,i);
      expect(model.position.x).toBe(b.bounds.x+b.bounds.width/2-.5);
      expect(model.position.z).toBe(b.bounds.y+b.bounds.height/2-.5);
    }
  });
  it('separates walking and work animation while retaining the authoritative actor position',()=>{
    const actor=character(0xffffff);actor.position.set(3,0,4);
    animateCharacter(actor,1,true,false);expect(actor.userData.legs[0].rotation.x).not.toBe(0);
    animateCharacter(actor,1,false,true);expect(actor.userData.legs[0].rotation.x).toBe(0);
    expect(actor.userData.arms[0].rotation.x).toBeLessThan(-.5);
    expect(actor.position.toArray()).toEqual([3,0,4]);
  });
});

it('preserves rounded and indexed parts sharing one material',()=>{
 const group=new T.Group();box(group,0,0,0,1,1,1,0x123456);box(group,2,0,0,.01,1,1,0x123456);
 let triangles=0;group.traverse(o=>{if(o instanceof T.Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position!.count)/3;});
 const result=batchStatic(group);let merged=0;result.traverse(o=>{if(o instanceof T.Mesh)merged+=(o.geometry.index?.count??o.geometry.attributes.position!.count)/3;});
 expect(merged).toBe(triangles);
});

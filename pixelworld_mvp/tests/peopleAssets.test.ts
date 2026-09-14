import {describe,it,expect} from 'vitest';
import {humanVariant} from '../src/three/people';
import {createRoomMemo} from '../src/rendering/interiorRuntimeCache';
import {WORLD_DEFINITION} from '../src/world/worldDefinition';
import {interiorDefinitionForBuilding} from '../src/world/interiorDefinitions';
describe('Honey cast',()=>{
 it('preserves the inspector texture and assigns stable agent colours',()=>{expect(humanVariant('inspector',true)).toMatchObject({body:'honey-inspector',tint:0xffffff});expect(humanVariant('agent-a')).toEqual(humanVariant('agent-a'));expect(new Set(Array.from({length:30},(_,i)=>humanVariant(`agent-${i}`).tint)).size).toBe(6);});
 it('invalidates room geometry when the same layout is edited',()=>{const room=interiorDefinitionForBuilding(WORLD_DEFINITION.buildings[0]!);const memo=createRoomMemo<number>();let calls=0;const value=()=>memo(room,'path',()=>++calls);expect(value()).toBe(1);expect(value()).toBe(1);room.furniture[0]!.point.x+=1;expect(value()).toBe(2);});
});

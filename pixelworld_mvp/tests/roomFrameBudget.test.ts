import {it,expect,vi} from 'vitest';
import {createRoomMemo,withRoomMemoFrame} from '../src/rendering/interiorRuntimeCache';
import {WORLD_DEFINITION} from '../src/world/worldDefinition';
import {interiorDefinitionForBuilding} from '../src/world/interiorDefinitions';
it('serializes a shared room once per frame, not once for every agent query',()=>{
 const room=interiorDefinitionForBuilding(WORLD_DEFINITION.buildings[0]!);
 const one=createRoomMemo<number>(),two=createRoomMemo<number>();
 const spy=vi.spyOn(JSON,'stringify');
 withRoomMemoFrame(()=>{for(let i=0;i<100;i++){one(room,'a',()=>1);two(room,'b',()=>2);}});
 const calls=spy.mock.calls.filter(args=>args[0]===room).length;spy.mockRestore();expect(calls).toBe(1);
});
it('invalidates edits on the next frame and releases the scope after an exception',()=>{
 const room=structuredClone(interiorDefinitionForBuilding(WORLD_DEFINITION.buildings[0]!));
 const memo=createRoomMemo<number>();let computed=0;
 withRoomMemoFrame(()=>memo(room,'a',()=>++computed));room.width++;
 withRoomMemoFrame(()=>memo(room,'a',()=>++computed));expect(computed).toBe(2);
 expect(()=>withRoomMemoFrame(()=>{throw Error('test');})).toThrow();room.width++;
 memo(room,'a',()=>++computed);expect(computed).toBe(3);
});

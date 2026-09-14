import {it,expect} from 'vitest';
import {WORLD_DEFINITION} from '../src/world/worldDefinition';
import {interiorDefinitionForBuilding} from '../src/world/interiorDefinitions';
import {assignInteriorOccupants,type InteriorAgentSnapshot} from '../src/rendering/interiorAssignment';
import {interiorMotionAt} from '../src/rendering/interiorMotion';
it('keeps twelve occupants within a 16 ms CPU simulation budget after warm-up',()=>{
 const room=interiorDefinitionForBuilding(WORLD_DEFINITION.buildings.find(b=>b.id==='archive-library')!);
 const snapshots:InteriorAgentSnapshot[]=Array.from({length:12},(_,i)=>({agentId:`perf-${i}`,role:'main',buildingId:'archive-library',action:'read',eventKind:'read',eventId:`event-${i}`,interiorElapsedMs:12000}));
 const frame=(time:number)=>{const assignments=assignInteriorOccupants(room,snapshots,'archive-library');assignments.forEach((a,i)=>interiorMotionAt({...snapshots[i]!,interiorElapsedMs:time},room,a,time));};
 frame(12000);const start=performance.now();for(let i=0;i<10;i++)frame(12016+i*16);const ms=(performance.now()-start)/10;
 console.info(`12 occupants CPU frame: ${ms.toFixed(2)} ms`);expect(ms).toBeLessThan(16);
});

import { describe,it,expect } from 'vitest';
import { workstationDefinitions,workstationYaw,workstationSeats,hookLines } from '../src/three/workstations';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { interiorDefinitionForBuilding } from '../src/world/interiorDefinitions';
import { interiorMotionAt } from '../src/rendering/interiorMotion';
import { assignInteriorOccupants } from '../src/rendering/interiorAssignment';
import { character,animateCharacter } from '../src/three/models';

describe('functional workstations and human rig',()=>{
  it('binds every authored monitor to an existing desk, never a nearby unrelated Agent',()=>{
    let count=0;
    for(const b of WORLD_DEFINITION.buildings){const room=interiorDefinitionForBuilding(b);
      for(const {screen,stationIds} of workstationDefinitions(room)){
        count++;expect(stationIds.length).toBeGreaterThan(0);
        for(const id of stationIds){const desk=room.furniture.find(f=>f.id===id)!;if(screen.kind==='display')expect(desk.kind).toBe('desk');else expect(desk.id).toBe(screen.id);expect(desk.point).toEqual(screen.point);}
        expect(Number.isFinite(workstationYaw(screen))).toBe(true);
      }
    }expect(count).toBeGreaterThan(25);
  });
  it('publishes the actual stop ID and does not mark an Agent walking between desks as their occupant',()=>{
    const room=interiorDefinitionForBuilding(WORLD_DEFINITION.buildings.find(b=>b.id==='archive-library')!);
    const snapshot={agentId:'test',role:'main' as const,buildingId:'archive-library',action:'read' as const,eventKind:'read' as const,eventId:'r'};
    const assignment=assignInteriorOccupants(room,[snapshot],'archive-library')[0]!;
    const stops=new Set<string>();let walking=0;
    for(let time=0;time<40000;time+=1000){const motion=interiorMotionAt({...snapshot,interiorElapsedMs:time},room,assignment,time);
      if(motion.walking){walking++;expect(motion.furnitureId).toBeUndefined();}
      else if(motion.furnitureId){stops.add(motion.furnitureId);expect(room.furniture.some(f=>f.id===motion.furnitureId)).toBe(true);}
    }expect(stops.size).toBeGreaterThan(1);expect(walking).toBeGreaterThan(0);
  });
  it('aligns grouped chairs to real work anchors and returns the rig to a standing pose',()=>{
    const room=interiorDefinitionForBuilding(WORLD_DEFINITION.buildings.find(b=>b.id==='archive-library')!);
    const seats=workstationSeats(room);expect(seats.size).toBeGreaterThan(1);
    for(const [id,seat] of seats){expect(seat.point).toEqual(room.furniture.find(f=>f.id===id)!.interactionPoint);expect(room.furniture.some(f=>f.id===seat.chairId)).toBe(true);}
    const actor=character(0x998866);animateCharacter(actor,1,false,true,true);expect(actor.userData.body.position.y).toBeLessThan(-.2);expect(actor.userData.knees[0].rotation.x).toBeGreaterThan(1);
    animateCharacter(actor,1,true,false);expect(actor.userData.body.position.y).toBeGreaterThanOrEqual(0);
  });
  it('reads only public hook fields and bounds output without inventing missing content',()=>{
    expect(hookLines()).toEqual([]);
    expect(hookLines({agent:'a',task:'Read docs',recent_actions:[{message:'<script>untrusted</script>',tool_name:'read_file',private_reasoning:'hidden',output:'x'.repeat(5000)}]})).toEqual(['Read docs','read_file','<script>untrusted</script>','x'.repeat(4000)]);
  });
  it('keeps limbs attached to anatomical joints and differentiates deterministic identities',()=>{
    const a=character(0x998866,'alice'),b=character(0x998866,'bob');
    expect(a.userData.knees[0].parent).toBe(a.userData.legs[0]);expect(a.userData.elbows[0].parent).toBe(a.userData.arms[0]);
    const pivot=a.userData.arms[0].position.clone();animateCharacter(a,1,true,false);expect(a.userData.arms[0].position.equals(pivot)).toBe(true);
    animateCharacter(a,1,false,true);expect(a.userData.elbows[0].rotation.x).toBeLessThan(-.9);
    expect(a.userData.phase).not.toBe(b.userData.phase);
  });
});

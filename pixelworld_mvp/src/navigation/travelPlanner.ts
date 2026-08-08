import type { AgentPresence, AgentTravelPlan } from '../agents/agentPresence';
import type { StationAssignment } from '../stations/stationAllocator';
import type { GridPoint, WorldDefinition } from '../world/types';

const copyPoint = (point: GridPoint): GridPoint => ({ x: point.x, y: point.y });

export function planAgentTravel(
  world: WorldDefinition,
  presence: AgentPresence,
  assignment: StationAssignment,
): AgentTravelPlan {
  const station = world.stations.find((item) => item.id === assignment.stationId);
  const destination = station?.buildingId
    ? world.buildings.find((building) => building.id === station.buildingId)
    : undefined;
  const source = presence.kind === 'inside'
    ? world.buildings.find((building) => building.id === presence.buildingId)
    : undefined;

  if (destination && presence.kind === 'inside' && presence.buildingId === destination.id) {
    return {
      waypoints: [],
      destinationBuilding: {
        buildingId: destination.id,
        threshold: copyPoint(destination.entrance.threshold),
      },
      stayInside: true,
    };
  }

  const waypoints: GridPoint[] = [];
  if (source) waypoints.push(copyPoint(source.entrance.outside));
  if (destination) {
    waypoints.push(copyPoint(destination.entrance.outside), copyPoint(destination.entrance.threshold));
    return {
      waypoints,
      destinationBuilding: {
        buildingId: destination.id,
        threshold: copyPoint(destination.entrance.threshold),
      },
      stayInside: false,
    };
  }

  waypoints.push(copyPoint(assignment.point));
  return { waypoints, stayInside: false };
}

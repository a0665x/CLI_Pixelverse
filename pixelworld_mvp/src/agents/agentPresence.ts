import type { GridPoint } from '../world/types';

export type AgentPresence =
  | { kind: 'outside' }
  | { kind: 'inside'; buildingId: string; threshold: GridPoint };

export interface AgentTravelPlan {
  waypoints: GridPoint[];
  destinationBuilding?: { buildingId: string; threshold: GridPoint };
  stayInside: boolean;
}

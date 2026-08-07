import type { AgentAction, Facing, GridPoint, StationDefinition } from '../world/types';

export interface StationAssignment {
  agentId: string;
  stationId: string;
  anchorId: string;
  point: GridPoint;
  facing: Facing;
  action: AgentAction;
  kind: 'interaction' | 'queue';
}
export type StationAssignmentResult =
  | { ok: true; assignment: StationAssignment }
  | { ok: false; reason: 'unknown-station' | 'station-full' };

const pointKey = (point: GridPoint) => `${point.x},${point.y}`;

export class StationAllocator {
  private readonly stations = new Map<string, StationDefinition>();
  private readonly byAgent = new Map<string, StationAssignment>();

  constructor(stations: StationDefinition[]) {
    stations.forEach((station) => this.stations.set(station.id, station));
  }

  assign(
    agentId: string,
    stationId: string,
    excludedAnchorIds: ReadonlySet<string> = new Set(),
  ): StationAssignmentResult {
    const station = this.stations.get(stationId);
    if (!station) return { ok: false, reason: 'unknown-station' };
    const { anchorIds, pointKeys } = this.occupiedByOtherAgents(agentId);
    const slot = station.interactionSlots.find((item) => {
      const anchorId = `${stationId}:${item.id}`;
      return !anchorIds.has(anchorId) && !pointKeys.has(pointKey(item.point)) && !excludedAnchorIds.has(anchorId);
    });
    if (slot) {
      const assignment: StationAssignment = {
        agentId, stationId, anchorId: `${stationId}:${slot.id}`, point: slot.point,
        facing: slot.facing, action: slot.action, kind: 'interaction',
      };
      this.byAgent.set(agentId, assignment);
      return { ok: true, assignment };
    }
    const queueIndex = station.queueAnchors.findIndex((_, index) => {
      const anchorId = `${stationId}:queue-${index}`;
      const point = station.queueAnchors[index]!;
      return !anchorIds.has(anchorId) && !pointKeys.has(pointKey(point)) && !excludedAnchorIds.has(anchorId);
    });
    if (queueIndex < 0) return { ok: false, reason: 'station-full' };
    const point = station.queueAnchors[queueIndex]!;
    const assignment: StationAssignment = {
      agentId, stationId, anchorId: `${stationId}:queue-${queueIndex}`, point,
      facing: 'right', action: 'queue', kind: 'queue',
    };
    this.byAgent.set(agentId, assignment);
    return { ok: true, assignment };
  }

  releaseAgent(agentId: string): void { this.byAgent.delete(agentId); }
  assignmentFor(agentId: string): StationAssignment | undefined { return this.byAgent.get(agentId); }
  restore(assignment: StationAssignment): boolean {
    const { anchorIds, pointKeys } = this.occupiedByOtherAgents(assignment.agentId);
    if (anchorIds.has(assignment.anchorId) || pointKeys.has(pointKey(assignment.point))) return false;
    this.byAgent.set(assignment.agentId, assignment);
    return true;
  }
  assignments(): readonly StationAssignment[] { return [...this.byAgent.values()]; }

  private occupiedByOtherAgents(agentId: string): { anchorIds: Set<string>; pointKeys: Set<string> } {
    const assignments = [...this.byAgent.values()].filter((item) => item.agentId !== agentId);
    return {
      anchorIds: new Set(assignments.map((item) => item.anchorId)),
      pointKeys: new Set(assignments.map((item) => pointKey(item.point))),
    };
  }
}

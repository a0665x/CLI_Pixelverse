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
    this.releaseAgent(agentId);
    const occupied = new Set([...this.byAgent.values()].map((item) => item.anchorId));
    const slot = station.interactionSlots.find((item) => {
      const anchorId = `${stationId}:${item.id}`;
      return !occupied.has(anchorId) && !excludedAnchorIds.has(anchorId);
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
      return !occupied.has(anchorId) && !excludedAnchorIds.has(anchorId);
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
  restore(assignment: StationAssignment): void { this.byAgent.set(assignment.agentId, assignment); }
  assignments(): readonly StationAssignment[] { return [...this.byAgent.values()]; }
}

import type {
  ActivityIconKind,
  AgentAction,
  Facing,
  FurnitureSemantic,
  GridPoint,
  InteriorDefinition,
  WorldEventKind,
} from '../world/types';
import {
  nearestSemanticStation,
  semanticForAction,
  semanticForFurniture,
} from './interiorFurnitureSemantics';

export interface InteriorAgentSnapshot {
  agentId: string;
  role: 'main' | 'subagent';
  buildingId: string | undefined;
  action: AgentAction;
  eventKind: WorldEventKind;
  eventId: string;
  activityLabel?: string;
  bubbleText?: string;
  interiorElapsedMs?: number;
}

export interface InteriorOccupantAssignment extends InteriorAgentSnapshot {
  point: GridPoint;
  facing: Facing;
  furnitureId?: string;
  icon: ActivityIconKind;
  seated: boolean;
  missingSemantic?: FurnitureSemantic;
}

const pointKey = ({ x, y }: GridPoint): string => `${Math.round(x)},${Math.round(y)}`;
export function assignInteriorOccupants(
  interior: InteriorDefinition,
  snapshots: readonly InteriorAgentSnapshot[],
  buildingId: string = interior.id,
): InteriorOccupantAssignment[] {
  const used = new Set<string>();
  const usedFurniture = new Set<string>();
  const entrance = { x: Math.floor(interior.width / 2), y: interior.height - 1 };
  return snapshots
    .filter((snapshot) => snapshot.buildingId === buildingId)
    .sort((first, second) => first.agentId.localeCompare(second.agentId))
    .map((snapshot) => {
      const matched = nearestSemanticStation(interior, snapshot.action, entrance, used, usedFurniture);
      if (matched) {
        const furniture = interior.furniture.find(({ id }) => id === matched.furnitureId)!;
        const { point } = matched;
        used.add(pointKey(point));
        usedFurniture.add(furniture.id);
        return {
          ...snapshot,
          point: { ...point },
          facing: furniture.facing,
          furnitureId: furniture.id,
          icon: furniture.icon,
          seated: semanticForFurniture(furniture) === 'rest',
        };
      }
      const hasReachableCategory = nearestSemanticStation(interior, snapshot.action, entrance) !== undefined;
      return {
        ...snapshot,
        point: { ...entrance },
        facing: 'down' as const,
        icon: 'generic' as const,
        seated: false,
        ...(!hasReachableCategory ? { missingSemantic: semanticForAction(snapshot.action) } : {}),
      };
    });
}

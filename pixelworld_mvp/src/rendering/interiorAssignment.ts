import type {
  ActivityIconKind,
  AgentAction,
  Facing,
  GridPoint,
  InteriorDefinition,
  WorldEventKind,
} from '../world/types';

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
}

const pointKey = ({ x, y }: GridPoint): string => `${x},${y}`;
const stableHash = (value: string): number => [...value].reduce(
  (hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0,
  2166136261,
);
const isSeatedFurniture = (kind: string): boolean => [
  'sofa', 'bed', 'computer', 'reading-desk', 'response-desk', 'radio-console', 'dispatch-pod',
].includes(kind);

function fallbackPoints(interior: InteriorDefinition): GridPoint[] {
  const points: GridPoint[] = [];
  for (let y = interior.height - 2; y >= 2; y -= 1) {
    for (let x = 2; x < interior.width - 1; x += 1) points.push({ x, y });
  }
  return [...interior.overflow, ...points];
}

export function assignInteriorOccupants(
  interior: InteriorDefinition,
  snapshots: readonly InteriorAgentSnapshot[],
  buildingId: string = interior.id,
): InteriorOccupantAssignment[] {
  const used = new Set<string>();
  const overflow = fallbackPoints(interior);
  return snapshots
    .filter((snapshot) => snapshot.buildingId === buildingId)
    .sort((first, second) => first.agentId.localeCompare(second.agentId))
    .map((snapshot) => {
      const compatible = interior.furniture
        .filter(({ supportedActions }) => supportedActions.includes(snapshot.action))
        .sort((first, second) => first.id.localeCompare(second.id));
      const offset = compatible.length > 0 ? stableHash(`${snapshot.agentId}:${snapshot.eventId}`) % compatible.length : 0;
      const ordered = compatible.map((_, index) => compatible[(index + offset) % compatible.length]!);
      const furniture = ordered.find(({ point }) => !used.has(pointKey(point)));
      if (furniture) {
        used.add(pointKey(furniture.point));
        return {
          ...snapshot,
          point: { ...furniture.point },
          facing: furniture.facing,
          furnitureId: furniture.id,
          icon: furniture.icon,
          seated: isSeatedFurniture(furniture.kind),
        };
      }
      const point = overflow.find((candidate) => !used.has(pointKey(candidate))) ?? { x: 1, y: 1 };
      used.add(pointKey(point));
      return {
        ...snapshot,
        point: { ...point },
        facing: 'down' as const,
        icon: 'generic' as const,
        seated: false,
      };
    });
}

import type { AgentAction, FurnitureDefinition, InteriorDefinition } from '../world/types';
import { canonicalFurnitureBounds } from './canonicalFurnitureGeometry';

export interface NavigationClearance {
  x: number;
  y: number;
}

export const AGENT_FEET_CLEARANCE: Readonly<NavigationClearance> = Object.freeze({
  x: 0.22,
  y: 0.12,
});

const SEATING_KINDS = new Set<FurnitureDefinition['kind']>([
  'chair',
  'office-chair',
  'sofa',
]);
const SEATING_ACTIONS = new Set<AgentAction>(['arrive', 'queue', 'rest']);

export function navigationBlockerKind(
  item: Pick<FurnitureDefinition, 'kind' | 'layer' | 'supportedByIds'>,
): 'passable' | 'solid' {
  return item.layer === 'floor'
    || Boolean(item.supportedByIds?.length)
    ? 'passable'
    : 'solid';
}

export function interactionAccess(
  item: Pick<FurnitureDefinition, 'kind' | 'supportedActions'>,
  action: AgentAction,
): 'none' | 'seat' | 'sleep' | 'station' {
  if (item.kind === 'bed') return action === 'offline' ? 'sleep' : 'none';
  if (SEATING_KINDS.has(item.kind)) return SEATING_ACTIONS.has(action) ? 'seat' : 'none';
  return item.supportedActions.includes(action) ? 'station' : 'none';
}

export function interiorNavigationSignature(interior: InteriorDefinition): string {
  const furniture = [...interior.furniture]
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((item) => ({
      id: item.id,
      kind: item.kind,
      blocker: navigationBlockerKind(item),
      bounds: canonicalFurnitureBounds(item),
      point: item.point,
      rotation: item.rotation ?? 0,
      scale: item.scale ?? 1,
      interactionPoint: item.interactionPoint ?? null,
      access: [...item.supportedActions].sort().map((action) => [action, interactionAccess(item, action)]),
      supportedByIds: [...(item.supportedByIds ?? [])].sort(),
    }));
  return JSON.stringify({ width: interior.width, height: interior.height, furniture });
}

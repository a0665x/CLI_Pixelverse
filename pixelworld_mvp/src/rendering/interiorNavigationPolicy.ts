import type { AgentAction, FurnitureDefinition } from '../world/types';

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

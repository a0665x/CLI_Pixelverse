export const WORLD_EVENT_KINDS = [
  'session_start', 'think', 'plan', 'read', 'edit', 'tool', 'web', 'clone',
  'respond', 'await', 'blocked', 'self_heal', 'idle', 'offline', 'heartbeat', 'unknown',
] as const;
export type WorldEventKind = (typeof WORLD_EVENT_KINDS)[number];

export type AgentAction =
  | 'arrive' | 'ponder' | 'plan' | 'read' | 'type' | 'terminal' | 'signal'
  | 'dispatch' | 'respond' | 'queue' | 'repair' | 'rest' | 'offline' | 'pulse';

export type Facing = 'left' | 'right' | 'up' | 'down';

export interface GridPoint {
  x: number;
  y: number;
}

export interface AgentWorldEvent {
  eventId: string;
  timestamp: number;
  source: 'demo' | 'hook';
  agentId: string;
  agentRole: 'main' | 'subagent';
  kind: WorldEventKind;
  phase: string;
  activityLabel: string;
  detail?: string;
  toolName?: string;
}

export interface BehaviorRoute {
  destinationId?: string;
  preserveLocation: boolean;
  action: AgentAction;
  bubblePolicy: 'none' | 'transient' | 'persistent';
  bubbleText: string;
  priority: number;
}

export interface GridRect { x: number; y: number; width: number; height: number }
export type TerrainKind = 'road' | 'plaza' | 'grass';
export interface TerrainArea { kind: TerrainKind; bounds: GridRect; cost: number }
export interface BuildingEntrance {
  outside: GridPoint;
  threshold: GridPoint;
  entryFacing: 'up';
  exitFacing: 'down';
}
export interface WorldTree { id: string; trunk: GridPoint }
export interface WorldScenery {
  trees: WorldTree[];
  pond: GridRect;
  flowerBeds: GridRect[];
}
export interface WorldBuilding {
  id: string;
  label: string;
  bounds: GridRect;
  labelAnchor: GridPoint;
  entrance: BuildingEntrance;
}
export interface WorldZone { id: string; label: string; bounds: GridRect }
export interface InteractionSlot {
  id: string;
  point: GridPoint;
  facing: Facing;
  action: AgentAction;
}
export interface StationDefinition {
  id: string;
  zoneId: string;
  buildingId?: string;
  approachAnchors: GridPoint[];
  interactionSlots: InteractionSlot[];
  queueAnchors: GridPoint[];
  interiorSceneId?: string;
}
export interface WorldDefinition {
  width: number;
  height: number;
  spawn: GridPoint;
  buildings: WorldBuilding[];
  zones: WorldZone[];
  scenery: WorldScenery;
  terrain: TerrainArea[];
  obstacleRects: GridRect[];
  walkableOverrides: GridPoint[];
  stations: StationDefinition[];
}

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
export type WorldDecorationKind = 'campfire' | 'bench' | 'signboard' | 'crate' | 'rock' | 'flowers';
export interface WorldDecoration { id: string; kind: WorldDecorationKind; point: GridPoint }
export type BuildingThemeId = 'rest-cabin' | 'research-library' | 'maker-workshop' | 'collaboration-barn';
export type FurnitureKind =
  | 'sofa' | 'chair' | 'television' | 'bed' | 'bookcase' | 'computer' | 'map-table'
  | 'planning-board' | 'reading-desk' | 'workbench' | 'tool-wall' | 'repair-table'
  | 'dispatch-pod' | 'radio-console' | 'response-desk' | 'meeting-table' | 'decor'
  | 'office-chair' | 'display' | 'desk' | 'cabinet' | 'plant' | 'beverage-station' | 'printer';
export type FurnitureScale = 0.75 | 1 | 1.25 | 1.5;
export type FurnitureRotation = 0 | 90 | 180 | 270;
export interface FurnitureFootprint { width: number; height: number }
export type ActivityIconKind =
  | 'rest' | 'offline' | 'think' | 'plan' | 'read' | 'web' | 'edit'
  | 'tool' | 'repair' | 'clone' | 'respond' | 'generic';
export interface FurnitureDefinition {
  id: string;
  kind: FurnitureKind;
  point: GridPoint;
  facing: Facing;
  supportedActions: AgentAction[];
  icon: ActivityIconKind;
  scale?: FurnitureScale;
  rotation?: FurnitureRotation;
  assetId?: number;
  footprint?: FurnitureFootprint;
}
export interface InteriorDefinition {
  id: BuildingThemeId;
  label: string;
  width: number;
  height: number;
  floor: 'wood' | 'tile';
  wall: 'cream' | 'blue' | 'brick' | 'green';
  furniture: FurnitureDefinition[];
  overflow: GridPoint[];
}
export interface AmbientAnimalDefinition {
  id: string;
  species: 'cow' | 'sheep' | 'chicken' | 'pig';
  patrolBounds: GridRect;
  start: GridPoint;
  speed: number;
}
export interface WorldScenery {
  trees: WorldTree[];
  decorations: WorldDecoration[];
  river: GridRect[];
  bridges: GridRect[];
  pastures: GridRect[];
  cropFields: GridRect[];
  flowerBeds: GridRect[];
  animals: AmbientAnimalDefinition[];
}
export interface WorldBuilding {
  id: string;
  label: string;
  themeId: BuildingThemeId;
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

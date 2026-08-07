export type WorldEventKind =
  | 'session_start' | 'think' | 'plan' | 'read' | 'edit' | 'tool' | 'web'
  | 'clone' | 'respond' | 'await' | 'blocked' | 'self_heal' | 'idle'
  | 'offline' | 'heartbeat' | 'unknown';

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

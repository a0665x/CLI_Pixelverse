import type { AgentWorldEvent, WorldEventKind } from '../world/types';

export interface BackendAgentSnapshot {
  agent: string;
  name?: string;
  project_path?: string;
  project_name?: string;
  parent_agent_id?: string;
  role?: 'main_agent' | 'subagent' | 'branch_session' | string;
  state?: string;
  pixel_state?: string;
  task?: string | null;
  room_key?: string;
  last_seen_ms?: number;
  activity_hint?: string;
  status_label?: string;
  tool_label?: string;
  recent_actions?: Array<Record<string, unknown>>;
}

export interface BackendWorldSnapshot {
  agents: BackendAgentSnapshot[];
  events?: Array<Record<string, unknown>>;
  server_time_ms?: number;
  stats?: Record<string, unknown>;
}

const normalized = (value: unknown): string => String(value ?? '').trim().toLowerCase().replaceAll('-', '_');

const PIXEL_EVENT_KINDS: Record<string, WorldEventKind> = {
  initializing: 'session_start',
  thinking: 'think',
  planning: 'plan',
  reading_files: 'read',
  editing_files: 'edit',
  shell_command: 'tool',
  tool_call: 'tool',
  executing: 'tool',
  coding: 'edit',
  invoking_skill: 'tool',
  browsing: 'web',
  external_tool: 'web',
  collaborating: 'clone',
  responding: 'respond',
  awaiting_input: 'await',
  blocked: 'blocked',
  failed: 'blocked',
  error: 'blocked',
  self_healing: 'self_heal',
  recovering: 'self_heal',
  sleeping: 'offline',
  offline: 'offline',
  idle: 'idle',
  completed: 'idle',
  done: 'idle',
  heartbeat: 'heartbeat',
};

const ROOM_EVENT_KINDS: Record<string, WorldEventKind> = {
  think_lab: 'think',
  blueprint_lab: 'plan',
  file_library: 'read',
  code_workbench: 'edit',
  terminal_bay: 'tool',
  tool_forge: 'web',
  response_studio: 'respond',
  clone_bay: 'clone',
  session_archive: 'read',
  offline_corner: 'blocked',
  standby_dock: 'idle',
};

const COMMAND_ROOM_TO_BUILDING: Record<string, string> = {
  think_lab: 'thinkers-cottage',
  blueprint_lab: 'thinkers-cottage',
  file_library: 'archive-library',
  code_workbench: 'maker-workshop',
  terminal_bay: 'tool-smithy',
  tool_forge: 'network-lab',
  response_studio: 'collaboration-barn',
  clone_bay: 'collaboration-barn',
  session_archive: 'archive-library',
  offline_corner: 'offline-dormitory',
  standby_dock: 'rest-cabin',
};

const BUILDING_TO_COMMAND_ROOM: Record<string, string> = {
  'thinkers-cottage': 'think_lab',
  'archive-library': 'file_library',
  'network-lab': 'tool_forge',
  'offline-dormitory': 'offline_corner',
  'maker-workshop': 'code_workbench',
  'tool-smithy': 'terminal_bay',
  'awaiting-post': 'standby_dock',
  'collaboration-barn': 'clone_bay',
  'recovery-clinic': 'offline_corner',
  'rest-cabin': 'standby_dock',
};

export function buildingIdForCommandRoom(value: unknown): string {
  const id = normalized(value);
  return COMMAND_ROOM_TO_BUILDING[id] || String(value ?? '');
}

export function commandRoomForBuilding(value: unknown): string {
  const id = String(value ?? '');
  return BUILDING_TO_COMMAND_ROOM[id] || id;
}

const DEFAULT_ACTIVITY: Record<WorldEventKind, string> = {
  session_start: '初始化工作階段', think: '整理推理', plan: '規劃步驟', read: '讀取資料',
  edit: '編輯代碼', tool: '使用工具', web: '查詢外部資料', clone: '協作與分身', respond: '整理回覆',
  await: '等待輸入', blocked: '處理阻塞', self_heal: '修復問題', idle: '待命', offline: '離線',
  heartbeat: '同步心跳', unknown: '更新狀態',
};

export function backendAgentRole(agent: BackendAgentSnapshot): 'main' | 'subagent' {
  return agent.role === 'main_agent' ? 'main' : 'subagent';
}

export function backendAgentSignature(agent: BackendAgentSnapshot): string {
  const latestAction = agent.recent_actions?.[0];
  return JSON.stringify([
    agent.agent,
    agent.role,
    normalized(agent.state),
    normalized(agent.pixel_state),
    agent.task?.trim() ?? '',
    normalized(agent.room_key),
    agent.activity_hint?.trim() ?? '',
    agent.status_label?.trim() ?? '',
    agent.tool_label?.trim() ?? '',
    latestAction?.id ?? latestAction?.timestamp ?? latestAction?.message ?? '',
  ]);
}

export function worldEventKindForBackendAgent(agent: BackendAgentSnapshot): WorldEventKind {
  const state = normalized(agent.state);
  if (state === 'heartbeat') return 'heartbeat';
  const pixelState = normalized(agent.pixel_state);
  const room = normalized(agent.room_key);
  // Generic CLI heartbeats can carry an idle pixel fallback while the process is working.
  if (state === 'working' && (!pixelState || pixelState === 'idle') && ROOM_EVENT_KINDS[room]) return ROOM_EVENT_KINDS[room]!;
  if (PIXEL_EVENT_KINDS[pixelState]) return PIXEL_EVENT_KINDS[pixelState]!;
  if (state === 'working' && ROOM_EVENT_KINDS[room]) return ROOM_EVENT_KINDS[room]!;
  return PIXEL_EVENT_KINDS[state] ?? ROOM_EVENT_KINDS[room] ?? 'unknown';
}

export function worldEventForBackendAgent(agent: BackendAgentSnapshot, sequence: number): AgentWorldEvent {
  const kind = worldEventKindForBackendAgent(agent);
  const phase = normalized(agent.pixel_state) || normalized(agent.state) || 'unknown';
  const task = agent.task?.trim();
  const event: AgentWorldEvent = {
    eventId: `live:${sequence}:${agent.agent}:${phase}`,
    timestamp: Number(agent.last_seen_ms) || Date.now(),
    source: 'hook',
    agentId: agent.agent,
    agentRole: backendAgentRole(agent),
    kind,
    phase,
    activityLabel: task || agent.status_label?.trim() || DEFAULT_ACTIVITY[kind],
  };
  if (agent.activity_hint?.trim()) event.detail = agent.activity_hint.trim();
  if (agent.tool_label?.trim()) event.toolName = agent.tool_label.trim();
  return event;
}

export function isBackendWorldSnapshot(value: unknown): value is BackendWorldSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<BackendWorldSnapshot>;
  return Array.isArray(snapshot.agents)
    && snapshot.agents.every((agent) => Boolean(agent && typeof agent.agent === 'string' && agent.agent.trim()));
}

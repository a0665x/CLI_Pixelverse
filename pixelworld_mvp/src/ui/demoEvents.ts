import type { AgentWorldEvent, WorldEventKind } from '../world/types';

export interface AgentOption { id: string; role: 'main' | 'subagent' }
const COPY: Record<WorldEventKind, { phase: string; label: string }> = {
  session_start: { phase: 'initializing', label: '初始化' },
  think: { phase: 'thinking', label: '思考中' },
  plan: { phase: 'planning', label: '規劃工作' },
  read: { phase: 'reading_files', label: '查閱檔案' },
  edit: { phase: 'working', label: '修改程式' },
  tool: { phase: 'tool_using', label: '使用工具' },
  web: { phase: 'external_tool', label: '連接服務' },
  clone: { phase: 'collaborating', label: '建立 Subagent' },
  respond: { phase: 'responding', label: '輸出結果' },
  await: { phase: 'awaiting_input', label: '等待輸入' },
  blocked: { phase: 'blocked', label: '工作受阻' },
  self_heal: { phase: 'self_healing', label: '自我修復' },
  idle: { phase: 'idle', label: '休息' },
  offline: { phase: 'offline', label: '離線' },
  heartbeat: { phase: 'preserve_phase', label: '仍在工作' },
  unknown: { phase: 'unknown', label: '未知狀態' },
};

export function createDemoEvent(
  kind: WorldEventKind,
  agent: AgentOption,
  sequence: number,
  timestamp = Date.now(),
): AgentWorldEvent {
  const copy = COPY[kind];
  return {
    eventId: `demo-${sequence}-${kind}-${agent.id}`,
    timestamp,
    source: 'demo',
    agentId: agent.id,
    agentRole: agent.role,
    kind,
    phase: copy.phase,
    activityLabel: copy.label,
  };
}

import { describe, expect, it } from 'vitest';
import {
  backendAgentRole,
  backendAgentSignature,
  worldEventForBackendAgent,
  worldEventKindForBackendAgent,
  type BackendAgentSnapshot,
} from '../src/live/backendSnapshot';

const agent = (overrides: Partial<BackendAgentSnapshot> = {}): BackendAgentSnapshot => ({
  agent: 'codex-main',
  role: 'main_agent',
  state: 'idle',
  pixel_state: 'idle',
  task: null,
  room_key: 'standby_dock',
  last_seen_ms: 1_786_430_000_000,
  ...overrides,
});

describe('backend snapshot event adapter', () => {
  it.each([
    ['initializing', '', '', 'session_start'],
    ['thinking', '', '', 'think'],
    ['planning', '', '', 'plan'],
    ['working', 'reading_files', '', 'read'],
    ['working', 'editing_files', '', 'edit'],
    ['working', 'shell_command', '', 'tool'],
    ['working', 'tool_call', '', 'tool'],
    ['working', 'browsing', '', 'web'],
    ['working', 'external_tool', '', 'web'],
    ['working', 'collaborating', '', 'clone'],
    ['working', 'responding', '', 'respond'],
    ['working', 'working', 'response_studio', 'respond'],
    ['working', 'working', 'clone_bay', 'clone'],
    ['awaiting_input', '', '', 'await'],
    ['blocked', '', '', 'blocked'],
    ['self_healing', '', '', 'self_heal'],
    ['offline', '', '', 'offline'],
    ['sleeping', '', '', 'offline'],
    ['idle', '', '', 'idle'],
    ['heartbeat', '', '', 'heartbeat'],
  ] as const)('maps state=%s pixel=%s room=%s to %s', (state, pixelState, roomKey, expected) => {
    expect(worldEventKindForBackendAgent(agent({
      state,
      pixel_state: pixelState || state,
      room_key: roomKey || 'standby_dock',
    }))).toBe(expected);
  });

  it('builds a stable hook event using backend identity and visible task text', () => {
    const event = worldEventForBackendAgent(agent({
      agent: 'reviewer-2',
      role: 'subagent',
      state: 'working',
      pixel_state: 'external_tool',
      task: 'codegraph_explore',
      activity_hint: '正在網路屋查詢呼叫關係',
      tool_label: 'CodeGraph',
    }), 42);

    expect(event).toEqual({
      eventId: 'live:42:reviewer-2:external_tool',
      timestamp: 1_786_430_000_000,
      source: 'hook',
      agentId: 'reviewer-2',
      agentRole: 'subagent',
      kind: 'web',
      phase: 'external_tool',
      activityLabel: 'codegraph_explore',
      detail: '正在網路屋查詢呼叫關係',
      toolName: 'CodeGraph',
    });
  });

  it('treats branch sessions as visible subagents', () => {
    expect(backendAgentRole(agent({ role: 'main_agent' }))).toBe('main');
    expect(backendAgentRole(agent({ role: 'subagent' }))).toBe('subagent');
    expect(backendAgentRole(agent({ role: 'branch_session' }))).toBe('subagent');
  });

  it('deduplicates heartbeat-only snapshot churn but notices meaningful work changes', () => {
    const first = agent({ last_seen_ms: 100, task: '讀檔案' });
    expect(backendAgentSignature({ ...first, last_seen_ms: 200 })).toBe(backendAgentSignature(first));
    expect(backendAgentSignature({ ...first, task: '寫檔案' })).not.toBe(backendAgentSignature(first));
  });
});

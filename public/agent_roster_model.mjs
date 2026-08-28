const ATTENTION_STATES = new Set(['blocked', 'awaiting_input']);
const BUSY_PIXEL_STATES = new Set([
  'executing', 'tool_call', 'external_tool', 'self_healing', 'editing_files', 'shell_command',
]);
const THINKING_PIXEL_STATES = new Set(['thinking', 'planning', 'reading_files', 'browsing']);

const normalized = (value) => String(value ?? '').trim().toLowerCase();
const identity = (agent = {}) => String(agent.id || agent.agent || '');
const displayName = (agent = {}) => String(
  agent.name || agent.full_name || agent.agent || agent.id || 'Agent',
);

const lastSeenMs = (agent, nowMs) => {
  const value = agent.lastSeenMs ?? agent.last_seen_ms ?? agent.freshness?.lastSeenMs;
  if (value === undefined || value === null || value === '') return nowMs;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : nowMs;
};

export function resolveAgentSignal(agent = {}, nowMs = Date.now()) {
  const state = normalized(agent.state);
  const pixelState = normalized(agent.pixelState || agent.pixel_state);
  const freshnessMs = Math.max(0, Number(nowMs) - lastSeenMs(agent, Number(nowMs)));
  const needsAttention = Boolean(
    agent.needsAttention || agent.needs_attention || agent.requires_approval,
  ) || ATTENTION_STATES.has(state) || ATTENTION_STATES.has(pixelState);

  if (state === 'offline' || agent.lifecycle === 'offline' || agent.is_stale || agent.freshness?.isStale) {
    return {
      kind: 'offline', tone: 'offline', load: 0, rate: 0, amplitude: 0,
      freshnessMs, needsAttention: false,
    };
  }
  if (agent.connection_status === 'degraded' || agent.connection_status === 'reconnecting') {
    return {
      kind: 'degraded', tone: 'degraded', load: .28, rate: .55, amplitude: .45,
      freshnessMs, needsAttention: false,
    };
  }
  if (needsAttention) {
    return {
      kind: 'blocked', tone: 'blocked', load: .42, rate: .68, amplitude: .72,
      freshnessMs, needsAttention: true,
    };
  }
  if (BUSY_PIXEL_STATES.has(pixelState)) {
    return {
      kind: 'busy', tone: 'work', load: 1, rate: 1, amplitude: 1,
      freshnessMs, needsAttention: false,
    };
  }
  if (state === 'working' || ['working', 'responding', 'collaborating', 'invoking_skill'].includes(pixelState)) {
    return {
      kind: 'working', tone: 'work', load: .78, rate: .78, amplitude: .82,
      freshnessMs, needsAttention: false,
    };
  }
  if (['thinking', 'planning'].includes(state) || THINKING_PIXEL_STATES.has(pixelState)) {
    return {
      kind: 'thinking', tone: 'search', load: .62, rate: .62, amplitude: .68,
      freshnessMs, needsAttention: false,
    };
  }
  return {
    kind: 'idle', tone: 'rest', load: .18, rate: .18, amplitude: .18,
    freshnessMs, needsAttention: false,
  };
}

const groupRank = (row) => {
  if (row.role === 'main_agent') return 0;
  if (row.needsAttention) return 1;
  if (['busy', 'working', 'thinking', 'degraded'].includes(row.signal.kind)) return 2;
  return row.signal.kind === 'idle' ? 3 : 4;
};

export function compareAgentRosterEntries(first, second) {
  return groupRank(first) - groupRank(second) || first.id.localeCompare(second.id);
}

export function buildAgentRoster(model = {}, { nowMs = Date.now() } = {}) {
  return (model.agents || []).map((agent) => {
    const signal = resolveAgentSignal(agent, nowMs);
    const id = identity(agent);
    const role = agent.role || 'main_agent';
    return {
      id,
      role,
      name: displayName(agent),
      state: agent.state || 'idle',
      pixelState: agent.pixelState || agent.pixel_state || agent.state || 'idle',
      roomKey: agent.buildingId || agent.targetRoom || agent.room_key || '',
      task: String(agent.task || ''),
      externalTask: String(agent.task || ''),
      needsAttention: signal.needsAttention,
      attentionReason: signal.needsAttention
        ? String(agent.waiting_on || agent.blocked_reason || agent.task || '')
        : '',
      urgency: groupRank({ role, needsAttention: signal.needsAttention, signal }),
      freshnessMs: signal.freshnessMs,
      signal,
      portraitInput: {
        role,
        state: agent.state || 'idle',
        color: agent.color || '',
        facing: 'down',
        frame: 0,
      },
    };
  }).sort(compareAgentRosterEntries);
}

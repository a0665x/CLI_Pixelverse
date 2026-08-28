import { resolveAgentSignal } from './agent_roster_model.mjs';

const identity = (agent = {}) => String(agent.id || agent.agent || '');

export function buildAgentDetail(model = {}, agentId, { nowMs = Date.now() } = {}) {
  const agent = (model.agents || []).find((candidate) => identity(candidate) === String(agentId));
  if (!agent) return null;
  const id = identity(agent);
  const roomKey = agent.roomKey || agent.buildingId || agent.targetRoom || agent.room_key || '';
  return {
    id,
    name: agent.name || id,
    role: agent.role || 'main_agent',
    state: agent.state || 'idle',
    pixelState: agent.pixelState || agent.pixel_state || agent.state || 'idle',
    signal: resolveAgentSignal(agent, nowMs),
    task: String(agent.task || ''),
    room: {
      key: roomKey,
      label: agent.roomLabel || agent.room_label || (roomKey ? `rooms.${roomKey}.name` : ''),
    },
    tool: String(agent.toolName || agent.tool_name || agent.tool || ''),
    hook: String(agent.hook || agent.source || agent.agent_kind || ''),
    processIdentity: agent.processId ?? agent.process_id ?? null,
    sessionIdentity: agent.instanceName || agent.instance_name || agent.sessionId || agent.session_id || null,
    lastSeen: agent.lastSeenMs ?? agent.last_seen_ms ?? agent.freshness?.lastSeenMs ?? null,
    recentEvents: (model.events || []).filter((event) => (
      String(event.agentId || event.agent?.id || event.agent || '') === id
    )).slice(0, 8),
    portraitInput: agent,
    externalFields: [
      'name', 'task', 'tool', 'hook', 'processIdentity', 'sessionIdentity', 'recentEvents',
    ],
  };
}

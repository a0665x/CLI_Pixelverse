import { resolveAgentSignal } from './agent_roster_model.mjs';

const MAIN_ROLE = 'main_agent';

const REST_ROOMS = new Set(['standby_dock', 'offline_corner', 'rest-cabin']);
const GENERIC_EVENT_KINDS = new Set(['', 'action', 'event', 'update']);

const stateRank = (agent = {}) => {
  if (agent.lifecycle === 'offline' || agent.state === 'offline' || agent.is_stale) return 0;
  if (agent.semantic === 'work' || agent.hookSemantic === 'work') return 4;
  if (agent.semantic === 'search' || agent.hookSemantic === 'search') return 3;
  return 1;
};

export const compareCommandDeckAgents = (first = {}, second = {}) => {
  const firstMain = first.role === MAIN_ROLE ? 0 : 1;
  const secondMain = second.role === MAIN_ROLE ? 0 : 1;
  return firstMain - secondMain || String(first.agent || first.id || '').localeCompare(String(second.agent || second.id || ''));
};

const normalized = (value) => String(value ?? '').trim().toLowerCase();

const displayName = (agent = {}) => agent.full_name || agent.name || agent.agent || agent.id || 'Agent';

const sourceIdentity = (agent = {}) => String(agent.source || agent.agent_kind || '');

const heartbeatState = (agent = {}) => {
  const state = normalized(agent.state);
  const pixelState = normalized(agent.pixel_state);
  if (state === 'offline' || agent.is_stale) return { tone: 'offline', state: 'offline', load: 0 };
  if (['thinking', 'planning', 'reading_files', 'browsing'].includes(pixelState)) {
    return { tone: 'search', state: 'thinking', load: .62 };
  }
  if (['tool_call', 'invoking_skill', 'executing', 'responding', 'self_healing', 'editing_files', 'shell_command', 'external_tool', 'collaborating'].includes(pixelState)) {
    return { tone: 'work', state: 'working', load: .94 };
  }
  if (['thinking', 'planning'].includes(state)) return { tone: 'search', state: 'thinking', load: .62 };
  if (['working', 'executing', 'responding'].includes(state)) return { tone: 'work', state: 'working', load: .94 };
  if (['idle', 'sleeping'].includes(pixelState) || ['idle', 'resting', 'waiting'].includes(state)) {
    return { tone: 'rest', state: 'idle', load: .18 };
  }
  return { tone: 'work', state: agent.state || 'working', load: .94 };
};

export function normalizeVisibleAgents(snapshot = {}) {
  const agents = Array.isArray(snapshot) ? snapshot : Array.isArray(snapshot.agents) ? snapshot.agents : [];
  const attachedSources = new Set(agents
    .filter((agent) => !agent.source_placeholder
      && !agent.is_stale
      && normalized(agent.state) !== 'offline'
      && (agent.connection_status === 'attached' || agent.process_id || normalized(agent.state) === 'working'))
    .map(sourceIdentity)
    .filter(Boolean));
  return agents.filter((agent) => !(
    agent.source_placeholder
    && (agent.is_stale || agent.connection_status === 'awaiting_attach')
    && attachedSources.has(sourceIdentity(agent))
  ));
}

export function resolvedAgentActivity(agent = {}) {
  if (agent.commandDeckActivity) return agent.commandDeckActivity;
  const heartbeat = heartbeatState(agent);
  const semantic = heartbeat.tone === 'search' ? 'search' : heartbeat.tone === 'work' ? 'work' : 'rest';
  let roomKey = agent.targetRoom || agent.room_key || '';
  if (semantic === 'work' && REST_ROOMS.has(roomKey)) roomKey = 'response_studio';
  if (semantic === 'search' && REST_ROOMS.has(roomKey)) roomKey = 'think_lab';
  if (!roomKey) roomKey = semantic === 'work' ? 'response_studio' : semantic === 'search' ? 'think_lab' : 'standby_dock';
  return { state: heartbeat.state, tone: heartbeat.tone, load: heartbeat.load, semantic, roomKey };
}

export function normalizeAgentForWorld(agent = {}) {
  const activity = resolvedAgentActivity(agent);
  const currentPixelState = normalized(agent.pixel_state);
  const compatibleStates = {
    work: new Set(['tool_call', 'invoking_skill', 'executing', 'responding', 'self_healing', 'editing_files', 'shell_command']),
    search: new Set(['thinking', 'planning', 'reading_files', 'browsing']),
    rest: new Set(['idle', 'sleeping', 'offline']),
  };
  const pixelState = activity.state === 'offline'
    ? 'offline'
    : compatibleStates[activity.semantic].has(currentPixelState)
      ? currentPixelState
      : activity.semantic === 'search'
        ? 'thinking'
        : activity.semantic === 'work'
          ? 'responding'
          : 'idle';
  return { ...agent, state: activity.state, pixel_state: pixelState, room_key: activity.roomKey };
}

const payloadEventContent = (event = {}) => {
  const action = event.payload?.action || {};
  const envelopeKinds = [event.type, event.event_name, event.kind].filter(Boolean).map(String);
  const envelopeKind = envelopeKinds.find((kind) => !GENERIC_EVENT_KINDS.has(normalized(kind)))
    || envelopeKinds[0] || '';
  const actionType = String(action.type || '');
  const tool = action.tool ?? action.tool_name ?? action.tool_names ?? event.tool ?? event.tool_name ?? event.tool_names ?? '';
  const toolText = Array.isArray(tool) ? tool.join(', ') : String(tool || '');
  return {
    kind: event.category || (GENERIC_EVENT_KINDS.has(normalized(envelopeKind)) ? actionType || envelopeKind : envelopeKind),
    envelopeKind,
    actionType,
    text: event.summary || action.preview || action.message || event.message || event.preview
      || event.title || toolText || '',
    tool: toolText,
  };
};

export const classifyCommandEvent = (event = {}) => {
  const content = payloadEventContent(event);
  const value = `${normalized(content.kind)} ${normalized(content.text)} ${normalized(content.tool)}`;
  if (/(complete|completed|done|finish|完成|完了|완료)/.test(value)) return 'completion';
  if (/(reason|thought|thinking|planning|plan|思考|規劃|推理|計画|推論|추론|계획)/.test(value)) return 'reasoning';
  if (/(tool|patch|read_file|write_file|terminal|execute|browser|工具)/.test(value)) return 'tool';
  if (/(subagent|clone|分身|クローン|서브)/.test(value)) return 'subagent';
  if (/(session|branch|工作階段|セッション|세션)/.test(value)) return 'session';
  if (/(message|speak|reply|訊息|メッセージ|메시지)/.test(value)) return 'message';
  return 'status';
};

const eventAgentId = (event = {}) => String(
  event.agent ?? event.agent_id ?? event.agentId ?? event.payload?.agent ?? '',
);

const eventRoom = (event = {}) => String(
  event.target_room ?? event.room_key ?? event.building_id ?? event.buildingId
    ?? event.payload?.target_room ?? event.payload?.room_key ?? '',
);

const hashString = (value) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

const stableEventId = (event = {}) => {
  const explicit = event.id ?? event.event_id ?? event.eventId;
  if (explicit !== undefined && explicit !== null && String(explicit)) return String(explicit);
  const content = payloadEventContent(event);
  return `event-${hashString(JSON.stringify([
    eventAgentId(event), content.kind, content.envelopeKind, content.actionType,
    Number(event.time ?? event.timestamp ?? event.created_at ?? 0) || 0,
    content.text, content.tool, eventRoom(event),
  ]))}`;
};

const eventTime = (event = {}) => {
  const value = Number(event.time ?? event.timestamp ?? event.created_at ?? 0);
  return Number.isFinite(value) ? value : 0;
};

const eventSummary = (event = {}) => {
  const content = payloadEventContent(event);
  return content.text || content.tool || content.kind;
};

const makeAgent = (agent, nowMs) => {
  const activity = resolvedAgentActivity(agent);
  const lastSeenMs = Number(agent.last_seen_ms ?? agent.last_action_at ?? 0) || 0;
  const ageMs = lastSeenMs && nowMs ? Math.max(0, nowMs - lastSeenMs) : null;
  const id = String(agent.agent || agent.id || '');
  const lifecycle = activity.state === 'offline' ? 'offline' : activity.semantic === 'rest' ? 'idle' : 'active';
  const commandDeckActivity = Object.freeze({ ...activity });
  return {
    ...agent,
    id,
    agent: id,
    name: displayName(agent),
    labelKey: 'commandDeck.agent',
    lifecycle,
    state: activity.state,
    pixelState: agent.pixel_state || activity.state,
    targetRoom: activity.roomKey,
    roomKey: activity.roomKey,
    buildingId: activity.roomKey,
    toolName: agent.tool_name || agent.tool || '',
    processId: agent.process_id ?? null,
    instanceName: agent.instance_name || agent.session_id || '',
    lastSeenMs,
    hookSemantic: activity.semantic,
    semantic: activity.semantic,
    tone: activity.tone,
    load: activity.load,
    eventCategory: activity.semantic === 'search' ? 'reasoning' : activity.semantic === 'work' ? 'status' : 'status',
    freshness: { lastSeenMs, ageMs, isStale: Boolean(agent.is_stale) },
    priority: (agent.role === MAIN_ROLE ? 100 : 0) + stateRank({ ...agent, semantic: activity.semantic }),
    reportedRoom: String(agent.room_key || ''),
    commandDeckActivity,
  };
};

const makeEvent = (event, agentsById, nowMs) => {
  const id = stableEventId(event);
  const agentId = eventAgentId(event);
  const agent = agentsById[agentId] || null;
  const buildingId = eventRoom(event) || agent?.buildingId || '';
  const category = classifyCommandEvent(event);
  const time = eventTime(event);
  return {
    ...event,
    id,
    agentId,
    agent,
    buildingId,
    hookSemantic: agent?.hookSemantic || (category === 'reasoning' ? 'search' : category === 'status' ? 'rest' : 'work'),
    category,
    categoryLabelKey: `eventCategories.${category}`,
    summary: eventSummary(event),
    freshness: { timestampMs: time, ageMs: time && nowMs ? Math.max(0, nowMs - time) : null },
    priority: (agent?.priority || 0) + (category === 'completion' ? 2 : category === 'tool' ? 1 : 0),
    time,
  };
};

const objectIndex = (records) => Object.fromEntries(records.map((record) => [record.id, record]));

const renderedCollection = (rendered, key, alternateKey) => {
  if (Object.prototype.hasOwnProperty.call(rendered, key)) return rendered[key];
  if (alternateKey && Object.prototype.hasOwnProperty.call(rendered, alternateKey)) return rendered[alternateKey];
  return undefined;
};

const collectionIds = (value, keys) => {
  if (value === undefined) return null;
  if (value instanceof Set) return new Set([...value].map(String));
  if (value instanceof Map) return new Set([...value.keys()].map(String));
  if (Array.isArray(value)) return new Set(value.map((item) => {
    if (typeof item === 'string' || typeof item === 'number') return String(item);
    return String(keys.map((key) => item?.[key]).find((entry) => entry !== undefined) ?? '');
  }).filter(Boolean));
  if (value && typeof value === 'object') return new Set(Object.keys(value));
  return new Set();
};

const renderedRecord = (value, id, keys) => {
  if (!Array.isArray(value)) return null;
  return value.find((item) => item && typeof item === 'object'
    && keys.some((key) => String(item[key] ?? '') === id)) || null;
};

export function commandDeckFindings(model = {}, rendered = {}) {
  const findings = [];
  const add = (finding) => findings.push({ params: {}, ...finding });
  const agents = Array.isArray(model.agents) ? model.agents : [];
  const events = Array.isArray(model.events) ? model.events : [];

  for (const agent of agents) {
    if (agent.reportedRoom && agent.reportedRoom !== agent.targetRoom) {
      add({
        id: `agent-room-mismatch:${agent.id}`,
        severity: 'warning',
        agentId: agent.id,
        buildingId: agent.targetRoom,
        messageKey: 'commandDeck.findings.roomMismatch',
        params: { reportedRoom: agent.reportedRoom, resolvedRoom: agent.targetRoom },
      });
    }
  }
  for (const event of events) {
    if (event.agentId && !event.agent) {
      add({
        id: `event-agent-missing:${event.id}`,
        severity: 'warning',
        agentId: event.agentId,
        buildingId: event.buildingId || undefined,
        messageKey: 'commandDeck.findings.eventAgentMissing',
        params: { eventId: event.id },
      });
    }
  }

  const renderedAgents = renderedCollection(rendered, 'agents', 'agentIds');
  const renderedAgentIds = collectionIds(renderedAgents, ['id', 'agent', 'agentId']);
  if (renderedAgentIds) {
    for (const agent of agents) {
      if (!renderedAgentIds.has(agent.id)) {
        add({
          id: `missing-village-agent:${agent.id}`,
          severity: 'critical',
          agentId: agent.id,
          buildingId: agent.buildingId,
          messageKey: 'commandDeck.findings.missingVillageAgent',
          params: { agentId: agent.id },
        });
      }
      const renderedAgent = renderedRecord(renderedAgents, agent.id, ['id', 'agent', 'agentId']);
      const renderedRoom = renderedAgent && String(
        renderedAgent.buildingId ?? renderedAgent.targetRoom ?? renderedAgent.room_key ?? '',
      );
      if (renderedRoom && renderedRoom !== agent.buildingId) {
        add({
          id: `village-room-mismatch:${agent.id}`,
          severity: 'warning',
          agentId: agent.id,
          buildingId: agent.buildingId,
          messageKey: 'commandDeck.findings.villageRoomMismatch',
          params: { renderedRoom, resolvedRoom: agent.buildingId },
        });
      }
    }
  }

  const renderedBuildings = renderedCollection(rendered, 'buildings', 'buildingIds');
  const renderedBuildingIds = collectionIds(renderedBuildings, ['id', 'buildingId', 'room_key']);
  if (renderedBuildingIds) {
    const required = new Set([
      ...agents.map(({ buildingId }) => buildingId),
      ...events.map(({ buildingId }) => buildingId),
    ].filter(Boolean));
    for (const buildingId of required) {
      if (!renderedBuildingIds.has(buildingId)) {
        add({
          id: `missing-village-building:${buildingId}`,
          severity: 'critical',
          buildingId,
          messageKey: 'commandDeck.findings.missingVillageBuilding',
          params: { buildingId },
        });
      }
    }
  }

  return [...new Map(findings.map((finding) => [finding.id, finding])).values()];
}

export function buildCommandDeckModel(snapshot = {}, options = {}) {
  const nowMs = Number(options.nowMs ?? snapshot.server_time_ms ?? 0) || 0;
  const agents = normalizeVisibleAgents(snapshot).map((agent) => makeAgent(agent, nowMs)).sort(compareCommandDeckAgents);
  const agent = objectIndex(agents);
  const events = (Array.isArray(snapshot.events) ? snapshot.events : [])
    .map((item) => makeEvent(item, agent, nowMs))
    .filter((item, index, source) => source.findIndex(({ id }) => id === item.id) === index)
    .sort((first, second) => second.time - first.time || first.id.localeCompare(second.id));

  const configuredBuildings = [
    ...(Array.isArray(snapshot.buildings) ? snapshot.buildings : []),
    ...(Array.isArray(options.buildings) ? options.buildings : []),
  ];
  const buildingIds = new Set([
    ...configuredBuildings.map((item) => String(item.id || item.buildingId || '')),
    ...agents.map(({ buildingId }) => buildingId),
    ...events.map(({ buildingId }) => buildingId),
  ].filter(Boolean));
  const buildings = [...buildingIds].sort().map((id) => {
    const configured = configuredBuildings.find((item) => String(item.id || item.buildingId || '') === id) || {};
    return {
      ...configured,
      id,
      labelKey: configured.labelKey || `rooms.${id}.name`,
      agents: agents.filter(({ buildingId }) => buildingId === id),
      events: events.filter(({ buildingId }) => buildingId === id),
    };
  });
  const building = objectIndex(buildings);
  const hooks = ['work', 'search', 'rest'].map((id) => ({
    id,
    labelKey: `hooks.${id}.label`,
    agents: agents.filter(({ hookSemantic }) => hookSemantic === id),
    events: events.filter(({ hookSemantic }) => hookSemantic === id),
    buildings: buildings.filter((item) => (
      item.agents.some(({ hookSemantic }) => hookSemantic === id)
      || item.events.some(({ hookSemantic }) => hookSemantic === id)
    )),
  }));
  const hook = objectIndex(hooks);
  const event = objectIndex(events);
  const selectionIndex = { agent, building, hook, event };
  const model = { agents, events, selectionIndex, findings: [], situation: {} };
  model.findings = commandDeckFindings(model, options.rendered || options.village || {});
  const signals = agents.map((agent) => resolveAgentSignal(agent, nowMs));
  model.situation = {
    agentCount: agents.length,
    eventCount: events.length,
    activeAgentCount: agents.filter(({ lifecycle }) => lifecycle === 'active').length,
    attentionCount: signals.filter(({ needsAttention }) => needsAttention).length,
    busyAgentCount: signals.filter(({ kind }) => kind === 'busy').length,
    idleAgentCount: signals.filter(({ kind }) => kind === 'idle').length,
    offlineAgentCount: signals.filter(({ kind }) => kind === 'offline').length,
    warningCount: model.findings.filter(({ severity }) => severity === 'warning').length,
    criticalCount: model.findings.filter(({ severity }) => severity === 'critical').length,
    highestSeverity: model.findings.some(({ severity }) => severity === 'critical')
      ? 'critical'
      : model.findings.some(({ severity }) => severity === 'warning') ? 'warning' : 'info',
    updatedAt: nowMs,
  };
  return model;
}

export function resolveCommandSelection(model = {}, selection = null) {
  if (!selection || !['agent', 'building', 'hook', 'event'].includes(selection.kind)) return null;
  const record = model.selectionIndex?.[selection.kind]?.[String(selection.id)];
  if (!record) return null;

  if (selection.kind === 'agent') {
    const building = model.selectionIndex.building[record.buildingId] || null;
    const hook = model.selectionIndex.hook[record.hookSemantic] || null;
    return {
      kind: 'agent', id: record.id, agent: record, building, buildingId: record.buildingId,
      hook, events: model.events.filter(({ agent }) => agent === record),
    };
  }
  if (selection.kind === 'building') {
    const agent = record.agents[0] || null;
    const event = record.events[0] || null;
    return {
      kind: 'building', id: record.id, building: record, buildingId: record.id,
      agent, event, agents: record.agents, events: record.events,
      hook: agent ? model.selectionIndex.hook[agent.hookSemantic] : null,
    };
  }
  if (selection.kind === 'hook') {
    const agent = [...record.agents].sort((first, second) => (
      second.priority - first.priority || compareCommandDeckAgents(first, second)
    ))[0] || null;
    const event = record.events[0] || null;
    const building = agent ? model.selectionIndex.building[agent.buildingId] : record.buildings[0] || null;
    return {
      kind: 'hook', id: record.id, hook: record, agent, event, building,
      buildingId: building?.id || '', agents: record.agents, events: record.events,
    };
  }
  const agentRecord = record.agent || model.selectionIndex.agent[record.agentId] || null;
  const buildingRecord = model.selectionIndex.building[record.buildingId] || null;
  return {
    kind: 'event', id: record.id, event: record, agent: agentRecord,
    building: buildingRecord, buildingId: record.buildingId,
    hook: model.selectionIndex.hook[record.hookSemantic] || null,
  };
}

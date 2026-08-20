const CATEGORY_ORDER = ['reasoning', 'tool', 'subagent', 'session', 'status', 'message', 'completion'];

const categoryFor = (event = {}) => {
  if (CATEGORY_ORDER.includes(event.category)) return event.category;
  const value = `${event.kind || event.type || event.event_name || ''} ${event.summary || event.message || ''}`.toLowerCase();
  if (/(complete|completed|done|finish|完成|完了|완료)/.test(value)) return 'completion';
  if (/(reason|thought|think|planning|思考|規劃|推理|計画|推論|추론|계획)/.test(value)) return 'reasoning';
  if (/(tool|patch|read_file|write_file|terminal|execute|browser|工具)/.test(value)) return 'tool';
  if (/(subagent|clone|分身|クローン|서브)/.test(value)) return 'subagent';
  if (/(session|branch|工作階段|セッション|세션)/.test(value)) return 'session';
  if (/(message|speak|reply|訊息|メッセージ|메시지)/.test(value)) return 'message';
  return 'status';
};

const eventTime = (event = {}) => {
  const value = Number(event.time ?? event.timestamp ?? event.created_at ?? event.freshness?.timestampMs);
  if (!Number.isFinite(value)) return 0;
  return value;
};

const eventId = (event = {}, index = 0) => String(
  event.id ?? event.event_id ?? event.eventId ?? `${event.agentId || event.agent || 'event'}:${eventTime(event)}:${index}`,
);

const agentId = (event = {}) => String(event.agentId ?? event.agent?.id ?? event.agent ?? event.payload?.agent ?? '');

const roleRank = (agent = {}) => agent.role === 'main_agent' ? 0 : agent.role === 'subagent' ? 1 : 2;

const compareAgents = (left = {}, right = {}) => (
  roleRank(left) - roleRank(right)
  || String(left.id || left.agent || '').localeCompare(String(right.id || right.agent || ''))
);

export function buildMissionTrace(model = {}, options = {}) {
  const windowEndMs = Number(options.windowEndMs ?? options.nowMs ?? Date.now());
  const windowMs = Math.max(1, Number(options.windowMs) || 20 * 60 * 1_000);
  const windowStartMs = windowEndMs - windowMs;
  const maxEvents = Math.max(1, Number(options.maxEvents) || 240);
  const selectedEventId = options.selectedEventId == null ? null : String(options.selectedEventId);
  const sourceEvents = Array.isArray(model.events) ? model.events : [];
  const retained = sourceEvents
    .map((event, index) => ({ event, id: eventId(event, index), time: eventTime(event) }))
    .filter(({ time }) => time >= windowStartMs && time <= windowEndMs)
    .sort((left, right) => right.time - left.time || left.id.localeCompare(right.id))
    .slice(0, maxEvents)
    .sort((left, right) => left.time - right.time || left.id.localeCompare(right.id));

  const agentsById = new Map();
  (Array.isArray(model.agents) ? model.agents : []).forEach((agent) => {
    const id = String(agent.id || agent.agent || '');
    if (id) agentsById.set(id, agent);
  });
  retained.forEach(({ event }) => {
    const id = agentId(event);
    if (id && !agentsById.has(id)) agentsById.set(id, event.agent || { id, agent: id, name: id });
  });

  const lanes = [...agentsById.values()].sort(compareAgents).map((agent, laneIndex) => {
    const id = String(agent.id || agent.agent || '');
    const events = retained.filter(({ event }) => agentId(event) === id).map(({ event, id: idValue, time }) => {
      const category = categoryFor(event);
      const eventAgent = event.agent || model.selectionIndex?.agent?.[id] || agent;
      const buildingId = String(event.buildingId || event.room_key || eventAgent?.buildingId || eventAgent?.room_key || '');
      const building = model.selectionIndex?.building?.[buildingId] || (buildingId ? { id: buildingId } : null);
      return {
        ...event,
        id: idValue,
        time,
        agentId: id,
        agent: eventAgent,
        buildingId,
        building,
        category,
        categoryIndex: CATEGORY_ORDER.indexOf(category),
        xPct: Number((((time - windowStartMs) / windowMs) * 100).toFixed(3)),
        selected: selectedEventId === idValue,
        selection: { kind: 'event', id: idValue },
      };
    });
    return {
      id,
      agentId: id,
      laneIndex,
      agent,
      buildingId: String(agent.buildingId || agent.room_key || ''),
      events,
      points: events,
    };
  });

  return {
    lanes,
    windowStartMs,
    windowEndMs,
    live: options.live !== false,
    selectedEventId,
  };
}

export function createMissionTraceController(options = {}) {
  const now = options.now || (() => Date.now());
  const requestFrame = options.requestAnimationFrame || globalThis.requestAnimationFrame?.bind(globalThis);
  const cancelFrame = options.cancelAnimationFrame || globalThis.cancelAnimationFrame?.bind(globalThis);
  const setStaticInterval = options.setInterval || globalThis.setInterval?.bind(globalThis);
  const clearStaticInterval = options.clearInterval || globalThis.clearInterval?.bind(globalThis);
  const reducedMotion = options.reducedMotion ?? globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  const frameIntervalMs = options.frameIntervalMs === undefined ? 1000 / 12 : Math.max(0, Number(options.frameIntervalMs));
  const staticRefreshMs = Math.max(1_000, Number(options.staticRefreshMs) || 2_000);
  const maxEvents = Math.max(1, Number(options.maxEvents) || 240);
  const eventHistory = new Map();
  const agentHistory = new Map();
  let model = { agents: [], events: [], selectionIndex: {} };
  let selectedEventId = null;
  let live = true;
  let pausedAtMs = null;
  let started = false;
  let frameHandle = null;
  let staticHandle = null;
  let lastFrameMs = -Infinity;

  const retainedModel = (nextModel = model) => ({
    ...nextModel,
    agents: [...agentHistory.values()],
    events: [...eventHistory.values()],
    selectionIndex: {
      ...(nextModel.selectionIndex || {}),
      agent: Object.fromEntries([...agentHistory].map(([id, agent]) => [id, agent])),
    },
  });

  const render = (structureChanged = false) => {
    const trace = buildMissionTrace(retainedModel(), {
      nowMs: live ? now() : pausedAtMs,
      windowMs: options.windowMs,
      maxEvents,
      live,
      selectedEventId,
    });
    options.onRender?.(trace, { structureChanged });
    return trace;
  };

  const pruneHistory = () => {
    const entries = [...eventHistory.entries()].sort(([, left], [, right]) => eventTime(right) - eventTime(left));
    entries.slice(maxEvents).forEach(([id]) => eventHistory.delete(id));
    const referenced = new Set([...eventHistory.values()].map(agentId));
    [...agentHistory.keys()].forEach((id) => {
      if (!referenced.has(id) && !(model.agents || []).some((agent) => String(agent.id || agent.agent) === id)) agentHistory.delete(id);
    });
  };

  const tick = (timestamp = now()) => {
    if (!started) return;
    if (live && timestamp - lastFrameMs >= frameIntervalMs) {
      lastFrameMs = timestamp;
      render(false);
    }
    if (requestFrame) frameHandle = requestFrame(tick);
  };

  return {
    setModel(nextModel = {}) {
      model = nextModel;
      (nextModel.agents || []).forEach((agent) => {
        const id = String(agent.id || agent.agent || '');
        if (id) agentHistory.set(id, agent);
      });
      (nextModel.events || []).forEach((event, index) => eventHistory.set(eventId(event, index), event));
      pruneHistory();
      return render(true);
    },
    select(id) {
      selectedEventId = id == null ? null : String(id);
      pausedAtMs = now();
      live = false;
      const trace = render(false);
      const selected = trace.lanes.flatMap((lane) => lane.events).find((event) => event.id === selectedEventId) || null;
      options.onSelect?.(selected);
      return selected;
    },
    resume() {
      selectedEventId = null;
      pausedAtMs = null;
      live = true;
      return render(false);
    },
    start() {
      if (started) return false;
      started = true;
      if (reducedMotion) {
        if (setStaticInterval) staticHandle = setStaticInterval(() => { if (live) render(false); }, staticRefreshMs);
      } else if (requestFrame) {
        frameHandle = requestFrame(tick);
      }
      return true;
    },
    stop() {
      if (!started) return false;
      started = false;
      if (frameHandle != null) cancelFrame?.(frameHandle);
      if (staticHandle != null) clearStaticInterval?.(staticHandle);
      frameHandle = null;
      staticHandle = null;
      return true;
    },
  };
}

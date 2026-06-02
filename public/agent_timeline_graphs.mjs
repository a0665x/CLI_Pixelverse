const CATEGORY_ORDER = ['reasoning', 'tool', 'subagent', 'session', 'status', 'message', 'completion'];

const CATEGORY_STYLES = {
  reasoning: { color: '#a78bfa', dot: '🧠' },
  tool: { color: '#60a5fa', dot: '🛠️' },
  subagent: { color: '#8b5cf6', dot: '🧬' },
  session: { color: '#22c55e', dot: '🗂️' },
  status: { color: '#fbbf24', dot: '📡' },
  message: { color: '#f472b6', dot: '💬' },
  completion: { color: '#4ade80', dot: '✅' },
};

function toTime(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num : Date.now();
}

function classifyEvent(item = {}) {
  const kind = item.kind || item.type || item.event_name || '';
  const summary = String(item.summary || item.message || '').toLowerCase();
  if (/(complete|completed|done|finish|完成|完了|완료)/.test(kind) || /(complete|completed|done|finish|完成|完了|완료)/.test(summary)) return 'completion';
  if (/(reason|thought|planning|思考|規劃|推理|思考中|計画|推論|추론|계획)/.test(kind) || /(reason|plan|thinking|思考|規劃|推理|計画|推論|추론|계획)/.test(summary)) return 'reasoning';
  if (/(tool|patch|read_file|write_file|terminal|execute|browser|工具)/.test(kind) || /(tool|patch|terminal|execute|browser|工具)/.test(summary)) return 'tool';
  if (/(subagent|clone|分身|クローン|서브)/.test(kind) || /(subagent|clone|分身|クローン|서브)/.test(summary)) return 'subagent';
  if (/(session|branch|工作階段|セッション|세션)/.test(kind) || /(session|branch|工作階段|セッション|세션)/.test(summary)) return 'session';
  if (/(message|speak|reply|訊息|メッセージ|메시지)/.test(kind) || /(message|reply|訊息|メッセージ|메시지)/.test(summary)) return 'message';
  return 'status';
}

function eventAgentId(item = {}) {
  return item.agent || item.payload?.agent || null;
}

function localActionToEvent(action = {}, agent = {}, index = 0) {
  const summary = action.preview || action.message || action.tool_name || action.type || agent.task || '';
  return {
    id: `${agent.agent}:local:${index}`,
    time: toTime(action.time || agent.last_seen_ms),
    agent: agent.agent,
    kind: action.event_name || action.type || 'status',
    title: action.event_name || action.type || 'status',
    summary,
  };
}

function recentAgentEvents(snapshot = {}, agent = {}) {
  const worldEvents = Array.isArray(snapshot.events) ? snapshot.events.filter((item) => eventAgentId(item) === agent.agent) : [];
  const localEvents = Array.isArray(agent.recent_actions) ? agent.recent_actions.map((action, index) => localActionToEvent(action, agent, index)) : [];
  const merged = [...worldEvents, ...localEvents];
  merged.sort((a, b) => toTime(a.time) - toTime(b.time));
  return merged;
}

function lanePoints(events = [], nowMs, windowMs, locale) {
  const labels = locale.eventCategories || {};
  const rows = CATEGORY_ORDER.map((key, index) => ({
    key,
    index,
    label: labels[key] || key,
    color: CATEGORY_STYLES[key].color,
  }));
  const points = events.map((event) => {
    const category = classifyEvent(event);
    const row = rows.find((item) => item.key === category) || rows.at(-1);
    const time = toTime(event.time);
    const ratio = Math.max(0, Math.min(1, (time - (nowMs - windowMs)) / windowMs));
    return {
      category,
      row: row.index,
      rowLabel: row.label,
      color: row.color,
      icon: CATEGORY_STYLES[category].dot,
      xPct: Number((ratio * 100).toFixed(2)),
      yPct: Number((((row.index + 0.5) / rows.length) * 100).toFixed(2)),
      summary: event.summary || event.title || row.label,
      title: event.title || row.label,
      time,
    };
  });
  return { rows, points };
}

function activeSortScore(agent = {}) {
  const state = agent.state || 'idle';
  if (state === 'working') return 4;
  if (state === 'planning') return 3;
  if (state === 'thinking') return 2;
  if (agent.role === 'subagent') return 1.5;
  if (agent.role === 'branch_session') return 1.2;
  return 1;
}

function heartbeatLoad(agent = {}) {
  return ({
    idle: 0,
    sleeping: 0,
    thinking: 0.62,
    planning: 0.74,
    collaborating: 0.84,
    invoking_skill: 0.88,
    tool_call: 0.94,
    executing: 1,
    responding: 0.78,
    self_healing: 0.96,
    blocked: 0.42,
  })[agent.pixel_state] || 0.58;
}

function gaussian(value, center, width) {
  return Math.exp(-Math.pow((value - center) / width, 2));
}

export function buildHeartbeatPath(panel = {}, nowMs = Date.now(), refreshMs = 1000, widthPx = 4096) {
  const width = Math.max(1, Number(widthPx) || 4096);
  const flat = panel.state === 'idle'
    || panel.state === 'offline'
    || panel.heartbeatTone === 'waiting'
    || panel.heartbeatTone === 'stale'
    || Number(panel.heartbeatLoad) <= 0;
  if (flat) return `M 0,16 L ${width},16`;

  const load = Math.max(.45, Math.min(1, Number(panel.heartbeatLoad) || .58));
  const beatWidthPx = heartbeatBeatWidthPx(panel);
  const phaseOffset = (nowMs / Math.max(90, Number(refreshMs) || 1000)) * .22;
  const points = [];
  for (let x = 0; x <= width; x += .25) {
    const phase = ((x / beatWidthPx) + phaseOffset) % 1;
    const signal = (
      (.1 * gaussian(phase, .14, .045))
      - (.18 * gaussian(phase, .27, .035))
      + (1.12 * gaussian(phase, .31, .028))
      - (.42 * gaussian(phase, .365, .04))
      + (.22 * gaussian(phase, .62, .09))
    );
    const y = 16 - (signal * load * 14);
    points.push(`${Number(x.toFixed(2))},${Number(y.toFixed(2))}`);
  }
  return `M ${points.join(' L ')}`;
}

export function heartbeatBeatWidthPx(panel = {}) {
  const load = Math.max(.45, Math.min(1, Number(panel.heartbeatLoad) || .58));
  return 20 - Math.round(load * 4);
}

export function buildAgentTimelinePanels(snapshot = {}, localeStrings = {}, options = {}) {
  const nowMs = toTime(options.nowMs ?? snapshot.server_time_ms ?? Date.now());
  const windowMs = Number.isFinite(Number(options.windowMs)) ? Number(options.windowMs) : 20 * 60 * 1000;
  const agents = Array.isArray(snapshot.agents) ? [...snapshot.agents] : [];
  const interesting = agents
    .filter((agent) => agent.state === 'offline' || agent.role === 'subagent' || agent.role === 'branch_session' || ['working', 'planning', 'thinking'].includes(agent.state || 'idle') || (agent.event_count || (agent.recent_actions || []).length || 0) > 0)
    .sort((a, b) => {
      const score = activeSortScore(b) - activeSortScore(a);
      if (score) return score;
      return (a.age_seconds || 0) - (b.age_seconds || 0);
    })
    .slice(0, 8);

  return interesting.map((agent) => {
    const events = recentAgentEvents(snapshot, agent).filter((event) => toTime(event.time) >= nowMs - windowMs);
    const { rows, points } = lanePoints(events, nowMs, windowMs, localeStrings);
    const latest = points.at(-1);
    return {
      agentId: agent.agent,
      name: agent.full_name || agent.name || agent.agent,
      shortName: agent.name || agent.agent,
      state: agent.state || 'idle',
      heartbeatLoad: heartbeatLoad(agent),
      heartbeatTone: agent.state === 'offline' || agent.is_stale ? 'stale' : agent.connection_status === 'awaiting_attach' ? 'waiting' : 'live',
      canDelete: agent.can_delete === true,
      role: agent.role || 'main_agent',
      ageSeconds: agent.age_seconds || 0,
      roomLabel: agent.room_label || '',
      latestSummary: latest?.summary || agent.activity_hint || agent.task || localeStrings.noEvents,
      latestCategory: latest?.rowLabel || (localeStrings.eventCategories?.status || 'Status'),
      rows,
      points,
    };
  });
}

import { buildHeartbeatPath } from './agent_timeline_graphs.mjs';
import { buildAgentRoster } from './agent_roster_model.mjs';
import {
  buildCommandDeckModel,
  compareCommandDeckAgents,
  normalizeAgentForWorld,
  normalizeVisibleAgents,
  resolvedAgentActivity,
} from './command_deck_model.mjs';

export { normalizeAgentForWorld, normalizeVisibleAgents, resolvedAgentActivity };

export function buildLiveAgentRail(snapshot = {}, locale = {}, nowMs = Date.now()) {
  const rooms = locale.rooms || {};
  const states = locale.states || {};
  const source = Array.isArray(snapshot) ? { agents: snapshot } : snapshot;
  const model = buildCommandDeckModel(source, { nowMs });
  return buildAgentRoster(model, { nowMs }).map((row) => {
    const agent = model.selectionIndex.agent[row.id] || {};
    const signal = row.signal;
    return {
      ...row,
      state: agent.state || row.state || 'idle',
      stateLabel: states[agent.state] || agent.state || row.state || 'idle',
      room: rooms[row.roomKey]?.name || agent.room_label || row.roomKey || '',
      hook: agent.hookSemantic || 'rest',
      tone: signal.tone,
      load: signal.load,
      path: buildHeartbeatPath({
        state: agent.state || row.state,
        signalKind: signal.kind,
        heartbeatTone: signal.tone,
        heartbeatLoad: signal.load,
        heartbeatRate: signal.rate,
        heartbeatAmplitude: signal.amplitude,
      }, nowMs, 1000, 176),
    };
  });
}

export function liveAgentPage(agents = [], page = 0, pageSize = 4) {
  const ordered = [...(Array.isArray(agents) ? agents : [])].sort(compareCommandDeckAgents);
  const size = Math.max(1, Math.trunc(Number(pageSize) || 1));
  const pageCount = Math.max(1, Math.ceil(ordered.length / size));
  const resolved = Math.max(0, Math.min(pageCount - 1, Math.trunc(Number(page) || 0)));
  return {
    items: ordered.slice(resolved * size, (resolved + 1) * size),
    page: resolved,
    pageCount,
    canPrevious: resolved > 0,
    canNext: resolved + 1 < pageCount,
  };
}

const BUILDING_BY_SEMANTIC = {
  rest: 'Rest Cabin',
  search: 'Research Library',
  work: 'Maker Workshop',
};

const CHANNEL_LABELS = {
  'zh-TW': { work: '工作', search: '搜尋', rest: '休息' },
  'en-US': { work: 'Work', search: 'Search', rest: 'Rest' },
  'ja-JP': { work: '作業', search: '検索', rest: '休憩' },
  'ko-KR': { work: '작업', search: '검색', rest: '휴식' },
};

export function hookChannelsForAgents(agents = [], locale = 'en-US', selectedAgentId = '', nowMs = Date.now()) {
  const labels = CHANNEL_LABELS[locale] || CHANNEL_LABELS['en-US'];
  const visible = normalizeVisibleAgents({ agents });
  const selected = hookRailForAgents(visible, selectedAgentId);
  return ['work', 'search', 'rest'].map((semantic) => {
    const occupants = visible
      .filter((agent) => resolvedAgentActivity(agent).semantic === semantic)
      .sort((first, second) => Number(second.last_seen_ms || second.last_action_at || 0)
        - Number(first.last_seen_ms || first.last_action_at || 0));
    const freshest = occupants[0];
    const tone = semantic === 'search' ? 'search' : semantic === 'rest' ? 'rest' : 'work';
    const state = occupants.length === 0 ? 'offline' : semantic === 'rest' ? 'idle' : semantic === 'search' ? 'thinking' : 'working';
    return {
      semantic,
      label: labels[semantic],
      count: occupants.length,
      building: BUILDING_BY_SEMANTIC[semantic],
      activity: freshest?.task || freshest?.activity_hint || freshest?.state || '',
      agentId: freshest?.agent || '',
      active: selected.semantic === semantic,
      path: buildHeartbeatPath({
        state,
        heartbeatTone: tone,
        heartbeatLoad: occupants.length === 0 ? 0 : semantic === 'rest' ? .18 : semantic === 'search' ? .62 : .94,
      }, nowMs, 1000, 176),
    };
  });
}

const HOOK_GUIDE = {
  'zh-TW': [
    ['休息 Hook → 休息小屋', '座椅、沙發與床位；等待、休息、離線狀態。'],
    ['搜尋 Hook → 研究圖書館', '書櫃、收納與閱讀桌；思考、規劃、搜尋狀態。'],
    ['工作 Hook → 製作工房', '辦公桌、工作台與設備；編輯、工具調用、修復狀態。'],
    ['協作 Hook → 協作公會', '控制台與會議桌；分身、派遣、回應狀態。'],
  ],
  'en-US': [
    ['Rest Hook → Rest Cabin', 'Seats, sofas, and beds for waiting, resting, and offline states.'],
    ['Search Hook → Research Library', 'Shelves, storage, and reading desks for thinking, planning, and search.'],
    ['Work Hook → Maker Workshop', 'Desks, benches, and equipment for editing, tools, and repair.'],
    ['Collaboration Hook → Agent Guild', 'Consoles and meeting tables for cloning, dispatch, and responses.'],
  ],
  'ja-JP': [
    ['休憩 Hook → 休憩小屋', '椅子、ソファ、ベッド。待機・休憩・オフライン状態。'],
    ['検索 Hook → 研究図書館', '本棚、収納、読書机。思考・計画・検索状態。'],
    ['作業 Hook → 制作工房', '机、作業台、設備。編集・ツール・修復状態。'],
    ['協働 Hook → エージェントギルド', 'コンソールと会議机。分身・派遣・応答状態。'],
  ],
  'ko-KR': [
    ['휴식 Hook → 휴식 오두막', '의자, 소파, 침대. 대기·휴식·오프라인 상태.'],
    ['검색 Hook → 연구 도서관', '책장, 수납, 독서 책상. 생각·계획·검색 상태.'],
    ['작업 Hook → 제작 공방', '책상, 작업대, 장비. 편집·도구·복구 상태.'],
    ['협업 Hook → 에이전트 길드', '콘솔과 회의 테이블. 분신·파견·응답 상태.'],
  ],
};

export function hookGuideForLocale(locale = 'en-US') {
  return (HOOK_GUIDE[locale] || HOOK_GUIDE['en-US']).map(([title, detail]) => ({ kind: 'guide', title, detail }));
}

export function hookRailForAgents(agents = [], selectedAgentId = '') {
  const source = normalizeVisibleAgents({ agents });
  const agent = source.find(({ agent: id }) => id === selectedAgentId)
    || [...source].sort((first, second) => {
      const rank = ({ state = '', pixel_state = '', is_stale = false } = {}) => {
        if (state === 'offline' || is_stale) return 0;
        if (['working', 'executing', 'responding'].includes(state)) return 4;
        if (['thinking', 'planning'].includes(state) || ['thinking', 'planning'].includes(pixel_state)) return 3;
        return state === 'idle' ? 1 : 2;
      };
      const activity = rank(second) - rank(first);
      const freshness = Number(second.last_seen_ms || second.last_action_at || 0)
        - Number(first.last_seen_ms || first.last_action_at || 0);
      return activity || freshness || compareCommandDeckAgents(first, second);
    })[0];
  if (!agent) return { agentId: '', semantic: 'rest', building: 'Rest Cabin', activity: '', roomKey: '' };
  const resolved = resolvedAgentActivity(agent);
  const semantic = resolved.semantic;
  return {
    agentId: agent.agent || '',
    semantic,
    building: BUILDING_BY_SEMANTIC[semantic],
    activity: agent.task || agent.activity_hint || agent.state || '',
    roomKey: resolved.roomKey,
  };
}

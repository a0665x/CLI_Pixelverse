import { createAgentSprite, createPropSprite } from './pixel_assets.mjs';
import {
  getKenneyAgentSprite,
  getKenneyDoorSprite,
  getKenneyPropSprite,
  getKenneyRoomLayout,
  getKenneyRoomTheme,
  KENNEY_PACK,
} from './kenney_assets.mjs';
import {
  getLocaleStrings,
  getRoomCopy,
  getRoomDecor,
  localizeToolSummary,
  normalizeLocale,
  summarizeWorld,
} from './ui_strings.mjs';
import {
  buildStreamUrl,
  parseStreamMessage,
  supportsEventStream,
} from './realtime.mjs';
import {
  getPropFx,
  getZoneFx,
} from './scene_fx.mjs';
import {
  buildRoute,
  getFacingFromDelta,
  movementDurationMs,
  nextWalkFrame,
  patrolPoint,
  shouldPatrol,
} from './world_motion.mjs';
import { getAgentPose, INTERACTION_OBJECT_ICONS, selectInteractionTarget } from './agent_pose.mjs';
import { buildAgentDialog, buildAgentSpeech } from './agent_dialog.mjs';
import { clampCameraOffset, centeredCamera, clampZoom, nextDraggedOffset, nextZoomState } from './ui_state.mjs';
import { HOUSE_DOORS, ROOM_LAYOUTS } from './house_layout.mjs';
import { deriveAgentEventVisual } from './main_agent_events.mjs';
import { getAppleDogDoorSprite, getAppleDogPropSprite, getAppleDogRoomTheme } from './appledog_assets.mjs';
import { shouldUseHighClarityProp } from './office_life_assets.mjs';
import {
  roomDecorLayout,
  roomInteractionPositions,
} from './room_furniture.mjs';

const ROOM_ACTIVITY_TARGETS = {
  think_lab: {
    thinking: [{ x: 44, y: 52 }, { x: 62, y: 26 }, { x: 74, y: 44 }],
    planning: [{ x: 62, y: 26 }, { x: 38, y: 20 }, { x: 44, y: 52 }],
  },
  blueprint_lab: {
    planning: [{ x: 28, y: 56 }, { x: 50, y: 18 }, { x: 74, y: 56 }],
    working: [{ x: 78, y: 26 }, { x: 18, y: 56 }, { x: 52, y: 62 }],
  },
  tool_forge: {
    working: [{ x: 24, y: 58 }, { x: 66, y: 56 }, { x: 54, y: 20 }],
    planning: [{ x: 48, y: 36 }, { x: 24, y: 58 }, { x: 78, y: 18 }],
  },
  response_studio: {
    working: [{ x: 24, y: 58 }, { x: 74, y: 56 }, { x: 46, y: 56 }],
    thinking: [{ x: 24, y: 24 }, { x: 46, y: 56 }, { x: 74, y: 20 }],
  },
  standby_dock: {
    idle: [{ x: 16, y: 54 }, { x: 40, y: 54 }, { x: 56, y: 26 }],
  },
  clone_bay: {
    working: [{ x: 28, y: 56 }, { x: 74, y: 56 }, { x: 52, y: 18 }],
    planning: [{ x: 18, y: 20 }, { x: 82, y: 22 }, { x: 52, y: 18 }],
  },
  session_archive: {
    working: [{ x: 18, y: 60 }, { x: 74, y: 24 }, { x: 52, y: 60 }],
    idle: [{ x: 18, y: 26 }, { x: 74, y: 60 }, { x: 52, y: 18 }],
  },
};

const EVENT_TITLES = {
  'zh-TW': {
    heartbeat: '主代理心跳同步',
    action: '世界動作更新',
    'hermes.status': 'Hermes 狀態同步',
    'hermes.subagent': '分身狀態更新',
    'hermes.subagent.event': '分身事件',
    'hermes.session': 'Hermes 工作階段',
    'webhook.registered': 'Webhook 已註冊',
    'webhook.removed': 'Webhook 已移除',
  },
  'en-US': {
    heartbeat: 'Main heartbeat',
    action: 'World action',
    'hermes.status': 'Hermes status',
    'hermes.subagent': 'Subagent update',
    'hermes.subagent.event': 'Subagent event',
    'hermes.session': 'Hermes session',
    'webhook.registered': 'Webhook registered',
    'webhook.removed': 'Webhook removed',
  },
};

const ROLE_CHIPS = {
  'zh-TW': { main_agent: '主', subagent: '分', branch_session: '支' },
  'en-US': { main_agent: 'M', subagent: 'S', branch_session: 'B' },
};

const dom = {
  agentsLayer: document.getElementById('agents-layer'),
  cameraStage: document.getElementById('camera-stage'),
  eventSummary: document.getElementById('event-summary'),
  events: document.getElementById('events'),
  inspectorBody: document.getElementById('inspector-body'),
  languageButtons: Array.from(document.querySelectorAll('[data-locale-switch]')),
  lastSync: document.getElementById('last-sync'),
  pathLayer: document.getElementById('path-layer'),
  panels: Array.from(document.querySelectorAll('[data-draggable-panel]')),
  panelHandles: Array.from(document.querySelectorAll('[data-drag-handle]')),
  dialogBackdrop: document.getElementById('speech-dialog-backdrop'),
  dialogPanel: document.getElementById('speech-dialog'),
  dialogTitle: document.getElementById('speech-dialog-title'),
  dialogBody: document.getElementById('speech-dialog-body'),
  dialogRows: document.getElementById('speech-dialog-rows'),
  sessionCount: document.getElementById('session-count'),
  subagentCount: document.getElementById('subagent-count'),
  summaryPanels: Array.from(document.querySelectorAll('.panel')),
  body: document.body,
  world: document.getElementById('world'),
  worldState: document.getElementById('world-state'),
  worldSummary: document.getElementById('world-summary'),
  agentCount: document.getElementById('agent-count'),
};

const agentViews = new Map();
let currentSnapshot = null;
let selectedAgentId = null;
let pollTimer = null;
let patrolTimer = null;
let liveStream = null;
let lastStreamId = 0;
const queryLocale = new URLSearchParams(window.location.search).get('lang');
let currentLocale = normalizeLocale(queryLocale || localStorage.getItem('pixelverse:locale') || 'zh-TW');
let cameraOffset = { x: 0, y: 0 };
let cameraScale = 1;
let cameraPanning = null;
let panelDragging = null;
let activeDialogAgentId = null;

const short = (text = '', max = 42) => text && text.length > max ? `${text.slice(0, max - 1)}…` : (text || '');

function strings() {
  return getLocaleStrings(currentLocale);
}

function roomCopy(agent) {
  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || strings().unknownRoom;
  return `${agent.room_icon || '📍'} ${roomName}`;
}

function ageText(ageSeconds = 0) {
  const copy = strings();
  return ageSeconds < 60 ? copy.secondsAgo(Math.round(ageSeconds)) : copy.minutesAgo(ageSeconds / 60);
}

function stateText(state = 'idle') {
  return strings().states[state] || state;
}

function localizeTask(task = '') {
  const localized = localizeToolSummary(task, currentLocale);
  return localized || task || strings().idleFallback;
}

function roleLabel(role = 'main_agent') {
  if (role === 'subagent') return strings().roleSubagent;
  if (role === 'branch_session') return strings().roleBranch;
  return strings().roleMain;
}

function roleChip(role = 'main_agent') {
  return ROLE_CHIPS[currentLocale]?.[role] || ROLE_CHIPS['zh-TW'][role] || '主';
}

function toolTokens(agent) {
  return String(agent.task || agent.tool_label || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function semanticFocus(agent) {
  const raw = [agent.task, agent.tool_label, agent.activity_hint].filter(Boolean).join(' ').toLowerCase();
  if (/(search|read|spec|plan|session|map|搜尋|讀取|規劃|藍圖|研究)/.test(raw)) return 'planning';
  if (/(patch|write|terminal|execute|browser|reply|修改|寫入|終端機|回覆)/.test(raw)) return 'working';
  if (agent.state === 'thinking') return 'thinking';
  if (agent.state === 'working') return 'working';
  if (agent.state === 'planning') return 'planning';
  return 'idle';
}

function activityTarget(agent, patrolIndex = 0) {
  const roomKey = agent.room_key || 'standby_dock';
  const room = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  const points = room.patrol || [room.center];
  const fallback = points.length ? points[patrolIndex % points.length] : (room.center || { x: agent.x || 0, y: agent.y || 0 });
  if (patrolIndex > 0) return fallback;
  const roomDecor = getRoomDecor(roomKey, currentLocale);
  const layout = roomDecorLayout(roomKey, roomDecor);
  const decor = layout.map((item) => item.prop);
  const worldPositions = roomInteractionPositions(roomKey, roomDecor);
  return selectInteractionTarget(agent, decor, worldPositions, fallback) || fallback;
}

function activityPoint(agent, patrolIndex = 0) {
  const target = activityTarget(agent, patrolIndex);
  return target ? { x: target.x, y: target.y } : { x: agent.x || 0, y: agent.y || 0 };
}

function interactionCopy(target) {
  if (!target?.propType) return '';
  const label = target.propLabel || target.propType;
  const action = currentLocale === 'en-US' ? target.actionLabelEn : target.actionLabelZh;
  return currentLocale === 'en-US' ? `${action} at ${label}` : `${action}：${label}`;
}

function ambientSpeech(agent) {
  const task = short(localizeTask(agent.task || ''), currentLocale === 'en-US' ? 28 : 18);
  if (agent.speech) return agent.speech;
  if (currentLocale === 'en-US') {
    if (agent.state === 'planning') return task ? `Plan: ${task}` : 'Planning route…';
    if (agent.state === 'thinking') return task ? `Think: ${task}` : 'Reasoning quietly';
    if (agent.state === 'working') return task ? `Doing: ${task}` : 'Running tools';
    if (agent.state === 'offline') return 'Signal lost';
    return agent.role === 'main_agent' ? 'Standing by' : '';
  }
  if (agent.state === 'planning') return task ? `規劃：${task}` : '正在拆解需求';
  if (agent.state === 'thinking') return task ? `思考：${task}` : '正在整理推理';
  if (agent.state === 'working') return task ? `執行：${task}` : '工具運作中';
  if (agent.state === 'offline') return '訊號中斷';
  return agent.role === 'main_agent' ? '待命中' : '';
}

function activityHintText(agent) {
  if (currentLocale === 'zh-TW') {
    return agent.activity_hint || roomCopy(agent);
  }
  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || strings().unknownRoom;
  if (agent.state === 'thinking') return `Reasoning quietly inside ${roomName}`;
  if (agent.state === 'planning') return `Planning steps inside ${roomName}`;
  if (agent.state === 'working') return `Using ${localizeTask(agent.task || '') || 'tools'} inside ${roomName}`;
  if (agent.state === 'offline') return 'No fresh heartbeat from the main runtime';
  return `Waiting in ${roomName} for the next task`;
}

function formatTimelineItem(item = {}) {
  const eventName = item.event_name || '';
  const toolName = item.tool_name || (item.tool_names || [])[0] || '';
  const toolLabel = localizeTask(toolName) || toolName;
  if (currentLocale === 'en-US') {
    if (eventName === 'main.reasoning') return { label: 'reasoning', message: `Reasoning: ${short(item.preview || item.message || 'planning', 84)}` };
    if (eventName === 'main.tool.started') return { label: 'tool start', message: `Started ${toolLabel}${item.preview ? ` | ${short(item.preview, 56)}` : ''}` };
    if (eventName === 'main.tool.completed') return { label: 'tool done', message: `Finished ${toolLabel}${item.preview ? ` | ${short(item.preview, 56)}` : ''}` };
    if (eventName === 'main.tool.batch') return { label: 'tool route', message: `Tool route: ${localizeTask((item.tool_names || []).join(', ')) || short(item.preview || 'batch', 72)}` };
    if (eventName === 'main.task.completed') return { label: 'complete', message: short(item.preview || item.message || 'Returned to standby', 84) };
    if (item.type === 'tool') return { label: 'tool', message: `Tool step: ${toolLabel || short(item.message || 'step', 72)}` };
    if (item.type === 'thought') return { label: 'thought', message: `Thinking: ${short(item.preview || item.message || 'planning', 84)}` };
    if (item.type === 'status') return { label: 'status', message: `Status: ${short(item.message || 'updated', 84)}` };
  }
  if (eventName === 'main.reasoning') return { label: '規劃', message: `主代理正在規劃：${short(item.preview || item.message || '正在整理思路', 84)}` };
  if (eventName === 'main.tool.started') return { label: '工具啟動', message: `開始使用 ${toolLabel || '工具'}${item.preview ? `｜${short(item.preview, 56)}` : ''}` };
  if (eventName === 'main.tool.completed') return { label: '工具完成', message: `完成 ${toolLabel || '工具'}${item.preview ? `｜${short(item.preview, 56)}` : ''}` };
  if (eventName === 'main.tool.batch') return { label: '工具序列', message: `目前工具：${localizeTask((item.tool_names || []).join(', ')) || short(item.preview || '工具步驟', 72)}` };
  if (eventName === 'main.task.completed') return { label: '完成', message: short(item.preview || item.message || '回到待命站', 84) };
  if (item.type === 'tool') return { label: '工具', message: `工具步驟：${toolLabel || short(item.message || '步驟', 72)}` };
  if (item.type === 'thought') return { label: '思考', message: `思考中：${short(item.preview || item.message || '規劃', 84)}` };
  if (item.type === 'status') return { label: '狀態', message: short(item.message || '已更新', 84) };
  return { label: item.type || 'action', message: short(item.message || item.to || strings().noActions, 84) };
}

function applyCameraTransform(active = false) {
  if (!dom.cameraStage || !dom.world) return;
  dom.cameraStage.style.setProperty('--camera-x', `${cameraOffset.x}px`);
  dom.cameraStage.style.setProperty('--camera-y', `${cameraOffset.y}px`);
  dom.cameraStage.style.setProperty('--camera-scale', String(cameraScale));
  dom.cameraStage.classList.toggle('is-panning', active);
  dom.world.classList.toggle('panning', active);
}

function clampCamera(next) {
  if (!dom.cameraStage || !dom.world) return next;
  return clampCameraOffset(next, {
    width: dom.world.clientWidth,
    height: dom.world.clientHeight,
  }, {
    width: dom.cameraStage.offsetWidth,
    height: dom.cameraStage.offsetHeight,
  }, cameraScale);
}

function displayAgentName(agent) {
  const name = agent.full_name || agent.name || 'agent';
  if (currentLocale === 'zh-TW') return name;
  if (name === 'API 工作階段') return 'API Session';
  if (name === 'CLI 工作階段') return 'CLI Session';
  if (name === 'Gateway 工作階段') return 'Gateway Session';
  return name;
}

function eventTitle(item = {}) {
  if (currentLocale === 'zh-TW') {
    if (item.kind === 'main.task.started') return '主代理開始處理任務';
    if (item.kind === 'main.reasoning') return '主代理正在規劃';
    if (item.kind === 'main.tool.batch') return '主代理切換到工具序列';
    if (item.kind === 'main.tool.started') return '主代理工具啟動';
    if (item.kind === 'main.tool.completed') return '主代理工具完成';
    if (item.kind === 'main.task.completed') return '主代理任務完成';
    return item.title || EVENT_TITLES['zh-TW'][item.kind] || item.kind || 'event';
  }
  if (item.kind === 'main.task.started') return 'Main task started';
  if (item.kind === 'main.reasoning') return 'Main agent reasoning';
  if (item.kind === 'main.tool.batch') return 'Main tool route';
  if (item.kind === 'main.tool.started') return 'Main tool started';
  if (item.kind === 'main.tool.completed') return 'Main tool completed';
  if (item.kind === 'main.task.completed') return 'Main task completed';
  return EVENT_TITLES['en-US'][item.kind] || item.title || item.kind || 'event';
}

function eventSummary(item = {}) {
  if (currentLocale === 'zh-TW') {
    if (item.summary) return item.summary;
    const payload = item.payload || {};
    const action = payload.action || {};
    if (item.kind === 'main.reasoning') return short(action.preview || action.message || '正在整理思路', 54);
    if (item.kind === 'main.tool.started') return `開始使用 ${localizeTask(action.tool_name || '') || action.tool_name || '工具'}${action.preview ? `｜${short(action.preview, 36)}` : ''}`;
    if (item.kind === 'main.tool.completed') return `完成 ${localizeTask(action.tool_name || '') || action.tool_name || '工具'}${action.preview ? `｜${short(action.preview, 36)}` : ''}`;
    if (item.kind === 'main.tool.batch') return localizeTask((action.tool_names || []).join(', ')) || short(action.preview || '工具步驟', 54);
    if (item.kind === 'main.task.completed') return short(action.preview || action.message || '任務已完成，回到待命站', 54);
    return '';
  }
  const payload = item.payload || {};
  if (item.kind === 'heartbeat') return `State: ${stateText(payload.state || 'idle')} | ${localizeTask(payload.task || '') || 'Idle'}`;
  if (item.kind === 'main.reasoning') {
    const action = payload.action || {};
    return `Reasoning: ${short(action.preview || action.message || 'planning', 54)}`;
  }
  if (item.kind === 'main.tool.started') {
    const action = payload.action || {};
    return `Started ${localizeTask(action.tool_name || '') || action.tool_name || 'tool'}${action.preview ? ` | ${short(action.preview, 32)}` : ''}`;
  }
  if (item.kind === 'main.tool.completed') {
    const action = payload.action || {};
    return `Finished ${localizeTask(action.tool_name || '') || action.tool_name || 'tool'}${action.preview ? ` | ${short(action.preview, 32)}` : ''}`;
  }
  if (item.kind === 'main.tool.batch') {
    const action = payload.action || {};
    return `Tool route: ${localizeTask((action.tool_names || []).join(', ')) || short(action.preview || 'batch', 46)}`;
  }
  if (item.kind === 'main.task.completed') {
    const action = payload.action || {};
    return short(action.preview || action.message || 'Returned to standby', 54);
  }
  if (item.kind === 'action') {
    const action = payload.action || {};
    if (action.type === 'tool') {
      const raw = (action.message || '').split('：').pop().trim();
      return `Tool step: ${localizeTask(raw) || short(action.message || 'Tool step', 54)}`;
    }
    if (action.type === 'thought') {
      const raw = (action.message || '').split('：').pop().trim();
      return `Thinking: ${short(raw || action.message || 'Planning', 54)}`;
    }
    if (action.type === 'status') return `Status: ${short(action.message || 'Updated', 54)}`;
    return short(action.message || 'Action update', 54);
  }
  if (item.kind === 'hermes.status') return `Gateway: ${payload.gateway_state || 'unknown'} | active sessions: ${payload.active_sessions || 0}`;
  if (item.kind === 'hermes.subagent') {
    const status = stateText(payload.status === 'running' ? 'working' : payload.status || 'idle');
    return `${short(payload.goal || payload.agent || 'Subagent', 42)} | ${localizeTask(payload.current_tool || '') || payload.current_tool || 'No tool'} | ${status}`;
  }
  if (item.kind === 'hermes.subagent.event') {
    const tool = localizeTask(payload.tool_name || '') || payload.tool_name || 'step';
    const detail = short(payload.text || '', 46);
    return `${short(payload.goal || payload.agent || 'Subagent', 32)} | tool: ${tool}${detail ? ` | ${detail}` : ''}`;
  }
  if (item.kind === 'hermes.session') return `${short(payload.title || payload.session_id || 'session', 42)} | ${payload.active ? 'active' : 'recent'}`;
  if (item.kind === 'webhook.registered') return short(payload.url || 'registered', 54);
  if (item.kind === 'webhook.removed') return short(payload.agent || 'removed', 54);
  return item.summary || '';
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function applyStaticCopy() {
  const copy = strings();
  document.documentElement.lang = currentLocale === 'zh-TW' ? 'zh-Hant' : 'en';
  dom.body.dataset.locale = currentLocale;
  setText('brand-title', copy.brandTitle);
  setText('brand-subtitle', copy.brandSubtitle);
  setText('inspector-title', copy.inspectorTitle);
  setText('event-belt-title', copy.eventBeltTitle);
  setText('summary-title', copy.worldOverview);
  setText('summary-world-label', copy.connectionLabel);
  setText('summary-agent-label', copy.agentsVisible);
  setText('summary-subagent-label', copy.subagentsVisible);
  setText('summary-session-label', copy.sessionsVisible);
  setText('language-label', copy.languageLabel);
  setText('core-wing-label', copy.coreWing);
  setText('clone-wing-label', copy.cloneWing);
  setText('legend-title', copy.worldLegend);
  setText('legend-thinking-title', copy.legendThinkingTitle);
  setText('legend-thinking-body', copy.legendThinkingBody);
  setText('legend-planning-title', copy.legendPlanningTitle);
  setText('legend-planning-body', copy.legendPlanningBody);
  setText('legend-working-title', copy.legendWorkingTitle);
  setText('legend-working-body', copy.legendWorkingBody);
  setText('legend-idle-title', copy.legendIdleTitle);
  setText('legend-idle-body', copy.legendIdleBody);
  setText('legend-offline-title', copy.legendOfflineTitle);
  setText('legend-offline-body', copy.legendOfflineBody);
  dom.languageButtons.forEach((button) => button.classList.toggle('active', button.dataset.localeSwitch === currentLocale));
  if (!selectedAgentId) {
    dom.inspectorBody.className = 'empty';
    dom.inspectorBody.textContent = copy.inspectorEmpty;
  }
  renderDistricts();
  repaintAgents();
}

function renderDistricts() {
  const copy = strings();
  document.querySelectorAll('.district').forEach((district) => {
    const roomKey = district.dataset.room;
    const layoutRect = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
    district.style.left = `${layoutRect.left}%`;
    district.style.top = `${layoutRect.top}%`;
    district.style.width = `${layoutRect.width}%`;
    district.style.height = `${layoutRect.height}%`;
    const room = getRoomCopy(roomKey, currentLocale);
    const roomTheme = getAppleDogRoomTheme(roomKey) || getKenneyRoomTheme(roomKey);
    const layout = getKenneyRoomLayout(roomKey);
    district.style.setProperty('--district-floor-tile', `url("${roomTheme.floorTile}")`);
    district.style.setProperty('--district-floor-color', roomTheme.floorColor || '#d4c196');
    district.style.setProperty('--district-wall-tile', `url("${roomTheme.wallTile}")`);
    district.style.setProperty('--district-rug-color', roomTheme.rugColor || 'rgba(102,75,48,0.14)');
    district.style.setProperty('--district-accent-color', roomTheme.accentColor || 'rgba(255,255,255,0.12)');
    district.style.setProperty('--district-floor-size', roomTheme.floorSize || '24px 24px');
    district.style.setProperty('--district-wall-size', roomTheme.wallSize || '64px 64px');
    const labelEl = district.querySelector('.district-label');
    if (labelEl) {
      labelEl.innerHTML = `<span>${roomKey === 'think_lab' ? '💡' : roomKey === 'blueprint_lab' ? '🗺️' : roomKey === 'tool_forge' ? '🛠️' : roomKey === 'response_studio' ? '📨' : roomKey === 'standby_dock' ? '🛏️' : roomKey === 'clone_bay' ? '🧬' : '🗂️'}</span><div><strong>${room.name}</strong><div class="district-subtitle">${room.subtitle}</div></div>`;
    }

    const floorAccentLayer = district.querySelector('.district-floor-accents');
    if (floorAccentLayer) {
      floorAccentLayer.innerHTML = layout.floorAccents.map((item) => `
        <div class="tile-accent ${item.key}" style="left:${item.left}%;top:${item.top}%;width:${item.width}%;height:${item.height}%;--tile-url:url('${item.tile}');--tile-opacity:${item.opacity ?? 0.45}"></div>
      `).join('');
    }

    const semanticLayer = district.querySelector('.district-semantics');
    if (semanticLayer) {
      semanticLayer.innerHTML = layout.semanticZones.map((item) => {
        const label = copy.decor?.[item.labelKey] || item.labelKey || item.key;
        const fx = getZoneFx(item);
        return `
          <div class="semantic-zone ${item.kind || 'focus'} ${fx.className}" data-fx-intensity="${fx.intensity}" style="left:${item.left}%;top:${item.top}%;width:${item.width}%;height:${item.height}%;--tile-url:url('${item.tile}');--tile-opacity:${item.opacity ?? 0.75}" title="${label}">
            <span class="semantic-zone-label">${label}</span>
          </div>
        `;
      }).join('');
    }

    const wallLayer = district.querySelector('.district-walls');
    if (wallLayer) {
      wallLayer.innerHTML = layout.wallSegments.map((item) => `
        <div class="wall-segment ${item.key}" style="left:${item.left}%;top:${item.top}%;width:${item.width}%;height:${item.height}%;--tile-url:url('${item.tile}');--tile-opacity:${item.opacity ?? 0.75}"></div>
      `).join('');
    }

    const propLayout = roomDecorLayout(roomKey, getRoomDecor(roomKey, currentLocale));
    const propsLayer = district.querySelector('.district-props');
    if (propsLayer) {
      propsLayer.innerHTML = propLayout.map(({ prop, pos }) => {
        const appledog = getAppleDogPropSprite(prop.type);
        const useHighClarity = shouldUseHighClarityProp(prop.type);
        const kenney = appledog || useHighClarity ? null : getKenneyPropSprite(prop.type);
        const src = appledog?.src || kenney?.src || createPropSprite(prop.type);
        const scale = appledog?.scale || (useHighClarity ? 1.25 : (kenney?.scale || 1));
        const widthTiles = appledog?.widthTiles || 1;
        const heightTiles = appledog?.heightTiles || 1;
        const fx = getPropFx(prop.type, roomKey);
        const icon = INTERACTION_OBJECT_ICONS[prop.type] || '▪';
        const assetPack = appledog ? 'appledog' : kenney ? 'kenney' : 'office-fallback';
        return `
          <div class="prop ${fx.className}" data-prop-type="${prop.type}" data-asset-pack="${assetPack}" data-fx-intensity="${fx.intensity}" style="left:${pos.x}%;top:${pos.y}%;--prop-scale:${scale};--prop-width-tiles:${widthTiles};--prop-height-tiles:${heightTiles}" title="${prop.label}">
            <div class="prop-icon" aria-hidden="true">${icon}</div>
            <img alt="${prop.label}" src="${src}" data-pack="${assetPack}" />
            <div class="prop-label">${prop.label}</div>
          </div>
        `;
      }).join('');
    }
  });
  document.querySelectorAll('.room-door').forEach((door) => {
    const config = HOUSE_DOORS.find((item) => item.room === door.dataset.room);
    if (config) {
      door.style.left = `${config.left}%`;
      door.style.top = `${config.top}%`;
      door.style.width = `${config.width}%`;
      door.style.height = `${config.height}%`;
      door.dataset.side = config.side || 'bottom';
    }
    door.style.backgroundImage = `url("${getAppleDogDoorSprite() || getKenneyDoorSprite()}")`;
    door.title = `${KENNEY_PACK.name} / AppleDog door tile`;
  });
}

function setRouteDoorsOpen(roomKeys = [], open = false) {
  roomKeys
    .filter(Boolean)
    .forEach((roomKey) => {
      const door = document.querySelector(`.room-door[data-room="${roomKey}"]`);
      door?.classList.toggle('open', open);
    });
}

function renderInspector(agent) {
  const copy = strings();
  if (!agent) {
    dom.inspectorBody.className = 'empty';
    dom.inspectorBody.textContent = copy.inspectorEmpty;
    return;
  }
  const actions = (agent.recent_actions || []).slice(0, 5).map((item) => {
    const details = formatTimelineItem(item);
    return `<div class="timeline-item"><strong>${details.label}</strong><br>${details.message}</div>`;
  }).join('') || `<div class="empty">${copy.noActions}</div>`;

  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || copy.unknownRoom;
  const currentTask = localizeTask(agent.task) || agent.activity_hint || copy.idleFallback;
  dom.inspectorBody.className = '';
  dom.inspectorBody.innerHTML = `
    <div class="inspector-card">
      <div>
        <div class="subtitle">${roleLabel(agent.role)}</div>
        <div class="strong">${displayAgentName(agent)}</div>
      </div>
      <div class="pill-row">
        <span class="pill">${agent.room_icon || '📍'} ${roomName}</span>
        <span class="pill">${stateText(agent.state)}</span>
        ${agent.tool_label || agent.task ? `<span class="pill">${agent.tool_icon || '✨'} ${localizeTask(agent.task || agent.tool_label)}</span>` : ''}
        ${agent.session_id ? `<span class="pill">${copy.sessionLabel(agent.session_id)}</span>` : ''}
      </div>
      <div class="stat-grid">
        <div class="stat">${copy.currentTask}<br><span class="strong">${currentTask}</span></div>
        <div class="stat">${copy.lastUpdate}<br><span class="strong">${ageText(agent.age_seconds || 0)}</span></div>
        <div class="stat">${copy.roomMeaning}<br><span class="strong">${activityHintText(agent)}</span></div>
        <div class="stat">${copy.eventCount}<br><span class="strong">${agent.event_count ?? (agent.recent_actions || []).length}</span></div>
      </div>
    </div>
    <div class="inspector-card">
      <div class="subtitle">${copy.timelineTitle}</div>
      ${actions}
    </div>
  `;
}

function closeAgentDialog() {
  activeDialogAgentId = null;
  dom.dialogBackdrop?.classList.remove('show');
}

function openAgentDialog(agent) {
  if (!agent || !dom.dialogBackdrop || !dom.dialogPanel) return;
  const detail = buildAgentDialog(agent, currentLocale);
  activeDialogAgentId = agent.agent;
  dom.dialogTitle.textContent = detail.title;
  dom.dialogBody.textContent = detail.body;
  dom.dialogRows.innerHTML = detail.rows.map((row) => `
    <div class="dialog-row">
      <span class="muted">${row.label}</span>
      <strong>${row.value}</strong>
    </div>
  `).join('');
  dom.dialogBackdrop.classList.add('show');
}

function createAgentElement(agent) {
  const el = document.createElement('div');
  el.className = 'agent';
  el.dataset.agentId = agent.agent;
  el.innerHTML = `
    <div class="agent-speech"></div>
      <div class="sprite-wrap">
        <div class="beam"></div>
        <div class="object-chip"></div>
        <div class="role-chip"></div>
        <div class="tool-chip"></div>
        <div class="pose-chip"></div>
      <div class="event-chip"></div>
      <img class="agent-pixel" alt="${agent.name}" />
    </div>
    <div class="agent-card">
      <div class="agent-name"><span class="state-dot"></span><span class="agent-name-text"></span></div>
      <div class="agent-room"></div>
      <div class="agent-meta"></div>
    </div>
  `;
  const openDetail = (event) => {
    event.stopPropagation();
    const current = agentViews.get(agent.agent)?.data || agent;
    openAgentDialog(current);
  };
  el.querySelector('.agent-speech')?.addEventListener('click', openDetail);
  el.querySelector('.event-chip')?.addEventListener('click', openDetail);
  el.addEventListener('click', () => {
    selectedAgentId = agent.agent;
    repaintAgents();
    renderInspector(agentViews.get(agent.agent)?.data || agent);
  });
  dom.agentsLayer.appendChild(el);
  return el;
}

function ensureAgentView(agent) {
  if (!agentViews.has(agent.agent)) {
    const el = createAgentElement(agent);
    agentViews.set(agent.agent, {
      el,
      data: agent,
      currentX: agent.x || 0,
      currentY: agent.y || 0,
      motionToken: 0,
      patrolIndex: 0,
      frame: 0,
      facing: 'right',
      lastPatrolKey: '',
      nextPatrolAt: 0,
      pathTimeout: null,
      pathEl: null,
      walkFrameTimer: null,
    });
  }
  return agentViews.get(agent.agent);
}

function decorateAgent(view) {
  const agent = view.data;
  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || strings().unknownRoom;
  const displayTask = short(localizeTask(agent.task) || agent.activity_hint || strings().idleFallback, currentLocale === 'en-US' ? 28 : 24);
  const speechEl = view.el.querySelector('.agent-speech');
  const beamEl = view.el.querySelector('.beam');
  const objectChipEl = view.el.querySelector('.object-chip');
  const roleChipEl = view.el.querySelector('.role-chip');
  const toolChipEl = view.el.querySelector('.tool-chip');
  const poseChipEl = view.el.querySelector('.pose-chip');
  const eventChipEl = view.el.querySelector('.event-chip');
  const imgEl = view.el.querySelector('.agent-pixel');
  const nameText = view.el.querySelector('.agent-name-text');
  const roomEl = view.el.querySelector('.agent-room');
  const metaEl = view.el.querySelector('.agent-meta');
  const dotEl = view.el.querySelector('.state-dot');
  const pose = getAgentPose(agent);
  const interaction = view.interactionTarget || activityTarget(agent, 0);
  const eventVisual = deriveAgentEventVisual(agent, currentLocale);
  const bubble = buildAgentSpeech(agent, currentLocale);
  view.el.classList.toggle('selected', selectedAgentId === agent.agent);
  view.el.classList.toggle('walking', !!view.isMoving);
  view.el.classList.toggle('at-interaction', !!interaction?.propType && !view.isMoving);
  ['idle', 'thinking', 'planning', 'working', 'offline'].forEach((state) => view.el.classList.toggle(state, agent.state === state));
  ['ponder', 'planning', 'terminal', 'dispatch', 'notes', 'writing', 'rest', 'neutral'].forEach((name) => view.el.classList.toggle(`pose-${name}`, pose.pose === name));
  beamEl.className = `beam ${agent.state || 'idle'}`;
  objectChipEl.textContent = interaction?.objectIcon || INTERACTION_OBJECT_ICONS[interaction?.propType] || '';
  objectChipEl.title = interactionCopy(interaction);
  objectChipEl.dataset.propType = interaction?.propType || '';
  objectChipEl.classList.toggle('show', !!interaction?.propType && !view.isMoving);
  roleChipEl.textContent = roleChip(agent.role);
  toolChipEl.textContent = agent.tool_icon || eventVisual.icon || '✨';
  toolChipEl.title = localizeTask(agent.task || agent.tool_label || '') || strings().idleFallback;
  poseChipEl.textContent = pose.icon || '✨';
  poseChipEl.title = pose.pose || 'pose';
  eventChipEl.textContent = `${eventVisual.icon} ${short(eventVisual.label, currentLocale === 'en-US' ? 16 : 10)}`;
  eventChipEl.title = eventVisual.detail || eventVisual.label || '';
  eventChipEl.className = `event-chip ${eventVisual.tone || 'idle'}`;
  eventChipEl.classList.toggle('show', !!eventVisual.label);
  eventChipEl.classList.toggle('clickable', !!bubble.clickable);
  const sprite = getKenneyAgentSprite({ role: agent.role, state: agent.state, color: agent.color, facing: view.facing, frame: view.frame });
  imgEl.src = sprite?.src || createAgentSprite({ role: agent.role, state: agent.state, color: agent.color, facing: view.facing, frame: view.frame });
  imgEl.dataset.pack = sprite?.src ? 'kenney' : 'fallback';
  imgEl.style.transform = sprite?.flipX ? 'scaleX(-1)' : '';
  imgEl.alt = agent.name;
  nameText.textContent = displayAgentName(agent);
  roomEl.textContent = `${agent.room_icon || '📍'} ${roomName}`;
  metaEl.textContent = agent.role === 'main_agent'
    ? short(interactionCopy(interaction) || eventVisual.detail || displayTask, currentLocale === 'en-US' ? 32 : 26)
    : displayTask;
  dotEl.className = `state-dot ${agent.state || 'idle'}`;
  speechEl.textContent = bubble.summary;
  speechEl.title = bubble.detail || bubble.summary || '';
  speechEl.classList.toggle('show', !!bubble.summary);
  speechEl.classList.toggle('clickable', !!bubble.clickable);
}

function updateAgentPosition(view, x, y) {
  const dx = x - view.currentX;
  const dy = y - view.currentY;
  view.facing = getFacingFromDelta(dx, dy, view.facing || 'right');
  view.frame = nextWalkFrame(view.frame, !!view.isMoving);
  view.currentX = x;
  view.currentY = y;
  view.el.style.left = `${x}%`;
  view.el.style.top = `${y}%`;
}

function clearWalkFrameTimer(view) {
  if (!view.walkFrameTimer) return;
  window.clearInterval(view.walkFrameTimer);
  view.walkFrameTimer = null;
}

function startWalkFrameTimer(view, token) {
  clearWalkFrameTimer(view);
  view.walkFrameTimer = window.setInterval(() => {
    if (token !== view.motionToken || !view.isMoving) {
      clearWalkFrameTimer(view);
      return;
    }
    view.frame = nextWalkFrame(view.frame, true);
    decorateAgent(view);
  }, 170);
}

function clearAgentPath(view) {
  if (view.pathTimeout) {
    clearTimeout(view.pathTimeout);
    view.pathTimeout = null;
  }
  if (view.pathEl) {
    view.pathEl.remove();
    view.pathEl = null;
  }
}

function drawPath(view) {
  clearAgentPath(view);
}

function moveAlongRoute(view, route, state, { patrol = false, routeDoors = [] } = {}) {
  const token = ++view.motionToken;
  const duration = movementDurationMs(route, state);
  let elapsed = 0;
  view.isMoving = true;
  setRouteDoorsOpen(routeDoors, true);
  startWalkFrameTimer(view, token);
  decorateAgent(view);
  drawPath(view);

  const step = (index) => {
    if (token !== view.motionToken) return;
    if (index >= route.length) {
      view.isMoving = false;
      view.frame = 0;
      clearWalkFrameTimer(view);
      decorateAgent(view);
      return;
    }
    const point = route[index];
    const prev = index === 0 ? { x: view.currentX, y: view.currentY } : route[index - 1];
    const segmentDist = Math.hypot(point.x - prev.x, point.y - prev.y);
    const totalDist = Math.max(1, route.slice(1).reduce((acc, item, idx) => acc + Math.hypot(item.x - route[idx].x, item.y - route[idx].y), 0));
    const segmentMs = index === 0 ? 0 : Math.max(180, Math.round((segmentDist / totalDist) * duration));
    view.el.style.transitionDuration = `${segmentMs}ms`;
    updateAgentPosition(view, point.x, point.y);
    elapsed += segmentMs;
    if (index === route.length - 1) {
      window.setTimeout(() => {
        if (token === view.motionToken) {
          view.isMoving = false;
          view.frame = 0;
          clearWalkFrameTimer(view);
          setRouteDoorsOpen(routeDoors, false);
          decorateAgent(view);
          if (!patrol) view.nextPatrolAt = performance.now() + 1200;
          const pending = view.pendingMove;
          view.pendingMove = null;
          if (pending) {
            maybeMoveAgent(view, pending.agent, pending.targetX, pending.targetY, pending.roomKey, pending.options);
          }
        }
      }, segmentMs + 40);
      return;
    }
    window.setTimeout(() => step(index + 1), segmentMs + 24);
  };

  step(0);
}

function maybeMoveAgent(view, agent, targetX, targetY, roomKey, options = {}) {
  if (view.isMoving && !options.patrol) {
    view.pendingMove = {
      agent,
      targetX,
      targetY,
      roomKey,
      options: {
        ...options,
        fromRoomKey: view.data.room_key || options.fromRoomKey || roomKey,
      },
    };
    return;
  }
  const fromRoomKey = options.fromRoomKey || view.data.room_key || roomKey;
  const route = buildRoute({ x: view.currentX, y: view.currentY }, { x: targetX, y: targetY }, fromRoomKey, roomKey);
  const noMove = route.length < 2 || route.every((item, idx) => idx === 0 || (Math.abs(item.x - route[idx - 1].x) < 0.2 && Math.abs(item.y - route[idx - 1].y) < 0.2));
  view.data = { ...agent, x: targetX, y: targetY, room_key: roomKey };
  if (Object.hasOwn(options, 'interactionTarget')) view.interactionTarget = options.interactionTarget;
  decorateAgent(view);
  if (!noMove) moveAlongRoute(view, route, agent.state, { ...options, routeDoors: fromRoomKey === roomKey ? [roomKey] : [fromRoomKey, roomKey] });
  else updateAgentPosition(view, targetX, targetY);
}

function patrolActiveAgents() {
  const now = performance.now();
  agentViews.forEach((view) => {
    const agent = view.data;
    if (!shouldPatrol(agent.state) || view.isMoving || now < view.nextPatrolAt) return;
    view.patrolIndex = (view.patrolIndex + 1) % 3;
    const patrol = activityPoint(agent, view.patrolIndex) || patrolPoint(agent.room_key, view.patrolIndex);
    const patrolKey = `${agent.room_key}:${view.patrolIndex}:${agent.state}:${semanticFocus(agent)}`;
    if (patrolKey === view.lastPatrolKey) return;
    view.lastPatrolKey = patrolKey;
    maybeMoveAgent(view, { ...agent, x: patrol.x, y: patrol.y }, patrol.x, patrol.y, agent.room_key, { patrol: true, interactionTarget: null });
    view.nextPatrolAt = now + 2600;
  });
}

function repaintAgents() {
  agentViews.forEach((view) => decorateAgent(view));
}

function renderAgents(snapshot) {
  const seen = new Set();
  const agents = snapshot.agents || [];
  agents.forEach((agent) => {
    seen.add(agent.agent);
    const view = ensureAgentView(agent);
    const previous = view.data || {};
    const target = activityTarget(agent, view.patrolIndex || 0);
    const targetChanged = previous.room_key !== agent.room_key
      || Math.abs((previous.x || 0) - target.x) > 0.25
      || Math.abs((previous.y || 0) - target.y) > 0.25;
    const stateChanged = previous.state !== agent.state || previous.task !== agent.task || previous.activity_hint !== agent.activity_hint;
    if (!view.el.style.left) updateAgentPosition(view, target.x || 0, target.y || 0);
    if (targetChanged || stateChanged) {
      view.lastPatrolKey = '';
      maybeMoveAgent(view, { ...agent, x: target.x, y: target.y }, target.x || 0, target.y || 0, agent.room_key || 'standby_dock', {
        fromRoomKey: previous.room_key || agent.room_key || 'standby_dock',
        interactionTarget: target.propType ? target : null,
      });
    } else {
      view.data = { ...agent, x: target.x, y: target.y };
      view.interactionTarget = target.propType ? target : null;
      decorateAgent(view);
    }
  });

  Array.from(agentViews.keys()).forEach((agentId) => {
    if (!seen.has(agentId)) {
      const view = agentViews.get(agentId);
      clearAgentPath(view);
      view.el.remove();
      agentViews.delete(agentId);
    }
  });

  if (!selectedAgentId && agents[0]) {
    selectedAgentId = agents[0].agent;
    renderInspector(agents[0]);
  } else if (selectedAgentId) {
    renderInspector(agents.find((item) => item.agent === selectedAgentId) || agents[0]);
  }
  if (activeDialogAgentId) {
    const active = agents.find((item) => item.agent === activeDialogAgentId);
    if (active) openAgentDialog(active);
    else closeAgentDialog();
  }
}

function renderEvents(items = []) {
  const copy = strings();
  dom.eventSummary.textContent = items.length ? copy.recentCount(items.length) : copy.noEvents;
  if (!items.length) {
    dom.events.innerHTML = `<div class="event-card"><div class="empty">${copy.waitingEvents}</div></div>`;
    return;
  }
  dom.events.innerHTML = items.map((item) => `
    <div class="event-card">
      <div class="event-top">
        <span>${item.icon || '✨'} ${eventTitle(item)}</span>
        <span class="muted">${new Date(item.time).toLocaleTimeString(currentLocale, { hour12: false })}</span>
      </div>
      <div class="event-summary">${eventSummary(item)}</div>
    </div>
  `).join('');
}

function renderSnapshot(snapshot) {
  currentSnapshot = snapshot;
  const copy = strings();
  dom.agentCount.textContent = String(snapshot.stats.agent_count || 0);
  dom.subagentCount.textContent = String(snapshot.stats.subagent_count || 0);
  dom.sessionCount.textContent = String(snapshot.stats.branch_session_count || snapshot.stats.active_session_count || 0);
  dom.worldState.textContent = snapshot.stats.hermes_connected ? copy.hermesConnected : copy.localOnly;
  dom.worldSummary.textContent = summarizeWorld(snapshot.stats, currentLocale);
  dom.lastSync.textContent = `${copy.lastSyncPrefix} ${new Date(snapshot.server_time_ms).toLocaleTimeString(currentLocale, { hour12: false })}`;
  renderAgents(snapshot);
  renderEvents(snapshot.events || []);
}

async function refresh() {
  const copy = strings();
  try {
    const res = await fetch('/api/world', { cache: 'no-store' });
    const snapshot = await res.json();
    renderSnapshot(snapshot);
  } catch (err) {
    dom.worldState.textContent = copy.readFailed;
    dom.worldSummary.textContent = err.message;
    renderEvents([]);
  }
}

function startPolling() {
  if (pollTimer) clearInterval(pollTimer);
  refresh();
  pollTimer = window.setInterval(refresh, 2000);
}

function connectRealtime() {
  if (!supportsEventStream(window)) {
    startPolling();
    return;
  }
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  if (liveStream) liveStream.close();
  const streamUrl = buildStreamUrl(window.location.href) + (lastStreamId ? `?since=${lastStreamId}` : '');
  liveStream = new window.EventSource(streamUrl);
  liveStream.addEventListener('world.update', (message) => {
    const payload = parseStreamMessage(message.data);
    if (payload.id) lastStreamId = payload.id;
    if (payload.snapshot) renderSnapshot(payload.snapshot);
  });
  liveStream.onerror = () => {
    if (liveStream) {
      liveStream.close();
      liveStream = null;
    }
    startPolling();
    window.setTimeout(() => {
      if (!liveStream) connectRealtime();
    }, 2500);
  };
}

function setupDraggablePanels() {
  dom.panels.forEach((panel) => {
    const key = panel.dataset.draggablePanel;
    const saved = localStorage.getItem(`pixelverse:panel:${key}`);
    if (saved) {
      try {
        const offset = JSON.parse(saved);
        panel.dataset.offsetX = String(offset.x || 0);
        panel.dataset.offsetY = String(offset.y || 0);
        panel.style.transform = `translate3d(${offset.x || 0}px, ${offset.y || 0}px, 0)`;
      } catch {}
    }
  });

  dom.panelHandles.forEach((handle) => {
    handle.addEventListener('pointerdown', (event) => {
      const panel = handle.closest('[data-draggable-panel]');
      if (!panel) return;
      panelDragging = {
        panel,
        start: {
          x: Number(panel.dataset.offsetX || 0),
          y: Number(panel.dataset.offsetY || 0),
        },
        pointer: { x: event.clientX, y: event.clientY },
      };
      handle.setPointerCapture?.(event.pointerId);
      panel.classList.add('dragging');
      event.preventDefault();
      event.stopPropagation();
    });
  });

  window.addEventListener('pointermove', (event) => {
    if (panelDragging) {
      const delta = { x: event.clientX - panelDragging.pointer.x, y: event.clientY - panelDragging.pointer.y };
      const next = nextDraggedOffset(panelDragging.start, delta);
      panelDragging.panel.dataset.offsetX = String(next.x);
      panelDragging.panel.dataset.offsetY = String(next.y);
      panelDragging.panel.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
      return;
    }
    if (!cameraPanning) return;
    const delta = { x: event.clientX - cameraPanning.pointer.x, y: event.clientY - cameraPanning.pointer.y };
    cameraOffset = clampCamera(nextDraggedOffset(cameraPanning.start, delta));
    applyCameraTransform(true);
  });

  window.addEventListener('pointerup', () => {
    if (panelDragging) {
      const panel = panelDragging.panel;
      localStorage.setItem(`pixelverse:panel:${panel.dataset.draggablePanel}`, JSON.stringify({
        x: Number(panel.dataset.offsetX || 0),
        y: Number(panel.dataset.offsetY || 0),
      }));
      panel.classList.remove('dragging');
      panelDragging = null;
    }
    if (cameraPanning) {
      cameraPanning = null;
      applyCameraTransform(false);
    }
  });
}

function setupCameraPan() {
  if (!dom.world || !dom.cameraStage) return;
  const viewport = () => ({ width: dom.world.clientWidth, height: dom.world.clientHeight });
  const stage = () => ({ width: dom.cameraStage.offsetWidth, height: dom.cameraStage.offsetHeight });
  const recenter = () => {
    cameraScale = clampZoom(cameraScale);
    cameraOffset = centeredCamera(viewport(), stage(), cameraScale);
    applyCameraTransform(false);
  };
  recenter();
  window.addEventListener('resize', recenter);
  dom.world.addEventListener('pointerdown', (event) => {
    if (event.target.closest('.agent-speech') || event.target.closest('.event-chip') || event.target.closest('.speech-dialog')) return;
    if (event.target.closest('.agent') || event.target.closest('[data-draggable-panel]') || event.target.closest('button')) {
      if (!event.target.closest('.speech-dialog')) closeAgentDialog();
      return;
    }
    closeAgentDialog();
    cameraPanning = {
      start: { ...cameraOffset },
      pointer: { x: event.clientX, y: event.clientY },
    };
    dom.world.setPointerCapture?.(event.pointerId);
    applyCameraTransform(true);
    event.preventDefault();
  });
  dom.world.addEventListener('wheel', (event) => {
    if (event.target.closest('[data-draggable-panel]')) return;
    const rect = dom.world.getBoundingClientRect();
    const pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    const next = nextZoomState({
      offset: cameraOffset,
      scale: cameraScale,
      viewport: viewport(),
      stage: stage(),
      pointer,
      deltaY: event.deltaY,
    });
    cameraOffset = next.offset;
    cameraScale = next.scale;
    applyCameraTransform(false);
    event.preventDefault();
  }, { passive: false });
}

function setLocale(locale) {
  currentLocale = normalizeLocale(locale);
  localStorage.setItem('pixelverse:locale', currentLocale);
  applyStaticCopy();
  if (currentSnapshot) renderSnapshot(currentSnapshot);
}

dom.languageButtons.forEach((button) => {
  button.addEventListener('click', () => setLocale(button.dataset.localeSwitch));
});

dom.dialogBackdrop?.addEventListener('click', (event) => {
  if (!event.target.closest('.speech-dialog')) closeAgentDialog();
});

applyStaticCopy();
setupDraggablePanels();
setupCameraPan();
connectRealtime();
if (patrolTimer) clearInterval(patrolTimer);
patrolTimer = window.setInterval(patrolActiveAgents, 1500);

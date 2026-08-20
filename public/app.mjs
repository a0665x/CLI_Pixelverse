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
  activityHintForLocale,
  agentTaskText,
  agentToolText,
  agentTooltipText,
  ambientText,
  furnitureCoordinateText,
  furnitureLabelForLocale,
  getLocaleLabel,
  getLocaleStrings,
  getRoomCopy,
  getRoomDecor,
  eventSummaryForLocale,
  eventTitleForLocale,
  LOCALE_LABELS,
  localizeToolSummary,
  normalizeLocale,
  interactionText,
  poseLabelForLocale,
  summarizeWorld,
  SUPPORTED_LOCALES,
  timelineItemForLocale,
  uiText,
} from './ui_strings.mjs';
import {
  buildStreamUrl,
  parseStreamMessage,
  supportsEventStream,
} from './realtime.mjs';
import {
  attachPageLifecycleCleanup,
  attachPixelworldBridge,
  commandDeckFocusSelection,
  createCutawayStatusRailController,
  createPixelworldBridge,
} from './pixelworld_embed.mjs';
import {
  legacyResizablePanels,
  setupWorkbenchLayoutController,
  workbenchTopFor,
} from './workbench_layout.mjs';
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
  refreshFurnitureBlockers,
  shouldPatrol,
  snapToWalkable,
} from './world_motion.mjs';
import { getAgentPose, INTERACTION_OBJECT_ICONS, selectInteractionTarget } from './agent_pose.mjs';
import { buildAgentDialog, buildAgentSpeech } from './agent_dialog.mjs';
import { createCommandDeckLocaleController } from './command_deck_locale_controller.mjs';
import { clampCameraOffset, centeredCamera, clampZoom, nextDraggedOffset, nextZoomState } from './ui_state.mjs';
import { CORRIDOR_RECTS, GLOBAL_MAP, HOUSE_DOORS, loadGlobalMap, roomMapCopy, ROOM_LAYOUTS, ROOM_STATE_GROUPS } from './house_layout.mjs';
import { hookStateRoutes } from './hook_state_map.mjs';
import { deriveAgentEventVisual } from './main_agent_events.mjs';
import { getAppleDogDoorSprite, getAppleDogPropSprite, getAppleDogRoomTheme } from './appledog_assets.mjs';
import { shouldUseHighClarityProp } from './office_life_assets.mjs';
import {
  exportFurnitureLayout,
  FURNITURE_SIZE_MULTIPLIER,
  getRoomPropPositions,
  positionOverlapsFurniture,
  roomDecorLayout,
  roomInteractionPositions,
  setFurnitureLayoutOverrides,
} from './room_furniture.mjs';
import {
  buildGridLines,
  clampPercent,
  dragPositionStyle,
  formatScale,
  formatPercent,
  normalizeScale,
  normalizePercent,
  resolveSnapStep,
  SCALE_STEP,
} from './furniture_editing.mjs';
import { buildAgentTimelinePanels, buildHeartbeatPath, heartbeatBeatWidthPx } from './agent_timeline_graphs.mjs';
import {
  buildLiveAgentRail,
  hookChannelsForAgents,
  hookGuideForLocale,
  hookRailForAgents,
  liveAgentPage,
  normalizeAgentForWorld,
  normalizeVisibleAgents,
} from './live_agent_rails.mjs';
import { agentOverlayClass } from './agent_overlay.mjs';
import { setupPressFeedback } from './press_feedback.mjs';
import {
  buildDashboardLiveSnapshot,
  dashboardCardItemMarkup,
  dashboardCardPage,
  dashboardCardPageSize,
  placeDashboardCard,
  renderDashboardCardView,
} from './dashboard_cards.mjs';
import {
  activeDashboardCardTrigger,
  applyMapLayerVisibility,
  createCutawayFocusHandoff,
  dashboardCardLabel as localizedDashboardCardLabel,
  dashboardInputModality,
  deferDashboardCardFocus,
  readDashboardDisclosure,
  renderDashboardCardControl,
  restoreDashboardCardFocus,
  toggleDashboardCard,
  updateLiveRegionText,
  writeDashboardDisclosure,
} from './dashboard_disclosure.mjs';
import { createLiveEcgController } from './live_ecg_controller.mjs';
import { createCommandDeckLayoutController } from './command_deck_layout.mjs';
import { buildCommandDeckModel, resolveCommandSelection } from './command_deck_model.mjs';
import { createMissionTraceController } from './mission_trace.mjs';

const ROOM_ACTIVITY_TARGETS = {
  think_lab: {
    thinking: [{ x: 44, y: 52 }, { x: 62, y: 26 }, { x: 74, y: 44 }],
    planning: [{ x: 62, y: 26 }, { x: 38, y: 20 }, { x: 44, y: 52 }],
  },
  blueprint_lab: {
    planning: [{ x: 28, y: 56 }, { x: 50, y: 18 }, { x: 74, y: 56 }],
    working: [{ x: 78, y: 26 }, { x: 18, y: 56 }, { x: 52, y: 62 }],
  },
  file_library: {
    reading_files: [{ x: 28, y: 58 }, { x: 52, y: 18 }, { x: 74, y: 52 }],
    working: [{ x: 28, y: 58 }, { x: 74, y: 52 }, { x: 52, y: 18 }],
  },
  code_workbench: {
    editing_files: [{ x: 26, y: 58 }, { x: 50, y: 22 }, { x: 74, y: 58 }],
    working: [{ x: 26, y: 58 }, { x: 74, y: 58 }, { x: 50, y: 22 }],
  },
  terminal_bay: {
    shell_command: [{ x: 24, y: 58 }, { x: 52, y: 22 }, { x: 74, y: 58 }],
    executing: [{ x: 24, y: 58 }, { x: 74, y: 58 }, { x: 52, y: 22 }],
  },
  tool_forge: {
    external_tool: [{ x: 24, y: 58 }, { x: 66, y: 56 }, { x: 54, y: 20 }],
    browsing: [{ x: 48, y: 36 }, { x: 24, y: 58 }, { x: 78, y: 18 }],
    working: [{ x: 24, y: 58 }, { x: 66, y: 56 }, { x: 54, y: 20 }],
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

const ROLE_CHIPS = {
  'zh-TW': { main_agent: '主', subagent: '分', branch_session: '支' },
  'en-US': { main_agent: 'M', subagent: 'S', branch_session: 'B' },
  'ja-JP': { main_agent: '主', subagent: '副', branch_session: '分' },
  'ko-KR': { main_agent: '주', subagent: '부', branch_session: '분' },
};

const dom = {
  agentsLayer: document.getElementById('agents-layer'),
  agentLiveList: document.getElementById('agent-live-list'),
  agentLivePage: document.getElementById('agent-live-page'),
  agentLivePrevious: document.getElementById('agent-live-previous'),
  agentLiveNext: document.getElementById('agent-live-next'),
  liveLeftSplitter: document.getElementById('live-left-splitter'),
  liveRightSplitter: document.getElementById('live-right-splitter'),
  brand: document.querySelector('.brand'),
  cameraControls: document.getElementById('camera-controls'),
  cameraStage: document.getElementById('camera-stage'),
  cancelFurnitureButton: document.getElementById('cancel-furniture-btn'),
  currentAgentState: document.getElementById('current-agent-state'),
  commandBottomSplitter: document.getElementById('command-bottom-splitter'),
  commandCollapseBottom: document.getElementById('command-collapse-bottom'),
  commandCollapseLeft: document.getElementById('command-collapse-left'),
  commandCollapseRight: document.getElementById('command-collapse-right'),
  commandResetLayout: document.getElementById('command-reset-layout'),
  commandSwapSides: document.getElementById('command-swap-sides'),
  dashboardCard: document.getElementById('dashboard-card'),
  dashboardCardBody: document.getElementById('dashboard-card-body'),
  dashboardCardItems: document.getElementById('dashboard-card-items'),
  dashboardCardButtons: Array.from(document.querySelectorAll('[data-dashboard-card]')),
  dashboardCardKicker: document.getElementById('dashboard-card-kicker'),
  dashboardCardLive: document.getElementById('dashboard-card-live'),
  dashboardCardNext: document.getElementById('dashboard-card-next'),
  dashboardCardPage: document.getElementById('dashboard-card-page'),
  dashboardCardPrevious: document.getElementById('dashboard-card-previous'),
  dashboardCardTitle: document.getElementById('dashboard-card-title'),
  dashboardHelpSettings: document.getElementById('dashboard-help-settings'),
  dashboardHelpButton: document.getElementById('dashboard-help-btn'),
  eventSummary: document.getElementById('event-summary'),
  events: document.getElementById('events'),
  missionTraceLive: document.getElementById('mission-trace-live'),
  exposureLabel: document.getElementById('exposure-label'),
  exposureSelect: document.getElementById('exposure-select'),
  exposureUrl: document.getElementById('exposure-url'),
  copyExposureButton: document.getElementById('copy-exposure-btn'),
  editFurnitureButton: document.getElementById('edit-furniture-btn'),
  furnitureEditBanner: document.getElementById('furniture-edit-banner'),
  furnitureEditDirtyLabel: document.getElementById('furniture-edit-dirty-label'),
  furnitureEditHint: document.getElementById('furniture-edit-hint'),
  furnitureEditMeta: document.getElementById('furniture-edit-meta'),
  furnitureEditModeLabel: document.getElementById('furniture-edit-mode-label'),
  furnitureCoordBody: document.getElementById('furniture-coord-body'),
  furnitureCoordHud: document.getElementById('furniture-coord-hud'),
  furnitureCoordTitle: document.getElementById('furniture-coord-title'),
  furnitureToast: document.getElementById('furniture-toast'),
  furnitureToastBody: document.getElementById('furniture-toast-body'),
  furnitureToastTitle: document.getElementById('furniture-toast-title'),
  heartbeatLabel: document.getElementById('heartbeat-label'),
  heartbeatStatus: document.getElementById('heartbeat-status'),
  hookLiveActivity: document.getElementById('hook-live-activity'),
  hookLiveAgent: document.getElementById('hook-live-agent'),
  hookLiveBuilding: document.getElementById('hook-live-building'),
  hookLiveSemantic: document.getElementById('hook-live-semantic'),
  hookLiveChannels: document.getElementById('hook-live-channels'),
  inspectorAgentSelect: document.getElementById('inspector-agent-select'),
  inspectorBody: document.getElementById('inspector-body'),
  hookStateTable: document.getElementById('hook-state-table'),
  languageSelect: document.getElementById('locale-select'),
  lastSync: document.getElementById('last-sync'),
  mapCoordinatePlane: document.getElementById('map-coordinate-plane'),
  mobileModeButton: document.getElementById('mobile-mode-btn'),
  pathLayer: document.getElementById('path-layer'),
  pixelworldFrame: document.getElementById('pixelworld-frame'),
  panels: Array.from(document.querySelectorAll('[data-draggable-panel]')),
  panelHandles: Array.from(document.querySelectorAll('[data-drag-handle]')),
  resizablePanels: Array.from(document.querySelectorAll('[data-resizable-panel]')),
  dialogBackdrop: document.getElementById('speech-dialog-backdrop'),
  dialogPanel: document.getElementById('speech-dialog'),
  dialogTitle: document.getElementById('speech-dialog-title'),
  dialogBody: document.getElementById('speech-dialog-body'),
  dialogRows: document.getElementById('speech-dialog-rows'),
  saveFurnitureButton: document.getElementById('save-furniture-btn'),
  sidebarCloseButton: document.getElementById('sidebar-close-btn'),
  sidebarTitle: document.getElementById('sidebar-title'),
  sidebarToggleButton: document.getElementById('sidebar-toggle-btn'),
  sidebarResizer: document.getElementById('sidebar-resizer'),
  sessionCount: document.getElementById('session-count'),
  subagentCount: document.getElementById('subagent-count'),
  timelineResizer: document.getElementById('timeline-resizer'),
  timelineRefreshLabel: document.getElementById('timeline-refresh-label'),
  topStatusBar: document.getElementById('top-status-bar'),
  refreshSlowerButton: document.getElementById('refresh-slower-btn'),
  refreshFasterButton: document.getElementById('refresh-faster-btn'),
  refreshRateOutput: document.getElementById('refresh-rate-output'),
  summaryPanels: Array.from(document.querySelectorAll('.panel')),
  body: document.body,
  world: document.getElementById('world'),
  workspace: document.querySelector('.map-first-workspace'),
  worldState: document.getElementById('world-state'),
  worldSummary: document.getElementById('world-summary'),
  workspaceSettingsSummary: document.querySelector('.workspace-settings > summary'),
  zoomInButton: document.getElementById('zoom-in-btn'),
  zoomOutButton: document.getElementById('zoom-out-btn'),
  zoomResetButton: document.getElementById('zoom-reset-btn'),
  agentCount: document.getElementById('agent-count'),
};

const agentViews = new Map();
let currentSnapshot = null;
let currentCommandDeckModel = null;
let currentCommandSelection = null;
let currentMissionTrace = null;
let commandFocusSequence = 0;
let currentExposure = null;
let selectedAgentId = null;
let pollTimer = null;
let patrolTimer = null;
let timelineTimer = null;
let uiTickTimer = null;
let liveStream = null;
let lastStreamId = 0;
const DEFAULT_TIMELINE_REFRESH_MS = 1000;
let timelineRefreshMs = Math.max(
  100,
  Number(localStorage.getItem('pixelverse:timeline-refresh-ms')) || DEFAULT_TIMELINE_REFRESH_MS,
);
const queryLocale = new URLSearchParams(window.location.search).get('lang');
let currentLocale = normalizeLocale(queryLocale || localStorage.getItem('pixelverse:locale') || 'en-US');
let mobileMode = localStorage.getItem('pixelverse:mobile-mode') === '1';
let sidebarOpen = mobileMode ? localStorage.getItem('pixelverse:sidebar-open') === '1' : true;
let dashboardStorage = null;
try {
  dashboardStorage = window.localStorage;
} catch {
  dashboardStorage = null;
}
let dashboardDisclosure = readDashboardDisclosure(dashboardStorage);
let dashboardTouchTooltipTimer = null;
let lastDashboardInputModality = 'keyboard';
const dashboardPages = { events: 0, agents: 0, help: 0 };
let dashboardLastTrigger = null;
let dashboardLiveSnapshot = null;
let agentLivePageIndex = 0;
let cancelDashboardFocusRestore = null;
const cutawayFocusHandoff = createCutawayFocusHandoff({
  schedule: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
});
const liveEcgController = createLiveEcgController({ root: dom.agentLiveList });
const commandDeckLayoutController = createCommandDeckLayoutController({
  workspace: dom.workspace,
  leftHandle: dom.liveLeftSplitter,
  rightHandle: dom.liveRightSplitter,
  bottomHandle: dom.commandBottomSplitter,
  storage: dashboardStorage,
  viewport: () => ({
    width: window.innerWidth,
    height: window.innerHeight,
    topHeight: dom.topStatusBar?.getBoundingClientRect?.().height || 44,
  }),
  onResize: renderCommandDeckControls,
});
function renderCommandDeckControls() {
  const collapsed = commandDeckLayoutController.getLayout().collapsed;
  [
    [dom.commandCollapseLeft, 'left', 'Left'],
    [dom.commandCollapseRight, 'right', 'Right'],
    [dom.commandCollapseBottom, 'bottom', 'Bottom'],
  ].forEach(([button, region, keySuffix]) => {
    if (!button) return;
    const action = collapsed[region] ? 'expand' : 'collapse';
    const label = uiText(currentLocale, `commandDeck.layout.${action}${keySuffix}`);
    button.setAttribute('aria-expanded', String(!collapsed[region]));
    button.setAttribute('aria-label', label);
    button.title = label;
  });
}
[
  [dom.commandCollapseLeft, 'left'],
  [dom.commandCollapseRight, 'right'],
  [dom.commandCollapseBottom, 'bottom'],
].forEach(([button, region]) => button?.addEventListener('click', () => {
  commandDeckLayoutController.collapse(region);
  renderCommandDeckControls();
}));
dom.commandSwapSides?.addEventListener('click', () => {
  commandDeckLayoutController.swapSides();
  renderCommandDeckControls();
});
dom.commandResetLayout?.addEventListener('click', () => {
  commandDeckLayoutController.reset();
  renderCommandDeckControls();
});
const resetCutawayFocusHandoff = () => {
  cancelDashboardFocusRestore?.();
  cancelDashboardFocusRestore = null;
  cutawayFocusHandoff.reset();
};
const dashboardCutawayOpen = () => dom.body.dataset.pixelworldCutaway === 'open';
const cutawayStatusRail = createCutawayStatusRailController({
  body: dom.body,
  frame: dom.pixelworldFrame,
  hostElements: [
    // The full desktop heartbeat card can reach 176px even when current copy
    // happens to be shorter; reserve that stable envelope for collision policy.
    { element: document.getElementById('live-status-rail'), minimumHeight: 176 },
    document.querySelector('.workspace-tools'),
  ],
});
let cutawayStatusRailFrame = 0;
const syncCutawayStatusRail = () => {
  window.cancelAnimationFrame(cutawayStatusRailFrame);
  cutawayStatusRailFrame = window.requestAnimationFrame(() => cutawayStatusRail.sync());
};
const pixelworldBridge = createPixelworldBridge({
  frame: dom.pixelworldFrame,
  origin: window.location.origin,
  onFocus: (selection) => selectCommandDeck(selection, { publish: false }),
  onCutawayStateChange: (open) => {
    if (open) {
      cancelDashboardFocusRestore?.();
      cancelDashboardFocusRestore = null;
      cutawayFocusHandoff.cutawayOpened(dashboardActiveTrigger());
      closeDashboardCard({ restoreFocus: false });
      dom.body.dataset.pixelworldCutaway = 'open';
      renderDashboardDisclosure();
      syncCutawayStatusRail();
    } else {
      dom.body.dataset.pixelworldCutaway = 'closed';
      cutawayStatusRail.clear();
      renderDashboardDisclosure();
      const trigger = cutawayFocusHandoff.cutawayClosed();
      if (trigger) scheduleDashboardCardFocus(trigger);
    }
  },
});
const missionTraceController = createMissionTraceController({
  now: () => Date.now(),
  requestAnimationFrame: (callback) => window.requestAnimationFrame(callback),
  cancelAnimationFrame: (handle) => window.cancelAnimationFrame(handle),
  setInterval: (callback, delay) => window.setInterval(callback, delay),
  clearInterval: (handle) => window.clearInterval(handle),
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true,
  windowMs: 20 * 60 * 1000,
  maxEvents: 240,
  onRender: renderMissionTrace,
});
pixelworldBridge.setLocale(currentLocale);
const detachPixelworldBridge = attachPixelworldBridge({
  frame: dom.pixelworldFrame,
  messageTarget: window,
  bridge: pixelworldBridge,
  origin: window.location.origin,
  onFrameLoad: resetCutawayFocusHandoff,
  onFrameCutawayOpen: () => cutawayFocusHandoff.frameCutawayOpened(),
  onFramePointerDown: () => {
    cutawayFocusHandoff.framePointerDown(dashboardActiveTrigger());
    closeDashboardCard({ restoreFocus: false });
  },
  onFramePointerComplete: () => cutawayFocusHandoff.framePointerComplete(),
  onFrameEscape: () => closeDashboardCard({ deferFocus: true }),
});
attachPageLifecycleCleanup({ pageTarget: window, cleanup: () => {
  detachPixelworldBridge();
  resetCutawayFocusHandoff();
  liveEcgController.stop();
  missionTraceController.stop();
  commandDeckLayoutController.destroy();
} });
window.addEventListener('resize', () => {
  syncCutawayStatusRail();
  if (dashboardDisclosure.activeCard) {
    renderDashboardCardContent();
    window.requestAnimationFrame(positionDashboardCard);
  }
});
let workbenchLayoutController = null;
let cameraOffset = { x: 0, y: 0 };
let cameraScale = 1;
let cameraPanning = null;
let panelDragging = null;
let activeDialogAgentId = null;
let furnitureEditMode = false;
let furnitureDraft = {};
let furnitureSavedLayout = {};
let furnitureDirty = false;
let furnitureSaving = false;
let propDragging = null;
let dragRenderQueued = false;
let dragAgentsQueued = false;
let furnitureToastTimer = null;
let selectedFurnitureProp = null;
let furnitureSnapStep = resolveSnapStep(false);
let lastFurnitureCollisionAt = 0;
const forcedOpenDoorRooms = new Set();
const proximityOpenDoorRooms = new Set();
const DOOR_OPEN_DISTANCE = 5.6;

const short = (text = '', max = 42) => text && text.length > max ? `${text.slice(0, max - 1)}…` : (text || '');

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function strings() {
  return getLocaleStrings(currentLocale);
}

function commandText(key, params = {}) {
  return uiText(currentLocale, key, params);
}

function populateLocaleSelect() {
  if (!dom.languageSelect) return;
  dom.languageSelect.innerHTML = SUPPORTED_LOCALES.map((locale) => {
    const label = getLocaleLabel(locale) || LOCALE_LABELS[locale] || locale;
    return `<option value="${locale}">${label}</option>`;
  }).join('');
  dom.languageSelect.value = currentLocale;
}

function cloneLayout(layout = {}) {
  return JSON.parse(JSON.stringify(layout || {}));
}

function layoutEquals(left = {}, right = {}) {
  return JSON.stringify(left || {}) === JSON.stringify(right || {});
}

function selectedPropMeta() {
  const target = propDragging || selectedFurnitureProp;
  if (!target) return '';
  const room = getRoomCopy(target.roomKey, currentLocale);
  const roomName = room.name || target.roomKey;
  const coords = `${Number(target.x || 0).toFixed(1)}%, ${Number(target.y || 0).toFixed(1)}%`;
  return `${furnitureLabelForLocale(currentLocale, target.label, target.propType)} · ${roomName} · ${coords} · ${formatScale(target.scale || 1)}`;
}

function selectedPropCoordinates(target = propDragging || selectedFurnitureProp) {
  if (!target) return null;
  return {
    x: formatPercent(target.x || 0),
    y: formatPercent(target.y || 0),
  };
}

function selectedPropGuideLabel(target = propDragging || selectedFurnitureProp) {
  if (!target) return '';
  const copy = strings();
  const coords = selectedPropCoordinates(target);
  return copy.layoutGuideBadge(furnitureLabelForLocale(currentLocale, target.label, target.propType), coords?.x || '0.0', coords?.y || '0.0', Number(furnitureSnapStep || 0.5).toFixed(1));
}

function updateFurnitureCoordinateHud() {
  if (!dom.furnitureCoordHud) return;
  const copy = strings();
  const target = propDragging || selectedFurnitureProp;
  const active = furnitureEditMode && !!target;
  dom.furnitureCoordHud.hidden = !active;
  if (!active) return;
  const room = getRoomCopy(target.roomKey, currentLocale);
  const coords = selectedPropCoordinates(target);
  const furnitureLabel = furnitureLabelForLocale(currentLocale, target.label, target.propType);
  if (dom.furnitureCoordTitle) {
    dom.furnitureCoordTitle.textContent = `${copy.layoutCoordTitle} · ${furnitureLabel}`;
  }
  if (dom.furnitureCoordBody) {
    const label = document.createElement('span');
    label.textContent = furnitureCoordinateText(currentLocale, {
      label: furnitureLabel,
      propType: target.propType,
      room: room.name || target.roomKey,
      x: coords?.x || '0.0',
      y: coords?.y || '0.0',
      snap: Number(furnitureSnapStep || 0.5).toFixed(1),
      scale: formatScale(target.scale || 1),
    });
    const scaleDown = document.createElement('button');
    scaleDown.type = 'button';
    scaleDown.dataset.furnitureScale = '-1';
    scaleDown.setAttribute('aria-label', copy.layoutScaleDown);
    scaleDown.textContent = '-';
    const scaleUp = document.createElement('button');
    scaleUp.type = 'button';
    scaleUp.dataset.furnitureScale = '1';
    scaleUp.setAttribute('aria-label', copy.layoutScaleUp);
    scaleUp.textContent = '+';
    dom.furnitureCoordBody.replaceChildren(label, scaleDown, scaleUp);
  }
}

function setSelectedFurnitureProp(next = null) {
  selectedFurnitureProp = next ? {
    roomKey: next.roomKey,
    originRoomKey: next.originRoomKey || next.roomKey,
    index: Number(next.index || 0),
    propType: next.propType || 'prop',
    label: next.label || next.propType || 'prop',
    x: Number(next.x || 50),
    y: Number(next.y || 50),
    scale: normalizeScale(next.scale || 1),
  } : null;
}

function selectedFurnitureKey() {
  if (!selectedFurnitureProp) return '';
  return `${selectedFurnitureProp.originRoomKey}:${selectedFurnitureProp.index}`;
}

function getDecorByRoom() {
  return Object.fromEntries(
    Object.keys(ROOM_LAYOUTS)
      .filter((roomKey) => roomKey !== 'offline_corner')
      .map((roomKey) => [roomKey, roomDecorFor(roomKey)]),
  );
}

function roomDecorFor(roomKey) {
  const mapFurniture = roomMapCopy(roomKey).furniture || [];
  if (mapFurniture.length) {
    return mapFurniture.map((item) => ({
      type: item.type || 'table',
      label: item.label || item.type || 'prop',
      labelKey: item.type || 'prop',
      handles: item.handles || [],
      anchors: item.anchors || [],
      footprint: item.footprint,
      iconStyle: item.icon_style,
      w: item.w,
      h: item.h,
      scale: item.scale,
    }));
  }
  return getRoomDecor(roomKey, currentLocale);
}

function furnitureChangeCount(layout = currentLayoutSnapshot(), baseline = furnitureSavedLayout || {}) {
  return Object.keys(layout || {}).reduce((count, roomKey) => {
    const roomLayout = layout[roomKey] || [];
    const roomBaseline = baseline[roomKey] || [];
    return count + roomLayout.reduce((roomCount, item, index) => {
      const previous = roomBaseline[index] || {};
      return roomCount + ((Math.abs((item.x || 0) - (previous.x || 0)) > 0.01
        || Math.abs((item.y || 0) - (previous.y || 0)) > 0.01
        || (item.room || roomKey) !== (previous.room || roomKey)) ? 1 : 0);
    }, 0);
  }, 0);
}

function changedRoomCount(layout = currentLayoutSnapshot(), baseline = furnitureSavedLayout || {}) {
  return Object.keys(layout || {}).filter((roomKey) => {
    const roomLayout = layout[roomKey] || [];
    const roomBaseline = baseline[roomKey] || [];
    return roomLayout.some((item, index) => {
      const previous = roomBaseline[index] || {};
      return Math.abs((item.x || 0) - (previous.x || 0)) > 0.01
        || Math.abs((item.y || 0) - (previous.y || 0)) > 0.01
        || (item.room || roomKey) !== (previous.room || roomKey);
    });
  }).length;
}

function dragHintText() {
  const copy = strings();
  if (propDragging) return copy.layoutDragActiveHint;
  if (selectedFurnitureProp) return copy.layoutSelectedHint;
  return copy.layoutEditingHint;
}

function queueDistrictRender() {
  if (dragRenderQueued) return;
  dragRenderQueued = true;
  window.requestAnimationFrame(() => {
    dragRenderQueued = false;
    renderDistricts();
  });
}

function queueAgentRefresh() {
  if (dragAgentsQueued || !currentSnapshot) return;
  dragAgentsQueued = true;
  window.requestAnimationFrame(() => {
    dragAgentsQueued = false;
    if (currentSnapshot) renderAgents(currentSnapshot);
  });
}

function updateFurnitureEditorBanner() {
  const copy = strings();
  if (!dom.furnitureEditBanner) return;
  dom.furnitureEditBanner.hidden = !furnitureEditMode;
  if (!furnitureEditMode) return;
  const changes = furnitureChangeCount();
  if (dom.furnitureEditModeLabel) {
    dom.furnitureEditModeLabel.className = 'editor-chip info';
    dom.furnitureEditModeLabel.textContent = furnitureSaving ? copy.layoutSaving : copy.layoutEditing;
  }
  if (dom.furnitureEditDirtyLabel) {
    const dirtyClass = furnitureDirty ? 'warn' : 'success';
    dom.furnitureEditDirtyLabel.className = `editor-chip ${dirtyClass}`;
    dom.furnitureEditDirtyLabel.textContent = furnitureDirty ? copy.layoutChangesCount(changes) : copy.layoutNoChanges;
  }
  if (dom.furnitureEditHint) {
    dom.furnitureEditHint.textContent = dragHintText();
  }
  if (dom.furnitureEditMeta) {
    const coords = selectedPropCoordinates();
    const chips = [
      `<span class="editor-chip info">${copy.layoutKeyboardHint}</span>`,
      `<span class="editor-chip info">${copy.layoutDragSurfaceHint}</span>`,
      `<span class="editor-chip info">${copy.layoutGridHint}</span>`,
      `<span class="editor-chip ${selectedFurnitureProp ? 'warn' : 'info'}">${selectedPropMeta() || copy.layoutPickHint}</span>`,
      selectedFurnitureProp && coords ? `<span class="editor-chip success">${copy.layoutCoordChip(coords.x, coords.y)}</span>` : '',
      selectedFurnitureProp ? `<span class="editor-chip info">${copy.layoutSnapChip(Number(furnitureSnapStep || 0.5).toFixed(1))}</span>` : '',
    ].filter(Boolean);
    dom.furnitureEditMeta.innerHTML = chips.join('');
  }
  updateFurnitureCoordinateHud();
}

function updateFurnitureToolbar() {
  const copy = strings();
  if (dom.editFurnitureButton) dom.editFurnitureButton.textContent = copy.editFurniture;
  if (dom.saveFurnitureButton) {
    dom.saveFurnitureButton.textContent = furnitureSaving ? copy.layoutSaving : copy.saveLayout;
    dom.saveFurnitureButton.hidden = !furnitureEditMode;
    dom.saveFurnitureButton.disabled = furnitureSaving || !furnitureDirty;
  }
  if (dom.cancelFurnitureButton) {
    dom.cancelFurnitureButton.textContent = copy.cancelLayout;
    dom.cancelFurnitureButton.hidden = !furnitureEditMode;
    dom.cancelFurnitureButton.disabled = furnitureSaving;
  }
  if (dom.editFurnitureButton) {
    dom.editFurnitureButton.hidden = furnitureEditMode;
    dom.editFurnitureButton.disabled = furnitureSaving;
  }
  dom.world?.classList.toggle('editing', furnitureEditMode);
  applyMapLayerVisibility({
    frame: dom.pixelworldFrame,
    legacyStage: dom.cameraStage,
    legacyControls: dom.cameraControls,
  }, furnitureEditMode);
  updateFurnitureEditorBanner();
}

function applyMobileMode() {
  const copy = strings();
  dom.body.dataset.mobileMode = mobileMode ? 'on' : 'off';
  dom.body.dataset.sidebarOpen = sidebarOpen ? 'true' : 'false';
  if (!dom.mobileModeButton) return;
  dom.mobileModeButton.textContent = mobileMode ? copy.desktopMode : copy.mobileMode;
  dom.mobileModeButton.setAttribute('aria-pressed', String(mobileMode));
  dom.mobileModeButton.title = mobileMode ? copy.desktopModeHint : copy.mobileModeHint;
  renderDashboardDisclosure();
}

function dashboardCardLabel(name) {
  return localizedDashboardCardLabel(strings(), name);
}

function dashboardCardItems(name) {
  const copy = strings();
  const snapshot = dashboardLiveSnapshot || currentSnapshot;
  if (name === 'events') return Array.isArray(snapshot?.events) ? snapshot.events : [];
  if (name === 'agents') return Array.isArray(snapshot?.agents) ? snapshot.agents : [];
  return hookGuideForLocale(currentLocale);
}

function dashboardEventCard(item = {}) {
  const timestamp = Number(item.time || item.created_at || 0);
  const timeLabel = timestamp
    ? new Date(timestamp < 10_000_000_000 ? timestamp * 1000 : timestamp).toLocaleTimeString(currentLocale, { hour12: false })
    : '';
  return dashboardCardItemMarkup({
    title: eventTitle(item),
    meta: timeLabel,
    detail: eventSummary(item) || strings().noActions,
  });
}

function dashboardAgentCard(agent = {}) {
  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || strings().unknownRoom;
  const detail = agentTaskText(agent) || strings().idleFallback;
  return dashboardCardItemMarkup({
    title: displayAgentName(agent),
    meta: `${roleLabel(agent.role)} · ${stateText(agent.state)} · ${roomName}`,
    detail,
  });
}

function renderDashboardCardContent() {
  const name = dashboardDisclosure.activeCard;
  if (!name || !dom.dashboardCard) return;
  const copy = strings();
  const cardSize = {
    width: Number(dom.dashboardCard.dataset.layoutWidth) || dom.dashboardCard.getBoundingClientRect().width,
    height: Number(dom.dashboardCard.dataset.layoutHeight) || dom.dashboardCard.getBoundingClientRect().height,
  };
  const pageSize = dashboardCardPageSize(name, cardSize);
  const page = dashboardCardPage(
    dashboardCardItems(name),
    dashboardPages[name],
    pageSize,
  );
  dashboardPages[name] = page.page;
  const settingsVisible = name === 'help' && page.items[0]?.kind === 'settings';
  let markup = '';
  if (name === 'events') {
    markup = page.items.length
      ? page.items.map(dashboardEventCard).join('')
      : dashboardCardItemMarkup({ detail: copy.waitingEvents });
  } else if (name === 'agents') {
    markup = page.items.length
      ? page.items.map(dashboardAgentCard).join('')
      : dashboardCardItemMarkup({ detail: copy.inspectorEmpty });
  } else if (!settingsVisible) {
    const item = page.items[0] || {};
    markup = dashboardCardItemMarkup({ title: item.title, detail: item.detail });
  }
  const signature = JSON.stringify({ name, page: page.page, markup, settingsVisible, locale: currentLocale });
  const pageLabel = copy.dashboardPage(page.page + 1, page.pageCount);
  const stateLabels = name === 'agents'
    ? page.items.map((agent) => `${displayAgentName(agent)} ${stateText(agent.state)}`).join(', ')
    : name === 'events'
      ? page.items.map((item) => eventTitle(item)).join(', ')
      : page.items.map((item) => item.title).filter(Boolean).join(', ');
  renderDashboardCardView({
    card: dom.dashboardCard,
    items: dom.dashboardCardItems,
    settings: dom.dashboardHelpSettings,
    previous: dom.dashboardCardPrevious,
    next: dom.dashboardCardNext,
    page: dom.dashboardCardPage,
    liveStatus: dom.dashboardCardLive,
  }, {
    signature,
    markup,
    settingsVisible,
    previousLabel: copy.dashboardPrevious,
    previousDisabled: !page.canPrevious,
    nextLabel: copy.dashboardNext,
    nextDisabled: !page.canNext,
    pageLabel,
    liveText: `${dashboardCardLabel(name)} · ${pageLabel}${stateLabels ? ` · ${stateLabels}` : ''}`,
    pageSize,
  });
}

function positionDashboardCard() {
  const name = dashboardDisclosure.activeCard;
  const trigger = dom.dashboardCardButtons.find((button) => button.dataset.dashboardCard === name);
  if (!name || !trigger || !dom.dashboardCard || dom.dashboardCard.hidden) return;
  dom.dashboardCard.style.removeProperty('width');
  dom.dashboardCard.style.removeProperty('height');
  const cardRect = dom.dashboardCard.getBoundingClientRect();
  const exclusions = [document.getElementById('live-status-rail')]
    .filter((element) => element && !element.hidden)
    .map((element) => {
      const rect = element.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: Math.max(rect.bottom, rect.top + 176),
      };
    });
  const point = placeDashboardCard(
    trigger.getBoundingClientRect(),
    { width: cardRect.width, height: cardRect.height },
    { width: window.innerWidth, height: window.innerHeight, margin: window.innerWidth <= 720 ? 8 : 14, gap: 8 },
    exclusions,
  );
  if (!point.visible) {
    closeDashboardCard({ restoreFocus: false });
    return;
  }
  dom.dashboardCard.style.left = `${Math.round(point.left)}px`;
  dom.dashboardCard.style.top = `${Math.round(point.top)}px`;
  dom.dashboardCard.style.width = `${Math.floor(point.width)}px`;
  dom.dashboardCard.style.height = `${Math.floor(point.height)}px`;
  const previousPageSize = dashboardCardPageSize(name, {
    width: Number(dom.dashboardCard.dataset.layoutWidth),
    height: Number(dom.dashboardCard.dataset.layoutHeight),
  });
  dom.dashboardCard.dataset.layoutWidth = String(Math.floor(point.width));
  dom.dashboardCard.dataset.layoutHeight = String(Math.floor(point.height));
  if (previousPageSize !== dashboardCardPageSize(name, point)) renderDashboardCardContent();
}

function renderDashboardDisclosure() {
  const activeCard = dashboardDisclosure.activeCard;
  const copy = strings();
  const cardState = activeCard || 'none';
  if (dom.body.dataset.dashboardCard !== cardState) dom.body.dataset.dashboardCard = cardState;
  dom.dashboardCardButtons.forEach((button) => {
    const name = button.dataset.dashboardCard;
    const label = renderDashboardCardControl(button, {
      name, activeCard, copy, blocked: dashboardCutawayOpen(),
    });
    const labelNode = document.getElementById(`dashboard-${name}-label`);
    if (labelNode && labelNode.textContent !== label) labelNode.textContent = label;
  });
  if (!dom.dashboardCard) return;
  if (dom.dashboardCard.hidden !== !activeCard) dom.dashboardCard.hidden = !activeCard;
  if (dom.dashboardCard.dataset.card !== (activeCard || '')) dom.dashboardCard.dataset.card = activeCard || '';
  if (!activeCard) return;
  if (dom.dashboardCardKicker.textContent !== copy.brandTitle) dom.dashboardCardKicker.textContent = copy.brandTitle;
  const title = dashboardCardLabel(activeCard);
  if (dom.dashboardCardTitle.textContent !== title) dom.dashboardCardTitle.textContent = title;
  renderDashboardCardContent();
  window.requestAnimationFrame(positionDashboardCard);
}

function persistDashboardDisclosure() {
  writeDashboardDisclosure(dashboardStorage, dashboardDisclosure);
}

function dashboardActiveTrigger() {
  return activeDashboardCardTrigger(
    dashboardDisclosure.activeCard,
    dashboardLastTrigger,
    dom.dashboardCardButtons,
  );
}

function scheduleDashboardCardFocus(trigger) {
  cancelDashboardFocusRestore?.();
  cancelDashboardFocusRestore = deferDashboardCardFocus(trigger, {
    schedule: (callback) => window.requestAnimationFrame(() => {
      cancelDashboardFocusRestore = null;
      callback();
    }),
    cancel: (handle) => window.cancelAnimationFrame(handle),
  });
}

function closeDashboardCard({ restoreFocus = true, deferFocus = false } = {}) {
  const activeCard = dashboardDisclosure.activeCard;
  if (!activeCard) return false;
  const trigger = dashboardActiveTrigger();
  dashboardDisclosure = { ...dashboardDisclosure, activeCard: null };
  persistDashboardDisclosure();
  renderDashboardDisclosure();
  if (restoreFocus) {
    if (deferFocus) scheduleDashboardCardFocus(trigger);
    else restoreDashboardCardFocus(trigger);
  }
  return true;
}

function changeDashboardCard(requested, trigger) {
  cancelDashboardFocusRestore?.();
  cancelDashboardFocusRestore = null;
  const wasActive = dashboardDisclosure.activeCard;
  dashboardLastTrigger = trigger || dashboardLastTrigger;
  dashboardDisclosure = toggleDashboardCard(dashboardDisclosure, requested, dashboardCutawayOpen());
  persistDashboardDisclosure();
  renderDashboardDisclosure();
  if (wasActive === requested && !dashboardDisclosure.activeCard) restoreDashboardCardFocus(trigger);
}

function updateLastSyncText(snapshot = currentSnapshot, nowMs = Date.now()) {
  if (!dom.lastSync) return;
  const copy = strings();
  if (!snapshot) {
    dom.lastSync.textContent = copy.syncPending;
    return;
  }
  const serverTimeMs = Number(snapshot.server_time_ms || nowMs);
  const syncAge = Math.max(0, Math.round((nowMs - serverTimeMs) / 1000));
  const stamp = new Date(serverTimeMs).toLocaleTimeString(currentLocale, { hour12: false });
  dom.lastSync.textContent = `${copy.lastSyncPrefix} ${stamp} · ${copy.secondsAgo(syncAge)}`;
}

function renderHeartbeat(snapshot = {}) {
  if (!dom.heartbeatStatus) return;
  const copy = strings();
  const mainAgent = (snapshot.agents || []).find((agent) => agent.role === 'main_agent') || (snapshot.agents || [])[0];
  if (!mainAgent) {
    dom.heartbeatStatus.classList.add('stale');
    dom.heartbeatStatus.classList.remove('waiting');
    if (dom.heartbeatLabel) dom.heartbeatLabel.textContent = copy.uiStatusMissing || copy.heartbeatMissing;
    return;
  }
  const waiting = mainAgent.connection_status === 'awaiting_attach';
  const stale = !!mainAgent.is_stale && !waiting;
  dom.heartbeatStatus.classList.toggle('stale', stale);
  dom.heartbeatStatus.classList.toggle('waiting', waiting);
  if (dom.heartbeatLabel) {
    dom.heartbeatLabel.textContent = stale
      ? (copy.uiStatusStale || copy.heartbeatStale(ageText(mainAgent.age_seconds || 0)))
      : waiting
        ? (copy.uiStatusWaiting || copy.heartbeatWaiting)
        : (copy.uiStatusHealthy || copy.heartbeatLive(ageText(mainAgent.age_seconds || 0)));
  }
}

function updateCurrentAgentState(snapshot = {}) {
  if (!dom.currentAgentState) return;
  const copy = strings();
  const mainAgent = (snapshot.agents || []).find((agent) => agent.role === 'main_agent') || (snapshot.agents || [])[0];
  if (!mainAgent) {
    updateLiveRegionText(dom.currentAgentState, copy.uiStatusMissing || copy.heartbeatMissing || copy.waitingEvents);
    return;
  }
  const room = getRoomCopy(mainAgent.room_key, currentLocale);
  const roomName = room.name || mainAgent.room_label || copy.unknownRoom;
  const task = agentTaskText(mainAgent);
  updateLiveRegionText(dom.currentAgentState, [
    displayAgentName(mainAgent),
    stateText(mainAgent.state),
    roomName,
    task ? short(task, 52) : '',
  ].filter(Boolean).join(' · '));
}

function updateRefreshController() {
  const copy = strings();
  if (dom.timelineRefreshLabel) dom.timelineRefreshLabel.textContent = copy.timelineRefreshLabel;
  if (dom.refreshRateOutput) dom.refreshRateOutput.textContent = `${(timelineRefreshMs / 1000).toFixed(1)}s`;
}

function restartTimelineTimer() {
  if (timelineTimer) {
    clearInterval(timelineTimer);
    timelineTimer = null;
  }
}

function startLiveUiTicker() {
  if (uiTickTimer) {
    clearInterval(uiTickTimer);
    uiTickTimer = null;
  }
  uiTickTimer = window.setInterval(() => {
    if (!currentSnapshot) return;
    const nowMs = Date.now();
    const liveSnapshot = buildDashboardLiveSnapshot(currentSnapshot, nowMs);
    dashboardLiveSnapshot = liveSnapshot;
    updateLastSyncText(currentSnapshot, nowMs);
    renderHeartbeat(liveSnapshot);
    updateCurrentAgentState(liveSnapshot);
    renderLiveMonitoring(liveSnapshot, nowMs);
    renderAgents(liveSnapshot);
  }, Math.max(100, timelineRefreshMs));
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
  const roomDecor = roomDecorFor(roomKey);
  const decorByRoom = getDecorByRoom();
  const layout = roomDecorLayout(roomKey, roomDecor, decorByRoom);
  const decor = layout.map((item) => item.prop);
  const worldPositions = roomInteractionPositions(roomKey, roomDecor, decorByRoom);
  return selectInteractionTarget(agent, decor, worldPositions, fallback) || fallback;
}

function activityPoint(agent, patrolIndex = 0) {
  const target = activityTarget(agent, patrolIndex);
  return target ? { x: target.x, y: target.y } : { x: agent.x || 0, y: agent.y || 0 };
}

function interactionCopy(target) {
  return interactionText(currentLocale, target);
}

function ambientSpeech(agent) {
  if (agent.role !== 'main_agent' && !agent.speech && !agent.task) return '';
  return ambientText(currentLocale, agent, agent.task || '');
}

function activityHintText(agent) {
  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || strings().unknownRoom;
  return activityHintForLocale(currentLocale, agent, roomName, agent.task || '');
}

function formatTimelineItem(item = {}) {
  const toolName = item.tool_name || (item.tool_names || [])[0] || '';
  const toolLabel = localizeTask(toolName) || toolName;
  return timelineItemForLocale(currentLocale, item, {
    toolLabel,
    toolRouteLabel: localizeTask((item.tool_names || []).join(', ')),
  });
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
  const name = agent.full_name || agent.name || commandText('commandDeck.inspector.agentFallback');
  if (name === 'API 工作階段') return commandText('commandDeck.inspector.sessionNames.api');
  if (name === 'CLI 工作階段') return commandText('commandDeck.inspector.sessionNames.cli');
  if (name === 'Gateway 工作階段') return commandText('commandDeck.inspector.sessionNames.gateway');
  return name;
}

function eventTitle(item = {}) {
  return eventTitleForLocale(item, currentLocale);
}

function eventSummary(item = {}) {
  return eventSummaryForLocale(item, currentLocale);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function applyStaticCopy() {
  const copy = strings();
  document.documentElement.lang = currentLocale === 'zh-TW' ? 'zh-Hant' : currentLocale === 'ja-JP' ? 'ja' : currentLocale === 'ko-KR' ? 'ko' : 'en';
  dom.body.dataset.locale = currentLocale;
  document.querySelectorAll('[data-i18n]').forEach((element) => {
    element.textContent = commandText(element.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-aria-label]').forEach((element) => {
    element.setAttribute('aria-label', commandText(element.dataset.i18nAriaLabel));
  });
  document.querySelectorAll('[data-i18n-title]').forEach((element) => {
    element.title = commandText(element.dataset.i18nTitle);
  });
  setText('brand-title', copy.brandTitle);
  setText('brand-subtitle', copy.brandSubtitle);
  setText('dashboard-guide-title', copy.dashboardGuideTitle);
  setText('diagnostics-drawer-explanation', copy.diagnosticsExplanation);
  setText('inspector-title', copy.inspectorTitle);
  setText('event-belt-title', copy.eventBeltTitle);
  setText('summary-title', copy.worldOverview);
  setText('summary-world-label', copy.connectionLabel);
  setText('summary-agent-label', copy.agentsVisible);
  setText('summary-subagent-label', copy.subagentsVisible);
  setText('summary-session-label', copy.sessionsVisible);
  setText('language-label', copy.languageLabel);
  setText('exposure-label', copy.exposureLabel || 'URL');
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
  setText('hook-state-title', copy.hookStateTitle);
  if (dom.workspaceSettingsSummary) {
    const settingsLabel = `${copy.dashboardPanels} · ${copy.languageLabel}`;
    dom.workspaceSettingsSummary.dataset.tooltip = settingsLabel;
    dom.workspaceSettingsSummary.setAttribute('aria-label', settingsLabel);
  }
  if (dom.dashboardHelpButton) {
    dom.dashboardHelpButton.dataset.tooltip = copy.dashboardHelp;
    dom.dashboardHelpButton.setAttribute('aria-label', copy.dashboardHelp);
    dom.dashboardHelpButton.title = copy.dashboardHelp;
  }
  renderCommandDeckControls();
  renderHookStateTable();
  populateLocaleSelect();
  updateRefreshController();
  updateFurnitureToolbar();
  applyMobileMode();
  updateCurrentAgentState(currentSnapshot || {});
  if (!selectedAgentId && dom.inspectorBody) {
    dom.inspectorBody.className = 'empty';
    dom.inspectorBody.textContent = copy.inspectorEmpty;
  }
  renderDistricts();
  repaintAgents();
  renderExposure();
}

function exposureModeLabel(mode) {
  const copy = strings();
  return (copy.exposureModes && copy.exposureModes[mode]) || mode;
}

function renderExposure() {
  if (!dom.exposureSelect || !dom.exposureUrl || !currentExposure) return;
  const activeMode = currentExposure.active_mode || 'localhost';
  dom.exposureSelect.innerHTML = (currentExposure.options || []).map((option) => {
    const disabled = option.available ? '' : ' disabled';
    const selected = option.mode === activeMode ? ' selected' : '';
    const label = exposureModeLabel(option.mode);
    return `<option value="${option.mode}"${disabled}${selected}>${label}${option.available ? '' : ` · ${commandText('commandDeck.error.unavailable')}`}</option>`;
  }).join('');
  dom.exposureUrl.textContent = currentExposure.active_url || '';
  dom.exposureUrl.title = currentExposure.active_url || '';
  if (dom.copyExposureButton) {
    dom.copyExposureButton.disabled = !currentExposure.active_url;
    dom.copyExposureButton.title = `${strings().copyUrl || 'Copy URL'}: ${currentExposure.active_url || ''}`;
  }
}

async function loadExposure() {
  try {
    const response = await fetch('/api/exposure', { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    currentExposure = await response.json();
    renderExposure();
  } catch (err) {
    currentExposure = {
      active_mode: 'localhost',
      active_url: window.location.origin,
      options: [{ mode: 'localhost', label: 'Localhost', url: window.location.origin, available: true }],
    };
    renderExposure();
  }
}

async function setExposureMode(mode) {
  try {
    const response = await fetch('/api/exposure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    currentExposure = await response.json();
    renderExposure();
  } catch (err) {
    dom.exposureUrl.textContent = `${strings().exposureFailed || 'Exposure update failed'}: ${err.message}`;
  }
}

async function copyExposureUrl() {
  const url = currentExposure?.active_url || '';
  if (!url) return;
  try {
    await navigator.clipboard.writeText(url);
    dom.copyExposureButton.textContent = '✓';
    window.setTimeout(() => { if (dom.copyExposureButton) dom.copyExposureButton.textContent = '📋'; }, 900);
  } catch {
    window.prompt(strings().copyUrlPrompt || 'Copy URL', url);
  }
}

function renderDistricts() {
  const copy = strings();
  syncGlobalMapDom();
  document.querySelectorAll('.district').forEach((district) => {
    const roomKey = district.dataset.room;
    const layoutRect = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
    district.style.left = `${layoutRect.left}%`;
    district.style.top = `${layoutRect.top}%`;
    district.style.width = `${layoutRect.width}%`;
    district.style.height = `${layoutRect.height}%`;
    district.tabIndex = 0;
    district.setAttribute('role', 'button');
    if (Array.isArray(layoutRect.polygon) && layoutRect.polygon.length >= 3) {
      const points = layoutRect.polygon.map((point) => `${((point.x - layoutRect.left) / layoutRect.width) * 100}% ${((point.y - layoutRect.top) / layoutRect.height) * 100}%`);
      district.style.clipPath = `polygon(${points.join(', ')})`;
    } else {
      district.style.clipPath = '';
    }
    const localizedRoom = getRoomCopy(roomKey, currentLocale);
    const metadata = roomMapCopy(roomKey);
    const room = localizedRoom.name === copy.unknownRoom
      ? { name: metadata.name || roomKey, subtitle: metadata.description || '' }
      : localizedRoom;
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
      const stateLabels = (ROOM_STATE_GROUPS[roomKey] || []).map((state) => `<span>${stateText(state)}</span>`).join('');
      labelEl.innerHTML = `<span>${roomIcon(roomKey)}</span><div><strong>${room.name}</strong><div class="district-subtitle">${room.subtitle}</div><div class="district-state-tags">${stateLabels}</div></div>`;
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

    const propLayout = roomDecorLayout(roomKey, roomDecorFor(roomKey), getDecorByRoom());
    district.classList.toggle('editing', furnitureEditMode);
    const selectedKey = selectedFurnitureKey();
    const selectedInRoom = selectedFurnitureProp && selectedFurnitureProp.roomKey === roomKey;
    const propsLayer = district.querySelector('.district-props');
    if (propsLayer) {
      const gridLines = buildGridLines();
      const guide = furnitureEditMode && selectedInRoom ? `
        <div class="room-edit-grid" aria-hidden="true">
          ${gridLines.map((value) => `<span class="grid-line vertical${Math.abs(value - 50) < 0.01 ? ' mid' : ''}" style="left:${value}%"></span>`).join('')}
          ${gridLines.map((value) => `<span class="grid-line horizontal${Math.abs(value - 50) < 0.01 ? ' mid' : ''}" style="top:${value}%"></span>`).join('')}
        </div>
        <div class="prop-guide${propDragging && propDragging.roomKey === roomKey ? ' dragging' : ''}" style="left:${Number(selectedFurnitureProp.x || 50).toFixed(2)}%;top:${Number(selectedFurnitureProp.y || 50).toFixed(2)}%">
          <span class="snap-guide vertical"></span>
          <span class="snap-guide horizontal"></span>
          <span class="snap-guide-dot"></span>
          <span class="prop-guide-badge">${selectedPropGuideLabel()}</span>
        </div>
      ` : '';
      propsLayer.innerHTML = guide + propLayout.map(({ prop, pos, index, originRoomKey }) => {
        const appledog = getAppleDogPropSprite(prop.type);
        const useHighClarity = shouldUseHighClarityProp(prop.type);
        const kenney = appledog || useHighClarity ? null : getKenneyPropSprite(prop.type);
        const src = appledog?.src || kenney?.src || createPropSprite(prop.type);
        const assetScale = appledog?.scale || (useHighClarity ? 1.25 : (kenney?.scale || 1));
        const scale = Number((assetScale * normalizeScale(pos.scale || prop.scale || 1) * FURNITURE_SIZE_MULTIPLIER).toFixed(2));
        const widthTiles = appledog?.widthTiles || 1;
        const heightTiles = appledog?.heightTiles || 1;
        const fx = getPropFx(prop.type, roomKey);
        const icon = INTERACTION_OBJECT_ICONS[prop.type] || '▪';
        const assetPack = appledog ? 'appledog' : kenney ? 'kenney' : 'office-fallback';
        const draftPos = pos;
        const isSelected = selectedKey === `${originRoomKey}:${index}`;
        return `
          <div class="prop ${fx.className}${isSelected ? ' selected' : ''}" data-room-key="${roomKey}" data-origin-room-key="${originRoomKey}" data-prop-index="${index}" data-prop-type="${prop.type}" data-prop-label="${prop.label}" data-prop-scale="${normalizeScale(pos.scale || prop.scale || 1)}" data-asset-pack="${assetPack}" data-fx-intensity="${fx.intensity}" style="left:${draftPos.x}%;top:${draftPos.y}%;--prop-scale:${scale};--prop-width-tiles:${widthTiles};--prop-height-tiles:${heightTiles}" title="${prop.label}">
            <div class="prop-icon" aria-hidden="true">${icon}</div>
            <img alt="${prop.label}" src="${src}" data-pack="${assetPack}" />
            <div class="prop-label">${prop.label}</div>
            <div class="prop-meta">${prop.label} · ${draftPos.x.toFixed(1)}%, ${draftPos.y.toFixed(1)} · ${formatScale(pos.scale || prop.scale || 1)}</div>
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
    door.title = commandText('commandDeck.accessibility.appleDogDoor');
  });
}

function roomIcon(roomKey) {
  const icons = {
    bed: '🛏️',
    books: '📚',
    card_index_dividers: '🗂️',
    dna: '🧬',
    envelope: '📨',
    laptop: '💻',
    lightbulb: '💡',
    map: '🗺️',
    memo: '📝',
    tools: '🛠️',
    warning: '⚠️',
  };
  const fixed = {
    think_lab: '💡',
    blueprint_lab: '🗺️',
    file_library: '📚',
    code_workbench: '📝',
    terminal_bay: '💻',
    tool_forge: '🛠️',
    response_studio: '📨',
    standby_dock: '🛏️',
    clone_bay: '🧬',
    session_archive: '🗂️',
    offline_corner: '⚠️',
  };
  return icons[roomMapCopy(roomKey).icon] || fixed[roomKey] || '🗂️';
}

function syncGlobalMapDom() {
  const shell = document.querySelector('.house-shell');
  const officeShell = document.querySelector('.office-shell');
  const mapCoordinatePlane = dom.mapCoordinatePlane || document.getElementById('map-coordinate-plane');
  if (!shell || !officeShell || !mapCoordinatePlane) return;
  if (GLOBAL_MAP.image) {
    shell.style.setProperty('--global-map-image', `url("${GLOBAL_MAP.image}")`);
    shell.classList.add('has-global-map-image');
  }

  const pathLayer = dom.pathLayer;
  const agentsLayer = dom.agentsLayer;
  document.querySelectorAll('.house-corridor').forEach((node) => node.remove());
  CORRIDOR_RECTS.forEach((rect) => {
    const node = document.createElement('div');
    node.className = 'house-corridor';
    node.dataset.corridor = rect.key || '';
    node.style.left = `${rect.left}%`;
    node.style.top = `${rect.top}%`;
    node.style.width = `${rect.width}%`;
    node.style.height = `${rect.height}%`;
    node.style.opacity = GLOBAL_MAP.image ? '0' : '1';
    mapCoordinatePlane.insertBefore(node, officeShell);
  });
  HOUSE_DOORS.forEach((door) => {
    if (!officeShell.querySelector(`.room-door[data-room="${door.room}"]`)) {
      const node = document.createElement('div');
      node.className = 'room-door';
      node.dataset.room = door.room;
      officeShell.appendChild(node);
    }
  });
  document.querySelectorAll('.room-door').forEach((door) => {
    if (!HOUSE_DOORS.some((item) => item.room === door.dataset.room)) door.remove();
  });

  Object.keys(ROOM_LAYOUTS).forEach((roomKey) => {
    if (roomKey === 'offline_corner') return;
    if (mapCoordinatePlane.querySelector(`.district[data-room="${roomKey}"]`)) return;
    const district = document.createElement('div');
    district.className = 'district';
    district.dataset.room = roomKey;
    district.innerHTML = '<div class="district-label"></div><div class="district-floor-accents"></div><div class="district-semantics"></div><div class="district-walls"></div><div class="district-props"></div>';
    mapCoordinatePlane.insertBefore(district, pathLayer || agentsLayer || null);
  });
  document.querySelectorAll('.district').forEach((district) => {
    if (!ROOM_LAYOUTS[district.dataset.room]) district.remove();
  });
  refreshDoorOpenStates();
}

function renderHookStateTable() {
  if (!dom.hookStateTable) return;
  const copy = strings();
  dom.hookStateTable.innerHTML = `
    <div class="hook-state-head"><span>${copy.hookStateHook}</span><span>${copy.hookStateState}</span><span>${copy.hookStateRoom}</span></div>
    ${hookStateRoutes().map((route) => {
      const room = getRoomCopy(route.room, currentLocale);
      return `<div class="hook-state-row"><code>${route.hook}</code><span>${stateText(route.state)}</span><span>${room.name}</span></div>`;
    }).join('')}
  `;
}

function setRouteDoorsOpen(roomKeys = [], open = false) {
  roomKeys
    .filter(Boolean)
    .forEach((roomKey) => {
      if (open) forcedOpenDoorRooms.add(roomKey);
      else forcedOpenDoorRooms.delete(roomKey);
    });
  refreshDoorOpenStates();
}

function distanceToDoor(view, doorConfig) {
  const room = ROOM_LAYOUTS[doorConfig.room];
  if (!room) return Infinity;
  const candidates = [room.portal, room.aisle, room.hub].filter(Boolean);
  return Math.min(...candidates.map((point) => Math.hypot((view.currentX || 0) - point.x, (view.currentY || 0) - point.y)));
}

function refreshDoorProximity() {
  proximityOpenDoorRooms.clear();
  HOUSE_DOORS.forEach((door) => {
    const close = Array.from(agentViews.values()).some((view) => distanceToDoor(view, door) <= DOOR_OPEN_DISTANCE);
    if (close) proximityOpenDoorRooms.add(door.room);
  });
}

function refreshDoorOpenStates() {
  refreshDoorProximity();
  document.querySelectorAll('.room-door').forEach((door) => {
    const roomKey = door.dataset.room;
    door.classList.toggle('open', forcedOpenDoorRooms.has(roomKey) || proximityOpenDoorRooms.has(roomKey));
  });
}

function renderInspector(agent) {
  if (!dom.inspectorBody) return;
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
  const currentTask = agentTaskText(agent) || copy.idleFallback;
  const toolPill = agentToolText(agent, currentLocale) || agentTaskText(agent);
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
        ${toolPill ? `<span class="pill">${agent.tool_icon || '✨'} ${toolPill}</span>` : ''}
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

function renderInspectorAgentSelect(agents = []) {
  if (!dom.inspectorAgentSelect) return;
  const copy = strings();
  const roleOrder = ['main_agent', 'subagent', 'branch_session'];
  const grouped = new Map(roleOrder.map((role) => [role, []]));
  agents.forEach((agent) => {
    const role = grouped.has(agent.role) ? agent.role : 'main_agent';
    grouped.get(role).push(agent);
  });
  dom.inspectorAgentSelect.innerHTML = '';
  roleOrder.forEach((role) => {
    const items = grouped.get(role);
    if (!items.length) return;
    const group = document.createElement('optgroup');
    group.label = roleLabel(role);
    items.forEach((agent) => {
      const option = document.createElement('option');
      option.value = agent.agent;
      option.textContent = `${displayAgentName(agent)} · ${stateText(agent.state)}`;
      group.append(option);
    });
    dom.inspectorAgentSelect.append(group);
  });
  dom.inspectorAgentSelect.hidden = !agents.length;
  if (selectedAgentId && agents.some((agent) => agent.agent === selectedAgentId)) {
    dom.inspectorAgentSelect.value = selectedAgentId;
  } else if (agents[0] && !currentCommandSelection) {
    selectedAgentId = agents[0].agent;
    dom.inspectorAgentSelect.value = selectedAgentId;
  }
  dom.inspectorAgentSelect.setAttribute('aria-label', copy.inspectorAgentSelect || copy.inspectorTitle);
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
  el.tabIndex = 0;
  el.setAttribute('role', 'button');
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
    selectCommandDeck({ kind: 'agent', id: agent.agent });
    openAgentDialog(current);
  };
  el.querySelector('.agent-speech')?.addEventListener('click', openDetail);
  el.querySelector('.event-chip')?.addEventListener('click', openDetail);
  el.addEventListener('click', () => {
    selectCommandDeck({ kind: 'agent', id: agent.agent });
  });
  el.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return;
    event.preventDefault();
    selectCommandDeck({ kind: 'agent', id: agent.agent });
  });
  dom.agentsLayer.appendChild(el);
  return el;
}

function ensureAgentView(agent) {
  if (!agentViews.has(agent.agent)) {
    const el = createAgentElement(agent);
    const slot = Array.from(String(agent.agent || '')).reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
    agentViews.set(agent.agent, {
      el,
      data: agent,
      currentX: agent.x || 0,
      currentY: agent.y || 0,
      motionToken: 0,
      patrolIndex: slot,
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
  const displayTask = short(agentTaskText(agent) || strings().idleFallback, 28);
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
  view.el.classList.remove('overlay-left', 'overlay-right');
  view.el.classList.add(agentOverlayClass(agent));
  view.el.classList.toggle('walking', !!view.isMoving);
  view.el.classList.toggle('at-interaction', !!interaction?.propType && !view.isMoving);
  ['idle', 'thinking', 'planning', 'working', 'blocked', 'self_healing', 'awaiting_input', 'initializing', 'sleeping', 'offline'].forEach((state) => view.el.classList.toggle(state, agent.state === state));
  view.el.dataset.pixelState = agent.pixel_state || agent.state || 'idle';
  ['ponder', 'planning', 'terminal', 'dispatch', 'notes', 'writing', 'rest', 'neutral'].forEach((name) => view.el.classList.toggle(`pose-${name}`, pose.pose === name));
  beamEl.className = `beam ${agent.state || 'idle'}`;
  objectChipEl.textContent = interaction?.objectIcon || INTERACTION_OBJECT_ICONS[interaction?.propType] || '';
  objectChipEl.title = interactionCopy(interaction);
  objectChipEl.dataset.propType = interaction?.propType || '';
  objectChipEl.classList.toggle('show', !!interaction?.propType && !view.isMoving);
  roleChipEl.textContent = roleChip(agent.role);
  toolChipEl.textContent = agent.tool_icon || eventVisual.icon || '✨';
  toolChipEl.title = agentTooltipText(agent, currentLocale) || strings().idleFallback;
  poseChipEl.textContent = pose.icon || '✨';
  poseChipEl.title = poseLabelForLocale(currentLocale, pose.pose);
  eventChipEl.textContent = `${eventVisual.icon} ${short(eventVisual.label, 16)}`;
  eventChipEl.title = eventVisual.detail || eventVisual.label || '';
  eventChipEl.className = `event-chip ${eventVisual.tone || 'idle'}`;
  eventChipEl.classList.toggle('show', !!eventVisual.label);
  eventChipEl.classList.toggle('clickable', !!bubble.clickable);
  const sprite = getKenneyAgentSprite({ role: agent.role, state: agent.state, color: agent.color, facing: view.facing, frame: view.frame });
  imgEl.src = sprite?.src || createAgentSprite({ role: agent.role, state: agent.state, color: agent.color, facing: view.facing, frame: view.frame });
  imgEl.className = `agent-pixel ${sprite?.pixelClass || `fallback-${agent.role || 'main_agent'}`}`;
  imgEl.dataset.pack = sprite?.src ? 'kenney' : 'fallback';
  view.el.dataset.agentRole = agent.role || 'main_agent';
  imgEl.style.transform = sprite?.flipX ? 'scaleX(-1)' : '';
  imgEl.alt = agent.name;
  nameText.textContent = `${displayAgentName(agent)} · ${agent.instance_label || agent.agent}`;
  roomEl.textContent = `${agent.room_icon || '📍'} ${roomName}`;
  metaEl.textContent = agent.role === 'main_agent'
    ? short(interactionCopy(interaction) || eventVisual.detail || displayTask, 32)
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
  refreshDoorOpenStates();
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
  const safeTarget = snapToWalkable({ x: targetX, y: targetY });
  targetX = safeTarget.x;
  targetY = safeTarget.y;
  const route = buildRoute({ x: view.currentX, y: view.currentY }, { x: targetX, y: targetY }, fromRoomKey, roomKey);
  const targetDelta = Math.hypot(targetX - view.currentX, targetY - view.currentY);
  const routeBlocked = route.length < 2 && targetDelta > 0.2;
  if (routeBlocked) {
    view.data = { ...agent, x: view.currentX, y: view.currentY, room_key: fromRoomKey };
    decorateAgent(view);
    return;
  }
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

function syncFurnitureLayout(layout = {}) {
  furnitureSavedLayout = cloneLayout(layout || {});
  furnitureDraft = cloneLayout(layout || {});
  furnitureDirty = false;
  if (selectedFurnitureProp) {
    const next = (furnitureDraft[selectedFurnitureProp.originRoomKey] || [])[selectedFurnitureProp.index];
    if (next) {
      selectedFurnitureProp.roomKey = next.room || selectedFurnitureProp.originRoomKey;
      selectedFurnitureProp.x = Number(next.x || selectedFurnitureProp.x || 50);
      selectedFurnitureProp.y = Number(next.y || selectedFurnitureProp.y || 50);
      selectedFurnitureProp.scale = normalizeScale(next.scale || selectedFurnitureProp.scale || 1);
    } else {
      setSelectedFurnitureProp(null);
    }
  }
  setFurnitureLayoutOverrides(furnitureDraft);
  refreshFurnitureBlockers();
  updateFurnitureToolbar();
}

function districtAtPoint(clientX, clientY) {
  return Array.from(dom.world?.querySelectorAll('.district[data-room]') || []).find((district) => {
    const roomKey = district.dataset.room;
    if (!roomKey || roomKey === 'offline_corner') return false;
    const rect = district.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }) || null;
}

function currentLayoutSnapshot() {
  return exportFurnitureLayout();
}

function updateFurnitureDirtyState() {
  furnitureDirty = !layoutEquals(currentLayoutSnapshot(), furnitureSavedLayout || {});
  updateFurnitureToolbar();
}

function updateDraggedGuideVisual(roomKey, x, y, { create = false } = {}) {
  const propsLayer = dom.world?.querySelector(`.district[data-room="${roomKey}"] .district-props`);
  if (!propsLayer) return;
  if (create) {
    dom.world?.querySelectorAll('.room-edit-grid, .prop-guide').forEach((item) => {
      if (!propsLayer.contains(item)) item.remove();
    });
  }
  let guide = propsLayer.querySelector('.prop-guide');
  if (!guide && create) {
    const gridLines = buildGridLines();
    const grid = document.createElement('div');
    grid.className = 'room-edit-grid';
    grid.setAttribute('aria-hidden', 'true');
    grid.innerHTML = [
      ...gridLines.map((value) => `<span class="grid-line vertical${Math.abs(value - 50) < 0.01 ? ' mid' : ''}" style="left:${value}%"></span>`),
      ...gridLines.map((value) => `<span class="grid-line horizontal${Math.abs(value - 50) < 0.01 ? ' mid' : ''}" style="top:${value}%"></span>`),
    ].join('');
    guide = document.createElement('div');
    guide.className = 'prop-guide dragging';
    guide.innerHTML = `
      <span class="snap-guide vertical"></span>
      <span class="snap-guide horizontal"></span>
      <span class="snap-guide-dot"></span>
      <span class="prop-guide-badge"></span>
    `;
    propsLayer.prepend(grid, guide);
  }
  if (!guide) return;
  const style = dragPositionStyle(x, y);
  guide.style.left = style.left;
  guide.style.top = style.top;
  guide.classList.add('dragging');
  const badge = guide.querySelector('.prop-guide-badge');
  if (badge) badge.textContent = selectedPropGuideLabel();
}

function updateDraggedPropVisual(prop, roomKey, x, y) {
  if (!prop) return;
  const propsLayer = dom.world?.querySelector(`.district[data-room="${roomKey}"] .district-props`);
  if (propsLayer && prop.parentElement !== propsLayer) propsLayer.append(prop);
  prop.dataset.roomKey = roomKey;
  const style = dragPositionStyle(x, y);
  prop.style.left = style.left;
  prop.style.top = style.top;
  prop.classList.add('selected');
  updateDraggedGuideVisual(roomKey, x, y, { create: true });
  const meta = prop.querySelector('.prop-meta');
  if (meta) {
    const label = furnitureLabelForLocale(currentLocale, prop.dataset.propLabel, prop.dataset.propType);
    meta.textContent = `${label} · ${formatPercent(x)}%, ${formatPercent(y)}%`;
  }
}

function updateFurnitureDragGhost(event) {
  if (!propDragging?.ghost) return;
  propDragging.ghost.style.left = `${event.clientX - propDragging.offsetX}px`;
  propDragging.ghost.style.top = `${event.clientY - propDragging.offsetY}px`;
}

function applyDraftPosition(originRoomKey, index, x, y, options = {}) {
  const roomKey = options.roomKey || originRoomKey;
  const roomPositions = (furnitureDraft[originRoomKey] || getRoomPropPositions(originRoomKey)).map((item) => ({ ...item }));
  const nextX = normalizePercent(x, { step: options.step || furnitureSnapStep });
  const nextY = normalizePercent(y, { step: options.step || furnitureSnapStep });
  const current = roomPositions[index] || {};
  const nextScale = normalizeScale(options.scale || current.scale || 1);
  if (positionOverlapsFurniture(roomKey, roomDecorFor(roomKey), index, { x: nextX, y: nextY, scale: nextScale }, roomPositions, {
    originRoomKey,
    decorByRoom: getDecorByRoom(),
  })) {
    const now = Date.now();
    if (now - lastFurnitureCollisionAt > 900) {
      const copy = strings();
      showFurnitureToast('error', copy.layoutCollisionTitle, copy.layoutCollisionDetail);
      lastFurnitureCollisionAt = now;
    }
    return false;
  }
  roomPositions[index] = { x: nextX, y: nextY, room: roomKey, scale: nextScale };
  furnitureDraft[originRoomKey] = roomPositions;
  if (selectedFurnitureProp && selectedFurnitureProp.originRoomKey === originRoomKey && selectedFurnitureProp.index === index) {
    selectedFurnitureProp.roomKey = roomKey;
    selectedFurnitureProp.x = nextX;
    selectedFurnitureProp.y = nextY;
    selectedFurnitureProp.scale = nextScale;
  }
  if (propDragging && propDragging.originRoomKey === originRoomKey && propDragging.index === index) {
    propDragging.roomKey = roomKey;
    propDragging.x = nextX;
    propDragging.y = nextY;
    propDragging.scale = nextScale;
  }
  setFurnitureLayoutOverrides(furnitureDraft);
  refreshFurnitureBlockers();
  updateFurnitureDirtyState();
  if (options.prop) updateDraggedPropVisual(options.prop, roomKey, nextX, nextY);
  if (options.renderDistricts) queueDistrictRender();
  queueAgentRefresh();
  return true;
}

function applyDraftScale(originRoomKey, index, delta = 0) {
  const current = (furnitureDraft[originRoomKey] || getRoomPropPositions(originRoomKey))[index];
  if (!current || !selectedFurnitureProp) return false;
  const nextScale = normalizeScale((current.scale || 1) + delta);
  return applyDraftPosition(originRoomKey, index, current.x, current.y, {
    roomKey: current.room || selectedFurnitureProp.roomKey,
    scale: nextScale,
    renderDistricts: true,
  });
}

function showFurnitureToast(kind = 'info', title = '', body = '') {
  if (!dom.furnitureToast || !dom.furnitureToastTitle || !dom.furnitureToastBody) return;
  if (furnitureToastTimer) window.clearTimeout(furnitureToastTimer);
  dom.furnitureToast.className = `toast ${kind}`;
  dom.furnitureToastTitle.textContent = title;
  dom.furnitureToastBody.textContent = body;
  window.requestAnimationFrame(() => dom.furnitureToast?.classList.add('show'));
  furnitureToastTimer = window.setTimeout(() => {
    dom.furnitureToast?.classList.remove('show');
  }, 2600);
}

const missionCategoryColor = (category) => ({
  reasoning: '#a78bfa',
  tool: '#60a5fa',
  subagent: '#8b5cf6',
  session: '#22c55e',
  status: '#fbbf24',
  message: '#f472b6',
  completion: '#4ade80',
})[category] || '#fbbf24';
const missionLaneDom = new Map();

function createMissionLane(lane) {
  const article = document.createElement('article');
  article.className = 'mission-trace-lane';
  article.dataset.missionLane = lane.agentId;
  const header = document.createElement('header');
  const focus = document.createElement('button');
  focus.type = 'button';
  focus.className = 'mission-lane-agent';
  focus.dataset.selectionKind = 'agent';
  focus.dataset.selectionId = lane.agentId;
  const state = document.createElement('span');
  state.className = 'mission-lane-state';
  header.append(focus, state);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'mission-lane-track');
  svg.setAttribute('viewBox', '0 0 100 70');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'group');
  for (let index = 0; index < 7; index += 1) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const y = (index + 0.5) * 10;
    line.setAttribute('class', 'mission-lane-grid');
    line.setAttribute('d', `M 0 ${y} L 100 ${y}`);
    svg.append(line);
  }
  const events = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  events.setAttribute('class', 'mission-lane-events');
  svg.append(events);
  article.append(header, svg);
  const entry = { article, focus, state, events, eventNodes: new Map() };
  missionLaneDom.set(lane.agentId, entry);
  return entry;
}

function reconcileMissionLane(entry, lane) {
  const agent = lane.agent || {};
  entry.focus.textContent = agent.name || agent.agent || lane.agentId;
  entry.state.textContent = `${stateText(agent.state || 'idle')} · ${getRoomCopy(agent.buildingId || agent.room_key, currentLocale).name || agent.buildingId || agent.room_key || ''}`;
  const wanted = new Set(lane.events.map(({ id }) => id));
  entry.eventNodes.forEach((node, id) => {
    if (wanted.has(id)) return;
    node.remove();
    entry.eventNodes.delete(id);
  });
  lane.events.forEach((item) => {
    let node = entry.eventNodes.get(item.id);
    if (!node) {
      node = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      node.dataset.eventId = item.id;
      node.dataset.selectionKind = 'event';
      node.dataset.selectionId = item.id;
      node.setAttribute('class', 'mission-event-node');
      node.setAttribute('cx', '0');
      node.setAttribute('r', '3.2');
      node.setAttribute('tabindex', '0');
      node.setAttribute('role', 'button');
      const title = document.createElementNS('http://www.w3.org/2000/svg', 'title');
      node.append(title);
      entry.events.append(node);
      entry.eventNodes.set(item.id, node);
    }
    node.setAttribute('cy', String((item.categoryIndex + 0.5) * 10));
    node.setAttribute('fill', missionCategoryColor(item.category));
    const category = commandText(`commandDeck.hook.categories.${item.category}`);
    node.setAttribute('aria-label', commandText('commandDeck.timeline.eventLabel', {
      category,
      summary: item.summary || category,
    }));
    node.querySelector('title').textContent = item.summary || category;
  });
}

function renderMissionTrace(trace, { structureChanged = false } = {}) {
  if (!dom.events || !dom.eventSummary) return;
  currentMissionTrace = trace;
  const traceState = commandText(trace.live ? 'commandDeck.timeline.live' : 'commandDeck.timeline.paused');
  dom.eventSummary.textContent = commandText('commandDeck.timeline.summary', { state: traceState, count: trace.lanes.length });
  if (dom.missionTraceLive) {
    dom.missionTraceLive.hidden = trace.live;
    dom.missionTraceLive.setAttribute('aria-pressed', String(trace.live));
  }
  if (structureChanged) {
    const wanted = new Set(trace.lanes.map(({ agentId }) => agentId));
    missionLaneDom.forEach((entry, agentId) => {
      if (wanted.has(agentId)) return;
      entry.article.remove();
      missionLaneDom.delete(agentId);
    });
    trace.lanes.forEach((lane) => {
      const entry = missionLaneDom.get(lane.agentId) || createMissionLane(lane);
      reconcileMissionLane(entry, lane);
      dom.events.append(entry.article);
    });
  }
  trace.lanes.forEach((lane) => {
    const entry = missionLaneDom.get(lane.agentId);
    if (!entry) return;
    entry.article.classList.toggle('selected', currentCommandSelection?.kind === 'agent' && currentCommandSelection.id === lane.agentId);
    lane.events.forEach((item) => {
      const node = entry.eventNodes.get(item.id);
      if (!node) return;
      node.setAttribute('transform', `translate(${item.xPct} 0)`);
      node.classList.toggle('selected', item.selected);
    });
  });
}

function renderTimelineSvg(panel) {
  const rowHeight = 98 / Math.max(1, panel.rows.length);
  const gridLines = panel.rows.map((row) => {
    const y = Number((((row.index + 0.5) / panel.rows.length) * 98).toFixed(2));
    return `<line x1="0" y1="${y}" x2="100" y2="${y}" stroke="rgba(171,192,223,0.16)" stroke-width="0.6" />`;
  }).join('');
  const dots = panel.points.map((point) => `<circle cx="${point.xPct}" cy="${Number((point.yPct * 0.98).toFixed(2))}" r="2.8" fill="${point.color}"><title>${point.title} | ${point.summary}</title></circle>`).join('');
  return `<svg viewBox="0 0 100 98" preserveAspectRatio="none">${gridLines}${dots}</svg>`;
}

function renderTimelineHeartbeat(panel, nowMs = Date.now()) {
  const beatWidth = heartbeatBeatWidthPx(panel);
  const patternId = `ecg-${String(panel.agentId || 'agent').replace(/[^a-z0-9_-]/gi, '-')}`;
  return `<svg aria-hidden="true">
    <defs><pattern id="${patternId}" width="${beatWidth}" height="32" patternUnits="userSpaceOnUse"><path d="${buildHeartbeatPath(panel, nowMs, timelineRefreshMs, beatWidth)}" /></pattern></defs>
    <rect width="100%" height="32" fill="url(#${patternId})" />
  </svg>`;
}

function renderTimelinePanels(snapshot, { nowMs = snapshot?.server_time_ms || Date.now(), windowMs = 20 * 60 * 1000 } = {}) {
  if (!dom.eventSummary || !dom.events) return;
  const copy = strings();
  const panels = buildAgentTimelinePanels(snapshot, copy, { nowMs, windowMs });
  dom.eventSummary.textContent = panels.length ? copy.eventGraphSummary(panels.length) : copy.noEvents;
  if (!panels.length) {
    dom.events.innerHTML = `<div class="event-card"><div class="empty">${copy.waitingEvents}</div></div>`;
    return;
  }
  dom.events.innerHTML = `<div class="timeline-grid">${panels.map((panel) => `
    <article class="timeline-panel">
      <div class="event-top"><span>${panel.role === 'subagent' ? '🧬' : panel.role === 'branch_session' ? '🗂️' : '🤖'} ${panel.name}</span><span class="timeline-live-indicator ${panel.heartbeatTone}">${panel.connectionLabel}</span></div>
      <div class="timeline-live-state" aria-live="polite">
        <span class="timeline-state-pill">${panel.stateLabel}</span>
        <span>⌂ ${short(panel.roomLabel, 28)}</span>
        <span>› ${short(panel.taskLabel, 42)}</span>
        <span>${ageText(panel.ageSeconds)}</span>
      </div>
      <div class="timeline-heartbeat ${panel.heartbeatTone}">
        <span>${panel.heartbeatTone === 'stale' ? copy.heartbeatStale(ageText(panel.ageSeconds)) : panel.heartbeatTone === 'waiting' ? copy.heartbeatWaiting : copy.heartbeatLive(ageText(panel.ageSeconds))}</span>
        ${renderTimelineHeartbeat(panel, nowMs)}
        ${panel.canDelete ? `<button type="button" class="timeline-delete-agent" data-delete-agent="${encodeURIComponent(panel.agentId)}">${copy.deleteOfflineAgent || 'Delete'}</button>` : ''}
      </div>
      <div class="timeline-meta"><span>${copy.latestEvent}: ${panel.latestCategory}</span><span>${copy.blockedFor}: ${ageText(panel.ageSeconds)}</span></div>
      <div class="timeline-rows">
        <div class="timeline-row-labels" style="grid-template-rows: repeat(${panel.rows.length}, 1fr)">${panel.rows.map((row) => `<span>${row.label}</span>`).join('')}</div>
        <div>${renderTimelineSvg(panel)}</div>
      </div>
      <div class="event-summary">${short(panel.latestSummary || copy.noEvents, 120)}</div>
    </article>
  `).join('')}</div>`;
}

async function deleteOfflineAgent(agentId) {
  const copy = strings();
  if (!window.confirm(copy.deleteOfflineAgentConfirm?.(agentId) || `Delete offline agent ${agentId}?`)) return;
  const response = await fetch(`/api/agents?agent=${encodeURIComponent(agentId)}`, { method: 'DELETE' });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    window.alert(payload.detail || payload.error || copy.deleteOfflineAgentFailed || 'Unable to delete offline agent');
    return;
  }
  await refresh();
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

  renderInspectorAgentSelect(agents);
  const resolvedSelection = resolveCurrentCommandSelection(currentCommandSelection);
  renderInspector(resolvedSelection?.agent || agents.find((item) => item.agent === selectedAgentId) || (!currentCommandSelection ? agents[0] : null));
  if (dashboardDisclosure.activeCard === 'agents') renderDashboardCardContent();
  if (activeDialogAgentId) {
    const active = agents.find((item) => item.agent === activeDialogAgentId);
    if (active) openAgentDialog(active);
    else closeAgentDialog();
  }
}

function applyCommandSelectionStyling(resolved = null) {
  const agentId = resolved?.agent?.id || resolved?.agent?.agent || '';
  const buildingId = resolved?.buildingId || resolved?.building?.id || '';
  const hookId = resolved?.hook?.id || '';
  agentViews.forEach((view, id) => view.el.classList.toggle('selected', id === agentId));
  document.querySelectorAll('.district[data-room]').forEach((district) => district.classList.toggle('command-selected', district.dataset.room === buildingId));
  dom.agentLiveList?.querySelectorAll('[data-selection-kind="agent"]').forEach((row) => row.classList.toggle('selected', row.dataset.selectionId === agentId));
  dom.hookLiveChannels?.querySelectorAll('[data-selection-kind="hook"]').forEach((row) => row.classList.toggle('selected', row.dataset.selectionId === hookId));
}

function resolveCurrentCommandSelection(selection) {
  if (!currentCommandDeckModel || !selection) return null;
  const normalized = { kind: selection.kind, id: String(selection.id || '') };
  let resolved = resolveCommandSelection(currentCommandDeckModel, normalized);
  if (!resolved && ['event', 'agent'].includes(normalized.kind)) {
    const retainedLane = currentMissionTrace?.lanes.find((lane) => lane.agentId === normalized.id);
    const retainedEvent = currentMissionTrace?.lanes.flatMap((lane) => lane.events).find((item) => item.id === normalized.id);
    if (normalized.kind === 'event' && retainedEvent) {
      resolved = {
        kind: 'event', id: retainedEvent.id, event: retainedEvent,
        agent: retainedEvent.agent, building: retainedEvent.building,
        buildingId: retainedEvent.buildingId,
        hook: currentCommandDeckModel.selectionIndex?.hook?.[retainedEvent.hookSemantic] || null,
      };
    } else if (normalized.kind === 'agent' && retainedLane) {
      const agent = retainedLane.agent;
      const buildingId = retainedLane.buildingId;
      resolved = {
        kind: 'agent', id: retainedLane.agentId, agent, buildingId,
        building: currentCommandDeckModel.selectionIndex?.building?.[buildingId] || { id: buildingId },
        hook: currentCommandDeckModel.selectionIndex?.hook?.[agent.hookSemantic] || null,
        events: retainedLane.events,
      };
    }
  }
  return resolved;
}

function selectCommandDeck(selection, { publish = true } = {}) {
  if (!currentCommandDeckModel) return false;
  const normalized = selection && { kind: selection.kind, id: String(selection.id || '') };
  const resolved = resolveCurrentCommandSelection(normalized);
  if (!resolved) return false;
  currentCommandSelection = normalized;
  selectedAgentId = resolved.agent?.id || resolved.agent?.agent || selectedAgentId;
  const selectedEvent = resolved.event || [...(resolved.events || [])].sort((left, right) => Number(right.time || 0) - Number(left.time || 0))[0] || null;
  missionTraceController.select(selectedEvent?.id ?? null);
  repaintAgents();
  renderInspector(resolved.agent || null);
  applyCommandSelectionStyling(resolved);
  if (publish) {
    commandFocusSequence = Math.max(commandFocusSequence + 1, Date.now());
    const villageSelection = commandDeckFocusSelection(normalized, resolved);
    pixelworldBridge.setFocus(villageSelection, commandFocusSequence);
  }
  return true;
}

function resumeCommandDeckLive() {
  currentCommandSelection = null;
  missionTraceController.resume();
  applyCommandSelectionStyling(null);
}

function renderEvents(items = []) {
  if (currentCommandDeckModel) missionTraceController.setModel(currentCommandDeckModel);
  else if (!items.length && dom.events) dom.events.replaceChildren();
}

function renderLiveMonitoring(snapshot = {}, nowMs = Date.now()) {
  const rows = buildLiveAgentRail(snapshot, strings(), nowMs);
  const pageSize = window.innerWidth <= 840 ? 2 : 4;
  const page = liveAgentPage(rows, agentLivePageIndex, pageSize);
  agentLivePageIndex = page.page;
  if (dom.agentLivePage) dom.agentLivePage.textContent = commandText('commandDeck.dynamic.page', { page: page.page + 1, count: page.pageCount });
  if (dom.agentLivePrevious) dom.agentLivePrevious.disabled = !page.canPrevious;
  if (dom.agentLiveNext) dom.agentLiveNext.disabled = !page.canNext;
  if (dom.agentLiveList) {
    const items = page.items.map((row) => {
      const article = document.createElement('article');
      article.className = 'agent-live-row';
      article.tabIndex = 0;
      article.setAttribute('role', 'button');
      article.dataset.selectionKind = 'agent';
      article.dataset.selectionId = row.id;
      article.dataset.tone = row.tone;
      article.setAttribute('aria-label', `${row.name} · ${row.stateLabel} · ${row.room}`);
      const avatar = document.createElement('div');
      avatar.className = 'agent-live-avatar';
      avatar.textContent = row.name.slice(0, 1).toUpperCase();
      const copy = document.createElement('div');
      copy.className = 'agent-live-copy';
      const name = document.createElement('div'); name.className = 'agent-live-name'; name.textContent = row.name;
      const meta = document.createElement('div'); meta.className = 'agent-live-meta';
      meta.textContent = `${row.stateLabel} · ${row.room} · ${row.hook}`;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'agent-live-ecg'); svg.setAttribute('viewBox', '0 0 176 32');
      svg.dataset.agentEcg = row.id;
      svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${row.name} ${row.stateLabel}`);
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', row.path);
      svg.append(path); copy.append(name, meta, svg); article.append(avatar, copy);
      return article;
    });
    dom.agentLiveList.replaceChildren(...items);
    dom.agentLiveList.style.setProperty('--visible-agent-count', String(Math.max(1, page.items.length)));
    liveEcgController.sync(page.items);
  }
  const hook = hookRailForAgents(snapshot.agents, selectedAgentId);
  const roomCopy = getRoomCopy(hook.roomKey, currentLocale);
  if (dom.hookLiveSemantic) dom.hookLiveSemantic.textContent = commandText(`commandDeck.hook.semantic.${hook.semantic}`);
  if (dom.hookLiveBuilding) dom.hookLiveBuilding.textContent = roomCopy.name || hook.building;
  if (dom.hookLiveActivity) dom.hookLiveActivity.textContent = String(hook.activity || strings().idleFallback);
  if (dom.hookLiveAgent) dom.hookLiveAgent.textContent = hook.agentId;
  if (dom.hookLiveChannels) {
    const channels = hookChannelsForAgents(snapshot.agents, currentLocale, selectedAgentId, nowMs);
    dom.hookLiveChannels.replaceChildren(...channels.map((channel) => {
      const article = document.createElement('article');
      article.className = 'hook-live-channel';
      article.tabIndex = 0;
      article.setAttribute('role', 'button');
      article.dataset.selectionKind = 'hook';
      article.dataset.selectionId = channel.semantic;
      article.dataset.semantic = channel.semantic;
      article.dataset.active = String(channel.active);
      const header = document.createElement('header');
      const label = document.createElement('strong'); label.textContent = channel.label;
      const count = document.createElement('output'); count.textContent = String(channel.count);
      header.append(label, count);
      const activity = document.createElement('p');
      activity.textContent = String(channel.activity || strings().idleFallback);
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hook-live-ecg');
      svg.setAttribute('viewBox', '0 0 176 32');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', channel.path);
      svg.append(path);
      const agent = document.createElement('span'); agent.textContent = channel.agentId || '—';
      article.append(header, activity, svg, agent);
      return article;
    }));
  }
}

function renderSnapshot(snapshot) {
  const agedSnapshot = buildDashboardLiveSnapshot(snapshot, Number(snapshot.server_time_ms) || Date.now());
  const agents = normalizeVisibleAgents(agedSnapshot).map(normalizeAgentForWorld);
  dashboardLiveSnapshot = {
    ...agedSnapshot,
    agents,
    stats: {
      ...(agedSnapshot.stats || {}),
      agent_count: agents.length,
      subagent_count: agents.filter(({ role }) => role === 'subagent').length,
      branch_session_count: agents.filter(({ role }) => role === 'branch_session').length,
    },
  };
  currentSnapshot = dashboardLiveSnapshot;
  currentCommandDeckModel = buildCommandDeckModel(dashboardLiveSnapshot, {
    nowMs: Number(snapshot.server_time_ms) || Date.now(),
    buildings: Object.keys(ROOM_LAYOUTS).map((id) => ({ id })),
  });
  missionTraceController.setModel(currentCommandDeckModel);
  const sequence = snapshot.server_time_ms || Date.now();
  pixelworldBridge.setLocale(currentLocale, sequence);
  pixelworldBridge.setSnapshot(dashboardLiveSnapshot, sequence);
  if (!furnitureEditMode) syncFurnitureLayout(snapshot.furniture_layout || {});
  const copy = strings();
  dom.agentCount.textContent = String(dashboardLiveSnapshot.stats.agent_count || 0);
  dom.subagentCount.textContent = String(dashboardLiveSnapshot.stats.subagent_count || 0);
  dom.sessionCount.textContent = String(dashboardLiveSnapshot.stats.branch_session_count || dashboardLiveSnapshot.stats.active_session_count || 0);
  dom.worldState.textContent = snapshot.stats.hermes_connected ? copy.hermesConnected : copy.localOnly;
  dom.worldSummary.textContent = summarizeWorld(snapshot.stats, currentLocale);
  updateLastSyncText(snapshot, snapshot.server_time_ms);
  renderHeartbeat(dashboardLiveSnapshot);
  updateCurrentAgentState(dashboardLiveSnapshot);
  renderLiveMonitoring(dashboardLiveSnapshot);
  renderAgents(dashboardLiveSnapshot);
  if (currentCommandSelection) {
    const resolved = resolveCurrentCommandSelection(currentCommandSelection);
    if (resolved) {
      selectedAgentId = resolved.agent?.id || resolved.agent?.agent || selectedAgentId;
      renderInspector(resolved.agent || null);
      applyCommandSelectionStyling(resolved);
    }
  }
  if (dashboardDisclosure.activeCard) renderDashboardCardContent();
}

function beginFurnitureEdit() {
  const copy = strings();
  furnitureEditMode = true;
  furnitureSaving = false;
  furnitureSnapStep = resolveSnapStep(false);
  furnitureDraft = cloneLayout(furnitureSavedLayout || {});
  furnitureDirty = false;
  propDragging = null;
  setSelectedFurnitureProp(null);
  setFurnitureLayoutOverrides(furnitureDraft);
  refreshFurnitureBlockers();
  updateFurnitureToolbar();
  renderDistricts();
  showFurnitureToast('info', copy.layoutEditing, copy.layoutEditingHint);
}

function cancelFurnitureEdit() {
  const copy = strings();
  if (furnitureDirty && !window.confirm(copy.layoutExitConfirm)) return;
  furnitureEditMode = false;
  furnitureSaving = false;
  furnitureSnapStep = resolveSnapStep(false);
  propDragging = null;
  setSelectedFurnitureProp(null);
  syncFurnitureLayout(furnitureSavedLayout || {});
  updateFurnitureToolbar();
  renderDistricts();
  if (currentSnapshot) renderAgents(currentSnapshot);
  showFurnitureToast('info', copy.cancelLayout, copy.layoutReset);
}

async function saveFurnitureEdit() {
  const copy = strings();
  if (furnitureSaving) return;
  const layout = currentLayoutSnapshot();
  const changeCount = furnitureChangeCount(layout, furnitureSavedLayout || {});
  const roomCount = changedRoomCount(layout, furnitureSavedLayout || {});
  if (!furnitureDirty) {
    showFurnitureToast('info', copy.layoutEditing, copy.layoutNoChanges);
    return;
  }
  furnitureSaving = true;
  updateFurnitureToolbar();
  try {
    const res = await fetch('/api/furniture-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ layout }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    syncFurnitureLayout(payload.layout || layout);
    furnitureEditMode = false;
    furnitureSaving = false;
    furnitureSnapStep = resolveSnapStep(false);
    propDragging = null;
    setSelectedFurnitureProp(null);
    updateFurnitureToolbar();
    renderDistricts();
    if (currentSnapshot) renderAgents(currentSnapshot);
    dom.worldState.textContent = copy.layoutSaved;
    showFurnitureToast('success', copy.saveLayout, copy.layoutSavedDetail(changeCount, roomCount));
  } catch (err) {
    furnitureSaving = false;
    updateFurnitureToolbar();
    dom.worldState.textContent = `${copy.layoutSaveFailed}: ${err.message}`;
    showFurnitureToast('error', copy.layoutSaveFailed, err.message);
  }
}

function setupFurnitureEditor() {
  dom.editFurnitureButton?.addEventListener('click', beginFurnitureEdit);
  dom.cancelFurnitureButton?.addEventListener('click', cancelFurnitureEdit);
  dom.saveFurnitureButton?.addEventListener('click', saveFurnitureEdit);
  dom.furnitureCoordHud?.addEventListener('click', (event) => {
    if (!furnitureEditMode || furnitureSaving || !selectedFurnitureProp) return;
    const button = event.target.closest('[data-furniture-scale]');
    if (!button) return;
    const direction = Number(button.dataset.furnitureScale || 0);
    if (!direction) return;
    const accepted = applyDraftScale(
      selectedFurnitureProp.originRoomKey,
      selectedFurnitureProp.index,
      direction * SCALE_STEP,
    );
    if (!accepted) {
      const copy = strings();
      showFurnitureToast('error', copy.layoutCollisionTitle, copy.layoutCollisionBody);
    }
    updateFurnitureEditorBanner();
    event.preventDefault();
    event.stopPropagation();
  });

  dom.world?.addEventListener('pointerdown', (event) => {
    if (!furnitureEditMode || furnitureSaving) return;
    const prop = event.target.closest('.prop');
    if (!prop) {
      if (selectedFurnitureProp) {
        setSelectedFurnitureProp(null);
        queueDistrictRender();
        updateFurnitureEditorBanner();
      }
      return;
    }
    const roomKey = prop.dataset.roomKey;
    const originRoomKey = prop.dataset.originRoomKey || roomKey;
    const index = Number(prop.dataset.propIndex || 0);
    const district = prop.closest('.district');
    const rect = district?.getBoundingClientRect();
    const propRect = prop.getBoundingClientRect();
    if (!roomKey || !rect || !propRect) return;
    const current = (furnitureDraft[originRoomKey] || getRoomPropPositions(originRoomKey))[index] || { x: 50, y: 50, room: roomKey };
    setSelectedFurnitureProp({
      roomKey,
      originRoomKey,
      index,
      propType: prop.dataset.propType || 'prop',
      label: prop.dataset.propLabel || prop.dataset.propType || 'prop',
      x: Number(current.x || 50),
      y: Number(current.y || 50),
      scale: normalizeScale(current.scale || prop.dataset.propScale || 1),
    });
    propDragging = {
      roomKey,
      originRoomKey,
      index,
      prop,
      rect,
      propType: prop.dataset.propType || 'prop',
      label: prop.dataset.propLabel || prop.dataset.propType || 'prop',
      offsetX: event.clientX - (propRect.left + propRect.width / 2),
      offsetY: event.clientY - (propRect.top + propRect.height / 2),
      x: Number(current.x || 50),
      y: Number(current.y || 50),
      scale: normalizeScale(current.scale || prop.dataset.propScale || 1),
      pointerId: event.pointerId,
    };
    const ghost = prop.cloneNode(true);
    ghost.classList.add('furniture-drag-ghost', 'dragging');
    ghost.classList.remove('selected');
    document.body.append(ghost);
    propDragging.ghost = ghost;
    prop.setPointerCapture?.(event.pointerId);
    prop.classList.add('dragging', 'drag-source');
    updateFurnitureDragGhost(event);
    updateDraggedGuideVisual(roomKey, propDragging.x, propDragging.y, { create: true });
    updateFurnitureEditorBanner();
    event.preventDefault();
    event.stopPropagation();
  });

  window.addEventListener('pointermove', (event) => {
    if (!propDragging || furnitureSaving) return;
    updateFurnitureDragGhost(event);
    const district = districtAtPoint(event.clientX, event.clientY);
    if (!district) {
      updateFurnitureEditorBanner();
      return;
    }
    const roomKey = district.dataset.room;
    const liveRect = district.getBoundingClientRect();
    const rawX = (((event.clientX - liveRect.left) - propDragging.offsetX) / liveRect.width) * 100;
    const rawY = (((event.clientY - liveRect.top) - propDragging.offsetY) / liveRect.height) * 100;
    furnitureSnapStep = resolveSnapStep(event.shiftKey);
    const x = normalizePercent(rawX, { step: furnitureSnapStep });
    const y = normalizePercent(rawY, { step: furnitureSnapStep });
    propDragging.rect = liveRect;
    const accepted = applyDraftPosition(propDragging.originRoomKey, propDragging.index, x, y, {
      prop: propDragging.prop,
      roomKey,
      step: furnitureSnapStep,
    });
    if (accepted) {
      propDragging.roomKey = roomKey;
      propDragging.x = x;
      propDragging.y = y;
    }
    updateFurnitureEditorBanner();
  });

  const finishDrag = ({ rerender = true } = {}) => {
    if (!propDragging) return;
    const settled = { ...propDragging };
    setSelectedFurnitureProp(settled);
    propDragging.prop?.releasePointerCapture?.(propDragging.pointerId);
    propDragging.prop?.classList.remove('dragging', 'drag-source');
    propDragging.ghost?.remove();
    propDragging = null;
    updateFurnitureEditorBanner();
    if (rerender) {
      queueDistrictRender();
      queueAgentRefresh();
    }
  };

  window.addEventListener('pointerup', () => finishDrag());
  window.addEventListener('pointercancel', () => finishDrag());
  window.addEventListener('keydown', (event) => {
    if (!furnitureEditMode || furnitureSaving) return;
    if (event.key === 'Escape') {
      if (propDragging) {
        finishDrag();
        return;
      }
      cancelFurnitureEdit();
      return;
    }
    if (event.key === 'Enter' && furnitureDirty) {
      event.preventDefault();
      saveFurnitureEdit();
      return;
    }
    if (!selectedFurnitureProp) return;
    const delta = { x: 0, y: 0 };
    const step = resolveSnapStep(event.shiftKey);
    furnitureSnapStep = step;
    if (event.key === 'ArrowLeft') delta.x = -step;
    if (event.key === 'ArrowRight') delta.x = step;
    if (event.key === 'ArrowUp') delta.y = -step;
    if (event.key === 'ArrowDown') delta.y = step;
    if (!delta.x && !delta.y) return;
    event.preventDefault();
    const nextX = clampPercent(selectedFurnitureProp.x + delta.x);
    const nextY = clampPercent(selectedFurnitureProp.y + delta.y);
    applyDraftPosition(selectedFurnitureProp.originRoomKey, selectedFurnitureProp.index, nextX, nextY, {
      renderDistricts: true,
      roomKey: selectedFurnitureProp.roomKey,
      step,
    });
    updateFurnitureEditorBanner();
  });
  window.addEventListener('beforeunload', (event) => {
    if (!furnitureEditMode || !furnitureDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
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
  pollTimer = window.setInterval(refresh, Math.max(100, timelineRefreshMs));
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
      if (event.target.closest('button, select, option, input, textarea, a')) return;
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

function setupResizablePanels() {
  const legacyPanels = legacyResizablePanels(dom.resizablePanels);
  const restore = (panel) => {
    const key = panel.dataset.resizablePanel;
    const saved = Number(localStorage.getItem(`pixelverse:size:${key}`));
    if (!Number.isFinite(saved) || saved <= 0) return;
    panel.style.height = `${saved}px`;
  };
  legacyPanels.forEach(restore);
  if (!window.ResizeObserver) return;
  const observer = new ResizeObserver((entries) => {
    entries.forEach(({ target }) => {
      if (mobileMode) return;
      const key = target.dataset.resizablePanel;
      const bounds = target.getBoundingClientRect();
      const size = bounds.height;
      if (!key || !Number.isFinite(size) || size <= 0) return;
      localStorage.setItem(`pixelverse:size:${key}`, String(Math.round(size)));
    });
  });
  legacyPanels.forEach((panel) => observer.observe(panel));
}

function setupWorkbenchLayout() {
  if (!dom.sidebarResizer || !dom.timelineResizer) return;
  workbenchLayoutController?.destroy();
  workbenchLayoutController = setupWorkbenchLayoutController({
    sidebarHandle: dom.sidebarResizer,
    timelineHandle: dom.timelineResizer,
    sidebarPanel: dom.resizablePanels.find((panel) => panel.dataset.resizablePanel === 'sidebar'),
    timelinePanel: dom.resizablePanels.find((panel) => panel.dataset.resizablePanel === 'timeline'),
    root: document.documentElement,
    body: dom.body,
    storage: dashboardStorage,
    resizeTarget: window,
    sidebarEdge: 'right',
    isMobile: () => mobileMode,
    viewport: () => ({
      width: window.innerWidth,
      height: window.innerHeight,
      workbenchTop: workbenchTopFor(dom.brand?.getBoundingClientRect().height || 0),
    }),
    onResize: () => window.dispatchEvent(new Event('resize')),
    observeHeader: (callback) => {
      if (!window.ResizeObserver || !dom.brand) return null;
      const observer = new ResizeObserver(callback);
      observer.observe(dom.brand);
      return () => observer.disconnect();
    },
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
  const zoomAtCenter = (deltaY) => {
    const currentViewport = viewport();
    const next = nextZoomState({
      offset: cameraOffset,
      scale: cameraScale,
      viewport: currentViewport,
      stage: stage(),
      pointer: { x: currentViewport.width / 2, y: currentViewport.height / 2 },
      deltaY,
    });
    cameraOffset = next.offset;
    cameraScale = next.scale;
    applyCameraTransform(false);
  };
  recenter();
  window.addEventListener('resize', recenter);
  dom.world.addEventListener('pointerdown', (event) => {
    if (furnitureEditMode && event.target.closest('.prop')) return;
    if (event.target.closest('.agent-speech') || event.target.closest('.event-chip') || event.target.closest('.speech-dialog')) return;
    if (event.target.closest('.agent') || event.target.closest('[data-draggable-panel]') || event.target.closest('button') || event.target.closest('select')) {
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
  dom.zoomInButton?.addEventListener('click', () => zoomAtCenter(-120));
  dom.zoomOutButton?.addEventListener('click', () => zoomAtCenter(120));
  dom.zoomResetButton?.addEventListener('click', () => {
    cameraScale = 1;
    cameraOffset = centeredCamera(viewport(), stage(), cameraScale);
    applyCameraTransform(false);
  });
}

const localeController = createCommandDeckLocaleController({
  initialLocale: currentLocale,
  localeSelect: dom.languageSelect,
  bridge: pixelworldBridge,
  getSnapshot: () => currentSnapshot,
  getMissionTrace: () => currentMissionTrace,
  getSelection: () => currentCommandSelection,
  onLocale: (locale) => { currentLocale = locale; },
  applyStaticCopy,
  renderSnapshot,
  renderMissionTrace,
  renderLiveMonitoring,
  resolveSelection: resolveCurrentCommandSelection,
  renderInspector,
});
localeController.attach();

dom.exposureSelect?.addEventListener('change', (event) => {
  setExposureMode(event.target.value);
});

dom.copyExposureButton?.addEventListener('click', copyExposureUrl);

dom.dashboardCardButtons.forEach((button) => {
  button.addEventListener('click', () => changeDashboardCard(button.dataset.dashboardCard, button));
  button.addEventListener('pointerdown', (event) => {
    if (event.pointerType !== 'touch') return;
    if (dashboardTouchTooltipTimer) window.clearTimeout(dashboardTouchTooltipTimer);
    dom.dashboardCardButtons.forEach((item) => item.removeAttribute('data-tooltip-visible'));
    button.dataset.tooltipVisible = 'true';
    dashboardTouchTooltipTimer = window.setTimeout(() => {
      button.removeAttribute('data-tooltip-visible');
      dashboardTouchTooltipTimer = null;
    }, 1600);
  });
});

document.addEventListener('pointerdown', (event) => {
  lastDashboardInputModality = dashboardInputModality(event);
  if (!dashboardDisclosure.activeCard) return;
  if (event.target.closest('#dashboard-card, [data-dashboard-card]')) return;
  closeDashboardCard({ deferFocus: true });
}, { capture: true });

document.addEventListener('keydown', (event) => {
  lastDashboardInputModality = dashboardInputModality(event);
  if (event.key !== 'Escape') return;
  closeDashboardCard({ deferFocus: true });
});

dom.dashboardCardPrevious?.addEventListener('click', () => {
  const name = dashboardDisclosure.activeCard;
  if (!name) return;
  dashboardPages[name] -= 1;
  renderDashboardCardContent();
});

dom.dashboardCardNext?.addEventListener('click', () => {
  const name = dashboardDisclosure.activeCard;
  if (!name) return;
  dashboardPages[name] += 1;
  renderDashboardCardContent();
});

dom.agentLivePrevious?.addEventListener('click', () => {
  agentLivePageIndex -= 1;
  if (dashboardLiveSnapshot) renderLiveMonitoring(dashboardLiveSnapshot);
});

dom.agentLiveNext?.addEventListener('click', () => {
  agentLivePageIndex += 1;
  if (dashboardLiveSnapshot) renderLiveMonitoring(dashboardLiveSnapshot);
});

window.addEventListener('resize', () => {
  if (dashboardLiveSnapshot) renderLiveMonitoring(dashboardLiveSnapshot);
});

dom.mobileModeButton?.addEventListener('click', () => {
  mobileMode = !mobileMode;
  if (mobileMode) sidebarOpen = false;
  localStorage.setItem('pixelverse:mobile-mode', mobileMode ? '1' : '0');
  localStorage.setItem('pixelverse:sidebar-open', sidebarOpen ? '1' : '0');
  applyMobileMode();
  window.dispatchEvent(new Event('resize'));
});

dom.sidebarToggleButton?.addEventListener('click', () => {
  sidebarOpen = !sidebarOpen;
  localStorage.setItem('pixelverse:sidebar-open', sidebarOpen ? '1' : '0');
  applyMobileMode();
});

dom.dialogBackdrop?.addEventListener('click', (event) => {
  if (!event.target.closest('.speech-dialog')) closeAgentDialog();
});

dom.inspectorAgentSelect?.addEventListener('change', (event) => {
  selectCommandDeck({ kind: 'agent', id: event.target.value });
});

dom.events?.addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-agent]');
  if (button) {
    deleteOfflineAgent(decodeURIComponent(button.dataset.deleteAgent || ''));
    return;
  }
  const target = event.target.closest('[data-selection-kind][data-selection-id]');
  if (target) selectCommandDeck({ kind: target.dataset.selectionKind, id: target.dataset.selectionId });
});

dom.events?.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const target = event.target.closest('[data-selection-kind][data-selection-id]');
  if (!target) return;
  event.preventDefault();
  selectCommandDeck({ kind: target.dataset.selectionKind, id: target.dataset.selectionId });
});

dom.agentLiveList?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-selection-kind="agent"]');
  if (target) selectCommandDeck({ kind: 'agent', id: target.dataset.selectionId });
});
dom.agentLiveList?.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const target = event.target.closest('[data-selection-kind="agent"]');
  if (!target) return;
  event.preventDefault();
  selectCommandDeck({ kind: 'agent', id: target.dataset.selectionId });
});

dom.hookLiveChannels?.addEventListener('click', (event) => {
  const target = event.target.closest('[data-selection-kind="hook"]');
  if (target) selectCommandDeck({ kind: 'hook', id: target.dataset.selectionId });
});
dom.hookLiveChannels?.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const target = event.target.closest('[data-selection-kind="hook"]');
  if (!target) return;
  event.preventDefault();
  selectCommandDeck({ kind: 'hook', id: target.dataset.selectionId });
});

dom.world?.addEventListener('click', (event) => {
  const district = event.target.closest('.district[data-room]');
  if (district && !furnitureEditMode) selectCommandDeck({ kind: 'building', id: district.dataset.room });
});
dom.world?.addEventListener('keydown', (event) => {
  if (!['Enter', ' '].includes(event.key)) return;
  const district = event.target.closest('.district[data-room]');
  if (!district || furnitureEditMode) return;
  event.preventDefault();
  selectCommandDeck({ kind: 'building', id: district.dataset.room });
});

dom.missionTraceLive?.addEventListener('click', resumeCommandDeckLive);

function adjustRefreshInterval(deltaMs) {
  timelineRefreshMs = clampNumber(timelineRefreshMs + deltaMs, 100, 10_000);
  localStorage.setItem('pixelverse:timeline-refresh-ms', String(timelineRefreshMs));
  updateRefreshController();
  restartTimelineTimer();
  startLiveUiTicker();
  if (pollTimer) startPolling();
}

dom.refreshSlowerButton?.addEventListener('click', () => adjustRefreshInterval(100));
dom.refreshFasterButton?.addEventListener('click', () => adjustRefreshInterval(-100));

async function initializeApp() {
  setupPressFeedback();
  try {
    await loadGlobalMap();
  } catch (err) {
    console.warn('[pixelverse] using fallback global map:', err);
  }
  populateLocaleSelect();
  applyStaticCopy();
  syncGlobalMapDom();
  refreshFurnitureBlockers();
  loadExposure();
  updateRefreshController();
  setupDraggablePanels();
  setupResizablePanels();
  setupWorkbenchLayout();
  setupCameraPan();
  setupFurnitureEditor();
  liveEcgController.start();
  missionTraceController.start();
  commandDeckLayoutController.start();
  renderCommandDeckControls();
  startLiveUiTicker();
  restartTimelineTimer();
  connectRealtime();
  if (patrolTimer) clearInterval(patrolTimer);
  patrolTimer = window.setInterval(patrolActiveAgents, 1500);
}

initializeApp();

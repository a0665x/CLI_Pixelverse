import {applyAgentPortrait} from './agent_portrait.mjs';
const rabbitLiveFrames=new Map();
import {rabbitIdentity,worldSpritePortrait} from './agent_identity.mjs';
let rabbitPortraitSources=[];
const villagePortrait=agent=>{if(document.body.dataset.worldView!=='3d')return worldSpritePortrait(agent,document.body.dataset.officePack==='free',rabbitLiveFrames.get(agent.agent||agent.id||''));const index=rabbitIdentity(agent.agent||agent.id||'').index;return {src:rabbitPortraitSources[index]||'/pixelworld/assets/honey-meshy/reference.png',pixelClass:rabbitPortraitSources[index]?'rabbit-portrait':`rabbit-portrait rabbit-coat-${index}`};};
import {
  activityHintForLocale,
  agentConnectionStatusText,
  agentTaskText,
  agentToolText,
  getLocaleLabel,
  getLocaleStrings,
  getRoomCopy,
  eventSummaryForLocale,
  eventTitleForLocale,
  LOCALE_LABELS,
  normalizeLocale,
  summarizeWorld,
  SUPPORTED_LOCALES,
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
import { buildAgentDialog } from './agent_dialog.mjs';
import { buildAgentRoster } from './agent_roster_model.mjs';
import { createAgentRosterView } from './agent_roster_view.mjs';
import { buildAgentDetail } from './agent_detail_model.mjs';
import { createAgentDetailView } from './agent_detail_view.mjs';
import { createVillageFirstLayoutController } from './village_first_layout.mjs';
import { createCommandDeckLocaleController } from './command_deck_locale_controller.mjs';
import { currentAgentStatePresentation, escapeHtml, timelinePayloadPresentation } from './command_deck_payload_presenters.mjs';
import { nextDraggedOffset } from './ui_state.mjs';
import { hookStateRoutes } from './hook_state_map.mjs';
import { formatTimelineItemForLocale } from './timeline_item_presenter.mjs';
import { buildAgentTimelinePanels, buildHeartbeatPath, heartbeatBeatWidthPx } from './agent_timeline_graphs.mjs';
import {
  hookChannelsForAgents,
  hookGuideForLocale,
  hookRailForAgents,
  normalizeAgentForWorld,
  normalizeVisibleAgents,
} from './live_agent_rails.mjs';
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
import { buildCommandDeckModel, commandBuildingIds, resolveCommandSelection } from './command_deck_model.mjs';
import { createMissionTraceController } from './mission_trace.mjs';

const dom = {
  agentLiveList: document.getElementById('agent-live-list'),
  agentDetail: document.getElementById('agent-detail'),
  villageTopSplitter: document.getElementById('village-top-splitter'),
  villageRosterSplitter: document.getElementById('village-roster-splitter'),
  villageDetailSplitter: document.getElementById('village-detail-splitter'),
  villageResetLayout: document.getElementById('village-reset-layout'),
  needsAttentionCount: document.getElementById('needs-attention-count'),
  activeAgentCount: document.getElementById('active-agent-count'),
  idleAgentCount: document.getElementById('idle-agent-count'),
  offlineAgentCount: document.getElementById('offline-agent-count'),
  liveLeftSplitter: document.getElementById('live-left-splitter'),
  liveRightSplitter: document.getElementById('live-right-splitter'),
  brand: document.querySelector('.brand'),
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
  dashboardHelpButton: document.getElementById('settings-open-help-btn'),
  eventSummary: document.getElementById('event-summary'),
  events: document.getElementById('events'),
  missionTraceLive: document.getElementById('mission-trace-live'),
  exposureLabel: document.getElementById('exposure-label'),
  exposureSelect: document.getElementById('exposure-select'),
  exposureUrl: document.getElementById('exposure-url'),
  copyExposureButton: document.getElementById('copy-exposure-btn'),
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
  mobileModeButton: document.getElementById('mobile-mode-btn'),
  pixelworldFrame: document.getElementById('pixelworld-frame'),
  panels: Array.from(document.querySelectorAll('[data-draggable-panel]')),
  panelHandles: Array.from(document.querySelectorAll('[data-drag-handle]')),
  resizablePanels: Array.from(document.querySelectorAll('[data-resizable-panel]')),
  dialogBackdrop: document.getElementById('speech-dialog-backdrop'),
  dialogPanel: document.getElementById('speech-dialog'),
  dialogTitle: document.getElementById('speech-dialog-title'),
  dialogBody: document.getElementById('speech-dialog-body'),
  dialogRows: document.getElementById('speech-dialog-rows'),
  sidebarCloseButton: document.getElementById('sidebar-close-btn'),
  sidebarTitle: document.getElementById('sidebar-title'),
  sidebarToggleButton: document.getElementById('sidebar-toggle-btn'),
  sidebarResizer: document.getElementById('sidebar-resizer'),
  sessionCount: document.getElementById('session-count'),
  subagentCount: document.getElementById('subagent-count'),
  timelineResizer: document.getElementById('timeline-resizer'),
  timelineRefreshLabel: document.getElementById('timeline-refresh-label'),
  topSettings: document.getElementById('top-settings'),
  topSettingsSummary: document.getElementById('top-settings-summary'),
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
  agentCount: document.getElementById('agent-count'),
};

let currentSnapshot = null;
let currentCommandDeckModel = null;
let currentCommandSelection = null;
let currentMissionTrace = null;
let commandFocusSequence = 0;
let currentExposure = null;
let selectedAgentId = null;
let pollTimer = null;
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
let cancelDashboardFocusRestore = null;
const cutawayFocusHandoff = createCutawayFocusHandoff({
  schedule: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
});
const liveEcgController = createLiveEcgController({ root: dom.workspace });
const villageFirstLayoutController = createVillageFirstLayoutController({
  workspace: dom.workspace,
  handles: {
    top: dom.villageTopSplitter,
    roster: dom.villageRosterSplitter,
    detail: dom.villageDetailSplitter,
  },
  storage: dashboardStorage,
  viewport: () => ({ width: window.innerWidth, height: window.innerHeight }),
  eventTarget: window,
});
const agentDetailView = createAgentDetailView({
  root: dom.agentDetail,
  documentRef: document,
  spriteFor: villagePortrait,
  textFor: (key, params = {}) => key.startsWith('rooms.')
    ? (getRoomCopy(key.split('.')[1], currentLocale).name || key)
    : uiText(currentLocale, key, params),
  eventTextFor: (event) => eventSummaryForLocale(event, currentLocale),
  onClose: () => villageFirstLayoutController.setDetailOpen(false),
});
const agentRosterView = createAgentRosterView({
  root: dom.agentLiveList,
  spriteFor: villagePortrait,
  textFor: (key, params = {}) => key === 'select'
    ? uiText(currentLocale, 'commandDeck.inspector.liveDetail', params)
    : uiText(currentLocale, `commandDeck.roster.signal.${key}`, params),
  onActivate: (selection, trigger) => activateAgentDetail(selection.id, { trigger }),
});
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
  onFocus: (selection) => selection?.kind === 'agent'
    ? activateAgentDetail(selection.id, { trigger: dom.pixelworldFrame, publish: false })
    : selectCommandDeck(selection, { publish: false }),
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
let panelDragging = null;
let activeDialogAgentId = null;

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
  const detail = agentTaskText(agent, currentLocale) || strings().idleFallback;
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
  const detail = agentConnectionStatusText(currentLocale, mainAgent)
    || agentTaskText(mainAgent, currentLocale)
    || activityHintForLocale(currentLocale, mainAgent, roomName);
  const presentation = currentAgentStatePresentation({
    name: displayAgentName(mainAgent), state: stateText(mainAgent.state), room: roomName, detail,
  });
  updateLiveRegionText(dom.currentAgentState, presentation.text);
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
    restoreCurrentCommandSelectionStyling();
  }, Math.max(100, timelineRefreshMs));
}

function ageText(ageSeconds = 0) {
  const copy = strings();
  return ageSeconds < 60 ? copy.secondsAgo(Math.round(ageSeconds)) : copy.minutesAgo(ageSeconds / 60);
}

function stateText(state = 'idle') {
  return strings().states[state] || state;
}

function roleLabel(role = 'main_agent') {
  if (role === 'subagent') return strings().roleSubagent;
  if (role === 'branch_session') return strings().roleBranch;
  return strings().roleMain;
}

function activityHintText(agent) {
  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || strings().unknownRoom;
  return activityHintForLocale(currentLocale, agent, roomName, agent.task || '');
}

function formatTimelineItem(item = {}) {
  return formatTimelineItemForLocale(currentLocale, item);
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
  document.querySelectorAll('[data-i18n-tooltip]').forEach((element) => {
    element.dataset.tooltip = commandText(element.dataset.i18nTooltip);
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
  setText('exposure-label', copy.exposureLabel);
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
  applyMobileMode();
  updateCurrentAgentState(currentSnapshot || {});
  if (!selectedAgentId && dom.inspectorBody) {
    dom.inspectorBody.className = 'empty';
    dom.inspectorBody.textContent = copy.inspectorEmpty;
  }
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
    dom.copyExposureButton.title = `${strings().copyUrl}: ${currentExposure.active_url || ''}`;
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
    dom.exposureUrl.textContent = `${strings().exposureFailed}: ${err.message}`;
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
    window.prompt(strings().copyUrlPrompt, url);
  }
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
    return `<div class="timeline-item"><strong>${escapeHtml(details.label)}</strong><br>${escapeHtml(details.message)}</div>`;
  }).join('') || `<div class="empty">${copy.noActions}</div>`;

  const room = getRoomCopy(agent.room_key, currentLocale);
  const roomName = room.name || agent.room_label || copy.unknownRoom;
  const currentTask = agentTaskText(agent, currentLocale) || copy.idleFallback;
  const toolPill = agentToolText(agent, currentLocale) || agentTaskText(agent, currentLocale);
  dom.inspectorBody.className = '';
  dom.inspectorBody.innerHTML = `
    <div class="inspector-card">
      <div>
        <div class="subtitle">${roleLabel(agent.role)}</div>
        <div class="strong">${escapeHtml(displayAgentName(agent))}</div>
      </div>
      <div class="pill-row">
        <span class="pill">${escapeHtml(agent.room_icon || '📍')} ${escapeHtml(roomName)}</span>
        <span class="pill">${stateText(agent.state)}</span>
        ${toolPill ? `<span class="pill">${escapeHtml(agent.tool_icon || '✨')} ${escapeHtml(toolPill)}</span>` : ''}
        ${agent.session_id ? `<span class="pill">${copy.sessionLabel(agent.session_id)}</span>` : ''}
      </div>
      <div class="stat-grid">
        <div class="stat">${copy.currentTask}<br><span class="strong">${escapeHtml(currentTask)}</span></div>
        <div class="stat">${copy.lastUpdate}<br><span class="strong">${ageText(agent.age_seconds || 0)}</span></div>
        <div class="stat">${copy.roomMeaning}<br><span class="strong">${escapeHtml(activityHintText(agent))}</span></div>
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
      <span class="muted">${escapeHtml(row.label)}</span>
      <strong>${escapeHtml(row.value)}</strong>
    </div>
  `).join('');
  dom.dialogBackdrop.classList.add('show');
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
  const dots = panel.points.map((point) => `<circle cx="${point.xPct}" cy="${Number((point.yPct * 0.98).toFixed(2))}" r="2.8" fill="${point.color}"><title>${escapeHtml(point.title)} | ${escapeHtml(point.summary)}</title></circle>`).join('');
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
  dom.events.innerHTML = `<div class="timeline-grid">${panels.map((panel) => {
    const payload = timelinePayloadPresentation(panel, copy.noEvents);
    return `
    <article class="timeline-panel">
      <div class="event-top"><span>${panel.role === 'subagent' ? '🧬' : panel.role === 'branch_session' ? '🗂️' : '🤖'} ${escapeHtml(panel.name)}</span><span class="timeline-live-indicator ${panel.heartbeatTone}">${escapeHtml(panel.connectionLabel)}</span></div>
      <div class="timeline-live-state" aria-live="polite">
        <span class="timeline-state-pill">${escapeHtml(panel.stateLabel)}</span>
        <span>⌂ ${escapeHtml(panel.roomLabel)}</span>
        <span>› ${payload.taskHtml}</span>
        <span>${ageText(panel.ageSeconds)}</span>
      </div>
      <div class="timeline-heartbeat ${panel.heartbeatTone}">
        <span>${panel.heartbeatTone === 'stale' ? copy.heartbeatStale(ageText(panel.ageSeconds)) : panel.heartbeatTone === 'waiting' ? copy.heartbeatWaiting : copy.heartbeatLive(ageText(panel.ageSeconds))}</span>
        ${renderTimelineHeartbeat(panel, nowMs)}
        ${panel.canDelete ? `<button type="button" class="timeline-delete-agent" data-delete-agent="${encodeURIComponent(panel.agentId)}">${copy.deleteOfflineAgent || 'Delete'}</button>` : ''}
      </div>
      <div class="timeline-meta"><span>${copy.latestEvent}: ${panel.latestCategory}</span><span>${copy.blockedFor}: ${ageText(panel.ageSeconds)}</span></div>
      <div class="timeline-rows">
        <div class="timeline-row-labels" style="grid-template-rows: repeat(${panel.rows.length}, 1fr)">${panel.rows.map((row) => `<span>${escapeHtml(row.label)}</span>`).join('')}</div>
        <div>${renderTimelineSvg(panel)}</div>
      </div>
      <div class="event-summary">${payload.summaryHtml}</div>
    </article>
  `;
  }).join('')}</div>`;
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
  const agents = snapshot.agents || [];
  renderInspectorAgentSelect(agents);
  const resolvedSelection = resolveCurrentCommandSelection(currentCommandSelection);
  renderInspector(resolvedSelection?.agent || agents.find((item) => item.agent === selectedAgentId)
    || (!currentCommandSelection ? agents[0] : null));
  if (dashboardDisclosure.activeCard === 'agents') renderDashboardCardContent();
  if (activeDialogAgentId) {
    const active = agents.find((item) => item.agent === activeDialogAgentId);
    if (active) openAgentDialog(active); else closeAgentDialog();
  }
}

function applyCommandSelectionStyling(resolved = null) {
  const agentId = resolved?.agent?.id || resolved?.agent?.agent || '';
  const hookId = resolved?.hook?.id || '';
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

function restoreCurrentCommandSelectionStyling() {
  if (!currentCommandSelection) return false;
  const resolved = resolveCurrentCommandSelection(currentCommandSelection);
  if (!resolved) return false;
  selectedAgentId = resolved.agent?.id || resolved.agent?.agent || selectedAgentId;
  renderInspector(resolved.agent || null);
  applyCommandSelectionStyling(resolved);
  return true;
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
  renderInspector(resolved.agent || null);
  applyCommandSelectionStyling(resolved);
  if (publish) {
    commandFocusSequence = Math.max(commandFocusSequence + 1, Date.now());
    const villageSelection = commandDeckFocusSelection(normalized, resolved);
    pixelworldBridge.setFocus(villageSelection, commandFocusSequence);
  }
  return true;
}

function activateAgentDetail(agentId, { trigger = document.activeElement, publish = true } = {}) {
  if (!selectCommandDeck({ kind: 'agent', id: agentId }, { publish })) return false;
  const detail = buildAgentDetail(currentCommandDeckModel, agentId, { nowMs: Date.now() });
  if (!detail) return false;
  agentDetailView.open({ ...detail, task: agentTaskText({ task: detail.task }, currentLocale) }, trigger);
  villageFirstLayoutController.setDetailOpen(true);
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
  const model = currentCommandDeckModel || buildCommandDeckModel(snapshot, { nowMs });
  const rows = buildAgentRoster(model, { nowMs }).map((row) => ({
    ...row,
    externalTask: agentTaskText({ task: row.externalTask }, currentLocale),
  }));
  if (dom.agentLiveList) {
    agentRosterView.render(rows, { selectedId: selectedAgentId });
    liveEcgController.sync(rows);
  }
  const openDetail = agentDetailView.current();
  if (openDetail) {
    const detail = buildAgentDetail(model, openDetail.id, { nowMs });
    if (detail) agentDetailView.render({ ...detail, task: agentTaskText({ task: detail.task }, currentLocale) });
    else agentDetailView.close();
  }
  if (dom.needsAttentionCount) dom.needsAttentionCount.textContent = uiText(currentLocale, 'commandDeck.roster.needsYou', { count: model.situation.attentionCount });
  if (dom.activeAgentCount) dom.activeAgentCount.textContent = uiText(currentLocale, 'commandDeck.roster.active', { count: model.situation.activeAgentCount });
  if (dom.idleAgentCount) dom.idleAgentCount.textContent = uiText(currentLocale, 'commandDeck.roster.idle', { count: model.situation.idleAgentCount });
  if (dom.offlineAgentCount) dom.offlineAgentCount.textContent = uiText(currentLocale, 'commandDeck.roster.offline', { count: model.situation.offlineAgentCount });
  const hook = hookRailForAgents(snapshot.agents, selectedAgentId);
  const roomCopy = getRoomCopy(hook.roomKey, currentLocale);
  if (dom.hookLiveSemantic) dom.hookLiveSemantic.textContent = commandText(`commandDeck.hook.semantic.${hook.semantic}`);
  if (dom.hookLiveBuilding) dom.hookLiveBuilding.textContent = roomCopy.name || hook.building;
  if (dom.hookLiveActivity) {
    const externalActivity = agentTaskText({ task: hook.activity }, currentLocale);
    dom.hookLiveActivity.textContent = externalActivity || strings().idleFallback;
    if (externalActivity) dom.hookLiveActivity.dataset.externalCopy = 'true';
    else delete dom.hookLiveActivity.dataset.externalCopy;
  }
  if (dom.hookLiveAgent) {
    dom.hookLiveAgent.textContent = hook.agentId;
    if (hook.agentId) dom.hookLiveAgent.dataset.externalCopy = 'true';
    else delete dom.hookLiveAgent.dataset.externalCopy;
  }
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
      if (channel.activity) activity.dataset.externalCopy = 'true';
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'hook-live-ecg');
      svg.setAttribute('viewBox', '0 0 176 32');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', channel.path);
      svg.append(path);
      const agent = document.createElement('span');
      agent.textContent = channel.agentId || '—';
      if (channel.agentId) agent.dataset.externalCopy = 'true';
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
    buildings: commandBuildingIds(dashboardLiveSnapshot).map((id) => ({ id })),
  });
  missionTraceController.setModel(currentCommandDeckModel);
  const sequence = snapshot.server_time_ms || Date.now();
  pixelworldBridge.setLocale(currentLocale, sequence);
  pixelworldBridge.setSnapshot(dashboardLiveSnapshot, sequence);
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
  restoreCurrentCommandSelectionStyling();
  if (dashboardDisclosure.activeCard) renderDashboardCardContent();
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
    if (!panelDragging) return;
    const delta = { x: event.clientX - panelDragging.pointer.x, y: event.clientY - panelDragging.pointer.y };
    const next = nextDraggedOffset(panelDragging.start, delta);
    panelDragging.panel.dataset.offsetX = String(next.x);
    panelDragging.panel.dataset.offsetY = String(next.y);
    panelDragging.panel.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
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

function closeTopSettings({ restoreFocus = false } = {}) {
  if (!dom.topSettings?.open) return;
  dom.topSettings.open = false;
  if (restoreFocus) dom.topSettingsSummary?.focus();
}

dom.dashboardCardButtons.forEach((button) => {
  button.addEventListener('click', () => {
    closeTopSettings();
    changeDashboardCard(button.dataset.dashboardCard, button);
  });
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
  if (dom.topSettings?.open && !dom.topSettings.contains(event.target)) {
    closeTopSettings();
  }
  if (!dashboardDisclosure.activeCard) return;
  if (event.target.closest('#dashboard-card, [data-dashboard-card]')) return;
  closeDashboardCard({ deferFocus: true });
}, { capture: true });

document.addEventListener('keydown', (event) => {
  lastDashboardInputModality = dashboardInputModality(event);
  if (event.key !== 'Escape') return;
  closeTopSettings({ restoreFocus: true });
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

window.addEventListener('resize', () => {
  if (dashboardLiveSnapshot) renderLiveMonitoring(dashboardLiveSnapshot);
  const detail = agentDetailView.current();
  if (detail) agentDetailView.render(detail);
});

dom.villageResetLayout?.addEventListener('click', () => villageFirstLayoutController.reset());

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
  populateLocaleSelect();
  applyStaticCopy();
  loadExposure();
  updateRefreshController();
  setupDraggablePanels();
  setupResizablePanels();
  setupWorkbenchLayout();
  liveEcgController.start();
  missionTraceController.start();
  commandDeckLayoutController.start();
  renderCommandDeckControls();
  villageFirstLayoutController.start();
  startLiveUiTicker();
  restartTimelineTimer();
  connectRealtime();
}

initializeApp();

// Render mode changes presentation only; iframe simulation and hook transport stay connected.
{
  const frame = document.getElementById('pixelworld-frame');
  const buttons = [...document.querySelectorAll('[data-world-view]')];
  let mode = '3d';
  try { mode = localStorage.getItem('pixelverse:view') === '2d' ? '2d' : '3d'; } catch {}
  const send = () => frame?.contentWindow?.postMessage({ type: 'pixelverse.view.set', mode }, location.origin);
  buttons.forEach(button => button.addEventListener('click', () => { mode = button.dataset.worldView; send(); frame?.focus(); }));
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
    if(event.data?.type==='pixelverse.rabbit.frames'&&mode==='2d'&&Array.isArray(event.data.frames)){
      rabbitLiveFrames.clear();
      for(const item of event.data.frames){if(typeof item?.id==='string'&&/^woodland-rabbit-[0-5]$/.test(item.sheet)&&Number.isInteger(item.frame)&&item.frame>=0&&item.frame<32)rabbitLiveFrames.set(item.id,item);}
      for(const image of document.querySelectorAll('[data-agent-portrait-id]'))applyAgentPortrait(image,villagePortrait({agent:image.dataset.agentPortraitId}));
    }
    if(event.data?.type==='pixelverse.rabbit.portraits'&&Array.isArray(event.data.sources)&&event.data.sources.length===6&&event.data.sources.every(s=>typeof s==='string'&&s.startsWith('data:image/png;base64,')&&s.length<200000)){rabbitPortraitSources=event.data.sources;renderLiveMonitoring();}
    if (event.data?.type === 'pixelverse.view.ready') send();
    if (event.data?.type === 'pixelverse.view.changed' && ['2d', '3d'].includes(event.data.mode)) {
      mode = event.data.mode;
      document.body.dataset.worldView=mode;document.body.dataset.officePack=event.data.officePack||'modern-office';
      renderLiveMonitoring();
      buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.worldView === mode)));
      try { localStorage.setItem('pixelverse:view', mode); } catch {}
    }
  });
}

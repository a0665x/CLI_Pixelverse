import {
  addDoorToRoom,
  builderToolHelpItems,
  cancelPendingRect,
  assignRoomFromPalette,
  buildLayerList,
  canEditSelection,
  confirmPendingRect,
  createPendingRect,
  doorAnchorPoints,
  eraseOverlappingWalkable,
  exportBuilderYaml,
  findNearestDarkWall,
  furniturePaletteItems,
  getBuilderStrings,
  imagePointToWorld,
  isLayerVisible,
  mapBuilderPromptChecklist,
  nextViewport,
  pendingRectLabel,
  planRoomConnectivityRoutes,
  resizeHandlesForSelection,
  roomPaletteItems,
  resizeSelection,
  setLayerLocked,
  summarizeDarkWallMask,
  toggleLayerVisibility,
  translateSelection,
  updatePendingRect,
  validateBuilderModel,
  worldRectFromDrag,
} from './map_builder_core.mjs';
import { parseGlobalMapYaml } from './global_map_loader.mjs';

const PROP_SIZES = {
  bed: { w: 7.4, h: 5.8 },
  board: { w: 5.8, h: 2.6 },
  bookshelf: { w: 5.8, h: 4.8 },
  cabinet: { w: 4.8, h: 4.8 },
  chair: { w: 3.4, h: 3.2 },
  coffee: { w: 3.8, h: 3.2 },
  desk: { w: 6.4, h: 4.6 },
  locker: { w: 4.8, h: 4.8 },
  portal: { w: 5.2, h: 5.2 },
  server: { w: 5.6, h: 4.8 },
  sofa: { w: 7.2, h: 4.8 },
  table: { w: 6.8, h: 4.8 },
  terminal: { w: 5.2, h: 4.2 },
  workbench: { w: 6.8, h: 4.8 },
};

const dom = {
  canvas: document.getElementById('builder-canvas'),
  wallMaskCanvas: document.getElementById('wall-mask-canvas'),
  appShell: document.querySelector('.builder-app'),
  simpleToggle: document.getElementById('simple-editor-toggle'),
  simpleLoadPng: document.getElementById('simple-load-png-btn'),
  simpleLoadYaml: document.getElementById('simple-load-yaml-btn'),
  simpleStepRooms: document.getElementById('simple-step-rooms'),
  simpleStepCorridors: document.getElementById('simple-step-corridors'),
  simpleStepFreeSpace: document.getElementById('simple-step-free-space'),
  simpleStepDoors: document.getElementById('simple-step-doors'),
  simpleStepFurniture: document.getElementById('simple-step-furniture'),
  simpleStepValidate: document.getElementById('simple-step-validate'),
  simpleExit: document.getElementById('simple-exit-btn'),
  simpleLayerSelect: document.getElementById('simple-layer-select'),
  simpleLayerFocus: document.getElementById('simple-layer-focus-btn'),
  simpleLayerHide: document.getElementById('simple-layer-hide-btn'),
  simpleLayerLock: document.getElementById('simple-layer-lock-btn'),
  simpleValidateNow: document.getElementById('simple-validate-now-btn'),
  simpleSubmitNow: document.getElementById('simple-submit-now-btn'),
  simpleExportNow: document.getElementById('simple-export-now-btn'),
  simpleDuplicate: document.getElementById('simple-duplicate-btn'),
  simpleDelete: document.getElementById('simple-delete-btn'),
  simpleClearSelection: document.getElementById('simple-clear-selection-btn'),
  paintToolPalette: document.getElementById('paint-tool-palette'),
  paintTools: [...document.querySelectorAll('[data-paint-mode]')],
  paintLayerToggle: document.getElementById('paint-layer-toggle-btn'),
  paintValidate: document.getElementById('paint-validate-btn'),
  paintSubmit: document.getElementById('paint-submit-btn'),
  paintStatusStrip: document.getElementById('paint-status-strip'),
  selectedSummary: document.getElementById('selected-summary'),
  simpleFeedback: document.getElementById('simple-feedback'),
  batchRows: {
    room: document.getElementById('batch-room-row'),
    corridor: document.getElementById('batch-corridor-row'),
    free_space: document.getElementById('batch-free-space-row'),
    door: document.getElementById('batch-door-row'),
    furniture: document.getElementById('batch-furniture-row'),
  },
  wallMaskToggle: document.getElementById('wall-mask-toggle'),
  wallMaskSummary: document.getElementById('wall-mask-summary'),
  exportButton: document.getElementById('export-yaml-btn'),
  currentPayloadLabel: document.getElementById('current-payload-label'),
  currentToolLabel: document.getElementById('current-tool-label'),
  dropHint: document.getElementById('drop-hint'),
  furniturePalette: document.getElementById('furniture-palette'),
  furnitureType: document.getElementById('furniture-type-input'),
  helpTooltip: document.getElementById('builder-help-tooltip'),
  inspectorBody: document.getElementById('inspector-body'),
  layerList: document.getElementById('layer-list'),
  locale: document.getElementById('builder-locale'),
  modeButtons: [...document.querySelectorAll('[data-mode]')],
  overlay: document.getElementById('builder-overlay'),
  pngInput: document.getElementById('png-input'),
  roomPalette: document.getElementById('room-palette'),
  roomKey: document.getElementById('room-key-input'),
  stage: document.getElementById('builder-stage'),
  status: document.getElementById('builder-status'),
  validateButton: document.getElementById('validate-map-btn'),
  validationList: document.getElementById('validation-list'),
  routePlanList: document.getElementById('route-plan-list'),
  submitButton: document.getElementById('submit-map-btn'),
  promptChecklist: document.getElementById('builder-prompt-checklist'),
  yamlInput: document.getElementById('yaml-input'),
  yamlOutput: document.getElementById('yaml-output'),
  assignCancel: document.getElementById('assign-cancel-btn'),
  assignConfirm: document.getElementById('assign-confirm-btn'),
  assignDelete: document.getElementById('assign-delete-btn'),
  assignPopover: document.getElementById('assign-popover'),
  assignRoomKey: document.getElementById('assign-room-key'),
  assignRoomName: document.getElementById('assign-room-name'),
  selectionCancel: document.getElementById('selection-cancel-btn'),
  selectionDelete: document.getElementById('selection-delete-btn'),
  selectionDuplicate: document.getElementById('selection-duplicate-btn'),
  selectionEdit: document.getElementById('selection-edit-btn'),
  selectionTitle: document.getElementById('selection-title'),
  selectionToolbar: document.getElementById('selection-toolbar'),
  zoomIn: document.getElementById('zoom-in-btn'),
  zoomOut: document.getElementById('zoom-out-btn'),
  zoomReset: document.getElementById('zoom-reset-btn'),
  zoomOutput: document.getElementById('zoom-output'),
  dragPreviewLabel: document.getElementById('drag-preview-label'),
};

const ctx = dom.canvas.getContext('2d', { willReadFrequently: true });
const wallMaskCtx = dom.wallMaskCanvas?.getContext('2d', { willReadFrequently: false });

let mode = 'room';
let dragStart = null;
let activeDrag = null;
let pending = null;
let editingRoomKey = null;
let paletteRoomKey = 'think_lab';
let selected = null;
let loadedImageData = null;
let loadedPngDataUrl = '';
let viewport = { scale: 1, x: 0, y: 0, preferredZoom: null };
let locale = localStorage.getItem('pixelverse-builder-locale') || 'zh-TW';
let model = {
  key: 'user-built-office',
  name: 'User Built Office',
  image: '/global_map/default.png',
  bounds: { left: 2, top: 2, width: 96, height: 96 },
  corridors: [],
  free_space: [],
  rooms: {},
};

function stagePoint(event) {
  const rect = dom.stage.getBoundingClientRect();
  const scaleX = dom.canvas.width / rect.width;
  const scaleY = dom.canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function roomForWorld(point) {
  return Object.entries(model.rooms).find(([, room]) => (
    point.x >= room.rect.left
    && point.x <= room.rect.left + room.rect.width
    && point.y >= room.rect.top
    && point.y <= room.rect.top + room.rect.height
  ));
}

function cssRect(rect) {
  return `left:${rect.left}%;top:${rect.top}%;width:${rect.width}%;height:${rect.height}%;`;
}

function selectedLabel() {
  if (!selected) return 'No selection';
  if (selected.type === 'room') return `Room · ${selected.key}`;
  if (selected.type === 'corridor') return `Corridor · ${model.corridors[selected.index]?.key || selected.index}`;
  if (selected.type === 'furniture') return `Furniture · ${selected.key} #${selected.index + 1}`;
  if (selected.type === 'door_anchor') return `Door · ${selected.key} · ${selected.anchor}`;
  return selected.type;
}

function layerIdForSelection(selection = {}) {
  if (selection.type === 'room') return `room:${selection.key}`;
  if (selection.type === 'corridor') return `corridor:${selection.index}`;
  if (selection.type === 'free_space') return `free_space:${selection.index}`;
  if (selection.type === 'door') return `door:${selection.key}`;
  if (selection.type === 'door_anchor') return `door_anchor:${selection.key}:${selection.anchor}`;
  if (selection.type === 'furniture') return `furniture:${selection.key}:${selection.index}`;
  return '';
}

function selectedPayload() {
  if (!selected) return null;
  if (selected.type === 'room') return model.rooms[selected.key] || null;
  if (selected.type === 'corridor') return model.corridors[selected.index] || null;
  if (selected.type === 'free_space') return model.free_space?.[selected.index] || null;
  if (selected.type === 'furniture') return model.rooms[selected.key]?.furniture?.[selected.index] || null;
  if (selected.type === 'door_anchor') return model.rooms[selected.key]?.[selected.anchor] || null;
  return null;
}

function selectionFromDataset(value = '') {
  const [type, key, extra] = value.split(':');
  if (type === 'room') return { type, key };
  if (type === 'corridor') return { type, index: Number(key) };
  if (type === 'free_space') return { type, index: Number(key) };
  if (type === 'furniture') return { type, key, index: Number(extra) };
  if (type === 'door_anchor') return { type, key, anchor: extra };
  if (type === 'door') return { type, key };
  return null;
}

function updateInspector() {
  if (dom.selectionToolbar) dom.selectionToolbar.hidden = !selected;
  if (dom.selectionTitle) dom.selectionTitle.textContent = selectedLabel();
  const payload = selectedPayload();
  dom.inspectorBody.textContent = payload
    ? JSON.stringify({ selection: selected, value: payload }, null, 2)
    : 'No selection.';
}

function renderPalette() {
  const items = roomPaletteItems(model, locale);
  dom.roomPalette.innerHTML = items.map((item) => `
    <div class="palette-item ${paletteRoomKey === item.key ? 'active' : ''}" draggable="${item.disabled ? 'false' : 'true'}" aria-disabled="${item.disabled}" data-room-template="${item.key}">
      <span>${item.icon || 'room'}</span>
      <span>${item.name}</span>
      <small>${item.disabled ? 'used' : item.key}</small>
    </div>
  `).join('');
}

function firstAvailableRoomKey() {
  return roomPaletteItems(model, locale).find((item) => !item.disabled)?.key || 'think_lab';
}

function renderFurniturePalette() {
  const items = furniturePaletteItems();
  const activeType = dom.furnitureType.value || 'desk';
  dom.furniturePalette.innerHTML = items.map((item) => `
    <div class="palette-item ${activeType === item.type ? 'active' : ''}" draggable="true" data-furniture-template="${item.type}">
      <span>${item.icon}</span>
      <span>${item.name}</span>
    </div>
  `).join('');
}

function selectionFromLayerId(layerId = '') {
  const [type, key, extra] = String(layerId).split(':');
  if (type === 'room') return { type, key };
  if (type === 'corridor') return { type, index: Number(key) };
  if (type === 'free_space') return { type, index: Number(key) };
  if (type === 'door') return { type, key };
  if (type === 'furniture') return { type, key, index: Number(extra) };
  if (type === 'door_anchor') return { type, key, anchor: extra };
  return null;
}

function renderSimpleLayerSelect(layers = buildLayerList(model)) {
  if (!dom.simpleLayerSelect) return;
  const current = layerIdForSelection(selected || {});
  dom.simpleLayerSelect.innerHTML = layers.length
    ? layers.map((layer) => `<option value="${layer.id}" ${layer.id === current ? 'selected' : ''}>${layer.visible ? '👁' : '🚫'} ${layer.locked ? '🔒' : '✋'} ${layer.type} · ${layer.label}</option>`).join('')
    : '<option value="">尚未建立 layer</option>';
}

function setSimpleFeedback(message, tone = 'working') {
  if (!dom.simpleFeedback) return;
  dom.simpleFeedback.textContent = message;
  dom.simpleFeedback.classList.remove('ok', 'error', 'working');
  dom.simpleFeedback.classList.add(tone);
  dom.simpleFeedback.setAttribute('aria-busy', tone === 'working' ? 'true' : 'false');
}

function updateSelectionSummary() {
  if (!dom.selectedSummary) return;
  dom.selectedSummary.textContent = selected
    ? `已選取：${selectedLabel()} · 可拖拉 / Ctrl+C 複製 / Delete 刪除`
    : '目前沒有選取圖層';
}

function renderBatchLayerPanel(layers = buildLayerList(model)) {
  if (!dom.batchRows) return;
  const groups = { room: [], corridor: [], free_space: [], door: [], furniture: [] };
  layers.forEach((layer) => {
    const key = layer.type === 'free_space' ? 'free_space' : layer.type;
    if (groups[key]) groups[key].push(layer);
  });
  Object.entries(groups).forEach(([type, items]) => {
    const row = dom.batchRows[type];
    if (!row) return;
    const title = row.querySelector('strong')?.outerHTML || `<strong>${type}</strong>`;
    row.innerHTML = title + (items.length
      ? items.map((layer) => `<button type="button" class="batch-chip ${layerIdForSelection(selected || {}) === layer.id ? 'active' : ''} ${layer.visible ? '' : 'hidden-chip'}" data-batch-layer="${layer.id}">${layer.visible ? '👁' : '🚫'} ${layer.label}</button>`).join('')
      : '<span class="ghost-note">尚無</span>');
  });
}

function syncSubmitButtons() {
  if (dom.simpleSubmitNow && dom.submitButton) dom.simpleSubmitNow.disabled = dom.submitButton.disabled;
  if (dom.paintSubmit && dom.submitButton) dom.paintSubmit.disabled = dom.submitButton.disabled;
}

function focusSelectedOnMap(message = '', tone = 'ok') {
  updateSelectionSummary();
  requestAnimationFrame(() => {
    const id = layerIdForSelection(selected || {});
    if (!id) return;
    const shape = dom.overlay?.querySelector(`[data-select="${CSS.escape(id)}"]`);
    shape?.scrollIntoView?.({ block: 'center', inline: 'center', behavior: 'smooth' });
    shape?.animate?.([
      { transform: 'scale(1)' },
      { transform: 'scale(1.035)' },
      { transform: 'scale(1)' },
    ], { duration: 520, easing: 'ease-out' });
  });
  if (message) setSimpleFeedback(message, tone);
}

function selectLayer(layerId, messagePrefix = '已選取') {
  const nextSelection = selectionFromLayerId(layerId);
  if (!nextSelection) return;
  selected = nextSelection;
  setMode('select');
  render();
  focusSelectedOnMap(`${messagePrefix} ${selectedLabel()}。圖上會以亮橘色外框閃爍；可拖拉 / Ctrl+C 複製 / Delete 刪除。`);
}

function renderLayers() {
  const layers = buildLayerList(model);
  if (!layers.length) {
    dom.layerList.innerHTML = '<div class="ghost-note">No layers yet. Drag a room or import YAML.</div>';
    renderSimpleLayerSelect(layers);
    renderBatchLayerPanel(layers);
    syncSubmitButtons();
    return;
  }
  renderSimpleLayerSelect(layers);
  renderBatchLayerPanel(layers);
  dom.layerList.innerHTML = layers.map((layer) => `
    <div class="layer-row ${layerIdForSelection(selected || {}) === layer.id ? 'active' : ''}" data-layer-id="${layer.id}">
      <button type="button" data-layer-eye="${layer.id}" title="Show / hide">${layer.visible ? 'eye' : 'hide'}</button>
      <button type="button" data-layer-lock="${layer.id}" title="Lock / unlock">${layer.locked ? 'lock' : 'open'}</button>
      <button type="button" class="layer-name" data-layer-select="${layer.id}">${layer.label}</button>
    </div>
  `).join('');
}

function applyLocale() {
  const strings = getBuilderStrings(locale);
  dom.status.textContent = strings.dragHint;
  dom.locale.value = locale;
  if (dom.promptChecklist) {
    dom.promptChecklist.innerHTML = mapBuilderPromptChecklist(locale).map((item) => `<li>${item}</li>`).join('');
  }
}

function updateCurrentAction() {
  const room = roomPaletteItems({ rooms: {} }, locale).find((item) => item.key === paletteRoomKey);
  const furniture = furniturePaletteItems().find((item) => item.type === (dom.furnitureType.value || 'desk'));
  const labels = {
    room: ['Place Room', `${room?.name || paletteRoomKey} · drag on map or drop from palette`],
    corridor: ['Draw Corridor', 'Drag a walkable hallway rectangle'],
    door: ['Place Door', 'Click near a black wall line'],
    furniture: ['Place Furniture', `${furniture?.name || dom.furnitureType.value} · click inside a room or drag from palette`],
    free_space: ['補空間', '框選門洞或 L 型缺口的小可走區域，補齊 room/corridor 矩形沒涵蓋的 free space'],
    eraser: ['橡皮擦', '拖拉一個紅色橡皮擦框，放開後刪除碰到的房間 / 走廊 / 補空間。'],
    select: ['Select / Edit', selected ? selectedLabel() : 'Click a layer or overlay to edit'],
  };
  const [tool, payload] = labels[mode] || labels.room;
  dom.currentToolLabel.textContent = tool;
  dom.currentPayloadLabel.textContent = payload;
  dom.dropHint.textContent = dom.appShell?.classList.contains('simple-builder')
    ? '小畫家模式：先選工具，再在 PNG 上拖拉；選取後可直接移動、拉角落改大小。深紅遮罩是極深色牆。'
    : mode === 'select'
      ? 'Select a layer or overlay. Use eye/lock controls to reduce clutter.'
      : 'Drag a room or furniture tile from the left, or draw directly on the map.';
  if (dom.paintStatusStrip) {
    const zhLabels = {
      room: '房間：拖出一個可走房間框，可重疊。',
      corridor: '走廊：拖出通道；可用補空間連接缺口。',
      free_space: '補空間：拖出門洞、缺口或 L 型轉角的可走區。',
      eraser: '橡皮擦：拖出紅色範圍，放開後刪除碰到的房間/走廊/補空間。',
      door: '門：在房間牆線或門洞位置點一下。',
      furniture: '家具：點房間內放置，選取後可移動。',
      select: selected ? `選取：${selectedLabel()}，可拖拉、拉角落、Ctrl+C、Delete。` : '選取：點圖上的框線或打開「圖層」找物件。',
    };
    dom.paintStatusStrip.textContent = `目前工具：${zhLabels[mode] || zhLabels.select}`;
  }
}

function toolHelpForMode(helpMode) {
  return builderToolHelpItems(locale).find((item) => item.mode === helpMode)?.help || '';
}

function positionHelpTooltip(event) {
  if (!dom.helpTooltip || dom.helpTooltip.hidden) return;
  const x = Math.min(window.innerWidth - 340, event.clientX + 14);
  const y = Math.min(window.innerHeight - 110, event.clientY + 16);
  dom.helpTooltip.style.left = `${Math.max(12, x)}px`;
  dom.helpTooltip.style.top = `${Math.max(12, y)}px`;
}

function showHelpTooltip(event, helpMode) {
  if (!dom.helpTooltip) return;
  const help = toolHelpForMode(helpMode);
  if (!help) return;
  dom.helpTooltip.textContent = help;
  dom.helpTooltip.hidden = false;
  positionHelpTooltip(event);
}

function hideHelpTooltip() {
  if (dom.helpTooltip) dom.helpTooltip.hidden = true;
}

function updateViewport() {
  dom.stage.style.transform = `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.scale})`;
  dom.zoomOutput.textContent = `${Math.round(viewport.scale * 100)}%`;
}

function updateSimpleStepButtons() {
  [
    [dom.simpleStepRooms, 'room'],
    [dom.simpleStepCorridors, 'corridor'],
    [dom.simpleStepFreeSpace, 'free_space'],
    [dom.simpleStepDoors, 'door'],
    [dom.simpleStepFurniture, 'furniture'],
  ].forEach(([button, targetMode]) => {
    if (button) button.classList.toggle('active', mode === targetMode);
  });
  dom.paintTools?.forEach((button) => {
    button.classList.toggle('active', button.dataset.paintMode === mode);
  });
}

function setSimpleMode(enabled) {
  dom.appShell?.classList.toggle('simple-builder', !!enabled);
  dom.appShell?.classList.toggle('paint-mode', !!enabled);
  dom.appShell?.classList.remove('layers-open');
  dom.paintLayerToggle?.setAttribute('aria-pressed', 'false');
  dom.simpleToggle?.setAttribute('aria-pressed', enabled ? 'true' : 'false');
  if (dom.simpleToggle) dom.simpleToggle.textContent = enabled ? '完整工具' : '簡易編輯';
  localStorage.setItem('pixelverse-builder-simple', enabled ? '1' : '0');
  dom.status.textContent = enabled
    ? '小畫家模式：先選工具，再在圖上拖拉；需要批次選圖層再按「圖層」。'
    : getBuilderStrings(locale).dragHint;
  updateCurrentAction();
}

function isSimpleMode() {
  return dom.appShell?.classList.contains('simple-builder');
}

function nextRoomKeyForSimple() {
  const available = roomPaletteItems(model, locale).find((item) => !item.disabled);
  if (available?.key) return available.key;
  let index = Object.keys(model.rooms || {}).length + 1;
  while (model.rooms?.[`custom_room_${index}`]) index += 1;
  return `custom_room_${index}`;
}

function confirmSimplePendingRect() {
  if (!pending) return false;
  const info = {};
  if (pending.type === 'room') {
    const key = paletteRoomKey && !model.rooms?.[paletteRoomKey] ? paletteRoomKey : nextRoomKeyForSimple();
    const template = roomPaletteItems({ rooms: {} }, locale).find((item) => item.key === key);
    info.key = key;
    info.name = template?.name || key;
  } else if (pending.type === 'corridor') {
    info.key = `corridor-${(model.corridors || []).length + 1}`;
  } else if (pending.type === 'free_space') {
    info.key = `free-space-${(model.free_space || []).length + 1}`;
  }
  const result = pending.type === 'room' && roomPaletteItems({ rooms: {} }, locale).some((item) => item.key === info.key)
    ? assignRoomFromPalette(model, pending, info.key)
    : confirmPendingRect(model, pending, info);
  selected = result.selection;
  pending = null;
  paletteRoomKey = firstAvailableRoomKey();
  setMode('select');
  showValidation();
  setSimpleFeedback(`已新增 ${selectedLabel()}。可繼續拖拉或按「驗證地圖」。`, 'ok');
  return true;
}

function drawWallMask() {
  if (!dom.wallMaskCanvas || !wallMaskCtx || !loadedImageData) return;
  dom.wallMaskCanvas.width = dom.canvas.width;
  dom.wallMaskCanvas.height = dom.canvas.height;
  const summary = summarizeDarkWallMask(loadedImageData, { darkThreshold: 80 });
  const mask = wallMaskCtx.createImageData(dom.wallMaskCanvas.width, dom.wallMaskCanvas.height);
  for (let pixel = 0; pixel < summary.totalPixels; pixel += 1) {
    const offset = pixel * 4;
    const alpha = loadedImageData.data[offset + 3] === undefined ? 255 : Number(loadedImageData.data[offset + 3]);
    const darkness = Number(loadedImageData.data[offset]) + Number(loadedImageData.data[offset + 1]) + Number(loadedImageData.data[offset + 2]);
    if (alpha > 8 && darkness <= summary.darkThreshold * 3) {
      mask.data[offset] = 208;
      mask.data[offset + 1] = 44;
      mask.data[offset + 2] = 32;
      mask.data[offset + 3] = 150;
    } else {
      mask.data[offset + 3] = 0;
    }
  }
  wallMaskCtx.putImageData(mask, 0, 0);
  if (dom.wallMaskSummary) {
    dom.wallMaskSummary.textContent = `深色牆面 ${Math.round(summary.darkRatio * 100)}% · 你框選的房間/走廊內，非深色像素會被視為 free space 候選。`;
  }
}

function renderOverlay() {
  const shapes = [];
  if (pending) {
    shapes.push(`<div class="shape pending ${pending.type}" style="${cssRect(pending.rect)}">${pendingRectLabel(pending)}</div>`);
  }
  model.corridors.forEach((corridor, index) => {
    const selection = { type: 'corridor', index };
    if (!isLayerVisible(model, selection)) return;
    const handles = selected?.type === 'corridor' && selected.index === index
      ? resizeHandlesForSelection(model, selection).map((handle) => `<span class="resize-handle" data-resize="${handle}"></span>`).join('')
      : '';
    shapes.push(`<div class="shape corridor ${selected?.type === 'corridor' && selected.index === index ? 'selected' : ''} ${canEditSelection(model, selection) ? '' : 'layer-locked'}" data-select="corridor:${index}" data-layer-kind="走廊" style="${cssRect(corridor)}"><span class="shape-label">${corridor.key}</span>${handles}</div>`);
  });
  (model.free_space || []).forEach((space, index) => {
    const selection = { type: 'free_space', index };
    if (!isLayerVisible(model, selection)) return;
    const handles = selected?.type === 'free_space' && selected.index === index
      ? resizeHandlesForSelection(model, selection).map((handle) => `<span class="resize-handle" data-resize="${handle}"></span>`).join('')
      : '';
    shapes.push(`<div class="shape free-space ${selected?.type === 'free_space' && selected.index === index ? 'selected' : ''} ${canEditSelection(model, selection) ? '' : 'layer-locked'}" data-select="free_space:${index}" data-layer-kind="補空間" style="${cssRect(space)}"><span class="shape-label">${space.key || `free-space-${index + 1}`}</span>${handles}</div>`);
  });
  Object.entries(model.rooms).forEach(([roomKey, room]) => {
    const roomSelection = { type: 'room', key: roomKey };
    if (isLayerVisible(model, roomSelection)) {
      const handles = selected?.type === 'room' && selected.key === roomKey
        ? resizeHandlesForSelection(model, roomSelection).map((handle) => `<span class="resize-handle" data-resize="${handle}"></span>`).join('')
        : '';
      shapes.push(`<div class="shape room ${selected?.type === 'room' && selected.key === roomKey ? 'selected' : ''} ${canEditSelection(model, roomSelection) ? '' : 'layer-locked'}" data-select="room:${roomKey}" data-layer-kind="房間" style="${cssRect(room.rect)}"><span class="shape-label">${roomKey}</span>${handles}</div>`);
    }
    if (room.portal && isLayerVisible(model, { type: 'door', key: roomKey })) {
      doorAnchorPoints(roomKey, room).forEach((anchor) => {
        const selectionKey = selected?.type === 'door_anchor' && selected.key === roomKey && selected.anchor === anchor.anchor;
        shapes.push(`<div class="shape door-anchor ${anchor.anchor} ${selectionKey ? 'selected' : ''}" data-select="door_anchor:${roomKey}:${anchor.anchor}" data-anchor-label="${anchor.label}" title="${roomKey} ${anchor.anchor}" style="left:${anchor.x}%;top:${anchor.y}%"></div>`);
      });
    }
    (room.furniture || []).forEach((item, index) => {
      const furnitureSelection = { type: 'furniture', key: roomKey, index };
      if (!isLayerVisible(model, furnitureSelection)) return;
      const world = {
        left: room.rect.left + room.rect.width * item.x / 100 - item.w / 2,
        top: room.rect.top + room.rect.height * item.y / 100 - item.h / 2,
        width: item.w * (item.scale || 1),
        height: item.h * (item.scale || 1),
      };
      shapes.push(`<div class="shape furniture ${selected?.type === 'furniture' && selected.key === roomKey && selected.index === index ? 'selected' : ''} ${canEditSelection(model, furnitureSelection) ? '' : 'layer-locked'}" data-select="furniture:${roomKey}:${index}" style="${cssRect(world)}"><span class="shape-label">${item.type}</span></div>`);
    });
  });
  dom.overlay.innerHTML = shapes.join('');
}

function render() {
  renderOverlay();
  renderPalette();
  renderFurniturePalette();
  renderLayers();
  updateInspector();
  updateCurrentAction();
  updateSimpleStepButtons();
  updateSelectionSummary();
  updateViewport();
  syncSubmitButtons();
}

function setMode(nextMode) {
  mode = nextMode;
  pending = null;
  dragStart = null;
  activeDrag = null;
  dom.assignPopover.hidden = true;
  dom.modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  dom.status.textContent = `Mode: ${mode}`;
  render();
}

function addFurnitureAt(point) {
  const found = roomForWorld(point);
  if (!found) {
    dom.status.textContent = '家具必須放在房間內。';
    return;
  }
  const [roomKey, room] = found;
  const type = dom.furnitureType.value || 'desk';
  const size = PROP_SIZES[type] || PROP_SIZES.desk;
  room.furniture ||= [];
  room.furniture.push({
    type,
    x: Number(((point.x - room.rect.left) * 100 / room.rect.width).toFixed(2)),
    y: Number(((point.y - room.rect.top) * 100 / room.rect.height).toFixed(2)),
    w: size.w,
    h: size.h,
    scale: 1,
  });
  selected = { type: 'furniture', key: roomKey, index: room.furniture.length - 1 };
  showValidation();
}

function addFurnitureTemplateAt(type, point) {
  dom.furnitureType.value = type || dom.furnitureType.value || 'desk';
  setMode('furniture');
  addFurnitureAt(point);
  render();
}

function addDoorAt(canvasPoint) {
  const world = imagePointToWorld(canvasPoint, dom.canvas);
  const found = roomForWorld(world);
  if (!found) {
    dom.status.textContent = '門必須放在房間牆線附近。';
    return;
  }
  const nearest = loadedImageData ? findNearestDarkWall(loadedImageData, canvasPoint, { radius: 14 }) : canvasPoint;
  if (!nearest) {
    dom.status.textContent = '附近找不到黑色牆線，門未建立。';
    return;
  }
  const [roomKey] = found;
  const snapped = imagePointToWorld(nearest, dom.canvas);
  addDoorToRoom(model, roomKey, snapped);
  selected = { type: 'room', key: roomKey };
  dom.status.textContent = `Door snapped to ${roomKey}.`;
  showValidation();
}

function showValidation() {
  setSimpleFeedback('驗證中：正在檢查 schema、房間互通、門與可走區域...', 'working');
  const result = validateBuilderModel(model);
  const routePlan = planRoomConnectivityRoutes(model);
  if (dom.submitButton) dom.submitButton.disabled = !result.ok || !routePlan.ok;
  syncSubmitButtons();
  if (dom.routePlanList) {
    if (routePlan.ok) {
      const roomCount = Object.keys(model.rooms || {}).length;
      dom.routePlanList.innerHTML = `<li class="ok">${roomCount} rooms are mutually reachable through real doors and corridors/free-space.</li>`;
    } else {
      dom.routePlanList.innerHTML = (routePlan.unreachable.length ? routePlan.unreachable : [{ room: 'map', reason: 'missing route graph' }])
        .map((item) => `<li><button type="button" data-route-room="${item.room}">${item.room}: ${item.reason}</button></li>`)
        .join('');
      dom.routePlanList.querySelectorAll('[data-route-room]').forEach((button) => {
        button.addEventListener('click', () => {
          const key = button.dataset.routeRoom;
          if (model.rooms[key]) selectLayer(`room:${key}`, '已定位問題房間');
        });
      });
    }
  }
  if (result.ok) {
    const warningItems = (result.warnings || [])
      .map((warning) => `<li class="warning">提示：${warning.message}（重疊區域會被當成可走空間，不會阻擋提交）</li>`)
      .join('');
    dom.validationList.innerHTML = `<li class="ok">Map schema is valid for CLI Pixelverse.</li>${warningItems}`;
    setSimpleFeedback(routePlan.ok
      ? `驗證 OK：${Object.keys(model.rooms || {}).length} 個房間都可互通。可按「提交並儲存」。`
      : `Schema OK，但房間互通失敗：${routePlan.unreachable?.[0]?.room || 'map'} ${routePlan.unreachable?.[0]?.reason || ''}`,
      routePlan.ok ? 'ok' : 'error');
    return result;
  }
  const issues = result.issues?.length
    ? result.issues
    : result.errors.map((message) => ({ message, target: null }));
  dom.validationList.innerHTML = issues.map((issue, index) => (
    `<li><button type="button" data-issue-index="${index}">${issue.message}</button></li>`
  )).join('');
  dom.validationList.querySelectorAll('[data-issue-index]').forEach((button) => {
    button.addEventListener('click', () => {
      const issue = issues[Number(button.dataset.issueIndex)];
      if (issue?.target) {
        const layerId = layerIdForSelection(issue.target);
        if (layerId) selectLayer(layerId, '已定位驗證問題');
      }
    });
  });
  const firstError = result.errors?.[0] || issues?.[0]?.message || '驗證失敗';
  setSimpleFeedback(`驗證失敗：${firstError}。點下方紅色問題或上方 Layerout chip 可定位修改。`, 'error');
  return result;
}

function exportYaml() {
  const result = showValidation();
  const yaml = exportBuilderYaml(model);
  dom.yamlOutput.value = yaml;
  dom.status.textContent = result.ok ? 'YAML exported.' : 'YAML exported with validation errors.';
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Unable to read PNG'));
    reader.readAsDataURL(blob);
  });
}

async function submitMap() {
  const result = showValidation();
  const routePlan = planRoomConnectivityRoutes(model);
  if (!result.ok || !routePlan.ok || !loadedPngDataUrl) {
    const message = !loadedPngDataUrl
      ? 'Submit needs a loaded PNG.'
      : !routePlan.ok
        ? `Fix route planning errors before Submit: ${routePlan.unreachable?.[0]?.room || 'map'} ${routePlan.unreachable?.[0]?.reason || ''}`
        : 'Fix validation errors before Submit.';
    dom.status.textContent = message;
    setSimpleFeedback(message, 'error');
    return;
  }
  const yaml = exportBuilderYaml(model);
  dom.yamlOutput.value = yaml;
  dom.submitButton.disabled = true;
  syncSubmitButtons();
  dom.status.textContent = 'Submitting PNG + YAML to active runtime map...';
  setSimpleFeedback('提交中：正在寫出新的 YAML + PNG 到 runtime global_map。', 'working');
  try {
    const response = await fetch('/api/global-map/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ yaml, png_base64: loadedPngDataUrl.split(',').pop() }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || payload.ok === false) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
    dom.status.textContent = 'Submit OK. Main world will load the updated PNG/YAML after refresh.';
    setSimpleFeedback('提交成功：已存出新的 default.yaml + default.png。回主頁重新整理即可套用。', 'ok');
    if (dom.submitButton) dom.submitButton.disabled = false;
    syncSubmitButtons();
  } catch (error) {
    dom.status.textContent = `Submit failed: ${error.message}`;
    setSimpleFeedback(`提交失敗：${error.message}`, 'error');
    if (dom.submitButton) dom.submitButton.disabled = false;
    syncSubmitButtons();
  }
}

async function loadPng(file, options = {}) {
  const bitmap = await createImageBitmap(file);
  loadedPngDataUrl = await blobToDataUrl(file);
  dom.canvas.width = bitmap.width;
  dom.canvas.height = bitmap.height;
  if (dom.wallMaskCanvas) {
    dom.wallMaskCanvas.width = bitmap.width;
    dom.wallMaskCanvas.height = bitmap.height;
  }
  ctx.clearRect(0, 0, dom.canvas.width, dom.canvas.height);
  ctx.drawImage(bitmap, 0, 0);
  loadedImageData = ctx.getImageData(0, 0, dom.canvas.width, dom.canvas.height);
  model.image = '/global_map/default.png';
  if (options.resetModel) {
    model = {
      key: 'user-built-office',
      name: 'User Built Office',
      image: '/global_map/default.png',
      bounds: { left: 2, top: 2, width: 96, height: 96 },
      corridors: [],
      free_space: [],
      rooms: {},
    };
    selected = null;
    pending = null;
    dom.yamlOutput.value = '';
    paletteRoomKey = firstAvailableRoomKey();
    mode = 'room';
  }
  dom.status.textContent = `Loaded PNG ${bitmap.width}x${bitmap.height}.`;
  drawWallMask();
  render();
}

async function loadYaml(file) {
  const text = await file.text();
  const manifest = parseGlobalMapYaml(text);
  model = {
    key: manifest.key || 'user-built-office',
    name: manifest.name || manifest.key || 'User Built Office',
    image: manifest.image || '/global_map/default.png',
    bounds: manifest.bounds || { left: 2, top: 2, width: 96, height: 96 },
    corridors: manifest.corridors || [],
    free_space: manifest.free_space || [],
    rooms: manifest.rooms || {},
  };
  dom.yamlOutput.value = text;
  selected = null;
  pending = null;
  mode = 'select';
  dom.modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
  render();
  showValidation();
}

function showAssignPopover(event, pendingRect) {
  const rect = dom.stage.getBoundingClientRect();
  dom.assignPopover.style.left = `${Math.max(12, event.clientX - rect.left + 12)}px`;
  dom.assignPopover.style.top = `${Math.max(12, event.clientY - rect.top + 12)}px`;
  dom.assignPopover.hidden = false;
  dom.assignRoomKey.value = paletteRoomKey || dom.roomKey.value.trim() || `room_${Object.keys(model.rooms).length + 1}`;
  const template = roomPaletteItems({ rooms: {} }).find((item) => item.key === dom.assignRoomKey.value);
  dom.assignRoomName.value = template?.name || dom.assignRoomKey.value;
  if (pendingRect.type === 'corridor') {
    dom.assignRoomKey.value = `corridor-${model.corridors.length + 1}`;
    dom.assignRoomName.value = 'Corridor';
  }
}

function deleteSelected() {
  if (!selected) {
    setSimpleFeedback('沒有選取圖層，請先點圖上框線或下方 Layerout chip。', 'error');
    return;
  }
  if (!canEditSelection(model, selected)) {
    dom.status.textContent = 'Layer is locked.';
    setSimpleFeedback('此圖層已鎖定，請先按「鎖定/解鎖」。', 'error');
    return;
  }
  const label = selectedLabel();
  if (selected.type === 'room') delete model.rooms[selected.key];
  if (selected.type === 'corridor') model.corridors.splice(selected.index, 1);
  if (selected.type === 'free_space') model.free_space?.splice(selected.index, 1);
  if (selected.type === 'furniture') model.rooms[selected.key]?.furniture?.splice(selected.index, 1);
  selected = null;
  render();
  showValidation();
  setSimpleFeedback(`已刪除 ${label}。`, 'ok');
}

function nextUniqueRoomCopyKey(baseKey) {
  let index = 1;
  let key = `${baseKey}_copy`;
  while (model.rooms?.[key]) {
    index += 1;
    key = `${baseKey}_copy_${index}`;
  }
  return key;
}

function duplicateSelected() {
  if (!selected) {
    setSimpleFeedback('沒有選取圖層，請先點圖上框線或下方 Layerout chip。', 'error');
    return;
  }
  if (!canEditSelection(model, selected)) {
    dom.status.textContent = 'Layer is locked.';
    setSimpleFeedback('此圖層已鎖定，請先按「鎖定/解鎖」。', 'error');
    return;
  }
  if (selected.type === 'room') {
    const source = model.rooms[selected.key];
    const key = nextUniqueRoomCopyKey(selected.key);
    model.rooms[key] = JSON.parse(JSON.stringify(source));
    model.rooms[key].name = `${source.name || selected.key} Copy`;
    translateSelection(model, { type: 'room', key }, { dx: 2, dy: 2 });
    selected = { type: 'room', key };
  }
  if (selected.type === 'corridor') {
    const source = model.corridors[selected.index];
    model.corridors.push({ ...source, key: `${source.key || 'corridor'}-copy`, left: source.left + 2, top: source.top + 2 });
    selected = { type: 'corridor', index: model.corridors.length - 1 };
  }
  if (selected.type === 'free_space') {
    const source = model.free_space[selected.index];
    model.free_space.push({ ...source, key: `${source.key || 'free-space'}-copy`, left: source.left + 2, top: source.top + 2 });
    selected = { type: 'free_space', index: model.free_space.length - 1 };
  }
  render();
  showValidation();
  focusSelectedOnMap(`已複製成 ${selectedLabel()}，圖上會亮橘色閃爍。`);
}

dom.modeButtons.forEach((button) => button.addEventListener('click', () => setMode(button.dataset.mode)));
const startSimple = localStorage.getItem('pixelverse-builder-simple') !== '0';
setSimpleMode(startSimple);
dom.simpleToggle?.addEventListener('click', () => setSimpleMode(!dom.appShell?.classList.contains('simple-builder')));
dom.simpleLoadPng?.addEventListener('click', () => dom.pngInput?.click());
dom.simpleLoadYaml?.addEventListener('click', () => dom.yamlInput?.click());
dom.simpleStepRooms?.addEventListener('click', () => setMode('room'));
dom.simpleStepCorridors?.addEventListener('click', () => setMode('corridor'));
dom.simpleStepFreeSpace?.addEventListener('click', () => setMode('free_space'));
dom.simpleStepDoors?.addEventListener('click', () => setMode('door'));
dom.simpleStepFurniture?.addEventListener('click', () => setMode('furniture'));
dom.paintTools?.forEach((button) => {
  button.addEventListener('click', () => setMode(button.dataset.paintMode));
});
dom.paintValidate?.addEventListener('click', () => {
  showValidation();
  exportYaml();
});
dom.paintSubmit?.addEventListener('click', submitMap);
dom.paintLayerToggle?.addEventListener('click', () => {
  const open = !dom.appShell?.classList.contains('layers-open');
  dom.appShell?.classList.toggle('layers-open', open);
  dom.paintLayerToggle?.setAttribute('aria-pressed', open ? 'true' : 'false');
  setSimpleFeedback(open ? '圖層面板已打開：點 chip 可定位圖上的框。' : '圖層面板已收起，回到小畫家拖拉模式。', 'ok');
});
dom.simpleStepValidate?.addEventListener('click', () => {
  showValidation();
  exportYaml();
});
dom.simpleValidateNow?.addEventListener('click', () => {
  showValidation();
  exportYaml();
});
dom.simpleExportNow?.addEventListener('click', exportYaml);
dom.simpleDuplicate?.addEventListener('click', duplicateSelected);
dom.simpleDelete?.addEventListener('click', deleteSelected);
dom.simpleSubmitNow?.addEventListener('click', submitMap);
dom.simpleClearSelection?.addEventListener('click', () => {
  selected = null;
  pending = null;
  dom.assignPopover.hidden = true;
  setSimpleFeedback('已取消選取。你可以直接拖拉新區域，或從 Layerout / 批次 chips 選圖層。', 'ok');
  render();
});
dom.simpleExit?.addEventListener('click', () => setSimpleMode(false));
dom.wallMaskToggle?.addEventListener('click', () => {
  const hidden = !dom.wallMaskCanvas?.hidden;
  if (dom.wallMaskCanvas) dom.wallMaskCanvas.hidden = hidden;
  dom.wallMaskToggle.setAttribute('aria-pressed', hidden ? 'false' : 'true');
});
dom.locale.value = locale;
dom.locale.addEventListener('change', () => {
  locale = dom.locale.value;
  localStorage.setItem('pixelverse-builder-locale', locale);
  applyLocale();
  render();
});
dom.modeButtons.forEach((button) => {
  button.addEventListener('mouseenter', (event) => showHelpTooltip(event, button.dataset.helpMode));
  button.addEventListener('mousemove', positionHelpTooltip);
  button.addEventListener('mouseleave', hideHelpTooltip);
  button.addEventListener('focus', (event) => showHelpTooltip(event, button.dataset.helpMode));
  button.addEventListener('blur', hideHelpTooltip);
});
dom.validateButton.addEventListener('click', showValidation);
dom.exportButton.addEventListener('click', exportYaml);
if (dom.submitButton) dom.submitButton.addEventListener('click', submitMap);
dom.simpleLayerSelect?.addEventListener('change', () => {
  selectLayer(dom.simpleLayerSelect.value, '已從 Layerout 選取');
});
dom.simpleLayerFocus?.addEventListener('click', () => {
  selectLayer(dom.simpleLayerSelect?.value || '', '已定位 Layerout 圖層');
});
dom.simpleLayerHide?.addEventListener('click', () => {
  if (!dom.simpleLayerSelect?.value) return;
  toggleLayerVisibility(model, dom.simpleLayerSelect.value);
  render();
});
dom.simpleLayerLock?.addEventListener('click', () => {
  if (!dom.simpleLayerSelect?.value) return;
  const layer = buildLayerList(model).find((item) => item.id === dom.simpleLayerSelect.value);
  setLayerLocked(model, dom.simpleLayerSelect.value, !layer?.locked);
  render();
});
dom.assignCancel.addEventListener('click', () => {
  pending = cancelPendingRect(pending);
  editingRoomKey = null;
  dom.assignPopover.hidden = true;
  render();
});
dom.assignDelete.addEventListener('click', () => {
  pending = cancelPendingRect(pending);
  editingRoomKey = null;
  dom.assignPopover.hidden = true;
  render();
});
dom.assignConfirm.addEventListener('click', () => {
  if (!pending) return;
  const roomKey = dom.assignRoomKey.value.trim();
  let result;
  if (editingRoomKey && model.rooms[editingRoomKey]) {
    const room = model.rooms[editingRoomKey];
    room.name = dom.assignRoomName.value.trim() || room.name || editingRoomKey;
    if (roomKey && roomKey !== editingRoomKey) {
      if (model.rooms[roomKey]) {
        dom.status.textContent = `Room key ${roomKey} is already assigned.`;
        return;
      }
      model.rooms[roomKey] = room;
      delete model.rooms[editingRoomKey];
      selected = { type: 'room', key: roomKey };
    } else {
      selected = { type: 'room', key: editingRoomKey };
    }
    result = { selection: selected };
  } else if (pending.type === 'room' && roomPaletteItems({ rooms: {} }).some((item) => item.key === roomKey)) {
    result = assignRoomFromPalette(model, pending, roomKey);
    model.rooms[roomKey].name = dom.assignRoomName.value.trim() || model.rooms[roomKey].name;
  } else {
    result = confirmPendingRect(model, pending, {
      key: roomKey,
      name: dom.assignRoomName.value.trim(),
    });
  }
  selected = result.selection;
  pending = null;
  editingRoomKey = null;
  dom.assignPopover.hidden = true;
  setMode('select');
  showValidation();
});
dom.selectionCancel.addEventListener('click', () => {
  selected = null;
  render();
});
dom.selectionDelete.addEventListener('click', deleteSelected);
dom.selectionDuplicate.addEventListener('click', duplicateSelected);
dom.selectionEdit.addEventListener('click', () => {
  if (!selected || selected.type !== 'room') return;
  pending = { type: 'room', status: 'pending', rect: model.rooms[selected.key].rect };
  editingRoomKey = selected.key;
  dom.assignRoomKey.value = selected.key;
  dom.assignRoomName.value = model.rooms[selected.key].name || selected.key;
  dom.assignPopover.style.left = '18px';
  dom.assignPopover.style.top = '18px';
  dom.assignPopover.hidden = false;
});
dom.zoomIn.addEventListener('click', () => {
  viewport = nextViewport(viewport, { type: 'zoom', delta: 1, anchor: { x: 50, y: 50 } });
  render();
});
dom.zoomOut.addEventListener('click', () => {
  viewport = nextViewport(viewport, { type: 'zoom', delta: -1, anchor: { x: 50, y: 50 } });
  render();
});
dom.zoomReset.addEventListener('click', () => {
  viewport = { scale: 1, x: 0, y: 0, preferredZoom: null };
  render();
});
dom.roomPalette.addEventListener('click', (event) => {
  const item = event.target.closest('[data-room-template]');
  if (!item || item.getAttribute('aria-disabled') === 'true') return;
  paletteRoomKey = item.dataset.roomTemplate;
  dom.roomKey.value = paletteRoomKey;
  setMode('room');
});
dom.roomPalette.addEventListener('dragstart', (event) => {
  const item = event.target.closest('[data-room-template]');
  if (!item || item.getAttribute('aria-disabled') === 'true') {
    event.preventDefault();
    return;
  }
  paletteRoomKey = item.dataset.roomTemplate;
  event.dataTransfer.setData('application/x-pixelverse-room', paletteRoomKey);
  event.dataTransfer.setData('text/plain', paletteRoomKey);
  setMode('room');
});
dom.furniturePalette.addEventListener('click', (event) => {
  const item = event.target.closest('[data-furniture-template]');
  if (!item) return;
  dom.furnitureType.value = item.dataset.furnitureTemplate;
  setMode('furniture');
});
dom.furniturePalette.addEventListener('dragstart', (event) => {
  const item = event.target.closest('[data-furniture-template]');
  if (!item) {
    event.preventDefault();
    return;
  }
  dom.furnitureType.value = item.dataset.furnitureTemplate;
  event.dataTransfer.setData('application/x-pixelverse-furniture', item.dataset.furnitureTemplate);
  event.dataTransfer.setData('text/plain', item.dataset.furnitureTemplate);
  setMode('furniture');
});
dom.stage.addEventListener('dragover', (event) => event.preventDefault());
dom.stage.addEventListener('drop', (event) => {
  event.preventDefault();
  const roomKey = event.dataTransfer.getData('application/x-pixelverse-room');
  const furnitureType = event.dataTransfer.getData('application/x-pixelverse-furniture');
  const point = stagePoint(event);
  if (furnitureType) {
    addFurnitureTemplateAt(furnitureType, imagePointToWorld(point, dom.canvas));
    return;
  }
  if (!roomKey) return;
  paletteRoomKey = roomKey;
  pending = createPendingRect('room', { x: point.x - 80, y: point.y - 60 }, { x: point.x + 80, y: point.y + 60 }, dom.canvas);
  if (isSimpleMode()) confirmSimplePendingRect();
  else showAssignPopover(event, pending);
  render();
});
document.addEventListener('click', (event) => {
  const chip = event.target.closest('[data-batch-layer]');
  if (!chip) return;
  selectLayer(chip.dataset.batchLayer, '已從批次圖層選取');
});
dom.layerList.addEventListener('click', (event) => {
  const eye = event.target.closest('[data-layer-eye]');
  const lock = event.target.closest('[data-layer-lock]');
  const select = event.target.closest('[data-layer-select]');
  if (eye) {
    toggleLayerVisibility(model, eye.dataset.layerEye);
    render();
    return;
  }
  if (lock) {
    const layer = buildLayerList(model).find((item) => item.id === lock.dataset.layerLock);
    setLayerLocked(model, lock.dataset.layerLock, !layer?.locked);
    render();
    return;
  }
  if (select) {
    const layer = buildLayerList(model).find((item) => item.id === select.dataset.layerSelect);
    if (layer?.target) {
      selectLayer(select.dataset.layerSelect, '已從完整圖層清單選取');
    }
  }
});
dom.pngInput.addEventListener('change', () => {
  const file = dom.pngInput.files?.[0];
  if (file) loadPng(file, { resetModel: true });
});
dom.furnitureType.addEventListener('change', () => {
  renderFurniturePalette();
  updateCurrentAction();
});
dom.yamlInput.addEventListener('change', () => {
  const file = dom.yamlInput.files?.[0];
  if (file) loadYaml(file);
});

dom.stage.addEventListener('pointerdown', (event) => {
  if (event.button !== 0) return;
  if (event.target.closest('.floating-card')) return;
  if (event.target.dataset.resize && selected && resizeHandlesForSelection(model, selected).length) {
    if (!canEditSelection(model, selected)) return;
    activeDrag = { kind: 'resize', start: stagePoint(event), handle: event.target.dataset.resize };
    dom.stage.setPointerCapture(event.pointerId);
    return;
  }
  const target = event.target.closest('[data-select]');
  if (target && mode === 'select') {
    selected = selectionFromDataset(target.dataset.select);
    if (!selected) return;
    if (!canEditSelection(model, selected)) {
      render();
      return;
    }
    activeDrag = { kind: 'move', start: stagePoint(event) };
    dom.stage.setPointerCapture(event.pointerId);
    render();
    focusSelectedOnMap(`已選取 ${selectedLabel()}。拖曳可移動，Ctrl+C 複製，Delete 刪除。`);
    return;
  }
  if (event.shiftKey || event.code === 'Space') {
    activeDrag = { kind: 'pan', startClient: { x: event.clientX, y: event.clientY } };
    dom.stage.setPointerCapture(event.pointerId);
    return;
  }
  dragStart = stagePoint(event);
  if (mode === 'room' || mode === 'corridor' || mode === 'free_space' || mode === 'eraser') {
    pending = createPendingRect(mode, dragStart, dragStart, dom.canvas);
    dom.dragPreviewLabel.hidden = false;
  }
});

dom.stage.addEventListener('pointermove', (event) => {
  if (!activeDrag) return;
  if (activeDrag.kind === 'pan') {
    viewport = nextViewport(viewport, {
      type: 'pan',
      dx: event.clientX - activeDrag.startClient.x,
      dy: event.clientY - activeDrag.startClient.y,
    });
    activeDrag.startClient = { x: event.clientX, y: event.clientY };
    render();
    return;
  }
  const current = stagePoint(event);
  const previousWorld = imagePointToWorld(activeDrag.start, dom.canvas);
  const currentWorld = imagePointToWorld(current, dom.canvas);
  const delta = {
    dx: Number((currentWorld.x - previousWorld.x).toFixed(2)),
    dy: Number((currentWorld.y - previousWorld.y).toFixed(2)),
  };
  if (activeDrag.kind === 'move') translateSelection(model, selected, delta);
  if (activeDrag.kind === 'resize') resizeSelection(model, selected, activeDrag.handle, delta);
  activeDrag.start = current;
  renderOverlay();
  updateInspector();
});

dom.stage.addEventListener('pointermove', (event) => {
  if (!dragStart || activeDrag || !(mode === 'room' || mode === 'corridor' || mode === 'free_space' || mode === 'eraser')) return;
  const current = stagePoint(event);
  pending = updatePendingRect(pending || createPendingRect(mode, dragStart, current, dom.canvas), dragStart, current, dom.canvas);
  dom.dragPreviewLabel.hidden = false;
  dom.dragPreviewLabel.textContent = pendingRectLabel(pending);
  dom.dragPreviewLabel.style.left = `${Math.max(12, event.offsetX + 12)}px`;
  dom.dragPreviewLabel.style.top = `${Math.max(12, event.offsetY + 12)}px`;
  renderOverlay();
});

dom.stage.addEventListener('pointerup', (event) => {
  if (activeDrag) {
    activeDrag = null;
    showValidation();
    render();
    return;
  }
  if (!dragStart) return;
  const end = stagePoint(event);
  const rect = worldRectFromDrag(dragStart, end, dom.canvas);
  const world = imagePointToWorld(end, dom.canvas);
  if (mode === 'room' && rect.width > 1 && rect.height > 1) {
    pending = updatePendingRect(pending || createPendingRect('room', dragStart, end, dom.canvas), dragStart, end, dom.canvas);
    if (isSimpleMode()) confirmSimplePendingRect();
    else showAssignPopover(event, pending);
  } else if (mode === 'corridor' && rect.width > 1 && rect.height > 1) {
    pending = updatePendingRect(pending || createPendingRect('corridor', dragStart, end, dom.canvas), dragStart, end, dom.canvas);
    if (isSimpleMode()) confirmSimplePendingRect();
    else showAssignPopover(event, pending);
  } else if (mode === 'free_space' && rect.width > 1 && rect.height > 1) {
    pending = updatePendingRect(pending || createPendingRect('free_space', dragStart, end, dom.canvas), dragStart, end, dom.canvas);
    if (isSimpleMode()) confirmSimplePendingRect();
    else showAssignPopover(event, pending);
  } else if (mode === 'eraser' && rect.width > 1 && rect.height > 1) {
    pending = updatePendingRect(pending || createPendingRect('eraser', dragStart, end, dom.canvas), dragStart, end, dom.canvas);
    const removed = eraseOverlappingWalkable(model, pending.rect);
    selected = null;
    pending = null;
    showValidation();
    setSimpleFeedback(
      removed.total
        ? `橡皮擦已刪除 ${removed.total} 個區塊（房間 ${removed.rooms}、走廊 ${removed.corridors}、補空間 ${removed.free_space}）。`
        : '橡皮擦沒有碰到可刪除區塊；請拖過房間 / 走廊 / 補空間框。',
      removed.total ? 'ok' : 'error',
    );
  } else if (mode === 'furniture') {
    addFurnitureAt(world);
  } else if (mode === 'door') {
    addDoorAt(end);
  }
  dragStart = null;
  dom.dragPreviewLabel.hidden = true;
  render();
});

dom.stage.addEventListener('wheel', (event) => {
  event.preventDefault();
  viewport = nextViewport(viewport, {
    type: 'zoom',
    delta: event.deltaY < 0 ? 1 : -1,
    anchor: { x: event.offsetX, y: event.offsetY },
  });
  render();
}, { passive: false });

document.addEventListener('keydown', (event) => {
  const tagName = String(document.activeElement?.tagName || '').toLowerCase();
  if (['input', 'textarea', 'select'].includes(tagName)) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c') {
    event.preventDefault();
    duplicateSelected();
    return;
  }
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    deleteSelected();
    return;
  }
  if (event.key === 'Escape') {
    selected = null;
    pending = null;
    dom.assignPopover.hidden = true;
    setSimpleFeedback('已取消選取。', 'ok');
    render();
  }
});

ctx.fillStyle = '#fffaf1';
ctx.fillRect(0, 0, dom.canvas.width, dom.canvas.height);
applyLocale();
render();

async function loadRuntimeMap() {
  try {
    const pngResponse = await fetch('/global_map/default.png', { cache: 'no-store' });
    if (pngResponse.ok) await loadPng(await pngResponse.blob(), { resetModel: false });
  } catch (error) {
    console.warn('Unable to auto-load runtime PNG', error);
  }
  try {
    const yamlResponse = await fetch('/global_map/default.yaml', { cache: 'no-store' });
    if (yamlResponse.ok) {
      const text = await yamlResponse.text();
      const manifest = parseGlobalMapYaml(text);
      model = {
        key: manifest.key || 'user-built-office',
        name: manifest.name || manifest.key || 'User Built Office',
        image: manifest.image || '/global_map/default.png',
        bounds: manifest.bounds || { left: 2, top: 2, width: 96, height: 96 },
        corridors: manifest.corridors || [],
        free_space: manifest.free_space || [],
        rooms: manifest.rooms || {},
      };
      dom.yamlOutput.value = text;
      selected = null;
      pending = null;
      mode = 'select';
      dom.modeButtons.forEach((button) => button.classList.toggle('active', button.dataset.mode === mode));
      showValidation();
      render();
    }
  } catch (error) {
    console.warn('Unable to auto-load runtime YAML', error);
  }
}

loadRuntimeMap();

import { WORLD_PIXELS } from '../game/constants';
import type { CutawayLayout } from './InteriorCutawaySystem';
import type { ModernOfficeCategory } from './modernOfficeCatalog';
import type { FurnitureDefinition, FurnitureLayer, FurnitureRotation } from '../world/types';
import {
  contextToolbarPlacement,
  interiorInspectorAvailable,
  type EditorRect,
  type InteriorEditorLayout,
} from './interiorEditorLayout';
import { interiorEditorCopy } from './interiorLocale';
import {
  cutawayMessage,
  furnitureLayerLabel,
  renderCutawayMessageState,
  type CutawayMessageState,
  type VillageLocale,
  villageCopy,
} from '../i18n/villageLocale';

export function selectionCapabilities(selection: readonly FurnitureDefinition[]): {
  canDuplicate: boolean;
  canGroup: boolean;
} {
  const ordinaryCount = selection.filter(({ supportedActions, requirementId }) =>
    supportedActions.length === 0 && !requirementId).length;
  const instanceId = selection[0]?.prefabInstanceId;
  const oneAtomicSelection = selection.length === 1 || Boolean(
    instanceId && selection.every(({ prefabInstanceId }) => prefabInstanceId === instanceId),
  );
  return {
    canDuplicate: oneAtomicSelection,
    canGroup: ordinaryCount >= 2 && selection.every(({ prefabInstanceId }) => !prefabInstanceId),
  };
}

interface CutawayDomModelBase {
  titleId: keyof ReturnType<typeof villageCopy>['cutaway']['titles'];
  title: string;
  editMode: boolean;
  category: ModernOfficeCategory;
  page: number;
  totalPages: number;
  requiredPlaced: number;
  requiredTotal: number;
  prefabCount: number;
  clipboardAvailable: boolean;
  saveBlocked: boolean;
  selectedCount: number;
  canDuplicate: boolean;
  canGroup: boolean;
  canDissolve: boolean;
  canUndo: boolean;
  templatePreviewing: boolean;
  templateValid: boolean;
  templateDiagnostics: Array<'templateInvalid' | 'unreachableHook'>;
  selected?: { label: string; scale: number; rotation: FurnitureRotation; layer: FurnitureLayer };
  editorLayout?: InteriorEditorLayout;
  selectionBounds?: EditorRect;
}

export interface CutawayDisclosureState {
  catalogExpanded: boolean;
  inspectorExpanded: boolean;
  guideMode: boolean;
}

export type CutawayDomModel = CutawayDomModelBase & CutawayDisclosureState & CutawayMessageState;

export interface CutawayDomHandlers {
  close(): void;
  toggleEdit(): void;
  toggleCatalog(): void;
  toggleInspector(): void;
  toggleGuide(): void;
  fitView(): void;
  save(): void;
  undo(): void;
  previewTemplate(): void;
  applyTemplate(): void;
  category(category: ModernOfficeCategory): void;
  page(delta: -1 | 1): void;
  resize(delta: -1 | 1): void;
  rotate(delta: -90 | 90): void;
  collect(): void;
  revert(): void;
  copy(): void;
  paste(): void;
  group(): void;
  dissolveGroup(): void;
  shiftLayer(direction: 'previous' | 'next'): void;
  reorder(direction: 'back' | 'backward' | 'forward' | 'front'): void;
  duplicate(): void;
  returnToShelf(): void;
  cancelSelection(): void;
}

export interface CutawayRoomLabel { id: string; text: string; x: number; y: number; kind: 'hook' | 'agent'; selected?: boolean }

export class InteriorCutawayDomOverlay {
  private readonly host: HTMLElement | undefined;
  private panel: HTMLElement | undefined;
  private header: HTMLElement | undefined;
  private title: HTMLElement | undefined;
  private status: HTMLElement | undefined;
  private editButton: HTMLButtonElement | undefined;
  private roomToolbar: HTMLElement | undefined;
  private catalog: HTMLElement | undefined;
  private inspector: HTMLElement | undefined;
  private contextToolbar: HTMLElement | undefined;
  private guidePopover: HTMLElement | undefined;
  private handlers: CutawayDomHandlers | undefined;
  private labelLayer: HTMLDivElement | undefined;
  private locale: VillageLocale = 'zh-TW';
  private model: CutawayDomModel | undefined;
  private roomLabels: CutawayRoomLabel[] = [];
  private layout: CutawayLayout | undefined;

  constructor(private readonly canvasRect: () => DOMRect | undefined) {
    this.host = typeof document === 'undefined'
      ? undefined
      : document.querySelector<HTMLElement>('#cutaway-ui-layer') ?? undefined;
  }

  open(layout: CutawayLayout, model: CutawayDomModel, handlers: CutawayDomHandlers): void {
    this.close();
    if (!this.host) return;
    this.handlers = handlers;
    const panel = document.createElement('section');
    panel.className = 'cutaway-dom-panel';
    panel.innerHTML = `
      <header class="cutaway-dom-header">
        <div><h2></h2><p class="cutaway-dom-status"></p></div>
        <div class="cutaway-dom-actions">
          <button type="button" data-action="edit">✥</button>
          <button type="button" data-action="catalog">▦</button>
          <button type="button" data-action="inspector">ⓘ</button>
          <button type="button" data-action="guide">?</button>
          <button type="button" data-action="fit">⛶</button>
          <button type="button" data-action="close">×</button>
        </div>
      </header>
      <nav class="cutaway-room-toolbar" aria-label="Room editing commands" hidden>
        <button type="button" data-action="collect"></button>
        <button type="button" data-action="revert"></button>
        <button type="button" data-action="copy"></button>
        <button type="button" data-action="paste"></button>
        <button type="button" data-action="undo"></button>
        <button type="button" data-action="preview-template"></button>
        <button type="button" data-action="apply-template" hidden></button>
        <button type="button" data-action="save"></button>
      </nav>
      <div class="cutaway-context-toolbar" hidden></div>
      <aside class="cutaway-dom-inspector" hidden></aside>
      <section class="cutaway-dom-catalog" hidden>
        <nav class="cutaway-dom-categories"></nav>
        <div class="cutaway-dom-page"><button type="button" data-action="prev">‹</button><span></span><button type="button" data-action="next">›</button></div>
      </section>
      <div class="cutaway-guide-popover" id="cutaway-guide-popover" role="dialog" aria-modal="false" hidden></div>
      <div class="cutaway-room-labels"></div>`;
    this.host.append(panel);
    this.labelLayer = panel.querySelector<HTMLDivElement>('.cutaway-room-labels') ?? undefined;
    this.panel = panel;
    this.header = panel.querySelector('.cutaway-dom-header') ?? undefined;
    this.title = panel.querySelector('h2') ?? undefined;
    this.status = panel.querySelector('.cutaway-dom-status') ?? undefined;
    this.editButton = panel.querySelector('[data-action="edit"]') ?? undefined;
    this.roomToolbar = panel.querySelector('.cutaway-room-toolbar') ?? undefined;
    this.catalog = panel.querySelector('.cutaway-dom-catalog') ?? undefined;
    this.inspector = panel.querySelector('.cutaway-dom-inspector') ?? undefined;
    this.contextToolbar = panel.querySelector('.cutaway-context-toolbar') ?? undefined;
    this.guidePopover = panel.querySelector('.cutaway-guide-popover') ?? undefined;
    panel.querySelector('[data-action="close"]')?.addEventListener('click', handlers.close);
    panel.querySelector('[data-action="edit"]')?.addEventListener('click', handlers.toggleEdit);
    panel.querySelector('[data-action="catalog"]')?.addEventListener('click', handlers.toggleCatalog);
    panel.querySelector('[data-action="inspector"]')?.addEventListener('click', handlers.toggleInspector);
    panel.querySelector('[data-action="guide"]')?.addEventListener('click', handlers.toggleGuide);
    panel.querySelector('[data-action="fit"]')?.addEventListener('click', handlers.fitView);
    panel.querySelector('[data-action="collect"]')?.addEventListener('click', handlers.collect);
    panel.querySelector('[data-action="revert"]')?.addEventListener('click', handlers.revert);
    panel.querySelector('[data-action="copy"]')?.addEventListener('click', handlers.copy);
    panel.querySelector('[data-action="paste"]')?.addEventListener('click', handlers.paste);
    panel.querySelector('[data-action="undo"]')?.addEventListener('click', handlers.undo);
    panel.querySelector('[data-action="preview-template"]')?.addEventListener('click', handlers.previewTemplate);
    panel.querySelector('[data-action="apply-template"]')?.addEventListener('click', handlers.applyTemplate);
    panel.querySelector('[data-action="save"]')?.addEventListener('click', handlers.save);
    panel.querySelector('[data-action="prev"]')?.addEventListener('click', () => handlers.page(-1));
    panel.querySelector('[data-action="next"]')?.addEventListener('click', () => handlers.page(1));
    panel.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape' || !this.model?.guideMode) return;
      event.preventDefault();
      event.stopPropagation();
      this.handlers?.toggleGuide();
    });
    this.position(layout);
    this.update(model);
  }

  update(model: CutawayDomModel): void {
    const previousGuideMode = Boolean(this.model?.guideMode);
    const activeElement = typeof document === 'undefined' ? undefined : document.activeElement as HTMLElement | null;
    const guideHadFocus = Boolean(activeElement && this.guidePopover?.contains(activeElement));
    this.model = model;
    if (!this.panel) return;
    const localeCopy = villageCopy(this.locale).cutaway;
    const chrome = interiorEditorCopy(this.locale);
    if (this.title) this.title.textContent = localeCopy.titles[model.titleId] ?? model.title;
    if (this.status) this.status.textContent = renderCutawayMessageState(this.locale, model);
    const iconActions = {
      edit: model.editMode ? localeCopy.actions.done : localeCopy.actions.edit,
      catalog: chrome.catalog,
      inspector: chrome.properties,
      guide: chrome.help,
      fit: chrome.fitView,
      close: localeCopy.actions.close,
      prev: chrome.previousPage,
      next: chrome.nextPage,
    } as const;
    Object.entries(iconActions).forEach(([action, label]) => {
      const button = this.panel?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      button?.setAttribute('aria-label', label);
      button?.setAttribute('data-tooltip', label);
    });
    if (this.editButton) this.editButton.textContent = model.editMode ? '✓' : '✥';
    const actionLabels: Record<string, string> = {
      collect: localeCopy.actions.collect,
      revert: localeCopy.actions.revert,
      copy: localeCopy.actions.copy,
      paste: localeCopy.actions.paste,
      undo: localeCopy.actions.undo,
      'preview-template': localeCopy.actions.previewTemplate,
      'apply-template': localeCopy.actions.applyTemplate,
      save: localeCopy.actions.save,
    };
    const catalogButton = this.panel.querySelector<HTMLButtonElement>('[data-action="catalog"]');
    const inspectorButton = this.panel.querySelector<HTMLButtonElement>('[data-action="inspector"]');
    const guideButton = this.panel.querySelector<HTMLButtonElement>('[data-action="guide"]');
    if (catalogButton) { catalogButton.hidden = !model.editMode; catalogButton.setAttribute('aria-pressed', String(model.catalogExpanded)); }
    const inspectorAvailable = model.editorLayout ? interiorInspectorAvailable(model.editorLayout.frame) : true;
    const catalogAvailable = (model.editorLayout?.catalog.height ?? 1) > 0;
    if (inspectorButton) { inspectorButton.hidden = !model.editMode; inspectorButton.disabled = !model.selected || !inspectorAvailable; inspectorButton.setAttribute('aria-pressed', String(model.inspectorExpanded)); }
    if (guideButton) {
      guideButton.setAttribute('aria-expanded', String(model.guideMode));
      guideButton.setAttribute('aria-controls', 'cutaway-guide-popover');
    }
    if (this.roomToolbar) this.roomToolbar.hidden = !model.editMode || (model.editorLayout?.roomToolbar.height ?? 1) <= 0;
    const roomActionState: Record<string, { disabled?: boolean; hidden?: boolean }> = {
      collect: {}, revert: {}, copy: {},
      paste: { disabled: !model.clipboardAvailable },
      undo: { disabled: !model.canUndo },
      'preview-template': {},
      'apply-template': { disabled: !model.templateValid, hidden: !model.templatePreviewing },
      save: { disabled: model.saveBlocked },
    };
    Object.entries(roomActionState).forEach(([action, state]) => {
      const button = this.panel?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (!button) return;
      button.disabled = Boolean(state.disabled);
      button.hidden = Boolean(state.hidden);
    });
    if (this.catalog) this.catalog.hidden = !model.editMode || !model.catalogExpanded || !catalogAvailable;
    const nav = this.panel.querySelector('.cutaway-dom-categories');
    if (nav) {
      nav.replaceChildren(...Object.entries(localeCopy.categories).map(([category, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.setAttribute('aria-label', label);
        button.dataset.active = String(category === model.category);
        button.addEventListener('click', () => this.handlers?.category(category as ModernOfficeCategory));
        return button;
      }));
    }
    const page = this.panel.querySelector('.cutaway-dom-page span');
    if (page) page.textContent = `${model.page + 1} / ${model.totalPages}`;
    if (this.inspector) {
      this.inspector.hidden = !model.editMode || !model.selected || !model.inspectorExpanded || !inspectorAvailable;
      const compactBottom = Boolean(
        model.editorLayout
        && model.editorLayout.inspector.width === model.editorLayout.frame.width
        && model.editorLayout.inspector.height > 0,
      );
      this.inspector.dataset.placement = compactBottom ? 'bottom' : 'side';
      this.inspector.replaceChildren();
      if (model.selected) {
        const label = document.createElement('strong');
        const selectedLabel = this.locale !== 'zh-TW' && /[\u3400-\u9fff]/.test(model.selected.label)
          ? localeCopy.status.furniture : model.selected.label;
        label.textContent = model.selectedCount > 1
          ? `${model.selectedCount} ${localeCopy.status.selected} · ${localeCopy.status.batch}`
          : `${selectedLabel} · ${Math.round(model.selected.scale * 100)}% · ${model.selected.rotation}° · ${furnitureLayerLabel(this.locale, model.selected.layer)}`;
        this.inspector.append(label);
      }
    }

    if (this.contextToolbar) {
      this.contextToolbar.hidden = !model.editMode || !model.selected;
      const focusedAction = activeElement && this.contextToolbar.contains(activeElement)
        ? activeElement.dataset.contextAction
        : undefined;
      let restoredContextFocus = false;
      this.contextToolbar.replaceChildren();
      if (!this.contextToolbar.hidden) {
        const controls: Array<[string, string, () => void, boolean?]> = [
          ['cancel', localeCopy.actions.cancel, () => this.handlers?.cancelSelection()],
          ...(model.canDuplicate ? [['duplicate', localeCopy.actions.duplicate, () => this.handlers?.duplicate()] as [string, string, () => void]] : []),
          ...(model.canGroup ? [['group', localeCopy.actions.group, () => this.handlers?.group()] as [string, string, () => void]] : []),
          ...(model.canDissolve ? [['dissolve', localeCopy.actions.dissolveGroup, () => this.handlers?.dissolveGroup()] as [string, string, () => void]] : []),
          ['shelf', localeCopy.actions.shelf, () => this.handlers?.returnToShelf()],
          ['smaller', localeCopy.actions.smaller, () => this.handlers?.resize(-1)],
          ['larger', localeCopy.actions.larger, () => this.handlers?.resize(1)],
          ['rotate-left', '↶', () => this.handlers?.rotate(-90)],
          ['rotate-right', '↷', () => this.handlers?.rotate(90)],
          ['layer-down', localeCopy.actions.layerDown, () => this.handlers?.shiftLayer('previous')],
          ['layer-up', localeCopy.actions.layerUp, () => this.handlers?.shiftLayer('next')],
          ['back', localeCopy.actions.back, () => this.handlers?.reorder('back')],
          ['backward', localeCopy.actions.backward, () => this.handlers?.reorder('backward')],
          ['forward', localeCopy.actions.forward, () => this.handlers?.reorder('forward')],
          ['front', localeCopy.actions.front, () => this.handlers?.reorder('front')],
        ];
        this.contextToolbar.append(...controls.map(([action, text, handler, disabled]) => {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = text; button.onclick = handler; button.disabled = Boolean(disabled);
          button.dataset.contextAction = action;
          const semanticLabel = text === '↶' ? chrome.rotateLeft : text === '↷' ? chrome.rotateRight : text;
          button.setAttribute('aria-label', semanticLabel); button.setAttribute('data-tooltip', semanticLabel);
          return button;
        }));
        if (focusedAction) {
          const replacement = this.contextToolbar.querySelector<HTMLButtonElement>(`[data-context-action="${focusedAction}"]`);
          replacement?.focus();
          restoredContextFocus = Boolean(replacement);
        }
      }
      if (focusedAction && !restoredContextFocus) {
        const roomFallback = this.roomToolbar?.querySelector<HTMLButtonElement>('button:not([hidden]):not(:disabled)');
        (roomFallback ?? this.editButton)?.focus();
      }
    }
    if (this.guidePopover) {
      this.guidePopover.setAttribute('aria-label', chrome.help);
      this.guidePopover.hidden = !model.guideMode;
      this.guidePopover.replaceChildren();
      if (model.guideMode) {
        const copy = document.createElement('p');
        copy.textContent = `${chrome.validPlacement} · ${chrome.collision} · ${chrome.returnedToOrigin}`;
        const close = document.createElement('button');
        close.type = 'button'; close.textContent = chrome.closeGuide; close.onclick = () => this.handlers?.toggleGuide();
        close.setAttribute('aria-label', chrome.closeGuide); close.setAttribute('data-tooltip', chrome.closeGuide);
        this.guidePopover.append(copy, close);
        if (!previousGuideMode || guideHadFocus) close.focus();
      }
      if (previousGuideMode && !model.guideMode) guideButton?.focus();
    }
    Object.entries(actionLabels).forEach(([action, label]) => {
      const button = this.panel?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (!button) return;
      button.textContent = label; button.setAttribute('aria-label', label); button.setAttribute('data-tooltip', label);
    });
    if (this.status && model.editMode) {
      const diagnostics = model.templateDiagnostics.map((id) => cutawayMessage(this.locale, id));
      const status = diagnostics.length > 0
        ? diagnostics.join(' · ')
        : renderCutawayMessageState(this.locale, model);
      this.status.textContent = `${status} · ${localeCopy.status.hook} ${model.requiredPlaced}/${model.requiredTotal} · ${localeCopy.status.prefab} ${model.prefabCount}`;
    }
    this.positionEditorRegions();
    this.positionContextToolbar();
  }

  relayout(layout: CutawayLayout): void {
    this.layout = layout;
    this.position(layout);
    this.renderRoomLabels();
  }

  setLocale(locale: VillageLocale): void {
    this.locale = locale;
    if (this.model) this.update(this.model);
  }

  setRoomLabels(labels: readonly CutawayRoomLabel[]): void {
    this.roomLabels = labels.map((label) => ({ ...label }));
    this.renderRoomLabels();
  }

  private renderRoomLabels(): void {
    if (!this.labelLayer) return;
    const rect = this.canvasRect();
    if (!rect) return;
    const rendered = this.roomLabels.map((item) => {
      const label = document.createElement('div');
      label.className = `cutaway-room-label cutaway-room-label--${item.kind}`;
      label.dataset.labelId = item.id;
      label.textContent = item.text;
      label.tabIndex = 0;
      label.setAttribute('aria-label', item.text.replace(/\n/g, ' · '));
      label.dataset.expanded = String(Boolean(item.selected) || Boolean(this.model?.guideMode));
      return { item, label };
    });
    this.labelLayer.replaceChildren(...rendered.map(({ label }) => label));
    const clamp = (value: number, minimum: number, maximum: number): number =>
      maximum < minimum ? (minimum + maximum) / 2 : Math.min(maximum, Math.max(minimum, value));
    const intersects = (first: EditorRect, second: EditorRect): boolean => (
      first.x < second.x + second.width && first.x + first.width > second.x
      && first.y < second.y + second.height && first.y + first.height > second.y
    );
    rendered.forEach(({ item, label }) => {
      const layout = this.layout;
      const room = this.model?.editorLayout?.room ?? layout;
      let x = item.x;
      let y = item.y;
      const selection = this.model?.selectionBounds;
      if (room) {
        const cssScaleX = rect.width / WORLD_PIXELS.width;
        const cssScaleY = rect.height / WORLD_PIXELS.height;
        label.dataset.measureExpanded = 'true';
        const measured = label.getBoundingClientRect();
        delete label.dataset.measureExpanded;
        const labelWidth = Math.min(room.width, measured.width / cssScaleX);
        const labelHeight = Math.min(room.height, measured.height / cssScaleY);
        const halfWidth = labelWidth / 2;
        const anchorBounds = (anchorX: number, anchorY: number): EditorRect => ({
          x: anchorX - halfWidth,
          y: item.kind === 'agent' ? anchorY - labelHeight : anchorY,
          width: labelWidth,
          height: labelHeight,
        });
        const clampAnchor = (anchorX: number, anchorY: number): { x: number; y: number } => ({
          x: clamp(anchorX, room.x + halfWidth, room.x + room.width - halfWidth),
          y: item.kind === 'agent'
            ? clamp(anchorY, room.y + labelHeight, room.y + room.height)
            : clamp(anchorY, room.y, room.y + room.height - labelHeight),
        });
        ({ x, y } = clampAnchor(x, y));
        if (selection && intersects(anchorBounds(x, y), selection)) {
          const gap = 6;
          const above = item.kind === 'agent' ? selection.y - gap : selection.y - gap - labelHeight;
          const below = item.kind === 'agent'
            ? selection.y + selection.height + gap + labelHeight
            : selection.y + selection.height + gap;
          const candidates = [
            clampAnchor(x, above),
            clampAnchor(x, below),
            clampAnchor(selection.x - gap - halfWidth, y),
            clampAnchor(selection.x + selection.width + gap + halfWidth, y),
          ].filter((candidate) => !intersects(anchorBounds(candidate.x, candidate.y), selection));
          const nearest = candidates.sort((first, second) => (
            (first.x - x) ** 2 + (first.y - y) ** 2
            - ((second.x - x) ** 2 + (second.y - y) ** 2)
          ))[0];
          if (nearest) ({ x, y } = nearest);
        }
      }
      const anchor = item.kind === 'agent' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';
      const coordinateFrame = room ?? layout;
      const left = coordinateFrame ? (x - coordinateFrame.x) / WORLD_PIXELS.width * rect.width : rect.left + x / WORLD_PIXELS.width * rect.width;
      const top = coordinateFrame ? (y - coordinateFrame.y) / WORLD_PIXELS.height * rect.height : rect.top + y / WORLD_PIXELS.height * rect.height;
      label.style.transform = `translate3d(${left}px, ${top}px, 0) ${anchor}`;
    });
  }

  close(): void {
    this.panel?.remove();
    this.labelLayer?.remove();
    this.panel = undefined;
    this.header = undefined;
    this.roomToolbar = undefined;
    this.catalog = undefined;
    this.inspector = undefined;
    this.labelLayer = undefined;
    this.contextToolbar = undefined;
    this.guidePopover = undefined;
    this.handlers = undefined;
    this.roomLabels = [];
  }

  destroy(): void { this.close(); }

  private position(layout: CutawayLayout): void {
    this.layout = layout;
    const rect = this.canvasRect();
    if (!this.panel || !rect) return;
    this.panel.style.left = `${rect.left + layout.x / WORLD_PIXELS.width * rect.width}px`;
    this.panel.style.top = `${rect.top + layout.y / WORLD_PIXELS.height * rect.height}px`;
    this.panel.style.width = `${layout.width / WORLD_PIXELS.width * rect.width}px`;
    this.panel.style.height = `${layout.height / WORLD_PIXELS.height * rect.height}px`;
    this.positionEditorRegions();
    this.positionContextToolbar();
  }

  private positionEditorRegions(): void {
    const layout = this.layout;
    const editorLayout = this.model?.editorLayout;
    if (!layout || !editorLayout || layout.width <= 0 || layout.height <= 0) return;
    const place = (element: HTMLElement | undefined, region: EditorRect): void => {
      if (!element) return;
      element.style.left = `${(region.x - layout.x) / layout.width * 100}%`;
      element.style.top = `${(region.y - layout.y) / layout.height * 100}%`;
      element.style.width = `${region.width / layout.width * 100}%`;
      element.style.height = `${region.height / layout.height * 100}%`;
    };
    place(this.header, editorLayout.header);
    place(this.roomToolbar, editorLayout.roomToolbar);
    place(this.catalog, editorLayout.catalog);
    place(this.inspector, editorLayout.inspector);
    place(this.labelLayer, editorLayout.room);
    if (this.labelLayer) {
      this.labelLayer.dataset.region = 'room';
      this.labelLayer.style.overflow = 'visible';
    }
  }

  private positionContextToolbar(): void {
    const layout = this.layout;
    const editorLayout = this.model?.editorLayout;
    const selection = this.model?.selectionBounds;
    if (!layout || !editorLayout || !selection || !this.contextToolbar || this.contextToolbar.hidden) return;
    const width = Math.min(280, editorLayout.room.width);
    this.contextToolbar.style.width = `${width / layout.width * 100}%`;
    const panelHeight = this.panel?.getBoundingClientRect().height ?? 0;
    const measuredHeight = panelHeight > 0
      ? this.contextToolbar.scrollHeight / panelHeight * layout.height
      : 56;
    const height = Math.min(Math.max(40, measuredHeight), Math.min(112, editorLayout.room.height));
    const placement = contextToolbarPlacement(selection, editorLayout.room, { width, height });
    this.contextToolbar.dataset.side = placement.side;
    this.contextToolbar.style.left = `${(placement.x - layout.x) / layout.width * 100}%`;
    this.contextToolbar.style.top = `${(placement.y - layout.y) / layout.height * 100}%`;
    this.contextToolbar.style.height = `${placement.height / layout.height * 100}%`;
    this.contextToolbar.style.maxHeight = `${placement.height / layout.height * 100}%`;
    this.contextToolbar.style.overflowY = 'auto';
  }
}

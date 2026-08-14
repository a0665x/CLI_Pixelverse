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
      <div class="cutaway-context-toolbar" hidden></div>
      <aside class="cutaway-dom-inspector" hidden></aside>
      <section class="cutaway-dom-catalog" hidden>
        <nav class="cutaway-dom-categories"></nav>
        <div class="cutaway-dom-page"><button type="button" data-action="prev">‹</button><span></span><button type="button" data-action="next">›</button></div>
      </section>
      <div class="cutaway-guide-popover" role="tooltip" hidden></div>
      <div class="cutaway-room-labels"></div>`;
    this.host.append(panel);
    this.labelLayer = panel.querySelector<HTMLDivElement>('.cutaway-room-labels') ?? undefined;
    this.panel = panel;
    this.header = panel.querySelector('.cutaway-dom-header') ?? undefined;
    this.title = panel.querySelector('h2') ?? undefined;
    this.status = panel.querySelector('.cutaway-dom-status') ?? undefined;
    this.editButton = panel.querySelector('[data-action="edit"]') ?? undefined;
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
    panel.querySelector('[data-action="prev"]')?.addEventListener('click', () => handlers.page(-1));
    panel.querySelector('[data-action="next"]')?.addEventListener('click', () => handlers.page(1));
    this.position(layout);
    this.update(model);
  }

  update(model: CutawayDomModel): void {
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
    if (catalogButton) { catalogButton.hidden = !model.editMode; catalogButton.setAttribute('aria-pressed', String(model.catalogExpanded)); }
    const inspectorAvailable = model.editorLayout ? interiorInspectorAvailable(model.editorLayout.frame) : true;
    const catalogAvailable = (model.editorLayout?.catalog.height ?? 1) > 0;
    if (inspectorButton) { inspectorButton.hidden = !model.editMode; inspectorButton.disabled = !model.selected || !inspectorAvailable; inspectorButton.setAttribute('aria-pressed', String(model.inspectorExpanded)); }
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
      this.contextToolbar.replaceChildren();
      if (!this.contextToolbar.hidden) {
        const controls: Array<[string, () => void, boolean?]> = [
          [localeCopy.actions.cancel, () => this.handlers?.cancelSelection()],
          ...(model.canDuplicate ? [[localeCopy.actions.duplicate, () => this.handlers?.duplicate()] as [string, () => void]] : []),
          ...(model.canGroup ? [[localeCopy.actions.group, () => this.handlers?.group()] as [string, () => void]] : []),
          ...(model.canDissolve ? [[localeCopy.actions.dissolveGroup, () => this.handlers?.dissolveGroup()] as [string, () => void]] : []),
          [localeCopy.actions.shelf, () => this.handlers?.returnToShelf()],
          [localeCopy.actions.smaller, () => this.handlers?.resize(-1)], [localeCopy.actions.larger, () => this.handlers?.resize(1)],
          ['↶', () => this.handlers?.rotate(-90)], ['↷', () => this.handlers?.rotate(90)],
          [localeCopy.actions.layerDown, () => this.handlers?.shiftLayer('previous')], [localeCopy.actions.layerUp, () => this.handlers?.shiftLayer('next')],
          [localeCopy.actions.back, () => this.handlers?.reorder('back')], [localeCopy.actions.backward, () => this.handlers?.reorder('backward')],
          [localeCopy.actions.forward, () => this.handlers?.reorder('forward')], [localeCopy.actions.front, () => this.handlers?.reorder('front')],
          [localeCopy.actions.collect, () => this.handlers?.collect()], [localeCopy.actions.revert, () => this.handlers?.revert()],
          [localeCopy.actions.copy, () => this.handlers?.copy()], [localeCopy.actions.paste, () => this.handlers?.paste(), !model.clipboardAvailable],
          [localeCopy.actions.undo, () => this.handlers?.undo(), !model.canUndo],
          [localeCopy.actions.previewTemplate, () => this.handlers?.previewTemplate()],
          ...(model.templatePreviewing ? [[localeCopy.actions.applyTemplate, () => this.handlers?.applyTemplate(), !model.templateValid] as [string, () => void, boolean]] : []),
          [localeCopy.actions.save, () => this.handlers?.save(), model.saveBlocked],
        ];
        this.contextToolbar.append(...controls.map(([text, handler, disabled]) => {
          const button = document.createElement('button');
          button.type = 'button'; button.textContent = text; button.onclick = handler; button.disabled = Boolean(disabled);
          const semanticLabel = text === '↶' ? chrome.rotateLeft : text === '↷' ? chrome.rotateRight : text;
          button.setAttribute('aria-label', semanticLabel); button.setAttribute('data-tooltip', semanticLabel);
          return button;
        }));
      }
    }
    if (this.guidePopover) {
      this.guidePopover.hidden = !model.guideMode;
      this.guidePopover.replaceChildren();
      if (model.guideMode) {
        const copy = document.createElement('p');
        copy.textContent = `${chrome.validPlacement} · ${chrome.collision} · ${chrome.returnedToOrigin}`;
        const close = document.createElement('button');
        close.type = 'button'; close.textContent = chrome.closeGuide; close.onclick = () => this.handlers?.toggleGuide();
        close.setAttribute('aria-label', chrome.closeGuide); close.setAttribute('data-tooltip', chrome.closeGuide);
        this.guidePopover.append(copy, close);
      }
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
    this.labelLayer.replaceChildren(...this.roomLabels.map((item) => {
      const label = document.createElement('div');
      label.className = `cutaway-room-label cutaway-room-label--${item.kind}`;
      label.dataset.labelId = item.id;
      label.textContent = item.text;
      label.tabIndex = 0;
      label.setAttribute('aria-label', item.text.replace(/\n/g, ' · '));
      label.dataset.expanded = String(Boolean(item.selected) || Boolean(this.model?.guideMode));
      let x = item.x;
      let y = item.y;
      const selection = this.model?.selectionBounds;
      if (item.kind === 'agent' && selection && x >= selection.x - 24 && x <= selection.x + selection.width + 24
        && y >= selection.y - 24 && y <= selection.y + selection.height + 24) {
        y = selection.y - 8;
      }
      const anchor = item.kind === 'agent' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';
      const layout = this.layout;
      const left = layout ? (x - layout.x) / WORLD_PIXELS.width * rect.width : rect.left + x / WORLD_PIXELS.width * rect.width;
      const top = layout ? (y - layout.y) / WORLD_PIXELS.height * rect.height : rect.top + y / WORLD_PIXELS.height * rect.height;
      label.style.transform = `translate3d(${Math.round(left)}px, ${Math.round(top)}px, 0) ${anchor}`;
      return label;
    }));
  }

  close(): void {
    this.panel?.remove();
    this.labelLayer?.remove();
    this.panel = undefined;
    this.header = undefined;
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
    if (!layout || !editorLayout) return;
    const place = (element: HTMLElement | undefined, region: EditorRect): void => {
      if (!element) return;
      element.style.left = `${(region.x - layout.x) / layout.width * 100}%`;
      element.style.top = `${(region.y - layout.y) / layout.height * 100}%`;
      element.style.width = `${region.width / layout.width * 100}%`;
      element.style.height = `${region.height / layout.height * 100}%`;
    };
    place(this.header, editorLayout.header);
    place(this.catalog, editorLayout.catalog);
    place(this.inspector, editorLayout.inspector);
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

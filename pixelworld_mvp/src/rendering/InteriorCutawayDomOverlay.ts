import { WORLD_PIXELS } from '../game/constants';
import type { CutawayLayout } from './InteriorCutawaySystem';
import type { ModernOfficeCategory } from './modernOfficeCatalog';
import type { FurnitureDefinition, FurnitureLayer, FurnitureRotation } from '../world/types';
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
}
export type CutawayDomModel = CutawayDomModelBase & CutawayMessageState;

export interface CutawayDomHandlers {
  close(): void;
  toggleEdit(): void;
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

export interface CutawayRoomLabel { id: string; text: string; x: number; y: number; kind: 'hook' | 'agent' }

export class InteriorCutawayDomOverlay {
  private readonly host: HTMLElement | undefined;
  private panel: HTMLDivElement | undefined;
  private title: HTMLElement | undefined;
  private status: HTMLElement | undefined;
  private editButton: HTMLButtonElement | undefined;
  private catalog: HTMLElement | undefined;
  private inspector: HTMLElement | undefined;
  private handlers: CutawayDomHandlers | undefined;
  private labelLayer: HTMLDivElement | undefined;
  private locale: VillageLocale = 'zh-TW';
  private model: CutawayDomModel | undefined;
  private roomLabels: CutawayRoomLabel[] = [];

  constructor(private readonly canvasRect: () => DOMRect | undefined) {
    this.host = typeof document === 'undefined'
      ? undefined
      : document.querySelector<HTMLElement>('#cutaway-ui-layer') ?? undefined;
  }

  open(layout: CutawayLayout, model: CutawayDomModel, handlers: CutawayDomHandlers): void {
    this.close();
    if (!this.host) return;
    this.handlers = handlers;
    const panel = document.createElement('div');
    panel.className = 'cutaway-dom-panel';
    panel.innerHTML = `
      <header class="cutaway-dom-header">
        <div><h2></h2><p class="cutaway-dom-status"></p></div>
        <div class="cutaway-dom-actions">
          <button type="button" data-action="edit"></button>
          <button type="button" data-action="collect"></button>
          <button type="button" data-action="revert"></button>
          <button type="button" data-action="copy"></button>
          <button type="button" data-action="paste"></button>
          <button type="button" data-action="undo"></button>
          <button type="button" data-action="preview-template"></button>
          <button type="button" data-action="apply-template"></button>
          <button type="button" data-action="save"></button>
          <button type="button" data-action="close">×</button>
        </div>
      </header>
      <section class="cutaway-dom-catalog">
        <nav class="cutaway-dom-categories"></nav>
        <div class="cutaway-dom-page"><button type="button" data-action="prev">‹</button><span></span><button type="button" data-action="next">›</button></div>
      </section>
      <section class="cutaway-dom-inspector"></section>`;
    this.host.append(panel);
    const labelLayer = document.createElement('div');
    labelLayer.className = 'cutaway-dom-room-labels';
    this.host.append(labelLayer);
    this.labelLayer = labelLayer;
    this.panel = panel;
    this.title = panel.querySelector('h2') ?? undefined;
    this.status = panel.querySelector('.cutaway-dom-status') ?? undefined;
    this.editButton = panel.querySelector('[data-action="edit"]') ?? undefined;
    this.catalog = panel.querySelector('.cutaway-dom-catalog') ?? undefined;
    this.inspector = panel.querySelector('.cutaway-dom-inspector') ?? undefined;
    panel.querySelector('[data-action="close"]')?.addEventListener('click', handlers.close);
    panel.querySelector('[data-action="edit"]')?.addEventListener('click', handlers.toggleEdit);
    panel.querySelector('[data-action="save"]')?.addEventListener('click', handlers.save);
    panel.querySelector('[data-action="collect"]')?.addEventListener('click', handlers.collect);
    panel.querySelector('[data-action="revert"]')?.addEventListener('click', handlers.revert);
    panel.querySelector('[data-action="copy"]')?.addEventListener('click', handlers.copy);
    panel.querySelector('[data-action="paste"]')?.addEventListener('click', handlers.paste);
    panel.querySelector('[data-action="undo"]')?.addEventListener('click', handlers.undo);
    panel.querySelector('[data-action="preview-template"]')?.addEventListener('click', handlers.previewTemplate);
    panel.querySelector('[data-action="apply-template"]')?.addEventListener('click', handlers.applyTemplate);
    panel.querySelector('[data-action="prev"]')?.addEventListener('click', () => handlers.page(-1));
    panel.querySelector('[data-action="next"]')?.addEventListener('click', () => handlers.page(1));
    this.position(layout);
    this.update(model);
  }

  update(model: CutawayDomModel): void {
    this.model = model;
    if (!this.panel) return;
    const localeCopy = villageCopy(this.locale).cutaway;
    if (this.title) this.title.textContent = localeCopy.titles[model.titleId] ?? model.title;
    if (this.status) this.status.textContent = renderCutawayMessageState(this.locale, model);
    if (this.editButton) this.editButton.textContent = model.editMode ? localeCopy.actions.done : localeCopy.actions.edit;
    const actionLabels = {
      collect: localeCopy.actions.collect,
      revert: localeCopy.actions.revert,
      copy: localeCopy.actions.copy,
      paste: localeCopy.actions.paste,
      undo: localeCopy.actions.undo,
      'preview-template': localeCopy.actions.previewTemplate,
      'apply-template': localeCopy.actions.applyTemplate,
      save: localeCopy.actions.save,
    } as const;
    Object.entries(actionLabels).forEach(([action, label]) => {
      const button = this.panel?.querySelector<HTMLButtonElement>(`[data-action="${action}"]`);
      if (button) button.textContent = label;
    });
    this.panel.querySelector<HTMLButtonElement>('[data-action="close"]')?.setAttribute('aria-label', localeCopy.actions.close);
    if (this.catalog) this.catalog.hidden = !model.editMode;
    const nav = this.panel.querySelector('.cutaway-dom-categories');
    if (nav) {
      nav.replaceChildren(...Object.entries(localeCopy.categories).map(([category, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.dataset.active = String(category === model.category);
        button.addEventListener('click', () => this.handlers?.category(category as ModernOfficeCategory));
        return button;
      }));
    }
    const page = this.panel.querySelector('.cutaway-dom-page span');
    if (page) page.textContent = `${model.page + 1} / ${model.totalPages}`;
    if (this.inspector) {
      this.inspector.hidden = !model.editMode || !model.selected;
      this.inspector.replaceChildren();
      if (model.selected) {
        const label = document.createElement('strong');
        const selectedLabel = this.locale !== 'zh-TW' && /[\u3400-\u9fff]/.test(model.selected.label)
          ? localeCopy.status.furniture : model.selected.label;
        label.textContent = model.selectedCount > 1
          ? `${model.selectedCount} ${localeCopy.status.selected} · ${localeCopy.status.batch}`
          : `${selectedLabel} · ${Math.round(model.selected.scale * 100)}% · ${model.selected.rotation}° · ${furnitureLayerLabel(this.locale, model.selected.layer)}`;
        const controls: Array<[string, () => void]> = [
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
        ];
        this.inspector.append(label, ...controls.map(([text, handler]) => {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.onclick = handler; return button;
        }));
      }
    }
    const collect = this.panel.querySelector<HTMLButtonElement>('[data-action="collect"]');
    const revert = this.panel.querySelector<HTMLButtonElement>('[data-action="revert"]');
    const copy = this.panel.querySelector<HTMLButtonElement>('[data-action="copy"]');
    const paste = this.panel.querySelector<HTMLButtonElement>('[data-action="paste"]');
    const save = this.panel.querySelector<HTMLButtonElement>('[data-action="save"]');
    const undo = this.panel.querySelector<HTMLButtonElement>('[data-action="undo"]');
    const previewTemplate = this.panel.querySelector<HTMLButtonElement>('[data-action="preview-template"]');
    const applyTemplate = this.panel.querySelector<HTMLButtonElement>('[data-action="apply-template"]');
    if (collect) collect.hidden = !model.editMode;
    if (revert) revert.hidden = !model.editMode;
    if (copy) copy.hidden = !model.editMode;
    if (paste) { paste.hidden = !model.editMode; paste.disabled = !model.clipboardAvailable; }
    if (save) save.disabled = model.saveBlocked;
    if (undo) { undo.hidden = !model.editMode; undo.disabled = !model.canUndo; }
    if (previewTemplate) previewTemplate.hidden = !model.editMode;
    if (applyTemplate) {
      applyTemplate.hidden = !model.editMode || !model.templatePreviewing;
      applyTemplate.disabled = !model.templateValid;
    }
    if (this.status && model.editMode) {
      const diagnostics = model.templateDiagnostics.map((id) => cutawayMessage(this.locale, id));
      const status = diagnostics.length > 0
        ? diagnostics.join(' · ')
        : renderCutawayMessageState(this.locale, model);
      this.status.textContent = `${status} · ${localeCopy.status.hook} ${model.requiredPlaced}/${model.requiredTotal} · ${localeCopy.status.prefab} ${model.prefabCount}`;
    }
  }

  relayout(layout: CutawayLayout): void {
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
      const anchor = item.kind === 'agent' ? 'translate(-50%, -100%)' : 'translate(-50%, 0)';
      label.style.transform = `translate3d(${Math.round(rect.left + item.x / WORLD_PIXELS.width * rect.width)}px, ${Math.round(rect.top + item.y / WORLD_PIXELS.height * rect.height)}px, 0) ${anchor}`;
      return label;
    }));
  }

  close(): void {
    this.panel?.remove();
    this.labelLayer?.remove();
    this.panel = undefined;
    this.labelLayer = undefined;
    this.handlers = undefined;
    this.roomLabels = [];
  }

  destroy(): void { this.close(); }

  private position(layout: CutawayLayout): void {
    const rect = this.canvasRect();
    if (!this.panel || !rect) return;
    this.panel.style.left = `${rect.left + layout.x / WORLD_PIXELS.width * rect.width}px`;
    this.panel.style.top = `${rect.top + layout.y / WORLD_PIXELS.height * rect.height}px`;
    this.panel.style.width = `${layout.width / WORLD_PIXELS.width * rect.width}px`;
    this.panel.style.height = `${layout.height / WORLD_PIXELS.height * rect.height}px`;
  }
}

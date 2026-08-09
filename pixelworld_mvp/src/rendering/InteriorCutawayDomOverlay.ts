import { WORLD_PIXELS } from '../game/constants';
import type { CutawayLayout } from './InteriorCutawaySystem';
import type { ModernOfficeCategory } from './modernOfficeCatalog';
import type { FurnitureLayer, FurnitureRotation } from '../world/types';

export interface CutawayDomModel {
  title: string;
  status: string;
  editMode: boolean;
  category: ModernOfficeCategory;
  page: number;
  totalPages: number;
  requiredPlaced: number;
  requiredTotal: number;
  prefabCount: number;
  clipboardAvailable: boolean;
  selectedCount: number;
  selected?: { label: string; scale: number; rotation: FurnitureRotation; layer: FurnitureLayer };
}

export interface CutawayDomHandlers {
  close(): void;
  toggleEdit(): void;
  save(): void;
  category(category: ModernOfficeCategory): void;
  page(delta: -1 | 1): void;
  resize(delta: -1 | 1): void;
  rotate(delta: -90 | 90): void;
  collect(): void;
  revert(): void;
  copy(): void;
  paste(): void;
  group(): void;
  shiftLayer(direction: 'previous' | 'next'): void;
  reorder(direction: 'back' | 'backward' | 'forward' | 'front'): void;
}

export interface CutawayRoomLabel { id: string; text: string; x: number; y: number; kind: 'hook' | 'agent' }

const CATEGORY_LABELS: Record<ModernOfficeCategory, string> = {
  surfaces: '地板／牆面',
  'seating-plants': '座椅／植栽',
  'screens-electronics': '螢幕／電子',
  'storage-partitions': '收納／隔間',
  workstations: '工作桌組',
};

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
          <button type="button" data-action="collect">全部收回</button>
          <button type="button" data-action="revert">取消配置</button>
          <button type="button" data-action="copy">複製格局</button>
          <button type="button" data-action="paste">貼上格局</button>
          <button type="button" data-action="save">儲存配置</button>
          <button type="button" data-action="close" aria-label="關閉室內">×</button>
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
    panel.querySelector('[data-action="prev"]')?.addEventListener('click', () => handlers.page(-1));
    panel.querySelector('[data-action="next"]')?.addEventListener('click', () => handlers.page(1));
    this.position(layout);
    this.update(model);
  }

  update(model: CutawayDomModel): void {
    if (!this.panel) return;
    if (this.title) this.title.textContent = model.title;
    if (this.status) this.status.textContent = model.status;
    if (this.editButton) this.editButton.textContent = model.editMode ? '完成移動' : '移動家具';
    if (this.catalog) this.catalog.hidden = !model.editMode;
    const nav = this.panel.querySelector('.cutaway-dom-categories');
    if (nav) {
      nav.replaceChildren(...Object.entries(CATEGORY_LABELS).map(([category, label]) => {
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
        label.textContent = `${model.selected.label} · ${Math.round(model.selected.scale * 100)}% · ${model.selected.rotation}° · ${model.selected.layer}`;
        const controls: Array<[string, () => void]> = [
          ['縮小', () => this.handlers?.resize(-1)], ['放大', () => this.handlers?.resize(1)],
          ['↶', () => this.handlers?.rotate(-90)], ['↷', () => this.handlers?.rotate(90)],
          ['下層', () => this.handlers?.shiftLayer('previous')], ['上層', () => this.handlers?.shiftLayer('next')],
          ['最下', () => this.handlers?.reorder('back')], ['下降', () => this.handlers?.reorder('backward')],
          ['上升', () => this.handlers?.reorder('forward')], ['最上', () => this.handlers?.reorder('front')],
        ];
        this.inspector.append(label, ...controls.map(([text, handler]) => {
          const button = document.createElement('button'); button.type = 'button'; button.textContent = text; button.onclick = handler; return button;
        }));
      }
      if (model.selectedCount >= 2) {
        const group = document.createElement('button');
        group.type = 'button';
        group.textContent = `建立組裝件 (${model.selectedCount})`;
        group.onclick = () => this.handlers?.group();
        this.inspector.append(group);
      }
    }
    const collect = this.panel.querySelector<HTMLButtonElement>('[data-action="collect"]');
    const revert = this.panel.querySelector<HTMLButtonElement>('[data-action="revert"]');
    const copy = this.panel.querySelector<HTMLButtonElement>('[data-action="copy"]');
    const paste = this.panel.querySelector<HTMLButtonElement>('[data-action="paste"]');
    if (collect) collect.hidden = !model.editMode;
    if (revert) revert.hidden = !model.editMode;
    if (copy) copy.hidden = !model.editMode;
    if (paste) { paste.hidden = !model.editMode; paste.disabled = !model.clipboardAvailable; }
    if (this.status && model.editMode) {
      this.status.textContent = `${model.status} · Hook ${model.requiredPlaced}/${model.requiredTotal} · 組裝件 ${model.prefabCount}`;
    }
  }

  setStatus(message: string): void { if (this.status) this.status.textContent = message; }

  setRoomLabels(labels: readonly CutawayRoomLabel[]): void {
    if (!this.labelLayer) return;
    const rect = this.canvasRect();
    if (!rect) return;
    this.labelLayer.replaceChildren(...labels.map((item) => {
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

import { describe, expect, it, vi } from 'vitest';
import {
  InteriorCutawayDomOverlay,
  type CutawayDomHandlers,
  type CutawayDomModel,
} from '../src/rendering/InteriorCutawayDomOverlay';
import { cutawayLayoutForViewport, editorLayoutForCutaway } from '../src/rendering/InteriorCutawaySystem';
import { contextActionCopy } from '../src/rendering/interiorLocale';

const model = (overrides: Partial<CutawayDomModel> = {}): CutawayDomModel => ({
  titleId: 'rest-cabin', title: 'Rest Cabin', statusId: 'ready', editMode: true,
  catalogExpanded: false, inspectorExpanded: false, guideMode: false,
  category: 'workstations', page: 0, totalPages: 1, requiredPlaced: 0, requiredTotal: 0,
  prefabCount: 0, clipboardAvailable: false, saveBlocked: false, selectedCount: 1,
  canDuplicate: true, canGroup: false, canDissolve: false, canUndo: true,
  templatePreviewing: false, templateValid: false, templateDiagnostics: [],
  selected: { label: 'Plant', scale: 1, rotation: 0, layer: 'furniture' },
  ...overrides,
}) as CutawayDomModel;

const harness = () => {
  const attributes = new Map<object, Map<string, string>>();
  let activeElement: ReturnType<typeof makeElement> | undefined;
  const makeElement = () => {
    const listeners = new Map<string, Array<(event?: Record<string, unknown>) => void>>();
    const element: {
      hidden: boolean; disabled: boolean; isConnected: boolean; type: string; textContent: string; className: string;
      innerHTML: string; dataset: Record<string, string>; style: Record<string, string>;
      children: Array<ReturnType<typeof makeElement>>; scrollHeight: number;
      onclick: (() => void) | undefined; addEventListener(name: string, handler: (event?: Record<string, unknown>) => void): void;
      emit(name: string, event?: Record<string, unknown>): void; click(): void; focus(): void;
      contains(candidate: unknown): boolean; querySelector(selector: string): ReturnType<typeof makeElement> | undefined;
      append(...children: Array<ReturnType<typeof makeElement>>): void;
      replaceChildren(...children: Array<ReturnType<typeof makeElement>>): void;
      setAttribute(name: string, value: string): void; getAttribute(name: string): string | null;
      getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number };
      remove(): void;
    } = {
      hidden: false, disabled: false, isConnected: true, type: '', textContent: '', className: '', innerHTML: '',
      dataset: {}, style: {}, children: [], scrollHeight: 116, onclick: undefined,
      addEventListener(name, handler) { listeners.set(name, [...(listeners.get(name) ?? []), handler]); },
      emit(name, event = {}) { for (const handler of listeners.get(name) ?? []) handler(event); },
      click() { if (!element.disabled) { element.emit('click'); element.onclick?.(); } },
      focus() { activeElement = element; },
      contains(candidate) { return candidate === element || element.children.some((child) => child.contains(candidate)); },
      querySelector(selector) {
        const action = selector.match(/\[data-context-action="([^"]+)"\]/)?.[1];
        return action ? element.children.find((child) => child.dataset.contextAction === action) : undefined;
      },
      append(...children) { children.forEach((child) => { child.isConnected = true; }); element.children.push(...children); },
      replaceChildren(...children) {
        element.children.forEach((child) => { child.isConnected = false; });
        children.forEach((child) => { child.isConnected = true; });
        element.children = children;
      },
      setAttribute(name, value) {
        const values = attributes.get(element) ?? new Map<string, string>();
        values.set(name, value); attributes.set(element, values);
      },
      getAttribute(name) { return attributes.get(element)?.get(name) ?? null; },
      getBoundingClientRect() { return { left: 0, top: 0, right: 180, bottom: 116, width: 180, height: 116 }; },
      remove: vi.fn(),
    };
    return element;
  };
  const actionNames = ['edit', 'catalog', 'inspector', 'guide', 'fit', 'collect', 'undo', 'save', 'close', 'prev', 'next'];
  const actions = new Map(actionNames.map((name) => [name, makeElement()]));
  const title = makeElement(); const status = makeElement(); const header = makeElement();
  const roomToolbar = makeElement(); const catalog = makeElement(); const inspector = makeElement();
  const contextMenu = makeElement(); const guide = makeElement(); const labels = makeElement();
  const categories = makeElement(); const page = makeElement();
  const panel = Object.assign(makeElement(), {
    getBoundingClientRect: () => ({ left: 0, top: 0, right: 720, bottom: 495, width: 720, height: 495 }),
    querySelector(selector: string) {
      const fixed = new Map<string, ReturnType<typeof makeElement>>([
        ['h2', title], ['.cutaway-dom-status', status], ['.cutaway-dom-header', header],
        ['.cutaway-room-toolbar', roomToolbar], ['.cutaway-dom-catalog', catalog],
        ['.cutaway-dom-inspector', inspector], ['.cutaway-context-menu', contextMenu],
        ['.cutaway-guide-popover', guide], ['.cutaway-room-labels', labels],
        ['.cutaway-dom-categories', categories], ['.cutaway-dom-page span', page],
      ]);
      const named = selector.match(/\[data-action="([^"]+)"\]/)?.[1];
      return fixed.get(selector) ?? (named ? actions.get(named) : undefined);
    },
  });
  const host = { append: vi.fn() };
  vi.stubGlobal('document', {
    querySelector: () => host,
    createElement: (tag: string) => tag === 'section' && !host.append.mock.calls.length ? panel : makeElement(),
    get activeElement() { return activeElement; },
  });
  const handlers = Object.fromEntries([
    'close', 'toggleEdit', 'toggleCatalog', 'toggleInspector', 'toggleGuide', 'fitView', 'save', 'undo',
    'previewTemplate', 'applyTemplate', 'category', 'page', 'resize', 'rotate', 'collect', 'revert',
    'copy', 'paste', 'group', 'dissolveGroup', 'shiftLayer', 'reorder', 'duplicate', 'returnToShelf',
    'cancelSelection', 'dismissContextMenu',
  ].map((name) => [name, vi.fn()])) as unknown as CutawayDomHandlers;
  return { overlay: new InteriorCutawayDomOverlay(() => ({ left: 0, top: 0, width: 768, height: 448 }) as DOMRect), handlers, panel, roomToolbar, inspector, contextMenu, actions, get activeElement() { return activeElement; } };
};

describe('InteriorCutawayDomOverlay context menu', () => {
  it('renders only Save, Undo, and Collect all in room chrome', () => {
    const dom = harness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      dom.overlay.open(layout, model({ editorLayout: editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      }) }), dom.handlers);
      const roomMarkup = dom.panel.innerHTML.match(/<nav class="cutaway-room-toolbar"[\s\S]*?<\/nav>/)?.[0] ?? '';
      expect([...roomMarkup.matchAll(/data-action="([^"]+)"/g)].map((match) => match[1]))
        .toEqual(['collect', 'undo', 'save']);
      expect(roomMarkup).not.toMatch(/layer|front|back|preview-template|apply-template|cancel/);
      expect(dom.roomToolbar.hidden).toBe(false);
      expect(dom.roomToolbar.getAttribute('aria-label')).toBe('房間編輯指令');
      expect(dom.handlers.previewTemplate).not.toHaveBeenCalled();
      expect(dom.handlers.applyTemplate).not.toHaveBeenCalled();
      expect(dom.handlers.shiftLayer).not.toHaveBeenCalled();
      expect(dom.handlers.reorder).not.toHaveBeenCalled();
      expect(dom.handlers.cancelSelection).not.toHaveBeenCalled();
    } finally {
      dom.overlay.destroy(); vi.unstubAllGlobals();
    }
  });

  it('renders a localized four-item menu with menu semantics and pointer-down feedback', () => {
    const dom = harness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      dom.overlay.setLocale('en-US');
      dom.overlay.open(layout, model({
        editorLayout,
        contextMenu: {
          pointer: { x: editorLayout.room.x + 12, y: editorLayout.room.y + 12 },
          selection: { itemIds: ['chair'], grouped: false },
        },
      }), dom.handlers);

      expect(dom.contextMenu.hidden).toBe(false);
      expect(dom.contextMenu.getAttribute('role')).toBe('menu');
      expect(dom.contextMenu.children.map(({ dataset }) => dataset.contextAction))
        .toEqual(['duplicate', 'rotate', 'resize', 'return']);
      expect(dom.contextMenu.children.every((button) => button.getAttribute('role') === 'menuitem')).toBe(true);
      expect(dom.contextMenu.children.map((button) => button.getAttribute('aria-label')))
        .toEqual(['Duplicate', 'Rotate', 'Resize', 'Return']);
      expect(dom.contextMenu.children.every(({ textContent }) => /\S+\s+\S+/.test(textContent))).toBe(true);

      const duplicate = dom.contextMenu.children[0]!;
      duplicate.emit('pointerdown');
      expect(duplicate.dataset.pressed).toBe('true');
      duplicate.emit('pointerup');
      expect(duplicate.dataset.pressed).toBeUndefined();
      duplicate.click();
      expect(dom.handlers.duplicate).toHaveBeenCalledOnce();
    } finally {
      dom.overlay.destroy(); vi.unstubAllGlobals();
    }
  });

  it('provides every context action label in all four locales', () => {
    expect(Object.keys(contextActionCopy)).toEqual(['zh-TW', 'en-US', 'ja-JP', 'ko-KR']);
    for (const copy of Object.values(contextActionCopy)) {
      expect(Object.keys(copy)).toEqual(['menu', 'duplicate', 'rotate', 'resize', 'return', 'group', 'dissolve']);
      expect(Object.values(copy).every(Boolean)).toBe(true);
    }
  });

  it('restores focus when the context menu closes', () => {
    const dom = harness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      dom.overlay.open(layout, model({ editorLayout }), dom.handlers);
      dom.actions.get('edit')!.focus();
      dom.overlay.update(model({
        editorLayout,
        contextMenu: {
          pointer: { x: editorLayout.room.x + 40, y: editorLayout.room.y + 40 },
          selection: { itemIds: ['chair'], grouped: false },
        },
      }));
      expect(dom.activeElement).toBe(dom.contextMenu.children[0]);

      dom.overlay.update(model({ editorLayout }));
      expect(dom.activeElement).toBe(dom.actions.get('edit'));
    } finally {
      dom.overlay.destroy(); vi.unstubAllGlobals();
    }
  });

  it('keeps the compact fixed inspector summary fully available without a scrolling drawer', () => {
    const dom = harness();
    try {
      const layout = cutawayLayoutForViewport(600, 320);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: true,
      });
      dom.overlay.setLocale('en-US');
      dom.overlay.open(layout, model({
        inspectorExpanded: true,
        editorLayout,
        selected: { label: 'Long selected furniture name', scale: 1.25, rotation: 90, layer: 'surface' },
      }), dom.handlers);

      expect(dom.inspector.hidden).toBe(false);
      expect(dom.inspector.dataset.placement).toBe('bottom');
      expect(dom.inspector.children).toHaveLength(1);
      const summary = dom.inspector.children[0]!;
      expect(summary.textContent).toContain('Long selected furniture name');
      expect(summary.getAttribute('aria-label')).toBe(summary.textContent);
      expect(summary.getAttribute('title')).toBe(summary.textContent);
    } finally {
      dom.overlay.destroy(); vi.unstubAllGlobals();
    }
  });
});

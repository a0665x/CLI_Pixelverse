import { describe, expect, it, vi } from 'vitest';
import {
  InteriorCutawaySystem,
  dragPreviewScreenPoint,
  cutawayLayoutForViewport,
  cutawayContainsPointer,
  editorLayoutForCutaway,
  furnitureRenderScreenPoint,
  furnitureRenderScreenGeometry,
  hookFurnitureLabel,
  interiorAgentRenderDepth,
  interiorFurnitureRenderDepth,
  prefabDisplayName,
  roomCellForLayout,
  roomOriginForLayout,
  roomPointForScreen,
  roomScreenPoint,
  roomViewportFrameForLayout,
  stableInteriorAgentIndex,
} from '../src/rendering/InteriorCutawaySystem';
import {
  InteriorCutawayDomOverlay,
  selectionCapabilities,
  type CutawayDomHandlers,
  type CutawayDomModel,
} from '../src/rendering/InteriorCutawayDomOverlay';
import type { InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
import { BUILT_IN_OFFICE_PREFABS } from '../src/rendering/builtInOfficePrefabs';
import type { InteriorDefinition } from '../src/world/types';
import { transformedAlphaBounds } from '../src/rendering/interiorPlacement';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';
import { agentSkinFor } from '../src/rendering/assetManifest';
import { interiorEditorLayout } from '../src/rendering/interiorEditorLayout';
import { WORLD_PIXELS } from '../src/game/constants';

class FakeObject {
  x = 0;
  y = 0;
  alpha = 1;
  visible = true;
  destroyed = false;
  interactive = false;
  text = '';
  texture = '';
  frame = 0;
  scale = 1;
  resolution = 1;
  tinted = false;
  tintColor: number | undefined;
  lineColor: number | undefined;
  strokeRects: Array<{ color: number | undefined; x: number; y: number; width: number; height: number }> = [];
  width = 0;
  height = 0;
  depth = 0;
  children: FakeObject[] = [];
  private readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  constructor(texture = '') { this.texture = texture; }
  setOrigin(): this { return this; }
  setDepth(depth: number): this { this.depth = depth; return this; }
  setScrollFactor(): this { return this; }
  setInteractive(): this { this.interactive = true; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  getLocalPoint(x: number, y: number): { x: number; y: number } {
    return { x: (x - this.x) / this.scale, y: (y - this.y) / this.scale };
  }
  setScale(scale: number): this { this.scale = scale; return this; }
  setMask(): this { return this; }
  createGeometryMask(): object { return {}; }
  setSize(width: number, height: number): this { this.width = width; this.height = height; return this; }
  setAngle(): this { return this; }
  setResolution(resolution: number): this { this.resolution = resolution; return this; }
  setTint(color?: number): this { this.tinted = true; this.tintColor = color; return this; }
  clearTint(): this { this.tinted = false; this.tintColor = undefined; return this; }
  setTexture(texture?: string, frame?: number): this {
    if (texture !== undefined) this.texture = texture;
    if (frame !== undefined) this.frame = frame;
    return this;
  }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setText(text: string): this { this.text = text; return this; }
  setStrokeStyle(): this { return this; }
  add(items: FakeObject | FakeObject[]): this { this.children.push(...(Array.isArray(items) ? items : [items])); return this; }
  bringToTop(child: FakeObject): this {
    const index = this.children.indexOf(child);
    if (index >= 0) this.children.splice(index, 1);
    this.children.push(child);
    return this;
  }
  removeAll(destroy = false): this { if (destroy) this.children.forEach((child) => child.destroy()); this.children = []; return this; }
  sort(property: keyof FakeObject): this {
    this.children.sort((first, second) => Number(first[property]) - Number(second[property]));
    return this;
  }
  fillStyle(): this { return this; }
  fillRect(): this { return this; }
  clear(): this { return this; }
  lineStyle(_width?: number, color?: number): this { this.lineColor = color; return this; }
  lineBetween(): this { return this; }
  strokeRect(x = 0, y = 0, width = 0, height = 0): this {
    this.strokeRects.push({ color: this.lineColor, x, y, width, height });
    return this;
  }
  on(event: string, handler: (...args: unknown[]) => void): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }
  emit(event: string, ...args: unknown[]): this {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
    return this;
  }
  off(): this { return this; }
  destroy(): void { this.destroyed = true; }
}

const fakeScene = () => {
  const objects: FakeObject[] = [];
  const inputHandlers = new Map<string, Array<(...args: unknown[]) => void>>();
  const make = (texture = '') => { const object = new FakeObject(texture); objects.push(object); return object; };
  return {
    objects,
    scene: {
      add: {
        container: vi.fn(() => make()), rectangle: vi.fn(() => make()), text: vi.fn((_x, _y, text: string) => { const object = make(); object.text = text; return object; }),
        image: vi.fn((_x, _y, texture: string, frame?: number) => { const object = make(texture); object.frame = frame ?? 0; return object; }), graphics: vi.fn(() => make()), zone: vi.fn(() => make()),
      },
      tweens: {
        add: vi.fn((config: { onComplete?: () => void }) => {
          config.onComplete?.();
          return { stop: vi.fn() };
        }),
        killTweensOf: vi.fn(),
      },
      input: {
        keyboard: { on: vi.fn(), off: vi.fn() }, setDraggable: vi.fn(),
        on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          inputHandlers.set(event, [...(inputHandlers.get(event) ?? []), handler]);
        }),
        off: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
          inputHandlers.set(event, (inputHandlers.get(event) ?? []).filter((candidate) => candidate !== handler));
        }),
      },
      time: { now: 0 },
      cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1 } },
    },
    emitInput: (event: string, ...args: unknown[]) => {
      for (const handler of inputHandlers.get(event) ?? []) handler(...args);
    },
  };
};

const idleInside: InteriorAgentSnapshot = {
  agentId: 'main', role: 'main', buildingId: 'rest-cabin', action: 'rest',
  eventKind: 'idle', eventId: 'idle-1',
};

const pointerAt = (x: number, y: number) => ({
  x, y, camera: {}, positionToCamera: () => ({ x, y }),
});

const viewportPointerAt = (x: number, y: number, button = 0) => ({
  ...pointerAt(x, y), button, event: { preventDefault: vi.fn() },
});

const captureCutawayHandlers = (cutaway: InteriorCutawaySystem) => {
  let handlers: CutawayDomHandlers | undefined;
  let model: CutawayDomModel | undefined;
  const overlay = {
    open: vi.fn((_layout, nextModel: CutawayDomModel, nextHandlers: CutawayDomHandlers) => {
      model = nextModel;
      handlers = nextHandlers;
    }),
    update: vi.fn((nextModel: CutawayDomModel) => { model = nextModel; }),
    setLocale: vi.fn(), setRoomLabels: vi.fn(), relayout: vi.fn(), close: vi.fn(), destroy: vi.fn(),
  };
  Object.assign(cutaway, { domOverlay: overlay });
  return {
    overlay,
    handlers: () => handlers!,
    model: () => model!,
  };
};

const cutawayDomModel = (overrides: Partial<CutawayDomModel> = {}): CutawayDomModel => ({
  titleId: 'rest-cabin', title: 'Rest Cabin', statusId: 'ready', editMode: false,
  catalogExpanded: false, inspectorExpanded: false, guideMode: false,
  category: 'workstations', page: 0, totalPages: 1, requiredPlaced: 0, requiredTotal: 0,
  prefabCount: 0, clipboardAvailable: false, saveBlocked: false, selectedCount: 0,
  canDuplicate: false, canGroup: false, canDissolve: false, canUndo: false,
  templatePreviewing: false, templateValid: false, templateDiagnostics: [],
  ...overrides,
}) as CutawayDomModel;

const selectedFurniture = (): NonNullable<CutawayDomModel['selected']> => ({
  label: 'Plant', scale: 1, rotation: 0, layer: 'furniture',
});

const overlayDomHarness = () => {
  const attributes = new Map<object, Map<string, string>>();
  let activeElement: ReturnType<typeof element> | undefined;
  const element = () => {
    const listeners = new Map<string, Array<(event?: Record<string, unknown>) => void>>();
    const target: {
      hidden: boolean; disabled: boolean; textContent: string; className: string;
      dataset: Record<string, string>; style: Record<string, string>; children: Array<ReturnType<typeof element>>;
      scrollHeight: number; onclick: (() => void) | undefined;
      addEventListener(event: string, handler: (event?: Record<string, unknown>) => void): void;
      click(): void; focus(): void; emitEvent(event: string, value?: Record<string, unknown>): void;
      contains(candidate: unknown): boolean; querySelector(selector: string): ReturnType<typeof element> | undefined;
      getBoundingClientRect(): { left: number; top: number; right: number; bottom: number; width: number; height: number };
      remove(): void; append(...children: Array<ReturnType<typeof element>>): void;
      replaceChildren(...children: Array<ReturnType<typeof element>>): void;
      setAttribute(name: string, value: string): void; getAttribute(name: string): string | null;
    } = {
      hidden: false, disabled: false, textContent: '', className: '', dataset: {} as Record<string, string>,
      style: {} as Record<string, string>, children: [],
      scrollHeight: 240,
      onclick: undefined,
      addEventListener: vi.fn((event: string, handler: (event?: Record<string, unknown>) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      }),
      click() {
        if (target.disabled) return;
        for (const handler of listeners.get('click') ?? []) handler({});
        target.onclick?.();
      },
      focus() { activeElement = target; },
      emitEvent(event: string, value: Record<string, unknown> = {}) {
        if (event === 'mouseenter') target.dataset.testHovered = 'true';
        if (event === 'mouseleave') delete target.dataset.testHovered;
        for (const handler of listeners.get(event) ?? []) handler(value);
      },
      contains(candidate: unknown): boolean {
        return candidate === target || target.children.some((child) => child.contains(candidate));
      },
      querySelector(selector: string) {
        const contextAction = selector.match(/\[data-context-action="([^"]+)"\]/)?.[1];
        if (contextAction) {
          return target.children.find(({ dataset }) => dataset.contextAction === contextAction);
        }
        return undefined;
      },
      getBoundingClientRect() {
        const expanded = target.dataset.expanded === 'true'
          || target.dataset.measureExpanded === 'true'
          || target.dataset.testHovered === 'true'
          || activeElement === target;
        const isLabel = target.className.includes('cutaway-room-label');
        const width = isLabel ? (expanded ? 180 : 26) : 0;
        const height = isLabel ? (expanded ? (target.className.includes('--agent') ? 44 : 34) : 18) : 0;
        const match = target.style.transform?.match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/);
        const anchorX = Number(match?.[1] ?? 0);
        const anchorY = Number(match?.[2] ?? 0);
        const left = isLabel ? anchorX - width / 2 : anchorX;
        const top = isLabel && target.className.includes('--agent') ? anchorY - height : anchorY;
        return { left, top, right: left + width, bottom: top + height, width, height };
      },
      remove: vi.fn(),
      append(...children) { target.children.push(...children); },
      replaceChildren(...children) { target.children = children; },
      setAttribute(name: string, value: string) {
        const values = attributes.get(target) ?? new Map<string, string>();
        values.set(name, value); attributes.set(target, values);
      },
      getAttribute(name: string) { return attributes.get(target)?.get(name) ?? null; },
    };
    return target;
  };
  const actions = new Map([
    'edit', 'catalog', 'inspector', 'guide', 'fit', 'collect', 'revert', 'copy', 'paste', 'undo',
    'preview-template', 'apply-template', 'save', 'close', 'prev', 'next',
  ].map((name) => [name, element()]));
  const title = element(); const status = element(); const catalog = element(); const inspector = element();
  const header = element(); const roomToolbar = element(); const toolbar = element(); const guide = element();
  const nav = element(); const page = element(); const labelLayer = element();
  const panel = Object.assign(element(), {
    innerHTML: '',
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 495 }),
    querySelector(selector: string) {
      if (selector === 'h2') return title;
      if (selector === '.cutaway-dom-status') return status;
      if (selector === '.cutaway-dom-header') return header;
      if (selector === '.cutaway-room-toolbar') return roomToolbar;
      if (selector === '.cutaway-dom-catalog') return catalog;
      if (selector === '.cutaway-dom-inspector') return inspector;
      if (selector === '.cutaway-context-toolbar') return toolbar;
      if (selector === '.cutaway-guide-popover') return guide;
      if (selector === '.cutaway-room-labels') return labelLayer;
      if (selector === '.cutaway-dom-categories') return nav;
      if (selector === '.cutaway-dom-page span') return page;
      const action = selector.match(/\[data-action="([^"]+)"\]/)?.[1];
      return action ? actions.get(action) : undefined;
    },
  });
  const host = { append: vi.fn() };
  const documentStub = {
    querySelector: () => host,
    createElement: (tag: string) => tag === 'section' && !host.append.mock.calls.length ? panel : element(),
    get activeElement() { return activeElement; },
  };
  vi.stubGlobal('document', documentStub);
  const overlay = new InteriorCutawayDomOverlay(() => ({ left: 0, top: 0, width: 768, height: 448 }) as DOMRect);
  const handlers = Object.fromEntries([
    'close', 'toggleEdit', 'toggleCatalog', 'toggleInspector', 'toggleGuide', 'fitView', 'save', 'undo',
    'previewTemplate', 'applyTemplate', 'category', 'page', 'resize', 'rotate', 'collect', 'revert',
    'copy', 'paste', 'group', 'dissolveGroup', 'shiftLayer', 'reorder', 'duplicate', 'returnToShelf',
    'cancelSelection',
  ].map((name) => [name, vi.fn()])) as unknown as CutawayDomHandlers;
  return {
    overlay, handlers, panel, header, roomToolbar, catalog, inspector, toolbar, guide, labelLayer,
    actions, documentStub,
  };
};

describe('InteriorCutawaySystem', () => {
  it('keeps room content clear until contextual drawers are requested', () => {
    const { overlay, handlers, panel, catalog, inspector } = overlayDomHarness();
    try {
      overlay.open(cutawayLayoutForViewport(1_280, 720), cutawayDomModel({ editMode: true }), handlers);
      expect(catalog.hidden).toBe(true);
      expect(inspector.hidden).toBe(true);
      expect(panel.innerHTML).toContain('class="cutaway-dom-header"');
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('opens Properties by clicking the selected collapsed wide-layout control', () => {
    const { overlay, handlers, actions, inspector } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      const collapsedLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      let model = cutawayDomModel({
        editMode: true, selected: selectedFurniture(), editorLayout: collapsedLayout,
      });
      handlers.toggleInspector = vi.fn(() => {
        model = {
          ...model,
          inspectorExpanded: true,
          editorLayout: editorLayoutForCutaway(layout, {
            editMode: true, catalogExpanded: false, inspectorExpanded: true,
          }),
        };
        overlay.update(model);
      });

      overlay.open(layout, model, handlers);
      const properties = actions.get('inspector')!;
      expect(collapsedLayout.inspector.width).toBe(0);
      expect(properties.disabled).toBe(false);
      properties.click();
      expect(handlers.toggleInspector).toHaveBeenCalledOnce();
      expect(inspector.hidden).toBe(false);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('opens Properties as a reserved compact bottom sheet', () => {
    const { overlay, handlers, actions, inspector } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(600, 320);
      const collapsedLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      let model = cutawayDomModel({
        editMode: true, selected: selectedFurniture(), editorLayout: collapsedLayout,
      });
      handlers.toggleInspector = vi.fn(() => {
        model = {
          ...model,
          inspectorExpanded: true,
          editorLayout: editorLayoutForCutaway(layout, {
            editMode: true, catalogExpanded: false, inspectorExpanded: true,
          }),
        };
        overlay.update(model);
      });
      overlay.open(layout, model, handlers);

      const properties = actions.get('inspector')!;
      expect(properties.disabled).toBe(false);
      properties.click();
      expect(handlers.toggleInspector).toHaveBeenCalledOnce();
      expect(inspector.hidden).toBe(false);
      expect(inspector.dataset.placement).toBe('bottom');
      expect(inspector.style.width).toBe('100%');
      expect(inspector.style.height).not.toBe('0%');
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('exposes every icon action through an accessible tooltip', () => {
    const { overlay, handlers, actions } = overlayDomHarness();
    try {
      overlay.open(cutawayLayoutForViewport(1_280, 720), cutawayDomModel({
        editMode: true, selected: selectedFurniture(),
      }), handlers);
      const buttons = [...actions.values()].filter((button) => Boolean(button.getAttribute('data-tooltip')));
      expect(buttons.length).toBeGreaterThan(0);
      expect(buttons.every((button) => Boolean(button.getAttribute('aria-label')))).toBe(true);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('matches responsive DOM regions to the reserved editor geometry', () => {
    const { overlay, handlers, header, catalog, inspector } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(600, 320);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: true, inspectorExpanded: true,
      });
      overlay.open(layout, cutawayDomModel({
        editMode: true, catalogExpanded: true, inspectorExpanded: true,
        selected: selectedFurniture(), editorLayout,
      }), handlers);
      expect(header.style.height).toBe(`${editorLayout.header.height / layout.height * 100}%`);
      expect(catalog.style.height).toBe('0%');
      expect(inspector.style.width).toBe('100%');
      expect(inspector.style.height).toBe(`${editorLayout.inspector.height / layout.height * 100}%`);
      expect(inspector.hidden).toBe(false);
      expect(inspector.dataset.placement).toBe('bottom');
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('keeps room-level commands reachable after Collect empties the room and explicitly saves that empty layout', () => {
    const dom = overlayDomHarness();
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => { values.set(key, value); }),
    };
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn() });
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(
        fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }),
      );
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');
      capture.handlers().toggleEdit();
      const layout = cutawayLayoutForViewport(1_280, 720);
      dom.overlay.open(layout, capture.model(), capture.handlers());

      expect(dom.panel.innerHTML).toContain('class="cutaway-room-toolbar"');
      expect(dom.roomToolbar.hidden).toBe(false);
      dom.actions.get('collect')!.click();
      dom.overlay.update(capture.model());

      const internal = cutaway as unknown as { activeInterior: InteriorDefinition };
      expect(internal.activeInterior.furniture).toEqual([]);
      expect(capture.model().selected).toBeUndefined();
      expect(dom.roomToolbar.hidden).toBe(false);
      expect(dom.actions.get('save')!.hidden).toBe(false);

      dom.actions.get('save')!.click();
      const persisted = JSON.parse(values.get('pixelworld:interior-layout:rest-cabin') ?? 'null');
      expect(persisted).toMatchObject({ version: 5, furniture: [] });

      cutaway.close();
      cutaway.open('rest-cabin');
      expect((cutaway as unknown as { activeInterior: InteriorDefinition }).activeInterior.furniture).toEqual([]);
    } finally {
      dom.overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('keeps room commands in reserved chrome above furniture content', () => {
    const { overlay, handlers, roomToolbar } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      overlay.open(layout, cutawayDomModel({ editMode: true, editorLayout }), handlers);
      const toolbarTop = Number.parseFloat(roomToolbar.style.top ?? 'NaN');
      const toolbarHeight = Number.parseFloat(roomToolbar.style.height ?? 'NaN');
      const roomTop = (editorLayout.room.y - layout.y) / layout.height * 100;
      expect(toolbarTop).toBeGreaterThanOrEqual(0);
      expect(toolbarTop + toolbarHeight).toBeLessThanOrEqual(roomTop + Number.EPSILON * 100);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('restores contextual-toolbar focus by stable action identity after rerendering', () => {
    const { overlay, handlers, toolbar, documentStub } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      let model = cutawayDomModel({
        editMode: true, selected: selectedFurniture(), selectedCount: 1,
        editorLayout: editorLayoutForCutaway(layout, {
          editMode: true, catalogExpanded: false, inspectorExpanded: false,
        }),
        selectionBounds: { x: layout.x + 220, y: layout.y + 180, width: 32, height: 32 },
      });
      handlers.rotate = vi.fn(() => {
        model = { ...model, selected: { ...model.selected!, rotation: 90 } };
        overlay.update(model);
      });
      overlay.open(layout, model, handlers);
      const rotateRight = toolbar.children.find(({ dataset }) => dataset.contextAction === 'rotate-right');
      expect(rotateRight).toBeDefined();
      rotateRight!.focus();
      rotateRight!.click();
      expect(handlers.rotate).toHaveBeenCalledWith(90);
      expect(documentStub.activeElement?.dataset.contextAction).toBe('rotate-right');
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('moves focus to the Edit trigger when a contextual action disappears after rerendering', () => {
    const { overlay, handlers, toolbar, actions, documentStub } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      let model = cutawayDomModel({
        editMode: true, selected: selectedFurniture(), selectedCount: 2, canGroup: true,
        editorLayout: editorLayoutForCutaway(layout, {
          editMode: true, catalogExpanded: false, inspectorExpanded: false,
        }),
        selectionBounds: { x: layout.x + 220, y: layout.y + 180, width: 64, height: 32 },
      });
      handlers.group = vi.fn(() => {
        const { selected: _selected, ...withoutSelection } = model;
        model = { ...withoutSelection, selectedCount: 0, canGroup: false };
        overlay.update(model);
      });
      overlay.open(layout, model, handlers);
      const group = toolbar.children.find(({ dataset }) => dataset.contextAction === 'group');
      expect(group).toBeDefined();
      group!.focus();
      group!.click();
      expect(handlers.group).toHaveBeenCalledOnce();
      expect(documentStub.activeElement).toBe(actions.get('edit'));
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('gives the interior guide a complete focus, ARIA, dismiss, and Escape lifecycle', () => {
    const { overlay, handlers, panel, guide, actions, documentStub } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      let model = cutawayDomModel({ editMode: true, guideMode: false });
      handlers.toggleGuide = vi.fn(() => {
        model = { ...model, guideMode: !model.guideMode };
        overlay.update(model);
      });
      overlay.open(layout, model, handlers);
      const help = actions.get('guide')!;
      expect(help.getAttribute('aria-controls')).toBe('cutaway-guide-popover');
      expect(help.getAttribute('aria-expanded')).toBe('false');
      expect(guide.getAttribute('aria-label')).toBe(help.getAttribute('aria-label'));

      help.click();
      expect(help.getAttribute('aria-expanded')).toBe('true');
      expect(guide.hidden).toBe(false);
      expect(documentStub.activeElement).toBe(guide.children[1]);

      const preventDefault = vi.fn();
      panel.emitEvent('keydown', { key: 'Escape', preventDefault, stopPropagation: vi.fn() });
      expect(preventDefault).toHaveBeenCalledOnce();
      expect(guide.hidden).toBe(true);
      expect(help.getAttribute('aria-expanded')).toBe('false');
      expect(documentStub.activeElement).toBe(help);

      help.click();
      guide.children[1]!.click();
      expect(guide.hidden).toBe(true);
      expect(documentStub.activeElement).toBe(help);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('clips and clamps Hook and agent labels to the transformed room away from selection', () => {
    const { overlay, handlers, labelLayer } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      const selectionBounds = {
        x: editorLayout.room.x + 4, y: editorLayout.room.y + 4, width: 84, height: 54,
      };
      overlay.open(layout, cutawayDomModel({
        editMode: true, selected: selectedFurniture(), selectedCount: 1,
        editorLayout, selectionBounds,
      }), handlers);
      overlay.setRoomLabels([
        { id: 'hook:edge', text: 'Hook', x: editorLayout.room.x - 500, y: editorLayout.room.y - 500, kind: 'hook' },
        { id: 'agent:selected', text: 'Agent', x: selectionBounds.x + 20, y: selectionBounds.y + 20, kind: 'agent' },
      ]);

      expect(labelLayer.dataset.region).toBe('room');
      expect(labelLayer.style.overflow).toBe('visible');
      const maximumX = editorLayout.room.width / WORLD_PIXELS.width * 768;
      const maximumY = editorLayout.room.height / WORLD_PIXELS.height * 448;
      const positions = labelLayer.children.map(({ style }) => {
        const match = (style.transform ?? '').match(/translate3d\((-?[\d.]+)px, (-?[\d.]+)px/);
        return { x: Number(match?.[1]), y: Number(match?.[2]) };
      });
      expect(positions.every(({ x, y }) => x >= 0 && x <= maximumX && y >= 0 && y <= maximumY)).toBe(true);
      const selectionTop = (selectionBounds.y - editorLayout.room.y) / WORLD_PIXELS.height * 448;
      const selectionBottom = (selectionBounds.y + selectionBounds.height - editorLayout.room.y) / WORLD_PIXELS.height * 448;
      expect(positions[1]!.y < selectionTop || positions[1]!.y > selectionBottom).toBe(true);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('contains the full expanded label boxes at every room edge after 1.5x zoom and pan', () => {
    const { overlay, handlers, labelLayer } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      const selectionBounds = {
        x: editorLayout.room.x + editorLayout.room.width / 2 - 50,
        y: editorLayout.room.y + editorLayout.room.height / 2 - 36,
        width: 100,
        height: 72,
      };
      overlay.open(layout, cutawayDomModel({
        editMode: true, selected: selectedFurniture(), selectedCount: 1, guideMode: true,
        editorLayout, selectionBounds,
      }), handlers);
      const zoomPan = (x: number, y: number) => ({
        x: editorLayout.room.x + (x - editorLayout.room.x) * 1.5 - 37,
        y: editorLayout.room.y + (y - editorLayout.room.y) * 1.5 + 29,
      });
      const leftTop = zoomPan(editorLayout.room.x - 80, editorLayout.room.y - 60);
      const rightBottom = zoomPan(
        editorLayout.room.x + editorLayout.room.width + 80,
        editorLayout.room.y + editorLayout.room.height + 60,
      );
      const selected = zoomPan(selectionBounds.x + 10, selectionBounds.y + 10);
      overlay.setRoomLabels([
        { id: 'hook:left-top', text: 'Expanded Hook label at the left and top edge', ...leftTop, kind: 'hook' },
        { id: 'hook:right-bottom', text: 'Expanded Hook label at the right and bottom edge', ...rightBottom, kind: 'hook' },
        { id: 'agent:left-top', text: 'Expanded agent label at the left and top edge', ...leftTop, kind: 'agent' },
        { id: 'agent:right-bottom', text: 'Expanded agent label at the right and bottom edge', ...rightBottom, kind: 'agent' },
        { id: 'agent:selection', text: 'Expanded agent label avoiding selected furniture', ...selected, kind: 'agent' },
      ]);

      const roomCss = {
        left: 0,
        top: 0,
        right: editorLayout.room.width / WORLD_PIXELS.width * 768,
        bottom: editorLayout.room.height / WORLD_PIXELS.height * 448,
      };
      const selectionCss = {
        left: (selectionBounds.x - editorLayout.room.x) / WORLD_PIXELS.width * 768,
        top: (selectionBounds.y - editorLayout.room.y) / WORLD_PIXELS.height * 448,
        right: (selectionBounds.x + selectionBounds.width - editorLayout.room.x) / WORLD_PIXELS.width * 768,
        bottom: (selectionBounds.y + selectionBounds.height - editorLayout.room.y) / WORLD_PIXELS.height * 448,
      };
      const intersects = (
        first: { left: number; top: number; right: number; bottom: number },
        second: { left: number; top: number; right: number; bottom: number },
      ) => first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top;
      const rects = labelLayer.children.map((label) => label.getBoundingClientRect());
      expect(labelLayer.style.overflow).toBe('visible');
      expect(labelLayer.children.every(({ dataset }) => dataset.expanded === 'true')).toBe(true);
      expect(rects.every((rect) => rect.left >= roomCss.left && rect.right <= roomCss.right
        && rect.top >= roomCss.top && rect.bottom <= roomCss.bottom)).toBe(true);
      expect(intersects(rects[4]!, selectionCss)).toBe(false);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('keeps edge labels compact while reserving their full hover and keyboard-focus boxes', () => {
    const { overlay, handlers, labelLayer } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: true, inspectorExpanded: true,
      });
      const selectionBounds = {
        x: editorLayout.room.x + editorLayout.room.width / 2 - 42,
        y: editorLayout.room.y + editorLayout.room.height / 2 - 28,
        width: 84,
        height: 56,
      };
      overlay.open(layout, cutawayDomModel({
        editMode: true, selected: selectedFurniture(), selectedCount: 1,
        guideMode: false, editorLayout, selectionBounds,
      }), handlers);
      const roomLabels = [
        { id: 'hook:left', text: 'Expanded Hook at the left edge', x: editorLayout.room.x - 90, y: editorLayout.room.y + 8, kind: 'hook' },
        { id: 'hook:right', text: 'Expanded Hook at the right edge', x: editorLayout.room.x + editorLayout.room.width + 90, y: editorLayout.room.y + editorLayout.room.height - 8, kind: 'hook' },
        { id: 'agent:top', text: 'Expanded agent at the top edge', x: editorLayout.room.x + 8, y: editorLayout.room.y - 80, kind: 'agent' },
        { id: 'agent:bottom', text: 'Expanded agent at the bottom edge', x: editorLayout.room.x + editorLayout.room.width - 8, y: editorLayout.room.y + editorLayout.room.height + 80, kind: 'agent' },
        { id: 'agent:selected', text: 'Expanded agent avoiding selection', x: selectionBounds.x + 12, y: selectionBounds.y + 12, kind: 'agent' },
      ] as const;
      overlay.setRoomLabels(roomLabels);

      const roomCss = {
        left: 0, top: 0,
        right: editorLayout.room.width / WORLD_PIXELS.width * 768,
        bottom: editorLayout.room.height / WORLD_PIXELS.height * 448,
      };
      const selectionCss = {
        left: (selectionBounds.x - editorLayout.room.x) / WORLD_PIXELS.width * 768,
        top: (selectionBounds.y - editorLayout.room.y) / WORLD_PIXELS.height * 448,
        right: (selectionBounds.x + selectionBounds.width - editorLayout.room.x) / WORLD_PIXELS.width * 768,
        bottom: (selectionBounds.y + selectionBounds.height - editorLayout.room.y) / WORLD_PIXELS.height * 448,
      };
      const inside = (rect: { left: number; top: number; right: number; bottom: number }) => (
        rect.left >= roomCss.left && rect.right <= roomCss.right
        && rect.top >= roomCss.top && rect.bottom <= roomCss.bottom
      );
      const intersects = (
        first: { left: number; top: number; right: number; bottom: number },
        second: { left: number; top: number; right: number; bottom: number },
      ) => first.left < second.right && first.right > second.left
        && first.top < second.bottom && first.bottom > second.top;

      for (const label of labelLayer.children) {
        expect(label.dataset.expanded).toBe('false');
        expect(label.dataset.measureExpanded).toBeUndefined();
        expect(label.style.maxWidth).toBeUndefined();
        expect(label.getBoundingClientRect().width).toBe(26);
        expect(inside(label.getBoundingClientRect())).toBe(true);
        label.focus();
        expect(label.getBoundingClientRect().width).toBe(180);
        expect(inside(label.getBoundingClientRect())).toBe(true);
        label.emitEvent('mouseenter');
        expect(inside(label.getBoundingClientRect())).toBe(true);
        label.emitEvent('mouseleave');
      }
      expect(intersects(labelLayer.children[4]!.getBoundingClientRect(), selectionCss)).toBe(false);

      overlay.setRoomLabels(roomLabels.map((label, index) => ({ ...label, selected: index === 0 })));
      expect(labelLayer.children[0]!.dataset.expanded).toBe('true');
      expect(labelLayer.children[0]!.getBoundingClientRect().width).toBe(180);
      expect(inside(labelLayer.children[0]!.getBoundingClientRect())).toBe(true);

      overlay.update(cutawayDomModel({
        editMode: true, selected: selectedFurniture(), selectedCount: 1,
        guideMode: true, editorLayout, selectionBounds,
      }));
      overlay.setRoomLabels(roomLabels);
      expect(labelLayer.children.every(({ dataset }) => dataset.expanded === 'true')).toBe(true);
      expect(labelLayer.children.every((label) => inside(label.getBoundingClientRect()))).toBe(true);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('localizes pagination and rotation glyphs for assistive technology', () => {
    const { overlay, handlers, actions, toolbar } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(1_280, 720);
      overlay.setLocale('en-US');
      overlay.open(layout, cutawayDomModel({
        editMode: true, selected: selectedFurniture(), selectedCount: 1,
        editorLayout: editorLayoutForCutaway(layout, {
          editMode: true, catalogExpanded: false, inspectorExpanded: false,
        }),
        selectionBounds: { x: layout.x + 200, y: layout.y + 160, width: 32, height: 32 },
      }), handlers);
      expect(actions.get('prev')?.getAttribute('aria-label')).toBe('Previous page');
      expect(actions.get('prev')?.getAttribute('data-tooltip')).toBe('Previous page');
      expect(actions.get('next')?.getAttribute('aria-label')).toBe('Next page');
      const rotations = (toolbar.children as Array<ReturnType<typeof actions.get>>)
        .filter((button) => button?.textContent === '↶' || button?.textContent === '↷');
      expect(rotations.map((button) => button?.getAttribute('aria-label'))).toEqual(['Rotate left', 'Rotate right']);
      expect(rotations.every((button) => Boolean(button?.getAttribute('data-tooltip')))).toBe(true);
      const room = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      }).room;
      const toolbarTop = Number.parseFloat(toolbar.style.top ?? '');
      const toolbarHeight = Number.parseFloat(toolbar.style.height ?? '');
      const roomTop = (room.y - layout.y) / layout.height * 100;
      const roomBottom = (room.y + room.height - layout.y) / layout.height * 100;
      expect(toolbar.style.overflowY).toBe('auto');
      expect(toolbarTop).toBeGreaterThanOrEqual(roomTop);
      expect(toolbarTop + toolbarHeight).toBeLessThanOrEqual(roomBottom);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('exposes contextual operations from the exact selection shape', () => {
    const ordinary = {
      id: 'ordinary', kind: 'decor' as const, point: { x: 1, y: 1 }, facing: 'up' as const,
      icon: 'generic' as const, supportedActions: [],
    };
    const hook = { ...ordinary, id: 'hook', supportedActions: ['terminal' as const], requirementId: 'maker:hook' };
    expect(selectionCapabilities([ordinary])).toEqual({ canDuplicate: true, canGroup: false });
    expect(selectionCapabilities([ordinary, { ...ordinary, id: 'second' }])).toEqual({ canDuplicate: false, canGroup: true });
    expect(selectionCapabilities([ordinary, hook])).toEqual({ canDuplicate: false, canGroup: false });
  });

  it('resets room disclosure and does not open properties when furniture is selected', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    expect(capture.model()).toMatchObject({ catalogExpanded: false, inspectorExpanded: false });

    capture.handlers().toggleEdit();
    capture.handlers().toggleCatalog();
    expect(capture.model()).toMatchObject({ catalogExpanded: true, inspectorExpanded: false });

    const selectedBeforeClose = fake.objects.find(({ interactive, destroyed, depth }) => interactive && !destroyed && depth > 0);
    selectedBeforeClose?.emit('pointerdown', pointerAt(0, 0));
    expect(capture.model().selected).toBeDefined();
    expect(capture.model().inspectorExpanded).toBe(false);
    capture.handlers().toggleInspector();
    expect(capture.model().inspectorExpanded).toBe(true);

    cutaway.close();
    cutaway.open('rest-cabin');
    expect(capture.model()).toMatchObject({ catalogExpanded: false, inspectorExpanded: false });
    capture.handlers().toggleEdit();
    const selected = fake.objects.find(({ interactive, destroyed, depth }) => interactive && !destroyed && depth > 0);
    selected?.emit('pointerdown', pointerAt(0, 0));
    expect(capture.model().selected).toBeDefined();
    expect(capture.model().inspectorExpanded).toBe(false);
  });

  it('persists only guide dismissal and fits the room without saving furniture', () => {
    const storage = { getItem: vi.fn((_: string): string | null => null), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn() });
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');
      expect(capture.model().guideMode).toBe(true);

      const internal = cutaway as unknown as { interiorViewport: { zoom: number; panX: number; panY: number } };
      internal.interiorViewport = { ...internal.interiorViewport, zoom: 2, panX: 40, panY: -20 };
      capture.handlers().fitView();
      expect(internal.interiorViewport).toMatchObject({ zoom: 1, panX: 0, panY: 0 });
      expect(storage.setItem).not.toHaveBeenCalled();

      capture.handlers().toggleGuide();
      expect(storage.setItem).toHaveBeenCalledOnce();
      expect(storage.setItem).toHaveBeenCalledWith('pixelworld:guide-dismissed:v1', 'true');
      storage.getItem.mockImplementation((key: string) => key === 'pixelworld:guide-dismissed:v1' ? 'true' : null);
      cutaway.close();
      cutaway.open('rest-cabin');
      expect(capture.model()).toMatchObject({ catalogExpanded: false, inspectorExpanded: false, guideMode: false });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('immediately reflows existing compact labels when Help opens and dismisses', () => {
    const storage = {
      getItem: vi.fn((key: string): string | null => key === 'pixelworld:guide-dismissed:v1' ? 'true' : null),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn() });
    const { overlay, actions, guide, labelLayer } = overlayDomHarness();
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(
        fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }),
      );
      Object.assign(cutaway, { domOverlay: overlay });
      cutaway.open('rest-cabin');
      cutaway.update([idleInside]);

      expect(labelLayer.children.length).toBeGreaterThan(0);
      expect(labelLayer.children.every((label) => label.dataset.expanded === 'false')).toBe(true);
      expect(labelLayer.children.every((label) => label.style.maxWidth === undefined)).toBe(true);
      expect(labelLayer.children.every((label) => label.getBoundingClientRect().width === 26)).toBe(true);

      actions.get('guide')!.click();
      expect(labelLayer.children.every((label) => label.dataset.expanded === 'true')).toBe(true);
      expect(labelLayer.children.every((label) => label.getBoundingClientRect().width === 180)).toBe(true);
      const layout = cutawayLayoutForViewport(1_280, 720);
      const room = editorLayoutForCutaway(layout, {
        editMode: false, catalogExpanded: false, inspectorExpanded: false,
      }).room;
      const roomCss = {
        left: 0, top: 0,
        right: room.width / WORLD_PIXELS.width * 768,
        bottom: room.height / WORLD_PIXELS.height * 448,
      };
      expect(labelLayer.children.every((label) => {
        const rect = label.getBoundingClientRect();
        return rect.left >= roomCss.left && rect.right <= roomCss.right
          && rect.top >= roomCss.top && rect.bottom <= roomCss.bottom;
      })).toBe(true);

      guide.children[1]!.click();
      expect(labelLayer.children.every((label) => label.dataset.expanded === 'false')).toBe(true);
      expect(labelLayer.children.every((label) => label.getBoundingClientRect().width === 26)).toBe(true);
      expect(storage.setItem).toHaveBeenCalledWith('pixelworld:guide-dismissed:v1', 'true');
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('compacts existing expanded labels on the first-use guide dismissal', () => {
    const storage = { getItem: vi.fn((): string | null => null), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn() });
    const { overlay, guide, labelLayer } = overlayDomHarness();
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(
        fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }),
      );
      Object.assign(cutaway, { domOverlay: overlay });
      cutaway.open('rest-cabin');
      cutaway.update([idleInside]);

      expect(labelLayer.children.length).toBeGreaterThan(0);
      expect(labelLayer.children.every((label) => label.dataset.expanded === 'true')).toBe(true);
      guide.children[1]!.click();
      expect(labelLayer.children.every((label) => label.dataset.expanded === 'false')).toBe(true);
      expect(labelLayer.children.every((label) => label.getBoundingClientRect().width === 26)).toBe(true);
      expect(labelLayer.children.every((label) => label.style.maxWidth === undefined)).toBe(true);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('reprojects selection exclusion before relocating labels after pan and zoom', () => {
    const storage = {
      getItem: vi.fn((key: string): string | null => key === 'pixelworld:guide-dismissed:v1' ? 'true' : null),
      setItem: vi.fn(),
    };
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn() });
    const { overlay, actions, labelLayer } = overlayDomHarness();
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(
        fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }),
      );
      Object.assign(cutaway, { domOverlay: overlay });
      cutaway.open('rest-cabin');
      actions.get('edit')!.click();

      const internal = cutaway as unknown as {
        interiorViewport: { anchorX: number; anchorY: number; zoom: number; panX: number; panY: number };
        activeInterior: InteriorDefinition;
        currentLayout: ReturnType<typeof cutawayLayoutForViewport>;
        selectedFurnitureId: string;
        selectedFurnitureIds: Set<string>;
        overlayModel(): CutawayDomModel;
        applyRoomViewport(): void;
        renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
      };
      internal.selectedFurnitureId = 'rest-blocked-board';
      internal.selectedFurnitureIds.add('rest-blocked-board');
      internal.renderFurniture(internal.activeInterior, internal.currentLayout);
      const beforeSelection = internal.overlayModel().selectionBounds!;
      const beforeLabel = labelLayer.children.find((label) => label.dataset.expanded === 'true');
      expect(beforeLabel).toBeDefined();
      const beforeTransform = beforeLabel!.style.transform;

      internal.interiorViewport = {
        ...internal.interiorViewport,
        zoom: 1.5,
        panX: internal.interiorViewport.panX + 96,
        panY: internal.interiorViewport.panY + 54,
      };
      internal.applyRoomViewport();

      const afterSelection = internal.overlayModel().selectionBounds!;
      expect(afterSelection).not.toEqual(beforeSelection);
      const overlayState = overlay as unknown as { model?: CutawayDomModel };
      expect(overlayState.model?.selectionBounds).toEqual(afterSelection);
      const afterLabel = labelLayer.children.find((label) => label.dataset.expanded === 'true');
      expect(afterLabel).toBeDefined();
      expect(afterLabel!.style.transform).not.toBe(beforeTransform);
      const editorRoom = internal.overlayModel().editorLayout!.room;
      const selectionCss = {
        left: (afterSelection.x - editorRoom.x) / WORLD_PIXELS.width * 768,
        top: (afterSelection.y - editorRoom.y) / WORLD_PIXELS.height * 448,
        right: (afterSelection.x + afterSelection.width - editorRoom.x) / WORLD_PIXELS.width * 768,
        bottom: (afterSelection.y + afterSelection.height - editorRoom.y) / WORLD_PIXELS.height * 448,
      };
      const labelRect = afterLabel!.getBoundingClientRect();
      const intersects = labelRect.left < selectionCss.right && labelRect.right > selectionCss.left
        && labelRect.top < selectionCss.bottom && labelRect.bottom > selectionCss.top;
      expect(intersects).toBe(false);
    } finally {
      overlay.destroy();
      vi.unstubAllGlobals();
    }
  });

  it('uses the first Escape to dismiss the guide before a second Escape closes the room', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(
      fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }),
    );
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    expect(capture.model().guideMode).toBe(true);
    const escape = fake.scene.input.keyboard.on.mock.calls.find(([event]) => event === 'keydown-ESC')?.[1];

    escape?.();
    expect(cutaway.isOpen()).toBe(true);
    expect(capture.model().guideMode).toBe(false);

    escape?.();
    expect(cutaway.isOpen()).toBe(false);
  });

  it('places interactive catalog sprites inside the reserved canvas handoff region', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 336, height: 320 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    capture.handlers().toggleEdit();
    capture.handlers().toggleCatalog();
    const catalog = capture.model().editorLayout!.catalog;
    const paletteItems = (cutaway as unknown as { paletteLayer: FakeObject }).paletteLayer.children
      .filter(({ interactive, destroyed }) => interactive && !destroyed);
    expect(catalog.height).toBeGreaterThan(0);
    expect(paletteItems.length).toBeGreaterThan(0);
    expect(paletteItems.every(({ x, y }) => x >= catalog.x && x <= catalog.x + catalog.width
      && y >= catalog.y && y <= catalog.y + catalog.height)).toBe(true);
  });

  it('labels only hook furniture with readable action-oriented text', () => {
    expect(hookFurnitureLabel({
      id: 'hook', kind: 'computer', point: { x: 1, y: 1 }, facing: 'up', icon: 'web',
      supportedActions: ['signal', 'terminal'],
    })).toBe('查詢網路 / 執行工具');
    expect(hookFurnitureLabel({
      id: 'decor', kind: 'plant', point: { x: 1, y: 1 }, facing: 'up', icon: 'generic', supportedActions: [],
    })).toBe('');
  });

  it.each([
    ['zh-TW', '查詢網路 / 執行工具'],
    ['en-US', 'Browsing sources / Using tools'],
    ['ja-JP', '情報検索中 / ツール実行中'],
    ['ko-KR', '자료 검색 중 / 도구 실행 중'],
  ] as const)('localizes Hook action labels in %s', (locale, expected) => {
    expect(hookFurnitureLabel({
      id: 'hook', kind: 'computer', point: { x: 1, y: 1 }, facing: 'up', icon: 'web',
      supportedActions: ['signal', 'terminal'],
    }, locale)).toBe(expected);
  });

  it('localizes immutable built-ins by stable ID while preserving a user-created prefab name', () => {
    const builtIn = BUILT_IN_OFFICE_PREFABS[1]!;
    const userPrefab = {
      ...builtIn, id: 'prefab-user', name: 'My Saved Layout', source: 'user' as const, immutable: false,
    };

    expect(prefabDisplayName(builtIn, 'ja-JP')).toBe('2人用L字型ポッド');
    expect(prefabDisplayName(userPrefab, 'ja-JP')).toBe('My Saved Layout');
  });

  it('uses the approved adaptive interior workspace layouts', () => {
    const desktop = interiorEditorLayout(960, 560, {
      editMode: false,
      catalogExpanded: false,
      inspectorExpanded: false,
    });
    expect(cutawayLayoutForViewport(960, 560)).toEqual({ x: 120, y: 33, width: 720, height: 495 });
    expect(cutawayLayoutForViewport(960, 560)).toEqual(desktop.frame);
    expect(roomViewportFrameForLayout(cutawayLayoutForViewport(960, 560))).toEqual(desktop.room);
    expect(cutawayLayoutForViewport(800, 450)).toEqual({ x: 40, y: 8, width: 720, height: 434 });
    expect(cutawayLayoutForViewport(640, 360)).toEqual({ x: 8, y: 8, width: 624, height: 344 });

    const reserved = interiorEditorLayout(640, 360, {
      editMode: true,
      catalogExpanded: true,
      inspectorExpanded: true,
    });
    expect(reserved.room.y + reserved.room.height).toBeLessThanOrEqual(reserved.catalog.y);
  });

  it('projects the viewport-safe CSS frame into scaled Phaser canvas coordinates', () => {
    const fake = fakeScene();
    const canvasRect = { left: 144, top: 114, width: 1_152, height: 672 };
    Object.assign(fake.scene, {
      game: { canvas: { getBoundingClientRect: () => canvasRect } },
    });
    const cutaway = new InteriorCutawaySystem(
      fake.scene as never,
      WORLD_DEFINITION,
      () => ({ width: 1_440, height: 900 }),
    );
    const capture = captureCutawayHandlers(cutaway);

    cutaway.open('rest-cabin');

    const layout = capture.overlay.open.mock.calls.at(-1)?.[0];
    expect(layout).toMatchObject({ width: 480, height: 330 });
    expect(layout.x).toBeCloseTo(144);
    expect(layout.y).toBeCloseTo(59.3333333333);
    const projected = {
      left: canvasRect.left + layout.x / WORLD_PIXELS.width * canvasRect.width,
      top: canvasRect.top + layout.y / WORLD_PIXELS.height * canvasRect.height,
      width: layout.width / WORLD_PIXELS.width * canvasRect.width,
      height: layout.height / WORLD_PIXELS.height * canvasRect.height,
    };
    expect(projected.left).toBeCloseTo(360);
    expect(projected.top).toBeCloseTo(203);
    expect(projected.width).toBeCloseTo(720);
    expect(projected.height).toBeCloseTo(495);
  });

  it('uses the projected CSS frame width for desktop Properties on a scaled canvas', () => {
    const fake = fakeScene();
    const canvasRect = { left: 144, top: 114, width: 1_152, height: 672 };
    Object.assign(fake.scene, {
      game: { canvas: { getBoundingClientRect: () => canvasRect } },
    });
    const cutaway = new InteriorCutawaySystem(
      fake.scene as never,
      WORLD_DEFINITION,
      () => ({ width: 1_440, height: 900 }),
    );
    const capture = captureCutawayHandlers(cutaway);

    cutaway.open('rest-cabin');
    capture.handlers().toggleEdit();
    const selected = fake.objects.find(({ interactive, destroyed, depth }) =>
      interactive && !destroyed && depth > 0);
    selected?.emit('pointerdown', pointerAt(0, 0));
    expect(capture.model().selected).toBeDefined();

    capture.handlers().toggleInspector();
    const editorLayout = capture.model().editorLayout!;
    expect(editorLayout.frame.width / WORLD_PIXELS.width * canvasRect.width).toBeCloseTo(720);
    expect(editorLayout.inspector.width).toBeGreaterThan(0);
    expect(editorLayout.inspector.width).toBeLessThan(editorLayout.frame.width);
    expect(editorLayout.inspector.height).toBe(editorLayout.room.height);
    expect(editorLayout.inspector.x).toBe(editorLayout.room.x + editorLayout.room.width);
  });

  it('keeps scaled-canvas projection inside sub-minimum viewports across resize', () => {
    const fake = fakeScene();
    const viewport = { width: 319, height: 279 };
    const canvasRect = { left: 5, top: 7, width: 309, height: 265 };
    Object.assign(fake.scene, {
      game: { canvas: { getBoundingClientRect: () => canvasRect } },
    });
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => viewport);
    const capture = captureCutawayHandlers(cutaway);
    const projected = () => {
      const layout = capture.overlay.relayout.mock.calls.at(-1)?.[0]
        ?? capture.overlay.open.mock.calls.at(-1)?.[0];
      return {
        left: canvasRect.left + layout.x / WORLD_PIXELS.width * canvasRect.width,
        top: canvasRect.top + layout.y / WORLD_PIXELS.height * canvasRect.height,
        width: layout.width / WORLD_PIXELS.width * canvasRect.width,
        height: layout.height / WORLD_PIXELS.height * canvasRect.height,
      };
    };
    const expectContained = () => {
      const frame = projected();
      expect(frame.left).toBeGreaterThanOrEqual(0);
      expect(frame.top).toBeGreaterThanOrEqual(0);
      expect(frame.left + frame.width).toBeLessThanOrEqual(viewport.width);
      expect(frame.top + frame.height).toBeLessThanOrEqual(viewport.height);
    };

    cutaway.open('rest-cabin');
    expectContained();
    viewport.width = 160;
    viewport.height = 180;
    Object.assign(canvasRect, { left: 4, top: 5, width: 152, height: 170 });
    cutaway.open('rest-cabin');
    expectContained();
  });

  it('owns wheel zoom and empty-space panning inside an open room', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1280, height: 720 }));
    cutaway.open('rest-cabin');
    const internal = cutaway as unknown as {
      interiorViewport: { zoom: number; panX: number; panY: number };
      roomViewportLayer: FakeObject;
    };
    const center = viewportPointerAt(384, 224);

    fake.emitInput('wheel', center, [], 0, -420);
    expect(internal.interiorViewport.zoom).toBeGreaterThan(1);
    expect(internal.roomViewportLayer.scale).toBeCloseTo(internal.interiorViewport.zoom);

    fake.emitInput('pointerdown', center, []);
    fake.emitInput('pointermove', viewportPointerAt(430, 250));
    fake.emitInput('pointerup', viewportPointerAt(430, 250));
    expect(Math.abs(internal.interiorViewport.panX) + Math.abs(internal.interiorViewport.panY)).toBeGreaterThan(0);
  });

  it('does not start left-button room panning while furniture edit marquee owns empty space', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1280, height: 720 }));
    const captured = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    fake.emitInput('wheel', viewportPointerAt(384, 224), [], 0, -420);
    captured.handlers().toggleEdit();
    const internal = cutaway as unknown as { interiorViewport: { panX: number; panY: number } };
    const before = { ...internal.interiorViewport };

    fake.emitInput('pointerdown', viewportPointerAt(384, 224), []);
    fake.emitInput('pointermove', viewportPointerAt(440, 270));
    fake.emitInput('pointerup', viewportPointerAt(440, 270));
    expect(internal.interiorViewport).toMatchObject(before);
  });

  it('fits an 18x12 work office inside the cutaway content area with a readable cell', () => {
    const cell = roomCellForLayout(
      { width: 18, height: 12 },
      { x: 80, y: 44, width: 608, height: 360 },
    );
    const frame = roomViewportFrameForLayout({ x: 80, y: 44, width: 608, height: 360 });
    expect(cell).toBeGreaterThanOrEqual(12);
    expect(cell * 18).toBeLessThanOrEqual(frame.width);
    expect(cell * 12).toBeLessThanOrEqual(frame.height);
  });

  it('round-trips fractional room coordinates through the responsive room origin', () => {
    const layout = { x: 80, y: 44, width: 608, height: 360 };
    const room = { width: 18, height: 12 };
    const cell = roomCellForLayout(room, layout);
    const origin = roomOriginForLayout(room, layout, cell);
    const point = { x: 3.125, y: 7.75 };

    expect(roomPointForScreen(origin, roomScreenPoint(origin, point, cell), cell)).toEqual(point);
  });

  it('materializes the normalized authored visual offset at the item scale exactly once', () => {
    const furniture = {
      id: 'offset-display', kind: 'display' as const, point: { x: 3, y: 4 }, facing: 'right' as const,
      icon: 'generic' as const, supportedActions: [], visualOffset: { x: -0.5, y: 0.25 },
      rotation: 90 as const, scale: 1.5 as const,
    };
    const point = furnitureRenderScreenPoint({ x: 100, y: 50 }, furniture, 20);
    expect(point.x).toBeCloseTo(155);
    expect(point.y).toBeCloseTo(147.5);
  });

  it('projects the same effective alpha bounds for render positioning and selection highlights', () => {
    const furniture = {
      id: 'offset-display', kind: 'display' as const, point: { x: 3, y: 4 }, facing: 'right' as const,
      icon: 'generic' as const, supportedActions: [], visualOffset: { x: -0.5, y: 0.25 },
      rotation: 90 as const, scale: 1.5 as const, assetId: 121,
    };
    const logical = transformedAlphaBounds(furniture);
    const screen = furnitureRenderScreenGeometry({ x: 100, y: 50 }, furniture, 20);

    expect(screen.bounds.x).toBeCloseTo(100 + logical.x * 20);
    expect(screen.bounds.y).toBeCloseTo(50 + logical.y * 20);
    expect(screen.bounds.width).toBeCloseTo(logical.width * 20);
    expect(screen.bounds.height).toBeCloseTo(logical.height * 20);
    expect(screen.point.x).toBeCloseTo(screen.bounds.x + screen.bounds.width / 2);
    expect(screen.point.y).toBeCloseTo(screen.bounds.y + screen.bounds.height / 2);
  });

  it('orders wall foreground against renderer-owned agent foot Y', () => {
    const wall = {
      id: 'wall', kind: 'cabinet' as const, point: { x: 3, y: 4 }, facing: 'up' as const,
      icon: 'generic' as const, supportedActions: [], layer: 'wall' as const,
    };
    const geometry = furnitureRenderScreenGeometry({ x: 100, y: 50 }, {
      ...wall, assetId: 176, scale: 2, visualOffset: { x: 0, y: 0.25 },
    }, 20);
    const wallDepth = interiorFurnitureRenderDepth(wall, geometry.baselineY);
    expect(wallDepth).toBeGreaterThan(interiorAgentRenderDepth(geometry.baselineY - 1, 1));
    expect(wallDepth).toBeLessThan(interiorAgentRenderDepth(geometry.baselineY + 1, 1));
    expect(interiorFurnitureRenderDepth({ ...wall, layer: 'surface' }, geometry.baselineY))
      .toBeLessThan(interiorAgentRenderDepth(0, 1));
  });

  it('uses an ID-stable tie break for agents sharing the same foot Y', () => {
    const firstOrder = [{ agentId: 'beta' }, { agentId: 'alpha' }];
    const recreated = [{ agentId: 'alpha' }, { agentId: 'beta' }];

    expect(stableInteriorAgentIndex(firstOrder, 'alpha')).toBe(stableInteriorAgentIndex(recreated, 'alpha'));
    expect(interiorAgentRenderDepth(120, stableInteriorAgentIndex(firstOrder, 'alpha')))
      .toBe(interiorAgentRenderDepth(120, stableInteriorAgentIndex(recreated, 'alpha')));
  });

  it('returns a fitted cell instead of silently overflowing unsupported room dimensions', () => {
    const layout = { x: 80, y: 44, width: 608, height: 360 };
    const frame = roomViewportFrameForLayout(layout);
    const cell = roomCellForLayout({ width: 80, height: 40 }, layout);
    expect(cell * 80).toBeLessThanOrEqual(frame.width);
    expect(cell * 40).toBeLessThanOrEqual(frame.height);
    const subpixel = roomCellForLayout({ width: 1_000, height: 1_000 }, layout);
    expect(subpixel * 1_000).toBeLessThanOrEqual(frame.height);
  });

  it('keeps panel pointer events available for room marquee input', () => {
    const layout = cutawayLayoutForViewport(1_280, 720);
    expect(cutawayContainsPointer(layout, { x: layout.x + 1, y: layout.y + 1 })).toBe(true);
    expect(cutawayContainsPointer(layout, { x: layout.x - 1, y: layout.y + 1 })).toBe(false);
  });

  it('renders the dragged sprite at the same fitted anchor as its placement preview', () => {
    expect(dragPreviewScreenPoint({ x: 486, y: 178 }, { x: 0.125, y: 1.75 })).toEqual({
      x: 499.75,
      y: 227.5,
    });
  });

  it('opens any house, projects matching occupants, and closes idempotently', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));

    cutaway.open('rest-cabin');
    const furnitureKeys = (fake.scene.add.image.mock.calls as unknown[][]).map((call) => call[2]);
    expect(furnitureKeys.length).toBeGreaterThan(0);
    expect(furnitureKeys.every((key) => String(key).startsWith('modern-office-v1.2-'))).toBe(true);
    cutaway.open('rest-cabin');
    cutaway.update([idleInside]);

    expect(cutaway.isOpen()).toBe(true);
    expect(cutaway.openBuildingId()).toBe('rest-cabin');
    expect(cutaway.occupants()).toEqual([expect.objectContaining({ agentId: 'main', furnitureId: 'rest-sofa-a' })]);
    expect(fake.scene.tweens.add).toHaveBeenCalledTimes(1);

    cutaway.close();
    cutaway.close();
    expect(cutaway.isOpen()).toBe(false);
    expect(cutaway.openBuildingId()).toBeUndefined();
  });

  it('keeps distinct agent identities and advances walk frames inside the room', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('network-lab');
    const candidateIds = Array.from({ length: 12 }, (_, index) => `subagent-${index + 1}`);
    const firstId = candidateIds[0]!;
    const firstSheet = agentSkinFor(firstId, 'subagent').sheet;
    const secondId = candidateIds.find((id) => agentSkinFor(id, 'subagent').sheet !== firstSheet)!;
    const snapshots: InteriorAgentSnapshot[] = [firstId, secondId].map((agentId, index) => ({
      agentId, role: 'subagent', buildingId: 'network-lab', action: 'terminal',
      eventKind: 'web', eventId: `web-${index}`, interiorElapsedMs: 0,
    }));

    fake.scene.time.now = 0;
    cutaway.update(snapshots);
    const internal = cutaway as unknown as { occupantViews: Map<string, { sprite: FakeObject }> };
    const firstView = internal.occupantViews.get(firstId)!;
    const secondView = internal.occupantViews.get(secondId)!;
    expect(firstView.sprite.texture).toBe(agentSkinFor(firstId, 'subagent').sheet);
    expect(secondView.sprite.texture).toBe(agentSkinFor(secondId, 'subagent').sheet);
    expect(firstView.sprite.texture).not.toBe(secondView.sprite.texture);
    const firstFrame = firstView.sprite.frame;

    fake.scene.time.now = 120;
    cutaway.update(snapshots);
    expect(firstView.sprite.frame).not.toBe(firstFrame);
  });

  it('emits one open transition, keeps focus during building switches, and emits close once', () => {
    const fake = fakeScene();
    const states: Array<[boolean, string | undefined]> = [];
    const cutaway = new InteriorCutawaySystem(
      fake.scene as never,
      WORLD_DEFINITION,
      () => ({ width: 1_280, height: 720 }),
      { onOpenStateChange: (open, buildingId) => states.push([open, buildingId]) },
    );

    cutaway.open('network-lab');
    cutaway.open('tool-smithy');
    cutaway.close();
    cutaway.close();

    expect(states).toEqual([
      [true, 'network-lab'],
      [true, 'tool-smithy'],
      [false, undefined],
    ]);
  });

  it('closes an open interior exactly once when destroyed', () => {
    const fake = fakeScene();
    const states: boolean[] = [];
    const cutaway = new InteriorCutawaySystem(
      fake.scene as never,
      WORLD_DEFINITION,
      () => ({ width: 1_280, height: 720 }),
      { onOpenStateChange: (open) => states.push(open) },
    );

    cutaway.open('network-lab');
    cutaway.destroy();
    cutaway.destroy();

    expect(states).toEqual([true, false]);
  });

  it('shows an empty layout without manufacturing an Agent or changing the world camera', () => {
    const fake = fakeScene();
    fake.scene.cameras.main.scrollX = 4;
    fake.scene.cameras.main.scrollY = 6;
    fake.scene.cameras.main.zoom = 2;
    const cameraBefore = { ...fake.scene.cameras.main };
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 840, height: 480 }));

    cutaway.open('research-library');
    cutaway.update([]);
    cutaway.destroy();

    expect(cutaway.occupants()).toEqual([]);
    expect(fake.scene.cameras.main).toEqual(cameraBefore);
    expect(cutaway.isOpen()).toBe(false);
  });

  it('renders furniture from the licensed Modern Office family', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const sprites = fake.objects.filter(({ texture }) => texture.startsWith('modern-office'));
    expect(sprites.length).toBeGreaterThan(5);
    expect(sprites.every(({ destroyed }) => !destroyed)).toBe(true);
  });

  it('uses Pointer coordinates for smooth group ghosts and snaps the retained anchor only at commit', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const room: InteriorDefinition = {
      id: 'research-library', label: 'Shelf test', width: 18, height: 12,
      floor: 'tile', wall: 'blue', furniture: [], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean;
      activeDefinition: InteriorDefinition;
      activeInterior: InteriorDefinition;
      roomOrigin: { x: number; y: number };
      roomCell: number;
      root: FakeObject;
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    Object.assign(internal, { disclosureState: { catalogExpanded: true, inspectorExpanded: false, guideMode: false } });
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    internal.root.x = 30;
    internal.root.y = 20;
    internal.root.scale = 2;

    const bench = BUILT_IN_OFFICE_PREFABS[0]!;
    const preview = fake.objects.find((object) => object.interactive &&
      object.children.filter(({ texture }) => texture.startsWith('modern-office')).length === bench.items.length);
    expect(preview).toBeDefined();
    const previewParts = preview!.children.filter(({ texture }) => texture.startsWith('modern-office'));
    expect(previewParts).toHaveLength(bench.items.length);
    expect(previewParts.every(({ tinted }) => !tinted)).toBe(true);

    const anchor = { x: 2.12, y: 2.12 };
    const pointer = dragPreviewScreenPoint(internal.roomOrigin, anchor, internal.roomCell);
    const world = (point: { x: number; y: number }) => ({
      x: internal.root.x + point.x * internal.root.scale,
      y: internal.root.y + point.y * internal.root.scale,
    });
    const transformedPointer = (point: { x: number; y: number }) => {
      const transformed = world(point);
      return pointerAt(transformed.x, transformed.y);
    };
    preview!.emit('dragstart', transformedPointer({ x: pointer.x - 20, y: pointer.y - 20 }));
    preview!.emit('drag', transformedPointer(pointer), -320, 850);
    const ghosts = fake.objects.filter(({ alpha, destroyed }) => alpha === 0.72 && !destroyed);
    expect(ghosts).toHaveLength(bench.items.length);
    const firstOffset = bench.items[0]!.visualOffset ?? { x: 0, y: 0 };
    expect(ghosts[0]).toMatchObject({
      x: pointer.x + (bench.items[0]!.point.x + firstOffset.x - bench.anchor.x) * internal.roomCell,
      y: pointer.y + (bench.items[0]!.point.y + firstOffset.y - bench.anchor.y) * internal.roomCell,
    });

    preview!.emit('dragend', transformedPointer({ x: pointer.x + 200, y: pointer.y + 200 }), 7, 9);
    expect(room.furniture).toHaveLength(bench.items.length);
    expect(room.furniture[0]!.point).toEqual({ x: 2, y: 3 });
    expect(room.furniture.every(({ prefabInstanceId }) => prefabInstanceId === room.furniture[0]!.prefabInstanceId)).toBe(true);
    expect(room.furniture.some(({ supportedActions }) => supportedActions.length > 0)).toBe(true);
  });

  it('commits from the Pointer captured at dragstart when no drag update fires', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const room: InteriorDefinition = {
      id: 'research-library', label: 'Shelf test', width: 18, height: 12,
      floor: 'tile', wall: 'blue', furniture: [], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean;
      activeDefinition: InteriorDefinition;
      activeInterior: InteriorDefinition;
      roomOrigin: { x: number; y: number };
      roomCell: number;
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    Object.assign(internal, { disclosureState: { catalogExpanded: true, inspectorExpanded: false, guideMode: false } });
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));

    const bench = BUILT_IN_OFFICE_PREFABS[0]!;
    const preview = fake.objects.find((object) => object.interactive &&
      object.children.filter(({ texture }) => texture.startsWith('modern-office')).length === bench.items.length)!;
    const pointer = dragPreviewScreenPoint(internal.roomOrigin, { x: 3.12, y: 2.88 }, internal.roomCell);

    preview.emit('dragstart', pointerAt(pointer.x, pointer.y));
    preview.emit('dragend', pointerAt(pointer.x + 300, pointer.y + 300), -12, -8);

    expect(room.furniture).toHaveLength(bench.items.length);
    expect(room.furniture[0]!.point).toEqual({ x: 3, y: 4 });
  });

  it.each([
    ['zh-TW', '四人雙排工作桌'],
    ['en-US', 'Four-seat Double Bench'],
    ['ja-JP', '4人用両面ベンチ'],
    ['ko-KR', '4인용 양면 벤치'],
  ] as const)('localizes the built-in prefab shelf preview and placement feedback in %s', (locale, expectedName) => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.setLocale(locale);
    cutaway.open('rest-cabin');
    capture.handlers().toggleEdit();
    capture.handlers().toggleCatalog();
    const room: InteriorDefinition = {
      id: 'research-library', label: 'Shelf locale test', width: 18, height: 12,
      floor: 'tile', wall: 'blue', furniture: [], overflow: [],
    };
    const internal = cutaway as unknown as {
      activeDefinition: InteriorDefinition;
      activeInterior: InteriorDefinition;
      roomOrigin: { x: number; y: number };
      roomCell: number;
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));

    const bench = BUILT_IN_OFFICE_PREFABS[0]!;
    const preview = fake.objects.find((object) => !object.destroyed && object.interactive &&
      object.children.filter(({ texture }) => texture.startsWith('modern-office')).length === bench.items.length)!;
    const previewLabel = preview.children.find(({ text }) => text === expectedName)!;
    expect(previewLabel).toBeDefined();
    expect(previewLabel.visible).toBe(false);
    preview.emit('pointerover');
    expect(previewLabel.visible).toBe(true);
    if (locale !== 'en-US') {
      expect(preview.children.some(({ text }) => text === bench.name)).toBe(false);
    }

    const pointer = dragPreviewScreenPoint(internal.roomOrigin, { x: 3, y: 3 }, internal.roomCell);
    preview.emit('dragstart', pointerAt(pointer.x, pointer.y));
    preview.emit('dragend', pointerAt(pointer.x, pointer.y));
    expect(capture.model()).toMatchObject({
      statusId: 'prefabPlaced', statusParams: { name: expectedName },
    });
  });

  it('keeps an existing offset sprite at the same logical point on a no-motion drag', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const furniture = {
      id: 'offset-item', kind: 'plant' as const, point: { x: 6, y: 4 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 98, scale: 1.5 as const,
      rotation: 0 as const, visualOffset: { x: 0.5, y: 0.25 }, blocksNavigation: false,
    };
    const room: InteriorDefinition = {
      id: 'rest-cabin', label: 'Offset drag', width: 14, height: 9,
      floor: 'wood', wall: 'cream', furniture: [furniture], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean;
      activeDefinition: InteriorDefinition;
      activeInterior: InteriorDefinition;
      currentDragCandidate?: { furniture: { point: { x: number; y: number } } };
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    const sprite = fake.objects.find(({ texture, interactive, destroyed, depth }) =>
      texture === 'modern-office-v1.2-single-98' && interactive && !destroyed && depth > 0)!;

    const pointer = pointerAt(sprite.x, sprite.y);
    sprite.emit('pointerdown', pointer);
    sprite.emit('dragstart', pointer);
    sprite.emit('drag', pointer, sprite.x, sprite.y);
    expect(internal.currentDragCandidate?.furniture.point).toEqual(furniture.point);
    sprite.emit('dragend', pointer);

    expect(room.furniture.find(({ id }) => id === furniture.id)?.point).toEqual(furniture.point);
  });

  it('retains an off-center grab vector through camera and root transforms', () => {
    const fake = fakeScene();
    fake.scene.cameras.main.scrollX = 35;
    fake.scene.cameras.main.scrollY = 20;
    fake.scene.cameras.main.zoom = 2;
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const furniture = {
      id: 'edge-grab-item', kind: 'plant' as const, point: { x: 6, y: 4 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 98, scale: 1.5 as const,
      rotation: 0 as const, visualOffset: { x: 0.5, y: 0.25 }, blocksNavigation: false,
    };
    const room: InteriorDefinition = {
      id: 'rest-cabin', label: 'Edge drag', width: 14, height: 9,
      floor: 'wood', wall: 'cream', furniture: [furniture], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean; activeDefinition: InteriorDefinition; activeInterior: InteriorDefinition;
      root: FakeObject; currentDragCandidate?: { furniture: { point: { x: number; y: number } } };
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    internal.root.x = 28;
    internal.root.y = 17;
    internal.root.scale = 1.5;
    const sprite = fake.objects.find(({ texture, interactive, destroyed, depth }) =>
      texture === 'modern-office-v1.2-single-98' && interactive && !destroyed && depth > 0)!;
    const pointerForLocal = (local: { x: number; y: number }) => {
      const world = {
        x: internal.root.x + local.x * internal.root.scale,
        y: internal.root.y + local.y * internal.root.scale,
      };
      const raw = {
        x: (world.x - fake.scene.cameras.main.scrollX) * fake.scene.cameras.main.zoom,
        y: (world.y - fake.scene.cameras.main.scrollY) * fake.scene.cameras.main.zoom,
      };
      return {
        ...raw, camera: fake.scene.cameras.main,
        positionToCamera: () => ({
          x: fake.scene.cameras.main.scrollX + raw.x / fake.scene.cameras.main.zoom,
          y: fake.scene.cameras.main.scrollY + raw.y / fake.scene.cameras.main.zoom,
        }),
      };
    };
    const grab = { x: sprite.x + 8, y: sprite.y - 6 };
    const grabPointer = pointerForLocal(grab);
    sprite.emit('pointerdown', grabPointer);
    sprite.emit('dragstart', grabPointer);
    sprite.emit('drag', grabPointer, -999, 999);
    expect(internal.currentDragCandidate?.furniture.point).toEqual(furniture.point);

    sprite.emit('drag', pointerForLocal({ x: grab.x + 2, y: grab.y - 2 }), -999, 999);
    expect(internal.currentDragCandidate?.furniture.point).toEqual(furniture.point);
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    expect(internal.currentDragCandidate).toBeUndefined();
    expect(room.furniture.find(({ id }) => id === furniture.id)?.point).toEqual(furniture.point);
  });

  it('keeps an invalid furniture preview under the pointer until one rollback on drag end', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    const moving = {
      id: 'preview-moving', kind: 'plant' as const, point: { x: 3, y: 4 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 98, scale: 1 as const,
      rotation: 0 as const, layer: 'surface' as const, blocksNavigation: false,
    };
    const obstacle = {
      id: 'preview-obstacle', kind: 'display' as const, point: { x: 8, y: 4 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 129, scale: 1 as const,
      rotation: 0 as const, layer: 'surface' as const, blocksNavigation: false,
    };
    const room: InteriorDefinition = {
      id: 'rest-cabin', label: 'Invalid preview', width: 14, height: 9,
      floor: 'wood', wall: 'cream', furniture: [moving, obstacle], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean; activeDefinition: InteriorDefinition; activeInterior: InteriorDefinition;
      roomCell: number; roomOrigin: { x: number; y: number };
      currentDragMutation?: { accepted: boolean };
      undoStore: { canUndo: boolean; reset(layout: InteriorDefinition['furniture']): void };
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.undoStore.reset(room.furniture);
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    const sprite = fake.objects.find(({ texture, interactive, destroyed, depth }) =>
      texture === 'modern-office-v1.2-single-98' && interactive && !destroyed && depth > 0)!;
    const restingDepth = sprite.depth;
    const origin = { x: sprite.x, y: sprite.y };
    const target = furnitureRenderScreenPoint(internal.roomOrigin, { ...moving, point: obstacle.point }, internal.roomCell);

    const originPointer = pointerAt(origin.x, origin.y);
    const targetPointer = pointerAt(target.x, target.y);
    sprite.emit('pointerdown', originPointer);
    sprite.emit('dragstart', originPointer);
    sprite.emit('drag', targetPointer, target.x, target.y);

    expect(internal.currentDragMutation?.accepted).toBe(false);
    expect({ x: sprite.x, y: sprite.y }).toEqual(target);
    expect({ x: sprite.x, y: sprite.y }).not.toEqual(origin);
    expect(sprite.depth).toBeGreaterThan(restingDepth);
    expect(sprite.tintColor).toBe(0xe05b54);
    expect(fake.objects.some(({ strokeRects }) => strokeRects.some(({ color }) => color === 0xe05b54))).toBe(true);
    expect(room.furniture).toEqual([moving, obstacle]);
    expect(internal.undoStore.canUndo).toBe(false);

    sprite.emit('dragend', targetPointer);

    expect(fake.scene.tweens.add).toHaveBeenLastCalledWith(expect.objectContaining({
      targets: expect.arrayContaining([sprite]), duration: 140,
    }));
    expect(sprite.destroyed).toBe(true);
    expect(room.furniture).toEqual([moving, obstacle]);
    expect(internal.undoStore.canUndo).toBe(false);
    expect(capture.model()).toMatchObject({
      statusId: 'placementRejected', statusParams: { diagnostic: 'overlap' },
    });
    const restored = fake.objects.find(({ texture, interactive, destroyed, depth }) =>
      texture === 'modern-office-v1.2-single-98' && interactive && !destroyed && depth > 0)!;
    expect({ x: restored.x, y: restored.y }).toEqual(origin);
  });

  it('does not persist or create undo history while previewing a furniture drag', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    vi.stubGlobal('localStorage', storage);
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');
      capture.handlers().toggleEdit();
      const internal = cutaway as unknown as {
        activeInterior: InteriorDefinition; undoStore: { canUndo: boolean }; roomCell: number;
        currentDragMutation?: { accepted: boolean };
      };
      const originalRotations = internal.activeInterior.furniture.map(({ rotation }) => rotation);
      const sprite = fake.objects.find(({ interactive, destroyed, depth }) => interactive && !destroyed && depth > 0)!;
      const owner = { ...pointerAt(sprite.x, sprite.y), id: 7 };
      const outside = { ...pointerAt(sprite.x - internal.roomCell * 50, sprite.y), id: 7 };

      sprite.emit('pointerdown', owner);
      sprite.emit('dragstart', owner);
      sprite.emit('drag', outside, -999, sprite.y);

      expect(internal.currentDragMutation).toBeDefined();
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(internal.undoStore.canUndo).toBe(false);
      expect(internal.activeInterior.furniture.map(({ rotation }) => rotation)).toEqual(originalRotations);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps invalid outline state while reduced motion removes lift and settle movement', () => {
    const fake = fakeScene();
    const canvas = { dataset: {} as Record<string, string> };
    Object.assign(fake.scene, { game: { canvas } });
    vi.stubGlobal('window', {
      matchMedia: vi.fn(() => ({ matches: true })),
      dispatchEvent: vi.fn(),
    });
    try {
      const cutaway = new InteriorCutawaySystem(
        fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }),
      );
      cutaway.open('rest-cabin');
      const moving = {
        id: 'reduced-moving', kind: 'plant' as const, point: { x: 3, y: 4 }, facing: 'up' as const,
        supportedActions: [], icon: 'generic' as const, assetId: 98, scale: 1 as const,
        rotation: 0 as const, layer: 'surface' as const, blocksNavigation: false,
      };
      const obstacle = {
        id: 'reduced-obstacle', kind: 'display' as const, point: { x: 8, y: 4 }, facing: 'up' as const,
        supportedActions: [], icon: 'generic' as const, assetId: 129, scale: 1 as const,
        rotation: 0 as const, layer: 'surface' as const, blocksNavigation: false,
      };
      const room: InteriorDefinition = {
        id: 'rest-cabin', label: 'Reduced drag', width: 14, height: 9,
        floor: 'wood', wall: 'cream', furniture: [moving, obstacle], overflow: [],
      };
      const internal = cutaway as unknown as {
        editMode: boolean; activeDefinition: InteriorDefinition; activeInterior: InteriorDefinition;
        roomCell: number; roomOrigin: { x: number; y: number };
        renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
      };
      internal.editMode = true;
      internal.activeDefinition = room;
      internal.activeInterior = room;
      internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
      const sprite = fake.objects.find(({ texture, interactive, destroyed, depth }) =>
        texture === 'modern-office-v1.2-single-98' && interactive && !destroyed && depth > 0)!;
      const restingScale = sprite.scale;
      const target = furnitureRenderScreenPoint(internal.roomOrigin, { ...moving, point: obstacle.point }, internal.roomCell);
      const owner = pointerAt(sprite.x, sprite.y);
      const blocked = pointerAt(target.x, target.y);
      sprite.emit('pointerdown', owner);
      sprite.emit('dragstart', owner);
      sprite.emit('drag', blocked, target.x, target.y);

      expect(sprite.scale).toBe(restingScale);
      expect(sprite.tintColor).toBe(0xe05b54);
      expect(canvas.dataset.interiorDragTone).toBe('invalid');
      expect(fake.objects.some(({ strokeRects }) => strokeRects.some(({ color }) => color === 0xe05b54))).toBe(true);
      const tweenCount = fake.scene.tweens.add.mock.calls.length;
      sprite.emit('dragend', blocked);
      expect(fake.scene.tweens.add).toHaveBeenCalledTimes(tweenCount);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lifts dragged furniture and its outline above later furniture then restores container order on cancel', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const lower = {
      id: 'lower-order', kind: 'plant' as const, point: { x: 3, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 98, scale: 1 as const,
      rotation: 0 as const, layer: 'surface' as const, zIndex: 0, blocksNavigation: false,
    };
    const later = {
      id: 'later-order', kind: 'display' as const, point: { x: 8, y: 5 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 129, scale: 1 as const,
      rotation: 0 as const, layer: 'surface' as const, zIndex: 1, blocksNavigation: false,
    };
    const room: InteriorDefinition = {
      id: 'rest-cabin', label: 'Render order', width: 14, height: 9,
      floor: 'wood', wall: 'cream', furniture: [lower, later], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean; activeDefinition: InteriorDefinition; activeInterior: InteriorDefinition;
      furnitureLayer: FakeObject; roomOrigin: { x: number; y: number }; roomCell: number;
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    const layer = internal.furnitureLayer;
    const lowerSprite = fake.objects.find(({ texture, interactive, destroyed }) =>
      texture === 'modern-office-v1.2-single-98' && interactive && !destroyed)!;
    const laterSprite = fake.objects.find(({ texture, interactive, destroyed }) =>
      texture === 'modern-office-v1.2-single-129' && interactive && !destroyed)!;
    expect(layer.children.indexOf(lowerSprite)).toBeLessThan(layer.children.indexOf(laterSprite));

    const owner = { ...pointerAt(lowerSprite.x, lowerSprite.y), id: 81 };
    const overlap = furnitureRenderScreenPoint(internal.roomOrigin, { ...lower, point: later.point }, internal.roomCell);
    lowerSprite.emit('pointerdown', owner);
    lowerSprite.emit('dragstart', owner);
    lowerSprite.emit('drag', { ...pointerAt(overlap.x, overlap.y), id: 81 }, overlap.x, overlap.y);
    const outline = layer.children.find(({ strokeRects }) => strokeRects.length > 0)!;

    expect(layer.children.indexOf(lowerSprite)).toBeGreaterThan(layer.children.indexOf(laterSprite));
    expect(layer.children.at(-1)).toBe(outline);

    fake.emitInput('pointercancel', owner);
    expect(layer.children.indexOf(lowerSprite)).toBeLessThan(layer.children.indexOf(laterSprite));
    expect(layer.children.indexOf(outline)).toBeLessThan(layer.children.indexOf(lowerSprite));
    expect(layer.children.map(({ depth }) => depth).every((depth, index, values) => index === 0 || values[index - 1]! <= depth)).toBe(true);
  });

  it('cancels captured furniture dragging without committing and lets furniture win over room pan', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const internal = cutaway as unknown as {
      editMode: boolean; activeInterior: InteriorDefinition; roomCell: number;
      interiorViewport: { zoom: number; panX: number; panY: number };
      currentDragMutation?: { accepted: boolean };
      furnitureDragCapture?: unknown;
      undoStore: { canUndo: boolean };
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.interiorViewport.zoom = 2;
    internal.renderFurniture(internal.activeInterior, cutawayLayoutForViewport(1_280, 720));
    const sprite = fake.objects.find(({ interactive, destroyed, depth }) => interactive && !destroyed && depth > 0)!;
    const before = structuredClone(internal.activeInterior.furniture);
    const panBefore = { x: internal.interiorViewport.panX, y: internal.interiorViewport.panY };
    const pointer = { ...viewportPointerAt(sprite.x, sprite.y), id: 23 };

    fake.emitInput('pointerdown', pointer, [sprite]);
    sprite.emit('pointerdown', pointer);
    sprite.emit('dragstart', pointer);
    sprite.emit('drag', { ...viewportPointerAt(sprite.x + internal.roomCell, sprite.y), id: 23 }, sprite.x + internal.roomCell, sprite.y);
    fake.emitInput('pointermove', { ...viewportPointerAt(sprite.x + 30, sprite.y), id: 23 });
    fake.emitInput('pointercancel', pointer);

    expect(internal.interiorViewport).toMatchObject({ panX: panBefore.x, panY: panBefore.y });
    expect(internal.furnitureDragCapture).toBeUndefined();
    expect(internal.currentDragMutation).toBeUndefined();
    expect(internal.activeInterior.furniture).toEqual(before);
    expect(internal.undoStore.canUndo).toBe(false);
  });

  it('clears active drag ownership and feedback on direct room switch and destroy', () => {
    const fake = fakeScene();
    const canvas = { dataset: {} as Record<string, string> };
    Object.assign(fake.scene, { game: { canvas } });
    const cutaway = new InteriorCutawaySystem(
      fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }),
    );
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    capture.handlers().toggleEdit();
    let sprite = fake.objects.find(({ interactive, destroyed, depth }) => interactive && !destroyed && depth > 0)!;
    const firstPointer = { ...pointerAt(sprite.x, sprite.y), id: 41 };
    sprite.emit('pointerdown', firstPointer);
    sprite.emit('dragstart', firstPointer);
    expect(canvas.dataset.interiorDragging).toBe('true');

    cutaway.open('network-lab');
    expect((cutaway as unknown as { furnitureDragCapture?: unknown }).furnitureDragCapture).toBeUndefined();
    expect(canvas.dataset.interiorDragging).toBeUndefined();
    expect(canvas.dataset.interiorDragTone).toBeUndefined();

    capture.handlers().toggleEdit();
    sprite = fake.objects.find(({ interactive, destroyed, depth }) => interactive && !destroyed && depth > 0)!;
    const secondPointer = { ...pointerAt(sprite.x, sprite.y), id: 42 };
    sprite.emit('pointerdown', secondPointer);
    sprite.emit('dragstart', secondPointer);
    expect(canvas.dataset.interiorDragging).toBe('true');

    cutaway.destroy();
    expect((cutaway as unknown as { furnitureDragCapture?: unknown }).furnitureDragCapture).toBeUndefined();
    expect(canvas.dataset.interiorDragging).toBeUndefined();
    expect(canvas.dataset.interiorDragTone).toBeUndefined();
  });

  it('keeps the first pointer as exclusive drag owner until its own drop commits', () => {
    const fake = fakeScene();
    const canvas = { dataset: {} as Record<string, string> };
    Object.assign(fake.scene, { game: { canvas } });
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const first = {
      id: 'owner-a', kind: 'plant' as const, point: { x: 3, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 98, rotation: 90 as const,
      scale: 1 as const, layer: 'surface' as const, blocksNavigation: false,
    };
    const second = {
      id: 'owner-b', kind: 'display' as const, point: { x: 8, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, assetId: 129, rotation: 270 as const,
      scale: 1 as const, layer: 'surface' as const, blocksNavigation: false,
    };
    const room: InteriorDefinition = {
      id: 'rest-cabin', label: 'Pointer ownership', width: 14, height: 9,
      floor: 'wood', wall: 'cream', furniture: [first, second], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean; activeDefinition: InteriorDefinition; activeInterior: InteriorDefinition;
      roomCell: number; selectedFurnitureId?: string;
      furnitureDragCapture?: { pointerId: number; furnitureId: string };
      currentDragCandidate?: { furniture: { id: string; point: { x: number; y: number } } };
      currentDragMutation?: { accepted: boolean; layout: InteriorDefinition['furniture'] };
      undoStore: { canUndo: boolean; reset(layout: InteriorDefinition['furniture']): void };
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.undoStore.reset(room.furniture);
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    const firstSprite = fake.objects.find(({ texture, interactive, destroyed }) =>
      texture === 'modern-office-v1.2-single-98' && interactive && !destroyed)!;
    const secondSprite = fake.objects.find(({ texture, interactive, destroyed }) =>
      texture === 'modern-office-v1.2-single-129' && interactive && !destroyed)!;
    const firstScale = firstSprite.scale;
    const pointerA = { ...pointerAt(firstSprite.x, firstSprite.y), id: 11 };
    const targetA = { ...pointerAt(firstSprite.x + internal.roomCell, firstSprite.y), id: 11 };

    firstSprite.emit('pointerdown', pointerA);
    firstSprite.emit('dragstart', pointerA);
    firstSprite.emit('drag', targetA, targetA.x, targetA.y);
    const ownerPreview = internal.currentDragMutation;

    expect(internal.furnitureDragCapture).toMatchObject({ pointerId: 11, furnitureId: first.id });
    expect(ownerPreview?.accepted).toBe(true);
    expect(firstSprite.scale).toBeGreaterThan(firstScale);
    expect(firstSprite.alpha).toBe(0.94);
    expect(canvas.dataset.interiorDragTone).toBe('valid');

    const pointerB = { ...pointerAt(secondSprite.x, secondSprite.y), id: 22 };
    secondSprite.emit('pointerdown', pointerB);
    secondSprite.emit('dragstart', pointerB);
    secondSprite.emit('drag', { ...pointerAt(secondSprite.x - internal.roomCell, secondSprite.y), id: 22 }, secondSprite.x - internal.roomCell, secondSprite.y);
    fake.emitInput('pointercancel', pointerB);
    fake.emitInput('pointerup', pointerB);
    secondSprite.emit('dragend', pointerB);

    expect(internal.furnitureDragCapture).toMatchObject({ pointerId: 11, furnitureId: first.id });
    expect(internal.currentDragMutation).toBe(ownerPreview);
    expect(internal.selectedFurnitureId).toBe(first.id);
    expect(room.furniture).toEqual([first, second]);
    expect(internal.undoStore.canUndo).toBe(false);

    firstSprite.emit('dragend', pointerA);

    expect(fake.scene.tweens.add).toHaveBeenLastCalledWith(expect.objectContaining({
      targets: expect.arrayContaining([firstSprite]), duration: 90,
      scaleX: expect.anything(), scaleY: expect.anything(), ease: 'Back.easeOut',
    }));
    expect(room.furniture.find(({ id }) => id === first.id)?.point).toEqual({ x: 4, y: 3 });
    expect(room.furniture.find(({ id }) => id === second.id)).toEqual(second);
    expect(room.furniture.map(({ rotation }) => rotation)).toEqual([90, 270]);
    expect(internal.undoStore.canUndo).toBe(true);
    expect(internal.furnitureDragCapture).toBeUndefined();
    expect(internal.currentDragCandidate).toBeUndefined();
    expect(internal.currentDragMutation).toBeUndefined();
  });

  it('refreshes an open cutaway for a changed viewport without discarding its draft', () => {
    const fake = fakeScene();
    const viewport = { width: 1_280, height: 720 };
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => viewport);
    cutaway.open('maker-workshop');
    const internal = cutaway as unknown as {
      root: FakeObject;
      roomCell: number;
      activeInterior: InteriorDefinition;
    };
    const firstRoot = internal.root;
    const firstCell = internal.roomCell;
    internal.activeInterior.furniture.push({
      id: 'unsaved-marker', kind: 'plant', point: { x: 9, y: 9 }, facing: 'up',
      supportedActions: [], icon: 'generic', assetId: 98, blocksNavigation: false,
    });
    viewport.width = 840;
    viewport.height = 480;

    cutaway.open('maker-workshop');

    expect(internal.root).not.toBe(firstRoot);
    expect(internal.roomCell).not.toBe(firstCell);
    expect(internal.activeInterior.furniture.some(({ id }) => id === 'unsaved-marker')).toBe(true);
  });

  it('rebuilds Phaser when the adaptive frame moves with the viewport', () => {
    const fake = fakeScene();
    const viewport = { width: 1_280, height: 720 };
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => viewport);
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    const firstRoot = (cutaway as unknown as { root: FakeObject }).root;
    viewport.width = 1_100;

    cutaway.open('rest-cabin');

    expect((cutaway as unknown as { root: FakeObject }).root).not.toBe(firstRoot);
    expect(capture.overlay.relayout).toHaveBeenCalledWith(cutawayLayoutForViewport(1_100, 720));
  });

  it('reflows an open cutaway when its embedded canvas changes size', () => {
    const fake = fakeScene();
    const viewport = { width: 1_280, height: 720 };
    const canvas = {};
    Object.assign(fake.scene, { game: { canvas } });
    let resize: (() => void) | undefined;
    const observe = vi.fn();
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(handler: () => void) { resize = handler; }
      observe = observe;
      disconnect = disconnect;
    });
    try {
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => viewport);
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');
      viewport.width = 840;
      viewport.height = 480;

      resize?.();

      expect(observe).toHaveBeenCalledWith(canvas);
      expect(capture.overlay.relayout).toHaveBeenCalledWith(cutawayLayoutForViewport(840, 480));
      expect(capture.model().editorLayout?.frame).toEqual(cutawayLayoutForViewport(840, 480));
      capture.handlers().toggleEdit();
      capture.handlers().toggleCatalog();
      expect((cutaway as unknown as { currentLayout: ReturnType<typeof cutawayLayoutForViewport> }).currentLayout)
        .toEqual(cutawayLayoutForViewport(840, 480));
      expect(capture.overlay.relayout).toHaveBeenLastCalledWith(cutawayLayoutForViewport(840, 480));
      cutaway.destroy();
      expect(disconnect).toHaveBeenCalledOnce();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('reprojects cached room labels when the canvas CSS rectangle changes', () => {
    let rect = { left: 10, top: 20, width: 768, height: 512 } as DOMRect;
    const overlay = new InteriorCutawayDomOverlay(() => rect);
    const replaceChildren = vi.fn();
    Object.assign(overlay, { labelLayer: { replaceChildren }, panel: { style: {} } });
    vi.stubGlobal('document', {
      createElement: () => ({
        className: '', dataset: {}, textContent: '', style: { transform: '' }, setAttribute: vi.fn(),
        getBoundingClientRect: () => ({ width: 26, height: 18 }),
      }),
    });
    try {
      overlay.setRoomLabels([{ id: 'agent:a', text: 'A', x: 384, y: 256, kind: 'agent' }]);
      const first = replaceChildren.mock.calls.at(-1)![0].style.transform;
      rect = { left: 30, top: 40, width: 384, height: 256 } as DOMRect;

      overlay.relayout(cutawayLayoutForViewport(1_280, 720));

      const second = replaceChildren.mock.calls.at(-1)![0].style.transform;
      expect(replaceChildren).toHaveBeenCalledTimes(2);
      expect(second).not.toBe(first);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('converts camera and root coordinates before marquee selection', () => {
    const fake = fakeScene();
    fake.scene.cameras.main.scrollX = 40;
    fake.scene.cameras.main.scrollY = 25;
    fake.scene.cameras.main.zoom = 2;
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    const target = {
      id: 'marquee-target', kind: 'plant' as const, assetId: 98, point: { x: 2, y: 2 },
      facing: 'up' as const, supportedActions: [], icon: 'generic' as const, blocksNavigation: false,
    };
    const room: InteriorDefinition = {
      id: 'rest-cabin', label: 'Marquee', width: 14, height: 9,
      floor: 'wood', wall: 'cream', furniture: [target], overflow: [],
    };
    const internal = cutaway as unknown as {
      editMode: boolean; activeInterior: InteriorDefinition; activeDefinition: InteriorDefinition;
      root: FakeObject; roomOrigin: { x: number; y: number }; roomCell: number;
      selectedFurnitureIds: Set<string>;
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeInterior = room;
    internal.activeDefinition = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    internal.root.x = 30;
    internal.root.y = 15;
    internal.root.scale = 1.5;
    const pointerForLocal = (local: { x: number; y: number }) => {
      const world = {
        x: internal.root.x + local.x * internal.root.scale,
        y: internal.root.y + local.y * internal.root.scale,
      };
      const raw = {
        x: (world.x - fake.scene.cameras.main.scrollX) * fake.scene.cameras.main.zoom,
        y: (world.y - fake.scene.cameras.main.scrollY) * fake.scene.cameras.main.zoom,
      };
      return {
        ...raw, camera: fake.scene.cameras.main,
        positionToCamera: () => ({
          x: fake.scene.cameras.main.scrollX + raw.x / fake.scene.cameras.main.zoom,
          y: fake.scene.cameras.main.scrollY + raw.y / fake.scene.cameras.main.zoom,
        }),
      };
    };
    fake.emitInput('pointerdown', pointerForLocal(roomScreenPoint(internal.roomOrigin, { x: 1, y: 1 }, internal.roomCell)), []);
    fake.emitInput('pointerup', pointerForLocal(roomScreenPoint(internal.roomOrigin, { x: 4, y: 4 }, internal.roomCell)));

    expect([...internal.selectedFurnitureIds]).toEqual([target.id]);
  });

  it('treats a clicked prefab instance atomically through move, scale, rotate, layer, z, duplicate, return, dissolve, and undo', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('maker-workshop');
    capture.handlers().toggleEdit();
    const internal = cutaway as unknown as {
      activeInterior: InteriorDefinition;
      activeDefinition: InteriorDefinition;
      roomCell: number;
      undoStore: { reset(layout: InteriorDefinition['furniture']): void };
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    const group = [
      {
        id: 'atomic-a', kind: 'plant' as const, assetId: 98, point: { x: 4, y: 3 }, facing: 'up' as const,
        supportedActions: [], icon: 'generic' as const, scale: 1 as const, rotation: 0 as const,
        layer: 'surface' as const, zIndex: 2, blocksNavigation: false, prefabInstanceId: 'atomic-instance',
        interactionPoint: { x: 4, y: 4 }, visualOffset: { x: 0.25, y: 0 },
      },
      {
        id: 'atomic-b', kind: 'display' as const, assetId: 129, point: { x: 6, y: 3 }, facing: 'up' as const,
        supportedActions: [], icon: 'generic' as const, scale: 1 as const, rotation: 0 as const,
        layer: 'surface' as const, zIndex: 4, blocksNavigation: false, prefabInstanceId: 'atomic-instance',
      },
    ];
    const peer = {
      id: 'atomic-peer', kind: 'plant' as const, assetId: 98, point: { x: 10, y: 3 }, facing: 'up' as const,
      supportedActions: [], icon: 'generic' as const, scale: 1 as const, rotation: 0 as const,
      layer: 'surface' as const, zIndex: 9, blocksNavigation: false,
    };
    const negativePeer = { ...peer, id: 'atomic-negative-peer', assetId: 129, point: { x: 12, y: 3 }, zIndex: -5 };
    internal.activeInterior.furniture = structuredClone([...group, peer, negativePeer]);
    internal.activeDefinition = internal.activeInterior;
    internal.undoStore.reset(internal.activeInterior.furniture);
    internal.renderFurniture(internal.activeInterior, cutawayLayoutForViewport(1_280, 720));

    const placed = (texture: string) => fake.objects.find((object) => (
      object.texture === texture && object.interactive && !object.destroyed && object.depth > 0
    ))!;
    const selectGroup = () => {
      const pointer = pointerAt(0, 0);
      placed('modern-office-v1.2-single-98').emit('pointerdown', pointer);
      fake.emitInput('pointerup', pointer);
    };
    const currentGroup = () => internal.activeInterior.furniture.filter(({ prefabInstanceId }) => prefabInstanceId === 'atomic-instance');

    selectGroup();
    expect(capture.model()).toMatchObject({ selectedCount: 2, canDuplicate: true, canDissolve: true });

    const first = placed('modern-office-v1.2-single-98');
    const beforeMove = structuredClone(currentGroup());
    const firstPointer = pointerAt(first.x, first.y);
    const movedPointer = pointerAt(first.x + internal.roomCell, first.y);
    first.emit('pointerdown', firstPointer);
    first.emit('dragstart', firstPointer);
    first.emit('drag', movedPointer, first.x + internal.roomCell, first.y);
    first.emit('dragend', movedPointer);
    expect(currentGroup().map(({ point }) => point)).toEqual(beforeMove.map(({ point }) => ({ x: point.x + 1, y: point.y })));
    expect(currentGroup()[1]!.point.x - currentGroup()[0]!.point.x).toBe(2);
    capture.handlers().undo();
    expect(currentGroup()).toEqual(group);

    selectGroup();
    capture.handlers().resize(1);
    expect(currentGroup().map(({ scale }) => scale)).toEqual([1.25, 1.25]);
    expect(currentGroup()[1]!.point.x - currentGroup()[0]!.point.x).toBe(2.5);
    capture.handlers().undo();

    selectGroup();
    capture.handlers().rotate(90);
    expect(currentGroup().map(({ point }) => point)).toEqual([{ x: 5, y: 2 }, { x: 5, y: 4 }]);
    expect(currentGroup().map(({ rotation }) => rotation)).toEqual([90, 90]);
    expect(currentGroup()[0]!.interactionPoint).toEqual({ x: 4, y: 2 });
    capture.handlers().undo();

    selectGroup();
    capture.handlers().shiftLayer('next');
    expect(currentGroup().map(({ layer }) => layer)).toEqual(['wall', 'wall']);
    capture.handlers().shiftLayer('next');
    expect(currentGroup().map(({ layer }) => layer)).toEqual(['wall', 'wall']);
    expect(capture.model().statusId).toBe('layerShiftRejected');
    capture.handlers().undo();

    selectGroup();
    capture.handlers().reorder('back');
    expect(currentGroup().map(({ zIndex }) => zIndex)).toEqual([-8, -6]);
    capture.handlers().undo();
    expect(currentGroup()).toEqual(group);

    selectGroup();
    capture.handlers().reorder('front');
    expect(currentGroup().map(({ zIndex }) => zIndex)).toEqual([10, 12]);
    capture.handlers().undo();

    selectGroup();
    capture.handlers().duplicate();
    const duplicated = internal.activeInterior.furniture.filter(({ prefabInstanceId }) => (
      prefabInstanceId && prefabInstanceId !== 'atomic-instance'
    ));
    expect(duplicated).toHaveLength(2);
    expect(duplicated.every(({ id }) => !group.some((source) => source.id === id))).toBe(true);
    expect(new Set(duplicated.map(({ prefabInstanceId }) => prefabInstanceId)).size).toBe(1);
    capture.handlers().undo();

    selectGroup();
    capture.handlers().returnToShelf();
    expect(currentGroup()).toEqual([]);
    capture.handlers().undo();
    expect(currentGroup()).toEqual(group);

    selectGroup();
    capture.handlers().dissolveGroup();
    expect(internal.activeInterior.furniture.filter(({ id }) => group.some((source) => source.id === id))
      .every(({ prefabInstanceId }) => prefabInstanceId === undefined)).toBe(true);
    placed('modern-office-v1.2-single-98').emit('pointerdown', pointerAt(0, 0));
    expect(capture.model().selectedCount).toBe(1);
    capture.handlers().returnToShelf();
    expect(internal.activeInterior.furniture.some(({ id }) => id === 'atomic-a')).toBe(false);
    expect(internal.activeInterior.furniture.some(({ id }) => id === 'atomic-b')).toBe(true);
  });

  it('rejects an invalid Research bench layer shift without runtime mutation or undo pollution', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('network-lab');
    capture.handlers().toggleEdit();
    const internal = cutaway as unknown as {
      activeInterior: InteriorDefinition;
      selectedFurnitureIds: Set<string>;
      selectedFurnitureId?: string;
      undoStore: { reset(layout: InteriorDefinition['furniture']): void; canUndo: boolean };
    };
    const bench = internal.activeInterior.furniture.filter(({ prefabInstanceId }) => (
      prefabInstanceId?.includes('bench-four-1')
    ));
    const before = structuredClone(internal.activeInterior.furniture);
    internal.selectedFurnitureIds = new Set(bench.map(({ id }) => id));
    internal.selectedFurnitureId = bench[0]!.id;
    internal.undoStore.reset(internal.activeInterior.furniture);

    capture.handlers().shiftLayer('next');

    expect(internal.activeInterior.furniture).toEqual(before);
    expect(internal.undoStore.canUndo).toBe(false);
    expect(capture.model().statusId).toBe('layerShiftRejected');
    capture.handlers().undo();
    expect(internal.activeInterior.furniture).toEqual(before);
  });

  it('previews without mutation or storage, applies a valid compact template in memory, and undoes it', () => {
    const storage = { getItem: vi.fn(() => null), setItem: vi.fn() };
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn(), prompt: vi.fn() });
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');
      capture.handlers().toggleEdit();
      capture.handlers().collect();
      const beforePreview = structuredClone((cutaway as unknown as { activeInterior: InteriorDefinition }).activeInterior.furniture);

      capture.handlers().previewTemplate();

      expect((cutaway as unknown as { activeInterior: InteriorDefinition }).activeInterior.furniture).toEqual(beforePreview);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(capture.model()).toMatchObject({ templatePreviewing: true, templateValid: true });
      expect(fake.objects.some(({ alpha, destroyed }) => alpha === 0.36 && !destroyed)).toBe(true);

      capture.handlers().applyTemplate();
      expect((cutaway as unknown as { activeInterior: InteriorDefinition }).activeInterior.furniture.length).toBeGreaterThan(0);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(capture.model()).toMatchObject({ templatePreviewing: false, canUndo: true, statusId: 'templateApplied' });

      capture.handlers().undo();
      expect((cutaway as unknown as { activeInterior: InteriorDefinition }).activeInterior.furniture).toEqual([]);
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(capture.model()).toMatchObject({ statusId: 'undoApplied' });
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it.each(['arrival-lodge', 'awaiting-post', 'offline-dormitory'] as const)(
    'enables Preview and Apply for the valid compact template in %s',
    (buildingId) => {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open(buildingId);
      capture.handlers().toggleEdit();
      capture.handlers().previewTemplate();
      expect(capture.model()).toMatchObject({ templatePreviewing: true, templateValid: true });
    },
  );

  it('reports an invalid template through the model and refuses Apply', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    capture.handlers().toggleEdit();
    const internal = cutaway as unknown as { activeDefinition: InteriorDefinition; activeInterior: InteriorDefinition };
    internal.activeDefinition.furniture.push({
      id: 'invalid-outside', kind: 'desk', point: { x: -20, y: -20 }, facing: 'up',
      supportedActions: ['terminal'], icon: 'tool', assetId: 193, blocksNavigation: true,
    });
    const before = internal.activeInterior.furniture;

    capture.handlers().previewTemplate();
    expect(capture.model()).toMatchObject({ templatePreviewing: true, templateValid: false });
    expect(capture.model().templateDiagnostics).toContain('templateInvalid');
    capture.handlers().applyTemplate();
    expect(internal.activeInterior.furniture).toBe(before);
  });

  it('shows Dissolve only for one selected instance, dissolves it atomically, and supports Undo', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('maker-workshop');
    capture.handlers().toggleEdit();
    const internal = cutaway as unknown as {
      activeInterior: InteriorDefinition;
      selectedFurnitureIds: Set<string>;
      selectedFurnitureId?: string;
      syncOverlay(): void;
    };
    const instanceId = internal.activeInterior.furniture.find(({ prefabInstanceId }) => prefabInstanceId)?.prefabInstanceId!;
    const instance = internal.activeInterior.furniture.filter(({ prefabInstanceId }) => prefabInstanceId === instanceId);
    instance.forEach(({ id }) => internal.selectedFurnitureIds.add(id));
    internal.selectedFurnitureId = instance[0]!.id;
    internal.syncOverlay();
    expect(capture.model().canDissolve).toBe(true);

    capture.handlers().dissolveGroup();
    expect(internal.activeInterior.furniture.filter(({ id }) => instance.some((item) => item.id === id))
      .every(({ prefabInstanceId }) => prefabInstanceId === undefined)).toBe(true);
    expect(capture.model()).toMatchObject({ canDissolve: false, statusId: 'groupDissolved' });

    capture.handlers().undo();
    expect(internal.activeInterior.furniture.filter(({ id }) => instance.some((item) => item.id === id))
      .every(({ prefabInstanceId }) => prefabInstanceId === instanceId)).toBe(true);
  });

  it('survives throwing storage reads and localizes failed Save, Copy, and assembly writes', () => {
    const readWindow = { get localStorage(): Storage { throw new Error('storage denied'); }, dispatchEvent: vi.fn() };
    vi.stubGlobal('window', readWindow);
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    const capture = captureCutawayHandlers(cutaway);
    expect(() => cutaway.open('rest-cabin')).not.toThrow();
    expect(() => capture.handlers().save()).not.toThrow();
    expect(capture.model().statusId).toBe('storageFailed');
    vi.stubGlobal('window', {
      localStorage: { getItem: vi.fn(() => null), setItem: vi.fn(() => { throw new Error('storage full'); }) },
      dispatchEvent: vi.fn(), prompt: vi.fn(() => 'Desk group'),
    });
    capture.handlers().toggleEdit();

    expect(() => capture.handlers().save()).not.toThrow();
    expect(capture.model().statusId).toBe('storageFailed');
    expect(() => capture.handlers().copy()).not.toThrow();
    expect(capture.model().statusId).toBe('storageFailed');
    expect(cutaway.isOpen()).toBe(true);

    const internal = cutaway as unknown as {
      activeInterior: InteriorDefinition;
      selectedFurnitureIds: Set<string>;
      selectedFurnitureId?: string;
    };
    const ordinary = internal.activeInterior.furniture.filter(({ supportedActions, requirementId }) =>
      supportedActions.length === 0 && !requirementId).slice(0, 2);
    ordinary.forEach(({ id }) => internal.selectedFurnitureIds.add(id));
    internal.selectedFurnitureId = ordinary[0]!.id;
    expect(() => capture.handlers().group()).not.toThrow();
    expect(capture.model().statusId).toBe('storageFailed');
    vi.unstubAllGlobals();
  });

  it('blocks ordinary Save after an unknown layout read until a successful Revert retry', () => {
    const saved = JSON.stringify({
      version: 5, authoredRevision: 2,
      furniture: [{
        id: 'saved-chair', kind: 'chair', point: { x: 2, y: 2 }, facing: 'up',
        supportedActions: [], icon: 'generic', scale: 1, rotation: 0,
      }],
    });
    let failedLayoutRead = false;
    const storage = {
      getItem: vi.fn((key: string) => {
        if (key.includes('interior-layout') && !failedLayoutRead) {
          failedLayoutRead = true;
          throw new Error('temporarily blocked');
        }
        return key.includes('interior-layout') ? saved : null;
      }),
      setItem: vi.fn(),
    };
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn(), prompt: vi.fn() });
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');

      expect(capture.model()).toMatchObject({ statusId: 'storageFailed', saveBlocked: true });
      capture.handlers().save();
      expect(storage.setItem).not.toHaveBeenCalled();

      capture.handlers().revert();
      expect(capture.model().saveBlocked).toBe(false);
      expect((cutaway as unknown as { activeInterior: InteriorDefinition }).activeInterior.furniture)
        .toEqual(expect.arrayContaining([expect.objectContaining({ id: 'saved-chair' })]));
      capture.handlers().save();
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('lets explicit Apply establish layout intent after a failed saved-layout read', () => {
    const storage = {
      getItem: vi.fn((key: string) => {
        if (key.includes('interior-layout')) throw new Error('blocked');
        return null;
      }),
      setItem: vi.fn(),
    };
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn(), prompt: vi.fn() });
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');
      capture.handlers().toggleEdit();
      capture.handlers().previewTemplate();
      capture.handlers().applyTemplate();

      expect(capture.model().saveBlocked).toBe(false);
      capture.handlers().save();
      expect(storage.setItem).toHaveBeenCalledTimes(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('surfaces failed prefab and clipboard reads once without model-render read loops', () => {
    const storage = {
      getItem: vi.fn(() => { throw new Error('blocked'); }),
      setItem: vi.fn(),
    };
    vi.stubGlobal('window', { localStorage: storage, dispatchEvent: vi.fn(), prompt: vi.fn() });
    try {
      const fake = fakeScene();
      const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
      const capture = captureCutawayHandlers(cutaway);
      cutaway.open('rest-cabin');
      const readsAfterOpen = storage.getItem.mock.calls.length;

      expect(capture.model().statusId).toBe('storageFailed');
      capture.handlers().toggleEdit();
      capture.handlers().cancelSelection();
      expect(capture.model().statusId).toBe('storageFailed');
      expect(storage.getItem).toHaveBeenCalledTimes(readsAfterOpen);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('keeps canvas text out of the cutaway header so DOM text stays crisp', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    expect(fake.objects.some(({ text }) => text === '移動家具' || text === '儲存配置')).toBe(false);
  });
});

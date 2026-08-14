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
  setTint(): this { this.tinted = true; return this; }
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
  removeAll(destroy = false): this { if (destroy) this.children.forEach((child) => child.destroy()); this.children = []; return this; }
  sort(property: keyof FakeObject): this {
    this.children.sort((first, second) => Number(first[property]) - Number(second[property]));
    return this;
  }
  fillStyle(): this { return this; }
  fillRect(): this { return this; }
  clear(): this { return this; }
  lineStyle(): this { return this; }
  lineBetween(): this { return this; }
  strokeRect(): this { return this; }
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
  const element = () => {
    const listeners = new Map<string, Array<() => void>>();
    const target = {
      hidden: false, disabled: false, textContent: '', className: '', dataset: {} as Record<string, string>,
      style: {} as Record<string, string>, children: [] as object[],
      scrollHeight: 240,
      onclick: undefined as (() => void) | undefined,
      addEventListener: vi.fn((event: string, handler: () => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), handler]);
      }),
      click() {
        if (target.disabled) return;
        for (const handler of listeners.get('click') ?? []) handler();
        target.onclick?.();
      },
      remove: vi.fn(),
      append(...children: object[]) { target.children.push(...children); },
      replaceChildren(...children: object[]) { target.children = children; },
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
  const header = element(); const toolbar = element(); const guide = element(); const nav = element(); const page = element();
  const panel = {
    ...element(), innerHTML: '',
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 720, height: 495 }),
    querySelector(selector: string) {
      if (selector === 'h2') return title;
      if (selector === '.cutaway-dom-status') return status;
      if (selector === '.cutaway-dom-header') return header;
      if (selector === '.cutaway-dom-catalog') return catalog;
      if (selector === '.cutaway-dom-inspector') return inspector;
      if (selector === '.cutaway-context-toolbar') return toolbar;
      if (selector === '.cutaway-guide-popover') return guide;
      if (selector === '.cutaway-dom-categories') return nav;
      if (selector === '.cutaway-dom-page span') return page;
      const action = selector.match(/\[data-action="([^"]+)"\]/)?.[1];
      return action ? actions.get(action) : undefined;
    },
  };
  const host = { append: vi.fn() };
  vi.stubGlobal('document', {
    querySelector: () => host,
    createElement: (tag: string) => tag === 'section' && !host.append.mock.calls.length ? panel : element(),
  });
  const overlay = new InteriorCutawayDomOverlay(() => ({ left: 0, top: 0, width: 768, height: 448 }) as DOMRect);
  const handlers = Object.fromEntries([
    'close', 'toggleEdit', 'toggleCatalog', 'toggleInspector', 'toggleGuide', 'fitView', 'save', 'undo',
    'previewTemplate', 'applyTemplate', 'category', 'page', 'resize', 'rotate', 'collect', 'revert',
    'copy', 'paste', 'group', 'dissolveGroup', 'shiftLayer', 'reorder', 'duplicate', 'returnToShelf',
    'cancelSelection',
  ].map((name) => [name, vi.fn()])) as unknown as CutawayDomHandlers;
  return { overlay, handlers, panel, header, catalog, inspector, toolbar, actions };
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

  it('keeps Properties unavailable when the compact layout cannot reserve an inspector', () => {
    const { overlay, handlers, actions, inspector } = overlayDomHarness();
    try {
      const layout = cutawayLayoutForViewport(600, 320);
      const editorLayout = editorLayoutForCutaway(layout, {
        editMode: true, catalogExpanded: false, inspectorExpanded: false,
      });
      overlay.open(layout, cutawayDomModel({
        editMode: true, selected: selectedFurniture(), editorLayout,
      }), handlers);

      const properties = actions.get('inspector')!;
      expect(properties.disabled).toBe(true);
      properties.click();
      expect(handlers.toggleInspector).not.toHaveBeenCalled();
      expect(inspector.hidden).toBe(true);
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
      expect(catalog.style.height).toBe(`${editorLayout.catalog.height / layout.height * 100}%`);
      expect(catalog.style.height).not.toBe(`${112 / layout.height * 100}%`);
      expect(inspector.style.width).toBe('0%');
      expect(inspector.hidden).toBe(true);
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
      };
      const originalRotations = internal.activeInterior.furniture.map(({ rotation }) => rotation);
      const sprite = fake.objects.find(({ interactive, destroyed, depth }) => interactive && !destroyed && depth > 0)!;

      sprite.emit('dragstart', { ...pointerAt(sprite.x, sprite.y), id: 7 });
      sprite.emit('drag', { ...pointerAt(sprite.x - internal.roomCell * 50, sprite.y), id: 7 }, -999, sprite.y);

      expect(storage.setItem).not.toHaveBeenCalled();
      expect(internal.undoStore.canUndo).toBe(false);
      expect(internal.activeInterior.furniture.map(({ rotation }) => rotation)).toEqual(originalRotations);
    } finally {
      vi.unstubAllGlobals();
    }
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
      createElement: () => ({ className: '', dataset: {}, textContent: '', style: { transform: '' }, setAttribute: vi.fn() }),
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

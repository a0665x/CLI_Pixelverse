import { describe, expect, it, vi } from 'vitest';
import {
  InteriorCutawaySystem,
  dragPreviewScreenPoint,
  cutawayLayoutForViewport,
  cutawayContainsPointer,
  hookFurnitureLabel,
} from '../src/rendering/InteriorCutawaySystem';
import {
  selectionCapabilities,
  type CutawayDomHandlers,
  type CutawayDomModel,
} from '../src/rendering/InteriorCutawayDomOverlay';
import type { InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
import { BUILT_IN_OFFICE_PREFABS } from '../src/rendering/builtInOfficePrefabs';
import type { InteriorDefinition } from '../src/world/types';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

class FakeObject {
  x = 0;
  y = 0;
  alpha = 1;
  visible = true;
  destroyed = false;
  interactive = false;
  text = '';
  texture = '';
  scale = 1;
  resolution = 1;
  tinted = false;
  width = 0;
  height = 0;
  children: FakeObject[] = [];
  private readonly handlers = new Map<string, Array<(...args: unknown[]) => void>>();
  constructor(texture = '') { this.texture = texture; }
  setOrigin(): this { return this; }
  setDepth(): this { return this; }
  setScrollFactor(): this { return this; }
  setInteractive(): this { this.interactive = true; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  getLocalPoint(x: number, y: number): { x: number; y: number } { return { x, y }; }
  setScale(scale: number): this { this.scale = scale; return this; }
  setSize(width: number, height: number): this { this.width = width; this.height = height; return this; }
  setAngle(): this { return this; }
  setResolution(resolution: number): this { this.resolution = resolution; return this; }
  setTint(): this { this.tinted = true; return this; }
  setTexture(): this { return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setText(text: string): this { this.text = text; return this; }
  setStrokeStyle(): this { return this; }
  add(items: FakeObject | FakeObject[]): this { this.children.push(...(Array.isArray(items) ? items : [items])); return this; }
  removeAll(destroy = false): this { if (destroy) this.children.forEach((child) => child.destroy()); this.children = []; return this; }
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
  const make = (texture = '') => { const object = new FakeObject(texture); objects.push(object); return object; };
  return {
    objects,
    scene: {
      add: {
        container: vi.fn(() => make()), rectangle: vi.fn(() => make()), text: vi.fn((_x, _y, text: string) => { const object = make(); object.text = text; return object; }),
        image: vi.fn((_x, _y, texture: string) => make(texture)), graphics: vi.fn(() => make()), zone: vi.fn(() => make()),
      },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })), killTweensOf: vi.fn() },
      input: { keyboard: { on: vi.fn(), off: vi.fn() }, setDraggable: vi.fn() },
      time: { now: 0 },
      cameras: { main: { scrollX: 0, scrollY: 0, zoom: 1 } },
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

const captureCutawayHandlers = (cutaway: InteriorCutawaySystem) => {
  let handlers: CutawayDomHandlers | undefined;
  let model: CutawayDomModel | undefined;
  const overlay = {
    open: vi.fn((_layout, nextModel: CutawayDomModel, nextHandlers: CutawayDomHandlers) => {
      model = nextModel;
      handlers = nextHandlers;
    }),
    update: vi.fn((nextModel: CutawayDomModel) => { model = nextModel; }),
    setLocale: vi.fn(), setRoomLabels: vi.fn(), close: vi.fn(), destroy: vi.fn(),
  };
  Object.assign(cutaway, { domOverlay: overlay });
  return {
    overlay,
    handlers: () => handlers!,
    model: () => model!,
  };
};

describe('InteriorCutawaySystem', () => {
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

  it('labels only hook furniture with readable action-oriented text', () => {
    expect(hookFurnitureLabel({
      id: 'hook', kind: 'computer', point: { x: 1, y: 1 }, facing: 'up', icon: 'web',
      supportedActions: ['signal', 'terminal'],
    })).toBe('WEB / MCP / 工具調用');
    expect(hookFurnitureLabel({
      id: 'decor', kind: 'plant', point: { x: 1, y: 1 }, facing: 'up', icon: 'generic', supportedActions: [],
    })).toBe('');
  });

  it('uses the approved centered desktop and narrow viewport layouts', () => {
    expect(cutawayLayoutForViewport(1_280, 720)).toMatchObject({ width: 480, height: 330, x: 144, y: 59 });
    expect(cutawayLayoutForViewport(840, 480)).toMatchObject({ width: 608, height: 360, x: 80, y: 44 });
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
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));

    const bench = BUILT_IN_OFFICE_PREFABS[0]!;
    const preview = fake.objects.find((object) => object.interactive &&
      object.children.filter(({ texture }) => texture.startsWith('modern-office')).length === bench.items.length);
    expect(preview).toBeDefined();
    const previewParts = preview!.children.filter(({ texture }) => texture.startsWith('modern-office'));
    expect(previewParts).toHaveLength(bench.items.length);
    expect(previewParts.every(({ tinted }) => !tinted)).toBe(true);

    const anchor = { x: 2.12, y: 2.12 };
    const pointer = dragPreviewScreenPoint(internal.roomOrigin, anchor);
    preview!.emit('dragstart', pointerAt(pointer.x - 20, pointer.y - 20));
    preview!.emit('drag', pointerAt(pointer.x, pointer.y), -320, 850);
    const ghosts = fake.objects.filter(({ alpha, destroyed }) => alpha === 0.72 && !destroyed);
    expect(ghosts).toHaveLength(bench.items.length);
    expect(ghosts[0]).toMatchObject({
      x: pointer.x + (bench.items[0]!.point.x - bench.anchor.x) * 22,
      y: pointer.y + (bench.items[0]!.point.y - bench.anchor.y) * 22,
    });

    preview!.emit('dragend', pointerAt(pointer.x + 200, pointer.y + 200), 7, 9);
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
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
    internal.activeDefinition = room;
    internal.activeInterior = room;
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));

    const bench = BUILT_IN_OFFICE_PREFABS[0]!;
    const preview = fake.objects.find((object) => object.interactive &&
      object.children.filter(({ texture }) => texture.startsWith('modern-office')).length === bench.items.length)!;
    const pointer = dragPreviewScreenPoint(internal.roomOrigin, { x: 3.12, y: 2.88 });

    preview.emit('dragstart', pointerAt(pointer.x, pointer.y));
    preview.emit('dragend', pointerAt(pointer.x + 300, pointer.y + 300), -12, -8);

    expect(room.furniture).toHaveLength(bench.items.length);
    expect(room.furniture[0]!.point).toEqual({ x: 3, y: 4 });
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

  it('keeps canvas text out of the cutaway header so DOM text stays crisp', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    expect(fake.objects.some(({ text }) => text === '移動家具' || text === '儲存配置')).toBe(false);
  });
});

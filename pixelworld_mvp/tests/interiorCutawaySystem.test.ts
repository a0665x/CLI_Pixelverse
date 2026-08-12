import { describe, expect, it, vi } from 'vitest';
import {
  InteriorCutawaySystem,
  dragPreviewScreenPoint,
  cutawayLayoutForViewport,
  cutawayContainsPointer,
  furnitureRenderScreenPoint,
  furnitureRenderScreenGeometry,
  hookFurnitureLabel,
  interiorAgentRenderDepth,
  interiorFurnitureRenderDepth,
  roomCellForLayout,
  roomOriginForLayout,
  roomPointForScreen,
  roomScreenPoint,
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
        image: vi.fn((_x, _y, texture: string) => make(texture)), graphics: vi.fn(() => make()), zone: vi.fn(() => make()),
      },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })), killTweensOf: vi.fn() },
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

  it('fits an 18x12 work office inside the cutaway content area with a readable cell', () => {
    const cell = roomCellForLayout(
      { width: 18, height: 12 },
      { x: 80, y: 44, width: 608, height: 360 },
    );
    expect(cell).toBeGreaterThanOrEqual(12);
    expect(cell * 18).toBeLessThanOrEqual(584);
    expect(cell * 12).toBeLessThanOrEqual(250);
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
    const cell = roomCellForLayout({ width: 80, height: 40 }, layout);
    expect(cell * 80).toBeLessThanOrEqual(layout.width - 24);
    expect(cell * 40).toBeLessThanOrEqual(layout.height - 110);
    const subpixel = roomCellForLayout({ width: 1_000, height: 1_000 }, layout);
    expect(subpixel * 1_000).toBeLessThanOrEqual(layout.height - 110);
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
      roomCell: number;
      root: FakeObject;
      renderFurniture(interior: InteriorDefinition, layout: ReturnType<typeof cutawayLayoutForViewport>): void;
    };
    internal.editMode = true;
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

    sprite.emit('drag', undefined, sprite.x, sprite.y);
    expect(internal.currentDragCandidate?.furniture.point).toEqual(furniture.point);
    sprite.emit('dragend');

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
    sprite.emit('dragstart', pointerForLocal(grab));
    sprite.emit('drag', pointerForLocal(grab), -999, 999);
    expect(internal.currentDragCandidate?.furniture.point).toEqual(furniture.point);

    sprite.emit('drag', pointerForLocal({ x: grab.x + 2, y: grab.y - 2 }), -999, 999);
    expect(internal.currentDragCandidate?.furniture.point).toEqual(furniture.point);
    internal.renderFurniture(room, cutawayLayoutForViewport(1_280, 720));
    expect(internal.currentDragCandidate).toBeUndefined();
    expect(room.furniture.find(({ id }) => id === furniture.id)?.point).toEqual(furniture.point);
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

  it('refreshes the DOM overlay without rebuilding Phaser inside the same breakpoint', () => {
    const fake = fakeScene();
    const viewport = { width: 1_280, height: 720 };
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => viewport);
    const capture = captureCutawayHandlers(cutaway);
    cutaway.open('rest-cabin');
    const firstRoot = (cutaway as unknown as { root: FakeObject }).root;
    viewport.width = 1_100;

    cutaway.open('rest-cabin');

    expect((cutaway as unknown as { root: FakeObject }).root).toBe(firstRoot);
    expect(capture.overlay.relayout).toHaveBeenCalledWith(cutawayLayoutForViewport(1_100, 720));
  });

  it('reprojects cached room labels when the canvas CSS rectangle changes', () => {
    let rect = { left: 10, top: 20, width: 768, height: 512 } as DOMRect;
    const overlay = new InteriorCutawayDomOverlay(() => rect);
    const replaceChildren = vi.fn();
    Object.assign(overlay, { labelLayer: { replaceChildren }, panel: { style: {} } });
    vi.stubGlobal('document', {
      createElement: () => ({ className: '', dataset: {}, textContent: '', style: { transform: '' } }),
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

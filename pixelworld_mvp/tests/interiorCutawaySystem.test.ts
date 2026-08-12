import { describe, expect, it, vi } from 'vitest';
import {
  InteriorCutawaySystem,
  dragPreviewScreenPoint,
  cutawayLayoutForViewport,
  cutawayContainsPointer,
  hookFurnitureLabel,
} from '../src/rendering/InteriorCutawaySystem';
import { selectionCapabilities } from '../src/rendering/InteriorCutawayDomOverlay';
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

  it('renders every built-in prefab part without tint and drags the group as one atomic preview', () => {
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

    preview!.emit('dragstart');
    const pointer = dragPreviewScreenPoint(internal.roomOrigin, { x: 2, y: 2 });
    preview!.emit('drag', {}, pointer.x + 0.13, pointer.y + 0.19);
    const ghosts = fake.objects.filter(({ alpha, destroyed }) => alpha === 0.72 && !destroyed);
    expect(ghosts).toHaveLength(bench.items.length);
    expect(ghosts[0]).toMatchObject({
      x: pointer.x + 0.13 + (bench.items[0]!.point.x - bench.anchor.x) * 22,
      y: pointer.y + 0.19 + (bench.items[0]!.point.y - bench.anchor.y) * 22,
    });

    preview!.emit('dragend', {}, pointer.x, pointer.y);
    expect(room.furniture).toHaveLength(bench.items.length);
    expect(room.furniture.every(({ prefabInstanceId }) => prefabInstanceId === room.furniture[0]!.prefabInstanceId)).toBe(true);
    expect(room.furniture.some(({ supportedActions }) => supportedActions.length > 0)).toBe(true);
  });

  it('keeps canvas text out of the cutaway header so DOM text stays crisp', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));
    cutaway.open('rest-cabin');
    expect(fake.objects.some(({ text }) => text === '移動家具' || text === '儲存配置')).toBe(false);
  });
});

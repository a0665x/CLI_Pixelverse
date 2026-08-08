import { describe, expect, it, vi } from 'vitest';
import {
  InteriorCutawaySystem,
  cutawayLayoutForViewport,
} from '../src/rendering/InteriorCutawaySystem';
import type { InteriorAgentSnapshot } from '../src/rendering/interiorAssignment';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

class FakeObject {
  x = 0;
  y = 0;
  alpha = 1;
  visible = true;
  destroyed = false;
  interactive = false;
  text = '';
  children: FakeObject[] = [];
  setOrigin(): this { return this; }
  setDepth(): this { return this; }
  setScrollFactor(): this { return this; }
  setInteractive(): this { this.interactive = true; return this; }
  setPosition(x: number, y: number): this { this.x = x; this.y = y; return this; }
  setScale(): this { return this; }
  setTint(): this { return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  setVisible(visible: boolean): this { this.visible = visible; return this; }
  setText(text: string): this { this.text = text; return this; }
  setStrokeStyle(): this { return this; }
  add(items: FakeObject | FakeObject[]): this { this.children.push(...(Array.isArray(items) ? items : [items])); return this; }
  removeAll(destroy = false): this { if (destroy) this.children.forEach((child) => child.destroy()); this.children = []; return this; }
  fillStyle(): this { return this; }
  fillRect(): this { return this; }
  lineStyle(): this { return this; }
  strokeRect(): this { return this; }
  on(): this { return this; }
  off(): this { return this; }
  destroy(): void { this.destroyed = true; }
}

const fakeScene = () => {
  const objects: FakeObject[] = [];
  const make = () => { const object = new FakeObject(); objects.push(object); return object; };
  return {
    objects,
    scene: {
      add: {
        container: vi.fn(() => make()), rectangle: vi.fn(() => make()), text: vi.fn((_x, _y, text: string) => { const object = make(); object.text = text; return object; }),
        image: vi.fn(() => make()), graphics: vi.fn(() => make()), zone: vi.fn(() => make()),
      },
      tweens: { add: vi.fn(() => ({ stop: vi.fn() })), killTweensOf: vi.fn() },
      input: { keyboard: { on: vi.fn(), off: vi.fn() } },
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
  it('uses the approved centered desktop and narrow viewport layouts', () => {
    expect(cutawayLayoutForViewport(1_280, 720)).toMatchObject({ width: 480, height: 288, x: 80, y: 32 });
    expect(cutawayLayoutForViewport(840, 480)).toMatchObject({ width: 608, height: 320, x: 16, y: 16 });
  });

  it('opens any house, projects matching occupants, and closes idempotently', () => {
    const fake = fakeScene();
    const cutaway = new InteriorCutawaySystem(fake.scene as never, WORLD_DEFINITION, () => ({ width: 1_280, height: 720 }));

    cutaway.open('rest-cabin');
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
});

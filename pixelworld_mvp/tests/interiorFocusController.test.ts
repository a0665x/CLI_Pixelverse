import { describe, expect, it } from 'vitest';
import { InteriorFocusController, type InteriorFocusTarget } from '../src/rendering/InteriorFocusController';

function fakeTarget(initialVisible: boolean): InteriorFocusTarget & {
  visibilityWrites(): boolean[];
} {
  let currentVisible = initialVisible;
  const writes: boolean[] = [];
  return {
    visible: () => currentVisible,
    setVisible: (visible) => {
      writes.push(visible);
      currentVisible = visible;
    },
    visibilityWrites: () => writes,
  };
}

describe('InteriorFocusController', () => {
  it('hides every registered exterior target and restores its current visibility', () => {
    const building = fakeTarget(true);
    const zone = fakeTarget(false);
    const controller = new InteriorFocusController([building, zone]);

    controller.setFocused(true);
    expect(building.visible()).toBe(false);
    expect(zone.visible()).toBe(false);

    controller.setFocused(false);
    expect(building.visible()).toBe(true);
    expect(zone.visible()).toBe(false);
  });

  it('keeps labels hidden while switching directly between interiors', () => {
    const label = fakeTarget(true);
    const controller = new InteriorFocusController([label]);

    controller.setFocused(true);
    controller.setFocused(true);

    expect(label.visibilityWrites()).toEqual([false]);
  });

  it('hides targets registered while focused and restores their visibility on exit', () => {
    const controller = new InteriorFocusController();
    const label = fakeTarget(true);

    controller.setFocused(true);
    controller.register(label);
    expect(label.visible()).toBe(false);

    controller.setFocused(false);
    expect(label.visible()).toBe(true);
  });

  it('restores a focused target before unregistering it', () => {
    const label = fakeTarget(true);
    const controller = new InteriorFocusController([label]);

    controller.setFocused(true);
    controller.register(label)();

    expect(label.visible()).toBe(true);
  });
});

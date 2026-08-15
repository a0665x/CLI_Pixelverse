import { describe, expect, it } from 'vitest';
import {
  contextActions,
  placeContextMenu,
} from '../src/rendering/interiorContextMenu';

describe('interior context menu', () => {
  it('offers exactly four single-item actions', () => {
    expect(contextActions({ itemIds: ['chair'], grouped: false }))
      .toEqual(['duplicate', 'rotate', 'resize', 'return']);
  });

  it('offers exactly four multi-item actions with the correct group operation', () => {
    expect(contextActions({ itemIds: ['a', 'b'], grouped: false }))
      .toEqual(['group', 'duplicate', 'rotate', 'return']);
    expect(contextActions({ itemIds: ['a', 'b'], grouped: true }))
      .toEqual(['dissolve', 'duplicate', 'rotate', 'return']);
  });

  it('has no actions without a selection', () => {
    expect(contextActions({ itemIds: [], grouped: false })).toEqual([]);
  });

  it.each([
    [{ x: 102, y: 72 }, { x: 110, y: 80 }],
    [{ x: 598, y: 72 }, { x: 410, y: 80 }],
    [{ x: 102, y: 430 }, { x: 110, y: 306 }],
    [{ x: 598, y: 430 }, { x: 410, y: 306 }],
  ])('flips at each room corner and contains the complete menu at %o', (pointer, expected) => {
    const room = { x: 100, y: 64, width: 500, height: 360 };
    const menu = { width: 180, height: 116 };
    const placed = placeContextMenu(pointer, menu, room);

    expect(placed).toEqual(expected);
    expect(placed.x).toBeGreaterThanOrEqual(room.x);
    expect(placed.y).toBeGreaterThanOrEqual(room.y);
    expect(placed.x + menu.width).toBeLessThanOrEqual(room.x + room.width);
    expect(placed.y + menu.height).toBeLessThanOrEqual(room.y + room.height);
  });
});

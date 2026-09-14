import { describe, expect, it } from 'vitest';
import { PathFollower } from '../src/agents/pathFollower';

describe('PathFollower', () => {
  it('moves only on path segments, reports facing, and arrives exactly at the target', () => {
    const follower = new PathFollower(16, 32);
    follower.setPath([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 2, y: 3 }]);
    const first = follower.update(250);
    expect(first.facing).toBe('right');
    expect(first.arrived).toBe(false);
    let snapshot = first;
    for (let index = 0; index < 20 && !snapshot.arrived; index += 1) snapshot = follower.update(100);
    expect(snapshot.arrived).toBe(true);
    expect(snapshot.position).toEqual({ x: 40, y: 56 });
  });

  it('replaces an active route without retaining old waypoints', () => {
    const follower = new PathFollower(16, 32);
    follower.setPath([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    follower.setPath([{ x: 1, y: 1 }, { x: 1, y: 2 }]);
    expect(follower.update(100).facing).toBe('down');
  });

  it('preserves its exact pixel position when retargeted mid-segment', () => {
    const follower = new PathFollower(16, 32);
    follower.setPath([{ x: 1, y: 1 }, { x: 2, y: 1 }]);
    expect(follower.update(0).position).toEqual({ x: 24, y: 24 });

    const midSegment = follower.update(187.5);
    expect(midSegment.position).toEqual({ x: 30, y: 24 });

    follower.setPath([{ x: 1, y: 1 }, { x: 1, y: 2 }], { preservePosition: true });
    expect(follower.update(0).position).toEqual(midSegment.position);

    const snapshots = Array.from({ length: 10 }, () => follower.update(100));
    expect(snapshots.every(({ position }) => position.y === 24 || position.x === 24)).toBe(true);
    expect(snapshots.at(-1)).toMatchObject({ position: { x: 24, y: 40 }, arrived: true });
    expect(Math.max(...snapshots.map((snapshot) => snapshot.position.x))).toBeLessThan(40);
  });
});

describe('continuous RPG walking', () => {
  it('covers the same distance around corners at different frame rates', () => {
    const path = [{ x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }, { x: 3, y: 2 }];
    const slow = new PathFollower(16, 32);
    const fast = new PathFollower(16, 32);
    slow.setPath(path); fast.setPath(path);
    const oneFrame = slow.update(1250);
    let manyFrames = fast.update(0);
    for (let i = 0; i < 125; i++) manyFrames = fast.update(10);
    expect(manyFrames.position.x).toBeCloseTo(oneFrame.position.x);
    expect(manyFrames.position.y).toBeCloseTo(oneFrame.position.y);
    expect(oneFrame.position).toEqual({ x: 48, y: 40 });
  });
});

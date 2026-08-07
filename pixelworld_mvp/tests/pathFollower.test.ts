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
});

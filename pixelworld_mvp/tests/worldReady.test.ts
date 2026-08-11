import { describe, expect, it } from 'vitest';
import { emitWorldReady, subscribeWorldReady } from '../src/game/worldReady';

class EventBus {
  private listener: ((world: unknown) => void) | undefined;

  once(event: string, listener: (world: unknown) => void): void {
    if (event === 'world-ready') this.listener = listener;
  }

  emit(event: string, world: unknown): void {
    if (event === 'world-ready') this.listener?.(world);
  }

  on(event: string, listener: (world: unknown) => void): void {
    if (event === 'world-ready') this.listener = listener;
  }

  off(event: string, listener: (world: unknown) => void): void {
    if (event === 'world-ready' && this.listener === listener) this.listener = undefined;
  }
}

describe('world-ready event', () => {
  it('delivers the created world instance to its listener', () => {
    const events = new EventBus();
    const world = { scene: 'world' };
    let received: unknown;

    events.once('world-ready', (readyWorld) => {
      received = readyWorld;
    });

    emitWorldReady(events, world);

    expect(received).toBe(world);
  });

  it('delivers replacement scene instances until unsubscribed', () => {
    const events = new EventBus();
    const received: unknown[] = [];
    const unsubscribe = subscribeWorldReady(events, (world) => received.push(world));
    const first = { scene: 'first' };
    const restarted = { scene: 'restarted' };

    emitWorldReady(events, first);
    emitWorldReady(events, restarted);
    unsubscribe();
    emitWorldReady(events, { scene: 'stale' });

    expect(received).toEqual([first, restarted]);
  });
});

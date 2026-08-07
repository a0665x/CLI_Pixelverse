import { describe, expect, it } from 'vitest';
import { emitWorldReady } from '../src/game/worldReady';

class EventBus {
  private listener: ((world: unknown) => void) | undefined;

  once(event: string, listener: (world: unknown) => void): void {
    if (event === 'world-ready') this.listener = listener;
  }

  emit(event: string, world: unknown): void {
    if (event === 'world-ready') this.listener?.(world);
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
});

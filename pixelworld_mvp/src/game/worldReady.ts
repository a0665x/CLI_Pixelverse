export interface WorldReadyEvents {
  emit(event: 'world-ready', world: unknown): unknown;
}

export interface WorldReadySubscriptions {
  on(event: 'world-ready', listener: (world: unknown) => void): unknown;
  off(event: 'world-ready', listener: (world: unknown) => void): unknown;
}

export function emitWorldReady(events: WorldReadyEvents, world: unknown): void {
  events.emit('world-ready', world);
}

export function subscribeWorldReady<T>(
  events: WorldReadySubscriptions,
  listener: (world: T) => void,
): () => void {
  const handler = (world: unknown) => listener(world as T);
  events.on('world-ready', handler);
  return () => events.off('world-ready', handler);
}

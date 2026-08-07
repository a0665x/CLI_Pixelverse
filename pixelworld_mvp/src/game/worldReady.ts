export interface WorldReadyEvents {
  emit(event: 'world-ready', world: unknown): unknown;
}

export function emitWorldReady(events: WorldReadyEvents, world: unknown): void {
  events.emit('world-ready', world);
}

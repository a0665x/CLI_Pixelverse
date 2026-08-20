import { isBackendWorldSnapshot, type BackendWorldSnapshot } from './backendSnapshot';
import { localeMessage } from '../i18n/villageLocale';

export interface LiveSnapshotEnvelope {
  snapshot: BackendWorldSnapshot;
  sequence: number;
}

export type CommandFocusSelection = {
  kind: 'agent' | 'building' | 'hook' | 'event';
  id: string;
  agentId?: string;
  buildingId?: string;
};

export interface CommandFocusEnvelope {
  selection: CommandFocusSelection;
  sequence: number;
}

export function focusFromMessage(value: unknown): CommandFocusEnvelope | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const message = value as { type?: unknown; sequence?: unknown; selection?: { kind?: unknown; id?: unknown; agentId?: unknown; buildingId?: unknown } };
  const sequence = message.sequence;
  const kind = message.selection?.kind;
  const id = typeof message.selection?.id === 'string' ? message.selection.id.trim() : '';
  if (message.type !== 'pixelverse.command.focus'
    || !['agent', 'building', 'hook', 'event'].includes(String(kind))
    || !id
    || typeof sequence !== 'number'
    || !Number.isFinite(sequence)) return undefined;
  const agentId = typeof message.selection?.agentId === 'string' ? message.selection.agentId.trim() : '';
  const buildingId = typeof message.selection?.buildingId === 'string' ? message.selection.buildingId.trim() : '';
  return {
    selection: {
      kind: kind as CommandFocusSelection['kind'], id,
      ...(agentId ? { agentId } : {}),
      ...(buildingId ? { buildingId } : {}),
    },
    sequence,
  };
}

export function snapshotFromMessage(value: unknown): LiveSnapshotEnvelope | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const message = value as { type?: unknown; sequence?: unknown; snapshot?: unknown };
  if (message.type !== 'pixelverse.world.snapshot' || !isBackendWorldSnapshot(message.snapshot)) return undefined;
  return { snapshot: message.snapshot, sequence: Number(message.sequence) || Date.now() };
}

export function snapshotFromStreamData(data: string): LiveSnapshotEnvelope | undefined {
  try {
    const payload = JSON.parse(data) as { id?: unknown; sequence?: unknown; snapshot?: unknown };
    if (!isBackendWorldSnapshot(payload.snapshot)) return undefined;
    return { snapshot: payload.snapshot, sequence: Number(payload.id ?? payload.sequence) || Date.now() };
  } catch {
    return undefined;
  }
}

export const localeFromMessage = localeMessage;

export class LiveWorldClient {
  private eventSource?: EventSource;
  private pollTimer?: number;
  private receivedFocusSequence = Number.NEGATIVE_INFINITY;
  private sentFocusSequence = Number.NEGATIVE_INFINITY;
  private readonly onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const envelope = snapshotFromMessage(event.data);
    if (envelope) this.publish(envelope);
    const locale = localeFromMessage(event.data);
    if (locale) this.publishLocale(locale);
    const focus = focusFromMessage(event.data);
    if (focus && focus.sequence > this.receivedFocusSequence) {
      this.receivedFocusSequence = focus.sequence;
      this.publishFocus(focus.selection);
    }
  };

  constructor(
    private readonly publish: (envelope: LiveSnapshotEnvelope) => void,
    private readonly publishLocale: (locale: ReturnType<typeof localeMessage>) => void = () => undefined,
    private readonly publishFocus: (selection: CommandFocusSelection) => void = () => undefined,
  ) {}

  sendFocus(selection: CommandFocusSelection, sequence?: number): boolean {
    const nextSequence = sequence === undefined ? Math.max(Date.now(), this.sentFocusSequence + 1) : sequence;
    const envelope = focusFromMessage({ type: 'pixelverse.command.focus', selection, sequence: nextSequence });
    if (!envelope || envelope.sequence <= this.sentFocusSequence || window.parent === window) return false;
    this.sentFocusSequence = envelope.sequence;
    window.parent.postMessage({ type: 'pixelverse.command.focus', ...envelope }, window.location.origin);
    return true;
  }

  start(): void {
    window.addEventListener('message', this.onMessage);
    if (window.parent !== window) {
      window.parent.postMessage({ type: 'pixelverse.world.ready' }, window.location.origin);
      return;
    }
    void this.fetchSnapshot();
    if (typeof EventSource !== 'undefined') {
      this.eventSource = new EventSource('/api/world/stream');
      const handleSnapshot = (event: MessageEvent) => {
        const envelope = snapshotFromStreamData(event.data);
        if (envelope) this.publish(envelope);
      };
      this.eventSource.onmessage = handleSnapshot;
      this.eventSource.addEventListener('world.update', handleSnapshot as EventListener);
      this.eventSource.onerror = () => this.startPolling();
    } else {
      this.startPolling();
    }
  }

  destroy(): void {
    window.removeEventListener('message', this.onMessage);
    this.eventSource?.close();
    if (this.pollTimer !== undefined) window.clearInterval(this.pollTimer);
  }

  private startPolling(): void {
    if (this.pollTimer !== undefined) return;
    this.pollTimer = window.setInterval(() => void this.fetchSnapshot(), 3_000);
  }

  private async fetchSnapshot(): Promise<void> {
    try {
      const response = await fetch('/api/world', { cache: 'no-store' });
      if (!response.ok) return;
      const snapshot: unknown = await response.json();
      if (isBackendWorldSnapshot(snapshot)) this.publish({ snapshot, sequence: snapshot.server_time_ms ?? Date.now() });
    } catch {
      // Parent messages or the next poll/SSE reconnect can restore the feed.
    }
  }
}

import { isBackendWorldSnapshot, type BackendWorldSnapshot } from './backendSnapshot';
import { localeMessage } from '../i18n/villageLocale';

export interface LiveSnapshotEnvelope {
  snapshot: BackendWorldSnapshot;
  sequence: number;
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
  private readonly onMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin || event.source !== window.parent) return;
    const envelope = snapshotFromMessage(event.data);
    if (envelope) this.publish(envelope);
    const locale = localeFromMessage(event.data);
    if (locale) this.publishLocale(locale);
  };

  constructor(
    private readonly publish: (envelope: LiveSnapshotEnvelope) => void,
    private readonly publishLocale: (locale: ReturnType<typeof localeMessage>) => void = () => undefined,
  ) {}

  start(): void {
    window.addEventListener('message', this.onMessage);
    if (window.parent !== window) window.parent.postMessage({ type: 'pixelverse.world.ready' }, window.location.origin);
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

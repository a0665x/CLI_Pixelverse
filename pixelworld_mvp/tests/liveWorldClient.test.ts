import { describe, expect, it, vi } from 'vitest';
import { LiveWorldClient, localeFromMessage, snapshotFromMessage, snapshotFromStreamData } from '../src/live/LiveWorldClient';

const snapshot = { agents: [{ agent: 'codex-main', role: 'main_agent', state: 'idle' }] };

describe('LiveWorldClient payload parsing', () => {
  it('accepts dashboard snapshot messages and rejects unrelated messages', () => {
    expect(snapshotFromMessage({ type: 'pixelverse.world.snapshot', sequence: 3, snapshot }))
      .toEqual({ snapshot, sequence: 3 });
    expect(snapshotFromMessage({ type: 'something-else', snapshot })).toBeUndefined();
  });

  it('parses locale messages from the dashboard', () => {
    expect(localeFromMessage({ type: 'pixelverse.locale.update', locale: 'ko-KR', sequence: 9 }))
      .toEqual({ locale: 'ko-KR', sequence: 9 });
    expect(localeFromMessage({ type: 'pixelverse.locale.update', locale: 'bad' })).toEqual({ locale: 'zh-TW', sequence: expect.any(Number) });
  });

  it('extracts the nested snapshot emitted by the backend SSE route', () => {
    expect(snapshotFromStreamData(JSON.stringify({ id: 12, snapshot })))
      .toEqual({ snapshot, sequence: 12 });
    expect(snapshotFromStreamData('not-json')).toBeUndefined();
  });

  it('accepts locale and snapshot messages only from the exact parent window', () => {
    let onMessage: ((event: MessageEvent) => void) | undefined;
    const parent = { postMessage: vi.fn() };
    const host = {
      location: { origin: 'https://pixelverse.test' }, parent,
      addEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) => { onMessage = listener; }),
      removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1), clearInterval: vi.fn(),
    };
    vi.stubGlobal('window', host);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    try {
      const publish = vi.fn();
      const publishLocale = vi.fn();
      const client = new LiveWorldClient(publish, publishLocale);
      client.start();
      const wrongSource = { postMessage: vi.fn() };

      onMessage?.({
        origin: host.location.origin, source: wrongSource,
        data: { type: 'pixelverse.world.snapshot', sequence: 3, snapshot },
      } as unknown as MessageEvent);
      onMessage?.({
        origin: host.location.origin, source: wrongSource,
        data: { type: 'pixelverse.locale.update', locale: 'ja-JP', sequence: 4 },
      } as unknown as MessageEvent);
      expect(publish).not.toHaveBeenCalled();
      expect(publishLocale).not.toHaveBeenCalled();

      onMessage?.({
        origin: host.location.origin, source: parent,
        data: { type: 'pixelverse.world.snapshot', sequence: 5, snapshot },
      } as unknown as MessageEvent);
      onMessage?.({
        origin: host.location.origin, source: parent,
        data: { type: 'pixelverse.locale.update', locale: 'ko-KR', sequence: 6 },
      } as unknown as MessageEvent);
      expect(publish).toHaveBeenCalledWith({ snapshot, sequence: 5 });
      expect(publishLocale).toHaveBeenCalledWith({ locale: 'ko-KR', sequence: 6 });
      client.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('uses the normalized parent feed exclusively while embedded', () => {
    const parent = { postMessage: vi.fn() };
    const host = {
      location: { origin: 'https://pixelverse.test' }, parent,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1), clearInterval: vi.fn(),
    };
    const fetchSnapshot = vi.fn(async () => ({ ok: true, json: async () => snapshot }));
    const EventSource = vi.fn();
    vi.stubGlobal('window', host);
    vi.stubGlobal('fetch', fetchSnapshot);
    vi.stubGlobal('EventSource', EventSource);
    try {
      new LiveWorldClient(vi.fn()).start();
      expect(parent.postMessage).toHaveBeenCalledWith(
        { type: 'pixelverse.world.ready' },
        host.location.origin,
      );
      expect(fetchSnapshot).not.toHaveBeenCalled();
      expect(EventSource).not.toHaveBeenCalled();
      expect(host.setInterval).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

import { describe, expect, it, vi } from 'vitest';
import {
  focusFromMessage,
  LiveWorldClient,
  localeFromMessage,
  snapshotFromMessage,
  snapshotFromStreamData,
  type CommandFocusSelection,
} from '../src/live/LiveWorldClient';

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

  it('parses only supported command focus messages with finite sequences', () => {
    expect(focusFromMessage({
      type: 'pixelverse.command.focus', selection: { kind: 'building', id: 'maker-workshop' }, sequence: 7,
    })).toEqual({ selection: { kind: 'building', id: 'maker-workshop' }, sequence: 7 });
    expect(focusFromMessage({
      type: 'pixelverse.command.focus', selection: { kind: 'unknown', id: 'x' }, sequence: 8,
    })).toBeUndefined();
    expect(focusFromMessage({
      type: 'pixelverse.command.focus', selection: { kind: 'agent', id: 'main' }, sequence: 'bad',
    })).toBeUndefined();
    expect(focusFromMessage({
      type: 'pixelverse.command.focus', selection: { kind: 'agent', id: 'main' }, sequence: null,
    })).toBeUndefined();
    expect(focusFromMessage({
      type: 'pixelverse.command.focus',
      selection: { kind: 'hook', id: 'work', agentId: 'main', buildingId: 'code_workbench' },
      sequence: 9,
    })).toEqual({
      selection: { kind: 'hook', id: 'work', agentId: 'main', buildingId: 'code_workbench' },
      sequence: 9,
    });
  });

  it('accepts monotonic focus only from the exact parent and publishes clicks back to that origin', () => {
    let onMessage: ((event: MessageEvent) => void) | undefined;
    const parent = { postMessage: vi.fn() };
    const host = {
      location: { origin: 'https://pixelverse.test' }, parent,
      addEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) => { onMessage = listener; }),
      removeEventListener: vi.fn(), setInterval: vi.fn(() => 1), clearInterval: vi.fn(),
    };
    vi.stubGlobal('window', host);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })));
    try {
      const publishFocus = vi.fn();
      const client = new LiveWorldClient(vi.fn(), vi.fn(), publishFocus);
      client.start();
      parent.postMessage.mockClear();
      const focus = (
        sequence: number,
        source: unknown = parent,
        origin = host.location.origin,
        selection: CommandFocusSelection = { kind: 'agent', id: 'main' },
      ) => onMessage?.({
        origin, source, data: {
          type: 'pixelverse.command.focus', selection, sequence,
        },
      } as unknown as MessageEvent);

      focus(5);
      focus(5);
      focus(4);
      focus(6, {});
      focus(7, parent, 'https://foreign.test');
      focus(8, parent, host.location.origin, {
        kind: 'hook', id: 'work', agentId: 'main', buildingId: 'code_workbench',
      });
      expect(publishFocus.mock.calls).toEqual([
        [{ kind: 'agent', id: 'main' }],
        [{ kind: 'hook', id: 'work', agentId: 'main', buildingId: 'code_workbench' }],
      ]);

      expect(client.sendFocus({ kind: 'building', id: 'maker-workshop' }, 10)).toBe(true);
      expect(client.sendFocus({ kind: 'agent', id: 'main' }, 10)).toBe(false);
      expect(client.sendFocus({ kind: 'event', id: 'evt-1' }, 11)).toBe(true);
      expect(parent.postMessage.mock.calls).toEqual([
        [{ type: 'pixelverse.command.focus', selection: { kind: 'building', id: 'maker-workshop' }, sequence: 10 }, host.location.origin],
        [{ type: 'pixelverse.command.focus', selection: { kind: 'event', id: 'evt-1' }, sequence: 11 }, host.location.origin],
      ]);
      client.destroy();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('makes default outbound focus sequences monotonic within one clock tick', () => {
    const parent = { postMessage: vi.fn() };
    const host = {
      location: { origin: 'https://pixelverse.test' }, parent,
      addEventListener: vi.fn(), removeEventListener: vi.fn(),
      setInterval: vi.fn(() => 1), clearInterval: vi.fn(),
    };
    vi.stubGlobal('window', host);
    vi.spyOn(Date, 'now').mockReturnValue(20);
    try {
      const client = new LiveWorldClient(vi.fn());
      expect(client.sendFocus({ kind: 'agent', id: 'main' })).toBe(true);
      expect(client.sendFocus({ kind: 'building', id: 'maker-workshop' })).toBe(true);
      expect(parent.postMessage.mock.calls.map(([message]) => message.sequence)).toEqual([20, 21]);
    } finally {
      vi.restoreAllMocks();
      vi.unstubAllGlobals();
    }
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

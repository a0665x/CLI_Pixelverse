import { afterEach, describe, expect, it, vi } from 'vitest';

const entry = vi.hoisted(() => ({
  onWorldReady: undefined as ((world: unknown) => void) | undefined,
}));

vi.mock('../src/game/createGame', () => ({
  createGame: vi.fn((_parent: string, onWorldReady?: (world: unknown) => void) => {
    entry.onWorldReady = onWorldReady;
    return {};
  }),
}));
vi.mock('../src/three/mountWorldViews', () => ({ mountWorldViews: vi.fn() }));
vi.mock('../src/player/ImmersionController', () => ({ ImmersionController: class {} }));
vi.mock('../src/ui/TestPanel', () => ({ mountTestPanel: vi.fn() }));

describe('main locale integration', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
    entry.onWorldReady = undefined;
  });

  it('carries the dashboard selection through production bootstrap before and after WorldScene readiness', async () => {
    const messageListeners: Array<(event: MessageEvent) => void> = [];
    const host = {
      location: { origin: 'https://pixelverse.test', search: '?embed=1' },
      parent: { postMessage: vi.fn() },
      addEventListener: vi.fn((type: string, listener: (event: MessageEvent) => void) => {
        if (type === 'message') messageListeners.push(listener);
      }),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
      setInterval: vi.fn(() => 1),
      clearInterval: vi.fn(),
    };
    vi.stubGlobal('window', host);
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => ({ hidden: false })),
      documentElement: { lang: '' },
    });
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))));

    await import('../src/main');
    const publishLocale = (locale: string, sequence: number) => messageListeners.forEach((listener) => listener({
      origin: host.location.origin,
      source: host.parent,
      data: { type: 'pixelverse.locale.update', locale, sequence },
    } as unknown as MessageEvent));
    publishLocale('ja-JP', 1);

    const shutdown = vi.fn();
    const world = {
      setLocale: vi.fn(),
      syncLiveSnapshot: vi.fn(),
      events: { once: vi.fn((_event: string, handler: () => void) => shutdown.mockImplementation(handler)) },
    };
    entry.onWorldReady?.(world);
    expect(world.setLocale).toHaveBeenCalledWith('ja-JP');

    publishLocale('ko-KR', 2);
    expect(world.setLocale).toHaveBeenLastCalledWith('ko-KR');
    shutdown();
  });
});

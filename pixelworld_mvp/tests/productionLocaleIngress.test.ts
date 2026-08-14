import { describe, expect, it, vi } from 'vitest';
import { connectProductionLocaleIngress } from '../src/game/productionLocaleIngress';

describe('production locale ingress', () => {
  it('retains a dashboard locale received before WorldScene is ready and forwards later changes', () => {
    let onMessage: ((event: MessageEvent) => void) | undefined;
    const parent = { postMessage: vi.fn() };
    const host = {
      location: { origin: 'https://pixelverse.test' },
      parent,
      addEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) => { onMessage = listener; }),
      removeEventListener: vi.fn(),
    };
    const ingress = connectProductionLocaleIngress(host as never);
    const setLocale = vi.fn();

    onMessage?.({ origin: host.location.origin, source: parent, data: { type: 'pixelverse.locale.update', locale: 'ja-JP', sequence: 1 } } as unknown as MessageEvent);
    expect(setLocale).not.toHaveBeenCalled();

    ingress.attachWorld({ setLocale });
    expect(setLocale).toHaveBeenLastCalledWith('ja-JP');

    onMessage?.({ origin: host.location.origin, source: parent, data: { type: 'pixelverse.locale.update', locale: 'ko-KR', sequence: 2 } } as unknown as MessageEvent);
    expect(setLocale).toHaveBeenLastCalledWith('ko-KR');
    expect(parent.postMessage).toHaveBeenCalledWith({ type: 'pixelverse.world.ready' }, host.location.origin);
  });

  it('rejects a forged same-origin locale message from any source except the exact parent', () => {
    let onMessage: ((event: MessageEvent) => void) | undefined;
    const parent = { postMessage: vi.fn() };
    const host = {
      location: { origin: 'https://pixelverse.test' }, parent,
      addEventListener: vi.fn((_type: string, listener: (event: MessageEvent) => void) => { onMessage = listener; }),
      removeEventListener: vi.fn(),
    };
    const ingress = connectProductionLocaleIngress(host as never);
    const setLocale = vi.fn();
    ingress.attachWorld({ setLocale });
    setLocale.mockClear();

    onMessage?.({
      origin: host.location.origin,
      source: { postMessage: vi.fn() },
      data: { type: 'pixelverse.locale.update', locale: 'ja-JP', sequence: 1 },
    } as unknown as MessageEvent);
    expect(setLocale).not.toHaveBeenCalled();

    onMessage?.({
      origin: host.location.origin,
      source: parent,
      data: { type: 'pixelverse.locale.update', locale: 'ko-KR', sequence: 2 },
    } as unknown as MessageEvent);
    expect(setLocale).toHaveBeenCalledWith('ko-KR');
  });
});

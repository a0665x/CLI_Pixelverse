import { describe, expect, it } from 'vitest';
import { localeFromMessage, snapshotFromMessage, snapshotFromStreamData } from '../src/live/LiveWorldClient';

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
});

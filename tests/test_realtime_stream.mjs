import test from 'node:test';
import assert from 'node:assert/strict';

import { buildStreamUrl, parseStreamMessage, supportsEventStream } from '../public/realtime.mjs';

test('supportsEventStream detects EventSource availability', () => {
  assert.equal(supportsEventStream({ EventSource: class MockEventSource {} }), true);
  assert.equal(supportsEventStream({}), false);
});

test('buildStreamUrl preserves existing origin and uses world stream route', () => {
  const url = buildStreamUrl('http://localhost:4321/ui');
  assert.equal(url, 'http://localhost:4321/api/world/stream');
});

test('parseStreamMessage returns snapshot payload', () => {
  const message = JSON.stringify({ event: 'world.update', id: 7, snapshot: { stats: { agent_count: 2 } } });
  const parsed = parseStreamMessage(message);
  assert.equal(parsed.id, 7);
  assert.equal(parsed.snapshot.stats.agent_count, 2);
});

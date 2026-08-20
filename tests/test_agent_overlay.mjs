import assert from 'node:assert/strict';
import { test } from 'node:test';
import { agentOverlayClass, agentOverlaySide } from '../public/agent_overlay.mjs';

test('agentOverlaySide deterministically spreads nearby agent overlays left and right', () => {
  assert.equal(agentOverlaySide({ agent: 'henry-main' }), agentOverlaySide({ agent: 'henry-main' }));
  const sides = new Set([
    agentOverlaySide({ agent: 'henry-main' }),
    agentOverlaySide({ agent: 'synthetic-subagent-1' }),
    agentOverlaySide({ agent: 'synthetic-subagent-2' }),
  ]);
  assert.deepEqual(sides, new Set(['left', 'right']));
});

test('agentOverlayClass returns a CSS class for lateral non-occluding overlays', () => {
  assert.match(agentOverlayClass({ agent: 'henry-main' }), /^overlay-(left|right)$/);
});

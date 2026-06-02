import test from 'node:test';
import assert from 'node:assert/strict';

import { hookStateRoutes } from '../public/hook_state_map.mjs';
import { ROOM_LAYOUTS, ROOM_STATE_GROUPS } from '../public/house_layout.mjs';

test('hook state table routes every lifecycle condition to a visible room category', () => {
  const routes = hookStateRoutes();
  assert.ok(routes.length >= 8);
  for (const route of routes) {
    assert.ok(ROOM_LAYOUTS[route.room], `unknown room for ${route.hook}`);
    assert.ok(ROOM_STATE_GROUPS[route.room]?.includes(route.state), `${route.state} missing from ${route.room}`);
  }
});

test('tool forge groups active execution states', () => {
  assert.deepEqual(
    ROOM_STATE_GROUPS.tool_forge,
    ['invoking_skill', 'tool_call', 'executing', 'self_healing', 'blocked'],
  );
});

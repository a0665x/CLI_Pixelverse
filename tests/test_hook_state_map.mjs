import test from 'node:test';
import assert from 'node:assert/strict';

import { hookStateRoutes } from '../public/hook_state_map.mjs';

test('hook state table preserves the active semantic room contract', () => {
  const routes = hookStateRoutes();
  const statesByRoom = {};
  for (const route of routes) {
    (statesByRoom[route.room] ||= []).push(route.state);
  }

  assert.deepEqual(statesByRoom, {
    clone_bay: ['initializing', 'collaborating', 'collaborating'],
    think_lab: ['thinking', 'awaiting_input'],
    tool_forge: ['invoking_skill', 'browsing', 'external_tool', 'tool_call'],
    file_library: ['reading_files', 'reading_files'],
    code_workbench: ['editing_files', 'editing_files'],
    terminal_bay: ['shell_command'],
    blueprint_lab: ['planning'],
    offline_corner: ['blocked', 'offline'],
    standby_dock: ['idle'],
  });
});

test('hook state routes are returned as defensive copies', () => {
  const routes = hookStateRoutes();
  routes[0].room = 'changed';

  assert.equal(hookStateRoutes()[0].room, 'clone_bay');
});

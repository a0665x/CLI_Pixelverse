import test from 'node:test';
import assert from 'node:assert/strict';

import { getPropFx, getZoneFx } from '../public/scene_fx.mjs';

test('portal and server props expose strong ambient animations', () => {
  const portal = getPropFx('portal', 'clone_bay');
  const server = getPropFx('server', 'tool_forge');

  assert.equal(portal.className, 'prop-fx-pulse');
  assert.equal(portal.intensity, 'high');
  assert.equal(server.className, 'prop-fx-flicker');
  assert.equal(server.intensity, 'medium');
});

test('terminal, coffee, and lamp props expose readable motion styles', () => {
  assert.equal(getPropFx('terminal', 'response_studio').className, 'prop-fx-terminal');
  assert.equal(getPropFx('coffee', 'standby_dock').className, 'prop-fx-coffee');
  assert.equal(getPropFx('lamp', 'think_lab').className, 'prop-fx-glow');
});

test('semantic zones expose room-specific ambient classes', () => {
  assert.equal(getZoneFx({ kind: 'scan', key: 'scanner-nook' }).className, 'zone-fx-scan');
  assert.equal(getZoneFx({ kind: 'server', key: 'clone-nodes' }).className, 'zone-fx-flicker');
  assert.equal(getZoneFx({ kind: 'portal', key: 'portal-stage' }).className, 'zone-fx-pulse');
  assert.equal(getZoneFx({ kind: 'rest', key: 'bed-alcove' }).className, 'zone-fx-rest');
});

import test from 'node:test';
import assert from 'node:assert/strict';

import { getKenneyAgentSprite } from '../public/kenney_assets.mjs';
import { getFacingFromDelta, nextWalkFrame } from '../public/world_motion.mjs';

function tileNumber(sprite) {
  const match = String(sprite.src || '').match(/tile_(\d+)\.png$/);
  return match ? Number(match[1]) : null;
}

test('getFacingFromDelta resolves all four directions', () => {
  assert.equal(getFacingFromDelta(1, 0), 'right');
  assert.equal(getFacingFromDelta(-1, 0), 'left');
  assert.equal(getFacingFromDelta(0, -1), 'up');
  assert.equal(getFacingFromDelta(0, 1), 'down');
});

test('main agent exposes distinct directional idle sprites', () => {
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'idle', facing: 'left', frame: 0 })), 212);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'idle', facing: 'down', frame: 0 })), 213);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'idle', facing: 'up', frame: 0 })), 214);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'idle', facing: 'right', frame: 0 })), 215);
});

test('moving agents alternate directional walk frames without losing facing', () => {
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'working', facing: 'left', frame: 0 })), 212);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'working', facing: 'left', frame: 1 })), 239);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'working', facing: 'down', frame: 1 })), 240);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'working', facing: 'up', frame: 1 })), 241);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'main_agent', state: 'working', facing: 'right', frame: 1 })), 242);
});

test('subagents and branch sessions also support four-direction walk sprites', () => {
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'subagent', state: 'planning', facing: 'up', frame: 1 })), 160);
  assert.equal(tileNumber(getKenneyAgentSprite({ role: 'branch_session', state: 'thinking', facing: 'down', frame: 1 })), 105);
});

test('nextWalkFrame alternates only while moving', () => {
  assert.equal(nextWalkFrame(0, true), 1);
  assert.equal(nextWalkFrame(1, true), 0);
  assert.equal(nextWalkFrame(1, false), 0);
});

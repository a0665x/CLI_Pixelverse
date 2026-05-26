import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getKenneyAgentSprite,
  getKenneyDoorSprite,
  getKenneyPropSprite,
  getKenneyRoomTheme,
  KENNEY_PACK,
} from '../public/kenney_assets.mjs';

test('Kenney pack metadata is CC0', () => {
  assert.equal(KENNEY_PACK.license, 'CC0');
  assert.match(KENNEY_PACK.sourceUrl, /kenney\.nl\/assets\/rpg-urban-pack/);
});

test('room themes expose floor and wall tiles', () => {
  const theme = getKenneyRoomTheme('tool_forge');
  assert.match(theme.floorTile, /tile_0128\.png$/);
  assert.match(theme.wallTile, /tile_0150\.png$/);
});

test('props map to pack PNG assets', () => {
  const desk = getKenneyPropSprite('desk');
  const bed = getKenneyPropSprite('bed');
  assert.match(desk.src, /tile_0152\.png$/);
  assert.match(bed.src, /tile_0172\.png$/);
  assert.equal(typeof desk.scale, 'number');
});

test('agent sprites map by role, facing, and walk frame', () => {
  const main = getKenneyAgentSprite({ role: 'main_agent', state: 'working', frame: 1, facing: 'left' });
  const branch = getKenneyAgentSprite({ role: 'branch_session', state: 'idle', frame: 0, facing: 'right' });
  assert.match(main.src, /tile_0239\.png$/);
  assert.equal(main.flipX, false);
  assert.match(branch.src, /tile_0080\.png$/);
  assert.equal(branch.flipX, false);
});

test('door sprite is present', () => {
  assert.match(getKenneyDoorSprite(), /tile_0255\.png$/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseGlobalMapYaml } from '../public/global_map_loader.mjs';
import { applyGlobalMapManifest, DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP, ROOM_LAYOUTS } from '../public/house_layout.mjs';

test('generated terraced room YAML survives browser parser and normalization', () => {
  const text = readFileSync(new URL('../global_map/VLM_Generated.yaml', import.meta.url), 'utf8');
  const manifest = parseGlobalMapYaml(text);
  assert.match(text, /layout: compact-terraced-central-gallery/);
  assert.match(text, /corridor_mode: single-gallery/);
  assert.equal(Object.keys(manifest.rooms).length, 10);
  assert.equal(manifest.corridors.length, 1);
  for (const room of Object.values(manifest.rooms)) {
    assert.ok(room.rect.width > 0);
    assert.ok(room.rect.height > 0);
    assert.ok(room.walkable_rect.width < room.rect.width);
    assert.ok(room.walkable_rect.height < room.rect.height);
    assert.ok(room.furniture.length);
  }
  applyGlobalMapManifest(manifest);
  assert.equal(Object.keys(ROOM_LAYOUTS).filter((key) => key !== 'offline_corner').length, 10);
  assert.equal(ROOM_LAYOUTS.think_lab.left + ROOM_LAYOUTS.think_lab.width, ROOM_LAYOUTS.blueprint_lab.left);
  assert.equal(ROOM_LAYOUTS.terminal_bay.left + ROOM_LAYOUTS.terminal_bay.width, ROOM_LAYOUTS.session_archive.left);
  const firstDesk = manifest.rooms.think_lab.furniture[0];
  const expectedLocalX = ((firstDesk.x - manifest.rooms.think_lab.rect.left) / manifest.rooms.think_lab.rect.width) * 100;
  const expectedLocalY = ((firstDesk.y - manifest.rooms.think_lab.rect.top) / manifest.rooms.think_lab.rect.height) * 100;
  assert.ok(Math.abs(DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP.think_lab[0].x - expectedLocalX) < 0.001);
  assert.ok(Math.abs(DEFAULT_ROOM_PROP_POSITIONS_FROM_MAP.think_lab[0].y - expectedLocalY) < 0.001);
});

test('district renderer clips a polygon relative to its bounding rect', () => {
  const source = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /district\.style\.clipPath\s*=\s*`polygon\(/);
  assert.match(source, /point\.x\s*-\s*layoutRect\.left/);
  assert.match(source, /point\.y\s*-\s*layoutRect\.top/);
});

test('generated map furniture replaces rectangular fallback decor', () => {
  const source = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /if \(mapFurniture\.length\) \{\s*return mapFurniture\.map/);
});

test('live furniture preserves generated semantic anchors and footprint metadata', () => {
  const source = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /anchors:\s*item\.anchors\s*\|\|\s*\[\]/);
  assert.match(source, /footprint:\s*item\.footprint/);
  assert.match(source, /iconStyle:\s*item\.icon_style/);
});

test('live agents apply role-specific sprite classes and role metadata', () => {
  const source = readFileSync(new URL('../public/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /imgEl\.className\s*=\s*`agent-pixel \$\{sprite\?\.pixelClass/);
  assert.match(source, /view\.el\.dataset\.agentRole\s*=\s*agent\.role/);
});

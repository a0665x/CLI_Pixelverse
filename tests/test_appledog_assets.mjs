import test from 'node:test';
import assert from 'node:assert/strict';

import { APPLEDOG_PACK, getAppleDogDoorSprite, getAppleDogPropSprite, getAppleDogRoomTheme } from '../public/appledog_assets.mjs';

test('AppleDog pack metadata keeps source and credit information', () => {
  assert.equal(APPLEDOG_PACK.author, 'Apple Dog');
  assert.match(APPLEDOG_PACK.sourceUrl, /apple-dog\.itch\.io/);
  assert.equal(APPLEDOG_PACK.tileSize, 32);
});

test('AppleDog furniture sprites cover the most readable room props', () => {
  for (const type of ['bed', 'sofa', 'chair', 'desk', 'table', 'cabinet', 'terminal']) {
    const sprite = getAppleDogPropSprite(type);
    assert.ok(sprite, `${type} should have an AppleDog sprite`);
    assert.match(sprite.src, /appledog-modern-interior\/32x32\/.+\.png$/);
    assert.equal(typeof sprite.widthTiles, 'number');
    assert.equal(typeof sprite.heightTiles, 'number');
  }
  assert.equal(getAppleDogPropSprite('board'), null);
});

test('AppleDog environment sprites provide floors walls and doors', () => {
  const theme = getAppleDogRoomTheme('blueprint_lab');
  assert.match(theme.floorColor, /^#/);
  assert.match(theme.wallTile, /wall-.+\.png$/);
  assert.match(theme.rugColor, /rgba/);
  assert.match(getAppleDogDoorSprite(), /door-wood\.png$/);
});

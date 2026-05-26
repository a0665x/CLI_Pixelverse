import test from 'node:test';
import assert from 'node:assert/strict';

import { OFFICE_LIFE_PACK, shouldUseHighClarityProp } from '../public/office_life_assets.mjs';

test('office visual direction records source attribution metadata', () => {
  assert.equal(OFFICE_LIFE_PACK.name, 'Pixel Life: Office Essentials');
  assert.match(OFFICE_LIFE_PACK.sourceUrl, /christianperich\.itch\.io/);
  assert.equal(OFFICE_LIFE_PACK.gridSize, 32);
});

test('high clarity fallback is enabled for office state props', () => {
  for (const type of ['bed', 'desk', 'chair', 'sofa', 'bookshelf', 'cabinet', 'board', 'terminal']) {
    assert.equal(shouldUseHighClarityProp(type), true, `${type} should use the readable office fallback`);
  }
  assert.equal(shouldUseHighClarityProp('window'), false);
});

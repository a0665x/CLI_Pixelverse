import test from 'node:test';
import assert from 'node:assert/strict';

import { createCommandDeckLocaleController } from '../public/command_deck_locale_controller.mjs';

test('incomplete locale is rejected without changing or persisting active locale', () => {
  const writes = [];
  const rejected = [];
  const localeSelect = { value: 'en-US' };
  const controller = createCommandDeckLocaleController({
    initialLocale: 'en-US',
    localeSelect,
    storage: { setItem: (...args) => writes.push(args) },
    isLocaleComplete: (locale) => locale !== 'ja-JP',
    onLocaleRejected: (locale) => rejected.push(locale),
  });

  assert.equal(controller.setLocale('ja-JP'), 'en-US');
  assert.equal(controller.getLocale(), 'en-US');
  assert.equal(localeSelect.value, 'en-US');
  assert.deepEqual(writes, []);
  assert.deepEqual(rejected, ['ja-JP']);
});

test('accepted locale rerenders the existing roster snapshot immediately', () => {
  const calls = [];
  const snapshot = { agents: [{ agent: 'main' }] };
  const controller = createCommandDeckLocaleController({
    initialLocale: 'en-US',
    storage: null,
    getSnapshot: () => snapshot,
    applyStaticCopy: () => calls.push('static'),
    renderSnapshot: (value) => calls.push(value === snapshot ? 'snapshot' : 'wrong'),
    renderLiveMonitoring: (value) => calls.push(value === snapshot ? 'roster' : 'wrong'),
    isLocaleComplete: () => true,
  });

  assert.equal(controller.setLocale('ko-KR'), 'ko-KR');
  assert.deepEqual(calls, ['static', 'snapshot', 'roster']);
});

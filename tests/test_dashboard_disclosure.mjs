import assert from 'node:assert/strict';
import test from 'node:test';

import {
  readDashboardDisclosure,
  shouldShowGuide,
  toggleDashboardDrawer,
  writeDashboardDisclosure,
} from '../public/dashboard_disclosure.mjs';

test('secondary drawers start collapsed while core HUD stays visible', () => {
  const initial = readDashboardDisclosure(null);
  assert.deepEqual(initial, {
    activeDrawer: null,
    guideDismissed: false,
  });

  const open = toggleDashboardDrawer(initial, 'timeline');
  assert.deepEqual(open, { activeDrawer: 'timeline', guideDismissed: false });
  assert.deepEqual(toggleDashboardDrawer({ ...open, guideDismissed: true }, 'timeline'), {
    activeDrawer: null,
    guideDismissed: true,
  });
});

test('guide appears once for pointer, keyboard, and touch discovery', () => {
  for (const modality of ['pointer', 'keyboard', 'touch']) {
    assert.equal(shouldShowGuide({ guideDismissed: false }, modality), true);
  }
  assert.equal(shouldShowGuide({ guideDismissed: true }, 'pointer'), false);
  assert.equal(shouldShowGuide({ guideDismissed: false }, 'unknown'), false);
});

test('stored disclosure is validated and malformed storage fails closed', () => {
  const validStorage = {
    getItem: () => JSON.stringify({ activeDrawer: 'agents', guideDismissed: true }),
  };
  assert.deepEqual(readDashboardDisclosure(validStorage), {
    activeDrawer: 'agents',
    guideDismissed: true,
  });

  const invalidStorage = {
    getItem: () => JSON.stringify({ activeDrawer: 'settings', guideDismissed: 'yes' }),
  };
  assert.deepEqual(readDashboardDisclosure(invalidStorage), {
    activeDrawer: null,
    guideDismissed: false,
  });

  assert.deepEqual(readDashboardDisclosure({ getItem: () => { throw new Error('denied'); } }), {
    activeDrawer: null,
    guideDismissed: false,
  });
});

test('storage writes report quota or privacy failures without throwing', () => {
  let stored = null;
  const storage = { setItem: (_key, value) => { stored = JSON.parse(value); } };
  const state = { activeDrawer: 'diagnostics', guideDismissed: true };

  assert.equal(writeDashboardDisclosure(storage, state), true);
  assert.deepEqual(stored, state);
  assert.equal(writeDashboardDisclosure({ setItem: () => { throw new Error('quota'); } }, state), false);
});

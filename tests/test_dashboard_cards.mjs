import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DASHBOARD_CARD_IDS,
  dashboardCardPage,
  placeDashboardCard,
} from '../public/dashboard_cards.mjs';

const overlaps = (a, b) => (
  a.left < b.right
  && a.right > b.left
  && a.top < b.bottom
  && a.bottom > b.top
);

test('dashboard exposes exactly Events, Agents, and Help cards', () => {
  assert.deepEqual(DASHBOARD_CARD_IDS, ['events', 'agents', 'help']);
});

test('dashboard pagination preserves order and clamps requested pages', () => {
  const items = [1, 2, 3, 4, 5];
  assert.deepEqual(dashboardCardPage(items, 1, 2), {
    items: [3, 4],
    page: 1,
    pageCount: 3,
    canPrevious: true,
    canNext: true,
  });
  assert.deepEqual(dashboardCardPage(items, 99, 2).items, [5]);
  assert.deepEqual(dashboardCardPage(items, -4, 2).items, [1, 2]);
  assert.deepEqual(items, [1, 2, 3, 4, 5]);
});

test('empty pagination remains a single stable page', () => {
  assert.deepEqual(dashboardCardPage([], 12, 0), {
    items: [],
    page: 0,
    pageCount: 1,
    canPrevious: false,
    canNext: false,
  });
});

test('dashboard card placement stays bounded and avoids heartbeat and cutaway rectangles', () => {
  const viewport = { width: 1200, height: 800, margin: 12, gap: 8 };
  const cardSize = { width: 360, height: 360 };
  const trigger = { left: 1060, top: 14, right: 1188, bottom: 56 };
  const heartbeat = { left: 14, top: 14, right: 434, bottom: 190 };
  const cutaway = { left: 400, top: 200, right: 1120, bottom: 695 };
  const point = placeDashboardCard(trigger, cardSize, viewport, [heartbeat, cutaway]);
  const card = {
    left: point.left,
    top: point.top,
    right: point.left + cardSize.width,
    bottom: point.top + cardSize.height,
  };

  assert.ok(card.left >= viewport.margin);
  assert.ok(card.top >= viewport.margin);
  assert.ok(card.right <= viewport.width - viewport.margin);
  assert.ok(card.bottom <= viewport.height - viewport.margin);
  assert.equal(overlaps(card, heartbeat), false);
  assert.equal(overlaps(card, cutaway), false);
});

test('compact placement uses the available space below the status rail', () => {
  const viewport = { width: 720, height: 495, margin: 8, gap: 8 };
  const cardSize = { width: 328, height: 300 };
  const trigger = { left: 456, top: 8, right: 712, bottom: 48 };
  const heartbeat = { left: 0, top: 0, right: 720, bottom: 48 };
  const point = placeDashboardCard(trigger, cardSize, viewport, [heartbeat]);

  assert.ok(point.top >= heartbeat.bottom);
  assert.ok(point.left >= 8);
  assert.ok(point.left + cardSize.width <= 712);
  assert.ok(point.top + cardSize.height <= 487);
});

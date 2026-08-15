import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DASHBOARD_CARD_IDS,
  buildDashboardLiveSnapshot,
  dashboardCardPage,
  dashboardCardPageSize,
  dashboardCardItemMarkup,
  placeDashboardCard,
  renderDashboardCardView,
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

test('adaptive placement guarantees zero collision across compact and desktop viewports', () => {
  const cases = [
    {
      label: '375x500',
      viewport: { width: 375, height: 500, margin: 8, gap: 8 },
      heartbeat: { left: 8, top: 8, right: 258, bottom: 184 },
      trigger: { left: 263, top: 8, right: 367, bottom: 48 },
      desired: { width: 336, height: 340 },
    },
    {
      label: '720x495',
      viewport: { width: 720, height: 495, margin: 8, gap: 8 },
      heartbeat: { left: 8, top: 8, right: 338, bottom: 184 },
      trigger: { left: 456, top: 8, right: 712, bottom: 48 },
      desired: { width: 336, height: 340 },
    },
    {
      label: '1024 normal',
      viewport: { width: 1024, height: 768, margin: 14, gap: 8 },
      heartbeat: { left: 14, top: 14, right: 434, bottom: 190 },
      trigger: { left: 732, top: 14, right: 1010, bottom: 56 },
      desired: { width: 380, height: 390 },
    },
    {
      label: 'desktop with cutaway',
      viewport: { width: 1440, height: 900, margin: 14, gap: 8 },
      heartbeat: { left: 14, top: 14, right: 434, bottom: 190 },
      cutaway: { left: 360, top: 202, right: 1080, bottom: 697 },
      trigger: { left: 1148, top: 14, right: 1426, bottom: 56 },
      desired: { width: 380, height: 390 },
    },
  ];

  cases.forEach(({ label, viewport, heartbeat, cutaway, trigger, desired }) => {
    const exclusions = [heartbeat, cutaway].filter(Boolean);
    const placement = placeDashboardCard(trigger, desired, viewport, exclusions);
    assert.equal(placement.visible, true, label);
    const card = {
      left: placement.left,
      top: placement.top,
      right: placement.left + placement.width,
      bottom: placement.top + placement.height,
    };
    assert.ok(card.left >= viewport.margin, label);
    assert.ok(card.top >= viewport.margin, label);
    assert.ok(card.right <= viewport.width - viewport.margin, label);
    assert.ok(card.bottom <= viewport.height - viewport.margin, label);
    exclusions.forEach((exclusion) => assert.equal(overlaps(card, exclusion), false, label));
  });
});

test('full-size card remains anchored beside the heartbeat when horizontal room exists', () => {
  const heartbeat = { left: 14, top: 14, right: 434, bottom: 190 };
  const trigger = { left: 732, top: 14, right: 1010, bottom: 56 };
  const placement = placeDashboardCard(
    trigger,
    { width: 380, height: 390 },
    { width: 1024, height: 768, margin: 14, gap: 8 },
    [heartbeat],
  );

  assert.equal(placement.width, 380);
  assert.equal(placement.height, 390);
  assert.ok(placement.left >= heartbeat.right + 8);
  assert.equal(placement.top, trigger.bottom + 8);
});

test('adaptive card height selects a page size that keeps every item reachable without scrolling', () => {
  assert.equal(dashboardCardPageSize('events', { width: 336, height: 300 }), 1);
  assert.equal(dashboardCardPageSize('agents', { width: 336, height: 340 }), 2);
  assert.equal(dashboardCardPageSize('events', { width: 380, height: 390 }), 3);
  assert.equal(dashboardCardPageSize('help', { width: 380, height: 390 }), 1);
});

test('extreme summaries remain line-clamped visually and fully available to assistive technology', () => {
  const detail = `long <summary> & accessible ${'detail '.repeat(700)}`;
  const markup = dashboardCardItemMarkup({ title: 'Build <event>', meta: '12:00', detail });

  assert.match(markup, /class="dashboard-card-item-detail dashboard-card-item-detail--clamped"/);
  assert.ok(markup.includes('aria-label="Build &lt;event&gt; · 12:00 · long &lt;summary&gt; &amp; accessible'));
  assert.ok(markup.includes('title="long &lt;summary&gt; &amp; accessible'));
  assert.equal(markup.includes('<summary>'), false);

  const items = [1, 2, 3, 4].map((id) => dashboardCardItemMarkup({ title: `Event ${id}`, detail }));
  const pages = [dashboardCardPage(items, 0, 1), dashboardCardPage(items, 1, 1), dashboardCardPage(items, 2, 1), dashboardCardPage(items, 3, 1)];
  assert.deepEqual(pages.flatMap((page) => page.items), items);
});

test('fake-clock ticker data updates the actual card view without another server snapshot', () => {
  const source = {
    server_time_ms: 1_000,
    stats: { stale_after_seconds: 2 },
    agents: [{ agent: 'main', state: 'working', age_seconds: 0, connection_status: 'live' }],
  };
  const first = buildDashboardLiveSnapshot(source, 2_000);
  const ticked = buildDashboardLiveSnapshot(source, 4_000);

  assert.equal(first.agents[0].state, 'working');
  assert.equal(ticked.agents[0].state, 'offline');
  assert.equal(ticked.agents[0].age_seconds, 3);
  assert.equal(ticked.agents[0].is_stale, true);

  const view = {
    card: { dataset: {} },
    items: { innerHTML: '', style: { getPropertyValue: () => '1', setProperty() {} } },
  };
  const renderAgent = (snapshot) => {
    const state = snapshot.agents[0].state;
    renderDashboardCardView(view, {
      signature: state,
      markup: dashboardCardItemMarkup({ title: 'main', detail: state }),
      pageSize: 1,
    });
  };
  renderAgent(first);
  assert.match(view.items.innerHTML, /working/);
  renderAgent(ticked);
  assert.match(view.items.innerHTML, /offline/);
});

test('actual dashboard view performs zero DOM writes or announcements for an identical render', () => {
  const writes = [];
  const node = (initial = {}) => {
    let textContent = initial.textContent || '';
    let innerHTML = initial.innerHTML || '';
    let hidden = Boolean(initial.hidden);
    let disabled = Boolean(initial.disabled);
    const properties = new Map();
    return {
      dataset: {},
      style: {
        getPropertyValue: (name) => properties.get(name) || '',
        setProperty(name, value) { properties.set(name, value); writes.push(`style:${name}`); },
      },
      get textContent() { return textContent; },
      set textContent(value) { textContent = value; writes.push('text'); },
      get innerHTML() { return innerHTML; },
      set innerHTML(value) { innerHTML = value; writes.push('html'); },
      get hidden() { return hidden; },
      set hidden(value) { hidden = value; writes.push('hidden'); },
      get disabled() { return disabled; },
      set disabled(value) { disabled = value; writes.push('disabled'); },
    };
  };
  const view = {
    card: node(), items: node(), settings: node(), previous: node(), next: node(),
    page: node(), liveStatus: node(),
  };
  const model = {
    signature: 'agents:0:working', markup: '<article>Agent</article>', settingsVisible: false,
    previousLabel: 'Prev', previousDisabled: true, nextLabel: 'Next', nextDisabled: false,
    pageLabel: '1 / 2', liveText: 'Agents, 1 / 2', pageSize: 2,
  };

  assert.ok(renderDashboardCardView(view, model) > 0);
  writes.length = 0;
  assert.equal(renderDashboardCardView(view, model), 0);
  assert.deepEqual(writes, []);
});

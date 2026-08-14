import test from 'node:test';
import assert from 'node:assert/strict';
import * as pixelworldEmbed from '../public/pixelworld_embed.mjs';

const {
  isPixelworldReadyMessage,
  publishPixelworldLocale,
  publishPixelworldSnapshot,
} = pixelworldEmbed;

test('dashboard publishes canonical snapshots to the Pixelworld iframe', () => {
  const sent = [];
  const frame = { contentWindow: { postMessage: (...args) => sent.push(args) } };
  const snapshot = { agents: [{ agent: 'main' }] };
  assert.equal(publishPixelworldSnapshot(frame, snapshot, 14, 'http://localhost'), true);
  assert.deepEqual(sent, [[{ type: 'pixelverse.world.snapshot', snapshot, sequence: 14 }, 'http://localhost']]);
});

test('dashboard publishes locale updates to Pixelworld', () => {
  const sent = [];
  const frame = { contentWindow: { postMessage: (...args) => sent.push(args) } };
  assert.equal(publishPixelworldLocale(frame, 'en-US', 22, 'http://localhost'), true);
  assert.deepEqual(sent, [[{ type: 'pixelverse.locale.update', locale: 'en-US', sequence: 22 }, 'http://localhost']]);
});

test('publisher tolerates an iframe that has not mounted yet', () => {
  assert.equal(publishPixelworldSnapshot(null, { agents: [] }, 1, 'http://localhost'), false);
});

test('dashboard recognizes the iframe readiness handshake', () => {
  assert.equal(isPixelworldReadyMessage({ type: 'pixelverse.world.ready' }), true);
  assert.equal(isPixelworldReadyMessage({ type: 'pixelverse.locale.update' }), false);
  assert.equal(isPixelworldReadyMessage(null), false);
});

test('bridge publishes before readiness and replays the latest locale and snapshot after load and ready', () => {
  assert.equal(typeof pixelworldEmbed.createPixelworldBridge, 'function');
  const sent = [];
  const contentWindow = { postMessage: (...args) => sent.push(args) };
  const frame = { contentWindow };
  const bridge = pixelworldEmbed.createPixelworldBridge({
    frame,
    origin: 'http://localhost',
    now: () => 91,
  });
  const snapshot = { server_time_ms: 44, agents: [{ agent: 'main' }] };

  assert.equal(bridge.setLocale('ja-JP', 40), true);
  assert.equal(bridge.setSnapshot(snapshot, 44), true);
  assert.deepEqual(sent.map(([message]) => message.type), [
    'pixelverse.locale.update',
    'pixelverse.world.snapshot',
  ]);

  sent.length = 0;
  assert.equal(bridge.handleLoad(), true);
  assert.deepEqual(sent.map(([message]) => message), [
    { type: 'pixelverse.locale.update', locale: 'ja-JP', sequence: 91 },
    { type: 'pixelverse.world.snapshot', snapshot, sequence: 44 },
  ]);

  sent.length = 0;
  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.world.ready' },
    origin: 'http://localhost',
    source: contentWindow,
  }), true);
  assert.deepEqual(sent.map(([message]) => message.type), [
    'pixelverse.locale.update',
    'pixelverse.world.snapshot',
  ]);
});

test('new iframe documents reset stale cutaway visibility before replay without resetting on ready', () => {
  const events = [];
  const contentWindow = {
    postMessage: (message) => events.push(`publish:${message.type}`),
  };
  const bridge = pixelworldEmbed.createPixelworldBridge({
    frame: { contentWindow },
    origin: 'http://localhost',
    now: () => 91,
    onCutawayStateChange: (open) => events.push(`cutaway:${open}`),
  });

  bridge.setLocale('ja-JP', 40);
  bridge.setSnapshot({ server_time_ms: 44, agents: [] }, 44);
  bridge.handleMessage({
    data: { type: 'pixelverse.cutaway.state', open: true },
    origin: 'http://localhost',
    source: contentWindow,
  });
  events.length = 0;

  assert.equal(bridge.handleLoad(), true);
  assert.deepEqual(events, [
    'cutaway:false',
    'publish:pixelverse.locale.update',
    'publish:pixelverse.world.snapshot',
  ]);

  events.length = 0;
  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.world.ready' },
    origin: 'http://localhost',
    source: contentWindow,
  }), true);
  assert.deepEqual(events, [
    'publish:pixelverse.locale.update',
    'publish:pixelverse.world.snapshot',
  ]);
});

test('bridge ignores readiness messages from the wrong origin or frame', () => {
  assert.equal(typeof pixelworldEmbed.createPixelworldBridge, 'function');
  const sent = [];
  const contentWindow = { postMessage: (...args) => sent.push(args) };
  const bridge = pixelworldEmbed.createPixelworldBridge({
    frame: { contentWindow },
    origin: 'http://localhost',
  });
  bridge.setLocale('en-US', 1);
  sent.length = 0;

  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.world.ready' },
    origin: 'https://example.test',
    source: contentWindow,
  }), false);
  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.world.ready' },
    origin: 'http://localhost',
    source: {},
  }), false);
  assert.deepEqual(sent, []);
});

test('bridge accepts cutaway visibility only from its own Pixelworld frame', () => {
  const contentWindow = {};
  const states = [];
  const bridge = pixelworldEmbed.createPixelworldBridge({
    frame: { contentWindow },
    origin: 'http://localhost',
    onCutawayStateChange: (open) => states.push(open),
  });

  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.cutaway.state', open: true },
    origin: 'http://localhost',
    source: contentWindow,
  }), true);
  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.cutaway.state', open: false },
    origin: 'http://localhost',
    source: contentWindow,
  }), true);
  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.cutaway.state', open: true },
    origin: 'https://example.test',
    source: contentWindow,
  }), false);
  assert.equal(bridge.handleMessage({
    data: { type: 'pixelverse.cutaway.state', open: true },
    origin: 'http://localhost',
    source: {},
  }), false);
  assert.deepEqual(states, [true, false]);
});

test('bridge attachment connects iframe load and window message events and can detach cleanly', () => {
  assert.equal(typeof pixelworldEmbed.attachPixelworldBridge, 'function');
  const eventTarget = () => {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, listener) { listeners.set(type, listener); },
      removeEventListener(type, listener) {
        if (listeners.get(type) === listener) listeners.delete(type);
      },
      dispatch(type, event = {}) { listeners.get(type)?.(event); },
    };
  };
  const frame = eventTarget();
  frame.contentWindow = {};
  const messageTarget = eventTarget();
  const calls = [];
  const detach = pixelworldEmbed.attachPixelworldBridge({
    frame,
    messageTarget,
    bridge: {
      handleLoad: () => calls.push('load'),
      handleMessage: (event) => calls.push(event.data.type),
    },
  });

  frame.dispatch('load');
  messageTarget.dispatch('message', { data: { type: 'pixelverse.world.ready' } });
  assert.deepEqual(calls, ['load', 'pixelverse.world.ready']);
  detach();
  frame.dispatch('load');
  messageTarget.dispatch('message', { data: { type: 'pixelverse.world.ready' } });
  assert.deepEqual(calls, ['load', 'pixelverse.world.ready']);
});

test('cutaway status rail is derived from live host and centered cutaway chrome collisions', () => {
  assert.equal(typeof pixelworldEmbed.cutawayChromeCollidesWithHost, 'function');
  const matrix = [
    [720, 495, true],
    [800, 450, true],
    [1024, 800, true],
    [1280, 720, true],
    [1366, 768, true],
    [1440, 900, false],
  ];
  for (const [width, height, expected] of matrix) {
    const cutawayWidth = Math.min(720, width - 16);
    const cutawayHeight = Math.min(495, height - 16);
    const cutawayHeader = {
      left: (width - cutawayWidth) / 2,
      top: (height - cutawayHeight) / 2,
      right: (width + cutawayWidth) / 2,
      bottom: (height - cutawayHeight) / 2 + 40,
    };
    const compactHud = width <= 720;
    const hud = {
      left: compactHud ? 8 : 14,
      top: compactHud ? 8 : 14,
      right: (compactHud ? 8 : 14) + (compactHud ? 330 : 420),
      bottom: (compactHud ? 8 : 14) + (compactHud ? 168 : 176),
    };
    assert.equal(pixelworldEmbed.cutawayChromeCollidesWithHost({
      hostRects: [hud], childRects: [cutawayHeader], frameRect: { left: 0, top: 0 },
    }), expected, `${width}x${height}`);
  }
});

test('status rail controller adds on collision and removes on close or safe resize', () => {
  assert.equal(typeof pixelworldEmbed.createCutawayStatusRailController, 'function');
  const classes = new Set();
  const body = {
    dataset: { pixelworldCutaway: 'open' },
    classList: {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      remove(name) { classes.delete(name); },
    },
  };
  const hudRect = { left: 14, top: 14, right: 434, bottom: 190 };
  const headerRect = { left: 280, top: 112, right: 1000, bottom: 152 };
  const frame = {
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    contentDocument: { querySelectorAll: () => [{ hidden: false, getBoundingClientRect: () => headerRect }] },
  };
  const controller = pixelworldEmbed.createCutawayStatusRailController({
    body, frame, hostElements: [{ hidden: false, getBoundingClientRect: () => hudRect }],
  });

  assert.equal(controller.sync(), true);
  assert.equal(classes.has('cutaway-status-rail'), true);
  headerRect.top = 203;
  headerRect.bottom = 243;
  assert.equal(controller.sync(), false);
  assert.equal(classes.has('cutaway-status-rail'), false);
  body.dataset.pixelworldCutaway = 'closed';
  headerRect.top = 112;
  headerRect.bottom = 152;
  assert.equal(controller.sync(), false);
  assert.equal(classes.has('cutaway-status-rail'), false);
});

test('status rail controller uses the HUD reserved envelope instead of transient short content', () => {
  const classes = new Set();
  const body = {
    dataset: { pixelworldCutaway: 'open' },
    classList: {
      toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
      remove(name) { classes.delete(name); },
    },
  };
  let viewport = { width: 1024, height: 800 };
  const domRect = (values) => Object.defineProperties({}, Object.fromEntries(
    Object.entries(values).map(([name, value]) => [name, { value, enumerable: false }]),
  ));
  const hud = {
    hidden: false,
    getBoundingClientRect: () => domRect({ left: 14, top: 14, right: 434, bottom: 138 }),
  };
  const frame = {
    contentDocument: {
      querySelectorAll: () => [{
        hidden: false,
        getBoundingClientRect: () => ({ left: 152, top: 152.5, right: 872, bottom: 192.5 }),
      }],
    },
    getBoundingClientRect: () => ({
      left: 0, top: 0, right: viewport.width, bottom: viewport.height,
      width: viewport.width, height: viewport.height,
    }),
  };
  const controller = pixelworldEmbed.createCutawayStatusRailController({
    body,
    frame,
    hostElements: [{ element: hud, minimumHeight: 176 }],
  });

  assert.equal(controller.sync(), true);
  assert.equal(classes.has('cutaway-status-rail'), true);
  viewport = { width: 1440, height: 900 };
  assert.equal(controller.sync(), false);
  assert.equal(classes.has('cutaway-status-rail'), false);
});

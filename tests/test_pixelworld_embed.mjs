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

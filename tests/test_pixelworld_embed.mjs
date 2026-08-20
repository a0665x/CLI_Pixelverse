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

test('command deck focus messages preserve selection and monotonic sequence values', () => {
  assert.equal(typeof pixelworldEmbed.commandDeckFocusMessage, 'function');
  assert.deepEqual(pixelworldEmbed.commandDeckFocusMessage({ kind: 'agent', id: 'main' }, 12), {
    type: 'pixelverse.command.focus',
    selection: { kind: 'agent', id: 'main' },
    sequence: 12,
  });

  const sent = [];
  const bridge = pixelworldEmbed.createPixelworldBridge({
    frame: { contentWindow: { postMessage: (...args) => sent.push(args) } },
    origin: 'http://localhost',
  });
  assert.equal(bridge.setFocus({ kind: 'agent', id: 'main' }, 12), true);
  assert.equal(bridge.setFocus({ kind: 'building', id: 'maker' }, 12), false);
  assert.equal(bridge.setFocus({ kind: 'building', id: 'maker' }, 13), true);
  assert.deepEqual(sent.map(([message]) => message), [
    pixelworldEmbed.commandDeckFocusMessage({ kind: 'agent', id: 'main' }, 12),
    pixelworldEmbed.commandDeckFocusMessage({ kind: 'building', id: 'maker' }, 13),
  ]);
  assert.ok(sent.every(([, targetOrigin]) => targetOrigin === 'http://localhost'));
});

test('hook focus messages carry their resolved visible agent and building context', () => {
  const selection = pixelworldEmbed.commandDeckFocusSelection(
    { kind: 'hook', id: 'work' },
    { agent: { id: 'main' }, buildingId: 'code_workbench' },
  );
  assert.deepEqual(selection, {
    kind: 'hook', id: 'work', agentId: 'main', buildingId: 'code_workbench',
  });
  const sent = [];
  const bridge = pixelworldEmbed.createPixelworldBridge({
    frame: { contentWindow: { postMessage: (...args) => sent.push(args) } },
    origin: 'http://localhost',
  });
  assert.equal(bridge.setFocus(selection, 15), true);
  assert.deepEqual(sent, [[{
    type: 'pixelverse.command.focus', selection, sequence: 15,
  }, 'http://localhost']]);
});

test('focus message validation rejects coerced non-numeric sequences', () => {
  const message = (sequence) => pixelworldEmbed.commandDeckFocusMessage({ kind: 'hook', id: 'work' }, sequence);

  assert.equal(pixelworldEmbed.isCommandDeckFocusMessage(message(4)), true);
  assert.equal(pixelworldEmbed.isCommandDeckFocusMessage(message(null)), false);
  assert.equal(pixelworldEmbed.isCommandDeckFocusMessage(message('')), false);
});

test('focus bridge rejects foreign-origin and stale iframe focus messages', () => {
  const contentWindow = {};
  const selections = [];
  const bridge = pixelworldEmbed.createPixelworldBridge({
    frame: { contentWindow },
    origin: 'http://localhost',
    onFocus: (selection) => selections.push(selection),
  });
  const event = (sequence, origin = 'http://localhost') => ({
    data: pixelworldEmbed.commandDeckFocusMessage({ kind: 'agent', id: 'main' }, sequence),
    origin,
    source: contentWindow,
  });

  assert.equal(bridge.handleMessage(event(4)), true);
  assert.equal(bridge.handleMessage(event(4)), false);
  assert.equal(bridge.handleMessage(event(3)), false);
  assert.equal(bridge.handleMessage(event(5, 'https://foreign.test')), false);
  assert.deepEqual(selections, [{ kind: 'agent', id: 'main' }]);
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
    onFrameLoad: () => calls.push('frame-load'),
  });

  frame.dispatch('load');
  messageTarget.dispatch('message', { data: { type: 'pixelverse.world.ready' } });
  assert.deepEqual(calls, ['frame-load', 'load', 'pixelverse.world.ready']);
  detach();
  frame.dispatch('load');
  messageTarget.dispatch('message', { data: { type: 'pixelverse.world.ready' } });
  assert.deepEqual(calls, ['frame-load', 'load', 'pixelverse.world.ready']);
});

test('bridge attachment closes cards from the same-origin child document and rebinds safely on reload', () => {
  const eventTarget = () => {
    const listeners = new Map();
    return {
      listeners,
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set());
        listeners.get(type).add(listener);
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
      dispatch(type, event = {}) { [...(listeners.get(type) || [])].forEach((listener) => listener(event)); },
      count(type) { return listeners.get(type)?.size || 0; },
    };
  };
  const contentWindow = eventTarget();
  const childDocument = (origin = 'http://localhost', source = contentWindow) => ({
    ...eventTarget(),
    defaultView: source,
    location: { origin },
  });
  let documentValue = childDocument();
  const frame = {
    ...eventTarget(),
    contentWindow,
    get contentDocument() { return documentValue; },
  };
  const messageTarget = eventTarget();
  const closures = [];
  const completions = [];
  let cutawayOpens = 0;
  let activeCard = 'events';
  const close = (reason) => {
    if (!activeCard) return;
    closures.push(`${reason}:${activeCard}`);
    activeCard = null;
  };
  const detach = pixelworldEmbed.attachPixelworldBridge({
    frame,
    messageTarget,
    origin: 'http://localhost',
    bridge: { handleLoad() {}, handleMessage() {} },
    onFrameCutawayOpen: () => { cutawayOpens += 1; },
    onFramePointerDown: () => close('pointer'),
    onFramePointerComplete: (event) => completions.push(event.type),
    onFrameEscape: () => close('escape'),
  });

  assert.equal(documentValue.count('pointerup'), 1);
  assert.equal(documentValue.count('pointercancel'), 1);
  assert.equal(contentWindow.count('pixelworld:cutaway-open'), 1);
  documentValue.dispatch('pointerdown', { pointerType: 'mouse' });
  documentValue.dispatch('pointerup', { type: 'pointerup' });
  contentWindow.dispatch('pixelworld:cutaway-open');
  documentValue.dispatch('pointercancel', { type: 'pointercancel' });
  assert.deepEqual(closures, ['pointer:events']);
  assert.deepEqual(completions, ['pointerup', 'pointercancel']);
  assert.equal(cutawayOpens, 1);
  activeCard = 'agents';
  documentValue.dispatch('keydown', { key: 'Escape' });
  assert.deepEqual(closures, ['pointer:events', 'escape:agents']);

  const firstDocument = documentValue;
  documentValue = childDocument();
  frame.dispatch('load');
  assert.equal(firstDocument.count('pointerdown'), 0);
  assert.equal(firstDocument.count('pointerup'), 0);
  assert.equal(firstDocument.count('pointercancel'), 0);
  activeCard = 'help';
  firstDocument.dispatch('pointerdown');
  assert.equal(activeCard, 'help');
  documentValue.dispatch('pointerdown');
  assert.equal(activeCard, null);

  const sameOriginDocument = documentValue;
  documentValue = childDocument('https://example.test');
  frame.dispatch('load');
  assert.equal(sameOriginDocument.count('pointerdown'), 0);
  assert.equal(documentValue.count('pointerdown'), 0);
  assert.equal(contentWindow.count('pixelworld:cutaway-open'), 0);

  documentValue = childDocument('http://localhost', {});
  frame.dispatch('load');
  assert.equal(documentValue.count('pointerdown'), 0);

  documentValue = childDocument();
  frame.dispatch('load');
  assert.equal(documentValue.count('pointerdown'), 1);
  assert.equal(documentValue.count('pointerup'), 1);
  assert.equal(documentValue.count('pointercancel'), 1);
  assert.equal(contentWindow.count('pixelworld:cutaway-open'), 1);
  detach();
  assert.equal(documentValue.count('pointerdown'), 0);
  assert.equal(documentValue.count('pointerup'), 0);
  assert.equal(documentValue.count('pointercancel'), 0);
  assert.equal(contentWindow.count('pixelworld:cutaway-open'), 0);
  assert.equal(documentValue.count('keydown'), 0);
  assert.equal(frame.count('load'), 0);
  assert.equal(messageTarget.count('message'), 0);
});

test('bridge child-document integration fails closed when same-origin access throws', () => {
  const listeners = new Map();
  const frame = {
    contentWindow: {},
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type) => listeners.delete(type),
    get contentDocument() { throw new DOMException('cross origin', 'SecurityError'); },
  };
  let childEvents = 0;
  const detach = pixelworldEmbed.attachPixelworldBridge({
    frame,
    origin: 'http://localhost',
    bridge: { handleLoad() {}, handleMessage() {} },
    onFramePointerDown: () => { childEvents += 1; },
    onFrameEscape: () => { childEvents += 1; },
  });

  assert.doesNotThrow(() => listeners.get('load')?.());
  assert.equal(childEvents, 0);
  assert.doesNotThrow(detach);
});

test('page lifecycle keeps the bridge attached through BFCache and cleans up real navigation', () => {
  assert.equal(typeof pixelworldEmbed.attachPageLifecycleCleanup, 'function');
  const listeners = new Map();
  const pageTarget = {
    addEventListener: (type, listener) => listeners.set(type, listener),
    removeEventListener: (type, listener) => {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
  };
  let cleanupCount = 0;
  const detachLifecycle = pixelworldEmbed.attachPageLifecycleCleanup({
    pageTarget,
    cleanup: () => { cleanupCount += 1; },
  });

  listeners.get('pagehide')({ persisted: true });
  assert.equal(cleanupCount, 0);
  listeners.get('pagehide')({ persisted: false });
  assert.equal(cleanupCount, 1);
  detachLifecycle();
  assert.equal(listeners.has('pagehide'), false);
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

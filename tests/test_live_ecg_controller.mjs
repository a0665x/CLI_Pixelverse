import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveEcgController } from '../public/live_ecg_controller.mjs';

function fixture({ reduced = false, pathFor = (row, nowMs) => `${row.state}:${nowMs}` } = {}) {
  const paths = new Map();
  const nodes = [];
  const root = { querySelectorAll: () => nodes };
  const frames = [];
  const cancelled = [];
  let clock = 1_000;
  const add = (id) => {
    const path = { value: '', setAttribute: (_name, value) => { path.value = value; } };
    const node = { dataset: { agentEcg: id }, querySelector: () => path };
    nodes.push(node); paths.set(id, path);
  };
  const options = {
    root,
    now: () => clock,
    requestFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelFrame: (handle) => cancelled.push(handle),
    reducedMotion: () => reduced,
  };
  if (pathFor) options.pathFor = pathFor;
  const controller = createLiveEcgController(options);
  return { controller, frames, paths, nodes, cancelled, add, setClock: (value) => { clock = value; } };
}

test('active ECG updates between unchanged backend snapshots', () => {
  const view = fixture();
  view.add('main');
  view.controller.sync([{ id: 'main', state: 'working', tone: 'work', load: .94 }]);
  view.controller.start();
  view.frames.shift()(0);
  assert.equal(view.paths.get('main').value, 'working:1000');
  view.setClock(1_040);
  view.frames.shift()(40);
  assert.equal(view.paths.get('main').value, 'working:1040');
});

test('animation is capped near 30fps and stop cancels the pending frame', () => {
  const view = fixture();
  view.add('main');
  view.controller.sync([{ id: 'main', state: 'working', tone: 'work', load: .94 }]);
  view.controller.start();
  view.frames.shift()(0);
  view.setClock(1_010);
  view.frames.shift()(10);
  assert.equal(view.paths.get('main').value, 'working:1000');
  view.controller.stop();
  assert.equal(view.cancelled.length, 1);
});

test('reduced motion paints once without scheduling a continuous loop', () => {
  const view = fixture({ reduced: true });
  view.add('idle');
  view.controller.sync([{ id: 'idle', state: 'idle', tone: 'rest', load: 0 }]);
  view.controller.start();
  assert.equal(view.paths.get('idle').value, 'idle:1000');
  assert.equal(view.frames.length, 0);
});

test('controller skips hidden roster ECG nodes and forwards semantic signal', () => {
  const view = fixture();
  view.add('main');
  const node = view.nodes[0];
  node.hidden = true;
  node.getClientRects = () => [];
  view.controller.sync([{
    id: 'main', state: 'working', signal: { kind: 'busy', rate: 1, amplitude: 1 },
  }]);
  view.controller.start();

  assert.equal(view.paths.get('main').value, '');
});

test('default path builder consumes the canonical semantic signal', () => {
  const view = fixture({ pathFor: null });
  view.add('main');
  const signal = { kind: 'busy', rate: 1, amplitude: 1 };

  view.controller.sync([{ id: 'main', state: 'idle', signal }]);

  assert.notEqual(view.paths.get('main').value, 'M 0,16 L 176,16');
});

test('one scheduler paints roster and detail ECG nodes for the same Agent', () => {
  const paths = [];
  const nodes = Array.from({ length: 2 }, () => {
    const path = { value: '', setAttribute: (_name, value) => { path.value = value; } };
    paths.push(path);
    return { dataset: { agentEcg: 'main' }, querySelector: () => path };
  });
  const controller = createLiveEcgController({
    root: { querySelectorAll: () => nodes },
    now: () => 1_000,
    pathFor: (row) => row.signal.kind,
  });

  controller.sync([{ id: 'main', state: 'working', signal: { kind: 'busy' } }]);

  assert.deepEqual(paths.map(({ value }) => value), ['busy', 'busy']);
});

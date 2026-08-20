import test from 'node:test';
import assert from 'node:assert/strict';
import { createLiveEcgController } from '../public/live_ecg_controller.mjs';

function fixture({ reduced = false } = {}) {
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
  const controller = createLiveEcgController({
    root,
    now: () => clock,
    requestFrame: (callback) => { frames.push(callback); return frames.length; },
    cancelFrame: (handle) => cancelled.push(handle),
    reducedMotion: () => reduced,
    pathFor: (row, nowMs) => `${row.state}:${nowMs}`,
  });
  return { controller, frames, paths, cancelled, add, setClock: (value) => { clock = value; } };
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

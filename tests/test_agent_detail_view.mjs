import test from 'node:test';
import assert from 'node:assert/strict';

import { createAgentDetailView } from '../public/agent_detail_view.mjs';

class Node {
  constructor(selector = '') {
    this.selector = selector;
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.hidden = true;
    this.isConnected = true;
    this.focusCalls = 0;
    this.textContent = '';
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, callback) { this.listeners.set(type, callback); }
  removeEventListener(type) { this.listeners.delete(type); }
  dispatch(type, event = {}) { this.listeners.get(type)?.({ target: this, preventDefault() {}, stopPropagation() {}, ...event }); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  focus() { this.focusCalls += 1; }
  querySelector(selector) { return this.nodes?.get(selector) ?? null; }
  querySelectorAll() { return []; }
}

const detail = {
  id: 'main', name: 'RAW_NAME', role: 'main_agent', state: 'working', pixelState: 'editing_files',
  signal: { kind: 'busy' }, task: 'RAW_TASK', room: { key: 'code_workbench', label: 'rooms.code_workbench.name' },
  tool: 'apply_patch', hook: 'PostToolUse', processIdentity: 42, sessionIdentity: 'terminal-a', lastSeen: 9_950,
  recentEvents: [{ id: 'evt-1', summary: 'RAW_EVENT' }], portraitInput: { role: 'main_agent' },
};

function fixture(mode = 'drawer') {
  const root = new Node('root');
  root.nodes = new Map([
    ['[data-agent-detail-panel]', new Node('panel')],
    ['[data-agent-detail-close]', new Node('close')],
    ['[data-agent-detail-portrait]', new Node('portrait')],
    ['[data-agent-detail-name]', new Node('name')],
    ['[data-agent-detail-role]', new Node('role')],
    ['[data-agent-detail-state]', new Node('state')],
    ['[data-agent-detail-task]', new Node('task')],
    ['[data-agent-detail-room]', new Node('room')],
    ['[data-agent-detail-tool]', new Node('tool')],
    ['[data-agent-detail-hook]', new Node('hook')],
    ['[data-agent-detail-process]', new Node('process')],
    ['[data-agent-detail-session]', new Node('session')],
    ['[data-agent-detail-last-seen]', new Node('last-seen')],
    ['[data-agent-detail-events]', new Node('events')],
    ['[data-agent-detail-ecg]', new Node('ecg')],
  ]);
  const documentRef = { activeElement: null, createElement: () => new Node('created') };
  return {
    root,
    documentRef,
    view: createAgentDetailView({
      root, documentRef,
      textFor: (key) => key,
      spriteFor: () => ({ src: '/portrait.png', pixelClass: 'pixel' }),
      modeFor: () => mode,
    }),
  };
}

test('closing by button Escape and backdrop restores the connected originating trigger', () => {
  for (const closeWith of ['button', 'escape', 'backdrop']) {
    const { root, view } = fixture(closeWith === 'backdrop' ? 'dialog' : 'drawer');
    const trigger = new Node('trigger');
    view.open(detail, trigger);
    if (closeWith === 'button') root.nodes.get('[data-agent-detail-close]').dispatch('click');
    if (closeWith === 'escape') root.dispatch('keydown', { key: 'Escape' });
    if (closeWith === 'backdrop') root.dispatch('click', { target: root });
    assert.equal(root.hidden, true, closeWith);
    assert.equal(trigger.focusCalls, 1, closeWith);
  }
});

test('updating an open detail preserves its original trigger and external-copy boundaries', () => {
  const { root, view } = fixture();
  const firstTrigger = new Node('first');
  const secondTrigger = new Node('second');
  view.open(detail, firstTrigger);
  view.open({ ...detail, id: 'sub', name: 'RAW_SUB' }, secondTrigger);

  assert.equal(root.hidden, false);
  assert.equal(root.dataset.agentId, 'sub');
  assert.equal(root.dataset.agentDetailMode, 'drawer');
  assert.equal(root.nodes.get('[data-agent-detail-name]').dataset.externalCopy, 'true');
  assert.equal(root.nodes.get('[data-agent-detail-task]').dataset.externalCopy, 'true');
  assert.equal(root.nodes.get('[data-agent-detail-ecg]').dataset.agentEcg, 'sub');
  view.close();
  assert.equal(firstTrigger.focusCalls, 1);
  assert.equal(secondTrigger.focusCalls, 0);
});

test('closing skips a trigger that is no longer connected', () => {
  const { view } = fixture();
  const trigger = new Node('trigger');
  trigger.isConnected = false;
  view.open(detail, trigger);
  view.close();
  assert.equal(trigger.focusCalls, 0);
});

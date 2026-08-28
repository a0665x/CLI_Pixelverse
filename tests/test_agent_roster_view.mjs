import test from 'node:test';
import assert from 'node:assert/strict';

import { agentRosterDescriptor, createAgentRosterView } from '../public/agent_roster_view.mjs';

class FakeNode {
  constructor(tagName, ownerDocument = null) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.dataset = {};
    this.attributes = new Map();
    this.children = [];
    this.listeners = new Map();
    this.className = '';
    this.textContent = '';
    this.classList = {
      add: (...names) => {
        const tokens = new Set(this.className.split(/\s+/).filter(Boolean));
        names.forEach((name) => tokens.add(name));
        this.className = [...tokens].join(' ');
      },
      toggle: (name, enabled) => {
        const tokens = new Set(this.className.split(/\s+/).filter(Boolean));
        if (enabled) tokens.add(name); else tokens.delete(name);
        this.className = [...tokens].join(' ');
      },
      contains: (name) => this.className.split(/\s+/).includes(name),
    };
  }

  append(...children) {
    children.forEach((child) => { child.parentNode = this; });
    this.children.push(...children);
  }
  replaceChildren(...children) {
    if (this.contains(this.ownerDocument?.activeElement)) this.ownerDocument.activeElement = this.ownerDocument.body;
    this.children.forEach((child) => { child.parentNode = null; });
    children.forEach((child) => { child.parentNode = this; });
    this.children = children;
  }
  contains(node) { return node === this || this.children.some((child) => child.contains(node)); }
  closest(selector) {
    if (selector === '.agent-roster-card' && this.classList.contains('agent-roster-card')) return this;
    return this.parentNode?.closest(selector) || null;
  }
  focus(options) {
    this.focusCalls = [...(this.focusCalls || []), options];
    this.ownerDocument.activeElement = this;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  dispatch(type, event = {}) { this.listeners.get(type)?.(event); }
}

const documentRef = { activeElement: null, body: null };
documentRef.createElement = (tagName) => new FakeNode(tagName, documentRef);
documentRef.createElementNS = (_namespace, tagName) => new FakeNode(tagName, documentRef);
documentRef.body = new FakeNode('body', documentRef);
documentRef.activeElement = documentRef.body;

const row = {
  id: 'main', name: 'Codex', role: 'main_agent', roomKey: 'tool_forge', externalTask: 'RAW_TASK',
  signal: { kind: 'busy', tone: 'work' },
  portraitInput: { role: 'main_agent', state: 'working' },
};

const options = {
  selectedId: 'main',
  spriteFor: () => ({ src: '/portrait.png', pixelClass: 'pixel' }),
  textFor: (key) => ({ busy: 'Busy signal', select: 'Inspect Codex' })[key],
};

test('descriptor keeps identity, localized labels, sprite, and external task separate', () => {
  assert.deepEqual(agentRosterDescriptor(row, options), {
    id: 'main', selected: true, tone: 'work', signalKind: 'busy', portraitSrc: '/portrait.png',
    portraitClass: 'pixel', name: 'Codex', signalLabel: 'Busy signal', externalTask: 'RAW_TASK',
    ariaLabel: 'Inspect Codex',
  });
});

test('view renders accessible selectable portrait cards and marks runtime tasks as external copy', () => {
  const root = new FakeNode('div');
  const selections = [];
  const view = createAgentRosterView({
    root,
    documentRef,
    spriteFor: options.spriteFor,
    textFor: options.textFor,
    onSelect: (selection) => selections.push(selection),
  });

  view.render([row], { selectedId: 'main' });

  const article = root.children[0];
  const [portrait, copy] = article.children;
  const [name, state, task, svg] = copy.children;
  assert.equal(article.dataset.selectionKind, 'agent');
  assert.equal(article.dataset.selectionId, 'main');
  assert.equal(article.dataset.signalKind, 'busy');
  assert.equal(article.classList.contains('selected'), true);
  assert.equal(article.getAttribute('aria-label'), 'Inspect Codex');
  assert.equal(portrait.src, '/portrait.png');
  assert.match(portrait.className, /pixel/);
  assert.equal(portrait.alt, '');
  assert.equal(name.textContent, 'Codex');
  assert.equal(name.dataset.externalCopy, 'true');
  assert.equal(state.textContent, 'Busy signal');
  assert.equal(task.textContent, 'RAW_TASK');
  assert.equal(task.dataset.externalCopy, 'true');
  assert.equal(svg.dataset.agentEcg, 'main');
  assert.equal(svg.getAttribute('aria-label'), 'Codex · Busy signal');

  article.dispatch('click');
  article.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  assert.deepEqual(selections, [{ kind: 'agent', id: 'main' }, { kind: 'agent', id: 'main' }]);

  view.render([], { selectedId: '' });
  assert.deepEqual(root.children, []);
  view.destroy();
  assert.deepEqual(root.children, []);
});

test('click and keyboard activation pass the exact card trigger', () => {
  const root = new FakeNode('div');
  const activations = [];
  const view = createAgentRosterView({
    root, documentRef, spriteFor: options.spriteFor, textFor: options.textFor,
    onActivate: (selection, trigger) => activations.push([selection, trigger]),
  });
  view.render([row]);
  const card = root.children[0];

  card.dispatch('click');
  card.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  card.dispatch('keydown', { key: ' ', preventDefault() {} });

  assert.deepEqual(activations.map(([selection]) => selection), [
    { kind: 'agent', id: 'main' }, { kind: 'agent', id: 'main' }, { kind: 'agent', id: 'main' },
  ]);
  assert.ok(activations.every(([, trigger]) => trigger === card));
});

test('refresh preserves a focused roster card without stealing outside focus', () => {
  const root = new FakeNode('div', documentRef);
  const view = createAgentRosterView({
    root, documentRef, spriteFor: options.spriteFor, textFor: options.textFor,
  });
  view.render([row]);
  const card = root.children[0];
  card.focus();

  view.render([row]);
  view.render([{ ...row, externalTask: 'UPDATED_TASK' }]);

  assert.equal(documentRef.activeElement, card);
  assert.deepEqual(card.focusCalls.slice(-2), [{ preventScroll: true }, { preventScroll: true }]);

  const outside = new FakeNode('button', documentRef);
  outside.focus();
  const restoreCount = card.focusCalls.length;
  view.render([{ ...row, externalTask: 'ANOTHER_UPDATE' }]);

  assert.equal(documentRef.activeElement, outside);
  assert.equal(card.focusCalls.length, restoreCount);
});

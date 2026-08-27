import test from 'node:test';
import assert from 'node:assert/strict';

import { agentRosterDescriptor, createAgentRosterView } from '../public/agent_roster_view.mjs';

class FakeNode {
  constructor(tagName) {
    this.tagName = tagName;
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

  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) { this.listeners.set(type, listener); }
  dispatch(type, event = {}) { this.listeners.get(type)?.(event); }
}

const documentRef = {
  createElement: (tagName) => new FakeNode(tagName),
  createElementNS: (_namespace, tagName) => new FakeNode(tagName),
};

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

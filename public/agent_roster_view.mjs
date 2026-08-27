export function agentRosterDescriptor(row, {
  selectedId = '',
  spriteFor,
  textFor,
} = {}) {
  const sprite = spriteFor?.(row.portraitInput) || {};
  const signalKind = row.signal?.kind || 'idle';
  const signalLabel = textFor?.(signalKind) || signalKind;
  return {
    id: row.id,
    selected: row.id === selectedId,
    tone: row.signal?.tone || 'rest',
    signalKind,
    portraitSrc: sprite.src || '',
    portraitClass: sprite.pixelClass || '',
    name: row.name,
    signalLabel,
    externalTask: row.externalTask,
    ariaLabel: textFor?.('select', { name: row.name, signal: signalLabel }) || row.name,
  };
}

export function createAgentRosterView({
  root,
  documentRef = globalThis.document,
  spriteFor,
  textFor,
  onSelect = () => {},
} = {}) {
  const nodes = new Map();
  const build = () => {
    const article = documentRef.createElement('article');
    article.className = 'agent-roster-card';
    article.tabIndex = 0;
    article.setAttribute('role', 'button');

    const portrait = documentRef.createElement('img');
    portrait.className = 'agent-roster-portrait';
    const copy = documentRef.createElement('div');
    copy.className = 'agent-roster-copy';
    const name = documentRef.createElement('strong');
    name.className = 'agent-roster-name';
    name.dataset.externalCopy = 'true';
    const state = documentRef.createElement('span');
    state.className = 'agent-roster-state';
    const task = documentRef.createElement('span');
    task.className = 'agent-roster-task';
    task.dataset.externalCopy = 'true';
    const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('agent-roster-ecg');
    svg.setAttribute('viewBox', '0 0 176 32');
    svg.dataset.agentEcg = '';
    const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.append(path);
    copy.append(name, state, task, svg);
    article.append(portrait, copy);

    const select = () => onSelect({ kind: 'agent', id: article.dataset.selectionId });
    article.addEventListener('click', select);
    article.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      select();
    });
    return { article, portrait, name, state, task, svg };
  };

  return {
    render(rows = [], { selectedId = '' } = {}) {
      const ordered = rows.map((row) => {
        const node = nodes.get(row.id) || build();
        nodes.set(row.id, node);
        const item = agentRosterDescriptor(row, { selectedId, spriteFor, textFor });
        node.article.dataset.selectionKind = 'agent';
        node.article.dataset.selectionId = item.id;
        node.article.dataset.tone = item.tone;
        node.article.dataset.signalKind = item.signalKind;
        node.article.classList.toggle('selected', item.selected);
        node.article.setAttribute('aria-label', item.ariaLabel);
        node.portrait.src = item.portraitSrc;
        node.portrait.className = `agent-roster-portrait ${item.portraitClass}`.trim();
        node.portrait.alt = '';
        node.name.textContent = item.name;
        node.state.textContent = item.signalLabel;
        node.task.textContent = item.externalTask;
        node.svg.dataset.agentEcg = item.id;
        node.svg.setAttribute('aria-label', `${item.name} · ${item.signalLabel}`);
        return node.article;
      });
      const retained = new Set(rows.map(({ id }) => id));
      for (const id of nodes.keys()) {
        if (!retained.has(id)) nodes.delete(id);
      }
      root.replaceChildren(...ordered);
    },
    destroy() {
      root.replaceChildren();
      nodes.clear();
    },
  };
}

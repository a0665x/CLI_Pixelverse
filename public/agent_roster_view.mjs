import {applyAgentPortrait} from './agent_portrait.mjs';
import {activityLabel} from './agent_activity.mjs';
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
    ...(Number.isInteger(sprite.frame)?{portraitFrame:sprite.frame}:{}),
    portraitClass: sprite.pixelClass || '',
    name: row.name,
    ...(row.identity ? {identity:row.identity} : {}),
    signalLabel,
    projectName: row.projectName || '',
    externalTask: row.externalTask,
    ariaLabel: [
      textFor?.('select', { name: row.name, signal: signalLabel }) || row.name,
      row.projectName,
    ].filter(Boolean).join(' · '),
  };
}

export function createAgentRosterView({
  root,
  documentRef = globalThis.document,
  spriteFor,
  textFor,
  onSelect = () => {},
  onActivate = () => {},
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
    const activity = documentRef.createElement('span');activity.className='agent-roster-activity';
    const glyph=documentRef.createElement('span');glyph.className='activity-glyph';glyph.setAttribute('aria-hidden','true');
    const activityText=documentRef.createElement('span');activity.append(glyph,activityText);
    const project = documentRef.createElement('span');
    project.className = 'agent-roster-project';
    const task = documentRef.createElement('span');
    task.className = 'agent-roster-task';
    const svg = documentRef.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.classList.add('agent-roster-ecg');
    svg.setAttribute('viewBox', '0 0 176 32');
    svg.dataset.agentEcg = '';
    const path = documentRef.createElementNS('http://www.w3.org/2000/svg', 'path');
    svg.append(path);
    copy.append(name, state, activity, project, task, svg);
    article.append(portrait, copy);

    const activate = () => {
      const selection = { kind: 'agent', id: article.dataset.selectionId };
      onSelect(selection);
      onActivate(selection, article);
    };
    article.addEventListener('click', activate);
    article.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      activate();
    });
    return { article, portrait, name, state, activity, glyph, activityText, project, task, svg };
  };

  return {
    render(rows = [], { selectedId = '' } = {}) {
      const activeElement = documentRef.activeElement;
      const focusedCard = activeElement && root.contains(activeElement)
        ? activeElement.closest?.('.agent-roster-card')
        : null;
      const focusedId = focusedCard?.dataset?.selectionId || '';
      const ordered = rows.map((row) => {
        const node = nodes.get(row.id) || build();
        nodes.set(row.id, node);
        const item = agentRosterDescriptor(row, { selectedId, spriteFor, textFor });
        node.article.dataset.selectionKind = 'agent';
        node.article.dataset.selectionId = item.id;
        node.article.dataset.tone = item.tone;
        node.article.dataset.signalKind = item.signalKind;
        node.activity.hidden=!row.activity;
        if(row.activity){node.activity.dataset.activity=row.activity.kind;node.glyph.textContent=row.activity.icon;node.activityText.textContent=activityLabel(row.activity,documentRef.documentElement?.lang);node.activity.title=[node.activityText.textContent,row.activity.tool].filter(Boolean).join(' · ');}
        node.article.classList.toggle('selected', item.selected);
        node.article.setAttribute('aria-label', item.ariaLabel);
        node.portrait.dataset.agentPortraitId=item.id;
        applyAgentPortrait(node.portrait,{src:item.portraitSrc,frame:item.portraitFrame});
        node.portrait.className = `agent-roster-portrait ${item.portraitClass}`.trim();
        node.portrait.alt = '';
        node.name.textContent = item.name;
        const roles=({'zh-TW':{main:'主 Agent',sub:'子 Agent',branch:'分支'},'ja-JP':{main:'メイン',sub:'サブ',branch:'分岐'},'ko-KR':{main:'메인',sub:'하위',branch:'분기'}})[documentRef.documentElement?.lang]||{main:'Main',sub:'Subagent',branch:'Branch'};
        node.state.textContent = item.identity ? `${roles[item.identity.role]} #${item.identity.code} · ${item.signalLabel}` : item.signalLabel;
        node.article.title=item.identity?[item.name,`${roles[item.identity.role]} #${item.identity.code}`,item.identity.parentName?`↳ ${item.identity.parentName}`:'',item.identity.project].filter(Boolean).join(' · '):item.name;
        node.project.textContent = [item.projectName,item.identity?.parentName?`↳ ${item.identity.parentName}`:''].filter(Boolean).join(' · ');
        node.project.hidden = !node.project.textContent;
        if (item.projectName) node.project.dataset.externalCopy = 'true';
        else delete node.project.dataset.externalCopy;
        node.task.textContent = item.externalTask;
        if (item.externalTask) node.task.dataset.externalCopy = 'true';
        else delete node.task.dataset.externalCopy;
        node.svg.dataset.agentEcg = item.id;
        node.svg.setAttribute('aria-label', `${item.name} · ${item.signalLabel}`);
        return node.article;
      });
      const retained = new Set(rows.map(({ id }) => id));
      for (const id of nodes.keys()) {
        if (!retained.has(id)) nodes.delete(id);
      }
      root.replaceChildren(...ordered);
      const restoredCard = focusedId ? nodes.get(focusedId)?.article : null;
      if (restoredCard) restoredCard.focus({ preventScroll: true });
    },
    destroy() {
      root.replaceChildren();
      nodes.clear();
    },
  };
}

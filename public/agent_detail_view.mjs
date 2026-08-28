const valueText = (value, fallback = '—') => (
  value === undefined || value === null || value === '' ? fallback : String(value)
);

export function createAgentDetailView({
  root,
  documentRef = globalThis.document,
  textFor = (key) => key,
  spriteFor = () => ({}),
  modeFor = () => (globalThis.innerWidth < 900 ? 'dialog' : 'drawer'),
  onClose = () => {},
} = {}) {
  let originTrigger = null;
  let opened = false;
  let currentDetail = null;
  const panel = root?.querySelector?.('[data-agent-detail-panel]');
  const closeButton = root?.querySelector?.('[data-agent-detail-close]');

  const setText = (selector, value, { external = false } = {}) => {
    const node = root?.querySelector?.(selector);
    if (!node) return;
    node.textContent = valueText(value);
    if (external) node.dataset.externalCopy = 'true';
    else delete node.dataset.externalCopy;
  };

  const render = (detail) => {
    if (!detail || !root) return;
    currentDetail = detail;
    root.dataset.agentId = detail.id;
    root.dataset.agentDetailMode = modeFor();
    root.dataset.signalKind = detail.signal?.kind || 'idle';
    const portrait = root.querySelector?.('[data-agent-detail-portrait]');
    const sprite = spriteFor(detail.portraitInput) || {};
    if (portrait) {
      portrait.src = sprite.src || '';
      portrait.alt = '';
      portrait.className = `agent-detail-portrait ${sprite.pixelClass || ''}`.trim();
    }
    setText('[data-agent-detail-name]', detail.name, { external: true });
    setText('[data-agent-detail-role]', textFor(`agentDetail.role.${detail.role}`));
    setText('[data-agent-detail-state]', textFor(`agentState.${detail.pixelState}`));
    setText('[data-agent-detail-task]', detail.task || textFor('agentDetail.noTask'), { external: Boolean(detail.task) });
    setText('[data-agent-detail-room]', detail.room?.label ? textFor(detail.room.label) : detail.room?.key);
    setText('[data-agent-detail-tool]', detail.tool, { external: Boolean(detail.tool) });
    setText('[data-agent-detail-hook]', detail.hook, { external: Boolean(detail.hook) });
    setText('[data-agent-detail-process]', detail.processIdentity, { external: detail.processIdentity != null });
    setText('[data-agent-detail-session]', detail.sessionIdentity, { external: Boolean(detail.sessionIdentity) });
    setText('[data-agent-detail-last-seen]', detail.lastSeen);
    const ecg = root.querySelector?.('[data-agent-detail-ecg]');
    if (ecg) {
      ecg.dataset.agentEcg = detail.id;
      ecg.setAttribute?.('aria-label', `${detail.name} · ${textFor(`commandDeck.roster.signal.${detail.signal?.kind || 'idle'}`)}`);
    }
    const eventRoot = root.querySelector?.('[data-agent-detail-events]');
    if (eventRoot) {
      const events = (detail.recentEvents || []).map((event) => {
        const node = documentRef.createElement('article');
        node.className = 'agent-detail-event';
        node.dataset.externalCopy = 'true';
        node.textContent = valueText(event.summary || event.preview || event.message || event.event || event.type);
        return node;
      });
      eventRoot.replaceChildren(...events);
    }
  };

  const close = () => {
    if (!opened) return;
    opened = false;
    currentDetail = null;
    root.hidden = true;
    root.setAttribute?.('aria-hidden', 'true');
    onClose();
    const restore = originTrigger;
    originTrigger = null;
    if (restore?.isConnected) restore.focus?.();
  };

  const onRootClick = (event) => {
    if (event.target === root && root.dataset.agentDetailMode === 'dialog') close();
  };
  const onRootKeydown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault?.();
      close();
      return;
    }
    if (event.key !== 'Tab' || root.dataset.agentDetailMode !== 'dialog') return;
    const focusable = [...(panel?.querySelectorAll?.('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') || [])];
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && documentRef.activeElement === first) { event.preventDefault?.(); last.focus?.(); }
    else if (!event.shiftKey && documentRef.activeElement === last) { event.preventDefault?.(); first.focus?.(); }
  };
  closeButton?.addEventListener?.('click', close);
  root?.addEventListener?.('click', onRootClick);
  root?.addEventListener?.('keydown', onRootKeydown);

  return {
    open(detail, trigger) {
      if (!detail || !root) return;
      if (!opened) originTrigger = trigger || documentRef.activeElement || null;
      opened = true;
      root.hidden = false;
      root.setAttribute?.('aria-hidden', 'false');
      render(detail);
      closeButton?.focus?.();
    },
    render,
    close,
    isOpen: () => opened,
    current: () => currentDetail,
    destroy() {
      close();
      closeButton?.removeEventListener?.('click', close);
      root?.removeEventListener?.('click', onRootClick);
      root?.removeEventListener?.('keydown', onRootKeydown);
    },
  };
}

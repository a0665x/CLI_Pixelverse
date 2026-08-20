export function agentOverlaySide(agent = {}) {
  const key = String(agent.agent || agent.id || agent.name || 'agent');
  let hash = 0;
  for (const char of key) {
    hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  }
  return Math.abs(hash) % 2 === 0 ? 'right' : 'left';
}

export function agentOverlayClass(agent = {}) {
  return `overlay-${agentOverlaySide(agent)}`;
}

import { agentTaskText } from './ui_strings.mjs';

export const escapeHtml = (value = '') => String(value).replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character]);

export function agentPayloadPresentation(agent = {}, fallback = '') {
  return { task: agentTaskText(agent) || String(fallback || '') };
}

export function currentAgentStatePresentation({ name = '', state = '', room = '', detail = '' } = {}) {
  return { detail: String(detail || ''), text: [name, state, room, detail].filter(Boolean).join(' · ') };
}

export function timelinePayloadPresentation(panel = {}, fallback = '') {
  const task = String(panel.taskLabel || '');
  const summary = String(panel.latestSummary || fallback || '');
  return { task, summary, taskHtml: escapeHtml(task), summaryHtml: escapeHtml(summary) };
}

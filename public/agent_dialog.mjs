import {
  ambientText,
  agentTaskText,
  getLocaleStrings,
  getRoomCopy,
  localizeToolSummary,
  normalizeLocale,
  uiText,
} from './ui_strings.mjs';

function latestAction(agent = {}) {
  return (agent.recent_actions || [])[0] || {};
}

function taskLabel(agent = {}, locale = 'zh-TW') {
  return agentTaskText(agent, locale) || localizeToolSummary(agent.tool_label || '', locale) || agent.tool_label || '';
}

function eventPreview(action = {}) {
  return String(action.preview || action.message || '');
}

export function buildAgentSpeech(agent = {}, locale = 'zh-TW') {
  const copy = getLocaleStrings(locale);
  const action = latestAction(agent);
  const task = taskLabel(agent, locale);
  const preview = eventPreview(action);
  if (agent.speech) {
    return { summary: String(agent.speech), detail: agent.speech, clickable: true };
  }
  const summary = agent.role === 'main_agent' || task
    ? ambientText(locale, agent, task)
    : '';
  const clickable = ['planning', 'thinking', 'working'].includes(agent.state);
  return {
    summary,
    detail: preview || task || summary || copy.idleFallback,
    clickable,
  };
}

export function buildAgentDialog(agent = {}, locale = 'zh-TW') {
  const normalized = normalizeLocale(locale);
  const copy = getLocaleStrings(locale);
  const action = latestAction(agent);
  const room = getRoomCopy(agent.room_key, locale);
  const roomName = room.name || agent.room_label || copy.unknownRoom;
  const task = taskLabel(agent, locale) || copy.idleFallback;
  const detail = buildAgentSpeech(agent, locale);
  const state = copy.states?.[agent.state] || agent.state || copy.idleFallback;
  const label = uiText(normalized, 'commandDeck.inspector.liveDetail', {
    name: agent.name || uiText(normalized, 'commandDeck.inspector.agentFallback'),
  });
  const body = [detail.detail, previewRow(action, normalized)]
    .filter(Boolean)
    .join(uiText(normalized, 'commandDeck.inspector.detailSeparator'));
  return {
    title: label,
    body,
    rows: [
      { label: uiText(normalized, 'commandDeck.inspector.rowState'), value: state },
      { label: uiText(normalized, 'commandDeck.inspector.rowRoom'), value: roomName },
      { label: uiText(normalized, 'commandDeck.inspector.rowTask'), value: task },
      ...(action.time ? [{ label: uiText(normalized, 'commandDeck.inspector.rowEventTime'), value: new Date(action.time).toLocaleTimeString(normalized, { hour12: false }) }] : []),
    ],
  };
}

function previewRow(action = {}, locale = 'zh-TW') {
  if (!action || (!action.message && !action.preview && !action.tool_name && !(action.tool_names || []).length)) return '';
  const tool = localizeToolSummary(action.tool_name || (action.tool_names || []).join(', '), locale) || action.tool_name || (action.tool_names || []).join(', ');
  const preview = eventPreview(action);
  const value = tool && preview ? `${tool}｜${preview}` : preview || tool;
  return uiText(locale, 'commandDeck.inspector.latestEvent', { value });
}

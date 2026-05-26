import { getLocaleStrings, getRoomCopy, localizeToolSummary } from './ui_strings.mjs';

function short(text = '', max = 72) {
  return text && text.length > max ? `${text.slice(0, max - 1)}…` : (text || '');
}

function latestAction(agent = {}) {
  return (agent.recent_actions || [])[0] || {};
}

function taskLabel(agent = {}, locale = 'zh-TW') {
  return localizeToolSummary(agent.task || agent.tool_label || '', locale) || agent.task || agent.tool_label || '';
}

function eventPreview(action = {}) {
  return short(action.preview || action.message || '', 84);
}

export function buildAgentSpeech(agent = {}, locale = 'zh-TW') {
  const copy = getLocaleStrings(locale);
  const action = latestAction(agent);
  const task = short(taskLabel(agent, locale), locale === 'en-US' ? 30 : 20);
  const preview = eventPreview(action);
  if (agent.speech) {
    return { summary: short(agent.speech, locale === 'en-US' ? 52 : 34), detail: agent.speech, clickable: true };
  }
  if (locale === 'en-US') {
    if (agent.state === 'planning') return { summary: task ? `Plan: ${task}` : 'Planning route…', detail: preview || agent.activity_hint || task || 'Planning route…', clickable: true };
    if (agent.state === 'thinking') return { summary: task ? `Think: ${task}` : 'Reasoning quietly', detail: preview || agent.activity_hint || task || 'Reasoning quietly', clickable: true };
    if (agent.state === 'working') return { summary: task ? `Doing: ${task}` : 'Running tools', detail: preview || agent.activity_hint || task || 'Running tools', clickable: true };
    if (agent.state === 'offline') return { summary: 'Signal lost', detail: agent.activity_hint || 'No live bridge signal', clickable: false };
    return { summary: agent.role === 'main_agent' ? 'Standing by' : '', detail: agent.activity_hint || copy.idleFallback, clickable: false };
  }
  if (agent.state === 'planning') return { summary: task ? `規劃：${task}` : '正在拆解需求', detail: preview || agent.activity_hint || task || '正在拆解需求', clickable: true };
  if (agent.state === 'thinking') return { summary: task ? `思考：${task}` : '正在整理推理', detail: preview || agent.activity_hint || task || '正在整理推理', clickable: true };
  if (agent.state === 'working') return { summary: task ? `執行：${task}` : '工具運作中', detail: preview || agent.activity_hint || task || '工具運作中', clickable: true };
  if (agent.state === 'offline') return { summary: '訊號中斷', detail: agent.activity_hint || '目前沒有主代理即時事件', clickable: false };
  return { summary: agent.role === 'main_agent' ? '待命中' : '', detail: agent.activity_hint || copy.idleFallback, clickable: false };
}

export function buildAgentDialog(agent = {}, locale = 'zh-TW') {
  const copy = getLocaleStrings(locale);
  const action = latestAction(agent);
  const room = getRoomCopy(agent.room_key, locale);
  const roomName = room.name || agent.room_label || copy.unknownRoom;
  const task = taskLabel(agent, locale) || copy.idleFallback;
  const detail = buildAgentSpeech(agent, locale);
  const state = copy.states?.[agent.state] || agent.state || copy.idleFallback;
  const label = locale === 'en-US' ? `${agent.name || 'Agent'} live detail` : `${agent.name || '代理'} 即時細節`;
  const body = [detail.detail, agent.activity_hint, previewRow(action, locale)].filter(Boolean).join(locale === 'en-US' ? ' • ' : '｜');
  return {
    title: label,
    body,
    rows: [
      { label: locale === 'en-US' ? 'State' : '狀態', value: state },
      { label: locale === 'en-US' ? 'Room' : '房間', value: roomName },
      { label: locale === 'en-US' ? 'Task' : '任務', value: task },
      ...(action.time ? [{ label: locale === 'en-US' ? 'Event time' : '事件時間', value: new Date(action.time).toLocaleTimeString(locale === 'en-US' ? 'en-US' : 'zh-TW', { hour12: false }) }] : []),
    ],
  };
}

function previewRow(action = {}, locale = 'zh-TW') {
  if (!action || (!action.message && !action.preview && !action.tool_name && !(action.tool_names || []).length)) return '';
  const tool = localizeToolSummary(action.tool_name || (action.tool_names || []).join(', '), locale) || action.tool_name || (action.tool_names || []).join(', ');
  const preview = eventPreview(action);
  if (locale === 'en-US') {
    if (tool && preview) return `Latest event: ${tool} | ${preview}`;
    return `Latest event: ${preview || tool}`;
  }
  if (tool && preview) return `最新事件：${tool}｜${preview}`;
  return `最新事件：${preview || tool}`;
}

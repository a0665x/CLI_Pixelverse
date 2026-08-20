import { agentTaskText, localizeToolSummary, uiText } from './ui_strings.mjs';

function latestAction(agent = {}) {
  return Array.isArray(agent.recent_actions) ? agent.recent_actions[0] || {} : {};
}

function toolLabel(action = {}, locale = 'zh-TW') {
  const explicit = action.tool_name || (Array.isArray(action.tool_names) ? action.tool_names.join(', ') : '');
  return explicit ? (localizeToolSummary(explicit, locale) || String(explicit)) : '';
}

function rawActionPayload(action = {}) {
  if (action.preview !== undefined && action.preview !== null && action.preview !== '') return String(action.preview);
  if (action.message !== undefined && action.message !== null && action.message !== '') return String(action.message);
  return '';
}

const PIXEL_VISUALS = {
  reading_files: ['planning', '📖'], editing_files: ['working', '✏️'], shell_command: ['working', '⌨️'],
  browsing: ['working', '🌐'], external_tool: ['working', '🔌'],
  blocked: ['offline', '⚠️'], self_healing: ['working', '🔧'], awaiting_input: ['thinking', '⌛'],
  initializing: ['planning', '🌀'], sleeping: ['idle', '💤'], collaborating: ['working', '💬'],
  invoking_skill: ['working', '✨'], tool_call: ['working', '🧰'], executing: ['working', '💻'], responding: ['working', '✍️'],
};

export function deriveAgentEventVisual(agent = {}, locale = 'zh-TW') {
  const action = latestAction(agent);
  const eventName = action.event_name || '';
  const state = agent.state || 'idle';
  const pixelState = agent.pixel_state || state;
  const localizedTool = toolLabel(action, locale);
  const rawPayload = rawActionPayload(action);
  if (agent.role === 'main_agent') {
    if (eventName === 'main.task.started') return {
      tone: 'planning', icon: '🚩', label: uiText(locale, 'commandDeck.eventChip.events.taskStart'),
      detail: uiText(locale, 'commandDeck.eventChip.details.taskStarted', { value: rawPayload }),
    };
    if (eventName === 'main.reasoning') return {
      tone: 'planning', icon: '🧠', label: uiText(locale, 'commandDeck.eventChip.events.reasoning'),
      detail: rawPayload || uiText(locale, 'commandDeck.eventChip.details.reasoning'),
    };
    if (eventName === 'main.tool.started') return {
      tone: 'working', icon: '▶', label: uiText(locale, 'commandDeck.eventChip.events.toolStart', { tool: localizedTool }),
      detail: uiText(locale, 'commandDeck.eventChip.details.started', { value: rawPayload }),
    };
    if (eventName === 'main.tool.completed') return {
      tone: 'working', icon: '✓', label: uiText(locale, 'commandDeck.eventChip.events.toolDone', { tool: localizedTool }),
      detail: uiText(locale, 'commandDeck.eventChip.details.finished', { value: rawPayload }),
    };
    if (eventName === 'main.tool.batch') return {
      tone: 'working', icon: '🛠️', label: uiText(locale, 'commandDeck.eventChip.events.toolRoute'),
      detail: [localizedTool, rawPayload].filter(Boolean).join(' · ') || uiText(locale, 'commandDeck.eventChip.details.toolRoute'),
    };
    if (eventName === 'main.task.completed') return {
      tone: 'idle', icon: '🏁', label: uiText(locale, 'commandDeck.eventChip.events.standby'),
      detail: uiText(locale, 'commandDeck.eventChip.details.completed', { value: rawPayload }),
    };
  }
  if (PIXEL_VISUALS[pixelState]) {
    const [tone, icon] = PIXEL_VISUALS[pixelState];
    return { tone, icon, label: uiText(locale, `commandDeck.eventChip.pixel.${pixelState}`), detail: localizedTool || agentTaskText(agent) };
  }
  const stateKey = ['working', 'planning', 'thinking', 'offline'].includes(state) ? state : 'standby';
  return {
    tone: state === 'offline' ? 'offline' : state === 'planning' ? 'planning' : state === 'thinking' ? 'thinking' : state === 'working' ? 'working' : 'idle',
    icon: state === 'offline' ? '⛔' : state === 'planning' ? '🗺️' : state === 'thinking' ? '💭' : state === 'working' ? '⚙️' : '🛋️',
    label: uiText(locale, `commandDeck.eventChip.states.${stateKey}`),
    detail: localizedTool || agentTaskText(agent),
  };
}

export function agentEventChipPresentation(agent = {}, locale = 'zh-TW') {
  const visual = deriveAgentEventVisual(agent, locale);
  return {
    visual,
    textContent: `${visual.icon} ${visual.label}`,
    title: visual.detail || visual.label || '',
    className: `event-chip ${visual.tone || 'idle'}`,
    visible: Boolean(visual.label),
  };
}

import { localizeToolSummary } from './ui_strings.mjs';

function latestAction(agent = {}) {
  return Array.isArray(agent.recent_actions) ? agent.recent_actions[0] || {} : {};
}

function toolLabel(action = {}, locale = 'zh-TW') {
  const names = [];
  if (action.tool_name) names.push(action.tool_name);
  if (Array.isArray(action.tool_names) && action.tool_names.length) names.push(action.tool_names.join(', '));
  if (action.preview) names.push(action.preview);
  const localized = localizeToolSummary(names[0] || '', locale);
  return localized || names[0] || '';
}

export function deriveAgentEventVisual(agent = {}, locale = 'zh-TW') {
  const action = latestAction(agent);
  const eventName = action.event_name || '';
  const state = agent.state || 'idle';
  const localizedTool = toolLabel(action, locale);
  if (agent.role === 'main_agent') {
    if (eventName === 'main.reasoning') {
      return {
        tone: 'planning',
        icon: '🧠',
        label: locale === 'zh-TW' ? '規劃推演' : 'Reasoning',
        detail: action.preview || action.message || (locale === 'zh-TW' ? '正在整理藍圖與策略' : 'Planning the next step'),
      };
    }
    if (eventName === 'main.tool.started') {
      return {
        tone: 'working',
        icon: '▶',
        label: locale === 'zh-TW' ? `${localizedTool || '工具'} 啟動` : `${localizedTool || 'Tool'} start`,
        detail: locale === 'zh-TW'
          ? `開始：${action.preview || action.message || '開始執行工具'}`
          : `Started: ${action.preview || action.message || 'Tool execution started'}`,
      };
    }
    if (eventName === 'main.tool.completed') {
      return {
        tone: 'working',
        icon: '✓',
        label: locale === 'zh-TW' ? `${localizedTool || '工具'} 完成` : `${localizedTool || 'Tool'} done`,
        detail: locale === 'zh-TW'
          ? `完成：${action.preview || action.message || '工具已完成'}`
          : `Finished: ${action.preview || action.message || 'Tool finished'}`,
      };
    }
    if (eventName === 'main.tool.batch') {
      return {
        tone: 'working',
        icon: '🛠️',
        label: locale === 'zh-TW' ? '工具序列' : 'Tool route',
        detail: localizedTool || action.message || (locale === 'zh-TW' ? '切換工具序列' : 'Tool sequence updated'),
      };
    }
    if (eventName === 'main.task.completed') {
      return {
        tone: 'idle',
        icon: '🏁',
        label: locale === 'zh-TW' ? '回到待命' : 'Standby',
        detail: action.preview || action.message || (locale === 'zh-TW' ? '任務完成，回到客廳待命區' : 'Task completed, back to standby'),
      };
    }
  }

  if (state === 'working') return { tone: 'working', icon: '⚙️', label: locale === 'zh-TW' ? '執行中' : 'Working', detail: localizedTool || agent.task || '' };
  if (state === 'planning') return { tone: 'planning', icon: '🗺️', label: locale === 'zh-TW' ? '規劃中' : 'Planning', detail: localizedTool || agent.task || '' };
  if (state === 'thinking') return { tone: 'thinking', icon: '💭', label: locale === 'zh-TW' ? '思考中' : 'Thinking', detail: localizedTool || agent.task || '' };
  if (state === 'offline') return { tone: 'offline', icon: '⛔', label: locale === 'zh-TW' ? '離線' : 'Offline', detail: localizedTool || agent.task || '' };
  return { tone: 'idle', icon: '🛋️', label: locale === 'zh-TW' ? '待命中' : 'Standby', detail: localizedTool || agent.task || '' };
}

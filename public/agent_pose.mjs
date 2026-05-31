const TOOL_RULES = [
  { test: /(memory|todo|archive|session|history)/i, pose: 'notes', icon: '🗄️', types: ['cabinet', 'bookshelf', 'table', 'desk'] },
  { test: /(search_files|session_search|read_file|browser_snapshot|spec|search|read|plan|map|research|blueprint|route)/i, pose: 'planning', icon: '🗺️', types: ['board', 'whiteboard', 'cabinet', 'table', 'desk', 'bookshelf', 'terminal'] },
  { test: /(patch|write_file|terminal|execute_code|browser_click|browser_type)/i, pose: 'terminal', icon: '💻', types: ['terminal', 'workbench', 'server', 'desk', 'crate'] },
  { test: /(delegate_task)/i, pose: 'dispatch', icon: '🧬', types: ['portal', 'terminal', 'desk', 'server'] },
  { test: /(reply|response|draft|write)/i, pose: 'writing', icon: '✍️', types: ['desk', 'chair', 'table', 'terminal'] },
  { test: /(idle|standby|rest|sleep)/i, pose: 'rest', icon: '🛏️', types: ['bed', 'sofa', 'chair', 'coffee'] },
];

export const INTERACTION_OBJECT_ICONS = {
  bed: '🛏️',
  sofa: '🛋️',
  chair: '🪑',
  desk: '🧑‍💻',
  table: '🗺️',
  board: '🧭',
  whiteboard: '🧭',
  bookshelf: '📚',
  cabinet: '🗄️',
  locker: '🗄️',
  terminal: '💻',
  server: '🖥️',
  workbench: '🛠️',
  portal: '🧬',
  coffee: '☕',
  charger: '⚡',
  crate: '📦',
  lamp: '💡',
};

const POSE_ACTIONS = {
  rest: { zh: '休息', en: 'resting' },
  planning: { zh: '畫藍圖', en: 'planning' },
  ponder: { zh: '思考', en: 'thinking' },
  terminal: { zh: '操作工具', en: 'working' },
  dispatch: { zh: '派遣', en: 'dispatching' },
  notes: { zh: '查閱資料', en: 'reviewing' },
  writing: { zh: '撰寫', en: 'writing' },
  neutral: { zh: '待命', en: 'standing by' },
};

function normalizeToolText(agent = {}) {
  const latest = (agent.recent_actions || [])[0] || {};
  return [
    latest.tool_name,
    ...(latest.tool_names || []),
    agent.task,
    agent.tool_label,
    agent.activity_hint,
    latest.message,
  ].filter(Boolean).join(' ');
}

export function getAgentPose(agent = {}) {
  const state = agent.state || 'idle';
  const pixelState = agent.pixel_state || state;
  const toolText = normalizeToolText(agent);
  if (pixelState === 'blocked') return { pose: 'neutral', icon: '⚠️', preferredTypes: ['server', 'terminal', 'workbench'], state };
  if (pixelState === 'self_healing') return { pose: 'terminal', icon: '🔧', preferredTypes: ['workbench', 'terminal', 'server'], state };
  if (pixelState === 'awaiting_input') return { pose: 'ponder', icon: '⌛', preferredTypes: ['terminal', 'desk', 'chair'], state };
  if (pixelState === 'sleeping') return { pose: 'rest', icon: '💤', preferredTypes: ['bed', 'sofa', 'chair'], state };
  if (pixelState === 'collaborating') return { pose: 'dispatch', icon: '💬', preferredTypes: ['portal', 'desk', 'terminal'], state };
  if (pixelState === 'invoking_skill') return { pose: 'dispatch', icon: '✨', preferredTypes: ['portal', 'terminal', 'desk'], state };
  if (pixelState === 'responding') return { pose: 'writing', icon: '✍️', preferredTypes: ['desk', 'terminal', 'table'], state };
  for (const rule of TOOL_RULES) {
    if (rule.test.test(toolText)) {
      return { pose: rule.pose, icon: rule.icon, preferredTypes: rule.types, state };
    }
  }
  if (state === 'thinking') return { pose: 'ponder', icon: '💭', preferredTypes: ['board', 'whiteboard', 'desk', 'bookshelf', 'lamp'], state };
  if (state === 'planning') return { pose: 'planning', icon: '🗺️', preferredTypes: ['board', 'whiteboard', 'table', 'desk', 'terminal'], state };
  if (state === 'working') return { pose: 'terminal', icon: '💻', preferredTypes: ['terminal', 'desk', 'workbench', 'table'], state };
  if (state === 'idle') return { pose: 'rest', icon: '🛋️', preferredTypes: ['bed', 'sofa', 'chair', 'coffee'], state };
  return { pose: 'neutral', icon: '✨', preferredTypes: ['desk', 'table'], state };
}

export function selectInteractionTarget(agent = {}, decor = [], positions = [], fallback = null) {
  const pose = getAgentPose(agent);
  for (const type of pose.preferredTypes || []) {
    const index = decor.findIndex((item) => item?.type === type);
    if (index >= 0 && positions[index]) {
      const prop = decor[index] || {};
      return {
        ...positions[index],
        prop,
        propIndex: index,
        propType: prop.type || type,
        propLabel: prop.label || prop.labelKey || type,
        objectIcon: INTERACTION_OBJECT_ICONS[prop.type || type] || pose.icon || '✨',
        actionLabelZh: POSE_ACTIONS[pose.pose]?.zh || '互動',
        actionLabelEn: POSE_ACTIONS[pose.pose]?.en || 'interacting',
        pose,
      };
    }
  }
  return fallback ? { ...fallback, pose, prop: null, propType: null, objectIcon: pose.icon || '✨' } : null;
}

export function selectInteractionAnchor(agent = {}, decor = [], positions = [], fallback = null) {
  const target = selectInteractionTarget(agent, decor, positions, fallback);
  return target ? { x: target.x, y: target.y } : fallback;
}

export const HOOK_STATE_ROUTES = [
  { hook: 'SessionStart', state: 'initializing', room: 'clone_bay' },
  { hook: 'UserPromptSubmit', state: 'thinking', room: 'think_lab' },
  { hook: '$skill / /skill', state: 'invoking_skill', room: 'tool_forge' },
  { hook: 'PreToolUse', state: 'tool_call', room: 'tool_forge' },
  { hook: 'PostToolUse', state: 'executing', room: 'tool_forge' },
  { hook: 'SubagentStart / Stop', state: 'collaborating', room: 'clone_bay' },
  { hook: 'Stop', state: 'idle', room: 'standby_dock' },
  { hook: 'stale heartbeat', state: 'offline', room: 'offline_corner' },
];

export function hookStateRoutes() {
  return HOOK_STATE_ROUTES.map((route) => ({ ...route }));
}

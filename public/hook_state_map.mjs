export const HOOK_STATE_ROUTES = [
  { hook: 'SessionStart', state: 'initializing', room: 'clone_bay' },
  { hook: 'UserPromptSubmit', state: 'thinking', room: 'think_lab' },
  { hook: 'UserPromptSubmit: $skill / /skill', state: 'invoking_skill', room: 'tool_forge' },
  { hook: 'PreToolUse / PostToolUse: Read', state: 'reading_files', room: 'file_library' },
  { hook: 'PreToolUse / PostToolUse: Grep / Glob / LS', state: 'reading_files', room: 'file_library' },
  { hook: 'PreToolUse / PostToolUse: Edit / MultiEdit', state: 'editing_files', room: 'code_workbench' },
  { hook: 'PreToolUse / PostToolUse: Write / apply_patch / patch', state: 'editing_files', room: 'code_workbench' },
  { hook: 'PreToolUse / PostToolUse: Bash / terminal / execute', state: 'shell_command', room: 'terminal_bay' },
  { hook: 'PreToolUse / PostToolUse: WebFetch / WebSearch / browser_*', state: 'browsing', room: 'tool_forge' },
  { hook: 'PreToolUse / PostToolUse: mcp__* / github_*', state: 'external_tool', room: 'tool_forge' },
  { hook: 'PreToolUse / PostToolUse: TodoWrite / todo', state: 'planning', room: 'blueprint_lab' },
  { hook: 'PreToolUse / PostToolUse: Task / delegate_task', state: 'collaborating', room: 'clone_bay' },
  { hook: 'SubagentStart / Stop', state: 'collaborating', room: 'clone_bay' },
  { hook: 'heartbeat: preserve_phase=true', state: 'tool_call', room: 'tool_forge' },
  { hook: 'awaiting approval / human input', state: 'awaiting_input', room: 'think_lab' },
  { hook: 'error / failed / blocked', state: 'blocked', room: 'offline_corner' },
  { hook: 'Stop', state: 'idle', room: 'standby_dock' },
  { hook: 'stale heartbeat', state: 'offline', room: 'offline_corner' },
];

export function hookStateRoutes() {
  return HOOK_STATE_ROUTES.map((route) => ({ ...route }));
}

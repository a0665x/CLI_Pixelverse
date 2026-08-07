import type { AgentAction } from '../world/types';

export interface AgentActivity {
  agentId: string;
  buildingId?: string;
  action: AgentAction;
  label: string;
  bubbleText: string;
  bubblePolicy: 'none' | 'transient' | 'persistent';
  priority: number;
  updatedAt: number;
  bubbleExpiresAt: number;
}

export interface BuildingActivitySummary {
  count: number;
  actionCounts: Partial<Record<AgentAction, number>>;
  message: string;
  messagePersistent: boolean;
}

export const ACTION_ICONS: Record<AgentAction, string> = {
  arrive: '✦', ponder: '…', plan: '▤', read: '▥', type: '⌨', terminal: '>_',
  signal: '⌁', dispatch: '◇', respond: '➤', queue: '⌛', repair: '⚒',
  rest: 'z', offline: '×', pulse: '•',
};

export function aggregateBuildingActivity(
  activities: AgentActivity[],
  buildingId: string,
  now: number,
): BuildingActivitySummary {
  const occupants = activities.filter((activity) => activity.buildingId === buildingId);
  const actionCounts: Partial<Record<AgentAction, number>> = {};
  occupants.forEach((activity) => {
    actionCounts[activity.action] = (actionCounts[activity.action] ?? 0) + 1;
  });
  const message = [...occupants]
    .filter((activity) => activity.bubblePolicy === 'persistent' || activity.bubbleExpiresAt > now)
    .sort((left, right) =>
      Number(right.bubblePolicy === 'persistent') - Number(left.bubblePolicy === 'persistent')
      || right.priority - left.priority
      || right.updatedAt - left.updatedAt,
    )[0];
  return {
    count: occupants.length,
    actionCounts,
    message: message?.bubbleText ?? '',
    messagePersistent: message?.bubblePolicy === 'persistent',
  };
}

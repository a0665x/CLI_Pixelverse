import { describe, expect, it } from 'vitest';
import { aggregateBuildingActivity, type AgentActivity } from '../src/status/buildingActivity';

const activity = (overrides: Partial<AgentActivity>): AgentActivity => ({
  agentId: 'main', buildingId: 'build-workshop', action: 'type', label: '修改程式',
  bubbleText: '修改程式', bubblePolicy: 'transient', priority: 40, updatedAt: 1, bubbleExpiresAt: 5,
  ...overrides,
});

describe('aggregateBuildingActivity', () => {
  it('counts occupants by action and chooses persistent/high-priority copy', () => {
    const summary = aggregateBuildingActivity([
      activity({ agentId: 'main', action: 'type' }),
      activity({ agentId: 'subagent-1', action: 'terminal', updatedAt: 2 }),
      activity({ agentId: 'subagent-2', action: 'repair', bubbleText: '工作受阻', bubblePolicy: 'persistent', priority: 100, updatedAt: 3, bubbleExpiresAt: Number.POSITIVE_INFINITY }),
    ], 'build-workshop', 10);
    expect(summary).toEqual({
      count: 3,
      actionCounts: { type: 1, terminal: 1, repair: 1 },
      message: '工作受阻',
      messagePersistent: true,
    });
  });

  it('returns an empty summary when no Agent is assigned to the building', () => {
    expect(aggregateBuildingActivity([], 'knowledge-hall', 10)).toEqual({
      count: 0, actionCounts: {}, message: '', messagePersistent: false,
    });
  });

  it('keeps the occupant count but expires ordinary building copy after four seconds', () => {
    expect(aggregateBuildingActivity([activity({ bubbleExpiresAt: 5 })], 'build-workshop', 6)).toMatchObject({
      count: 1, message: '', messagePersistent: false,
    });
  });
});

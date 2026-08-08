import { describe, expect, it } from 'vitest';
import { routeEvent } from '../src/events/behaviorRouter';
import type { AgentWorldEvent, WorldEventKind } from '../src/world/types';

const event = (kind: WorldEventKind): AgentWorldEvent => ({
  eventId: `evt-${kind}`,
  timestamp: 1,
  source: 'demo',
  agentId: 'main',
  agentRole: 'main',
  kind,
  phase: kind,
  activityLabel: kind,
});

describe('routeEvent', () => {
  it.each([
    ['think', 'planning-board', 'ponder'],
    ['plan', 'planning-board', 'plan'],
    ['read', 'reading-desk', 'read'],
    ['edit', 'editing-desk', 'type'],
    ['tool', 'signal-console', 'terminal'],
    ['web', 'signal-console', 'signal'],
    ['clone', 'dispatch-pad', 'dispatch'],
    ['await', 'queue-plaza', 'queue'],
    ['blocked', 'repair-bench', 'repair'],
    ['idle', 'lounge', 'rest'],
  ] as const)('maps %s to %s/%s', (kind, destinationId, action) => {
    expect(routeEvent(event(kind))).toMatchObject({ destinationId, action });
  });

  it('preserves movement and suppresses bubbles for heartbeat', () => {
    expect(routeEvent(event('heartbeat'))).toEqual({
      preserveLocation: true,
      action: 'pulse',
      bubblePolicy: 'none',
      bubbleText: '',
      priority: 0,
    });
  });

  it('makes blocked persistent and higher-priority than normal work', () => {
    expect(routeEvent(event('blocked'))).toMatchObject({ bubblePolicy: 'persistent', priority: 100 });
    expect(routeEvent(event('edit')).priority).toBeLessThan(100);
  });
});

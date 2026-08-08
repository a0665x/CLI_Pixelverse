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
    ['think', 'research-plan', 'ponder'],
    ['plan', 'research-plan', 'plan'],
    ['read', 'research-read', 'read'],
    ['edit', 'maker-edit', 'type'],
    ['tool', 'maker-tool', 'terminal'],
    ['web', 'research-web', 'signal'],
    ['clone', 'dispatch-pod', 'dispatch'],
    ['respond', 'response-radio', 'respond'],
    ['await', 'queue-benches', 'queue'],
    ['blocked', 'blocked-apron', 'repair'],
    ['self_heal', 'maker-heal', 'repair'],
    ['idle', 'rest-sofa', 'rest'],
    ['offline', 'rest-bed', 'offline'],
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

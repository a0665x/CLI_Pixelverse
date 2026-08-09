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
    ['think', 'think-plan', 'ponder'],
    ['plan', 'think-plan', 'plan'],
    ['read', 'archive-read', 'read'],
    ['edit', 'maker-edit', 'type'],
    ['tool', 'tool-call', 'terminal'],
    ['web', 'network-web', 'signal'],
    ['clone', 'guild-dispatch', 'dispatch'],
    ['respond', 'guild-respond', 'respond'],
    ['await', 'awaiting-wait', 'queue'],
    ['blocked', 'recovery-blocked', 'repair'],
    ['self_heal', 'recovery-heal', 'repair'],
    ['idle', 'rest-sofa', 'rest'],
    ['offline', 'offline-bed', 'offline'],
    ['heartbeat', 'heartbeat-pulse', 'pulse'],
  ] as const)('maps %s to %s/%s', (kind, destinationId, action) => {
    expect(routeEvent(event(kind))).toMatchObject({ destinationId, action });
  });

  it('routes heartbeat to its own visible house without a bubble', () => {
    expect(routeEvent(event('heartbeat'))).toEqual({
      destinationId: 'heartbeat-pulse',
      preserveLocation: false,
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

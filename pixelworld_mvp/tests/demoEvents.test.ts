import { describe, expect, it } from 'vitest';
import { createDemoEvent } from '../src/ui/demoEvents';

describe('createDemoEvent', () => {
  it('creates deterministic, normalized events for the selected Agent', () => {
    expect(createDemoEvent('edit', { id: 'subagent-2', role: 'subagent' }, 7, 123)).toEqual({
      eventId: 'demo-7-edit-subagent-2', timestamp: 123, source: 'demo', agentId: 'subagent-2',
      agentRole: 'subagent', kind: 'edit', phase: 'working', activityLabel: '修改程式',
    });
  });

  it('uses preserve-phase copy for heartbeat without inventing raw detail', () => {
    const event = createDemoEvent('heartbeat', { id: 'main', role: 'main' }, 8, 124);
    expect(event.phase).toBe('preserve_phase');
    expect(event.activityLabel).toBe('仍在工作');
    expect(event.detail).toBeUndefined();
  });
});

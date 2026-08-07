import { describe, expect, it } from 'vitest';
import { EventIngress, sanitizeDisplayDetail } from '../src/events/eventIngress';
import type { AgentWorldEvent } from '../src/world/types';

const valid: AgentWorldEvent = {
  eventId: 'evt-1', timestamp: 1, source: 'demo', agentId: 'main', agentRole: 'main',
  kind: 'edit', phase: 'working', activityLabel: '修改程式', detail: '<script>secret</script>\nlong line',
};

describe('EventIngress', () => {
  it('accepts once and rejects a duplicate event id', () => {
    const ingress = new EventIngress();
    expect(ingress.ingest(valid).accepted).toBe(true);
    expect(ingress.ingest(valid)).toEqual({ accepted: false, reason: 'duplicate-event' });
  });

  it('rejects missing identity without routing', () => {
    const ingress = new EventIngress();
    expect(ingress.ingest({ ...valid, eventId: '', agentId: '' })).toEqual({
      accepted: false,
      reason: 'invalid-event',
    });
  });

  it('strips markup/newlines and caps optional display detail at 80 characters', () => {
    expect(sanitizeDisplayDetail(valid.detail)).toBe('scriptsecret/script long line');
    expect(sanitizeDisplayDetail('x'.repeat(100))).toHaveLength(80);
  });
});

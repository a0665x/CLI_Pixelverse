import { routeEvent } from './behaviorRouter';
import type { AgentWorldEvent, BehaviorRoute } from '../world/types';

export type IngressResult =
  | { accepted: true; event: AgentWorldEvent; route: BehaviorRoute }
  | { accepted: false; reason: 'duplicate-event' | 'invalid-event' };

export function sanitizeDisplayDetail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return clean || undefined;
}

function isValid(event: AgentWorldEvent): boolean {
  return Boolean(
    event.eventId.trim() && event.agentId.trim() && event.phase.trim()
    && event.activityLabel.trim() && Number.isFinite(event.timestamp),
  );
}

export class EventIngress {
  private readonly seen = new Set<string>();

  ingest(input: AgentWorldEvent): IngressResult {
    if (!isValid(input)) return { accepted: false, reason: 'invalid-event' };
    if (this.seen.has(input.eventId)) return { accepted: false, reason: 'duplicate-event' };
    this.seen.add(input.eventId);

    const detail = sanitizeDisplayDetail(input.detail);
    const { detail: _discarded, ...withoutDetail } = input;
    const event: AgentWorldEvent = detail === undefined ? withoutDetail : { ...withoutDetail, detail };
    return { accepted: true, event, route: routeEvent(event) };
  }
}

import { routeEvent } from './behaviorRouter';
import type { AgentWorldEvent, BehaviorRoute, WorldEventKind } from '../world/types';

export type IngressResult =
  | { accepted: true; event: AgentWorldEvent; route: BehaviorRoute }
  | { accepted: false; reason: 'duplicate-event' | 'invalid-event' };

export function sanitizeDisplayDetail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return clean || undefined;
}

const KINDS: readonly WorldEventKind[] = ['session_start', 'think', 'plan', 'read', 'edit', 'tool', 'web', 'clone', 'respond', 'await', 'blocked', 'self_heal', 'idle', 'offline', 'heartbeat', 'unknown'];
const isNonBlank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function isValid(event: unknown): event is AgentWorldEvent {
  if (!event || typeof event !== 'object') return false;
  const value = event as Record<string, unknown>;
  return isNonBlank(value.eventId) && isNonBlank(value.agentId) && isNonBlank(value.phase)
    && isNonBlank(value.activityLabel) && Number.isFinite(value.timestamp)
    && (value.source === 'demo' || value.source === 'hook')
    && (value.agentRole === 'main' || value.agentRole === 'subagent')
    && typeof value.kind === 'string' && KINDS.includes(value.kind as WorldEventKind)
    && (value.detail === undefined || typeof value.detail === 'string')
    && (value.toolName === undefined || typeof value.toolName === 'string');
}

export class EventIngress {
  private readonly seen = new Set<string>();

  ingest(input: unknown): IngressResult {
    if (!isValid(input)) return { accepted: false, reason: 'invalid-event' };
    if (this.seen.has(input.eventId)) return { accepted: false, reason: 'duplicate-event' };
    this.seen.add(input.eventId);

    const detail = sanitizeDisplayDetail(input.detail);
    const { detail: _discarded, ...withoutDetail } = input;
    const event: AgentWorldEvent = detail === undefined ? withoutDetail : { ...withoutDetail, detail };
    return { accepted: true, event, route: routeEvent(event) };
  }
}

import { routeEvent } from './behaviorRouter';
import { WORLD_EVENT_KINDS, type AgentWorldEvent, type BehaviorRoute, type WorldEventKind } from '../world/types';

export type IngressResult =
  | { accepted: true; event: AgentWorldEvent; route: BehaviorRoute }
  | { accepted: false; reason: 'duplicate-event' | 'invalid-event' };

export function sanitizeDisplayDetail(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  return clean || undefined;
}

const KINDS = new Set<WorldEventKind>(WORLD_EVENT_KINDS);
const isNonBlank = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

function isValid(event: unknown): event is AgentWorldEvent {
  if (!event || typeof event !== 'object') return false;
  const value = event as Record<string, unknown>;
  return isNonBlank(value.eventId) && isNonBlank(value.agentId) && isNonBlank(value.phase)
    && isNonBlank(value.activityLabel) && Number.isFinite(value.timestamp)
    && (value.source === 'demo' || value.source === 'hook')
    && (value.agentRole === 'main' || value.agentRole === 'subagent')
    && typeof value.kind === 'string' && KINDS.has(value.kind as WorldEventKind)
    && (value.detail === undefined || typeof value.detail === 'string')
    && (value.toolName === undefined || typeof value.toolName === 'string');
}

export class EventIngress {
  private readonly seen = new Set<string>();

  ingest(input: unknown): IngressResult {
    if (!isValid(input)) return { accepted: false, reason: 'invalid-event' };
    const eventId = input.eventId.trim();
    if (this.seen.has(eventId)) return { accepted: false, reason: 'duplicate-event' };
    this.seen.add(eventId);

    const detail = sanitizeDisplayDetail(input.detail);
    const toolName = input.toolName?.trim() || undefined;
    const { detail: _discardedDetail, toolName: _discardedTool, ...withoutOptional } = input;
    const event: AgentWorldEvent = {
      ...withoutOptional,
      eventId,
      agentId: input.agentId.trim(),
      phase: input.phase.trim(),
      activityLabel: input.activityLabel.trim(),
      ...(detail === undefined ? {} : { detail }),
      ...(toolName === undefined ? {} : { toolName }),
    };
    return { accepted: true, event, route: routeEvent(event) };
  }
}

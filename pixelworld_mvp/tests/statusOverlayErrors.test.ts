import { describe, expect, it, vi } from 'vitest';
import type { AgentController } from '../src/agents/AgentController';
import { StatusOverlaySystem, type StatusFailureReason } from '../src/rendering/StatusOverlaySystem';

vi.mock('phaser', () => ({ default: {} }));

const textObject = () => ({
  text: '', visible: true,
  setOrigin: vi.fn().mockReturnThis(), setDepth: vi.fn().mockReturnThis(),
  setText: vi.fn(function (this: { text: string }, text: string) { this.text = text; return this; }),
  setVisible: vi.fn(function (this: { visible: boolean }, visible: boolean) { this.visible = visible; return this; }),
  setPosition: vi.fn().mockReturnThis(), destroy: vi.fn(),
});

describe('StatusOverlaySystem failure transitions', () => {
  it.each<[StatusFailureReason, string]>([
    ['station-full', '⚠ 工作區已滿'], ['no-path', '⚠ 無法抵達'],
    ['clone-queue', '⚠ Clone 工作位已滿'], ['agent-cap', '⚠ Agent 已達上限'],
  ])('preserves building occupancy and shows accurate %s status', (reason, copy) => {
    const created: ReturnType<typeof textObject>[] = [];
    const scene = { time: { now: 100 }, add: { text: vi.fn(() => { const text = textObject(); created.push(text); return text; }) } };
    const overlay = new StatusOverlaySystem(scene as never, [{
      id: 'build', label: 'Build', bounds: { x: 0, y: 0, width: 1, height: 1 }, labelAnchor: { x: 0, y: 0 },
      entrance: { outside: { x: 0, y: 1 }, threshold: { x: 0, y: 0 }, entryFacing: 'up', exitFacing: 'down' },
    }]);
    const agent = {
      agentId: 'main', role: 'main', sprite: { x: 8, y: 8 }, presence: () => ({ kind: 'outside' }),
    } as AgentController;
    overlay.publish(agent, {
      eventId: 'e', timestamp: 1, source: 'demo', agentId: 'main', agentRole: 'main', kind: 'edit', phase: 'working', activityLabel: '修改程式',
    }, { destinationId: 'editing-desk', preserveLocation: false, action: 'type', bubblePolicy: 'transient', bubbleText: '修改程式', priority: 40 });
    overlay.setPresence('main', 'build');
    expect(created[0]!.visible).toBe(true);

    overlay.showError(agent, reason);

    expect(created[0]!.visible).toBe(true);
    expect(created[1]!.text).toBe(`main · ${copy}`);
    expect(created[2]!.text).toBe(copy);
    expect(created[2]!.visible).toBe(true);
  });

  it('adds building occupancy only after physical arrival', () => {
    const created: ReturnType<typeof textObject>[] = [];
    const scene = { time: { now: 100 }, add: { text: vi.fn(() => { const text = textObject(); created.push(text); return text; }) } };
    const overlay = new StatusOverlaySystem(scene as never, [{
      id: 'build', label: 'Build', bounds: { x: 0, y: 0, width: 1, height: 1 }, labelAnchor: { x: 0, y: 0 },
      entrance: { outside: { x: 0, y: 1 }, threshold: { x: 0, y: 0 }, entryFacing: 'up', exitFacing: 'down' },
    }]);
    const agent = { agentId: 'main', role: 'main', sprite: { x: 8, y: 8 }, presence: () => ({ kind: 'outside' }) } as AgentController;

    overlay.publish(agent, {
      eventId: 'e', timestamp: 1, source: 'demo', agentId: 'main', agentRole: 'main', kind: 'edit', phase: 'working', activityLabel: '修改程式',
    }, { destinationId: 'editing-desk', preserveLocation: false, action: 'type', bubblePolicy: 'transient', bubbleText: '修改程式', priority: 40 });
    expect(created[0]!.visible).toBe(false);

    overlay.setPresence('main', 'build');
    expect(created[0]!.visible).toBe(true);
  });

  it('hides individual overlays inside and restores valid bubbles outside', () => {
    const created: ReturnType<typeof textObject>[] = [];
    const scene = { time: { now: 100 }, add: { text: vi.fn(() => { const text = textObject(); created.push(text); return text; }) } };
    const overlay = new StatusOverlaySystem(scene as never, []);
    let inside = false;
    const agent = {
      agentId: 'main', role: 'main', sprite: { x: 8, y: 8 },
      presence: () => inside ? { kind: 'inside', buildingId: 'build', threshold: { x: 0, y: 0 } } : { kind: 'outside' },
    } as AgentController;
    overlay.publish(agent, {
      eventId: 'e', timestamp: 1, source: 'demo', agentId: 'main', agentRole: 'main', kind: 'plan', phase: 'working', activityLabel: '規劃',
    }, { destinationId: 'planning-board', preserveLocation: false, action: 'plan', bubblePolicy: 'persistent', bubbleText: '規劃中', priority: 40 });

    inside = true;
    overlay.update([agent]);
    expect(created[0]!.visible).toBe(false);
    expect(created[1]!.visible).toBe(false);

    inside = false;
    overlay.update([agent]);
    expect(created[0]!.visible).toBe(true);
    expect(created[1]!.visible).toBe(true);
  });
});

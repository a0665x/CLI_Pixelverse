import Phaser from 'phaser';
import type { AgentController } from '../agents/AgentController';
import { ACTION_ICONS, aggregateBuildingActivity, type AgentActivity, withBuildingPresence } from '../status/buildingActivity';
import type { AgentWorldEvent, BehaviorRoute, WorldBuilding } from '../world/types';

interface AgentOverlay {
  chip: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Text;
  bubbleExpiresAt: number;
}

export type StatusFailureReason = 'station-full' | 'no-path' | 'clone-queue' | 'agent-cap';
const FAILURE_COPY: Record<StatusFailureReason, string> = {
  'station-full': '⚠ 工作區已滿',
  'no-path': '⚠ 無法抵達',
  'clone-queue': '⚠ Clone 工作位已滿',
  'agent-cap': '⚠ Agent 已達上限',
};

export class StatusOverlaySystem {
  private readonly overlays = new Map<string, AgentOverlay>();
  private readonly activities = new Map<string, AgentActivity>();
  private readonly buildingBadges = new Map<string, Phaser.GameObjects.Text>();

  constructor(private readonly scene: Phaser.Scene, buildings: WorldBuilding[]) {
    for (const building of buildings) {
      const badge = scene.add.text(building.labelAnchor.x * 16, building.labelAnchor.y * 16 + 11, '', {
        fontFamily: 'monospace', fontSize: '8px', color: '#f7f2d0', backgroundColor: '#263c2d', padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 0).setDepth(20_001).setVisible(false);
      this.buildingBadges.set(building.id, badge);
    }
  }

  attachAgent(agent: AgentController): void {
    if (this.overlays.has(agent.agentId)) return;
    const chip = this.scene.add.text(agent.sprite.x, agent.sprite.y - 16, agent.role === 'main' ? 'main · idle' : agent.agentId, {
      fontFamily: 'monospace', fontSize: agent.role === 'main' ? '8px' : '7px', color: '#ffffff', backgroundColor: '#17281ddd', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(20_000);
    const bubble = this.scene.add.text(agent.sprite.x, agent.sprite.y - 34, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#203126', backgroundColor: '#fff8d6', padding: { x: 4, y: 3 },
    }).setOrigin(0.5, 1).setDepth(20_002).setVisible(false);
    this.overlays.set(agent.agentId, { chip, bubble, bubbleExpiresAt: 0 });
  }

  publish(agent: AgentController, event: AgentWorldEvent, route: BehaviorRoute): void {
    this.attachAgent(agent);
    const overlay = this.overlays.get(agent.agentId)!;
    const currentActivity = this.activities.get(agent.agentId);
    const prefix = agent.role === 'main' ? 'main' : agent.agentId;
    overlay.chip.setText(`${prefix} · ${ACTION_ICONS[route.action]} ${event.activityLabel}`);
    let bubbleExpiresAt = 0;
    if (route.bubblePolicy === 'none') {
      overlay.bubble.setVisible(false);
      overlay.bubbleExpiresAt = 0;
    } else {
      overlay.bubble.setText(route.bubbleText).setVisible(true);
      bubbleExpiresAt = route.bubblePolicy === 'persistent'
        ? Number.POSITIVE_INFINITY
        : this.scene.time.now + 4000;
      overlay.bubbleExpiresAt = bubbleExpiresAt;
    }
    this.activities.set(agent.agentId, {
      ...currentActivity,
      agentId: agent.agentId,
      action: route.action,
      label: event.activityLabel,
      bubbleText: route.bubbleText,
      bubblePolicy: route.bubblePolicy,
      priority: route.priority,
      updatedAt: event.timestamp,
      bubbleExpiresAt,
    });
    this.syncAgentVisibility(agent, overlay);
    this.refreshBuildings();
  }

  setPresence(agentId: string, buildingId?: string): void {
    const activity = this.activities.get(agentId);
    if (!activity) return;
    this.activities.set(agentId, withBuildingPresence(activity, buildingId));
    this.refreshBuildings();
  }

  showError(agent: AgentController, reason: StatusFailureReason): void {
    this.attachAgent(agent);
    const overlay = this.overlays.get(agent.agentId)!;
    const message = FAILURE_COPY[reason];
    const prefix = agent.role === 'main' ? 'main' : agent.agentId;
    overlay.chip.setText(`${prefix} · ${message}`);
    overlay.bubble.setText(message).setVisible(true);
    overlay.bubbleExpiresAt = Number.POSITIVE_INFINITY;
    this.syncAgentVisibility(agent, overlay);
    this.refreshBuildings();
  }

  update(agents: AgentController[]): void {
    for (const agent of agents) {
      const overlay = this.overlays.get(agent.agentId);
      if (!overlay) continue;
      overlay.chip.setPosition(agent.sprite.x, agent.sprite.y - 16);
      overlay.bubble.setPosition(agent.sprite.x, agent.sprite.y - 31);
      this.syncAgentVisibility(agent, overlay);
    }
    this.refreshBuildings();
  }

  destroy(): void {
    this.overlays.forEach(({ chip, bubble }) => {
      chip.destroy();
      bubble.destroy();
    });
    this.buildingBadges.forEach((badge) => badge.destroy());
    this.overlays.clear();
    this.activities.clear();
    this.buildingBadges.clear();
  }

  private refreshBuildings(): void {
    const activities = [...this.activities.values()];
    for (const [buildingId, badge] of this.buildingBadges) {
      const summary = aggregateBuildingActivity(activities, buildingId, this.scene.time.now);
      if (summary.count === 0) {
        badge.setVisible(false);
        continue;
      }
      const counts = Object.entries(summary.actionCounts)
        .map(([action, count]) => `${ACTION_ICONS[action as keyof typeof ACTION_ICONS]}${count}`)
        .join(' ');
      badge.setText(`👥${summary.count} ${counts}${summary.message ? `\n${summary.message}` : ''}`).setVisible(true);
    }
  }

  private syncAgentVisibility(agent: AgentController, overlay: AgentOverlay): void {
    const outside = agent.presence().kind === 'outside';
    const bubbleActive = overlay.bubbleExpiresAt === Number.POSITIVE_INFINITY
      || this.scene.time.now < overlay.bubbleExpiresAt;
    overlay.chip.setVisible(outside);
    overlay.bubble.setVisible(outside && bubbleActive);
  }
}

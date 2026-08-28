import Phaser from 'phaser';
import type { AgentController } from '../agents/AgentController';
import { ACTION_ICONS, aggregateBuildingActivity, type AgentActivity, withBuildingPresence } from '../status/buildingActivity';
import type { AgentWorldEvent, BehaviorRoute, GridRect, WorldBuilding } from '../world/types';
import { DomStatusOverlay } from './domStatusOverlay';
import {
  statusFailureMessage,
  type StatusFailureReason,
  type VillageLocale,
  villageCopy,
} from '../i18n/villageLocale';

export type { StatusFailureReason } from '../i18n/villageLocale';

interface AgentOverlay {
  chip: Phaser.GameObjects.Text;
  bubble: Phaser.GameObjects.Text;
  bubbleExpiresAt: number;
}

export class StatusOverlaySystem {
  private readonly overlays = new Map<string, AgentOverlay>();
  private readonly activities = new Map<string, AgentActivity>();
  private readonly buildingBadges = new Map<string, Phaser.GameObjects.Text>();
  private readonly agents = new Map<string, AgentController>();
  private readonly domOverlay: DomStatusOverlay;
  private readonly buildings: WorldBuilding[];
  private readonly failures = new Map<string, StatusFailureReason>();
  private locale: VillageLocale = 'zh-TW';
  private exteriorLabelsVisible = true;

  constructor(private readonly scene: Phaser.Scene, buildings: WorldBuilding[]) {
    this.buildings = buildings;
    this.domOverlay = new DomStatusOverlay(buildings, () => {
      const canvas = scene.game?.canvas;
      if (!canvas) return undefined;
      const rect = canvas.getBoundingClientRect();
      return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    });
    for (const building of buildings) {
      const badge = scene.add.text(building.labelAnchor.x * 16, building.labelAnchor.y * 16 + 11, '', {
        fontFamily: 'monospace', fontSize: '8px', color: '#fff2ba', backgroundColor: '#3b2a1ddd', padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 0).setDepth(20_001).setVisible(false);
      this.buildingBadges.set(building.id, badge);
    }
  }

  setLocale(locale: VillageLocale): void {
    this.locale = locale;
    this.domOverlay.setLocale(locale);
    this.activities.forEach((activity, agentId) => {
      const text = villageCopy(locale).actions[activity.action];
      activity.bubbleText = text;
      const overlay = this.overlays.get(agentId);
      overlay?.chip.setText(`${agentId === 'main' ? 'main' : agentId} · ${ACTION_ICONS[activity.action]} ${text}`);
      overlay?.bubble.setText(text);
      this.domOverlay.setAgentBubble(agentId, text);
    });
    this.failures.forEach((reason, agentId) => {
      const message = statusFailureMessage(locale, reason);
      const prefix = agentId === 'main' ? 'main' : agentId;
      this.overlays.get(agentId)?.chip.setText(`${prefix} · ${message}`);
      this.overlays.get(agentId)?.bubble.setText(message);
      this.domOverlay.setAgentBubble(agentId, message);
    });
    this.refreshBuildings();
  }

  setBuildingHitRegion(buildingId: string, bounds: GridRect): void {
    this.domOverlay.setBuildingHitRegion(buildingId, bounds);
  }

  attachAgent(agent: AgentController): void {
    this.agents.set(agent.agentId, agent);
    if (this.overlays.has(agent.agentId)) return;
    const prefix = agent.role === 'main' ? 'main' : agent.agentId;
    const chip = this.scene.add.text(agent.sprite.x, agent.sprite.y - 16, `${prefix} · ${villageCopy(this.locale).actions.idle}`, {
      fontFamily: 'monospace', fontSize: agent.role === 'main' ? '8px' : '7px', color: '#fff5c7', backgroundColor: '#27452ddd', padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setDepth(20_000).setVisible(false);
    const bubble = this.scene.add.text(agent.sprite.x, agent.sprite.y - 34, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#29351e', backgroundColor: '#fff0badd', padding: { x: 4, y: 3 },
    }).setOrigin(0.5, 1).setDepth(20_002).setVisible(false);
    this.overlays.set(agent.agentId, { chip, bubble, bubbleExpiresAt: 0 });
  }

  detachAgent(agentId: string): void {
    const overlay = this.overlays.get(agentId);
    overlay?.chip.destroy();
    overlay?.bubble.destroy();
    this.overlays.delete(agentId);
    this.agents.delete(agentId);
    this.activities.delete(agentId);
    this.failures.delete(agentId);
    this.domOverlay.removeAgent(agentId);
    this.refreshBuildings();
  }

  setExteriorLabelsVisible(visible: boolean): void {
    if (this.exteriorLabelsVisible === visible) return;
    this.exteriorLabelsVisible = visible;
    this.domOverlay.setVisible(visible);
    if (!visible) {
      this.overlays.forEach(({ bubble }) => bubble.setVisible(false));
      this.buildingBadges.forEach((badge) => badge.setVisible(false));
      return;
    }
    this.agents.forEach((agent, agentId) => {
      const overlay = this.overlays.get(agentId);
      if (overlay) this.syncAgentVisibility(agent, overlay);
    });
    this.refreshBuildings();
  }

  publish(agent: AgentController, event: AgentWorldEvent, route: BehaviorRoute): void {
    this.attachAgent(agent);
    const overlay = this.overlays.get(agent.agentId)!;
    const currentActivity = this.activities.get(agent.agentId);
    const prefix = agent.role === 'main' ? 'main' : agent.agentId;
    const localizedActivity = villageCopy(this.locale).actions[route.action];
    this.failures.delete(agent.agentId);
    overlay.chip.setText(`${prefix} · ${ACTION_ICONS[route.action]} ${localizedActivity}`);
    let bubbleExpiresAt = 0;
    if (route.bubblePolicy === 'none') {
      overlay.bubbleExpiresAt = 0;
    } else {
      overlay.bubble.setText(villageCopy(this.locale).actions[route.action]);
      bubbleExpiresAt = route.bubblePolicy === 'persistent'
        ? Number.POSITIVE_INFINITY
        : this.scene.time.now + 4000;
      overlay.bubbleExpiresAt = bubbleExpiresAt;
    }
    this.activities.set(agent.agentId, {
      ...currentActivity,
      agentId: agent.agentId,
      action: route.action,
      label: localizedActivity,
      bubbleText: villageCopy(this.locale).actions[route.action],
      bubblePolicy: route.bubblePolicy,
      priority: route.priority,
      updatedAt: event.timestamp,
      bubbleExpiresAt,
    });
    this.domOverlay.publish(
      agent,
      `${prefix} · ${ACTION_ICONS[route.action]} ${localizedActivity}`,
      villageCopy(this.locale).actions[route.action],
      route.bubblePolicy !== 'none',
    );
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
    const message = statusFailureMessage(this.locale, reason);
    this.failures.set(agent.agentId, reason);
    const prefix = agent.role === 'main' ? 'main' : agent.agentId;
    overlay.chip.setText(`${prefix} · ${message}`);
    overlay.bubble.setText(message);
    overlay.bubbleExpiresAt = Number.POSITIVE_INFINITY;
    this.domOverlay.publish(agent, `${prefix} · ${message}`, message, true);
    this.syncAgentVisibility(agent, overlay);
    this.refreshBuildings();
  }

  update(agents: AgentController[]): void {
    for (const agent of agents) {
      this.agents.set(agent.agentId, agent);
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
    this.agents.clear();
    this.activities.clear();
    this.failures.clear();
    this.buildingBadges.clear();
    this.domOverlay.destroy();
  }

  private refreshBuildings(): void {
    const activities = [...this.activities.values()];
    for (const [buildingId, badge] of this.buildingBadges) {
      const summary = aggregateBuildingActivity(activities, buildingId, this.scene.time.now);
      if (summary.count === 0) {
        badge.setVisible(false);
        const building = this.buildings.find(({ id }) => id === buildingId);
        if (building) this.domOverlay.setBuilding(building, '', false);
        continue;
      }
      const counts = Object.entries(summary.actionCounts)
        .map(([action, count]) => `${ACTION_ICONS[action as keyof typeof ACTION_ICONS]}${count}`)
        .join(' ');
      const text = `👥${summary.count} ${counts}${summary.message ? `\n${summary.message}` : ''}`;
      badge.setText(text).setVisible(this.exteriorLabelsVisible && !this.domOverlay.isActive());
      const building = this.buildings.find(({ id }) => id === buildingId);
      if (building) this.domOverlay.setBuilding(building, text, true);
    }
  }

  private syncAgentVisibility(agent: AgentController, overlay: AgentOverlay): void {
    const outside = agent.presence().kind === 'outside';
    const bubbleActive = overlay.bubbleExpiresAt === Number.POSITIVE_INFINITY
      || this.scene.time.now < overlay.bubbleExpiresAt;
    overlay.chip.setVisible(false);
    overlay.bubble.setVisible(this.exteriorLabelsVisible && outside && bubbleActive && !this.domOverlay.isActive());
    this.domOverlay.positionAgent(agent, outside, this.exteriorLabelsVisible && outside && bubbleActive);
  }
}

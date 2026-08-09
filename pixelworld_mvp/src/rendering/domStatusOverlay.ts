import { TILE_SIZE, WORLD_PIXELS } from '../game/constants';
import type { AgentController } from '../agents/AgentController';
import type { WorldBuilding } from '../world/types';

export interface OverlayRect { left: number; top: number; width: number; height: number }

export function worldPointToOverlay(
  point: { x: number; y: number },
  rect: OverlayRect,
): { x: number; y: number } {
  return {
    x: rect.left + point.x / WORLD_PIXELS.width * rect.width,
    y: rect.top + point.y / WORLD_PIXELS.height * rect.height,
  };
}

interface AgentDomView {
  root: HTMLDivElement;
  chip: HTMLDivElement;
  bubble: HTMLDivElement;
}

export class DomStatusOverlay {
  private readonly root: HTMLElement | undefined;
  private readonly agents = new Map<string, AgentDomView>();
  private readonly buildings = new Map<string, HTMLDivElement>();
  private readonly buildingLabels = new Map<string, HTMLDivElement>();

  constructor(
    buildings: readonly WorldBuilding[],
    private readonly canvasRect: () => OverlayRect | undefined,
  ) {
    this.root = typeof document === 'undefined'
      ? undefined
      : (document.querySelector<HTMLElement>('#world-status-layer') ?? undefined);
    if (!this.root) return;
    buildings.forEach((building) => {
      const label = document.createElement('div');
      label.className = 'world-building-label';
      label.textContent = building.label;
      label.dataset.buildingId = building.id;
      const badge = document.createElement('div');
      badge.className = 'world-building-badge';
      badge.dataset.buildingId = building.id;
      badge.hidden = true;
      this.root!.append(label, badge);
      this.buildingLabels.set(building.id, label);
      this.buildings.set(building.id, badge);
    });
  }

  isActive(): boolean { return this.root !== undefined; }

  attachAgent(agent: AgentController): void {
    if (!this.root || this.agents.has(agent.agentId)) return;
    const root = document.createElement('div');
    root.className = 'world-agent-status';
    root.dataset.agentId = agent.agentId;
    const bubble = document.createElement('div');
    bubble.className = 'world-agent-bubble';
    const chip = document.createElement('div');
    chip.className = 'world-agent-chip';
    root.append(bubble, chip);
    this.root.append(root);
    this.agents.set(agent.agentId, { root, chip, bubble });
  }

  publish(agent: AgentController, chipText: string, bubbleText: string, bubbleVisible: boolean): void {
    this.attachAgent(agent);
    const view = this.agents.get(agent.agentId);
    if (!view) return;
    view.chip.textContent = chipText;
    view.bubble.textContent = bubbleText;
    view.bubble.hidden = !bubbleVisible;
  }

  positionAgent(agent: AgentController, visible: boolean, bubbleVisible: boolean): void {
    const view = this.agents.get(agent.agentId);
    const rect = this.canvasRect();
    if (!view || !rect) return;
    const labelClearance = agent.role === 'main' ? 40 : 25;
    const position = worldPointToOverlay({ x: agent.sprite.x, y: agent.sprite.y - labelClearance }, rect);
    view.root.style.transform = `translate3d(${Math.round(position.x)}px, ${Math.round(position.y)}px, 0)`;
    view.root.hidden = !visible;
    view.bubble.hidden = !bubbleVisible;
  }

  setBuilding(building: WorldBuilding, text: string, visible: boolean): void {
    const badge = this.buildings.get(building.id);
    const label = this.buildingLabels.get(building.id);
    const rect = this.canvasRect();
    if (!badge || !label || !rect) return;
    const labelPosition = worldPointToOverlay({
      x: building.labelAnchor.x * TILE_SIZE,
      y: building.labelAnchor.y * TILE_SIZE,
    }, rect);
    const badgePosition = worldPointToOverlay({
      x: building.labelAnchor.x * TILE_SIZE,
      y: building.labelAnchor.y * TILE_SIZE + 14,
    }, rect);
    label.style.transform = `translate3d(${Math.round(labelPosition.x)}px, ${Math.round(labelPosition.y)}px, 0)`;
    badge.style.transform = `translate3d(${Math.round(badgePosition.x)}px, ${Math.round(badgePosition.y)}px, 0)`;
    badge.textContent = text;
    badge.hidden = !visible;
  }

  destroy(): void {
    this.agents.forEach(({ root }) => root.remove());
    this.buildings.forEach((badge) => badge.remove());
    this.buildingLabels.forEach((label) => label.remove());
    this.agents.clear();
    this.buildings.clear();
    this.buildingLabels.clear();
  }
}

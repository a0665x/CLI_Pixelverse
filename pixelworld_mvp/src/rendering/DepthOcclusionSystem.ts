import type Phaser from 'phaser';
import type { AgentController } from '../agents/AgentController';
import type { RenderedForeground } from '../scenes/WorldScene';

export const depthFromFootY = (footY: number, tieBreaker: number): number =>
  Math.round(footY) + tieBreaker / 1000;

interface Bounds { x: number; y: number; width: number; height: number }

export function shouldFadeForeground(agentBounds: Bounds, foregroundBounds: Bounds, agentFootY: number, baselineY: number): boolean {
  const fullyCovered = agentBounds.x >= foregroundBounds.x && agentBounds.y >= foregroundBounds.y &&
    agentBounds.x + agentBounds.width <= foregroundBounds.x + foregroundBounds.width &&
    agentBounds.y + agentBounds.height <= foregroundBounds.y + foregroundBounds.height;
  return agentFootY < baselineY && fullyCovered;
}

export class DepthOcclusionSystem {
  private readonly coveredSince = new Map<RenderedForeground, number>();

  constructor(private readonly scene: Phaser.Scene, private readonly foregrounds: RenderedForeground[], private readonly agents: () => AgentController[]) {}

  update(selected: AgentController): void {
    this.agents().forEach((agent, index) => agent.sprite.setDepth(depthFromFootY(agent.sprite.y, index + 1)));
    const activeForegrounds = new Set(this.foregrounds);
    for (const foreground of this.coveredSince.keys()) {
      if (activeForegrounds.has(foreground)) continue;
      foreground.object.setAlpha(1);
      this.coveredSince.delete(foreground);
    }
    const now = this.scene.time.now;
    const selectedBounds = selected.sprite.getBounds();
    for (const foreground of this.foregrounds) {
      const covered = shouldFadeForeground(selectedBounds, foreground.bounds, selected.sprite.y, foreground.baselineY);
      if (!covered) {
        this.coveredSince.delete(foreground);
        foreground.object.setAlpha(1);
        continue;
      }
      const since = this.coveredSince.get(foreground) ?? now;
      this.coveredSince.set(foreground, since);
      foreground.object.setAlpha(now - since >= 500 ? 0.6 : 1);
    }
  }
}

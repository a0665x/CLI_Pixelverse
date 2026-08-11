import Phaser from 'phaser';
import type { AgentController } from '../agents/AgentController';
import { TILE_SIZE } from '../game/constants';
import type { NavigationGrid } from '../navigation/navigationGrid';
import type { WorldDefinition } from '../world/types';

export type DebugLayerName = 'grid' | 'collision' | 'paths' | 'anchors' | 'depth';

export class DebugOverlay {
  private readonly layers = new Map<DebugLayerName, Phaser.GameObjects.Graphics>();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: NavigationGrid,
    private readonly world: WorldDefinition,
    private readonly agents: () => AgentController[],
  ) {
    (['grid', 'collision', 'paths', 'anchors', 'depth'] as const).forEach((name) => {
      this.layers.set(name, scene.add.graphics().setDepth(30_000).setVisible(false));
    });
    this.drawStatic();
  }

  setVisible(name: DebugLayerName, visible: boolean): void { this.layers.get(name)?.setVisible(visible); }

  update(): void {
    const paths = this.layers.get('paths')!.clear().lineStyle(1, 0xfff176, 0.9);
    const depth = this.layers.get('depth')!.clear().lineStyle(1, 0xff6b8a, 0.9);
    for (const agent of this.agents()) {
      if (agent.currentPath.length > 1) {
        paths.beginPath();
        agent.currentPath.forEach((point, index) => {
          const x = point.x * TILE_SIZE + TILE_SIZE / 2;
          const y = point.y * TILE_SIZE + TILE_SIZE / 2;
          index === 0 ? paths.moveTo(x, y) : paths.lineTo(x, y);
        });
        paths.strokePath();
      }
      depth.lineBetween(agent.sprite.x - 7, agent.sprite.y, agent.sprite.x + 7, agent.sprite.y);
    }
  }

  private drawStatic(): void {
    const gridLayer = this.layers.get('grid')!.lineStyle(1, 0xffffff, 0.12);
    for (let x = 0; x <= this.world.width; x += 1) {
      gridLayer.lineBetween(x * TILE_SIZE, 0, x * TILE_SIZE, this.world.height * TILE_SIZE);
    }
    for (let y = 0; y <= this.world.height; y += 1) {
      gridLayer.lineBetween(0, y * TILE_SIZE, this.world.width * TILE_SIZE, y * TILE_SIZE);
    }
    const collisions = this.layers.get('collision')!.fillStyle(0xff385c, 0.28);
    this.grid.blockedPoints().forEach((point) => {
      collisions.fillRect(point.x * TILE_SIZE, point.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    });
    const anchors = this.layers.get('anchors')!;
    for (const station of this.world.stations) {
      anchors.fillStyle(0x45f0a8, 0.75);
      station.interactionSlots.forEach((slot) => {
        anchors.fillCircle(slot.point.x * TILE_SIZE + TILE_SIZE / 2, slot.point.y * TILE_SIZE + TILE_SIZE / 2, 3);
      });
      anchors.fillStyle(0xffd166, 0.75);
      station.queueAnchors.forEach((point) => {
        anchors.fillCircle(point.x * TILE_SIZE + TILE_SIZE / 2, point.y * TILE_SIZE + TILE_SIZE / 2, 3);
      });
    }
  }
}

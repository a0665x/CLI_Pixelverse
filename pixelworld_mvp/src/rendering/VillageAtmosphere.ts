import type Phaser from 'phaser';
import type { WorldDefinition } from '../world/types';
import { TILE_SIZE } from '../game/constants';

/** Ground-only daylight and water accents, bounded to the authored world. */
export class VillageAtmosphere {
  private shadows?: Phaser.GameObjects.Graphics;
  private water?: Phaser.GameObjects.Graphics;
  private readonly motionPreference = typeof window === 'undefined' ? undefined : window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private elapsed = 0;
  private lastFrame = -1;
  constructor(scene: Phaser.Scene, private readonly world: WorldDefinition) {
    this.shadows = scene.add.graphics?.();
    this.water = scene.add.graphics?.();
    this.shadows?.setDepth(-720);
    this.water?.setDepth(-780);
    for (const { bounds } of world.buildings) {
      this.shadows?.fillStyle(0x35452e, .18).fillRect(
        bounds.x * TILE_SIZE + 5, (bounds.y + bounds.height - .2) * TILE_SIZE,
        bounds.width * TILE_SIZE - 2, 5,
      );
    }
    for (const { trunk } of world.scenery.trees) {
      this.shadows?.fillStyle(0x35452e, .12).fillEllipse(
        (trunk.x + .45) * TILE_SIZE, (trunk.y + .8) * TILE_SIZE, 24, 7,
      );
    }
  }
  update(delta: number): void {
    const reduced = this.motionPreference?.matches ?? false;
    this.elapsed += reduced ? 0 : Math.max(0, delta);
    const frame = Math.floor(this.elapsed / 180);
    if (frame === this.lastFrame || !this.water) return;
    this.lastFrame = frame;
    this.water.clear();
    for (const rect of this.world.scenery.river) {
      for (let row = 0; row < rect.height; row += 2) {
        const drift = frame % 8;
        this.water.fillStyle(0xd5f2de, .3).fillRect(
          rect.x * TILE_SIZE + 6 + ((row * 3 + frame) % 10),
          (rect.y + row) * TILE_SIZE + 3 + drift, 5, 1,
        );
      }
    }
  }
  destroy(): void { this.shadows?.destroy(); this.water?.destroy(); }
}

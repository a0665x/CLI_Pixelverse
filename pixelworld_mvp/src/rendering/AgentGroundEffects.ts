import type Phaser from 'phaser';

/** Small pooled footfalls, driven by distance travelled, never by background timers. */
export class AgentGroundEffects {
  private shadow?: Phaser.GameObjects.Ellipse;
  private dust: Array<{ shape: Phaser.GameObjects.Ellipse; age: number }> = [];
  private readonly motionPreference = typeof window === 'undefined' ? undefined : window.matchMedia?.('(prefers-reduced-motion: reduce)');
  private travelled = 0;
  private cursor = 0;
  private last?: { x: number; y: number };
  constructor(scene: Phaser.Scene) {
    this.shadow = scene.add.ellipse?.(0, 0, 11, 4, 0x302e29, .22);
    if (scene.add.ellipse) {
      this.dust = Array.from({ length: 3 }, () => ({
        shape: scene.add.ellipse(0, 0, 3, 2, 0xf3d9a3, 0).setVisible(false), age: 1000,
      }));
    }
  }
  update(sprite: Phaser.GameObjects.Image, delta: number, walking: boolean): void {
    this.shadow?.setPosition(sprite.x, sprite.y + 1).setDepth(sprite.y - .5).setVisible(sprite.visible);
    const reduced = this.motionPreference?.matches ?? false;
    for (const puff of this.dust) {
      puff.age += Math.max(0, delta);
      puff.shape.setAlpha(Math.max(0, 1 - puff.age / 260) * .32).setVisible(!reduced && sprite.visible && puff.age < 260);
    }
    if (!reduced && walking && sprite.visible && this.last) {
      const distance = Math.hypot(sprite.x - this.last.x, sprite.y - this.last.y);
      if (distance < 24) this.travelled += distance;
      if (this.travelled >= 12 && this.dust.length) {
        this.travelled %= 12;
        const puff = this.dust[this.cursor++ % this.dust.length]!;
        puff.age = 0;
        puff.shape.setPosition(sprite.x + (this.cursor % 2 ? 2 : -2), sprite.y + 1).setDepth(sprite.y - .4).setVisible(true);
      }
    } else this.travelled = 0;
    this.last = { x: sprite.x, y: sprite.y };
  }
  destroy(): void { this.shadow?.destroy(); this.dust.forEach(({ shape }) => shape.destroy()); }
}

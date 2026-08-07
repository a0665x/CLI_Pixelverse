import Phaser from 'phaser';
import type { AgentAction } from '../world/types';

const ICONS: Record<AgentAction, string> = {
  arrive: '✦', ponder: '…', plan: '▤', read: '▥', type: '⌨', terminal: '>_',
  signal: '⌁', dispatch: '◇', respond: '➤', queue: '⌛', repair: '⚒',
  rest: 'z', offline: '×', pulse: '•',
};

export class ActionController {
  private readonly icon: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | undefined;
  private pulseTween: Phaser.Tweens.Tween | undefined;
  private baseY = 0;

  constructor(private readonly scene: Phaser.Scene, private readonly sprite: Phaser.GameObjects.Image) {
    this.icon = scene.add.text(sprite.x, sprite.y - 18, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#fff8d6', backgroundColor: '#24382a', padding: { x: 2, y: 1 },
    }).setOrigin(0.5).setDepth(20_000).setVisible(false);
  }

  start(action: AgentAction): void {
    this.stop();
    this.baseY = this.sprite.y;
    this.icon.setText(ICONS[action]).setVisible(action !== 'arrive');
    this.tween = this.scene.tweens.add({
      targets: this.sprite, y: this.baseY - (action === 'rest' ? 0 : 1),
      duration: action === 'ponder' ? 600 : 320, yoyo: true, repeat: -1, ease: 'Stepped',
    });
  }

  pulse(): void {
    this.pulseTween?.stop();
    this.pulseTween = this.scene.tweens.add({ targets: this.sprite, alpha: 0.55, duration: 90, yoyo: true });
  }

  update(): void { this.icon.setPosition(this.sprite.x, this.sprite.y - 18); }

  stop(): void {
    if (this.tween) {
      this.tween.stop();
      this.sprite.setY(this.baseY);
    }
    this.pulseTween?.stop();
    this.tween = undefined;
    this.pulseTween = undefined;
    this.sprite.setAlpha(1);
    this.icon.setVisible(false);
  }

  destroy(): void { this.stop(); this.icon.destroy(); }
}

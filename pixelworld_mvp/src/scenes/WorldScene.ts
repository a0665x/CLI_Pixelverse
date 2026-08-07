import Phaser from 'phaser';
import { WORLD_PIXELS } from '../game/constants';

export class WorldScene extends Phaser.Scene {
  constructor() {
    super('world');
  }

  create(): void {
    this.cameras.main.setBounds(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height);
    this.cameras.main.setRoundPixels(true);
    this.add.rectangle(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height, 0x79ad5b)
      .setOrigin(0);
    this.add.text(16, 16, 'PixelWorld Work Village MVP', {
      color: '#17351f',
      fontFamily: 'monospace',
      fontSize: '12px',
    });
  }
}

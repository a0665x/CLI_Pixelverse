import Phaser from 'phaser';
import { WorldScene } from '../scenes/WorldScene';
import { WORLD_PIXELS, integerScaleFor } from './constants';

export function buildGameConfig(
  parent: string,
  onWorldReady?: (world: WorldScene) => void,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width: WORLD_PIXELS.width,
    height: WORLD_PIXELS.height,
    backgroundColor: '#13251b',
    pixelArt: true,
    antialias: false,
    roundPixels: true,
    render: { antialias: false, pixelArt: true, roundPixels: true },
    scale: {
      mode: Phaser.Scale.NONE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: WORLD_PIXELS.width,
      height: WORLD_PIXELS.height,
    },
    callbacks: {
      postBoot: (game) => {
        if (onWorldReady) game.events.once('world-ready', onWorldReady);
        const root = document.getElementById(parent);
        if (!root) throw new Error(`Missing #${parent}`);
        const resize = () => {
          const scale = integerScaleFor(root.clientWidth, root.clientHeight);
          game.canvas.style.width = `${WORLD_PIXELS.width * scale}px`;
          game.canvas.style.height = `${WORLD_PIXELS.height * scale}px`;
        };
        const observer = new ResizeObserver(resize);
        observer.observe(root);
        game.events.once(Phaser.Core.Events.DESTROY, () => observer.disconnect());
        resize();
      },
    },
    scene: [WorldScene],
  };
}

export function createGame(
  parent = 'game-root',
  onWorldReady?: (world: WorldScene) => void,
): Phaser.Game {
  return new Phaser.Game(buildGameConfig(parent, onWorldReady));
}

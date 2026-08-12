import Phaser from 'phaser';
import { WorldScene } from '../scenes/WorldScene';
import { WORLD_PIXELS } from './constants';
import { VillageViewportController } from './VillageViewportController';
import { subscribeWorldReady } from './worldReady';

export function buildGameConfig(
  parent: string,
  onWorldReady?: (world: WorldScene) => void,
  onViewportReady?: (viewport: VillageViewportController) => void,
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
      // CSS Grid owns centering. Phaser margins plus Grid centering double-offset
      // a 1.5x canvas and crop the east/south village edges.
      autoCenter: Phaser.Scale.NO_CENTER,
      width: WORLD_PIXELS.width,
      height: WORLD_PIXELS.height,
    },
    callbacks: {
      postBoot: (game) => {
        const unsubscribeWorldReady = onWorldReady
          ? subscribeWorldReady<WorldScene>(game.events, onWorldReady)
          : () => undefined;
        const root = document.getElementById(parent);
        if (!root) throw new Error(`Missing #${parent}`);
        const embedded = new URLSearchParams(window.location.search).get('embed') === '1';
        const viewport = new VillageViewportController(({ width, height, offsetX, offsetY }) => {
          game.canvas.style.width = `${width}px`;
          game.canvas.style.height = `${height}px`;
          game.canvas.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
        }, embedded ? 'cover' : 'fit');
        onViewportReady?.(viewport);
        const resize = () => viewport.resize(root.clientWidth, root.clientHeight);
        const observer = new ResizeObserver(resize);
        observer.observe(root);
        game.events.once(Phaser.Core.Events.DESTROY, () => {
          observer.disconnect();
          unsubscribeWorldReady();
        });
        resize();
      },
    },
    scene: [WorldScene],
  };
}

export function createGame(
  parent = 'game-root',
  onWorldReady?: (world: WorldScene) => void,
  onViewportReady?: (viewport: VillageViewportController) => void,
): Phaser.Game {
  return new Phaser.Game(buildGameConfig(parent, onWorldReady, onViewportReady));
}

import type Phaser from 'phaser';
import type { Facing } from '../world/types';

type DirectionTextures = Record<Facing, string>;
export interface AgentSkin { idle: DirectionTextures; active: DirectionTextures }

const textureSet = (prefix: string, idle: number[], active: number[]): AgentSkin => {
  const directions: Facing[] = ['left', 'down', 'up', 'right'];
  return {
    idle: Object.fromEntries(directions.map((direction, index) => [direction, `${prefix}-idle-${direction}-${idle[index]}`])) as DirectionTextures,
    active: Object.fromEntries(directions.map((direction, index) => [direction, `${prefix}-active-${direction}-${active[index]}`])) as DirectionTextures,
  };
};

export const AGENT_SKINS = {
  main: textureSet('main', [212, 213, 214, 215], [239, 240, 241, 242]),
  subagent: textureSet('subagent', [131, 132, 133, 134], [158, 159, 160, 161]),
  branch: textureSet('branch', [77, 78, 79, 80], [104, 105, 106, 107]),
} as const;

export const PROP_ASSETS = {
  bookshelf: '/assets/kenney/Tiles/tile_0124.png',
  board: '/assets/kenney/Tiles/tile_0149.png',
  desk: '/assets/kenney/Tiles/tile_0152.png',
  terminal: '/assets/kenney/Tiles/tile_0167.png',
  lamp: '/assets/kenney/Tiles/tile_0190.png',
  sofa: '/assets/kenney/Tiles/tile_0222.png',
  chair: '/assets/kenney/Tiles/tile_0223.png',
  plant: '/assets/kenney/Tiles/tile_0232.png',
  cabinet: '/assets/kenney/Tiles/tile_0250.png',
  server: '/assets/kenney/Tiles/tile_0251.png',
  crate: '/assets/kenney/Tiles/tile_0254.png',
  appleTerminal: '/assets/appledog/terminal.png',
  appleSmallTerminal: '/assets/appledog/small-terminal.png',
  appleDesk: '/assets/appledog/office-table.png',
  appleSofa: '/assets/appledog/lounge-sofa.png',
  applePlant: '/assets/appledog/plant.png',
} as const;

const tilePath = (number: number) => `/assets/kenney/Tiles/tile_${String(number).padStart(4, '0')}.png`;

export function villageAssetEntries(): Array<[string, string]> {
  const entries: Array<[string, string]> = [];
  for (const skin of Object.values(AGENT_SKINS)) {
    for (const group of [skin.idle, skin.active]) {
      for (const key of Object.values(group)) {
        const number = Number(key.slice(key.lastIndexOf('-') + 1));
        entries.push([key, tilePath(number)]);
      }
    }
  }
  for (const [key, path] of Object.entries(PROP_ASSETS)) entries.push([`prop-${key}`, path]);
  return entries;
}

export function preloadVillageAssets(scene: Phaser.Scene): void {
  villageAssetEntries().forEach(([key, path]) => scene.load.image(key, path));
}

export function ensureAssetFallbacks(scene: Phaser.Scene): void {
  for (const [key] of villageAssetEntries()) {
    if (scene.textures.exists(key)) continue;
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xff2f6d).fillRect(0, 0, 16, 16);
    graphics.fillStyle(0x1b1020).fillRect(2, 2, 12, 12);
    graphics.lineStyle(2, 0xffd166).lineBetween(2, 2, 14, 14).lineBetween(14, 2, 2, 14);
    graphics.generateTexture(key, 16, 16);
    graphics.destroy();
    console.error(`[pixelworld] missing asset; placeholder installed: ${key}`);
  }
}

import type Phaser from 'phaser';
import type { Facing } from '../world/types';

export interface SpriteSheetAsset {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

export interface AgentSkin {
  sheet: string;
  idleRow: 0;
  walkRows: readonly [0, 1, 2, 3];
  idle: Record<Facing, string>;
  active: Record<Facing, string>;
}

export const WORLD_ATLAS: SpriteSheetAsset = {
  key: 'puny-world',
  path: '/assets/puny-world/punyworld-overworld-tileset.png',
  frameWidth: 16,
  frameHeight: 16,
};

export const AGENT_ATLAS = {
  main: { key: 'ninja-blue', path: '/assets/ninja-adventure/ninja-blue.png', frameWidth: 16, frameHeight: 16 },
  subagent: { key: 'samurai-blue', path: '/assets/ninja-adventure/samurai-blue.png', frameWidth: 16, frameHeight: 16 },
  branch: { key: 'samurai-green', path: '/assets/ninja-adventure/samurai-green.png', frameWidth: 16, frameHeight: 16 },
} as const satisfies Record<string, SpriteSheetAsset>;

const legacyTextureSet = (prefix: string, idle: number[], active: number[]): Pick<AgentSkin, 'idle' | 'active'> => {
  const directions: Facing[] = ['left', 'down', 'up', 'right'];
  return {
    idle: Object.fromEntries(directions.map((direction, index) => [direction, `${prefix}-idle-${direction}-${idle[index]}`])) as Record<Facing, string>,
    active: Object.fromEntries(directions.map((direction, index) => [direction, `${prefix}-active-${direction}-${active[index]}`])) as Record<Facing, string>,
  };
};

export const AGENT_SKINS = {
  main: { sheet: AGENT_ATLAS.main.key, idleRow: 0, walkRows: [0, 1, 2, 3], ...legacyTextureSet('main', [212, 213, 214, 215], [239, 240, 241, 242]) },
  subagent: { sheet: AGENT_ATLAS.subagent.key, idleRow: 0, walkRows: [0, 1, 2, 3], ...legacyTextureSet('subagent', [131, 132, 133, 134], [158, 159, 160, 161]) },
  branch: { sheet: AGENT_ATLAS.branch.key, idleRow: 0, walkRows: [0, 1, 2, 3], ...legacyTextureSet('branch', [77, 78, 79, 80], [104, 105, 106, 107]) },
} as const satisfies Record<string, AgentSkin>;

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

export function villageAssetEntries(): Array<[string, string]> {
  return Object.entries(PROP_ASSETS).map(([key, path]) => [`prop-${key}`, path]);
}

export function preloadVillageAssets(scene: Phaser.Scene): void {
  [WORLD_ATLAS, ...Object.values(AGENT_ATLAS)].forEach((asset) => {
    scene.load.spritesheet(asset.key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
  });
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

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

export const ANIMAL_ASSETS = {
  cow: { key: 'animal-cow', path: '/assets/kenney/tiny-farm/cow.png', frameWidth: 16, frameHeight: 16 },
  sheep: { key: 'animal-sheep', path: '/assets/kenney/tiny-farm/sheep.png', frameWidth: 16, frameHeight: 16 },
  chicken: { key: 'animal-chicken', path: '/assets/kenney/tiny-farm/chicken.png', frameWidth: 16, frameHeight: 16 },
  pig: { key: 'animal-pig', path: '/assets/ninja-adventure/pig.png', frameWidth: 16, frameHeight: 16 },
} as const satisfies Record<string, SpriteSheetAsset>;

export const INTERIOR_ASSETS = {
  sofa: { key: 'interior-sofa', path: '/assets/kenney/roguelike-rpg/sofa.png', frameWidth: 16, frameHeight: 16 },
  bed: { key: 'interior-bed', path: '/assets/kenney/roguelike-rpg/bed.png', frameWidth: 16, frameHeight: 16 },
  bookcase: { key: 'interior-bookcase', path: '/assets/kenney/roguelike-rpg/bookcase.png', frameWidth: 16, frameHeight: 16 },
  table: { key: 'interior-table', path: '/assets/kenney/roguelike-rpg/table.png', frameWidth: 16, frameHeight: 16 },
  workbench: { key: 'interior-workbench', path: '/assets/kenney/roguelike-rpg/workbench.png', frameWidth: 16, frameHeight: 16 },
  television: { key: 'interior-television', path: '/assets/kenney/modern-city/television.png', frameWidth: 16, frameHeight: 16 },
  computer: { key: 'interior-computer', path: '/assets/kenney/modern-city/computer.png', frameWidth: 16, frameHeight: 16 },
  radio: { key: 'interior-radio', path: '/assets/kenney/modern-city/radio.png', frameWidth: 16, frameHeight: 16 },
} as const satisfies Record<string, SpriteSheetAsset>;

const tinyTownPiece = (name: string): SpriteSheetAsset => ({
  key: `tiny-town-${name}`,
  path: `/assets/kenney/tiny-town/${name}.png`,
  frameWidth: 16,
  frameHeight: 16,
});

export const HOUSE_ASSETS = {
  grayRoofTopLeft: tinyTownPiece('roof-gray-top-left'),
  grayRoofTopMiddle: tinyTownPiece('roof-gray-top-middle'),
  grayRoofTopRight: tinyTownPiece('roof-gray-top-right'),
  grayRoofWindowTop: tinyTownPiece('roof-gray-window-top'),
  orangeRoofTopLeft: tinyTownPiece('roof-orange-top-left'),
  orangeRoofTopMiddle: tinyTownPiece('roof-orange-top-middle'),
  orangeRoofTopRight: tinyTownPiece('roof-orange-top-right'),
  orangeRoofWindowTop: tinyTownPiece('roof-orange-window-top'),
  grayRoofBottomLeft: tinyTownPiece('roof-gray-bottom-left'),
  grayRoofBottomMiddle: tinyTownPiece('roof-gray-bottom-middle'),
  grayRoofBottomRight: tinyTownPiece('roof-gray-bottom-right'),
  grayRoofWindowBottom: tinyTownPiece('roof-gray-window-bottom'),
  orangeRoofBottomLeft: tinyTownPiece('roof-orange-bottom-left'),
  orangeRoofBottomMiddle: tinyTownPiece('roof-orange-bottom-middle'),
  orangeRoofBottomRight: tinyTownPiece('roof-orange-bottom-right'),
  orangeRoofWindowBottom: tinyTownPiece('roof-orange-window-bottom'),
  brownWallLeft: tinyTownPiece('wall-brown-left'),
  brownWallWindow: tinyTownPiece('wall-brown-window'),
  brownWallDoor: tinyTownPiece('wall-brown-door'),
  brownWallRight: tinyTownPiece('wall-brown-right'),
  grayWallLeft: tinyTownPiece('wall-gray-left'),
  grayWallWindow: tinyTownPiece('wall-gray-window'),
  grayWallDoor: tinyTownPiece('wall-gray-door'),
  grayWallRight: tinyTownPiece('wall-gray-right'),
} as const satisfies Record<string, SpriteSheetAsset>;

export const AGENT_SKINS = {
  main: { sheet: AGENT_ATLAS.main.key, idleRow: 0, walkRows: [0, 1, 2, 3] },
  subagent: { sheet: AGENT_ATLAS.subagent.key, idleRow: 0, walkRows: [0, 1, 2, 3] },
  branch: { sheet: AGENT_ATLAS.branch.key, idleRow: 0, walkRows: [0, 1, 2, 3] },
} as const satisfies Record<string, AgentSkin>;

const FACING_FRAME_COLUMNS: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 };
const AGENT_FRAME_COLUMNS = 4;

export function agentFrameIndex(skin: AgentSkin, facing: Facing, row: number = skin.idleRow): number {
  return row * AGENT_FRAME_COLUMNS + FACING_FRAME_COLUMNS[facing];
}

export function preloadVillageAssets(scene: Phaser.Scene): void {
  [WORLD_ATLAS, ...Object.values(AGENT_ATLAS)].forEach((asset) => {
    scene.load.spritesheet(asset.key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
  });
  [...Object.values(ANIMAL_ASSETS), ...Object.values(INTERIOR_ASSETS), ...Object.values(HOUSE_ASSETS)].forEach((asset) => {
    scene.load.image(asset.key, asset.path);
  });
}

export const WORLD_ATLAS_FALLBACK_KEY = 'puny-world-missing';

export function ensureWorldAtlasTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(WORLD_ATLAS.key)) return WORLD_ATLAS.key;
  if (!scene.textures.exists(WORLD_ATLAS_FALLBACK_KEY)) {
    const graphics = scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(0xff2f6d).fillRect(0, 0, 16, 16);
    graphics.fillStyle(0x1b1020).fillRect(2, 2, 12, 12);
    graphics.lineStyle(2, 0xffd166).lineBetween(2, 2, 14, 14).lineBetween(14, 2, 2, 14);
    graphics.generateTexture(WORLD_ATLAS_FALLBACK_KEY, 16, 16);
    graphics.destroy();
  }
  console.error(`[pixelworld] missing essential Puny atlas: ${WORLD_ATLAS.path}; diagnostic texture installed`);
  return WORLD_ATLAS_FALLBACK_KEY;
}

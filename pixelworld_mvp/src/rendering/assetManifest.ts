import type Phaser from 'phaser';
import type { Facing } from '../world/types';
import { MODERN_OFFICE_ASSETS } from './modernOfficeManifest';
import { MODERN_OFFICE_CATALOG } from './modernOfficeCatalog';

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
  facingFrames?: Readonly<Record<Facing, number>>;
  animation?: 'adam-16x32';
  renderScale?: number;
}

export const WORLD_ATLAS: SpriteSheetAsset = {
  key: 'puny-world',
  path: '/assets/puny-world/punyworld-overworld-tileset.png',
  frameWidth: 16,
  frameHeight: 16,
};

export const SERENE_VILLAGE_ASSETS = {
  atlas: {
    key: 'serene-village-atlas', path: '/assets/limezu/serene-village/Serene_Village_16x16.png',
    frameWidth: 16, frameHeight: 16,
  },
  door: {
    key: 'serene-village-door', path: '/assets/limezu/serene-village/door_16x16.png',
    frameWidth: 16, frameHeight: 16,
  },
  campfire: {
    key: 'serene-village-campfire', path: '/assets/limezu/serene-village/campfire_16x16.png',
    frameWidth: 16, frameHeight: 16,
  },
  waterWaves: {
    key: 'serene-village-water-waves', path: '/assets/limezu/serene-village/water_waves_16x16.png',
    frameWidth: 16, frameHeight: 16,
  },
} as const satisfies Record<string, SpriteSheetAsset>;

export const MODERN_INTERIOR_ASSETS = {
  agent: {
    key: 'modern-agent-adam', path: '/assets/limezu/modern-interiors-free/Adam_16x16.png',
    frameWidth: 16, frameHeight: 32,
  },
  agentIdle: {
    key: 'modern-agent-adam-idle', path: '/assets/limezu/modern-interiors-free/Adam_idle_anim_16x16.png',
    frameWidth: 16, frameHeight: 32,
  },
} as const satisfies Record<string, SpriteSheetAsset>;

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
  main: {
    sheet: MODERN_INTERIOR_ASSETS.agent.key,
    idleRow: 0,
    walkRows: [0, 1, 2, 3],
    facingFrames: { down: 3, up: 1, left: 2, right: 0 },
    animation: 'adam-16x32',
    renderScale: 1.1,
  },
  ninja: { sheet: AGENT_ATLAS.main.key, idleRow: 0, walkRows: [0, 1, 2, 3], renderScale: 1.35 },
  subagent: { sheet: AGENT_ATLAS.subagent.key, idleRow: 0, walkRows: [0, 1, 2, 3], renderScale: 1.35 },
  branch: { sheet: AGENT_ATLAS.branch.key, idleRow: 0, walkRows: [0, 1, 2, 3], renderScale: 1.35 },
} as const satisfies Record<string, AgentSkin>;

const SUBAGENT_SKINS = [AGENT_SKINS.ninja, AGENT_SKINS.subagent, AGENT_SKINS.branch] as const;

export function agentSkinFor(agentId: string, role: 'main' | 'subagent'): AgentSkin {
  if (role === 'main') return AGENT_SKINS.main;
  const sequence = agentId.match(/(\d+)$/)?.[1];
  if (sequence) return SUBAGENT_SKINS[(Math.max(1, Number(sequence)) - 1) % SUBAGENT_SKINS.length]!;
  let hash = 2166136261;
  for (const character of agentId) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return SUBAGENT_SKINS[(hash >>> 0) % SUBAGENT_SKINS.length]!;
}

const FACING_FRAME_COLUMNS: Record<Facing, number> = { down: 0, up: 1, left: 2, right: 3 };
const AGENT_FRAME_COLUMNS = 4;

export function agentFrameIndex(skin: AgentSkin, facing: Facing, row: number = skin.idleRow): number {
  if (skin.facingFrames) return skin.facingFrames[facing];
  return row * AGENT_FRAME_COLUMNS + FACING_FRAME_COLUMNS[facing];
}

export function preloadVillageAssets(scene: Phaser.Scene): void {
  [
    WORLD_ATLAS,
    ...Object.values(SERENE_VILLAGE_ASSETS),
    ...Object.values(MODERN_INTERIOR_ASSETS),
    ...Object.values(AGENT_ATLAS),
    MODERN_OFFICE_ASSETS.atlas,
    MODERN_OFFICE_ASSETS.roomBuilder,
  ].forEach((asset) => {
    scene.load.spritesheet(asset.key, asset.path, { frameWidth: asset.frameWidth, frameHeight: asset.frameHeight });
  });
  [
    ...Object.values(ANIMAL_ASSETS),
    ...Object.values(HOUSE_ASSETS),
    ...Object.values(MODERN_OFFICE_ASSETS.furniture),
    ...MODERN_OFFICE_CATALOG,
  ].forEach((asset) => {
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

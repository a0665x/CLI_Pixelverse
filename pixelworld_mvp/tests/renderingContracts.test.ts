import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_ATLAS,
  AGENT_SKINS,
  WORLD_ATLAS,
  WORLD_ATLAS_FALLBACK_KEY,
  agentFrameIndex,
  ensureWorldAtlasTexture,
  preloadVillageAssets,
} from '../src/rendering/assetManifest';

describe('village asset manifest', () => {
  it('uses only the curated CC0 world and agent sprite sheets', () => {
    const sheets = [WORLD_ATLAS, ...Object.values(AGENT_ATLAS)];

    expect(WORLD_ATLAS.path).toBe('/assets/puny-world/punyworld-overworld-tileset.png');
    expect(Object.values(AGENT_ATLAS).map((sheet) => sheet.path)).toEqual([
      '/assets/ninja-adventure/ninja-blue.png',
      '/assets/ninja-adventure/samurai-blue.png',
      '/assets/ninja-adventure/samurai-green.png',
    ]);
    for (const sheet of sheets) {
      expect(sheet).toMatchObject({ frameWidth: 16, frameHeight: 16 });
      expect(sheet.path).not.toMatch(/pokemon|essentials|ruby|sapphire|rip/i);
    }
  });

  it('loads every curated sheet as 16 by 16 spritesheet frames', () => {
    const spritesheet = vi.fn();
    const image = vi.fn();

    preloadVillageAssets({ load: { spritesheet, image } } as never);

    expect(spritesheet).toHaveBeenCalledTimes(4);
    expect(spritesheet).toHaveBeenCalledWith('puny-world', '/assets/puny-world/punyworld-overworld-tileset.png', { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith('ninja-blue', '/assets/ninja-adventure/ninja-blue.png', { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith('samurai-blue', '/assets/ninja-adventure/samurai-blue.png', { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith('samurai-green', '/assets/ninja-adventure/samurai-green.png', { frameWidth: 16, frameHeight: 16 });
    expect(image).not.toHaveBeenCalled();
  });

  it('maps each facing and skin row to the expected four-column frame', () => {
    expect(agentFrameIndex(AGENT_SKINS.main, 'down')).toBe(0);
    expect(agentFrameIndex(AGENT_SKINS.main, 'up')).toBe(1);
    expect(agentFrameIndex(AGENT_SKINS.main, 'left')).toBe(2);
    expect(agentFrameIndex(AGENT_SKINS.main, 'right')).toBe(3);
    expect(agentFrameIndex(AGENT_SKINS.main, 'right', AGENT_SKINS.main.walkRows[1])).toBe(7);
  });

  it('installs and reports an explicit diagnostic texture when the Puny atlas is missing', () => {
    const generateTexture = vi.fn();
    const graphics = {
      fillStyle: vi.fn().mockReturnThis(),
      fillRect: vi.fn().mockReturnThis(),
      lineStyle: vi.fn().mockReturnThis(),
      lineBetween: vi.fn().mockReturnThis(),
      generateTexture,
      destroy: vi.fn(),
    };
    const scene = {
      textures: { exists: vi.fn(() => false) },
      make: { graphics: vi.fn(() => graphics) },
    };
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    expect(ensureWorldAtlasTexture(scene as never)).toBe(WORLD_ATLAS_FALLBACK_KEY);
    expect(generateTexture).toHaveBeenCalledWith(WORLD_ATLAS_FALLBACK_KEY, 16, 16);
    expect(error).toHaveBeenCalledWith(expect.stringContaining('missing essential Puny atlas'));
    error.mockRestore();
  });

  it('uses the loaded Puny atlas without creating a fallback', () => {
    const scene = {
      textures: { exists: vi.fn((key: string) => key === WORLD_ATLAS.key) },
      make: { graphics: vi.fn() },
    };
    expect(ensureWorldAtlasTexture(scene as never)).toBe(WORLD_ATLAS.key);
    expect(scene.make.graphics).not.toHaveBeenCalled();
  });
});

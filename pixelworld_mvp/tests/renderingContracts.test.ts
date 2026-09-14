import { VILLAGE_FURNITURE_CATALOG } from '../src/rendering/villageFurnitureCatalog';
import { describe, expect, it, vi } from 'vitest';
import {
  AGENT_ATLAS,
  AGENT_SKINS,
  ANIMAL_ASSETS,
  HOUSE_ASSETS,
  MODERN_INTERIOR_ASSETS,
  MODERN_OFFICE_COLLISION_MASKS,
  SERENE_VILLAGE_ASSETS,
  WORLD_ATLAS,
  WORLD_ATLAS_FALLBACK_KEY,
  agentFrameIndex,
  agentSkinFor,
  ensureWorldAtlasTexture,
  preloadVillageAssets,
  licensedOfficeAvailable,
} from '../src/rendering/assetManifest';
import { MODERN_OFFICE_ASSETS } from '../src/rendering/modernOfficeManifest';
import { MODERN_OFFICE_CATALOG } from '../src/rendering/modernOfficeCatalog';

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

  it('loads the Serene, Modern Interiors, world, and Agent sprite sheets', () => {
    const spritesheet = vi.fn();
    const image = vi.fn();
    const json = vi.fn();

    preloadVillageAssets({ load: { spritesheet, image, json } } as never);

    if (licensedOfficeAvailable()) expect(json).toHaveBeenCalledWith(
      MODERN_OFFICE_COLLISION_MASKS.key,
      MODERN_OFFICE_COLLISION_MASKS.path,
    );
    else expect(json).not.toHaveBeenCalled();

    expect([...spritesheet.mock.calls, ...image.mock.calls].map((call) => String(call[1])))
      .not.toEqual(expect.arrayContaining([
        expect.stringMatching(/modern-interiors-free\/(?:Interiors|Room_Builder)/),
      ]));

    expect(spritesheet).toHaveBeenCalledTimes(licensedOfficeAvailable()?12:10);
    expect(spritesheet).toHaveBeenCalledWith('puny-world', '/assets/puny-world/punyworld-overworld-tileset.png', { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith('ninja-blue', '/assets/ninja-adventure/ninja-blue.png', { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith('samurai-blue', '/assets/ninja-adventure/samurai-blue.png', { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith('samurai-green', '/assets/ninja-adventure/samurai-green.png', { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith(SERENE_VILLAGE_ASSETS.atlas.key, SERENE_VILLAGE_ASSETS.atlas.path, { frameWidth: 16, frameHeight: 16 });
    expect(spritesheet).toHaveBeenCalledWith(MODERN_INTERIOR_ASSETS.agent.key, MODERN_INTERIOR_ASSETS.agent.path, { frameWidth: 16, frameHeight: 32 });
    if(licensedOfficeAvailable()) expect(spritesheet).toHaveBeenCalledWith(MODERN_OFFICE_ASSETS.roomBuilder.key, MODERN_OFFICE_ASSETS.roomBuilder.path, { frameWidth: 16, frameHeight: 16 });
    expect(image).toHaveBeenCalledTimes(
      Object.keys(ANIMAL_ASSETS).length + Object.keys(HOUSE_ASSETS).length
        + (licensedOfficeAvailable()?Object.keys(MODERN_OFFICE_ASSETS.furniture).length + MODERN_OFFICE_CATALOG.length:0) + VILLAGE_FURNITURE_CATALOG.length,
    );
    for (const asset of VILLAGE_FURNITURE_CATALOG) expect(image).toHaveBeenCalledWith(asset.key, asset.path);
    expect(image).toHaveBeenCalledWith('animal-cow', '/assets/kenney/tiny-farm/cow.png');
    if(licensedOfficeAvailable()) expect(image).toHaveBeenCalledWith('modern-office-v1.2-computer', '/assets/private/modern-office-v1.2/Modern_Office_Singles_225.png');
    if(!licensedOfficeAvailable()) expect([...image.mock.calls,...spritesheet.mock.calls].some(call=>String(call[1]).includes('/private/'))).toBe(false);
    expect(image).toHaveBeenCalledWith('tiny-town-wall-brown-door', '/assets/kenney/tiny-town/wall-brown-door.png');
  });

  it('maps the taller LimeZu main character to its authored directional frames', () => {
    expect(AGENT_SKINS.main).toMatchObject({ sheet: MODERN_INTERIOR_ASSETS.agent.key, renderScale: 1.1 });
    expect(agentFrameIndex(AGENT_SKINS.main, 'down')).toBe(3);
    expect(agentFrameIndex(AGENT_SKINS.main, 'up')).toBe(1);
    expect(agentFrameIndex(AGENT_SKINS.main, 'left')).toBe(2);
    expect(agentFrameIndex(AGENT_SKINS.main, 'right')).toBe(0);
    expect(agentFrameIndex(AGENT_SKINS.subagent, 'right', AGENT_SKINS.subagent.walkRows[1])).toBe(7);
  });

  it('assigns stable varied character sheets by agent identity', () => {
    expect(agentSkinFor('main', 'main')).toBe(AGENT_SKINS.main);
    expect(agentSkinFor('reviewer-2', 'subagent')).toBe(agentSkinFor('reviewer-2', 'subagent'));
    const sheets = new Set(Array.from({ length: 18 }, (_, index) => (
      agentSkinFor(`subagent-${index + 1}`, 'subagent').sheet
    )));
    expect(sheets).toEqual(new Set([
      AGENT_SKINS.ninja.sheet,
      AGENT_SKINS.subagent.sheet,
      AGENT_SKINS.branch.sheet,
    ]));
    expect(new Set(['subagent-1', 'subagent-2', 'subagent-3'].map((id) => (
      agentSkinFor(id, 'subagent').sheet
    ))).size).toBe(3);
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

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ANIMAL_ASSETS,
  HOUSE_ASSETS,
  MODERN_INTERIOR_ASSETS,
  MODERN_OFFICE_COLLISION_MASKS,
  SERENE_VILLAGE_ASSETS,
  installVillageCollisionMasks,
  preloadVillageAssets,
  licensedOfficeAvailable,
} from '../src/rendering/assetManifest';
import { clearFurnitureAlphaMasksForTests, furnitureAlphaMask } from '../src/rendering/furnitureAlphaMasks';
import { MODERN_OFFICE_ASSETS } from '../src/rendering/modernOfficeManifest';

describe('curated village asset manifest', () => {
  afterEach(() => clearFurnitureAlphaMasksForTests());

  it('registers four semantic 16px Kenney Tiny Farm animal cells', () => {
    expect(Object.keys(ANIMAL_ASSETS)).toEqual(['cow', 'sheep', 'chicken', 'pig']);
    expect(ANIMAL_ASSETS.cow.path).toBe('/assets/kenney/tiny-farm/cow.png');
    expect(ANIMAL_ASSETS.pig.path).toBe('/assets/ninja-adventure/pig.png');
    expect(Object.values(ANIMAL_ASSETS).every(({ frameWidth, frameHeight }) => (
      frameWidth === 16 && frameHeight === 16
    ))).toBe(true);
  });

  it('registers detailed furniture only from the purchased Modern Office family', () => {
    expect(MODERN_OFFICE_ASSETS.furniture.computer.path).toBe('/assets/private/modern-office-v1.2/Modern_Office_Singles_225.png');
    expect(MODERN_OFFICE_ASSETS.furniture['office-chair'].path).toBe('/assets/private/modern-office-v1.2/Modern_Office_Singles_101.png');
    expect(Object.values(MODERN_OFFICE_ASSETS.furniture).every(({ path }) => path.includes('/assets/private/modern-office-v1.2/'))).toBe(true);
  });

  it('registers semantic Tiny Town pieces for one coherent house shell', () => {
    expect(HOUSE_ASSETS.grayRoofTopLeft.path).toBe('/assets/kenney/tiny-town/roof-gray-top-left.png');
    expect(HOUSE_ASSETS.orangeRoofWindowBottom.path).toBe('/assets/kenney/tiny-town/roof-orange-window-bottom.png');
    expect(HOUSE_ASSETS.brownWallDoor.path).toBe('/assets/kenney/tiny-town/wall-brown-door.png');
    expect(HOUSE_ASSETS.grayWallWindow.path).toBe('/assets/kenney/tiny-town/wall-gray-window.png');
    expect(Object.values(HOUSE_ASSETS)).toHaveLength(24);
    expect(Object.values(HOUSE_ASSETS).every(({ frameWidth, frameHeight }) => (
      frameWidth === 16 && frameHeight === 16
    ))).toBe(true);
  });

  it('registers the official LimeZu exterior and prototype interior family', () => {
    expect(SERENE_VILLAGE_ASSETS.atlas).toMatchObject({
      key: 'serene-village-atlas',
      path: '/assets/limezu/serene-village/Serene_Village_16x16.png',
      frameWidth: 16,
      frameHeight: 16,
    });
    expect(SERENE_VILLAGE_ASSETS.door.path).toContain('/assets/limezu/serene-village/door_16x16.png');
    expect(MODERN_INTERIOR_ASSETS.agentIdle.path).toContain('/assets/limezu/modern-interiors-free/Adam_idle_anim_16x16.png');
    expect(MODERN_OFFICE_ASSETS.roomBuilder.path).toContain('/assets/private/modern-office-v1.2/Room_Builder_Office_16x16.png');
  });

  it('preloads and installs the required Modern Office collision manifest', () => {
    const json = vi.fn();
    const scene = {
      load: { spritesheet: vi.fn(), image: vi.fn(), json },
      cache: { json: { get: vi.fn(() => ({
        schemaVersion: 1,
        alphaThreshold: 1,
        assets: Object.fromEntries(Array.from({ length: 339 }, (_, index) => [
          String(index + 1),
          { width: 32, height: 48, runs: [[0, 0, 1]] },
        ])),
      })) } },
    };

    preloadVillageAssets(scene as never);
    if (licensedOfficeAvailable()) expect(json).toHaveBeenCalledWith(
      MODERN_OFFICE_COLLISION_MASKS.key,
      MODERN_OFFICE_COLLISION_MASKS.path,
    );
    else expect(json).not.toHaveBeenCalled();
    installVillageCollisionMasks(scene as never);
    expect(furnitureAlphaMask(1)?.width).toBe(32);
    expect(furnitureAlphaMask(339)?.height).toBe(48);
  });
});

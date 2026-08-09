import { describe, expect, it } from 'vitest';
import {
  ANIMAL_ASSETS,
  HOUSE_ASSETS,
  MODERN_INTERIOR_ASSETS,
  SERENE_VILLAGE_ASSETS,
} from '../src/rendering/assetManifest';
import { MODERN_OFFICE_ASSETS } from '../src/rendering/modernOfficeManifest';

describe('curated village asset manifest', () => {
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
});

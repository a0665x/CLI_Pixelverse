import { describe, expect, it } from 'vitest';
import { ANIMAL_ASSETS, HOUSE_ASSETS, INTERIOR_ASSETS } from '../src/rendering/assetManifest';

describe('curated village asset manifest', () => {
  it('registers four semantic 16px Kenney Tiny Farm animal cells', () => {
    expect(Object.keys(ANIMAL_ASSETS)).toEqual(['cow', 'sheep', 'chicken', 'pig']);
    expect(ANIMAL_ASSETS.cow.path).toBe('/assets/kenney/tiny-farm/cow.png');
    expect(ANIMAL_ASSETS.pig.path).toBe('/assets/ninja-adventure/pig.png');
    expect(Object.values(ANIMAL_ASSETS).every(({ frameWidth, frameHeight }) => (
      frameWidth === 16 && frameHeight === 16
    ))).toBe(true);
  });

  it('registers furniture by visual purpose instead of source tile number', () => {
    expect(INTERIOR_ASSETS.sofa.path).toBe('/assets/kenney/roguelike-rpg/sofa.png');
    expect(INTERIOR_ASSETS.computer.path).toBe('/assets/kenney/modern-city/computer.png');
    expect(INTERIOR_ASSETS.television.path).toBe('/assets/kenney/modern-city/television.png');
    expect(Object.values(INTERIOR_ASSETS).every(({ frameWidth, frameHeight }) => (
      frameWidth === 16 && frameHeight === 16
    ))).toBe(true);
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
});

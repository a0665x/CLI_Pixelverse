export const TILE_SIZE = 16 as const;
export const WORLD_TILES = Object.freeze({ width: 48, height: 28 });
export const WORLD_PIXELS = Object.freeze({
  width: WORLD_TILES.width * TILE_SIZE,
  height: WORLD_TILES.height * TILE_SIZE,
});

export function displayScaleFor(availableWidth: number, availableHeight: number): number {
  return Math.min(
    availableWidth / WORLD_PIXELS.width,
    availableHeight / WORLD_PIXELS.height,
    1.5,
  );
}

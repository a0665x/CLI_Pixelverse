import { describe, expect, it } from 'vitest';
import { TILE_SIZE } from '../src/game/constants';
import { WORLD_ATLAS_FALLBACK_KEY } from '../src/rendering/assetManifest';
import { PUNY_REGIONS } from '../src/rendering/punyVillageAtlas';
import { buildVillageRenderPlan, VillageRenderer } from '../src/rendering/VillageRenderer';
import { WORLD_DEFINITION } from '../src/world/worldDefinition';

class FakeImage {
  depth = 0;
  alpha = 1;
  flipX = false;
  readonly width = TILE_SIZE;
  readonly height = TILE_SIZE;

  constructor(readonly x: number, readonly y: number, readonly texture: string, readonly frame?: number) {}
  setOrigin(originX: number, originY = originX): this {
    if (originX !== 0 || originY !== 0) throw new Error('village tiles must use top-left native-cell placement');
    return this;
  }
  setDepth(depth: number): this { this.depth = depth; return this; }
  setFlipX(flipX: boolean): this { this.flipX = flipX; return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  getBounds() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

const fakeScene = () => {
  const images: FakeImage[] = [];
  return {
    images,
    scene: {
      add: {
        image: (x: number, y: number, texture: string, frame?: number) => {
          const image = new FakeImage(x, y, texture, frame);
          images.push(image);
          return image;
        },
      },
    },
  };
};

const pointKey = (x: number, y: number) => `${x},${y}`;

describe('Puny village renderer contracts', () => {
  it('keeps every curated source cell on the native 16-pixel atlas grid', () => {
    for (const region of Object.values(PUNY_REGIONS)) {
      expect(region).toMatchObject({ width: TILE_SIZE, height: TILE_SIZE });
      expect(region.x % TILE_SIZE).toBe(0);
      expect(region.y % TILE_SIZE).toBe(0);
    }
  });

  it('covers each logical building bound with native atlas cells instead of scaled house motifs', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    for (const building of WORLD_DEFINITION.buildings) {
      const tiles = plan.buildingTiles.filter(({ buildingId }) => buildingId === building.id);
      const shell = tiles.filter(({ buildingRole }) => ['roof', 'wall', 'door'].includes(buildingRole ?? ''));
      const expected = new Set<string>();
      for (let y = building.bounds.y; y < building.bounds.y + building.bounds.height; y += 1) {
        for (let x = building.bounds.x; x < building.bounds.x + building.bounds.width; x += 1) {
          expected.add(pointKey(x * TILE_SIZE, y * TILE_SIZE));
        }
      }

      expect(new Set(shell.map(({ x, y }) => pointKey(x, y))), building.id).toEqual(expected);
      expect(shell).toHaveLength(building.bounds.width * building.bounds.height);
      expect(tiles.every(({ scale }) => scale === undefined), building.id).toBe(true);
      expect(tiles.every(({ x, y }) => x % TILE_SIZE === 0 && y % TILE_SIZE === 0), building.id).toBe(true);
    }
  });

  it('separates static facade cells from roof and door-frame foreground groups', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    for (const building of WORLD_DEFINITION.buildings) {
      const tiles = plan.buildingTiles.filter(({ buildingId }) => buildingId === building.id);
      const roof = tiles.filter(({ buildingRole }) => buildingRole === 'roof');
      const facade = tiles.filter(({ buildingRole }) => buildingRole === 'wall' || buildingRole === 'door');
      const doorFrame = tiles.find(({ buildingRole }) => buildingRole === 'door-frame');
      const frontY = (building.bounds.y + building.bounds.height) * TILE_SIZE;

      expect(roof).toHaveLength(building.bounds.width * 3);
      expect(facade).toHaveLength(building.bounds.width * 2);
      expect(new Set(roof.map(({ foregroundGroup }) => foregroundGroup))).toEqual(new Set([`roof:${building.id}`]));
      expect(facade.every(({ foregroundGroup, foregroundKind }) => !foregroundGroup && !foregroundKind)).toBe(true);
      expect(doorFrame).toMatchObject({
        x: building.entrance.threshold.x * TILE_SIZE,
        y: building.entrance.threshold.y * TILE_SIZE,
        foregroundGroup: `door:${building.id}`,
        foregroundKind: 'door-frame',
        depth: frontY,
      });
      expect(Math.max(...facade.map(({ depth }) => depth))).toBeLessThan(building.entrance.threshold.y * TILE_SIZE + TILE_SIZE / 2);
      expect(Math.min(...roof.map(({ depth }) => depth))).toBeLessThan(doorFrame!.depth);
    }
  });

  it('renders one real composite foreground for each roof, door frame, and tree canopy', () => {
    const fake = fakeScene();
    const rendered = new VillageRenderer(fake.scene as never).render(WORLD_DEFINITION);
    const roofs = rendered.foregrounds.filter(({ kind }) => kind === 'roof');
    const doors = rendered.foregrounds.filter(({ kind }) => kind === 'door-frame');
    const canopies = rendered.foregrounds.filter(({ kind }) => kind === 'canopy');

    expect(roofs).toHaveLength(WORLD_DEFINITION.buildings.length);
    expect(doors).toHaveLength(WORLD_DEFINITION.buildings.length);
    expect(canopies).toHaveLength(WORLD_DEFINITION.scenery.trees.length);
    for (const [index, building] of WORLD_DEFINITION.buildings.entries()) {
      expect(roofs[index]!.bounds).toEqual({
        x: building.bounds.x * TILE_SIZE,
        y: building.bounds.y * TILE_SIZE,
        width: building.bounds.width * TILE_SIZE,
        height: 3 * TILE_SIZE,
      });
      expect(doors[index]!.bounds).toEqual({
        x: building.entrance.threshold.x * TILE_SIZE,
        y: building.entrance.threshold.y * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
      });
    }
    for (const [index, tree] of WORLD_DEFINITION.scenery.trees.entries()) {
      expect(canopies[index]!.bounds).toEqual({
        x: (tree.trunk.x - 1) * TILE_SIZE,
        y: (tree.trunk.y - 1) * TILE_SIZE,
        width: 3 * TILE_SIZE,
        height: 2 * TILE_SIZE,
      });
    }
    expect(fake.images).toHaveLength(buildVillageRenderPlan(WORLD_DEFINITION).commands.length);
  });

  it('derives road tiles from terrain and chooses edge, straight, plaza, and junction cells', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    const expected = new Set<string>();
    for (const area of WORLD_DEFINITION.terrain.filter(({ kind }) => kind === 'road' || kind === 'plaza')) {
      for (let y = area.bounds.y; y < area.bounds.y + area.bounds.height; y += 1) {
        for (let x = area.bounds.x; x < area.bounds.x + area.bounds.width; x += 1) expected.add(pointKey(x, y));
      }
    }
    const roads = plan.commands.filter(({ layer }) => layer === 'roads');
    expect(new Set(plan.roadTiles.map(({ x, y }) => pointKey(x, y)))).toEqual(expected);
    expect([...new Set(roads.map(({ region }) => region))]).toEqual(expect.arrayContaining([
      'dirtHorizontal', 'dirtVertical', 'dirtJunction', 'dirtPlaza',
    ]));
    expect(roads.find(({ x, y }) => x === 2 * TILE_SIZE && y === 8 * TILE_SIZE)?.region).toBe('dirtHorizontal');
    expect(roads.find(({ x, y }) => x === 11 * TILE_SIZE && y === 10 * TILE_SIZE)?.region).toBe('dirtVertical');
    expect(roads.find(({ x, y }) => x === 11 * TILE_SIZE && y === 8 * TILE_SIZE)?.region).toBe('dirtJunction');
  });

  it('emits only atlas commands in concrete cross-layer depth families', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    const commandsAt = (layer: string) => plan.commands.filter((command) => command.layer === layer);
    const knowledge = plan.buildingTiles.filter(({ buildingId }) => buildingId === 'knowledge-hall');

    expect(plan.commands.every(({ primitive }) => primitive === 'atlas')).toBe(true);
    expect(new Set(plan.commands.map(({ layer }) => layer))).toEqual(new Set([
      'grass', 'roads', 'waterAndDecorations', 'wallsAndThresholds',
      'trunksAndWorkZones', 'foregrounds', 'signboards',
    ]));
    expect(new Set(commandsAt('grass').map(({ depth }) => depth))).toEqual(new Set([-1_000]));
    expect(new Set(commandsAt('roads').map(({ depth }) => depth))).toEqual(new Set([-900]));
    expect(new Set(knowledge.filter(({ buildingRole }) => buildingRole === 'wall').map(({ depth }) => depth))).toEqual(new Set([-700]));
    expect(new Set(knowledge.filter(({ buildingRole }) => buildingRole === 'roof').map(({ depth }) => depth))).toEqual(new Set([80]));
    expect(knowledge.find(({ buildingRole }) => buildingRole === 'door-frame')?.depth).toBe(112);
    expect(knowledge.find(({ buildingRole }) => buildingRole === 'signboard')?.depth).toBe(113);
  });

  it('renders the diagnostic atlas texture without invalid frame lookups when Puny is missing', () => {
    const fake = fakeScene();
    new VillageRenderer(fake.scene as never, WORLD_ATLAS_FALLBACK_KEY).render(WORLD_DEFINITION);

    expect(fake.images.every(({ texture }) => texture === WORLD_ATLAS_FALLBACK_KEY)).toBe(true);
    expect(fake.images.every(({ frame }) => frame === undefined)).toBe(true);
  });
});

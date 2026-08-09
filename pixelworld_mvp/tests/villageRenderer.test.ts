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
  setTint(_tint: number): this { return this; }
  setAlpha(alpha: number): this { this.alpha = alpha; return this; }
  getBounds() { return { x: this.x, y: this.y, width: this.width, height: this.height }; }
}

class FakeZone {
  interactive = false;
  constructor(readonly x: number, readonly y: number, readonly width: number, readonly height: number) {}
  setOrigin(_x: number, _y = _x): this { return this; }
  setInteractive(): this { this.interactive = true; return this; }
}

const fakeScene = () => {
  const images: FakeImage[] = [];
  const zones: FakeZone[] = [];
  return {
    images,
    zones,
    scene: {
      add: {
        image: (x: number, y: number, texture: string, frame?: number) => {
          const image = new FakeImage(x, y, texture, frame);
          images.push(image);
          return image;
        },
        zone: (x: number, y: number, width: number, height: number) => {
          const zone = new FakeZone(x, y, width, height);
          zones.push(zone);
          return zone;
        },
      },
    },
  };
};

const pointKey = (x: number, y: number) => `${x},${y}`;

describe('Puny village renderer contracts', () => {
  it('uses a seamless base tile instead of packed Serene object fragments', () => {
    const grass = buildVillageRenderPlan(WORLD_DEFINITION).commands.filter(({ layer }) => layer === 'grass');

    expect(grass).toHaveLength(WORLD_DEFINITION.width * WORLD_DEFINITION.height);
    expect(grass.every(({ region, textureKey, frame }) => (
      region === 'grassPlain' && textureKey === undefined && frame === undefined
    ))).toBe(true);
  });

  it('uses one verified complete six-cell Serene tree assembly for every tree', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    const frameSets = WORLD_DEFINITION.scenery.trees.map((tree) => plan.commands
      .filter(({ foregroundGroup }) => foregroundGroup === `canopy:${tree.id}`)
      .map(({ frame }) => frame));

    expect(frameSets.every((frames) => frames.length === 6)).toBe(true);
    expect(new Set(frameSets.map((frames) => frames.join(','))).size).toBe(1);
  });

  it('renders each exterior threshold as one clean dirt cell beneath its real door frame', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    for (const building of WORLD_DEFINITION.buildings) {
      const threshold = plan.commands.filter(({ x, y, buildingRole }) => (
        x === building.entrance.threshold.x * TILE_SIZE &&
        y === building.entrance.threshold.y * TILE_SIZE &&
        buildingRole === 'threshold'
      ));
      expect(threshold).toHaveLength(1);
      expect(threshold[0]).toMatchObject({ region: 'doorThreshold' });
      expect(threshold[0]).not.toHaveProperty('textureKey');
      expect(threshold[0]).not.toHaveProperty('frame');
    }
  });

  it('uses the crisp DOM building labels without stray atlas sign fragments', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);

    expect(plan.commands.filter(({ buildingRole }) => buildingRole === 'signboard')).toEqual([]);
  });

  it('uses clean Serene house rows without carrying pixels from the preceding packed object', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    const expectedRows: Record<string, number> = {
      'arrival-lodge': 25,
      'maker-workshop': 25,
      'tool-smithy': 25,
      'thinkers-cottage': 33,
      'network-lab': 33,
      'heartbeat-tower': 41,
      'offline-dormitory': 41,
      'awaiting-post': 33,
      'collaboration-barn': 33,
      'recovery-clinic': 25,
      'archive-library': 41,
      'rest-cabin': 41,
    };
    for (const building of WORLD_DEFINITION.buildings) {
      const firstRoof = plan.buildingTiles.find(({ buildingId, buildingRole }) => (
        buildingId === building.id && buildingRole === 'roof'
      ));
      const expectedColumn = ['network-lab', 'offline-dormitory', 'maker-workshop', 'collaboration-barn', 'recovery-clinic', 'rest-cabin']
        .includes(building.id) ? 5 : 0;
      expect(firstRoof?.frame).toBe(expectedRows[building.id]! * 19 + expectedColumn);
    }

  });

  it('uses a clean horizontal avenue at the Maker entrance instead of a broken cap cell', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    const maker = WORLD_DEFINITION.buildings.find(({ id }) => id === 'maker-workshop')!;
    const outside = plan.commands.find(({ layer, x, y }) => (
      layer === 'roads' && x === maker.entrance.outside.x * TILE_SIZE && y === maker.entrance.outside.y * TILE_SIZE
    ));

    expect(outside?.region).toBe('dirtHorizontal');
  });

  it('uses dedicated timber bridge deck tiles instead of house-wall fragments', () => {
    const bridges = buildVillageRenderPlan(WORLD_DEFINITION).commands.filter(({ sceneryRole }) => sceneryRole === 'bridge');
    expect(bridges).toHaveLength(6);
    expect(bridges.map(({ region }) => region)).toEqual([
      'timberBridgeLeft', 'timberBridgeRight',
      'timberBridgeLeft', 'timberBridgeRight',
      'timberBridgeLeft', 'timberBridgeRight',
    ]);
  });

  it('keeps a lively mixed herd in the village pasture', () => {
    const count = (species: 'cow' | 'sheep' | 'pig' | 'chicken') =>
      WORLD_DEFINITION.scenery.animals.filter((animal) => animal.species === species);
    expect(count('cow')).toHaveLength(2);
    expect(count('sheep')).toHaveLength(3);
    expect(count('pig')).toHaveLength(2);
    expect(count('chicken')).toHaveLength(3);
  });

  it('keeps every curated source cell on the native 16-pixel atlas grid', () => {
    for (const region of Object.values(PUNY_REGIONS)) {
      expect(region).toMatchObject({ width: TILE_SIZE, height: TILE_SIZE });
      expect(region.x % TILE_SIZE).toBe(0);
      expect(region.y % TILE_SIZE).toBe(0);
    }
  });

  it('builds twelve compact native-scale LimeZu houses with distinct functional destinations', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    for (const building of WORLD_DEFINITION.buildings) {
      const tiles = plan.buildingTiles.filter(({ buildingId }) => buildingId === building.id);
      const shell = tiles.filter(({ buildingRole }) => ['roof', 'wall', 'window', 'door'].includes(buildingRole ?? ''));
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
      expect(building.bounds).toMatchObject({ width: 5, height: 4 });
      expect(tiles.filter(({ buildingRole }) => buildingRole === 'door')).toHaveLength(1);
      expect(tiles.filter(({ buildingRole }) => buildingRole === 'window')).toHaveLength(2);
      expect(tiles.filter(({ buildingRole }) => ['roof', 'wall', 'window', 'door', 'door-frame'].includes(buildingRole ?? ''))
        .every(({ textureKey }) => textureKey === 'serene-village-atlas'), building.id).toBe(true);
    }
    expect(WORLD_DEFINITION.buildings).toHaveLength(12);
    expect(plan.hitRegions.map(({ buildingId }) => buildingId)).toEqual(WORLD_DEFINITION.buildings.map(({ id }) => id));
  });

  it('separates static facade cells from roof and door-frame foreground groups', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    for (const building of WORLD_DEFINITION.buildings) {
      const tiles = plan.buildingTiles.filter(({ buildingId }) => buildingId === building.id);
      const roof = tiles.filter(({ buildingRole }) => buildingRole === 'roof');
      const facade = tiles.filter(({ buildingRole }) => ['wall', 'window', 'door'].includes(buildingRole ?? ''));
      const doorFrame = tiles.find(({ buildingRole }) => buildingRole === 'door-frame');
      const frontY = (building.bounds.y + building.bounds.height) * TILE_SIZE;

      expect(roof).toHaveLength(building.bounds.width * 3);
      expect(facade).toHaveLength(building.bounds.width);
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
    expect(rendered.hitRegions).toHaveLength(WORLD_DEFINITION.buildings.length);
    expect(rendered.hitRegions.every(({ object }) => (object as unknown as FakeZone).interactive)).toBe(true);
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
        y: (tree.trunk.y - 2) * TILE_SIZE,
        width: 2 * TILE_SIZE,
        height: 3 * TILE_SIZE,
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
    expect(roads.find(({ x, y }) => x === 14 * TILE_SIZE && y === 6 * TILE_SIZE)?.region).toBe('dirtHorizontal');
    expect(roads.find(({ x, y }) => x === 16 * TILE_SIZE && y === 18 * TILE_SIZE)?.region).toBe('dirtVertical');
    expect(roads.find(({ x, y }) => x === 38 * TILE_SIZE && y === 14 * TILE_SIZE)?.region).toBe('dirtJunction');
  });

  it('renders winding water, three bridges, crops, pasture, and farm details from world data', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    const roles = plan.commands.map(({ sceneryRole }) => sceneryRole);
    expect(roles.filter((role) => role === 'bridge')).toHaveLength(6);
    expect(roles).toContain('river');
    expect(roles).toContain('crop');
    expect(roles).toContain('pasture');
  });

  it('emits only atlas commands in concrete cross-layer depth families', () => {
    const plan = buildVillageRenderPlan(WORLD_DEFINITION);
    const commandsAt = (layer: string) => plan.commands.filter((command) => command.layer === layer);
    const research = plan.buildingTiles.filter(({ buildingId }) => buildingId === 'arrival-lodge');

    expect(plan.commands.every(({ primitive }) => primitive === 'atlas')).toBe(true);
    expect(new Set(plan.commands.map(({ layer }) => layer))).toEqual(new Set([
      'grass', 'roads', 'waterAndDecorations', 'wallsAndThresholds',
      'trunksAndWorkZones', 'foregrounds',
    ]));
    expect(new Set(commandsAt('grass').map(({ depth }) => depth))).toEqual(new Set([-1_000]));
    expect(new Set(commandsAt('roads').map(({ depth }) => depth))).toEqual(new Set([-900]));
    expect(new Set(research.filter(({ buildingRole }) => buildingRole === 'wall').map(({ depth }) => depth))).toEqual(new Set([-700]));
    expect(new Set(research.filter(({ buildingRole }) => buildingRole === 'roof').map(({ depth }) => depth))).toEqual(new Set([80]));
    expect(research.find(({ buildingRole }) => buildingRole === 'door-frame')?.depth).toBe(96);
    expect(research.find(({ buildingRole }) => buildingRole === 'signboard')).toBeUndefined();
  });

  it('renders the diagnostic atlas texture without invalid frame lookups when Puny is missing', () => {
    const fake = fakeScene();
    new VillageRenderer(fake.scene as never, WORLD_ATLAS_FALLBACK_KEY).render(WORLD_DEFINITION);

    const fallbackImages = fake.images.filter(({ texture }) => texture === WORLD_ATLAS_FALLBACK_KEY);
    const houseImages = fake.images.filter(({ texture }) => texture === 'serene-village-atlas');
    expect(fallbackImages.length).toBeGreaterThan(0);
    expect(fallbackImages.every(({ frame }) => frame === undefined)).toBe(true);
    expect(houseImages.length).toBeGreaterThan(0);
    expect(houseImages.every(({ frame }) => typeof frame === 'number')).toBe(true);
  });
});

import Phaser from 'phaser';
import { TILE_SIZE, WORLD_PIXELS } from '../game/constants';
import { emitWorldReady } from '../game/worldReady';
import { NavigationGrid } from '../navigation/navigationGrid';
import { ensureAssetFallbacks, preloadVillageAssets, PROP_ASSETS } from '../rendering/assetManifest';
import { createVillageTextures } from '../rendering/createVillageTextures';
import { WORLD_DEFINITION } from '../world/worldDefinition';
import { validateWorld } from '../world/validateWorld';

export interface RenderedForeground {
  object: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Alpha & Phaser.GameObjects.Components.Depth;
  bounds: Phaser.Geom.Rectangle;
  baselineY: number;
}

export class WorldScene extends Phaser.Scene {
  readonly worldDefinition = WORLD_DEFINITION;
  readonly navigationGrid = NavigationGrid.fromWorld(WORLD_DEFINITION);
  readonly renderedForegrounds: RenderedForeground[] = [];

  constructor() { super('world'); }
  preload(): void { preloadVillageAssets(this); }

  create(): void {
    const errors = validateWorld(this.worldDefinition);
    if (errors.length > 0) throw new Error(`Invalid world definition:\n${errors.join('\n')}`);
    ensureAssetFallbacks(this);
    createVillageTextures(this);
    this.cameras.main.setBounds(0, 0, WORLD_PIXELS.width, WORLD_PIXELS.height).setRoundPixels(true);
    this.renderTerrain();
    this.renderBuildings();
    this.renderScenery();
    this.renderWorkProps();
    emitWorldReady(this.game.events, this);
  }

  private renderTerrain(): void {
    for (let y = 0; y < this.worldDefinition.height; y += 1) for (let x = 0; x < this.worldDefinition.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'terrain-grass').setOrigin(0).setDepth(0);
    const pathRects = [
      { x: 1, y: 7, width: 38, height: 3 }, { x: 18, y: 7, width: 4, height: 14 },
      { x: 5, y: 9, width: 3, height: 10 }, { x: 32, y: 9, width: 3, height: 10 },
    ];
    for (const rect of pathRects) for (let y = rect.y; y < rect.y + rect.height; y += 1) for (let x = rect.x; x < rect.x + rect.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'terrain-path').setOrigin(0).setDepth(1);
  }

  private renderBuildings(): void {
    const palettes = [0x58718f, 0x8b5a47, 0x5d6f5a];
    this.worldDefinition.buildings.forEach((building, index) => {
      const { x, y, width, height } = building.bounds;
      this.add.rectangle(x * TILE_SIZE, y * TILE_SIZE, width * TILE_SIZE, height * TILE_SIZE, palettes[index]!).setOrigin(0).setDepth((y + height) * TILE_SIZE - 2);
      this.add.rectangle(x * TILE_SIZE - 4, y * TILE_SIZE - 8, width * TILE_SIZE + 8, 28, 0x343b4f).setOrigin(0).setDepth((y + height) * TILE_SIZE);
      this.add.rectangle((x + Math.floor(width / 2)) * TILE_SIZE - 6, (y + height) * TILE_SIZE - 18, 12, 18, 0x5a3828).setOrigin(0).setDepth((y + height) * TILE_SIZE - 1);
      this.add.text(building.labelAnchor.x * TILE_SIZE, building.labelAnchor.y * TILE_SIZE, building.label, { fontFamily: 'monospace', fontSize: '8px', color: '#fff4cf', backgroundColor: '#203126', padding: { x: 3, y: 2 } }).setOrigin(0.5, 0).setDepth(10_000);
    });
  }

  private renderScenery(): void {
    const pond = this.worldDefinition.scenery.pond;
    for (let y = pond.y; y < pond.y + pond.height; y += 1) for (let x = pond.x; x < pond.x + pond.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'terrain-water').setOrigin(0).setDepth(2);
    for (const bed of this.worldDefinition.scenery.flowerBeds) for (let y = bed.y; y < bed.y + bed.height; y += 1) for (let x = bed.x; x < bed.x + bed.width; x += 1) this.add.image(x * TILE_SIZE, y * TILE_SIZE, 'flower-bed').setOrigin(0).setDepth(3);
    for (const tree of this.worldDefinition.scenery.trees) {
      const footX = tree.trunk.x * TILE_SIZE + 8;
      const footY = tree.trunk.y * TILE_SIZE + TILE_SIZE;
      this.add.image(tree.trunk.x * TILE_SIZE, tree.trunk.y * TILE_SIZE, 'tree-trunk').setOrigin(0).setDepth(footY - 1);
      const canopy = this.add.image(footX, footY - 22, 'tree-canopy').setDepth(footY);
      this.renderedForegrounds.push({ object: canopy, bounds: canopy.getBounds(), baselineY: footY });
    }
  }

  private renderWorkProps(): void {
    const props: Array<[keyof typeof PROP_ASSETS, number, number]> = [
      ['board', 5, 7], ['bookshelf', 8, 7], ['appleDesk', 18, 7], ['appleTerminal', 22, 7],
      ['server', 31, 7], ['lamp', 34, 7], ['appleSofa', 20, 17], ['crate', 34, 14],
    ];
    for (const [key, x, y] of props) {
      const image = this.add.image(x * TILE_SIZE + 8, y * TILE_SIZE + 8, `prop-${key}`).setDepth(y * TILE_SIZE + 15);
      if (key.startsWith('apple')) image.setScale(0.5);
    }
  }
}

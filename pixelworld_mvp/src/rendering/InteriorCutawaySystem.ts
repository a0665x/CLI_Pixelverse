import type Phaser from 'phaser';
import { WORLD_PIXELS } from '../game/constants';
import type { FurnitureDefinition, FurnitureKind, GridPoint, InteriorDefinition, WorldDefinition } from '../world/types';
import { INTERIOR_DEFINITIONS } from '../world/interiorDefinitions';
import { CUTAWAY_OPEN_EVENT } from '../ui/TestPanel';
import { AGENT_SKINS, INTERIOR_ASSETS, agentFrameIndex } from './assetManifest';
import {
  assignInteriorOccupants,
  type InteriorAgentSnapshot,
  type InteriorOccupantAssignment,
} from './interiorAssignment';

const ROOM_CELL = 22;
const CUTAWAY_DEPTH = 100_000;
const CYCLE_MS = 2_400;

export interface CutawayLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function cutawayLayoutForViewport(viewportWidth: number, _viewportHeight: number): CutawayLayout {
  const wide = viewportWidth >= 940;
  const width = wide ? 480 : 608;
  const height = wide ? 288 : 320;
  return {
    x: (WORLD_PIXELS.width - width) / 2,
    y: (WORLD_PIXELS.height - height) / 2,
    width,
    height,
  };
}

const viewport = (): { width: number; height: number } => ({
  width: typeof window === 'undefined' ? 1_280 : window.innerWidth,
  height: typeof window === 'undefined' ? 720 : window.innerHeight,
});

const wallColors: Record<InteriorDefinition['wall'], number> = {
  cream: 0xe8cf98,
  blue: 0x8fb8c9,
  brick: 0xb66f5c,
  green: 0x91b878,
};
const floorColors: Record<InteriorDefinition['floor'], [number, number]> = {
  wood: [0xb88754, 0xc99c64],
  tile: [0x8f9b91, 0xaab3a7],
};
const roofColors: Record<InteriorDefinition['id'], [number, number, number]> = {
  'rest-cabin': [0x8a4b35, 0xb96b46, 0xe0a86f],
  'research-library': [0x376b84, 0x4f91a8, 0x9bc4ce],
  'maker-workshop': [0x8e3f35, 0xc65b43, 0xe39a62],
  'collaboration-barn': [0x466b3b, 0x6a9452, 0xa5bf72],
};
const actionSymbols = {
  rest: 'Z', offline: 'ZZ', think: '?', plan: '▤', read: '▥', web: '⌁', edit: '<>',
  tool: '⚒', repair: '+', clone: '◇', respond: '➤', generic: '•',
} as const;

const furnitureLabel = (kind: FurnitureKind): string => ({
  sofa: 'SOFA', television: 'TV', bed: 'BED', bookcase: 'BOOKS', computer: 'PC',
  'map-table': 'MAP', 'planning-board': 'PLAN', 'reading-desk': 'READ', workbench: 'BENCH',
  'tool-wall': 'TOOLS', 'repair-table': 'REPAIR', 'dispatch-pod': 'CLONE',
  'radio-console': 'RADIO', 'response-desk': 'SEND', 'meeting-table': 'MEET', decor: '',
})[kind];

function assetForFurniture(kind: FurnitureKind): string | undefined {
  if (kind === 'sofa') return INTERIOR_ASSETS.sofa.key;
  if (kind === 'bed') return INTERIOR_ASSETS.bed.key;
  if (kind === 'bookcase') return INTERIOR_ASSETS.bookcase.key;
  if (kind === 'computer') return INTERIOR_ASSETS.computer.key;
  if (kind === 'television') return INTERIOR_ASSETS.television.key;
  if (kind === 'workbench' || kind === 'tool-wall' || kind === 'repair-table') return INTERIOR_ASSETS.workbench.key;
  if (kind === 'radio-console' || kind === 'response-desk' || kind === 'dispatch-pod') return INTERIOR_ASSETS.radio.key;
  if (kind === 'map-table' || kind === 'meeting-table' || kind === 'reading-desk') return INTERIOR_ASSETS.table.key;
  return undefined;
}

function drawFurnitureShape(
  graphics: Phaser.GameObjects.Graphics,
  furniture: FurnitureDefinition,
  x: number,
  y: number,
): void {
  const dark = 0x382d2a;
  const wood = 0x855338;
  const cream = 0xf1d89a;
  const blue = 0x66b7b2;
  graphics.fillStyle(dark, 1);
  if (furniture.kind === 'sofa') {
    graphics.fillRect(x - 16, y - 7, 32, 14).fillStyle(0xb65f4b, 1).fillRect(x - 13, y - 5, 26, 9);
  } else if (furniture.kind === 'television') {
    graphics.fillRect(x - 14, y - 10, 28, 18).fillStyle(0x69c8c7, 1).fillRect(x - 11, y - 7, 22, 11);
  } else if (furniture.kind === 'bed') {
    graphics.fillRect(x - 16, y - 10, 32, 20).fillStyle(cream, 1).fillRect(x - 13, y - 8, 26, 16).fillStyle(0x7ca6a0, 1).fillRect(x - 13, y + 1, 26, 7);
  } else if (furniture.kind === 'bookcase') {
    graphics.fillRect(x - 9, y - 16, 18, 32).fillStyle(wood, 1).fillRect(x - 7, y - 14, 14, 28);
    graphics.fillStyle(0xd1a84b, 1).fillRect(x - 5, y - 11, 3, 8).fillStyle(blue, 1).fillRect(x, y - 11, 4, 8);
    graphics.fillStyle(cream, 1).fillRect(x - 5, y + 2, 4, 8).fillStyle(0xb4554c, 1).fillRect(x + 1, y + 2, 3, 8);
  } else if (furniture.kind === 'computer' || furniture.kind === 'radio-console' || furniture.kind === 'response-desk' || furniture.kind === 'dispatch-pod') {
    graphics.fillRect(x - 14, y + 3, 28, 7).fillStyle(wood, 1).fillRect(x - 12, y + 5, 24, 3);
    graphics.fillStyle(dark, 1).fillRect(x - 8, y - 9, 16, 13).fillStyle(blue, 1).fillRect(x - 6, y - 7, 12, 8);
  } else if (furniture.kind === 'planning-board' || furniture.kind === 'tool-wall') {
    graphics.fillRect(x - 16, y - 11, 32, 22).fillStyle(cream, 1).fillRect(x - 13, y - 8, 26, 16);
    graphics.fillStyle(0xb65f4b, 1).fillRect(x - 9, y - 4, 7, 3).fillStyle(blue, 1).fillRect(x + 2, y + 1, 8, 3);
  } else {
    graphics.fillRect(x - 15, y - 6, 30, 12).fillStyle(wood, 1).fillRect(x - 13, y - 4, 26, 8);
  }
}

export class InteriorCutawaySystem {
  private root: Phaser.GameObjects.Container | undefined;
  private occupantLayer: Phaser.GameObjects.Container | undefined;
  private roof: Phaser.GameObjects.Container | undefined;
  private roofTween: Phaser.Tweens.Tween | undefined;
  private statusText: Phaser.GameObjects.Text | undefined;
  private openId: string | undefined;
  private currentAssignments: InteriorOccupantAssignment[] = [];
  private assignmentSignature = '';
  private roomOrigin: GridPoint = { x: 0, y: 0 };
  private readonly escapeHandler = (): void => this.close();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldDefinition,
    private readonly viewportProvider: () => { width: number; height: number } = viewport,
  ) {
    scene.input.keyboard?.on('keydown-ESC', this.escapeHandler);
  }

  open(buildingId: string): void {
    if (this.openId === buildingId && this.root) return;
    const building = this.world.buildings.find(({ id }) => id === buildingId);
    if (!building) {
      console.warn(`[pixelworld] cannot open unknown house: ${buildingId}`);
      return;
    }
    const interior = INTERIOR_DEFINITIONS[building.themeId];
    this.close();
    this.openId = buildingId;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CUTAWAY_OPEN_EVENT));
    const size = this.viewportProvider();
    const layout = cutawayLayoutForViewport(size.width, size.height);
    const root = this.scene.add.container(0, 0).setDepth(CUTAWAY_DEPTH).setScrollFactor(0);
    this.root = root;

    const backdrop = this.scene.add.rectangle(
      WORLD_PIXELS.width / 2, WORLD_PIXELS.height / 2,
      WORLD_PIXELS.width, WORLD_PIXELS.height, 0x071018, 0.78,
    ).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    const panel = this.scene.add.rectangle(
      layout.x + layout.width / 2, layout.y + layout.height / 2,
      layout.width, layout.height, 0x17252a, 1,
    ).setStrokeStyle(3, 0xf1d89a, 1);
    const blocker = this.scene.add.zone(layout.x, layout.y, layout.width, layout.height)
      .setOrigin(0, 0).setInteractive().on('pointerdown', (...args: unknown[]) => {
        (args.at(-1) as { stopPropagation?: () => void } | undefined)?.stopPropagation?.();
      });
    root.add([backdrop, panel]);

    const title = this.scene.add.text(layout.x + 18, layout.y + 10, interior.label, {
      fontFamily: 'monospace', fontSize: '11px', color: '#fff0bd', fontStyle: 'bold',
    });
    this.statusText = this.scene.add.text(layout.x + 18, layout.y + 27, 'EMPTY · 點擊關閉或按 ESC', {
      fontFamily: 'monospace', fontSize: '7px', color: '#9fc9b4',
    });
    root.add([title, this.statusText]);

    const roomWidth = interior.width * ROOM_CELL;
    const roomHeight = interior.height * ROOM_CELL;
    const roomX = Math.round(layout.x + (layout.width - roomWidth) / 2);
    const roomY = Math.round(layout.y + 48);
    this.roomOrigin = { x: roomX, y: roomY };
    const room = this.scene.add.graphics();
    const [floorA, floorB] = floorColors[interior.floor];
    room.fillStyle(wallColors[interior.wall], 1).fillRect(roomX - 7, roomY - 7, roomWidth + 14, roomHeight + 14);
    for (let y = 0; y < interior.height; y += 1) {
      for (let x = 0; x < interior.width; x += 1) {
        room.fillStyle((x + y) % 2 === 0 ? floorA : floorB, 1)
          .fillRect(roomX + x * ROOM_CELL, roomY + y * ROOM_CELL, ROOM_CELL, ROOM_CELL);
      }
    }
    room.fillStyle(0x3b3430, 1).fillRect(roomX - 7, roomY - 7, roomWidth + 14, 7);
    room.lineStyle(2, 0x4d3a30, 1).strokeRect(roomX - 7, roomY - 7, roomWidth + 14, roomHeight + 14);
    root.add(room);

    const furnitureGraphics = this.scene.add.graphics();
    root.add(furnitureGraphics);
    for (const furniture of interior.furniture) {
      const x = roomX + furniture.point.x * ROOM_CELL + ROOM_CELL / 2;
      const y = roomY + furniture.point.y * ROOM_CELL + ROOM_CELL / 2;
      drawFurnitureShape(furnitureGraphics, furniture, x, y);
      const assetKey = assetForFurniture(furniture.kind);
      if (assetKey) root.add(this.scene.add.image(x, y, assetKey).setOrigin(0.5).setScale(1));
      const label = furnitureLabel(furniture.kind);
      if (label) root.add(this.scene.add.text(x, y + 10, label, {
        fontFamily: 'monospace', fontSize: '5px', color: '#2c2523', backgroundColor: '#e9d59c', padding: { x: 1, y: 0 },
      }).setOrigin(0.5, 0));
    }

    const roof = this.scene.add.container(0, 0);
    const roofGraphics = this.scene.add.graphics();
    const [roofDark, roofMain, roofLight] = roofColors[interior.id];
    roofGraphics.fillStyle(wallColors[interior.wall], 1).fillRect(roomX - 10, roomY + 34, roomWidth + 20, roomHeight - 34);
    roofGraphics.fillStyle(roofDark, 1).fillRect(roomX - 16, roomY - 12, roomWidth + 32, 28);
    roofGraphics.fillStyle(roofMain, 1).fillRect(roomX - 12, roomY + 16, roomWidth + 24, 42);
    roofGraphics.fillStyle(roofLight, 1).fillRect(roomX - 8, roomY + 58, roomWidth + 16, 14);
    roofGraphics.fillStyle(0x5b3b2c, 1).fillRect(roomX + roomWidth / 2 - 10, roomY + roomHeight - 24, 20, 24);
    roof.add(roofGraphics);
    root.add(roof);
    this.roof = roof;
    this.roofTween = this.scene.tweens.add({
      targets: roof, y: roof.y - 20, alpha: 0, duration: 220, ease: 'Stepped',
    });

    root.add(blocker);
    const closeBox = this.scene.add.rectangle(layout.x + layout.width - 22, layout.y + 18, 26, 20, 0x9d443d, 1)
      .setStrokeStyle(1, 0xffe0a0, 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    const closeText = this.scene.add.text(layout.x + layout.width - 22, layout.y + 18, '×', {
      fontFamily: 'monospace', fontSize: '13px', color: '#fff0bd', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    root.add([closeBox, closeText]);
  }

  close(): void {
    this.roofTween?.stop();
    if (this.roof) this.scene.tweens.killTweensOf(this.roof);
    this.root?.removeAll(true);
    this.root?.destroy();
    this.root = undefined;
    this.occupantLayer = undefined;
    this.roof = undefined;
    this.roofTween = undefined;
    this.statusText = undefined;
    this.openId = undefined;
    this.currentAssignments = [];
    this.assignmentSignature = '';
  }

  update(snapshots: readonly InteriorAgentSnapshot[]): void {
    if (!this.root || !this.openId) return;
    const building = this.world.buildings.find(({ id }) => id === this.openId);
    if (!building) return;
    const interior = INTERIOR_DEFINITIONS[building.themeId];
    const cycle = Math.floor(this.scene.time.now / CYCLE_MS);
    const cyclingSnapshots = snapshots.map((snapshot) => (
      snapshot.eventKind === 'web' || snapshot.action === 'terminal'
        ? { ...snapshot, eventId: `${snapshot.eventId}:cycle-${cycle}` }
        : snapshot
    ));
    const assignments = assignInteriorOccupants(interior, cyclingSnapshots);
    const signature = assignments.map(({ agentId, furnitureId, point, eventId }) => (
      `${agentId}:${furnitureId ?? `${point.x},${point.y}`}:${eventId}`
    )).join('|');
    if (signature === this.assignmentSignature) return;
    this.assignmentSignature = signature;
    this.currentAssignments = assignments;
    this.occupantLayer?.removeAll(true);
    this.occupantLayer?.destroy();
    const layer = this.scene.add.container(0, 0);
    this.occupantLayer = layer;
    this.root.add(layer);
    this.statusText?.setText(assignments.length === 0
      ? 'EMPTY HOUSE · 目前沒有 Agent'
      : `${assignments.length} AGENT${assignments.length === 1 ? '' : 'S'} INSIDE · LIVE`);
    if (assignments.length === 0) {
      layer.add(this.scene.add.text(WORLD_PIXELS.width / 2, this.roomOrigin.y + 92, '— EMPTY —', {
        fontFamily: 'monospace', fontSize: '9px', color: '#5a5148', backgroundColor: '#d9c490', padding: { x: 5, y: 2 },
      }).setOrigin(0.5));
      return;
    }
    assignments.forEach((assignment, index) => {
      const x = this.roomOrigin.x + assignment.point.x * ROOM_CELL + ROOM_CELL / 2;
      const y = this.roomOrigin.y + assignment.point.y * ROOM_CELL + ROOM_CELL / 2 + (assignment.seated ? 4 : 0);
      const skin = assignment.role === 'main' ? AGENT_SKINS.main : AGENT_SKINS.subagent;
      const sprite = this.scene.add.image(x, y, skin.sheet, agentFrameIndex(skin, assignment.facing))
        .setOrigin(0.5, 0.82).setDepth(CUTAWAY_DEPTH + 10 + index / 100);
      const icon = this.scene.add.text(x, y - 19, actionSymbols[assignment.icon], {
        fontFamily: 'monospace', fontSize: '7px', color: '#fff4c2', backgroundColor: '#315348', padding: { x: 2, y: 1 },
      }).setOrigin(0.5).setDepth(CUTAWAY_DEPTH + 20);
      const name = this.scene.add.text(x, y + 8, assignment.agentId, {
        fontFamily: 'monospace', fontSize: '5px', color: '#fff4c2', backgroundColor: '#41342f', padding: { x: 1, y: 0 },
      }).setOrigin(0.5, 0).setDepth(CUTAWAY_DEPTH + 20);
      layer.add([sprite, icon, name]);
    });
  }

  destroy(): void {
    this.close();
    this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
  }

  isOpen(): boolean { return this.root !== undefined; }
  openBuildingId(): string | undefined { return this.openId; }
  occupants(): readonly InteriorOccupantAssignment[] { return this.currentAssignments.map((item) => ({ ...item, point: { ...item.point } })); }
}

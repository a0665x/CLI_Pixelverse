import type Phaser from 'phaser';
import { WORLD_PIXELS } from '../game/constants';
import type {
  AgentAction,
  FurnitureDefinition,
  FurnitureKind,
  FurnitureScale,
  GridPoint,
  InteriorDefinition,
  WorldDefinition,
} from '../world/types';
import { INTERIOR_DEFINITIONS } from '../world/interiorDefinitions';
import { CUTAWAY_OPEN_EVENT } from '../ui/TestPanel';
import { AGENT_SKINS, agentFrameIndex } from './assetManifest';
import { agentAnimationFrame } from './agentAnimation';
import { modernOfficeAsset, type ModernOfficeFurnitureKind } from './modernOfficeManifest';
import {
  assignInteriorOccupants,
  type InteriorAgentSnapshot,
  type InteriorOccupantAssignment,
} from './interiorAssignment';
import { interiorMotionAt } from './interiorMotion';
import {
  FURNITURE_PALETTE,
  FURNITURE_SCALES,
  addFurniture,
  furnitureCells,
  loadInteriorLayout,
  moveFurniture,
  normalizeFurnitureScale,
  placementDiagnostic,
  resizeFurniture,
  saveInteriorLayout,
} from './interiorLayoutEditor';

const ROOM_CELL = 22;
const CUTAWAY_DEPTH = 100_000;

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
  sofa: 'SOFA', chair: 'CHAIR', television: 'TV', bed: 'BED', bookcase: 'BOOKS', computer: 'PC',
  'map-table': 'MAP', 'planning-board': 'PLAN', 'reading-desk': 'READ', workbench: 'BENCH',
  'tool-wall': 'TOOLS', 'repair-table': 'REPAIR', 'dispatch-pod': 'CLONE',
  'radio-console': 'RADIO', 'response-desk': 'SEND', 'meeting-table': 'MEET', decor: '',
  'office-chair': 'CHAIR', display: 'DISPLAY', desk: 'DESK', cabinet: 'CABINET', plant: 'PLANT',
  'beverage-station': 'DRINK', printer: 'PRINT',
})[kind];

const hookActionLabels: Record<AgentAction, string> = {
  arrive: '抵達', ponder: '思考', plan: '規劃', read: '查閱', type: '編輯', terminal: '工具調用',
  signal: 'WEB / MCP', dispatch: '分派 AGENT', respond: '回覆', queue: '等待', repair: '修復',
  rest: '休息', offline: '離線', pulse: '心跳',
};

export const hookFurnitureLabel = (furniture: FurnitureDefinition): string => (
  [...new Set(furniture.supportedActions.map((action) => hookActionLabels[action]))].join(' / ')
);

const placementMessage = (diagnostic: ReturnType<typeof placementDiagnostic>): string => ({
  valid: '可放置',
  'outside-room': '超出房間範圍',
  'blocks-door': '不能擋住房門',
  overlap: '會與其他家具重疊',
})[diagnostic];

export function modernOfficeKindForFurniture(kind: FurnitureKind): ModernOfficeFurnitureKind {
  const aliases: Record<FurnitureKind, ModernOfficeFurnitureKind> = {
    sofa: 'sofa', bed: 'sofa', chair: 'office-chair', 'office-chair': 'office-chair',
    television: 'display', display: 'display', computer: 'computer', 'dispatch-pod': 'computer',
    'radio-console': 'computer', bookcase: 'bookcase', 'planning-board': 'whiteboard',
    'map-table': 'meeting-table', 'meeting-table': 'meeting-table',
    'reading-desk': 'desk', workbench: 'desk', 'repair-table': 'desk', 'response-desk': 'desk', desk: 'desk',
    'tool-wall': 'cabinet', cabinet: 'cabinet', decor: 'plant', plant: 'plant',
    'beverage-station': 'beverage-station', printer: 'printer',
  };
  return aliases[kind];
}

export class InteriorCutawaySystem {
  private root: Phaser.GameObjects.Container | undefined;
  private occupantLayer: Phaser.GameObjects.Container | undefined;
  private roof: Phaser.GameObjects.Container | undefined;
  private roofTween: Phaser.Tweens.Tween | undefined;
  private statusText: Phaser.GameObjects.Text | undefined;
  private furnitureLayer: Phaser.GameObjects.Container | undefined;
  private paletteLayer: Phaser.GameObjects.Container | undefined;
  private selectedFurnitureId: string | undefined;
  private lastFurnitureTap: { id: string; at: number } | undefined;
  private activeInterior: InteriorDefinition | undefined;
  private editMode = false;
  private openId: string | undefined;
  private currentAssignments: InteriorOccupantAssignment[] = [];
  private assignmentSignature = '';
  private roomOrigin: GridPoint = { x: 0, y: 0 };
  private readonly occupantViews = new Map<string, {
    sprite: Phaser.GameObjects.Image;
    icon: Phaser.GameObjects.Text;
    bubble: Phaser.GameObjects.Text;
    name: Phaser.GameObjects.Text;
  }>();
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
    const definition = INTERIOR_DEFINITIONS[building.themeId];
    this.close();
    this.openId = buildingId;
    this.activeInterior = {
      ...definition,
      furniture: loadInteriorLayout(buildingId, definition),
      overflow: definition.overflow.map((point) => ({ ...point })),
    };
    const interior = this.activeInterior;
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
    ).setStrokeStyle(3, 0xf1d89a, 1).setInteractive().on('pointerdown', (...args: unknown[]) => {
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

    this.renderFurniture(interior, layout);

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

    const editButton = this.scene.add.text(layout.x + layout.width - 185, layout.y + 12, '移動家具', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#fff4c2', backgroundColor: '#315348', padding: { x: 6, y: 3 },
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      this.editMode = !this.editMode;
      editButton.setText(this.editMode ? '完成移動' : '移動家具');
      this.statusText?.setText(this.editMode ? '編輯模式 · 拖曳家具或下方素材到房間' : '家具配置已暫存，按儲存保存');
      if (this.activeInterior) this.renderFurniture(this.activeInterior, layout);
    });
    const saveButton = this.scene.add.text(layout.x + layout.width - 105, layout.y + 12, '儲存配置', {
      fontFamily: 'sans-serif', fontSize: '9px', color: '#fff4c2', backgroundColor: '#6b5734', padding: { x: 6, y: 3 },
    }).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
      if (this.openId && this.activeInterior) saveInteriorLayout(this.openId, this.activeInterior.furniture);
      this.statusText?.setText('✓ 家具配置已保存');
    });
    const closeBox = this.scene.add.rectangle(layout.x + layout.width - 22, layout.y + 18, 26, 20, 0x9d443d, 1)
      .setStrokeStyle(1, 0xffe0a0, 1).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    const closeText = this.scene.add.text(layout.x + layout.width - 22, layout.y + 18, '×', {
      fontFamily: 'monospace', fontSize: '13px', color: '#fff0bd', fontStyle: 'bold',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => this.close());
    root.add([editButton, saveButton, closeBox, closeText]);
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
    this.furnitureLayer = undefined;
    this.paletteLayer = undefined;
    this.selectedFurnitureId = undefined;
    this.lastFurnitureTap = undefined;
    this.activeInterior = undefined;
    this.editMode = false;
    this.openId = undefined;
    this.currentAssignments = [];
    this.assignmentSignature = '';
    this.occupantViews.clear();
  }

  update(snapshots: readonly InteriorAgentSnapshot[]): void {
    if (!this.root || !this.openId) return;
    const building = this.world.buildings.find(({ id }) => id === this.openId);
    if (!building) return;
    const interior = this.activeInterior ?? INTERIOR_DEFINITIONS[building.themeId];
    const matchingSnapshots = snapshots.filter(({ buildingId }) => buildingId === building.id);
    const assignments = assignInteriorOccupants(interior, matchingSnapshots, building.id);
    const signature = assignments.map(({ agentId, furnitureId, point, eventId }) => (
      `${agentId}:${furnitureId ?? `${point.x},${point.y}`}:${eventId}`
    )).join('|');
    if (signature !== this.assignmentSignature) {
      this.assignmentSignature = signature;
      this.currentAssignments = assignments;
      this.occupantLayer?.removeAll(true);
      this.occupantLayer?.destroy();
      this.occupantViews.clear();
      const layer = this.scene.add.container(0, 0);
      this.occupantLayer = layer;
      this.root.add(layer);
      this.statusText?.setText(assignments.length === 0
        ? 'EMPTY HOUSE · 目前沒有 Agent'
        : `${assignments.length} AGENT${assignments.length === 1 ? '' : 'S'} INSIDE · LIVE`);
      if (assignments.length === 0) {
        layer.add(this.scene.add.text(WORLD_PIXELS.width / 2, this.roomOrigin.y + 92, '— EMPTY —', {
          fontFamily: 'sans-serif', fontSize: '10px', color: '#5a5148', backgroundColor: '#d9c490', padding: { x: 5, y: 2 },
        }).setOrigin(0.5));
        return;
      }
      assignments.forEach((assignment, index) => {
        const snapshot = matchingSnapshots.find(({ agentId }) => agentId === assignment.agentId) ?? assignment;
        const motion = interiorMotionAt(snapshot, interior, assignment, this.scene.time.now);
        const skin = assignment.role === 'main' ? AGENT_SKINS.main : AGENT_SKINS.subagent;
        const sprite = this.scene.add.image(0, 0, skin.sheet, agentFrameIndex(skin, motion.facing))
          .setOrigin(0.5, 0.82).setDepth(CUTAWAY_DEPTH + 10 + index / 100)
          .setScale('renderScale' in skin ? skin.renderScale : 1.35);
        const icon = this.scene.add.text(0, 0, actionSymbols[assignment.icon], {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#fff4c2', backgroundColor: '#315348', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(CUTAWAY_DEPTH + 20);
        const bubble = this.scene.add.text(0, 0, motion.bubbleText, {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#263323', backgroundColor: '#fff5c7', padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 1).setDepth(CUTAWAY_DEPTH + 21);
        const name = this.scene.add.text(0, 0, assignment.agentId, {
          fontFamily: 'sans-serif', fontSize: '6px', color: '#fff4c2', backgroundColor: '#41342f', padding: { x: 2, y: 1 },
        }).setOrigin(0.5, 0).setDepth(CUTAWAY_DEPTH + 20);
        this.occupantViews.set(assignment.agentId, { sprite, icon, bubble, name });
        layer.add([sprite, icon, bubble, name]);
      });
    }

    assignments.forEach((assignment) => {
      const snapshot = matchingSnapshots.find(({ agentId }) => agentId === assignment.agentId) ?? assignment;
      const motion = interiorMotionAt(snapshot, interior, assignment, this.scene.time.now);
      const view = this.occupantViews.get(assignment.agentId);
      if (!view) return;
      const skin = assignment.role === 'main' ? AGENT_SKINS.main : AGENT_SKINS.subagent;
      const frame = 'animation' in skin && skin.animation === 'adam-16x32'
        ? agentAnimationFrame(motion.facing, motion.walking, this.scene.time.now)
        : agentFrameIndex(skin, motion.facing);
      view.sprite.setTexture(skin.sheet, frame);
      const x = this.roomOrigin.x + motion.point.x * ROOM_CELL + ROOM_CELL / 2;
      const y = this.roomOrigin.y + motion.point.y * ROOM_CELL + ROOM_CELL / 2
        + (assignment.seated && motion.phase === 'working' ? 4 : 0) + motion.bob;
      view.sprite.setPosition(x, y);
      view.icon.setPosition(x, y - 21);
      view.bubble.setPosition(x, y - 31).setText(motion.bubbleText);
      view.name.setPosition(x, y + 9);
    });
  }

  destroy(): void {
    this.close();
    this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
  }

  isOpen(): boolean { return this.root !== undefined; }
  openBuildingId(): string | undefined { return this.openId; }
  occupants(): readonly InteriorOccupantAssignment[] { return this.currentAssignments.map((item) => ({ ...item, point: { ...item.point } })); }

  private renderFurniture(interior: InteriorDefinition, layout: CutawayLayout): void {
    this.furnitureLayer?.removeAll(true);
    this.furnitureLayer?.destroy();
    this.paletteLayer?.removeAll(true);
    this.paletteLayer?.destroy();
    if (!this.root) return;
    const furnitureLayer = this.scene.add.container(0, 0);
    this.furnitureLayer = furnitureLayer;
    this.root.add(furnitureLayer);
    const placementPreview = this.scene.add.graphics();
    furnitureLayer.add(placementPreview);

    const drawPlacementPreview = (candidate: FurnitureDefinition, ignoreId?: string): ReturnType<typeof placementDiagnostic> => {
      placementPreview.clear();
      const diagnostic = placementDiagnostic(interior, candidate, interior.furniture, ignoreId);
      placementPreview.fillStyle(diagnostic === 'valid' ? 0x65d47e : 0xe05b54, 0.42);
      for (const cell of furnitureCells(candidate)) {
        placementPreview.fillRect(
          this.roomOrigin.x + cell.x * ROOM_CELL + 1,
          this.roomOrigin.y + cell.y * ROOM_CELL + 1,
          ROOM_CELL - 2,
          ROOM_CELL - 2,
        );
      }
      return diagnostic;
    };

    for (const furniture of interior.furniture) {
      const x = this.roomOrigin.x + furniture.point.x * ROOM_CELL + ROOM_CELL / 2;
      const y = this.roomOrigin.y + furniture.point.y * ROOM_CELL + ROOM_CELL / 2;
      const assetKey = modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const sprite = this.scene.add.image(x, y, assetKey).setOrigin(0.5).setScale(normalizeFurnitureScale(furniture.scale));
      furnitureLayer.add(sprite);
      const label = hookFurnitureLabel(furniture);
      const labelView = label ? this.scene.add.text(x, y + (furniture.kind === 'bed' ? 28 : 21), label, {
        fontFamily: 'Arial, Noto Sans TC, sans-serif', fontSize: '9px', color: '#241f1c',
        backgroundColor: '#fff0b8', padding: { x: 3, y: 1 },
      }).setOrigin(0.5, 0).setResolution(Math.max(2, typeof window === 'undefined' ? 2 : window.devicePixelRatio)) : undefined;
      if (labelView) furnitureLayer.add(labelView);
      if (!this.editMode) continue;
      sprite.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(sprite);
      sprite.on('pointerdown', () => {
        const now = this.scene.time.now;
        if (this.lastFurnitureTap?.id === furniture.id && now - this.lastFurnitureTap.at <= 320) {
          this.selectedFurnitureId = furniture.id;
          this.lastFurnitureTap = undefined;
          this.renderFurniture(interior, layout);
          return;
        }
        this.lastFurnitureTap = { id: furniture.id, at: now };
      });
      sprite.on('drag', (_pointer: unknown, dragX: number, dragY: number) => {
        sprite.setPosition(dragX, dragY);
        labelView?.setPosition(dragX, dragY + (furniture.kind === 'bed' ? 28 : 21));
        const point = this.roomPoint(dragX, dragY);
        drawPlacementPreview({ ...furniture, point }, furniture.id);
      });
      sprite.on('dragend', () => {
        const point = this.roomPoint(sprite.x, sprite.y);
        const diagnostic = placementDiagnostic(interior, { ...furniture, point }, interior.furniture, furniture.id);
        const moved = moveFurniture(interior, interior.furniture, furniture.id, point);
        const accepted = diagnostic === 'valid';
        if (accepted) interior.furniture = moved;
        this.statusText?.setText(accepted ? '家具已移動 · 按儲存配置' : `⚠ ${placementMessage(diagnostic)} · 已回復原位`);
        this.renderFurniture(interior, layout);
      });
    }

    if (!this.editMode) return;
    const palette = this.scene.add.container(0, 0);
    this.paletteLayer = palette;
    this.root.add(palette);
    const startX = layout.x + 42;
    const paletteY = layout.y + layout.height - 18;
    palette.add(this.scene.add.text(layout.x + 10, paletteY - 5, '家具', {
      fontFamily: 'sans-serif', fontSize: '8px', color: '#ffe9ab',
    }).setOrigin(0, 0.5));
    FURNITURE_PALETTE.forEach((kind, index) => {
      const x = startX + index * 30;
      const assetKey = modernOfficeAsset(modernOfficeKindForFurniture(kind)).key;
      const item = this.scene.add.image(x, paletteY, assetKey).setOrigin(0.5).setScale(0.65);
      item.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(item);
      let dragClone: Phaser.GameObjects.Image | undefined;
      item.on('dragstart', () => {
        dragClone = this.scene.add.image(item.x, item.y, assetKey).setOrigin(0.5).setScale(1).setAlpha(0.88);
        furnitureLayer.add(dragClone);
      });
      item.on('drag', (_pointer: unknown, dragX: number, dragY: number) => {
        if (!dragClone) {
          dragClone = this.scene.add.image(dragX, dragY, assetKey).setOrigin(0.5).setScale(1).setAlpha(0.88);
          furnitureLayer.add(dragClone);
        }
        dragClone.setPosition(dragX, dragY);
        const point = this.roomPoint(dragX, dragY);
        const preview: FurnitureDefinition = {
          id: '__palette-preview__', kind, point, facing: 'up', supportedActions: [], icon: 'generic', scale: 1,
        };
        drawPlacementPreview(preview);
      });
      item.on('dragend', (_pointer: unknown, dragX?: number, dragY?: number) => {
        const dropX = Number.isFinite(dragX) ? dragX as number : dragClone?.x ?? item.x;
        const dropY = Number.isFinite(dragY) ? dragY as number : dragClone?.y ?? item.y;
        const point = this.roomPoint(dropX, dropY);
        const added = addFurniture(interior, interior.furniture, kind, point);
        const accepted = added.length > interior.furniture.length;
        if (accepted) interior.furniture = added;
        this.statusText?.setText(accepted ? `${furnitureLabel(kind)} 已加入 · 按儲存配置` : '⚠ 放置位置超界或與家具重疊');
        dragClone?.destroy();
        dragClone = undefined;
        this.renderFurniture(interior, layout);
      });
      palette.add(item);
    });

    const selected = interior.furniture.find(({ id }) => id === this.selectedFurnitureId);
    if (selected) {
      const scale = normalizeFurnitureScale(selected.scale);
      const index = FURNITURE_SCALES.indexOf(scale);
      const inspectorX = layout.x + layout.width / 2;
      const inspectorY = layout.y + layout.height - 42;
      const title = this.scene.add.text(inspectorX - 65, inspectorY, `尺寸 ${Math.round(scale * 100)}%`, {
        fontFamily: 'Arial, Noto Sans TC, sans-serif', fontSize: '10px', color: '#fff4c2',
        backgroundColor: '#263a35', padding: { x: 5, y: 3 },
      }).setOrigin(0.5).setResolution(Math.max(2, typeof window === 'undefined' ? 2 : window.devicePixelRatio));
      const resize = (direction: -1 | 1): void => {
        const nextScale = FURNITURE_SCALES[index + direction] as FurnitureScale | undefined;
        if (!nextScale) return;
        const resized = resizeFurniture(interior, interior.furniture, selected.id, nextScale);
        const accepted = normalizeFurnitureScale(resized.find(({ id }) => id === selected.id)?.scale) === nextScale;
        if (accepted) interior.furniture = resized;
        this.statusText?.setText(accepted ? `家具尺寸 ${Math.round(nextScale * 100)}% · 按儲存配置` : '⚠ 放大後會超界、擋門或重疊');
        this.renderFurniture(interior, layout);
      };
      const minus = this.scene.add.text(inspectorX + 10, inspectorY, '－', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#fff4c2', backgroundColor: '#755044', padding: { x: 7, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => resize(-1));
      const plus = this.scene.add.text(inspectorX + 43, inspectorY, '＋', {
        fontFamily: 'sans-serif', fontSize: '12px', color: '#fff4c2', backgroundColor: '#315348', padding: { x: 7, y: 2 },
      }).setOrigin(0.5).setInteractive({ useHandCursor: true }).on('pointerdown', () => resize(1));
      palette.add([title, minus, plus]);
    }
  }

  private roomPoint(x: number, y: number): GridPoint {
    return {
      x: Math.round((x - this.roomOrigin.x - ROOM_CELL / 2) / ROOM_CELL),
      y: Math.round((y - this.roomOrigin.y - ROOM_CELL / 2) / ROOM_CELL),
    };
  }
}

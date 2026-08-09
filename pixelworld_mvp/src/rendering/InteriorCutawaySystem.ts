import type Phaser from 'phaser';
import { WORLD_PIXELS } from '../game/constants';
import type {
  AgentAction,
  FurnitureDefinition,
  FurnitureKind,
  FurnitureScale,
  FurnitureRotation,
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
  catalogPage,
  MODERN_OFFICE_CATALOG,
  type ModernOfficeCategory,
} from './modernOfficeCatalog';
import { InteriorCutawayDomOverlay, type CutawayRoomLabel } from './InteriorCutawayDomOverlay';
import {
  EDITOR_CELL,
  commitPlacementCandidate,
  effectiveFurnitureFootprint,
  resolvePlacementCandidate,
  type PlacementCandidate,
} from './interiorPlacement';
import {
  assignInteriorOccupants,
  type InteriorAgentSnapshot,
  type InteriorOccupantAssignment,
} from './interiorAssignment';
import { interiorMotionAt } from './interiorMotion';
import {
  FURNITURE_SCALES,
  loadInteriorLayout,
  normalizeFurnitureScale,
  resizeFurniture,
  rotateFurniture,
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
  const height = wide ? 330 : 360;
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

const placementMessage = (diagnostic: PlacementCandidate['diagnostic']): string => ({
  valid: '可放置',
  'outside-room': '超出房間範圍',
  'blocks-door': '不能擋住房門',
  overlap: '會與其他家具重疊',
  'invalid-asset': '素材資料不完整',
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
  private furnitureLayer: Phaser.GameObjects.Container | undefined;
  private paletteLayer: Phaser.GameObjects.Container | undefined;
  private selectedFurnitureId: string | undefined;
  private activeInterior: InteriorDefinition | undefined;
  private editMode = false;
  private openId: string | undefined;
  private currentAssignments: InteriorOccupantAssignment[] = [];
  private assignmentSignature = '';
  private roomOrigin: GridPoint = { x: 0, y: 0 };
  private currentDragCandidate: PlacementCandidate | undefined;
  private catalogCategory: ModernOfficeCategory = 'workstations';
  private catalogPageIndex = 0;
  private readonly domOverlay: InteriorCutawayDomOverlay;
  private statusMessage = '';
  private furnitureDomLabels: CutawayRoomLabel[] = [];
  private occupantDomLabels: CutawayRoomLabel[] = [];
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
    this.domOverlay = new InteriorCutawayDomOverlay(() => {
      const canvas = this.scene.game?.canvas;
      return canvas?.getBoundingClientRect();
    });
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

    const roomWidth = interior.width * ROOM_CELL;
    const roomHeight = interior.height * ROOM_CELL;
    const roomX = Math.round(layout.x + (layout.width - roomWidth) / 2);
    const roomY = Math.round(layout.y + 52);
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

    this.statusMessage = 'EMPTY · 點擊關閉或按 ESC';
    this.domOverlay.open(layout, this.overlayModel(), {
      close: () => this.close(),
      toggleEdit: () => {
        this.editMode = !this.editMode;
        this.setStatus(this.editMode ? '編輯模式 · 拖曳家具或下方素材到房間' : '家具配置已暫存，按儲存保存');
        if (this.activeInterior) this.renderFurniture(this.activeInterior, layout);
      },
      save: () => {
        if (this.openId && this.activeInterior) saveInteriorLayout(this.openId, this.activeInterior.furniture);
        this.setStatus('✓ 家具配置已保存，下次開啟仍會保留');
      },
      category: (category) => {
        this.catalogCategory = category;
        this.catalogPageIndex = 0;
        if (this.activeInterior) this.renderFurniture(this.activeInterior, layout);
      },
      page: (delta) => {
        const total = catalogPage(this.catalogCategory, this.catalogPageIndex).totalPages;
        this.catalogPageIndex = Math.max(0, Math.min(total - 1, this.catalogPageIndex + delta));
        if (this.activeInterior) this.renderFurniture(this.activeInterior, layout);
      },
      resize: (delta) => this.resizeSelected(interior, layout, delta),
      rotate: (delta) => this.rotateSelected(interior, layout, delta),
    });
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
    this.domOverlay.close();
    this.furnitureLayer = undefined;
    this.paletteLayer = undefined;
    this.selectedFurnitureId = undefined;
    this.activeInterior = undefined;
    this.editMode = false;
    this.openId = undefined;
    this.currentAssignments = [];
    this.assignmentSignature = '';
    this.currentDragCandidate = undefined;
    this.statusMessage = '';
    this.furnitureDomLabels = [];
    this.occupantDomLabels = [];
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
      this.setStatus(assignments.length === 0
        ? 'EMPTY HOUSE · 目前沒有 Agent'
        : `${assignments.length} AGENT${assignments.length === 1 ? '' : 'S'} INSIDE · LIVE`);
      if (assignments.length === 0) {
        this.occupantDomLabels = [];
        this.syncRoomLabels();
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
        icon.setVisible(false);
        bubble.setVisible(false);
        name.setVisible(false);
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
    this.occupantDomLabels = assignments.map((assignment) => {
      const snapshot = matchingSnapshots.find(({ agentId }) => agentId === assignment.agentId) ?? assignment;
      const motion = interiorMotionAt(snapshot, interior, assignment, this.scene.time.now);
      return {
        id: `agent:${assignment.agentId}`,
        text: `${actionSymbols[assignment.icon]} ${motion.bubbleText}\n${assignment.agentId}`,
        x: this.roomOrigin.x + motion.point.x * ROOM_CELL + ROOM_CELL / 2,
        y: this.roomOrigin.y + motion.point.y * ROOM_CELL - 2,
        kind: 'agent' as const,
      };
    });
    this.syncRoomLabels();
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

    if (this.editMode) {
      const grid = this.scene.add.graphics().lineStyle(1, 0xf5deb0, 0.15);
      for (let x = 0; x <= interior.width * 2; x += 1) {
        grid.lineBetween(this.roomOrigin.x + x * EDITOR_CELL, this.roomOrigin.y,
          this.roomOrigin.x + x * EDITOR_CELL, this.roomOrigin.y + interior.height * ROOM_CELL);
      }
      for (let y = 0; y <= interior.height * 2; y += 1) {
        grid.lineBetween(this.roomOrigin.x, this.roomOrigin.y + y * EDITOR_CELL,
          this.roomOrigin.x + interior.width * ROOM_CELL, this.roomOrigin.y + y * EDITOR_CELL);
      }
      furnitureLayer.add(grid);
    }

    const drawPlacementPreview = (candidate: PlacementCandidate): void => {
      placementPreview.clear();
      placementPreview.fillStyle(candidate.diagnostic === 'valid' ? 0x65d47e : 0xe05b54, 0.42);
      for (const cell of candidate.fineCells) {
        placementPreview.fillRect(
          this.roomOrigin.x + cell.x * EDITOR_CELL + 0.5,
          this.roomOrigin.y + cell.y * EDITOR_CELL + 0.5,
          EDITOR_CELL - 1,
          EDITOR_CELL - 1,
        );
      }
    };

    for (const furniture of interior.furniture) {
      const x = this.roomOrigin.x + furniture.point.x * ROOM_CELL + ROOM_CELL / 2;
      const y = this.roomOrigin.y + furniture.point.y * ROOM_CELL + ROOM_CELL / 2;
      const catalog = MODERN_OFFICE_CATALOG.find(({ id }) => id === furniture.assetId);
      const assetKey = catalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const originX = catalog ? (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32 : 0.5;
      const originY = catalog ? (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48 : 0.5;
      const sprite = this.scene.add.image(x, y, assetKey).setOrigin(originX, originY)
        .setScale(normalizeFurnitureScale(furniture.scale)).setAngle(furniture.rotation ?? 0);
      furnitureLayer.add(sprite);
      if (!this.editMode) continue;
      sprite.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(sprite);
      sprite.on('pointerdown', () => {
        this.selectedFurnitureId = furniture.id;
        this.syncOverlay();
      });
      sprite.on('drag', (_pointer: unknown, dragX: number, dragY: number) => {
        sprite.setPosition(dragX, dragY);
        this.currentDragCandidate = resolvePlacementCandidate(
          interior, interior.furniture, furniture, this.roomPoint(dragX, dragY), furniture.id,
        );
        drawPlacementPreview(this.currentDragCandidate);
      });
      sprite.on('dragend', () => {
        const candidate = this.currentDragCandidate;
        const accepted = candidate?.diagnostic === 'valid';
        if (candidate) interior.furniture = commitPlacementCandidate(interior, interior.furniture, candidate);
        this.setStatus(accepted ? '家具已移動 · 按儲存配置' : `⚠ ${placementMessage(candidate?.diagnostic ?? 'outside-room')} · 已回復原位`);
        this.currentDragCandidate = undefined;
        this.renderFurniture(interior, layout);
      });
    }

    const contextualFurnitureIds = new Set([
      this.selectedFurnitureId,
      ...this.currentAssignments.map(({ furnitureId }) => furnitureId),
    ].filter((id): id is string => Boolean(id)));
    this.furnitureDomLabels = interior.furniture.flatMap((furniture): CutawayRoomLabel[] => {
      const label = hookFurnitureLabel(furniture);
      if (!label || !contextualFurnitureIds.has(furniture.id)) return [];
      return [{
        id: `hook:${furniture.id}`, text: label,
        x: this.roomOrigin.x + furniture.point.x * ROOM_CELL + ROOM_CELL / 2,
        y: this.roomOrigin.y + furniture.point.y * ROOM_CELL + ROOM_CELL / 2 + 18,
        kind: 'hook',
      }];
    });
    this.syncRoomLabels();

    if (!this.editMode) return;
    const palette = this.scene.add.container(0, 0);
    this.paletteLayer = palette;
    this.root.add(palette);
    const page = catalogPage(this.catalogCategory, this.catalogPageIndex);
    const startX = layout.x + (layout.width - 12 * 34) / 2 + 17;
    page.items.forEach((catalog, index) => {
      const x = startX + (index % 12) * 34;
      const y = layout.y + layout.height - 42 + Math.floor(index / 12) * 24;
      const originX = (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32;
      const originY = (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48;
      const item = this.scene.add.image(x, y, catalog.key).setOrigin(originX, originY).setScale(0.68);
      item.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(item);
      let dragClone: Phaser.GameObjects.Image | undefined;
      item.on('dragstart', () => {
        dragClone = this.scene.add.image(item.x, item.y, catalog.key).setOrigin(originX, originY).setScale(1).setAlpha(0.88);
        furnitureLayer.add(dragClone);
      });
      item.on('drag', (_pointer: unknown, dragX: number, dragY: number) => {
        if (!dragClone) {
          dragClone = this.scene.add.image(dragX, dragY, catalog.key).setOrigin(originX, originY).setScale(1).setAlpha(0.88);
          furnitureLayer.add(dragClone);
        }
        dragClone.setPosition(dragX, dragY);
        const preview: FurnitureDefinition = {
          id: `custom-office-${catalog.id}-${Date.now()}`, kind: 'decor', point: this.roomPoint(dragX, dragY),
          facing: 'up', supportedActions: [], icon: 'generic', scale: 1, rotation: 0,
          assetId: catalog.id, footprint: { ...catalog.footprint },
        };
        this.currentDragCandidate = resolvePlacementCandidate(interior, interior.furniture, preview, preview.point);
        drawPlacementPreview(this.currentDragCandidate);
      });
      item.on('dragend', () => {
        const candidate = this.currentDragCandidate;
        const accepted = candidate?.diagnostic === 'valid';
        if (candidate) interior.furniture = commitPlacementCandidate(interior, interior.furniture, candidate);
        this.setStatus(accepted ? `${catalog.label} 已加入 · 按儲存配置` : `⚠ ${placementMessage(candidate?.diagnostic ?? 'outside-room')}`);
        dragClone?.destroy();
        dragClone = undefined;
        this.currentDragCandidate = undefined;
        this.renderFurniture(interior, layout);
      });
      palette.add(item);
    });
    this.syncOverlay();
  }

  private roomPoint(x: number, y: number): GridPoint {
    return {
      x: (x - this.roomOrigin.x) / ROOM_CELL - 0.5,
      y: (y - this.roomOrigin.y) / ROOM_CELL - 0.5,
    };
  }

  private overlayModel() {
    const page = catalogPage(this.catalogCategory, this.catalogPageIndex);
    const selected = this.activeInterior?.furniture.find(({ id }) => id === this.selectedFurnitureId);
    const catalog = selected ? MODERN_OFFICE_CATALOG.find(({ id }) => id === selected.assetId) : undefined;
    return {
      title: this.activeInterior?.label ?? '', status: this.statusMessage, editMode: this.editMode,
      category: this.catalogCategory, page: page.page, totalPages: page.totalPages,
      ...(selected ? { selected: {
        label: hookFurnitureLabel(selected) || catalog?.label || furnitureLabel(selected.kind),
        scale: normalizeFurnitureScale(selected.scale), rotation: selected.rotation ?? 0,
      } } : {}),
    };
  }

  private syncOverlay(): void { this.domOverlay.update(this.overlayModel()); }
  private setStatus(message: string): void {
    this.statusMessage = message;
    this.domOverlay.update(this.overlayModel());
  }

  private syncRoomLabels(): void {
    this.domOverlay.setRoomLabels([...this.furnitureDomLabels, ...this.occupantDomLabels]);
  }

  private resizeSelected(interior: InteriorDefinition, layout: CutawayLayout, direction: -1 | 1): void {
    const selected = interior.furniture.find(({ id }) => id === this.selectedFurnitureId);
    if (!selected) return;
    const scale = normalizeFurnitureScale(selected.scale);
    const nextScale = FURNITURE_SCALES[FURNITURE_SCALES.indexOf(scale) + direction] as FurnitureScale | undefined;
    if (!nextScale) return;
    const resized = resizeFurniture(interior, interior.furniture, selected.id, nextScale);
    const accepted = normalizeFurnitureScale(resized.find(({ id }) => id === selected.id)?.scale) === nextScale;
    if (accepted) interior.furniture = resized;
    this.setStatus(accepted ? `家具尺寸 ${Math.round(nextScale * 100)}% · 按儲存配置` : '⚠ 放大後會超界、擋門或重疊');
    this.renderFurniture(interior, layout);
  }

  private rotateSelected(interior: InteriorDefinition, layout: CutawayLayout, delta: -90 | 90): void {
    const selected = interior.furniture.find(({ id }) => id === this.selectedFurnitureId);
    if (!selected) return;
    const next = (((selected.rotation ?? 0) + delta + 360) % 360) as FurnitureRotation;
    const rotated = rotateFurniture(interior, interior.furniture, selected.id, next);
    const accepted = rotated.find(({ id }) => id === selected.id)?.rotation === next;
    if (accepted) interior.furniture = rotated;
    this.setStatus(accepted ? `家具已旋轉至 ${next}° · 按儲存配置` : '⚠ 旋轉後會超界、擋門或重疊');
    this.renderFurniture(interior, layout);
  }
}

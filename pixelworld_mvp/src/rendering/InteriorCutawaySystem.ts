import type Phaser from 'phaser';
import { WORLD_PIXELS } from '../game/constants';
import type {
  AgentAction,
  FurnitureDefinition,
  FurnitureKind,
  FurnitureScale,
  FurnitureRotation,
  FurnitureLayer,
  FurniturePrefab,
  GridPoint,
  InteriorDefinition,
  InteriorLayoutClipboard,
  OfficePrefabDefinition,
  WorldDefinition,
} from '../world/types';
import { interiorDefinitionForBuilding } from '../world/interiorDefinitions';
import { CUTAWAY_OPEN_EVENT } from '../ui/TestPanel';
import { AGENT_SKINS, agentFrameIndex } from './assetManifest';
import { agentAnimationFrame } from './agentAnimation';
import { modernOfficeAsset, type ModernOfficeFurnitureKind } from './modernOfficeManifest';
import {
  catalogPage,
  MODERN_OFFICE_CATALOG,
  type ModernOfficeCategory,
} from './modernOfficeCatalog';
import {
  InteriorCutawayDomOverlay,
  selectionCapabilities,
  type CutawayRoomLabel,
} from './InteriorCutawayDomOverlay';
import type { VillageLocale } from '../i18n/villageLocale';
import {
  commitPlacementCandidate,
  resolvePlacementCandidate,
  resolvedFurnitureAsset,
  snapFurniturePoint,
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
  readInteriorLayout,
  normalizeFurnitureScale,
  resizeFurniture,
  saveInteriorLayout,
  collectAllFurniture,
  requiredHookInventory,
  reorderFurniture,
} from './interiorLayoutEditor';
import {
  createFurniturePrefab,
  duplicateFurniture,
  removeSelection,
  selectedFurnitureIds,
  transformSelectionAtomically,
} from './interiorSelection';
import {
  copyDecorativeLayout,
  isBuiltInPrefab,
  pasteDecorativeLayout,
  readAvailablePrefabs,
  readLayoutClipboard,
  saveLayoutClipboard,
  savePrefabs,
  upsertPrefab,
} from './interiorPrefabStore';
import { officeLayoutIssues, placeOfficePrefab } from './prefabGeometry';
import {
  cloneFurnitureLayout,
  dissolvePrefabInstance,
  InteriorUndoStore,
} from './interiorUndoStore';

const BASE_ROOM_CELL = 22;
const MIN_ROOM_CELL = 12;
const ROOM_CONTENT_TOP = 52;
const ROOM_CONTENT_BOTTOM = 58;
const CUTAWAY_DEPTH = 100_000;
const LAYER_ORDER: Record<FurnitureLayer, number> = { floor: 0, furniture: 1, surface: 2, wall: 3 };

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

export function cutawayContainsPointer(layout: CutawayLayout, point: GridPoint): boolean {
  return point.x >= layout.x && point.x <= layout.x + layout.width
    && point.y >= layout.y && point.y <= layout.y + layout.height;
}

export function roomCellForLayout(
  room: Pick<InteriorDefinition, 'width' | 'height'>,
  layout: CutawayLayout,
): number {
  const contentWidth = layout.width - 24;
  const contentHeight = layout.height - ROOM_CONTENT_TOP - ROOM_CONTENT_BOTTOM;
  return Math.max(MIN_ROOM_CELL, Math.floor(Math.min(contentWidth / room.width, contentHeight / room.height)));
}

export function roomOriginForLayout(
  room: Pick<InteriorDefinition, 'width' | 'height'>,
  layout: CutawayLayout,
  cell = roomCellForLayout(room, layout),
): GridPoint {
  return {
    x: Math.round(layout.x + (layout.width - room.width * cell) / 2),
    y: Math.round(layout.y + ROOM_CONTENT_TOP),
  };
}

export function roomScreenPoint(roomOrigin: GridPoint, point: GridPoint, cell: number): GridPoint {
  return {
    x: roomOrigin.x + point.x * cell + cell / 2,
    y: roomOrigin.y + point.y * cell + cell / 2,
  };
}

export function roomPointForScreen(roomOrigin: GridPoint, point: GridPoint, cell: number): GridPoint {
  return {
    x: (point.x - roomOrigin.x) / cell - 0.5,
    y: (point.y - roomOrigin.y) / cell - 0.5,
  };
}

export function furnitureRenderScreenPoint(
  roomOrigin: GridPoint,
  furniture: Pick<FurnitureDefinition, 'point' | 'visualOffset'>,
  cell: number,
): GridPoint {
  const visualOffset = furniture.visualOffset ?? { x: 0, y: 0 };
  return roomScreenPoint(roomOrigin, {
    x: furniture.point.x + visualOffset.x,
    y: furniture.point.y + visualOffset.y,
  }, cell);
}

export function dragPreviewScreenPoint(roomOrigin: GridPoint, point: GridPoint, cell = BASE_ROOM_CELL): GridPoint {
  return roomScreenPoint(roomOrigin, point, cell);
}

const BACKGROUND_DEPTH: Record<Exclude<FurnitureLayer, 'wall'>, number> = {
  floor: 0,
  furniture: 1_000,
  surface: 2_000,
};
const OCCLUSION_DEPTH = 3_000;

export function interiorAgentRenderDepth(footY: number, tieBreaker: number): number {
  return OCCLUSION_DEPTH + footY + tieBreaker / 1_000;
}

export function interiorFurnitureRenderDepth(
  furniture: Pick<FurnitureDefinition, 'layer' | 'zIndex'>,
  screenPoint: GridPoint,
): number {
  const layer = furniture.layer ?? 'furniture';
  const zIndex = furniture.zIndex ?? 0;
  return layer === 'wall'
    ? OCCLUSION_DEPTH + screenPoint.y + zIndex / 1_000
    : BACKGROUND_DEPTH[layer] + zIndex / 1_000;
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
  private readonly selectedFurnitureIds = new Set<string>();
  private prefabs: OfficePrefabDefinition[] = [];
  private clipboard: InteriorLayoutClipboard | undefined;
  private layoutStorageReadFailed = false;
  private prefabStorageReadFailed = false;
  private clipboardStorageReadFailed = false;
  private activeInterior: InteriorDefinition | undefined;
  private activeDefinition: InteriorDefinition | undefined;
  private editMode = false;
  private openId: string | undefined;
  private currentAssignments: InteriorOccupantAssignment[] = [];
  private assignmentSignature = '';
  private roomOrigin: GridPoint = { x: 0, y: 0 };
  private roomCell = BASE_ROOM_CELL;
  private currentDragCandidate: PlacementCandidate | undefined;
  private catalogCategory: ModernOfficeCategory = 'workstations';
  private catalogPageIndex = 0;
  private readonly domOverlay: InteriorCutawayDomOverlay;
  private statusMessage = '';
  private statusId: 'storageFailed' | 'undoApplied' | 'templatePreviewReady' | 'templateApplied' | 'groupDissolved' | undefined;
  private readonly undoStore = new InteriorUndoStore([], 20);
  private templatePreview: FurnitureDefinition[] | undefined;
  private templateDiagnostics: Array<'templateInvalid' | 'unreachableHook'> = [];
  private furnitureDomLabels: CutawayRoomLabel[] = [];
  private occupantDomLabels: CutawayRoomLabel[] = [];
  private marqueeCleanup: (() => void) | undefined;
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
    const definition = interiorDefinitionForBuilding(building);
    this.close();
    const layoutRead = readInteriorLayout(buildingId, definition);
    const prefabRead = readAvailablePrefabs();
    const clipboardRead = readLayoutClipboard();
    this.openId = buildingId;
    this.activeDefinition = definition;
    this.activeInterior = {
      ...definition,
      furniture: layoutRead.layout,
      overflow: definition.overflow.map((point) => ({ ...point })),
    };
    this.undoStore.reset(this.activeInterior.furniture);
    this.templatePreview = undefined;
    this.templateDiagnostics = [];
    this.prefabs = prefabRead.value;
    this.clipboard = clipboardRead.value;
    this.layoutStorageReadFailed = layoutRead.storageRead === 'failed';
    this.prefabStorageReadFailed = prefabRead.storageRead === 'failed';
    this.clipboardStorageReadFailed = clipboardRead.storageRead === 'failed';
    const interior = this.activeInterior;
    if (typeof window !== 'undefined') window.dispatchEvent(new Event(CUTAWAY_OPEN_EVENT));
    const size = this.viewportProvider();
    const layout = cutawayLayoutForViewport(size.width, size.height);
    const root = this.scene.add.container(0, 0).setDepth(CUTAWAY_DEPTH).setScrollFactor(0);
    this.root = root;

    const backdrop = this.scene.add.rectangle(
      WORLD_PIXELS.width / 2, WORLD_PIXELS.height / 2,
      WORLD_PIXELS.width, WORLD_PIXELS.height, 0x071018, 0.78,
    ).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: unknown) => {
      const point = pointer as Partial<GridPoint>;
      if (!cutawayContainsPointer(layout, { x: point.x ?? -1, y: point.y ?? -1 })) this.close();
    });
    const panel = this.scene.add.rectangle(
      layout.x + layout.width / 2, layout.y + layout.height / 2,
      layout.width, layout.height, 0x17252a, 1,
    ).setStrokeStyle(3, 0xf1d89a, 1).setInteractive();
    root.add([backdrop, panel]);

    this.roomCell = roomCellForLayout(interior, layout);
    this.roomOrigin = roomOriginForLayout(interior, layout, this.roomCell);
    const roomWidth = interior.width * this.roomCell;
    const roomHeight = interior.height * this.roomCell;
    const { x: roomX, y: roomY } = this.roomOrigin;
    const room = this.scene.add.graphics();
    const [floorA, floorB] = floorColors[interior.floor];
    room.fillStyle(wallColors[interior.wall], 1).fillRect(roomX - 7, roomY - 7, roomWidth + 14, roomHeight + 14);
    for (let y = 0; y < interior.height; y += 1) {
      for (let x = 0; x < interior.width; x += 1) {
        room.fillStyle((x + y) % 2 === 0 ? floorA : floorB, 1)
          .fillRect(roomX + x * this.roomCell, roomY + y * this.roomCell, this.roomCell, this.roomCell);
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
    if (this.layoutStorageReadFailed || this.prefabStorageReadFailed || this.clipboardStorageReadFailed) {
      this.statusId = 'storageFailed';
    }
    this.domOverlay.open(layout, this.overlayModel(), {
      close: () => this.close(),
      toggleEdit: () => {
        this.editMode = !this.editMode;
        if (!this.editMode) this.clearTemplatePreview();
        this.setStatus(this.editMode ? '編輯模式 · 拖曳家具或下方素材到房間' : '家具配置已暫存，按儲存保存');
        if (this.activeInterior) this.renderFurniture(this.activeInterior, layout);
      },
      save: () => {
        if (this.layoutStorageReadFailed) {
          this.setStatus('', 'storageFailed');
          return;
        }
        try {
          if (this.openId && this.activeInterior) saveInteriorLayout(this.openId, this.activeInterior.furniture);
          this.setStatus('✓ 家具配置已保存，下次開啟仍會保留');
        } catch {
          this.setStatus('', 'storageFailed');
        }
      },
      undo: () => this.undo(interior, layout),
      previewTemplate: () => this.previewTemplate(definition, interior, layout),
      applyTemplate: () => this.applyTemplate(interior, layout),
      collect: () => {
        this.commitFurnitureMutation(interior, collectAllFurniture(interior.furniture));
        this.selectedFurnitureIds.clear();
        this.selectedFurnitureId = undefined;
        this.setStatus('全部家具已收回下方貨架 · 尚未儲存');
        this.renderFurniture(interior, layout);
      },
      revert: () => {
        if (!this.openId) return;
        const read = readInteriorLayout(this.openId, definition);
        if (read.storageRead === 'failed') {
          this.layoutStorageReadFailed = true;
          this.setStatus('', 'storageFailed');
          return;
        }
        this.layoutStorageReadFailed = false;
        interior.furniture = read.layout;
        this.undoStore.reset(interior.furniture);
        this.clearTemplatePreview();
        this.selectedFurnitureIds.clear();
        this.selectedFurnitureId = undefined;
        this.setStatus('已取消未儲存變更，回到最後保存版本');
        this.renderFurniture(interior, layout);
      },
      copy: () => {
        if (!this.openId) return;
        if (this.clipboardStorageReadFailed) {
          this.setStatus('', 'storageFailed');
          return;
        }
        try {
          const clipboard = copyDecorativeLayout(this.openId, interior.furniture);
          saveLayoutClipboard(clipboard);
          this.clipboard = clipboard;
          this.clipboardStorageReadFailed = false;
          this.setStatus('格局已複製（Hook 家具不會被帶走）');
          this.close();
        } catch {
          this.setStatus('', 'storageFailed');
        }
      },
      paste: () => {
        const clipboard = this.clipboard;
        if (!clipboard) return;
        const result = pasteDecorativeLayout(interior, interior.furniture, clipboard);
        if (result.accepted) this.commitFurnitureMutation(interior, result.layout);
        this.setStatus(result.accepted ? '格局已貼上 · 請補齊左側 Hook 家具後儲存' : '⚠ 格局超出這間房，未套用');
        this.renderFurniture(interior, layout);
      },
      group: () => this.createSelectedPrefab(interior, layout),
      dissolveGroup: () => this.dissolveSelectedGroup(interior, layout),
      duplicate: () => this.duplicateSelected(interior, layout),
      returnToShelf: () => this.returnSelectedToShelf(interior, layout),
      cancelSelection: () => this.cancelSelection(),
      shiftLayer: (direction) => this.shiftSelectedLayer(interior, layout, direction),
      reorder: (direction) => this.reorderSelected(interior, layout, direction),
      category: (category) => {
        this.catalogCategory = category;
        this.catalogPageIndex = 0;
        if (this.activeInterior) this.renderFurniture(this.activeInterior, layout);
      },
      page: (delta) => {
        const total = catalogPage(this.catalogCategory, this.catalogPageIndex, 12).totalPages;
        this.catalogPageIndex = Math.max(0, Math.min(total - 1, this.catalogPageIndex + delta));
        if (this.activeInterior) this.renderFurniture(this.activeInterior, layout);
      },
      resize: (delta) => this.resizeSelected(interior, layout, delta),
      rotate: (delta) => this.rotateSelected(interior, layout, delta),
    });
  }

  setLocale(locale: VillageLocale): void { this.domOverlay.setLocale(locale); }

  close(): void {
    this.marqueeCleanup?.();
    this.marqueeCleanup = undefined;
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
    this.selectedFurnitureIds.clear();
    this.activeInterior = undefined;
    this.activeDefinition = undefined;
    this.clipboard = undefined;
    this.layoutStorageReadFailed = false;
    this.prefabStorageReadFailed = false;
    this.clipboardStorageReadFailed = false;
    this.editMode = false;
    this.openId = undefined;
    this.currentAssignments = [];
    this.assignmentSignature = '';
    this.currentDragCandidate = undefined;
    this.roomCell = BASE_ROOM_CELL;
    this.statusMessage = '';
    this.statusId = undefined;
    this.undoStore.reset([]);
    this.templatePreview = undefined;
    this.templateDiagnostics = [];
    this.furnitureDomLabels = [];
    this.occupantDomLabels = [];
    this.occupantViews.clear();
  }

  update(snapshots: readonly InteriorAgentSnapshot[]): void {
    if (!this.root || !this.openId) return;
    const building = this.world.buildings.find(({ id }) => id === this.openId);
    if (!building) return;
    const interior = this.activeInterior ?? interiorDefinitionForBuilding(building);
    const matchingSnapshots = snapshots.filter(({ buildingId }) => buildingId === building.id);
    const assignments = assignInteriorOccupants(interior, matchingSnapshots, building.id);
    const signature = assignments.map(({ agentId, furnitureId, point, eventId }) => (
      `${agentId}:${furnitureId ?? `${point.x},${point.y}`}:${eventId}`
    )).join('|');
    if (signature !== this.assignmentSignature) {
      this.assignmentSignature = signature;
      this.currentAssignments = assignments;
      for (const view of this.occupantViews.values()) {
        view.sprite.destroy();
        view.icon.destroy();
        view.bubble.destroy();
        view.name.destroy();
      }
      this.occupantViews.clear();
      const layer = this.furnitureLayer;
      if (!layer) return;
      this.occupantLayer = layer;
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
          .setOrigin(0.5, 0.82).setDepth(interiorAgentRenderDepth(0, index + 1))
          .setScale(('renderScale' in skin ? skin.renderScale : 1.35) * this.roomCell / BASE_ROOM_CELL);
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
      const point = roomScreenPoint(this.roomOrigin, motion.point, this.roomCell);
      const pixelScale = this.roomCell / BASE_ROOM_CELL;
      const x = point.x;
      const y = point.y + (assignment.seated && motion.phase === 'working' ? 4 * pixelScale : 0)
        + motion.bob * pixelScale;
      view.sprite.setPosition(x, y).setDepth(interiorAgentRenderDepth(y, this.currentAssignments.indexOf(assignment) + 1));
      view.icon.setPosition(x, y - 21 * pixelScale);
      view.bubble.setPosition(x, y - 31 * pixelScale).setText(motion.bubbleText);
      view.name.setPosition(x, y + 9 * pixelScale);
    });
    this.occupantDomLabels = assignments.map((assignment) => {
      const snapshot = matchingSnapshots.find(({ agentId }) => agentId === assignment.agentId) ?? assignment;
      const motion = interiorMotionAt(snapshot, interior, assignment, this.scene.time.now);
      return {
        id: `agent:${assignment.agentId}`,
        text: `${actionSymbols[assignment.icon]} ${motion.bubbleText}\n${assignment.agentId}`,
        x: roomScreenPoint(this.roomOrigin, motion.point, this.roomCell).x,
        y: roomScreenPoint(this.roomOrigin, motion.point, this.roomCell).y - this.roomCell / 2 - 2 * this.roomCell / BASE_ROOM_CELL,
        kind: 'agent' as const,
      };
    });
    this.furnitureLayer?.sort('depth');
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
    this.marqueeCleanup?.();
    this.marqueeCleanup = undefined;
    this.furnitureLayer?.removeAll(true);
    this.furnitureLayer?.destroy();
    this.occupantLayer = undefined;
    this.occupantViews.clear();
    this.assignmentSignature = '';
    this.paletteLayer?.removeAll(true);
    this.paletteLayer?.destroy();
    if (!this.root) return;
    this.roomCell = roomCellForLayout(interior, layout);
    this.roomOrigin = roomOriginForLayout(interior, layout, this.roomCell);
    const root = this.root;
    const furnitureLayer = this.scene.add.container(0, 0);
    this.furnitureLayer = furnitureLayer;
    root.add(furnitureLayer);
    const placementPreview = this.scene.add.graphics();
    furnitureLayer.add(placementPreview);

    if (this.editMode) {
      const grid = this.scene.add.graphics().lineStyle(1, 0xf5deb0, 0.15);
      for (let x = 0; x <= interior.width * 4; x += 1) {
        grid.lineBetween(this.roomOrigin.x + x * this.roomCell / 4, this.roomOrigin.y,
          this.roomOrigin.x + x * this.roomCell / 4, this.roomOrigin.y + interior.height * this.roomCell);
      }
      for (let y = 0; y <= interior.height * 4; y += 1) {
        grid.lineBetween(this.roomOrigin.x, this.roomOrigin.y + y * this.roomCell / 4,
          this.roomOrigin.x + interior.width * this.roomCell, this.roomOrigin.y + y * this.roomCell / 4);
      }
      furnitureLayer.add(grid);
    }

    const drawPlacementPreview = (candidate: PlacementCandidate): void => {
      placementPreview.clear();
      placementPreview.fillStyle(candidate.diagnostic === 'valid' ? 0x65d47e : 0xe05b54, 0.42);
      placementPreview.fillRect(
        this.roomOrigin.x + candidate.bounds.x * this.roomCell,
        this.roomOrigin.y + candidate.bounds.y * this.roomCell,
        candidate.bounds.width * this.roomCell,
        candidate.bounds.height * this.roomCell,
      );
    };

    const sortedFurniture = [...interior.furniture].sort((a, b) => {
      const layer = LAYER_ORDER[a.layer ?? 'furniture'] - LAYER_ORDER[b.layer ?? 'furniture'];
      return layer || (a.zIndex ?? 0) - (b.zIndex ?? 0);
    });
    const furnitureSprites = new Set<Phaser.GameObjects.Image>();
    for (const furniture of sortedFurniture) {
      const point = furnitureRenderScreenPoint(this.roomOrigin, furniture, this.roomCell);
      const catalog = resolvedFurnitureAsset(furniture);
      const assetKey = catalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const originX = catalog ? (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32 : 0.5;
      const originY = catalog ? (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48 : 0.5;
      const sprite = this.scene.add.image(point.x, point.y, assetKey).setOrigin(originX, originY)
        .setScale(normalizeFurnitureScale(furniture.scale) * this.roomCell / BASE_ROOM_CELL)
        .setAngle(furniture.rotation ?? 0).setDepth(interiorFurnitureRenderDepth(furniture, point));
      furnitureLayer.add(sprite);
      if (!this.editMode) continue;
      sprite.setInteractive({ useHandCursor: true, draggable: true });
      furnitureSprites.add(sprite);
      this.scene.input.setDraggable(sprite);
      sprite.on('pointerdown', (pointer: unknown) => {
        this.selectedFurnitureId = furniture.id;
        this.selectedFurnitureIds.clear();
        this.selectedFurnitureIds.add(furniture.id);
        this.syncOverlay();
        if ((pointer as { event?: { detail?: number } }).event?.detail === 2) {
          const scale = normalizeFurnitureScale(furniture.scale);
          const nextIndex = (FURNITURE_SCALES.indexOf(scale) + 1) % FURNITURE_SCALES.length;
          const nextScale = FURNITURE_SCALES[nextIndex]!;
          const resized = resizeFurniture(interior, interior.furniture, furniture.id, nextScale);
          if (normalizeFurnitureScale(resized.find(({ id }) => id === furniture.id)?.scale) === nextScale) {
            this.commitFurnitureMutation(interior, resized);
            this.setStatus(`雙擊調整為 ${Math.round(nextScale * 100)}% · 按儲存配置`);
            this.renderFurniture(interior, layout);
          }
        }
      });
      sprite.on('drag', (_pointer: unknown, dragX: number, dragY: number) => {
        this.currentDragCandidate = resolvePlacementCandidate(
          interior, interior.furniture, furniture, this.roomPoint(dragX, dragY), furniture.id,
        );
        const fitted = furnitureRenderScreenPoint(this.roomOrigin, this.currentDragCandidate.furniture, this.roomCell);
        sprite.setPosition(fitted.x, fitted.y);
        drawPlacementPreview(this.currentDragCandidate);
      });
      sprite.on('dragend', () => {
        const candidate = this.currentDragCandidate;
        const accepted = candidate?.diagnostic === 'valid';
        if (candidate && accepted) {
          this.commitFurnitureMutation(interior, commitPlacementCandidate(interior, interior.furniture, candidate));
        }
        this.setStatus(accepted ? '家具已移動 · 按儲存配置' : `⚠ ${placementMessage(candidate?.diagnostic ?? 'outside-room')} · 已回復原位`);
        this.currentDragCandidate = undefined;
        this.renderFurniture(interior, layout);
      });
    }

    for (const furniture of this.templatePreview ?? []) {
      const point = furnitureRenderScreenPoint(this.roomOrigin, furniture, this.roomCell);
      const catalog = resolvedFurnitureAsset(furniture);
      const assetKey = catalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const originX = catalog ? (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32 : 0.5;
      const originY = catalog ? (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48 : 0.5;
      furnitureLayer.add(this.scene.add.image(point.x, point.y, assetKey).setOrigin(originX, originY)
        .setScale(normalizeFurnitureScale(furniture.scale) * this.roomCell / BASE_ROOM_CELL)
        .setAngle(furniture.rotation ?? 0).setDepth(interiorFurnitureRenderDepth(furniture, point)).setAlpha(0.36));
    }
    furnitureLayer.sort('depth');

    const contextualFurnitureIds = new Set([
      this.selectedFurnitureId,
      ...this.currentAssignments.map(({ furnitureId }) => furnitureId),
    ].filter((id): id is string => Boolean(id)));
    this.furnitureDomLabels = interior.furniture.flatMap((furniture): CutawayRoomLabel[] => {
      const label = hookFurnitureLabel(furniture);
      if (!label || !contextualFurnitureIds.has(furniture.id)) return [];
      return [{
        id: `hook:${furniture.id}`, text: label,
        x: furnitureRenderScreenPoint(this.roomOrigin, furniture, this.roomCell).x,
        y: furnitureRenderScreenPoint(this.roomOrigin, furniture, this.roomCell).y + 18 * this.roomCell / BASE_ROOM_CELL,
        kind: 'hook',
      }];
    });
    this.syncRoomLabels();

    if (this.editMode) this.installMarqueeSelection(interior, layout, furnitureLayer, furnitureSprites);

    if (!this.editMode) return;
    const palette = this.scene.add.container(0, 0);
    this.paletteLayer = palette;
    root.add(palette);
    const rootPointForPointer = (pointer: unknown): GridPoint | undefined => {
      const value = pointer as Phaser.Input.Pointer | undefined;
      if (!value || typeof value.positionToCamera !== 'function') return undefined;
      const camera = value.camera ?? this.scene.cameras.main;
      const worldPoint = value.positionToCamera(camera) as GridPoint;
      const point = root.getLocalPoint(worldPoint.x, worldPoint.y, undefined, camera);
      return Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : undefined;
    };
    const page = catalogPage(this.catalogCategory, this.catalogPageIndex, 12);
    const required = requiredHookInventory(this.activeDefinition ?? interior, interior.furniture);
    const startX = layout.x + (layout.width - 12 * 34) / 2 + 17;
    const shelfY = layout.y + layout.height - 42;
    const missingRequired = required.filter(({ placed }) => !placed);
    missingRequired.slice(0, 12).forEach(({ furniture }, index) => {
      const catalog = resolvedFurnitureAsset(furniture);
      const assetKey = catalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const originX = catalog ? (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32 : 0.5;
      const originY = catalog ? (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48 : 0.5;
      const item = this.scene.add.image(startX + index * 34, shelfY, assetKey).setOrigin(originX, originY).setScale(0.68).setTint(0xffd36b);
      this.wireFurnitureSource(item, furniture, assetKey, originX, originY, interior, layout, furnitureLayer, `Hook: ${hookFurnitureLabel(furniture)}`);
      palette.add(item);
    });
    const prefabOffset = Math.min(12, missingRequired.length);
    this.prefabs.slice(0, Math.max(0, 12 - prefabOffset)).forEach((prefab, index) => {
      const points = prefab.items.map(({ point, visualOffset }) => ({
        x: point.x + (visualOffset?.x ?? 0),
        y: point.y + (visualOffset?.y ?? 0),
      }));
      const minX = Math.min(...points.map(({ x }) => x));
      const maxX = Math.max(...points.map(({ x }) => x));
      const minY = Math.min(...points.map(({ y }) => y));
      const maxY = Math.max(...points.map(({ y }) => y));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const previewScale = Math.min(0.68, 26 / (Math.max(maxX - minX + 1, maxY - minY + 1) * this.roomCell));
      const item = this.scene.add.container(startX + (prefabOffset + index) * 34, shelfY).setSize(30, 30);
      const outline = this.scene.add.graphics().lineStyle(1, 0x8ee8ff, 0.95).strokeRect(-14, -14, 28, 28);
      item.add(outline);
      prefab.items.forEach((part) => {
        const partCatalog = resolvedFurnitureAsset(part);
        const partKey = partCatalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(part.kind)).key;
        const partOriginX = partCatalog ? (partCatalog.opaqueBounds.x + partCatalog.opaqueBounds.width / 2) / 32 : 0.5;
        const partOriginY = partCatalog ? (partCatalog.opaqueBounds.y + partCatalog.opaqueBounds.height / 2) / 48 : 0.5;
        const offset = part.visualOffset ?? { x: 0, y: 0 };
        item.add(this.scene.add.image(
          (part.point.x + offset.x - centerX) * this.roomCell * previewScale,
          (part.point.y + offset.y - centerY) * this.roomCell * previewScale,
          partKey,
        ).setOrigin(partOriginX, partOriginY)
          .setScale(normalizeFurnitureScale(part.scale) * this.roomCell / BASE_ROOM_CELL * previewScale)
          .setAngle(part.rotation ?? 0));
      });
      item.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(item);
      let ghosts: Phaser.GameObjects.Image[] = [];
      let lastPointerAnchor: { screen: GridPoint; room: GridPoint } | undefined;
      const capturePointerAnchor = (pointer: unknown) => {
        const screen = rootPointForPointer(pointer);
        if (!screen) return undefined;
        lastPointerAnchor = { screen, room: this.roomPoint(screen.x, screen.y) };
        return lastPointerAnchor;
      };
      const createGhosts = (x: number, y: number): Phaser.GameObjects.Image[] => prefab.items.map((part) => {
          const partCatalog = resolvedFurnitureAsset(part);
          const partKey = partCatalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(part.kind)).key;
          const partOriginX = partCatalog ? (partCatalog.opaqueBounds.x + partCatalog.opaqueBounds.width / 2) / 32 : 0.5;
          const partOriginY = partCatalog ? (partCatalog.opaqueBounds.y + partCatalog.opaqueBounds.height / 2) / 48 : 0.5;
          const offset = part.visualOffset ?? { x: 0, y: 0 };
          const ghost = this.scene.add.image(
            x + (part.point.x + offset.x - prefab.anchor.x) * this.roomCell,
            y + (part.point.y + offset.y - prefab.anchor.y) * this.roomCell,
            partKey,
          ).setOrigin(partOriginX, partOriginY)
            .setScale(normalizeFurnitureScale(part.scale) * this.roomCell / BASE_ROOM_CELL)
            .setAngle(part.rotation ?? 0).setAlpha(0.72);
          furnitureLayer.add(ghost);
          return ghost;
        });
      item.on('dragstart', (pointer: unknown) => {
        const anchor = capturePointerAnchor(pointer);
        ghosts = anchor ? createGhosts(anchor.screen.x, anchor.screen.y) : [];
      });
      item.on('drag', (pointer: unknown) => {
        const anchor = capturePointerAnchor(pointer);
        if (!anchor) return;
        if (ghosts.length === 0) ghosts = createGhosts(anchor.screen.x, anchor.screen.y);
        ghosts.forEach((ghost, partIndex) => {
          const part = prefab.items[partIndex]!;
          const offset = part.visualOffset ?? { x: 0, y: 0 };
          ghost.setPosition(
            anchor.screen.x + (part.point.x + offset.x - prefab.anchor.x) * this.roomCell,
            anchor.screen.y + (part.point.y + offset.y - prefab.anchor.y) * this.roomCell,
          );
        });
      });
      item.on('dragend', (pointer: unknown) => {
        const anchor = lastPointerAnchor ?? capturePointerAnchor(pointer);
        const result = anchor
          ? placeOfficePrefab(interior, interior.furniture, prefab, snapFurniturePoint(anchor.room))
          : undefined;
        if (result?.accepted) this.commitFurnitureMutation(interior, result.layout);
        this.setStatus(result?.accepted ? `組裝件「${prefab.name}」已放置` : '⚠ 組裝件超出房間或擋門');
        ghosts.forEach((ghost) => ghost.destroy());
        ghosts = [];
        lastPointerAnchor = undefined;
        this.renderFurniture(interior, layout);
      });
      palette.add(item);
    });
    page.items.forEach((catalog, index) => {
      const x = startX + index * 34;
      const y = shelfY + 24;
      const originX = (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32;
      const originY = (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48;
      const item = this.scene.add.image(x, y, catalog.key).setOrigin(originX, originY).setScale(0.68);
      item.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(item);
      let dragClone: Phaser.GameObjects.Image | undefined;
      item.on('dragstart', () => {
        dragClone = this.scene.add.image(item.x, item.y, catalog.key).setOrigin(originX, originY)
          .setScale(this.roomCell / BASE_ROOM_CELL).setAlpha(0.88);
        furnitureLayer.add(dragClone);
      });
      item.on('drag', (_pointer: unknown, dragX: number, dragY: number) => {
        if (!dragClone) {
          dragClone = this.scene.add.image(dragX, dragY, catalog.key).setOrigin(originX, originY)
            .setScale(this.roomCell / BASE_ROOM_CELL).setAlpha(0.88);
          furnitureLayer.add(dragClone);
        }
        const preview: FurnitureDefinition = {
          id: `custom-office-${catalog.id}-${Date.now()}`, kind: 'decor', point: this.roomPoint(dragX, dragY),
          facing: 'up', supportedActions: [], icon: 'generic', scale: 1, rotation: 0,
          assetId: catalog.id, footprint: { ...catalog.footprint },
          visualOffset: { x: catalog.visualOffset.x / 16, y: catalog.visualOffset.y / 16 },
        };
        this.currentDragCandidate = resolvePlacementCandidate(interior, interior.furniture, preview, preview.point);
        const fitted = furnitureRenderScreenPoint(this.roomOrigin, this.currentDragCandidate.furniture, this.roomCell);
        dragClone.setPosition(fitted.x, fitted.y);
        drawPlacementPreview(this.currentDragCandidate);
      });
      item.on('dragend', () => {
        const candidate = this.currentDragCandidate;
        const accepted = candidate?.diagnostic === 'valid';
        if (candidate && accepted) {
          this.commitFurnitureMutation(interior, commitPlacementCandidate(interior, interior.furniture, candidate));
        }
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
    return roomPointForScreen(this.roomOrigin, { x, y }, this.roomCell);
  }

  private wireFurnitureSource(
    item: Phaser.GameObjects.Image,
    template: FurnitureDefinition,
    assetKey: string,
    originX: number,
    originY: number,
    interior: InteriorDefinition,
    layout: CutawayLayout,
    furnitureLayer: Phaser.GameObjects.Container,
    label: string,
  ): void {
    item.setInteractive({ useHandCursor: true, draggable: true });
    this.scene.input.setDraggable(item);
    let dragClone: Phaser.GameObjects.Image | undefined;
    item.on('dragstart', () => {
      dragClone = this.scene.add.image(item.x, item.y, assetKey).setOrigin(originX, originY)
        .setScale(normalizeFurnitureScale(template.scale) * this.roomCell / BASE_ROOM_CELL).setAlpha(0.88);
      furnitureLayer.add(dragClone);
    });
    item.on('drag', (_pointer: unknown, dragX: number, dragY: number) => {
      const preview: FurnitureDefinition = {
        ...template,
        point: this.roomPoint(dragX, dragY),
        requirementId: template.requirementId ?? `${interior.id}:${template.id}`,
      };
      this.currentDragCandidate = resolvePlacementCandidate(interior, interior.furniture, preview, preview.point);
      const fitted = furnitureRenderScreenPoint(this.roomOrigin, this.currentDragCandidate.furniture, this.roomCell);
      dragClone?.setPosition(fitted.x, fitted.y);
    });
    item.on('dragend', () => {
      const candidate = this.currentDragCandidate;
      if (candidate?.diagnostic === 'valid') {
        this.commitFurnitureMutation(interior, commitPlacementCandidate(interior, interior.furniture, candidate));
      }
      this.setStatus(candidate?.diagnostic === 'valid' ? `${label} 已放置 · 按儲存配置` : '⚠ Hook 家具超出房間或擋門');
      dragClone?.destroy();
      this.currentDragCandidate = undefined;
      this.renderFurniture(interior, layout);
    });
  }

  private installMarqueeSelection(
    interior: InteriorDefinition,
    layout: CutawayLayout,
    furnitureLayer: Phaser.GameObjects.Container,
    furnitureSprites: ReadonlySet<Phaser.GameObjects.Image>,
  ): void {
    const input = this.scene.input as Phaser.Input.InputPlugin & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      off?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    if (!input.on || !input.off) return;
    const marquee = this.scene.add.graphics();
    furnitureLayer.add(marquee);
    let start: GridPoint | undefined;
    const pointOf = (pointer: unknown): GridPoint => {
      const value = pointer as { x?: number; y?: number };
      return this.roomPoint(value.x ?? 0, value.y ?? 0);
    };
    const inside = (point: GridPoint): boolean => point.x >= -0.5 && point.y >= -0.5
      && point.x <= interior.width - 0.5 && point.y <= interior.height - 0.5;
    const down = (pointer: unknown, hitObjects: unknown): void => {
      const point = pointOf(pointer);
      const hits = Array.isArray(hitObjects) ? hitObjects : [];
      if (hits.some((object) => furnitureSprites.has(object as Phaser.GameObjects.Image)) || !inside(point)) return;
      start = point;
      this.setStatus('框選中 · 放開滑鼠建立多選範圍');
    };
    const move = (pointer: unknown): void => {
      if (!start) return;
      const end = pointOf(pointer);
      marquee.clear().fillStyle(0x79d9ff, 0.16).fillRect(
        this.roomOrigin.x + Math.min(start.x, end.x) * this.roomCell + this.roomCell / 2,
        this.roomOrigin.y + Math.min(start.y, end.y) * this.roomCell + this.roomCell / 2,
        Math.abs(end.x - start.x) * this.roomCell,
        Math.abs(end.y - start.y) * this.roomCell,
      );
    };
    const up = (pointer: unknown): void => {
      if (!start) return;
      const end = pointOf(pointer);
      const rect = {
        x: Math.min(start.x, end.x) + 0.5,
        y: Math.min(start.y, end.y) + 0.5,
        width: Math.abs(end.x - start.x),
        height: Math.abs(end.y - start.y),
      };
      this.selectedFurnitureIds.clear();
      selectedFurnitureIds(rect, interior.furniture).forEach((id) => this.selectedFurnitureIds.add(id));
      this.selectedFurnitureId = [...this.selectedFurnitureIds][0];
      start = undefined;
      marquee.clear();
      this.setStatus(`已框選 ${this.selectedFurnitureIds.size} 件 · 可建立組裝件`);
      this.syncOverlay();
    };
    input.on('pointerdown', down);
    input.on('pointermove', move);
    input.on('pointerup', up);
    this.marqueeCleanup = () => {
      input.off?.('pointerdown', down);
      input.off?.('pointermove', move);
      input.off?.('pointerup', up);
    };
  }

  private overlayModel() {
    const page = catalogPage(this.catalogCategory, this.catalogPageIndex, 12);
    const selected = this.activeInterior?.furniture.find(({ id }) => id === this.selectedFurnitureId);
    const selection = this.activeInterior?.furniture.filter(({ id }) => this.selectedFurnitureIds.has(id)) ?? [];
    const catalog = selected ? resolvedFurnitureAsset(selected) : undefined;
    const capabilities = selectionCapabilities(selection);
    const selectedInstanceId = selection[0]?.prefabInstanceId;
    return {
      titleId: this.activeInterior?.id ?? 'rest-cabin',
      title: this.activeInterior?.label ?? '', status: this.statusMessage, editMode: this.editMode,
      category: this.catalogCategory, page: page.page, totalPages: page.totalPages,
      requiredPlaced: this.activeInterior ? requiredHookInventory(this.activeDefinition ?? this.activeInterior, this.activeInterior.furniture).filter(({ placed }) => placed).length : 0,
      requiredTotal: this.activeInterior ? requiredHookInventory(this.activeDefinition ?? this.activeInterior, this.activeInterior.furniture).length : 0,
      prefabCount: this.prefabs.length,
      clipboardAvailable: Boolean(this.clipboard),
      saveBlocked: this.layoutStorageReadFailed,
      selectedCount: this.selectedFurnitureIds.size,
      ...capabilities,
      canDissolve: Boolean(selectedInstanceId) && selection.every(({ prefabInstanceId }) => prefabInstanceId === selectedInstanceId),
      canUndo: this.undoStore.canUndo,
      templatePreviewing: Boolean(this.templatePreview),
      templateValid: Boolean(this.templatePreview) && this.templateDiagnostics.length === 0,
      templateDiagnostics: [...this.templateDiagnostics],
      ...(this.statusId ? { statusId: this.statusId } : {}),
      ...(selected ? { selected: {
        label: hookFurnitureLabel(selected) || catalog?.label || furnitureLabel(selected.kind),
        scale: normalizeFurnitureScale(selected.scale), rotation: selected.rotation ?? 0,
        layer: selected.layer ?? 'furniture',
      } } : {}),
    };
  }

  private syncOverlay(): void { this.domOverlay.update(this.overlayModel()); }
  private setStatus(
    message: string,
    statusId?: 'storageFailed' | 'undoApplied' | 'templatePreviewReady' | 'templateApplied' | 'groupDissolved',
  ): void {
    this.statusMessage = message;
    const unresolvedStorageRead = this.layoutStorageReadFailed
      || this.prefabStorageReadFailed
      || this.clipboardStorageReadFailed;
    this.statusId = statusId ?? (unresolvedStorageRead ? 'storageFailed' : undefined);
    this.domOverlay.update(this.overlayModel());
  }

  private clearTemplatePreview(): void {
    this.templatePreview = undefined;
    this.templateDiagnostics = [];
  }

  private commitFurnitureMutation(
    interior: InteriorDefinition,
    next: readonly FurnitureDefinition[],
  ): boolean {
    if (JSON.stringify(interior.furniture) === JSON.stringify(next)) return false;
    interior.furniture = this.undoStore.commit(next);
    this.clearTemplatePreview();
    return true;
  }

  private undo(interior: InteriorDefinition, layout: CutawayLayout): void {
    const restored = this.undoStore.undo();
    if (!restored) return;
    interior.furniture = restored;
    this.clearTemplatePreview();
    this.selectedFurnitureIds.clear();
    this.selectedFurnitureId = undefined;
    this.setStatus('', 'undoApplied');
    this.renderFurniture(interior, layout);
  }

  private previewTemplate(
    definition: InteriorDefinition,
    interior: InteriorDefinition,
    layout: CutawayLayout,
  ): void {
    const proposed = cloneFurnitureLayout(definition.furniture);
    const issues = officeLayoutIssues({ ...definition, furniture: proposed });
    const diagnostics = new Set<'templateInvalid' | 'unreachableHook'>();
    for (const issue of issues) {
      if (issue.diagnostic === 'unreachable-interaction-anchor' && issue.furnitureId) diagnostics.add('unreachableHook');
      else diagnostics.add('templateInvalid');
    }
    this.templatePreview = proposed;
    this.templateDiagnostics = [...diagnostics];
    this.setStatus('', diagnostics.size === 0 ? 'templatePreviewReady' : undefined);
    this.renderFurniture(interior, layout);
  }

  private applyTemplate(interior: InteriorDefinition, layout: CutawayLayout): void {
    if (!this.templatePreview || this.templateDiagnostics.length > 0) return;
    const proposed = cloneFurnitureLayout(this.templatePreview);
    this.commitFurnitureMutation(interior, proposed);
    this.layoutStorageReadFailed = false;
    this.clearTemplatePreview();
    this.selectedFurnitureIds.clear();
    this.selectedFurnitureId = undefined;
    this.setStatus('', 'templateApplied');
    this.renderFurniture(interior, layout);
  }

  private dissolveSelectedGroup(interior: InteriorDefinition, layout: CutawayLayout): void {
    const selection = interior.furniture.filter(({ id }) => this.selectedFurnitureIds.has(id));
    const instanceId = selection[0]?.prefabInstanceId;
    if (!instanceId || !selection.every(({ prefabInstanceId }) => prefabInstanceId === instanceId)) return;
    this.commitFurnitureMutation(interior, dissolvePrefabInstance(interior.furniture, instanceId));
    this.setStatus('', 'groupDissolved');
    this.renderFurniture(interior, layout);
  }

  private syncRoomLabels(): void {
    this.domOverlay.setRoomLabels([...this.furnitureDomLabels, ...this.occupantDomLabels]);
  }

  private resizeSelected(interior: InteriorDefinition, layout: CutawayLayout, direction: -1 | 1): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const result = transformSelectionAtomically(interior, interior.furniture, [...this.selectedFurnitureIds], (item) => {
      const scale = normalizeFurnitureScale(item.scale);
      const nextScale = FURNITURE_SCALES[FURNITURE_SCALES.indexOf(scale) + direction] as FurnitureScale | undefined;
      return nextScale ? { ...item, scale: nextScale } : item;
    });
    if (result.accepted) this.commitFurnitureMutation(interior, result.layout);
    this.setStatus(result.accepted ? '已批次調整家具尺寸 · 按儲存配置' : '⚠ 尺寸調整後會超界或擋門');
    this.renderFurniture(interior, layout);
  }

  private rotateSelected(interior: InteriorDefinition, layout: CutawayLayout, delta: -90 | 90): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const result = transformSelectionAtomically(interior, interior.furniture, [...this.selectedFurnitureIds], (item) => ({
      ...item, rotation: (((item.rotation ?? 0) + delta + 360) % 360) as FurnitureRotation,
    }));
    if (result.accepted) this.commitFurnitureMutation(interior, result.layout);
    this.setStatus(result.accepted ? '已批次旋轉家具 · 按儲存配置' : '⚠ 旋轉後會超界或擋門');
    this.renderFurniture(interior, layout);
  }

  private shiftSelectedLayer(interior: InteriorDefinition, layout: CutawayLayout, direction: 'previous' | 'next'): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const layers: readonly FurnitureLayer[] = ['floor', 'furniture', 'surface', 'wall'];
    const result = transformSelectionAtomically(interior, interior.furniture, [...this.selectedFurnitureIds], (item) => {
      const current = item.layer ?? 'furniture';
      const index = Math.max(0, Math.min(layers.length - 1, layers.indexOf(current) + (direction === 'next' ? 1 : -1)));
      return { ...item, layer: layers[index]!, zIndex: 0 };
    });
    if (result.accepted) this.commitFurnitureMutation(interior, result.layout);
    this.setStatus(direction === 'next' ? '選取家具已移到上一層' : '選取家具已移到下一層');
    this.renderFurniture(interior, layout);
  }

  private reorderSelected(
    interior: InteriorDefinition,
    layout: CutawayLayout,
    direction: 'back' | 'backward' | 'forward' | 'front',
  ): void {
    if (this.selectedFurnitureIds.size === 0) return;
    let reordered = interior.furniture;
    for (const id of this.selectedFurnitureIds) reordered = reorderFurniture(reordered, id, direction);
    this.commitFurnitureMutation(interior, reordered);
    this.setStatus('選取家具顯示順序已調整 · 按儲存配置');
    this.renderFurniture(interior, layout);
  }

  private createSelectedPrefab(interior: InteriorDefinition, layout: CutawayLayout): void {
    if (this.prefabStorageReadFailed) {
      this.setStatus('', 'storageFailed');
      return;
    }
    const userPrefabCount = this.prefabs.filter((prefab) => !isBuiltInPrefab(prefab)).length;
    const name = typeof window === 'undefined' ? `組裝件 ${userPrefabCount + 1}`
      : window.prompt('替這個組裝件命名', `組裝件 ${userPrefabCount + 1}`)?.trim();
    if (!name) return;
    const selection = interior.furniture.filter(({ id }) => this.selectedFurnitureIds.has(id));
    let prefab: FurniturePrefab;
    try {
      prefab = createFurniturePrefab(name, selection);
    } catch {
      this.setStatus('⚠ 至少框選兩件一般家具；Hook 家具不會加入組裝件');
      return;
    }
    try {
      savePrefabs(upsertPrefab(this.prefabs, prefab));
      const read = readAvailablePrefabs();
      if (read.storageRead === 'failed') {
        this.prefabStorageReadFailed = true;
        this.setStatus('', 'storageFailed');
        return;
      }
      this.prefabs = read.value;
      this.setStatus(`組裝件「${name}」已加入下方貨架`);
    } catch {
      this.setStatus('', 'storageFailed');
    }
    this.renderFurniture(interior, layout);
  }

  private duplicateSelected(interior: InteriorDefinition, layout: CutawayLayout): void {
    if (this.selectedFurnitureIds.size !== 1) return;
    const sourceId = [...this.selectedFurnitureIds][0]!;
    const result = duplicateFurniture(interior, interior.furniture, sourceId);
    if (result.accepted) {
      this.commitFurnitureMutation(interior, result.layout);
      this.selectedFurnitureIds.clear();
      result.selectedIds.forEach((id) => this.selectedFurnitureIds.add(id));
      this.selectedFurnitureId = result.selectedIds[0];
    }
    this.setStatus(result.accepted ? '家具已複製 · 原件與複本已選取' : '⚠ 附近沒有可放置複本的位置');
    this.renderFurniture(interior, layout);
  }

  private returnSelectedToShelf(interior: InteriorDefinition, layout: CutawayLayout): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const count = this.selectedFurnitureIds.size;
    this.commitFurnitureMutation(interior, removeSelection(interior.furniture, [...this.selectedFurnitureIds]));
    this.selectedFurnitureIds.clear();
    this.selectedFurnitureId = undefined;
    this.setStatus(`${count} 件家具已放回下排 · 尚未儲存`);
    this.renderFurniture(interior, layout);
  }

  private cancelSelection(): void {
    this.selectedFurnitureIds.clear();
    this.selectedFurnitureId = undefined;
    this.setStatus('已取消家具選取');
    if (this.activeInterior && this.root) {
      const size = this.viewportProvider();
      this.renderFurniture(this.activeInterior, cutawayLayoutForViewport(size.width, size.height));
    }
  }
}

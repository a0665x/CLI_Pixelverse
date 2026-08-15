import type Phaser from 'phaser';
import { WORLD_PIXELS } from '../game/constants';
import type {
  FurnitureDefinition,
  FurnitureKind,
  FurniturePrefab,
  GridPoint,
  InteriorDefinition,
  InteriorLayoutClipboard,
  OfficePrefabDefinition,
  WorldDefinition,
} from '../world/types';
import { interiorDefinitionForBuilding } from '../world/interiorDefinitions';
import { CUTAWAY_OPEN_EVENT, publishCutawayState } from '../ui/TestPanel';
import { agentSkinFor } from './assetManifest';
import { agentFrameForSkin } from './agentAnimation';
import { modernOfficeAsset, type ModernOfficeFurnitureKind } from './modernOfficeManifest';
import {
  catalogPage,
  MODERN_OFFICE_CATALOG,
  type ModernOfficeCategory,
} from './modernOfficeCatalog';
import {
  InteriorCutawayDomOverlay,
  selectionCapabilities,
  type CutawayDisclosureState,
  type CutawayRoomLabel,
} from './InteriorCutawayDomOverlay';
import {
  builtInPrefabLabel,
  cutawayMessage,
  cutawayMessageState,
  type CutawayMessageArgs,
  type CutawayMessageId,
  type CutawayMessageState,
  type VillageLocale,
  villageCopy,
} from '../i18n/villageLocale';
import { isBuiltInOfficePrefabId } from './builtInOfficePrefabs';
import {
  commitPlacementCandidate,
  furniturePointFromRenderPoint,
  furnitureRenderGeometry,
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
  readInteriorLayout,
  normalizeFurnitureScale,
  saveInteriorLayout,
  collectAllFurniture,
  requiredHookInventory,
} from './interiorLayoutEditor';
import {
  duplicateSelection,
  expandSelectionClosure,
  previewSelectionMove,
  removeSelection,
  reorderSelection,
  resizeSelectionAtomically,
  rotateSelectionAtomically,
  selectedFurnitureIds,
  shiftSelectionLayer,
  type SelectionMutationResult,
} from './interiorSelection';
import {
  copyDecorativeLayout,
  isBuiltInPrefab,
  pasteDecorativeLayout,
  readAvailablePrefabs,
  readLayoutClipboard,
  saveLayoutClipboard,
} from './interiorPrefabStore';
import { officeLayoutIssues, placeOfficePrefab } from './prefabGeometry';
import {
  cloneFurnitureLayout,
  dissolvePrefabInstance,
  InteriorUndoStore,
} from './interiorUndoStore';
import {
  applyInteriorViewport,
  clampInteriorViewport,
  createInteriorViewport,
  interiorPanEligible,
  panInteriorViewport,
  unapplyInteriorViewport,
  zoomInteriorViewportAt,
  type InteriorViewportRect,
  type InteriorViewportState,
} from './interiorViewport';
import { missingSemanticFurnitureCopy } from './interiorLocale';
import { authoredPlacement, supportedRotations } from './interiorFurnitureScale';
import {
  interiorEditorLayout,
  type InteriorEditorLayout,
  type InteriorEditorLayoutOptions,
} from './interiorEditorLayout';
import { dragPresentation } from './interiorDragPresentation';
import {
  automaticStackRank,
  compareAutomaticStack,
  resolveAutomaticSupport,
  type StackRoleFurniture,
} from './interiorAutoStack';

const BASE_ROOM_CELL = 22;
const CUTAWAY_DEPTH = 100_000;
const GUIDE_DISMISSED_KEY = 'pixelworld:guide-dismissed:v1';

const guideDismissed = (): boolean => {
  try { return typeof localStorage !== 'undefined' && localStorage.getItem(GUIDE_DISMISSED_KEY) === 'true'; }
  catch { return false; }
};

const persistGuideDismissal = (): void => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(GUIDE_DISMISSED_KEY, 'true'); }
  catch { /* The editor remains usable when browser storage is unavailable. */ }
};

export interface CutawayLayout {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function cutawayLayoutForViewport(viewportWidth: number, viewportHeight: number): CutawayLayout {
  return interiorEditorLayout(viewportWidth, viewportHeight, {
    editMode: false,
    catalogExpanded: false,
    inspectorExpanded: false,
  }).frame;
}

export function cutawayLayoutForCanvas(
  viewportWidth: number,
  viewportHeight: number,
  canvasRect?: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): CutawayLayout {
  const displayFrame = cutawayLayoutForViewport(viewportWidth, viewportHeight);
  if (!canvasRect || canvasRect.width <= 0 || canvasRect.height <= 0) return displayFrame;
  const scaleX = canvasRect.width / WORLD_PIXELS.width;
  const scaleY = canvasRect.height / WORLD_PIXELS.height;
  return {
    x: (displayFrame.x - canvasRect.left) / scaleX,
    y: (displayFrame.y - canvasRect.top) / scaleY,
    width: displayFrame.width / scaleX,
    height: displayFrame.height / scaleY,
  };
}

export function editorLayoutForCutaway(
  layout: CutawayLayout,
  options: InteriorEditorLayoutOptions = { editMode: false, catalogExpanded: false, inspectorExpanded: false },
  responsiveFrameWidth = layout.width,
): InteriorEditorLayout {
  const reserved = interiorEditorLayout(layout.width + 16, layout.height + 16, {
    ...options,
  }, responsiveFrameWidth);
  const translate = ({ x, y, width, height }: InteriorViewportRect): InteriorViewportRect => ({
    x: layout.x + x - reserved.frame.x, y: layout.y + y - reserved.frame.y, width, height,
  });
  return {
    frame: translate(reserved.frame), header: translate(reserved.header),
    roomToolbar: translate(reserved.roomToolbar), room: translate(reserved.room),
    catalog: translate(reserved.catalog), inspector: translate(reserved.inspector),
  };
}

export function roomViewportFrameForLayout(
  layout: CutawayLayout,
  options?: InteriorEditorLayoutOptions,
): InteriorViewportRect {
  return editorLayoutForCutaway(layout, options).room;
}

export function cutawayContainsPointer(layout: CutawayLayout, point: GridPoint): boolean {
  return point.x >= layout.x && point.x <= layout.x + layout.width
    && point.y >= layout.y && point.y <= layout.y + layout.height;
}

export function roomCellForLayout(
  room: Pick<InteriorDefinition, 'width' | 'height'>,
  layout: CutawayLayout,
  options?: InteriorEditorLayoutOptions,
): number {
  const frame = roomViewportFrameForLayout(layout, options);
  const fitted = Math.min(frame.width / room.width, frame.height / room.height);
  return fitted < 1 ? fitted : Math.floor(fitted);
}

export function roomOriginForLayout(
  room: Pick<InteriorDefinition, 'width' | 'height'>,
  layout: CutawayLayout,
  cell?: number,
  options?: InteriorEditorLayoutOptions,
): GridPoint {
  const frame = roomViewportFrameForLayout(layout, options);
  const fittedCell = cell ?? roomCellForLayout(room, layout, options);
  return {
    x: Math.round(frame.x + (frame.width - room.width * fittedCell) / 2),
    y: Math.round(frame.y),
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
  furniture: Pick<FurnitureDefinition, 'kind' | 'point' | 'assetId' | 'rotation' | 'scale' | 'footprint' | 'visualOffset'>,
  cell: number,
): GridPoint {
  return furnitureRenderScreenGeometry(roomOrigin, furniture, cell).point;
}

export function furnitureRenderScreenGeometry(
  roomOrigin: GridPoint,
  furniture: Pick<FurnitureDefinition, 'kind' | 'point' | 'assetId' | 'rotation' | 'scale' | 'footprint' | 'visualOffset'>,
  cell: number,
): { point: GridPoint; bounds: { x: number; y: number; width: number; height: number }; baselineY: number } {
  const geometry = furnitureRenderGeometry(furniture);
  const bounds = {
    x: roomOrigin.x + geometry.bounds.x * cell,
    y: roomOrigin.y + geometry.bounds.y * cell,
    width: geometry.bounds.width * cell,
    height: geometry.bounds.height * cell,
  };
  return {
    point: { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    bounds,
    baselineY: roomOrigin.y + geometry.baselineY * cell,
  };
}

export function dragPreviewScreenPoint(roomOrigin: GridPoint, point: GridPoint, cell = BASE_ROOM_CELL): GridPoint {
  return roomScreenPoint(roomOrigin, point, cell);
}

const OCCLUSION_DEPTH = 3_000;

export function interiorAgentRenderDepth(footY: number, tieBreaker: number): number {
  return OCCLUSION_DEPTH + footY + tieBreaker / 1_000;
}

export function stableInteriorAgentIndex(
  assignments: readonly Pick<InteriorOccupantAssignment, 'agentId'>[],
  agentId: string,
): number {
  const sortedIds = [...new Set(assignments.map(({ agentId: id }) => id))].sort((a, b) => a.localeCompare(b));
  return Math.max(1, sortedIds.indexOf(agentId) + 1);
}

export function interiorFurnitureRenderDepth(
  furniture: StackRoleFurniture,
  baselineY: number,
): number {
  return automaticStackRank(furniture) * 1_000 + baselineY;
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

export const hookFurnitureLabel = (
  furniture: FurnitureDefinition,
  locale: VillageLocale = 'zh-TW',
): string => (
  [...new Set(furniture.supportedActions.map((action) => villageCopy(locale).actions[action]))].join(' / ')
);

export const prefabDisplayName = (
  prefab: FurniturePrefab,
  locale: VillageLocale,
): string => (
  isBuiltInPrefab(prefab) && isBuiltInOfficePrefabId(prefab.id)
    ? builtInPrefabLabel(locale, prefab.id)
    : prefab.name
);

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

export interface InteriorCutawaySystemOptions {
  onOpenStateChange?: (open: boolean, buildingId?: string) => void;
}

interface FurnitureDragCapture {
  pointerId: number;
  furnitureId: string;
  selectedIds: string[];
  startLayout: FurnitureDefinition[];
  grabOffset: GridPoint;
}

const pointerIdOf = (pointer: unknown): number => {
  const value = pointer as { id?: number; pointerId?: number } | undefined;
  return value?.id ?? value?.pointerId ?? 0;
};

const reducedMotionPreferred = (): boolean => (
  typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches
);

export class InteriorCutawaySystem {
  private root: Phaser.GameObjects.Container | undefined;
  private roomViewportLayer: Phaser.GameObjects.Container | undefined;
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
  private disclosureState: CutawayDisclosureState = {
    catalogExpanded: false, inspectorExpanded: false, guideMode: false,
  };
  private openId: string | undefined;
  private currentAssignments: InteriorOccupantAssignment[] = [];
  private assignmentSignature = '';
  private missingFeedbackKey: string | undefined;
  private missingFeedbackUntil = 0;
  private missingStatusVisible = false;
  private roomOrigin: GridPoint = { x: 0, y: 0 };
  private roomCell = BASE_ROOM_CELL;
  private currentLayout: CutawayLayout | undefined;
  private currentDragCandidate: PlacementCandidate | undefined;
  private currentDragMutation: SelectionMutationResult | undefined;
  private furnitureDragCapture: FurnitureDragCapture | undefined;
  private furnitureDragCleanup: (() => void) | undefined;
  private contextMenuPointer: GridPoint | undefined;
  private contextMenuSuppressionCleanup: (() => void) | undefined;
  private catalogCategory: ModernOfficeCategory = 'workstations';
  private catalogPageIndex = 0;
  private readonly domOverlay: InteriorCutawayDomOverlay;
  private locale: VillageLocale = 'zh-TW';
  private status: CutawayMessageState = { statusId: 'ready' };
  private readonly undoStore = new InteriorUndoStore([], 20);
  private templatePreview: FurnitureDefinition[] | undefined;
  private templateDiagnostics: Array<'templateInvalid' | 'unreachableHook'> = [];
  private furnitureDomLabels: CutawayRoomLabel[] = [];
  private occupantDomLabels: CutawayRoomLabel[] = [];
  private marqueeCleanup: (() => void) | undefined;
  private viewportResizeObserver: ResizeObserver | undefined;
  private viewportGestureCleanup: (() => void) | undefined;
  private interiorViewport: InteriorViewportState = createInteriorViewport({ x: 0, y: 0, width: 0, height: 0 });
  private readonly occupantViews = new Map<string, {
    sprite: Phaser.GameObjects.Image;
    icon: Phaser.GameObjects.Text;
    bubble: Phaser.GameObjects.Text;
    name: Phaser.GameObjects.Text;
  }>();
  private readonly escapeHandler = (): void => {
    if (this.contextMenuPointer) {
      this.contextMenuPointer = undefined;
      this.syncOverlay();
      return;
    }
    if (this.root && this.disclosureState.guideMode) {
      this.disclosureState.guideMode = false;
      persistGuideDismissal();
      this.syncOverlay();
      this.syncRoomLabels();
      return;
    }
    this.close();
  };
  private readonly resizeHandler = (): void => this.refreshLayout();

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly world: WorldDefinition,
    private readonly viewportProvider: () => { width: number; height: number } = viewport,
    private readonly options: InteriorCutawaySystemOptions = {},
  ) {
    scene.input.keyboard?.on('keydown-ESC', this.escapeHandler);
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', this.resizeHandler);
    }
    this.domOverlay = new InteriorCutawayDomOverlay(() => {
      const canvas = this.scene.game?.canvas;
      return canvas?.getBoundingClientRect();
    });
    const canvas = this.scene.game?.canvas;
    if (canvas && typeof ResizeObserver !== 'undefined') {
      this.viewportResizeObserver = new ResizeObserver(this.resizeHandler);
      this.viewportResizeObserver.observe(canvas);
    }
  }

  open(buildingId: string): void {
    if (this.openId === buildingId && this.root) {
      this.refreshLayout();
      return;
    }
    const building = this.world.buildings.find(({ id }) => id === buildingId);
    if (!building) {
      console.warn(`[pixelworld] cannot open unknown house: ${buildingId}`);
      return;
    }
    const definition = interiorDefinitionForBuilding(building);
    this.closeActive(false);
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
    this.disclosureState = {
      catalogExpanded: false,
      inspectorExpanded: false,
      guideMode: !guideDismissed(),
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
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event(CUTAWAY_OPEN_EVENT));
      const origin = window.location?.origin;
      if (window.parent && window.parent !== window && origin) publishCutawayState(window.parent, true, origin);
    }
    const layout = this.layoutForViewport();
    this.rebuildShell(interior, layout);
    this.installContextMenuSuppression();

    this.status = this.layoutStorageReadFailed || this.prefabStorageReadFailed || this.clipboardStorageReadFailed
      ? { statusId: 'storageFailed' } : { statusId: 'empty' };
    this.domOverlay.open(layout, this.overlayModel(), {
      close: () => this.close(),
      toggleEdit: () => {
        this.editMode = !this.editMode;
        if (!this.editMode) {
          this.contextMenuPointer = undefined;
          this.clearTemplatePreview();
          this.disclosureState.catalogExpanded = false;
          this.disclosureState.inspectorExpanded = false;
        }
        this.setStatus(this.editMode ? 'editingEnabled' : 'editingDisabled');
        this.refreshDisclosureLayout();
      },
      toggleCatalog: () => {
        if (!this.editMode) return;
        const opening = !this.disclosureState.catalogExpanded;
        this.disclosureState.catalogExpanded = opening;
        const current = this.currentLayout ?? this.layoutForViewport();
        if (opening && this.projectedFrameWidth(current) < 620) {
          this.disclosureState.inspectorExpanded = false;
        }
        this.refreshDisclosureLayout();
      },
      toggleInspector: () => {
        if (!this.editMode || !this.selectedFurnitureId) return;
        const opening = !this.disclosureState.inspectorExpanded;
        this.disclosureState.inspectorExpanded = opening;
        const current = this.currentLayout ?? this.layoutForViewport();
        if (opening && this.projectedFrameWidth(current) < 620) {
          this.disclosureState.catalogExpanded = false;
        }
        this.refreshDisclosureLayout();
      },
      toggleGuide: () => {
        this.disclosureState.guideMode = !this.disclosureState.guideMode;
        if (!this.disclosureState.guideMode) persistGuideDismissal();
        this.syncOverlay();
        this.syncRoomLabels();
      },
      fitView: () => {
        const current = this.currentLayout ?? this.layoutForViewport();
        this.interiorViewport = createInteriorViewport(this.roomViewportFrame(current));
        this.applyRoomViewport();
      },
      save: () => {
        if (this.layoutStorageReadFailed) {
          this.setStatus('storageFailed');
          return;
        }
        try {
          if (this.openId && this.activeInterior) saveInteriorLayout(this.openId, this.activeInterior.furniture);
          this.setStatus('saved');
        } catch {
          this.setStatus('storageFailed');
        }
      },
      undo: () => this.undo(interior, layout),
      previewTemplate: () => this.previewTemplate(definition, interior, layout),
      applyTemplate: () => this.applyTemplate(interior, layout),
      collect: () => {
        this.contextMenuPointer = undefined;
        this.commitFurnitureMutation(interior, collectAllFurniture(interior.furniture));
        this.selectedFurnitureIds.clear();
        this.selectedFurnitureId = undefined;
        this.setStatus('collectedAll');
        this.renderFurniture(interior, layout);
      },
      revert: () => {
        if (!this.openId) return;
        const read = readInteriorLayout(this.openId, definition);
        if (read.storageRead === 'failed') {
          this.layoutStorageReadFailed = true;
          this.setStatus('storageFailed');
          return;
        }
        this.layoutStorageReadFailed = false;
        interior.furniture = read.layout;
        this.undoStore.reset(interior.furniture);
        this.clearTemplatePreview();
        this.selectedFurnitureIds.clear();
        this.selectedFurnitureId = undefined;
        this.setStatus('reverted');
        this.renderFurniture(interior, layout);
      },
      copy: () => {
        if (!this.openId) return;
        if (this.clipboardStorageReadFailed) {
          this.setStatus('storageFailed');
          return;
        }
        try {
          const clipboard = copyDecorativeLayout(this.openId, interior.furniture);
          saveLayoutClipboard(clipboard);
          this.clipboard = clipboard;
          this.clipboardStorageReadFailed = false;
          this.setStatus('layoutCopied');
          this.close();
        } catch {
          this.setStatus('storageFailed');
        }
      },
      paste: () => {
        const clipboard = this.clipboard;
        if (!clipboard) return;
        const result = pasteDecorativeLayout(interior, interior.furniture, clipboard);
        if (result.accepted) this.commitFurnitureMutation(interior, result.layout);
        this.setStatus(result.accepted ? 'layoutPasted' : 'layoutPasteRejected');
        this.renderFurniture(interior, layout);
      },
      group: () => { this.contextMenuPointer = undefined; this.groupSelectedDraft(interior, layout); },
      dissolveGroup: () => { this.contextMenuPointer = undefined; this.dissolveSelectedGroup(interior, layout); },
      duplicate: () => { this.contextMenuPointer = undefined; this.duplicateSelected(interior, layout); },
      returnToShelf: () => { this.contextMenuPointer = undefined; this.returnSelectedToShelf(interior, layout); },
      cancelSelection: () => this.cancelSelection(),
      dismissContextMenu: () => {
        if (!this.contextMenuPointer) return;
        this.contextMenuPointer = undefined;
        this.syncOverlay();
      },
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
      resize: (delta) => { this.contextMenuPointer = undefined; this.resizeSelected(interior, layout, delta); },
      rotate: (delta) => { this.contextMenuPointer = undefined; this.rotateSelected(interior, layout, delta); },
    });
    this.syncRoomLabels();
    this.options.onOpenStateChange?.(true, buildingId);
  }

  setLocale(locale: VillageLocale): void {
    this.locale = locale;
    this.domOverlay.setLocale(locale);
    if (this.activeInterior && this.root && this.currentLayout) {
      this.renderFurniture(this.activeInterior, this.currentLayout);
    }
  }

  private clearRenderedShell(): void {
    this.furnitureDragCleanup?.();
    this.furnitureDragCleanup = undefined;
    this.furnitureDragCapture = undefined;
    this.currentDragCandidate = undefined;
    this.currentDragMutation = undefined;
    this.viewportGestureCleanup?.();
    this.viewportGestureCleanup = undefined;
    this.marqueeCleanup?.();
    this.marqueeCleanup = undefined;
    this.roofTween?.stop();
    if (this.roof) this.scene.tweens.killTweensOf(this.roof);
    this.root?.removeAll(true);
    this.root?.destroy();
    this.root = undefined;
    this.roomViewportLayer = undefined;
    this.occupantLayer = undefined;
    this.roof = undefined;
    this.roofTween = undefined;
    this.furnitureLayer = undefined;
    this.paletteLayer = undefined;
    this.occupantViews.clear();
    this.assignmentSignature = '';
  }

  private rebuildShell(interior: InteriorDefinition, layout: CutawayLayout): void {
    const previousLayout = this.currentLayout;
    this.currentLayout = layout;
    const root = this.scene.add.container(0, 0).setDepth(CUTAWAY_DEPTH).setScrollFactor(0);
    this.root = root;
    const backdrop = this.scene.add.rectangle(
      WORLD_PIXELS.width / 2, WORLD_PIXELS.height / 2,
      WORLD_PIXELS.width, WORLD_PIXELS.height, 0x071018, 0.78,
    ).setScrollFactor(0).setInteractive({ useHandCursor: true }).on('pointerdown', (pointer: unknown) => {
      const point = this.pointerScreenPoint(pointer) ?? { x: -1, y: -1 };
      if (!cutawayContainsPointer(this.currentLayout ?? layout, point)) this.close();
    });
    const panel = this.scene.add.rectangle(
      layout.x + layout.width / 2, layout.y + layout.height / 2,
      layout.width, layout.height, 0x17252a, 1,
    ).setStrokeStyle(3, 0xf1d89a, 1).setInteractive();
    root.add([backdrop, panel]);

    const editorOptions = this.editorLayoutOptions();
    this.roomCell = roomCellForLayout(interior, layout, editorOptions);
    this.roomOrigin = roomOriginForLayout(interior, layout, this.roomCell, editorOptions);
    const roomWidth = interior.width * this.roomCell;
    const roomHeight = interior.height * this.roomCell;
    const { x: roomX, y: roomY } = this.roomOrigin;
    const viewportFrame = this.roomViewportFrame(layout);
    const contentBounds = this.roomContentBounds(interior);
    this.interiorViewport = previousLayout
      ? clampInteriorViewport(this.interiorViewport, viewportFrame, contentBounds)
      : createInteriorViewport(viewportFrame);
    const roomViewportLayer = this.scene.add.container(0, 0);
    this.roomViewportLayer = roomViewportLayer;
    const roomMask = this.scene.add.graphics().fillStyle(0xffffff, 1).fillRect(
      viewportFrame.x, viewportFrame.y, viewportFrame.width, viewportFrame.height,
    ).setVisible(false);
    roomViewportLayer.setMask(roomMask.createGeometryMask());
    root.add([roomMask, roomViewportLayer]);
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
    roomViewportLayer.add(room);
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
    roomViewportLayer.add(roof);
    this.roof = roof;
    this.roofTween = this.scene.tweens.add({
      targets: roof, y: roof.y - 20, alpha: 0, duration: 220, ease: 'Stepped',
    });
    this.applyRoomViewport();
    this.installViewportGestures(interior, layout, panel, backdrop);
  }

  private refreshLayout(): void {
    if (!this.activeInterior || !this.root) return;
    const layout = this.layoutForViewport();
    (this.domOverlay as InteriorCutawayDomOverlay & { relayout?: (next: CutawayLayout) => void }).relayout?.(layout);
    if (this.currentLayout && Object.keys(layout).every((key) => (
      layout[key as keyof CutawayLayout] === this.currentLayout![key as keyof CutawayLayout]
    ))) return;
    this.clearRenderedShell();
    this.rebuildShell(this.activeInterior, layout);
    this.syncOverlay();
    this.syncRoomLabels();
  }

  close(): void {
    this.closeActive(true);
  }

  private closeActive(notify: boolean): void {
    const wasOpen = this.openId !== undefined || this.root !== undefined;
    this.contextMenuSuppressionCleanup?.();
    this.contextMenuSuppressionCleanup = undefined;
    this.clearRenderedShell();
    this.domOverlay.close();
    this.selectedFurnitureId = undefined;
    this.selectedFurnitureIds.clear();
    this.activeInterior = undefined;
    this.activeDefinition = undefined;
    this.clipboard = undefined;
    this.layoutStorageReadFailed = false;
    this.prefabStorageReadFailed = false;
    this.clipboardStorageReadFailed = false;
    this.editMode = false;
    this.disclosureState = { catalogExpanded: false, inspectorExpanded: false, guideMode: false };
    this.openId = undefined;
    this.currentAssignments = [];
    this.assignmentSignature = '';
    this.missingFeedbackKey = undefined;
    this.missingFeedbackUntil = 0;
    this.missingStatusVisible = false;
    this.currentDragCandidate = undefined;
    this.currentDragMutation = undefined;
    this.contextMenuPointer = undefined;
    this.roomCell = BASE_ROOM_CELL;
    this.currentLayout = undefined;
    this.interiorViewport = createInteriorViewport({ x: 0, y: 0, width: 0, height: 0 });
    this.status = { statusId: 'ready' };
    this.undoStore.reset([]);
    this.templatePreview = undefined;
    this.templateDiagnostics = [];
    this.furnitureDomLabels = [];
    this.occupantDomLabels = [];
    this.occupantViews.clear();
    if (notify && wasOpen) {
      if (typeof window !== 'undefined') {
        const origin = window.location?.origin;
        if (window.parent && window.parent !== window && origin) publishCutawayState(window.parent, false, origin);
      }
      this.options.onOpenStateChange?.(false);
    }
  }

  update(snapshots: readonly InteriorAgentSnapshot[]): void {
    if (!this.root || !this.openId) return;
    const building = this.world.buildings.find(({ id }) => id === this.openId);
    if (!building) return;
    const interior = this.activeInterior ?? interiorDefinitionForBuilding(building);
    const matchingSnapshots = snapshots.filter(({ buildingId }) => buildingId === building.id);
    const assignments = assignInteriorOccupants(interior, matchingSnapshots, building.id);
    const missingAssignment = assignments.find(({ missingSemantic }) => Boolean(missingSemantic));
    const missingFeedbackKey = missingAssignment?.missingSemantic
      ? `${building.id}:${missingAssignment.missingSemantic}`
      : undefined;
    if (missingFeedbackKey !== this.missingFeedbackKey) {
      this.missingFeedbackKey = missingFeedbackKey;
      this.missingFeedbackUntil = missingFeedbackKey ? this.scene.time.now + 4_000 : 0;
    }
    const missingBubbleOwnerId = missingAssignment?.agentId;
    const signature = assignments.map(({ agentId, role, furnitureId, point, missingSemantic }) => (
      `${agentId}:${role}:${furnitureId ?? `${point.x},${point.y}`}:${missingSemantic ?? ''}`
    )).join('|');
    this.currentAssignments = assignments;
    if (signature !== this.assignmentSignature) {
      this.assignmentSignature = signature;
      this.missingStatusVisible = Boolean(missingAssignment) && this.missingFeedbackActive();
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
      if (assignments.length === 0) this.setStatus('houseEmpty');
      else this.setStatus('houseOccupied', { count: assignments.length });
      if (assignments.length === 0) {
        this.occupantDomLabels = [];
        this.syncRoomLabels();
        return;
      }
      assignments.forEach((assignment, index) => {
        const snapshot = matchingSnapshots.find(({ agentId }) => agentId === assignment.agentId) ?? assignment;
        const motion = interiorMotionAt(snapshot, interior, assignment, this.scene.time.now);
        const skin = agentSkinFor(assignment.agentId, assignment.role);
        const sprite = this.scene.add.image(0, 0, skin.sheet, agentFrameForSkin(skin, motion.facing, false, 0))
          .setOrigin(0.5, 0.82).setDepth(interiorAgentRenderDepth(0, index + 1))
          .setScale(('renderScale' in skin ? skin.renderScale : 1.35) * this.roomCell / BASE_ROOM_CELL);
        const icon = this.scene.add.text(0, 0, actionSymbols[assignment.icon], {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#fff4c2', backgroundColor: '#315348', padding: { x: 3, y: 1 },
        }).setOrigin(0.5).setDepth(CUTAWAY_DEPTH + 20);
        const localizedBubble = assignment.missingSemantic
          ? missingSemanticFurnitureCopy(this.locale, assignment.missingSemantic)
          : villageCopy(this.locale).actions[assignment.action];
        const bubble = this.scene.add.text(0, 0, localizedBubble, {
          fontFamily: 'sans-serif', fontSize: '8px', color: '#263323', backgroundColor: '#fff5c7', padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 1).setDepth(CUTAWAY_DEPTH + 21);
        const name = this.scene.add.text(0, 0, assignment.agentId, {
          fontFamily: 'sans-serif', fontSize: '6px', color: '#fff4c2', backgroundColor: '#41342f', padding: { x: 2, y: 1 },
        }).setOrigin(0.5, 0).setDepth(CUTAWAY_DEPTH + 20);
        icon.setVisible(false);
        bubble.setVisible(assignment.agentId === missingBubbleOwnerId
          && Boolean(assignment.missingSemantic) && this.missingFeedbackActive());
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
      const skin = agentSkinFor(assignment.agentId, assignment.role);
      const frame = agentFrameForSkin(skin, motion.facing, motion.walking, this.scene.time.now);
      view.sprite.setTexture(skin.sheet, frame);
      const point = roomScreenPoint(this.roomOrigin, motion.point, this.roomCell);
      const pixelScale = this.roomCell / BASE_ROOM_CELL;
      const x = point.x;
      const y = point.y + (assignment.seated && motion.phase === 'working' ? 4 * pixelScale : 0)
        + motion.bob * pixelScale;
      view.sprite.setPosition(x, y).setDepth(interiorAgentRenderDepth(
        y,
        stableInteriorAgentIndex(this.currentAssignments, assignment.agentId),
      ));
      view.icon.setPosition(x, y - 21 * pixelScale);
      const localizedBubble = assignment.missingSemantic
        ? missingSemanticFurnitureCopy(this.locale, assignment.missingSemantic)
        : villageCopy(this.locale).actions[assignment.action];
      view.bubble.setPosition(x, y - 31 * pixelScale).setText(localizedBubble)
        .setVisible(assignment.agentId === missingBubbleOwnerId
          && Boolean(assignment.missingSemantic) && this.missingFeedbackActive());
      view.name.setPosition(x, y + 9 * pixelScale);
    });
    this.occupantDomLabels = assignments.flatMap((assignment) => {
      if (assignment.missingSemantic
        && (assignment.agentId !== missingBubbleOwnerId || !this.missingFeedbackActive())) return [];
      const snapshot = matchingSnapshots.find(({ agentId }) => agentId === assignment.agentId) ?? assignment;
      const motion = interiorMotionAt(snapshot, interior, assignment, this.scene.time.now);
      return [{
        id: `agent:${assignment.agentId}`,
        text: `${actionSymbols[assignment.icon]} ${assignment.missingSemantic
          ? missingSemanticFurnitureCopy(this.locale, assignment.missingSemantic)
          : villageCopy(this.locale).actions[assignment.action]}\n${assignment.agentId}`,
        x: roomScreenPoint(this.roomOrigin, motion.point, this.roomCell).x,
        y: roomScreenPoint(this.roomOrigin, motion.point, this.roomCell).y - this.roomCell / 2 - 2 * this.roomCell / BASE_ROOM_CELL,
        kind: 'agent' as const,
      }];
    });
    this.furnitureLayer?.sort('depth');
    this.syncRoomLabels();
    const missingStatusVisible = Boolean(missingAssignment) && this.missingFeedbackActive();
    if (missingStatusVisible !== this.missingStatusVisible) {
      this.missingStatusVisible = missingStatusVisible;
      this.syncOverlay();
    }
  }

  destroy(): void {
    this.close();
    this.viewportResizeObserver?.disconnect();
    this.viewportResizeObserver = undefined;
    this.scene.input.keyboard?.off('keydown-ESC', this.escapeHandler);
    if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
      window.removeEventListener('resize', this.resizeHandler);
    }
  }

  isOpen(): boolean { return this.root !== undefined; }
  openBuildingId(): string | undefined { return this.openId; }
  occupants(): readonly InteriorOccupantAssignment[] { return this.currentAssignments.map((item) => ({ ...item, point: { ...item.point } })); }

  private renderFurniture(interior: InteriorDefinition, layout: CutawayLayout): void {
    layout = this.currentLayout ?? layout;
    this.furnitureDragCleanup?.();
    this.furnitureDragCleanup = undefined;
    this.furnitureDragCapture = undefined;
    this.currentDragCandidate = undefined;
    this.currentDragMutation = undefined;
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
    const editorOptions = this.editorLayoutOptions();
    this.roomCell = roomCellForLayout(interior, layout, editorOptions);
    this.roomOrigin = roomOriginForLayout(interior, layout, this.roomCell, editorOptions);
    const root = this.root;
    const furnitureLayer = this.scene.add.container(0, 0);
    this.furnitureLayer = furnitureLayer;
    (this.roomViewportLayer ?? root).add(furnitureLayer);
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
      const color = candidate.diagnostic === 'valid' ? 0x65d47e : 0xe05b54;
      placementPreview.clear();
      placementPreview.fillStyle(color, 0.24).lineStyle(2, color, 0.96);
      placementPreview.fillRect(
        this.roomOrigin.x + candidate.bounds.x * this.roomCell,
        this.roomOrigin.y + candidate.bounds.y * this.roomCell,
        candidate.bounds.width * this.roomCell,
        candidate.bounds.height * this.roomCell,
      );
      placementPreview.strokeRect(
        this.roomOrigin.x + candidate.bounds.x * this.roomCell,
        this.roomOrigin.y + candidate.bounds.y * this.roomCell,
        candidate.bounds.width * this.roomCell,
        candidate.bounds.height * this.roomCell,
      );
    };

    const drawSelectionPreview = (items: readonly FurnitureDefinition[], valid: boolean): void => {
      const color = valid ? 0x65d47e : 0xe05b54;
      placementPreview.clear();
      placementPreview.fillStyle(color, 0.24).lineStyle(2, color, 0.96);
      items.forEach((item) => {
        const bounds = furnitureRenderScreenGeometry(this.roomOrigin, item, this.roomCell).bounds;
        placementPreview.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);
        placementPreview.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
      });
    };

    const sortedFurniture = [...interior.furniture].sort(compareAutomaticStack);
    const furnitureSprites = new Set<Phaser.GameObjects.Image>();
    const furnitureSpritesById = new Map<string, Phaser.GameObjects.Image>();
    const furnitureSpriteScalesById = new Map<string, number>();
    const furnitureSpriteDepthsById = new Map<string, number>();
    const restoreFurnitureOrder = (): void => { furnitureLayer.sort('depth'); };
    const liftDragVisuals = (ids: readonly string[]): void => {
      ids.map((id) => furnitureSpritesById.get(id)).filter((sprite): sprite is Phaser.GameObjects.Image => Boolean(sprite))
        .sort((first, second) => first.depth - second.depth)
        .forEach((sprite) => furnitureLayer.bringToTop(sprite));
      furnitureLayer.bringToTop(placementPreview);
    };
    const setCanvasDragState = (active: boolean, tone: 'neutral' | 'valid' | 'invalid' = 'neutral'): void => {
      const canvas = this.scene.game?.canvas;
      if (!canvas?.dataset) return;
      if (active) {
        canvas.dataset.interiorDragging = 'true';
        canvas.dataset.interiorDragTone = tone;
      } else {
        delete canvas.dataset.interiorDragging;
        delete canvas.dataset.interiorDragTone;
      }
    };
    const applyDragPresentation = (
      ids: readonly string[],
      diagnostic: PlacementCandidate['diagnostic'],
      phase: Parameters<typeof dragPresentation>[1],
    ): void => {
      const presentation = dragPresentation(diagnostic, phase, reducedMotionPreferred());
      for (const id of ids) {
        const sprite = furnitureSpritesById.get(id);
        const scale = furnitureSpriteScalesById.get(id);
        const depth = furnitureSpriteDepthsById.get(id);
        if (!sprite || scale === undefined || depth === undefined) continue;
        sprite.setScale(scale * presentation.scale).setAlpha(presentation.alpha);
        if (presentation.tone === 'neutral') sprite.clearTint().setDepth(depth);
        else sprite.setTint(presentation.tone === 'valid' ? 0x65d47e : 0xe05b54).setDepth(depth + 10_000);
      }
      if (presentation.tone === 'neutral') restoreFurnitureOrder();
      else liftDragVisuals(ids);
      setCanvasDragState(phase !== 'idle', presentation.tone);
    };
    const clearFurnitureDrag = (): void => {
      const capture = this.furnitureDragCapture;
      if (capture) {
        for (const item of capture.startLayout.filter(({ id }) => capture.selectedIds.includes(id))) {
          const point = furnitureRenderScreenPoint(this.roomOrigin, item, this.roomCell);
          furnitureSpritesById.get(item.id)?.setPosition(point.x, point.y);
        }
        applyDragPresentation(capture.selectedIds, 'valid', 'idle');
      }
      placementPreview.clear();
      this.furnitureDragCapture = undefined;
      this.currentDragCandidate = undefined;
      this.currentDragMutation = undefined;
      setCanvasDragState(false);
    };
    const input = this.scene.input as Phaser.Input.InputPlugin & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      off?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    const cancelPointer = (pointer: unknown): void => {
      if (!this.furnitureDragCapture || pointerIdOf(pointer) !== this.furnitureDragCapture.pointerId) return;
      clearFurnitureDrag();
    };
    const releasePointer = (pointer: unknown): void => {
      if (!this.furnitureDragCapture || this.currentDragMutation) return;
      if (pointerIdOf(pointer) === this.furnitureDragCapture.pointerId) clearFurnitureDrag();
    };
    input.on?.('pointercancel', cancelPointer);
    input.on?.('pointerup', releasePointer);
    this.furnitureDragCleanup = () => {
      input.off?.('pointercancel', cancelPointer);
      input.off?.('pointerup', releasePointer);
      clearFurnitureDrag();
    };
    for (const furniture of sortedFurniture) {
      const geometry = furnitureRenderScreenGeometry(this.roomOrigin, furniture, this.roomCell);
      const point = geometry.point;
      const catalog = resolvedFurnitureAsset(furniture);
      const assetKey = catalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const originX = catalog ? (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32 : 0.5;
      const originY = catalog ? (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48 : 0.5;
      const spriteScale = normalizeFurnitureScale(furniture.scale) * this.roomCell / BASE_ROOM_CELL;
      const sprite = this.scene.add.image(point.x, point.y, assetKey).setPosition(point.x, point.y).setOrigin(originX, originY)
        .setScale(spriteScale)
        .setAngle(furniture.rotation ?? 0).setDepth(interiorFurnitureRenderDepth(furniture, geometry.baselineY));
      furnitureLayer.add(sprite);
      if (!this.editMode) continue;
      sprite.setInteractive({ useHandCursor: true, draggable: true });
      furnitureSprites.add(sprite);
      furnitureSpritesById.set(furniture.id, sprite);
      furnitureSpriteScalesById.set(furniture.id, spriteScale);
      furnitureSpriteDepthsById.set(furniture.id, sprite.depth);
      this.scene.input.setDraggable(sprite);
      sprite.on('pointerdown', (pointer: unknown) => {
        if (this.furnitureDragCapture) return;
        const button = (pointer as { button?: number }).button ?? 0;
        if (button === 2) {
          (pointer as { event?: { preventDefault?: () => void } }).event?.preventDefault?.();
          if (this.contextMenuPointer) {
            this.contextMenuPointer = undefined;
            this.syncOverlay();
            return;
          }
          if (!this.selectedFurnitureIds.has(furniture.id)) {
            this.selectedFurnitureId = furniture.id;
            this.selectedFurnitureIds.clear();
            expandSelectionClosure(interior.furniture, [furniture.id])
              .forEach((id) => this.selectedFurnitureIds.add(id));
          }
          this.contextMenuPointer = this.pointerScreenPoint(pointer);
          this.syncOverlay();
          return;
        }
        if (button !== 0) return;
        this.contextMenuPointer = undefined;
        this.selectedFurnitureId = furniture.id;
        this.selectedFurnitureIds.clear();
        const selectedIds = expandSelectionClosure(interior.furniture, [furniture.id]);
        selectedIds.forEach((id) => this.selectedFurnitureIds.add(id));
        const screen = this.pointerScreenPoint(pointer);
        const rendered = applyInteriorViewport(this.interiorViewport, { x: sprite.x, y: sprite.y });
        this.furnitureDragCapture = {
          pointerId: pointerIdOf(pointer),
          furnitureId: furniture.id,
          selectedIds,
          startLayout: cloneFurnitureLayout(interior.furniture),
          grabOffset: screen ? { x: screen.x - rendered.x, y: screen.y - rendered.y } : { x: 0, y: 0 },
        };
        this.currentDragCandidate = undefined;
        this.currentDragMutation = undefined;
        applyDragPresentation(selectedIds, 'valid', 'lifting');
        this.syncOverlay();
      });
      sprite.on('dragstart', (pointer: unknown) => {
        const capture = this.furnitureDragCapture;
        if (!capture || capture.furnitureId !== furniture.id || capture.pointerId !== pointerIdOf(pointer)) return;
        applyDragPresentation(capture.selectedIds, 'valid', 'lifting');
      });
      sprite.on('drag', (pointer: unknown, dragX: number, dragY: number) => {
        const capture = this.furnitureDragCapture;
        if (!capture || capture.furnitureId !== furniture.id || pointerIdOf(pointer) !== capture.pointerId) return;
        const source = capture.startLayout.find(({ id }) => id === furniture.id);
        if (!source) return;
        const pointerPoint = this.pointerScreenPoint(pointer);
        const screen = pointerPoint
          ? {
              x: pointerPoint.x - capture.grabOffset.x,
              y: pointerPoint.y - capture.grabOffset.y,
            }
          : { x: dragX, y: dragY };
        const requested = furniturePointFromRenderPoint(source, this.roomPoint(screen.x, screen.y));
        this.currentDragCandidate = resolvePlacementCandidate(
          interior, capture.startLayout, source, requested, furniture.id,
        );
        this.currentDragMutation = previewSelectionMove(interior, capture.startLayout, capture.selectedIds, {
          x: requested.x - source.point.x,
          y: requested.y - source.point.y,
        });
        const selected = new Set(capture.selectedIds);
        const preview = this.currentDragMutation.layout.filter(({ id }) => selected.has(id));
        const draggedPreview = preview.find(({ id }) => id === furniture.id);
        if (draggedPreview) this.currentDragCandidate = { ...this.currentDragCandidate, furniture: draggedPreview };
        preview.forEach((item) => {
          const point = furnitureRenderScreenPoint(this.roomOrigin, item, this.roomCell);
          furnitureSpritesById.get(item.id)?.setPosition(point.x, point.y);
        });
        const diagnostic = this.currentDragMutation.accepted ? 'valid'
          : this.currentDragCandidate.diagnostic === 'valid' ? 'outside-room' : this.currentDragCandidate.diagnostic;
        applyDragPresentation(capture.selectedIds, diagnostic, 'dragging');
        drawSelectionPreview(preview, this.currentDragMutation.accepted);
      });
      sprite.on('dragend', (pointer: unknown) => {
        const capture = this.furnitureDragCapture;
        if (!capture || capture.furnitureId !== furniture.id || capture.pointerId !== pointerIdOf(pointer)) return;
        const mutation = this.currentDragMutation;
        const accepted = mutation?.accepted === true;
        const diagnostic = !accepted && this.currentDragCandidate?.diagnostic === 'valid'
          ? 'outside-room'
          : this.currentDragCandidate?.diagnostic ?? 'outside-room';
        if (accepted) setCanvasDragState(true, 'valid');
        else applyDragPresentation(capture.selectedIds, diagnostic, 'returning');
        if (mutation && accepted) this.commitFurnitureMutation(interior, mutation.layout);
        if (accepted) this.setStatus('moveApplied');
        else this.setStatus('placementRejected', { diagnostic });
        const finish = (): void => {
          if (this.furnitureDragCapture !== capture) return;
          this.furnitureDragCapture = undefined;
          this.currentDragMutation = undefined;
          this.currentDragCandidate = undefined;
          setCanvasDragState(false);
          this.renderFurniture(interior, layout);
        };
        const presentation = dragPresentation(diagnostic, accepted ? 'settling' : 'returning', reducedMotionPreferred());
        const returns = capture.selectedIds.flatMap((id) => {
          const selectedSprite = furnitureSpritesById.get(id);
          const item = capture.startLayout.find((candidate) => candidate.id === id);
          return selectedSprite && item ? [{
            sprite: selectedSprite,
            point: furnitureRenderScreenPoint(this.roomOrigin, item, this.roomCell),
          }] : [];
        });
        const settles = capture.selectedIds.flatMap((id) => {
          const selectedSprite = furnitureSpritesById.get(id);
          const scale = furnitureSpriteScalesById.get(id);
          return selectedSprite && scale !== undefined ? [{ sprite: selectedSprite, scale }] : [];
        });
        if (accepted && settles.length > 0 && presentation.durationMs > 0) {
          this.scene.tweens.add({
            targets: settles.map(({ sprite: target }) => target),
            scaleX: (_target: unknown, _key: string, _value: number, index: number) => settles[index]!.scale,
            scaleY: (_target: unknown, _key: string, _value: number, index: number) => settles[index]!.scale,
            alpha: 1,
            duration: presentation.durationMs,
            ease: 'Back.easeOut',
            onComplete: finish,
          });
          return;
        }
        if (!accepted && returns.length > 0 && presentation.durationMs > 0) {
          this.scene.tweens.add({
            targets: returns.map(({ sprite: target }) => target),
            x: (_target: unknown, _key: string, _value: number, index: number) => returns[index]!.point.x,
            y: (_target: unknown, _key: string, _value: number, index: number) => returns[index]!.point.y,
            alpha: 1,
            duration: presentation.durationMs,
            ease: 'Quad.easeOut',
            onComplete: finish,
          });
          return;
        }
        finish();
      });
    }

    for (const furniture of this.templatePreview ?? []) {
      const geometry = furnitureRenderScreenGeometry(this.roomOrigin, furniture, this.roomCell);
      const point = geometry.point;
      const catalog = resolvedFurnitureAsset(furniture);
      const assetKey = catalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const originX = catalog ? (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32 : 0.5;
      const originY = catalog ? (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48 : 0.5;
      furnitureLayer.add(this.scene.add.image(point.x, point.y, assetKey).setOrigin(originX, originY)
        .setScale(normalizeFurnitureScale(furniture.scale) * this.roomCell / BASE_ROOM_CELL)
        .setAngle(furniture.rotation ?? 0).setDepth(interiorFurnitureRenderDepth(furniture, geometry.baselineY)).setAlpha(0.36));
    }
    furnitureLayer.sort('depth');

    const contextualFurnitureIds = new Set([
      this.selectedFurnitureId,
      ...this.currentAssignments.map(({ furnitureId }) => furnitureId),
    ].filter((id): id is string => Boolean(id)));
    this.furnitureDomLabels = interior.furniture.flatMap((furniture): CutawayRoomLabel[] => {
      const label = hookFurnitureLabel(furniture, this.locale);
      if (!label || !contextualFurnitureIds.has(furniture.id)) return [];
      return [{
        id: `hook:${furniture.id}`, text: label,
        x: furnitureRenderScreenPoint(this.roomOrigin, furniture, this.roomCell).x,
        y: furnitureRenderScreenPoint(this.roomOrigin, furniture, this.roomCell).y + 18 * this.roomCell / BASE_ROOM_CELL,
        kind: 'hook',
        selected: this.selectedFurnitureIds.has(furniture.id),
      }];
    });
    this.syncRoomLabels();

    if (this.editMode) this.installMarqueeSelection(interior, layout, furnitureLayer, furnitureSprites);

    if (!this.editMode) return;
    if (!this.disclosureState.catalogExpanded) {
      this.syncOverlay();
      return;
    }
    const palette = this.scene.add.container(0, 0);
    this.paletteLayer = palette;
    root.add(palette);
    const rootPointForPointer = (pointer: unknown): GridPoint | undefined => this.pointerScreenPoint(pointer);
    const page = catalogPage(this.catalogCategory, this.catalogPageIndex, 12);
    const required = requiredHookInventory(this.activeDefinition ?? interior, interior.furniture);
    const catalogBounds = this.reservedEditorLayout(layout).catalog;
    const slotSpacing = Math.min(34, (catalogBounds.width - 30) / 11);
    const startX = catalogBounds.x + (catalogBounds.width - slotSpacing * 11) / 2;
    const shelfY = catalogBounds.y + catalogBounds.height - 42;
    const missingRequired = required.filter(({ placed }) => !placed);
    missingRequired.slice(0, 12).forEach(({ furniture }, index) => {
      const catalog = resolvedFurnitureAsset(furniture);
      const assetKey = catalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(furniture.kind)).key;
      const originX = catalog ? (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32 : 0.5;
      const originY = catalog ? (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48 : 0.5;
      const itemX = startX + index * slotSpacing;
      const item = this.scene.add.image(itemX, shelfY, assetKey)
        .setPosition(itemX, shelfY).setOrigin(originX, originY).setScale(0.68).setTint(0xffd36b);
      this.wireFurnitureSource(item, furniture, assetKey, originX, originY, interior, layout, furnitureLayer, `Hook: ${hookFurnitureLabel(furniture, this.locale)}`);
      palette.add(item);
    });
    const prefabOffset = Math.min(12, missingRequired.length);
    this.prefabs.slice(0, Math.max(0, 12 - prefabOffset)).forEach((prefab, index) => {
      const prefabName = prefabDisplayName(prefab, this.locale);
      const points = prefab.items.map((part) => {
        const { center } = furnitureRenderGeometry(part);
        return { x: center.x - 0.5, y: center.y - 0.5 };
      });
      const minX = Math.min(...points.map(({ x }) => x));
      const maxX = Math.max(...points.map(({ x }) => x));
      const minY = Math.min(...points.map(({ y }) => y));
      const maxY = Math.max(...points.map(({ y }) => y));
      const centerX = (minX + maxX) / 2;
      const centerY = (minY + maxY) / 2;
      const previewScale = Math.min(0.68, 26 / (Math.max(maxX - minX + 1, maxY - minY + 1) * this.roomCell));
      const itemX = startX + (prefabOffset + index) * slotSpacing;
      const item = this.scene.add.container(itemX, shelfY).setPosition(itemX, shelfY).setSize(30, 30);
      const outline = this.scene.add.graphics().lineStyle(1, 0x8ee8ff, 0.95).strokeRect(-14, -14, 28, 28);
      const nameLabel = this.scene.add.text(0, -17, prefabName, {
        fontFamily: 'sans-serif', fontSize: '7px', color: '#fff5c7', backgroundColor: '#27452dee',
        padding: { x: 3, y: 2 },
      }).setOrigin(0.5, 1).setVisible(false);
      item.add([outline, nameLabel]);
      prefab.items.forEach((part) => {
        const partCatalog = resolvedFurnitureAsset(part);
        const partKey = partCatalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(part.kind)).key;
        const partOriginX = partCatalog ? (partCatalog.opaqueBounds.x + partCatalog.opaqueBounds.width / 2) / 32 : 0.5;
        const partOriginY = partCatalog ? (partCatalog.opaqueBounds.y + partCatalog.opaqueBounds.height / 2) / 48 : 0.5;
        const { center } = furnitureRenderGeometry(part);
        item.add(this.scene.add.image(
          (center.x - 0.5 - centerX) * this.roomCell * previewScale,
          (center.y - 0.5 - centerY) * this.roomCell * previewScale,
          partKey,
        ).setOrigin(partOriginX, partOriginY)
          .setScale(normalizeFurnitureScale(part.scale) * this.roomCell / BASE_ROOM_CELL * previewScale)
          .setAngle(part.rotation ?? 0));
      });
      item.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(item);
      item.on('pointerover', () => nameLabel.setVisible(true));
      item.on('pointerout', () => nameLabel.setVisible(false));
      let ghosts: Phaser.GameObjects.Image[] = [];
      let lastPointerAnchor: { screen: GridPoint; room: GridPoint } | undefined;
      const capturePointerAnchor = (pointer: unknown) => {
        const screen = rootPointForPointer(pointer);
        if (!screen) return undefined;
        lastPointerAnchor = {
          screen: unapplyInteriorViewport(this.interiorViewport, screen),
          room: this.roomPoint(screen.x, screen.y),
        };
        return lastPointerAnchor;
      };
      const createGhosts = (x: number, y: number): Phaser.GameObjects.Image[] => prefab.items.map((part) => {
          const partCatalog = resolvedFurnitureAsset(part);
          const partKey = partCatalog?.key ?? modernOfficeAsset(modernOfficeKindForFurniture(part.kind)).key;
          const partOriginX = partCatalog ? (partCatalog.opaqueBounds.x + partCatalog.opaqueBounds.width / 2) / 32 : 0.5;
          const partOriginY = partCatalog ? (partCatalog.opaqueBounds.y + partCatalog.opaqueBounds.height / 2) / 48 : 0.5;
          const { offset } = furnitureRenderGeometry(part);
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
        nameLabel.setVisible(true);
        const anchor = capturePointerAnchor(pointer);
        ghosts = anchor ? createGhosts(anchor.screen.x, anchor.screen.y) : [];
      });
      item.on('drag', (pointer: unknown) => {
        const anchor = capturePointerAnchor(pointer);
        if (!anchor) return;
        if (ghosts.length === 0) ghosts = createGhosts(anchor.screen.x, anchor.screen.y);
        ghosts.forEach((ghost, partIndex) => {
          const part = prefab.items[partIndex]!;
          const { offset } = furnitureRenderGeometry(part);
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
        if (result?.accepted) this.setStatus('prefabPlaced', { name: prefabName });
        else this.setStatus('prefabRejected');
        ghosts.forEach((ghost) => ghost.destroy());
        ghosts = [];
        lastPointerAnchor = undefined;
        this.renderFurniture(interior, layout);
      });
      palette.add(item);
    });
    page.items.forEach((catalog, index) => {
      const authored = authoredPlacement(catalog.id);
      const x = startX + index * slotSpacing;
      const y = shelfY + 24;
      const originX = (catalog.opaqueBounds.x + catalog.opaqueBounds.width / 2) / 32;
      const originY = (catalog.opaqueBounds.y + catalog.opaqueBounds.height / 2) / 48;
      const item = this.scene.add.image(x, y, catalog.key).setPosition(x, y).setOrigin(originX, originY).setScale(0.68);
      item.setInteractive({ useHandCursor: true, draggable: true });
      this.scene.input.setDraggable(item);
      let dragClone: Phaser.GameObjects.Image | undefined;
      item.on('dragstart', () => {
        dragClone = this.scene.add.image(item.x, item.y, catalog.key).setOrigin(originX, originY)
          .setScale(authored.scale * this.roomCell / BASE_ROOM_CELL).setAngle(authored.rotation).setAlpha(0.88);
        furnitureLayer.add(dragClone);
      });
      item.on('drag', (pointer: unknown, dragX: number, dragY: number) => {
        if (!dragClone) {
          dragClone = this.scene.add.image(dragX, dragY, catalog.key).setOrigin(originX, originY)
            .setScale(authored.scale * this.roomCell / BASE_ROOM_CELL).setAngle(authored.rotation).setAlpha(0.88);
          furnitureLayer.add(dragClone);
        }
        const screen = this.pointerScreenPoint(pointer) ?? { x: dragX, y: dragY };
        const renderPoint = this.roomPoint(screen.x, screen.y);
        const preview: FurnitureDefinition = {
          id: `custom-office-${catalog.id}-${Date.now()}`, kind: 'decor', point: { x: 0, y: 0 },
          facing: 'up', supportedActions: [], icon: 'generic', ...authored,
          assetId: catalog.id, footprint: { ...catalog.footprint },
          visualOffset: { x: catalog.visualOffset.x / 16, y: catalog.visualOffset.y / 16 },
        };
        preview.point = furniturePointFromRenderPoint(preview, renderPoint);
        const placement = resolvePlacementCandidate(interior, interior.furniture, preview, preview.point);
        this.currentDragCandidate = {
          ...placement,
          furniture: resolveAutomaticSupport(placement.furniture, interior.furniture).item,
        };
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
        if (accepted) this.setStatus('catalogAdded', { label: catalog.label });
        else this.setStatus('placementRejected', { diagnostic: candidate?.diagnostic ?? 'outside-room' });
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
    return roomPointForScreen(
      this.roomOrigin,
      unapplyInteriorViewport(this.interiorViewport, { x, y }),
      this.roomCell,
    );
  }

  private pointerScreenPoint(pointer: unknown): GridPoint | undefined {
    const value = pointer as Phaser.Input.Pointer | undefined;
    const root = this.root;
    if (!root || !value || typeof value.positionToCamera !== 'function') return undefined;
    const camera = value.camera ?? this.scene.cameras.main;
    const worldPoint = value.positionToCamera(camera) as GridPoint;
    const point = root.getLocalPoint(worldPoint.x, worldPoint.y, undefined, camera);
    return Number.isFinite(point.x) && Number.isFinite(point.y) ? { x: point.x, y: point.y } : undefined;
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
    item.on('drag', (pointer: unknown, dragX: number, dragY: number) => {
      const screen = this.pointerScreenPoint(pointer) ?? { x: dragX, y: dragY };
      const preview: FurnitureDefinition = {
        ...template,
        point: furniturePointFromRenderPoint(template, this.roomPoint(screen.x, screen.y)),
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
      if (candidate?.diagnostic === 'valid') this.setStatus('hookPlaced', { label });
      else this.setStatus('hookRejected');
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
    let owner: { pointerId: number; start: GridPoint } | undefined;
    const pointOf = (pointer: unknown): GridPoint => {
      const point = this.pointerScreenPoint(pointer) ?? { x: 0, y: 0 };
      return this.roomPoint(point.x, point.y);
    };
    const inside = (point: GridPoint): boolean => point.x >= -0.5 && point.y >= -0.5
      && point.x <= interior.width - 0.5 && point.y <= interior.height - 0.5;
    const down = (pointer: unknown, hitObjects: unknown): void => {
      const button = (pointer as { button?: number }).button ?? 0;
      const point = pointOf(pointer);
      const hits = Array.isArray(hitObjects) ? hitObjects : [];
      if (hits.some((object) => furnitureSprites.has(object as Phaser.GameObjects.Image)) || !inside(point)) return;
      if (button === 2) {
        (pointer as { event?: { preventDefault?: () => void } }).event?.preventDefault?.();
        if (this.contextMenuPointer) {
          this.contextMenuPointer = undefined;
          this.syncOverlay();
        }
        return;
      }
      if (button !== 0) return;
      if (this.contextMenuPointer) {
        this.contextMenuPointer = undefined;
        this.syncOverlay();
      }
      owner = { pointerId: pointerIdOf(pointer), start: point };
      this.setStatus('marqueeSelecting');
    };
    const move = (pointer: unknown): void => {
      if (!owner || pointerIdOf(pointer) !== owner.pointerId) return;
      const end = pointOf(pointer);
      marquee.clear().fillStyle(0x79d9ff, 0.16).fillRect(
        this.roomOrigin.x + Math.min(owner.start.x, end.x) * this.roomCell + this.roomCell / 2,
        this.roomOrigin.y + Math.min(owner.start.y, end.y) * this.roomCell + this.roomCell / 2,
        Math.abs(end.x - owner.start.x) * this.roomCell,
        Math.abs(end.y - owner.start.y) * this.roomCell,
      );
    };
    const up = (pointer: unknown): void => {
      if (!owner || pointerIdOf(pointer) !== owner.pointerId) return;
      const end = pointOf(pointer);
      const rect = {
        x: Math.min(owner.start.x, end.x) + 0.5,
        y: Math.min(owner.start.y, end.y) + 0.5,
        width: Math.abs(end.x - owner.start.x),
        height: Math.abs(end.y - owner.start.y),
      };
      this.selectedFurnitureIds.clear();
      selectedFurnitureIds(rect, interior.furniture).forEach((id) => this.selectedFurnitureIds.add(id));
      this.selectedFurnitureId = [...this.selectedFurnitureIds][0];
      owner = undefined;
      marquee.clear();
      this.setStatus('selectionCompleted', { count: this.selectedFurnitureIds.size });
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
    const grouped = selection.length > 1 && Boolean(selectedInstanceId)
      && selection.every(({ prefabInstanceId }) => prefabInstanceId === selectedInstanceId);
    const selectionBounds = selection.length > 0
      ? selection.map((item) => furnitureRenderScreenGeometry(this.roomOrigin, item, this.roomCell).bounds)
        .map((bounds) => {
          const topLeft = applyInteriorViewport(this.interiorViewport, bounds);
          const bottomRight = applyInteriorViewport(this.interiorViewport, {
            x: bounds.x + bounds.width, y: bounds.y + bounds.height,
          });
          return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
        }).reduce((combined, bounds) => {
          const x = Math.min(combined.x, bounds.x);
          const y = Math.min(combined.y, bounds.y);
          return {
            x, y,
            width: Math.max(combined.x + combined.width, bounds.x + bounds.width) - x,
            height: Math.max(combined.y + combined.height, bounds.y + bounds.height) - y,
          };
        })
      : undefined;
    const activeMissing = this.missingFeedbackActive()
      ? this.currentAssignments.find(({ missingSemantic }) => Boolean(missingSemantic))
      : undefined;
    return {
      titleId: this.activeInterior?.id ?? 'rest-cabin',
      title: this.activeInterior?.label ?? '', ...this.status,
      editMode: this.editMode,
      ...this.disclosureState,
      ...(this.currentLayout ? { editorLayout: this.reservedEditorLayout(this.currentLayout) } : {}),
      ...(selectionBounds ? { selectionBounds } : {}),
      ...(this.contextMenuPointer && selection.length > 0 ? { contextMenu: {
        pointer: { ...this.contextMenuPointer },
        selection: {
          itemIds: selection.map(({ id }) => id),
          grouped,
          canRotate: selection.every((item) => supportedRotations(item.assetId).length > 1),
        },
      } } : {}),
      ...(activeMissing?.missingSemantic ? { missingSemantic: activeMissing.missingSemantic } : {}),
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
      ...(selected ? { selected: {
        label: hookFurnitureLabel(selected, this.locale) || catalog?.label || furnitureLabel(selected.kind),
        scale: normalizeFurnitureScale(selected.scale), rotation: selected.rotation ?? 0,
        layer: selected.layer ?? 'furniture',
      } } : {}),
    };
  }

  private syncOverlay(): void { this.domOverlay.update(this.overlayModel()); }
  private missingFeedbackActive(): boolean {
    return Boolean(this.missingFeedbackKey) && this.scene.time.now < this.missingFeedbackUntil;
  }
  private setStatus<K extends CutawayMessageId>(id: K, ...args: CutawayMessageArgs<K>): void {
    const unresolvedStorageRead = this.layoutStorageReadFailed
      || this.prefabStorageReadFailed
      || this.clipboardStorageReadFailed;
    this.status = unresolvedStorageRead
      ? { statusId: 'storageFailed' }
      : cutawayMessageState(id, ...args);
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
    this.setStatus('undoApplied');
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
    this.setStatus(diagnostics.size === 0 ? 'templatePreviewReady' : 'templateInvalid');
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
    this.setStatus('templateApplied');
    this.renderFurniture(interior, layout);
  }

  private dissolveSelectedGroup(interior: InteriorDefinition, layout: CutawayLayout): void {
    const selection = interior.furniture.filter(({ id }) => this.selectedFurnitureIds.has(id));
    const instanceId = selection[0]?.prefabInstanceId;
    if (!instanceId || !selection.every(({ prefabInstanceId }) => prefabInstanceId === instanceId)) return;
    this.commitFurnitureMutation(interior, dissolvePrefabInstance(interior.furniture, instanceId));
    this.setStatus('groupDissolved');
    this.renderFurniture(interior, layout);
  }

  private syncRoomLabels(): void {
    this.domOverlay.setRoomLabels([...this.furnitureDomLabels, ...this.occupantDomLabels].map((label) => ({
      ...label,
      ...applyInteriorViewport(this.interiorViewport, label),
    })));
  }

  private roomViewportFrame(layout: CutawayLayout): InteriorViewportRect {
    return this.reservedEditorLayout(layout).room;
  }

  private projectedFrameWidth(layout: CutawayLayout): number {
    const canvasRect = this.scene.game?.canvas?.getBoundingClientRect?.();
    if (!canvasRect || !Number.isFinite(canvasRect.width) || canvasRect.width <= 0) return layout.width;
    return layout.width / WORLD_PIXELS.width * canvasRect.width;
  }

  private reservedEditorLayout(
    layout: CutawayLayout,
    options: InteriorEditorLayoutOptions = this.editorLayoutOptions(),
  ): InteriorEditorLayout {
    return editorLayoutForCutaway(layout, options, this.projectedFrameWidth(layout));
  }

  private editorLayoutOptions(): InteriorEditorLayoutOptions {
    return {
      editMode: this.editMode,
      catalogExpanded: this.disclosureState.catalogExpanded,
      inspectorExpanded: this.disclosureState.inspectorExpanded,
    };
  }

  private refreshDisclosureLayout(): void {
    if (!this.activeInterior || !this.root) {
      this.syncOverlay();
      return;
    }
    const layout = this.layoutForViewport();
    this.clearRenderedShell();
    this.rebuildShell(this.activeInterior, layout);
    this.domOverlay.relayout(layout);
    this.syncRoomLabels();
  }

  private roomContentBounds(interior: InteriorDefinition): InteriorViewportRect {
    return {
      x: this.roomOrigin.x - 16,
      y: this.roomOrigin.y - 12,
      width: interior.width * this.roomCell + 32,
      height: interior.height * this.roomCell + 24,
    };
  }

  private layoutForViewport(): CutawayLayout {
    const size = this.viewportProvider();
    return cutawayLayoutForCanvas(
      size.width,
      size.height,
      this.scene.game?.canvas?.getBoundingClientRect?.(),
    );
  }

  private applyRoomViewport(): void {
    const layer = this.roomViewportLayer;
    if (!layer) return;
    const state = this.interiorViewport;
    layer.setPosition(
      state.anchorX * (1 - state.zoom) + state.panX,
      state.anchorY * (1 - state.zoom) + state.panY,
    ).setScale(state.zoom);
    this.syncOverlay();
    this.syncRoomLabels();
  }

  private installContextMenuSuppression(): void {
    this.contextMenuSuppressionCleanup?.();
    const canvas = this.scene.game?.canvas;
    if (!canvas || typeof canvas.addEventListener !== 'function') return;
    const suppress = (event: Event): void => { event.preventDefault(); };
    canvas.addEventListener('contextmenu', suppress);
    this.contextMenuSuppressionCleanup = () => canvas.removeEventListener('contextmenu', suppress);
  }

  private installViewportGestures(
    interior: InteriorDefinition,
    layout: CutawayLayout,
    panel: Phaser.GameObjects.Rectangle,
    backdrop: Phaser.GameObjects.Rectangle,
  ): void {
    const input = this.scene.input as Phaser.Input.InputPlugin & {
      on?: (event: string, handler: (...args: unknown[]) => void) => void;
      off?: (event: string, handler: (...args: unknown[]) => void) => void;
    };
    if (!input.on || !input.off) return;
    let drag: { pointerId: number; x: number; y: number; committed: boolean } | undefined;
    const wheel = (pointer: unknown, _hits: unknown, _deltaX: number, deltaY: number): void => {
      const point = this.pointerScreenPoint(pointer);
      if (!point || !cutawayContainsPointer(this.currentLayout ?? layout, point) || deltaY === 0) return;
      const frame = this.roomViewportFrame(this.currentLayout ?? layout);
      if (point.y < frame.y || point.y > frame.y + frame.height) return;
      this.interiorViewport = zoomInteriorViewportAt(
        this.interiorViewport,
        point,
        this.interiorViewport.zoom * Math.exp(-deltaY * 0.0012),
        frame,
        this.roomContentBounds(interior),
      );
      (pointer as { event?: { preventDefault?: () => void } }).event?.preventDefault?.();
      this.applyRoomViewport();
    };
    const down = (pointer: unknown, hitObjects: unknown): void => {
      const value = pointer as Phaser.Input.Pointer & { button?: number; id?: number; pointerId?: number };
      const point = this.pointerScreenPoint(pointer);
      if (!point) return;
      const hits = Array.isArray(hitObjects) ? hitObjects : [];
      const overInteractive = hits.some((hit) => hit !== panel && hit !== backdrop);
      if (!interiorPanEligible({
        button: value.button ?? 0,
        insideFrame: cutawayContainsPointer(this.currentLayout ?? layout, point),
        overInteractive,
        editMode: this.editMode,
        zoom: this.interiorViewport.zoom,
      })) return;
      drag = {
        pointerId: value.id ?? value.pointerId ?? 0,
        x: point.x,
        y: point.y,
        committed: false,
      };
    };
    const move = (pointer: unknown): void => {
      if (!drag) return;
      const value = pointer as Phaser.Input.Pointer & { id?: number; pointerId?: number };
      if ((value.id ?? value.pointerId ?? 0) !== drag.pointerId) return;
      const point = this.pointerScreenPoint(pointer);
      if (!point) return;
      const deltaX = point.x - drag.x;
      const deltaY = point.y - drag.y;
      if (!drag.committed && Math.hypot(deltaX, deltaY) < 6) return;
      drag.committed = true;
      this.interiorViewport = panInteriorViewport(
        this.interiorViewport,
        deltaX,
        deltaY,
        this.roomViewportFrame(this.currentLayout ?? layout),
        this.roomContentBounds(interior),
      );
      drag.x = point.x;
      drag.y = point.y;
      (pointer as { event?: { preventDefault?: () => void } }).event?.preventDefault?.();
      this.applyRoomViewport();
    };
    const up = (): void => { drag = undefined; };
    input.on('wheel', wheel);
    input.on('pointerdown', down);
    input.on('pointermove', move);
    input.on('pointerup', up);
    input.on('pointercancel', up);
    this.viewportGestureCleanup = () => {
      input.off?.('wheel', wheel);
      input.off?.('pointerdown', down);
      input.off?.('pointermove', move);
      input.off?.('pointerup', up);
      input.off?.('pointercancel', up);
    };
  }

  private resizeSelected(interior: InteriorDefinition, layout: CutawayLayout, direction: -1 | 1): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const result = resizeSelectionAtomically(interior, interior.furniture, [...this.selectedFurnitureIds], direction);
    if (result.accepted) this.commitFurnitureMutation(interior, result.layout);
    const selected = result.layout.find(({ id }) => this.selectedFurnitureIds.has(id));
    if (result.accepted) this.setStatus('resizeApplied', {
      percent: Math.round(normalizeFurnitureScale(selected?.scale) * 100),
    });
    else this.setStatus('resizeRejected');
    this.renderFurniture(interior, layout);
  }

  private rotateSelected(interior: InteriorDefinition, layout: CutawayLayout, delta: -90 | 90): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const selected = interior.furniture.filter(({ id }) => this.selectedFurnitureIds.has(id));
    const targetSupported = selected.length > 0 && selected.every((item) => {
      const target = (((item.rotation ?? authoredPlacement(item.assetId).rotation) + delta + 360) % 360) as 0 | 90 | 180 | 270;
      return supportedRotations(item.assetId).includes(target);
    });
    if (!targetSupported) {
      this.setStatus('rotateRejected');
      this.renderFurniture(interior, layout);
      return;
    }
    const result = rotateSelectionAtomically(interior, interior.furniture, [...this.selectedFurnitureIds], delta);
    if (result.accepted) this.commitFurnitureMutation(interior, result.layout);
    this.setStatus(result.accepted ? 'rotateApplied' : 'rotateRejected');
    this.renderFurniture(interior, layout);
  }

  private shiftSelectedLayer(interior: InteriorDefinition, layout: CutawayLayout, direction: 'previous' | 'next'): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const result = shiftSelectionLayer(interior, interior.furniture, [...this.selectedFurnitureIds], direction);
    const changed = result.accepted && this.commitFurnitureMutation(interior, result.layout);
    this.setStatus(changed ? (direction === 'next' ? 'layerUpApplied' : 'layerDownApplied') : 'layerShiftRejected');
    this.renderFurniture(interior, layout);
  }

  private reorderSelected(
    interior: InteriorDefinition,
    layout: CutawayLayout,
    direction: 'back' | 'backward' | 'forward' | 'front',
  ): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const reordered = reorderSelection(interior.furniture, [...this.selectedFurnitureIds], direction);
    this.commitFurnitureMutation(interior, reordered);
    this.setStatus('reordered');
    this.renderFurniture(interior, layout);
  }

  private groupSelectedDraft(interior: InteriorDefinition, layout: CutawayLayout): void {
    if (this.selectedFurnitureIds.size < 2) return;
    const usedInstanceIds = new Set(interior.furniture
      .map(({ prefabInstanceId }) => prefabInstanceId)
      .filter((id): id is string => Boolean(id)));
    let sequence = 1;
    while (usedInstanceIds.has(`draft-group-${sequence}`)) sequence += 1;
    const instanceId = `draft-group-${sequence}`;
    const grouped = cloneFurnitureLayout(interior.furniture).map((item) => (
      this.selectedFurnitureIds.has(item.id) ? { ...item, prefabInstanceId: instanceId } : item
    ));
    this.commitFurnitureMutation(interior, grouped);
    this.renderFurniture(interior, layout);
  }

  private duplicateSelected(interior: InteriorDefinition, layout: CutawayLayout): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const result = duplicateSelection(interior, interior.furniture, [...this.selectedFurnitureIds]);
    if (result.accepted) {
      this.commitFurnitureMutation(interior, result.layout);
      this.selectedFurnitureIds.clear();
      result.selectedIds.forEach((id) => this.selectedFurnitureIds.add(id));
      this.selectedFurnitureId = result.selectedIds[0];
    }
    this.setStatus(result.accepted ? 'duplicateApplied' : 'duplicateRejected');
    this.renderFurniture(interior, layout);
  }

  private returnSelectedToShelf(interior: InteriorDefinition, layout: CutawayLayout): void {
    if (this.selectedFurnitureIds.size === 0) return;
    const selection = expandSelectionClosure(interior.furniture, [...this.selectedFurnitureIds]);
    const count = selection.length;
    this.commitFurnitureMutation(interior, removeSelection(interior.furniture, selection));
    this.selectedFurnitureIds.clear();
    this.selectedFurnitureId = undefined;
    this.setStatus('returnedToShelf', { count });
    this.renderFurniture(interior, layout);
  }

  private cancelSelection(): void {
    this.selectedFurnitureIds.clear();
    this.selectedFurnitureId = undefined;
    this.setStatus('selectionCleared');
    if (this.activeInterior && this.root) {
      this.renderFurniture(this.activeInterior, this.layoutForViewport());
    }
  }
}

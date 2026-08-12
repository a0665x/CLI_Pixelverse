import type {
  FurnitureDefinition,
  FurnitureLayer,
  FurniturePrefab,
  FurnitureRotation,
  GridPoint,
  InteriorDefinition,
} from '../world/types';
import {
  diagnoseFinePlacement,
  furnitureBlocksNavigation,
  furnitureWithRotation,
  rotateGridPoint,
  resolvePlacementCandidate,
  snapFurniturePoint,
  transformedAlphaBounds,
  type FurnitureBounds,
} from './interiorPlacement';
import { FURNITURE_SCALES, normalizeFurnitureScale } from './interiorLayoutEditor';
import { officeLayoutIssues } from './prefabGeometry';

export interface SelectionRect extends FurnitureBounds {}

const intersects = (left: FurnitureBounds, right: FurnitureBounds): boolean => (
  left.x < right.x + right.width && left.x + left.width > right.x &&
  left.y < right.y + right.height && left.y + left.height > right.y
);

const cloneFurniture = (item: FurnitureDefinition): FurnitureDefinition => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
  ...(item.interactionPoint ? { interactionPoint: { ...item.interactionPoint } } : {}),
});

export function selectedFurnitureIds(
  rect: SelectionRect,
  layout: readonly FurnitureDefinition[],
): string[] {
  const normalized = {
    x: Math.min(rect.x, rect.x + rect.width), y: Math.min(rect.y, rect.y + rect.height),
    width: Math.abs(rect.width), height: Math.abs(rect.height),
  };
  const hits = layout.filter((item) => intersects(normalized, transformedAlphaBounds(item))).map(({ id }) => id);
  return expandSelection(layout, hits);
}

/** Expands every selected prefab member to its complete, layout-ordered instance. */
export function expandSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
): string[] {
  const selected = new Set(selectedIds);
  const instanceIds = new Set(layout
    .filter(({ id }) => selected.has(id))
    .map(({ prefabInstanceId }) => prefabInstanceId)
    .filter((id): id is string => Boolean(id)));
  return layout
    .filter((item) => selected.has(item.id) || Boolean(item.prefabInstanceId && instanceIds.has(item.prefabInstanceId)))
    .map(({ id }) => id);
}

const translateFurniture = (item: FurnitureDefinition, delta: GridPoint): FurnitureDefinition => ({
  ...cloneFurniture(item),
  point: { x: item.point.x + delta.x, y: item.point.y + delta.y },
  ...(item.interactionPoint ? { interactionPoint: {
    x: item.interactionPoint.x + delta.x,
    y: item.interactionPoint.y + delta.y,
  } } : {}),
});

const selectionAnchor = (items: readonly FurnitureDefinition[]): GridPoint => ({
  x: (Math.min(...items.map(({ point }) => point.x)) + Math.max(...items.map(({ point }) => point.x))) / 2,
  y: (Math.min(...items.map(({ point }) => point.y)) + Math.max(...items.map(({ point }) => point.y))) / 2,
});

const selectionBounds = (items: readonly FurnitureDefinition[]): FurnitureBounds => {
  const bounds = items.map((item) => transformedAlphaBounds(item));
  const x = Math.min(...bounds.map((item) => item.x));
  const y = Math.min(...bounds.map((item) => item.y));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  return { x, y, width: right - x, height: bottom - y };
};

const fitSelectionToRoom = (
  room: InteriorDefinition,
  items: readonly FurnitureDefinition[],
): FurnitureDefinition[] => {
  if (items.length === 0) return [];
  const bounds = selectionBounds(items);
  if (bounds.width > room.width || bounds.height > room.height) return items.map(cloneFurniture);
  const intersectsRoom = bounds.x < room.width && bounds.x + bounds.width > 0
    && bounds.y < room.height && bounds.y + bounds.height > 0;
  if (!intersectsRoom) return items.map(cloneFurniture);
  const delta = {
    x: Math.max(0, -bounds.x) - Math.max(0, bounds.x + bounds.width - room.width),
    y: Math.max(0, -bounds.y) - Math.max(0, bounds.y + bounds.height - room.height),
  };
  return items.map((item) => translateFurniture(item, delta));
};

const selectedMutationIsValid = (
  room: InteriorDefinition,
  previousLayout: readonly FurnitureDefinition[],
  candidateLayout: readonly FurnitureDefinition[],
  selected: ReadonlySet<string>,
): boolean => {
  const selectedItems = candidateLayout.filter(({ id }) => selected.has(id));
  if (!selectedItems.every((item) => diagnoseFinePlacement(room, item, candidateLayout, item.id) === 'valid')) return false;
  const issueKey = (issue: ReturnType<typeof officeLayoutIssues>[number]): string => [
    issue.diagnostic,
    issue.furnitureId ?? '',
    issue.conflictingId ?? '',
    issue.point ? `${issue.point.x},${issue.point.y}` : '',
  ].join('|');
  const previousIssues = new Set(officeLayoutIssues({
    ...room, furniture: previousLayout.map(cloneFurniture),
  }).map(issueKey));
  return !officeLayoutIssues({ ...room, furniture: candidateLayout.map(cloneFurniture) }).some((issue) => (
    Boolean(issue.furnitureId && selected.has(issue.furnitureId))
    || Boolean(issue.conflictingId && selected.has(issue.conflictingId))
    || !previousIssues.has(issueKey(issue))
  ));
};

export function moveSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  delta: GridPoint,
): FurnitureDefinition[] {
  const expanded = expandSelection(layout, selectedIds);
  const selected = new Set(expanded);
  const first = layout.find(({ id }) => selected.has(id));
  if (!first) return layout.map(cloneFurniture);
  const snapped = snapFurniturePoint({ x: first.point.x + delta.x, y: first.point.y + delta.y });
  const applied = { x: snapped.x - first.point.x, y: snapped.y - first.point.y };
  return layout.map((item) => selected.has(item.id) ? translateFurniture(item, applied) : cloneFurniture(item));
}

export interface SelectionMutationResult {
  accepted: boolean;
  layout: FurnitureDefinition[];
}

export interface DuplicateFurnitureResult extends SelectionMutationResult {
  selectedIds: string[];
}

export function removeSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
): FurnitureDefinition[] {
  const selected = new Set(expandSelection(layout, selectedIds));
  return layout.filter(({ id }) => !selected.has(id)).map(cloneFurniture);
}

export function moveSelectionAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  delta: GridPoint,
): SelectionMutationResult {
  const selected = new Set(expandSelection(layout, selectedIds));
  if (selected.size === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const movedWithoutFit = moveSelection(layout, [...selected], delta);
  const fitted = new Map(fitSelectionToRoom(
    room,
    movedWithoutFit.filter(({ id }) => selected.has(id)),
  ).map((item) => [item.id, item]));
  const moved = movedWithoutFit.map((item) => selected.has(item.id) ? fitted.get(item.id)! : item);
  const accepted = selectedMutationIsValid(room, layout, moved, selected);
  return { accepted, layout: (accepted ? moved : layout).map(cloneFurniture) };
}

export function transformSelectionAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  transform: (item: FurnitureDefinition) => FurnitureDefinition,
): SelectionMutationResult {
  const selected = new Set(expandSelection(layout, selectedIds));
  if (selected.size === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const changedSelection = layout.filter(({ id }) => selected.has(id)).map((item) => transform(cloneFurniture(item)));
  const fittedById = new Map(fitSelectionToRoom(room, changedSelection).map((item) => [item.id, item]));
  const transformed = layout.map((item) => {
    if (!selected.has(item.id)) return cloneFurniture(item);
    return cloneFurniture(fittedById.get(item.id)!);
  });
  const accepted = selectedMutationIsValid(room, layout, transformed, selected);
  return { accepted, layout: (accepted ? transformed : layout).map(cloneFurniture) };
}

const rotatedFacing = (
  facing: FurnitureDefinition['facing'],
  delta: FurnitureRotation,
): FurnitureDefinition['facing'] => {
  const facings: FurnitureDefinition['facing'][] = ['up', 'right', 'down', 'left'];
  return facings[(facings.indexOf(facing) + delta / 90) % facings.length]!;
};

export function rotateSelectionAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  delta: -90 | 90,
): SelectionMutationResult {
  const selected = new Set(expandSelection(layout, selectedIds));
  const items = layout.filter(({ id }) => selected.has(id));
  if (items.length === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const anchor = selectionAnchor(items);
  const normalizedDelta = ((delta + 360) % 360) as FurnitureRotation;
  return transformSelectionAtomically(room, layout, [...selected], (item) => {
    const relative = rotateGridPoint({ x: item.point.x - anchor.x, y: item.point.y - anchor.y }, normalizedDelta);
    const point = { x: anchor.x + relative.x, y: anchor.y + relative.y };
    const rotated = furnitureWithRotation(
      item,
      (((item.rotation ?? 0) + normalizedDelta) % 360) as FurnitureRotation,
    );
    const translated = translateFurniture(rotated, { x: point.x - item.point.x, y: point.y - item.point.y });
    return { ...translated, facing: rotatedFacing(item.facing, normalizedDelta) };
  });
}

export function resizeSelectionAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  direction: -1 | 1,
): SelectionMutationResult {
  const selected = new Set(expandSelection(layout, selectedIds));
  const items = layout.filter(({ id }) => selected.has(id));
  if (items.length === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const anchor = selectionAnchor(items);
  const firstScale = normalizeFurnitureScale(items[0]!.scale);
  const firstNext = FURNITURE_SCALES[FURNITURE_SCALES.indexOf(firstScale) + direction];
  if (!firstNext) return { accepted: false, layout: layout.map(cloneFurniture) };
  const ratio = firstNext / firstScale;
  const nextScales = new Map(items.map((item) => {
    const scaled = Number((normalizeFurnitureScale(item.scale) * ratio).toFixed(4));
    return [item.id, FURNITURE_SCALES.find((candidate) => candidate === scaled)] as const;
  }));
  if ([...nextScales.values()].some((scale) => scale === undefined)) {
    return { accepted: false, layout: layout.map(cloneFurniture) };
  }
  return transformSelectionAtomically(room, layout, [...selected], (item) => {
    const nextScale = nextScales.get(item.id)!;
    const point = {
      x: anchor.x + (item.point.x - anchor.x) * ratio,
      y: anchor.y + (item.point.y - anchor.y) * ratio,
    };
    const interactionPoint = item.interactionPoint ? {
      x: anchor.x + (item.interactionPoint.x - anchor.x) * ratio,
      y: anchor.y + (item.interactionPoint.y - anchor.y) * ratio,
    } : undefined;
    return {
      ...item,
      point,
      scale: nextScale,
      ...(interactionPoint ? { interactionPoint } : {}),
    };
  });
}

const LAYERS: readonly FurnitureLayer[] = ['floor', 'furniture', 'surface', 'wall'];

export function shiftSelectionLayer(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  direction: 'previous' | 'next',
): FurnitureDefinition[] {
  const selected = new Set(expandSelection(layout, selectedIds));
  const selectedItems = layout.filter(({ id }) => selected.has(id));
  if (selectedItems.length === 0) return layout.map(cloneFurniture);
  const delta = direction === 'next' ? 1 : -1;
  if (selectedItems.some((item) => {
    const index = LAYERS.indexOf(item.layer ?? 'furniture');
    return index + delta < 0 || index + delta >= LAYERS.length;
  })) return layout.map(cloneFurniture);
  return layout.map((item) => {
    if (!selected.has(item.id)) return cloneFurniture(item);
    const current = item.layer ?? 'furniture';
    return { ...cloneFurniture(item), layer: LAYERS[LAYERS.indexOf(current) + delta]! };
  });
}

export function reorderSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  direction: 'back' | 'backward' | 'forward' | 'front',
): FurnitureDefinition[] {
  const selected = new Set(expandSelection(layout, selectedIds));
  const items = layout.filter(({ id }) => selected.has(id));
  if (items.length === 0) return layout.map(cloneFurniture);
  return layout.map((item) => {
    if (!selected.has(item.id)) return cloneFurniture(item);
    const layer = item.layer ?? 'furniture';
    const selectedOnLayer = items.filter((candidate) => (candidate.layer ?? 'furniture') === layer);
    const peers = layout.filter((candidate) => (candidate.layer ?? 'furniture') === layer && !selected.has(candidate.id));
    const current = item.zIndex ?? 0;
    const delta = direction === 'front'
      ? (Math.max(-1, ...peers.map((peer) => peer.zIndex ?? 0)) + 1) - Math.min(...selectedOnLayer.map((peer) => peer.zIndex ?? 0))
      : direction === 'back'
        ? (Math.min(1, ...peers.map((peer) => peer.zIndex ?? 0)) - 1) - Math.min(...selectedOnLayer.map((peer) => peer.zIndex ?? 0))
        : direction === 'forward' ? 1 : -1;
    return { ...cloneFurniture(item), zIndex: current + delta };
  });
}

const duplicateOffsets = (): GridPoint[] => {
  const offsets: GridPoint[] = [{ x: 0.25, y: 0.25 }];
  for (let radius = 1; radius <= 8; radius += 1) {
    const distance = radius * 0.25;
    offsets.push(
      { x: distance, y: 0 }, { x: 0, y: distance },
      { x: -distance, y: 0 }, { x: 0, y: -distance },
      { x: distance, y: distance }, { x: -distance, y: distance },
      { x: distance, y: -distance }, { x: -distance, y: -distance },
    );
  }
  return offsets;
};

export function duplicateFurniture(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  furnitureId: string,
  now: number = Date.now(),
): DuplicateFurnitureResult {
  const source = layout.find(({ id }) => id === furnitureId);
  if (!source) return { accepted: false, layout: layout.map(cloneFurniture), selectedIds: [] };
  const {
    requirementId: _requirementId,
    blocksNavigation: _blocksNavigation,
    interactionPoint: _interactionPoint,
    ...visualSource
  } = cloneFurniture(source);
  const occupiedIds = new Set(layout.map(({ id }) => id));
  const idPrefix = `duplicate-${now}-${source.id}`;
  let id = idPrefix;
  let suffix = 0;
  while (occupiedIds.has(id)) id = `${idPrefix}-${++suffix}`;
  const base: FurnitureDefinition = {
    ...visualSource,
    id,
    supportedActions: [],
    icon: 'generic',
  };
  base.blocksNavigation = furnitureBlocksNavigation(base);
  for (const offset of duplicateOffsets()) {
    const point = { x: source.point.x + offset.x, y: source.point.y + offset.y };
    const candidate = resolvePlacementCandidate(room, layout, base, point);
    if (candidate.diagnostic !== 'valid') continue;
    return {
      accepted: true,
      layout: [...layout.map(cloneFurniture), cloneFurniture(candidate.furniture)],
      selectedIds: [source.id, candidate.furniture.id],
    };
  }
  return { accepted: false, layout: layout.map(cloneFurniture), selectedIds: [source.id] };
}

const oneAtomicSelection = (
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
): FurnitureDefinition[] => {
  const ids = expandSelection(layout, selectedIds);
  const items = layout.filter(({ id }) => ids.includes(id));
  if (items.length === 1) return items;
  const instanceId = items[0]?.prefabInstanceId;
  return instanceId && items.every(({ prefabInstanceId }) => prefabInstanceId === instanceId) ? items : [];
};

export function duplicateSelection(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  now: number = Date.now(),
): DuplicateFurnitureResult {
  const source = oneAtomicSelection(layout, selectedIds);
  if (source.length === 0) return { accepted: false, layout: layout.map(cloneFurniture), selectedIds: [] };
  if (source.length === 1 && !source[0]!.prefabInstanceId) return duplicateFurniture(room, layout, source[0]!.id, now);

  const sourceInstanceId = source[0]!.prefabInstanceId!;
  let suffix = 0;
  let instanceId = `prefab-${now}-duplicate-${sourceInstanceId}`;
  const occupiedInstanceIds = new Set(layout.map(({ prefabInstanceId }) => prefabInstanceId));
  const occupiedItemIds = new Set(layout.map(({ id }) => id));
  while (occupiedInstanceIds.has(instanceId)
    || source.some((_, index) => occupiedItemIds.has(`${instanceId}-${index}`))) {
    instanceId = `prefab-${now}-duplicate-${sourceInstanceId}-${++suffix}`;
  }
  const copiedIds = source.map((item, index) => `${instanceId}-${index}`);
  for (const offset of duplicateOffsets()) {
    const copied = source.map((item, index) => ({
      ...translateFurniture(item, offset),
      id: copiedIds[index]!,
      prefabInstanceId: instanceId,
    }));
    const candidate = [...layout.map(cloneFurniture), ...copied];
    const copiedSet = new Set(copiedIds);
    if (!selectedMutationIsValid(room, layout, candidate, copiedSet)) continue;
    return { accepted: true, layout: candidate, selectedIds: copiedIds };
  }
  return { accepted: false, layout: layout.map(cloneFurniture), selectedIds: source.map(({ id }) => id) };
}

export function createFurniturePrefab(
  name: string,
  selection: readonly FurnitureDefinition[],
  createdAt: number = Date.now(),
): FurniturePrefab {
  const ordinary = selection.filter(({ supportedActions, requirementId }) => supportedActions.length === 0 && !requirementId);
  if (ordinary.length < 2) throw new Error('A prefab requires at least two ordinary furniture items');
  const minX = Math.min(...ordinary.map(({ point }) => point.x));
  const minY = Math.min(...ordinary.map(({ point }) => point.y));
  const bounds = ordinary.map((item) => transformedAlphaBounds(item));
  const right = Math.max(...bounds.map((item) => item.x + item.width));
  const bottom = Math.max(...bounds.map((item) => item.y + item.height));
  const left = Math.min(...bounds.map(({ x }) => x));
  const top = Math.min(...bounds.map(({ y }) => y));
  return {
    id: `prefab-${createdAt}-${ordinary.map(({ assetId }) => assetId ?? 0).join('-')}`,
    name: name.trim() || '未命名組裝件',
    createdAt,
    width: right - left,
    height: bottom - top,
    items: ordinary.map((item) => {
      const { requirementId: _requirementId, interactionPoint: _interactionPoint, ...template } = cloneFurniture(item);
      return {
        ...template,
        id: `template-${item.id}`,
        point: snapFurniturePoint({ x: item.point.x - minX, y: item.point.y - minY }),
        supportedActions: [],
      };
    }),
  };
}

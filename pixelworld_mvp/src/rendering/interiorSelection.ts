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
  fitBoundsDeltaToRoom,
  furnitureBlocksNavigation,
  furnitureRenderGeometry,
  furnitureWithRotation,
  rotateGridPoint,
  resolvePlacementCandidate,
  snapFurniturePoint,
  transformedAlphaBounds,
  type FurnitureBounds,
} from './interiorPlacement';
import { FURNITURE_SCALES, normalizeFurnitureScale } from './interiorLayoutEditor';
import { officeLayoutIssues } from './prefabGeometry';
import {
  isCompatibleStackSupport,
  resolveAutomaticSupport,
  stackDependencies,
  stackRoleForFurniture,
} from './interiorAutoStack';

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
  ...(item.supportedByIds ? { supportedByIds: [...item.supportedByIds] } : {}),
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
  return expandSelectionClosure(layout, hits);
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

/** Alternates prefab membership and forward support dependencies until the layout-ordered selection is stable. */
export function expandSelectionClosure(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
): string[] {
  let expanded = layout.filter(({ id }) => selectedIds.includes(id)).map(({ id }) => id);
  while (true) {
    const next = stackDependencies(expandSelection(layout, expanded), layout);
    if (next.length === expanded.length && next.every((id, index) => id === expanded[index])) return next;
    expanded = next;
  }
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
  const impossibleFit = bounds.width > room.width || bounds.height > room.height;
  const entirelyOutside = bounds.x + bounds.width <= 0 || bounds.x >= room.width
    || bounds.y + bounds.height <= 0 || bounds.y >= room.height;
  if (impossibleFit || entirelyOutside) return items.map(cloneFurniture);
  const delta = fitBoundsDeltaToRoom(room, bounds);
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
  const previousInvalidSupports = new Set(officeLayoutIssues({
    ...room, furniture: previousLayout.map(cloneFurniture),
  }).filter(({ diagnostic }) => diagnostic === 'invalid-support')
    .map(({ furnitureId, conflictingId }) => `${furnitureId ?? ''}:${conflictingId ?? ''}`));
  return !officeLayoutIssues({ ...room, furniture: candidateLayout.map(cloneFurniture) })
    .filter(({ diagnostic }) => diagnostic === 'invalid-support')
    .some(({ furnitureId, conflictingId }) => (
      Boolean(furnitureId && selected.has(furnitureId))
      || !previousInvalidSupports.has(`${furnitureId ?? ''}:${conflictingId ?? ''}`)
    ));
};

const preserveContainingSupport = (
  item: FurnitureDefinition,
  previous: FurnitureDefinition | undefined,
  layout: readonly FurnitureDefinition[],
): FurnitureDefinition | undefined => {
  if (stackRoleForFurniture(item) !== 'surface') return undefined;
  const center = furnitureRenderGeometry(item).center;
  const supportId = previous?.supportedByIds?.find((id) => {
    const support = layout.find((candidate) => candidate.id === id);
    if (!isCompatibleStackSupport(support)) return false;
    const bounds = transformedAlphaBounds(support);
    return center.x >= bounds.x && center.x <= bounds.x + bounds.width
      && center.y >= bounds.y && center.y <= bounds.y + bounds.height;
  });
  return supportId ? { ...cloneFurniture(item), supportedByIds: [supportId] } : undefined;
};

export function moveSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  delta: GridPoint,
): FurnitureDefinition[] {
  const expanded = expandSelectionClosure(layout, selectedIds);
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
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
  return layout.filter(({ id }) => !selected.has(id)).map(cloneFurniture);
}

export function moveSelectionAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  delta: GridPoint,
): SelectionMutationResult {
  const preview = previewSelectionMove(room, layout, selectedIds, delta);
  return {
    accepted: preview.accepted,
    layout: (preview.accepted ? preview.layout : layout).map(cloneFurniture),
  };
}

export function previewSelectionMove(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  delta: GridPoint,
): SelectionMutationResult {
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
  if (selected.size === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const movedWithoutFit = moveSelection(layout, [...selected], delta);
  const fitted = new Map(fitSelectionToRoom(
    room,
    movedWithoutFit.filter(({ id }) => selected.has(id)),
  ).map((item) => [item.id, item]));
  const moved = movedWithoutFit.map((item) => selected.has(item.id) ? fitted.get(item.id)! : item);
  const supported = moved.map(cloneFurniture);
  for (let index = 0; index < supported.length; index += 1) {
    if (!selected.has(supported[index]!.id)) continue;
    const previous = layout.find(({ id }) => id === supported[index]!.id);
    const movedWithSupport = previous?.supportedByIds?.some((id) => selected.has(id)) === true;
    if (movedWithSupport) continue;
    supported[index] = resolveAutomaticSupport(supported[index]!, supported).item;
  }
  const accepted = selectedMutationIsValid(room, layout, supported, selected);
  return { accepted, layout: supported.map(cloneFurniture) };
}

export function transformSelectionAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  transform: (item: FurnitureDefinition) => FurnitureDefinition,
): SelectionMutationResult {
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
  if (selected.size === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const changedSelection = layout.filter(({ id }) => selected.has(id)).map((item) => transform(cloneFurniture(item)));
  const fittedById = new Map(fitSelectionToRoom(room, changedSelection).map((item) => [item.id, item]));
  const transformed = layout.map((item) => {
    if (!selected.has(item.id)) return cloneFurniture(item);
    return cloneFurniture(fittedById.get(item.id)!);
  });
  const supported = transformed.map((item) => {
    if (!selected.has(item.id)) return item;
    const previous = layout.find(({ id }) => id === item.id);
    if (previous?.layer !== item.layer) return item;
    return preserveContainingSupport(item, previous, transformed)
      ?? resolveAutomaticSupport(item, transformed).item;
  });
  const accepted = selectedMutationIsValid(room, layout, supported, selected);
  return { accepted, layout: (accepted ? supported : layout).map(cloneFurniture) };
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
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
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
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
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

export function resetSelectionScaleAtomically(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
): SelectionMutationResult {
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
  const items = layout.filter(({ id }) => selected.has(id));
  if (items.length === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const currentScale = normalizeFurnitureScale(items[0]!.scale);
  if (items.some((item) => normalizeFurnitureScale(item.scale) !== currentScale)) {
    return { accepted: false, layout: layout.map(cloneFurniture) };
  }
  if (currentScale === 1) return { accepted: true, layout: layout.map(cloneFurniture) };
  const anchor = selectionAnchor(items);
  const ratio = 1 / currentScale;
  return transformSelectionAtomically(room, layout, [...selected], (item) => {
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
      scale: 1,
      ...(interactionPoint ? { interactionPoint } : {}),
    };
  });
}

const LAYERS: readonly FurnitureLayer[] = ['floor', 'furniture', 'surface', 'wall'];

export function shiftSelectionLayer(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  direction: 'previous' | 'next',
): SelectionMutationResult {
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
  const selectedItems = layout.filter(({ id }) => selected.has(id));
  if (selectedItems.length === 0) return { accepted: false, layout: layout.map(cloneFurniture) };
  const delta = direction === 'next' ? 1 : -1;
  if (selectedItems.some((item) => {
    const index = LAYERS.indexOf(item.layer ?? 'furniture');
    return index + delta < 0 || index + delta >= LAYERS.length;
  })) return { accepted: false, layout: layout.map(cloneFurniture) };
  return transformSelectionAtomically(room, layout, [...selected], (item) => {
    const current = item.layer ?? 'furniture';
    return { ...cloneFurniture(item), layer: LAYERS[LAYERS.indexOf(current) + delta]! };
  });
}

export function reorderSelection(
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  direction: 'back' | 'backward' | 'forward' | 'front',
): FurnitureDefinition[] {
  const selected = new Set(expandSelectionClosure(layout, selectedIds));
  const items = layout.filter(({ id }) => selected.has(id));
  if (items.length === 0) return layout.map(cloneFurniture);
  const layerDeltas = new Map<FurnitureLayer, number>();
  for (const layer of LAYERS) {
    const selectedOnLayer = items.filter((candidate) => (candidate.layer ?? 'furniture') === layer);
    if (selectedOnLayer.length === 0) continue;
    const peers = layout.filter((candidate) => (
      (candidate.layer ?? 'furniture') === layer && !selected.has(candidate.id)
    ));
    if (direction === 'front' || direction === 'back') {
      if (peers.length === 0) {
        layerDeltas.set(layer, 0);
        continue;
      }
      const peerZ = peers.map((peer) => peer.zIndex ?? 0);
      const selectedZ = selectedOnLayer.map((peer) => peer.zIndex ?? 0);
      layerDeltas.set(layer, direction === 'front'
        ? Math.max(...peerZ) + 1 - Math.min(...selectedZ)
        : Math.min(...peerZ) - 1 - Math.max(...selectedZ));
      continue;
    }
    layerDeltas.set(layer, direction === 'forward' ? 1 : -1);
  }
  return layout.map((item) => {
    if (!selected.has(item.id)) return cloneFurniture(item);
    const layer = item.layer ?? 'furniture';
    const current = item.zIndex ?? 0;
    return { ...cloneFurniture(item), zIndex: current + layerDeltas.get(layer)! };
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
    supportedByIds: _supportedByIds,
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

export function duplicateSelection(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  selectedIds: readonly string[],
  now: number = Date.now(),
): DuplicateFurnitureResult {
  const sourceIds = new Set(expandSelectionClosure(layout, selectedIds));
  const source = layout.filter(({ id }) => sourceIds.has(id));
  if (source.length === 0) return { accepted: false, layout: layout.map(cloneFurniture), selectedIds: [] };
  if (source.length === 1 && !source[0]!.prefabInstanceId) return duplicateFurniture(room, layout, source[0]!.id, now);

  const occupiedInstanceIds = new Set(layout.map(({ prefabInstanceId }) => prefabInstanceId));
  const occupiedItemIds = new Set(layout.map(({ id }) => id));
  const copiedInstanceBySource = new Map<string, string>();
  for (const sourceInstanceId of new Set(source
    .map(({ prefabInstanceId }) => prefabInstanceId)
    .filter((id): id is string => Boolean(id)))) {
    const members = source.filter(({ prefabInstanceId }) => prefabInstanceId === sourceInstanceId);
    const base = `prefab-${now}-duplicate-${sourceInstanceId}`;
    let instanceId = base;
    let suffix = 0;
    while (occupiedInstanceIds.has(instanceId)
      || members.some((_, index) => occupiedItemIds.has(`${instanceId}-${index}`))) {
      instanceId = `${base}-${++suffix}`;
    }
    copiedInstanceBySource.set(sourceInstanceId, instanceId);
    occupiedInstanceIds.add(instanceId);
    members.forEach((_, index) => occupiedItemIds.add(`${instanceId}-${index}`));
  }
  const copiedIds = source.map((item) => {
    if (item.prefabInstanceId) {
      const members = source.filter(({ prefabInstanceId }) => prefabInstanceId === item.prefabInstanceId);
      return `${copiedInstanceBySource.get(item.prefabInstanceId)!}-${members.indexOf(item)}`;
    }
    const base = `duplicate-${now}-${item.id}`;
    let id = base;
    let suffix = 0;
    while (occupiedItemIds.has(id)) id = `${base}-${++suffix}`;
    occupiedItemIds.add(id);
    return id;
  });
  const copiedIdBySourceId = new Map(source.map((item, index) => [item.id, copiedIds[index]!]));
  for (const offset of duplicateOffsets()) {
    const copied = source.map((item, index): FurnitureDefinition => {
      const translated = translateFurniture(item, offset);
      const copy: FurnitureDefinition = {
        ...translated,
        id: copiedIds[index]!,
        ...(item.supportedByIds ? {
          supportedByIds: item.supportedByIds.map((id) => copiedIdBySourceId.get(id) ?? id),
        } : {}),
      };
      if (item.prefabInstanceId) {
        copy.prefabInstanceId = copiedInstanceBySource.get(item.prefabInstanceId)!;
      } else {
        delete copy.prefabInstanceId;
      }
      if (item.prefabInstanceId) return copy;
      if (item.supportedActions.length === 0 && !item.requirementId) return copy;
      const {
        requirementId: _requirementId,
        interactionPoint: _interactionPoint,
        blocksNavigation: _blocksNavigation,
        ...ordinaryCopy
      } = copy;
      const normalizedCopy: FurnitureDefinition = {
        ...ordinaryCopy, supportedActions: [], icon: 'generic',
      };
      normalizedCopy.blocksNavigation = furnitureBlocksNavigation(normalizedCopy);
      return normalizedCopy;
    });
    const candidate = [...layout.map(cloneFurniture), ...copied];
    for (let index = layout.length; index < candidate.length; index += 1) {
      const item = candidate[index]!;
      if (stackRoleForFurniture(item) !== 'surface') continue;
      candidate[index] = preserveContainingSupport(item, item, candidate)
        ?? resolveAutomaticSupport(item, candidate).item;
    }
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
  const templateIds = new Map(ordinary.map((item) => [item.id, `template-${item.id}`]));
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
        id: templateIds.get(item.id)!,
        point: snapFurniturePoint({ x: item.point.x - minX, y: item.point.y - minY }),
        supportedActions: [],
        ...(item.supportedByIds ? {
          supportedByIds: item.supportedByIds.flatMap((id) => templateIds.get(id) ?? []),
        } : {}),
      };
    }),
  };
}

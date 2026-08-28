export type AlphaRun = readonly [y: number, startX: number, endXExclusive: number];

export interface FurnitureAlphaMask {
  width: number;
  height: number;
  runs: readonly AlphaRun[];
}

export interface FurnitureAlphaMaskManifest {
  schemaVersion: 1;
  alphaThreshold: 1;
  assets: ReadonlyMap<number, FurnitureAlphaMask>;
}

export interface ParseFurnitureAlphaMaskOptions {
  requiredAssetIds?: readonly number[];
}

let installedManifest: FurnitureAlphaMaskManifest | undefined;
let installedVersion = 'geometry-fallback';
const SOURCE_WORLD_CELL = 22;
const EPSILON = 1e-6;

const record = (value: unknown): Record<string, unknown> | undefined => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
);

const collisionError = (detail: string): Error => new Error(`Invalid furniture collision mask: ${detail}`);

function parseMask(assetId: number, value: unknown): FurnitureAlphaMask {
  const source = record(value);
  if (!source) throw collisionError(`asset ${assetId} must be an object`);
  const { width, height, runs } = source;
  if (!Number.isInteger(width) || (width as number) <= 0) throw collisionError(`asset ${assetId} width is invalid`);
  if (!Number.isInteger(height) || (height as number) <= 0) throw collisionError(`asset ${assetId} height is invalid`);
  if (!Array.isArray(runs) || runs.length === 0) throw collisionError(`asset ${assetId} runs are empty`);
  const parsed: AlphaRun[] = [];
  let previousY = -1;
  let previousEnd = -1;
  for (const candidate of runs) {
    if (!Array.isArray(candidate) || candidate.length !== 3 || !candidate.every(Number.isInteger)) {
      throw collisionError(`asset ${assetId} has an invalid run`);
    }
    const [y, startX, endXExclusive] = candidate as [number, number, number];
    if (y < 0 || y >= (height as number) || startX < 0 || startX >= endXExclusive || endXExclusive > (width as number)) {
      throw collisionError(`asset ${assetId} has an out-of-range run`);
    }
    if (y < previousY || (y === previousY && startX < previousEnd)) {
      throw collisionError(`asset ${assetId} runs are unordered or overlapping`);
    }
    previousY = y;
    previousEnd = endXExclusive;
    parsed.push(Object.freeze([y, startX, endXExclusive]) as AlphaRun);
  }
  return Object.freeze({ width: width as number, height: height as number, runs: Object.freeze(parsed) });
}

export function parseFurnitureAlphaMaskManifest(
  value: unknown,
  options: ParseFurnitureAlphaMaskOptions = {},
): FurnitureAlphaMaskManifest {
  const source = record(value);
  if (!source || source.schemaVersion !== 1) throw collisionError('schemaVersion must be 1');
  if (source.alphaThreshold !== 1) throw collisionError('alphaThreshold must be 1');
  const sourceAssets = record(source.assets);
  if (!sourceAssets) throw collisionError('assets must be an object');
  const assets = new Map<number, FurnitureAlphaMask>();
  for (const [rawId, rawMask] of Object.entries(sourceAssets)) {
    const assetId = Number(rawId);
    if (!Number.isInteger(assetId) || assetId <= 0 || String(assetId) !== rawId) {
      throw collisionError(`asset ID ${rawId} is invalid`);
    }
    assets.set(assetId, parseMask(assetId, rawMask));
  }
  for (const assetId of options.requiredAssetIds ?? []) {
    if (!assets.has(assetId)) throw collisionError(`required asset ${assetId} is missing`);
  }
  return Object.freeze({ schemaVersion: 1, alphaThreshold: 1, assets });
}

export function installFurnitureAlphaMasks(manifest: FurnitureAlphaMaskManifest): void {
  installedManifest = manifest;
  installedVersion = manifestVersion(manifest);
}

export function furnitureAlphaMasksInstalled(): boolean {
  return installedManifest !== undefined;
}

export function furnitureAlphaMask(assetId: number): FurnitureAlphaMask | undefined {
  return installedManifest?.assets.get(assetId);
}

function manifestVersion(manifest: FurnitureAlphaMaskManifest): string {
  let hash = 2166136261;
  const append = (value: number): void => {
    hash ^= value;
    hash = Math.imul(hash, 16777619);
  };
  [...manifest.assets.entries()].sort(([left], [right]) => left - right).forEach(([assetId, mask]) => {
    append(assetId);
    append(mask.width);
    append(mask.height);
    mask.runs.forEach((run) => run.forEach(append));
  });
  return `alpha-v1-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

export function furnitureAlphaMaskVersion(): string {
  return installedVersion;
}

interface Rectangle { left: number; top: number; right: number; bottom: number }

const rotated = (x: number, y: number, rotation: 0 | 90 | 180 | 270): GridPoint => {
  if (rotation === 90) return { x: -y, y: x };
  if (rotation === 180) return { x: -x, y: -y };
  if (rotation === 270) return { x: y, y: -x };
  return { x, y };
};

function transformedRunRectangles(
  item: FurnitureDefinition,
  mask: FurnitureAlphaMask,
): { bounds: Rectangle; rectangles: Rectangle[] } {
  const asset = canonicalFurnitureAsset(item);
  if (!asset) throw new Error(`Furniture collision mask asset is unresolved for ${item.id}`);
  if (mask.width !== 32 || mask.height !== 48) {
    throw new Error(`Furniture collision mask ${asset.id} has unsupported source dimensions`);
  }
  const source = asset.opaqueBounds;
  const sourceCenterX = source.x + source.width / 2;
  const sourceCenterY = source.y + source.height / 2;
  const canonical = canonicalFurnitureGeometry(item, { width: source.width, height: source.height });
  const worldBounds = canonicalFurnitureBounds(item, { width: source.width, height: source.height });
  const center = {
    x: worldBounds.x + worldBounds.width / 2,
    y: worldBounds.y + worldBounds.height / 2,
  };
  const ratio = canonical.scale / SOURCE_WORLD_CELL;
  const rectangles: Rectangle[] = [];
  for (const [y, startX, endXExclusive] of mask.runs) {
    const left = Math.max(startX, source.x);
    const right = Math.min(endXExclusive, source.x + source.width);
    const top = Math.max(y, source.y);
    const bottom = Math.min(y + 1, source.y + source.height);
    if (left >= right || top >= bottom) continue;
    const corners = [
      rotated((left - sourceCenterX) * ratio, (top - sourceCenterY) * ratio, canonical.rotation),
      rotated((right - sourceCenterX) * ratio, (top - sourceCenterY) * ratio, canonical.rotation),
      rotated((left - sourceCenterX) * ratio, (bottom - sourceCenterY) * ratio, canonical.rotation),
      rotated((right - sourceCenterX) * ratio, (bottom - sourceCenterY) * ratio, canonical.rotation),
    ];
    rectangles.push({
      left: center.x + Math.min(...corners.map(({ x }) => x)),
      top: center.y + Math.min(...corners.map(({ y }) => y)),
      right: center.x + Math.max(...corners.map(({ x }) => x)),
      bottom: center.y + Math.max(...corners.map(({ y }) => y)),
    });
  }
  return {
    bounds: {
      left: worldBounds.x,
      top: worldBounds.y,
      right: worldBounds.x + worldBounds.width,
      bottom: worldBounds.y + worldBounds.height,
    },
    rectangles,
  };
}

export function transformedFurnitureMaskCells(
  item: FurnitureDefinition,
  mask: FurnitureAlphaMask,
  clearance: NavigationClearance,
): GridPoint[] {
  const { bounds, rectangles } = transformedRunRectangles(item, mask);
  const left = Math.ceil(bounds.left - clearance.x - 0.5 + EPSILON);
  const top = Math.ceil(bounds.top - clearance.y - 0.5 + EPSILON);
  const right = Math.floor(bounds.right + clearance.x - 0.5 - EPSILON);
  const bottom = Math.floor(bounds.bottom + clearance.y - 0.5 - EPSILON);
  const cells: GridPoint[] = [];
  for (let y = top; y <= bottom; y += 1) {
    const centerY = y + 0.5;
    for (let x = left; x <= right; x += 1) {
      const centerX = x + 0.5;
      const intersects = rectangles.some((rectangle) => (
        rectangle.left < centerX + clearance.x - EPSILON
        && rectangle.right > centerX - clearance.x + EPSILON
        && rectangle.top < centerY + clearance.y - EPSILON
        && rectangle.bottom > centerY - clearance.y + EPSILON
      ));
      if (intersects) cells.push({ x, y });
    }
  }
  return cells;
}

export function clearFurnitureAlphaMasksForTests(): void {
  installedManifest = undefined;
  installedVersion = 'geometry-fallback';
}
import type { FurnitureDefinition, GridPoint } from '../world/types';
import {
  canonicalFurnitureAsset,
  canonicalFurnitureBounds,
  canonicalFurnitureGeometry,
} from './canonicalFurnitureGeometry';
import type { NavigationClearance } from './interiorNavigationPolicy';

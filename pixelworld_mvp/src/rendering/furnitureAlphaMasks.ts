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
}

export function furnitureAlphaMasksInstalled(): boolean {
  return installedManifest !== undefined;
}

export function furnitureAlphaMask(assetId: number): FurnitureAlphaMask | undefined {
  return installedManifest?.assets.get(assetId);
}

export function clearFurnitureAlphaMasksForTests(): void {
  installedManifest = undefined;
}

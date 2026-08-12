import type { FurnitureDefinition } from '../world/types';

export const cloneFurnitureLayout = (
  layout: readonly FurnitureDefinition[],
): FurnitureDefinition[] => layout.map((item) => ({
  ...item,
  point: { ...item.point },
  supportedActions: [...item.supportedActions],
  ...(item.footprint ? { footprint: { ...item.footprint } } : {}),
  ...(item.visualOffset ? { visualOffset: { ...item.visualOffset } } : {}),
  ...(item.interactionPoint ? { interactionPoint: { ...item.interactionPoint } } : {}),
}));

export class InteriorUndoStore {
  private past: FurnitureDefinition[][] = [];
  private current: FurnitureDefinition[];
  private readonly limit: number;

  constructor(layout: readonly FurnitureDefinition[], limit = 20) {
    this.current = cloneFurnitureLayout(layout);
    this.limit = Math.max(0, Math.trunc(limit));
  }

  get canUndo(): boolean { return this.past.length > 0; }

  commit(next: readonly FurnitureDefinition[]): FurnitureDefinition[] {
    this.past = this.limit === 0
      ? []
      : [...this.past, cloneFurnitureLayout(this.current)].slice(-this.limit);
    this.current = cloneFurnitureLayout(next);
    return cloneFurnitureLayout(this.current);
  }

  undo(): FurnitureDefinition[] | undefined {
    const previous = this.past.pop();
    if (!previous) return undefined;
    this.current = cloneFurnitureLayout(previous);
    return cloneFurnitureLayout(this.current);
  }

  reset(layout: readonly FurnitureDefinition[]): void {
    this.past = [];
    this.current = cloneFurnitureLayout(layout);
  }
}

export function dissolvePrefabInstance(
  layout: readonly FurnitureDefinition[],
  instanceId: string,
): FurnitureDefinition[] {
  return cloneFurnitureLayout(layout).map((item) => {
    if (item.prefabInstanceId !== instanceId) return item;
    const { prefabInstanceId: _prefabInstanceId, ...dissolved } = item;
    return dissolved;
  });
}

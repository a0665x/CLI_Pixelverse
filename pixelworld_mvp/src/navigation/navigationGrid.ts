import type { GridPoint, WorldDefinition } from '../world/types';

const key = (point: GridPoint) => `${point.x},${point.y}`;

export class NavigationGrid {
  private constructor(
    readonly width: number,
    readonly height: number,
    private readonly blocked: Set<string>,
    private readonly terrainCosts: Map<string, number>,
  ) {}

  static fromWorld(world: WorldDefinition): NavigationGrid {
    const blocked = new Set<string>();
    for (const rect of world.obstacleRects) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) blocked.add(`${x},${y}`);
      }
    }
    for (const point of world.walkableOverrides) blocked.delete(key(point));

    const terrainCosts = new Map<string, number>();
    for (const area of world.terrain) {
      for (let y = area.bounds.y; y < area.bounds.y + area.bounds.height; y += 1) {
        for (let x = area.bounds.x; x < area.bounds.x + area.bounds.width; x += 1) {
          terrainCosts.set(`${x},${y}`, area.cost);
        }
      }
    }
    return new NavigationGrid(world.width, world.height, blocked, terrainCosts);
  }

  isWalkable(point: GridPoint): boolean {
    return Number.isInteger(point.x) && Number.isInteger(point.y) &&
      point.x >= 0 && point.y >= 0 && point.x < this.width && point.y < this.height &&
      !this.blocked.has(key(point));
  }

  costAt(point: GridPoint): number | undefined {
    if (!this.isWalkable(point)) return undefined;
    return this.terrainCosts.get(key(point)) ?? 5;
  }

  blockedPoints(): GridPoint[] {
    return [...this.blocked].map((value) => {
      const [x, y] = value.split(',').map(Number);
      return { x: x!, y: y! };
    });
  }
}

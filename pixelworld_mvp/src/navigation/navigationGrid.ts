import type { GridPoint, WorldDefinition } from '../world/types';

const key = (point: GridPoint) => `${point.x},${point.y}`;

export class NavigationGrid {
  private constructor(
    readonly width: number,
    readonly height: number,
    private readonly blocked: Set<string>,
  ) {}

  static fromWorld(world: WorldDefinition): NavigationGrid {
    const blocked = new Set<string>();
    for (const rect of world.obstacleRects) {
      for (let y = rect.y; y < rect.y + rect.height; y += 1) {
        for (let x = rect.x; x < rect.x + rect.width; x += 1) blocked.add(`${x},${y}`);
      }
    }
    return new NavigationGrid(world.width, world.height, blocked);
  }

  isWalkable(point: GridPoint): boolean {
    return Number.isInteger(point.x) && Number.isInteger(point.y) &&
      point.x >= 0 && point.y >= 0 && point.x < this.width && point.y < this.height &&
      !this.blocked.has(key(point));
  }

  blockedPoints(): GridPoint[] {
    return [...this.blocked].map((value) => {
      const [x, y] = value.split(',').map(Number);
      return { x: x!, y: y! };
    });
  }
}

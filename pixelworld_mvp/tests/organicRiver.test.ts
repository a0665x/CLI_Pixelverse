import { describe, expect, it } from 'vitest';
import { WORLD_DEFINITION as world } from '../src/world/worldDefinition';
import { NavigationGrid } from '../src/navigation/navigationGrid';
import { buildVillageRenderPlan } from '../src/rendering/VillageRenderer';
import { riverBankMask } from '../src/rendering/riverArt';
import type { GridRect } from '../src/world/types';
const cells = (r: GridRect) => Array.from({ length: r.width * r.height }, (_, i) => ({ x: r.x + i % r.width, y: r.y + Math.floor(i / r.width) }));
const key = (p: { x: number; y: number }) => `${p.x},${p.y}`;

describe('continuous stream and bank-to-bank crossings', () => {
  it('renders water under every bridge and blocks all other river cells', () => {
    const plan = buildVillageRenderPlan(world);
    const grid = NavigationGrid.fromWorld(world);
    const river = new Set(world.scenery.river.flatMap(cells).map(key));
    const bridges = new Set(world.scenery.bridges.flatMap(cells).map(key));
    for (const point of world.scenery.river.flatMap(cells)) expect(grid.isWalkable(point), key(point)).toBe(bridges.has(key(point)));
    for (const bridge of world.scenery.bridges) {
      for (const point of cells(bridge)) {
        expect(river.has(key(point))).toBe(true);
        const commands = plan.commands.filter(c => c.x === point.x * 16 && c.y === point.y * 16);
        const water = commands.find(c => c.sceneryRole === 'river')!;
        const deck = commands.find(c => c.sceneryRole === 'bridge')!;
        expect(water.textureKey).toMatch(/^village-stream-/);
        expect(water.depth).toBeLessThan(deck.depth);
      }
      for (const bank of [{ x: bridge.x - 1, y: bridge.y }, { x: bridge.x + bridge.width, y: bridge.y }]) {
        expect(river.has(key(bank))).toBe(false);
        expect(grid.costAt(bank)).toBe(1);
      }
    }
  });
  it('has a single connected river with varying banks', () => {
    const water = new Set(world.scenery.river.flatMap(cells).map(key));
    const pending = [world.scenery.river[0]!];
    const seen = new Set<string>();
    const flood = pending.map(({ x, y }) => ({ x, y }));
    while (flood.length) {
      const p = flood.pop()!;
      if (!water.has(key(p)) || seen.has(key(p))) continue;
      seen.add(key(p));
      for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]) flood.push({ x:p.x+dx!, y:p.y+dy! });
    }
    expect(seen).toEqual(water);
    expect(new Set(world.scenery.river.map(r => r.x)).size).toBeGreaterThan(3);
  });
  it('only paints banks against land, including both sides of a bend', () => {
    expect(riverBankMask({x:1,y:1},new Set(['1,0','2,1','1,2','0,1']))).toBe(0);
    expect(riverBankMask({x:1,y:1},new Set(['2,1','1,2']))).toBe(9);
  });
});

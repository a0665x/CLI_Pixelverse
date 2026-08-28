# Interior Collision-Safe Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every interior Agent a constant geometric speed and prevent its feet from crossing opaque furniture, while retaining explicit seat and sleeping interactions.

**Architecture:** Add one pure navigation-policy module that derives blockers and permitted target interactions from canonical furniture geometry. Refactor `interiorMotion.ts` to interpolate cumulative path distance at one cells-per-second rate, and include the current navigation geometry in cutaway assignment invalidation so every furniture edit triggers replanning.

**Tech Stack:** TypeScript, Phaser 3 rendering, Vitest, existing canonical furniture geometry and A* helpers.

## Global Constraints

- Ingress and working routes use the same `2.5` cells-per-second speed.
- Timing uses cumulative Euclidean segment distance, not node count or a fixed transition window.
- Floor visuals are passable; opaque furniture/surface/wall geometry blocks by default.
- Chairs, office chairs, sofas, and beds remain blockers except for their explicit interaction target.
- Beds accept only `offline` Agents; other seating accepts rest/queue/arrive interactions selected by assignment.
- Functional furniture is approached at an adjacent interaction point; its entire footprint is never opened.
- Feet clearance is `0.22` cells horizontally and `0.12` cells vertically around the Agent ground contact.
- Unreachable motion remains at the last legal point and reports `blocked`; no straight-line or teleport fallback.
- Preserve unrelated dirty files and keep canonical save/reload formats backward-compatible.

---

### Task 1: Authoritative Navigation Policy and Feet Clearance

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorNavigationPolicy.ts`
- Create: `pixelworld_mvp/tests/interiorNavigationPolicy.test.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Modify: `pixelworld_mvp/tests/interiorPlacement.test.ts`

**Interfaces:**
- Produces: `interactionAccess(item: FurnitureDefinition, action: AgentAction) -> 'none' | 'seat' | 'sleep' | 'station'`.
- Produces: `opaqueNavigationBounds(item: FurnitureDefinition) -> FurnitureBounds | undefined`.
- Produces: `inflatedNavigationCellKeys(items, clearance) -> Set<string>`.
- Extends: `navigationBlockedCellKeys(items, target?, targetFurnitureId?, options?)`, where options contain `action` and `clearance`.

- [ ] **Step 1: Write failing policy tests**

```typescript
// pixelworld_mvp/tests/interiorNavigationPolicy.test.ts
import { describe, expect, it } from 'vitest';
import { interactionAccess, navigationBlockerKind } from '../src/rendering/interiorNavigationPolicy';

const item = (kind: any, layer: any = 'furniture', blocksNavigation?: boolean) => ({
  id: kind, kind, point: { x: 2, y: 2 }, facing: 'down' as const,
  supportedActions: [], icon: 'generic' as const, layer, blocksNavigation,
});

describe('interior navigation policy', () => {
  it('blocks every opaque non-floor item even when legacy data marks it false', () => {
    for (const furniture of [item('desk'), item('plant'), item('cabinet', 'surface', false), item('decor', 'wall', false)]) {
      expect(navigationBlockerKind(furniture)).toBe('solid');
    }
    expect(navigationBlockerKind(item('decor', 'floor', false))).toBe('passable');
  });

  it('opens beds only as an offline target and seating only as an explicit seat target', () => {
    expect(interactionAccess(item('bed'), 'offline')).toBe('sleep');
    expect(interactionAccess(item('bed'), 'rest')).toBe('none');
    expect(interactionAccess(item('chair'), 'rest')).toBe('seat');
    expect(interactionAccess(item('chair'), 'terminal')).toBe('none');
  });
});
```

Add a placement test proving a route cell next to a 1×1 plant becomes blocked when the Agent feet clearance overlaps its canonical bounds.

- [ ] **Step 2: Run RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorNavigationPolicy.test.ts tests/interiorPlacement.test.ts`

Expected: FAIL because the policy module and clearance options do not exist.

- [ ] **Step 3: Implement explicit policy**

```typescript
// pixelworld_mvp/src/rendering/interiorNavigationPolicy.ts
import type { AgentAction, FurnitureDefinition } from '../world/types';
import { transformedAlphaBounds, type FurnitureBounds } from './interiorPlacement';

export const AGENT_FEET_CLEARANCE = Object.freeze({ x: 0.22, y: 0.12 });
const SEATING = new Set(['chair', 'office-chair', 'sofa']);
const SEAT_ACTIONS = new Set<AgentAction>(['arrive', 'queue', 'rest']);

export function navigationBlockerKind(item: FurnitureDefinition): 'passable' | 'solid' {
  return item.layer === 'floor' ? 'passable' : 'solid';
}

export function interactionAccess(item: FurnitureDefinition, action: AgentAction) {
  if (item.kind === 'bed') return action === 'offline' ? 'sleep' as const : 'none' as const;
  if (SEATING.has(item.kind)) return SEAT_ACTIONS.has(action) ? 'seat' as const : 'none' as const;
  return item.supportedActions.includes(action) ? 'station' as const : 'none' as const;
}

export function opaqueNavigationBounds(item: FurnitureDefinition): FurnitureBounds | undefined {
  return navigationBlockerKind(item) === 'solid' ? transformedAlphaBounds(item) : undefined;
}
```

In `interiorPlacement.ts`, rasterize the canonical bounds after expanding by the requested feet clearance. Exempt only the exact rounded target cell when `interactionAccess(targetFurniture, action) !== 'none'`; never delete the rest of its footprint.

- [ ] **Step 4: Run GREEN**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorNavigationPolicy.test.ts tests/interiorPlacement.test.ts`

Expected: focused tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add pixelworld_mvp/src/rendering/interiorNavigationPolicy.ts \
  pixelworld_mvp/src/rendering/interiorPlacement.ts \
  pixelworld_mvp/tests/interiorNavigationPolicy.test.ts \
  pixelworld_mvp/tests/interiorPlacement.test.ts
git diff --cached --check
git commit -m "feat: define collision-safe interior navigation policy"
```

---

### Task 2: Interaction Points for Seats, Stations, and Beds

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorFurnitureSemantics.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorAssignment.ts`
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts`
- Modify: `pixelworld_mvp/tests/interiorAssignment.test.ts`
- Modify: `pixelworld_mvp/tests/interiorDefinitions.test.ts`
- Modify: `pixelworld_mvp/tests/builtInOfficePrefabs.test.ts`

**Interfaces:**
- `nearestSemanticStation()` passes the current `AgentAction` to navigation policy.
- `InteriorOccupantAssignment.seated` is true only for `seat`/`sleep` access.
- Every seating/bed item used as a station has an exact authored or deterministic interaction point.

- [ ] **Step 1: Write failing assignment tests**

```typescript
it('assigns an offline Agent to the bed sleep point without opening the bed as a corridor', () => {
  const room = INTERIOR_DEFINITIONS['rest-cabin'];
  const snapshot = { ...offlineSnapshot, action: 'offline' as const };
  const assignment = assignInteriorOccupants(room, [snapshot], room.id)[0]!;
  const bed = room.furniture.find(({ id }) => id === assignment.furnitureId)!;
  expect(bed.kind).toBe('bed');
  expect(assignment.point).toEqual(bed.interactionPoint);
  expect(assignment.seated).toBe(true);
});

it('does not assign a working Agent onto a chair or bed footprint', () => {
  const assignment = assignInteriorOccupants(roomWithOnlyChairAndBed, [toolSnapshot], roomWithOnlyChairAndBed.id)[0]!;
  expect(assignment.furnitureId).toBeUndefined();
  expect(assignment.missingSemantic).toBe('work');
});
```

Add prefab assertions that divider and plant normalize to blocking, while chair retains an interaction point rather than globally passable navigation.

- [ ] **Step 2: Run RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorAssignment.test.ts tests/interiorDefinitions.test.ts tests/builtInOfficePrefabs.test.ts`

Expected: current bed/nonblocking and prefab assertions fail.

- [ ] **Step 3: Route semantic candidate validation through `interactionAccess()`**

For a candidate furniture item:

```typescript
const access = interactionAccess(furniture, action);
if (access === 'none') return [];
const targets = furniture.interactionPoint
  ? [{ ...furniture.interactionPoint }]
  : fallbackInteractionCandidates(room, furniture);
```

Pass `{ action, clearance: AGENT_FEET_CLEARANCE }` to path-distance blocker construction. Set assignment `seated` when access is `seat` or `sleep`.

- [ ] **Step 4: Normalize built-in furniture behavior**

Keep explicit `interactionPoint` on chair/sofa/bed definitions. Change divider, plant, cabinet, display, and other opaque prefab members to `blocksNavigation: true`; use their `supportedByIds` only for render grouping, never to make them passable.

- [ ] **Step 5: Run GREEN**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorAssignment.test.ts tests/interiorDefinitions.test.ts tests/builtInOfficePrefabs.test.ts tests/officeRoomValidation.test.ts`

Expected: all focused semantic and definition tests pass with updated assertions.

- [ ] **Step 6: Commit Task 2**

```bash
git add pixelworld_mvp/src/rendering/interiorFurnitureSemantics.ts \
  pixelworld_mvp/src/rendering/interiorAssignment.ts \
  pixelworld_mvp/src/world/interiorDefinitions.ts \
  pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts \
  pixelworld_mvp/tests/interiorAssignment.test.ts \
  pixelworld_mvp/tests/interiorDefinitions.test.ts \
  pixelworld_mvp/tests/builtInOfficePrefabs.test.ts
git diff --cached --check
git commit -m "fix: reserve furniture overlap for explicit interactions"
```

---

### Task 3: Constant Distance-Based Motion

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorMotion.ts`
- Modify: `pixelworld_mvp/tests/interiorMotion.test.ts`

**Interfaces:**
- Produces: `interiorPathDistance(path: readonly GridPoint[]) -> number`.
- Produces: `pointAtPathDistance(path, distance) -> GridPoint`.
- Exports: `INTERIOR_CELLS_PER_SECOND = 2.5`.
- Extends: `InteriorMotionState` with `blocked: boolean`.

- [ ] **Step 1: Write failing timing and collision tests**

```typescript
it('moves the same geometric distance in the same time across short and long paths', () => {
  const short = [{ x: 0, y: 0 }, { x: 2, y: 0 }];
  const long = [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 4, y: 3 }];
  expect(pointAtPathDistance(short, 1)).toEqual({ x: 1, y: 0 });
  expect(pointAtPathDistance(long, 1)).toEqual({ x: 0, y: 1 });
  expect(interiorPathDistance(short)).toBe(2);
  expect(interiorPathDistance(long)).toBe(7);
});

it('never samples a feet point inside a non-target blocker', () => {
  const motionSamples = Array.from({ length: 120 }, (_, index) =>
    interiorMotionAt(toolSnapshot(index * 50), obstacleRoom, assignment, index * 50));
  expect(motionSamples.every(({ point }) => feetPointIsLegal(obstacleRoom, point))).toBe(true);
});
```

Add a case where A* returns only the origin and assert `blocked === true`, `walking === false`, and the point never changes.

- [ ] **Step 2: Run RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorMotion.test.ts`

Expected: missing distance helpers and current fixed-duration behavior fail.

- [ ] **Step 3: Replace node-index interpolation**

```typescript
export const INTERIOR_CELLS_PER_SECOND = 2.5;
const segmentDistance = (a: GridPoint, b: GridPoint) => Math.hypot(b.x - a.x, b.y - a.y);

export function interiorPathDistance(path: readonly GridPoint[]): number {
  return path.slice(1).reduce((sum, point, index) => sum + segmentDistance(path[index]!, point), 0);
}

export function pointAtPathDistance(path: readonly GridPoint[], requested: number): GridPoint {
  if (path.length <= 1) return { ...(path[0] ?? { x: 0, y: 0 }) };
  let remaining = Math.max(0, Math.min(requested, interiorPathDistance(path)));
  for (let index = 1; index < path.length; index += 1) {
    const from = path[index - 1]!;
    const to = path[index]!;
    const length = segmentDistance(from, to);
    if (remaining <= length) return {
      x: from.x + ((to.x - from.x) * remaining / length),
      y: from.y + ((to.y - from.y) * remaining / length),
    };
    remaining -= length;
  }
  return { ...path.at(-1)! };
}
```

Compute `durationMs = distance / INTERIOR_CELLS_PER_SECOND * 1000` for both ingress and each work route. Keep dwell time separate from travel time. Delete `WORK_TRANSITION_MS`; route timing must not depend on room size or path node count.

- [ ] **Step 4: Return blocked motion instead of fallback travel**

When origin differs from target and `interiorPath()` contains only the origin, return the origin with `blocked: true` and `walking: false`. Bubble/status consumers may display the localized path-blocked diagnostic; do not synthesize a direct segment.

- [ ] **Step 5: Run GREEN**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorMotion.test.ts tests/interiorNavigationPolicy.test.ts`

Expected: constant-speed, blocker, and blocked-state tests pass.

- [ ] **Step 6: Commit Task 3**

```bash
git add pixelworld_mvp/src/rendering/interiorMotion.ts pixelworld_mvp/tests/interiorMotion.test.ts
git diff --cached --check
git commit -m "fix: drive interior movement by path distance"
```

---

### Task 4: Replan on Every Furniture Geometry Revision

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorNavigationPolicy.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLocale.ts`
- Modify: `pixelworld_mvp/tests/interiorLocale.test.ts`

**Interfaces:**
- Produces: `interiorNavigationSignature(interior: InteriorDefinition) -> string` from sorted canonical geometry and interaction policy.
- Assignment render signature includes the navigation signature.
- Localized status key: `pathBlocked` in all four locales.

- [ ] **Step 1: Write failing mutation and persistence tests**

```typescript
it('invalidates active routes after move rotate scale undo redo and reload', () => {
  system.open('tool-smithy');
  system.update([snapshot]);
  const before = system.navigationSignatureForTest();
  moveSelectedFurniture(system, { x: 1, y: 0 });
  expect(system.navigationSignatureForTest()).not.toBe(before);
  expect(system.assignmentSignatureForTest()).toContain(system.navigationSignatureForTest());
  system.undoForTest();
  system.redoForTest();
  const blocked = navigationBlockedCellKeys(system.activeInteriorForTest().furniture);
  const path = system.currentMotionForTest(snapshot.agentId).path;
  expect(path.every(({ x, y }) => !blocked.has(`${Math.round(x)},${Math.round(y)}`))).toBe(true);
});
```

Add equivalent cases for prefab paste and save/reload, plus locale completeness assertions for `pathBlocked`.

- [ ] **Step 2: Run RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorLocale.test.ts`

Expected: signature does not include furniture geometry and copy key is absent.

- [ ] **Step 3: Implement deterministic invalidation**

Build the navigation signature from each sorted item’s `id`, canonical opaque bounds, rotation, scale, interaction point, and blocker/access type. Append it to `InteriorCutawaySystem.update()`'s assignment signature before comparing with `this.assignmentSignature`.

- [ ] **Step 4: Surface blocked diagnostics**

When `motion.blocked`, show `interiorLocale.pathBlocked` for the affected Agent and keep its sprite at the last legal point. Clear this diagnostic automatically after a valid replanned path exists.

- [ ] **Step 5: Run navigation regression suite**

Run:

```bash
cd pixelworld_mvp
npm test -- --run tests/interiorNavigationPolicy.test.ts tests/interiorPlacement.test.ts \
  tests/interiorAssignment.test.ts tests/interiorMotion.test.ts \
  tests/interiorCutawaySystem.test.ts tests/interiorLocale.test.ts
npm test -- --run
```

Expected: focused and full Vitest suites pass.

- [ ] **Step 6: Commit Task 4**

```bash
git add pixelworld_mvp/src/rendering/interiorNavigationPolicy.ts \
  pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts \
  pixelworld_mvp/src/rendering/interiorLocale.ts \
  pixelworld_mvp/tests/interiorCutawaySystem.test.ts \
  pixelworld_mvp/tests/interiorLocale.test.ts spec/modules/world-frontend.md
git diff --cached --check
git commit -m "feat: replan interior routes after layout changes"
```

# Interior Focus and Hybrid Office Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide exterior village labels while an interior is open and replace unsaved work-room defaults with coherent high-density hybrid offices.

**Architecture:** `WorldScene` owns an explicit interior-focus state and coordinates visibility through small system APIs rather than DOM inference. Work-office definitions continue to compose immutable Modern Office v1.2 prefabs, but use a room-level spatial program with two central bench islands, specialist side stations, shared services, and a validated circulation spine. The existing saved-layout boundary remains authoritative.

**Tech Stack:** TypeScript, Phaser 3, DOM/CSS, Vite, Vitest, Modern Office Revamped v1.2 assets, Docker Compose, CodeGraph.

## Global Constraints

- Interior focus hides exterior building names, zone labels, agent labels, building badges, and exterior speech bubbles; it never hides interior Hook, occupant, status, or control labels.
- Closing or switching interiors restores or preserves focus deterministically with no one-frame exterior-label flash.
- Work offices remain 18×12; Arrival, Awaiting, Rest, and Offline rooms remain compact.
- Valid user-saved layouts always win and are never automatically overwritten or migrated.
- New office furniture uses only Modern Office Revamped v1.2 and keeps licensed files outside Git and the image.
- The centered entrance opens into a continuously two-tile-wide main aisle; every action-bearing Hook has an ordinary orthogonal A* path to its authored interaction point.
- Built-in groups remain atomic until Dissolve and preserve layer, z-index, rotation, scale, opaque bounds, visual offset, and interaction point.
- New visible copy supports `zh-TW`, `en-US`, `ja-JP`, and `ko-KR`; no rendering system hardcodes operational copy.
- Hidden DOM labels leave the accessibility tree, and reduced-motion mode performs focus visibility changes without animation.
- Preserve every unrelated dirty or untracked user file; stage exact task paths only.

---

## File Structure

- Create `pixelworld_mvp/src/rendering/InteriorFocusController.ts`: idempotent scene-level focus coordinator and visibility target contract.
- Create `pixelworld_mvp/tests/interiorFocusController.test.ts`: focus transitions, switching, teardown, and accessibility semantics.
- Modify `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`: explicit open-state callback and no-flash building switching.
- Modify `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`: exterior-overlay focus visibility API.
- Modify `pixelworld_mvp/src/rendering/domStatusOverlay.ts`: hide exterior DOM status layers with `hidden` semantics.
- Modify `pixelworld_mvp/src/scenes/WorldScene.ts`: register exterior label targets and coordinate focus lifecycle.
- Modify `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`, `statusOverlayErrors.test.ts`, and `worldSceneLocale.test.ts`: runtime integration regressions.
- Modify `pixelworld_mvp/src/world/interiorDefinitions.ts`: hybrid high-density Research, Maker, and Collaboration default compositions.
- Modify `pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts`: make all three approved built-ins available to every work theme; do not add an asset family.
- Modify `pixelworld_mvp/tests/interiorDefinitions.test.ts` and `interiorAssignment.test.ts`: spatial-program and Hook-path regressions.
- Create `pixelworld_mvp/tests/officeRoomValidation.test.ts` and `compactInteriorValidation.test.ts`: complete-room and compact-preservation gates.
- Modify `pixelworld_mvp/src/styles.css`: focus visibility transition and reduced-motion behavior.
- Modify deployment tests only if QA exposes a real integration regression.

---

### Task 1: Explicit Interior Focus State and Exterior Visibility Contract

**Files:**
- Create: `pixelworld_mvp/src/rendering/InteriorFocusController.ts`
- Create: `pixelworld_mvp/tests/interiorFocusController.test.ts`
- Modify: `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/domStatusOverlay.ts`
- Test: `pixelworld_mvp/tests/statusOverlayErrors.test.ts`

**Interfaces:**
- Consumes: existing Phaser building/zone label objects and `StatusOverlaySystem` exterior overlays.
- Produces: `InteriorFocusTarget`, `InteriorFocusController.register(target)`, `setFocused(focused)`, `isFocused()`, and `destroy()`; `StatusOverlaySystem.setExteriorLabelsVisible(visible)`.

- [ ] **Step 1: Write failing controller transition tests**

```ts
it('hides every registered exterior target and restores its current visibility', () => {
  const building = fakeTarget(true);
  const zone = fakeTarget(false);
  const controller = new InteriorFocusController([building, zone]);
  controller.setFocused(true);
  expect(building.visible()).toBe(false);
  expect(zone.visible()).toBe(false);
  controller.setFocused(false);
  expect(building.visible()).toBe(true);
  expect(zone.visible()).toBe(false);
});

it('keeps labels hidden while switching directly between interiors', () => {
  const label = fakeTarget(true);
  const controller = new InteriorFocusController([label]);
  controller.setFocused(true);
  controller.setFocused(true);
  expect(label.visibilityWrites()).toEqual([false]);
});
```

- [ ] **Step 2: Run RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorFocusController.test.ts tests/statusOverlayErrors.test.ts`  
Expected: FAIL because the focus controller and status visibility API do not exist.

- [ ] **Step 3: Implement the focused target contract**

```ts
export interface InteriorFocusTarget {
  visible(): boolean;
  setVisible(visible: boolean): void;
}

export class InteriorFocusController {
  private focused = false;
  private readonly prior = new Map<InteriorFocusTarget, boolean>();
  constructor(private readonly targets: InteriorFocusTarget[] = []) {}
  register(target: InteriorFocusTarget): () => void;
  setFocused(focused: boolean): void;
  isFocused(): boolean { return this.focused; }
  destroy(): void;
}
```

`setFocused(true)` snapshots each target only once and hides it. `setFocused(false)` restores the snapshot and clears it. Registering while focused hides the new target immediately. Repeated calls are no-ops.

- [ ] **Step 4: Add status-overlay focus behavior**

`StatusOverlaySystem.setExteriorLabelsVisible(false)` hides Phaser bubbles, building badges, and the entire exterior DOM overlay. `publish`, `update`, `refreshBuildings`, and `setLocale` continue updating cached content while focused but cannot make exterior elements visible. Restoring visibility recomputes the current agent/building state rather than restoring stale text.

`DomStatusOverlay.setVisible(false)` sets its host containers to `hidden=true` so links or controls cannot remain in the accessibility tree.

- [ ] **Step 5: Run GREEN and typecheck**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorFocusController.test.ts tests/statusOverlayErrors.test.ts && npm run typecheck`  
Expected: all focused tests pass and TypeScript exits 0.

- [ ] **Step 6: Commit the visibility boundary**

```bash
git add pixelworld_mvp/src/rendering/InteriorFocusController.ts pixelworld_mvp/src/rendering/StatusOverlaySystem.ts pixelworld_mvp/src/rendering/domStatusOverlay.ts pixelworld_mvp/tests/interiorFocusController.test.ts pixelworld_mvp/tests/statusOverlayErrors.test.ts
git commit -m "feat: add interior focus visibility boundary"
```

### Task 2: Wire Cutaway Open/Close to Village Labels Without Flash

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/scenes/WorldScene.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Create: `pixelworld_mvp/tests/worldSceneInteriorFocus.test.ts`

**Interfaces:**
- Consumes: `InteriorFocusController` and existing building/zone Phaser text collections.
- Produces: `InteriorCutawaySystemOptions.onOpenStateChange(open: boolean, buildingId?: string)` and `WorldScene.setInteriorFocused(open)`.

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it('emits one open transition, keeps focus during building switches, and emits close once', () => {
  const states: Array<[boolean, string | undefined]> = [];
  const system = cutaway({ onOpenStateChange: (open, id) => states.push([open, id]) });
  system.open(researchBuilding);
  system.open(toolBuilding);
  system.close();
  expect(states).toEqual([[true, researchBuilding.id], [true, toolBuilding.id], [false, undefined]]);
});

it('hides building, zone, and exterior status targets while preserving interior labels', () => {
  const scene = worldSceneHarness();
  scene.openBuilding('network-lab');
  expect(scene.exteriorLabelsVisible()).toBe(false);
  expect(scene.cutawayLabelsVisible()).toBe(true);
  scene.closeCutaway();
  expect(scene.exteriorLabelsVisible()).toBe(true);
});
```

- [ ] **Step 2: Run RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts tests/worldSceneInteriorFocus.test.ts`  
Expected: FAIL because cutaway lifecycle changes are not exposed and exterior label objects are not registered.

- [ ] **Step 3: Add the explicit cutaway callback**

Extend the cutaway constructor options with:

```ts
onOpenStateChange?: (open: boolean, buildingId?: string) => void;
```

Call it after a successful first open and after the active building ID changes. `close()` calls it only when an interior was open. `destroy()` closes once. Never emit `false` between direct building switches.

- [ ] **Step 4: Register exterior labels in `WorldScene`**

Wrap each building-name and zone-label Phaser text object as an `InteriorFocusTarget`. Register `StatusOverlaySystem` through a target whose setter calls `setExteriorLabelsVisible`. Cutaway DOM room labels are not registered and therefore remain visible.

Scene shutdown calls `focusController.destroy()` after cutaway teardown. Locale and live-snapshot updates may change exterior text while focused without revealing it.

- [ ] **Step 5: Add focus CSS and reduced-motion fallback**

```css
.village-exterior-label-layer[hidden],
.village-exterior-status-layer[hidden] { display: none !important; }

@media (prefers-reduced-motion: no-preference) {
  .village-exterior-label-layer { transition: opacity 120ms ease-out; }
}
```

Phaser labels use direct visibility; DOM exterior layers use `hidden`. Do not fade the village canvas or cutaway.

- [ ] **Step 6: Run GREEN and full focus integration**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorFocusController.test.ts tests/interiorCutawaySystem.test.ts tests/worldSceneInteriorFocus.test.ts tests/statusOverlayErrors.test.ts tests/worldSceneLocale.test.ts && npm run typecheck`  
Expected: all tests pass with no output warnings.

- [ ] **Step 7: Commit focus integration**

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/scenes/WorldScene.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests/interiorCutawaySystem.test.ts pixelworld_mvp/tests/worldSceneInteriorFocus.test.ts
git commit -m "feat: hide village labels during interior focus"
```

### Task 3: Compose High-Density Hybrid Work Offices

**Files:**
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts`
- Modify: `pixelworld_mvp/tests/interiorDefinitions.test.ts`
- Create: `pixelworld_mvp/tests/officeRoomValidation.test.ts`
- Create: `pixelworld_mvp/tests/compactInteriorValidation.test.ts`
- Modify: `pixelworld_mvp/tests/interiorAssignment.test.ts`

**Interfaces:**
- Consumes: `builtInPrefab`, `placeOfficePrefab`, `officeLayoutIssues`, and `interiorPath`.
- Produces: dense default `INTERIOR_DEFINITIONS` for `research-library`, `maker-workshop`, and `collaboration-barn` without changing saved-layout resolution.

- [ ] **Step 1: Write failing spatial-program tests**

```ts
it.each(['research-library', 'maker-workshop', 'collaboration-barn'] as const)('%s has a hybrid office program', (themeId) => {
  const room = INTERIOR_DEFINITIONS[themeId];
  const instances = new Map<string, number>();
  room.furniture.forEach((item) => {
    if (item.prefabInstanceId) instances.set(item.prefabInstanceId, (instances.get(item.prefabInstanceId) ?? 0) + 1);
  });
  expect([...instances.keys()].filter((id) => id.includes('bench-four'))).toHaveLength(2);
  expect([...instances.keys()].some((id) => id.includes('pod-l-two'))).toBe(true);
  expect([...instances.keys()].some((id) => id.includes('control-m-three'))).toBe(true);
  expect(primarySeatCount(room)).toBeGreaterThanOrEqual(12);
});
```

Also assert each theme has a meeting/support zone, aligned back-wall storage, no door blocker, and compact profiles remain 14×9.

- [ ] **Step 2: Run RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorDefinitions.test.ts tests/officeRoomValidation.test.ts tests/interiorAssignment.test.ts`  
Expected: FAIL because current themes do not all contain the approved two-bench plus L/M spatial program.

- [ ] **Step 3: Define explicit office-zone anchors**

First expose every approved group to every work theme while keeping compact themes unchanged:

```ts
const WORK_OFFICE_PREFABS = Object.freeze(['bench-four', 'pod-l-two', 'control-m-three']);
const THEME_PREFAB_IDS: Readonly<Record<BuildingThemeId, readonly string[]>> = Object.freeze({
  'rest-cabin': Object.freeze([]),
  'research-library': WORK_OFFICE_PREFABS,
  'maker-workshop': WORK_OFFICE_PREFABS,
  'collaboration-barn': WORK_OFFICE_PREFABS,
});
```

Add a typed composition table in `interiorDefinitions.ts`:

```ts
interface OfficeZonePlacement { prefabId: BuiltInOfficePrefabId; anchor: GridPoint; rotation?: FurnitureRotation }

const HYBRID_OFFICE_ZONES = {
  'research-library': {
    central: [
      { prefabId: 'bench-four', anchor: { x: 4, y: 3 } },
      { prefabId: 'bench-four', anchor: { x: 4, y: 7 } },
    ],
    specialist: [
      { prefabId: 'pod-l-two', anchor: { x: 13, y: 3 } },
      { prefabId: 'control-m-three', anchor: { x: 13, y: 8 } },
    ],
  },
  'maker-workshop': {
    central: [
      { prefabId: 'bench-four', anchor: { x: 4, y: 3 } },
      { prefabId: 'bench-four', anchor: { x: 4, y: 7 } },
    ],
    specialist: [
      { prefabId: 'pod-l-two', anchor: { x: 13, y: 3 } },
      { prefabId: 'control-m-three', anchor: { x: 13, y: 8 } },
    ],
  },
  'collaboration-barn': {
    central: [
      { prefabId: 'bench-four', anchor: { x: 4, y: 3 } },
      { prefabId: 'bench-four', anchor: { x: 4, y: 7 } },
    ],
    specialist: [
      { prefabId: 'pod-l-two', anchor: { x: 13, y: 3 } },
      { prefabId: 'control-m-three', anchor: { x: 13, y: 8 } },
    ],
  },
} satisfies Partial<Record<BuildingThemeId, { central: OfficeZonePlacement[]; specialist: OfficeZonePlacement[] }>>;
```

Use these anchors as the authored target. If opaque bounds make one placement invalid, change the whole table through a RED/GREEN room-validation test while preserving the same zone order, all seats, actions, and anchors. Never make validation pass by deleting seats, actions, or interaction anchors. Keep a two-tile entrance spine centered at door X and a two-tile cross aisle separating central islands from specialist zones.

- [ ] **Step 4: Add coherent support-zone furniture**

Place storage, bookcases, printer/device station, planning board, and compact meeting furniture along room edges. Every support item has a semantic ID, Modern Office v1.2 asset, correct layer/z-index, and an authored `interactionPoint` when it supports actions. Append support furniture before final validation.

Do not use support furniture to fill empty cells indiscriminately. Maintain one compact collaboration corner and visually continuous back-wall services.

- [ ] **Step 5: Validate the complete final room**

For every work theme, call `officeLayoutIssues(room)` after all prefabs and support furniture are present. Throw a development-time error containing theme, item IDs, cells, and diagnostics when issues are nonempty.

Tests iterate every action-bearing furniture item, calculate the production interaction point, and require `interiorPath(room, doorPoint, interactionPoint, furniture.id)` to contain at least two points and end exactly at the authored point.

- [ ] **Step 6: Prove saved-layout and compact-room preservation**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorDefinitions.test.ts tests/officeRoomValidation.test.ts tests/interiorAssignment.test.ts tests/interiorLayoutEditor.test.ts tests/compactInteriorValidation.test.ts`  
Expected: all tests pass; saved layouts remain unchanged and all four compact rooms retain their prior dimensions and valid geometry.

- [ ] **Step 7: Commit the office composition**

```bash
git add pixelworld_mvp/src/world/interiorDefinitions.ts pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts pixelworld_mvp/tests/interiorDefinitions.test.ts pixelworld_mvp/tests/officeRoomValidation.test.ts pixelworld_mvp/tests/compactInteriorValidation.test.ts pixelworld_mvp/tests/interiorAssignment.test.ts
git commit -m "feat: compose high-density hybrid offices"
```

### Task 4: Full Regression, Browser QA, Deployment, and CodeGraph

**Files:**
- Modify only if QA exposes a regression in Task 1–3 files.
- Verify: `docs/superpowers/specs/2026-08-13-interior-focus-hybrid-office-design.md`

**Interfaces:**
- Consumes: completed focus controller and hybrid office defaults.
- Produces: verified service at `http://127.0.0.1:5661/`, screenshots, clean console, source-attested image, and current CodeGraph.

- [ ] **Step 1: Run every automated suite from exact HEAD**

```bash
node --test tests/*.mjs
python -m pytest -q
cd pixelworld_mvp && npm run typecheck && npm test -- --run && npm run build
```

Expected: zero failures; the existing Vite large-chunk advisory may remain informational.

- [ ] **Step 2: Verify saved-layout protection in a clean browser profile**

Save a modified room, record the serialized `pixelworld:interior-layout:<buildingId>` value, rebuild/reload, and assert exact equality. Open an unsaved work building and confirm the new hybrid default appears.

- [ ] **Step 3: Browser-QA focus mode**

With genuine canvas input:

- open a work room and a compact room;
- assert building names, zone labels, exterior agent labels, building badges, and exterior bubbles are absent from display/accessibility tree;
- assert cutaway title, Hook labels, occupants, status, and controls remain visible;
- switch buildings without closing and confirm no one-frame label flash;
- close and confirm current exterior state returns;
- emulate reduced motion and confirm immediate transition.

- [ ] **Step 4: Browser-QA office readability and motion**

Capture Research, Maker, and Collaboration screenshots. Confirm two central bench islands, L/U pod, M console, shared back-wall services, and compact meeting zone read as coherent departments. Trigger Web/MCP, Tool, Edit, Clone, and Response; confirm door entry, orthogonal travel, exact workstation settling, and wall occlusion.

- [ ] **Step 5: Regression-QA editing**

Move/rotate/duplicate/return/dissolve/undo one central bench group, then reload after Save. Confirm the group remains coherent and no operation blocks another Hook or the entrance aisle.

- [ ] **Step 6: Rebuild through the ordinary source-attested workflow**

Run: `./run.sh start`  
Expected: the service rebuilds when revision/fingerprint changed, provisions licensed assets from the local archive, mounts them read-only, labels the image with exact HEAD, and starts healthy on port 5661.

Verify:

```bash
curl -fsS http://127.0.0.1:5661/health
docker inspect cli-pixelverse --format '{{ index .Config.Labels "org.opencontainers.image.revision" }}'
```

Expected: health contains `"ok":true` and the revision equals `git rev-parse HEAD`.

- [ ] **Step 7: Verify console, private assets, and CodeGraph**

Browser console contains no application errors or failed asset requests. A container without the private mount contains no Modern Office private files. Then run:

```bash
codegraph sync .
codegraph status .
```

Expected: `Index is up to date`.

- [ ] **Step 8: Commit only QA corrections when necessary**

If QA required a correction, append RED/GREEN evidence to the task report, rerun the focused and full commands above, and amend the task commit using only its explicitly listed paths. If no correction was required, create no QA-only commit.

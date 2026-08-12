# Modern Office Prefabs and Apple WebUI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build coherent Modern Office v1.2 workstation prefabs and 18×12 work interiors without overwriting saved rooms, then polish the dashboard and cutaway controls with a restrained Apple-style functional glass layer.

**Architecture:** Add immutable built-in prefab definitions and pure geometry/validation helpers beside the existing user-prefab store. Interior themes choose compact or work-office dimensions and load new defaults only through the existing saved-layout boundary. The cutaway editor consumes built-in and user prefabs through one shelf interface, while dashboard and cutaway styling share explicit material tokens and accessibility fallbacks.

**Tech Stack:** TypeScript, Phaser 3, Vite, Vitest, DOM/CSS, vanilla JavaScript, Node test runner, pytest, Docker Compose, Modern Office Revamped v1.2 assets.

## Global Constraints

- Use only Modern Office Revamped v1.2 assets for the new office furniture and prefabs.
- Work-oriented interiors are 18×12; domestic rest, offline, and waiting interiors remain compact.
- Never overwrite a valid user-saved room layout with a new default or template.
- Keep a two-tile main aisle from the entrance and an A*-reachable interaction anchor for every required Hook workstation.
- Preserve per-item layer, z-index, rotation, scale, minimal opaque bounds, and off-grid visual alignment inside prefabs.
- Liquid Glass is limited to navigation and control layers; do not apply glass to village content, data tables, or glass-on-glass nesting.
- New visible copy supports `zh-TW`, `en-US`, `ja-JP`, and `ko-KR` through the existing locale bridge.
- Respect `prefers-reduced-motion`, `prefers-reduced-transparency`, and `prefers-contrast: more`.
- The purchased source archive stays local and must not be committed or redistributed.
- Preserve the persisted furniture layers `floor | furniture | surface | wall`; treat `wall` as the furniture foreground/occlusion layer, while the agent layer remains renderer-owned.

## File Structure

- Create `pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts`: immutable v1.2 prefab definitions and theme template composition.
- Create `pixelworld_mvp/src/rendering/prefabGeometry.ts`: cloning, bounds, rotation, placement, and Hook-route validation for grouped furniture.
- Create `pixelworld_mvp/src/rendering/interiorUndoStore.ts`: bounded in-memory undo history for furniture mutations.
- Create `pixelworld_mvp/tests/builtInOfficePrefabs.test.ts`: asset-family, composition, bounds, and office-density tests.
- Create `pixelworld_mvp/tests/prefabGeometry.test.ts`: grouped transform and route validation tests.
- Create `pixelworld_mvp/tests/interiorUndoStore.test.ts`: undo isolation and cloning tests.
- Modify `pixelworld_mvp/src/world/types.ts`: richer prefab metadata and theme sizing fields.
- Modify `pixelworld_mvp/src/world/interiorDefinitions.ts`: 18×12 work defaults composed from built-in prefabs.
- Modify `pixelworld_mvp/src/world/worldDefinition.ts`: mark each building as compact or work-office independently of its visual theme.
- Modify `pixelworld_mvp/src/world/validateWorld.ts`: validate the resolved per-building interior rather than the visual theme alone.
- Modify `pixelworld_mvp/src/rendering/interiorPrefabStore.ts`: expose built-in and user prefabs through a common placement contract.
- Modify `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`: saved-layout probing and strict default-preservation boundary.
- Modify `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`: responsive room scale, prefab shelf, preview/apply/dissolve/undo actions.
- Modify `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`: template preview and localized group controls.
- Modify `pixelworld_mvp/src/i18n/villageLocale.ts`: prefab, preview, dissolve, undo, and validation copy.
- Modify `pixelworld_mvp/src/styles.css`: cutaway functional-glass material and accessibility variants.
- Modify `public/index.html`: dashboard material tokens, functional glass controls, standard content panels, typography, accessibility variants.
- Modify `public/app.mjs`: pointer-down press state and spatially anchored control feedback without changing existing dashboard data flow.
- Modify relevant existing Vitest, Node, and Python tests to lock integration behavior.

---

### Task 1: Rich Prefab Contract and Pure Group Geometry

**Files:**
- Create: `pixelworld_mvp/src/rendering/prefabGeometry.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`
- Test: `pixelworld_mvp/tests/prefabGeometry.test.ts`

**Interfaces:**
- Consumes: existing `FurnitureDefinition`, `FurnitureLayer`, `FurnitureRotation`, `GridPoint`, and `InteriorDefinition`.
- Produces: `OfficePrefabDefinition`, `PrefabPlacementResult`, `cloneOfficePrefab(prefab)`, `prefabBounds(prefab)`, `rotatePrefab(prefab, rotation)`, `placeOfficePrefab(room, layout, prefab, anchor, now)`, and `validateOfficePrefab(room, layout, prefab, anchor)`.

- [ ] **Step 1: Write failing tests for cloned metadata, minimal union bounds, and 90-degree grouped rotation**

```ts
it('preserves internal layers and off-grid offsets while cloning', () => {
  const cloned = cloneOfficePrefab(samplePrefab);
  expect(cloned).not.toBe(samplePrefab);
  expect(cloned.items[1]!.layer).toBe('surface');
  expect(cloned.items[1]!.visualOffset).toEqual({ x: -0.25, y: 0.125 });
});

it('rotates every relative point around the prefab anchor', () => {
  const rotated = rotatePrefab(samplePrefab, 90);
  expect(rotated.items.map(({ point }) => point)).toEqual([
    { x: 0, y: 0 }, { x: -1, y: 1 },
  ]);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/prefabGeometry.test.ts`  
Expected: FAIL because `prefabGeometry.ts` and the richer prefab fields do not exist.

- [ ] **Step 3: Add the exact prefab contract to `world/types.ts`**

```ts
export interface FurnitureVisualOffset { x: number; y: number }

export interface OfficePrefabDefinition extends FurniturePrefab {
  source: 'modern-office-v1.2' | 'user';
  immutable: boolean;
  category: 'bench' | 'pod' | 'control' | 'meeting' | 'support';
  hookActions: AgentAction[];
  anchor: GridPoint;
  interactionAnchors: Array<{ point: GridPoint; actions: AgentAction[] }>;
}
```

Add `visualOffset?: FurnitureVisualOffset` and `prefabInstanceId?: string` to `FurnitureDefinition`.
Add optional `interiorProfile?: 'compact' | 'work-office'` to `WorldBuilding`; it controls room composition, not the building's outdoor visual theme. It stays optional in Task 1 so the geometry commit typechecks before Task 3 annotates every authored building.

- [ ] **Step 4: Implement pure cloning, union-bounds, rotation, validation, and placement**

```ts
export function placeOfficePrefab(
  room: InteriorDefinition,
  layout: readonly FurnitureDefinition[],
  prefab: OfficePrefabDefinition,
  anchor: GridPoint,
  now = Date.now(),
): PrefabPlacementResult {
  const transformed = transformPrefabItems(prefab, anchor, now);
  const diagnostics = validatePlacedItems(room, layout, transformed, prefab.interactionAnchors);
  return diagnostics.length
    ? { accepted: false, layout: cloneFurnitureLayout(layout), diagnostics }
    : { accepted: true, layout: [...cloneFurnitureLayout(layout), ...transformed], diagnostics: [] };
}
```

Validation must reject `outside-room`, `blocks-door`, `invalid-asset`, and unreachable interaction anchors while allowing `surface` items to overlap their supporting desks.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `cd pixelworld_mvp && npm test -- --run tests/prefabGeometry.test.ts && npm run typecheck`  
Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the geometry boundary**

```bash
git add pixelworld_mvp/src/world/types.ts pixelworld_mvp/src/rendering/prefabGeometry.ts pixelworld_mvp/tests/prefabGeometry.test.ts
git commit -m "feat: add grouped office prefab geometry"
```

### Task 2: Curated Modern Office v1.2 Prefab Library

**Files:**
- Create: `pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts`
- Create: `pixelworld_mvp/tests/builtInOfficePrefabs.test.ts`
- Modify: `pixelworld_mvp/src/rendering/modernOfficeCatalog.ts`

**Interfaces:**
- Consumes: `OfficePrefabDefinition`, `catalogItem(assetId)`, and Modern Office catalog metadata.
- Produces: `BUILT_IN_OFFICE_PREFABS`, `builtInPrefab(id)`, and `prefabsForTheme(themeId)`.

- [ ] **Step 1: Write failing tests for the three approved workstation archetypes**

```ts
it.each(['bench-four', 'pod-l-two', 'control-m-three'])('%s is a complete v1.2 workstation', (id) => {
  const prefab = builtInPrefab(id)!;
  expect(prefab.source).toBe('modern-office-v1.2');
  expect(prefab.items.some(({ layer }) => layer === 'furniture')).toBe(true);
  expect(prefab.items.some(({ layer }) => layer === 'surface')).toBe(true);
  expect(prefab.items.every(({ assetId }) => assetId === undefined || catalogItem(assetId)?.path.includes('modern-office-v1.2'))).toBe(true);
  expect(prefab.interactionAnchors.length).toBeGreaterThanOrEqual(2);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/builtInOfficePrefabs.test.ts`  
Expected: FAIL because the built-in library does not exist.

- [ ] **Step 3: Give selected catalog IDs semantic labels**

Replace generic labels only for assets used by the curated templates, for example `Bench Desk Left`, `Low Divider`, `Dual Monitor`, `Office Chair`, `Keyboard`, and `Document Stack`. Do not rename unrelated catalog entries.

- [ ] **Step 4: Define complete immutable prefabs**

```ts
export const BUILT_IN_OFFICE_PREFABS: readonly OfficePrefabDefinition[] = [
  defineOfficePrefab({
    id: 'bench-four', name: 'Four-seat Double Bench', category: 'bench',
    hookActions: ['signal', 'terminal', 'type'],
    anchor: { x: 0, y: 0 },
    items: [deskNW, deskNE, deskSW, deskSE, dividerVertical, dividerHorizontal,
      monitorNW, monitorNE, monitorSW, monitorSE, chairNW, chairNE, chairSW, chairSE,
      keyboardNW, keyboardNE, papersSW, lampSE],
    interactionAnchors: fourSeatAnchors,
  }),
  defineOfficePrefab({
    id: 'pod-l-two', name: 'Two-seat L Pod', category: 'pod',
    hookActions: ['ponder', 'plan', 'read'],
    anchor: { x: 0, y: 0 },
    items: [podDeskNorth, podDeskWest, podDeskEast, podDivider,
      podMonitorWest, podMonitorEast, podChairWest, podChairEast,
      podKeyboardWest, podKeyboardEast, podPapers, podPlant],
    interactionAnchors: twoSeatAnchors,
  }),
  defineOfficePrefab({
    id: 'control-m-three', name: 'Three-seat M Control Console', category: 'control',
    hookActions: ['terminal', 'tool', 'edit', 'signal'],
    anchor: { x: 0, y: 0 },
    items: [controlDeskLeft, controlDeskCenter, controlDeskRight,
      controlWingLeft, controlWingRight, controlDividerLeft, controlDividerRight,
      controlMonitorLeft, controlMonitorCenter, controlMonitorRight,
      controlKeyboardLeft, controlKeyboardCenter, controlKeyboardRight,
      controlChairLeft, controlChairCenter, controlChairRight, controlDocuments],
    interactionAnchors: threeSeatAnchors,
  }),
];
```

Use concrete catalog IDs verified against the local v1.2 sheet and singles. Every surface item must share the correct desk-relative position and use a higher z-index.

- [ ] **Step 5: Run prefab and catalog tests**

Run: `cd pixelworld_mvp && npm test -- --run tests/builtInOfficePrefabs.test.ts tests/modernOfficeCatalog.test.ts`  
Expected: all tests PASS.

- [ ] **Step 6: Commit the built-in library**

```bash
git add pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts pixelworld_mvp/src/rendering/modernOfficeCatalog.ts pixelworld_mvp/tests/builtInOfficePrefabs.test.ts
git commit -m "feat: add Modern Office workstation prefabs"
```

### Task 3: Compose 18×12 Work Themes and Preserve Saved Rooms

**Files:**
- Modify: `pixelworld_mvp/src/world/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/world/worldDefinition.ts`
- Modify: `pixelworld_mvp/src/world/validateWorld.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/tests/interiorDefinitions.test.ts`
- Modify: `pixelworld_mvp/tests/validateWorld.test.ts`
- Modify: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Consumes: `prefabsForTheme(themeId)`, `placeOfficePrefab`, and the current `pixelworld:interior-layout:<buildingId>` storage format.
- Produces: `hasSavedInteriorLayout(buildingId, storage)`, `interiorDefinitionForBuilding(building)`, and updated `INTERIOR_DEFINITIONS`.

- [ ] **Step 1: Write failing tests for work-room dimensions and saved-layout priority**

```ts
it.each(['research-library', 'maker-workshop', 'collaboration-barn'] as const)('%s uses the work-office footprint', (id) => {
  expect(INTERIOR_DEFINITIONS[id]).toMatchObject({ width: 18, height: 12 });
});

it('keeps the waiting post compact even though it shares the collaboration visual theme', () => {
  const waitingPost = WORLD_DEFINITION.buildings.find(({ id }) => id === 'awaiting-post')!;
  expect(waitingPost).toMatchObject({ themeId: 'collaboration-barn', interiorProfile: 'compact' });
  expect(interiorDefinitionForBuilding(waitingPost).width).toBeLessThan(18);
});

it('returns a valid saved layout unchanged when defaults gain office prefabs', () => {
  saveInteriorLayout('network-lab', savedFurniture, storage);
  expect(loadInteriorLayout('network-lab', INTERIOR_DEFINITIONS['research-library'], storage)).toEqual(savedFurnitureNormalized);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorDefinitions.test.ts tests/interiorLayoutEditor.test.ts`  
Expected: FAIL because work themes remain 14×9, buildings have no interior profile, and no saved-layout probe is exported.

- [ ] **Step 3: Compose coherent theme defaults from built-in prefabs**

Use explicit anchors:

```ts
const WORK_THEME_SIZE = { width: 18, height: 12 } as const;
const researchFurniture = composeThemeLayout('research-library', [
  ['bench-four', { x: 4, y: 3 }],
  ['bench-four', { x: 4, y: 7 }],
  ['pod-l-two', { x: 12, y: 3 }],
  ['meeting-four', { x: 5, y: 9 }],
  ['archive-wall', { x: 15, y: 8 }],
]);
```

Maker uses bench and M-control groups plus repair/support zones. Collaboration uses M-control, meeting, response, and clone groups. Preserve a two-tile route from the centered door to the main cross aisle.

- [ ] **Step 4: Resolve interior size per building, not just per visual theme**

Set `interiorProfile: 'work-office'` on Web/MCP, Tool, Edit, Clone, and Response work buildings. Set `interiorProfile: 'compact'` on Rest, Offline, Arrival, and Awaiting buildings. Export `interiorDefinitionForBuilding(building)` from `interiorDefinitions.ts`; it returns a fresh 18×12 theme definition for work-office buildings and a fresh compact definition for compact buildings. In particular, `awaiting-post` and `arrival-lodge` keep compact collaboration furniture even though their outdoor house theme remains `collaboration-barn`.

Update `InteriorCutawaySystem.open()` and `validateWorld()` to use `interiorDefinitionForBuilding(building)`. Do not rename the theme IDs or storage keys.

- [ ] **Step 5: Add the saved-layout probe without changing valid storage payloads**

```ts
export function hasSavedInteriorLayout(buildingId: string, storage: StorageLike | undefined = browserStorage()): boolean {
  const raw = storage?.getItem(storageKey(buildingId));
  return raw !== null && parseSavedInteriorLayout(raw) !== undefined;
}
```

Refactor parsing so `hasSavedInteriorLayout` and `loadInteriorLayout` use the same validation. A valid saved layout always wins; malformed data falls back in memory and is not written until explicit save.

- [ ] **Step 6: Run definition, world validation, storage, placement, and assignment tests**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorDefinitions.test.ts tests/validateWorld.test.ts tests/interiorLayoutEditor.test.ts tests/interiorPlacement.test.ts tests/interiorAssignment.test.ts`  
Expected: all tests PASS.

- [ ] **Step 7: Commit the new defaults and preservation boundary**

```bash
git add pixelworld_mvp/src/world/interiorDefinitions.ts pixelworld_mvp/src/world/worldDefinition.ts pixelworld_mvp/src/world/validateWorld.ts pixelworld_mvp/src/rendering/interiorLayoutEditor.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/tests/interiorDefinitions.test.ts pixelworld_mvp/tests/validateWorld.test.ts pixelworld_mvp/tests/interiorLayoutEditor.test.ts
git commit -m "feat: compose dense work office interiors"
```

### Task 4: Unified Built-in and User Prefab Shelf

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorPrefabStore.ts`
- Modify: `pixelworld_mvp/tests/interiorPrefabStore.test.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`

**Interfaces:**
- Consumes: `BUILT_IN_OFFICE_PREFABS`, `loadPrefabs`, and `placeOfficePrefab`.
- Produces: `availablePrefabs(storage)`, `isBuiltInPrefab(prefab)`, and a cutaway shelf ordered as required Hooks → built-ins → user assemblies → singles.

- [ ] **Step 1: Write failing tests for shelf ordering and immutable built-ins**

```ts
it('lists built-ins before user assemblies without persisting built-ins', () => {
  const listed = availablePrefabs(storageWithUserPrefab);
  expect(listed.map(({ id }) => id).slice(0, 3)).toEqual(['bench-four', 'pod-l-two', 'control-m-three']);
  savePrefabs(listed, storageWithUserPrefab);
  expect(JSON.parse(storageWithUserPrefab.getItem(PREFAB_KEY)!).prefabs).toHaveLength(1);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorPrefabStore.test.ts tests/interiorCutawaySystem.test.ts`  
Expected: FAIL because only user assemblies are returned.

- [ ] **Step 3: Merge built-ins at read time and filter them at save time**

```ts
export function availablePrefabs(storage?: StorageLike): OfficePrefabDefinition[] {
  return [...BUILT_IN_OFFICE_PREFABS.map(cloneOfficePrefab), ...loadPrefabs(storage).map(asUserOfficePrefab)];
}
```

- [ ] **Step 4: Render built-in prefab shelf entries as group previews**

Replace the single first-item proxy with a small Phaser container preview containing all prefab parts at shelf scale. Dragging creates matching multi-part ghosts and commits through `placeOfficePrefab`. Tint only the selection outline; do not tint the actual Modern Office pixels.

- [ ] **Step 5: Run shelf, cutaway, and prefab tests**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorPrefabStore.test.ts tests/interiorCutawaySystem.test.ts tests/builtInOfficePrefabs.test.ts tests/prefabGeometry.test.ts`  
Expected: all tests PASS.

- [ ] **Step 6: Commit the unified shelf**

```bash
git add pixelworld_mvp/src/rendering/interiorPrefabStore.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/tests/interiorPrefabStore.test.ts pixelworld_mvp/tests/interiorCutawaySystem.test.ts
git commit -m "feat: expose built-in office groups in furniture shelf"
```

### Task 5: Dissolve, Preview, Template Apply, and Undo

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorUndoStore.ts`
- Create: `pixelworld_mvp/tests/interiorUndoStore.test.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/i18n/villageLocale.ts`
- Modify: `pixelworld_mvp/tests/villageLocale.test.ts`

**Interfaces:**
- Consumes: furniture layouts, prefab instance IDs, theme defaults, and the existing cutaway handler contract.
- Produces: `InteriorUndoStore`, `dissolvePrefabInstance(layout, instanceId)`, and handlers `undo`, `previewTemplate`, `applyTemplate`, and `dissolveGroup`.

- [ ] **Step 1: Write failing tests for undo snapshots and prefab dissolve**

```ts
it('undoes one grouped mutation without sharing furniture references', () => {
  const history = new InteriorUndoStore(initialLayout, 20);
  history.commit(mutatedLayout);
  const restored = history.undo();
  expect(restored).toEqual(initialLayout);
  expect(restored[0]).not.toBe(initialLayout[0]);
});

it('dissolves an instance while preserving each item layer and position', () => {
  const dissolved = dissolvePrefabInstance(placedGroup, 'instance-7');
  expect(dissolved.every(({ prefabInstanceId }) => prefabInstanceId === undefined)).toBe(true);
  expect(dissolved.map(({ layer }) => layer)).toEqual(['furniture', 'surface']);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorUndoStore.test.ts tests/villageLocale.test.ts`  
Expected: FAIL because undo and the new localized controls do not exist.

- [ ] **Step 3: Implement a bounded immutable history**

```ts
export class InteriorUndoStore {
  private past: FurnitureDefinition[][] = [];
  private current: FurnitureDefinition[];
  constructor(layout: readonly FurnitureDefinition[], private readonly limit = 20) {
    this.current = cloneFurnitureLayout(layout);
  }
  commit(next: readonly FurnitureDefinition[]): FurnitureDefinition[] {
    this.past = [...this.past, cloneFurnitureLayout(this.current)].slice(-this.limit);
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
```

- [ ] **Step 4: Add contextual DOM controls and template preview**

The cutaway header gets Undo and Apply Template. The inspector shows Dissolve Group only when all selected parts share one `prefabInstanceId`. Preview renders the proposed template at reduced alpha and reports Hook/aisle diagnostics before enabling Apply.

- [ ] **Step 5: Localize every new visible string**

Add `undo`, `applyTemplate`, `previewTemplate`, `dissolveGroup`, `templateInvalid`, `unreachableHook`, and `storageFailed` to all four locale catalogs. The English serialized cutaway copy must contain no CJK characters.

- [ ] **Step 6: Run undo, locale, selection, and cutaway tests**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorUndoStore.test.ts tests/villageLocale.test.ts tests/interiorSelection.test.ts tests/interiorCutawaySystem.test.ts`  
Expected: all tests PASS.

- [ ] **Step 7: Commit the safe editing workflow**

```bash
git add pixelworld_mvp/src/rendering/interiorUndoStore.ts pixelworld_mvp/tests/interiorUndoStore.test.ts pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/i18n/villageLocale.ts pixelworld_mvp/tests/villageLocale.test.ts
git commit -m "feat: add office template preview and undo"
```

### Task 6: Responsive 18×12 Cutaway Rendering and Occlusion

**Files:**
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorMotion.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorAssignment.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/tests/interiorMotion.test.ts`
- Modify: `pixelworld_mvp/tests/interiorAssignment.test.ts`

**Interfaces:**
- Consumes: room width/height, cutaway viewport, prefabs, and existing A* interior motion.
- Produces: `roomCellForLayout(interior, layout)`, responsive room origin, and correct occupant/foreground depth for larger rooms.

- [ ] **Step 1: Write failing tests for 18×12 responsive fit and orthogonal movement**

```ts
it('fits an 18x12 work office inside the cutaway content area', () => {
  const cell = roomCellForLayout({ width: 18, height: 12 }, { x: 80, y: 44, width: 608, height: 360 });
  expect(cell * 18).toBeLessThanOrEqual(584);
  expect(cell * 12).toBeLessThanOrEqual(250);
});

it('keeps every visible movement segment orthogonal around grouped blockers', () => {
  const motion = interiorMotionAt(workSnapshot, workInterior, assignment, 900);
  expect(motion.walking).toBe(true);
  expect(motion.path.every((point, index, path) => index === 0 || point.x === path[index - 1]!.x || point.y === path[index - 1]!.y)).toBe(true);
});
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts tests/interiorMotion.test.ts tests/interiorAssignment.test.ts`  
Expected: FAIL because `ROOM_CELL` is fixed at 22 and the larger room overflows.

- [ ] **Step 3: Replace fixed room-cell usage with a per-open computed cell**

```ts
export function roomCellForLayout(room: Pick<InteriorDefinition, 'width' | 'height'>, layout: CutawayLayout): number {
  return Math.max(12, Math.floor(Math.min((layout.width - 24) / room.width, (layout.height - 94) / room.height)));
}
```

Store the computed value on the system and use it for grid, furniture, palette ghosts, occupants, room labels, pointer conversion, and marquee selection.

- [ ] **Step 4: Verify assignments use prefab interaction anchors and depth remains foot-Y based**

Required Hook assignments select a reachable matching interaction anchor. Surface items remain nonblocking. Persisted `wall` items are rendered as the furniture foreground layer and ordered after agents when their baseline requires occlusion; the agent remains a renderer-owned layer, so no storage migration is needed.

- [ ] **Step 5: Run all interior tests and build**

Run: `cd pixelworld_mvp && npm test -- --run tests/interior*.test.ts tests/prefabGeometry.test.ts tests/builtInOfficePrefabs.test.ts && npm run build`  
Expected: all tests PASS and Vite build exits 0.

- [ ] **Step 6: Commit responsive cutaways**

```bash
git add pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts pixelworld_mvp/src/rendering/interiorMotion.ts pixelworld_mvp/src/rendering/interiorAssignment.ts pixelworld_mvp/src/styles.css pixelworld_mvp/tests/interiorCutawaySystem.test.ts pixelworld_mvp/tests/interiorMotion.test.ts pixelworld_mvp/tests/interiorAssignment.test.ts
git commit -m "feat: fit dense offices in responsive cutaways"
```

### Task 7: Apple Functional Glass and Dashboard Hierarchy

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.mjs`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `tests/test_dashboard_layout.py`
- Modify: `tests/test_frontend_i18n.mjs`
- Modify: `pixelworld_mvp/tests/gameConfig.test.ts`

**Interfaces:**
- Consumes: existing dashboard DOM, resize dividers, locale bridge, and cutaway DOM classes.
- Produces: CSS tokens `--material-content`, `--material-structural`, `--material-glass`, `--material-glass-border`, and DOM press-state behavior via `data-pressed`.

- [ ] **Step 1: Write failing structural tests for material boundaries and accessibility**

```python
def test_liquid_glass_is_reserved_for_functional_controls():
    html = INDEX.read_text()
    assert '--material-glass:' in html
    assert '.functional-glass' in html
    assert '@media (prefers-reduced-transparency: reduce)' in html
    assert '@media (prefers-contrast: more)' in html
    assert '.panel { background: var(--material-structural)' in html
```

```js
test('dashboard clears pointer press state on release and cancel', () => {
  assert.match(appSource, /pointerdown[\s\S]+data-pressed/);
  assert.match(appSource, /pointerup[\s\S]+delete .*pressed/);
  assert.match(appSource, /pointercancel[\s\S]+delete .*pressed/);
});
```

- [ ] **Step 2: Run dashboard tests and verify RED**

Run: `python -m pytest -q tests/test_dashboard_layout.py && node --test tests/test_frontend_i18n.mjs`  
Expected: FAIL because the new material tokens and press behavior are absent.

- [ ] **Step 3: Introduce restrained material tokens and assign semantic roles**

```css
:root {
  --material-content: #07111f;
  --material-structural: rgba(8, 19, 34, .94);
  --material-glass: rgba(207, 229, 250, .16);
  --material-glass-border: rgba(235, 247, 255, .34);
}
.functional-glass {
  background: var(--material-glass);
  border: 1px solid var(--material-glass-border);
  backdrop-filter: blur(22px) saturate(165%);
  box-shadow: inset 0 1px rgba(255,255,255,.4), 0 14px 34px rgba(0,13,31,.28);
}
```

Apply `functional-glass` only to top navigation controls, village camera controls, furniture tools, contextual menus, and cutaway controls. Keep `.panel`, tables, inspector, and timeline cards on structural material.

- [ ] **Step 4: Add immediate, reversible press feedback**

Use delegated `pointerdown`, `pointerup`, `pointercancel`, and `lostpointercapture` handlers for buttons and controls. `data-pressed=true` applies `transform: scale(.97)` and localized illumination. Do not delay the actual click handler or lock input.

- [ ] **Step 5: Add typography, scroll edges, focus, and accessibility variants**

```css
@media (prefers-reduced-motion: reduce) { .functional-glass, button { transition: opacity 160ms ease !important; transform: none !important; } }
@media (prefers-reduced-transparency: reduce) { .functional-glass { background: rgba(17,31,48,.97); backdrop-filter: none; } }
@media (prefers-contrast: more) { .functional-glass, .panel { border-color: #b8d8ff; background-color: #07111f; } }
```

Use system UI fonts for dashboard DOM text, tighter heading tracking, legible small-label tracking, and visible `:focus-visible` rings. Replace hard separators under floating toolbars with a localized gradient/blur edge.

- [ ] **Step 6: Run dashboard, localization, and Pixelworld style tests**

Run: `python -m pytest -q tests/test_dashboard_layout.py && node --test tests/test_frontend_i18n.mjs && cd pixelworld_mvp && npm test -- --run tests/gameConfig.test.ts tests/villageLocale.test.ts`  
Expected: all tests PASS.

- [ ] **Step 7: Commit the visual hierarchy**

```bash
git add public/index.html public/app.mjs pixelworld_mvp/src/styles.css tests/test_dashboard_layout.py tests/test_frontend_i18n.mjs pixelworld_mvp/tests/gameConfig.test.ts
git commit -m "feat: polish Pixelverse with functional glass controls"
```

### Task 8: Full Regression, Browser QA, Deployment, and CodeGraph Sync

**Files:**
- Modify only if QA exposes a regression in files already listed above.
- Verify: `docs/superpowers/specs/2026-08-12-modern-office-prefabs-apple-webui-design.md`

**Interfaces:**
- Consumes: completed prefab, layout, editor, localization, and material work.
- Produces: rebuilt `http://127.0.0.1:5661/`, fresh verification evidence, and current CodeGraph index.

- [ ] **Step 1: Run every automated suite**

```bash
node --test tests/*.mjs
python -m pytest -q
cd pixelworld_mvp && npm run typecheck && npm test -- --run && npm run build
```

Expected: zero failures in Node, pytest, Vitest, TypeScript, and Vite build.

- [ ] **Step 2: Rebuild the service image**

Run: `docker compose -p cli-pixelverse --env-file .pixelverse-service/compose.env up -d --build`  
Expected: image builds and container `cli-pixelverse` reaches running state.

- [ ] **Step 3: Browser-QA saved-layout protection**

Open a room with an existing saved layout and record its furniture IDs and positions. Reload and confirm they are unchanged. Open an unsaved work room and confirm the dense 18×12 default appears.

- [ ] **Step 4: Browser-QA all workstation prefabs**

For Bench, L/U Pod, and M Control:

- Drag the complete group from the shelf and confirm all parts track the pointer.
- Rotate, duplicate, dissolve, undo, and save.
- Confirm screens, keyboards, and papers remain on their desks.
- Confirm chairs face their work surfaces and partitions align without seams.

- [ ] **Step 5: Browser-QA agents and paths**

Trigger Web/MCP, Tool, Edit, Clone, and Response states. Open the destination house immediately and confirm each agent enters through the door, follows an orthogonal aisle path, and reaches a Hook anchor without clipping grouped furniture.

- [ ] **Step 6: Browser-QA Apple materials and accessibility**

At desktop and compact widths, verify functional glass is legible over village content, structural panels are not glass-on-glass, press feedback begins on pointer-down, and language switching updates all new labels. Emulate reduced motion and reduced transparency and confirm the fallback materials remain legible.

- [ ] **Step 7: Verify service health and console**

Run: `curl -fsS http://127.0.0.1:5661/health`  
Expected: JSON includes `"ok": true`. Browser console must contain no application errors.

- [ ] **Step 8: Sync and verify CodeGraph**

Run: `codegraph sync . && codegraph status .`  
Expected: `Index is up to date`.

- [ ] **Step 9: Re-run focused verification after any QA correction**

If browser QA required a source correction, rerun the focused test named in that task plus the full commands from Step 1. Amend the task's existing commit with the explicitly listed files from that task only. If QA required no correction, make no additional commit.

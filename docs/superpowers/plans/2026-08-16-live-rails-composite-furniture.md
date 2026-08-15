# Live Rails and Composite Furniture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace fragmented Modern Office catalog entries and overlapping dashboard chrome with atomic complete furniture, a durable user-group library, and fixed no-scroll live agent/Hook rails.

**Architecture:** Add a typed composite-recipe layer between the provisioned Modern Office singles and the visible catalog, then reuse the existing prefab placement engine for atomic composition. Extend the existing prefab store for automatically persisted user groups. Replace floating dashboard cards with pure live-rail view models rendered into a fixed CSS grid around the Pixelworld iframe; keep Help as the only paginated explanatory panel.

**Tech Stack:** TypeScript, Phaser 3, Vitest, ES modules, vanilla DOM/CSS, Node test runner, pytest, FastAPI/Docker Compose, localStorage-backed versioned stores.

## Global Constraints

- Raw Modern Office modular fragments consumed by a recipe are completely hidden; there is no Advanced Parts category.
- Purchased source PNGs remain private, read-only runtime assets and are never committed or baked into the image.
- Desktop geometry is 44 px top bar, 248 px left agent rail, flexible center village, and 196 px right Hook rail.
- Active catalogs, Help, monitoring surfaces, and context menus use pagination or fixed fit; no horizontal or vertical scrollbar is permitted.
- The context menu remains two columns by two rows with an outer maximum of approximately 152 × 92 CSS px.
- Grouping automatically creates a reusable, versioned user template; deleting a template never deletes placed room instances.
- Existing explicit room Save semantics, undo behavior, Rest/Search/Work routing, zoom/pan, localization, reduced motion, reduced transparency, and keyboard focus remain intact.
- Preserve unrelated dirty and untracked user work. Stage exact files or hunks only; never reset or clean the worktree.

---

## File Structure

### New files

- `pixelworld_mvp/src/rendering/modernOfficeCompositeCatalog.ts` — typed composite recipes, recipe validation, consumed-asset set, visible catalog projection.
- `pixelworld_mvp/tests/modernOfficeCompositeCatalog.test.ts` — recipe families, validation, hidden fragments, atomic prefab projection.
- `public/live_agent_rails.mjs` — pure current-agent ordering, pagination, ECG and Hook-rail view models.
- `tests/test_live_agent_rails.mjs` — live state, pagination, Help pages, no-history contract.

### Existing files to modify

- `pixelworld_mvp/src/rendering/modernOfficeCatalog.ts` — export source catalog and new six-category visible catalog contract.
- `pixelworld_mvp/src/rendering/assetManifest.ts` — preload composite source dependencies without adding generated licensed assets.
- `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts` — composite palette cards, user-group cards, atomic placement, group persistence, delete-template handling.
- `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts` — six catalog categories, compact group delete affordance, smaller context menu model.
- `pixelworld_mvp/src/rendering/interiorPrefabStore.ts` — create/validate/persist/delete user groups without built-in overwrite.
- `pixelworld_mvp/src/rendering/interiorLocale.ts` — six-category, group-library, storage-error, and delete labels in four locales.
- `pixelworld_mvp/src/styles.css` — catalog card/delete control and 152 × 92 context-menu geometry.
- `pixelworld_mvp/tests/modernOfficeCatalog.test.ts` — visible-category and consumed-fragment contracts.
- `pixelworld_mvp/tests/interiorPrefabStore.test.ts` — automatic group persistence, reload, malformed storage, deletion isolation.
- `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts` — category order, bounded menu, group delete accessibility.
- `pixelworld_mvp/tests/interiorCutawaySystem.test.ts` — composite drag, group auto-save/delete, one-undo room mutation.
- `public/index.html` — fixed top/left/center/right grid landmarks and bounded Help panel.
- `public/app.mjs` — render current rails, remove historical Events/Agents card paths, preserve Help/focus/cutaway lifecycle.
- `public/ui_strings.mjs` — four-locale rail, pagination, state, Hook guide copy.
- `public/agent_timeline_graphs.mjs` — reuse waveform generation for current-state ECG rather than historical panels.
- `tests/test_dashboard_layout.py` — structural no-overlap/no-scroll desktop and narrow layouts.
- `tests/test_dashboard_cards.mjs` — remove Events/Agents cards; retain bounded Help pagination.
- `tests/test_frontend_i18n.mjs` — rail and Hook guide copy in all locales.
- `tests/test_agent_timeline_graphs.mjs` — current state waveform tones.

---

### Task 1: Build the Atomic Composite Furniture Catalog

**Files:**
- Create: `pixelworld_mvp/src/rendering/modernOfficeCompositeCatalog.ts`
- Create: `pixelworld_mvp/tests/modernOfficeCompositeCatalog.test.ts`
- Modify: `pixelworld_mvp/src/rendering/modernOfficeCatalog.ts`
- Modify: `pixelworld_mvp/src/rendering/assetManifest.ts`
- Modify: `pixelworld_mvp/tests/modernOfficeCatalog.test.ts`
- Modify: `pixelworld_mvp/tests/modernOfficeManifest.test.ts`

**Interfaces:**
- Consumes: `ModernOfficeCatalogItem`, `FurnitureDefinition`, and `OfficePrefabDefinition`.
- Produces:

```ts
export interface CompositePartRecipe {
  assetId: number;
  offset: { x: number; y: number };
}

export interface ModernOfficeCompositeRecipe {
  id: string;
  label: string;
  category: VisibleFurnitureCategory;
  parts: readonly CompositePartRecipe[];
  semantic?: FurnitureSemantic;
  role: ModernOfficeCatalogRole;
  defaultRotation: FurnitureRotation;
  defaultScale: FurnitureScale;
}

export const MODERN_OFFICE_COMPOSITE_RECIPES: readonly ModernOfficeCompositeRecipe[];
export const consumedCompositeAssetIds: ReadonlySet<number>;
export function compositePrefab(recipe: ModernOfficeCompositeRecipe): OfficePrefabDefinition;
export function visibleStandaloneCatalog(): readonly ModernOfficeCatalogItem[];
export function validateCompositeRecipes(): readonly string[];
```

- [ ] **Step 1: Write failing recipe and hidden-fragment tests**

Add exact expectations that the three verified storage families are recipes and never visible raw entries:

```ts
it('assembles the first storage modular families and hides every consumed fragment', () => {
  expect(recipe('storage-run-cream')?.parts.map(({ assetId }) => assetId)).toEqual([179, 180, 181]);
  expect(recipe('storage-run-gold')?.parts.map(({ assetId }) => assetId)).toEqual([182, 183, 184]);
  expect(recipe('storage-run-orange')?.parts.map(({ assetId }) => assetId)).toEqual([185, 186, 187]);
  expect(visibleStandaloneCatalog().some(({ id }) => id >= 179 && id <= 187)).toBe(false);
});
```

Add table-driven tests for all declared recipes: at least two parts, source IDs exist exactly once per recipe, offsets are finite, combined opaque bounds are non-empty, no consumed asset leaks into the standalone projection, and recipe IDs are unique.

- [ ] **Step 2: Run RED tests**

Run:

```bash
cd pixelworld_mvp
npx vitest run tests/modernOfficeCompositeCatalog.test.ts tests/modernOfficeCatalog.test.ts tests/modernOfficeManifest.test.ts
```

Expected: FAIL because the composite module and recipe projection do not exist and 179–187 remain visible raw entries.

- [ ] **Step 3: Implement typed recipes and validation**

Create the recipe module with explicit audited families. Start the manifest with the verified families and add every modular family found by inspecting the provisioned sheet/singles adjacency:

```ts
const recipe = (
  id: string,
  label: string,
  category: VisibleFurnitureCategory,
  assetIds: readonly number[],
): ModernOfficeCompositeRecipe => ({
  id,
  label,
  category,
  parts: assetIds.map((assetId, index) => ({ assetId, offset: { x: index, y: 0 } })),
  role: 'support',
  semantic: 'search',
  defaultRotation: 0,
  defaultScale: 1,
});

export const MODERN_OFFICE_COMPOSITE_RECIPES = Object.freeze([
  recipe('storage-run-cream', 'Cream Storage Run', 'storage-partitions', [179, 180, 181]),
  recipe('storage-run-gold', 'Gold Storage Run', 'storage-partitions', [182, 183, 184]),
  recipe('storage-run-orange', 'Orange Storage Run', 'storage-partitions', [185, 186, 187]),
]);
```

Do not infer additional recipes solely from consecutive IDs. Generate category contact sheets from all 339 provisioned singles, compare them with the purchased source sheet, and explicitly classify every source ID as either `standalone` or a member of one named recipe. Commit the complete classification alongside the recipes. A test must assert that the classification contains exactly the 339 catalog IDs, each ID appears once, and every `composite` classification points to a declared recipe. Validation must reject missing assets, duplicate recipe IDs, duplicate consumption, non-finite offsets, and empty combined bounds.

Project each recipe to an immutable `OfficePrefabDefinition`; each part gets a stable template-local ID and the final placement engine supplies a fresh instance ID.

- [ ] **Step 4: Replace the visible catalog projection**

Keep `MODERN_OFFICE_CATALOG` as the authoritative source catalog for asset loading and semantic metadata. Add a six-category visible projection that combines:

```ts
[
  ...builtInWorkstationPrefabs,
  ...MODERN_OFFICE_COMPOSITE_RECIPES.map(compositePrefab),
  ...visibleStandaloneCatalog(),
]
```

Ensure `assetManifest.ts` still preloads every source asset referenced by a recipe even though its raw card is hidden.

- [ ] **Step 5: Run GREEN tests and typecheck**

Run:

```bash
cd pixelworld_mvp
npx vitest run tests/modernOfficeCompositeCatalog.test.ts tests/modernOfficeCatalog.test.ts tests/modernOfficeManifest.test.ts tests/renderingContracts.test.ts
npm run typecheck
```

Expected: all tests pass; no consumed raw fragment is visible; every recipe source remains preloadable.

- [ ] **Step 6: Commit Task 1 exactly**

```bash
git add pixelworld_mvp/src/rendering/modernOfficeCompositeCatalog.ts \
  pixelworld_mvp/src/rendering/modernOfficeCatalog.ts \
  pixelworld_mvp/src/rendering/assetManifest.ts \
  pixelworld_mvp/tests/modernOfficeCompositeCatalog.test.ts \
  pixelworld_mvp/tests/modernOfficeCatalog.test.ts \
  pixelworld_mvp/tests/modernOfficeManifest.test.ts
git diff --cached --check
git commit -m "feat: assemble complete Modern Office furniture"
```

---

### Task 2: Add the Durable Grouped Furniture Library

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorPrefabStore.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLocale.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/tests/interiorPrefabStore.test.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`

**Interfaces:**
- Consumes: complete selection closure, `FurniturePrefab`, `savePrefabs`, `upsertPrefab`, `deletePrefab`.
- Produces:

```ts
export function createUserGroupPrefab(
  selection: readonly FurnitureDefinition[],
  existing: readonly FurniturePrefab[],
  createdAt?: number,
): FurniturePrefab;

export function nextUserGroupName(existing: readonly FurniturePrefab[]): string;
```

DOM handler additions:

```ts
deletePrefab(prefabId: string): void;
selectCatalogCategory(category: VisibleFurnitureCategory): void;
```

- [ ] **Step 1: Write RED persistence and deletion tests**

Cover:

```ts
it('creates and reloads an automatically named reusable group', () => {
  const prefab = createUserGroupPrefab(selection, [], 100);
  expect(prefab.name).toBe('Group 01');
  savePrefabs([prefab], memory);
  expect(loadPrefabs(memory)).toEqual([prefab]);
});

it('deleting a template leaves placed room instances untouched', () => {
  const placed = cloneFurnitureLayout(roomFurniture);
  const next = deletePrefab([template], template.id);
  expect(next).toEqual([]);
  expect(roomFurniture).toEqual(placed);
});
```

Add malformed version/schema tests that return an empty library without overwriting storage. Add a write-throw test that reports `storageFailed` while preserving the room group mutation.

- [ ] **Step 2: Run RED tests**

```bash
cd pixelworld_mvp
npx vitest run tests/interiorPrefabStore.test.ts tests/interiorCutawaySystem.test.ts tests/interiorCutawayDomOverlay.test.ts
```

Expected: FAIL because grouping is draft-only and no Grouped Furniture category/delete control exists.

- [ ] **Step 3: Implement automatic template creation**

Normalize selected items around their minimum opaque bounds. Remap IDs to template-local IDs and keep internal `supportedByIds`; remove references outside the selection closure. Generate a collision-free stable ID and sequential localized display name.

In `groupSelectedDraft`:

```ts
const before = cloneFurnitureLayout(interior.furniture);
const groupedLayout = assignDraftGroup(before, selectedIds, instanceId);
this.commitFurnitureMutation(interior, groupedLayout); // one room undo entry
try {
  const prefab = createUserGroupPrefab(selectedClosure(groupedLayout), this.prefabs);
  const userPrefabs = upsertPrefab(this.prefabs.filter((item) => !isBuiltInPrefab(item)), prefab);
  savePrefabs(userPrefabs);
  this.prefabs = readAvailablePrefabs().value;
  this.setStatus('groupSaved', { name: prefab.name });
} catch {
  this.setStatus('groupSaveFailed');
}
```

The room mutation remains even if reusable-library persistence fails.

- [ ] **Step 4: Add Grouped Furniture category and delete control**

Render user prefabs only in the Grouped Furniture page. Each card includes a small trash button with `aria-label="Delete Group 01"`. Stop pointer propagation so deleting never begins a drag. Built-in recipes have no delete control.

Deletion updates the versioned store and re-renders the current page. Clamp the page if the last item was removed.

- [ ] **Step 5: Verify group behavior**

```bash
cd pixelworld_mvp
npx vitest run tests/interiorPrefabStore.test.ts tests/interiorCutawaySystem.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorSelection.test.ts
npm run typecheck
```

Expected: grouping yields one undoable room mutation and one durable library entry; reload restores it; deleting the template does not mutate rooms.

- [ ] **Step 6: Commit Task 2 exactly**

```bash
git add pixelworld_mvp/src/rendering/interiorPrefabStore.ts \
  pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts \
  pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts \
  pixelworld_mvp/src/rendering/interiorLocale.ts \
  pixelworld_mvp/src/styles.css \
  pixelworld_mvp/tests/interiorPrefabStore.test.ts \
  pixelworld_mvp/tests/interiorCutawaySystem.test.ts \
  pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts
git diff --cached --check
git commit -m "feat: persist reusable furniture groups"
```

---

### Task 3: Tighten the Game-Like Context Menu and Catalog Geometry

**Files:**
- Modify: `pixelworld_mvp/src/rendering/interiorContextMenu.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorEditorLayout.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/tests/interiorContextMenu.test.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`
- Modify: `pixelworld_mvp/tests/interiorEditorLayout.test.ts`

**Interfaces:**
- Consumes: `placeContextMenu`, `ContextSelection`, existing resize submenu.
- Produces:

```ts
export const CONTEXT_MENU_SIZE = Object.freeze({ width: 152, height: 92 });
```

- [ ] **Step 1: Write RED geometry and toggle tests**

Assert the menu is exactly two columns/two rows, outer geometry never exceeds 152 × 92 CSS px, every edge/corner placement remains inside the active room, a second right-click closes it, and left-clicking empty room closes it without clearing selection.

- [ ] **Step 2: Run RED tests**

```bash
cd pixelworld_mvp
npx vitest run tests/interiorContextMenu.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorEditorLayout.test.ts
```

Expected: FAIL on current oversized layout and missing exact outer-size contract.

- [ ] **Step 3: Implement compact geometry**

Use fixed outer geometry and compact buttons:

```css
.cutaway-context-menu {
  inline-size: 152px;
  block-size: 92px;
  grid-template: repeat(2, minmax(0, 1fr)) / repeat(2, minmax(0, 1fr));
  gap: 4px;
  padding: 5px;
  overflow: clip;
}
.cutaway-context-menu button {
  min-inline-size: 0;
  min-block-size: 0;
  padding: 3px 5px;
  font-size: 10px;
}
```

Keep cursor anchoring and room-bound clamping. Reuse the same outer geometry for the size submenu.

- [ ] **Step 4: Verify menu and catalog fit**

```bash
cd pixelworld_mvp
npx vitest run tests/interiorContextMenu.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorEditorLayout.test.ts tests/gameConfig.test.ts
npm run typecheck
```

Expected: menu and catalog fit tests pass with no scroll container and no wrapped third row.

- [ ] **Step 5: Commit Task 3 exactly**

```bash
git add pixelworld_mvp/src/rendering/interiorContextMenu.ts \
  pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts \
  pixelworld_mvp/src/rendering/interiorEditorLayout.ts \
  pixelworld_mvp/src/styles.css \
  pixelworld_mvp/tests/interiorContextMenu.test.ts \
  pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts \
  pixelworld_mvp/tests/interiorEditorLayout.test.ts
git diff --cached --check
git commit -m "fix: compact interior context controls"
```

---

### Task 4: Replace Floating Dashboard Cards with Live Rails

**Files:**
- Create: `public/live_agent_rails.mjs`
- Create: `tests/test_live_agent_rails.mjs`
- Modify: `public/index.html`
- Modify: `public/app.mjs`
- Modify: `public/ui_strings.mjs`
- Modify: `public/agent_timeline_graphs.mjs`
- Modify: `tests/test_dashboard_layout.py`
- Modify: `tests/test_dashboard_cards.mjs`
- Modify: `tests/test_frontend_i18n.mjs`
- Modify: `tests/test_agent_timeline_graphs.mjs`

**Interfaces:**
- Consumes: current world snapshot agents, existing `buildHeartbeatPath`, current locale copy, Pixelworld cutaway bridge.
- Produces:

```js
export function orderedVisibleAgents(snapshot = {}) {}
export function agentRailPage(snapshot = {}, page = 0, pageSize = 4, locale = {}) {}
export function agentEcgModel(agent = {}, width = 188) {}
export function hookRailModel(snapshot = {}, selectedAgentId = '', locale = {}) {}
export function hookGuidePages(locale = {}, pageSize = 4) {}
```

- [ ] **Step 1: Write RED pure-view tests**

Cover main-first stable ordering, current-map agents only, active/search/rest/offline waveform models, page clamping when agents disappear, selected-agent Hook priority, recent-agent fallback, and complete paginated Hook guide coverage.

```js
test('every visible current agent receives an ECG regardless of state', () => {
  const page = agentRailPage(snapshotWith('working', 'idle', 'offline'), 0, 4, strings);
  assert.equal(page.items.length, 3);
  assert.deepEqual(page.items.map(({ ecgTone }) => ecgTone), ['work', 'rest', 'stale']);
});
```

- [ ] **Step 2: Write RED structural layout tests**

In `tests/test_dashboard_layout.py`, assert:

- one 44 px top bar;
- one 248 px left rail;
- one flexible center iframe region;
- one 196 px right rail;
- no Events or Agents dashboard-card controls;
- exactly one Help trigger and one bounded Help panel;
- active production regions use `overflow: hidden` or `clip`, never `auto`/`scroll`;
- narrow layout moves rails below the map with two agents per page.

- [ ] **Step 3: Run RED tests**

```bash
node --test tests/test_live_agent_rails.mjs tests/test_dashboard_cards.mjs tests/test_frontend_i18n.mjs tests/test_agent_timeline_graphs.mjs
python3 -m pytest -q tests/test_dashboard_layout.py
```

Expected: FAIL because the live rail module/grid do not exist and Events/Agents floating controls remain.

- [ ] **Step 4: Implement pure live-rail models**

Derive ECG tone from current state only:

```js
const stateTone = (agent = {}) => {
  if (agent.state === 'offline' || agent.is_stale) return 'stale';
  if (['idle', 'await', 'rest'].includes(agent.state)) return 'rest';
  if (['think', 'plan', 'read', 'web'].includes(agent.state)) return 'search';
  return 'work';
};
```

Reuse `buildHeartbeatPath` with tone-specific load/frequency input. Do not include historical event arrays in the agent rail view model.

- [ ] **Step 5: Replace root markup with the fixed grid**

Create semantic landmarks:

```html
<header class="live-topbar" id="live-topbar"></header>
<main class="live-workspace-grid">
  <aside class="agent-rail" id="agent-rail" aria-label="Live agents"></aside>
  <section class="village-region"><iframe id="pixelworld-frame"></iframe></section>
  <aside class="hook-rail" id="hook-rail" aria-label="Current Hook"></aside>
</main>
<section class="hook-help-panel" id="hook-help-panel" hidden></section>
```

Desktop CSS:

```css
.live-page {
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  height: 100dvh;
  overflow: hidden;
}
.live-workspace-grid {
  display: grid;
  grid-template-columns: 248px minmax(0, 1fr) 196px;
  min-height: 0;
  overflow: hidden;
}
```

Narrow CSS uses two bounded bottom regions and a two-agent page size; it must not introduce document or panel scrolling.

- [ ] **Step 6: Wire live rendering and remove history cards**

Replace `renderDashboardCardContent` calls for Events/Agents with `renderLiveRails(snapshot)`. Keep current disclosure/focus lifecycle only for Help. Remove inaccessible hidden historical containers and handlers rather than merely hiding them with CSS.

Keep identical-snapshot DOM write dedup and live-region announcement dedup. When a cutaway opens, rails remain in their grid cells and the center iframe resizes; no overlay or focus target is cleared unless Help is open.

- [ ] **Step 7: Add four-locale current-state and Help copy**

Add localized labels for Work, Search, Rest, Waiting, Offline, current building, current Hook, previous/next agent page, and Hook guide entries. Tests must verify Japanese/Korean do not fall back to English/Chinese.

- [ ] **Step 8: Run GREEN root tests**

```bash
node --test tests/test_live_agent_rails.mjs tests/test_dashboard_cards.mjs tests/test_dashboard_disclosure.mjs tests/test_frontend_i18n.mjs tests/test_agent_timeline_graphs.mjs tests/test_pixelworld_embed.mjs
python3 -m pytest -q tests/test_dashboard_layout.py tests/test_fastapi_service.py
node --check public/app.mjs
node --check public/live_agent_rails.mjs
```

Expected: all tests pass; Events/Agents history cards are absent; Help remains bounded and focus-safe.

- [ ] **Step 9: Commit Task 4 with exact partial staging**

`public/app.mjs`, `public/index.html`, and dashboard tests may contain unrelated dirty user hunks. Stage only Task 4 hunks, inspect the complete cached diff, then commit:

```bash
git add public/live_agent_rails.mjs tests/test_live_agent_rails.mjs public/ui_strings.mjs public/agent_timeline_graphs.mjs
git add -p public/app.mjs public/index.html tests/test_dashboard_layout.py tests/test_dashboard_cards.mjs tests/test_frontend_i18n.mjs tests/test_agent_timeline_graphs.mjs
git diff --cached --check
git diff --cached --stat
git commit -m "feat: add fixed live agent monitoring rails"
```

---

### Task 5: Full Integration, Browser QA, and Release

**Files:**
- Modify only if a reproduced defect requires a TDD fix.
- Create report: `.superpowers/sdd/live-rails-composite-furniture-report.md`

**Interfaces:**
- Consumes: Tasks 1–4 exact committed behavior.
- Produces: verified deploy at `http://127.0.0.1:5661/`, release evidence, updated CodeGraph.

- [ ] **Step 1: Run fresh full automated suites**

```bash
node --test tests/*.mjs
python3 -m pytest -q tests
cd pixelworld_mvp
npm test -- --run
npm run typecheck
npm run build
```

Expected: zero failures. Record exact pass/skip counts and the known Vite chunk advisory separately.

- [ ] **Step 2: Reconstruct exact HEAD in a clean detached clone**

```bash
clean_root="$(mktemp -d /tmp/cli-pixelverse-live-rails.XXXXXX)/repo"
git clone --no-hardlinks --no-checkout . "$clean_root"
git -C "$clean_root" checkout --detach "$(git rev-parse HEAD)"
test -z "$(git -C "$clean_root" status --porcelain)"
```

Run the full Node/Python/Pixelworld/typecheck/build suites in the clean clone. Confirm the build does not depend on untracked private assets or dirty dashboard hunks.

- [ ] **Step 3: Deploy exact clean HEAD to 5661**

Use ordinary `./run.sh start` from the clean clone with `PIXELVERSE_PORT=5661`, `PIXELVERSE_BRIDGE_PORT=4568`, `PIXELVERSE_REBUILD=1`, and the existing runtime/Hermes/private asset mounts. Do not stop unrelated listeners such as the service on 5660.

Verify:

- image and container OCI revision equal exact HEAD;
- build fingerprint matches clean sources;
- `/health`, `/`, `/pixelworld/index.html`, `/api/world`, final JS/CSS, global map, and representative private Modern Office assets return 200;
- private assets are absent from the unmounted image;
- Modern Office and Hermes mounts are read-only.

- [ ] **Step 4: Perform bounded real-browser QA**

Verify at desktop and narrow viewports:

1. The top bar, left agent rail, center village, and right Hook rail have zero overlap.
2. No active region or document has a scrollbar.
3. Active, searching, resting, and offline agents have distinct ECGs.
4. Help is the only explanatory panel and maps every Hook family.
5. Storage recipes render as complete furniture; raw 179–187 entries are absent.
6. Dragging a complete composite moves it atomically.
7. Marquee + Group creates Group 01 in Grouped Furniture.
8. Reload preserves the group; placing it creates a fresh instance.
9. Deleting the template leaves the placed instance intact.
10. The context menu remains 2 × 2 and bounded at all room edges.

If browser automation cannot address Phaser pixels deterministically, stop after bounded attempts and list the exact interaction as Cannot Verify; cite the corresponding deterministic regression test.

- [ ] **Step 5: Request read-only whole-range review**

Review from the design commit through current HEAD. Fix every confirmed Critical or Important with a new RED→GREEN commit. Re-review until Critical 0 and Important 0. Address in-scope Minors unless they conflict with the approved design.

- [ ] **Step 6: Write the release report**

Document design/plan links, commits, RED/GREEN evidence, full suite counts, clean build provenance, browser screenshots, verified/Cannot Verify items, deployment digest/revision, mount security, and remaining non-blocking advisories in:

```text
.superpowers/sdd/live-rails-composite-furniture-report.md
```

- [ ] **Step 7: Sync CodeGraph as the final repository operation**

```bash
codegraph sync
codegraph status
```

Expected: index is up to date. Run no repository command afterward.

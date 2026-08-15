# Game-like Interior Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dense interior-editor chrome with direct left/right-pointer manipulation, permissive automatic stacking, semantic Hook furniture, normalized furniture sizing, and three compact non-scrolling dashboard cards.

**Architecture:** Keep Phaser as the authoritative room interaction surface and the DOM overlay as accessible chrome. Add small pure modules for context-menu state/placement, automatic support resolution, semantic furniture categories, and dashboard card pagination; route all mutations through the existing immutable undo/Save boundary. Existing v5 layouts remain readable, and semantic metadata is derived during hydration instead of eagerly rewriting storage.

**Tech Stack:** TypeScript, Phaser 3, DOM overlay, Vitest, JavaScript ES modules, Python structural tests, Vite, Docker Compose.

## Global Constraints

- Use Modern Office Revamped v1.2 assets already provisioned read-only; do not commit purchased files.
- Save is the only persistence boundary; previews and pointer moves perform zero storage writes.
- Preserve saved v5 fields: IDs, prefab instance IDs, supported relationships, interaction points, visual offsets, scale, and rotation.
- Support `en-US`, `zh-TW`, `ja-JP`, and `ko-KR` for every new visible or accessible string.
- No interior or dashboard popup may use horizontal or vertical scrolling.
- Preserve unrelated dirty and untracked workspace changes; stage exact task paths or hunks only.
- Use CodeGraph before textual search for code discovery and sync it after the final verified deploy.

---

### Task 1: Right-click interaction contract and minimal context menu

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorContextMenu.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorEditorLayout.ts`
- Modify: `pixelworld_mvp/src/styles.css`
- Modify: `pixelworld_mvp/src/i18n/interiorLocale.ts`
- Test: `pixelworld_mvp/tests/interiorContextMenu.test.ts`
- Test: `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Test: `pixelworld_mvp/tests/interiorEditorLayout.test.ts`

**Interfaces:**
- Produces: `ContextSelection = { itemIds: string[]; grouped: boolean }`.
- Produces: `contextActions(selection): readonly ('duplicate'|'rotate'|'resize'|'return'|'group'|'dissolve')[]`.
- Produces: `placeContextMenu(pointer, menuSize, roomBounds): { x: number; y: number }`.
- Consumes: existing `setSelectedFurniture`, marquee state, immutable mutation handlers, and four-locale message catalog.

- [ ] **Step 1: Write failing pure menu tests**

```ts
expect(contextActions({ itemIds: ['chair'], grouped: false }))
  .toEqual(['duplicate', 'rotate', 'resize', 'return']);
expect(contextActions({ itemIds: ['a', 'b'], grouped: false }))
  .toEqual(['group', 'duplicate', 'rotate', 'return']);
expect(placeContextMenu({ x: 598, y: 430 }, { width: 180, height: 116 }, room))
  .toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorContextMenu.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorCutawaySystem.test.ts tests/interiorEditorLayout.test.ts`

Expected: failures for the missing module, left-click opening legacy controls, absent context-menu toggle, and overflow/wrapping at room edges.

- [ ] **Step 3: Implement the pure context-menu model and 2×2 geometry**

Keep action choice and edge flipping independent of DOM/Phaser. The placement function must clamp the complete menu rectangle and return one position without scroll or wrapping.

- [ ] **Step 4: Replace the selection toolbar with pointer-owned context interaction**

Wire primary click to selection only, primary empty drag to marquee, and secondary click to menu toggle. Suppress `contextmenu` only for the open cutaway canvas. Enforce pointer ownership and close on empty primary click, second secondary click, `Escape`, close, switch, and destroy.

- [ ] **Step 5: Reduce room commands and preserve reachability**

Render only Save, Undo, and Collect all/redecorate in always-visible room chrome. Remove layer/front/back/template-preview/apply/cancel controls from the reachable DOM and handlers. Keep catalog categories plus explicit Previous/Next pagination.

- [ ] **Step 6: Implement direct feedback and accessibility**

Use pointer-down press feedback, localized icon-plus-short-label buttons, `role="menu"`, `role="menuitem"`, correct accessible names, focus restoration, keyboard activation, and reduced-motion immediate state changes.

- [ ] **Step 7: Run focused tests, typecheck, and commit**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorContextMenu.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorCutawaySystem.test.ts tests/interiorEditorLayout.test.ts && npm run typecheck`

Commit: `feat: simplify interior editing controls`

---

### Task 2: Permissive overlap, automatic support, and closest-edge placement

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorAutoStack.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorPlacement.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorSelection.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorRenderer.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorDragPresentation.ts`
- Modify: `pixelworld_mvp/src/rendering/prefabGeometry.ts`
- Modify: `pixelworld_mvp/src/rendering/officeRoomValidation.ts`
- Test: `pixelworld_mvp/tests/interiorAutoStack.test.ts`
- Test: `pixelworld_mvp/tests/interiorPlacement.test.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`
- Test: `pixelworld_mvp/tests/interiorSelection.test.ts`
- Test: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Test: `pixelworld_mvp/tests/officeRoomValidation.test.ts`

**Interfaces:**
- Produces: `StackRole = 'floor'|'support'|'surface'|'free'`.
- Produces: `resolveAutomaticSupport(candidate, layout): { item: FurnitureDefinition; attachedTo?: string }`.
- Produces: `stackDependencies(itemIds, layout): string[]` for support moves and returns.
- Changes placement diagnostics so ordinary overlap is valid; `blocks-door`, `outside-room`, and `invalid-asset` remain explicit.

- [ ] **Step 1: Write RED tests for permissive overlap and support attachment**

```ts
expect(diagnoseFinePlacement(room, overlappingChair, layout)).toBe('valid');
expect(resolveAutomaticSupport(monitorOverDesk, layout).item.supportedByIds).toEqual(['desk']);
expect(stackDependencies(['desk'], [desk, monitor])).toEqual(['desk', 'monitor']);
```

Also prove rug-under-furniture ordering, surface-over-support ordering, partial overflow closest-edge fit, entrance rejection, and unknown-support fallback as ordinary decor.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorAutoStack.test.ts tests/interiorPlacement.test.ts tests/interiorLayoutEditor.test.ts tests/interiorSelection.test.ts tests/officeRoomValidation.test.ts`

Expected: existing overlap diagnostics reject ordinary compositions; support attachment and dependency movement are missing.

- [ ] **Step 3: Implement semantic stack roles and automatic support resolution**

Classify Modern Office catalog categories and `FurnitureKind` into floor, support, surface, or free. Choose the topmost compatible support whose opaque bounds contain the surface-object center. Add/remove `supportedByIds` automatically as an item moves on/off a support.

- [ ] **Step 4: Narrow placement invalidation**

Remove unrelated opaque-overlap rejection from interactive placement while retaining entrance clearance and impossible-fit checks. Keep strict structural validation for malformed dangling IDs, but do not treat intentional visual overlap as a user error.

- [ ] **Step 5: Move dependency groups atomically and auto-order rendering**

Translate attached objects with their support using one shared delta. Return support dependencies together unless detached. Sort render children by stack role then foot baseline; lift the active selection and outline only during manipulation, restoring deterministic order afterward.

- [ ] **Step 6: Make red feedback exceptional**

Map valid overlap/attachment to normal selection feedback; map entrance collision and impossible room fit to red with one short localized message. Accepted closest-edge placement settles once without repeated snap-back.

- [ ] **Step 7: Run focused tests, full related validation, typecheck, and commit**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorAutoStack.test.ts tests/interiorPlacement.test.ts tests/interiorLayoutEditor.test.ts tests/interiorSelection.test.ts tests/interiorCutawaySystem.test.ts tests/officeRoomValidation.test.ts tests/prefabGeometry.test.ts && npm run typecheck`

Commit: `feat: add automatic furniture stacking`

---

### Task 3: Three semantic Hook categories and furniture-independent agent routing

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorFurnitureSemantics.ts`
- Modify: `pixelworld_mvp/src/world/types.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorAssignment.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorMotion.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/world/validateWorld.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/src/i18n/interiorLocale.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/interiorFurnitureSemantics.test.ts`
- Test: `pixelworld_mvp/tests/interiorAssignment.test.ts`
- Test: `pixelworld_mvp/tests/interiorMotion.test.ts`
- Test: `pixelworld_mvp/tests/interiorDefinitions.test.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`
- Test: `pixelworld_mvp/tests/villageSystemAcceptance.test.ts`

**Interfaces:**
- Produces: `FurnitureSemantic = 'rest'|'search'|'work'`.
- Produces: `semanticForAction(action: AgentAction): FurnitureSemantic`.
- Produces: `semanticForFurniture(item: FurnitureDefinition): FurnitureSemantic | undefined`.
- Produces: `nearestSemanticStation(room, action, origin): { furnitureId: string; point: GridPoint } | undefined`.

- [ ] **Step 1: Write RED mapping and routing tests**

```ts
expect(semanticForAction('rest')).toBe('rest');
expect(semanticForAction('read')).toBe('search');
expect(semanticForAction('terminal')).toBe('work');
expect(nearestSemanticStation(roomWithCustomDesk, 'terminal', entrance)?.furnitureId)
  .toBe('custom-desk');
```

Prove the nearest reachable compatible item wins, exact asset IDs and `requirementId` do not matter, and a missing category uses the entrance fallback with localized copy.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureSemantics.test.ts tests/interiorAssignment.test.ts tests/interiorMotion.test.ts tests/interiorDefinitions.test.ts tests/villageSystemAcceptance.test.ts`

Expected: current assignments depend on fine-grained `supportedActions` and required authored workstations.

- [ ] **Step 3: Implement category derivation and legacy compatibility**

Derive semantics from `FurnitureKind`, Modern Office catalog category, and legacy action metadata. Keep `supportedActions` readable for v5 compatibility, but stop requiring a particular item ID or requirement ID during user editing and assignment.

- [ ] **Step 4: Route occupants to nearby reachable semantic furniture**

For each agent action, filter by semantic category, calculate adjacent interaction candidates, reject navigation blockers, and choose the nearest A* reachable point with stable tie-breaking. If none exists, assign the entrance fallback without creating a fake furniture dependency.

- [ ] **Step 5: Surface concise missing-category feedback**

Publish one localized transient bubble and DOM status naming Rest, Search, or Work. Do not invalidate the room or block Save.

- [ ] **Step 6: Preserve saved-layout precedence and validate all four locales**

Hydrate legacy metadata into derived semantics in memory. Do not write storage until Save. Test custom furniture, empty rooms, malformed storage, and all locale messages.

- [ ] **Step 7: Run focused tests, typecheck, and commit**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureSemantics.test.ts tests/interiorAssignment.test.ts tests/interiorMotion.test.ts tests/interiorDefinitions.test.ts tests/interiorLayoutEditor.test.ts tests/villageSystemAcceptance.test.ts && npm run typecheck`

Commit: `feat: route agents by furniture semantics`

---

### Task 4: Normalize authored orientation and furniture family scale

**Files:**
- Create: `pixelworld_mvp/src/rendering/interiorFurnitureScale.ts`
- Modify: `pixelworld_mvp/src/rendering/modernOfficeCatalog.ts`
- Modify: `pixelworld_mvp/src/rendering/modernOfficeRoomBuilder.ts`
- Modify: `pixelworld_mvp/src/rendering/builtInOfficePrefabs.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorDefinitions.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Test: `pixelworld_mvp/tests/interiorFurnitureScale.test.ts`
- Test: `pixelworld_mvp/tests/modernOfficeCatalog.test.ts`
- Test: `pixelworld_mvp/tests/modernOfficeRoomBuilder.test.ts`
- Test: `pixelworld_mvp/tests/builtInOfficePrefabs.test.ts`
- Test: `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`

**Interfaces:**
- Produces: `FurnitureSizeFamily = 'surface-small'|'chair'|'desk-cabinet'|'sofa-bed'|'assembly'`.
- Produces: `authoredPlacement(assetId): { rotation: FurnitureRotation; scale: FurnitureScale }`.
- Produces: `normalizeBuiltInFurniture(item, catalog): FurnitureDefinition`.
- Produces: `supportedRotations(assetId): readonly FurnitureRotation[]`.

- [ ] **Step 1: Write RED tests for family-scale bands and authored rotations**

Assert representative Modern Office assets use consistent opaque rendered bounds within each family, every catalog insertion begins at authored rotation, unsupported rotations are omitted from the menu, and explicit user-saved scale/rotation round-trip unchanged.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureScale.test.ts tests/modernOfficeCatalog.test.ts tests/modernOfficeRoomBuilder.test.ts tests/builtInOfficePrefabs.test.ts tests/interiorLayoutEditor.test.ts`

Expected: built-in prefab scale values and generic four-way rotation produce inconsistent sizes/orientations.

- [ ] **Step 3: Implement catalog-derived authored placement**

Use trimmed alpha dimensions, sheet metadata, and known directional variants to assign family and authored orientation. Do not rotate sprites merely to fit layout geometry.

- [ ] **Step 4: Normalize built-ins without overwriting user intent**

Apply family defaults to authored/built-in creation and to legacy items lacking an explicit user scale marker. Preserve explicit v5 user scale and rotation. Keep the 75–300% manual range.

- [ ] **Step 5: Restrict rotation to meaningful variants**

Cycle through `supportedRotations(assetId)` from the current/authored rotation. Hide or disable Rotate for assets with one orientation.

- [ ] **Step 6: Run focused tests, full room geometry checks, typecheck, and commit**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureScale.test.ts tests/modernOfficeCatalog.test.ts tests/modernOfficeRoomBuilder.test.ts tests/builtInOfficePrefabs.test.ts tests/interiorDefinitions.test.ts tests/officeRoomValidation.test.ts tests/interiorLayoutEditor.test.ts && npm run typecheck`

Commit: `fix: normalize interior furniture presentation`

---

### Task 5: Three-button paginated dashboard HUD

**Files:**
- Create: `public/dashboard_cards.mjs`
- Modify: `public/dashboard_disclosure.mjs`
- Modify: `public/ui_strings.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`
- Test: `tests/test_dashboard_cards.mjs`
- Test: `tests/test_dashboard_disclosure.mjs`
- Test: `tests/test_frontend_i18n.mjs`
- Test: `tests/test_dashboard_layout.py`
- Test: `tests/test_fastapi_service.py`

**Interfaces:**
- Produces: `DashboardCardId = 'events'|'agents'|'help'`.
- Produces: `dashboardCardPage(items, page, pageSize): { items; page; pageCount; canPrevious; canNext }`.
- Produces: `placeDashboardCard(triggerRect, cardSize, viewport, exclusions): { left; top }`.
- Consumes: existing heartbeat/current-state/count DOM, disclosure storage, cutaway bridge state, locale catalog, and live snapshot renderer.

- [ ] **Step 1: Write RED tests for exactly three controls and pagination**

```js
assert.deepEqual(DASHBOARD_CARD_IDS, ['events', 'agents', 'help']);
assert.deepEqual(dashboardCardPage([1,2,3,4,5], 1, 2).items, [3,4]);
```

Structural tests must reject the legacy diagnostics/five-dot controls, any `overflow: auto|scroll` inside cards, viewport overflow, mutual card opening, and collision with heartbeat/cutaway rectangles.

- [ ] **Step 2: Run Node/Python focused tests and verify RED**

Run: `node --test tests/test_dashboard_cards.mjs tests/test_dashboard_disclosure.mjs tests/test_frontend_i18n.mjs && PYTHONPATH=. pytest -q tests/test_dashboard_layout.py tests/test_fastapi_service.py`

Expected: missing pagination module, legacy extra controls, scrollable drawer CSS, and unavailable localized labels.

- [ ] **Step 3: Implement pure pagination and viewport-safe card placement**

Clamp page numbers, maintain stable ordering, and place the complete fixed-size card without intersecting the heartbeat or open cutaway. Use a smaller fixed page size at compact dimensions; never introduce scroll.

- [ ] **Step 4: Replace five-dot toolbar/drawer with three colored icon controls**

Render Events, Agents, and Help with distinct semantic color tokens, text/icon labels, tooltips, `aria-expanded`, and one shared anchored card. Remove the resizable workspace drawer and associated dividers from the active map-first surface.

- [ ] **Step 5: Wire live data, dismissal, focus, and locale**

Opening one card closes the previous card. Same-button click, outside click, `Escape`, and cutaway open close it and restore focus. Previous/Next change page without scrolling. Render all four locale strings and deduplicate live-region announcements.

- [ ] **Step 6: Add compact/reduced-transparency/reduced-motion CSS**

Use opaque fallback surfaces when transparency is reduced, immediate transitions when motion is reduced, visible focus rings, bounded cards, and no `overflow: auto|scroll` in the active HUD.

- [ ] **Step 7: Run focused tests, syntax checks, and commit exact hunks**

Run: `node --test tests/test_dashboard_cards.mjs tests/test_dashboard_disclosure.mjs tests/test_frontend_i18n.mjs && PYTHONPATH=. pytest -q tests/test_dashboard_layout.py tests/test_fastapi_service.py && node --check public/app.mjs && node --check public/dashboard_cards.mjs`

Because `public/app.mjs`, `public/index.html`, and dashboard tests contain unrelated user changes, stage only task-owned hunks and audit `git diff --cached` before commit.

Commit: `feat: simplify the map-first dashboard hud`

---

### Task 6: Whole-range QA, deployment, and CodeGraph synchronization

**Files:**
- Modify only if a reproducible regression is found: directly responsible source/test files
- Append: `.superpowers/sdd/game-like-interior-editor-report.md`
- Create screenshots under: `.superpowers/sdd/game-like-interior-editor-artifacts/screenshots/`

**Interfaces:**
- Consumes all five task deliverables.
- Produces an exact-revision Docker image, browser evidence, final test evidence, and current CodeGraph status.

- [ ] **Step 1: Run full automated verification**

Run:

```bash
node --test tests/*.mjs
PYTHONPATH=. pytest -q
cd pixelworld_mvp
npm test -- --run
npm run typecheck
npm run build
```

Expected: zero failures; only documented conditional skips/advisories are acceptable.

- [ ] **Step 2: Rebuild through the ordinary project entrypoint**

Run `./run.sh start` with safe alternate ports if an unrelated process owns the default port. Verify OCI revision equals exact `HEAD`, health is OK, required public/private assets return 200, purchased assets are absent from the image and mounted read-only.

- [ ] **Step 3: Browser-test direct manipulation**

At desktop and compact sizes, verify left click does not open actions, right click toggles the four-action menu, empty click/Escape dismisses, marquee selection produces the group menu, no menu wraps/scrolls, and pointer capture survives edge crossing.

- [ ] **Step 4: Browser-test stacking, fitting, and persistence**

Place a small object on a desk, overlap ordinary furniture without red, fit beyond every edge, reject entrance blocking, move support plus attached object, Save/reload, and perform one Undo. Confirm zero writes before Save.

- [ ] **Step 5: Browser-test semantic agents, scale, dashboard, and accessibility**

Exercise Rest/Search/Work actions with custom compatible furniture, missing-category entrance fallback, representative furniture families, authored rotations, all three dashboard cards and pagination, keyboard focus/Escape, reduced motion/transparency, four locales, console, and network.

- [ ] **Step 6: Fix any discovered regression with a fresh RED→GREEN cycle**

Each browser defect receives one failing automated regression, minimal production fix, focused verification, and atomic commit. Stop bounded browser attempts and document any genuinely unavailable trusted-pointer/pixel-level check.

- [ ] **Step 7: Request whole-range review and close all Critical/Important findings**

Generate a review package from the design-plan base to final candidate. An independent reviewer checks the full range. Repeat narrow TDD fix waves until Critical and Important counts are zero.

- [ ] **Step 8: Final verification, report, and CodeGraph sync**

Re-run full tests/build against exact final HEAD, verify deployed revision and health, write the report with exact clean/shared counts and limitations, then run `codegraph sync` and `codegraph status` as the last repository operation.

Commit any scoped QA fix separately; do not commit purchased assets, browser state, or unrelated workspace files.

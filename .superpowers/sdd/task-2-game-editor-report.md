# Task 2 Report — Permissive Overlap, Automatic Support, and Closest-edge Placement

## Status

Implemented and verified Task 2. Ordinary visual overlap is accepted with normal feedback; surface objects attach to compatible supports and move/return with them; rendering is ordered by semantic role and foot baseline; partially overflowing furniture uses a single closest-edge fit while entirely outside, impossible-fit, entrance-blocking, and invalid-asset placements remain invalid.

## Owner mapping

CodeGraph and production import tracing established that two brief paths do not exist in this checkout:

- `interiorRenderer.ts` maps to the active furniture renderer in `InteriorCutawaySystem.ts`.
- `officeRoomValidation.ts` maps to the strict office/final validation in `prefabGeometry.ts`.

No placeholder files were created. `interiorPrefabStore.ts` was also updated because its final paste validator directly owned the old overlap rejection.

## TDD evidence

### RED

- The first Task 2 focused run produced 16 expected failures covering ordinary overlap, entirely-outside placement, automatic attachment/detachment, dependency movement/return, strict support validation, and semantic render depth.
- The unknown-asset hydration regression failed separately because the draft loader dropped the item instead of leaving it returnable.
- The prefab-store overlap regression failed separately because final paste validation still rejected an intentional overlap.
- A catalog-semantic audit added a floor fallback assertion for the `surfaces` category. It failed 1 of 4 tests (`support` received instead of `floor`) before the category mapping was corrected.

### GREEN

- Final focused command:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorAutoStack.test.ts tests/interiorPlacement.test.ts tests/interiorLayoutEditor.test.ts tests/interiorSelection.test.ts tests/interiorCutawaySystem.test.ts tests/interiorDragPresentation.test.ts tests/interiorPrefabStore.test.ts tests/officeRoomValidation.test.ts tests/prefabGeometry.test.ts`
  - Result before review: 9 files passed; 236 tests passed.
- Initial pre-review full Pixelworld run:
  - `cd pixelworld_mvp && npm test -- --run`
  - Result: 64 files passed; 598 tests passed.
- Final post-review focused command: the same 9-file command passed 238 tests.
- Final post-review full Pixelworld run:
  - `cd pixelworld_mvp && npm test -- --run`
  - Result: 64 files passed; 600 tests passed.
- Final typecheck:
  - `cd pixelworld_mvp && npm run typecheck`
  - Result: `tsc --noEmit`, exit 0.
- Task-file whitespace audit:
  - `git diff --check -- src/rendering tests`
  - Result: exit 0.

## Implementation

- Added the pure `interiorAutoStack.ts` model with the required `StackRole`, `resolveAutomaticSupport`, and `stackDependencies` interfaces. Explicit authored floor/surface roles are respected, catalog and furniture-kind semantics provide fallbacks, topmost support selection is deterministic, and unresolved support falls back to unattached ordinary decor.
- Narrowed placement invalidation to invalid assets, entrance collision, and bounds failures. A candidate that partly intersects the room is translated by the smallest fitting delta; one entirely outside the room or too large to fit is left invalid instead of snapping across the room.
- Applied automatic attachment/detachment to add, move, resize, rotate, catalog drag, and selection preview paths. Moving a support expands the selection to attached dependencies with one shared delta. Returning a support removes its dependency closure.
- Removed opaque-overlap rejection from interactive placement, office layout issues, prefab placement, and prefab paste validation. Strict validation still reports dangling IDs, non-surface sources, non-support targets, invalid assets, entrance blockage, and outside/impossible geometry.
- Replaced user `zIndex`-driven rendering with semantic role then opaque-foot baseline ordering. Agents and feedback remain above furniture; the active selection and outline are lifted only while manipulated and deterministic order is restored afterward.
- Preserved v5 fields and hydration, including `supportedByIds`, prefab/group IDs, scale, rotation, interaction points, and visual offsets. Unknown saved assets stay in the draft so the user can return them.
- Kept catalog support semantics stable through Save/reload by aligning the persisted default layer with workstation and labeled support categories. Hydration repairs dangling and non-support references into unattached ordinary decor in memory without rewriting storage before Save; unknown assets are retained only when their fallback bounds are inside and entrance-clear.
- Drag previews remain in memory and do not write storage or create undo history. An accepted overlap gesture commits exactly one undo snapshot; Save remains the persistence boundary.

## Independent review follow-up

The mandatory read-only completion review found no Critical issues and identified three Important compatibility gaps plus two Minor proof/API gaps. All were addressed before commit:

- Added a real catalog `kind: decor` workstation plus attached monitor v5 Save/reload regression.
- Made unknown-asset geometry/entrance validation precede the retainable `invalid-asset` diagnostic.
- Repaired malformed hydrated support graphs without silently dropping the furniture item.
- Made the exported `moveFurniture` helper carry attached dependency items instead of stranding them.
- Strengthened the overlap integration test to prove exactly one undo entry, not merely `canUndo === true`.

The first focused run after the role fix exposed 39 failures with one shared cause: an authored built-in surface was being reclassified from its catalog category. The fix was moved to persistence-layer defaulting so explicit authored `layer: surface` remains authoritative. Four related suites then passed 108/108, followed by the final focused 238/238 and full 600/600 runs.

The final read-only re-review reported no unresolved Critical, Important, or Minor issues and gave `Ready to merge: Yes`.

## Tests changed

- Created `pixelworld_mvp/tests/interiorAutoStack.test.ts`.
- Extended placement, layout editor, selection, cutaway-system, drag-presentation, prefab-store, office validation, and prefab geometry coverage.
- Tests prove rug/floor ordering, surface/support ordering, stable baseline ordering, overlap acceptance, attachment/detachment, dependency closure, partial-only edge fit, entrance/outside/impossible rejection, unknown asset retention, strict invalid support rejection, green overlap feedback, zero-write previews, and one-gesture undo.

## Scope audit

- No semantic Hook, scale, dashboard, or unrelated UI work was included.
- No Modern Office purchased asset was created, modified, staged, or committed.
- Existing unrelated dirty worktree changes were left untouched.

## Concerns

- Browser/manual QA was not requested for this task. The behavior is covered through pure geometry/selection tests plus the Phaser system integration harness.
- Legacy layer/z-index mutation helpers remain as internal compatibility APIs for existing callers and saved v5 data, but no user-facing control reaches them and the renderer ignores user z-index for ordering.

## Independent review follow-up 2 — Shared closure and transform geometry

### Outcome

- Public `moveFurniture` now translates the full support dependency closure first, computes one combined opaque bounds, and applies the room-edge fit delta once to every member. The 14-wide desk/offset-monitor repro settles against the right edge with its relationship and caller immutability intact.
- Selection expansion now alternates prefab membership and forward support dependencies to a fixed point. Cutaway right/left click, marquee, drag capture, lift, outline, preview mutation, selection count, commit, and return all consume the same layout-ordered IDs.
- Geometry transforms re-resolve selected surface attachments against the transformed layout when the layer itself did not change. A monitor rotated away with a separate chair prefab detaches from the external desk; a monitor transformed together with its support retains the relationship.
- Topmost support coverage now uses distinct baselines, reversed input order, and IDs whose lexical order opposes the expected result, proving baseline ordering rather than an array/ID tie.

### TDD evidence

#### RED

- Dependency closure closest-edge fit plus topmost characterization:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorAutoStack.test.ts tests/interiorLayoutEditor.test.ts -t "topmost containing support|complete public support dependency closure"`
  - Result: 1 failed, 1 passed, 48 skipped. `moveFurniture` returned the unchanged layout; the existing baseline comparator already passed the strengthened characterization.
- Transform support re-resolution:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorSelection.test.ts -t "re-resolves transformed surface support"`
  - Result: 1 failed, 26 skipped. The rotated monitor retained `supportedByIds: ['external-desk']`.
- Cutaway fixed-point closure:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts -t "fixed-point prefab and support closure"`
  - Result: 1 failed, 91 skipped. Drag capture contained desk and monitor but omitted the monitor's prefab chair.

#### GREEN

- Exact repros:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorLayoutEditor.test.ts tests/interiorSelection.test.ts tests/interiorCutawaySystem.test.ts tests/interiorAutoStack.test.ts -t "complete public support dependency closure|re-resolves transformed surface support|fixed-point prefab and support closure|topmost containing support"`
  - Result: 4 files passed; 4 tests passed, 165 skipped.
- Requested focused suite:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorAutoStack.test.ts tests/interiorSelection.test.ts tests/interiorLayoutEditor.test.ts tests/interiorCutawaySystem.test.ts tests/prefabGeometry.test.ts`
  - Result: 5 files passed; 180 tests passed.
- Fresh full Pixelworld suite and typecheck:
  - `cd pixelworld_mvp && npm test -- --run && npm run typecheck`
  - Result: 64 files passed; 603 tests passed; `tsc --noEmit` exit 0.

### Completion review resolution

The mandatory read-only completion review found no Critical issues and one Important preservation gap: unconditional automatic re-resolution could switch a surface from its still-containing declared support to a different overlapping support with a higher baseline. A dual-support regression was added before the production change.

- Review RED:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorSelection.test.ts -t "preserves the declared support"`
  - Result: 1 failed, 27 skipped. The monitor changed from `declared-desk` to `higher-desk`.
- Targeted GREEN:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorSelection.test.ts -t "preserves the declared support|re-resolves transformed surface support"`
  - Result: 2 passed, 26 skipped.
- Final requested focused suite and typecheck:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorAutoStack.test.ts tests/interiorSelection.test.ts tests/interiorLayoutEditor.test.ts tests/interiorCutawaySystem.test.ts tests/prefabGeometry.test.ts && npm run typecheck`
  - Result: 5 files passed; 181 tests passed; `tsc --noEmit` exit 0.
- Final fresh full Pixelworld suite and typecheck:
  - `cd pixelworld_mvp && npm test -- --run && npm run typecheck`
  - Result: 64 files passed; 604 tests passed; `tsc --noEmit` exit 0.

The transform path now keeps the declared support only while it remains compatible and geometrically contains the transformed surface; otherwise it detaches or selects the current topmost compatible support. No unresolved Critical or Important review findings remain.

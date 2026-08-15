# Task 3 Report — Semantic Hook Furniture and Agent Routing

## Status

Implemented and verified Task 3. Hook actions now resolve through the user-facing Rest, Search, and Work furniture categories. Occupants choose the nearest compatible reachable adjacent interaction point with deterministic tie-breaking, independently of exact furniture IDs, `requirementId`, or exact legacy actions. If a category is absent, the agent remains at the entrance and receives one short localized, non-blocking transient feedback message.

## Owner mapping

CodeGraph and production import tracing established the current owners before editing:

- The brief's `src/rendering/interiorDefinitions.ts` path maps to `src/world/interiorDefinitions.ts`. The authored definitions already provide all three semantic categories, so production changes there were unnecessary; coverage was added in `tests/interiorDefinitions.test.ts`.
- The brief's `src/i18n/interiorLocale.ts` is a known typo and maps to production `src/rendering/interiorLocale.ts`.
- DOM cutaway status is owned by `src/rendering/InteriorCutawayDomOverlay.ts`; it was updated alongside the Phaser cutaway system.
- Navigation footprint exemption is owned by `src/rendering/interiorPlacement.ts`, and the existing divider/non-support classifier is owned by `src/rendering/interiorAutoStack.ts`. Both were narrowly updated after independent review found shared-root routing/classification gaps.

No placeholder owner files were created.

## TDD evidence

### RED

- Initial focused run:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureSemantics.test.ts tests/interiorAssignment.test.ts tests/interiorMotion.test.ts tests/interiorDefinitions.test.ts tests/interiorLayoutEditor.test.ts tests/villageSystemAcceptance.test.ts tests/validateWorld.test.ts`
  - Result: two suites importing the missing semantic module initially failed to collect and five existing expectations failed; 78 tests passed and 5 failed among collected tests.
- Independent-review regressions:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureSemantics.test.ts tests/interiorMotion.test.ts tests/interiorCutawaySystem.test.ts`
  - Result: 3 files failed; 109 tests passed and 6 failed. Failures proved glass divider assets 207–209 were misclassified as Search, adjacent targets were reachable only by passing through the selected station, and two missing agents produced two overlapping bubbles.

### GREEN

- Reviewer regression rerun: 3 files passed; 115 tests passed.
- Final expanded focused command:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureSemantics.test.ts tests/interiorAssignment.test.ts tests/interiorMotion.test.ts tests/interiorDefinitions.test.ts tests/interiorLayoutEditor.test.ts tests/villageSystemAcceptance.test.ts tests/validateWorld.test.ts tests/interiorCutawaySystem.test.ts`
  - Result: 8 files passed; 218 tests passed.
- Single pre-commit full Pixelworld run:
  - `cd pixelworld_mvp && npm test`
  - Result: 65 files passed; 625 tests passed.
- Final typecheck:
  - `cd pixelworld_mvp && npm run typecheck`
  - Result: `tsc --noEmit`, exit 0.
- Whitespace audit:
  - `git diff --check`
  - Result: exit 0.

## Implementation

- Added `FurnitureSemantic = 'rest' | 'search' | 'work'` and the pure semantic APIs `semanticForAction`, `semanticForFurniture`, and `nearestSemanticStation`.
- Semantic derivation respects an explicit saved semantic first, then unanimous legacy action metadata, furniture kind, and Modern Office catalog metadata. Floor/surface objects, attached surface objects, and divider/partition/wall assets do not become stations accidentally.
- Assignment begins at the entrance, filters by semantic category, enumerates authored or adjacent interaction points, rejects blocked/unreachable candidates with four-direction A*, and applies stable distance/furniture-ID/point ordering. Used points and furniture remain unique.
- Fine-grained actions remain available for event behavior and labels, but assignment and required Hook inventory no longer require an exact supported action, furniture ID, or `requirementId`.
- Motion patrols up to two nearby reachable stations in the same semantic category and returns to the assigned station. The shared navigation blocker now exempts a selected station only when the target actually occupies its navigation footprint, preventing paths through large furniture while retaining legacy on-footprint anchors.
- Missing-category occupants stay at the exact entrance without a fake furniture route. Stable assignment ordering chooses one feedback owner for a four-second localized bubble and DOM status. Save remains enabled and unrelated furniture is neither invalidated nor tinted red.
- All four locales provide category names and concise missing-category copy.
- Saved v5 layouts preserve legacy metadata and derive semantic metadata in memory. Loading/hydration performs zero writes; normalized semantic metadata is persisted only on explicit Save.
- Existing authored office themes retain Rest/Search/Work coverage and 13-agent compatible capacity. Motion ingress, orthogonal paths, stable identity, and semantic patrol coverage remain green.

## Independent review

The initial read-only completion review reported no Critical findings and three Important gaps: whole-station navigation exemption, glass-divider Search misclassification, and one bubble per missing agent. RED regressions were added before each production fix. The targeted re-review explicitly cleared all Critical and Important issues and approved readiness.

## Changed files

- Created `pixelworld_mvp/src/rendering/interiorFurnitureSemantics.ts`.
- Modified semantic types, assignment, motion, placement, automatic-stack classification, layout hydration/inventory, world validation, locale copy, cutaway rendering, and DOM status in their production owners.
- Created `pixelworld_mvp/tests/interiorFurnitureSemantics.test.ts` and extended assignment, motion, authored definitions, layout editor, world validation, cutaway system, and village acceptance coverage.
- Created `.superpowers/sdd/task-3-game-editor-report.md`.

## Scope audit

- No furniture scale/orientation or dashboard work was included.
- No purchased Modern Office asset was created, modified, staged, or committed.
- Existing unrelated dirty worktree files, including `pixelworld_mvp/build_world_guide.md`, were not edited or staged.

## Concerns

- Browser/manual QA was not requested. The behavior is covered by pure semantic/navigation tests plus the existing Phaser and DOM harnesses.
- If compatible category capacity is exhausted, extra agents remain at the entrance without claiming the category is missing; the required 13-agent scenarios remain fully assigned where compatible furniture exists.

## Independent-review follow-up — 2026-08-15

### Status

Resolved all five findings from the independent review in a separate follow-up change. The fix keeps the original three semantic categories, 13-agent capacity behavior, v5 zero-write hydration, four locales, non-blocking Save, and existing motion/patrol behavior.

### TDD RED

- Initial five-finding regression run:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureSemantics.test.ts tests/interiorMotion.test.ts tests/interiorCutawaySystem.test.ts tests/interiorLayoutEditor.test.ts tests/validateWorld.test.ts`
  - Result: 5 files failed; 11 tests failed and 186 passed. The failures covered authoritative catalog roles, stale semantic precedence, multi-cell station traversal, transient DOM/Phaser feedback, layout shift/reload, and validation deduplication.
- The corrected missing-Search validation fixture produced two duplicate errors instead of one.
- An added explicit-semantic round-trip regression failed after the first normalization change exposed over-clearing of valid standalone furniture semantics.
- An added asset 239 persisted-semantic regression failed until catalog surface roles were made authoritative ahead of persisted semantic metadata.

### TDD GREEN

- Granular navigation target regressions: 5 tests passed. A 1×3 station with side blockers is unreachable from an on-footprint anchor without crossing opaque station cells, while a normal adjacent interaction point remains reachable.
- Catalog/role/normalization focused run: 105 tests passed. Representative assets and ranges are classified by centralized asset ID metadata; labels may change without affecting semantics. Asset 102 is Rest, asset 239 is not Work, dividers 207–209 have no semantic, and floor/surface/attached items cannot regain station semantics from persisted data.
- Expanded focused command:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorFurnitureSemantics.test.ts tests/interiorAssignment.test.ts tests/interiorMotion.test.ts tests/interiorCutawaySystem.test.ts tests/interiorLayoutEditor.test.ts tests/validateWorld.test.ts tests/interiorAutoStack.test.ts tests/interiorPlacement.test.ts && npm run typecheck`
  - Result: 8 files passed; 234 tests passed; `tsc --noEmit` exited 0.
- Fresh full Pixelworld verification after all production changes:
  - `cd pixelworld_mvp && npm test && npm run typecheck`
  - Result: 65 files passed; 651 tests passed; `tsc --noEmit` exited 0.
- `git diff --check` exited 0.

### Fixes

- Navigation removes only a genuine selected interaction target cell from the blocked set, and only when every owner of that cell is the selected station/prefab. The remainder of a multi-cell station footprint stays opaque.
- Modern Office semantic and physical roles are centralized by authoritative asset IDs. Semantic routing and auto-stack classification no longer infer roles from category names or labels.
- One stable missing agent owns both Phaser and DOM feedback for a four-second room/category episode. Event ID and action churn cannot restart it; a real category or room change may start a new episode. Other missing agents stay at the entrance without overlapping missing text.
- Layer, attachment, and authoritative surface/floor roles take precedence over persisted semantic metadata during runtime derivation and layout normalization. Shift plus explicit Save/reload cannot turn a floor or attached object into a station.
- World validation deduplicates actions after semantic mapping, so each missing semantic category emits one error per station/theme.

### Scope audit

- Follow-up production and regression changes are limited to the twelve semantic routing, placement, cutaway, layout, validation, and test owners listed in the commit diff plus this appended report.
- No purchased asset or unrelated dirty-worktree file was modified or staged by this follow-up.

### Independent re-review

- Read-only re-review verdict: approved, with no Critical or Important findings.
- One Minor test-coverage note remains: category changes are explicitly tested, while close/open to a different building relies on the production reset path rather than a dedicated cross-building assertion. The requested room/category lifecycle and all existing cutaway coverage remain green.

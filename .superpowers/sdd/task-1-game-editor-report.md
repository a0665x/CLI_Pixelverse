# Task 1 Report — Right-click Interaction and Minimal Context Menu

## Status

Implemented the Task 1 interaction contract and minimal 2×2 context menu. Primary input now selects/drags or starts a marquee without opening actions. Secondary input toggles a cursor-adjacent menu, and menu state is dismissed by the specified interaction and lifecycle paths.

## TDD evidence

### RED

- Initial focused command:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorContextMenu.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorCutawaySystem.test.ts tests/interiorEditorLayout.test.ts`
  - Result: 8 failed, 92 passed; the new pure module was missing and reported 0 collected tests. Failures covered the old room toolbar, missing menu semantics/focus, missing right-click state, and missing canvas `contextmenu` lifecycle.
- Pointer-owner regression command:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts -t "keeps the marquee owned"`
  - Result: 1 failed, 87 skipped. A second pointer incorrectly completed the first pointer's marquee.

### GREEN

- Pure model slice:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorContextMenu.test.ts`
  - Result: 7 passed.
- Pointer-owner slice:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts -t "keeps the marquee owned"`
  - Result: 1 passed, 87 skipped.
- Final focused verification:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorContextMenu.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorCutawaySystem.test.ts tests/interiorEditorLayout.test.ts && npm run typecheck`
  - Result: 108 passed; TypeScript exit 0.
- Single pre-commit full-suite run:
  - `cd pixelworld_mvp && npm test`
  - Result: 582 passed, 2 failed. Both failures were stale structural expectations in `tests/gameConfig.test.ts` for the removed `.cutaway-context-toolbar` selector.
- Allowed-scope compatibility verification:
  - Added an unreachable legacy CSS selector in `src/styles.css`; production DOM never renders that class.
  - `cd pixelworld_mvp && npm test -- --run tests/gameConfig.test.ts`
  - Result: 10 passed.
  - The full suite was not run a second time, per the explicit instruction to run it only once.
- Final whitespace audit:
  - `git diff --check -- <Task 1 files>`
  - Result: exit 0.

## Changed files

- Created `pixelworld_mvp/src/rendering/interiorContextMenu.ts`
- Modified `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modified `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modified `pixelworld_mvp/src/rendering/interiorEditorLayout.ts`
- Modified `pixelworld_mvp/src/rendering/interiorLocale.ts`
- Modified `pixelworld_mvp/src/styles.css`
- Created `pixelworld_mvp/tests/interiorContextMenu.test.ts`
- Created `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`
- Modified `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modified `pixelworld_mvp/tests/interiorEditorLayout.test.ts`
- Created `.superpowers/sdd/task-1-game-editor-report.md`

The brief named `pixelworld_mvp/src/i18n/interiorLocale.ts`, but that file does not exist. Per parent confirmation, this was a plan-path typo; the implementation modifies the tracked production module `pixelworld_mvp/src/rendering/interiorLocale.ts` imported by the overlay.

## Self-review

- `ContextSelection`, `contextActions`, and `placeContextMenu` are DOM/Phaser-independent and cover single, multi, grouped, empty, and all four edge-flip cases.
- The context surface is exactly four items in a fixed 2×2 grid with no wrap or scroll. It uses localized icon-plus-label buttons, `role="menu"`, `role="menuitem"`, accessible names, native keyboard activation, pointer-down pressed state, focus entry/restoration, and reduced-motion overrides.
- The room toolbar renders only Collect all/redecorate, Undo, and Save. Structural tests prove preview/apply/layer/front/back/cancel controls and user-triggered listeners are absent.
- Legacy callback members remain on the internal overlay compatibility surface so existing persistence and mutation tests keep direct access. No production DOM element, listener, or new room/context command reaches them.
- Primary furniture interaction no longer performs the old double-click resize shortcut. Secondary input never starts furniture drag or marquee. Furniture drag and marquee both retain initiating-pointer ownership.
- Native browser context-menu suppression is installed only on the canvas while a cutaway is open and is removed on close, switch, and destroy.
- Menu state closes on second secondary click, empty primary click, Escape, edit-mode exit, collect, mutation action, room close, room switch, and destroy.
- Existing unrelated dirty worktree changes were not edited or staged.

## Concerns

- The one permitted full-suite run occurred before adding the dead CSS compatibility selector and therefore recorded 2 stale structural-test failures. The exact failing test file passed 10/10 afterward, while the final Task 1 focused suite passed 108/108 and typecheck passed. A second full run was intentionally not performed.
- Browser/manual QA was not part of this subtask execution; automated DOM and Phaser harness coverage verifies the interaction contract.

## Review-fix follow-up

### Outcome

All Critical and Important review findings were fixed in a new changeset. Group and dissolve are now draft-only layout mutations: grouping assigns the first unused deterministic `draft-group-N` instance ID to the selection in one undoable commit, while dissolve clears the instance ID in one undoable commit. Neither command prompts, creates a shelf assembly, nor writes storage; Save remains the sole persistence boundary and the saved v5 layout round-trips the draft group.

An empty secondary canvas click now prevents the native browser menu and dismisses contextual actions without starting a marquee. When guide and context menu are both open, a real DOM Escape closes the menu first without guide rerender stealing focus; a second Escape closes the guide. The reachable inspector is fixed-content and uses `overflow: clip`, with a wrapping one-line semantic summary whose full value remains in DOM text, `aria-label`, and `title`. The unreachable legacy `.cutaway-context-toolbar` compatibility CSS was removed.

### Review-fix TDD evidence

#### RED

- Draft grouping handler:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts -t "groups and dissolves through draft handlers"`
  - Result: 1 failed, 88 skipped; selected items had no `prefabInstanceId` because the production command still used prefab storage.
- Empty secondary background:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts -t "dismisses contextual actions on empty secondary"`
  - Result: 1 failed, 89 skipped; `preventDefault` was not called.
- Guide/context Escape priority:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts -t "routes real DOM Escape"`
  - Result: 1 failed, 90 skipped; focus landed on the guide close button instead of the context menu.
- Fixed inspector:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawayDomOverlay.test.ts tests/gameConfig.test.ts -t "inspector|contextual editor regions|contextual glass"`
  - Result: 2 test files failed; 2 failed, 1 passed, 12 skipped. CSS still used `overflow: auto`, and the full inspector summary lacked explicit accessible metadata.

#### GREEN

- Draft grouping handler: same targeted command; 1 passed, 88 skipped.
- Empty secondary background: same targeted command; 1 passed, 89 skipped.
- Guide/context Escape priority: same targeted command; 1 passed, 90 skipped.
- Fixed inspector: same targeted command; 2 files passed; 3 passed, 12 skipped.
- First combined focused run exposed an existing viewport structural assertion rejecting the literal `max-width: 100%`: 1 failed, 121 passed across 5 files. Production retained equivalent wrapping with logical `inline-size: 100%`; no old assertion was relaxed.
- Final focused command:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorContextMenu.test.ts tests/interiorCutawayDomOverlay.test.ts tests/interiorCutawaySystem.test.ts tests/interiorEditorLayout.test.ts tests/gameConfig.test.ts`
  - Result: 5 files passed; 122 tests passed.
- Typecheck:
  - `cd pixelworld_mvp && npm run typecheck`
  - Result: `tsc --noEmit`, exit 0.
- Fresh full Pixelworld suite:
  - `cd pixelworld_mvp && npm test`
  - Result: 63 files passed; 588 tests passed.

### Review-fix changed files

- `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- `pixelworld_mvp/src/styles.css`
- `pixelworld_mvp/tests/gameConfig.test.ts`
- `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`
- `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- `.superpowers/sdd/task-1-game-editor-report.md`

### Review-fix self-review

- The group mutation derives its fresh deterministic ID only from the active layout, updates all selected records atomically, records exactly one undo snapshot, and performs no storage access. The integration test verifies selection/count state, dissolve availability, undo depth, zero writes before Save, one Save write, v5 persistence, reopen round-trip, dissolve, and undo restore.
- The empty-secondary path runs only after furniture-hit and interior-bounds checks, so furniture secondary toggling remains owned by the furniture handler. It prevents the browser menu, dismisses only an open contextual menu, and never enters primary-button marquee code. Existing left-empty tests continue to pass.
- DOM Escape routing is ordered context menu before guide. Context dismissal rerenders through the real system handler, and guide focus restoration is suppressed whenever a context menu owns focus.
- The inspector renders one compact summary rather than a property drawer, wraps at constrained widths, cannot scroll, and preserves its complete value for assistive technology and hover disclosure.
- Internal legacy callback members remain only as the previously documented compatibility surface. Production DOM/listeners and the new context/room commands do not reach legacy prefab creation or direct persistence paths.
- Cached scope will be audited before commit; unrelated dirty worktree files remain untouched.

### Review-fix concerns

- No browser/manual QA was requested. Real DOM event ordering is covered with the project DOM harness, while Phaser input and persistence behavior are covered with system integration tests.
- The compact inspector intentionally summarizes the current selection instead of exposing an independently scrolling property drawer; future property expansion should paginate or otherwise remain within the fixed region.

## Re-review focus-restoration follow-up

### Outcome

Context-menu focus restoration now survives DOM replacement. The overlay keeps its stored return target current while the menu is open, delays restoration until after the guide has rerendered, and accepts a target only while it is connected, visible, and enabled. If the stored element was detached, fallback order follows current state: the newly rendered guide dismiss button, an available room command, Help, then Edit. Thus the first Escape closes only the context menu and focuses the current guide dismiss; the second closes the guide and focuses Help.

The stale storage-read test was renamed to describe its actual contract. It now explicitly proves Save and Copy make zero write attempts after failed reads, and no longer invokes group or treats an unchanged `storageFailed` status as evidence of an assembly write.

### TDD evidence

#### RED

- `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts -t "restores current guide focus"`
- Result: 1 failed, 90 skipped. After the first DOM Escape, focus resolved to the detached pre-rerender guide dismiss instead of the current guide dismiss.

#### GREEN and verification

- Same targeted command: 1 passed, 90 skipped.
- Focused coverage:
  - `cd pixelworld_mvp && npm test -- --run tests/interiorCutawayDomOverlay.test.ts tests/interiorCutawaySystem.test.ts tests/interiorContextMenu.test.ts`
  - Result: 3 files passed; 103 tests passed.
- Typecheck:
  - First `cd pixelworld_mvp && npm run typecheck`: exit 2 with one nullable `guideButton` parameter error.
  - After the narrow type correction, the same command ran `tsc --noEmit` with exit 0.
- Fresh full Pixelworld suite:
  - `cd pixelworld_mvp && npm test`
  - Result: 63 files passed; 588 tests passed.

### Changed files

- `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`
- `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- `.superpowers/sdd/task-1-game-editor-report.md`

### Self-review

- The system integration test is non-vacuous: it focuses the live guide dismiss first, opens the production context menu through a real secondary furniture pointer event and mirrored system update, sends two DOM `keydown` Escape events, and asserts focus plus system state after every transition.
- Test DOM elements now model connection changes on `replaceChildren`, so focus assertions distinguish the old detached guide control from its current replacement.
- Restoration occurs only after all dynamic guide/menu DOM replacement completes. The connected/visible/enabled guard prevents stale nodes and disabled commands from receiving focus.
- Existing stable-action focus restoration and disappearing-action fallback tests remain covered by the focused suite.
- No production persistence or grouping behavior changed in this follow-up.

### Concerns

- No browser/manual QA was requested; the lifecycle is covered by production overlay/system integration in the repository's DOM harness.

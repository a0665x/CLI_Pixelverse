# Game-like Interior Editor Final Fixes Report

Date: 2026-08-15

Reviewed range: `64717bb..67cde7e`

Implementation commits: `80c2a1d`, `67cde7e`

Final-review input: 0 Critical, 8 Important, 4 Minor

## Outcome

All 8 Important and all 4 Minor findings in `game-like-interior-final-review.md` are resolved. Two independent task-scoped re-reviews found no remaining Critical or Important issue. The executable code head is fully green in focused and reconstructed full verification, is deployed through the ordinary launcher on port 5661, and passed bounded real-browser smoke. Purchased Modern Office assets remain private, read-only runtime inputs and were not staged or committed.

## Finding resolution

| Finding | Resolution | Primary regression coverage |
| --- | --- | --- |
| Important 1: arbitrary multi-selection Duplicate was a dead action | Duplication now accepts arbitrary selections atomically, creates fresh item and prefab-instance identities, remaps internal supports, re-resolves external supports, and records one undo mutation. | `interiorSelection.test.ts`, `interiorCutawaySystem.test.ts` |
| Important 2: Resize could only grow | The compact context surface now opens a bounded size submenu with Smaller, Larger, Reset 100%, and Back; it enters focus on Smaller. | `interiorCutawayDomOverlay.test.ts`, `interiorCutawaySystem.test.ts` |
| Important 3: transformed explicit interaction points could become unusable | Explicit points are accepted only when in-room, adjacent, and reachable; invalid persisted points fail safe to compatible reachable adjacent candidates without dropping furniture. | `interiorFurnitureSemantics.test.ts`, `interiorAssignment.test.ts` |
| Important 4: sofas and beds were supports | Auto-stack support classification is restricted to authoritative catalog supports and desk/table/cabinet/shelf roles. | `interiorAutoStack.test.ts` |
| Important 5: transparent texture padding stole input | Furniture interaction uses transformed trimmed opaque hit geometry, consistent with placement and marquee geometry across scale, rotation, and visual offset. | `interiorCutawaySystem.test.ts` |
| Important 6: duplicated surfaces retained stale external support IDs | Internal supports remap to copied IDs; external support links survive only when compatible copied geometry still contains the surface, otherwise a compatible support is selected or the surface detaches. | `interiorSelection.test.ts` |
| Important 7: cutaway lifecycle lost the HUD focus trigger | A one-shot pending-to-active focus handoff captures the connected dashboard trigger before disclosure closes, consumes it for the matching cutaway, and clears stale lifecycle state. | `test_dashboard_disclosure.mjs` |
| Important 8: production HUD cards could overlap an open cutaway | Cutaway-open production integration collapses and disables all dashboard card controls, marks them `aria-disabled`, and re-enables them on close. | `test_dashboard_disclosure.mjs`, `test_dashboard_layout.py` |
| Minor 1: native context menu was suppressed too broadly | Suppression is limited to edit mode and a point inside the current reserved room. | `interiorCutawaySystem.test.ts` |
| Minor 2: marquee lacked cancellation cleanup | `pointercancel` now releases ownership and clears rectangle, contextual state, and status through the same cleanup path. | `interiorCutawaySystem.test.ts` |
| Minor 3: furniture labels remained interactive | Furniture labels are selection/menu-only and inert; agent activity bubbles retain their intended availability. | `interiorCutawayDomOverlay.test.ts`, `gameConfig.test.ts` |
| Minor 4: JA/KO dynamic Events fell through to English | Dynamic event titles, summaries, status prefixes, and live-region text now use Japanese/Korean templates; both ASCII and fullwidth colons are parsed. | `test_frontend_i18n.mjs` |

The final geometry re-review additionally found and drove RED regressions for stale duplicated Hook `blocksNavigation` state and legacy on-footprint interaction anchors. Both were corrected before approval. A UI re-review found an ASCII-colon localization gap; that Minor was corrected with explicit Japanese/Korean regressions. Re-review result: Critical 0, Important 0, Minor 0 in the reviewed fix scope.

## TDD evidence

Every final-review behavior was first represented by a failing focused regression before production changes.

- RED: 22 behavior-specific failures were observed: 17 Pixelworld Vitest failures, 4 root Node test failures, and 1 root Python structural test failure.
- GREEN: all same 22 regressions passed after implementation.
- Final focused Pixelworld slice: 8 files, 207/207 tests passed.
- Final focused dashboard/i18n Node slice: 21/21 tests passed.
- Final focused dashboard layout Python slice: 18/18 tests passed.

The final focused commands were:

```text
cd pixelworld_mvp && npm test -- --run \
  tests/interiorSelection.test.ts \
  tests/interiorCutawaySystem.test.ts \
  tests/interiorCutawayDomOverlay.test.ts \
  tests/interiorAutoStack.test.ts \
  tests/interiorFurnitureSemantics.test.ts \
  tests/interiorAssignment.test.ts \
  tests/gameConfig.test.ts \
  tests/villageSystemAcceptance.test.ts

node --test tests/test_dashboard_disclosure.mjs tests/test_frontend_i18n.mjs
python3 -m pytest -q tests/test_dashboard_layout.py
```

## Full verification

The executable code head `67cde7e523dd1127d2098ec648bd8e87b5397cab` was reconstructed outside the dirty worktree and verified with clean dependencies:

- Pixelworld: 66 files, 682/682 tests passed.
- Root Node: 132/132 tracked exact-HEAD tests passed.
- Root Python: 82 passed, 1 skipped. An archive-only run first reported 81 passed, 1 skipped, and 1 infrastructure failure because `git archive` has no `.git`; rerunning the identical tree with read-only Git metadata satisfied the test's `git ls-files` precondition.
- Pixelworld typecheck: `tsc --noEmit` passed.
- Pixelworld production build: passed. Vite emitted only its existing advisory for a JavaScript chunk larger than 500 kB.

For comparison, the shared worktree's broader suites, which include unrelated untracked user tests, also passed: Pixelworld 682/682, root Node 176/176, and root Python 119 passed with 1 skipped.

## Scope and review audit

- Implementation was split into new commits after reviewed head `64717bb`; no reviewed commit was amended.
- Exact/partial staging included only the scoped production files, regressions, and this report.
- Existing unrelated modified, deleted, and untracked work remains in the shared worktree.
- No purchased Modern Office file was added to Git. The asset directory remains an external private bind.
- Read-only task-scoped reviews cleared the implementation after the geometry and localization follow-ups: no unresolved Critical or Important findings.

## Deployment attestation

Because the ordinary launcher reads Git metadata, deployment used a detached clean local clone rather than a Git archive. `./run.sh start` rebuilt and started the `cli-pixelverse` Compose project with public port 5661 and bridge port 4568 while preserving the existing runtime state bind.

Attested executable deployment at code head `67cde7e523dd1127d2098ec648bd8e87b5397cab`:

- OCI image: `sha256:61fb9e66b522d07ce51aa1c6b71588fe7ca7c465180476462e7465a04c4f995a`
- OCI revision label: exact code head.
- Build fingerprint: `4fe761906844683b7ac07239de91301491bdf1e6825873aad07edc41cfeacbf4`, equal to a clean-tree recomputation.
- `/host-hermes-agent`: read-only, `rprivate`.
- `/app/public/assets/private/modern-office-v1.2`: read-only, `rprivate`.
- `/app/runtime`: the only read-write bind.
- An ephemeral image check confirmed the purchased asset directory is absent from the image layers.
- `/health`, bridge health, root, Pixelworld, API/OpenAPI, committed global-map resources, emitted JS/CSS bundles, a public asset, and a private mounted asset all returned successfully.
- The unrelated `allen-cv-webui` listener on port 5660 remained running and was not disturbed.

The documentation-only successor commit containing this report does not alter the build-input fingerprint. Its exact release SHA/image attestation is recorded in the final handoff after the mandatory range review and release redeploy.

## Bounded real-browser verification

Verified in a 1440×900 real Chromium session against `http://127.0.0.1:5661/`:

- Japanese and Korean Events cards rendered localized dynamic titles and templates with no known English fallback tokens. Arbitrary upstream payload values such as `running` remain verbatim by design.
- Research Library cutaway opened from the live Phaser canvas.
- With the cutaway open, Events/Agents/Help were collapsed and disabled with accessible disabled state.
- The live HUD bottom was 189.3125 px and the cutaway panel top was 203 px, leaving about 13.7 px of separation and no collision.
- View mode did not suppress the native context menu. Edit mode suppressed it inside the reserved room but not outside.
- A real secondary selection produced an 18-item batch menu; Duplicate completed with `Furniture duplicated` and preserved an 18-item selection.
- A single Compact Desk Plant exposed the bounded Resize submenu. Smaller moved 100% to 75%; Larger returned it to 100%; Reset reported 100%. The submenu exposed Smaller/Larger/Reset 100%/Back and initially focused Smaller.
- The context menu rectangle remained within the active room.
- Closing a cutaway that displaced the Events card restored focus exactly once to `dashboard-events-btn`; the controls were re-enabled.
- Browser console contained no application error. Chromium emitted only repeated WebGL `ReadPixels` performance warnings.

Cannot Verify with bounded browser automation:

- A deterministic transparent-pixel-over-opaque-item click cannot be targeted reliably without private sprite-alpha introspection; transformed opaque-hit behavior is covered by the focused Phaser regression.
- A trustworthy native OS/browser `pointercancel` sequence is unavailable through the bounded browser driver; ownership and complete cleanup are covered by the focused Phaser regression.

## Remaining advisories

There are no known release-blocking defects in this scope. The only advisories are the existing Vite chunk-size notice, Chromium's WebGL readback performance warning, and the two browser-driver boundaries above with automated regression coverage.

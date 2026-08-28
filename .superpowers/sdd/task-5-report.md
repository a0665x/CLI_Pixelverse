# Task 5 Report: Delete Tracked Legacy YAML Map Stack

## Status

DONE_WITH_CONCERNS

The Task 5 retirement contract and all focused tests pass. The complete JS and
Python matrices still contain three verified pre-existing/out-of-scope failures,
documented below.

## Plan correction

The required pre-deletion audit found tracked dependencies that the original
Task 5 file list omitted:

- `public/room_furniture.mjs` imported `public/house_layout.mjs`.
- `scripts/render_local_ui_trajectory.py` imported `house_layout.mjs`,
  `room_furniture.mjs`, and `world_motion.mjs`; `run.sh test-hook` invoked it.
- `tests/test_agent_walk_cycle.mjs` imported `world_motion.mjs`.
- `tests/test_hook_state_map.mjs` imported `house_layout.mjs` even though the
  active dashboard still uses `public/hook_state_map.mjs` directly.
- `docker-compose.yml` and `run.sh` still contained strings rejected by the
  required active-source negative contract.

Execution paused before deletion. The parent workflow authorized a bounded
correction: delete the exclusively retired outer/YAML renderer dependencies,
decouple the active semantic hook-route test from `house_layout.mjs`, preserve
snapshot delivery and asynchronous route-evidence polling in `run.sh test-hook`,
and move the Compose map-mount removal forward from Task 6. README and skill
documentation remain for Task 6.

## Changes

- Deleted the 12 retired production files/assets/scripts and 10 obsolete suites
  listed in the brief.
- Also deleted the audited outer-renderer-only files
  `public/room_furniture.mjs`, `scripts/render_local_ui_trajectory.py`, and
  `tests/test_agent_walk_cycle.mjs`.
- Removed the obsolete renderer function/call/artifact help from `run.sh` while
  retaining hook delivery, snapshot capture, event freshness, positive runtime
  displacement, bounded polling, and transport diagnostics.
- Removed the global-map environment variable and bind mount from Compose.
- Removed `global_map` from `scripts/docker_build_metadata.py` `BUILD_INPUTS`
  (named `SOURCE_INPUTS` in the brief) and updated its release contract.
- Rewrote `tests/test_hook_state_map.mjs` to validate the active semantic
  room/state table and defensive copies without importing the retired geometry.
- Extended the negative file/reference contract to cover the audited renderer
  additions and obsolete artifact names.

No file under `pixelworld_mvp/` was modified. In particular,
`pixelworld_mvp/src/world/worldDefinition.ts` and Phaser interior definition,
editor, placement, prefab, navigation, and rendering modules remain present.
No recursive deletion was used against `global_map/`.

## TDD evidence

Initial RED:

```text
python3 -m pytest -q tests/test_legacy_map_retirement.py
2 failed, 3 passed
```

The absence test listed all 12 original retired production paths. The active
source test also found the obsolete `run.sh`/Compose map contract.

Corrected-scope RED before implementation:

```text
python3 -m pytest -q tests/test_legacy_map_retirement.py \
  tests/test_docker_release_integrity.py tests/test_command_deck_hook_smoke.py
5 failed, 12 passed, 1 skipped
```

Failures covered the 14 retired production paths, stale build input, legacy
renderer wiring, and the copied async fixture's dependency on the renderer.

GREEN:

```text
python3 -m pytest -q tests/test_legacy_map_retirement.py \
  tests/test_docker_release_integrity.py tests/test_command_deck_hook_smoke.py
17 passed, 1 skipped
```

```text
node --test tests/test_hook_state_map.mjs
1 suite passed
```

The skip is the existing optional release-image inspection gate.

## Repository audits

The required post-deletion import scan reports only:

- README references assigned to Task 6;
- a negative dashboard test name/assertion;
- stale skill documentation assigned to Task 6.

A second active-code scan found no imports of `global_map_loader`,
`house_layout`, `world_motion`, `room_furniture`, or the trajectory renderer
outside negative assertions. The same scan found no retired imports in Phaser,
bridge, server, or dashboard sources.

## Verification

```text
python3 -m pytest -q tests/test_legacy_map_retirement.py
5 passed
```

```text
node --test tests/*.mjs
32 suites passed, 2 failed
```

Both failures come from `tests/test_command_deck_i18n.mjs`, which still expects
the already-retired outer AppleDog door and `.agent-speech.show` surfaces.
Commit `6c27638` removed those surfaces before Task 5; Task 5 did not modify
`public/app.mjs`, `public/index.html`, or this i18n suite. The real-browser locale
suite passes when run with the i18n suite, confirming this is not caused by the
legacy file deletion.

```text
python3 -m pytest -q
165 passed, 1 skipped, 1 failed
```

The sole Python failure is the baseline missing untracked
`spec/PROJECT_MAP.md` fixture in
`test_readme_and_progressive_specs_publish_the_verified_browser_acceptance`;
it is recorded in `.superpowers/sdd/progress.md` and unrelated to Task 5.

```text
bash -n run.sh
exit 0

git diff --check HEAD
exit 0
```

## Commit

Committed with message: `refactor: delete legacy yaml map stack`.

## Concerns

- Task 6 must remove the remaining operational legacy-map references from
  README, skill documentation, ignore rules, and any release documentation.
- The missing untracked progressive-spec fixture keeps the full Python command
  from being completely green. The stale JS assertions were resolved by the
  review correction below.

## Review correction

Corrective commit: `4f121f8` (`fix: align legacy retirement coverage`).

The review identified that the two JS failures recorded above were stale
retirement contracts worth correcting in Task 5, and that deletion of
`tests/test_agent_walk_cycle.mjs` also removed useful active Kenney sprite
coverage. The correction:

- removed `appleDogDoor` from all four locale catalogs, the required-key list,
  and the real-browser locale fixture;
- replaced retired AppleDog, `.event-chip`, and `.agent-speech.show` assertions
  with active accessibility-catalog and dashboard-card truncation contracts;
- moved main-agent, subagent, and branch-session directional idle/active frame
  coverage into `tests/test_frontend_kenney.mjs` without restoring
  `world_motion` or `nextWalkFrame`.

Review RED:

```text
node --test tests/test_command_deck_i18n.mjs tests/test_frontend_kenney.mjs
1 passed, 1 failed
```

The i18n suite failed because the accessibility catalog still exposed the
retired fourth key; the restored Kenney coverage passed against active code.

Review GREEN (supersedes the earlier JS matrix result):

```text
node --test tests/*.mjs
222 passed, 0 failed
```

The real-browser locale test was run with loopback/Chromium permissions and
passed as part of the full matrix.

```text
python3 -m pytest -q tests/test_legacy_map_retirement.py \
  tests/test_docker_release_integrity.py tests/test_command_deck_hook_smoke.py
17 passed, 1 skipped
```

```text
bash -n run.sh
exit 0

git diff --check
exit 0
```

Repository search found no remaining `appleDogDoor`, retired AppleDog door
wiring, `.agent-speech.show`, `nextWalkFrame`, or `world_motion` references in
the corrected active/catalog/fixture test surface.

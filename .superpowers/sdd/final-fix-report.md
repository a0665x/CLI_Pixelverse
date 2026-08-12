# Final review fix wave

Date: 2026-08-13
Base HEAD: `5290396`
Branch: `main` (user-approved)

## Outcome

- Prefab instances remain atomic from placement until explicit Dissolve. A member click expands to the full instance; marquee can combine full instances and ordinary items. Move/drag, shared-anchor resize and rotation, layer movement, z-order, duplicate, and return-to-shelf mutate the whole instance. Mutations preserve authored geometry and metadata, validate as one candidate, and remain undo/save/load safe.
- Duplicate allocates fresh, collision-free item IDs and exactly one fresh prefab instance ID, including deterministic same-timestamp collisions.
- Group validation rejects newly introduced room, overlap, aisle, or Hook reachability issues, including a selected blocker that strands an unselected Hook. Group fitting applies one shared delta.
- Dissolve is the only grouping removal operation; after Dissolve, individual selection and removal resume.
- WorldScene propagates a locale selected before scene creation to both overlays and forwards later changes. Cutaway/status operational UI now uses typed semantic messages for `zh-TW`, `en-US`, `ja-JP`, and `ko-KR`; placeholder-bearing IDs require their parameter object at compile time. The English operational catalog serializes without CJK.
- Docker build fingerprints include `.dockerignore` and `global_map`. Provisioned PNG validation now walks the complete chunk stream, validates every CRC and the IEND/trailing-data structure, and rejects corruption after IHDR before trusting or extracting an asset.
- The pre-existing persisted-Tailscale versus explicit-localhost behavior was kept outside this fix wave, as requested.

## RED evidence

The regressions were established before implementation:

- Group lifecycle: `npm test -- --run tests/interiorSelection.test.ts` — 13 tests, **6 failed / 7 passed**. Missing group expansion, atomic move/rotate/resize/duplicate, and whole-instance removal were directly observed.
- Locale runtime: `npm test -- --run tests/worldSceneLocale.test.ts tests/statusOverlayErrors.test.ts tests/villageLocale.test.ts` — 3 files failed, **11 failed / 17 passed**. StatusOverlay did not receive the scene locale and operational/error strings remained Traditional Chinese.
- Minor hardening: `pytest -q tests/test_docker_release_integrity.py tests/test_modern_office_asset_provisioning.py` — **6 failed / 13 passed / 1 skipped**. Fingerprints ignored the new inputs and a PNG corrupted after IHDR was accepted.
- Review regressions: current tests initially produced **3 failed / 14 passed** for layer z preservation, atomic layer-boundary rejection, and duplicate ID collision. A targeted unselected-Hook stranding test failed **1/1**. `tsc --noEmit` reported two unused `@ts-expect-error` directives, proving the message API still accepted missing/extraneous params.

## GREEN evidence

Focused iteration:

- Group/runtime/locale/persistence suite: 6 files, **122/122 passed** before the final layer-feedback follow-up.
- Latest group/editor/locale follow-up: 3 files, **72/72 passed**.
- Minor Docker/PNG suite: **19 passed / 1 skipped**; the skip is the conditional built-image inspection that requires `PIXELVERSE_TEST_IMAGE`.
- TypeScript focused gate: `tsc --noEmit` passed.
- `git diff --check` passed.

Fresh full verification after all source changes:

| Gate | Result |
| --- | --- |
| `node --test tests/*.mjs` | **134 passed / 0 failed** |
| `python3 -m pytest -q` | **109 passed / 1 skipped / 0 failed** |
| `npm run typecheck` in `pixelworld_mvp` | **passed** |
| `npm test` in `pixelworld_mvp` | **53 files, 423/423 passed** |
| `npm run build` in `pixelworld_mvp` | **passed**, 56 modules transformed |
| `PIXELVERSE_TEST_IMAGE=cli-pixelverse:local python3 -m pytest -q tests/test_docker_release_integrity.py` | **9/9 passed**, including built-image inspection |

The Vite build retained its informational warning that the main minified chunk is larger than 500 kB; this is not a test or build failure and is unrelated to this wave.

Post-commit deployment verification:

- Implementation commit `807fe13` was built into `cli-pixelverse:local`; the image revision label is `807fe13045906f705b2bdc2d60467b10b0d35572`.
- The rebuilt container is serving on localhost port 5661. `/health`, `/openapi.json`, and `/api/world` all responded successfully.
- Health still reports the pre-existing persisted Tailscale mode as active while exposing localhost 5661 as an available option. Per scope, this behavior was documented and not changed.
- `codegraph sync .` completed successfully and reported the index already up to date.

## Coverage added

- Click/member and marquee group expansion.
- Shared snapped move, fit/reject, stable-anchor rotation, visual offset/facing/interaction-point rotation, uniform group scale, mixed-scale rejection, layer boundary/z preservation, z-order preservation.
- Whole-group duplicate with metadata/relative geometry and fresh/collision-safe identities; whole-group shelf return; Dissolve then single-item behavior.
- Runtime handler integration across move/resize/rotate/layer/z/duplicate/return/Dissolve and Undo.
- Save/load round-trip preserving prefab instance IDs and authored points, anchors, visual offsets, scale, rotation, layer, and z-index.
- Locale set before and after scene creation; localized status success/error/selection/storage flows in all four locales; English no-CJK serialization.
- Fingerprint changes for `.dockerignore`, `global_map/default.yaml`, and `global_map/default.png`.
- Existing-file repair and archive rejection for PNG corruption after IHDR.

## Review

An independent current-diff review completed after the follow-up fixes and reported no remaining Critical, Important, or Minor findings in the requested paths. Its findings drove the Hook baseline/candidate validation, ID collision allocation, atomic layer boundary behavior, z preservation, typed locale params, and truthful layer-rejection status.

## Commit scope

Only the following implementation/test paths and this report are intended for the fix-wave commit; all unrelated dirty and untracked user files are preserved:

- `pixelworld_mvp/src/i18n/villageLocale.ts`
- `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- `pixelworld_mvp/src/rendering/interiorSelection.ts`
- `pixelworld_mvp/src/scenes/WorldScene.ts`
- `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- `pixelworld_mvp/tests/interiorLayoutEditor.test.ts`
- `pixelworld_mvp/tests/interiorSelection.test.ts`
- `pixelworld_mvp/tests/statusOverlayErrors.test.ts`
- `pixelworld_mvp/tests/villageLocale.test.ts`
- `pixelworld_mvp/tests/worldSceneLocale.test.ts`
- `scripts/docker_build_metadata.py`
- `scripts/provision_modern_office_assets.py`
- `tests/test_docker_release_integrity.py`
- `tests/test_modern_office_asset_provisioning.py`
- `.superpowers/sdd/final-fix-report.md`

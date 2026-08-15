# Task 4 — Game Editor Scale and Orientation Report

## Status

Implemented. Modern Office furniture now derives a conservative authored transform from trimmed alpha bounds and catalog metadata, built-in/new catalog placements use that transform, user-authored v5 transforms remain authoritative, and rotation is exposed only for assets with meaningful supported orientations.

## Production changes

- Added `interiorFurnitureScale.ts` with the five requested size families, catalog-derived `authoredPlacement`, built-in normalization, and supported-rotation metadata.
- Classified chair variants from their known directional range, semantic rest assets as sofa/bed, large-footprint/long-alpha assets as assemblies, catalog surface assets as small surfaces, and the remainder as desk/cabinet.
- Used source-authored `0°` for the local Modern Office singles. Directional chairs are separate baked source files rather than arbitrary rotations of one sprite.
- Limited meaningful quarter turns to flat catalog floor/table-surface assets. Known single-orientation furniture and unknown assets expose only their source orientation.
- Normalized compact authored rooms and immutable office prefabs through the shared family defaults. New palette/catalog placements and drag previews begin at the same authored scale and rotation.
- Kept manual resizing at the existing 75–300% range.
- Hid Rotate from the contextual action set when every selected dependency cannot meaningfully rotate, and rejected unsupported direct/model rotation without mutation.
- Preserved Save as the persistence boundary, existing immutable Undo snapshots, stacking/support relationships, grouping, semantic fields, interaction points, offsets, and z/layer data.

## Scale/readability decision

Family targets are computed from trimmed opaque long edges (18/22/26/30/36 source pixels), then resolved to the editor's discrete scale steps. Authored defaults are constrained to 75–100%: oversized 43 px partition art is reduced to 75%, while ordinary 16–31 px furniture stays at 100% instead of inheriting the old arbitrary 125–200% prefab enlargement.

A controlled 125% experiment made the 16 px bench desks more prominent, but the enlarged blocking alpha covered reviewed interaction anchors and failed 23 room/persistence tests with `unreachable-interaction-anchor`. The geometry-safe defaults therefore remain at or below source size. Automated coverage verifies representative families project to readable 22–39 px opaque long edges at the editor's 1.5× viewport scale. Task 6 browser QA should still visually confirm these bands at desktop and compact viewports.

## Persistence and migration

- Explicit saved v5 scale/rotation are normalized only to the existing valid enums and round-trip unchanged, including a 300%/270° source-only chair.
- Legacy authored IDs continue through the production authored-fallback migration, so known oversized built-in defaults receive the new family transform.
- Custom furniture without an explicit transform marker keeps the historical 100%/0° default; family migration is not inferred for arbitrary user items.
- Storage is not rewritten until Save.

## TDD evidence

- Initial RED: 4 failed / 1 passed across the first focused set (three suites could not resolve the new module; source-only menu still exposed Rotate).
- Persistence RED: saving custom asset 207 without a marker incorrectly inferred 75%; after limiting generic normalization, `interiorLayoutEditor.test.ts` passed 53/53.
- Controlled-readability RED/GREEN: 125% desk normalization passed its unit expectation but failed reviewed room geometry; the final 1.5× projected-readability invariant and geometry-safe defaults passed 122/122 across scale, prefabs, definitions, room validation, and persistence.
- Final focused verification before report: 10 files, 262/262 tests passed.
- Final typecheck: `tsc --noEmit` passed.
- Final full Pixelworld verification before report: 66 files, 661/661 tests passed.

## Self-review

- `git diff --check` passed.
- Confirmed selection entry points expand prefab/support dependency closures before contextual rotation; the runtime guard also checks every selected item.
- Confirmed private purchased assets remain ignored and unstaged.
- The repository is on `main`, so the `review` skill correctly had no base-branch PR diff to inspect. A task-scoped source/test diff review was performed instead.
- No dashboard files were changed.

## Brief path reconciliation

`pixelworld_mvp/src/rendering/modernOfficeRoomBuilder.ts` and `pixelworld_mvp/tests/modernOfficeRoomBuilder.test.ts` do not exist at this revision. The production owners are `world/interiorDefinitions.ts`, `builtInOfficePrefabs.ts`, `prefabGeometry.ts`, and the corresponding definition/room-validation tests; no placeholder files were created. `rendering/interiorDefinitions.ts` likewise resolves to `world/interiorDefinitions.ts`. Existing `modernOfficeCatalog.ts` already owns the generated opaque bounds, footprint, semantic, role, and directional metadata consumed by the new module, so it required no generated-data rewrite.

## Remaining concern

Task 6 browser QA should verify perceived furniture readability and contextual-menu layout at the real 1.5× editor viewport on desktop and compact screens. This task did not add or commit any purchased asset files.

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

## Review fix — whole-catalog family normalization

This appendix supersedes the earlier 75–100% authored-default constraint. Review found that the global `<= 1` cap made tiny catalog art unreadable and left materially different sprites in the same family.

### Root cause and correction

- Root cause: family selection treated nearly every catalog `surface` role as `surface-small`, while `scaleFor` prohibited every asset from growing. Asset 119 therefore rendered with a 10 px authored long edge while full-height beverage station 173 rendered at 22.5 px in the same family.
- Classification now uses trimmed alpha size, footprint area, role, semantic metadata, and authoritative full-height catalog labels. Multi-cell floor constructions are assemblies; small one-cell art is surface-small; named desks/cabinets/bookcases/shelves/storage/credenzas/stations remain desk-cabinet.
- Asset 119 remains `surface-small` and resolves to 1.75×, producing a 17.5 px authored long edge. Asset 173 is `desk-cabinet` and remains 0.75×, producing 22.5 px; they no longer distort one family distribution.
- Catalog floor/surface roles may use the existing discrete 75–300% steps to approach their family target because they are nonblocking. Chair variants have a bounded 125% cap. Other desk/chair/sofa/assembly assets remain capped at 100% so reviewed interaction geometry stays authoritative.
- The known prefab bench desk 247 stays at 100%: the earlier 125% experiment reproducibly blocked interaction anchors. At the 1.5× editor viewport it projects to a readable 24 px long edge.

### Whole-catalog invariant

All 339 catalog entries are now checked from their trimmed opaque dimensions after authored scale and 1.5× viewport projection. Every family must remain inside its readable band and maximum spread:

- surface-small: 22–31 px, spread <= 1.4;
- chair: 30–38 px, spread <= 1.3;
- desk-cabinet: 24–42 px, spread <= 1.75;
- sofa-bed: 34–35 px, spread <= 1.05;
- assembly: 34–62 px, spread <= 1.8.

The test also proves that every `> 1×` authored default belongs to a geometry-safe floor/surface role or the bounded chair variant family.

### TDD and final verification

- RED: `interiorFurnitureScale.test.ts` ran 6 tests with 3 failed / 3 passed. Failures were `surface-small:minimum` at 15 px instead of >=22 px, asset 119 at 1× instead of 1.75×, and zero catalog assets eligible for safe enlargement.
- GREEN: the scale suite passed 6/6; the catalog/built-in/definitions/room-validation/layout set passed 122/122.
- Fresh requested focused run: 6 files, 128/128 passed.
- Fresh typecheck: `tsc --noEmit` passed.
- Fresh full Pixelworld run: 66 files, 664/664 passed.
- Existing room validation confirms `officeLayoutIssues=[]` and reachable interaction paths for all three work rooms. Existing prefab validation confirms support relationships, visual offsets, canonical authored transforms, and surface z-order.
- Purchased Modern Office files remained ignored, read-only inputs and were not staged.

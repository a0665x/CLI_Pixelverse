# Task 6 report: cohesive Puny village renderer

## Implemented

- Added a curated, source-pixel-aligned Puny World atlas map for grass, dirt,
  water edges, tree clusters, flowers, rocks, fences, work accents, signs,
  three house palettes, doors, and door frames.
- Added `VillageRenderer` and a pure render-plan builder. The visible roads and
  plaza expand directly from `WorldDefinition.terrain`; there are no scene-local
  path rectangles.
- Replaced all procedural building rectangles and generated terrain/scenery
  textures in `WorldScene` with Puny atlas images.
- Composed three distinct south-facing building compounds from native 16x16
  roof-corner, roof-fill, eave, wall, door, door-frame, and signboard cells.
  Every logical building tile is covered at the same pixel density as terrain
  and Agents; the renderer contains no per-building scale or offset tricks.
- Split static walls, facades, doors, and thresholds below Agents from roof/eave
  and real door-frame foreground groups. Roofs, door frames, and six-cell tree
  canopies now return one composite foreground each with explicit bounds and a
  real baseline, so fading affects the complete visual rather than single tiles.
- Selected horizontal, vertical, endpoint, junction, and plaza road cells from
  actual terrain adjacency instead of drawing every road as `dirtCenter`.
- Recolored building badges, Agent chips, bubbles, and the test panel to the
  constrained green, ochre, brown, and cream Puny palette.
- Made the game root own the viewport and float the collapsed test panel over it.
  The fixed 640x352 camera now presents at crisp 2x scale in 1280x720 while the
  full map remains visible at 840x480.
- Removed unused Kenney and AppleDog image preloads. If the essential Puny sheet
  is missing, startup logs an explicit diagnostic and installs a visible fallback
  texture without invalid frame lookups.

## TDD evidence

### RED

Command:

`cd pixelworld_mvp && npm test -- villageRenderer.test.ts buildingForeground.test.ts depthOcclusion.test.ts`

Expected result observed against commit `9f7d6b0`:

- The senior-review renderer test initially exposed two unmatched test
  parentheses; after correcting those test typos, 4 of 5 renderer behaviors
  failed for uncovered/scaled buildings, per-tile foregrounds, and
  `dirtCenter`-only roads.
- Both building-geometry behaviors failed: the old roof was 64px high and the
  old door foreground was a synthetic 32x32 region rather than its real cell.
- Three asset-manifest behaviors failed because 16 unused props were still
  preloaded and no essential-Puny diagnostic fallback existed.
- Canvas ownership and both desktop-collapse behaviors failed under the old
  grid layout.

### GREEN

Command:

`cd pixelworld_mvp && npm test -- villageRenderer.test.ts buildingForeground.test.ts renderingContracts.test.ts gameConfig.test.ts panelExpansion.test.ts depthOcclusion.test.ts`

Result: PASS, 6 files and 26 tests.

## Final verification

| Command | Result |
| --- | --- |
| `cd pixelworld_mvp && npm test` | PASS, 24 files and 121 tests. |
| `cd pixelworld_mvp && npm run typecheck` | PASS, `tsc --noEmit`. |
| `cd pixelworld_mvp && npm run build` | PASS, 34 modules transformed. The existing Phaser chunk-size advisory is the only warning. |
| `cd pixelworld_mvp && git diff --check` | PASS. |

## Browser visual QA

Browser: gstack browse against a fresh local Vite server at
`http://127.0.0.1:5175/`.

- `/tmp/gba-task6-fix-1280.png`: the fixed village fills 1280x704 of the
  1280x720 viewport at exact 2x nearest-neighbor scale; all three native-cell
  compounds, roads, doors, pond, trees, Agent, and collapsed toggle are crisp.
- `/tmp/gba-task6-fix-840.png`: the complete 640x352 map and collapsed panel are
  visible in 840x480. `/tmp/gba-task6-fix-840-expanded.png` confirms the panel is
  usable as a floating overlay without changing or clipping the fixed camera.
- `/tmp/gba-task6-exit-door.png` and `/tmp/gba-task6-signal-exit.png` show real
  inter-building exits plus the debug route joining and following the public
  road through the destination threshold.
- `/tmp/gba-task6-plan-door.png`, `/tmp/gba-task6-cross-road.png`, and
  `/tmp/gba-task6-signal-road.png` show the corresponding hidden occupancy and
  badge transfer after door entry.
- After clearing browser buffers and reloading, every request returned HTTP 200;
  only the Puny atlas and three Ninja sheets loaded. No Kenney/AppleDog request
  occurred and `console --errors` reported no errors.

## Files changed

- `pixelworld_mvp/src/rendering/punyVillageAtlas.ts` (new)
- `pixelworld_mvp/src/rendering/VillageRenderer.ts` (new)
- `pixelworld_mvp/src/rendering/buildingForeground.ts`
- `pixelworld_mvp/src/rendering/DepthOcclusionSystem.ts`
- `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- `pixelworld_mvp/src/scenes/WorldScene.ts`
- `pixelworld_mvp/src/styles.css`
- `pixelworld_mvp/src/ui/TestPanel.ts`
- `pixelworld_mvp/src/rendering/assetManifest.ts`
- `pixelworld_mvp/tests/renderingContracts.test.ts`
- `pixelworld_mvp/tests/gameConfig.test.ts`
- `pixelworld_mvp/tests/panelExpansion.test.ts`
- `pixelworld_mvp/tests/villageRenderer.test.ts` (new)
- `pixelworld_mvp/tests/buildingForeground.test.ts`
- `pixelworld_mvp/tests/depthOcclusion.test.ts`

## Self-review

- The production renderer uses only the already-vendored Puny World and Ninja
  Adventure sheets. No generated, Pokémon-derived, or newly downloaded image was
  introduced.
- Every renderer command uses a native 16x16 source cell at a tile-aligned world
  coordinate. Scaling occurs only on the complete Phaser canvas; pixel art,
  antialias-off, and round-pixel settings remain enabled.
- Tests inspect real command families, exact cross-layer depths, native building
  coverage, rendered composite kinds/counts/bounds, and runtime fallback texture
  behavior. They no longer assert only a stage-name constant.
- Road positions have a single source of truth in `world.terrain`.
- Browser captures confirm door leg ordering and actual road travel, not just
  static rendering contracts.
- No Task 7 hook mapping, panel presence-readout, README, or acceptance-system
  changes were pulled into this task.

## Concerns

None blocking. The production build retains the pre-existing non-blocking Phaser
bundle-size advisory.

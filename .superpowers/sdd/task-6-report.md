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
- Composed three distinct south-facing building compounds from integer-scaled
  source frames. Each compound has a visible threshold, central door, door-frame
  foreground, and small facade signboard.
- Added real foreground entries for building roofs, door frames, and six-tile
  tree clusters. Agent depth remains foot-Y based. Hidden inside Agents now reset
  foreground fading instead of leaving the village translucent.
- Recolored building badges, Agent chips, bubbles, and the test panel to the
  constrained green, ochre, brown, and cream Puny palette.
- Preserved the fixed full-village camera and the collapsed responsive panel.

## TDD evidence

### RED

Command:

`cd pixelworld_mvp && npm test -- villageRenderer.test.ts buildingForeground.test.ts depthOcclusion.test.ts`

Expected result observed:

- `villageRenderer.test.ts` could not import the not-yet-created atlas/renderer.
- Both building-foreground tests failed because
  `buildingForegroundGeometry` did not exist.
- Hidden-inside depth test failed with foreground alpha `0.6` instead of `1`.
- Overall: 3 files failed; 3 failed and 6 passed tests.

### GREEN

Command:

`cd pixelworld_mvp && npm test -- villageRenderer.test.ts buildingForeground.test.ts depthOcclusion.test.ts`

Result: PASS, 3 files and 14 tests.

## Final verification

| Command | Result |
| --- | --- |
| `cd pixelworld_mvp && npm test` | PASS, 24 files and 118 tests. |
| `cd pixelworld_mvp && npm run typecheck` | PASS, `tsc --noEmit`. |
| `cd pixelworld_mvp && npm run build` | PASS, 34 modules transformed. The existing Phaser chunk-size advisory is the only warning. |
| `cd pixelworld_mvp && git diff --check` | PASS. |

## Browser visual QA

Browser: gstack browse against the local Vite server at
`http://127.0.0.1:5174/`.

- 1280x720 clean fixed view with the final tuned art:
  `/tmp/gba-village-1280-final.png`.
- 840x480 collapsed view: `/tmp/gba-village-840-tuned.png`. The full village,
  three doors, paths, pond, flowerbed, trees, Agent chip, and expand toggle are
  all visible.
- 840x480 expanded panel: `/tmp/gba-village-840-expanded.png`. The complete
  village remains in view while panel controls scroll below it.
- Building exit and road preference: `/tmp/gba-village-building-exit.png` shows
  the Agent restored at the Build Workshop door with the debug path crossing the
  threshold, stepping outside, then joining the east-west public road toward the
  Signal Station. `/tmp/gba-village-cross-road.png` shows the Agent physically
  following that road rather than taking a straight grass shortcut.
- Door arrival / hidden occupancy: `/tmp/gba-village-working-door-mid.png` and
  `/tmp/gba-village-signal-arrival.png` show the visible front-door transition
  followed by a building-level occupant/action badge with the individual Agent
  hidden.
- Asset network responses were HTTP 200. No application console errors occurred.
  Chromium emitted only its headless WebGL `ReadPixels` screenshot-performance
  warnings.

## Files changed

- `pixelworld_mvp/src/rendering/punyVillageAtlas.ts` (new)
- `pixelworld_mvp/src/rendering/VillageRenderer.ts` (new)
- `pixelworld_mvp/src/rendering/buildingForeground.ts`
- `pixelworld_mvp/src/rendering/DepthOcclusionSystem.ts`
- `pixelworld_mvp/src/rendering/StatusOverlaySystem.ts`
- `pixelworld_mvp/src/scenes/WorldScene.ts`
- `pixelworld_mvp/src/styles.css`
- `pixelworld_mvp/tests/villageRenderer.test.ts` (new)
- `pixelworld_mvp/tests/buildingForeground.test.ts`
- `pixelworld_mvp/tests/depthOcclusion.test.ts`

## Self-review

- The production renderer uses only the already-vendored Puny World and Ninja
  Adventure sheets. No generated, Pokémon-derived, or newly downloaded image was
  introduced.
- House frames use integer 4x scale and the door frame uses integer 2x scale;
  Phaser remains configured for pixel art, no antialiasing, and round pixels.
- Road positions have a single source of truth in `world.terrain`.
- Browser captures confirm door leg ordering and actual road travel, not just
  static rendering contracts.
- No Task 7 hook mapping, panel presence-readout, README, or acceptance-system
  changes were pulled into this task.

## Concerns

None blocking. The production build retains the pre-existing non-blocking Phaser
bundle-size advisory.

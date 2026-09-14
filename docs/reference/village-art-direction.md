# RPG village presentation

The village uses a daylight RPG palette: botanical greens, painted roofs, warm
wood and muted stone. Each of the twelve buildings has an independently authored
interior rather than sharing the same office layout.

## Implementation entry points

- `pixelworld_mvp/src/rendering/villageArtDirection.ts`: building palettes and
  deterministic ground variations.
- `pixelworld_mvp/src/world/villageInteriors.ts`: per-building furniture programs,
  supported activities, interaction points and table groups.
- `pixelworld_mvp/src/rendering/interiorRoomArt.ts`: native floor planks, stone,
  woven rugs, window trim and thresholds. This decoration adds no blockers.
- `pixelworld_mvp/src/rendering/villageFurnitureCatalog.ts`: bundled furniture
  dimensions and alpha runs, separate from the paid office catalog. Numeric IDs
  1001, 1002, 1004, 1006 and 1007 identify bed, bookcase, sofa, chair and table.
- `pixelworld_mvp/src/rendering/villageBed.ts`: the bed's canvas mattress and
  matching opaque-mask extension. The source frame is an existing bundled asset.
- `pixelworld_mvp/src/rendering/VillageAtmosphere.ts` and `AgentGroundEffects.ts`:
  ground shadows, bounded water accents and pooled footsteps.

The full-size office templates remain available to existing callers. Production
buildings resolve through `interiorDefinitionForBuilding`. Saved browser layouts
remain authoritative; changing defaults does not overwrite a user's arrangement.
Use the existing template preview/apply controls in the furniture editor, then
Save, to adopt the new arrangement. Apply is undoable before saving.

## Room program

| Building | Furnishing focus |
| --- | --- |
| Arrival Lodge | Reception, noticeboard, waiting seat and supplies |
| Thinker's Cottage | Planning table, reading station and quiet seat |
| Archive Library | Bookshelves, paired reading stations and reading nook |
| Network Lab | Two consoles, network board and lounge |
| Heartbeat Tower | Radio/dispatch stations and briefing table |
| Offline Dormitory | Two beds, waiting seat and storage |
| Maker Workshop | Drawing table, assembly station and terminal |
| Tool Smithy | Workbench, terminal, repair station and tool storage |
| Awaiting Post | Paired waiting sofas, post desk and drinks |
| Agent Guild | Shared table, dispatch station and scribe desk |
| Recovery Clinic | Paired repair stations and recovery seat |
| Rest Cabin | Sofa and tea table, armchair and sleeping nook |

## Movement and geometry contracts

Outdoor walking consumes its remaining distance across orthogonal corners;
turning no longer discards a frame's travel. Retargeting preserves both pixel
position and the current walk-animation clock. Interior ingress faces the next
path segment, including after a corner. Empty live rosters must keep rendering.

Furniture uses each asset's actual source dimensions for image origins and alpha
masks. Existing office assets retain the 32×48 default; bundled village sprites
provide explicit dimensions. Keep the image, opaque bounds and mask in sync when
changing a furniture source. Ground decoration and footsteps never alter paths.
Reduced motion suppresses footsteps, freezes water accents, removes interior
idle bobbing and makes the roof reveal immediate; essential route movement stays.

## Validation

- `npm --prefix pixelworld_mvp run build`
- `npm --prefix pixelworld_mvp test -- --maxWorkers=2`
- `tests/villageInteriors.test.ts`: every room's placement and activity access,
  unique arrangements, saved-layout preservation and source mask dimensions.
- `tests/pathFollower.test.ts`, `tests/interiorMotion.test.ts` and
  `tests/worldSceneLiveRoster.test.ts`: corner travel, ingress facing and empty
  village rendering.

Use real browser acceptance for the final room appearance and event-driven
movement; unit tests do not prove the final rendered image. No new third-party
art download is required. Existing asset licenses remain applicable.

Previous room redesign verification: production build passed; 770 Phaser tests passed;
38 scoped Python contracts passed with one release-image check skipped because
`PIXELVERSE_TEST_IMAGE` was unset. Chromium opened all twelve rooms, recorded
agent displacement, and checked 390×844 and 1440×900 viewports plus reduced
motion with zero page or console errors. Machine-readable local evidence is
`tmp/rpg-browser-evidence.json`; these preview artifacts are not tracked.

## Organic village and river layout

Houses now have staggered setbacks across smaller clearings. Authored orthogonal
footpaths connect small door yards to the village square and three crossings;
the previous full-width streets and parallel north–south grid are removed.
Station slots follow the building entrance using local offsets. Keep all houses
reachable through road/plaza cells when changing their placement.

`worldDefinition.ts` supplies continuous river rows, including water under each
bridge. Those same rectangles are navigation obstacles; only bridge cells reopen
as walkable crossings. `rendering/riverArt.ts` supplies native pixel water with
neighbor-derived banks and left/middle/right timber deck textures. Water accents
render below the deck. Do not carve grass gaps into river data for bridges or
reuse the decorative Puny pool tiles as flowing water.

`tests/organicRiver.test.ts` checks continuous water, submerged bridge footprints,
land approaches on both ends, rendering depth, and collision for every river
cell. `tests/worldDefinition.test.ts` checks the entire path network is connected
and all house doors join it. Existing ordered-building-pair travel tests remain.

Organic-layout verification: production build and 773 tests passed. After
normalizing station definitions to entrance-relative offsets, all 29 affected
navigation, topology and river tests passed again. Chromium verified all twelve
rooms, agent displacement, desktop/mobile and reduced motion with no page or
console errors.

## Continuous footpaths

The path network omits ornamental door yards, redundant eastern loops and dead
ends that do not serve a doorway. Navigation retains connected orthogonal cells.
`rendering/villagePaths.ts` traces the road graph into continuous trails, rounds
bends across multiple cells, and paints muted earth with sparse world-positioned
grain. A single generated texture supplies native frames, including neighboring
transparent frames so curves cannot be clipped by tile borders. Door thresholds
join the painted network. Keep bridge alignment and the existing water blockers.
The road topology test now rejects dead ends without a house entrance.

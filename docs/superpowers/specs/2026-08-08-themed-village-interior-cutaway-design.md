# Themed Village and Interior Cutaway Design

Date: 2026-08-08
Status: approved direction, pending written-spec confirmation

## Goal

Replace the current rows of repeated house cells with a believable, dispersed
GBA-style village. Each house is a small, unique exterior tied to a coherent
group of Agent hooks. Clicking a house centers and enlarges it, fades/removes the
roof, and reveals a live pixel-art interior cutaway where every inside Agent is
visibly using activity-specific furniture.

The fixed global village camera remains the primary monitoring view. Interior
cutaways are an optional second layer opened by the user, never an automatic
camera transition.

## Problems Being Corrected

- The current renderer fills large building bounds with repeated roof and wall
  cells, making each “building” resemble many small houses glued together.
- All buildings sit in one northern row instead of reading as a village.
- Entering a building only hides the Agent and shows a badge; there is no way to
  inspect the room, furniture, Agent position, or work behavior.
- The landscape lacks a river, bridges, pasture life, and ambient animals.
- Hook destinations are technically different stations but are not expressed as
  strongly themed places with recognizable furniture and activity icons.

## Chosen Experience

### Global village

- Keep a fixed 40×22 tile camera and integer nearest-neighbor scaling.
- Use four small houses distributed around the map instead of one northern row.
- Separate houses with water, trees, fields, pasture fencing, road branches, and
  a central public square.
- Use a winding north-south river with two visible bridges. River tiles are
  blocked; bridge tiles are walkable road overrides. Cross-river Agent trips
  visibly use a bridge.
- Every house has one explicit front door threshold and one public-road outside
  tile. Building-to-building travel still exits the old door, joins a road,
  crosses a bridge when required, and enters the destination door.
- Occupied houses show a compact count/action badge. Outdoor Agents retain their
  chips and speech bubbles.

### Four themed houses

The house count is intentionally limited to four. Related hooks share a theme;
unrelated outdoor states remain in open zones.

1. **Rest Cabin**
   - Hooks: `idle`, `offline`.
   - Exterior: warm timber cottage, porch, chimney, flower pots.
   - Interior: sofa, television, coffee table, rug, floor lamp, small bed, plants.
   - `idle`: Agent sits on the sofa; the television flickers and a rest icon
     pulses near the sofa.
   - `offline`: Agent sleeps/rests near the bed; lights dim and the offline icon
     appears above the bed.

2. **Research Library**
   - Hooks: `think`, `plan`, `read`, `web`/MCP.
   - Exterior: blue-roof research cottage with notice board and telescope/sign.
   - Interior: two bookcase walls, computer desks, map table, planning board,
     reading chairs, filing cabinet, plants.
   - `think`: Agent alternates between the planning board and map table.
   - `plan`: Agent faces the planning board with checklist/map icons.
   - `read`: Agent sits at a reading desk with a book icon.
   - `web`: Agent alternates between a computer desk and bookcase, with search,
     network, or MCP icons indicating active lookup rather than idle wandering.

3. **Maker Workshop**
   - Hooks: `edit`, `tool`, `self_heal`.
   - Exterior: red/brown workshop with side shed, crates, tools, and vent/chimney.
   - Interior: code terminals, central workbench, tool wall, parts shelves,
     repair table, crates and cable/gear details.
   - `edit`: Agent sits at a code terminal with edit/code icons.
   - `tool`: Agent alternates between the workbench and tool wall with the active
     tool icon.
   - `self_heal`: Agent uses the repair table with a repair/health icon.

4. **Collaboration Barn**
   - Hooks: `clone`, `respond`.
   - Exterior: green-roof barn/office with antenna, delivery board, and side pen.
   - Interior: dispatch pods, radio console, response desk, meeting table,
     message board, spare chairs and storage.
   - `clone`: source Agent uses a dispatch pod; a new Subagent still emerges
     visibly from the exterior front door after the clone operation completes.
   - `respond`: Agent uses the radio/response desk with message/transmit icons.

### Outdoor hook zones

- `session_start`: central arrival square.
- `await`: benches/queue markers at the public square.
- `blocked`: visible repair apron outside the workshop.
- `heartbeat` and unknown events: preserve the current location.

## Interior Cutaway Interaction

1. Every house is clickable, whether occupied or empty.
2. Clicking a house dims—but does not move—the village background.
3. A copy of the selected house moves to the center and scales up using integer
   pixel scaling.
4. After a short 180–240 ms anticipation, the roof slides/fades away and the
   themed interior floor plan is revealed inside the enlarged exterior shell.
5. All Agents whose `presence.buildingId` matches the house appear at their
   assigned furniture stations. Multiple Agents use separate compatible slots.
6. Furniture icons pulse only around the active work station; decorative props
   remain quiet so the action is readable at a glance.
7. Activity changes update the open interior live without closing the cutaway.
8. A close button, Escape, or clicking the dimmed backdrop returns to the same
   unchanged global camera and selected Agent.
9. At viewport widths of 940 px and above, the cutaway is 480×288 internal
   pixels (960×576 at the normal 2× canvas presentation), centered with a visible
   village border. Below 940 px it is 608×320 internal pixels with a 16 px
   internal margin, and the close control and house title remain visible.
10. Empty houses still show their themed layout with an “empty” status; opening
    an empty house never manufactures an Agent.

## Architecture

### World data

Extend the data model instead of hard-coding visual decisions in `WorldScene`:

```ts
interface BuildingTheme {
  exterior: ExteriorHouseDefinition
  interior: InteriorDefinition
  supportedHooks: WorldEventKind[]
}

interface InteriorDefinition {
  width: number
  height: number
  floor: InteriorTileDefinition[]
  walls: InteriorTileDefinition[]
  furniture: FurnitureDefinition[]
}

interface FurnitureDefinition {
  id: string
  kind: FurnitureKind
  point: GridPoint
  facing: Facing
  supportedActions: AgentAction[]
  icon: ActivityIconKind
}

interface AmbientAnimalDefinition {
  id: string
  species: 'cow' | 'sheep' | 'chicken' | 'pig'
  patrolBounds: GridRect
  start: GridPoint
  speed: number
}
```

`WorldBuilding` receives a `themeId`. `WorldScenery` receives river/bridge
definitions, pasture/crop regions, and ambient animals. Terrain and obstacle
validation ensures no house, animal pen, tree, or water cell blocks a door or
public route.

### Exterior rendering

- `VillageRenderer` renders one small house composition per building from named
  exterior templates. It never fills a large rectangle with a repeated complete
  facade pattern.
- Every template has a distinct silhouette, palette, prop cluster, and roof
  fingerprint. Houses use 4–6 tile widths and at least four clear tiles between
  footprints.
- `VillageRenderer` returns clickable building hit regions in addition to
  foregrounds.
- River, bridges, field edges, pasture fence, crops, and animal props are driven
  by `WorldDefinition`, not scene-local rectangles.

### Interior overlay

Add `InteriorCutawaySystem`, owned by `WorldScene`, with a narrow public API:

```ts
open(buildingId: string): void
close(): void
update(agents: AgentController[]): void
destroy(): void
isOpen(): boolean
```

The system renders a Phaser overlay container in the existing canvas. It owns
the backdrop, transition, enlarged house shell, floor/walls, furniture, activity
icons, interior Agent sprites, title/status, and close control. It consumes
read-only presence/current action data and never changes routing, station
allocation, or the world camera.

Interior Agent sprites mirror the real Agent identity and action. They are
visual projections, not second controllers; closing the cutaway cannot change
world presence or create duplicate Agents.

### Ambient animals

Add `AmbientAnimalSystem`. Animals follow short deterministic patrol loops or
graze idly inside declared pasture/riverbank rectangles. They use foot-Y depth
and never enter `NavigationGrid`, reserve stations, or trigger collision/path
replanning. This keeps them visually alive without interfering with hook
behavior.

## Hook and Furniture Data Flow

1. Hook/demo event enters `EventIngress` and `behaviorRouter`.
2. Route resolves to a themed station and building door.
3. `AgentController` physically exits/enters through mandatory waypoints.
4. Arrival commits `AgentPresence` and building occupancy.
5. If the cutaway for that building is open, `InteriorCutawaySystem.update`
   projects the Agent onto the furniture slot associated with the current action.
6. Furniture icon and micro-animation are selected from data, not from Agent ID.
7. Clone arrival remains idempotent; the new Subagent appears at the exterior
   Collaboration Barn door while the open interior updates its remaining
   occupants.

## Asset and Palette Policy

- Keep Puny World for the base outdoor terrain and Ninja Adventure for Agents.
- Add only original-source CC0 assets:
  - Kenney Tiny Farm, official page: `https://kenney.nl/assets/tiny-farm`,
    CC0, 16×16, for cow, sheep, chicken, pig, crop, and farm-detail cells.
  - Kenney Roguelike/RPG Pack, official page:
    `https://kenney.nl/assets/roguelike-rpg-pack`, CC0, 16×16, for curated
    sofa/bed/bookshelf/table/chair/plant/workbench/decor cells.
  - Kenney Roguelike Modern City, official page:
    `https://kenney.nl/assets/roguelike-modern-city`, CC0, for curated
    television/computer/monitor/radio/console/tool/icon cells.
- Select only required files/cells. Apply a documented nearest-color palette
  remap to the existing Puny green/ochre/brown/cream palette when a source cell
  is visually inconsistent. Never smooth or resample.
- Record canonical pages, direct downloads, license text, retrieval date,
  selected cells, and palette transforms in `public/assets/ASSET_SOURCES.md`.
- Do not use Pokémon/Nintendo rips, fan-game-only resources, AI-prohibited packs,
  or non-commercial assets.

## Error Handling and Lifecycle

- Missing optional animal/furniture frames fall back to a visible diagnostic
  placeholder and log the missing key; routing and Agent state continue.
- If an open house becomes invalid during scene teardown/reset, close and destroy
  the overlay safely.
- Unknown actions use a neutral standing slot and generic activity icon.
- When compatible furniture slots are full, extra occupants use deterministic
  overflow standing spots rather than overlapping.
- Overlay transitions are idempotent: repeated clicks on the same house do not
  duplicate objects or timers.

## Testing and Acceptance

### Automated

- Every building footprint is unique, 4–6 tiles wide, separated from other
  houses, has one visible door, and connects to a road.
- All hook mappings resolve to the approved house or outdoor zone.
- Every interior action maps to compatible furniture and an icon.
- Multiple occupants receive stable non-overlapping furniture/overflow slots.
- Clicking/opening/closing the cutaway preserves camera, presence, assignments,
  and Agent count.
- Live activity changes update furniture placement without rebuilding the world.
- River cells are blocked, bridge cells are walkable, and cross-river routes use
  a bridge without cutting through water or houses.
- Ambient animals remain inside patrol bounds and cannot affect A*, capacity, or
  station allocation.
- Clone callbacks remain idempotent and Subagents emerge at the Collaboration
  Barn outside tile.

### Browser acceptance

- At 1280×720 and 840×480, the complete village reads as four separated houses,
  a central square, river/bridges, pasture, crops, trees, and roaming animals.
- Click each house empty and occupied; verify centered enlargement, roof reveal,
  close paths, themed layout, and responsive sizing.
- Demonstrate at least these live interiors: idle Agent seated at sofa/TV; web
  Agent alternating computer/bookcase; edit Agent at terminal; tool Agent at
  workbench/tool wall; clone source at dispatch pod plus visible new Subagent at
  the exterior door.
- Keep three or more Agents in different houses and verify badges, cutaway
  occupants, outdoor bubbles, and unchanged fixed camera.
- Finish with all assets HTTP 200 and no application console errors.

## Scope Boundary

This phase implements visual, live interior cutaways, not explorable interior
navigation. Agents do not walk freely inside rooms; their interior projection
moves between event-specific furniture anchors. A later phase may add interior
pathfinding without changing house IDs, presence, hook routing, or the cutaway
data model.

# Layered Interior Prefab Editor Design

**Date:** 2026-08-09
**Status:** Approved design, pending implementation plan

## Goal

Turn the cutaway editor into a fine-grid, layered DIY room composer. Players can overlap Modern Office fragments, save a selected arrangement as a reusable prefab, clear and rebuild rooms, copy decorative layouts between houses, and always see which house-specific Hook furniture is still required. Improve the village farm population and replace the current wall-tile river crossings with believable bridge components.

## Scope

This phase includes:

- quarter-cell furniture positioning;
- unrestricted visual overlap with explicit render layers;
- marquee selection and reusable prefab creation;
- persistent per-room layouts, global prefabs, and a cross-room clipboard;
- one-click room collection/reset;
- required Hook furniture inventory and completeness feedback;
- cross-house decorative layout copy/paste;
- navigation projection that ignores non-blocking decoration layers;
- additional farm animals;
- proper bridge deck rendering over river water.

The room remains a rectangular 14×9 logical navigation space. “DIY the whole room” means composing its complete visible floor, furniture, work areas, and decoration from layered assets. Arbitrary polygonal walls, resizing the navigation boundary, doors in new positions, and structural room construction are outside this phase because they would invalidate the authored Agent entrances and work routes.

## Interaction Model

### Fine grid

One 22px logical room cell is divided into a 4×4 editor grid. `EDITOR_CELL` becomes 5.5 internal canvas pixels. Stored positions use quarter-cell increments (`0`, `0.25`, `0.5`, `0.75`). Rendering may use fractional coordinates; sprite textures retain nearest-neighbour filtering.

The editor still rejects placements whose complete visual footprint leaves the room or blocks the fixed door clearance. Furniture-to-furniture overlap is no longer a placement error.

### Exact alpha occupancy

Furniture occupancy must use the smallest axis-aligned rectangle containing the asset’s non-transparent pixels, not a rounded 16px tile footprint. The existing catalog `opaqueBounds` is the source rectangle. Runtime bounds apply the instance’s corrected visual origin, scale, and rotation, then compute the smallest transformed room-space rectangle.

The same exact rectangle drives placement preview, room bounds, door clearance, marquee intersection, selection outline, group bounds, and navigation projection. Grid snapping affects the furniture anchor only; it must not inflate the occupied rectangle to whole editor cells. The preview is therefore a precise rectangular outline/fill around visible pixels rather than a collection of overestimated occupied squares.

### Layers and stacking

Every furniture instance stores:

- `layer`: `floor | furniture | surface | wall`;
- `zIndex`: integer order within its layer;
- `blocksNavigation`: whether Agents route around it;
- existing position, rotation, scale, asset ID, Hook actions, and footprint.

Default render order is floor, furniture, surface, wall. Within one layer, lower `zIndex` renders first. The inspector exposes “置底”, “下移”, “上移”, and “置頂” for order within one layer, plus “上一圖層” and “下一圖層” to move between `floor`, `furniture`, `surface`, and `wall`. Visual overlap is allowed between any items, including items in the same layer.

Catalog defaults are derived from curated asset ranges:

- flat architectural fragments and rugs → `floor`, non-blocking;
- chairs, sofas, desks, cabinets, workstations → `furniture`, blocking;
- electronics, desk objects, plants, small props → `surface`, non-blocking;
- boards, dividers, wall-mounted screens → `wall`, non-blocking unless explicitly marked.

The inspector lets the user override layer and navigation blocking for ordinary furniture. Hook furniture remains navigation-blocking unless its authored definition says otherwise.

### Selection and prefabs

While editing, dragging from an empty point creates a rectangular marquee. Items whose visible alpha bounds intersect the marquee become selected. Shift-click adds or removes one item from the selection.

A multi-selection toolbar provides:

- move the selection as one unit;
- create prefab;
- delete/return selected items;
- align and layer-order controls only where they have deterministic meaning.

Creating a prefab opens a compact DOM prompt with a generated editable name such as `組裝件 01`. The saved prefab contains deep-cloned item templates and positions relative to the selection’s top-left visual bound. Hook identity and supported actions are stripped from prefab templates so a prefab cannot duplicate a unique Hook station.

Prefabs persist globally in localStorage and appear in the bottom `組裝件` category. Dropping a prefab creates fresh furniture IDs, preserves relative spacing, rotation, scale, layers, and z-order, and validates only room bounds and door clearance. A prefab remains available after clearing a room or restarting the app.

## Room Inventory and Required Hooks

### Required Hook shelf

The leftmost palette section is `本屋必備`. It is built from the room’s authored furniture whose `supportedActions` is non-empty. Each required Hook item has a stable requirement ID and exists at most once in the room.

The shelf shows:

- red `缺少` when the required item is not placed;
- green check when it is placed;
- the Hook action label (`WEB / MCP`, `工具調用`, `休息`, and so on);
- the furniture sprite and destination room theme.

Dragging a missing required item places that unique instance. Returning it removes it from the room and makes it available on the shelf again. Ordinary catalog and prefab items remain unlimited templates.

### Collect all

`全部收回` requires a confirmation click within the cutaway panel and then removes all placed items from the current room. It does not delete global prefabs, catalog assets, the copied-room clipboard, or authored Hook requirements.

After collection, every required Hook item appears as missing in the left shelf. The empty draft is saved only when the user presses `儲存配置`, preserving the existing explicit-save contract.

`取消配置／還原` immediately discards every unsaved change in the active room and reloads the last explicitly saved v4 layout. This includes movement, overlap, resize, rotation, layer changes, z-order, collect-all, prefab drops, and paste operations. It does not alter global prefabs or the cross-room clipboard.

## Cross-Room Copy and Paste

`複製整屋格局` creates a persistent global clipboard containing all placed ordinary items and prefab-expanded pieces, normalized relative to the room origin. Hook items are omitted.

Copying closes the cutaway and returns to the fixed village view. Houses with compatible 14×9 interiors expose `貼上格局` when opened. Pasting replaces the target room’s ordinary draft furniture while preserving any already placed target Hook items. It creates new instance IDs and keeps source rotation, scale, layer, z-order, and relative position.

If any copied item would leave the room or overlap the door clearance, the complete paste is rejected and the previous target draft remains unchanged. No partial paste occurs.

After paste, the `本屋必備` shelf reports all target-room Hook requirements that remain missing. The clipboard survives reload until replaced by another copy or explicitly cleared.

## Navigation and Agent Work

Navigation collision is no longer derived from every furniture tile footprint. It is the union of the exact transformed alpha rectangles for `blocksNavigation` items projected conservatively onto the existing 22px logical navigation grid. Floor, surface, and wall decoration normally do not block.

Hook interaction targets retain their stable IDs and supported actions. Agent work routing continues to target the required Hook furniture placed in the room. Missing Hook furniture falls back to the authored overflow/work point and is visibly reported in the required shelf.

Agents and large blocking furniture may visually overlap only during motion transitions; A* does not route through blocking cells. Decorative objects may be drawn over or under Agents according to layer and depth without affecting movement.

## Persistence

The layout envelope becomes version 4:

```ts
interface SavedInteriorLayoutV4 {
  version: 4;
  furniture: FurnitureDefinition[];
}
```

Furniture gains layer, z-index, blocking, and requirement metadata. Version 2/3 layouts migrate by assigning semantic defaults from furniture kind and catalog category. Existing coordinates snap to the nearest quarter cell without changing their visible arrangement more than 2.75 internal pixels.

Global localStorage records:

- `pixelworld:interior-prefabs:v1` → reusable prefabs;
- `pixelworld:interior-clipboard:v1` → copied ordinary layout;
- existing building-specific keys → v4 room layouts.

Malformed prefabs, clipboard entries, unknown asset IDs, non-finite coordinates, and unsupported versions are ignored without overwriting valid saved data.

## UI Structure

The cutaway retains Phaser sprites and the crisp DOM control layer.

DOM controls add:

- `全部收回`;
- `取消配置／還原`;
- `複製格局` and conditional `貼上格局`;
- `建立組裝件` when multiple items are selected;
- layer and z-order controls;
- selected count and Hook completeness (`必備 3/5`).

The palette order is fixed:

1. `本屋必備` (always visible at the far left);
2. `組裝件`;
3. Modern Office categories;
4. page controls.

Marquee, selection outlines, fine grid, drag preview, and depth highlights are rendered in Phaser. Titles, buttons, diagnostics, prefab names, Hook labels, and Agent bubbles remain in the high-resolution DOM overlay.

## Farm Animals

The farm population expands to a visually readable mix of approximately ten animals: two cows, three sheep, two pigs, and three chickens, distributed across pasture areas. Each animal receives its own bounded patrol lane, deterministic pause timing, and correct sprite facing. Nearby animals use staggered lanes and starting offsets to avoid moving as one synchronized row.

Animal definitions remain declarative in `worldDefinition.ts`; `AmbientAnimalSystem` continues to own movement and depth ordering.

## Bridge Rendering

The renderer must stop using the house `brownWall` region for bridges. A curated bridge region set will use actual timber deck and edge components from the installed village-compatible tileset. Bridge commands render after water and before actors, cover only declared bridge bounds, align deck direction to the river crossing, and preserve visible water immediately upstream and downstream.

The navigation grid continues treating declared bridge cells as walkable road cells. Renderer tests assert bridge commands never use a wall, roof, or building-frame region.

## Error Handling and Atomicity

- Invalid drops return the dragged item to its source and display a persistent diagnostic.
- Marquee selection with zero intersecting items closes without changing selection.
- Prefab creation with fewer than two ordinary items is disabled.
- Hook items are excluded from prefabs and room clipboard copies.
- Clear and paste operations mutate only the draft until explicit save.
- Paste is atomic: all copied items fit or none are applied.
- Rotation, resize, group move, prefab drop, and paste preserve the previous draft on failure.
- Cancel/revert restores the last saved layout without requiring the cutaway to close.

## Testing

Model tests cover:

- quarter-cell snapping;
- exact transformed alpha occupancy without tile-size inflation;
- legal visual overlap and remaining room/door rejection;
- semantic layer defaults and navigation blocking projection;
- marquee intersection using visual alpha bounds;
- prefab relative coordinates, deep cloning, fresh IDs, persistence, and Hook stripping;
- collect-all behavior and required Hook shelf state;
- atomic copy/paste and target Hook preservation;
- v2/v3 to v4 migration;
- bridge region selection and absence of building-wall bridge frames;
- increased animal counts, bounded patrol, and sprite facing.

Cutaway integration tests cover DOM controls, palette ordering, selection state, prefab category, and clipboard actions. Browser QA covers drag overlap, rug-under-desk, prop-on-desk, marquee-to-prefab, room collection, cross-house paste, Hook missing indicators, save/reload, farm population, and bridge appearance.

## Acceptance Criteria

- A rug, desk, and computer can occupy overlapping visual bounds and render in the intended order.
- Each item’s preview and blocking area matches its smallest transformed non-transparent pixel rectangle.
- The fine grid provides four snap points per logical room cell.
- A marquee-selected arrangement can be saved and redropped from `組裝件` after reload.
- `全部收回` empties the room while retaining prefabs and required Hook shelf entries.
- `取消配置／還原` restores the last explicitly saved room state, including layers and stacking order.
- Required Hook furniture is always the leftmost palette content with missing/placed state.
- A decorative layout can be copied, the cutaway closes to the village, and the layout can be atomically pasted into another house without copying source Hook items.
- Agent routing ignores floor/surface decoration and avoids blocking furniture.
- The farm visibly contains the expanded animal mix with correct movement facing.
- Every river crossing uses bridge deck components rather than building wall tiles.
- All automated tests and the production build pass, the page returns HTTP 200, and CodeGraph is synchronized.

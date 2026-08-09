# Precision Furniture Placement and Multi-Select Editor Design

Date: 2026-08-09
Status: Approved approach A; awaiting written-spec review

## Goal

Make interior composition feel predictable at room edges and consistent between authored furniture and catalog furniture. Add direct mouse marquee selection with a contextual batch-operation toolbar, a return-to-shelf action, and scaling through 300%.

## Root Cause

Authored furniture usually has no `assetId`. The renderer currently falls back to a Modern Office texture but uses the full 32×48 texture center as its origin. Placement and selection resolve the semantic furniture kind to a catalog asset and use that asset's opaque alpha bounds. Catalog furniture has an explicit `assetId`, so rendering and placement agree for catalog items but disagree for authored items.

The fix is not a compensating offset. Rendering, placement, selection, navigation projection, rotation, and previews must all consume the same resolved catalog asset and the same opaque-alpha center.

## Coordinate and Edge-Fit Model

- Furniture `point` remains the logical anchor for the center of its opaque alpha rectangle.
- A shared asset resolver maps explicit `assetId` first, otherwise maps semantic furniture kind to the default Modern Office catalog asset.
- Rendering origin and transformed bounds use the resolver's `opaqueBounds`.
- Ordinary dragging snaps the anchor to the quarter-grid.
- After snapping, if the transformed alpha rectangle crosses a room edge, the anchor is translated by exactly the overflow distance so the opaque rectangle becomes flush with that edge.
- Exact edge-fit anchors may therefore be off the quarter-grid. Moving the item away from the edge resumes quarter-grid snapping.
- The bottom doorway remains protected. Edge fitting never moves an item through or onto the protected door rectangle; such a drop is rejected and returns to its prior position.
- Rotation and resizing also apply edge fitting before validation, so an operation close to a wall fits inward when possible instead of failing unnecessarily.

## Marquee Selection

- In edit mode, pressing and dragging on room background begins marquee selection without requiring Shift.
- Pressing directly on a furniture sprite selects that furniture and starts normal furniture dragging; it does not start a marquee.
- The marquee rectangle is rendered above the room and uses the exact transformed alpha rectangles for hit testing.
- Furniture is selected when its alpha rectangle intersects the marquee.
- Clicking empty room space without dragging clears selection.
- Existing single selection is represented by the same selection set, preventing single- and multi-select state from drifting apart.

## Contextual Operation Toolbar

When one or more items are selected, a crisp DOM toolbar appears near the lower edge of the room without covering the selection. It contains:

- Cancel selection
- Group as component (enabled only when at least two ordinary items are selected)
- Duplicate furniture
- Return to shelf
- Previous layer / next layer
- Send to back / move backward / move forward / bring to front
- Rotate left / rotate right
- Scale down / scale up

Batch layer, ordering, rotation, and scale operations apply atomically to every selected item. If any selected item would be outside the room or block the doorway, the whole operation is rejected and the draft remains unchanged.

Hook furniture is excluded when creating a reusable component, as before. If fewer than two ordinary items remain after excluding Hooks, grouping is disabled with a clear explanation.

## Duplicate Furniture

- The contextual toolbar exposes `Duplicate` when exactly one furniture item is selected.
- The duplicate preserves the source asset, scale, rotation, layer, layer order, and navigation behavior appropriate for its visual kind.
- A duplicated Hook preserves its visual appearance but removes `requirementId`, `supportedActions`, and Hook icon semantics. The authored Hook remains the unique functional station.
- The duplicate first attempts a quarter-grid diagonal offset. When the source is close to a wall, the editor searches nearby quarter-grid anchors inward and chooses the nearest legal placement.
- If no legal nearby placement exists, duplication is rejected without changing the draft.
- After success, both the original and duplicate are selected so they can immediately be aligned, layered, grouped, or moved together.

## Return to Shelf

- Returning selected furniture removes those instances from the current room draft.
- Required Hook furniture immediately appears in the Hook section at the left of the lower shelf and its completeness counter becomes missing.
- Ordinary Modern Office pieces remain available from the full catalog.
- Reusable grouped components are not deleted when their placed instances are returned.
- This action is unsaved until `Save configuration`; `Cancel configuration` restores the last saved room.

## Scaling

Supported scales are 75%, 100%, 125%, 150%, 175%, 200%, 225%, 250%, 275%, and 300%.

- Inspector buttons and double-click cycling use this shared scale list.
- Scale normalization, persistence, rendering, alpha bounds, navigation projection, prefab storage, copying, and pasting preserve the expanded values.
- Scaling at a room edge invokes edge fitting.
- Scaling beyond 300% or below 75% is disabled rather than wrapping. Double-click cycles upward and returns from 300% to 75% only as a deliberate shortcut.

## Persistence and Compatibility

- Existing v2, v3, and v4 layouts remain readable.
- Missing `assetId` is not forcibly persisted solely to fix rendering; both authored and catalog items use the shared runtime resolver.
- Off-grid edge-fit anchors are stored as finite coordinates without quarter-grid normalization on save. Loading preserves them exactly.
- Existing prefabs and room clipboard data remain valid.

## Test Strategy

Automated tests must first fail for each behavior:

1. Authored and explicit-catalog versions of the same furniture resolve identical alpha bounds and render origins.
2. A near-edge drop clamps the opaque rectangle exactly to each room edge.
3. Edge fitting still rejects doorway obstruction.
4. Save/load preserves exact edge-fit anchors.
5. Marquee selection intersects alpha bounds and excludes non-intersecting items.
6. Return-to-shelf removes all selected instances and marks removed Hooks missing.
7. Batch layer and ordering operations affect every selected item.
8. Batch resize is atomic and supports 300%.
9. Duplicating ordinary and Hook furniture creates a new visual item without duplicating Hook identity.
10. Overlay state enables grouping only for two or more ordinary selected items and duplication only for one selected item.

Browser QA will verify authored and catalog furniture alignment, edge fitting on all four walls, background marquee behavior, the contextual toolbar, batch operations, return-to-shelf, cancellation, save/reopen persistence, and absence of runtime errors.

## Acceptance Criteria

- No visible shift exists between a sprite and its green/red placement rectangle, regardless of whether it originated in the room definition, Hook shelf, prefab shelf, or catalog.
- Dropping close to a wall produces a flush, legal placement rather than rejection or a visible gap.
- A mouse-only user can marquee-select, duplicate, group, cancel, change layers, reorder, rotate, scale, and return selected items.
- Furniture can reach 300% while previews and hit testing stay aligned.
- Saved layouts and existing v2-v4 data continue to load.

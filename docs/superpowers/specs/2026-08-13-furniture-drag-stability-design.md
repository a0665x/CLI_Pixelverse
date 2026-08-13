# Furniture Drag Stability Design

## Goal

Furniture keeps the orientation authored by the Modern Office source or room layout, and dragging remains visually attached to the pointer without snapping back between frames.

## Orientation Contract

- A furniture item without an explicit `rotation` renders at the source orientation (`0` degrees).
- `facing` describes semantic interaction direction and must not implicitly rotate the furniture sprite.
- Explicit authored, saved, prefab, or user-selected rotations remain unchanged.
- Shelf items and prefab ghosts use the same orientation as the item that will be committed.
- Loading a legacy layout without `rotation` must not infer a 90/180/270-degree turn from `facing`.

## Drag Contract

- Pointer grab offset is captured once on drag start, in cutaway root-local coordinates.
- During drag, the visual preview follows the pointer continuously and uses quarter-cell snapping only for the candidate anchor.
- A temporarily invalid candidate remains at its proposed preview position and is colored invalid; it must not be replaced by the original layout during the drag frame.
- The committed room layout and undo history remain unchanged until drag end.
- On drag end, a valid candidate is committed atomically. An invalid candidate restores the original layout once and reports the rejection.
- Prefab groups move as one rigid selection. Every member uses the same snapped delta, including `interactionPoint` metadata.
- Re-render, resize, or cancellation clears the drag session so stale pointer state cannot affect the next drag.

## Boundaries

- Collision, door, room-boundary, Hook reachability, support, and two-wide aisle validation remain strict.
- This change does not add free rotation, continuous rotation, inertia, or collision bypasses.
- Saved layouts are not rewritten until the user explicitly saves.

## Verification

- RED/GREEN unit tests cover missing-rotation normalization, explicit rotation preservation, invalid preview continuity, one-time rollback, edge grab offset, group rigidity, and immutable committed state during drag.
- Existing placement, selection, persistence, office validation, typecheck, and full Pixelworld suites remain green.
- Browser QA uses real pointer input to drag valid and invalid candidates and verifies no mid-drag return-to-origin or angle change.
- The ordinary `./run.sh start` workflow rebuilds and deploys exact HEAD to port 5661.

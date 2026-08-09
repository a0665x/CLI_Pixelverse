# Interior Furniture Editor UX Design

Date: 2026-08-09
Status: Approved

## Goal

Make cutaway furniture editing feel direct and predictable. Furniture must remain attached to the pointer while dragging, show whether its footprint can be placed before release, support explicit resizing, display readable labels only for Hook-relevant furniture, and restore the last saved layout after page or browser restarts on the same origin.

## Root Cause

The current editor drags an invisible `22×22` zone while leaving the furniture sprite at its original position. Placement is validated only on `dragend` against semantic multi-cell footprints, so users receive no indication that an apparently open target overlaps an invisible footprint. All furniture labels are rendered as `5px` canvas monospace text, which becomes unclear after the game canvas is scaled.

## Interaction Model

### Dragging existing furniture

- The furniture sprite is the interactive draggable object; no separate invisible drag handle owns the gesture.
- The sprite follows the pointer continuously without interpolation or delayed re-rendering.
- While dragging, its candidate position snaps to the nearest room grid cell.
- A footprint overlay follows the candidate position. Green means the item can be placed; red means it is outside the room, overlaps another furniture footprint, or blocks the room entrance.
- On a valid drop, the model is updated once and the room is re-rendered.
- On an invalid drop, the sprite returns to its original position and the status line states the rejection reason.

### Adding palette furniture

- Palette items use the same drag preview and placement rules as existing furniture.
- Palette sprites remain available after a drag. Dragging creates a preview clone rather than consuming the palette item.
- The lower palette uses larger hit targets and spacing so adjacent items do not compete for the pointer.

### Resizing

- Double-clicking an existing furniture sprite in edit mode selects it and opens a compact size inspector.
- The inspector provides `−`, a percentage readout, and `+`.
- Supported scales are 75%, 100%, 125%, and 150%.
- Resizing updates both display scale and the grid footprint used by collision and path planning.
- A size change that would cross a wall, overlap another item, or block the entrance is rejected without changing the saved model.
- Palette furniture starts at 100%.

## Labels

- A furniture item is Hook-relevant when `supportedActions.length > 0`.
- Only Hook-relevant furniture receives a persistent label.
- Decorative and user-added furniture with no supported actions has no label.
- Labels use readable action-oriented text derived from the furniture's supported actions and icon, not generic asset names.
- Labels use a high-resolution sans-serif Phaser text texture, at least 9px source size, with device-aware text resolution and a high-contrast background.

## Data Model and Persistence

- `FurnitureDefinition` gains optional `scale`, normalized to one of `0.75`, `1`, `1.25`, or `1.5`.
- Placement and pathfinding use a scaled semantic footprint, rounded up per axis so the visible object never occupies less space than collision declares.
- Saved layouts use a versioned envelope containing `version: 2` and `furniture`.
- The loader accepts the existing unversioned furniture array as version 1 and migrates missing scales to `1`.
- The saved layout remains building-specific and stored in `localStorage` under the existing origin. Reloading or reopening the browser restores the last explicitly saved layout.
- Unsaved changes remain temporary. Closing a cutaway and reopening it reloads the last saved state, preserving the meaning of the Save button.
- Invalid or corrupted saved entries fall back to the authored room layout without preventing the cutaway from opening.

## Architecture

- `interiorLayoutEditor.ts` owns scale normalization, scaled footprints, placement diagnostics, resizing, migration, save, and load.
- `InteriorCutawaySystem.ts` owns Phaser pointer interaction, drag previews, selection, the size inspector, visual footprint feedback, and high-resolution labels.
- `interiorMotion.ts` continues using `furnitureCells`, so Agent A* paths automatically respect resized furniture.
- The renderer commits model changes only on a valid drop or resize; pointer motion changes display objects only.

## Error Handling

Placement diagnostics return one of `outside-room`, `blocks-door`, `overlap`, or `valid`. The UI translates these to concise Chinese messages. Storage parse errors, unsupported versions, invalid furniture kinds, and impossible saved geometry fall back safely to authored defaults.

## Testing

- Model tests cover placement diagnostics, scaled footprints, valid and invalid resizing, version-1 migration, version-2 round trips, building-specific storage, and corrupted-save fallback.
- Cutaway interaction tests verify the furniture sprite itself is draggable, follows drag coordinates, renders green/red previews, exposes the size inspector on double-click, and labels only Hook furniture.
- Interior motion tests verify A* avoids scaled footprints.
- Browser QA verifies smooth pointer attachment, valid/invalid feedback, resizing, save/reload restoration, readable labels, and a clean console/network log.

## Non-goals

- Arbitrary pixel positioning, free rotation, cross-device/cloud layout sync, and deleting authored Hook furniture are outside this phase.

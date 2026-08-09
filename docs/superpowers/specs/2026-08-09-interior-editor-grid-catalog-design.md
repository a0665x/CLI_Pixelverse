# Interior Editor Grid and Catalog Redesign

Date: 2026-08-09
Status: approved for implementation

## Objective

Make the interior editor deterministic and visually precise. A green placement preview must always commit at the same position on mouse release. Furniture must align with its occupied area, support rotation, expose the complete purchased Modern Office v1.2 singles catalog, and use crisp interface text independent of the pixel-art canvas scale.

## Confirmed root causes

1. Palette preview and drop commit independently derive their positions from Phaser drag events. The last preview candidate is not retained as the commit candidate, so the visible state and final validation can diverge.
2. Even-sized footprints are anchored on an integer cell. A two-cell footprint therefore extends from the anchor to its right instead of centering around the furniture image.
3. Every Modern Office single is stored in a 32×48 transparent image, while the opaque artwork has different bounds and centers. Centering the full transparent image does not center the visible furniture.
4. Only 12 of the 339 purchased single images are installed and registered.
5. Cutaway headings, status text, labels, and buttons are Phaser text rendered into a low-resolution pixel-art canvas that is enlarged with CSS. Text resolution settings cannot recover detail after that canvas scaling.

## Placement coordinate model

The authored room remains 14×9 logical navigation cells at 22 pixels per cell. Editing uses a 28×18 half-cell grid at 11 pixels per edit unit.

Furniture positions are stored in logical-cell units and may use increments of 0.5. Existing integer positions remain valid. The snapping rule depends on the rotated footprint parity:

- Odd footprint size on an axis snaps its center to an integer coordinate.
- Even footprint size on an axis snaps its center to an `n + 0.5` coordinate.

This makes the visible furniture center, preview center, and occupied-area center identical. The editor draws the 11-pixel grid only while edit mode is active. Indoor pathfinding conservatively blocks every 22-pixel navigation cell touched by a furniture footprint.

## Deterministic drag transaction

All drag sources use a single placement resolver. It receives the pointer position, asset metadata, rotation, room bounds, and current layout, then returns one immutable candidate containing:

- snapped logical position;
- rotated footprint;
- visible-art offset;
- occupied fine-grid cells;
- placement diagnostic.

The drag session stores this candidate as `currentDragCandidate`. Preview rendering reads it directly. Mouse release commits that exact object without recalculating pointer coordinates. Consequently, a green preview commits successfully unless the room layout was changed by another operation during the same drag. Editor operations are single-threaded, so that exception is not expected in normal use.

Invalid release restores the original item and keeps the diagnostic visible. Diagnostics distinguish room bounds, door clearance, furniture overlap, and invalid catalog metadata.

## Asset alignment and catalog

The installer extracts all 339 files from `4_Modern_Office_singles/16x16/` in the purchased archive. A generated catalog records, for each asset:

- numeric asset ID and texture key;
- 32×48 source path;
- opaque pixel bounds and visible center offset;
- inferred half-cell footprint;
- broad category and display label.

The visible center offset controls rendering and drag hit areas. The inferred footprint uses the opaque bounds rounded up to 11-pixel edit units, with a minimum of one unit on each axis. Catalog metadata is generated deterministically by the installation script and checked into source without copying the purchased PNG files into Git.

The bottom drawer shows 24 items at a time in two rows. It includes all catalog entries and provides category tabs plus previous/next page controls. Categories are surfaces, seating and plants, screens and electronics, storage and partitions, and workstation combinations. The selected page and category remain stable while editing the same house.

Furniture definitions gain an optional catalog asset ID. Existing semantic Hook furniture retains its semantic kind and action routing while selecting its current Modern Office asset. Newly dragged catalog furniture is decorative by default and receives its inferred footprint.

## Rotation and sizing

The selection inspector provides rotate-left, rotate-right, size-down, and size-up controls. Keyboard `R` rotates clockwise while a furniture item is selected.

Rotation uses four persisted orientations. A quarter turn swaps footprint width and height and rotates the rendered image by 90 degrees. Rotation or resizing commits only when the resulting placement is valid; otherwise the previous state remains and the exact diagnostic appears.

Supported scales remain 75%, 100%, 125%, and 150%. The footprint is recomputed from the asset's fine-grid footprint, scale, and rotation.

## Crisp interface layer

All non-pixel interface text in the cutaway moves to an HTML overlay aligned to the Phaser canvas:

- room title and occupancy status;
- edit, save, close, rotate, and size buttons;
- category tabs and pagination;
- placement diagnostics and save confirmation.

Text uses system CJK sans-serif fonts at normal browser resolution. The title is 13 CSS pixels; controls and status text are 11 CSS pixels. Hook labels are 9 CSS pixels and appear only for selected Hook furniture or furniture currently used by an Agent. Pixel sprites, floors, furniture, fine-grid lines, and placement highlights remain in Phaser.

The DOM overlay follows the canvas bounding rectangle and display scale on resize. Its controls stop pointer propagation so they do not close the cutaway or move furniture accidentally.

## Persistence and migration

Saved layout schema advances to version 3 and stores:

- half-cell position;
- scale;
- orientation;
- catalog asset ID;
- semantic Hook fields.

Version 2 layouts migrate by retaining positions, defaulting missing orientations from `facing`, and resolving the existing semantic kind to its current catalog asset. Legacy raw arrays continue through the existing migration path. Unsupported or corrupt data falls back to the authored room.

Only the explicit Save action writes local storage. Closing without saving discards the current edit session. Reloading or reopening after Save restores the exact last saved layout.

## Testing and acceptance

Automated tests must prove:

1. even footprints snap to half coordinates and remain centered;
2. preview and drop commit use the same stored candidate;
3. every green candidate commits and every invalid candidate reverts;
4. rotation swaps footprint axes and rejects collisions;
5. version 2 and legacy layouts migrate to version 3;
6. the generated catalog contains exactly 339 unique assets with valid metadata;
7. all catalog assets can be paged and dragged;
8. cutaway text controls are DOM elements rather than Phaser text;
9. Hook labels remain limited to relevant selected or occupied furniture;
10. pathfinding treats all fine-grid furniture coverage as blocked navigation cells.

Browser QA must cover dragging placed and catalog furniture, green and red releases, rotation near walls and other furniture, category paging, save/reload persistence, and text clarity at the 1.5× village display scale.

## Out of scope

- Arbitrary-angle rotation.
- Freeform placement without snapping.
- Editing walls, doors, or room dimensions.
- Uploading or committing the purchased PNG files outside the existing ignored private asset directory.

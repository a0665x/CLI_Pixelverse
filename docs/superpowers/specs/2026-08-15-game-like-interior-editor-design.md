# Game-like Interior Editor Design

**Date:** 2026-08-15  
**Status:** Approved for implementation  
**Product surface:** Pixelworld interior editor and map-first dashboard HUD

## Goal

Make furniture editing feel like a construction game: direct left-button manipulation, an intentionally small right-click action menu, permissive automatic stacking, semantic agent destinations, consistent furniture scale, and compact dashboard controls that never require scrolling or obscure the map.

## Interaction Model

### Pointer contract

- A primary-button click selects an item without opening any toolbar.
- Primary-button drag moves the selected item one-to-one from the exact grab offset.
- Primary-button drag on empty room space creates a marquee selection.
- A secondary-button click on an item or the current marquee selection opens a compact cursor-adjacent action menu.
- A second secondary-button click, a primary-button click on empty space, `Escape`, room close, or room switch closes the menu.
- The browser context menu is suppressed only inside the active interior editor.
- Furniture dragging and room pan remain mutually exclusive and pointer-owned.

### Context actions

For a single item, show only:

1. Duplicate
2. Rotate
3. Resize
4. Return to catalog

For multiple selected items, show only:

1. Group or Dissolve group, depending on selection state
2. Duplicate
3. Rotate
4. Return all to catalog

Layer, front, back, preview, apply-template, cancel-configuration, and other advanced actions are removed from the contextual surface. Rotation starts from the asset's authored rotation and cycles only through supported orientations. Resize uses a compact direct control and keeps the existing 75–300% persisted scale range.

### Room commands

Room-level edit chrome remains reachable with no selection and contains only:

- Save
- Undo
- Collect all and redecorate

The catalog is a fixed, non-scrolling page. Categories and previous/next pagination replace scrolling. Core Hook categories appear first, followed by decoration. No editor popup uses horizontal or vertical scrollbars.

## Placement and Stacking

### Permissive visual composition

- Ordinary furniture overlap is valid and never produces a red preview.
- Rugs and floor decorations automatically render below furniture.
- Small surface objects dragged over desks, tables, cabinets, or shelves automatically attach to that support and render above it.
- Large furniture may touch or partially overlap when the user intends a composition.
- Only two placement errors remain: blocking the room entrance and being entirely outside the room.
- Partially out-of-bounds furniture is translated by the smallest delta that places its opaque bounds against the nearest room edge.
- Red feedback is reserved for the entrance or an impossible fit. Valid overlap uses the normal selected outline.

### Automatic ordering

The editor owns display ordering. Users do not manage layers or z-index:

1. floor and rugs;
2. large furniture and supports;
3. surface objects;
4. agents and interaction feedback.

Moving a support also moves attached surface objects as one dependency group. Returning a support returns its attached objects unless they are explicitly detached by dragging them away first.

## Semantic Hook Furniture

Agent behavior no longer depends on one required furniture ID or one exact purchased sprite. Furniture is classified into three user-facing semantic categories:

- **Rest:** sofa, bed, lounge chair, or equivalent seating.
- **Search:** bookcase, storage cabinet, archive cabinet, or equivalent storage.
- **Work:** desk, workbench, computer desk, or equivalent work surface.

Hook actions map to the nearest compatible category and a reachable interaction point adjacent to it. Existing fine-grained actions remain internally available, but placement requirements resolve through these three categories. If a room lacks the needed category, the agent remains at the entrance and shows a short localized bubble naming the missing category. Missing furniture never locks editing, makes unrelated furniture red, or requires restoration of a particular built-in item.

## Furniture Scale and Orientation

- New catalog and built-in items begin at the authored asset rotation.
- Built-in layouts are normalized using transparent-pixel bounds rather than sprite-sheet cell size.
- Each visual family has a consistent target size band: small surface objects, chairs, desks/cabinets, sofas/beds, and assemblies.
- Existing abnormally enlarged built-in furniture is migrated to the family default.
- User-saved scale and rotation remain authoritative after migration and round-trip through Save/reload.
- A rotation is offered only when the asset has a meaningful supported orientation; unsupported assets keep their authored angle.

## Context Menu Layout and Motion

- The right-click menu is a 2×2 grid with large icon-plus-short-label actions.
- It opens adjacent to the pointer and flips horizontally or vertically to remain fully inside the cutaway.
- It never wraps into an extra row and never scrolls.
- Press feedback starts on pointer-down.
- Dragged items stay attached to the original grab point.
- Valid edge fitting settles with a short interruptible spring; invalid entrance placement returns to origin with one clear rebound.
- `prefers-reduced-motion` replaces springs with immediate state changes.

## Map-first Dashboard HUD

- The persistent surface contains the heartbeat, current live state, and visible Agent count.
- The five ambiguous dot buttons are replaced by three colored, labeled icon controls: Events, Agents, and Help.
- Only one anchored card may be open at a time.
- Cards use a fixed bounded size and never scroll. Dense content is paginated with explicit Previous/Next controls.
- Clicking the active control, clicking outside, pressing `Escape`, or opening an interior closes the card.
- Cards remain within the viewport and avoid the persistent heartbeat card and interior cutaway.
- Color, icon, title, focus ring, and pressed state distinguish every control. The map remains the primary visual surface.

## Feedback and Localization

- Furniture names are shown only for the selected item or open context menu.
- Short transient feedback appears next to the manipulated object: for example, “Entrance must stay clear” or “Attached to desk.”
- No persistent instructional column overlays the room.
- All new actions, category names, errors, pagination controls, and accessible names are localized in `en-US`, `zh-TW`, `ja-JP`, and `ko-KR`.

## Persistence and Compatibility

- Save remains the only persistence boundary. Drag, resize, rotate, automatic support attachment, grouping, and edge fit stay in memory until Save.
- Undo records one immutable snapshot per completed gesture, not per pointer move.
- Saved v5 layouts continue to load. Legacy specific Hook requirement IDs are mapped to semantic categories during hydration without rewriting storage until Save.
- Custom groups, prefab instance IDs, supported-object relationships, interaction points, visual offsets, scale, and authored rotation survive Save/reload.
- Existing user layouts are preserved unless an item uses a known oversized built-in default and has no explicit user scale.

## Error Handling

- Storage read/write errors keep the current in-memory layout and show one localized, non-blocking status.
- An item with an unknown asset remains returnable to the catalog and does not crash the editor.
- If an automatic surface attachment cannot be resolved, placement remains valid as ordinary decor instead of turning red.
- If a semantic Hook category has no reachable interaction cell, the agent uses the entrance fallback and publishes the missing-category bubble.

## Testing and Acceptance

Automated coverage must prove:

- left-click selection never opens the action menu;
- right-click toggles the menu and all dismissal paths work;
- the menu remains fully visible without wrapping or scrolling near every room edge;
- marquee selection exposes only the four group actions;
- ordinary overlap is valid, small objects attach to supports, and attached items move together;
- entrance blocking remains invalid and partial overflow fits to the nearest edge;
- no user-facing layer controls remain;
- the three semantic Hook categories select reachable nearby furniture and missing categories fall back to the entrance;
- built-in furniture families start at consistent sizes and authored rotations;
- Save/reload and Undo preserve grouping, support, scale, rotation, offsets, and interaction metadata;
- dashboard controls are exactly Events, Agents, and Help; cards are bounded, paginated, non-scrolling, mutually exclusive, and viewport-safe;
- all four locales and keyboard/accessibility paths are complete.

Browser QA must exercise desktop and compact viewports, left/right click, marquee selection, support stacking, edge fitting, room Save/reload, dashboard card pagination, console errors, network failures, and reduced-motion behavior.

## Out of Scope

- A user-managed layer stack.
- Freeform arbitrary-angle rotation.
- Restoring the removed advanced preview/apply-template toolbar.
- Requiring a specific Modern Office asset ID for Agent behavior.
- Replacing the purchased Modern Office v1.2 asset family.

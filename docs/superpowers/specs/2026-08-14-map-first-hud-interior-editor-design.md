# Map-First HUD and Interior Editor Design

Date: 2026-08-14

## Goal

Give the village map visual priority, enlarge the interior workspace, and make furniture editing feel direct and predictable without removing heartbeat, live execution status, or existing advanced capabilities.

## Current Problems

- The desktop cutaway is fixed at 480×330 world pixels, leaving dense 18×12 offices visually cramped.
- Header text, Hook labels, the inspector, batch controls, and the bottom furniture catalog compete with room content and can cover furniture.
- Furniture placement fits only partially out-of-bounds items. A pointer that moves fully outside the room can leave the candidate outside and cause a rejected drop or visible snap-back.
- Detailed dashboard panels permanently consume space even though the map, heartbeat, and current agent activity are the primary information.
- Advanced actions are always presented instead of appearing in the context where they are useful.

## Approved Direction

Use a map-first HUD with an adaptive large cutaway and contextual editing controls. Advanced information remains available in drawers, tooltips, and an optional guide mode rather than being deleted.

## Main Web UI

### Persistent information

The default workspace keeps only these elements continuously visible:

- the village map as the dominant canvas;
- a compact heartbeat/connection indicator;
- the currently executing agent event and concise live state;
- a small agent count or identity summary.

The map should use the available viewport rather than inheriting empty margins from detailed panels. On desktop it should occupy roughly 75–85% of the useful page area. Compact layouts may stack the status strip above the map.

### Progressive disclosure

- Event history, diagnostics, tool details, routing details, and secondary controls move into collapsible drawers.
- Icon buttons expose a short accessible tooltip on hover and keyboard focus.
- Guide mode may show a one-time anchored explanation when a user first encounters an important control. Dismissal is remembered locally and every explanation remains available from a help control.
- Tooltips must not replace accessible names, trap the pointer, or cover the control being explained.
- Opening a drawer must not resize the village unexpectedly; it overlays or uses a deliberate resizable split with a stable map viewport.

## Enlarged Interior Workspace

### Adaptive size

- The desktop target grows from 480×330 to approximately 720×495, matching the requested 1.5× scale.
- The cutaway remains viewport-safe: its outer frame is capped by available width and height with a consistent margin.
- Compact screens use nearly the full viewport and retain the existing independent room zoom and pan gestures.
- The pixel-art room remains nearest-neighbour rendered. DOM typography and controls remain high-resolution system text.

### Non-overlapping regions

The cutaway is divided into explicit regions instead of placing controls over the room:

1. A slim top bar contains the room name, edit state, help, fit-view, and close actions.
2. The centre is a dedicated clipped room viewport with no permanent inspector or catalog covering it.
3. The furniture catalog is a collapsible bottom drawer. When expanded, it occupies reserved space outside the room viewport rather than covering the bottom furniture.
4. Selection and batch actions appear as one compact contextual toolbar adjacent to the selection, then flip above/below or to the side to remain inside the safe frame.
5. Detailed properties use a narrow contextual side sheet on wide screens and a bottom sheet on compact screens. It opens only after selection and can be collapsed.

### Labels and explanations

- Permanent furniture text is reduced to the minimum needed to identify required Hook stations.
- Required Hook stations use a compact icon/badge by default; full names appear on hover, focus, selection, or while guide mode is active.
- Agent activity uses a concise bubble and the persistent live-status HUD; long descriptions do not sit on top of furniture.
- Tooltip and bubble placement must avoid the selected furniture bounds and remain inside the room viewport.

## Furniture Manipulation Contract

### Direct manipulation

- Pointer-down captures one stable logical drag target. The dragged item or selected group stays attached to the pointer without re-resolving its grab offset.
- During drag, the selection is lifted visually using a small scale increase, higher depth, and shadow/outline. It is not rotated or mirrored.
- Valid placement uses a restrained positive outline; collision or invalid placement uses a distinct negative outline.
- Placement feedback follows the pointer every animation frame, while persistence, undo history, and expensive final validation run only when the user releases.
- A successful drop uses a short settle animation. An invalid drop returns smoothly to the original position once, without oscillation.

### Edge fitting

- A drag target is always projected onto the closest room-safe point, even when the pointer is completely outside the room.
- Fitting uses transformed opaque bounds, scale, rotation, visual offset, and the complete selected-group bounds.
- Near an edge, movement stays continuous and preserves the original pointer grab offset; it does not alternate between the old position and the fitted candidate.
- On release, the closest valid fitted candidate is committed. If collision or required semantic validation still fails, the whole operation is atomically rejected and restored.

### Selection and commands

- Single selection, marquee selection, prefab groups, duplicate, rotate, resize, layer shift, reorder, return-to-shelf, dissolve, undo, and save remain supported.
- Contextual commands never mutate a group member independently unless the group has first been dissolved.
- Rotation remains explicit. Dragging or edge fitting must never change the authored/current rotation.
- Keyboard focus, Escape/cancel, and undo remain equivalent to pointer workflows.

## Motion and Accessibility

- Interaction feedback uses short physical easing with no long decorative transitions.
- Reduced-motion mode removes lift/settle movement while retaining outlines and state changes.
- Reduced-transparency mode uses opaque surfaces for HUD, drawers, tooltips, and contextual controls.
- Hover affordances also work with keyboard focus; touch uses tap/long-press or an explicit help control rather than hover-only discovery.
- The room viewport, catalog drawer, and contextual toolbar retain clear input ownership so room panning cannot steal furniture dragging.

## Data and Persistence

- Existing saved room layouts, rotations, prefab instance IDs, support relationships, interaction points, and visual offsets remain compatible.
- Dashboard disclosure preferences and dismissed guide tips may use separate local settings. They do not alter room layout storage.
- A drag preview performs no storage write. Only the existing explicit Save action makes the current room layout durable.

## Verification

- Pure tests cover adaptive cutaway sizing, viewport-safe regions, closest-edge fitting for all four sides and corners, oversized selections, rotation preservation, stable grab offsets, and atomic invalid-drop restoration.
- DOM tests cover collapsed/expanded drawers, contextual toolbar placement, tooltip accessibility, guide-mode dismissal, and the absence of permanent overlays over the room viewport.
- Integration tests cover furniture drag versus room pan ownership, group edge fitting, undo/save semantics, and saved-layout compatibility.
- Dashboard tests confirm that map, heartbeat, and current live status are persistent while secondary panels are collapsed by default and remain reachable.
- Browser QA covers desktop and compact layouts, a dense office, zoomed/panned rooms, edge dragging, contextual controls, keyboard focus, reduced motion/transparency, and reload persistence.
- Final verification runs Node, Python, Pixelworld Vitest, TypeScript typecheck, production build, ordinary `./run.sh start`, health checks, and browser console/network inspection on port 5661.

## Non-goals

- Do not remove live event data or backend hooks; only change their default presentation.
- Do not replace Modern Office assets or rewrite saved room arrangements.
- Do not rotate furniture automatically to make a placement fit.
- Do not move the village camera while an interior cutaway is open.

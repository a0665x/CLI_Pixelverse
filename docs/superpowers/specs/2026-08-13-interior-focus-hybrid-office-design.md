# Interior Focus and Hybrid Office Design

**Date:** 2026-08-13  
**Status:** Approved design  
**Scope:** Pixelworld interior cutaway focus behavior and default work-office composition

## Goal

Make an opened interior immediately readable by removing visual interference from the village behind it, and redesign unsaved work-office defaults to read as deliberate, high-density offices rather than collections of furniture parts.

## User Outcome

When a building opens, the user sees only the information relevant to that room. Village building names, zone labels, and exterior agent status labels or bubbles disappear until the interior closes. Work buildings show coherent office departments with workstation islands, side consoles, shared equipment, and circulation space.

## Interior Focus Mode

### Behavior

Opening any interior activates one scene-level focus state. While active, it hides:

- village building-name labels;
- village zone or district labels;
- exterior agent name and status labels;
- exterior agent speech bubbles and transient activity copy.

The village artwork, buildings, animals, paths, and scenery remain visible as the subdued background. Interior furniture labels, occupant labels, Hook labels, controls, and status copy remain visible.

Closing the interior restores every exterior label and bubble to the visibility dictated by its current agent state. Switching directly from one building to another keeps focus mode active without briefly flashing village labels. Destroying or restarting the scene restores the default non-focused state and leaves no stale DOM classes or hidden-object state.

### Architecture

Add one focused-visibility boundary owned by `WorldScene`. It receives cutaway open/close changes and forwards the focus state to the systems that own exterior labels and bubbles. Individual label systems retain ownership of their objects; the controller changes visibility without destroying or recreating them.

The cutaway system exposes an explicit open-state change callback. `WorldScene` is the coordinator because it already owns the cutaway, village labels, and exterior status overlay. Focus state is not inferred from CSS selectors or DOM presence.

### Accessibility and Motion

Visibility changes are immediate. A short opacity transition may be used when normal motion is enabled, but `prefers-reduced-motion` makes the change instantaneous. Hidden exterior DOM elements are removed from the accessibility tree with `hidden` or equivalent semantics rather than visually transparent but focusable.

## High-Density Hybrid Office

### Footprint and Preservation

Work-office interiors remain 18×12. Compact Arrival, Awaiting, Rest, and Offline interiors remain unchanged in size and character.

New office defaults apply only when a building has no valid saved layout. A valid user-saved layout always wins. Existing saved rooms are never migrated, rearranged, or overwritten automatically.

### Spatial Program

Each work-office default combines the approved mixed-office and high-density approaches:

1. **Entrance and reception threshold**
   - The centered door opens into a two-tile-wide main aisle.
   - No desk, chair, label, or foreground object blocks the threshold.

2. **Central workstation field**
   - Two coherent four-seat double-bench islands provide eight primary seats.
   - Each island reads as one assembly: aligned desks, continuous dividers, correctly facing chairs, and monitors, keyboards, documents, and lamps on the surface layer.
   - Aisles between islands and side zones remain visually clear.

3. **Specialist side workstations**
   - One two-seat L/U pod forms a quieter research or planning corner.
   - One three-seat M control console forms the dense tool, edit, dispatch, or response area.
   - Theme-specific Hook actions determine which side workstation is emphasized, without removing the other office structure.

4. **Shared back-wall services**
   - Bookcases, archive cabinets, printer or device station, planning board, and storage align along the back or side wall.
   - Surface accessories sit on their supporting furniture with correct z-order and visual offsets.

5. **Collaboration zone**
   - One compact meeting or standing-discussion area occupies a corner without cutting the main aisle.
   - The room avoids oversized decorative lounge furniture that would make it read as a house rather than an office.

### Density Limit

The visual target is approximately 12 primary seats, with eight central bench seats plus specialist L/M stations. Supporting decorative chairs do not count as primary Hook workstations. The layout may contain more furniture parts, but it must read as a small company office rather than a warehouse of individual sprites.

### Theme Variation

- **Research / Web-MCP:** bookcases, archive wall, reading and terminal emphasis.
- **Maker / Tool / Edit:** M console, equipment cabinets, planning board, printer or repair support.
- **Collaboration / Clone / Response:** M console, compact meeting zone, response/dispatch support.

Themes share the same office grammar and Modern Office Revamped v1.2 family, but use different support zones and Hook emphasis. No unrelated furniture asset family is introduced.

## Geometry and Agent Behavior

- The entrance-to-main-cross-aisle route remains continuously two tiles wide.
- Every action-bearing Hook workstation has an ordinary orthogonal A* path from the entrance/main aisle to its authored interaction point.
- Furniture, opaque bounds, labels, and visual pixels use the same geometry and offset calculations.
- Surface accessories remain nonblocking.
- The persisted `wall` layer continues to act as the foreground occlusion layer.
- Agents enter from the door and visibly walk to the assigned authored workstation; they do not appear instantly at a seat.
- Idle occupants retain their breathing animation and localized activity bubble inside the cutaway.

## Editing Behavior

Built-in bench, L/U pod, and M-console assemblies remain grouped until Dissolve. Their default placement is editable through the existing group move, rotate, scale, layer, duplicate, return, undo, and save operations.

Applying or restoring the new office template is explicit and undoable. Preview never writes storage. Save remains the only normal persistence boundary.

## Localization

Any new focus-mode or office-template feedback uses the existing typed locale system for `zh-TW`, `en-US`, `ja-JP`, and `ko-KR`. Built-in prefab names use their localized stable-ID labels. No new user-visible operational string is hardcoded in a rendering system.

## Error and Recovery Behavior

- If an authored office composition fails overlap, door, aisle, asset, or Hook-reachability validation, it is rejected during development and cannot become a runtime default.
- If saved-layout storage cannot be read, the room may display an in-memory default but Save remains blocked until a successful retry or explicit valid template Apply establishes user intent.
- If focus-state cleanup encounters an absent label system during scene shutdown, cleanup is idempotent and continues without throwing.

## Testing and Acceptance

### Focus mode

- Opening each work and compact room hides exterior building, zone, agent, and bubble labels.
- Interior Hook, occupant, status, and control labels remain visible.
- Closing restores current exterior state.
- Building-to-building switching produces no exterior-label flash.
- Scene destroy leaves no hidden-state or DOM residue.
- Reduced-motion and accessibility-tree behavior are verified.

### Office composition

- Unsaved Research, Maker, and Collaboration work rooms show two four-seat bench islands, an L/U pod, an M console, shared services, and a compact collaboration zone where the theme permits.
- Every complete room passes asset, opaque-bounds, overlap, door, two-wide main-aisle, and per-Hook A* validation.
- Desk accessories remain on surfaces; chairs face work surfaces; partitions form continuous groups.
- Every action-bearing workstation is assignable, and motion ends exactly at its authored interaction point.
- Existing valid saved layouts remain byte-for-byte untouched until an explicit user save.

### Regression and live QA

- Group editing, undo, template preview/apply, locale changes, storage recovery, camera pan/zoom, and same-breakpoint resize continue to work.
- Browser QA checks desktop and compact cutaways, exterior-label suppression, office readability, agent entrance motion, foreground occlusion, console errors, and service health at `http://127.0.0.1:5661/`.

## Out of Scope

- Changing the outdoor village art or building placement.
- Expanding compact domestic rooms to 18×12.
- Overwriting or migrating existing user-saved layouts.
- Adding another furniture asset family.
- Changing Agent event-to-building Hook routing.


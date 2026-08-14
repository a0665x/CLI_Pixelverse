# Interior Navigation and Agent Variety Design

Date: 2026-08-14

## Goal

Make a zoomed interior remain easy to explore, give concurrently visible agents stable distinct appearances, and show a convincing directional walk cycle both outdoors and inside rooms.

## Current Problems

- The global village viewport accepts wheel zoom, but deliberately rejects pointer panning while a cutaway is open. This prevents furniture drag from moving the village camera, but leaves the zoomed cutaway without any panning owner.
- Outdoor subagents are deterministically divided between only two static Ninja Adventure skins. Interior rendering ignores that selection and collapses every subagent to one skin.
- LimeZu Adam has an authored four-direction six-frame walk cycle, while the fallback 16×16 skins use a generic row calculation. Interior and exterior therefore do not present the same agent identity or motion quality.

## Approved Approach

### Independent interior viewport

The cutaway owns a local viewport transform while it is open. The village camera remains frozen.

- Wheel input zooms the room around the pointer position, not around the room centre.
- Primary-button dragging on non-interactive room space pans the room after a small movement threshold.
- Furniture drag, shelf drag, inspector controls, marquee selection and resize handles take priority and must never start room panning.
- Pan is clamped so the room cannot be lost entirely outside the visible cutaway frame. Fit/reset returns to the authored centred view.
- Opening another room resets to its fitted view; resizing the canvas recomputes fit and clamps the current transform.
- DOM controls and labels remain aligned with the transformed Phaser room content.

### Stable agent appearance

Introduce one shared skin resolver used by exterior and interior rendering.

- `main` keeps its stable signature skin.
- Other agents select deterministically from the locally available character pool using `agentId`; the same ID receives the same skin after reload and while moving between exterior and interior.
- The resolver avoids assigning every concurrently visible agent the same appearance where the pool permits variation.
- No sprite is rotated or mirrored merely to manufacture a new appearance.

### Shared directional animation

Move frame selection behind a skin-aware animation contract shared by both renderers.

- Moving agents cycle through the authored frames for their current facing direction.
- Idle agents show the authored idle frame for their last or assigned facing.
- Facing is derived from movement before selecting the frame, preventing backward walking and sideways sliding.
- Each skin declares its actual frame layout; unsupported frames are never inferred beyond the source sheet.
- Interior walking uses its motion clock, while exterior walking uses the controller clock, but both call the same resolver.

## Interaction Ownership

Input precedence inside an open room is:

1. DOM buttons/catalog controls
2. Furniture or prefab dragging/resizing
3. Marquee selection in edit mode
4. Room viewport panning on unused room space

The outer village viewport continues to reject pan gestures while the cutaway exists. Closing the cutaway restores normal village wheel and pan behaviour without retaining pointer capture.

## Verification

- Pure tests cover pointer-anchored zoom, pan threshold/clamping, fit/reset, resize and gesture ownership.
- Integration tests prove cutaway pan does not change the village camera and does not steal furniture drag or marquee selection.
- Skin tests prove deterministic identity, useful variation and identical selection inside/outside.
- Animation tests prove idle frames, changing walk frames and correct directional rows for every supported skin.
- Browser QA opens a room, zooms and pans it, then drags furniture; it also triggers multiple agents and observes distinct appearances and animated movement.
- Run Pixelworld focused tests, full Vitest, TypeScript typecheck and production build before deployment to port 5661.

## Non-goals

- Do not re-enable village-camera movement behind an open cutaway.
- Do not replace purchased Modern Office furniture or alter saved room layouts.
- Do not synthesize new character artwork or modify copyrighted source sheets.

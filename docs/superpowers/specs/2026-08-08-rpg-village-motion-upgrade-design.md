# RPG Village Motion Upgrade Design

**Status:** approved by the user's 2026-08-08 revision request and prior instruction to implement without intermediate questions.

## Outcome

Upgrade the fixed-camera Agent village into a larger, cohesive RPG map using LimeZu's Serene Village exterior family and the prototype-only free Modern Interiors family. Every hook category gets a visually distinct destination, Agents remain observable while crossing the exterior door and interior entry path, and all active Agents continuously communicate their current work.

## Visual system

- Use Serene Village Revamped as the exterior source of truth: grass, paths, water, trees, houses, doors, fences, props, and animated scenery.
- Render 16 px source art at 24 px world cells (1.5x) with nearest-neighbor sampling. Characters and animals receive the same world scale.
- Keep the complete fixed village visible inside the application viewport. The map becomes larger in logical area and richer in zoning, while the canvas uses the available screen more aggressively.
- Use browser/DOM text for village labels, speech bubbles, panel copy, and cutaway status so glyphs remain sharp at every pixel-art scale.
- Credit Serene Village under CC BY 4.0. Mark Modern Interiors Free as prototype-only because its included free license is restricted to testing/private/non-commercial use.

## Hook districts

Split the current four themes into eight small destinations while retaining four compatible interior palettes:

1. Arrival Lodge: session start and heartbeat.
2. Thinker's Cottage: think and plan.
3. Archive Library: read.
4. Network Lab: web/MCP.
5. Maker Workshop: edit.
6. Tool Smithy: tool and self-heal.
7. Guild Hall: clone and respond.
8. Rest Cabin: await, blocked, idle, and offline.

Each building has a real exterior door, connected road, readable sign, click hit area, matching station, and theme-specific furniture route.

## Interior time model

An Agent that crosses an exterior threshold enters an `ingress` phase. Its interior snapshot starts at the bottom-center door and walks cell-by-cell to the assigned furniture. Opening the cutaway immediately exposes its current interior progress instead of teleporting it.

After arrival, active work follows a deterministic loop through compatible furniture. Tool work cycles desk → bookcase/tool wall → whiteboard → desk; web work cycles computer → bookcase → computer; planning cycles board → map table; edit cycles terminal → workbench. Stationary frames use a subtle breathing bob. The cutaway always displays a sharp live activity bubble and Agent name.

## State and testing

- A pure interior-motion planner calculates ingress, working, and breathing states from entry time, current time, and furniture route.
- World routing continues to use A* for exterior travel. Existing hook event kinds remain compatible.
- Unit tests cover destination mapping, eight-building validity, 1.5x presentation constants, interior ingress progress, furniture cycling, and breathing.
- Browser QA covers the fixed village, enlarged sprites, crisp labels, immediate cutaway opening during ingress, and at least tool/web/idle flows.


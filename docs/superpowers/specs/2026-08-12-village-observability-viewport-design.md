# Village Observability and Viewport Design

## Goal

Make the village the primary, full-looking workspace while moving verbose agent telemetry into the event timeline. The village must remain directly manipulable, fully localized, and visually consistent with the Apple-inspired dashboard materials already in use.

## Approved Direction

Use a cover-first viewport with a persistent Fit escape hatch. The default camera fills the available village panel and may crop a small amount at the edges. Users can wheel-zoom around the pointer, drag to pan, or press Fit to reveal the full village. This avoids rebuilding world coordinates or route geometry while eliminating the large empty side bands produced by contain-only scaling.

## Information Architecture

### Village Overlay

- Remove the permanent verbose agent chip beneath each outdoor character.
- Retain one concise speech bubble per visible agent.
- Speech copy describes the current action in a short phrase, such as “查資料中”, “執行工具”, or “等待回覆”.
- Bubbles may be temporary or persistent according to the existing route policy, but must be visually bounded and must not repeat the full agent name, room, and task.
- Building occupancy badges remain concise. Full agent detail belongs outside the map.

### Agent Event Timeline

Each agent timeline card gains a live status header containing:

- localized current state;
- localized room name;
- current task or tool label;
- connection/heartbeat condition;
- time since the last event.

The header updates from the same canonical world snapshot already used to draw event lanes. Recent actions remain plotted in the existing reasoning, tool, subagent, session, status, message, and completion lanes. The map and timeline therefore show the same state at different levels of detail rather than duplicating long strings.

## Localization

The outer dashboard is the locale source of truth. Whenever the locale is initialized or changed, it sends a versioned locale message to the Pixelworld iframe. Pixelworld applies that locale to:

- outdoor building names and hook labels;
- agent action bubbles and fallback states;
- building occupancy copy;
- Fit and zoom control labels;
- room/cutaway headings and controls;
- status strings derived from live snapshots.

Pixelworld acknowledges no locale with a safe `zh-TW` fallback. Locale changes are live and do not reload the iframe or reset camera state. Supported values remain `zh-TW`, `en-US`, `ja-JP`, and `ko-KR`.

## Village Camera

### Initial Framing

- `Cover` is the initial and reset presentation for the embedded dashboard.
- Cover scale is `max(availableWidth / worldWidth, availableHeight / worldHeight)`, bounded by the supported zoom range.
- The world starts centered, filling the panel without background bands where geometry permits.
- `Fit` uses contain scale and centers the full world.
- Standalone Pixelworld may retain Fit as its initial mode if no embed parameter is present.

### Wheel Zoom

- Wheel zoom is anchored to the pointer position: the world coordinate below the pointer stays below it while scale changes.
- Trackpad and wheel deltas use continuous exponential scaling rather than fixed jumps.
- Scale is clamped to useful minimum and maximum bounds.
- The interaction has no gesture-driven CSS transition; every wheel event updates the presentation immediately.

### Drag Pan

- Primary-pointer drag pans the village 1:1 after a small movement threshold.
- Pointer capture keeps the map attached if the pointer leaves the canvas.
- The original grab offset is preserved.
- Camera bounds retain a visible portion of the world. Overshoot receives progressive resistance during drag and settles to the valid boundary on release.
- A click without passing the drag threshold continues to activate buildings normally.
- Camera scale, offset, and framing mode persist in `sessionStorage` and survive iframe/page reloads during the browser session.

### Controls

The compact floating control becomes `− / Cover or Fit / +`. Its middle control displays the active framing action and current percentage. A dedicated recenter/reset action is accessible by double-clicking the middle control or through its accessible label. All controls remain operable by keyboard.

## Layout

- The world panel remains between the resizable sidebar, header, and timeline.
- The canvas can visually overflow its viewport only inside the clipped world panel; no page scrollbars are introduced.
- Background behind the canvas uses a village-compatible dark green material rather than black.
- Cover framing is recomputed when sidebar, timeline, header, or browser dimensions change. User zoom/pan is preserved unless the user explicitly chooses Cover or Fit.
- At narrow breakpoints the existing mobile layout remains authoritative and the camera continues to support touch-compatible pointer panning.

## Apple-Inspired Visual System

- Structural sidebar and timeline panels use the heavier translucent material.
- Map controls and live-state pills use a lighter glass material with a bright top edge, restrained saturation, and readable vibrancy.
- Controls respond on pointer-down and remain interruptible.
- Typography uses the system stack, optical sizing, tight heading leading, and modest positive tracking for small labels.
- `prefers-reduced-motion` removes scale and settling motion while preserving color/opacity feedback.
- `prefers-reduced-transparency` replaces blur with near-solid materials.
- `prefers-contrast: more` strengthens borders and foreground contrast.

## Architecture

### Outer Dashboard

- `public/app.mjs` publishes both canonical snapshots and locale messages to the iframe.
- `public/agent_timeline_graphs.mjs` derives the live status header from canonical agent data.
- `public/index.html` styles the enhanced timeline state header and refines dashboard materials without changing API contracts.

### Pixelworld

- A pure camera model owns cover/fit metrics, pointer-anchored zoom, bounded pan, and session serialization.
- DOM/event wiring in `pixelworld_mvp/src/main.ts` translates wheel, pointer, and button input into camera model operations.
- `createGame.ts` applies camera presentation to a canvas wrapper rather than treating canvas width and height as the only viewport state.
- A locale bridge parses parent messages and exposes localized building, state, bubble, cutaway, and control copy.
- Status overlay rendering consumes concise localized bubble text and suppresses verbose outdoor chips.

## Error Handling

- Malformed camera session data resets to the embedded Cover default.
- Unsupported locale messages fall back to `zh-TW`.
- Missing iframe, storage denial, or unavailable pointer capture degrades safely without stopping snapshot rendering.
- Camera math handles zero-sized containers by retaining the previous valid presentation until a usable size is observed.

## Testing and Acceptance

- Pure tests cover cover/fit scale, pointer-anchored zoom, pan bounds, session round trips, malformed storage, and resize behavior.
- Locale tests prove all supported locales provide building, state, bubble, cutaway, and viewport-control strings.
- Timeline tests prove live state, room, task, heartbeat, and age are present and localized.
- Overlay tests prove the verbose agent chip is absent outdoors while concise bubbles remain.
- Browser QA verifies wheel zoom around the cursor, drag pan without click regression, Cover without large side bands, Fit restoration, locale switching without stale Chinese copy, camera persistence, responsive behavior, and no console errors.
- Existing Node, Pixelworld, Python, production build, furniture editing, routing, and live-agent tests remain green.

## Out of Scope

- Changing the village tilemap dimensions, building coordinates, collision geometry, or A* graph.
- Adding momentum flick physics that can obscure observability; bounded settling is sufficient for this phase.
- Replacing the current event-lane visualization or backend snapshot schema.

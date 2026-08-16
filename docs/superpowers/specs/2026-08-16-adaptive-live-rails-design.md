# Adaptive Live Rails Design

## Goal

Make the live monitoring shell feel immediate and spatially efficient: the ECG must animate continuously, the left and right rails must be independently resizable, every region must adapt to the available width, and the village must show exactly the same authoritative agents and states as the monitoring rails.

## Confirmed Problems

- ECG paths are regenerated only when a backend snapshot renders, so the waveform visibly advances about once per second.
- The desktop layout fixes the left rail at 248 px and the right rail at 196 px, leaving unused space inside both rails and offering no direct manipulation.
- The backend currently exposes a real attached CLI agent and a stale `source_placeholder` main agent. Both are rendered, so the village shows an extra resting character while the live rail reports a working CLI.
- Rail content has only one fixed density and therefore wastes space when widened and clips useful content when narrowed.

## Approved Design

### Authoritative Agent View

A pure normalizer produces the one display list consumed by the live rail, Hook rail, village renderer, counts, and Pixelworld bridge. A stale or `awaiting_attach` `source_placeholder` is suppressed only when a non-placeholder attached agent from the same source is present. Genuine idle, offline, subagent, and branch-session agents remain visible.

The normalizer resolves state precedence once. Explicit active `state` values such as `working`, `thinking`, and `planning` override stale `pixel_state=idle`; offline/stale still wins. Room and Hook selection are derived from that resolved state when the backend room is inconsistent.

### Smooth ECG

Snapshots update identity, tone, load, and state. A separate display-synced controller animates only the existing SVG paths with `requestAnimationFrame`, capped near 30 visual updates per second to limit CPU use. Idle and offline paths stay flat. Reduced-motion mode uses a low-frequency static refresh rather than continuous movement.

The rail DOM is not rebuilt for each animation frame.

### Resizable Workspace

Desktop uses five columns: left rail, left splitter, map, right splitter, right rail.

- Left rail default 280 px, range 180–420 px.
- Right rail default 260 px, range 180–360 px.
- Map minimum 520 px.
- Splitters are 8 px wide, track the pointer 1:1 with pointer capture, and respond immediately on pointer down.
- Keyboard Arrow keys resize by 16 px; Shift+Arrow resizes by 48 px.
- Double click restores the corresponding default.
- Valid widths persist in localStorage and are clamped again on every viewport resize.

At widths below 900 px the layout returns to map-above/rails-below. Desktop rail widths do not distort the narrow layout.

### Adaptive Rail Content

The left rail uses width-aware agent cards:

- compact: avatar, name/state, short waveform;
- standard: avatar, name/state/room, full waveform;
- wide: identity and current Hook beside a full-width signal monitor.

Cards share the available vertical space up to a practical maximum and remain grouped at the top afterward. Pagination remains available for larger agent counts.

The right rail becomes a compact live Hook console with Work, Search, and Rest channels. Each channel shows its current occupant count and the freshest activity. The selected/current Hook receives the strongest visual emphasis. Help remains at the bottom and opens within the right rail without covering the map.

No historical charts or internal scrollbars are introduced.

### Visual and Interaction Rules

- The village remains the primary surface.
- Splitters provide hover/focus affordance without becoming heavy bars.
- Dragging follows the pointer exactly; release uses a short critically damped settle only if clamping was required.
- Reduced motion disables the settle animation but keeps immediate resizing.
- All regions use system typography, high contrast, and `overflow: hidden`.

## Testing

- Pure tests for placeholder suppression, state precedence, room consistency, and Hook channels.
- Pure tests for rail width clamping, persistence values, pointer delta math, keyboard increments, and double-click reset.
- Controller tests proving ECG animation updates between unchanged snapshots and stops/cleans up correctly.
- Dashboard structure tests proving five-column desktop layout, adaptive rail classes, splitters, no scrollbars, and narrow fallback.
- Full Node/Python/Pixelworld regression suites, typecheck, production build, and real browser QA at 1440×900, 1024×768, and 800×450.

## Non-Goals

- Increasing backend polling frequency.
- Adding historical statistics.
- Hiding genuine idle or offline agents.
- Making the narrow layout preserve desktop rail widths.

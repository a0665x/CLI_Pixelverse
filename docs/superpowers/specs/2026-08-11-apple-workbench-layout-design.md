# Apple-style Resizable Pixelverse Workbench

## Goal

Make the integrated dashboard feel calm and directly manipulable while keeping the existing world overview, hook routing, inspector, timeline, exposure controls, furniture editor, and Pixelworld village.

## Layout

Desktop uses three primary regions: a left observability sidebar, a central village viewport, and a bottom agent timeline. A vertical separator controls sidebar width and a horizontal separator controls timeline height. Both separators track the pointer one-to-one with pointer capture, show immediate pressed feedback, clamp to safe bounds, and reset on double-click. Saved sizes persist in local storage.

On narrow/mobile layouts, separators are disabled and existing collapsible/mobile behavior remains authoritative. Resizing must never cover the village with an invisible hit target or make a primary region smaller than its usable minimum.

## Village viewport

The default scale is exact contain-fit: the full 768×448 village must be visible inside the current iframe viewport, including when the available height is below 448px. Fractional scales are required; the current minimum of 1× is removed. The canvas remains centered.

A compact translucent control provides zoom out, Fit, and zoom in. Zoom is relative to the current fitting scale, is clamped, persists for the session, and returns to exact contain-fit with Fit. Wheel zoom is enabled over the village with modest steps. Resize events recompute the fitting scale without discarding the user's zoom multiplier.

## Interaction and visual language

Following the Apple Design skill, pointer feedback begins on pointer-down, dragged boundaries stay attached to the grab point, animations are interruptible and critically damped in feel, and controls remain restrained. Structural surfaces use darker translucent material; small controls use a lighter material without stacking multiple light glass layers. System fonts handle body text while pixel typography remains only where it communicates game identity.

Reduced-motion removes transform interpolation. Reduced-transparency replaces blur with an opaque surface. High-contrast mode strengthens separator and panel boundaries. Separators expose keyboard arrow controls and ARIA separator values.

## Persistence and compatibility

Layout values use versioned local-storage keys and tolerate missing or malformed storage. Existing drag/panel state is left intact. The legacy furniture editing mode remains available and temporarily replaces the iframe exactly as it does now. No backend API or event payload changes are required.

## Verification

Pure layout and scale calculations receive node/vitest regression tests with a red-green cycle. Existing Python, Node, and Pixelworld test suites must remain green. Browser QA verifies full-village visibility, pointer resizing, persistence after reload, zoom controls, iframe readiness, console errors, and responsive behavior.

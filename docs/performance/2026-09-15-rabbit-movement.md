# Rabbit movement and rendering checks

Measured in the existing local 5661 browser at 1341 × 739 CSS/render pixels, with the inspector and the existing Codex placeholder. These are local samples, not a guaranteed frame rate on every device or a many-agent GPU benchmark.

| Check | Before | After |
| --- | --- | --- |
| 2D first summon scale → landed scale | 1.1 → 0.42 | 0.42 → 0.42 |
| 2D movement | about 59 FPS | about 60 FPS, p95 frame 16.7 ms |
| 3D follow/movement sample | about 28 FPS, p95 frame 50.1 ms | about 55 FPS, p95 frame 33.3 ms |
| Shared room serialization, 100 queries through two caches in one frame | 200 | 1 |

The 3D sample retains bloom and FXAA. Redundant canvas/4-sample composer antialiasing was removed, DPR is capped at 1.5, and the sun shadow map is 1024 square. Dynamic actors, collision and event processing remain active. Room-query scopes only share fingerprints within a synchronous simulation frame; edits invalidate the next frame. Regression coverage checks exception cleanup as well.

Inspect `document.documentElement.dataset.worldPerformance` inside the world iframe for simulation/frame telemetry; `#village-3d` exposes `data-performance` for 3D frame intervals, CPU submission time and draw counts. Samples are bounded to 120 frames and DOM output updates once per second. CPU timings do not measure GPU execution directly. `#immersion-ui` exposes `data-sprite-scale` for the summon/landing check.

Validation: frontend suite plus `roomFrameBudget.test.ts`; browser summon, WASD movement and view-switch checks. The reference-based rabbit image generation is separate: its raw checkerboard output is not yet a usable transparent game atlas.

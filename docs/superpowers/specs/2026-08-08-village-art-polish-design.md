# Village Art Polish Design

**Status:** approved by the user's 2026-08-08 request to repair exterior artifacts, add directional animal behavior, enrich the RPG layout, and add detailed same-family interiors.

## Outcome

Polish the fixed-camera Agent village without changing its eight hook destinations or 48×28 navigation footprint. Remove every clipped or stray atlas pixel, make ambient animals move in a direction their art can represent, enrich the village with purposeful RPG landmarks, and replace fake-looking workstations with coherent LimeZu Modern Interiors furniture assemblies.

## Exterior rendering

- Use the verified Puny World plain-grass cell as the seamless base. The Serene Village sheet is a packed object sheet, so unverified cells must never be randomized as terrain.
- Use one verified complete Serene 2×2 tree assembly until additional variants have explicit source coordinates and visual tests.
- Keep complete Serene 5×4 house assemblies. Thresholds use the normal dirt road cell and must not add a second decorative sprite.
- Enrich the map through data-driven scenery: irregular tree clusters, an orchard, fenced pasture edges, riverbank reeds/rocks, a village well, flower pockets, crop tools, crates, and small branch paths. Main A* corridors, building doors, and fixed global visibility remain clear.

The layout follows RPG Maker's town-mapping guidance: terrain and landmarks establish the settlement shape, paths connect functional destinations naturally, and decorations create lived-in zones without blocking navigation.

## Animal motion

The current cow, sheep, chicken, and pig images are side-facing single sprites. Their patrols therefore become horizontal grazing lanes with deterministic pauses. Movement right uses the source orientation; movement left flips horizontally. Vertical-only movement is prohibited until a licensed four-direction animal sheet is introduced.

## Interior furniture

- Every theme has seating: chairs at workstations, sofas in the Rest Cabin, and table seating in the Guild.
- Functional furniture is assembled from the existing LimeZu Modern Interiors Free atlas rather than generic rectangles: desk surface, monitor, keyboard/device cell, and chair are rendered as one workstation group.
- Furniture groups declare their visual footprint so placement preserves walkways and avoids overlaps.
- The current interaction IDs and motion routes remain stable: tool work still cycles computer → bookcase → planning board → computer.
- The free Modern Interiors license remains prototype/non-commercial only.

## Verification

Tests cover clean grass commands, valid Serene frames, complete tree geometry, absent duplicate threshold sprites, horizontal animal facing, scenery clearance, furniture footprints, and required seating. Browser QA checks all eight exterior houses, animal movement, Tool Smithy, Web/MCP Lab, Guild, and Rest Cabin at 1280×720.

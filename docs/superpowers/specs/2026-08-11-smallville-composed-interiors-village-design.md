# Smallville-style composed interiors and village density

Date: 2026-08-11

## Goal

Make the fixed-view Pixelverse village read like a lived-in agent town rather than a grid of isolated props. Use the Stanford Generative Agents / Smallville reference for spatial principles while keeping the project's licensed Serene Village and Modern Office Revamped v1.2 artwork.

## Reference findings

The reference town gets its visual density from connected neighborhood blocks, not from filling every grass tile. A broad main street joins smaller paths, buildings sit in clusters separated by trees, and deliberate open areas become parks or civic spaces. Interiors are readable because furniture is arranged in functional clusters: a desk with equipment and a chair, a central social table with surrounding seats, and storage or living furniture against the perimeter.

## Selected approach

Use editable compositional presets. Each visible setup remains a set of independent `FurnitureDefinition` objects, but authored defaults align their anchors and layers so they render as one workstation or living vignette. This preserves drag, copy, grouping, z-order, save, Hook routing, and user DIY.

Rejected alternatives:

- Pre-rendering furniture groups into new raster sprites would look coherent but would remove item-level editing.
- Procedurally scattering props would add density but make rooms and paths less intentional and harder to test.

## Interior composition

Introduce a small authored-furniture helper that accepts Modern Office asset IDs and optional scale, layer, z-order, and navigation behavior.

Each theme receives distinct zones:

- Rest Cabin: sofa-and-TV lounge, coffee surface, beds, bedside objects, and plants along the perimeter.
- Research Library: planning wall, central map table and chairs, two readable desk/computer stations, and book storage.
- Maker Workshop: two desk/monitor/chair stations, a shared tool bench with surface equipment, repair station, cabinets, and tool wall.
- Collaboration Barn: dispatch and response workstations, a central meeting table with surrounding chairs, message wall, and storage.

Surface electronics and desk accessories share the supporting desk's anchor with a higher layer/z-index and do not block navigation. Hook behavior stays on the supporting workstation or primary chair, so agent routing remains stable.

## Saved-layout migration

Default layout revision 2 is a visual redesign. Stored version-4 layouts are migrated once: authored stock furniture is replaced with the new theme preset while user-created/custom furniture and saved prefabs remain intact. New saves use version 5 and record the authored revision. This makes the redesign visible without deleting DIY additions.

## Village composition

Keep the current 48×28 fixed world and all 12 Hook buildings. Reshape terrain into:

- three horizontal neighborhood streets;
- short door approaches and cross-lanes around building groups;
- a central plaza linked to the river bridges;
- a farm lane and riverside walk;
- small verge pockets rather than large undifferentiated grass fields.

Add intentional clusters of trees, benches, signs, rocks, flowers, crates, and field-edge details. Collision data remains derived from the same buildings, river, fields, and tree trunks, and every station entrance must remain reachable by A*.

## Verification

- Unit tests assert layered workstation composition, preserved Hook coverage, migration behavior, denser connected roads, and reachable entrances.
- Existing world validation, navigation, renderer, interior editor, and persistence suites must pass.
- Browser QA checks the 1280×720 fixed village, at least one room from each theme, stacked furniture alignment, edit mode, and console/network errors.
- CodeGraph is synchronized after final source changes.


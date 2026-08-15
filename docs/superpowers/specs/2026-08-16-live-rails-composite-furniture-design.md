# Live Rails and Composite Furniture Design

Date: 2026-08-16
Status: User-approved design
Target: CLI_Pixelverse map-first WebUI and Pixelworld interior editor

## Objective

Replace the current overlapping HUD with a fixed, no-scroll monitoring layout and present the purchased Modern Office v1.2 modular sprites as complete, usable furniture. Preserve direct game-like editing: left-click selects and drags, marquee selects multiples, right-click opens a compact contextual menu, and Save remains the explicit room-layout persistence boundary.

## Product Outcomes

1. The village is never covered by the CLI status, agent telemetry, Hook status, or dashboard controls.
2. Every agent currently present in the world has an immediately readable live ECG, including resting, waiting, stale, and offline agents.
3. Historical event analytics are removed from the primary experience. The UI prioritizes current agents, current Hook activity, and the village.
4. Modular Modern Office sprite fragments are hidden and exposed only as complete, atomic furniture recipes.
5. User-created furniture groups automatically appear in a durable Grouped Furniture library and can be deleted from the library without deleting room instances.
6. No active dashboard, catalog, help, or monitoring surface requires horizontal or vertical scrolling.

## Information Architecture

### Desktop layout

The root WebUI becomes a four-region grid:

- Top status bar: fixed 44 px height.
- Left agent rail: fixed 248 px width.
- Center village: consumes all remaining space.
- Right Hook rail: fixed 196 px width.

The top bar contains only:

- CLI_Pixelverse identity.
- Connection health.
- Current task/activity.
- Last synchronization time.

The left rail contains the current world agents. Each agent row contains:

- Character portrait and name.
- Current state.
- Current room and Hook category.
- Live ECG waveform.

The center contains only the interactive village viewport and its camera controls. The village automatically fits the available center rectangle. Zoom and pan remain available.

The right rail contains:

- The selected or most recently active Hook.
- Its mapped building.
- A concise current activity sentence.
- One Help control for the Hook-to-building guide.

Events and Agents no longer open historical dashboard cards. Current information is already present in the rails. Help is the only explanatory popover.

### Narrow layout

When the viewport cannot support both side rails without making the map unusable:

- The 44 px status bar remains at the top.
- The village remains above the monitoring area.
- Agent monitoring and Hook status become two bounded regions below the village.
- Two agents appear per page.
- No region scrolls; explicit previous/next controls page the content.

Breakpoints are derived from usable map width rather than device labels. Layout switching must not cover or resize an already open cutaway incorrectly.

## Live Agent ECG

All agents still represented in the current world snapshot receive an ECG row, regardless of whether they are active, resting, waiting, stale, or offline.

Waveform semantics:

- Work/tool use: dense, higher-amplitude pulses.
- Search/thinking: medium-frequency pulses.
- Rest/wait: slow, low-amplitude rhythm.
- Offline/stale: muted dashed or flat trace with explicit text state.

The ECG is live state, not historical analytics. Old event histograms, long event lists, and historical summary statistics are removed from the primary HUD.

Agent pagination is deterministic and stable by agent identity. The active/main agent is first; remaining agents retain stable order between updates. Pages clamp safely when agents disappear.

## Hook Rail and Help

The right rail follows the selected agent when one is selected; otherwise it follows the most recently active agent. It displays:

- Hook semantic: Rest, Search, or Work.
- Current event/activity.
- Current building.
- Missing semantic furniture warning, when applicable.

Help opens a bounded, paginated Hook-to-building guide. Each entry contains the Hook/event family, target building, and example furniture category. The Help panel has no scrollbars, supports keyboard focus and Escape, and never overlaps the village.

## Modern Office Composite Catalog

### Root cause addressed

The current catalog maps each `Modern_Office_Singles_N.png` file one-to-one to a furniture card. The purchased pack includes modular left, center, and right pieces; these are authoring parts, not complete user-facing furniture. For example, 179/180/181, 182/183/184, and 185/186/187 are three complete variants when assembled, not nine independent furnishings.

### Composite recipe manifest

Add a typed composite recipe manifest. Each recipe defines:

- Stable composite ID.
- Localized display name.
- Catalog category.
- Ordered source asset IDs.
- Exact relative offsets in source pixels or room-grid units.
- Combined opaque bounds and footprint.
- Default rotation and scale.
- Furniture semantic and support role.

Recipes use the purchased pixels without resampling or redrawing. Preview thumbnails render all recipe parts into a single bounded card. Dragging a recipe places all parts atomically with one fresh `prefabInstanceId`.

### Catalog visibility rules

- Every source asset consumed by a composite recipe is hidden from the ordinary catalog.
- There is no Advanced Parts category or hidden toggle.
- True standalone source assets remain visible.
- Every modular family in the provisioned Modern Office v1.2 pack must be audited; the fix is not limited to the first storage page.
- Duplicate recipes and ambiguous overlapping recipes are rejected by validation.

### Atomic behavior

A complete composite acts as one furniture object for selection, drag, closest-edge fitting, scaling, rotation, duplication, return-to-library, undo, and Save. Internal part IDs and support relationships remain implementation details. The user may group the composite with other furniture, but cannot accidentally dissolve it into raw catalog fragments.

## Catalog Structure

Visible categories appear in this order:

1. Workstation Sets
2. Grouped Furniture
3. Tables and Seating
4. Storage and Partitions
5. Equipment
6. Decoration

Every category is page-based. Page size adapts to the available catalog width and height. No category uses a scroll container.

## User Group Library

### Creation

When the user marquee-selects or multi-selects furniture and chooses Group from the right-click menu:

1. The room draft receives a fresh group instance ID.
2. A reusable group template is created automatically.
3. The template is named sequentially: Group 01, Group 02, and so on.
4. A composite preview is rendered from its members.
5. The template is inserted into Grouped Furniture immediately.

Grouping is one undoable room mutation. Creating the reusable template is a separate persistent library mutation and must report storage failure explicitly.

### Persistence

User group templates use a versioned storage key independent from built-in catalog data. Built-in catalog regeneration, service restart, Docker rebuild, and code deployment must not overwrite this key. Schema migration preserves valid existing groups and rejects malformed entries without overwriting them.

The persistence contract targets the same browser origin. If storage is unavailable or throws, the group remains usable in the current room/session, but the UI states clearly that the reusable template was not saved.

### Deletion

Each Grouped Furniture card has a dedicated, accessible trash control. Deletion removes only the reusable library template. Existing placed instances stay in their rooms and continue to load correctly. Built-in composite furniture cannot be deleted.

## Context Menu

The right-click context menu remains cursor-adjacent and uses a two-column, two-row grid.

- Maximum outer size: approximately 152 × 92 CSS px.
- Short icon-plus-label actions.
- No wrapping into additional rows.
- No scrolling.
- Placement clamps to the active room bounds.
- A second right-click toggles it closed.
- Left-clicking empty room space closes it.
- The size submenu retains Smaller, Larger, Reset 100%, and Back using the same bounds.

The menu uses immediate pointer-down feedback and restrained, interruptible transitions. Reduced-motion and reduced-transparency preferences remain supported.

## Data Flow

### Catalog

1. Provisioned Modern Office singles load through the existing asset manifest.
2. Composite recipes validate against the catalog.
3. Visible standalone entries exclude all consumed source IDs.
4. Built-in composites and user groups join the same page-based palette model.
5. Drag placement delegates to existing atomic prefab placement and room validation.

### User groups

1. Selection expands to the complete dependency and prefab closure.
2. Group creation normalizes member coordinates relative to the group anchor.
3. Internal IDs and support references become template-local.
4. The versioned user-group store writes a deep-cloned template.
5. Reload reads, validates, migrates, and exposes groups in stable creation order.

### Dashboard

1. Live snapshot derives the current visible agents.
2. Stable pagination selects the current agent page.
3. Each row derives waveform, room, Hook, and state from the current snapshot.
4. The selected/recent agent drives the right Hook rail.
5. Identical snapshots perform no unnecessary DOM writes or live-region announcements.

## Error Handling

- Missing composite source assets: hide the invalid composite, preserve valid catalog entries, and emit one diagnostic.
- Invalid composite geometry: reject at manifest validation and fail tests/build.
- User-group storage read failure: show a persistent warning and block destructive overwrite.
- User-group storage write failure: keep the current room mutation, report that the reusable template was not persisted, and leave Save semantics unchanged.
- Agent feed unavailable: preserve the rails with a clear disconnected state instead of removing the layout.
- Too many agents or Help entries: paginate; never introduce scrollbars.

## Accessibility

- Rails are landmarks with explicit accessible names.
- ECG graphics include text alternatives for state and freshness.
- Pagination controls expose page position and disabled boundaries.
- The Help panel restores focus to its trigger on close.
- Group-delete controls identify the target group by name.
- Color is never the only state signal.
- Keyboard selection, context menu navigation, Escape, and focus-visible behavior remain functional.

## Verification

### Automated

- Composite manifest validates source existence, unique consumption, bounds, offsets, semantic role, and hidden raw IDs.
- Storage-page modular families render as complete recipes, including 179–181, 182–184, and 185–187.
- Drag/drop, move, duplicate, rotate, resize, return, undo, and save operate atomically on composites.
- Group creation automatically creates a persistent template.
- Reload and service rebuild preserve templates at the same browser origin.
- Deleting a template leaves placed instances unchanged.
- Context menu remains within 152 × 92 px, two by two, and room-bounded.
- Desktop and narrow layouts have zero overlap and zero active scroll containers.
- Every visible agent receives an ECG row; pagination remains stable as agents appear/disappear.
- Help content maps all supported Hook families to buildings.
- Reduced motion, reduced transparency, localization, keyboard focus, and live-region dedup remain covered.

### Browser QA

- Inspect the actual Modern Office composite previews and compare them with the purchased source sprites.
- Drag complete furniture from every catalog category.
- Create, reload, place, and delete a user group.
- Verify the 2×2 context menu at room edges.
- Verify desktop three-column and narrow stacked layouts with no overlap or scrollbar.
- Verify multiple active/resting/offline agents show distinct readable ECGs.
- Verify the Help guide and focus lifecycle.

## Non-Goals

- Editing or redistributing the purchased source pack.
- Exposing raw modular fragments through an advanced mode.
- Historical analytics, long event tables, or scrollable dashboards.
- Changing the village map art or room themes in this iteration.
- Replacing the existing semantic Rest/Search/Work routing model.

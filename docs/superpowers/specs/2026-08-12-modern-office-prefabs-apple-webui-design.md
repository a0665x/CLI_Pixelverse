# Modern Office Prefabs and Apple WebUI Design

Date: 2026-08-12  
Status: Approved design

## Goal

Turn the purchased Modern Office Revamped v1.2 furniture from loosely arranged singles into coherent office work zones, while polishing the CLI Pixelverse dashboard with a restrained Apple-style material and interaction system.

The village remains an RPG village. Office density appears inside work-oriented Hook houses, not as an office campus replacing the outdoor world.

## Source Findings

The local `Modern_Office_Revamped_v1.2.zip` contains:

- `Modern_Office_48x48.png`, which preserves the author's intended adjacency between desks, partitions, devices, chairs, and surface decorations.
- Room-builder sheets at 16×16, 32×32, and 48×48.
- Shadowed and shadowless composite sheets.
- More than 300 individual furniture sprites in three resolutions.

The official Modern Office examples use coherent workstation clusters rather than isolated furniture. Some example arrangements require small off-grid offsets, so forcing every visual part onto the same coarse grid cannot reproduce the intended composition. The editor must preserve relative pixel offsets inside a prefab.

## Scope

### Included

- Larger work-oriented interiors.
- Reusable workstation prefabs derived from Modern Office v1.2.
- Correct furniture layering and grouped manipulation.
- Aisle and Hook-anchor validation.
- Safe template adoption that preserves user-saved rooms.
- Dashboard and cutaway visual polish using Apple design principles.
- Accessibility variants for reduced motion, transparency, and increased contrast.

### Excluded

- Replacing the outdoor village layout.
- Replacing Modern Office v1.2 with assets from another family.
- Overwriting a room that already has a saved user layout.
- Automatic AI generation of arbitrary office layouts at runtime.
- A full rewrite of the existing furniture editor.

## Interior Types and Dimensions

Work-oriented themes use an 18×12 editing grid:

- Research Library / Web and MCP work
- Maker Workshop / editing and terminal work
- Tool work areas
- Collaboration / clone and response work

Domestic themes remain compact:

- Rest and idle rooms
- Offline rooms
- Waiting-oriented rooms where a dense office is not semantically appropriate

The larger room is a theme property, not a global constant. Cutaway sizing must remain responsive and fit the available viewport.

## Built-in Prefab Library

The system ships with curated prefabs using only Modern Office Revamped v1.2 assets.

### Four-seat double bench

- Four desks in two opposing rows.
- Central low divider and optional cross divider.
- Four chairs.
- One or two monitors per seat depending on the Hook theme.
- Keyboards, documents, mugs, lamps, and small devices on the surface layer.
- Intended for Web, Tool, Editing, and other high-frequency work Hooks.

### Two-seat L/U pod

- Shared horizontal desk with one or two side returns.
- Two chairs and displays.
- Partial divider or rear privacy panel.
- Optional plant or cabinet outside the interaction footprint.
- Intended for Think, Plan, and Read Hooks.

### Three-seat M-shaped control console

- Shared equipment rail with three work arms.
- Three chairs and monitor groups.
- Tool devices, communication equipment, or status displays on the surface layer.
- Intended for MCP, Clone, Response, and Heartbeat areas.

### Supporting zones

- Meeting table with chairs and planning board.
- File and archive wall.
- Printer, device, and repair station.
- Sofa and refresh corner where the theme benefits from one.

Each theme combines the relevant prefabs into a coherent initial layout. The target work-office density is up to eight formal work seats plus support zones, while retaining usable circulation.

## Prefab Data Model

A built-in or user-created prefab stores:

- Stable prefab ID and localized label.
- Semantic category and intended Hook actions.
- Anchor point used for dragging and placement.
- Minimal opaque-pixel bounding rectangle.
- Individual furniture items with relative coordinates.
- Per-item rotation, scale, asset ID, layer, and z-index.
- Per-item visual offset for small off-grid alignment.
- Interaction anchors relative to the prefab origin.
- A collision footprint that excludes transparent padding and nonblocking surface decoration.

Built-in prefabs and user-created assemblies use the same placement interface. A built-in prefab is immutable as a template, but a placed instance can be dissolved into editable parts.

## Layer Model

The room uses these ordered layers:

1. `floor`: rugs and floor decoration.
2. `furniture`: desk bodies, partitions, cabinets, sofas, and other blockers.
3. `surface`: monitors, keyboards, papers, lamps, mugs, and desk decorations.
4. `agent`: occupants depth-sorted by foot position.
5. `foreground`: tall cabinets, front desk edges, and wall pieces that can occlude agents.

Surface objects may overlap their supporting furniture. They do not independently block navigation. Furniture blockers and interaction footprints remain independent of sprite transparency and visual offsets.

## Editor Behavior

- A prefab follows the pointer as one continuous object while dragging.
- Placement preview uses the union of real blocking footprints, not the full transparent sprite rectangles.
- Rotating a prefab rotates every relative position and selects direction-appropriate assets where available.
- Duplicate creates a new placed instance with fresh item IDs.
- Return to shelf removes the placed instance without deleting the source template.
- Dissolve group converts the instance to ordinary selected furniture parts.
- Undo restores the last editor mutation, including template application, group placement, rotation, collection, and dissolve.
- Existing group, layer, resize, copy, paste, save, and selection tools remain available.

The bottom shelf places required Hook furniture first, followed by built-in workstation templates, user assemblies, and individual furniture categories.

## Navigation and Interaction Rules

- The main route from the door into the office remains at least two tiles wide.
- Long movement uses orthogonal A* routes; no diagonal visual shortcuts are introduced.
- Every required Hook workstation has at least one reachable interaction anchor.
- Chairs and surface objects cannot make the assigned interaction anchor unreachable.
- A prefab preview is invalid when its blockers cross room boundaries, obstruct the entrance, or disconnect a required Hook anchor.
- Agent depth continues to derive from foot Y, with foreground objects able to occlude correctly.

## Saved-layout Protection and Migration

User ownership of saved layouts takes priority over new defaults.

- A room with a valid saved layout is loaded unchanged.
- A room without a saved layout receives the new theme template.
- Applying a template manually always presents a preview.
- Template application is one undoable editor operation.
- Saving after template application writes through the existing persistent layout mechanism.
- Malformed saved data falls back through the existing validation path; it is not silently overwritten until the user explicitly saves.

No bulk migration overwrites all rooms.

## Dashboard Visual System

The dashboard adopts Apple design principles without turning every surface into glass.

### Content layer

- The village remains the dominant, edge-to-edge visual content.
- Sidebars, tables, timeline cards, and inspector surfaces use stable dark standard materials.
- Hierarchy comes primarily from grouping, spacing, typography, and contrast.
- Hard outlines are reduced where spacing or a soft scroll-edge treatment can communicate separation.

### Liquid Glass functional layer

Liquid Glass is reserved for:

- Top-level navigation and status controls.
- Village zoom and fit controls.
- Language and furniture-edit controls.
- Contextual toolbars and menus.
- The cutaway header and transient editor controls.

Glass is not nested on glass. Larger glass surfaces use more opacity, blur, and shadow than small control capsules. Controls use a bright top edge and localized illumination on press to communicate material depth.

### Interaction behavior

- Press feedback begins on pointer down.
- Buttons use a small scale and luminance response with no input lockout.
- Popovers and cutaways originate spatially from their trigger.
- Gesture-driven elements track the pointer one-to-one after their movement threshold.
- Reversible panels enter and leave along the same path.
- Motion is interruptible and uses compositor-friendly transforms and opacity.

### Typography

- Use the platform system font for dashboard UI.
- Pixel fonts remain limited to game-world art where deliberate.
- Headings use tighter tracking and leading; small labels use slightly more tracking for legibility.
- Text remains vector-rendered DOM content, not low-resolution canvas text, wherever it is part of the WebUI.

### Accessibility

- `prefers-reduced-motion`: replace spatial movement with short cross-fades and remove overshoot.
- `prefers-reduced-transparency`: replace glass with a near-solid material and disable blur.
- `prefers-contrast: more`: strengthen borders, text contrast, and panel opacity.
- All controls retain visible focus states and descriptive accessible names.

## Localization

New prefab names, editor actions, preview warnings, and dashboard labels use the existing village locale bridge for Traditional Chinese, English, Japanese, and Korean. English mode must not retain Chinese labels in the new surfaces.

## Failure Handling

- Missing prefab asset: reject the template at validation time and show a localized diagnostic.
- Invalid placement: keep the source on the shelf or restore the last accepted position.
- Unreachable Hook: reject template application and identify the affected Hook station.
- Storage failure: preserve the in-memory draft and show that persistence failed.
- Unsupported rotation asset: rotate the layout geometry and use the closest valid sprite orientation without losing the original asset metadata.

## Testing and Acceptance Criteria

### Prefab tests

- Built-in prefabs reference only Modern Office v1.2 assets.
- Relative positions, layers, offsets, and bounds round-trip through clone and placement.
- Rotate, duplicate, dissolve, return, undo, and save preserve valid IDs and geometry.
- Surface objects overlap supporting desks without becoming navigation blockers.

### Layout tests

- Every new default office fits its 18×12 bounds.
- The door-to-main-aisle route remains at least two tiles wide.
- All required Hook anchors are reachable.
- Existing saved rooms load byte-equivalent furniture state and are not replaced by new defaults.
- Unsaved work themes receive their designated template.

### UI tests

- Glass appears only on the declared functional layer.
- Pressed controls provide immediate feedback.
- Reduced-motion and reduced-transparency media queries provide stable alternatives.
- All new visible copy follows the selected locale.
- Dashboard, cutaway, furniture editing, map zoom/pan, and house opening continue to work together.

### Visual QA

- Open each work theme and confirm that stations read as complete groups at first glance.
- Confirm monitors and desk items sit on desks, chairs face their work surface, and dividers align without visible seams.
- Confirm agents enter through the door and travel along aisles without clipping furniture.
- Confirm dashboard glass controls remain legible over both bright village content and dark panels.
- Verify desktop and compact viewport layouts in a real browser.

## Implementation Boundaries

The implementation should introduce focused modules for built-in prefab definitions, prefab geometry/validation, and dashboard material tokens. Existing editor and scene systems consume these modules rather than accumulating another large block of inline definitions.

The Modern Office source archive remains local and is not committed or redistributed. Only the already-established project asset installation process may copy owned files into the build context.

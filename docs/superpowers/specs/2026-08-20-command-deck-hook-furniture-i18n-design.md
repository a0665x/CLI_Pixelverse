# Command Deck Hook, Furniture, and Localization Design

Date: 2026-08-20
Status: User-approved
Target: CLI_Pixelverse WebUI shell and the embedded `pixelworld_mvp` village/interior experience

## Objective

Turn the existing village UI into an operational command center that answers the important questions at a glance, supports click-through investigation, preserves user-arranged panels, proves Hook and subagent movement in the rendered world, keeps furniture and saved groups geometrically stable between differently sized houses, and localizes every user-visible surface in English, Traditional Chinese, Japanese, and Korean.

The existing village, house art, and interior experience remain the product core. This iteration redesigns the outer operational shell, restores a flowing event timeline, repairs furniture geometry and persistence, and produces README-ready proof screenshots.

## Product Outcomes

1. A first-time viewer can identify overall health, the main agent, active subagents, the current task, and the highest-priority event within three seconds.
2. Clicking an agent, house, Hook, or timeline event selects the same entity everywhere and reveals deeper information without crowding the default view.
3. The left, right, and bottom operational panels can be resized, collapsed, and docked without covering the village; the arrangement survives reload.
4. The timeline again feels like an Airflow-style live task stream instead of a static heartbeat strip.
5. Synthetic and real Hook events visibly move the main agent and subagents through the correct buildings.
6. Furniture and grouped furniture retain identical world size, aspect ratio, rotation, and member spacing when moved between differently sized houses or reloaded.
7. English, Traditional Chinese, Japanese, and Korean switching updates every visible static and dynamic UI string immediately.
8. The README contains one full-village screenshot with moving agents and one Starting Cabin interior screenshot containing an agent.

## Scope Boundaries

- Preserve the current `pixelworld_mvp` village, house themes, and interior art direction.
- Preserve the backend world schema unless an additive diagnostic field is required.
- Preserve existing Hook-to-building semantics, explicit room Save behavior, accessibility preferences, and supported integrations.
- Do not introduce accounts, remote persistence, or a second event protocol.
- Do not replace the village with a conventional table-first dashboard.
- Preserve unrelated dirty and untracked user work. Never reset or clean the worktree.

## Command Deck Information Architecture

### Global Situation Bar

The top bar shows only global operational facts: connection health, active and blocked agent counts, the highest-priority current event, last synchronization time, and the locale selector. It must remain one compact row at desktop widths and expose translated accessible labels.

### Agent Force Rail

The left rail lists the main agent first, followed by subagents and branch sessions ordered by operational urgency and stable identity. A compact card contains identity, lifecycle state, concise task, current building, freshness, and a live signal. The rail is for immediate status, not historical analytics.

### Village Operations Map

The center remains the largest surface. Agent movement, selected paths, building alerts, and focus state must remain legible. Selecting an entity in any command-deck region focuses the corresponding village entity through one shared selection model.

### Intelligence Inspector

The right rail defaults to a concise overall summary. Selecting an agent, building, Hook, or event reveals the corresponding task, source, lifecycle, recent events, route health, and errors. Detail is progressive: the default surface stays compact and full data appears only after selection.

### Mission Trace Timeline

The bottom rail contains one stable lane per visible agent, with the main agent first. Events flow left to right within a bounded live time window and are classified as planning, read, edit, execute, external, delegate, message, complete, or blocked. Directional motion continues between backend snapshots. Clicking an event pauses live-follow, selects its agent, focuses its building, and opens full details in the inspector. A clear control resumes Live mode.

## Docking and Layout Persistence

- Left, right, and bottom rails support direct resizing, collapse, and permitted dock swaps.
- Docking is constrained rather than free-floating: command surfaces cannot overlap the village.
- The village retains a minimum usable width and height at every supported desktop size.
- Layout state is versioned and stored in browser storage. Invalid or obsolete values fall back to safe defaults without destroying the stored value.
- Pointer dragging uses capture, keyboard resizing remains available, and reset restores the command-deck defaults.
- Narrow mode keeps the village first and exposes monitoring through bounded drawers or pages; desktop drag geometry does not leak into narrow mode.

## Shared Selection and View Model

A pure normalizer produces the authoritative visible agents, resolved states, Hook semantics, rooms, timeline events, health diagnostics, and selection identifiers consumed by all command-deck regions and the Pixelworld bridge.

Selection uses one discriminated identifier for `agent`, `building`, `hook`, and `event`. Every click path updates the same model. Rails, inspector, timeline, counts, village focus, and screenshots must not independently infer conflicting state.

Unknown backend values remain visible with translated fallback labels and their raw value. Stale and offline precedence remains explicit. Placeholder suppression must not hide genuine idle, subagent, or branch-session entities.

## Hook and Subagent Movement Contract

- Session/prompt start routes the main agent to thinking or planning.
- Read, Grep, Glob, LS, and search actions route to the file/search building.
- Edit, Write, patch, and equivalent actions route to the code workbench.
- Bash, shell, and execute actions route to the terminal building.
- Web, MCP, GitHub, and other external tools route to the tool forge.
- `SubagentStart` routes the main agent through the clone building and creates a visible `role=subagent` entity.
- A subagent tool event routes that subagent from the clone building to the appropriate task building.
- `SubagentStop` or completion returns the same child to the clone building; it remains visible unless explicit lifecycle rules make it removable.
- Tool completion remains a working phase. Only session completion or an explicit idle state returns the main agent to standby.

Synthetic verification must capture both paths:

```text
main agent: think/planning -> clone building -> standby
subagent: clone building -> task building -> clone building
```

## Runtime Self-Monitoring

The frontend derives non-destructive diagnostics continuously:

- Every authoritative agent must have a village entity and force-rail card.
- The rendered building must agree with the latest resolved Hook target.
- A newly started subagent must produce a route with a visible displacement, not only a text change.
- Route planning failure, stalled movement, SSE disconnect, stale snapshots, and untranslated copy produce explicit health findings.
- The global situation bar shows the highest-severity finding; the inspector provides evidence and recovery guidance.

Diagnostics never mutate backend state or fabricate successful movement. Reduced-motion mode may shorten or remove animation but must still prove a position transition.

## Canonical Furniture Geometry

Furniture geometry must no longer mix source pixels, room-local percentages, CSS scaling, and collision footprints.

Each placed item resolves to canonical world geometry containing a stable anchor, width, height, scale, and rotation. Position conversion changes only the anchor. Moving an item between houses cannot change its world dimensions, aspect ratio, rotation, or opaque/collision bounds.

Single furniture, built-in composites, and user groups use the same bounds calculation for sprite rendering, preview rendering, collision, house containment, interaction anchors, drag ghosts, and persistence.

### Grouped Furniture

A saved group stores a group origin plus member-local world offsets and member canonical geometry. Placing the group in another house applies translation to the origin; it does not normalize members against the destination house dimensions. Member spacing is invariant.

The store uses a versioned schema and a non-destructive migration from the existing format. Malformed data is rejected and reported without overwriting the original storage value. Deleting a reusable group template never deletes placed room instances. Browser reload, service restart, Docker rebuild, and switching between differently sized houses must preserve geometry at the same origin.

The Starting Cabin is the primary interior acceptance target, with at least one differently sized house used for cross-house invariance testing.

## Complete Localization

A single locale registry owns all visible copy for `en-US`, `zh-TW`, `ja-JP`, and `ko-KR`, including:

- top bar, rail and inspector headings;
- buttons, hints, empty states, warnings, errors, and recovery guidance;
- Hook, state, event, building, furniture category, and context-menu labels;
- dynamic status sentences, pagination, timestamps, and live-mode announcements;
- accessibility names, descriptions, and keyboard instructions.

Rendering code receives translated strings or translation keys rather than embedding visible English or Chinese. Switching locale re-renders the current snapshot, selection, editor, inspector, and timeline immediately. Raw external task text is preserved, but its type and surrounding status sentence are localized. Missing keys fail automated coverage checks and use an explicit readable fallback during runtime.

## Event Motion and Performance

Timeline motion is display-driven and independent from snapshot arrival. Existing DOM/SVG/canvas objects are advanced at a capped visual frequency; snapshots only update semantic data. Reduced-motion mode uses a static or low-frequency representation.

The live window is bounded by time and event count. Old events are discarded from the rendered model without changing backend history. Animation does not rebuild the full timeline or rail DOM every frame.

## Error Handling

- SSE loss preserves the last snapshot, marks it stale, and switches to the existing polling fallback.
- Route failure keeps the agent at the last valid point and emits a diagnostic with source and destination buildings.
- Furniture migration failure leaves the original data untouched and disables destructive Save until the user receives a clear explanation.
- Layout persistence failure keeps the current in-memory arrangement and reports that it will not survive reload.
- Missing translation keys show a readable fallback and appear in the self-monitoring inspector.
- Screenshot generation fails rather than publishing an empty village, missing agent, closed cabin, or untranslated UI.

## Accessibility

- All rails are named landmarks and all resize handles support keyboard operation.
- Color is never the only status or timeline distinction.
- Timeline nodes, agents, buildings, and furniture remain keyboard-selectable.
- Inspector focus follows an explicit user selection but does not jump on background updates.
- Collapsed panels remain discoverable and reset is always available.
- Reduced motion and reduced transparency remain supported.

## Verification

### Automated

- Pure tests for shared selection, authoritative agent normalization, Hook routing, self-monitoring findings, docking constraints, and persistence migration.
- Hook integration tests for main-agent and subagent lifecycle identity and target-room transitions.
- Geometry invariance tests across differently sized houses for single items, built-in composites, and user groups.
- Store tests for reload, migration failure, template deletion, and placed-instance preservation.
- Four-locale key parity and DOM coverage tests, including dynamic messages and accessibility labels.
- Timeline tests proving visual advancement between identical snapshots, bounded retention, click-to-focus, pause/resume, and reduced-motion behavior.
- Full Python, Node/MJS, TypeScript, production build, and shell syntax regressions.

### Browser QA

- Desktop command-deck validation at 1440×900 and 1024×768.
- Narrow validation at 800×450 or an equivalent constrained viewport.
- Resize, collapse, dock swap, persistence, reset, and no-overlap checks.
- Click-through checks from agent, building, Hook, and timeline to one synchronized inspector/village selection.
- English, Traditional Chinese, Japanese, and Korean switching with visible-copy audit.
- Synthetic Hook scenarios, including visible subagent movement and route evidence.
- Furniture/group creation, Save, reload, cross-house placement, and invariant geometry checks.

### Documentation Screenshots

Create stable, repository-owned images under `docs/assets/`:

1. A full-village command-deck view with at least the main agent and one subagent visibly engaged in movement.
2. A Starting Cabin interior view containing an agent and representative furniture.

Embed both images near the top of `README.md` with localized-neutral English alt text suitable for GitHub rendering.

## Acceptance Criteria

- No active command surface covers the central village.
- Default desktop layout has materially less unused space and more readable type than the current page.
- The top bar, force rail, inspector, and timeline agree on agent identity, state, room, and event.
- A synthetic subagent is visibly displaced between the clone building and a task building.
- Furniture/group geometry remains invariant across at least two differently sized houses and after reload.
- Every visible product-owned string switches correctly among all four locales.
- The Airflow-style timeline visibly advances without requiring a new backend snapshot.
- Both required screenshots contain visible agents and are embedded in the README.

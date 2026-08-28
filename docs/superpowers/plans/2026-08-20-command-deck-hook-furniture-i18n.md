# Command Deck Hook, Furniture, and Localization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a draggable command-deck WebUI with synchronized drill-down, a flowing mission timeline, complete four-locale copy, verified Hook/subagent movement, invariant cross-house furniture groups, and two README screenshots.

**Architecture:** Extend the existing root WebUI rails with pure command-deck view models, health diagnostics, selection, docking, and a display-driven mission trace, while retaining `pixelworld_mvp` as the center village renderer. Repair furniture at the Pixelworld data boundary by using one canonical grid/world geometry for single items, composites, saved groups, collision, and rendering; preserve the existing HTTP world contract and iframe locale/message bridge.

**Tech Stack:** Python 3, FastAPI, vanilla ES modules and DOM/CSS, TypeScript, Phaser 3, Vitest, Node test runner, pytest, Docker Compose, Chromium/Playwright-compatible browser automation.

## Global Constraints

- Preserve the current `pixelworld_mvp` village, house themes, interior art, Hook-to-building semantics, and explicit Save behavior.
- English, Traditional Chinese, Japanese, and Korean must cover every product-owned visible string, including dynamic and accessible copy.
- Command surfaces may resize, collapse, and dock only within bounded regions; they never cover the village.
- The timeline animates independently from backend snapshot frequency and respects reduced motion.
- Furniture position conversion cannot mutate canonical size, rotation, aspect ratio, or group-member spacing.
- Malformed persisted layouts/groups are reported without overwriting the original storage value.
- Preserve unrelated dirty and untracked user work. Stage exact files only; never reset or clean the worktree.
- Use CodeGraph before broad source exploration and follow red-green-refactor for every behavioral change.

---

### Task 1: Establish the Authoritative Command-Deck Model and Health Findings

**Files:**
- Create: `public/command_deck_model.mjs`
- Create: `tests/test_command_deck_model.mjs`
- Modify: `public/live_agent_rails.mjs`
- Modify: `tests/test_live_agent_rails.mjs`

**Interfaces:**
- Consumes: root `/api/world` snapshots and existing `normalizeVisibleAgents()`/`resolvedAgentActivity()` semantics.
- Produces:

```js
export function buildCommandDeckModel(snapshot, options = {})
// => { agents, events, selectionIndex, findings, situation }

export function resolveCommandSelection(model, selection)
// selection => { kind: 'agent'|'building'|'hook'|'event', id: string } | null

export function commandDeckFindings(model, rendered = {})
// => [{ id, severity: 'info'|'warning'|'critical', agentId?, buildingId?, messageKey, params }]
```

- [ ] **Step 1: Write failing model tests**

Add cases proving that the main agent sorts first, real subagents remain visible, stale placeholders are suppressed only when replaced, events retain stable IDs, every selection resolves to one shared agent/building/event record, and missing village entities or room mismatches produce findings.

```js
test('one authoritative model drives agent, event, and building selection', () => {
  const model = buildCommandDeckModel(snapshotWithMainAndSubagent);
  const selected = resolveCommandSelection(model, { kind: 'event', id: 'evt-sub-tool' });
  assert.equal(selected.agent.id, 'synthetic-subagent-1');
  assert.equal(selected.buildingId, 'tool_forge');
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `node --test tests/test_command_deck_model.mjs tests/test_live_agent_rails.mjs`

Expected: failure because `command_deck_model.mjs` and the shared model interfaces do not exist.

- [ ] **Step 3: Implement the minimal pure model**

Normalize identity, resolved lifecycle, target room, Hook semantic, event category, freshness, and priority once. Build indexes by agent, building, Hook, and event. Keep raw external task text but expose translation keys for product-owned labels. Add findings without mutating snapshots.

- [ ] **Step 4: Route the existing agent rail through the model**

Make `buildLiveAgentRail()` accept `model.agents` or use the same pure normalization helper. Remove any independent state/room inference that could disagree with the timeline or village bridge.

- [ ] **Step 5: Run GREEN and regressions**

Run: `node --test tests/test_command_deck_model.mjs tests/test_live_agent_rails.mjs tests/test_agent_timeline_graphs.mjs`

Expected: all focused tests pass and existing identity ordering remains stable.

- [ ] **Step 6: Commit Task 1 exactly**

```bash
git add public/command_deck_model.mjs public/live_agent_rails.mjs \
  tests/test_command_deck_model.mjs tests/test_live_agent_rails.mjs
git diff --cached --check
git commit -m "feat: unify command deck state and health"
```

---

### Task 2: Build the Bounded Draggable Command-Deck Layout

**Files:**
- Modify: `public/index.html`
- Create: `public/command_deck_layout.mjs`
- Create: `tests/test_command_deck_layout.mjs`
- Modify: `public/app.mjs`
- Modify: `tests/test_dashboard_layout.py`
- Create: `tests/test_dashboard_density.py`
- Modify: `tests/test_live_rail_layout.mjs`

**Interfaces:**
- Consumes: the current left/right rail controller and existing `workbench_layout.mjs` migration values.
- Produces:

```js
export const COMMAND_DECK_LAYOUT_KEY = 'pixelverse:command-deck-layout:v2';
export function normalizeCommandDeckLayout(value, viewport)
// => { leftWidth, rightWidth, bottomHeight, leftDock, rightDock, collapsed }
export function createCommandDeckLayoutController(options)
// => { start(), reset(), collapse(region), swapSides(), getLayout(), destroy() }
```

- [ ] **Step 1: Write failing geometry and persistence tests**

Cover safe minimum village dimensions, resize clamping, keyboard increments, collapse/restore, left/right dock swap, v1 rail/workbench migration, invalid-storage fallback without destructive overwrite, reload persistence, and narrow-mode isolation.

- [ ] **Step 2: Write failing structural layout tests**

Assert that the HTML contains named top, left, center, right, and bottom regions; resize handles expose separator semantics; collapse/reset/dock controls exist; and no command panel is positioned as a map-covering desktop overlay.

- [ ] **Step 3: Run RED tests**

Run: `node --test tests/test_command_deck_layout.mjs tests/test_live_rail_layout.mjs && python3 -m pytest -q tests/test_dashboard_layout.py`

Expected: failures for the missing v2 controller and command-deck regions.

- [ ] **Step 4: Implement v2 layout state and controller**

Reuse current pointer-capture behavior but persist a single versioned object. Constrain all dimensions against the measured viewport and minimum village area. Implement dock swapping through CSS data attributes rather than moving stateful DOM children.

- [ ] **Step 5: Recompose `index.html` and CSS**

Create a compact global situation bar, agent force rail, central Pixelworld iframe, intelligence inspector, and mission trace. Increase readable body type, remove redundant whitespace, use dense but breathable spacing, and preserve responsive/narrow behavior. Wire collapse, swap, reset, and direct resize controls from `app.mjs`.

- [ ] **Step 6: Run GREEN and viewport regressions**

Run: `node --test tests/test_command_deck_layout.mjs tests/test_live_rail_layout.mjs && python3 -m pytest -q tests/test_dashboard_layout.py tests/test_dashboard_density.py`

Expected: bounded geometry passes at 1440×900, 1024×768, and narrow fixtures with no overlap contracts violated.

- [ ] **Step 7: Commit Task 2 exactly**

```bash
git add public/index.html public/app.mjs public/command_deck_layout.mjs \
  tests/test_command_deck_layout.mjs tests/test_dashboard_layout.py \
  tests/test_dashboard_density.py \
  tests/test_live_rail_layout.mjs
git diff --cached --check
git commit -m "feat: add bounded command deck layout"
```

---

### Task 3: Restore the Airflow-Style Mission Trace and Unified Drill-Down

**Files:**
- Create: `public/mission_trace.mjs`
- Create: `tests/test_mission_trace.mjs`
- Modify: `public/agent_timeline_graphs.mjs`
- Modify: `tests/test_agent_timeline_graphs.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`
- Modify: `public/pixelworld_embed.mjs`
- Modify: `tests/test_pixelworld_embed.mjs`

**Interfaces:**

```js
export function buildMissionTrace(model, options)
// => { lanes, windowStartMs, windowEndMs, live, selectedEventId }
export function createMissionTraceController(options)
// => { setModel(model), select(eventId), resume(), start(), stop() }
export function commandDeckFocusMessage(selection, sequence)
// => { type: 'pixelverse.command.focus', selection, sequence }
```

- [ ] **Step 1: Write failing mission-trace tests**

Prove per-agent stable lanes, event classification, bounded event retention, x-position advancement between identical snapshots, pause-on-select, resume Live mode, reduced-motion behavior, and event-to-agent/building resolution.

- [ ] **Step 2: Write failing iframe focus-contract tests**

Prove agent/building selections become same-origin `pixelverse.command.focus` messages with monotonic sequence values and reject foreign-origin/stale messages.

- [ ] **Step 3: Run RED tests**

Run: `node --test tests/test_mission_trace.mjs tests/test_agent_timeline_graphs.mjs tests/test_pixelworld_embed.mjs`

Expected: missing controller and focus message contracts fail.

- [ ] **Step 4: Implement the display-driven trace**

Keep semantic event nodes stable between snapshots. Advance the live window with `requestAnimationFrame` at a capped rate, update only timeline transforms/paths, and fall back to low-frequency static refresh under reduced motion. Do not rebuild the whole lane DOM per frame.

- [ ] **Step 5: Wire one selection path**

Clicks from an agent card, building/Hook entry, and timeline event call the same selection function. Update village focus, inspector detail, selected styling, and paused/live trace state together. Background snapshots must not steal focus.

- [ ] **Step 6: Run GREEN and regressions**

Run: `node --test tests/test_mission_trace.mjs tests/test_agent_timeline_graphs.mjs tests/test_pixelworld_embed.mjs tests/test_live_ecg_controller.mjs`

Expected: trace advances without new snapshots, focus is synchronized, and ECG remains independent.

- [ ] **Step 7: Commit Task 3 exactly**

```bash
git add public/mission_trace.mjs public/agent_timeline_graphs.mjs public/app.mjs \
  public/index.html public/pixelworld_embed.mjs tests/test_mission_trace.mjs \
  tests/test_agent_timeline_graphs.mjs tests/test_pixelworld_embed.mjs
git diff --cached --check
git commit -m "feat: restore live mission trace drilldown"
```

---

### Task 4: Complete Four-Locale Coverage Across the Shell and Village

**Files:**
- Modify: `public/ui_strings.mjs`
- Create: `tests/test_command_deck_i18n.mjs`
- Modify: `tests/test_frontend_i18n.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`
- Modify: `pixelworld_mvp/src/i18n/villageLocale.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLocale.ts`
- Modify: `pixelworld_mvp/tests/villageLocale.test.ts`
- Modify: `pixelworld_mvp/tests/interiorLocale.test.ts`

**Interfaces:**

```js
export const SUPPORTED_LOCALES = ['en-US', 'zh-TW', 'ja-JP', 'ko-KR'];
export function uiText(locale, key, params = {})
export function missingLocaleKeys(catalog, baseline = 'en-US')
```

- [ ] **Step 1: Write failing locale parity tests**

Require identical nested key sets across all four locales for top bar, rails, inspector, layout controls, timeline, diagnostics, Hook/state/event/building/furniture labels, empty/error states, and accessible names. Add formatting tests for dynamic counts and timestamps.

- [ ] **Step 2: Write failing DOM coverage tests**

Scan product-owned visible strings and ARIA attributes in `index.html`/rendered fixtures. Fail on untranslated hard-coded copy outside explicitly allowed raw external fields. Prove switching locale re-renders an already-present snapshot and selection immediately.

- [ ] **Step 3: Run RED tests**

Run: `node --test tests/test_command_deck_i18n.mjs tests/test_frontend_i18n.mjs && cd pixelworld_mvp && npx vitest run tests/villageLocale.test.ts tests/interiorLocale.test.ts`

Expected: failures identify missing command-deck, dynamic, and accessibility keys.

- [ ] **Step 4: Consolidate and fill all four catalogs**

Move product-owned shell text behind `uiText()`. Complete `villageLocale.ts` and `interiorLocale.ts` key parity. Keep external task strings raw but translate surrounding sentences. Preserve the existing same-origin `pixelverse.locale.update` bridge.

- [ ] **Step 5: Re-render every active surface on locale change**

Update situation bar, agent rail, inspector, trace, help, editor, context menu, live announcements, and open cutaway immediately from current state. Do not wait for a new world snapshot.

- [ ] **Step 6: Run GREEN and build**

Run: `node --test tests/test_command_deck_i18n.mjs tests/test_frontend_i18n.mjs && cd pixelworld_mvp && npx vitest run tests/villageLocale.test.ts tests/interiorLocale.test.ts && npm run typecheck && npm run build`

Expected: four catalogs have complete parity and the TypeScript build succeeds.

- [ ] **Step 7: Commit Task 4 exactly**

```bash
git add public/ui_strings.mjs public/app.mjs public/index.html \
  tests/test_command_deck_i18n.mjs tests/test_frontend_i18n.mjs \
  pixelworld_mvp/src/i18n/villageLocale.ts \
  pixelworld_mvp/src/rendering/interiorLocale.ts \
  pixelworld_mvp/tests/villageLocale.test.ts pixelworld_mvp/tests/interiorLocale.test.ts
git diff --cached --check
git commit -m "feat: localize every command deck surface"
```

---

### Task 5: Prove Hook and Subagent Movement With Runtime Diagnostics

**Files:**
- Modify: `scripts/codex_pixelverse_hook.py`
- Modify: `pixelverse_server.py`
- Modify: `tests/test_hermes_integration.py`
- Modify: `tests/test_fastapi_service.py`
- Modify: `run.sh`
- Create: `tests/test_command_deck_hook_smoke.py`
- Modify: `scripts/render_local_ui_trajectory.py`
- Modify: `spec/modules/integration-and-events.md`
- Modify: `spec/modules/testing-and-ops.md`

**Interfaces:**
- Preserve `POST /api/event`, `POST /api/heartbeat`, `/api/world`, and SSE schemas.
- Add only optional debug evidence when needed:

```json
{
  "route_evidence": {
    "from_room": "clone_bay",
    "to_room": "tool_forge",
    "position_changed": true,
    "event_id": "..."
  }
}
```

- [ ] **Step 1: Write failing lifecycle tests**

Cover stable child identity from `SubagentStart` through child tool activity and `SubagentStop`; main-agent clone routing; child `clone_bay -> tool_forge -> clone_bay`; tool completion retaining working state; explicit session completion returning main agent to standby.

- [ ] **Step 2: Write failing smoke evidence tests**

Require `PIXELVERSE_TEST_HOOK_TARGET=clone_bay` to emit two agent plans with distinct route points and positive displacement. Reject a result that only changes text or room labels.

- [ ] **Step 3: Run RED tests**

Run: `python3 -m pytest -q tests/test_hermes_integration.py tests/test_fastapi_service.py tests/test_command_deck_hook_smoke.py`

Expected: new child movement/evidence assertions fail where runtime identity or route proof is incomplete.

- [ ] **Step 4: Repair normalization and evidence generation**

Keep explicit special-state precedence, then honor valid non-idle `target_room`, role routing, and tool fallback. Preserve child IDs across lifecycle events. Record source/destination positions and event IDs in debug artifacts without fabricating backend motion success.

- [ ] **Step 5: Extend `test-hook` acceptance**

Make `run.sh test-hook` fail when the expected main/subagent agents, rooms, routes, or displacement evidence are absent. Preserve existing artifacts and add clear human-readable summary output.

- [ ] **Step 6: Run GREEN and shell checks**

Run: `python3 -m pytest -q tests/test_hermes_integration.py tests/test_fastapi_service.py tests/test_command_deck_hook_smoke.py && bash -n run.sh`

Expected: lifecycle and displacement assertions pass.

- [ ] **Step 7: Commit Task 5 exactly**

```bash
git add scripts/codex_pixelverse_hook.py pixelverse_server.py run.sh \
  scripts/render_local_ui_trajectory.py tests/test_hermes_integration.py \
  tests/test_fastapi_service.py tests/test_command_deck_hook_smoke.py \
  spec/modules/integration-and-events.md spec/modules/testing-and-ops.md
git diff --cached --check
git commit -m "fix: prove hook and subagent world movement"
```

---

### Task 6: Make Furniture and Saved Groups Invariant Across Houses

**Files:**
- Modify: `pixelworld_mvp/src/world/types.ts`
- Create: `pixelworld_mvp/src/rendering/canonicalFurnitureGeometry.ts`
- Create: `pixelworld_mvp/tests/canonicalFurnitureGeometry.test.ts`
- Modify: `pixelworld_mvp/src/rendering/prefabGeometry.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorSelection.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorLayoutEditor.ts`
- Modify: `pixelworld_mvp/src/rendering/interiorPrefabStore.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts`
- Modify: `pixelworld_mvp/tests/interiorPrefabStore.test.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts`
- Modify: `pixelworld_mvp/tests/interiorSelection.test.ts`

**Interfaces:**

```ts
export interface CanonicalFurnitureGeometry {
  anchor: GridPoint;
  width: number;
  height: number;
  scale: FurnitureScale;
  rotation: FurnitureRotation;
}

export function canonicalFurnitureGeometry(item: FurnitureDefinition): CanonicalFurnitureGeometry;
export function translateFurnitureGeometry(item: FurnitureDefinition, delta: GridPoint): FurnitureDefinition;
export function geometryInvariant(before: FurnitureDefinition, after: FurnitureDefinition): boolean;
```

Saved user group schemas must store a version, group origin, and member-local canonical offsets. Existing valid stores migrate in memory; Save writes the new version only after successful validation.

- [ ] **Step 1: Write failing canonical-geometry tests**

Use the Starting Cabin and a differently sized work house. Prove that translating identical single furniture and built-in composites preserves width, height, aspect ratio, scale, rotation, alpha bounds, collision bounds, and member spacing.

- [ ] **Step 2: Write failing group persistence tests**

Create a multi-item group, save, reload, place in both houses, and compare all pairwise member offsets and bounds. Cover old-version migration, malformed-store non-overwrite, template deletion preserving placed instances, and Docker/browser-origin-independent data semantics.

- [ ] **Step 3: Run RED tests**

Run: `cd pixelworld_mvp && npx vitest run tests/canonicalFurnitureGeometry.test.ts tests/interiorPrefabStore.test.ts tests/interiorSelection.test.ts tests/interiorCutawaySystem.test.ts tests/interiorCutawayDomOverlay.test.ts`

Expected: destination-house normalization exposes at least one size or spacing mismatch before the fix.

- [ ] **Step 4: Introduce canonical geometry and migrate stores**

Make grid/world units authoritative. Bounds, rendering, drag ghosts, previews, placement, collision, interaction anchors, and persistence call the same geometry functions. Store groups as origin plus member-local offsets; destination placement applies translation only. Reject invalid migration without writing storage.

- [ ] **Step 5: Wire the editor without changing Save semantics**

Ensure group creation remains one room mutation plus one reusable-template mutation. Existing placed instances survive template deletion. Cross-house paste/place uses canonical translation and re-validates containment/collision without scaling to fit.

- [ ] **Step 6: Run GREEN, typecheck, and build**

Run: `cd pixelworld_mvp && npx vitest run tests/canonicalFurnitureGeometry.test.ts tests/interiorPrefabStore.test.ts tests/interiorSelection.test.ts tests/interiorCutawaySystem.test.ts tests/interiorCutawayDomOverlay.test.ts && npm run typecheck && npm run build`

Expected: geometry invariance and persistence tests pass for both houses.

- [ ] **Step 7: Commit Task 6 exactly**

```bash
git add pixelworld_mvp/src/world/types.ts \
  pixelworld_mvp/src/rendering/canonicalFurnitureGeometry.ts \
  pixelworld_mvp/src/rendering/prefabGeometry.ts \
  pixelworld_mvp/src/rendering/interiorSelection.ts \
  pixelworld_mvp/src/rendering/interiorLayoutEditor.ts \
  pixelworld_mvp/src/rendering/interiorPrefabStore.ts \
  pixelworld_mvp/src/rendering/InteriorCutawaySystem.ts \
  pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts \
  pixelworld_mvp/tests/canonicalFurnitureGeometry.test.ts \
  pixelworld_mvp/tests/interiorPrefabStore.test.ts \
  pixelworld_mvp/tests/interiorSelection.test.ts \
  pixelworld_mvp/tests/interiorCutawaySystem.test.ts \
  pixelworld_mvp/tests/interiorCutawayDomOverlay.test.ts
git diff --cached --check
git commit -m "fix: preserve furniture geometry across houses"
```

---

### Task 7: Browser QA, Screenshots, README, and Final Documentation

**Files:**
- Create: `scripts/command_deck_browser_smoke.py`
- Create: `tests/test_command_deck_browser_smoke.py`
- Create: `docs/assets/command-deck-village.png`
- Create: `docs/assets/starting-cabin-agent.png`
- Modify: `README.md`
- Modify: `spec/PROJECT_MAP.md`
- Modify: `spec/modules/world-frontend.md`
- Modify: `spec/modules/testing-and-ops.md`

**Interfaces:**
- Browser smoke output: `tmp/command_deck_browser_smoke.json` with viewport, locale coverage, layout bounds, selected entity, Hook routes, furniture invariants, screenshot paths, console errors, and pass/fail.

- [ ] **Step 1: Write failing browser-smoke contract tests**

Require explicit checks for 1440×900, 1024×768, and narrow mode; panel resize/collapse/dock/reload/reset; zero village overlap; agent/building/timeline drill-down; four locale switches; subagent displacement; Starting Cabin opening; furniture save/reload/cross-house invariance; and zero page errors.

- [ ] **Step 2: Run RED test**

Run: `python3 -m pytest -q tests/test_command_deck_browser_smoke.py`

Expected: failure because the browser smoke script and required artifact schema do not exist.

- [ ] **Step 3: Implement deterministic browser QA and screenshot capture**

Drive the running service with a fixed synthetic scenario. Wait for fonts/assets/world readiness, inject the clone-bay scenario, verify actual DOM/canvas/iframe state, and capture PNGs only after agents are visible. Open the Starting Cabin through the supported focus/cutaway interaction and verify an agent is inside before the interior capture.

- [ ] **Step 4: Run service and browser acceptance**

Run:

```bash
PIXELVERSE_AGENT_KIND=codex PIXELVERSE_EXPOSURE_MODE=localhost ./run.sh down_up
PIXELVERSE_TEST_HOOK_DELAY=5 PIXELVERSE_TEST_HOOK_TARGET=clone_bay ./run.sh test-hook
python3 scripts/command_deck_browser_smoke.py --base-url http://127.0.0.1:5660 --allow-mutation
```

Expected: JSON reports pass, both screenshots exist, village screenshot contains main/subagent evidence, and cabin screenshot contains an agent.

- [ ] **Step 5: Embed screenshots and update progressive docs**

Place both images near the README introduction:

```md
![CLI_Pixelverse command deck with active village agents](./docs/assets/command-deck-village.png)

![Starting Cabin interior with an active agent](./docs/assets/starting-cabin-agent.png)
```

Update the project map and frontend/testing specs with the command-deck model, layout, mission trace, self-monitoring, canonical furniture geometry, and repeatable browser-smoke command.

- [ ] **Step 6: Run complete verification**

Run:

```bash
node --test tests/*.mjs
python3 -m pytest -q -o faulthandler_timeout=10
bash -n run.sh
cd pixelworld_mvp && npx vitest run && npm run typecheck && npm run build
```

Expected: every command exits 0. Re-run the browser smoke after the production build and inspect both final screenshots.

- [ ] **Step 7: Commit Task 7 exactly**

```bash
git add scripts/command_deck_browser_smoke.py tests/test_command_deck_browser_smoke.py \
  docs/assets/command-deck-village.png docs/assets/starting-cabin-agent.png \
  README.md spec/PROJECT_MAP.md spec/modules/world-frontend.md \
  spec/modules/testing-and-ops.md
git diff --cached --check
git commit -m "docs: show verified command deck and cabin"
```

---

## Final Review Gate

- [ ] Compare the completed diff against every acceptance criterion in `docs/superpowers/specs/2026-08-20-command-deck-hook-furniture-i18n-design.md`.
- [ ] Confirm no unrelated dirty files were staged or rewritten.
- [ ] Run `git status --short`, record the exact verification commands and results, and retain browser smoke JSON plus both screenshots as evidence.
- [ ] Invoke `verification-before-completion` before claiming the work is complete.

# Responsive Agent Detail and Village Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open complete Agent details from either the Roster or village while making the top status, Roster, and desktop detail boundaries safely resizable.

**Architecture:** Add a pure detail projection and a focused responsive detail view, then route every Agent activation through one orchestration function in `app.mjs`. Add a small versioned village-first layout controller for the three approved dimensions, leaving the older command-deck layout migration intact and guaranteeing minimum village space through normalization.

**Tech Stack:** Vanilla ES modules, DOM/SVG/CSS, Node `node:test`, Python pytest, existing CDP Chromium smoke runner, existing four-locale bundles.

## Global Constraints

- Desktop uses a right-side drawer; viewport widths below `900px` use a modal dialog.
- Roster card click/Enter/Space and village character click open the same canonical Agent detail.
- Detail close restores focus to the original trigger when it is still connected.
- Desktop top status height, Roster height, and detail width support pointer and keyboard resize.
- Layout values persist under one versioned key and reset by double-click or Reset layout.
- Village retains at least `520px` width and `280px` height on desktop.
- Narrow layouts hide splitters and use scrolling/collapse; adjacent content never overlaps.
- ECG uses the existing shared controller; do not create a timer per detail or card.
- Product copy is complete and single-locale for exactly `en-US`, `zh-TW`, `ja-JP`, and `ko-KR`.
- External names, tasks, paths, commands, tool identifiers, and payload are marked external and remain verbatim.

---

### Task 1: Canonical Agent Detail Projection

**Files:**
- Create: `public/agent_detail_model.mjs`
- Create: `tests/test_agent_detail_model.mjs`
- Modify: `public/command_deck_model.mjs`
- Modify: `tests/test_command_deck_model.mjs`

**Interfaces:**
- Consumes: canonical Agent and indexed events from `buildCommandDeckModel()`.
- Produces: `buildAgentDetail(model, agentId, { nowMs })`.
- Output: `{ id, name, role, state, pixelState, signal, task, room, tool, hook, processIdentity, sessionIdentity, lastSeen, recentEvents, portraitInput, externalFields } | null`.

- [ ] **Step 1: Write failing projection tests**

```javascript
// tests/test_agent_detail_model.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAgentDetail } from '../public/agent_detail_model.mjs';
import { buildCommandDeckModel } from '../public/command_deck_model.mjs';

test('detail projects identity state location tooling and only this Agent recent events', () => {
  const model = buildCommandDeckModel({
    server_time_ms: 10_000,
    agents: [{
      agent: 'codex-cli:42', name: 'RAW_NAME', role: 'main_agent', state: 'working',
      pixel_state: 'editing_files', task: 'RAW_TASK', room_key: 'code_workbench',
      tool_name: 'apply_patch', process_id: 42, instance_name: 'terminal-a', last_seen_ms: 9_950,
    }],
    events: [
      { id: 'own', agent: 'codex-cli:42', event: 'tool.started', preview: 'RAW_EVENT' },
      { id: 'other', agent: 'other', event: 'status', preview: 'IGNORE' },
    ],
  });

  const detail = buildAgentDetail(model, 'codex-cli:42', { nowMs: 10_000 });
  assert.equal(detail.id, 'codex-cli:42');
  assert.equal(detail.signal.kind, 'busy');
  assert.equal(detail.room.key, 'code_workbench');
  assert.deepEqual(detail.recentEvents.map(({ id }) => id), ['own']);
  assert.deepEqual(detail.externalFields, ['name', 'task', 'tool', 'recentEvents']);
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/test_agent_detail_model.mjs tests/test_command_deck_model.mjs`

Expected: FAIL because the detail model does not exist or canonical fields are unavailable.

- [ ] **Step 3: Implement a pure projection**

```javascript
// public/agent_detail_model.mjs
import { resolveAgentSignal } from './agent_roster_model.mjs';

export function buildAgentDetail(model, agentId, { nowMs = Date.now() } = {}) {
  const agent = model.agents.find((candidate) => (candidate.id || candidate.agent) === agentId);
  if (!agent) return null;
  const id = agent.id || agent.agent;
  return {
    id,
    name: agent.name || id,
    role: agent.role,
    state: agent.state,
    pixelState: agent.pixelState || agent.pixel_state || agent.state,
    signal: resolveAgentSignal(agent, nowMs),
    task: agent.task || '',
    room: { key: agent.roomKey || agent.room_key || '', label: agent.roomLabel || agent.room_label || '' },
    tool: agent.toolName || agent.tool_name || agent.toolLabel || '',
    hook: agent.hook || agent.source || '',
    processIdentity: agent.processId || agent.process_id || null,
    sessionIdentity: agent.instanceName || agent.instance_name || agent.sessionId || null,
    lastSeen: agent.lastSeenMs || agent.last_seen_ms || null,
    recentEvents: model.events.filter((event) => (event.agentId || event.agent) === id).slice(0, 8),
    portraitInput: agent,
    externalFields: ['name', 'task', 'tool', 'hook', 'processIdentity', 'sessionIdentity', 'recentEvents'],
  };
}
```

If command-deck normalization uses different canonical names, add fields there once and keep the detail projector free of snapshot inference.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/test_agent_detail_model.mjs tests/test_command_deck_model.mjs tests/test_agent_roster_model.mjs`

Expected: projection and existing model tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add public/agent_detail_model.mjs public/command_deck_model.mjs \
  tests/test_agent_detail_model.mjs tests/test_command_deck_model.mjs
git diff --cached --check
git commit -m "feat: project canonical Agent detail data"
```

---

### Task 2: Shared Responsive Detail View and Focus Lifecycle

**Files:**
- Create: `public/agent_detail_view.mjs`
- Create: `tests/test_agent_detail_view.mjs`
- Modify: `public/agent_roster_view.mjs`
- Modify: `tests/test_agent_roster_view.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`

**Interfaces:**
- Produces: `createAgentDetailView({ root, documentRef, textFor, spriteFor, onClose }) -> { open(detail, trigger), close(), render(detail), destroy() }`.
- Extends roster callback to `onActivate(selection, trigger)`; selection-only updates remain available through `onSelect` if needed.
- Produces in `app.mjs`: `activateAgentDetail(agentId, { trigger, publish = true })`.

- [ ] **Step 1: Write failing interaction and focus tests**

```javascript
test('click and keyboard activation pass the exact card trigger', () => {
  const activations = [];
  const view = createAgentRosterView({ root, documentRef, spriteFor, textFor,
    onActivate: (selection, trigger) => activations.push([selection, trigger]) });
  view.render([row]);
  const card = root.children[0];
  card.dispatch('click');
  card.dispatch('keydown', { key: 'Enter', preventDefault() {} });
  assert.deepEqual(activations.map(([selection]) => selection), [
    { kind: 'agent', id: row.id }, { kind: 'agent', id: row.id },
  ]);
  assert.ok(activations.every(([, trigger]) => trigger === card));
});

test('closing detail restores focus to the connected trigger', () => {
  const trigger = fixtureElement();
  const view = createAgentDetailView(fixture());
  view.open(detail, trigger);
  view.close();
  assert.equal(trigger.focusCalls, 1);
});
```

Add tests for Escape, close button, backdrop, missing trigger, and updating an already-open Agent without losing its original trigger.

- [ ] **Step 2: Run RED**

Run: `node --test tests/test_agent_detail_view.mjs tests/test_agent_roster_view.mjs`

Expected: missing detail view and current roster callback shape fail.

- [ ] **Step 3: Implement accessible open/close behavior**

```javascript
export function createAgentDetailView({ root, documentRef = document, textFor, spriteFor, onClose = () => {} }) {
  let trigger = null;
  let open = false;
  const close = () => {
    if (!open) return;
    open = false;
    root.hidden = true;
    root.setAttribute('aria-hidden', 'true');
    onClose();
    if (trigger?.isConnected) trigger.focus();
    trigger = null;
  };
  return {
    open(detail, nextTrigger) {
      trigger ??= nextTrigger || documentRef.activeElement;
      open = true;
      root.hidden = false;
      root.setAttribute('aria-hidden', 'false');
      this.render(detail);
    },
    render(detail) {
      const portrait = root.querySelector('[data-agent-detail-portrait]');
      const name = root.querySelector('[data-agent-detail-name]');
      const task = root.querySelector('[data-agent-detail-task]');
      const state = root.querySelector('[data-agent-detail-state]');
      const sprite = spriteFor(detail.portraitInput) || {};
      portrait.src = sprite.src || '';
      portrait.alt = '';
      name.textContent = detail.name;
      task.textContent = detail.task || textFor('agentDetail.noTask');
      state.textContent = textFor(`agentState.${detail.pixelState}`);
      name.dataset.externalCopy = 'true';
      task.dataset.externalCopy = 'true';
      root.dataset.agentId = detail.id;
    },
    close,
    destroy() { close(); },
  };
}
```

Keep the existing dialog markup if practical, but expose one root with `data-agent-detail-mode="drawer|dialog"`; CSS and viewport state choose presentation. Add focus trap only in dialog mode.

- [ ] **Step 4: Route all Agent activation through one function**

```javascript
function activateAgentDetail(agentId, { trigger = document.activeElement, publish = true } = {}) {
  selectCommandDeck({ kind: 'agent', id: agentId }, { publish });
  const detail = buildAgentDetail(commandDeckModel, agentId, { nowMs: Date.now() });
  if (detail) agentDetailView.open(detail, trigger);
}
```

Use this for Roster activation and the village-character message/click path. Keep `selectCommandDeck()` selection-only for background synchronization and non-Agent surfaces.

- [ ] **Step 5: Run GREEN**

Run: `node --test tests/test_agent_detail_view.mjs tests/test_agent_roster_view.mjs tests/test_agent_detail_model.mjs`

Expected: all detail/activation tests pass.

- [ ] **Step 6: Commit Task 2**

```bash
git add public/agent_detail_view.mjs public/agent_roster_view.mjs public/app.mjs public/index.html \
  tests/test_agent_detail_view.mjs tests/test_agent_roster_view.mjs
git diff --cached --check
git commit -m "feat: open Agent detail from roster and village"
```

---

### Task 3: Versioned Three-Boundary Layout Controller

**Files:**
- Create: `public/village_first_layout.mjs`
- Create: `tests/test_village_first_layout.mjs`
- Modify: `public/app.mjs`
- Modify: `public/index.html`
- Modify: `tests/test_dashboard_layout.py`

**Interfaces:**
- Key: `pixelverse:village-first-layout:v1`.
- Produces: `normalizeVillageFirstLayout(value, viewport) -> { topHeight, rosterHeight, detailWidth }`.
- Produces: `createVillageFirstLayoutController(options) -> { start(), reset(), getLayout(), setDetailOpen(open), destroy() }`.

- [ ] **Step 1: Write failing normalization, persistence, and keyboard tests**

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { createVillageFirstLayoutController, normalizeVillageFirstLayout } from '../public/village_first_layout.mjs';

test('desktop normalization preserves the minimum village', () => {
  const layout = normalizeVillageFirstLayout(
    { topHeight: 500, rosterHeight: 500, detailWidth: 900 },
    { width: 1024, height: 768, detailOpen: true },
  );
  assert.ok(layout.topHeight + layout.rosterHeight + 280 <= 768);
  assert.ok(layout.detailWidth + 520 <= 1024);
});

test('pointer keyboard persistence and reset share one bounded state', () => {
  const first = fixture();
  first.controller.start();
  first.topHandle.dispatch('keydown', { key: 'ArrowDown' });
  first.rosterHandle.dispatch('keydown', { key: 'ArrowDown', shiftKey: true });
  first.detailHandle.dispatch('keydown', { key: 'ArrowLeft' });
  const changed = first.controller.getLayout();
  const second = fixture({ storage: first.storage });
  second.controller.start();
  assert.deepEqual(second.controller.getLayout(), changed);
  second.rosterHandle.dispatch('dblclick');
  assert.deepEqual(second.controller.getLayout(), normalizeVillageFirstLayout({}, second.viewport()));
});
```

Add malformed-storage preservation and `<900px` no-splitter behavior.

- [ ] **Step 2: Run RED**

Run: `node --test tests/test_village_first_layout.mjs`

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement bounded layout state**

```javascript
export const VILLAGE_FIRST_LAYOUT_KEY = 'pixelverse:village-first-layout:v1';
const DEFAULTS = Object.freeze({ topHeight: 56, rosterHeight: 128, detailWidth: 360 });
const LIMITS = Object.freeze({
  top: { min: 44, max: 120 }, roster: { min: 96, max: 260 }, detail: { min: 300, max: 520 },
  villageWidth: 520, villageHeight: 280, narrowWidth: 900,
});

export function normalizeVillageFirstLayout(value = {}, viewport = {}) {
  const width = Number(viewport.width) || 1440;
  const height = Number(viewport.height) || 900;
  let topHeight = clampNumber(value.topHeight, LIMITS.top, DEFAULTS.topHeight);
  let rosterHeight = clampNumber(value.rosterHeight, LIMITS.roster, DEFAULTS.rosterHeight);
  const maxVertical = Math.max(LIMITS.top.min + LIMITS.roster.min, height - LIMITS.villageHeight);
  if (topHeight + rosterHeight > maxVertical) rosterHeight = Math.max(LIMITS.roster.min, maxVertical - topHeight);
  const maxDetail = Math.max(LIMITS.detail.min, width - LIMITS.villageWidth);
  const detailWidth = clampNumber(value.detailWidth, { ...LIMITS.detail, max: Math.min(LIMITS.detail.max, maxDetail) }, DEFAULTS.detailWidth);
  return { topHeight, rosterHeight, detailWidth };
}
```

Controller writes CSS variables `--village-top-height`, `--village-roster-height`, and `--agent-detail-width`. Pointer and Arrow-key handlers persist only valid version-1 objects; invalid stored data remains untouched.

- [ ] **Step 4: Replace fixed Village-first tracks and add splitters**

Use:

```css
.map-first-workspace {
  grid-template-columns: minmax(520px, 1fr) var(--agent-detail-track, 0px);
  grid-template-rows: var(--village-top-height, 56px) var(--village-roster-height, 128px) minmax(280px, 1fr);
}
```

Add three semantic separator buttons with `role="separator"`, orientation, `aria-valuemin/max/now`, keyboard labels, and double-click reset. Below `900px`, set one column, auto top/roster tracks, modal detail, `overflow-y: auto`, and hide separators.

- [ ] **Step 5: Run GREEN and structural regression tests**

Run: `node --test tests/test_village_first_layout.mjs && python3 -m pytest -q tests/test_dashboard_layout.py`

Expected: controller and updated structural assertions pass; no assertion expects fixed `44px 112px` tracks.

- [ ] **Step 6: Commit Task 3**

```bash
git add public/village_first_layout.mjs public/app.mjs public/index.html \
  tests/test_village_first_layout.mjs tests/test_dashboard_layout.py
git diff --cached --check
git commit -m "feat: resize village status roster and detail regions"
```

---

### Task 4: Complete Detail Copy and Semantic ECG

**Files:**
- Modify: `public/ui_strings.mjs`
- Modify: `tests/test_frontend_i18n.mjs`
- Modify: `public/live_ecg_controller.mjs`
- Modify: `public/agent_timeline_graphs.mjs`
- Modify: `tests/test_live_ecg_controller.mjs`
- Modify: `tests/test_agent_timeline_graphs.mjs`
- Modify: `public/agent_detail_view.mjs`

**Interfaces:**
- Adds complete `agentDetail.*` and `villageLayout.*` keys to all four locale bundles.
- Existing ECG scheduler accepts detail nodes through the same `[data-agent-ecg]` registration path.
- Signal kinds remain `idle`, `busy`, and `offline` with reduced-motion static shapes.

- [ ] **Step 1: Write failing locale and ECG tests**

```javascript
test('all supported locales contain complete detail and layout copy without English fallback', () => {
  for (const locale of ['en-US', 'zh-TW', 'ja-JP', 'ko-KR']) {
    const bundle = UI_STRINGS[locale];
    for (const key of ['agentDetail.title', 'agentDetail.currentTask', 'agentDetail.lastSeen',
      'agentDetail.process', 'agentDetail.session', 'agentDetail.recentEvents',
      'villageLayout.reset', 'villageLayout.resizeTop', 'villageLayout.resizeRoster', 'villageLayout.resizeDetail']) {
      assert.equal(typeof lookupLocaleValue(bundle, key), 'string', `${locale}:${key}`);
    }
  }
});

test('detail ECG shares busy acceleration offline flatline and reduced-motion semantics', () => {
  assert.equal(resolveEcgSignal({ state: 'working', pixelState: 'editing_files' }).kind, 'busy');
  assert.equal(resolveEcgSignal({ state: 'offline' }).kind, 'offline');
  assert.notEqual(ecgPath('busy', 100), ecgPath('busy', 500));
  assert.equal(reducedMotionEcgPath('offline'), reducedMotionEcgPath('offline'));
});
```

- [ ] **Step 2: Run RED**

Run: `node --test tests/test_frontend_i18n.mjs tests/test_live_ecg_controller.mjs tests/test_agent_timeline_graphs.mjs`

Expected: missing copy keys or detail registration assertions fail.

- [ ] **Step 3: Add complete copy and reuse the shared scheduler**

Add all keys to each locale explicitly. Register the detail ECG SVG with the existing shared controller when detail opens and unregister it when closed; do not call `setInterval` or `requestAnimationFrame` in `agent_detail_view.mjs`.

- [ ] **Step 4: Run GREEN**

Run: `node --test tests/test_frontend_i18n.mjs tests/test_live_ecg_controller.mjs tests/test_agent_timeline_graphs.mjs tests/test_agent_detail_view.mjs`

Expected: four-locale and ECG tests pass.

- [ ] **Step 5: Commit Task 4**

```bash
git add public/ui_strings.mjs public/live_ecg_controller.mjs public/agent_timeline_graphs.mjs \
  public/agent_detail_view.mjs tests/test_frontend_i18n.mjs \
  tests/test_live_ecg_controller.mjs tests/test_agent_timeline_graphs.mjs
git diff --cached --check
git commit -m "feat: localize Agent detail and shared ECG states"
```

---

### Task 5: Multi-Viewport Browser Acceptance

**Files:**
- Modify: `scripts/command_deck_browser_smoke.py`
- Modify: `tests/test_command_deck_browser_smoke.py`
- Modify: `spec/modules/world-frontend.md`
- Modify: `spec/modules/testing-and-ops.md`

**Interfaces:**
- Smoke JSON adds `agent_detail`, `layout_resize`, and `focus_restore` evidence per viewport/locale.
- Evidence includes top/roster/village/detail rectangles, overlap results, page scroll width, selected identity, detail mode, and persisted/reset values.

- [ ] **Step 1: Write failing smoke contract tests**

```python
def test_browser_smoke_covers_agent_detail_layout_and_focus_restore():
    source = Path("scripts/command_deck_browser_smoke.py").read_text(encoding="utf-8")
    for token in ["agent_detail", "layout_resize", "focus_restore", "detailMode", "horizontalOverflow"]:
        assert token in source
    for viewport in [(1440, 900), (1024, 768), (800, 450), (390, 844)]:
        assert str(viewport[0]) in source and str(viewport[1]) in source
```

- [ ] **Step 2: Run RED**

Run: `python3 -m pytest -q tests/test_command_deck_browser_smoke.py -k 'detail or layout or viewport'`

Expected: new evidence fields and mobile viewport are absent.

- [ ] **Step 3: Extend the production smoke flow**

For each viewport and locale:

1. Activate the first Roster card and assert selected Agent identity equals the open detail identity.
2. Assert drawer at desktop and dialog below `900px`.
3. Measure every region and assert pairwise non-overlap plus `documentElement.scrollWidth <= clientWidth`.
4. On desktop, drag each splitter, reload, verify persisted values, double-click reset, and verify defaults.
5. Close by Escape and assert `document.activeElement` returns to the originating card.
6. Activate the same Agent through the village bridge and assert the same detail identity.
7. Assert all visible product-owned strings belong to the selected locale; external nodes carry `data-external-copy="true"`.

- [ ] **Step 4: Run the full verification gate**

Run:

```bash
node --test tests/*.mjs
python3 -m pytest -q tests/test_dashboard_layout.py tests/test_command_deck_browser_smoke.py
python3 scripts/command_deck_browser_smoke.py --base-url http://127.0.0.1:5661 --allow-mutation
```

Expected: unit/structural tests pass and browser smoke records zero overlap, zero horizontal overflow, correct mode/focus, and zero console/page errors.

- [ ] **Step 5: Commit Task 5**

```bash
git add scripts/command_deck_browser_smoke.py tests/test_command_deck_browser_smoke.py \
  spec/modules/world-frontend.md spec/modules/testing-and-ops.md
git diff --cached --check
git commit -m "test: verify responsive Agent detail and layout"
```

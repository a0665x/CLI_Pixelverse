# Retire Legacy Map And Localize Product Status Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Phaser village and per-building interiors the only visual world, remove the YAML/HTML legacy map stack, and ensure Pixelverse-owned status copy follows the selected locale.

**Architecture:** The outer dashboard becomes a non-spatial operational shell that publishes snapshots, locale, and focus commands to the Phaser iframe. Backend agent snapshots expose semantic connection fields, while the dashboard converts those fields to locale-owned status copy and preserves genuinely external task payloads verbatim. All YAML floorplan, browser map-builder, outer furniture-layout, and runtime map-mount paths are removed without changing the port-4568 lifecycle bridge.

**Tech Stack:** Python 3.11/FastAPI, Bash, Docker Compose, vanilla ES modules, TypeScript 7, Phaser 3.90, Vitest 4, pytest, Playwright/Chromium.

## Global Constraints

- Preserve `http://127.0.0.1:4568/hook`, Codex project hooks, wrapper heartbeats, and snapshot delivery.
- The only supported world is the Phaser village plus its second-layer interior cutaways.
- Furniture editing remains available inside an opened building through `InteriorCutawaySystem`; it must not exist in the outer dashboard.
- Product-owned copy supports exactly `en-US`, `zh-TW`, `ja-JP`, and `ko-KR` with no cross-locale fallback.
- External task, prompt, tool-response, and user-authored payload text remains verbatim.
- Do not delete untracked files under `global_map/` or `tmp/`; remove only tracked legacy assets and list remaining user files at handoff.
- Do not stage or commit the user's unrelated dirty files in the main worktree.
- Licensed Modern Office ZIPs, sprites, prepared metadata, and collision masks remain Git-ignored and must never be committed.
- Use a new `codex/retire-legacy-map` worktree created with the `using-git-worktrees` skill before implementation.

---

## File Responsibility Map

- `pixelverse_server.py`: semantic agent snapshot production and the stdlib compatibility server; no map or outer furniture persistence.
- `pixelverse_fastapi.py`: supported health/world/agent/exposure/event APIs and static dashboard assets; no map submission or outer furniture endpoints.
- `public/ui_strings.mjs`: four-locale product copy and semantic connection-status presentation.
- `public/command_deck_payload_presenters.mjs`: builds the top Agent state line from explicitly supplied localized status/task text.
- `public/app.mjs`: operational dashboard orchestration only; no independent spatial renderer or outer furniture editor.
- `public/index.html`: iframe, status, roster, detail, cards, settings, and exposure UI only.
- `public/command_deck_model.mjs`: derives command-deck selections from snapshot semantics without YAML room geometry.
- `run.sh`: agent/exposure/asset lifecycle only; no floorplan selector or map-builder command.
- `docker-compose.yml`: runtime service and bridge mounts only; no global-map bind mount.
- `README.md`: one village-first quickstart and current operating reference.
- `tests/test_legacy_map_retirement.py`: negative architecture contract preventing legacy files, commands, mounts, endpoints, and DOM from returning.

---

### Task 1: Localize Semantic Agent Connection Status

**Files:**
- Modify: `pixelverse_server.py:1043-1067`
- Modify: `public/ui_strings.mjs:1-1020`
- Modify: `public/command_deck_payload_presenters.mjs:1-18`
- Modify: `public/app.mjs:1012-1026`
- Modify: `tests/test_hermes_integration.py:280-315`
- Modify: `tests/test_command_deck_payload_presenters.mjs`
- Modify: `tests/test_frontend_i18n.mjs`

**Interfaces:**
- Produces: `agentConnectionStatusText(locale: string, agent: object): string` in `public/ui_strings.mjs`.
- Produces: `currentAgentStatePresentation({ name, state, room, detail }): { detail: string, text: string }`.
- Preserves: `agentTaskText(agent)` as the verbatim external-payload accessor.

- [ ] **Step 1: Add failing backend tests for semantic placeholder and stale snapshots**

Add assertions to the existing source-placeholder test in `tests/test_hermes_integration.py`:

```python
waiting = next(item for item in snapshot["agents"] if item["source_placeholder"])
assert waiting["connection_status"] == "awaiting_attach"
assert waiting["activity_hint"] == ""
assert waiting["status_label"] == ""
```

Add an equivalent stale-agent assertion:

```python
assert stale["connection_status"] == "stale"
assert stale["activity_hint"] == ""
assert stale["status_label"] == ""
```

- [ ] **Step 2: Run the backend reproduction and confirm it fails on Chinese prose**

Run:

```bash
python3 -m pytest -q tests/test_hermes_integration.py -k 'placeholder or stale'
```

Expected: FAIL because `activity_hint` contains `已選擇 agent source...` or `目前沒有收到...`.

- [ ] **Step 3: Make placeholder and stale snapshot fields semantic-only**

In `WorldState.snapshot_local_agents()`, keep `connection_status`, `state`, and
`room_key`, but clear product-owned display fields:

```python
if item["is_stale"] and item.get("source_placeholder"):
    item["state"] = "idle"
    item["status_label"] = ""
    item.update(classify_room("idle", None, role="main_agent"))
    item["activity_hint"] = ""
elif item["is_stale"] and item["state"] != "offline":
    item["state"] = "offline"
    item["status_label"] = ""
    item.update(classify_room("offline", item.get("task"), role="main_agent"))
    item["activity_hint"] = ""
    item["connection_status"] = "stale"
```

Do not alter non-empty external `task` payloads.

- [ ] **Step 4: Add failing four-locale presenter tests**

In `tests/test_command_deck_payload_presenters.mjs`, add:

```js
for (const [locale, expected] of Object.entries({
  'en-US': 'Waiting for a new CLI session',
  'zh-TW': '等待新的 CLI 工作階段',
  'ja-JP': '新しい CLI セッションを待機中',
  'ko-KR': '새 CLI 세션을 기다리는 중',
})) {
  test(`awaiting source uses ${locale} product copy`, () => {
    const agent = { connection_status: 'awaiting_attach', source_placeholder: true, activity_hint: '不應顯示' };
    const detail = agentConnectionStatusText(locale, agent);
    assert.equal(detail, expected);
    assert.equal(currentAgentStatePresentation({ name: 'codex', state: 'Idle', room: 'Standby Dock', detail }).text,
      `codex · Idle · Standby Dock · ${expected}`);
  });
}

test('external task bytes stay verbatim', () => {
  assert.equal(agentConnectionStatusText('en-US', { task: '使用者的原始任務', connection_status: 'attached' }), '');
  assert.equal(agentTaskText({ task: '使用者的原始任務' }), '使用者的原始任務');
});
```

- [ ] **Step 5: Run presenter tests and confirm the new API is absent**

Run:

```bash
node --test tests/test_command_deck_payload_presenters.mjs tests/test_frontend_i18n.mjs
```

Expected: FAIL because `agentConnectionStatusText` and the `detail` presenter contract do not exist.

- [ ] **Step 6: Implement locale-owned connection copy and explicit detail presentation**

Add the same keys to all four locale catalogs:

```js
agentConnection: {
  awaitingAttach: 'Waiting for a new CLI session',
  stale: 'No recent heartbeat from the main agent',
},
```

Use the approved translations from Step 4 for the other locales. Export:

```js
export function agentConnectionStatusText(locale, agent = {}) {
  if (agent.connection_status === 'awaiting_attach' || agent.source_placeholder) {
    return uiText(locale, 'agentConnection.awaitingAttach');
  }
  if (agent.connection_status === 'stale') {
    return uiText(locale, 'agentConnection.stale');
  }
  return '';
}
```

Change the presenter to:

```js
export function currentAgentStatePresentation({ name = '', state = '', room = '', detail = '' } = {}) {
  return { detail: String(detail || ''), text: [name, state, room, detail].filter(Boolean).join(' · ') };
}
```

In `updateCurrentAgentState()`, compute:

```js
const detail = agentConnectionStatusText(currentLocale, mainAgent) || agentTaskText(mainAgent);
const presentation = currentAgentStatePresentation({
  name: displayAgentName(mainAgent), state: stateText(mainAgent.state), room: roomName, detail,
});
```

- [ ] **Step 7: Run focused and catalog tests**

Run:

```bash
python3 -m pytest -q tests/test_hermes_integration.py -k 'placeholder or stale'
node --test tests/test_command_deck_payload_presenters.mjs tests/test_frontend_i18n.mjs tests/test_command_deck_locale_controller.mjs
```

Expected: all selected tests PASS and locale completeness remains true.

- [ ] **Step 8: Commit the localization fix**

```bash
git add pixelverse_server.py public/ui_strings.mjs public/command_deck_payload_presenters.mjs public/app.mjs tests/test_hermes_integration.py tests/test_command_deck_payload_presenters.mjs tests/test_frontend_i18n.mjs
git commit -m "fix: localize semantic agent connection status"
```

---

### Task 2: Remove The Outer Furniture Editor And Legacy Map Presentation

**Files:**
- Modify: `public/index.html:70-720, 1230-1550, 2938-3060`
- Modify: `public/app.mjs:1-1600, 2480-2765, 2920-3140`
- Modify: `public/dashboard_disclosure.mjs:175-205`
- Modify: `public/command_deck_model.mjs`
- Delete: `public/furniture_editing.mjs`
- Delete: `tests/test_furniture_editing.mjs`
- Modify: `tests/test_dashboard_layout.py`
- Modify: `tests/test_dashboard_disclosure.mjs`
- Create: `tests/test_legacy_map_retirement.py`

**Interfaces:**
- Produces: `commandBuildingIds(snapshot: object): string[]` in `public/command_deck_model.mjs`.
- Removes: `applyMapLayerVisibility()`, `furnitureEditMode`, outer layout save/cancel, camera stage, districts, path layer, and outer agent sprites.
- Preserves: iframe focus/locale/snapshot publication and Agent roster/detail rendering.

- [ ] **Step 1: Write a failing negative DOM contract**

Create `tests/test_legacy_map_retirement.py`:

```python
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_outer_dashboard_contains_only_the_phaser_world_layer():
    html = (ROOT / "public/index.html").read_text(encoding="utf-8")
    for retired in (
        'id="edit-furniture-btn"', 'id="save-furniture-btn"', 'id="cancel-furniture-btn"',
        'id="camera-stage"', 'class="district"', 'id="path-layer"', 'id="agents-layer"',
    ):
        assert retired not in html
    assert 'id="pixelworld-frame"' in html


def test_dashboard_script_does_not_switch_to_a_legacy_map():
    source = (ROOT / "public/app.mjs").read_text(encoding="utf-8")
    for retired in (
        "beginFurnitureEdit", "saveFurnitureEdit", "cancelFurnitureEdit",
        "furnitureEditMode", "applyMapLayerVisibility", "renderDistricts",
    ):
        assert retired not in source
```

- [ ] **Step 2: Run the negative contract and confirm legacy markup remains**

Run:

```bash
python3 -m pytest -q tests/test_legacy_map_retirement.py
```

Expected: FAIL on the outer furniture buttons and `camera-stage`.

- [ ] **Step 3: Add a snapshot-derived command building catalog**

Add tests to `tests/test_command_deck_model.mjs`:

```js
assert.deepEqual(commandBuildingIds({ agents: [
  { room_key: 'standby_dock' }, { room_key: 'code_workbench' }, { room_key: 'standby_dock' },
]}), ['code_workbench', 'standby_dock']);
assert.deepEqual(commandBuildingIds({ agents: [] }), []);
```

Implement:

```js
export const commandBuildingIds = (snapshot = {}) => [...new Set(
  (snapshot.agents || []).map((agent) => String(agent.room_key || '')).filter(Boolean),
)].sort();
```

Replace `Object.keys(ROOM_LAYOUTS)` in command-deck model construction with
`commandBuildingIds(dashboardLiveSnapshot).map((id) => ({ id }))`.

- [ ] **Step 4: Remove outer editor controls and legacy spatial markup**

Delete the settings buttons, editor banner/HUD, camera stage, house shell,
districts, doors, path layer, agents layer, and camera controls from
`public/index.html`. Delete CSS selectors whose only targets were removed.

The retained world section must reduce to this shape:

```html
<section class="world map-stage command-deck-region" id="world" data-command-region="center" data-i18n-aria-label="commandDeck.world.label">
  <iframe class="pixelworld-frame" id="pixelworld-frame" src="/pixelworld/index.html?embed=1"
    data-i18n-title="commandDeck.world.frameTitle" allow="fullscreen"></iframe>
</section>
```

- [ ] **Step 5: Remove outer editor state and spatial rendering from `app.mjs`**

Delete imports from `furniture_editing.mjs`, `house_layout.mjs`, and
`world_motion.mjs`; remove DOM references and variables for the retired nodes;
remove the outer layout synchronization, render, drag, key, save, and cancel
handlers.

Reduce `renderAgents()` to operational consumers only:

```js
function renderAgents(snapshot) {
  const agents = snapshot.agents || [];
  renderInspectorAgentSelect(agents);
  const resolvedSelection = resolveCurrentCommandSelection(currentCommandSelection);
  renderInspector(resolvedSelection?.agent || agents.find((item) => item.agent === selectedAgentId)
    || (!currentCommandSelection ? agents[0] : null));
  if (dashboardDisclosure.activeCard === 'agents') renderDashboardCardContent();
  if (activeDialogAgentId) {
    const active = agents.find((item) => item.agent === activeDialogAgentId);
    if (active) openAgentDialog(active); else closeAgentDialog();
  }
}
```

Keep `pixelworldBridge.setSnapshot()`, `setLocale()`, and `setFocus()` intact.

- [ ] **Step 6: Remove the presentation switch helper and obsolete tests**

Delete `applyMapLayerVisibility()` and its two tests from
`public/dashboard_disclosure.mjs` and `tests/test_dashboard_disclosure.mjs`.
Delete `public/furniture_editing.mjs` and `tests/test_furniture_editing.mjs` only
after `rg "furniture_editing|applyMapLayerVisibility" public tests` returns no
active imports.

- [ ] **Step 7: Run focused outer-dashboard tests**

Run:

```bash
python3 -m pytest -q tests/test_legacy_map_retirement.py tests/test_dashboard_layout.py
node --test tests/test_command_deck_model.mjs tests/test_dashboard_disclosure.mjs tests/test_agent_roster_view.mjs tests/test_agent_detail_view.mjs tests/test_pixelworld_embed.mjs
```

Expected: PASS; the iframe bridge and dashboard detail tests remain green.

- [ ] **Step 8: Commit the single-world dashboard**

```bash
git add public/index.html public/app.mjs public/dashboard_disclosure.mjs public/command_deck_model.mjs tests/test_dashboard_layout.py tests/test_dashboard_disclosure.mjs tests/test_command_deck_model.mjs tests/test_legacy_map_retirement.py
git rm public/furniture_editing.mjs tests/test_furniture_editing.mjs
git commit -m "refactor: retire outer legacy map editor"
```

---

### Task 3: Remove Floorplan Selection From Startup

**Files:**
- Modify: `run.sh:60-200, 400-565, 790-825, 1635-1655`
- Modify: `tests/test_run_restart.py`
- Replace: `tests/test_run_floorplan.py`
- Modify: `tests/test_run_architecture.py`

**Interfaces:**
- `start_service(mode)` no longer calls `prepare_floorplan(mode)`.
- Retired commands exit status 2 with `The Phaser village uses a single built-in world; YAML floorplans are no longer supported.`
- `PIXELVERSE_FLOORPLAN` and `PIXELVERSE_GLOBAL_MAP_DIR_HOST` are not written to compose/service state.

- [ ] **Step 1: Replace positive floorplan tests with failing retirement tests**

Rewrite `tests/test_run_floorplan.py` as:

```python
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_command(command):
    return subprocess.run(["bash", "run.sh", command], cwd=ROOT, text=True, capture_output=True,
                          env={**os.environ, "PIXELVERSE_AGENT_KIND": "codex"})


def test_retired_floorplan_commands_return_migration_guidance():
    for command in ("floorplans", "prepare-floorplan", "map-builder"):
        result = run_command(command)
        assert result.returncode == 2
        assert "single built-in world" in result.stderr


def test_run_source_contains_no_floorplan_selector_or_runtime_map_setting():
    source = (ROOT / "run.sh").read_text(encoding="utf-8")
    for retired in ("select_floorplan_key", "prepare_floorplan", "PIXELVERSE_FLOORPLAN",
                    "PIXELVERSE_GLOBAL_MAP_DIR_HOST", "Select visual floorplan"):
        assert retired not in source
```

- [ ] **Step 2: Run retirement tests and confirm current commands succeed or prompt**

Run:

```bash
python3 -m pytest -q tests/test_run_floorplan.py tests/test_run_restart.py
```

Expected: FAIL because the commands and floorplan functions still exist.

- [ ] **Step 3: Remove selector, copier, builder help, and startup call**

Delete the floorplan functions and environment default. Remove the call to
`prepare_floorplan "$mode"` from `start_service()`.

Add a compatibility case before the unknown-command case:

```bash
floorplans|prepare-floorplan|map-builder)
  echo "The Phaser village uses a single built-in world; YAML floorplans are no longer supported." >&2
  exit 2
  ;;
```

Remove these commands and environment examples from normal help so they are not
advertised.

- [ ] **Step 4: Update restart contracts**

Delete tests that expect reuse/copy of `tmp/global_map/default.*`. Add:

```python
def test_restart_never_selects_or_prepares_a_floorplan():
    source = RUN_SH.read_text(encoding="utf-8")
    assert 'prepare_floorplan "$mode"' not in source
    assert "Select visual floorplan" not in source
```

Keep agent-source reuse, port reuse, exposure reuse, and asset preparation tests unchanged.

- [ ] **Step 5: Run startup tests and shell syntax**

Run:

```bash
bash -n run.sh
python3 -m pytest -q tests/test_run_floorplan.py tests/test_run_restart.py tests/test_run_architecture.py tests/test_portable_onboarding.py
```

Expected: PASS.

- [ ] **Step 6: Commit the simplified startup**

```bash
git add run.sh tests/test_run_floorplan.py tests/test_run_restart.py tests/test_run_architecture.py
git commit -m "refactor: remove runtime floorplan selection"
```

---

### Task 4: Remove Legacy Map And Outer Furniture APIs

**Files:**
- Modify: `pixelverse_server.py:20-90, 220-280, 1070-1090, 1800-1905`
- Modify: `pixelverse_fastapi.py:10-90, 130-220, 300-340`
- Modify: `tests/test_fastapi_service.py`
- Modify: `tests/test_hermes_integration.py:330-370`
- Modify: `tests/test_dashboard_layout.py`

**Interfaces:**
- Removes: `/global_map/{path}`, `/api/global-map/submit`, `/api/furniture-layout` GET/POST.
- Removes: `furniture_layout` from `/api/world` snapshots.
- Preserves: `/health`, `/api/world`, `/api/world/stream`, `/api/event`, `/api/heartbeat`, `/api/agents`, `/api/exposure`, and webhook/inbox routes.

- [ ] **Step 1: Add failing supported-route and retired-route tests**

In `tests/test_fastapi_service.py`, use `TestClient`:

```python
def test_legacy_map_and_outer_furniture_routes_are_absent():
    for method, path in (
        ("get", "/global_map/default.yaml"),
        ("post", "/api/global-map/submit"),
        ("get", "/api/furniture-layout"),
        ("post", "/api/furniture-layout"),
    ):
        response = client.post(path, json={}) if method == "post" else client.get(path)
        assert response.status_code == 404


def test_world_snapshot_has_no_outer_furniture_layout():
    assert "furniture_layout" not in pixelverse_server.WORLD.public_snapshot()
```

Also assert `/health`, `/api/world`, and `/api/event` do not return 404.

- [ ] **Step 2: Run API tests and confirm retired routes still exist**

Run:

```bash
python3 -m pytest -q tests/test_fastapi_service.py -k 'legacy_map or outer_furniture or world_snapshot'
```

Expected: FAIL with 200/422 from at least one retired route and snapshot key present.

- [ ] **Step 3: Remove FastAPI payloads, imports, routes, and validator**

Delete `FurnitureLayoutPayload`, `GlobalMapSubmitPayload`, map/furniture imports,
the four route handlers, `_validate_global_map_yaml()`, and now-unused
`base64`/`binascii` imports.

- [ ] **Step 4: Remove compatibility-server map and furniture persistence**

Delete `GLOBAL_MAP_DIR`, `USER_GLOBAL_MAP_DIR`, `FURNITURE_LAYOUT_FILE`,
`resolve_global_map_file()`, layout normalize/overlap/load/save functions, the
`furniture_layout` snapshot key, `/global_map/` GET handling, and
`/api/furniture-layout` POST handling.

Do not change lifecycle event parsing, room classification, world snapshots,
or bridge-facing endpoints.

- [ ] **Step 5: Remove obsolete positive tests and run API/bridge coverage**

Delete furniture-layout and global-map submission tests from
`tests/test_fastapi_service.py` and `tests/test_hermes_integration.py`, retaining
the negative route tests.

Run:

```bash
python3 -m pytest -q tests/test_fastapi_service.py tests/test_hermes_integration.py tests/test_bridge_delivery.py tests/test_pixelverse_mcp_server.py
```

Expected: PASS.

- [ ] **Step 6: Commit the supported API surface**

```bash
git add pixelverse_server.py pixelverse_fastapi.py tests/test_fastapi_service.py tests/test_hermes_integration.py
git commit -m "refactor: remove legacy map service APIs"
```

---

### Task 5: Delete Tracked Legacy Map Modules, Assets, Scripts, And Tests

**Files:**
- Delete: `global_map/default.yaml`
- Delete: `global_map/default.png`
- Delete: `public/global_map_loader.mjs`
- Delete: `public/house_layout.mjs`
- Delete: `public/map_builder.html`
- Delete: `public/map_builder.mjs`
- Delete: `public/map_builder_core.mjs`
- Delete: `public/world_motion.mjs`
- Delete: `scripts/check_global_map_alignment.py`
- Delete: `scripts/generate_global_map_pixel_art.py`
- Delete: `scripts/generate_honeycomb_global_map.py`
- Delete: `scripts/generate_vlm_courtyard_map.py`
- Delete: `tests/test_generate_honeycomb_global_map.py`
- Delete: `tests/test_generate_vlm_courtyard_map.py`
- Delete: `tests/test_global_map_alignment_checker.py`
- Delete: `tests/test_global_map_art.py`
- Delete: `tests/test_honeycomb_frontend.mjs`
- Delete: `tests/test_house_layout_connected.mjs`
- Delete: `tests/test_map_builder_core.mjs`
- Delete: `tests/test_map_builder_page.py`
- Delete: `tests/test_walkability_mask.py`
- Delete: `tests/test_world_motion.mjs`
- Modify: `tests/test_legacy_map_retirement.py`
- Modify: `scripts/docker_build_metadata.py`

**Interfaces:**
- Produces: a tracked repository with no YAML-map implementation or default map pair.
- Preserves: `pixelworld_mvp/src/world/worldDefinition.ts` and all Phaser world/interior modules.

- [ ] **Step 1: Extend the failing negative file/reference contract**

Add:

```python
RETIRED = (
    "global_map/default.yaml", "global_map/default.png",
    "public/global_map_loader.mjs", "public/house_layout.mjs",
    "public/map_builder.html", "public/map_builder.mjs", "public/map_builder_core.mjs",
    "public/world_motion.mjs", "scripts/check_global_map_alignment.py",
    "scripts/generate_global_map_pixel_art.py", "scripts/generate_honeycomb_global_map.py",
    "scripts/generate_vlm_courtyard_map.py",
)


def test_tracked_legacy_map_files_are_absent():
    assert [path for path in RETIRED if (ROOT / path).exists()] == []


def test_active_sources_do_not_reference_retired_map_contracts():
    sources = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in (
        "public/app.mjs", "public/index.html", "run.sh", "docker-compose.yml",
        "pixelverse_server.py", "pixelverse_fastapi.py",
    ))
    for token in ("global_map", "map_builder", "PIXELVERSE_FLOORPLAN", "furniture-layout"):
        assert token not in sources
```

- [ ] **Step 2: Run the contract and confirm tracked legacy files remain**

Run:

```bash
python3 -m pytest -q tests/test_legacy_map_retirement.py
```

Expected: FAIL listing the tracked legacy files.

- [ ] **Step 3: Audit imports immediately before deletion**

Run:

```bash
rg -n "global_map_loader|house_layout|map_builder|world_motion|generate_global_map|generate_honeycomb|generate_vlm|check_global_map" \
  --glob '!docs/superpowers/**' --glob '!tests/test_legacy_map_retirement.py' .
```

Expected: only the files/tests scheduled for deletion plus README, Compose,
metadata, or integrity references scheduled in Tasks 6 and 7. Stop if any
active Phaser or bridge module imports them.

- [ ] **Step 4: Delete only the audited tracked files and obsolete tests**

Use `git rm` with the exact paths in this task. Do not use a recursive delete
against `global_map/`, because untracked user maps in the main worktree must
survive the eventual merge.

Remove `global_map` from `SOURCE_INPUTS` in `scripts/docker_build_metadata.py`.

- [ ] **Step 5: Run the negative contract and remaining JS/Python suites**

Run:

```bash
python3 -m pytest -q tests/test_legacy_map_retirement.py
node --test tests/*.mjs
python3 -m pytest -q
```

Expected: all remaining tests PASS; test count decreases only by the explicitly
deleted legacy suites.

- [ ] **Step 6: Commit the tracked deletion**

```bash
git add tests/test_legacy_map_retirement.py scripts/docker_build_metadata.py
git status --short
git commit -m "refactor: delete legacy yaml map stack"
```

Verify the staged list contains no untracked user map path.

---

### Task 6: Remove Runtime Map Mount And Update Release Contracts

**Files:**
- Modify: `docker-compose.yml:25-50`
- Modify: `.dockerignore`
- Modify: `.gitignore`
- Modify: `tests/test_dashboard_layout.py`
- Modify: `tests/test_docker_release_integrity.py`
- Modify: `tests/test_run_architecture.py`
- Modify: `README.md:80-1200`

**Interfaces:**
- Compose no longer exposes `PIXELVERSE_GLOBAL_MAP_DIR` or mounts `./tmp/global_map`.
- The image still contains Phaser assets and prepared private Modern Office assets.
- README exposes one village-first startup path.

- [ ] **Step 1: Add failing Compose/release retirement assertions**

Update tests to assert:

```python
compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
assert "PIXELVERSE_GLOBAL_MAP_DIR" not in compose
assert "/app/tmp/global_map" not in compose

for retired in ("global_map/default.yaml", "global_map/default.png", "public/map_builder.html"):
    assert retired not in release_required_paths
```

Keep assertions for `pixelworld_mvp`, `collision-masks.json`, representative
Modern Office sprites, bridge scripts, and health checks.

- [ ] **Step 2: Run focused contracts and confirm the mount/documentation remain**

Run:

```bash
python3 -m pytest -q tests/test_dashboard_layout.py tests/test_docker_release_integrity.py tests/test_run_architecture.py
```

Expected: FAIL on Compose map environment/mount and old integrity expectations.

- [ ] **Step 3: Remove Compose map environment and bind mount**

Delete only:

```yaml
PIXELVERSE_GLOBAL_MAP_DIR: /app/tmp/global_map
```

and:

```yaml
- ${PIXELVERSE_GLOBAL_MAP_DIR_HOST:-./tmp/global_map}:/app/tmp/global_map
```

Do not change runtime state, hook, Hermes, Ollama, or asset mounts/settings.

- [ ] **Step 4: Remove obsolete ignore rules and update integrity inputs**

Remove ignore exceptions or source-input entries that exist solely for tracked
global maps. Preserve ignores for `tmp/`, user-owned map remnants, private
licensed assets, and prepared sprites.

- [ ] **Step 5: Rewrite README current-operation sections**

Remove all operational instructions for:

```text
PIXELVERSE_FLOORPLAN
PIXELVERSE_GLOBAL_MAP_DIR_HOST
./run.sh floorplans
./run.sh prepare-floorplan
./run.sh map-builder
global_map/default.yaml
global_map/default.png
```

Document this single path:

```bash
git clone https://github.com/a0665x/CLI_Pixelverse.git
cd CLI_Pixelverse
mkdir -p private_assets/modern-office
# Place Modern_Office_Revamped_v1.zip in the directory above.
PIXELVERSE_AGENT_KIND=codex ./run.sh start
source "$(pwd -P)/.pixelverse-service/activate.sh"
codex
```

Explain that furniture is edited by opening a village building and using its
interior edit control. Keep the purchase/license warning and portable
`PIXELVERSE_ROOT` instructions.

- [ ] **Step 6: Add a documentation regression scan**

Extend `tests/test_legacy_map_retirement.py`:

```python
def test_current_readme_does_not_advertise_retired_map_workflow():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for token in ("PIXELVERSE_FLOORPLAN", "PIXELVERSE_GLOBAL_MAP_DIR_HOST",
                  "./run.sh map-builder", "./run.sh floorplans"):
        assert token not in readme
    assert "open" in readme.lower() and "interior" in readme.lower()
```

Historical files under `docs/superpowers/` are excluded from this current-doc
contract.

- [ ] **Step 7: Run release/documentation tests**

Run:

```bash
python3 -m pytest -q tests/test_legacy_map_retirement.py tests/test_dashboard_layout.py tests/test_docker_release_integrity.py tests/test_run_architecture.py tests/test_portable_onboarding.py
```

Expected: PASS.

- [ ] **Step 8: Commit runtime and documentation cleanup**

```bash
git add docker-compose.yml .dockerignore .gitignore README.md tests/test_legacy_map_retirement.py tests/test_dashboard_layout.py tests/test_docker_release_integrity.py tests/test_run_architecture.py
git commit -m "docs: make village world the only supported layout"
```

---

### Task 7: Prove Four-Locale UI, Interior Editing, Bridge, And Restart Behavior

**Files:**
- Modify: `scripts/command_deck_browser_smoke.py`
- Modify: `tests/test_command_deck_browser_smoke.py`
- Modify: `scripts/furniture_drag_browser_smoke.py`
- Modify: `tests/test_furniture_drag_browser_smoke.py`

**Interfaces:**
- Browser smoke rejects foreign product copy in each locale.
- Interior smoke opens `maker-workshop`, toggles its cutaway edit control, and never exposes `.camera-stage` or `.district`.
- Hook smoke proves port 4568 still changes the world snapshot.

- [ ] **Step 1: Add failing browser artifact requirements**

For each locale artifact, require `current_agent_state` and reject known
product-owned copy from the other catalogs. Add an explicit English check:

```python
english = artifact["locale_coverage"]["checks"]["en-US"]
assert english["current_agent_state"] == (
    "codex · Idle · Standby Dock · Waiting for a new CLI session"
)
assert not any("\u3400" <= char <= "\u9fff" for char in english["current_agent_state"])
```

For the interior artifact require:

```python
assert result.cutaway_visible
assert result.edit_control_visible
assert result.edit_mode_visible
assert not result.legacy_map_present
```

- [ ] **Step 2: Run smoke unit tests and confirm artifact fields are absent**

Run:

```bash
python3 -m pytest -q tests/test_command_deck_browser_smoke.py tests/test_furniture_drag_browser_smoke.py
```

Expected: FAIL for the new state/edit/legacy fields.

- [ ] **Step 3: Capture semantic locale state and interior edit mode**

In command-deck smoke, record `#current-agent-state` after each locale settles.
Use catalog-derived expected strings rather than a generic non-empty check.

In interior smoke, click the iframe control:

```python
edit_control = panel.locator('[data-action="edit"]')
await edit_control.click()
toolbar = panel.locator('.cutaway-room-toolbar')
await toolbar.wait_for(state="visible", timeout=plan.timeout_ms)
legacy_map_present = await page.locator('#camera-stage, .district').count() > 0
```

Record `edit_mode_visible=await toolbar.is_visible()` and
`legacy_map_present=legacy_map_present`.

- [ ] **Step 4: Run browser unit tests**

Run:

```bash
python3 -m pytest -q tests/test_command_deck_browser_smoke.py tests/test_furniture_drag_browser_smoke.py
```

Expected: PASS.

- [ ] **Step 5: Commit smoke coverage**

```bash
git add scripts/command_deck_browser_smoke.py tests/test_command_deck_browser_smoke.py scripts/furniture_drag_browser_smoke.py tests/test_furniture_drag_browser_smoke.py
git commit -m "test: cover localized village-only browser flow"
```

- [ ] **Step 6: Run the complete source test matrix**

Run:

```bash
python3 -m pytest -q -o faulthandler_timeout=10
npm test --prefix pixelworld_mvp
npm run build --prefix pixelworld_mvp
bash -n run.sh
git diff --check
```

Expected: every maintained test passes; production build has no TypeScript
errors. The existing bundle-size warning is non-blocking.

- [ ] **Step 7: Build and start from the feature worktree without a floorplan variable**

Run:

```bash
PIXELVERSE_MODERN_OFFICE_ZIP="$PWD/private_assets/modern-office/Modern_Office_Revamped_v1.zip" \
PIXELVERSE_AGENT_KIND=codex PIXELVERSE_PORT=5661 PIXELVERSE_BRIDGE_PORT=4568 \
./run.sh start
```

Expected: no floorplan prompt; asset provisioning/build gates pass; UI is
healthy at 5661 and bridge is healthy at 4568.

- [ ] **Step 8: Run runtime, image, browser, and hook verification**

Run:

```bash
curl -fsS http://127.0.0.1:5661/health
curl -fsS http://127.0.0.1:4568/health
PIXELVERSE_TEST_IMAGE=cli-pixelverse:local python3 -m pytest -q tests/test_docker_release_integrity.py -k local_release_image
PIXELVERSE_SMOKE_BASE_URL=http://127.0.0.1:5661 ./run.sh smoke-furniture-drag
PIXELVERSE_SMOKE_BASE_URL=http://127.0.0.1:5661 python3 scripts/command_deck_browser_smoke.py
./run.sh test-hook
```

Expected: health/image/browser checks PASS; synthetic hook produces current
route evidence; the interior screenshot shows real furniture and no black
placeholder blocks.

- [ ] **Step 9: Audit proprietary and legacy files before handoff**

Run:

```bash
git ls-files | rg 'Modern_Office_.*\.png|collision-masks\.json|Modern_Office_Revamped.*\.zip' && exit 1 || true
git ls-files | rg '^(global_map/|public/(global_map_loader|house_layout|map_builder|world_motion))' && exit 1 || true
git status --short
```

Expected: no licensed prepared asset and no tracked legacy-map implementation.
Only known worktree-local smoke artifacts may be untracked.

---

## Merge And Cleanup Notes

After all tasks pass, use `finishing-a-development-branch`. The user has not yet
selected a merge strategy for this new branch, so present the standard options.
Before any local merge, audit the dirty main worktree and use a temporary merge
audit to prove its patch can be reapplied. Never delete the implementation
worktree while it contains untracked files. After merge, list—not delete—the
user-owned `global_map/` and `tmp/` remnants.

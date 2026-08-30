# Agent Project Identity, Port Resolution, and Readable Bubbles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `hook_bridge.sh --launch` use the running Pixelverse port, show each Agent's project identity in the roster/detail UI, and keep interior Agent bubbles fully readable.

**Architecture:** Keep service configuration authoritative in `.pixelverse-service/compose.env`, capture project identity once in the CLI adapter, and carry it through the existing client → FastAPI → world snapshot → command-deck pipeline. Split Agent bubble sizing from compact furniture/hook label sizing while retaining the existing measured room-boundary placement.

**Tech Stack:** Bash, Python 3 dataclasses and FastAPI/Pydantic, Node.js ES modules, TypeScript, Phaser 3, Vitest, pytest, Node test runner.

## Global Constraints

- Port precedence is explicit environment value, then saved `compose.env`, then `5660`/`4567` defaults.
- Project paths and names are runtime copy and must never be translated.
- Roster cards show only the short project name; Agent detail shows the complete path.
- Legacy events without project identity remain accepted and do not show a fake project.
- Interior Agent labels are readable by default with a 160 CSS pixel cap; furniture and hook labels remain 26-pixel compact labels.
- Preserve existing uncommitted room-localization and event-formatting work in `public/agent_detail_model.mjs`, `public/agent_detail_view.mjs`, and their tests.
- Do not stage or commit unrelated dirty workspace files.

---

### Task 1: Make adapter generation load the saved service ports

**Files:**
- Create: `tests/test_run_adapter_ports.py`
- Modify: `run.sh:66-79`

**Interfaces:**
- Consumes: `.pixelverse-service/compose.env` keys `PIXELVERSE_PORT` and `PIXELVERSE_BRIDGE_PORT`.
- Produces: `run.sh` command initialization that resolves saved ports for adapter and hook commands; generated `activate.sh` containing those resolved ports.

- [ ] **Step 1: Write failing saved-port and override tests**

```python
from __future__ import annotations

import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def generate_activation(state_dir: Path, extra_env: dict[str, str] | None = None) -> str:
    state_dir.mkdir()
    (state_dir / "compose.env").write_text(
        "PIXELVERSE_PORT=5999\nPIXELVERSE_BRIDGE_PORT=4999\n",
        encoding="utf-8",
    )
    env = os.environ.copy()
    env.update({"PIXELVERSE_STATE_DIR": str(state_dir), "PIXELVERSE_SOURCE_ONLY": "1"})
    env.update(extra_env or {})
    command = 'source "$1" install-adapter; write_adapter_activation'
    result = subprocess.run(
        ["bash", "-c", command, "bash", str(ROOT / "run.sh")],
        cwd=ROOT, env=env, text=True, capture_output=True, check=False,
    )
    assert result.returncode == 0, result.stderr
    return (state_dir / "activate.sh").read_text(encoding="utf-8")


def test_install_adapter_uses_saved_service_ports(tmp_path: Path) -> None:
    activation = generate_activation(tmp_path / "state")
    assert 'PIXELVERSE_URL="http://127.0.0.1:5999"' in activation
    assert 'PIXELVERSE_BRIDGE_URL="http://127.0.0.1:4999"' in activation


def test_explicit_adapter_ports_override_saved_ports(tmp_path: Path) -> None:
    activation = generate_activation(tmp_path / "state", {
        "PIXELVERSE_PORT": "6001", "PIXELVERSE_BRIDGE_PORT": "5001",
    })
    assert 'PIXELVERSE_URL="http://127.0.0.1:6001"' in activation
    assert 'PIXELVERSE_BRIDGE_URL="http://127.0.0.1:5001"' in activation
```

- [ ] **Step 2: Run the focused tests and confirm the regression**

Run: `PYTHONPATH=. pytest -q tests/test_run_adapter_ports.py`

Expected: the saved-port test fails because `activate.sh` contains `5660` and `4567`; the explicit override test passes.

- [ ] **Step 3: Expand saved-port command coverage**

Change the `run.sh` command selection to:

```bash
case "$COMMAND" in
  start|stop|restart|down_up|status|log|logs|doctor|bridge-status|test-hook|smoke-furniture-drag|assets-status|down|adapter|install-adapter|install-codex-hook|enable-shell-adapter)
    load_saved_port=1
    ;;
  *) load_saved_port=0 ;;
esac
```

Do not change the existing explicit-environment precedence in the two assignments below the case block.

- [ ] **Step 4: Run focused launcher tests**

Run: `PYTHONPATH=. pytest -q tests/test_run_adapter_ports.py tests/test_hook_bridge.py tests/test_command_deck_hook_smoke.py`

Expected: all tests pass.

- [ ] **Step 5: Commit only the port regression**

```bash
git add run.sh tests/test_run_adapter_ports.py
git commit -m "fix: reuse saved ports for agent adapters"
```

---

### Task 2: Carry runtime project identity through adapter and backend

**Files:**
- Modify: `agent_bridges/cli_adapter.py:6-15,113-155`
- Modify: `agent_bridges/pixelverse_client.py:46-143`
- Modify: `pixelverse_fastapi.py:29-45,75-89,203-224`
- Modify: `pixelverse_server.py:616-729,811-836`
- Modify: `tests/test_agent_bridges.py`
- Modify: `tests/test_fastapi_service.py`
- Modify: `tests/test_hermes_integration.py`

**Interfaces:**
- Produces: `resolve_project_identity(cwd: str | None = None) -> tuple[str | None, str | None]`.
- Produces: optional `PixelverseClient.project_path` and `PixelverseClient.project_name` fields included in event and heartbeat payloads.
- Produces: optional public Agent fields `project_path` and `project_name` retained by `WorldState`.

- [ ] **Step 1: Write failing client identity tests**

Add to `tests/test_agent_bridges.py`:

```python
from pathlib import Path

from agent_bridges.cli_adapter import HeartbeatLoop, resolve_project_identity


def test_project_identity_uses_canonical_launch_directory(tmp_path: Path) -> None:
    project = tmp_path / "Allen_CV"
    project.mkdir()
    path, name = resolve_project_identity(str(project / "."))
    assert path == str(project.resolve())
    assert name == "Allen_CV"


def test_events_and_heartbeats_include_project_identity() -> None:
    client = RecordingClient()
    client.project_path = "/home/user/Allen_CV"
    client.project_name = "Allen_CV"
    client.start()
    client.heartbeat()
    assert client.posts[0][1]["project_path"] == "/home/user/Allen_CV"
    assert client.posts[0][1]["project_name"] == "Allen_CV"
    assert client.posts[1][1]["project_path"] == "/home/user/Allen_CV"
    assert client.posts[1][1]["project_name"] == "Allen_CV"
```

- [ ] **Step 2: Write failing backend retention tests**

Extend the FastAPI event test so it posts:

```python
project_path="/home/user/Allen_CV",
project_name="Allen_CV",
```

and asserts the world Agent exposes both values. Add a `WorldState` test that performs a project-bearing upsert followed by a heartbeat-like upsert without those keys and verifies the stored identity remains unchanged.

- [ ] **Step 3: Run the focused Python tests and confirm missing fields**

Run: `PYTHONPATH=. pytest -q tests/test_agent_bridges.py tests/test_fastapi_service.py tests/test_hermes_integration.py`

Expected: tests fail because the resolver, client fields, API fields, and world fields do not exist.

- [ ] **Step 4: Add the adapter identity resolver and client fields**

Implement in `agent_bridges/cli_adapter.py`:

```python
from pathlib import Path


def resolve_project_identity(cwd: str | None = None) -> tuple[str | None, str | None]:
    try:
        path = Path(cwd or os.getcwd()).resolve()
    except (OSError, RuntimeError):
        return None, None
    value = str(path)
    return value, path.name or value
```

Resolve once in `main()`, pass both values into `PixelverseClient`, and export them as `PIXELVERSE_PROJECT_PATH` and `PIXELVERSE_PROJECT_NAME` in `child_env` when present.

Add dataclass fields in `PixelverseClient`:

```python
project_path: str | None = None
project_name: str | None = None
```

Create one private helper that adds non-empty process, instance, and project metadata to both event and heartbeat payloads; use it from both methods to avoid divergent payload behavior.

- [ ] **Step 5: Add optional FastAPI and world-state fields**

Add to both `HeartbeatPayload` and `GenericAgentEvent`:

```python
project_path: str | None = Field(None, max_length=4096, description="Canonical Agent project path.")
project_name: str | None = Field(None, max_length=255, description="Short Agent project directory name.")
```

Pass both fields into `WORLD.upsert_agent()` from `generic_event`. Add matching optional fields to `AgentState`, expose them through `asdict()`, and update them only for non-empty incoming values:

```python
if payload.get("project_path"):
    agent.project_path = trim_text(payload.get("project_path"), 4096)
if payload.get("project_name"):
    agent.project_name = trim_text(payload.get("project_name"), 255)
```

- [ ] **Step 6: Run focused and schema tests**

Run: `PYTHONPATH=. pytest -q tests/test_agent_bridges.py tests/test_fastapi_service.py tests/test_hermes_integration.py tests/test_codex_pixelverse_hook.py`

Expected: all tests pass and existing hook payloads remain valid.

- [ ] **Step 7: Commit the runtime data path**

```bash
git add agent_bridges/cli_adapter.py agent_bridges/pixelverse_client.py pixelverse_fastapi.py pixelverse_server.py tests/test_agent_bridges.py tests/test_fastapi_service.py tests/test_hermes_integration.py
git commit -m "feat: publish agent project identity"
```

---

### Task 3: Show project name in roster and full path in Agent detail

**Files:**
- Modify: `public/command_deck_model.mjs:166-205`
- Modify: `public/agent_roster_model.mjs:74-110`
- Modify: `public/agent_roster_view.mjs:1-110`
- Modify: `public/agent_detail_model.mjs:5-36`
- Modify: `public/agent_detail_view.mjs:20-61`
- Modify: `public/ui_strings.mjs:161-185`
- Modify: `public/index.html:1744-1757,1962-1970`
- Modify: `tests/test_command_deck_model.mjs`
- Modify: `tests/test_agent_roster_model.mjs`
- Modify: `tests/test_agent_roster_view.mjs`
- Modify: `tests/test_agent_detail_model.mjs`
- Modify: `tests/test_agent_detail_view.mjs`
- Modify: `tests/test_frontend_i18n.mjs`

**Interfaces:**
- Consumes: snapshot fields `project_path` and `project_name` from Task 2.
- Produces: canonical model fields `projectPath` and `projectName`.
- Produces: roster row/descriptor field `projectName` and detail field `projectIdentity`.

- [ ] **Step 1: Write failing canonical-model and roster tests**

Add `project_path` and `project_name` to a command-deck fixture and assert:

```javascript
assert.equal(agent.projectPath, '/home/user/Allen_CV');
assert.equal(agent.projectName, 'Allen_CV');
```

Add a roster assertion:

```javascript
assert.equal(row.projectName, 'Allen_CV');
```

Update the roster view fixture so its expected descriptor contains `projectName: 'Allen_CV'`, and assert the rendered project node contains `Allen_CV` with `data-external-copy="true"`.

- [ ] **Step 2: Write failing Agent-detail and i18n tests**

Extend the detail fixture with both fields and assert:

```javascript
assert.equal(detail.projectIdentity, '/home/user/Allen_CV');
```

Add `[data-agent-detail-project]` to the view fixture, render the detail, and assert the full path plus external-copy marker. Add `agentDetail.project` to the exact four-locale key parity assertion.

- [ ] **Step 3: Run the focused Node tests and confirm the UI gap**

Run: `node --test tests/test_command_deck_model.mjs tests/test_agent_roster_model.mjs tests/test_agent_roster_view.mjs tests/test_agent_detail_model.mjs tests/test_agent_detail_view.mjs tests/test_frontend_i18n.mjs`

Expected: tests fail on missing project model, DOM, and locale fields.

- [ ] **Step 4: Preserve project fields in the canonical and roster models**

Add to `makeAgent()`:

```javascript
projectPath: String(agent.project_path || ''),
projectName: String(agent.project_name || ''),
```

Add `projectName` to roster rows and descriptors. In `createAgentRosterView`, create a `span.agent-roster-project` between state and task, render it only when non-empty, mark it as external copy only when populated, and include the value in the accessible card label without changing localized signal copy.

- [ ] **Step 5: Render full project identity in Agent detail**

Add to `buildAgentDetail()`:

```javascript
projectIdentity: String(
  agent.projectPath || agent.project_path || agent.projectName || agent.project_name || '',
),
```

Include `projectIdentity` in `externalFields`. Render it into `[data-agent-detail-project]` and add this field to `public/index.html`:

```html
<dt data-i18n="agentDetail.project"></dt><dd data-agent-detail-project></dd>
```

Add exact locale values:

```text
en-US: Project
zh-TW: 專案
ja-JP: プロジェクト
ko-KR: 프로젝트
```

Retain the current uncommitted room-key localization behavior and `eventTextFor` logic while editing these files.

- [ ] **Step 6: Adjust roster layout for the extra metadata line**

Update CSS so `.agent-roster-copy` has five rows and `.agent-roster-project` shares ellipsis behavior with the existing name/state/task nodes. Use a subdued 9px style distinct from the task line. Do not increase the card's maximum width beyond 190px.

- [ ] **Step 7: Run focused frontend tests**

Run: `node --test tests/test_command_deck_model.mjs tests/test_agent_roster_model.mjs tests/test_agent_roster_view.mjs tests/test_agent_detail_model.mjs tests/test_agent_detail_view.mjs tests/test_frontend_i18n.mjs tests/test_command_deck_i18n.mjs`

Expected: all tests pass.

- [ ] **Step 8: Commit only project-identity UI changes, preserving prior edits**

Use `git diff` to distinguish pre-existing changes before staging. Stage the complete intended versions only after verifying the room-localization/event-formatting changes are retained.

```bash
git add public/command_deck_model.mjs public/agent_roster_model.mjs public/agent_roster_view.mjs public/agent_detail_model.mjs public/agent_detail_view.mjs public/ui_strings.mjs public/index.html tests/test_command_deck_model.mjs tests/test_agent_roster_model.mjs tests/test_agent_roster_view.mjs tests/test_agent_detail_model.mjs tests/test_agent_detail_view.mjs tests/test_frontend_i18n.mjs
git commit -m "feat: show agent project identity"
```

---

### Task 4: Separate readable Agent bubbles from compact room labels

**Files:**
- Modify: `pixelworld_mvp/src/styles.css:56-60`
- Modify: `pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts:455-520`
- Modify: `pixelworld_mvp/tests/interiorCutawaySystem.test.ts`
- Modify: `pixelworld_mvp/tests/gameConfig.test.ts`

**Interfaces:**
- Consumes: `CutawayRoomLabel.kind` values `agent`, `hook`, and furniture-label kinds.
- Produces: Agent-label measurement at normal readable width; compact measurement for non-Agent labels.

- [ ] **Step 1: Replace compact-Agent test expectations with readable-width expectations**

Keep furniture/hook assertions at 26 pixels, but change Agent-label assertions to verify:

```typescript
const agentLabel = labelLayer.children.find((label) => label.className.includes('--agent'))!;
expect(agentLabel.getBoundingClientRect().width).toBeGreaterThan(26);
expect(agentLabel.getBoundingClientRect().width).toBeLessThanOrEqual(160);
expect(agentLabel.textContent).toContain('暫時休息');
```

Update the fake DOM measurement helper so Agent labels return their readable width by default while compact labels still return 26. Add a `gameConfig` CSS contract asserting the Agent rule contains `max-width: 160px`, normal wrapping, and no inherited 26-pixel cap.

- [ ] **Step 2: Run focused Pixelworld tests and confirm the current truncation contract fails**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts tests/gameConfig.test.ts`

Expected: tests fail because `.cutaway-room-label--agent` still inherits `max-width: 26px` and the fixture models that compact behavior.

- [ ] **Step 3: Give Agent labels a readable default style**

Update the Agent modifier with an explicit override:

```css
.cutaway-room-label--agent {
  width: max-content;
  max-width: 160px;
  overflow: visible;
  overflow-wrap: anywhere;
  white-space: pre-line;
}
```

Retain its existing padding, colors, pointer events, shadow, font size, and transform. Keep the base 26-pixel rule unchanged for furniture and hook labels.

- [ ] **Step 4: Measure Agent labels at their normal size**

In `renderRoomLabels()`, only set `data-measure-expanded="true"` for non-Agent items:

```typescript
if (item.kind !== 'agent') label.dataset.measureExpanded = 'true';
const measured = label.getBoundingClientRect();
delete label.dataset.measureExpanded;
```

This ensures the existing clamp and selection-collision calculations use the Agent bubble's real readable bounds.

- [ ] **Step 5: Run focused Pixelworld tests**

Run: `cd pixelworld_mvp && npm test -- --run tests/interiorCutawaySystem.test.ts tests/gameConfig.test.ts`

Expected: all focused tests pass; Agent labels are readable and other labels remain compact.

- [ ] **Step 6: Commit the bubble fix**

```bash
git add pixelworld_mvp/src/styles.css pixelworld_mvp/src/rendering/InteriorCutawayDomOverlay.ts pixelworld_mvp/tests/interiorCutawaySystem.test.ts pixelworld_mvp/tests/gameConfig.test.ts
git commit -m "fix: keep interior agent bubbles readable"
```

---

### Task 5: Verify the complete onboarding flow and document the resolved behavior

**Files:**
- Modify: `README.md` only if the current troubleshooting text still requires a manual port override.
- Test: existing Python, Node, and Pixelworld suites.

**Interfaces:**
- Consumes: all deliverables from Tasks 1–4.
- Produces: verified user flow with no manual `PIXELVERSE_URL` requirement.

- [ ] **Step 1: Run all backend and shell tests**

Run: `PYTHONPATH=. pytest -q`

Expected: the full Python suite passes with at most the existing intentional skips.

- [ ] **Step 2: Run all root frontend tests**

Run: `node --test tests/*.mjs`

Expected: all Node tests pass.

- [ ] **Step 3: Run the full Pixelworld suite and build**

Run: `cd pixelworld_mvp && npm test -- --run`

Expected: all Vitest tests pass.

Run: `cd pixelworld_mvp && npm run build`

Expected: production build succeeds.

- [ ] **Step 4: Regenerate the local adapter and inspect its resolved URL**

Run from the repository root:

```bash
./hook_bridge.sh --target /home/a0665x/Desktop/Allen_CV --agent codex
rg -n 'PIXELVERSE_(URL|BRIDGE_URL)' .pixelverse-service/activate.sh
```

Expected: the activation file reports the saved running ports (`5661` and `4568` in the current local configuration), not `5660` and `4567`.

- [ ] **Step 5: Restart services and perform a live API smoke**

Run:

```bash
./run.sh restart
./run.sh status
```

Then launch a short observable command from `Allen_CV` without a manual URL override and inspect `/api/world` for `project_name: Allen_CV` and its canonical `project_path`. Do not fabricate a permanent Agent entry; use the real adapter lifecycle.

- [ ] **Step 6: Browser-check roster, detail, and interior bubble**

At `http://localhost:5661/` verify:

1. the launched Agent appears;
2. its roster card shows `Allen_CV`;
3. clicking the card shows the complete project path;
4. an interior idle/rest state shows the full localized phrase rather than `Z暫`;
5. furniture and hook labels remain compact;
6. English, Traditional Chinese, Japanese, and Korean field labels remain locale-pure.

- [ ] **Step 7: Update README only if necessary and commit verification docs**

If README currently tells users to set `PIXELVERSE_URL` for the normal flow, replace that with the automatic saved-port behavior and keep the environment variable only as an advanced override. Otherwise make no documentation change and no commit for this step.

```bash
git add README.md
git commit -m "docs: clarify automatic agent port discovery"
```

- [ ] **Step 8: Inspect final scope**

Run:

```bash
git status --short
git log --oneline -8
```

Expected: only pre-existing unrelated dirty files remain; the feature is represented by focused commits and no local absolute path is introduced into checked-in runtime defaults.

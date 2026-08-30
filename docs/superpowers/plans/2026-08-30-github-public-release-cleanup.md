# GitHub Public Release Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a portable, verified CLI_Pixelverse release on `origin/main` with two current screenshots, one beginner Quick Start, current runtime fixes, and no internal history, retired map workflow, local-machine paths, or licensed asset payloads.

**Architecture:** Treat the public repository as three surfaces: runtime code, user-facing onboarding, and release hygiene. First preserve and verify the current functional worktree changes, then enforce portability and retirement rules with tests, replace the README and media, remove/ignore non-product artifacts, and finish with full build/runtime verification plus a non-force push.

**Tech Stack:** Bash, Python 3/FastAPI/pytest, TypeScript 7, Phaser 3, Vite 8, Vitest 4, Docker Compose, GitHub Markdown.

## Global Constraints

- Work directly on the user-approved `main` branch and never force-push.
- Preserve current locale-ingress, building hit-region, dependency, Modern Office asset-reuse, and related test changes.
- Public files must not contain `/home/a0665x`, `AI_AGX_WS`, or another developer workstation assumption.
- The paid `Modern_Office_Revamped_v1.zip`, extracted sprites, prepared sprites, and generated collision data must never be committed.
- Keep the built-in Phaser village and current room editor; remove the retired YAML floorplan/map-builder compatibility surface.
- Do not delete untracked `global_map/`, `.cache/`, `.superpowers/brainstorm/`, `docs/plans/`, or `pixelworld_mvp/build_world_guide.md`; ignore them.
- The README contains exactly one Quick Start and uses `$PIXELVERSE_ROOT`, `pwd -P`, and `/path/to/your-project` rather than a real workstation path.
- Support claims must distinguish Codex project hooks, process-level CLI adapters, Hermes hooks/plugin, and the generic HTTP API.

---

## File Structure

- `README.md`: single public product overview, screenshots, setup, binding, support matrix, operations, troubleshooting, and license links.
- `.gitignore`: public-clone rules for local runtime, licensed assets, caches, internal planning, legacy maps, build output, and secrets.
- `.dockerignore`: minimal runtime build context without repository metadata, internal documentation, tests, caches, or local assets.
- `run.sh`: portable CLI discovery/installation and supported command dispatch.
- `pixelverse_server.py`: portable optional Hermes source configuration.
- `tests/test_public_release.py`: release-contract tests for README/media/path safety/repository hygiene.
- `tests/test_portable_onboarding.py`: portable hook and command examples.
- `tests/test_run_floorplan.py`: active-source assertion that retired floorplan selection cannot return.
- `docs/reference/office-assets.md`: the retained detailed licensed-asset reference.
- `cli_pixelverse_demo_1.png`, `cli_pixelverse_demo_2.png`: GitHub hero media.

### Task 1: Preserve And Commit Current Product Fixes

**Files:**
- Modify: `pixelworld_mvp/src/game/productionLocaleIngress.ts`
- Modify: `pixelworld_mvp/src/main.ts`
- Modify: `pixelworld_mvp/src/rendering/domStatusOverlay.ts`
- Modify: `requirements.txt`
- Modify: `scripts/provision_modern_office_assets.py`
- Modify: `pixelworld_mvp/tests/backendSnapshot.test.ts`
- Modify: `pixelworld_mvp/tests/productionLocaleIngress.test.ts`
- Create: `pixelworld_mvp/tests/domStatusOverlay.test.ts`
- Modify: `tests/test_modern_office_asset_provisioning.py`

**Interfaces:**
- Consumes: existing locale postMessage ingress, overlay coordinate conversion, and Modern Office preparation metadata.
- Produces: `connectProductionLocaleIngress(host, publishLocale)`, `buildingHitRegionToOverlay(building, rect)`, and ZIP-independent reuse of valid prepared assets.

- [ ] **Step 1: Inspect only the exact current functional diff**

Run:

```bash
git diff -- requirements.txt scripts/provision_modern_office_assets.py \
  tests/test_modern_office_asset_provisioning.py \
  pixelworld_mvp/src/game/productionLocaleIngress.ts \
  pixelworld_mvp/src/main.ts \
  pixelworld_mvp/src/rendering/domStatusOverlay.ts \
  pixelworld_mvp/tests/backendSnapshot.test.ts \
  pixelworld_mvp/tests/productionLocaleIngress.test.ts \
  pixelworld_mvp/tests/domStatusOverlay.test.ts
```

Expected: only the approved locale, hit-region, neutral dependency fixture, `websockets`, and prepared-asset reuse work is present.

- [ ] **Step 2: Run focused Python asset tests**

Run:

```bash
PYTHONPATH=. pytest -q tests/test_modern_office_asset_provisioning.py
```

Expected: all tests pass, including `test_reuses_valid_prepared_assets_when_original_zip_is_unavailable`.

- [ ] **Step 3: Run focused Pixelworld tests**

Run:

```bash
cd pixelworld_mvp
npm test -- --run tests/productionLocaleIngress.test.ts tests/domStatusOverlay.test.ts tests/backendSnapshot.test.ts
```

Expected: all selected Vitest files pass.

- [ ] **Step 4: Commit the preserved fixes without unrelated files**

```bash
git add requirements.txt scripts/provision_modern_office_assets.py \
  tests/test_modern_office_asset_provisioning.py \
  pixelworld_mvp/src/game/productionLocaleIngress.ts \
  pixelworld_mvp/src/main.ts \
  pixelworld_mvp/src/rendering/domStatusOverlay.ts \
  pixelworld_mvp/tests/backendSnapshot.test.ts \
  pixelworld_mvp/tests/productionLocaleIngress.test.ts \
  pixelworld_mvp/tests/domStatusOverlay.test.ts
git commit -m "fix: finalize portable village runtime behavior"
```

### Task 2: Enforce Portable Runtime And Retire Compatibility Commands

**Files:**
- Create: `tests/test_public_release.py`
- Modify: `tests/test_portable_onboarding.py`
- Modify: `tests/test_run_floorplan.py`
- Modify: `run.sh`
- Modify: `pixelverse_server.py`
- Delete: `pixelworld_mvp/scripts/install-modern-office-assets.sh`

**Interfaces:**
- Consumes: `HERMES_REPO`, `PIXELVERSE_HERMES_REPO`, `PIXELVERSE_HERMES_ROOT`, `HERMES_HOME`, and `PATH`.
- Produces: portable Hermes discovery with no hardcoded checkout and a command dispatcher containing no YAML floorplan/map-builder aliases.

- [ ] **Step 1: Add failing release portability tests**

Create `tests/test_public_release.py` with:

```python
from __future__ import annotations

import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PUBLIC_RUNTIME = (
    "README.md",
    "run.sh",
    "hook_bridge.sh",
    "pixelverse_server.py",
    "pixelverse_fastapi.py",
    "docker-compose.yml",
    "scripts",
    "pixelworld_mvp/scripts",
)


def tracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "-z"], cwd=ROOT, check=True, capture_output=True
    )
    return [ROOT / item.decode() for item in result.stdout.split(b"\0") if item]


def test_public_runtime_has_no_developer_machine_path() -> None:
    files: list[Path] = []
    for relative in PUBLIC_RUNTIME:
        path = ROOT / relative
        files.extend(path.rglob("*")) if path.is_dir() else files.append(path)
    for path in files:
        if path.is_file():
            text = path.read_text(encoding="utf-8", errors="ignore")
            assert "/home/a0665x" not in text, path
            assert "AI_AGX_WS" not in text, path


def test_retired_floorplan_commands_are_absent() -> None:
    source = (ROOT / "run.sh").read_text(encoding="utf-8")
    for token in ("floorplans|prepare-floorplan|map-builder", "YAML floorplans"):
        assert token not in source


def test_obsolete_asset_installer_is_absent() -> None:
    assert not (ROOT / "pixelworld_mvp/scripts/install-modern-office-assets.sh").exists()


def test_no_paid_modern_office_payload_is_tracked() -> None:
    names = [path.as_posix() for path in tracked_files()]
    forbidden = ("Modern_Office_Revamped", "/assets/private/modern-office-v1.2/")
    assert [name for name in names if any(token in name for token in forbidden)] == []
```

- [ ] **Step 2: Replace the retired command behavior test**

Replace `tests/test_run_floorplan.py` with:

```python
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_run_source_contains_no_floorplan_selector_or_compatibility_command() -> None:
    source = (ROOT / "run.sh").read_text(encoding="utf-8")
    for retired in (
        "select_floorplan_key",
        "prepare_floorplan",
        "PIXELVERSE_FLOORPLAN",
        "PIXELVERSE_GLOBAL_MAP_DIR_HOST",
        "Select visual floorplan",
        "floorplans|prepare-floorplan|map-builder",
    ):
        assert retired not in source
```

- [ ] **Step 3: Run the tests and verify the existing public paths fail**

Run:

```bash
PYTHONPATH=. pytest -q tests/test_public_release.py tests/test_portable_onboarding.py tests/test_run_floorplan.py
```

Expected: failures identify hardcoded Hermes paths, the compatibility command branch, and the obsolete asset installer.

- [ ] **Step 4: Make Hermes discovery portable in `run.sh`**

In `detect_agent_roots`, use only explicit/user-standard candidates:

```bash
    hermes)
      local candidate
      for candidate in "${HERMES_REPO:-}" "$HOME/.hermes"; do
        [[ -n "$candidate" && -e "$candidate" ]] && echo "- root: $candidate"
      done
      ;;
```

In `discover_agent_command`, append an explicit virtualenv command only when configured:

```bash
  if [[ "$kind" == "hermes" && -n "${HERMES_REPO:-}" ]]; then
    candidates+=("${HERMES_REPO%/}/venv/bin/hermes")
  fi
```

Replace the workstation-specific restart line in `install_hermes_hook` with:

```bash
  echo "Restart your Hermes gateway/OpenWebUI process so gateway.hooks reloads this hook."
```

Delete the `floorplans|prepare-floorplan|map-builder)` dispatch branch completely.

- [ ] **Step 5: Make `pixelverse_server.py` Hermes repository optional**

Replace the hardcoded default with:

```python
HERMES_REPO_VALUE = os.getenv("PIXELVERSE_HERMES_REPO", "").strip()
HERMES_REPO = Path(HERMES_REPO_VALUE).expanduser() if HERMES_REPO_VALUE else None
```

At the repository snapshot guard, use:

```python
        if HERMES_REPO is None or not HERMES_REPO.exists():
            return None
```

- [ ] **Step 6: Remove the superseded asset installer**

Run:

```bash
git rm pixelworld_mvp/scripts/install-modern-office-assets.sh
```

The canonical installer remains `scripts/provision_modern_office_assets.py`, invoked through `run.sh`.

- [ ] **Step 7: Update portable onboarding assertions and run tests**

Change example assertions in `tests/test_portable_onboarding.py` to require:

```python
assert 'export PIXELVERSE_ROOT="$(pwd -P)"' in readme
assert 'cd /path/to/your-project' in readme
assert '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex --launch' in readme
assert "/home/user/my-project" not in readme
```

Run:

```bash
PYTHONPATH=. pytest -q tests/test_public_release.py tests/test_portable_onboarding.py \
  tests/test_run_floorplan.py tests/test_run_restart.py tests/test_legacy_map_retirement.py
```

Expected: all selected tests pass.

- [ ] **Step 8: Commit runtime portability**

```bash
git add run.sh pixelverse_server.py tests/test_public_release.py \
  tests/test_portable_onboarding.py tests/test_run_floorplan.py
git commit -m "refactor: remove machine-specific release paths"
```

### Task 3: Replace README And Preview Media

**Files:**
- Rewrite: `README.md`
- Add: `cli_pixelverse_demo_1.png`
- Add: `cli_pixelverse_demo_2.png`
- Delete: `pixel_ui.gif`
- Delete: `docs/assets/command-deck-village.png`
- Delete: `docs/assets/starting-cabin-agent.png`
- Modify: `tests/test_public_release.py`
- Modify: `tests/test_portable_onboarding.py`

**Interfaces:**
- Consumes: `./run.sh --start`, `hook_bridge.sh --agent <kind> --launch`, `.pixelverse-service/activate.sh`, default ports 5660/4567, and Modern Office provisioning.
- Produces: one GitHub-ready onboarding route whose commands work from any clone path.

- [ ] **Step 1: Add failing README/media contract tests**

Append to `tests/test_public_release.py`:

```python
def test_readme_has_one_quick_start_and_current_demo_images() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    assert readme.count("## Quick Start") == 1
    assert "./cli_pixelverse_demo_1.png" in readme
    assert "./cli_pixelverse_demo_2.png" in readme
    assert "pixel_ui.gif" not in readme
    assert "command-deck-village.png" not in readme
    assert "starting-cabin-agent.png" not in readme


def test_readme_documents_portable_binding_and_real_presence() -> None:
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    for required in (
        'export PIXELVERSE_ROOT="$(pwd -P)"',
        "cd /path/to/your-project",
        '"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex --launch',
        "Modern_Office_Revamped_v1.zip",
        "real CLI session",
        "http://localhost:5660",
    ):
        assert required in readme
```

Run:

```bash
PYTHONPATH=. pytest -q tests/test_public_release.py tests/test_portable_onboarding.py
```

Expected: README structure and current image assertions fail.

- [ ] **Step 2: Rewrite README with one exact structure**

Use these headings in this order:

```markdown
# CLI_Pixelverse

Local pixel-village observability for AI agent CLIs.

![CLI_Pixelverse live Agent roster, ECG, village, and detail panel](./cli_pixelverse_demo_1.png)

*Live Agent roster, activity ECG, project state, village routing, and recent events.*

![CLI_Pixelverse editable room interior](./cli_pixelverse_demo_2.png)

*Open a building to inspect an Agent and arrange its room with licensed furniture.*

## What You Get
## Quick Start
### 1. Clone and prepare the licensed asset
### 2. Start Pixelverse
### 3. Bind and launch an Agent project
## Agent Integration Coverage
## Everyday Commands
## Ports And Remote Access
## Troubleshooting
## Development
## Assets And Licenses
```

The Quick Start command sequence is:

```bash
git clone https://github.com/a0665x/CLI_Pixelverse.git
cd CLI_Pixelverse
export PIXELVERSE_ROOT="$(pwd -P)"
mkdir -p private_assets/modern-office
```

After the user places `Modern_Office_Revamped_v1.zip` at the documented clone-relative path:

```bash
PIXELVERSE_AGENT_KIND=codex ./run.sh --start
```

In a second terminal:

```bash
cd /path/to/CLI_Pixelverse
export PIXELVERSE_ROOT="$(pwd -P)"
cd /path/to/your-project
"$PIXELVERSE_ROOT/hook_bridge.sh" --agent codex --launch
```

State directly below the commands that binding installs integration metadata but the roster character appears only after a real CLI session starts and emits lifecycle activity.

- [ ] **Step 3: Write a factual integration matrix**

Use this distinction:

| Agent | Launch value | Integration level |
|---|---|---|
| Codex | `codex` | CLI lifecycle adapter plus project hooks |
| Gemini CLI | `gemini-cli` | Process-level CLI lifecycle adapter |
| Claude Code | `claude-code` | Process-level CLI lifecycle adapter |
| Antigravity | `antigravity` | Process-level CLI lifecycle adapter |
| Ollama | `ollama` | Process-level CLI lifecycle adapter |
| Hermes | `hermes` | CLI adapter plus optional Hermes hook/plugin and gateway relay |
| Custom agent | `generic` | Generic HTTP event API |

Document the generic API as `POST /api/event` and link API discovery to `http://localhost:5660/docs` without claiming tool-level parity for process-only adapters.

- [ ] **Step 4: Stage new media and remove superseded media**

```bash
git add cli_pixelverse_demo_1.png cli_pixelverse_demo_2.png
git rm pixel_ui.gif docs/assets/command-deck-village.png docs/assets/starting-cabin-agent.png
```

- [ ] **Step 5: Run README contracts**

Run:

```bash
PYTHONPATH=. pytest -q tests/test_public_release.py tests/test_portable_onboarding.py \
  tests/test_legacy_map_retirement.py
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit README and media**

```bash
git add README.md tests/test_public_release.py tests/test_portable_onboarding.py
git commit -m "docs: present portable Pixelverse quick start"
```

### Task 4: Remove Internal History And Ignore Local Artifacts

**Files:**
- Modify: `.gitignore`
- Modify: `.dockerignore`
- Delete: `.superpowers/sdd/**`
- Delete: `docs/superpowers/**`
- Ignore: `.cache/**`
- Ignore: `.superpowers/brainstorm/**`
- Ignore: `docs/plans/**`
- Ignore: `global_map/**`
- Ignore: `pixelworld_mvp/build_world_guide.md`

**Interfaces:**
- Consumes: Git tracking and Docker build context rules.
- Produces: a public repository containing product code/tests/docs while leaving user-owned local artifacts untouched.

- [ ] **Step 1: Add repository hygiene assertions**

Append to `tests/test_public_release.py`:

```python
def test_internal_history_is_not_tracked() -> None:
    names = [path.relative_to(ROOT).as_posix() for path in tracked_files()]
    forbidden_prefixes = (".superpowers/", "docs/superpowers/", "docs/plans/", "global_map/")
    assert [name for name in names if name.startswith(forbidden_prefixes)] == []


def test_local_artifact_paths_are_ignored() -> None:
    rules = (ROOT / ".gitignore").read_text(encoding="utf-8")
    for rule in (
        ".cache/",
        ".codegraph/",
        ".superpowers/",
        "docs/plans/",
        "docs/superpowers/",
        "global_map/",
        "pixelworld_mvp/build_world_guide.md",
        "private_assets/",
    ):
        assert rule in rules
```

- [ ] **Step 2: Verify tests fail before cleanup**

Run:

```bash
PYTHONPATH=. pytest -q tests/test_public_release.py
```

Expected: tracked internal-history and missing-ignore-rule assertions fail.

- [ ] **Step 3: Extend `.gitignore` with explicit public-clone rules**

Ensure these entries exist once:

```gitignore
.pixelverse-service/
private_assets/
pixelworld_mvp/public/assets/private/
.cache/
.codegraph/
.superpowers/
docs/plans/
docs/superpowers/
global_map/
pixelworld_mvp/build_world_guide.md
tmp/
spec/
.codex/
.agents/
**/__pycache__/
*.py[cod]
**/.pytest_cache/
**/node_modules/
**/dist/
test-results/
playwright-report/
browser-artifacts/
.env
.env.*
*.pem
*.key
*.log
.DS_Store
.worktrees/
.gstack/
```

- [ ] **Step 4: Restore a minimal `.dockerignore`**

Keep `.codegraph/` excluded and retain the private prepared-asset allow-list required by the build:

```dockerignore
.git/
.worktrees/
.codegraph/
**/node_modules
**/dist
**/__pycache__
**/.pytest_cache
.pixelverse-service/
**/assets/private/*
!pixelworld_mvp/public/assets/private/modern-office-v1.2/
!pixelworld_mvp/public/assets/private/modern-office-v1.2/**
.venv/
**/.venv/
.codex/
.agents/
.spec/
.superpowers/
.cache/
tmp/
tests/
test-results/
playwright-report/
browser-artifacts/
docs/
.env
.env.*
*.pem
*.key
*.log
```

- [ ] **Step 5: Remove only tracked internal history**

Resolve the exact tracked targets first:

```bash
git ls-files '.superpowers/**' 'docs/superpowers/**'
```

Then remove those tracked targets:

```bash
git rm -r .superpowers/sdd docs/superpowers
```

Do not run a recursive filesystem deletion against untracked `.superpowers/brainstorm/` or any ignored directory.

- [ ] **Step 6: Run repository hygiene tests**

Run:

```bash
PYTHONPATH=. pytest -q tests/test_public_release.py tests/test_docker_release_integrity.py
git status --short --ignored
```

Expected: tests pass; local caches/maps/plans are `!!` ignored, not staged.

- [ ] **Step 7: Commit public repository hygiene**

```bash
git add .gitignore .dockerignore tests/test_public_release.py
git commit -m "chore: remove internal release artifacts"
```

### Task 5: Audit Retained Public References

**Files:**
- Modify if required: `docs/reference/office-assets.md`
- Modify if required: `pixelworld_mvp/README.md`
- Modify if required: `pixelworld_mvp/ATTRIBUTION.md`
- Modify if required: `pixelworld_mvp/public/assets/ASSET_SOURCES.md`

**Interfaces:**
- Consumes: current `run.sh` asset workflow and included third-party assets.
- Produces: retained references that agree with the new README and do not advertise retired paths.

- [ ] **Step 1: Read every retained public Markdown file completely**

Run:

```bash
for path in docs/reference/office-assets.md pixelworld_mvp/README.md \
  pixelworld_mvp/ATTRIBUTION.md pixelworld_mvp/public/assets/ASSET_SOURCES.md; do
  sed -n '1,9999p' "$path"
done
```

Expected: full file contents are available for cross-reference.

- [ ] **Step 2: Scan retained docs for retired or local contracts**

Run:

```bash
rg -n '/home/a0665x|AI_AGX_WS|global_map|map-builder|prepare-floorplan|pixel_ui.gif|install-modern-office-assets' \
  README.md docs/reference pixelworld_mvp/README.md pixelworld_mvp/ATTRIBUTION.md \
  pixelworld_mvp/public/assets/ASSET_SOURCES.md
```

Expected: no match. If a current attribution name contains a substring, verify it is an asset name rather than a workflow reference before changing it.

- [ ] **Step 3: Validate public Markdown links with repository paths**

Run:

```bash
python3 - <<'PY'
import re
from pathlib import Path
root = Path('.')
for source in (root / 'README.md', root / 'docs/reference/office-assets.md', root / 'pixelworld_mvp/README.md'):
    text = source.read_text(encoding='utf-8')
    for target in re.findall(r'\[[^]]+\]\((?!https?://|#)([^)]+)\)', text):
        path = (source.parent / target.split('#', 1)[0]).resolve()
        assert path.exists(), f'{source}: missing {target}'
print('local Markdown links: ok')
PY
```

Expected: `local Markdown links: ok`.

- [ ] **Step 4: Commit only if retained references required corrections**

```bash
git add docs/reference/office-assets.md pixelworld_mvp/README.md \
  pixelworld_mvp/ATTRIBUTION.md pixelworld_mvp/public/assets/ASSET_SOURCES.md
git diff --cached --quiet || git commit -m "docs: align retained release references"
```

### Task 6: Complete Release Verification

**Files:**
- Verify: all tracked runtime, test, and documentation files.

**Interfaces:**
- Consumes: release candidate commits from Tasks 1–5.
- Produces: evidence that the branch is safe to publish.

- [ ] **Step 1: Run static release scans**

```bash
git ls-files -z | xargs -0 rg -n '/home/a0665x|AI_AGX_WS' && exit 1 || true
git ls-files | rg 'Modern_Office_Revamped.*\.zip|public/assets/private/modern-office' && exit 1 || true
git ls-files | rg '^(docs/superpowers/|\.superpowers/|docs/plans/|global_map/)' && exit 1 || true
bash -n run.sh hook_bridge.sh pixelworld_mvp/scripts/install-modern-office-assets.sh 2>/dev/null || \
  bash -n run.sh hook_bridge.sh
```

Expected: all three tracking scans print no matches; shell syntax succeeds for retained scripts.

- [ ] **Step 2: Run the complete Python suite**

```bash
PYTHONPATH=. pytest -q
```

Expected: all tests pass, with only explicitly marked skips.

- [ ] **Step 3: Run root JavaScript tests**

```bash
node --test tests/*.mjs
```

Expected: all tests pass.

- [ ] **Step 4: Run Pixelworld tests and production build**

```bash
cd pixelworld_mvp
npm test
npm run build
```

Expected: all Vitest tests pass and Vite produces `dist/`; the known bundle-size warning is informational unless a new error appears.

- [ ] **Step 5: Verify run.sh help and release integrity**

```bash
./run.sh --help
./run.sh --test
PYTHONPATH=. pytest -q tests/test_public_release.py tests/test_docker_release_integrity.py \
  tests/test_legacy_map_retirement.py tests/test_portable_onboarding.py
```

Expected: help lists only supported commands; all release-integrity tests pass.

- [ ] **Step 6: Start and smoke-test the local release**

```bash
./run.sh restart
./run.sh status
curl -fsS http://127.0.0.1:5660/health
curl -fsS http://127.0.0.1:5660/api/world
curl -fsS http://127.0.0.1:4567/health
```

If saved ports differ, use the URLs printed by `./run.sh status`. Expected: service and bridge are healthy, `/api/world` returns a snapshot, and the UI loads both demoed surfaces. If the licensed ZIP is absent but valid prepared assets exist, startup succeeds through the verified reuse path.

- [ ] **Step 7: Inspect the exact release diff**

```bash
git status --short
git log --oneline --decorate -12
git diff origin/main...HEAD --stat
git diff origin/main...HEAD -- README.md .gitignore .dockerignore run.sh pixelverse_server.py
```

Expected: no uncommitted product files; ignored user artifacts remain untracked; the diff contains no secrets, paid assets, local paths, or accidental unrelated changes.

### Task 7: Synchronize And Push `origin/main`

**Files:**
- Publish: verified Git commits only.

**Interfaces:**
- Consumes: clean verified local `main`.
- Produces: the same commit at local `main` and `origin/main`.

- [ ] **Step 1: Fetch and verify remote relationship**

```bash
git fetch origin main
git rev-list --left-right --count origin/main...main
```

Expected: the right count is the local release commits. If the left count is nonzero, stop before pushing; inspect and integrate remote work without force.

- [ ] **Step 2: Push the verified branch**

```bash
git push origin main
```

Expected: Git reports `main -> main` without force.

- [ ] **Step 3: Confirm local and remote commit identity**

```bash
git rev-parse main
git ls-remote --heads origin main
git status --short --branch
```

Expected: local and remote hashes match; the branch is up to date; only explicitly ignored local artifacts remain.

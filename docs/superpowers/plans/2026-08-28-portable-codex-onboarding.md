# Portable Codex Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make README onboarding and Codex hook installation work from any clone path while preserving every existing project hook.

**Architecture:** Move hook merge and atomic-write behavior into a dependency-free Python helper called by `run.sh`; keep `run.sh` as the public orchestrator. Derive activation guidance from the resolved Pixelverse repository root in README and MCP responses, and verify the complete flow in temporary paths that resemble another user's checkout.

**Tech Stack:** Bash 4+, Python 3 standard library, pytest, Markdown documentation.

## Global Constraints

- Public files must not contain `/home/a0665x` or assume a specific workspace name.
- Generated local files may contain the resolved absolute clone path and remain git-ignored.
- Existing `.codex/hooks.json` content must never be silently replaced.
- Malformed JSON and conflicting Pixelverse hook commands fail without changing the target.
- A successful repeated installation is idempotent.
- Changed hook files receive a recoverable same-directory backup and an atomic replacement.
- Preserve all unrelated dirty and untracked workspace files; stage exact files only.

---

### Task 1: Pure Safe Hook Merge

**Files:**
- Create: `scripts/codex_hook_installer.py`
- Create: `tests/test_codex_hook_installer.py`

**Interfaces:**
- Consumes: `existing: dict[str, object] | None`, `hook_script: Path`.
- Produces: `pixelverse_hook_document(hook_script: Path) -> dict[str, object]`.
- Produces: `merge_codex_hooks(existing: dict[str, object] | None, desired: dict[str, object], hook_script: Path) -> tuple[dict[str, object], bool]`.
- Produces: `install_codex_hooks(project_root: Path, hook_script: Path) -> InstallResult` where `InstallResult` exposes `target`, `backup`, and `changed`.

- [ ] **Step 1: Write failing merge and conflict tests**

```python
# tests/test_codex_hook_installer.py
import json
from pathlib import Path

import pytest

from scripts.codex_hook_installer import HookConflict, install_codex_hooks


def test_install_preserves_existing_hooks_and_is_idempotent(tmp_path: Path) -> None:
    project = tmp_path / "consumer"
    target = project / ".codex" / "hooks.json"
    target.parent.mkdir(parents=True)
    target.write_text(json.dumps({
        "custom": {"theme": "keep"},
        "hooks": {"PreToolUse": [{"matcher": "Bash", "hooks": [{
            "type": "command", "command": "./custom-hook", "timeout": 9,
        }]}]},
    }), encoding="utf-8")

    first = install_codex_hooks(project, Path("/opt/pixelverse/scripts/codex_pixelverse_hook.py"))
    first_payload = json.loads(target.read_text(encoding="utf-8"))
    second = install_codex_hooks(project, Path("/opt/pixelverse/scripts/codex_pixelverse_hook.py"))

    assert first.changed is True
    assert first.backup and first.backup.exists()
    assert first_payload["custom"] == {"theme": "keep"}
    assert first_payload["hooks"]["PreToolUse"][0]["hooks"][0]["command"] == "./custom-hook"
    assert second.changed is False
    assert json.loads(target.read_text(encoding="utf-8")) == first_payload


def test_malformed_json_and_pixelverse_conflict_leave_original_bytes_unchanged(tmp_path: Path) -> None:
    project = tmp_path / "consumer"
    target = project / ".codex" / "hooks.json"
    target.parent.mkdir(parents=True)
    for original in [b"{broken", json.dumps({"hooks": {"Stop": [{"hooks": [{
        "type": "command", "command": "/usr/bin/env python3 /old/scripts/codex_pixelverse_hook.py",
    }]}]}}).encode()]:
        target.write_bytes(original)
        with pytest.raises((ValueError, HookConflict)):
            install_codex_hooks(project, Path("/new/scripts/codex_pixelverse_hook.py"))
        assert target.read_bytes() == original
```

- [ ] **Step 2: Run tests and verify RED**

Run: `python3 -m pytest -q tests/test_codex_hook_installer.py`

Expected: FAIL because `scripts.codex_hook_installer` does not exist.

- [ ] **Step 3: Implement the minimal pure merger and atomic writer**

```python
# scripts/codex_hook_installer.py
from __future__ import annotations

import json
import os
import shutil
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

EVENTS = ("SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop", "Stop")


class HookConflict(RuntimeError):
    pass


@dataclass(frozen=True)
class InstallResult:
    target: Path
    backup: Path | None
    changed: bool


def _command(hook_script: Path) -> str:
    return f'/usr/bin/env python3 "{hook_script.resolve()}"'


def pixelverse_hook_document(hook_script: Path) -> dict[str, object]:
    command = _command(hook_script)
    return {"hooks": {
        event: [{**({"matcher": "startup|resume|clear|compact"} if event == "SessionStart" else
                    {"matcher": "*"} if event in {"PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop"} else {}),
                 "hooks": [{"type": "command", "command": command, "timeout": 5}]}]
        for event in EVENTS
    }}


def merge_codex_hooks(existing, desired, hook_script: Path):
    merged = dict(existing or {})
    hooks = {name: list(groups) for name, groups in dict(merged.get("hooks") or {}).items()}
    expected = _command(hook_script)
    for groups in hooks.values():
        for group in groups:
            for hook in group.get("hooks", []):
                command = str(hook.get("command") or "")
                if "codex_pixelverse_hook.py" in command and command != expected:
                    raise HookConflict(f"conflicting Pixelverse hook command: {command}")
    changed = False
    for event, desired_groups in desired["hooks"].items():
        current = hooks.setdefault(event, [])
        for group in desired_groups:
            if group not in current:
                current.append(group)
                changed = True
    merged["hooks"] = hooks
    return merged, changed


def install_codex_hooks(project_root: Path, hook_script: Path) -> InstallResult:
    target = project_root.resolve() / ".codex" / "hooks.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    existing = None
    if target.exists():
        existing = json.loads(target.read_text(encoding="utf-8"))
        if not isinstance(existing, dict):
            raise ValueError("hooks.json root must be an object")
    merged, changed = merge_codex_hooks(existing, pixelverse_hook_document(hook_script), hook_script)
    if not changed and target.exists():
        return InstallResult(target, None, False)
    backup = None
    if target.exists():
        stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
        backup = target.with_name(f"hooks.json.pixelverse-backup-{stamp}")
        shutil.copy2(target, backup)
    fd, temporary = tempfile.mkstemp(prefix=".hooks.", suffix=".json", dir=target.parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(merged, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, target)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return InstallResult(target, backup, True)
```

- [ ] **Step 4: Run GREEN and static checks**

Run: `python3 -m pytest -q tests/test_codex_hook_installer.py`

Expected: all focused tests pass.

- [ ] **Step 5: Commit Task 1**

```bash
git add scripts/codex_hook_installer.py tests/test_codex_hook_installer.py
git diff --cached --check
git commit -m "feat: safely merge Codex project hooks"
```

---

### Task 2: Route `run.sh install-codex-hook` Through the Safe Installer

**Files:**
- Modify: `run.sh`
- Modify: `tests/test_run_architecture.py`

**Interfaces:**
- Consumes: `scripts/codex_hook_installer.py <project-root> <hook-script>` CLI.
- Preserves: `./run.sh install-codex-hook [project-root]` public command.
- Produces exit code `0` for created/merged/already-installed; non-zero for malformed/conflict/write failures.

- [ ] **Step 1: Add failing orchestration tests**

```python
def test_install_codex_hook_preserves_existing_project_hook(tmp_path: Path) -> None:
    target = tmp_path / "other-project"
    codex = target / ".codex"
    codex.mkdir(parents=True)
    original = {"hooks": {"Stop": [{"hooks": [{"type": "command", "command": "./notify"}]}]}}
    (codex / "hooks.json").write_text(json.dumps(original), encoding="utf-8")

    result = run_script("install-codex-hook", str(target))
    payload = json.loads((codex / "hooks.json").read_text(encoding="utf-8"))

    assert result.returncode == 0, result.stderr
    assert payload["hooks"]["Stop"][0] == original["hooks"]["Stop"][0]
    assert "backup" in result.stdout.lower()


def test_install_codex_hook_refuses_malformed_existing_json(tmp_path: Path) -> None:
    target = tmp_path / "other-project"
    codex = target / ".codex"
    codex.mkdir(parents=True)
    hooks = codex / "hooks.json"
    hooks.write_text("{broken", encoding="utf-8")
    result = run_script("install-codex-hook", str(target))
    assert result.returncode != 0
    assert hooks.read_text(encoding="utf-8") == "{broken"
```

- [ ] **Step 2: Run RED**

Run: `python3 -m pytest -q tests/test_run_architecture.py -k codex_hook`

Expected: preservation/backup assertions fail because `run.sh` overwrites the file.

- [ ] **Step 3: Add the helper CLI and replace heredoc overwrite**

Add to `scripts/codex_hook_installer.py`:

```python
def main() -> int:
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("project_root", type=Path)
    parser.add_argument("hook_script", type=Path)
    args = parser.parse_args()
    result = install_codex_hooks(args.project_root, args.hook_script)
    print(json.dumps({"target": str(result.target), "backup": str(result.backup) if result.backup else None,
                      "changed": result.changed}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Make `install_codex_project_hooks()` invoke:

```bash
/usr/bin/env python3 "$ROOT/scripts/codex_hook_installer.py" "$project_root" "$ROOT/scripts/codex_pixelverse_hook.py"
```

Parse only for user-facing output if needed; preserve the helper's non-zero status.

- [ ] **Step 4: Run GREEN and Bash syntax validation**

Run: `bash -n run.sh && python3 -m pytest -q tests/test_codex_hook_installer.py tests/test_run_architecture.py -k 'codex_hook or platform'`

Expected: Bash syntax valid and focused tests pass.

- [ ] **Step 5: Commit Task 2**

```bash
git add run.sh scripts/codex_hook_installer.py tests/test_run_architecture.py
git diff --cached --check
git commit -m "feat: preserve existing hooks during Codex install"
```

---

### Task 3: Absolute MCP Activation Guidance

**Files:**
- Modify: `scripts/pixelverse_mcp_server.py`
- Modify: `tests/test_pixelverse_mcp_server.py`

**Interfaces:**
- Produces: `PixelverseMCP.activation_path -> Path`.
- `install_adapter()` structured content returns `activation` as `source "<absolute path>"`.

- [ ] **Step 1: Write the failing different-CWD test**

```python
def test_mcp_onboard_returns_absolute_activation_for_its_clone(tmp_path: Path):
    root = tmp_path / "another-user" / "CLI_Pixelverse"
    root.mkdir(parents=True)
    server = RecordingMCP()
    server.root = root
    result = server.call_tool("pixelverse_onboard", {"agent_kind": "codex"})
    expected = f'source "{root / ".pixelverse-service" / "activate.sh"}"'
    assert expected in result["content"][0]["text"]
    assert result["structuredContent"]["adapter"]["activation"] == expected
```

- [ ] **Step 2: Run RED**

Run: `python3 -m pytest -q tests/test_pixelverse_mcp_server.py -k activation`

Expected: FAIL because the current response is relative.

- [ ] **Step 3: Implement root-derived guidance**

```python
@property
def activation_path(self) -> Path:
    return self.root.resolve() / ".pixelverse-service" / "activate.sh"

def activation_command(self) -> str:
    return f'source "{self.activation_path}"'
```

Use `activation_command()` in `install_adapter()` and `pixelverse_onboard` message construction.

- [ ] **Step 4: Run GREEN**

Run: `python3 -m pytest -q tests/test_pixelverse_mcp_server.py`

Expected: all MCP tests pass.

- [ ] **Step 5: Commit Task 3**

```bash
git add scripts/pixelverse_mcp_server.py tests/test_pixelverse_mcp_server.py
git diff --cached --check
git commit -m "fix: return portable MCP activation guidance"
```

---

### Task 4: Rewrite and Smoke-Test Public Onboarding

**Files:**
- Modify: `README.md`
- Modify: `run.sh`
- Create: `tests/test_portable_onboarding.py`
- Modify: `spec/modules/integration-and-events.md`

**Interfaces:**
- README exports `PIXELVERSE_ROOT="$(pwd -P)"` from clone root.
- Public commands use `"$PIXELVERSE_ROOT/run.sh"` and absolute generated activation.
- Hermes integration uses `PIXELVERSE_HERMES_ROOT=/path/to/HermesAgent_OpenWebUI` rather than a developer home path.

- [ ] **Step 1: Write failing static and fresh-path tests**

```python
def test_public_docs_and_scripts_do_not_contain_developer_home() -> None:
    for path in [Path("README.md"), Path("run.sh"), Path("scripts/pixelverse_mcp_server.py")]:
        assert "/home/a0665x" not in path.read_text(encoding="utf-8"), path


def test_readme_defines_portable_root_and_cross_repo_commands() -> None:
    readme = Path("README.md").read_text(encoding="utf-8")
    assert 'export PIXELVERSE_ROOT="$(pwd -P)"' in readme
    assert '"$PIXELVERSE_ROOT/run.sh" install-codex-hook "$PWD"' in readme
    assert 'source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"' in readme
```

- [ ] **Step 2: Run RED**

Run: `python3 -m pytest -q tests/test_portable_onboarding.py`

Expected: FAIL on developer-specific Hermes/path examples and missing portable-root contract.

- [ ] **Step 3: Rewrite README into four lifecycle sections**

Use these exact headings and command shapes:

```markdown
### Once per Pixelverse clone
export PIXELVERSE_ROOT="$(pwd -P)"
PIXELVERSE_AGENT_KIND=codex "$PIXELVERSE_ROOT/run.sh" down_up

### Once per target repository
cd /path/to/your-project
"$PIXELVERSE_ROOT/run.sh" install-codex-hook "$PWD"

### Once per current shell
source "$PIXELVERSE_ROOT/.pixelverse-service/activate.sh"
command -v codex
"$PIXELVERSE_ROOT/run.sh" bridge-status

### Optional automatic activation for new Bash shells
"$PIXELVERSE_ROOT/run.sh" enable-shell-adapter
```

Document `/hooks` trust, generated-file boundaries, merge/backup/conflict behavior, and fresh CLI process requirement.

- [ ] **Step 4: Remove the hardcoded Hermes default from public behavior**

Resolve Hermes paths only from `PIXELVERSE_HERMES_ROOT` or an explicit CLI argument. If neither is present, print an actionable `/path/to/HermesAgent_OpenWebUI` example and skip optional Hermes integration rather than assuming a developer path.

- [ ] **Step 5: Run full onboarding verification**

Run:

```bash
bash -n run.sh
python3 -m pytest -q tests/test_codex_hook_installer.py tests/test_run_architecture.py tests/test_pixelverse_mcp_server.py tests/test_portable_onboarding.py
rg -n '/home/a0665x|source \.pixelverse-service/activate\.sh' README.md run.sh scripts
```

Expected: tests pass; `rg` returns no public machine-specific or cross-repo-relative activation examples.

- [ ] **Step 6: Commit Task 4**

```bash
git add README.md run.sh tests/test_portable_onboarding.py spec/modules/integration-and-events.md
git diff --cached --check
git commit -m "docs: make Pixelverse onboarding clone-path portable"
```

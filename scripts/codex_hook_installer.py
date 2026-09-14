#!/usr/bin/env python3
"""Safely install Pixelverse hooks into a Codex project configuration."""

from __future__ import annotations

import json
import copy
import os
import shlex
import shutil
import sys
import tempfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


EVENTS = (
    "SessionStart",
    "UserPromptSubmit",
    "PreToolUse",
    "PostToolUse",
    "SubagentStart",
    "SubagentStop",
    "Stop",
)


class HookConflict(RuntimeError):
    """Raised when another Pixelverse hook command is already configured."""


@dataclass(frozen=True)
class InstallResult:
    target: Path
    backup: Path | None
    changed: bool


def _command(hook_script: Path) -> str:
    return f'/usr/bin/env python3 "{hook_script.resolve()}"'


def _same_hook_command(command: str, hook_script: Path) -> bool:
    """Recognize our legacy system-Python launcher without executing shell text."""
    try:
        parts = shlex.split(command)
    except ValueError:
        return False
    script = str(hook_script.resolve())
    return parts in (
        ['/usr/bin/env', 'python3', script],
        ['/usr/bin/python3', script],
    )


def _comparable_group(group: dict[str, Any], hook_script: Path) -> dict[str, Any]:
    normalized = copy.deepcopy(group)
    for hook in normalized.get('hooks', []):
        if isinstance(hook, dict) and isinstance(hook.get('command'), str):
            if _same_hook_command(hook['command'], hook_script):
                hook['command'] = _command(hook_script)
    return normalized


def _event_group(event: str, command: str) -> dict[str, Any]:
    group: dict[str, Any] = {
        "hooks": [{"type": "command", "command": command, "timeout": 5}]
    }
    if event == "SessionStart":
        group["matcher"] = "startup|resume|clear|compact"
        group["hooks"][0]["statusMessage"] = "Syncing Pixelverse session"
    elif event in {"PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop"}:
        group["matcher"] = "*"
    if event == "PreToolUse":
        group["hooks"][0]["statusMessage"] = "Syncing Pixelverse tool call"
    return group


def pixelverse_hook_document(hook_script: Path) -> dict[str, Any]:
    command = _command(hook_script)
    return {"hooks": {event: [_event_group(event, command)] for event in EVENTS}}


def _commands(document: dict[str, Any]) -> list[str]:
    hooks = document.get("hooks", {})
    if not isinstance(hooks, dict):
        raise ValueError("hooks.json 'hooks' must be an object")
    commands: list[str] = []
    for groups in hooks.values():
        if not isinstance(groups, list):
            raise ValueError("hooks.json event groups must be arrays")
        for group in groups:
            if not isinstance(group, dict):
                raise ValueError("hooks.json event group must be an object")
            entries = group.get("hooks", [])
            if not isinstance(entries, list):
                raise ValueError("hooks.json hook entries must be arrays")
            for hook in entries:
                if isinstance(hook, dict) and isinstance(hook.get("command"), str):
                    commands.append(hook["command"])
    return commands


def merge_codex_hooks(
    existing: dict[str, Any] | None,
    desired: dict[str, Any],
    hook_script: Path,
) -> tuple[dict[str, Any], bool]:
    merged = dict(existing or {})
    for command in _commands(merged):
        if "codex_pixelverse_hook.py" in command and not _same_hook_command(command, hook_script):
            raise HookConflict(f"conflicting Pixelverse hook command: {command}")

    current_hooks = merged.get("hooks", {})
    if not isinstance(current_hooks, dict):
        raise ValueError("hooks.json 'hooks' must be an object")
    hooks = {event: list(groups) for event, groups in current_hooks.items()}
    changed = False
    for event, desired_groups in desired["hooks"].items():
        groups = hooks.setdefault(event, [])
        for group in desired_groups:
            if not any(_comparable_group(current, hook_script) == group for current in groups):
                groups.append(group)
                changed = True
    merged["hooks"] = hooks
    return merged, changed


def _backup_path(target: Path) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    candidate = target.with_name(f"hooks.json.pixelverse-backup-{stamp}")
    suffix = 1
    while candidate.exists():
        candidate = target.with_name(f"hooks.json.pixelverse-backup-{stamp}-{suffix}")
        suffix += 1
    return candidate


def install_codex_hooks(project_root: Path, hook_script: Path) -> InstallResult:
    target = project_root.resolve() / ".codex" / "hooks.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    existing: dict[str, Any] | None = None
    if target.exists():
        try:
            parsed = json.loads(target.read_text(encoding="utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as exc:
            raise ValueError(f"hooks.json must contain valid JSON: {target}") from exc
        if not isinstance(parsed, dict):
            raise ValueError("hooks.json root must be an object")
        existing = parsed

    merged, changed = merge_codex_hooks(
        existing,
        pixelverse_hook_document(hook_script),
        hook_script,
    )
    if not changed and target.exists():
        return InstallResult(target=target, backup=None, changed=False)

    backup = None
    if target.exists():
        backup = _backup_path(target)
        shutil.copy2(target, backup)

    descriptor, temporary_name = tempfile.mkstemp(
        prefix=".hooks.",
        suffix=".json",
        dir=target.parent,
    )
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as stream:
            json.dump(merged, stream, ensure_ascii=False, indent=2)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary_name, target)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)
    return InstallResult(target=target, backup=backup, changed=True)


def main() -> int:
    if len(sys.argv) != 3:
        print(
            "Usage: codex_hook_installer.py <project-root> <hook-script>",
            file=sys.stderr,
        )
        return 2
    try:
        result = install_codex_hooks(Path(sys.argv[1]), Path(sys.argv[2]))
    except (HookConflict, OSError, ValueError) as exc:
        print(f"Could not install Codex project hooks: {exc}", file=sys.stderr)
        return 1
    status = "Installed" if result.changed else "Already installed"
    print(f"{status} local Codex project hooks")
    print(f"Target: {result.target}")
    if result.backup:
        print(f"Backup: {result.backup}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

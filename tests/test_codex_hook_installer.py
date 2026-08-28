from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts.codex_hook_installer import HookConflict, install_codex_hooks


HOOK_SCRIPT = Path("/opt/pixelverse/scripts/codex_pixelverse_hook.py")


def test_install_preserves_existing_hooks_and_is_idempotent(tmp_path: Path) -> None:
    project = tmp_path / "consumer"
    target = project / ".codex" / "hooks.json"
    target.parent.mkdir(parents=True)
    target.write_text(
        json.dumps(
            {
                "custom": {"theme": "keep"},
                "hooks": {
                    "PreToolUse": [
                        {
                            "matcher": "Bash",
                            "hooks": [
                                {
                                    "type": "command",
                                    "command": "./custom-hook",
                                    "timeout": 9,
                                }
                            ],
                        }
                    ]
                },
            }
        ),
        encoding="utf-8",
    )

    first = install_codex_hooks(project, HOOK_SCRIPT)
    first_payload = json.loads(target.read_text(encoding="utf-8"))
    second = install_codex_hooks(project, HOOK_SCRIPT)

    assert first.changed is True
    assert first.backup and first.backup.exists()
    assert first_payload["custom"] == {"theme": "keep"}
    assert first_payload["hooks"]["PreToolUse"][0]["hooks"][0]["command"] == "./custom-hook"
    assert second.changed is False
    assert second.backup is None
    assert json.loads(target.read_text(encoding="utf-8")) == first_payload


def test_install_creates_a_complete_pixelverse_hook_document(tmp_path: Path) -> None:
    project = tmp_path / "consumer"

    result = install_codex_hooks(project, HOOK_SCRIPT)
    payload = json.loads(result.target.read_text(encoding="utf-8"))

    assert result.changed is True
    assert result.backup is None
    assert set(payload["hooks"]) == {
        "SessionStart",
        "UserPromptSubmit",
        "PreToolUse",
        "PostToolUse",
        "SubagentStart",
        "SubagentStop",
        "Stop",
    }
    commands = [
        hook["command"]
        for groups in payload["hooks"].values()
        for group in groups
        for hook in group["hooks"]
    ]
    assert commands
    assert all(command == f'/usr/bin/env python3 "{HOOK_SCRIPT}"' for command in commands)


def test_malformed_json_leaves_original_bytes_unchanged(tmp_path: Path) -> None:
    project = tmp_path / "consumer"
    target = project / ".codex" / "hooks.json"
    target.parent.mkdir(parents=True)
    original = b"{broken"
    target.write_bytes(original)

    with pytest.raises(ValueError, match="valid JSON"):
        install_codex_hooks(project, HOOK_SCRIPT)

    assert target.read_bytes() == original


def test_conflicting_pixelverse_command_leaves_original_bytes_unchanged(tmp_path: Path) -> None:
    project = tmp_path / "consumer"
    target = project / ".codex" / "hooks.json"
    target.parent.mkdir(parents=True)
    original = json.dumps(
        {
            "hooks": {
                "Stop": [
                    {
                        "hooks": [
                            {
                                "type": "command",
                                "command": (
                                    "/usr/bin/env python3 "
                                    '"/old/scripts/codex_pixelverse_hook.py"'
                                ),
                            }
                        ]
                    }
                ]
            }
        }
    ).encode()
    target.write_bytes(original)

    with pytest.raises(HookConflict, match="conflicting Pixelverse hook"):
        install_codex_hooks(project, Path("/new/scripts/codex_pixelverse_hook.py"))

    assert target.read_bytes() == original

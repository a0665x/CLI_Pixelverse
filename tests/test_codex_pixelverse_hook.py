import json
from pathlib import Path

from scripts.codex_pixelverse_hook import build_event


def test_codex_hooks_json_is_valid():
    data = json.loads(Path(".codex/hooks.json").read_text(encoding="utf-8"))
    assert {"SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "SubagentStart", "SubagentStop", "Stop"} <= set(data["hooks"])


def test_codex_hook_maps_explicit_skill_prompt(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_ID", "codex-cli:42")
    monkeypatch.setenv("PIXELVERSE_PROCESS_ID", "42")
    payload = build_event({
        "hook_event_name": "UserPromptSubmit",
        "session_id": "session-1",
        "prompt": "$project-spec-onboarding",
    })
    assert payload["agent"] == "codex-cli:42"
    assert payload["process_id"] == 42
    assert payload["state"] == "invoking_skill"
    assert payload["target_room"] == "tool_forge"


def test_codex_hook_maps_shell_and_mcp_tool_calls():
    bash = build_event({"hook_event_name": "PreToolUse", "session_id": "session-1", "tool_name": "Bash"})
    mcp = build_event({"hook_event_name": "PostToolUse", "session_id": "session-1", "tool_name": "mcp__filesystem__read"})
    assert bash["state"] == "executing"
    assert bash["event"] == "tool.started"
    assert mcp["state"] == "tool_call"
    assert mcp["event"] == "tool.completed"

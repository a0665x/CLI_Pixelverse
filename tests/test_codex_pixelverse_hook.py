import json
from pathlib import Path

from scripts.codex_pixelverse_hook import build_event, build_events


def test_codex_hooks_json_is_valid():
    data = json.loads(Path("scripts/codex_hooks_template.json").read_text(encoding="utf-8"))
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
    assert bash["state"] == "shell_command"
    assert bash["target_room"] == "terminal_bay"
    assert bash["event"] == "tool.started"
    assert mcp["state"] == "external_tool"
    assert mcp["target_room"] == "tool_forge"
    assert mcp["event"] == "tool.completed"


def test_codex_hook_maps_file_read_and_edit_tools():
    read = build_event({"hook_event_name": "PreToolUse", "session_id": "session-1", "tool_name": "Read"})
    edit = build_event({"hook_event_name": "PreToolUse", "session_id": "session-1", "tool_name": "Edit"})
    write = build_event({"hook_event_name": "PostToolUse", "session_id": "session-1", "tool_name": "Write"})
    assert read["state"] == "reading_files"
    assert read["target_room"] == "file_library"
    assert edit["state"] == "editing_files"
    assert edit["target_room"] == "code_workbench"
    assert write["state"] == "editing_files"
    assert write["target_room"] == "code_workbench"


def test_codex_hook_creates_visual_subagent_payload(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_ID", "codex-cli:42")
    events = build_events({
        "hook_event_name": "SubagentStart",
        "session_id": "session-1",
        "subagent_id": "019ea0f6-60d7-78a0-a464-340fcd1e6861",
        "agent_type": "gpt-5.4-mini medium",
        "prompt": "整理總體經濟新聞框架",
    })

    assert len(events) == 2
    main, child = events
    assert main["agent"] == "codex-cli:42"
    assert main["state"] == "collaborating"
    assert main["target_room"] == "clone_bay"
    assert child["agent"] == "codex-subagent:019ea0f6-60d7-78a0-a464-340fcd1e6861"
    assert child["role"] == "subagent"
    assert child["state"] == "working"
    assert child["target_room"] == "clone_bay"
    assert child["message"] == "整理總體經濟新聞框架"


def test_codex_hook_stops_same_visual_subagent():
    events = build_events({
        "hook_event_name": "SubagentStop",
        "session_id": "session-1",
        "subagent": {"id": "019ea0f6-60d7-78a0-a464-340fcd1e6861", "name": "macro-news"},
        "summary": "Completed macro framework",
    })

    assert len(events) == 2
    child = events[1]
    assert child["agent"] == "codex-subagent:019ea0f6-60d7-78a0-a464-340fcd1e6861"
    assert child["name"] == "macro-news"
    assert child["role"] == "subagent"
    assert child["state"] == "idle"
    assert child["target_room"] == "clone_bay"
    assert child["message"] == "Completed macro framework"


def test_codex_multi_agent_tool_routes_to_clone_bay():
    payload = build_event({
        "hook_event_name": "PreToolUse",
        "session_id": "session-1",
        "tool_name": "multi_agent_v1create_agent",
    })

    assert payload["state"] == "collaborating"
    assert payload["target_room"] == "clone_bay"

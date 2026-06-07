#!/usr/bin/env python3
"""Relay supported Codex lifecycle hooks into the Pixelverse event API."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from typing import Any


def normalize_base_url(value: str | None) -> str:
    url = (value or "http://127.0.0.1:5660").rstrip("/")
    return "http://127.0.0.1:5660" if url in {"http://127.0.0.1:4321", "http://localhost:4321"} else url


BASE_URL = normalize_base_url(os.getenv("PIXELVERSE_URL"))
SKILL_PATTERN = re.compile(r"(?:^|\s)[$/][\w:.-]+", re.UNICODE)
UUID_PATTERN = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b", re.IGNORECASE)


TOOL_ROUTES = {
    "Read": ("reading_files", "file_library"),
    "Grep": ("reading_files", "file_library"),
    "Glob": ("reading_files", "file_library"),
    "LS": ("reading_files", "file_library"),
    "Edit": ("editing_files", "code_workbench"),
    "MultiEdit": ("editing_files", "code_workbench"),
    "Write": ("editing_files", "code_workbench"),
    "apply_patch": ("editing_files", "code_workbench"),
    "Bash": ("shell_command", "terminal_bay"),
    "WebFetch": ("browsing", "tool_forge"),
    "WebSearch": ("browsing", "tool_forge"),
    "TodoWrite": ("planning", "blueprint_lab"),
    "Task": ("collaborating", "clone_bay"),
}


def trim(value: Any, limit: int = 120) -> str | None:
    text = str(value or "").strip()
    return text[:limit] if text else None


def first_string(data: dict[str, Any], keys: tuple[str, ...]) -> str | None:
    for key in keys:
        value = data.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if isinstance(value, dict):
            nested = first_string(value, keys)
            if nested:
                return nested
    return None


def find_uuid(value: Any) -> str | None:
    if isinstance(value, str):
        match = UUID_PATTERN.search(value)
        return match.group(0) if match else None
    if isinstance(value, dict):
        for item in value.values():
            found = find_uuid(item)
            if found:
                return found
    if isinstance(value, list):
        for item in value:
            found = find_uuid(item)
            if found:
                return found
    return None


def subagent_identity(data: dict[str, Any]) -> tuple[str, str]:
    session_id = str(data.get("session_id") or "unknown")
    raw_id = first_string(
        data,
        (
            "subagent_id",
            "child_agent_id",
            "spawned_agent_id",
            "agent_id",
            "subagent",
            "agent",
            "child",
            "spawned_agent",
            "task_id",
            "id",
        ),
    )
    child_id = raw_id or find_uuid(data) or f"{session_id}:{data.get('agent_type') or data.get('model') or 'subagent'}"
    name = first_string(data, ("name", "agent_name", "subagent", "agent", "child", "agent_type", "model")) or "Codex Subagent"
    return f"codex-subagent:{child_id}", trim(name, 48) or "Codex Subagent"


def tool_route(tool_name: str) -> tuple[str, str]:
    if tool_name in TOOL_ROUTES:
        return TOOL_ROUTES[tool_name]
    normalized = tool_name.strip().lower()
    if normalized.startswith("multi_agent_") or "subagent" in normalized or "spawn_agent" in normalized:
        return ("collaborating", "clone_bay")
    if normalized.startswith("mcp__") or normalized.startswith("github_"):
        return ("external_tool", "tool_forge")
    if normalized.startswith("browser_"):
        return ("browsing", "tool_forge")
    return ("tool_call", "tool_forge")


def build_event(data: dict[str, Any]) -> dict[str, Any] | None:
    events = build_events(data)
    return events[0] if events else None


def build_events(data: dict[str, Any]) -> list[dict[str, Any]]:
    hook = str(data.get("hook_event_name") or "")
    session_id = str(data.get("session_id") or "unknown")
    agent = os.getenv("PIXELVERSE_AGENT_ID") or f"codex-session:{session_id}"
    payload: dict[str, Any] = {
        "agent_type": "codex",
        "agent": agent,
        "name": os.getenv("PIXELVERSE_INSTANCE_NAME") or "Codex CLI",
        "event": hook or "status",
    }
    process_id = os.getenv("PIXELVERSE_PROCESS_ID")
    if process_id and process_id.isdigit():
        payload["process_id"] = int(process_id)

    if hook == "SessionStart":
        payload.update(state="initializing", message=f"Codex session {data.get('source') or 'started'}", target_room="clone_bay")
    elif hook == "UserPromptSubmit":
        prompt = trim(data.get("prompt"), 160) or "Codex prompt submitted"
        skill = SKILL_PATTERN.search(prompt)
        if skill:
            payload.update(event="skill.invoke", state="invoking_skill", message=f"Invoking skill {skill.group(0).strip()}", target_room="tool_forge")
        else:
            payload.update(state="thinking", message=prompt, target_room="think_lab")
    elif hook in {"PreToolUse", "PostToolUse"}:
        tool_name = str(data.get("tool_name") or "tool")
        phase = "started" if hook == "PreToolUse" else "completed"
        state, target_room = tool_route(tool_name)
        payload.update(
            event=f"tool.{phase}",
            state=state,
            tool_name=tool_name,
            message=f"{tool_name} {phase}",
            target_room=target_room,
        )
    elif hook == "SubagentStart":
        subagent_id, subagent_name = subagent_identity(data)
        payload.update(state="collaborating", message=f"Subagent {subagent_name} started", target_room="clone_bay")
        child = {
            **payload,
            "agent": subagent_id,
            "name": subagent_name,
            "event": "subagent.started",
            "state": "working",
            "role": "subagent",
            "message": trim(data.get("prompt") or data.get("task") or data.get("goal") or f"{subagent_name} started", 160),
            "target_room": "clone_bay",
            "color": "#8b5cf6",
        }
        return [payload, child]
    elif hook == "SubagentStop":
        subagent_id, subagent_name = subagent_identity(data)
        payload.update(state="collaborating", message=f"Subagent {subagent_name} stopped", target_room="clone_bay")
        child = {
            **payload,
            "agent": subagent_id,
            "name": subagent_name,
            "event": "subagent.stopped",
            "state": "idle",
            "role": "subagent",
            "message": trim(data.get("result") or data.get("summary") or f"{subagent_name} completed", 160),
            "target_room": "clone_bay",
            "color": "#8b5cf6",
        }
        return [payload, child]
    elif hook == "Stop":
        payload.update(event="completed", state="idle", message="Codex turn completed", target_room="standby_dock")
    else:
        return []
    return [payload]


def post_event(payload: dict[str, Any]) -> None:
    request = urllib.request.Request(
        f"{BASE_URL}/api/event",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=0.8):
            pass
    except Exception:
        pass


def main() -> int:
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    for payload in build_events(data):
        post_event(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

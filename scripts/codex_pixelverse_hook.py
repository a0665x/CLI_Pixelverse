#!/usr/bin/env python3
"""Relay supported Codex lifecycle hooks into the Pixelverse event API."""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.request
from typing import Any


BASE_URL = os.getenv("PIXELVERSE_URL", "http://127.0.0.1:4321").rstrip("/")
SKILL_PATTERN = re.compile(r"(?:^|\s)[$/][\w:.-]+", re.UNICODE)


def trim(value: Any, limit: int = 120) -> str | None:
    text = str(value or "").strip()
    return text[:limit] if text else None


def tool_state(tool_name: str) -> str:
    return "executing" if tool_name in {"Bash", "apply_patch", "Edit", "Write"} else "tool_call"


def build_event(data: dict[str, Any]) -> dict[str, Any] | None:
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
        payload.update(
            event=f"tool.{phase}",
            state=tool_state(tool_name),
            tool_name=tool_name,
            message=f"{tool_name} {phase}",
            target_room="tool_forge",
        )
    elif hook == "SubagentStart":
        payload.update(state="collaborating", message=f"Subagent {data.get('agent_type') or 'started'}", target_room="clone_bay")
    elif hook == "SubagentStop":
        payload.update(state="collaborating", message=f"Subagent {data.get('agent_type') or 'stopped'}", target_room="clone_bay")
    elif hook == "Stop":
        payload.update(event="completed", state="idle", message="Codex turn completed", target_room="standby_dock")
    else:
        return None
    return payload


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
    payload = build_event(data)
    if payload:
        post_event(payload)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

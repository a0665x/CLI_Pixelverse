"""Hermes user plugin that mirrors agent lifecycle hooks to Pixelverse."""

from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from typing import Any


PIXELVERSE_URL = os.getenv("PIXELVERSE_URL", "http://127.0.0.1:5660").rstrip("/")
AGENT_ID = os.getenv("PIXELVERSE_HERMES_AGENT_ID", "hermes-cli")
AGENT_NAME = os.getenv("PIXELVERSE_HERMES_AGENT_NAME", "Hermes CLI")
AGENT_COLOR = os.getenv("PIXELVERSE_HERMES_AGENT_COLOR", "#8b5cf6")


def _post(path: str, payload: dict[str, Any]) -> None:
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        f"{PIXELVERSE_URL}{path}",
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=1.5) as resp:
            resp.read()
    except (OSError, urllib.error.URLError):
        # Hermes plugins must never affect the agent loop.
        return


def _event(
    event: str,
    *,
    message: str | None = None,
    state: str | None = None,
    tool_name: str | None = None,
    target_room: str | None = None,
    role: str = "main_agent",
) -> None:
    payload: dict[str, Any] = {
        "agent_type": "hermes",
        "agent": AGENT_ID,
        "name": AGENT_NAME,
        "role": role,
        "color": AGENT_COLOR,
        "event": event,
    }
    if message:
        payload["message"] = message
    if state:
        payload["state"] = state
    if tool_name:
        payload["tool_name"] = tool_name
    if target_room:
        payload["target_room"] = target_room
    _post("/api/event", payload)


def _short(value: Any, limit: int = 180) -> str:
    if value is None:
        return ""
    text = str(value).replace("\n", " ").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 1] + "..."


def _room_for_tool(tool_name: str) -> str:
    low = tool_name.lower()
    if any(token in low for token in ("delegate", "subagent", "clone")):
        return "clone_bay"
    if any(token in low for token in ("session", "memory", "history")):
        return "session_archive"
    if any(token in low for token in ("search", "read", "grep", "find", "list")):
        return "blueprint_lab"
    if any(token in low for token in ("reply", "message", "draft")):
        return "response_studio"
    return "tool_forge"


def _pre_llm_call(**kwargs: Any) -> None:
    user_message = kwargs.get("user_message") or kwargs.get("prompt") or kwargs.get("query")
    _event(
        "thought",
        message=_short(user_message) or "Hermes is thinking",
        state="thinking",
        target_room="think_lab",
    )
    return None


def _post_llm_call(**kwargs: Any) -> None:
    response = kwargs.get("response") or kwargs.get("content") or kwargs.get("text")
    _event(
        "agent.response",
        message=_short(response) or "Hermes generated a response",
        state="working",
        target_room="response_studio",
    )
    return None


def _pre_tool_call(**kwargs: Any) -> None:
    tool_name = str(kwargs.get("tool_name") or kwargs.get("name") or "tool")
    _event(
        "tool.started",
        message=f"Using {tool_name}",
        state="working",
        tool_name=tool_name,
        target_room=_room_for_tool(tool_name),
    )
    return None


def _post_tool_call(**kwargs: Any) -> None:
    tool_name = str(kwargs.get("tool_name") or kwargs.get("name") or "tool")
    _event(
        "tool.completed",
        message=f"Completed {tool_name}",
        state="working",
        tool_name=tool_name,
        target_room=_room_for_tool(tool_name),
    )
    return None


def _session_end(**kwargs: Any) -> None:
    completed = kwargs.get("completed")
    state = "idle" if completed is not False else "offline"
    room = "standby_dock" if state == "idle" else "offline_corner"
    _event(
        "completed" if state == "idle" else "error",
        message="Hermes CLI session ended",
        state=state,
        target_room=room,
    )
    return None


def _session_reset(**kwargs: Any) -> None:
    _event(
        "status",
        message="Hermes CLI session reset",
        state="idle",
        target_room="standby_dock",
    )
    return None


def _pixelverse_status(raw_args: str = "") -> str:
    _event(
        "status",
        message=f"Pixelverse plugin heartbeat {int(time.time())}",
        state="working",
        target_room="think_lab",
    )
    return f"Pixelverse plugin is installed and posting to {PIXELVERSE_URL}"


def register(ctx: Any) -> None:
    ctx.register_hook("pre_llm_call", _pre_llm_call)
    ctx.register_hook("post_llm_call", _post_llm_call)
    ctx.register_hook("pre_tool_call", _pre_tool_call)
    ctx.register_hook("post_tool_call", _post_tool_call)
    ctx.register_hook("on_session_end", _session_end)
    ctx.register_hook("on_session_finalize", _session_end)
    ctx.register_hook("on_session_reset", _session_reset)
    ctx.register_command("pixelverse-status", _pixelverse_status, "Send a Pixelverse plugin heartbeat.")

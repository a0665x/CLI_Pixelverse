#!/usr/bin/env python3
"""Small reusable client for posting agent lifecycle events to Pixelverse."""

from __future__ import annotations

import argparse
import json
import os
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Any


DEFAULT_BASE_URL = os.getenv("PIXELVERSE_URL", "http://127.0.0.1:4321").rstrip("/")

ROOM_BY_TOKEN = [
    (("delegate_task", "delegate", "clone", "subagent", "分身", "派遣"), "clone_bay"),
    (("session_search", "archive", "history", "session", "memory", "歷史", "記憶"), "session_archive"),
    (("patch", "write", "terminal", "execute", "browser", "修改", "寫入", "終端機"), "tool_forge"),
    (("reply", "response", "draft", "回覆", "輸出"), "response_studio"),
    (("plan", "spec", "search", "read", "map", "research", "規劃", "搜尋", "讀取"), "blueprint_lab"),
]


def infer_target_room(*parts: str | None, default: str = "response_studio") -> str:
    text = " ".join(part for part in parts if part).lower()
    for tokens, room in ROOM_BY_TOKEN:
        if any(token in text for token in tokens):
            return room
    return default


@dataclass
class PixelverseClient:
    base_url: str = DEFAULT_BASE_URL
    agent_type: str = "generic"
    agent: str = "generic-main"
    name: str | None = None
    role: str = "main_agent"
    color: str | None = None
    timeout: float = 4.0

    def __post_init__(self) -> None:
        self.base_url = self.base_url.rstrip("/")

    def _post(self, path: str, payload: dict[str, Any]) -> dict[str, Any]:
        url = f"{self.base_url}{path}"
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=body,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                raw = resp.read().decode("utf-8") or "{}"
        except urllib.error.URLError as exc:
            raise RuntimeError(f"Pixelverse POST failed: {url}: {exc}") from exc
        try:
            return json.loads(raw)
        except json.JSONDecodeError:
            return {"ok": True, "raw": raw}

    def event(
        self,
        event: str,
        *,
        message: str | None = None,
        state: str | None = None,
        tool_name: str | None = None,
        tool_names: list[str] | None = None,
        target_room: str | None = None,
        role: str | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "agent_type": self.agent_type,
            "agent": self.agent,
            "event": event,
            "role": role or self.role,
        }
        if self.name:
            payload["name"] = self.name
        if self.color:
            payload["color"] = self.color
        if message:
            payload["message"] = message
        if state:
            payload["state"] = state
        if tool_name:
            payload["tool_name"] = tool_name
        if tool_names:
            payload["tool_names"] = tool_names
        if target_room:
            payload["target_room"] = target_room
        return self._post("/api/event", payload)

    def heartbeat(self, *, state: str = "idle", task: str | None = None, target_room: str | None = None) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "agent": self.agent,
            "state": state,
            "role": self.role,
        }
        if self.name:
            payload["name"] = self.name
        if task:
            payload["task"] = task
        if self.color:
            payload["color"] = self.color
        if target_room:
            payload["target_room"] = target_room
        return self._post("/api/heartbeat", payload)

    def start(self, message: str = "Agent session started", *, target_room: str = "think_lab") -> dict[str, Any]:
        return self.event("start", message=message, state="thinking", target_room=target_room)

    def tool(
        self,
        tool_names: list[str],
        *,
        message: str | None = None,
        target_room: str | None = None,
    ) -> dict[str, Any]:
        task = ", ".join(tool_names)
        room = target_room or infer_target_room(task)
        return self.event("tool.started", message=message or task, state="working", tool_names=tool_names, target_room=room)

    def complete(self, message: str = "Agent session completed", *, target_room: str = "standby_dock") -> dict[str, Any]:
        return self.event("completed", message=message, state="idle", target_room=target_room)

    def error(self, message: str, *, target_room: str = "offline_corner") -> dict[str, Any]:
        return self.event("error", message=message, state="offline", target_room=target_room)


def _split_tools(value: str | None) -> list[str]:
    return [item.strip() for item in (value or "").split(",") if item.strip()]


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Post lifecycle events to Pixelverse.")
    parser.add_argument("command", choices=["start", "tool", "complete", "error", "heartbeat", "event"])
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--agent-type", default=os.getenv("PIXELVERSE_AGENT_TYPE", "generic"))
    parser.add_argument("--agent", default=os.getenv("PIXELVERSE_AGENT_ID", "generic-main"))
    parser.add_argument("--name", default=os.getenv("PIXELVERSE_AGENT_NAME"))
    parser.add_argument("--role", default=os.getenv("PIXELVERSE_AGENT_ROLE", "main_agent"))
    parser.add_argument("--color", default=os.getenv("PIXELVERSE_AGENT_COLOR"))
    parser.add_argument("--event", default="status")
    parser.add_argument("--message", default="")
    parser.add_argument("--state", default="")
    parser.add_argument("--tool-name", default="")
    parser.add_argument("--tool-names", default="")
    parser.add_argument("--target-room", default="")
    parser.add_argument("--quiet", action="store_true")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    client = PixelverseClient(
        base_url=args.base_url,
        agent_type=args.agent_type,
        agent=args.agent,
        name=args.name,
        role=args.role,
        color=args.color,
    )
    started = time.time()
    if args.command == "start":
        result = client.start(args.message or "Agent session started", target_room=args.target_room or "think_lab")
    elif args.command == "tool":
        tools = _split_tools(args.tool_names) or ([args.tool_name] if args.tool_name else ["working"])
        result = client.tool(tools, message=args.message or None, target_room=args.target_room or None)
    elif args.command == "complete":
        result = client.complete(args.message or "Agent session completed", target_room=args.target_room or "standby_dock")
    elif args.command == "error":
        result = client.error(args.message or "Agent session failed", target_room=args.target_room or "offline_corner")
    elif args.command == "heartbeat":
        result = client.heartbeat(state=args.state or "idle", task=args.message or None, target_room=args.target_room or None)
    else:
        result = client.event(
            args.event,
            message=args.message or None,
            state=args.state or None,
            tool_name=args.tool_name or None,
            tool_names=_split_tools(args.tool_names) or None,
            target_room=args.target_room or None,
        )
    if not args.quiet:
        print(json.dumps({"elapsed_ms": round((time.time() - started) * 1000), "result": result}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

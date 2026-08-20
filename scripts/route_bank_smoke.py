#!/usr/bin/env python3
"""Launch a 10-agent visible route-bank smoke test for map/pathfinding QA.

The script posts synthetic generic agent events directly to /api/event so the live
browser shows many agents leaving Clone Bay and moving to different rooms. It
keeps them in working/status state at their target rooms instead of completing,
which makes manual wall-crossing inspection easier.
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass
from pathlib import Path
from typing import Any


DEFAULT_BASE_URL = "http://127.0.0.1:5660"
ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "tmp" / "route_bank_smoke_plan.json"


@dataclass(frozen=True)
class RouteJob:
    agent: str
    name: str
    role: str
    target_room: str
    tool_names: list[str]
    task: str
    color: str


def build_route_bank() -> list[RouteJob]:
    """Return ten deterministic room jobs for visual smoke testing."""
    return [
        RouteJob("smoke-agent-01", "Reasoning Scout", "main_agent", "think_lab", ["reasoning"], "檢查需求與約束", "#8b5cf6"),
        RouteJob("smoke-agent-02", "Planner", "subagent", "blueprint_lab", ["todo", "plan"], "拆解 10 條路線測試", "#22c55e"),
        RouteJob("smoke-agent-03", "Spawner", "subagent", "clone_bay", ["delegate_task"], "建立分身任務", "#a78bfa"),
        RouteJob("smoke-agent-04", "Reader", "subagent", "file_library", ["search_files", "read_file"], "讀取專案檔案", "#38bdf8"),
        RouteJob("smoke-agent-05", "Patcher", "subagent", "code_workbench", ["patch", "write_file"], "修改程式與測試", "#f97316"),
        RouteJob("smoke-agent-06", "Runner", "subagent", "terminal_bay", ["terminal", "pytest"], "執行測試命令", "#facc15"),
        RouteJob("smoke-agent-07", "Standby Monitor", "subagent", "standby_dock", ["heartbeat"], "等待下一步指令", "#94a3b8"),
        RouteJob("smoke-agent-08", "Responder", "subagent", "response_studio", ["draft_response"], "整理回覆內容", "#ec4899"),
        RouteJob("smoke-agent-09", "Toolsmith", "subagent", "tool_forge", ["browser", "mcp"], "呼叫外部工具", "#10b981"),
        RouteJob("smoke-agent-10", "Archivist", "branch_session", "session_archive", ["session_search"], "整理歷史脈絡", "#64748b"),
    ]


def _payload(route: RouteJob, event: str, *, target_room: str, state: str, message: str) -> dict[str, Any]:
    return {
        "agent_type": "hermes",
        "agent": route.agent,
        "name": route.name,
        "role": route.role,
        "event": event,
        "state": state,
        "target_room": target_room,
        "message": message,
        "tool_names": route.tool_names,
        "color": route.color,
        "instance_name": "10-room smoke",
    }


def build_payloads(routes: list[RouteJob]) -> list[dict[str, Any]]:
    """Build start -> target -> hold payloads for all routes."""
    starts = [
        _payload(route, "start", target_room="clone_bay", state="thinking", message="10-agent route-bank smoke test 啟動")
        for route in routes
    ]
    working = [
        _payload(
            route,
            "tool.started",
            target_room=route.target_room,
            state="working",
            message=f"{route.name} 前往 {route.target_room}: {route.task}",
        )
        for route in routes
    ]
    holds = [
        _payload(
            route,
            "status",
            target_room=route.target_room,
            state="working",
            message=f"停留在 {route.target_room} 方便人工觀察是否穿牆",
        )
        for route in routes
    ]
    return starts + working + holds


def post_event(base_url: str, payload: dict[str, Any], *, timeout: float = 5.0) -> dict[str, Any]:
    url = f"{base_url.rstrip('/')}/api/event"
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8") or "{}"
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Pixelverse event POST failed: {url}: {exc}") from exc
    return json.loads(raw)


def format_plan_summary(base_url: str, routes: list[RouteJob]) -> str:
    lines = [
        f"Pixelverse 10-agent route-bank smoke test",
        f"URL: {base_url.rstrip('/')}",
        f"Agents: {len(routes)}",
        "Routes:",
    ]
    for route in routes:
        lines.append(f"- {route.agent} {route.name}: clone_bay -> {route.target_room} ({', '.join(route.tool_names)})")
    return "\n".join(lines)


def write_plan_artifact(base_url: str, routes: list[RouteJob], payloads: list[dict[str, Any]]) -> Path:
    ARTIFACT.parent.mkdir(parents=True, exist_ok=True)
    ARTIFACT.write_text(
        json.dumps(
            {
                "base_url": base_url.rstrip("/"),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "routes": [route.__dict__ for route in routes],
                "payload_count": len(payloads),
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return ARTIFACT


def run(base_url: str, *, delay: float = 0.8, hold_seconds: float = 0.0, dry_run: bool = False) -> int:
    routes = build_route_bank()
    payloads = build_payloads(routes)
    artifact = write_plan_artifact(base_url, routes, payloads)
    print(format_plan_summary(base_url, routes))
    print(f"Plan artifact: {artifact}")
    if dry_run:
        print("Dry run only; no events posted.")
        return 0

    for index, payload in enumerate(payloads, start=1):
        result = post_event(base_url, payload)
        if not result.get("ok"):
            raise RuntimeError(f"Unexpected response for payload {index}: {result}")
        print(f"[{index:02d}/{len(payloads):02d}] {payload['agent']} -> {payload['target_room']} ({payload['event']})")
        if index < len(payloads):
            time.sleep(delay)

    if hold_seconds > 0:
        print(f"Holding final positions for {hold_seconds:g}s ...")
        time.sleep(hold_seconds)
    print("Route-bank smoke events sent. Keep the browser open and watch the agents move room-to-room.")
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Send 10 synthetic agents to 10 rooms for browser smoke testing.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help="Pixelverse UI/API base URL, default: http://127.0.0.1:5660")
    parser.add_argument("--delay", type=float, default=0.8, help="Seconds between events; raise to slow the animation.")
    parser.add_argument("--hold-seconds", type=float, default=0.0, help="Optional sleep after all events so a terminal-run smoke stays open.")
    parser.add_argument("--dry-run", action="store_true", help="Print the 10 routes and write the plan artifact without posting events.")
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    return run(args.base_url, delay=args.delay, hold_seconds=args.hold_seconds, dry_run=args.dry_run)


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Generic CLI adapter that mirrors a wrapped command lifecycle to Pixelverse."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys
import threading

try:
    from .pixelverse_client import PixelverseClient, infer_target_room
except ImportError:  # pragma: no cover - direct script execution fallback
    from pixelverse_client import PixelverseClient, infer_target_room


DEFAULT_COLORS = {
    "codex": "#2563eb",
    "gemini-cli": "#16a34a",
    "claude-code": "#d97706",
    "ollama": "#0f766e",
    "hermes": "#8b5cf6",
    "generic": "#64748b",
}

DEFAULT_NAMES = {
    "codex": "Codex CLI",
    "gemini-cli": "Gemini CLI",
    "claude-code": "Claude Code",
    "ollama": "Ollama",
    "hermes": "Hermes CLI",
    "generic": "Generic Agent",
}

DEFAULT_HEARTBEAT_SECONDS = 15.0


def safe_emit(label: str, fn) -> None:
    try:
        fn()
    except Exception as exc:
        print(f"pixelverse adapter: {label} event skipped: {exc}", file=sys.stderr)


class HeartbeatLoop:
    def __init__(
        self,
        client: PixelverseClient,
        *,
        task: str,
        target_room: str,
        interval: float = DEFAULT_HEARTBEAT_SECONDS,
    ) -> None:
        self.client = client
        self.task = task
        self.target_room = target_room
        self.interval = max(0.05, float(interval))
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, name="pixelverse-heartbeat", daemon=True)

    def _run(self) -> None:
        while not self.stop_event.wait(self.interval):
            safe_emit(
                "heartbeat",
                lambda: self.client.heartbeat(
                    state="working",
                    task=self.task,
                    target_room=self.target_room,
                    preserve_phase=True,
                ),
            )

    def start(self) -> None:
        self.thread.start()

    def stop(self) -> None:
        self.stop_event.set()
        self.thread.join(timeout=max(1.0, self.interval + 0.25))


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Run any agent CLI command while sending start/working/complete/error "
            "events to Pixelverse. Put the wrapped command after --."
        )
    )
    parser.add_argument("--base-url", default=os.getenv("PIXELVERSE_URL", "http://127.0.0.1:4321"))
    parser.add_argument("--agent-type", default=os.getenv("PIXELVERSE_AGENT_TYPE", "generic"))
    parser.add_argument("--agent", default=os.getenv("PIXELVERSE_AGENT_ID"))
    parser.add_argument("--instance-name", default=os.getenv("PIXELVERSE_INSTANCE_NAME"))
    parser.add_argument("--name", default=os.getenv("PIXELVERSE_AGENT_NAME"))
    parser.add_argument("--color", default=os.getenv("PIXELVERSE_AGENT_COLOR"))
    parser.add_argument("--target-room", default=os.getenv("PIXELVERSE_TARGET_ROOM", "response_studio"))
    parser.add_argument("--start-message", default=os.getenv("PIXELVERSE_START_MESSAGE", "CLI session started"))
    parser.add_argument("--working-message", default=os.getenv("PIXELVERSE_WORKING_MESSAGE", "CLI session running"))
    parser.add_argument("--complete-message", default=os.getenv("PIXELVERSE_COMPLETE_MESSAGE", "CLI session completed"))
    parser.add_argument("--heartbeat-seconds", type=float, default=float(os.getenv("PIXELVERSE_HEARTBEAT_SECONDS", str(DEFAULT_HEARTBEAT_SECONDS))))
    parser.add_argument("--no-complete", action="store_true", help="Leave the agent active when the command exits successfully.")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Command to run after --.")
    return parser


def normalize_command(raw: list[str]) -> list[str]:
    if raw and raw[0] == "--":
        raw = raw[1:]
    return raw


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    command = normalize_command(args.command)
    if not command:
        print("cli adapter: missing command after --", file=sys.stderr)
        return 2

    agent_type = args.agent_type
    process_id = os.getpid()
    agent_id = args.agent or f"{agent_type}-cli:{process_id}"
    client = PixelverseClient(
        base_url=args.base_url,
        agent_type=agent_type,
        agent=agent_id,
        name=args.name or DEFAULT_NAMES.get(agent_type, DEFAULT_NAMES["generic"]),
        role="main_agent",
        color=args.color or DEFAULT_COLORS.get(agent_type, DEFAULT_COLORS["generic"]),
        process_id=process_id,
        instance_name=args.instance_name,
    )

    safe_emit("start", lambda: client.start(args.start_message, target_room="think_lab"))
    safe_emit(
        "working",
        lambda: client.event(
            "status",
            message=args.working_message,
            state="working",
            target_room=args.target_room or infer_target_room(" ".join(command)),
        ),
    )
    heartbeat = HeartbeatLoop(
        client,
        task=args.working_message,
        target_room=args.target_room or infer_target_room(" ".join(command)),
        interval=args.heartbeat_seconds,
    )
    heartbeat.start()
    child_env = os.environ.copy()
    child_env["PIXELVERSE_AGENT_ID"] = client.agent
    child_env["PIXELVERSE_PROCESS_ID"] = str(process_id)
    if args.instance_name:
        child_env["PIXELVERSE_INSTANCE_NAME"] = args.instance_name
    try:
        result = subprocess.run(command, env=child_env)
    except FileNotFoundError:
        safe_emit("error", lambda: client.error(f"Command not found: {command[0]}"))
        print(f"cli adapter: command not found: {command[0]}", file=sys.stderr)
        return 127
    except KeyboardInterrupt:
        safe_emit("complete", lambda: client.complete("CLI session interrupted", target_room="standby_dock"))
        raise
    finally:
        heartbeat.stop()

    if result.returncode == 0:
        if not args.no_complete:
            safe_emit("complete", lambda: client.complete(args.complete_message, target_room="standby_dock"))
    else:
        safe_emit("error", lambda: client.error(f"CLI exited with code {result.returncode}"))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())

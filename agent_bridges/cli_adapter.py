#!/usr/bin/env python3
"""Generic CLI adapter that mirrors a wrapped command lifecycle to Pixelverse."""

from __future__ import annotations

import argparse
import os
import subprocess
import sys

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


def safe_emit(label: str, fn) -> None:
    try:
        fn()
    except Exception as exc:
        print(f"pixelverse adapter: {label} event skipped: {exc}", file=sys.stderr)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Run any agent CLI command while sending start/working/complete/error "
            "events to Pixelverse. Put the wrapped command after --."
        )
    )
    parser.add_argument("--base-url", default=os.getenv("PIXELVERSE_URL", "http://127.0.0.1:4321"))
    parser.add_argument("--agent-type", default=os.getenv("PIXELVERSE_AGENT_TYPE", "generic"))
    parser.add_argument("--agent", default=os.getenv("PIXELVERSE_AGENT_ID", "generic-cli"))
    parser.add_argument("--name", default=os.getenv("PIXELVERSE_AGENT_NAME"))
    parser.add_argument("--color", default=os.getenv("PIXELVERSE_AGENT_COLOR"))
    parser.add_argument("--target-room", default=os.getenv("PIXELVERSE_TARGET_ROOM", "response_studio"))
    parser.add_argument("--start-message", default=os.getenv("PIXELVERSE_START_MESSAGE", "CLI session started"))
    parser.add_argument("--working-message", default=os.getenv("PIXELVERSE_WORKING_MESSAGE", "CLI session running"))
    parser.add_argument("--complete-message", default=os.getenv("PIXELVERSE_COMPLETE_MESSAGE", "CLI session completed"))
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
    client = PixelverseClient(
        base_url=args.base_url,
        agent_type=agent_type,
        agent=args.agent,
        name=args.name or DEFAULT_NAMES.get(agent_type, DEFAULT_NAMES["generic"]),
        role="main_agent",
        color=args.color or DEFAULT_COLORS.get(agent_type, DEFAULT_COLORS["generic"]),
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
    try:
        result = subprocess.run(command)
    except FileNotFoundError:
        safe_emit("error", lambda: client.error(f"Command not found: {command[0]}"))
        print(f"cli adapter: command not found: {command[0]}", file=sys.stderr)
        return 127
    except KeyboardInterrupt:
        safe_emit("complete", lambda: client.complete("CLI session interrupted", target_room="standby_dock"))
        raise

    if result.returncode == 0:
        if not args.no_complete:
            safe_emit("complete", lambda: client.complete(args.complete_message, target_room="standby_dock"))
    else:
        safe_emit("error", lambda: client.error(f"CLI exited with code {result.returncode}"))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())

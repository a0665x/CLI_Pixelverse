#!/usr/bin/env python3
"""Hermes CLI adapter that wraps a command and mirrors lifecycle to Pixelverse."""

from __future__ import annotations

import argparse
import os
import shlex
import subprocess
import sys

try:
    from .pixelverse_client import PixelverseClient
except ImportError:  # pragma: no cover - direct script execution fallback
    from pixelverse_client import PixelverseClient


def safe_emit(label: str, fn) -> None:
    try:
        fn()
    except Exception as exc:
        print(f"pixelverse adapter: {label} event skipped: {exc}", file=sys.stderr)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Run a Hermes command while sending start/working/complete/error events "
            "to Pixelverse. Put the wrapped command after --."
        )
    )
    parser.add_argument("--base-url", default=os.getenv("PIXELVERSE_URL", "http://127.0.0.1:4321"))
    parser.add_argument("--agent", default=os.getenv("PIXELVERSE_HERMES_AGENT_ID", "hermes-cli-main"))
    parser.add_argument("--name", default=os.getenv("PIXELVERSE_HERMES_AGENT_NAME", "Hermes CLI"))
    parser.add_argument("--color", default=os.getenv("PIXELVERSE_HERMES_AGENT_COLOR", "#8b5cf6"))
    parser.add_argument("--start-message", default="Hermes CLI session started")
    parser.add_argument("--working-message", default="Hermes CLI session running")
    parser.add_argument("--complete-message", default="Hermes CLI session completed")
    parser.add_argument("--target-room", default="response_studio")
    parser.add_argument("--no-complete", action="store_true", help="Leave the agent in its last active state when the command exits.")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Command to run after --. Defaults to PIXELVERSE_HERMES_CMD or 'hermes chat'.")
    return parser


def normalize_command(raw: list[str]) -> list[str]:
    if raw and raw[0] == "--":
        raw = raw[1:]
    if raw:
        return raw
    configured = os.getenv("PIXELVERSE_HERMES_CMD", "hermes chat")
    return shlex.split(configured)


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    command = normalize_command(args.command)
    client = PixelverseClient(
        base_url=args.base_url,
        agent_type="hermes",
        agent=args.agent,
        name=args.name,
        role="main_agent",
        color=args.color,
    )
    safe_emit("start", lambda: client.start(args.start_message, target_room="think_lab"))
    safe_emit(
        "working",
        lambda: client.event(
            "status",
            message=args.working_message,
            state="working",
            target_room=args.target_room,
        ),
    )
    try:
        result = subprocess.run(command)
    except FileNotFoundError:
        safe_emit("error", lambda: client.error(f"Hermes command not found: {command[0]}"))
        print(f"hermes adapter: command not found: {command[0]}", file=sys.stderr)
        return 127
    except KeyboardInterrupt:
        safe_emit("complete", lambda: client.complete("Hermes CLI interrupted", target_room="standby_dock"))
        raise
    if result.returncode == 0:
        if not args.no_complete:
            safe_emit("complete", lambda: client.complete(args.complete_message, target_room="standby_dock"))
    else:
        safe_emit("error", lambda: client.error(f"Hermes CLI exited with code {result.returncode}"))
    return result.returncode


if __name__ == "__main__":
    raise SystemExit(main())

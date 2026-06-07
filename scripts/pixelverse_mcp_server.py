#!/usr/bin/env python3
"""Minimal stdio MCP server for Pixelverse onboarding and event emission."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from typing import Any, TextIO

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from agent_bridges.pixelverse_client import PixelverseClient  # noqa: E402


AGENT_KINDS = ["codex", "gemini-cli", "claude-code", "antigravity", "ollama", "hermes", "generic"]
ADAPTER_TARGETS = [*AGENT_KINDS, "all", "hermes-hook", "hermes-plugin"]
ROOMS = [
    "think_lab",
    "blueprint_lab",
    "file_library",
    "code_workbench",
    "terminal_bay",
    "tool_forge",
    "response_studio",
    "standby_dock",
    "clone_bay",
    "session_archive",
    "offline_corner",
]
SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"]


def text_result(text: str, **structured: Any) -> dict[str, Any]:
    result: dict[str, Any] = {"content": [{"type": "text", "text": text}]}
    if structured:
        result["structuredContent"] = structured
    return result


class PixelverseMCP:
    def __init__(self, root: Path = ROOT) -> None:
        self.root = root

    def run_bridge_command(self, *args: str) -> subprocess.CompletedProcess[str]:
        return subprocess.run(
            [str(self.root / "run.sh"), *args],
            cwd=self.root,
            capture_output=True,
            text=True,
            timeout=45,
            check=False,
        )

    def install_adapter(self, target: str) -> dict[str, Any]:
        if target not in ADAPTER_TARGETS:
            raise ValueError(f"unsupported adapter target: {target}")
        completed = self.run_bridge_command("install-adapter", target)
        output = (completed.stdout + completed.stderr).strip()
        if completed.returncode:
            raise RuntimeError(output or f"install-adapter failed with exit code {completed.returncode}")
        return {"target": target, "output": output, "activation": "source .pixelverse-service/activate.sh"}

    def bridge_status(self) -> dict[str, Any]:
        completed = self.run_bridge_command("bridge-status")
        output = (completed.stdout + completed.stderr).strip()
        return {"ok": completed.returncode == 0, "output": output}

    def emit_event(self, arguments: dict[str, Any]) -> dict[str, Any]:
        agent_type = str(arguments.get("agent_type") or "generic")
        if agent_type not in AGENT_KINDS:
            raise ValueError(f"unsupported agent_type: {agent_type}")
        client = PixelverseClient(
            base_url=str(arguments.get("base_url") or "http://127.0.0.1:5660"),
            agent_type=agent_type,
            agent=str(arguments.get("agent") or f"{agent_type}-main"),
            name=arguments.get("name"),
            role=str(arguments.get("role") or "main_agent"),
            color=arguments.get("color"),
        )
        event = str(arguments.get("event") or "status")
        target_room = arguments.get("target_room")
        if target_room and target_room not in ROOMS:
            raise ValueError(f"unsupported target_room: {target_room}")
        tool_names = arguments.get("tool_names")
        if isinstance(tool_names, str):
            tool_names = [item.strip() for item in tool_names.split(",") if item.strip()]
        return client.event(
            event,
            message=arguments.get("message"),
            state=arguments.get("state"),
            tool_name=arguments.get("tool_name"),
            tool_names=tool_names,
            target_room=target_room,
            role=arguments.get("role"),
        )

    def call_tool(self, name: str, arguments: dict[str, Any]) -> dict[str, Any]:
        if name == "pixelverse_install_adapter":
            data = self.install_adapter(str(arguments.get("target") or "generic"))
            return text_result(data["output"] or f"Installed {data['target']} adapter.", **data)
        if name == "pixelverse_bridge_status":
            data = self.bridge_status()
            return text_result(data["output"] or "No bridge status output.", **data)
        if name == "pixelverse_emit_event":
            data = self.emit_event(arguments)
            return text_result(json.dumps(data, ensure_ascii=False, indent=2), response=data)
        if name == "pixelverse_onboard":
            agent_kind = str(arguments.get("agent_kind") or "generic")
            data = self.install_adapter(agent_kind)
            status = self.bridge_status()
            message = "\n\n".join(filter(None, [
                data["output"],
                status["output"],
                "Activate native CLI shims in your shell with:\nsource .pixelverse-service/activate.sh",
            ]))
            return text_result(message, adapter=data, bridge=status)
        raise ValueError(f"unknown tool: {name}")

    def tools(self) -> list[dict[str, Any]]:
        return [
            {
                "name": "pixelverse_onboard",
                "description": "Install the selected Pixelverse CLI adapter, inspect bridge status, and return shell activation guidance. Use this as the one-click onboarding path after cloning Pixelverse.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "agent_kind": {"type": "string", "enum": AGENT_KINDS, "default": "generic"},
                    },
                },
            },
            {
                "name": "pixelverse_install_adapter",
                "description": "Install Pixelverse adapter shims or Hermes integrations. This invokes ./run.sh install-adapter and may create repo-local shims; Hermes targets may also install user-level Hermes hook/plugin files.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "target": {"type": "string", "enum": ADAPTER_TARGETS, "default": "generic"},
                    },
                },
            },
            {
                "name": "pixelverse_bridge_status",
                "description": "Run ./run.sh bridge-status and report API, hook, and local adapter availability.",
                "inputSchema": {"type": "object", "properties": {}},
            },
            {
                "name": "pixelverse_emit_event",
                "description": "Emit one standardized Pixelverse lifecycle event through the existing HTTP bridge protocol.",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "base_url": {"type": "string", "default": "http://127.0.0.1:5660"},
                        "agent_type": {"type": "string", "enum": AGENT_KINDS, "default": "generic"},
                        "agent": {"type": "string"},
                        "name": {"type": "string"},
                        "role": {"type": "string", "enum": ["main_agent", "subagent", "branch_session"], "default": "main_agent"},
                        "event": {"type": "string", "default": "status"},
                        "message": {"type": "string"},
                        "state": {"type": "string"},
                        "tool_name": {"type": "string"},
                        "tool_names": {"type": "array", "items": {"type": "string"}},
                        "target_room": {"type": "string", "enum": ROOMS},
                        "color": {"type": "string"},
                    },
                },
            },
        ]

    def handle(self, request: dict[str, Any]) -> dict[str, Any] | None:
        method = request.get("method")
        request_id = request.get("id")
        if request_id is None:
            return None
        if method == "initialize":
            requested_version = str((request.get("params") or {}).get("protocolVersion") or "")
            result = {
                "protocolVersion": requested_version if requested_version in SUPPORTED_PROTOCOL_VERSIONS else SUPPORTED_PROTOCOL_VERSIONS[0],
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "cli-pixelverse-onboarding", "version": "0.1.0"},
            }
        elif method == "ping":
            result = {}
        elif method == "tools/list":
            result = {"tools": self.tools()}
        elif method == "tools/call":
            params = request.get("params") or {}
            try:
                result = self.call_tool(str(params.get("name") or ""), params.get("arguments") or {})
            except Exception as exc:
                result = {
                    "content": [{"type": "text", "text": f"Pixelverse MCP tool failed: {exc}"}],
                    "isError": True,
                }
        else:
            return {"jsonrpc": "2.0", "id": request_id, "error": {"code": -32601, "message": f"Method not found: {method}"}}
        return {"jsonrpc": "2.0", "id": request_id, "result": result}


def serve(stdin: TextIO = sys.stdin, stdout: TextIO = sys.stdout) -> None:
    server = PixelverseMCP()
    for raw_line in stdin:
        line = raw_line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            response = server.handle(request)
        except Exception as exc:
            response = {"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": str(exc)}}
        if response is not None:
            stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
            stdout.flush()


if __name__ == "__main__":
    serve()

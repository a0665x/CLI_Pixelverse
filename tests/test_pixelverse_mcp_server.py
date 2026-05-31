import io
import json
from pathlib import Path
from types import SimpleNamespace

from scripts.pixelverse_mcp_server import PixelverseMCP, serve


class RecordingMCP(PixelverseMCP):
    def __init__(self):
        super().__init__(Path("."))
        self.commands = []

    def run_bridge_command(self, *args):
        self.commands.append(args)
        return SimpleNamespace(returncode=0, stdout=f"ran {' '.join(args)}", stderr="")


def test_mcp_lists_onboarding_status_install_and_emit_tools():
    tools = PixelverseMCP().tools()

    assert [tool["name"] for tool in tools] == [
        "pixelverse_onboard",
        "pixelverse_install_adapter",
        "pixelverse_bridge_status",
        "pixelverse_emit_event",
    ]


def test_mcp_onboard_installs_selected_adapter_and_checks_status():
    server = RecordingMCP()

    result = server.call_tool("pixelverse_onboard", {"agent_kind": "codex"})

    assert server.commands == [("install-adapter", "codex"), ("bridge-status",)]
    assert "source .pixelverse-service/activate.sh" in result["content"][0]["text"]


def test_mcp_rejects_unknown_adapter_target():
    server = RecordingMCP()

    result = server.handle({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": "pixelverse_install_adapter", "arguments": {"target": "unknown"}},
    })

    assert result["result"]["isError"] is True
    assert "unsupported adapter target" in result["result"]["content"][0]["text"]


def test_stdio_server_negotiates_initialize_and_lists_tools(monkeypatch):
    requests = [
        {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {"protocolVersion": "2025-03-26"}},
        {"jsonrpc": "2.0", "method": "notifications/initialized"},
        {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
    ]
    stdin = io.StringIO("\n".join(json.dumps(item) for item in requests))
    stdout = io.StringIO()

    serve(stdin, stdout)

    responses = [json.loads(line) for line in stdout.getvalue().splitlines()]
    assert responses[0]["result"]["protocolVersion"] == "2025-03-26"
    assert len(responses[1]["result"]["tools"]) == 4


def test_mcp_emit_event_uses_existing_http_client(monkeypatch):
    recorded = {}

    def fake_event(self, event, **kwargs):
        recorded.update({"event": event, **kwargs})
        return {"ok": True}

    monkeypatch.setattr("scripts.pixelverse_mcp_server.PixelverseClient.event", fake_event)

    result = PixelverseMCP().call_tool("pixelverse_emit_event", {
        "agent_type": "codex",
        "agent": "codex-main",
        "event": "tool.started",
        "tool_names": ["patch"],
        "target_room": "tool_forge",
    })

    assert result["structuredContent"]["response"] == {"ok": True}
    assert recorded["event"] == "tool.started"
    assert recorded["target_room"] == "tool_forge"

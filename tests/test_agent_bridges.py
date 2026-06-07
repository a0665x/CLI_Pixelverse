import time

from agent_bridges.cli_adapter import HeartbeatLoop
from agent_bridges.hermes_adapter import normalize_command
from agent_bridges.pixelverse_client import PixelverseClient, infer_target_room


class RecordingClient(PixelverseClient):
    def __init__(self):
        super().__init__(
            base_url="http://pixelverse.local",
            agent_type="codex",
            agent="codex-main",
            name="Codex",
            role="main_agent",
            color="#2563eb",
        )
        self.posts = []

    def _post(self, path, payload):
        self.posts.append((path, payload))
        return {"ok": True}


def test_infer_target_room_from_tools_and_messages():
    assert infer_target_room("patch terminal") == "code_workbench"
    assert infer_target_room("Bash") == "terminal_bay"
    assert infer_target_room("Read Grep") == "file_library"
    assert infer_target_room("delegate_task to subagent") == "clone_bay"
    assert infer_target_room("session_search history") == "session_archive"
    assert infer_target_room("reply to user") == "response_studio"
    assert infer_target_room("plan architecture") == "blueprint_lab"
    assert infer_target_room("unclassified work") == "response_studio"


def test_tool_event_posts_standard_payload_with_inferred_room():
    client = RecordingClient()

    client.tool(["patch", "terminal"])

    assert client.posts == [
        (
            "/api/event",
            {
                "agent_type": "codex",
                "agent": "codex-main",
                "event": "tool.started",
                "role": "main_agent",
                "name": "Codex",
                "color": "#2563eb",
                "message": "patch, terminal",
                "state": "working",
                "tool_names": ["patch", "terminal"],
                "target_room": "code_workbench",
            },
        )
    ]


def test_complete_event_returns_agent_to_standby():
    client = RecordingClient()

    client.complete("done")

    path, payload = client.posts[-1]
    assert path == "/api/event"
    assert payload["event"] == "completed"
    assert payload["state"] == "idle"
    assert payload["target_room"] == "standby_dock"


def test_cli_adapter_heartbeat_loop_keeps_long_running_process_attached():
    client = RecordingClient()
    loop = HeartbeatLoop(client, task="CLI session running", target_room="response_studio", interval=0.05)

    loop.start()
    time.sleep(0.13)
    loop.stop()

    heartbeats = [payload for path, payload in client.posts if path == "/api/heartbeat"]
    assert len(heartbeats) >= 2
    assert all(payload["state"] == "working" for payload in heartbeats)
    assert all(payload["target_room"] == "response_studio" for payload in heartbeats)
    assert all(payload["preserve_phase"] is True for payload in heartbeats)


def test_normalize_command_prefers_remainder_after_separator(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_HERMES_CMD", "ignored command")

    assert normalize_command(["--", "hermes", "chat"]) == ["hermes", "chat"]
    assert normalize_command(["hermes", "chat"]) == ["hermes", "chat"]


def test_normalize_command_uses_environment_default(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_HERMES_CMD", "hermes run --model codex")

    assert normalize_command([]) == ["hermes", "run", "--model", "codex"]

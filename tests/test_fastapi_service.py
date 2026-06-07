import importlib

import pytest
from fastapi import HTTPException


def test_fastapi_exposes_openapi_and_generic_agent_events(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "codex")
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    assert pixelverse_fastapi.health()["ok"] is True
    assert pixelverse_fastapi.health()["agent_kind"] == "codex"
    openapi = pixelverse_fastapi.app.openapi()
    assert "/api/event" in openapi["paths"]
    assert "/api/sources" in openapi["paths"]

    result = pixelverse_fastapi.generic_event(
        pixelverse_fastapi.GenericAgentEvent(
            agent_type="codex",
            agent="codex-main",
            event="tool.started",
            tool_name="terminal",
            message="running a command",
        )
    )
    assert result["ok"] is True

    world = pixelverse_fastapi.get_world()
    agent = next(item for item in world["agents"] if item["agent"] == "codex-main")
    assert agent["state"] == "working"
    assert world["hermes"]["source"] == "disabled"
    assert world["ollama"]["source"] == "disabled"

    sources = pixelverse_fastapi.get_sources()
    assert sources["agent_kind"] == "codex"
    assert sources["sources"]["events"]["local_agent_count"] >= 1


def test_fastapi_can_expose_hermes_source_even_when_primary_agent_kind_is_not_hermes(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "codex")
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "1")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    world = pixelverse_fastapi.get_world()
    assert world["hermes"]["enabled"] is True

    sources = pixelverse_fastapi.get_sources()
    assert sources["sources"]["hermes"]["enabled"] is True


def test_fastapi_static_responses_disable_cache(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "hermes")
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    root = pixelverse_fastapi.index()
    app_js = pixelverse_fastapi.static_file("app.mjs")

    assert root.headers["cache-control"].startswith("no-store")
    assert app_js.headers["cache-control"].startswith("no-store")


def test_fastapi_rejects_overlapping_furniture_layout(monkeypatch, tmp_path):
    monkeypatch.setenv("PIXELVERSE_RUNTIME_DIR", str(tmp_path))
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    payload = pixelverse_fastapi.FurnitureLayoutPayload(
        layout={"tool_forge": [{"x": 40, "y": 40}, {"x": 42, "y": 41}]},
    )
    with pytest.raises(HTTPException) as exc:
        pixelverse_fastapi.update_furniture_layout(payload)

    assert exc.value.status_code == 422


def test_fastapi_saves_cross_room_furniture_layout(monkeypatch, tmp_path):
    monkeypatch.setenv("PIXELVERSE_RUNTIME_DIR", str(tmp_path))
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    result = pixelverse_fastapi.update_furniture_layout(pixelverse_fastapi.FurnitureLayoutPayload(
        layout={"think_lab": [{"x": 64, "y": 60, "room": "tool_forge"}]},
    ))

    assert result["layout"]["think_lab"][0] == {"x": 64.0, "y": 60.0, "room": "tool_forge"}


def test_fastapi_lifecycle_stays_active_until_explicit_session_completion(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "codex")
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    def emit(event, **kwargs):
        pixelverse_fastapi.generic_event(pixelverse_fastapi.GenericAgentEvent(
            agent_type="codex",
            agent="codex-main",
            event=event,
            **kwargs,
        ))
        return next(item for item in pixelverse_fastapi.get_world()["agents"] if item["agent"] == "codex-main")

    assert emit("start", message="Analyzing request")["room_key"] == "think_lab"
    assert emit("planning", message="Reviewing project files")["room_key"] == "blueprint_lab"
    assert emit("tool.started", tool_name="patch", message="Updating code")["room_key"] == "code_workbench"
    tool_done = emit("tool.completed", tool_name="patch", message="Updated code")
    assert tool_done["state"] == "working"
    assert tool_done["room_key"] == "code_workbench"

    pixelverse_fastapi.heartbeat(pixelverse_fastapi.HeartbeatPayload(
        agent="codex-main",
        state="working",
        task="CLI session running",
        target_room="response_studio",
        preserve_phase=True,
    ))
    after_heartbeat = next(item for item in pixelverse_fastapi.get_world()["agents"] if item["agent"] == "codex-main")
    assert after_heartbeat["room_key"] == "code_workbench"

    status = emit("status", message="Inspecting results")
    assert status["state"] == "working"
    assert status["room_key"] == "response_studio"

    completed = emit("completed", message="Session completed")
    assert completed["state"] == "idle"
    assert completed["room_key"] == "standby_dock"


def test_fastapi_counts_and_keeps_local_subagents_in_clone_bay(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "codex")
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    pixelverse_fastapi.generic_event(pixelverse_fastapi.GenericAgentEvent(
        agent_type="codex",
        agent="codex-subagent:child-1",
        name="Macro Research",
        event="subagent.started",
        state="working",
        message="整理總體經濟新聞框架",
        role="subagent",
        target_room="clone_bay",
    ))
    active_world = pixelverse_fastapi.get_world()
    active = next(item for item in active_world["agents"] if item["agent"] == "codex-subagent:child-1")
    assert active["role"] == "subagent"
    assert active["state"] == "working"
    assert active["room_key"] == "clone_bay"
    assert active_world["stats"]["subagent_count"] == 1

    pixelverse_fastapi.generic_event(pixelverse_fastapi.GenericAgentEvent(
        agent_type="codex",
        agent="codex-subagent:child-1",
        name="Macro Research",
        event="subagent.stopped",
        state="idle",
        message="Completed macro framework",
        role="subagent",
        target_room="clone_bay",
    ))
    stopped_world = pixelverse_fastapi.get_world()
    stopped = next(item for item in stopped_world["agents"] if item["agent"] == "codex-subagent:child-1")
    assert stopped["role"] == "subagent"
    assert stopped["state"] == "idle"
    assert stopped["room_key"] == "clone_bay"
    assert stopped_world["stats"]["subagent_count"] == 1


def test_fastapi_only_deletes_offline_local_agents(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    pixelverse_fastapi.heartbeat(pixelverse_fastapi.HeartbeatPayload(agent="codex-cli:42", state="working"))
    with pytest.raises(HTTPException) as exc:
        pixelverse_fastapi.delete_offline_agent("codex-cli:42")
    assert exc.value.status_code == 409

    pixelverse_fastapi.heartbeat(pixelverse_fastapi.HeartbeatPayload(agent="codex-cli:43", state="offline"))
    assert pixelverse_fastapi.delete_offline_agent("codex-cli:43") == {"ok": True, "agent": "codex-cli:43"}
    assert all(item["agent"] != "codex-cli:43" for item in pixelverse_fastapi.get_world()["agents"])

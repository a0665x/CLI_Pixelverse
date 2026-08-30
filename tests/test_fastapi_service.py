import importlib

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient


def test_legacy_map_and_outer_furniture_routes_are_absent():
    import pixelverse_fastapi

    client = TestClient(pixelverse_fastapi.app)
    for method, path in (
        ("get", "/global_map/default.yaml"),
        ("post", "/api/global-map/submit"),
        ("get", "/api/furniture-layout"),
        ("post", "/api/furniture-layout"),
    ):
        response = client.post(path, json={}) if method == "post" else client.get(path)
        assert response.status_code == 404

    assert client.get("/health").status_code != 404
    assert client.get("/api/world").status_code != 404
    assert client.post("/api/event", json={}).status_code != 404


def test_world_snapshot_has_no_outer_furniture_layout():
    import pixelverse_server

    assert "furniture_layout" not in pixelverse_server.WORLD.public_snapshot()


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
            project_path="/home/user/Allen_CV",
            project_name="Allen_CV",
        )
    )
    assert result["ok"] is True

    world = pixelverse_fastapi.get_world()
    agent = next(item for item in world["agents"] if item["agent"] == "codex-main")
    assert agent["state"] == "working"
    assert agent["project_path"] == "/home/user/Allen_CV"
    assert agent["project_name"] == "Allen_CV"
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


def test_fastapi_subagent_routes_have_real_coordinate_displacement_and_event_ids(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "codex")
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    def emit(event, **kwargs):
        result = pixelverse_fastapi.generic_event(pixelverse_fastapi.GenericAgentEvent(
            agent_type="codex",
            agent="codex-subagent:child-route-1",
            name="Route Scout",
            role="subagent",
            event=event,
            **kwargs,
        ))
        agent = next(
            item for item in result["snapshot"]["agents"]
            if item["agent"] == "codex-subagent:child-route-1"
        )
        return result["snapshot"], agent

    _, started = emit(
        "subagent.started",
        state="working",
        message="Child spawned",
        target_room="clone_bay",
    )
    started_position = (started["x"], started["y"])

    working_world, working = emit(
        "tool.started",
        state="working",
        tool_name="WebSearch",
        message="Searching external sources",
        target_room="tool_forge",
    )
    working_position = (working["x"], working["y"])

    assert working["state"] == "working"
    assert working["room_key"] == "tool_forge"
    assert working_position != started_position
    outbound = working["route_evidence"]
    assert outbound["from_room"] == "clone_bay"
    assert outbound["to_room"] == "tool_forge"
    assert outbound["from_position"] == {"x": started_position[0], "y": started_position[1]}
    assert outbound["to_position"] == {"x": working_position[0], "y": working_position[1]}
    assert outbound["position_changed"] is True
    assert isinstance(outbound["event_id"], int)
    assert any(
        (item.get("payload", {}).get("route_evidence") or item.get("payload", {}).get("action", {}).get("route_evidence")) == outbound
        for item in working_world["events"]
    )

    _, tool_done = emit(
        "tool.completed",
        state="working",
        tool_name="WebSearch",
        message="External search completed",
        target_room="tool_forge",
    )
    assert tool_done["state"] == "working"
    assert (tool_done["x"], tool_done["y"]) == working_position

    _, stopped = emit(
        "subagent.stopped",
        state="idle",
        message="Child completed",
        target_room="clone_bay",
    )
    inbound = stopped["route_evidence"]
    assert stopped["room_key"] == "clone_bay"
    assert (stopped["x"], stopped["y"]) == started_position
    assert inbound["from_room"] == "tool_forge"
    assert inbound["to_room"] == "clone_bay"
    assert inbound["from_position"] == {"x": working_position[0], "y": working_position[1]}
    assert inbound["to_position"] == {"x": started_position[0], "y": started_position[1]}
    assert inbound["position_changed"] is True
    assert inbound["event_id"] > outbound["event_id"]


def test_fastapi_main_agent_routes_to_clone_then_only_completion_returns_standby(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "codex")
    monkeypatch.setenv("PIXELVERSE_HERMES_ENABLE", "0")

    import pixelverse_server
    import pixelverse_fastapi

    importlib.reload(pixelverse_server)
    pixelverse_fastapi = importlib.reload(pixelverse_fastapi)

    def emit(event, **kwargs):
        result = pixelverse_fastapi.generic_event(pixelverse_fastapi.GenericAgentEvent(
            agent_type="codex",
            agent="codex-main",
            event=event,
            **kwargs,
        ))
        return next(item for item in result["snapshot"]["agents"] if item["agent"] == "codex-main")

    thinking = emit("start", message="Analyze delegation")
    clone = emit("subagent.started", state="collaborating", message="Delegating", target_room="clone_bay")
    tool_done = emit("tool.completed", state="working", tool_name="Task", message="Delegation tool completed", target_room="clone_bay")
    completed = emit("completed", message="Session complete")

    assert thinking["room_key"] == "think_lab"
    assert clone["room_key"] == "clone_bay"
    assert (clone["x"], clone["y"]) != (thinking["x"], thinking["y"])
    assert tool_done["state"] == "working"
    assert tool_done["room_key"] == "clone_bay"
    assert completed["state"] == "idle"
    assert completed["room_key"] == "standby_dock"
    assert completed["route_evidence"]["from_room"] == "clone_bay"
    assert completed["route_evidence"]["to_room"] == "standby_dock"


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

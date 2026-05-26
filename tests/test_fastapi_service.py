import importlib


def test_fastapi_exposes_openapi_and_generic_agent_events(monkeypatch):
    monkeypatch.setenv("PIXELVERSE_AGENT_KIND", "codex")

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

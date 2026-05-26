#!/usr/bin/env python3
"""FastAPI service entrypoint for Hermes Pixelverse.

This keeps the existing stdlib server intact while exposing OpenAPI/Swagger
for generic agent integrations.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import FastAPI, Query
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from pixelverse_server import AGENT_KIND, INDEX_HTML, PUBLIC_DIR, PORT, WORLD, normalize_state


class HeartbeatPayload(BaseModel):
    agent: str = Field("main-agent", description="Stable agent id.")
    name: str | None = Field(None, description="Display name.")
    state: str = Field("idle", description="idle, thinking, planning, working, completed, failed, offline.")
    task: str | None = Field(None, description="Short current task or tool summary.")
    energy: float = Field(1.0, ge=0.0, le=1.0)
    color: str | None = Field(None, description="CSS color used by the world UI.")
    role: str | None = Field(None, description="main_agent, subagent, or branch_session.")
    target_room: str | None = Field(None, description="Optional Pixelverse room key override.")


class ActionPayload(BaseModel):
    type: str = Field("status", description="thought, tool, status, speak, or message.")
    message: str | None = None
    to: str | None = None
    state: str | None = None
    event_name: str | None = None
    tool_name: str | None = None
    tool_names: list[str] | None = None
    tool_phase: str | None = Field(None, description="started or completed.")
    preview: str | None = None
    target_room: str | None = Field(None, description="Optional Pixelverse room key override.")


class AgentActionPayload(BaseModel):
    agent: str = Field("main-agent", description="Agent id to update.")
    action: ActionPayload


class WebhookPayload(BaseModel):
    agent: str = Field("main-agent", description="Agent id.")
    url: str = Field(..., description="Webhook URL.")


class GenericAgentEvent(BaseModel):
    agent_type: str = Field("generic", description="codex, gemini-cli, claude-code, ollama, hermes, or generic.")
    agent: str = Field("main-agent", description="Stable agent id.")
    name: str | None = Field(None, description="Display name.")
    event: str = Field("status", description="start, thought, tool.started, tool.completed, end, error, status.")
    message: str | None = None
    state: str | None = None
    tool_name: str | None = None
    tool_names: list[str] | None = None
    target_room: str | None = Field(None, description="Optional Pixelverse room key override.")
    role: str | None = Field(None, description="main_agent, subagent, or branch_session.")
    color: str | None = None


app = FastAPI(
    title="Hermes Pixelverse Agent Visualizer",
    description=(
        "World-first pixel UI for Hermes, Codex, Gemini CLI, Claude Code, "
        "or any agent that can send heartbeat/action events."
    ),
    version="0.2.0",
)
app.mount("/assets", StaticFiles(directory=PUBLIC_DIR / "assets"), name="assets")


@app.get("/", include_in_schema=False)
def index() -> FileResponse:
    return FileResponse(INDEX_HTML)


@app.get("/health", tags=["service"])
def health() -> dict[str, Any]:
    snapshot = WORLD.public_snapshot()
    return {
        "ok": True,
        "service": "pixelverse-fastapi",
        "port": PORT,
        "agent_kind": AGENT_KIND,
        "sources": _source_summary(snapshot),
    }


@app.get("/api/world", tags=["world"])
def get_world() -> dict[str, Any]:
    return WORLD.public_snapshot()


@app.get("/api/sources", tags=["world"])
def get_sources() -> dict[str, Any]:
    snapshot = WORLD.public_snapshot()
    return {
        "agent_kind": AGENT_KIND,
        "sources": _source_summary(snapshot),
        "stats": snapshot.get("stats", {}),
    }


@app.get("/api/agents", tags=["world"])
def get_agents() -> dict[str, Any]:
    return {"agents": WORLD.public_snapshot()["agents"]}


@app.get("/api/inbox", tags=["world"])
def get_inbox(agent: str = Query("", description="Agent id."), peek: bool = False) -> dict[str, Any]:
    return {"messages": WORLD.get_inbox(agent, peek=peek)}


@app.get("/api/world/stream", tags=["world"])
async def stream_world(since: int = 0) -> StreamingResponse:
    async def event_stream():
        last_seq = since
        initial = WORLD.build_stream_event(last_seq)
        last_seq = int(initial["id"])
        yield _sse("world.update", last_seq, initial)
        while True:
            next_seq = await asyncio.to_thread(WORLD.wait_for_event, last_seq, 15.0)
            if next_seq > last_seq:
                update = WORLD.build_stream_event(last_seq)
                last_seq = int(update["id"])
                yield _sse("world.update", last_seq, update)
            else:
                yield ": keepalive\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


@app.post("/api/heartbeat", tags=["events"])
def heartbeat(payload: HeartbeatPayload) -> dict[str, Any]:
    agent = WORLD.upsert_agent(_model_dump(payload))
    return {"ok": True, "agent": agent.to_public()}


@app.post("/api/act", tags=["events"])
def act(payload: AgentActionPayload) -> dict[str, Any]:
    WORLD.act(payload.agent, _model_dump(payload.action))
    return {"ok": True}


@app.post("/api/event", tags=["events"])
def generic_event(payload: GenericAgentEvent) -> dict[str, Any]:
    data = _model_dump(payload)
    state = _state_for_event(data)
    task = data.get("message") or data.get("tool_name") or ", ".join(data.get("tool_names") or [])
    WORLD.upsert_agent(
        {
            "agent": payload.agent,
            "name": payload.name or _default_agent_name(payload.agent_type),
            "state": state,
            "task": task,
            "color": payload.color or _default_agent_color(payload.agent_type),
            "target_room": data.get("target_room"),
            "role": data.get("role") or "main_agent",
        }
    )
    WORLD.act(payload.agent, _action_for_event(data, state))
    return {"ok": True, "snapshot": WORLD.public_snapshot()}


@app.post("/api/webhook", tags=["webhooks"])
def register_webhook(payload: WebhookPayload) -> dict[str, Any]:
    WORLD.register_webhook(payload.agent, payload.url)
    return {"ok": True}


@app.delete("/api/webhook", tags=["webhooks"])
def unregister_webhook(agent: str = Query(..., description="Agent id.")) -> dict[str, Any]:
    WORLD.unregister_webhook(agent)
    return {"ok": True}


@app.get("/{path:path}", include_in_schema=False)
def static_file(path: str):
    requested = (PUBLIC_DIR / path).resolve()
    if PUBLIC_DIR in requested.parents and requested.is_file():
        return FileResponse(requested)
    return JSONResponse({"error": "not found", "path": f"/{path}"}, status_code=404)


def _sse(event_name: str, event_id: int | None, payload: dict[str, Any]) -> str:
    lines = [f"event: {event_name}"]
    if event_id is not None:
        lines.append(f"id: {event_id}")
    for line in json.dumps(payload, ensure_ascii=False).splitlines() or ["{}"]:
        lines.append(f"data: {line}")
    lines.append("")
    return "\n".join(lines) + "\n"


def _model_dump(model: BaseModel) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump(exclude_none=True)
    return model.dict(exclude_none=True)


def _source_summary(snapshot: dict[str, Any]) -> dict[str, Any]:
    hermes = snapshot.get("hermes") or {}
    ollama = snapshot.get("ollama") or {}
    return {
        "hermes": {
            "enabled": AGENT_KIND == "hermes",
            "connected": bool(hermes.get("connected")),
            "source": hermes.get("source"),
            "error": hermes.get("error"),
            "subagent_count": len(hermes.get("subagent_agents") or []),
            "session_count": len(hermes.get("session_agents") or []),
        },
        "ollama": {
            "enabled": AGENT_KIND == "ollama",
            "connected": bool(ollama.get("connected")),
            "source": ollama.get("source"),
            "error": ollama.get("error"),
            "model_count": len(ollama.get("model_agents") or []),
        },
        "events": {
            "local_agent_count": snapshot.get("stats", {}).get("local_agent_count", 0),
            "webhook_count": len(snapshot.get("webhooks") or {}),
        },
    }


def _state_for_event(data: dict[str, Any]) -> str:
    if data.get("state"):
        return normalize_state(data["state"])
    event = str(data.get("event") or "").lower()
    if event in {"start", "started"}:
        return "planning"
    if event in {"thought", "reasoning", "plan"}:
        return "thinking"
    if event.startswith("tool") or event in {"step", "working"}:
        return "working"
    if event in {"end", "done", "completed", "complete"}:
        return "idle"
    if event in {"error", "failed", "fail"}:
        return "offline"
    return "idle"


def _action_for_event(data: dict[str, Any], state: str) -> dict[str, Any]:
    event = str(data.get("event") or "status")
    action_type = "status"
    if event in {"thought", "reasoning", "plan"}:
        action_type = "thought"
    elif event.startswith("tool") or data.get("tool_name") or data.get("tool_names"):
        action_type = "tool"
    action = {
        "type": action_type,
        "message": data.get("message") or event,
        "state": state,
        "event_name": f"agent.{event}",
    }
    for key in ("tool_name", "tool_names", "target_room"):
        if data.get(key):
            action[key] = data[key]
    if event.endswith(".started"):
        action["tool_phase"] = "started"
    elif event.endswith(".completed"):
        action["tool_phase"] = "completed"
    return action


def _default_agent_name(agent_type: str) -> str:
    names = {
        "codex": "Codex",
        "gemini-cli": "Gemini CLI",
        "claude-code": "Claude Code",
        "ollama": "Ollama",
        "hermes": "Hermes",
    }
    return names.get(agent_type, "Generic Agent")


def _default_agent_color(agent_type: str) -> str:
    colors = {
        "codex": "#10b981",
        "gemini-cli": "#3b82f6",
        "claude-code": "#f97316",
        "ollama": "#111827",
        "hermes": "#8b5cf6",
    }
    return colors.get(agent_type, "#64748b")

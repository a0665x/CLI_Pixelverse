#!/usr/bin/env python3
"""Hermes Pixelverse local server.

Provides:
- A Miniverse-compatible subset for bridge.py
- A world-first pixel UI served from public/index.html
- Read-only integration with Hermes status / subagent / session data when available

This server intentionally avoids modifying the Hermes main repo.
"""

from __future__ import annotations

import json
import mimetypes
import os
import sys
import threading
import time
from collections import deque
from dataclasses import asdict, dataclass, field
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

import httpx

ROOT = Path(__file__).resolve().parent
PUBLIC_DIR = ROOT / "public"
INDEX_HTML = PUBLIC_DIR / "index.html"
HOST = os.getenv("PIXELVERSE_HOST", "0.0.0.0")
PORT = int(os.getenv("PIXELVERSE_PORT", "4321"))
AGENT_KIND = os.getenv("PIXELVERSE_AGENT_KIND", "hermes").strip().lower() or "hermes"
STALE_AFTER_SECONDS = int(os.getenv("PIXELVERSE_STALE_AFTER", "45"))
IDLE_DECAY_SECONDS = int(os.getenv("PIXELVERSE_IDLE_DECAY", "12"))
HERMES_WEB_BASE = os.getenv("PIXELVERSE_HERMES_WEB_BASE", "http://127.0.0.1:9119").rstrip("/")
HERMES_GATEWAY_HEALTH = os.getenv("PIXELVERSE_HERMES_GATEWAY_HEALTH", "http://127.0.0.1:8642/health/detailed")
HERMES_API_TOKEN = os.getenv("PIXELVERSE_HERMES_API_TOKEN", "")
HERMES_REPO = Path(
    os.getenv(
        "PIXELVERSE_HERMES_REPO",
        "~/Desktop/AI_AGX_WS/HermesAgent_OpenWebUI/hermes-agent",
    )
).expanduser()
HERMES_POLL_SECONDS = float(os.getenv("PIXELVERSE_HERMES_POLL_SECONDS", "2.0"))
OLLAMA_BASE = os.getenv("PIXELVERSE_OLLAMA_BASE", "http://127.0.0.1:11434").rstrip("/")
OLLAMA_POLL_SECONDS = float(os.getenv("PIXELVERSE_OLLAMA_POLL_SECONDS", "2.0"))

TOOL_DISPLAY: dict[str, dict[str, str]] = {
    "search_files": {"label": "搜尋檔案", "icon": "🔎"},
    "read_file": {"label": "讀取檔案", "icon": "📜"},
    "write_file": {"label": "寫入檔案", "icon": "✍️"},
    "patch": {"label": "修改檔案", "icon": "🩹"},
    "terminal": {"label": "終端機操作", "icon": "💻"},
    "browser_navigate": {"label": "打開網頁", "icon": "🧭"},
    "browser_click": {"label": "點擊網頁", "icon": "🖱️"},
    "browser_type": {"label": "填寫表單", "icon": "⌨️"},
    "browser_snapshot": {"label": "讀取頁面", "icon": "🪟"},
    "execute_code": {"label": "執行程式", "icon": "🧪"},
    "delegate_task": {"label": "派出分身", "icon": "🧬"},
    "session_search": {"label": "搜尋歷史紀錄", "icon": "🗂️"},
    "memory": {"label": "寫入記憶", "icon": "🧠"},
    "todo": {"label": "更新任務板", "icon": "📝"},
}

STATUS_LABELS = {
    "idle": "待命中",
    "thinking": "思考中",
    "planning": "規劃中",
    "working": "執行中",
    "running": "執行中",
    "completed": "已完成",
    "failed": "失敗",
    "offline": "離線",
}

SUBAGENT_STATUS_LABELS = {
    "running": "執行中",
    "completed": "已完成",
    "failed": "失敗",
    "idle": "待命中",
}

EVENT_TYPE_LABELS = {
    "subagent.start": "分身已啟動",
    "subagent.complete": "分身已完成",
    "subagent.error": "分身發生錯誤",
    "tool.started": "工具開始執行",
    "tool.completed": "工具執行完成",
    "reasoning.available": "主代理正在規劃",
    "_thinking": "分身正在整理結果",
}

SESSION_SOURCE_LABELS = {
    "api_server": "API 工作階段",
    "cli": "CLI 工作階段",
    "gateway": "Gateway 工作階段",
}

ROOM_DISPLAY = {
    "standby_dock": {"label": "待命站", "icon": "🛏️"},
    "think_lab": {"label": "思考室", "icon": "💡"},
    "blueprint_lab": {"label": "藍圖規劃研究室", "icon": "🗺️"},
    "tool_forge": {"label": "工具鍛造間", "icon": "🛠️"},
    "response_studio": {"label": "回覆工坊", "icon": "📨"},
    "clone_bay": {"label": "分身工位區", "icon": "🧬"},
    "session_archive": {"label": "工作階段檔案庫", "icon": "🗂️"},
    "offline_corner": {"label": "離線維護區", "icon": "🔌"},
}


def now_ts() -> float:
    return time.time()


def trim_text(value: str | None, limit: int = 80) -> str | None:
    if value is None:
        return None
    value = str(value).strip()
    if not value:
        return None
    return value if len(value) <= limit else value[: limit - 1] + "…"


def humanize_tool_name(tool_name: str | None) -> dict[str, str]:
    name = (tool_name or "").strip()
    if not name:
        return {"name": "", "label": "未指定工具", "icon": "✨"}
    if name in TOOL_DISPLAY:
        return {"name": name, **TOOL_DISPLAY[name]}
    prefix = name.split(":", 1)[0]
    if prefix in TOOL_DISPLAY:
        return {"name": name, **TOOL_DISPLAY[prefix]}
    if name.startswith("browser_"):
        return {"name": name, "label": "瀏覽器操作", "icon": "🌐"}
    if name.startswith("github_"):
        return {"name": name, "label": "GitHub 操作", "icon": "🐙"}
    return {"name": name, "label": name.replace("_", " "), "icon": "✨"}


def humanize_task_summary(task: str | None) -> str:
    if not task:
        return "待命"
    parts = [part.strip() for part in str(task).split(",") if part.strip()]
    if parts and all(" " not in part for part in parts):
        return "、".join(humanize_tool_name(part)["label"] for part in parts[:3])
    if len(parts) == 1:
        meta = humanize_tool_name(parts[0])
        if meta["name"] == parts[0]:
            return meta["label"]
    return trim_text(str(task), 60) or "待命"


def normalize_state(state: str | None) -> str:
    raw = (state or "idle").lower()
    if raw in {"running", "working", "busy"}:
        return "working"
    if raw in {"thinking"}:
        return "thinking"
    if raw in {"planning", "plan"}:
        return "planning"
    if raw in {"completed", "done", "success"}:
        return "idle"
    if raw in {"failed", "error", "offline"}:
        return "offline"
    return "idle"


def classify_room(
    state: str | None,
    task: str | None,
    *,
    role: str = "main_agent",
    room_hint: str | None = None,
) -> dict[str, str]:
    normalized = normalize_state(state)
    text = (task or "").lower()
    hint = (room_hint or "").strip()
    if normalized == "offline":
        key = "offline_corner"
    elif hint in ROOM_DISPLAY and hint != "offline_corner":
        key = hint
    elif role == "subagent":
        key = "clone_bay"
    elif role == "branch_session":
        key = "session_archive"
    elif normalized == "planning":
        key = "blueprint_lab"
    elif normalized == "thinking":
        key = "think_lab"
    elif normalized == "idle":
        key = "standby_dock"
    elif any(token in text for token in ("delegate_task", "delegate", "clone", "subagent", "分身", "派遣")):
        key = "clone_bay"
    elif any(token in text for token in ("session_search", "archive", "history", "session", "memory", "檔案庫", "歷史", "記憶")):
        key = "session_archive"
    elif any(token in text for token in ("patch", "write", "terminal", "execute", "browser", "修改", "寫入", "終端機", "工具")):
        key = "tool_forge"
    elif any(token in text for token in ("plan", "spec", "search", "read", "map", "research", "規劃", "搜尋", "讀取", "藍圖")):
        key = "blueprint_lab"
    elif normalized == "working":
        key = "response_studio"
    else:
        key = "standby_dock"
    room = ROOM_DISPLAY[key]
    return {"room_key": key, "room_label": room["label"], "room_icon": room["icon"]}


def _contains_any(text: str, tokens: tuple[str, ...]) -> bool:
    return any(token in text for token in tokens)


def infer_state_from_text(text: str | None, *, fallback: str = "idle") -> str:
    raw = (text or "").lower()
    if _contains_any(raw, ("待命", "idle", "standby", "完成", "completed", "回到待命")):
        return "idle"
    if _contains_any(raw, ("plan", "spec", "search", "read", "map", "research", "規劃", "搜尋", "讀取", "藍圖", "研究")):
        return "planning"
    if _contains_any(raw, ("thinking", "reason", "整理", "思考", "推理")):
        return "thinking"
    if _contains_any(raw, ("patch", "write", "terminal", "execute", "browser", "reply", "修改", "寫入", "終端機", "輸出", "回覆")):
        return "working"
    return normalize_state(fallback)


def summarize_action_task(action_type: str, message: str | None, action: dict[str, Any] | None = None) -> str | None:
    action = action or {}
    tool_name = action.get("tool_name") or (action.get("tool_names") or [None])[0]
    if tool_name:
        tool = humanize_tool_name(tool_name)
        if action.get("tool_phase") == "completed":
            return f"{tool['label']} 已完成"
        if action_type == "tool":
            return tool["label"]
    text = trim_text(message, 60)
    if not text:
        return None
    if action_type in {"thought", "tool"} and "：" in text:
        return trim_text(text.split("：", 1)[1], 60)
    if action_type == "status" and _contains_any(text.lower(), ("待命", "idle", "completed", "完成")):
        return None
    return text


def build_main_agent_position(room_key: str) -> tuple[int, int]:
    positions = {
        "think_lab": (18, 27),
        "blueprint_lab": (44, 27),
        "clone_bay": (76, 27),
        "tool_forge": (64, 72),
        "response_studio": (42, 72),
        "standby_dock": (18, 72),
        "session_archive": (84, 72),
        "offline_corner": (9, 90),
    }
    return positions.get(room_key, positions["standby_dock"])


def build_clone_position(index: int) -> tuple[int, int]:
    slots = [(66, 18), (82, 18), (66, 28), (82, 28), (74, 24), (88, 24), (70, 34), (84, 34)]
    return slots[index % len(slots)]


def build_session_position(index: int) -> tuple[int, int]:
    slots = [(76, 66), (88, 66), (76, 74), (88, 74), (82, 70), (86, 78)]
    return slots[index % len(slots)]


@dataclass
class AgentState:
    agent: str
    name: str
    role: str = "main_agent"
    state: str = "idle"
    energy: float = 1.0
    color: str = "#CD7F32"
    task: str | None = None
    x: int = 0
    y: int = 0
    last_seen: float = field(default_factory=now_ts)
    recent_actions: list[dict[str, Any]] = field(default_factory=list)
    speech: str | None = None
    speech_to: str | None = None
    last_action_at: float = field(default_factory=now_ts)
    last_action_type: str | None = None
    room_key_hint: str | None = None

    def effective_state(self) -> str:
        state = normalize_state(self.state)
        task = trim_text(self.task, 60)
        recent_text = (self.recent_actions[0].get("message") if self.recent_actions else "") or ""
        if state in {"thinking", "planning", "working"} and not task and now_ts() - self.last_action_at > IDLE_DECAY_SECONDS:
            return "idle"
        if state == "thinking" and infer_state_from_text(recent_text, fallback=state) == "planning":
            return "planning"
        return state

    def effective_task(self) -> str | None:
        if self.effective_state() == "idle":
            return None
        task = trim_text(self.task, 60)
        if task:
            return task
        if self.recent_actions:
            latest = self.recent_actions[0]
            if now_ts() - (latest.get("time", 0) / 1000) <= IDLE_DECAY_SECONDS:
                return summarize_action_task(latest.get("type", ""), latest.get("message"), latest)
        return None

    def to_public(self) -> dict[str, Any]:
        data = asdict(self)
        effective_state = self.effective_state()
        effective_task = self.effective_task()
        room_hint = None if effective_state == "idle" else self.room_key_hint
        role = self.role if self.role in {"main_agent", "subagent", "branch_session"} else "main_agent"
        room_meta = classify_room(effective_state, effective_task, role=role, room_hint=room_hint)
        if role == "subagent":
            px, py = build_clone_position(abs(hash(self.agent)) % 8)
        elif role == "branch_session":
            px, py = build_session_position(abs(hash(self.agent)) % 6)
        else:
            px, py = build_main_agent_position(room_meta["room_key"])
        data["state"] = effective_state
        data["task"] = effective_task
        data["last_seen_ms"] = int(self.last_seen * 1000)
        data["age_seconds"] = round(now_ts() - self.last_seen, 1)
        data["role"] = role
        data["role_label"] = "分身代理" if role == "subagent" else "分支工作階段" if role == "branch_session" else "主代理"
        data["status_label"] = STATUS_LABELS.get(effective_state, effective_state)
        data["tool_label"] = humanize_task_summary(effective_task)
        tool_meta = humanize_tool_name((effective_task or "").split(",", 1)[0].strip() if effective_task else None)
        data["tool_icon"] = tool_meta["icon"]
        data["source"] = "bridge"
        data.update(room_meta)
        data["x"] = px
        data["y"] = py
        if effective_state == "thinking":
            data["activity_hint"] = f"正在 {room_meta['room_label']} 整理推理與回覆"
        elif effective_state == "planning":
            data["activity_hint"] = f"正在 {room_meta['room_label']} 拆解需求與規劃步驟"
        elif effective_state == "working":
            data["activity_hint"] = f"正在 {room_meta['room_label']} 使用 {data['tool_label']}"
        elif effective_state == "offline":
            data["activity_hint"] = "目前沒有收到新的主代理心跳"
        else:
            data["activity_hint"] = f"目前位於 {room_meta['room_label']}，等待下一個任務"
        return data


class WorldState:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.event_cv = threading.Condition(self.lock)
        self.agents: dict[str, AgentState] = {}
        self.webhooks: dict[str, str] = {}
        self.inboxes: dict[str, list[dict[str, Any]]] = {}
        self.events: deque[dict[str, Any]] = deque(maxlen=120)
        self.event_seq = 0

    def _next_position(self, index: int) -> tuple[int, int]:
        slots = [(15, 44), (23, 16), (50, 16), (28, 35), (50, 35)]
        return slots[index % len(slots)]

    def add_event(self, kind: str, payload: dict[str, Any]) -> None:
        self.event_seq += 1
        self.events.appendleft({"id": self.event_seq, "time": int(now_ts() * 1000), "kind": kind, "payload": payload})
        self.event_cv.notify_all()

    def current_event_seq(self) -> int:
        with self.lock:
            return self.event_seq

    def wait_for_event(self, since_seq: int, timeout: float = 15.0) -> int:
        with self.event_cv:
            if self.event_seq > since_seq:
                return self.event_seq
            self.event_cv.wait(timeout=timeout)
            return self.event_seq

    def build_stream_event(self, since_seq: int = 0) -> dict[str, Any]:
        snapshot = self.public_snapshot()
        with self.lock:
            event_id = self.event_seq
        return {
            "event": "world.update",
            "id": event_id,
            "since": since_seq,
            "snapshot": snapshot,
        }

    def upsert_agent(self, payload: dict[str, Any]) -> AgentState:
        agent_id = payload.get("agent") or payload.get("id") or "unknown"
        with self.lock:
            agent = self.agents.get(agent_id)
            if not agent:
                x, y = self._next_position(len(self.agents))
                agent = AgentState(
                    agent=agent_id,
                    name=payload.get("name") or agent_id,
                    role=payload.get("role") or "main_agent",
                    x=x,
                    y=y,
                )
                self.agents[agent_id] = agent
            agent.name = payload.get("name") or agent.name
            if payload.get("role") in {"main_agent", "subagent", "branch_session"}:
                agent.role = payload.get("role")
            if payload.get("state") is not None:
                agent.state = normalize_state(payload.get("state"))
            agent.energy = float(payload.get("energy", agent.energy))
            agent.color = payload.get("color") or agent.color
            if "task" in payload:
                agent.task = trim_text(payload.get("task"), 60)
            if payload.get("target_room") in ROOM_DISPLAY:
                agent.room_key_hint = payload.get("target_room")
            elif payload.get("room_key") in ROOM_DISPLAY:
                agent.room_key_hint = payload.get("room_key")
            agent.last_seen = now_ts()
            self.add_event("heartbeat", {"agent": agent.agent, "state": agent.state, "task": agent.task})
            return agent

    def act(self, agent_id: str, action: dict[str, Any]) -> None:
        with self.lock:
            agent = self.agents.get(agent_id)
            if not agent:
                x, y = self._next_position(len(self.agents))
                agent = AgentState(agent=agent_id, name=agent_id, x=x, y=y)
                self.agents[agent_id] = agent
            entry = {
                "type": action.get("type", "unknown"),
                "message": action.get("message"),
                "to": action.get("to"),
                "time": int(now_ts() * 1000),
            }
            for key in ("event_name", "tool_name", "tool_names", "tool_phase", "preview", "state", "target_room", "room_key"):
                if key in action:
                    entry[key] = action.get(key)
            agent.recent_actions = [entry, *agent.recent_actions[:9]]
            agent.last_seen = now_ts()
            agent.last_action_at = now_ts()
            agent.last_action_type = entry["type"]
            action_type = entry["type"]
            if action_type in {"thought", "tool", "status"}:
                agent.state = normalize_state(action.get("state")) if action.get("state") else infer_state_from_text(entry.get("message"), fallback=agent.state)
                if action.get("target_room") in ROOM_DISPLAY:
                    agent.room_key_hint = action.get("target_room")
                elif action.get("room_key") in ROOM_DISPLAY:
                    agent.room_key_hint = action.get("room_key")
                if action_type == "status" and agent.state == "idle":
                    agent.task = None
                    agent.room_key_hint = None
                else:
                    agent.task = summarize_action_task(action_type, entry.get("message"), entry) or agent.task
            if action_type == "speak":
                agent.speech = action.get("message")
                agent.speech_to = action.get("to")
            if action_type == "message":
                to = action.get("to")
                if to:
                    self.inboxes.setdefault(to, []).append(
                        {"from": agent_id, "message": action.get("message", ""), "time": entry["time"]}
                    )
            event_kind = entry.get("event_name") or "action"
            self.add_event(event_kind, {"agent": agent_id, "action": entry})

    def register_webhook(self, agent_id: str, url: str) -> None:
        with self.lock:
            self.webhooks[agent_id] = url
            self.add_event("webhook.registered", {"agent": agent_id, "url": url})

    def unregister_webhook(self, agent_id: str) -> None:
        with self.lock:
            self.webhooks.pop(agent_id, None)
            self.add_event("webhook.removed", {"agent": agent_id})

    def get_inbox(self, agent_id: str, peek: bool = False) -> list[dict[str, Any]]:
        with self.lock:
            items = list(self.inboxes.get(agent_id, []))
            if not peek:
                self.inboxes[agent_id] = []
            return items

    def snapshot_local_agents(self) -> list[dict[str, Any]]:
        with self.lock:
            agents = [a.to_public() for a in self.agents.values()]
        agents.sort(key=lambda item: item["agent"])
        for item in agents:
            age = item["age_seconds"]
            item["is_stale"] = age > STALE_AFTER_SECONDS
            if item["is_stale"] and item["state"] != "offline":
                item["state"] = "offline"
                item["status_label"] = STATUS_LABELS["offline"]
                offline_room = classify_room("offline", item.get("task"), role="main_agent")
                item.update(offline_room)
                item["activity_hint"] = "目前沒有收到新的主代理心跳"
        return agents

    def public_snapshot(self) -> dict[str, Any]:
        local_agents = self.snapshot_local_agents()
        hermes = HERMES_SOURCE.get_snapshot()
        ollama = OLLAMA_SOURCE.get_snapshot()
        merged_agents = merge_agents(
            local_agents,
            hermes.get("subagent_agents", []),
            hermes.get("session_agents", []),
            ollama.get("model_agents", []),
        )
        merged_events = merge_hermes_events(list(self.events), [*hermes.get("events", []), *ollama.get("events", [])], limit=18)
        return {
            "server_time_ms": int(now_ts() * 1000),
            "agents": merged_agents,
            "events": [humanize_event(event) for event in merged_events],
            "webhooks": self.webhooks,
            "hermes": hermes,
            "ollama": ollama,
            "stats": {
                "agent_count": len(merged_agents),
                "local_agent_count": len(local_agents),
                "subagent_count": len(hermes.get("subagent_agents", [])),
                "branch_session_count": len(hermes.get("session_agents", [])),
                "ollama_model_count": len(ollama.get("model_agents", [])),
                "active_session_count": hermes.get("active_session_count", 0),
                "stale_after_seconds": STALE_AFTER_SECONDS,
                "hermes_connected": hermes.get("connected", False),
                "ollama_connected": ollama.get("connected", False),
            },
        }


class HermesSource:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.last_snapshot: dict[str, Any] = self._empty_snapshot()
        self.last_fetch = 0.0

    def _empty_snapshot(self) -> dict[str, Any]:
        return {
            "connected": False,
            "source": "disabled" if AGENT_KIND != "hermes" else "unavailable",
            "agent_kind": AGENT_KIND,
            "status": {},
            "subagents": {},
            "sessions": [],
            "subagent_agents": [],
            "session_agents": [],
            "events": [],
            "active_session_count": 0,
            "error": None if AGENT_KIND != "hermes" else None,
        }

    def get_snapshot(self) -> dict[str, Any]:
        if AGENT_KIND != "hermes":
            snapshot = self._empty_snapshot()
            snapshot["status"] = {"agent_kind": AGENT_KIND}
            return snapshot
        with self.lock:
            should_refresh = now_ts() - self.last_fetch >= HERMES_POLL_SECONDS
        if should_refresh:
            self.refresh()
        with self.lock:
            return json.loads(json.dumps(self.last_snapshot))

    def refresh(self) -> None:
        snapshot = self._fetch_snapshot()
        with self.lock:
            self.last_snapshot = snapshot
            self.last_fetch = now_ts()

    def _headers(self) -> dict[str, str]:
        if not HERMES_API_TOKEN:
            return {}
        return {"Authorization": f"Bearer {HERMES_API_TOKEN}"}

    def _get_json(self, url: str, *, needs_auth: bool = False) -> Any:
        headers = self._headers() if needs_auth else {}
        try:
            with httpx.Client(timeout=2.5) as client:
                resp = client.get(url, headers=headers)
            if resp.status_code == 401:
                return None
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    def _ensure_repo_on_path(self) -> bool:
        if not HERMES_REPO.exists():
            return False
        repo_str = str(HERMES_REPO)
        if repo_str not in sys.path:
            sys.path.insert(0, repo_str)
        return True

    def _fallback_status(self) -> dict[str, Any]:
        if not self._ensure_repo_on_path():
            return {}
        try:
            from gateway.status import get_running_pid, read_runtime_status

            runtime = read_runtime_status() or {}
            runtime["gateway_running"] = bool(get_running_pid()) or runtime.get("gateway_state") == "running"
            return runtime
        except Exception:
            return {}

    def _fallback_subagents(self) -> dict[str, Any]:
        if not self._ensure_repo_on_path():
            return {}
        try:
            from tools.subagent_tracker import get_subagent_tracker_snapshot

            data = get_subagent_tracker_snapshot()
            return data if isinstance(data, dict) else {}
        except Exception:
            return {}

    def _fallback_sessions(self, limit: int) -> list[dict[str, Any]]:
        if not self._ensure_repo_on_path():
            return []
        try:
            from hermes_state import SessionDB

            db = SessionDB()
            try:
                items = db.list_sessions_rich(limit=limit, offset=0)
                now = now_ts()
                for item in items:
                    item["is_active"] = item.get("ended_at") is None and (now - item.get("last_active", item.get("started_at", 0))) < 300
                return items
            finally:
                db.close()
        except Exception:
            return []

    def _fetch_status(self) -> dict[str, Any]:
        status = self._get_json(f"{HERMES_WEB_BASE}/api/status")
        if isinstance(status, dict):
            return status
        health = self._get_json(HERMES_GATEWAY_HEALTH)
        if isinstance(health, dict):
            return health
        return self._fallback_status()

    def _fetch_subagents(self) -> dict[str, Any]:
        api_data = self._get_json(f"{HERMES_WEB_BASE}/api/subagents")
        api_subagents = api_data if isinstance(api_data, dict) else {}
        fallback = self._fallback_subagents()
        api_total = ((api_subagents.get("summary") or {}).get("total") or 0) if api_subagents else 0
        fallback_total = ((fallback.get("summary") or {}).get("total") or 0) if fallback else 0
        return fallback if fallback_total > api_total else (api_subagents or fallback)

    def _fetch_sessions(self, limit: int) -> list[dict[str, Any]]:
        data = self._get_json(f"{HERMES_WEB_BASE}/api/sessions?limit={limit}", needs_auth=True)
        if isinstance(data, dict) and isinstance(data.get("sessions"), list):
            return [summarize_session(item) for item in data["sessions"]]
        return [summarize_session(item) for item in self._fallback_sessions(limit)]

    def _fetch_snapshot(self) -> dict[str, Any]:
        status = self._fetch_status()
        subagents = self._fetch_subagents()
        sessions = self._fetch_sessions(limit=8)
        subagent_agents: list[dict[str, Any]] = []
        session_agents: list[dict[str, Any]] = []
        subagent_events = extract_subagent_events(subagents, limit=10)

        for idx, child in enumerate(iter_subagent_children(subagents)):
            agent = build_subagent_agent(child, index=idx)
            subagent_agents.append(agent)
            subagent_events.append(
                {
                    "time": int((child.get("last_event_ts") or child.get("updated_ts") or now_ts()) * 1000),
                    "kind": "hermes.subagent",
                    "payload": {
                        "agent": agent["agent"],
                        "status": child.get("status", "unknown"),
                        "goal": child.get("goal"),
                        "current_tool": extract_child_tool_name(child),
                        "session_id": child.get("session_id"),
                    },
                }
            )

        for idx, sess in enumerate(select_branch_sessions(sessions, limit=6)):
            session_agents.append(build_session_agent(sess, index=idx))

        session_events = [
            {
                "time": int((sess.get("last_active") or sess.get("started_at") or now_ts()) * 1000),
                "kind": "hermes.session",
                "payload": {
                    "session_id": sess.get("session_id") or sess.get("id"),
                    "title": summarize_session(sess).get("title") or "未命名工作階段",
                    "active": sess.get("is_active", False),
                    "source": sess.get("source"),
                },
            }
            for sess in sessions[:4]
        ]

        events: list[dict[str, Any]] = []
        if status:
            events.append(
                {
                    "time": int(now_ts() * 1000),
                    "kind": "hermes.status",
                    "payload": {
                        "gateway_state": status.get("gateway_state") or status.get("status") or "unknown",
                        "active_sessions": status.get("active_sessions", 0),
                        "version": status.get("version") or status.get("platform", "Hermes"),
                    },
                }
            )
        events.extend(subagent_events)
        events.extend(session_events)
        connected = bool(status or subagents or sessions)
        source = "api" if status or subagents else "fallback"
        if not connected:
            source = "unavailable"
        return {
            "connected": connected,
            "source": source,
            "status": status,
            "subagents": subagents,
            "sessions": sessions,
            "subagent_agents": subagent_agents,
            "session_agents": session_agents,
            "events": events,
            "active_session_count": sum(1 for item in sessions if item.get("is_active")),
            "error": None if connected else "無法取得 Hermes 狀態",
        }


HERMES_SOURCE = HermesSource()


class OllamaSource:
    def __init__(self) -> None:
        self.lock = threading.Lock()
        self.last_snapshot: dict[str, Any] = self._empty_snapshot()
        self.last_fetch = 0.0

    def _empty_snapshot(self) -> dict[str, Any]:
        return {
            "connected": False,
            "source": "disabled" if AGENT_KIND != "ollama" else "unavailable",
            "base_url": OLLAMA_BASE,
            "models": [],
            "running_models": [],
            "model_agents": [],
            "events": [],
            "error": None if AGENT_KIND != "ollama" else None,
        }

    def get_snapshot(self) -> dict[str, Any]:
        if AGENT_KIND != "ollama":
            return self._empty_snapshot()
        with self.lock:
            should_refresh = now_ts() - self.last_fetch >= OLLAMA_POLL_SECONDS
        if should_refresh:
            self.refresh()
        with self.lock:
            return json.loads(json.dumps(self.last_snapshot))

    def refresh(self) -> None:
        snapshot = self._fetch_snapshot()
        with self.lock:
            self.last_snapshot = snapshot
            self.last_fetch = now_ts()

    def _get_json(self, path: str) -> Any:
        try:
            with httpx.Client(timeout=2.5) as client:
                resp = client.get(f"{OLLAMA_BASE}{path}")
            resp.raise_for_status()
            return resp.json()
        except Exception:
            return None

    def _fetch_snapshot(self) -> dict[str, Any]:
        running_data = self._get_json("/api/ps")
        tags_data = self._get_json("/api/tags")
        running_models = running_data.get("models", []) if isinstance(running_data, dict) else []
        models = tags_data.get("models", []) if isinstance(tags_data, dict) else []
        connected = isinstance(running_data, dict) or isinstance(tags_data, dict)
        model_agents = build_ollama_model_agents(running_models, models)
        events = []
        if connected:
            events.append(
                {
                    "time": int(now_ts() * 1000),
                    "kind": "ollama.status",
                    "payload": {
                        "running_count": len(running_models),
                        "model_count": len(models),
                        "base_url": OLLAMA_BASE,
                    },
                }
            )
        return {
            "connected": connected,
            "source": "api" if connected else "unavailable",
            "base_url": OLLAMA_BASE,
            "models": models,
            "running_models": running_models,
            "model_agents": model_agents,
            "events": events,
            "error": None if connected else f"無法連線到 Ollama：{OLLAMA_BASE}",
        }


OLLAMA_SOURCE = OllamaSource()


def summarize_session(session: dict[str, Any]) -> dict[str, Any]:
    session_id = session.get("session_id") or session.get("id")
    source_label = SESSION_SOURCE_LABELS.get(session.get("source"), session.get("source") or "工作階段")
    preview = trim_text(session.get("preview"), 60)
    title = trim_text(session.get("title") or session.get("summary") or source_label or "未命名工作階段", 60)
    return {
        "session_id": session_id,
        "title": title,
        "preview": preview,
        "source": session.get("source"),
        "source_label": source_label,
        "model": session.get("model"),
        "started_at": session.get("started_at"),
        "last_active": session.get("last_active"),
        "ended_at": session.get("ended_at"),
        "message_count": session.get("message_count", 0),
        "is_active": session.get("is_active", False),
    }


def iter_subagent_children(subagents: dict[str, Any]) -> list[dict[str, Any]]:
    runs = subagents.get("runs") or []
    children: list[dict[str, Any]] = []
    for run in runs:
        for child in run.get("children") or []:
            item = dict(child)
            item.setdefault("parent_run_id", run.get("id"))
            children.append(item)
    return children


def select_branch_sessions(sessions: list[dict[str, Any]], *, limit: int) -> list[dict[str, Any]]:
    ordered = sorted(
        sessions,
        key=lambda item: (0 if item.get("is_active") else 1, -(item.get("last_active") or item.get("started_at") or 0)),
    )
    selected: list[dict[str, Any]] = []
    seen: set[str] = set()
    for sess in ordered:
        session_id = sess.get("session_id") or sess.get("id")
        if not session_id or session_id in seen:
            continue
        seen.add(session_id)
        selected.append(sess)
        if len(selected) >= limit:
            break
    return selected


def extract_child_tool_name(child: dict[str, Any]) -> str | None:
    if child.get("current_tool"):
        return child.get("current_tool")
    for event in reversed(child.get("events") or []):
        tool_name = event.get("tool_name")
        if tool_name:
            return tool_name
    return None


def build_subagent_agent(child: dict[str, Any], index: int) -> dict[str, Any]:
    x, y = build_clone_position(index)
    tool_name = extract_child_tool_name(child)
    tool = humanize_tool_name(tool_name)
    state = normalize_state(child.get("status"))
    room_meta = classify_room(state, tool["label"] if tool_name else child.get("goal"), role="subagent")
    task = tool["label"] if tool_name else trim_text(child.get("goal"), 30)
    return {
        "agent": f"subagent:{child.get('id', index)}",
        "name": trim_text(child.get("goal") or child.get("id") or f"分身 {index + 1}", 22) or f"分身 {index + 1}",
        "full_name": child.get("goal") or child.get("id") or f"分身 {index + 1}",
        "state": state,
        "status_label": STATUS_LABELS.get(state, state),
        "energy": 1.0,
        "color": "#8b5cf6",
        "task": task,
        "tool_label": tool["label"],
        "tool_icon": tool["icon"],
        "x": x,
        "y": y,
        "last_seen_ms": int((child.get("last_event_ts") or child.get("updated_ts") or now_ts()) * 1000),
        "age_seconds": round(now_ts() - (child.get("last_event_ts") or child.get("updated_ts") or now_ts()), 1),
        "is_stale": False,
        "role": "subagent",
        "role_label": "分身代理",
        "goal": child.get("goal"),
        "session_id": child.get("session_id"),
        "event_count": child.get("event_count", 0),
        "recent_actions": [],
        "speech": None,
        "source": "hermes-subagents",
        **room_meta,
        "activity_hint": f"正在 {room_meta['room_label']} 處理：{task or '分身任務'}",
    }


def build_session_agent(session: dict[str, Any], index: int) -> dict[str, Any]:
    x, y = build_session_position(index)
    meta = summarize_session(session)
    is_active = bool(meta.get("is_active"))
    state = "working" if is_active else "idle"
    title = trim_text(meta.get("title"), 22) or f"分支 {index + 1}"
    full_name = meta.get("title") or meta.get("session_id") or f"分支 {index + 1}"
    task = meta.get("preview") or f"{meta.get('source_label', '工作階段')} 最近活動"
    last_seen = meta.get("last_active") or meta.get("started_at") or now_ts()
    room_meta = classify_room(state, task, role="branch_session")
    return {
        "agent": f"session:{meta.get('session_id') or index}",
        "name": title,
        "full_name": full_name,
        "state": state,
        "status_label": "活躍中" if is_active else "最近紀錄",
        "energy": 1.0,
        "color": "#22c55e" if is_active else "#0ea5e9",
        "task": task,
        "tool_label": meta.get("source_label") or "工作階段",
        "tool_icon": "🧵" if is_active else "🗂️",
        "x": x,
        "y": y,
        "last_seen_ms": int(last_seen * 1000),
        "age_seconds": round(max(0.0, now_ts() - last_seen), 1),
        "is_stale": not is_active,
        "role": "branch_session",
        "role_label": "分支工作階段",
        "goal": task,
        "session_id": meta.get("session_id"),
        "event_count": session.get("message_count", 0),
        "recent_actions": [],
        "speech": None,
        "source": "hermes-sessions",
        **room_meta,
        "activity_hint": f"存放在 {room_meta['room_label']}：{trim_text(task, 40) or '工作階段紀錄'}",
    }


def build_ollama_model_agents(running_models: list[dict[str, Any]], models: list[dict[str, Any]], *, limit: int = 8) -> list[dict[str, Any]]:
    running_names = {item.get("name") or item.get("model") for item in running_models}
    by_name: dict[str, dict[str, Any]] = {}
    for item in models:
        name = item.get("name") or item.get("model")
        if name:
            by_name[name] = dict(item)
    for item in running_models:
        name = item.get("name") or item.get("model")
        if name:
            merged = dict(by_name.get(name, {}))
            merged.update(item)
            by_name[name] = merged

    ordered_names = [name for name in running_names if name]
    ordered_names.extend(name for name in by_name if name not in running_names)
    agents: list[dict[str, Any]] = []
    for index, name in enumerate(ordered_names[:limit]):
        item = by_name.get(name, {})
        is_running = name in running_names
        state = "working" if is_running else "idle"
        x, y = build_clone_position(index)
        task = "模型已載入記憶體" if is_running else "本機可用模型"
        details = item.get("details") or {}
        family = details.get("family") or details.get("format") or "Ollama"
        room_meta = classify_room(state, task, role="subagent")
        return_name = trim_text(name, 22) or f"Ollama model {index + 1}"
        agents.append(
            {
                "agent": f"ollama:{name}",
                "name": return_name,
                "full_name": name,
                "state": state,
                "status_label": "已載入" if is_running else "可用",
                "energy": 1.0,
                "color": "#111827" if is_running else "#64748b",
                "task": task,
                "tool_label": family,
                "tool_icon": "🧠",
                "x": x,
                "y": y,
                "last_seen_ms": int(now_ts() * 1000),
                "age_seconds": 0,
                "is_stale": not is_running,
                "role": "subagent",
                "role_label": "本機模型",
                "goal": task,
                "session_id": None,
                "event_count": 0,
                "recent_actions": [],
                "speech": None,
                "source": "ollama",
                **room_meta,
                "activity_hint": f"{name}｜{task}",
            }
        )
    return agents


def extract_subagent_events(subagents: dict[str, Any], *, limit: int = 10) -> list[dict[str, Any]]:
    events: list[dict[str, Any]] = []
    for child in iter_subagent_children(subagents):
        goal = child.get("goal")
        for event in child.get("events") or []:
            events.append(
                {
                    "time": _event_time_ms(event, child),
                    "kind": "hermes.subagent.event",
                    "payload": {
                        "agent": child.get("id"),
                        "goal": goal,
                        "event_type": event.get("event_type") or "event",
                        "tool_name": event.get("tool_name"),
                        "text": event.get("text"),
                    },
                }
            )
    events.sort(key=lambda item: item.get("time", 0), reverse=True)
    return events[:limit]


def _event_time_ms(event: dict[str, Any], child: dict[str, Any]) -> int:
    raw = event.get("at")
    if isinstance(raw, str):
        try:
            return int(time.mktime(time.strptime(raw[:19], "%Y-%m-%dT%H:%M:%S")) * 1000)
        except Exception:
            pass
    ts = event.get("ts") or child.get("last_event_ts") or child.get("updated_ts") or now_ts()
    return int(float(ts) * 1000)


def merge_agents(
    local_agents: list[dict[str, Any]],
    subagent_agents: list[dict[str, Any]],
    session_agents: list[dict[str, Any]],
    extra_agents: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    merged = list(local_agents)
    merged.extend(subagent_agents)
    merged.extend(session_agents)
    merged.extend(extra_agents or [])
    return merged


def merge_hermes_events(world_events: list[dict[str, Any]], hermes_events: list[dict[str, Any]], *, limit: int = 18) -> list[dict[str, Any]]:
    merged = [*world_events, *hermes_events]
    merged.sort(key=lambda item: item.get("time", 0), reverse=True)
    filtered: list[dict[str, Any]] = []
    heartbeat_count = 0
    for item in merged:
        if item.get("kind") == "heartbeat":
            heartbeat_count += 1
            state = (item.get("payload") or {}).get("state")
            task = (item.get("payload") or {}).get("task")
            if heartbeat_count > 2 and (state in {None, "idle"} and not task):
                continue
        filtered.append(item)
        if len(filtered) >= limit:
            break
    return filtered


def humanize_event(event: dict[str, Any]) -> dict[str, Any]:
    kind = event.get("kind", "event")
    payload = event.get("payload") or {}
    result = dict(event)

    if kind == "heartbeat":
        state = payload.get("state", "idle")
        task = humanize_task_summary(payload.get("task"))
        result.update({"icon": "💓", "title": "主代理心跳同步", "summary": f"狀態：{STATUS_LABELS.get(state, state)}｜{task}"})
        return result
    if kind == "action":
        action = payload.get("action") or {}
        msg = trim_text(action.get("message") or action.get("type") or "動作更新", 60)
        result.update({"icon": "💬", "title": "世界動作更新", "summary": msg or "動作更新"})
        return result
    if kind == "main.task.started":
        action = payload.get("action") or {}
        preview = trim_text(action.get("preview") or action.get("message"), 60) or "開始新任務"
        result.update({"icon": "🧠", "title": "主代理開始處理任務", "summary": preview})
        return result
    if kind == "main.reasoning":
        action = payload.get("action") or {}
        preview = trim_text(action.get("preview") or action.get("message"), 60) or "正在整理推理"
        result.update({"icon": "💭", "title": "主代理正在規劃", "summary": preview})
        return result
    if kind == "main.tool.batch":
        action = payload.get("action") or {}
        tools = [humanize_tool_name(name)["label"] for name in (action.get("tool_names") or []) if name]
        summary = "、".join(tools) if tools else trim_text(action.get("preview") or action.get("message"), 60) or "工具步驟"
        result.update({"icon": "🛤️", "title": "主代理切換到工具序列", "summary": summary})
        return result
    if kind == "main.tool.started":
        action = payload.get("action") or {}
        tool = humanize_tool_name(action.get("tool_name"))
        preview = trim_text(action.get("preview"), 42)
        summary = f"開始使用 {tool['label']}"
        if preview:
            summary = f"{summary}｜{preview}"
        result.update({"icon": tool["icon"], "title": "主代理工具啟動", "summary": summary})
        return result
    if kind == "main.tool.completed":
        action = payload.get("action") or {}
        tool = humanize_tool_name(action.get("tool_name"))
        preview = trim_text(action.get("preview"), 42)
        summary = f"完成 {tool['label']}"
        if preview:
            summary = f"{summary}｜{preview}"
        result.update({"icon": "✅", "title": "主代理工具完成", "summary": summary})
        return result
    if kind == "main.task.completed":
        action = payload.get("action") or {}
        preview = trim_text(action.get("preview"), 60) or "任務已完成，回到待命站"
        result.update({"icon": "🏁", "title": "主代理任務完成", "summary": preview})
        return result
    if kind == "hermes.status":
        gateway_state = payload.get("gateway_state", "unknown")
        active = payload.get("active_sessions", 0)
        result.update({"icon": "🛰️", "title": "Hermes 狀態同步", "summary": f"Gateway：{gateway_state}｜活躍 sessions：{active}"})
        return result
    if kind == "ollama.status":
        running = payload.get("running_count", 0)
        total = payload.get("model_count", 0)
        result.update({"icon": "🧠", "title": "Ollama 模型同步", "summary": f"已載入：{running}｜可用模型：{total}"})
        return result
    if kind == "hermes.subagent":
        tool = humanize_tool_name(payload.get("current_tool"))
        status = payload.get("status", "unknown")
        goal = trim_text(payload.get("goal"), 48) or payload.get("agent", "分身")
        result.update({"icon": tool["icon"], "title": "分身執行中" if normalize_state(status) == "working" else "分身狀態更新", "summary": f"{goal}｜{tool['label']}｜{SUBAGENT_STATUS_LABELS.get(status, status)}"})
        return result
    if kind == "hermes.subagent.event":
        event_type = payload.get("event_type") or "event"
        tool = humanize_tool_name(payload.get("tool_name"))
        goal = trim_text(payload.get("goal"), 36) or payload.get("agent", "分身")
        detail = trim_text(payload.get("text"), 54)
        title = EVENT_TYPE_LABELS.get(event_type, event_type)
        parts = [goal]
        if payload.get("tool_name"):
            parts.append(f"工具：{tool['label']}")
        if detail:
            parts.append(detail)
        elif event_type == "tool.completed":
            parts.append("這個步驟已完成")
        result.update({"icon": tool["icon"] if payload.get("tool_name") else "🧬", "title": title, "summary": "｜".join(parts)})
        return result
    if kind == "hermes.session":
        title = trim_text(payload.get("title"), 48) or payload.get("session_id", "session")
        active = "活躍中" if payload.get("active") else "最近紀錄"
        result.update({"icon": "🗂️", "title": "Hermes 工作階段", "summary": f"{title}｜{active}"})
        return result
    if kind == "webhook.registered":
        result.update({"icon": "🔗", "title": "Webhook 已註冊", "summary": trim_text(payload.get("url"), 60) or "已註冊"})
        return result
    if kind == "webhook.removed":
        result.update({"icon": "🧹", "title": "Webhook 已移除", "summary": payload.get("agent", "agent")})
        return result
    result.update({"icon": "✨", "title": kind, "summary": trim_text(json.dumps(payload, ensure_ascii=False), 60) or kind})
    return result


WORLD = WorldState()


class PixelverseHandler(BaseHTTPRequestHandler):
    def _read_json(self) -> dict[str, Any]:
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        return json.loads(raw.decode("utf-8"))

    def _send_json(self, data: dict[str, Any], status: int = 200) -> None:
        payload = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def _send_text(self, body: str, content_type: str = "text/html; charset=utf-8", status: int = 200) -> None:
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def _send_sse_headers(self) -> None:
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Connection", "keep-alive")
        self.end_headers()

    def _write_sse_event(self, event_name: str, event_id: int | None, payload: dict[str, Any]) -> None:
        lines = []
        if event_name:
            lines.append(f"event: {event_name}")
        if event_id is not None:
            lines.append(f"id: {event_id}")
        for line in json.dumps(payload, ensure_ascii=False).splitlines() or ["{}"]:
            lines.append(f"data: {line}")
        lines.append("")
        body = "\n".join(lines).encode("utf-8")
        self.wfile.write(body)
        self.wfile.flush()

    def _send_file(self, path: Path) -> None:
        if not path.exists() or not path.is_file():
            self._send_json({"error": "not found", "path": str(path)}, status=404)
            return
        content_type, _ = mimetypes.guess_type(path.name)
        if path.suffix in {".mjs", ".js"}:
            content_type = "application/javascript; charset=utf-8"
        elif path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif path.suffix == ".svg":
            content_type = "image/svg+xml"
        elif path.suffix == ".json":
            content_type = "application/json; charset=utf-8"
        payload = path.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self._send_text(INDEX_HTML.read_text())
            return
        if parsed.path.startswith("/") and "." in parsed.path.rsplit("/", 1)[-1]:
            requested = (PUBLIC_DIR / parsed.path.lstrip("/")).resolve()
            if PUBLIC_DIR in requested.parents or requested == PUBLIC_DIR:
                self._send_file(requested)
                return
        if parsed.path == "/health":
            self._send_json({"ok": True, "service": "pixelverse-server", "port": PORT})
            return
        if parsed.path == "/api/world":
            self._send_json(WORLD.public_snapshot())
            return
        if parsed.path == "/api/world/stream":
            qs = parse_qs(parsed.query)
            try:
                last_seq = int(qs.get("since", ["0"])[0])
            except ValueError:
                last_seq = 0
            try:
                self._send_sse_headers()
                initial = WORLD.build_stream_event(last_seq)
                self._write_sse_event(initial["event"], initial["id"], initial)
                last_seq = initial["id"]
                while True:
                    next_seq = WORLD.wait_for_event(last_seq, timeout=15.0)
                    if next_seq > last_seq:
                        update = WORLD.build_stream_event(last_seq)
                        self._write_sse_event(update["event"], update["id"], update)
                        last_seq = update["id"]
                    else:
                        self.wfile.write(b": keepalive\n\n")
                        self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError, TimeoutError):
                return
            except Exception:
                return
            return
        if parsed.path == "/api/agents":
            self._send_json({"agents": WORLD.public_snapshot()["agents"]})
            return
        if parsed.path == "/api/inbox":
            qs = parse_qs(parsed.query)
            agent_id = qs.get("agent", [""])[0]
            peek = qs.get("peek", ["false"])[0].lower() == "true"
            self._send_json({"messages": WORLD.get_inbox(agent_id, peek=peek)})
            return
        self._send_json({"error": "not found", "path": parsed.path}, status=404)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        try:
            data = self._read_json()
        except Exception as exc:
            self._send_json({"error": f"invalid json: {exc}"}, status=400)
            return
        if parsed.path == "/api/heartbeat":
            agent = WORLD.upsert_agent(data)
            self._send_json({"ok": True, "agent": agent.to_public()})
            return
        if parsed.path == "/api/act":
            WORLD.act(data.get("agent", "unknown"), data.get("action", {}))
            self._send_json({"ok": True})
            return
        if parsed.path == "/api/webhook":
            WORLD.register_webhook(data.get("agent", "unknown"), data.get("url", ""))
            self._send_json({"ok": True})
            return
        self._send_json({"error": "not found", "path": parsed.path}, status=404)

    def do_DELETE(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/webhook":
            qs = parse_qs(parsed.query)
            WORLD.unregister_webhook(qs.get("agent", [""])[0])
            self._send_json({"ok": True})
            return
        self._send_json({"error": "not found", "path": parsed.path}, status=404)

    def log_message(self, format: str, *args: Any) -> None:
        return


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), PixelverseHandler)
    print(f"Hermes Pixelverse listening on http://{HOST}:{PORT}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("Shutting down Pixelverse server...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()

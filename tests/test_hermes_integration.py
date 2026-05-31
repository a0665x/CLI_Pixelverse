from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from pixelverse_server import (
    WorldState,
    build_ollama_model_agents,
    build_session_agent,
    build_subagent_agent,
    classify_room,
    extract_subagent_events,
    humanize_event,
    humanize_task_summary,
    humanize_tool_name,
    infer_state_from_text,
    infer_pixel_state,
    merge_hermes_events,
)


def test_humanize_tool_name_maps_known_tools():
    data = humanize_tool_name("search_files")
    assert data["label"] == "搜尋檔案"
    assert data["icon"] == "🔎"


def test_humanize_task_summary_maps_tool_lists():
    assert humanize_task_summary("search_files, read_file, patch") == "搜尋檔案、讀取檔案、修改檔案"


def test_humanize_event_prefers_human_readable_tool_copy():
    event = humanize_event({
        "kind": "hermes.subagent",
        "payload": {
            "agent": "child-1",
            "status": "running",
            "goal": "掃描 Hermes codebase",
            "current_tool": "read_file",
        },
        "time": 1710000000000,
    })
    assert event["title"] == "分身執行中"
    assert "讀取檔案" in event["summary"]


def test_build_subagent_agent_uses_clone_role_and_goal_summary():
    child = {
        "id": "child-1",
        "status": "running",
        "goal": "connect hermes sessions api",
        "current_tool": "delegate_task",
        "session_id": "session-123",
        "event_count": 4,
    }
    agent = build_subagent_agent(child, index=1)
    assert agent["role"] == "subagent"
    assert agent["state"] == "working"
    assert agent["task"] == "派出分身"
    assert agent["goal"] == "connect hermes sessions api"
    assert agent["agent"].startswith("subagent:")


def test_build_session_agent_creates_branch_session_avatar():
    session = {
        "id": "api-123",
        "source": "api_server",
        "preview": "Reviewing Pixelverse branch session activity",
        "last_active": 1710000000,
        "started_at": 1709999900,
        "is_active": True,
        "message_count": 6,
    }
    agent = build_session_agent(session, index=0)
    assert agent["role"] == "branch_session"
    assert agent["state"] == "working"
    assert agent["tool_label"] == "API 工作階段"
    assert agent["agent"].startswith("session:")


def test_build_ollama_model_agents_marks_running_models():
    agents = build_ollama_model_agents(
        running_models=[{"name": "llama3.2:latest", "details": {"family": "llama"}}],
        models=[
            {"name": "llama3.2:latest", "details": {"family": "llama"}},
            {"name": "qwen2.5-coder:latest", "details": {"family": "qwen2"}},
        ],
    )
    assert agents[0]["agent"] == "ollama:llama3.2:latest"
    assert agents[0]["state"] == "working"
    assert agents[0]["status_label"] == "已載入"
    assert any(agent["agent"] == "ollama:qwen2.5-coder:latest" for agent in agents)


def test_extract_subagent_events_and_humanize_tool_started_event():
    subagents = {
        "runs": [
            {
                "children": [
                    {
                        "id": "child-9",
                        "goal": "scan project files",
                        "status": "running",
                        "updated_ts": 1710000001,
                        "events": [
                            {
                                "at": "2024-03-09T16:00:00+00:00",
                                "event_type": "tool.started",
                                "tool_name": "search_files",
                                "text": "*.py",
                            }
                        ],
                    }
                ]
            }
        ]
    }
    events = extract_subagent_events(subagents, limit=5)
    assert len(events) == 1
    humanized = humanize_event(events[0])
    assert humanized["title"] == "工具開始執行"
    assert "搜尋檔案" in humanized["summary"]


def test_merge_hermes_events_sorts_newest_first_and_limits():
    merged = merge_hermes_events(
        world_events=[{"time": 10, "kind": "heartbeat", "payload": {"agent": "main"}}],
        hermes_events=[
            {"time": 30, "kind": "hermes.subagent", "payload": {"agent": "child-2", "status": "completed"}},
            {"time": 20, "kind": "hermes.status", "payload": {"gateway_state": "running"}},
        ],
        limit=2,
    )
    assert [item["time"] for item in merged] == [30, 20]


def test_classify_room_routes_thinking_and_planning_states():
    assert classify_room("thinking", "drafting response")["room_key"] == "think_lab"
    assert classify_room("planning", "draft spec")["room_key"] == "blueprint_lab"
    assert classify_room("idle", "search_files, read_file")["room_key"] == "standby_dock"
    assert classify_room("working", "search_files, read_file")["room_key"] == "blueprint_lab"
    assert classify_room("working", "patch")["room_key"] == "tool_forge"
    assert classify_room("working", "read_file, patch, write_file")["room_key"] == "tool_forge"
    assert classify_room("working", "delegate_task")["room_key"] == "clone_bay"
    assert classify_room("working", "session_search, history")["room_key"] == "session_archive"


def test_build_subagent_agent_and_session_agent_include_room_metadata():
    child = {"id": "child-1", "status": "running", "goal": "scan project files", "current_tool": "read_file"}
    subagent = build_subagent_agent(child, index=0)
    assert subagent["room_key"] == "clone_bay"
    assert "分身工位區" in subagent["activity_hint"]

    session = {
        "id": "api-123",
        "source": "api_server",
        "preview": "Reviewing Pixelverse branch session activity",
        "last_active": 1710000000,
        "started_at": 1709999900,
        "is_active": True,
        "message_count": 6,
    }
    branch = build_session_agent(session, index=0)
    assert branch["room_key"] == "session_archive"
    assert "工作階段檔案庫" in branch["activity_hint"]


def test_infer_state_from_text_detects_planning_and_idle():
    assert infer_state_from_text("正在規劃 Pixelverse 任務") == "planning"
    assert infer_state_from_text("任務已完成，回到待命站") == "idle"

def test_pixel_state_mapping_preserves_fine_grained_ui_meaning():
    assert infer_pixel_state("tool_call", "read_file") == "tool_call"
    assert infer_pixel_state("working", "delegate_task to subagent") == "collaborating"
    assert infer_pixel_state("working", "repair traceback") == "self_healing"
    assert classify_room("blocked", "API exception")["room_key"] == "offline_corner"
    assert classify_room("self_healing", "repair traceback")["room_key"] == "tool_forge"

def test_world_state_exposes_instance_pid_and_pixel_state():
    world = WorldState()
    world.upsert_agent({"agent": "codex-cli:42", "state": "executing", "task": "patch", "process_id": 42})
    agent = world.snapshot_local_agents()[0]
    assert agent["pixel_state"] == "executing"
    assert agent["process_id"] == 42
    assert agent["instance_label"] == "PID 42"


def test_world_state_actions_drive_main_agent_state_and_task():
    world = WorldState()
    world.upsert_agent({"agent": "henry-main", "name": "Henry", "state": "idle", "task": None})
    world.act("henry-main", {"type": "thought", "message": "正在規劃：拆解需求與搜尋規格", "event_name": "main.reasoning", "state": "planning", "preview": "拆解需求與搜尋規格"})
    world.act("henry-main", {"type": "tool", "message": "工具步驟：search_files, read_file", "event_name": "main.tool.started", "tool_name": "search_files", "tool_phase": "started", "state": "working"})
    agent = world.snapshot_local_agents()[0]
    assert agent["state"] in {"planning", "working"}
    assert agent["task"] is not None
    assert agent["tool_label"] in {"搜尋檔案", "搜尋檔案、讀取檔案"}

    world.act("henry-main", {"type": "status", "message": "任務已完成，回到待命站", "event_name": "main.task.completed", "state": "idle"})
    agent = world.snapshot_local_agents()[0]
    assert agent["state"] == "idle"
    assert agent["task"] is None
    assert agent["room_key"] == "standby_dock"


def test_world_state_stream_event_uses_monotonic_ids_and_latest_snapshot():
    world = WorldState()
    starting_seq = world.current_event_seq()

    world.upsert_agent({"agent": "henry-main", "name": "Henry", "state": "planning", "task": "search_files"})
    world.act("henry-main", {"type": "tool", "message": "開始使用 patch", "event_name": "main.tool.started", "tool_name": "patch", "tool_phase": "started", "preview": "update floorplan"})

    assert world.current_event_seq() > starting_seq
    event = world.build_stream_event(since_seq=starting_seq)

    assert event["event"] == "world.update"
    assert event["id"] == world.current_event_seq()
    assert event["snapshot"]["agents"][0]["agent"] == "henry-main"
    assert event["snapshot"]["agents"][0]["task"] is not None
    assert any(item["kind"] in {"main.tool.started", "heartbeat"} for item in event["snapshot"]["events"])


def test_world_state_holds_recent_active_event_before_returning_idle(monkeypatch):
    import pixelverse_server

    current_time = [1000.0]
    monkeypatch.setattr(pixelverse_server, "now_ts", lambda: current_time[0])

    world = pixelverse_server.WorldState()
    world.upsert_agent({"agent": "henry-main", "name": "Henry", "state": "idle", "task": None})
    current_time[0] = 1001.0
    world.act("henry-main", {"type": "tool", "message": "工具步驟：patch", "event_name": "main.tool.started", "tool_name": "patch", "tool_phase": "started", "state": "working", "target_room": "tool_forge"})
    current_time[0] = 1002.0
    world.upsert_agent({"agent": "henry-main", "name": "Henry", "state": "idle", "task": None})

    active = world.snapshot_local_agents()[0]
    assert active["state"] == "working"
    assert active["room_key"] == "tool_forge"
    assert active["task"] == "修改檔案"

    current_time[0] = 1012.0
    cooled = world.snapshot_local_agents()[0]
    assert cooled["state"] == "idle"
    assert cooled["room_key"] == "standby_dock"


def test_liveness_heartbeat_does_not_replace_latest_lifecycle_phase():
    world = WorldState()
    world.upsert_agent({"agent": "codex-main", "state": "working", "task": "CLI session running", "target_room": "response_studio"})
    world.act("codex-main", {
        "type": "tool",
        "message": "修改檔案",
        "event_name": "agent.tool.completed",
        "tool_name": "patch",
        "tool_phase": "completed",
        "state": "working",
        "target_room": "tool_forge",
    })
    world.upsert_agent({
        "agent": "codex-main",
        "state": "working",
        "task": "CLI session running",
        "target_room": "response_studio",
        "preserve_phase": True,
    })

    active = world.snapshot_local_agents()[0]
    assert active["state"] == "working"
    assert active["room_key"] == "tool_forge"
    assert active["task"] == "修改檔案 已完成"


def test_unattached_source_placeholder_waits_for_cli_instead_of_showing_offline(monkeypatch):
    import pixelverse_server

    current_time = [1000.0]
    monkeypatch.setattr(pixelverse_server, "now_ts", lambda: current_time[0])

    world = pixelverse_server.WorldState()
    world.upsert_agent({
        "agent": "codex-main",
        "name": "codex",
        "state": "idle",
        "task": "codex ready",
        "source_placeholder": True,
    })
    current_time[0] = 1100.0

    waiting = world.snapshot_local_agents()[0]
    assert waiting["state"] == "idle"
    assert waiting["room_key"] == "standby_dock"
    assert waiting["connection_status"] == "awaiting_attach"
    assert waiting["is_stale"] is True
    assert "等待新的 CLI session" in waiting["activity_hint"]


def test_attached_cli_that_stops_heartbeats_still_becomes_offline(monkeypatch):
    import pixelverse_server

    current_time = [1000.0]
    monkeypatch.setattr(pixelverse_server, "now_ts", lambda: current_time[0])

    world = pixelverse_server.WorldState()
    world.upsert_agent({"agent": "codex-main", "name": "Codex CLI", "state": "working", "source_placeholder": False})
    current_time[0] = 1100.0

    stale = world.snapshot_local_agents()[0]
    assert stale["state"] == "offline"
    assert stale["room_key"] == "offline_corner"
    assert stale["connection_status"] == "stale"


def test_furniture_layout_overlap_validation_rejects_colliding_positions():
    from pixelverse_server import furniture_layout_has_overlaps, normalize_furniture_layout

    overlapping = normalize_furniture_layout({"tool_forge": [{"x": 40, "y": 40}, {"x": 42, "y": 41}]})
    spaced = normalize_furniture_layout({"tool_forge": [{"x": 40, "y": 40}, {"x": 55, "y": 41}]})

    assert furniture_layout_has_overlaps(overlapping) is True
    assert furniture_layout_has_overlaps(spaced) is False


def test_humanize_event_supports_main_tool_lifecycle():
    event = humanize_event({
        "kind": "main.tool.started",
        "payload": {"action": {"tool_name": "patch", "preview": "update home floorplan"}},
        "time": 1710000000000,
    })
    done = humanize_event({
        "kind": "main.tool.completed",
        "payload": {"action": {"tool_name": "patch"}},
        "time": 1710000001000,
    })
    assert event["title"] == "主代理工具啟動"
    assert "修改檔案" in event["summary"]
    assert done["title"] == "主代理工具完成"

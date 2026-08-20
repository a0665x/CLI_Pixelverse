from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RENDERER = ROOT / "scripts" / "render_local_ui_trajectory.py"
RUN_SH = ROOT / "run.sh"


def load_renderer():
    spec = importlib.util.spec_from_file_location("render_local_ui_trajectory", RENDERER)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def valid_clone_debug_artifact() -> dict:
    def agent(agent_id, rooms, points, event_ids):
        start, work, returned = points
        return {
            "agent": agent_id,
            "rooms": {"start": rooms[0], "work": rooms[1], "return": rooms[2]},
            "points": {"start": start, "work": work, "return": returned},
            "outbound_route": [start, {"x": start["x"] + 2, "y": start["y"] + 3}, work],
            "return_route": [work, {"x": returned["x"] - 1, "y": returned["y"] - 2}, returned],
            "route_evidence": {
                "outbound": {
                    "event_id": event_ids[0],
                    "from_room": rooms[0],
                    "to_room": rooms[1],
                    "from_position": start,
                    "to_position": work,
                    "position_changed": True,
                },
                "return": {
                    "event_id": event_ids[1],
                    "from_room": rooms[1],
                    "to_room": rooms[2],
                    "from_position": work,
                    "to_position": returned,
                    "position_changed": True,
                },
            },
        }

    return {
        "latest": {"minimum_event_id": 10},
        "agents": [
            agent(
                "henry-main",
                ("think_lab", "clone_bay", "standby_dock"),
                ({"x": 19, "y": 20}, {"x": 80, "y": 20}, {"x": 16, "y": 82}),
                (11, 17),
            ),
            agent(
                "synthetic-subagent-1",
                ("clone_bay", "tool_forge", "clone_bay"),
                ({"x": 66, "y": 18}, {"x": 64, "y": 82}, {"x": 66, "y": 18}),
                (13, 16),
            ),
        ]
    }


def test_clone_hook_evidence_requires_two_agents_routes_and_positive_displacement():
    renderer = load_renderer()
    validator = getattr(renderer, "validate_hook_evidence", None)
    assert callable(validator)

    failures = validator(valid_clone_debug_artifact(), "clone_bay")

    assert failures == []


def test_clone_hook_evidence_rejects_text_or_room_label_only_changes():
    renderer = load_renderer()
    validator = getattr(renderer, "validate_hook_evidence", None)
    assert callable(validator)
    debug = valid_clone_debug_artifact()
    child = debug["agents"][1]
    child["points"]["work"] = dict(child["points"]["start"])
    child["outbound_route"] = [dict(child["points"]["start"])]
    child["route_evidence"]["outbound"]["to_position"] = dict(
        child["route_evidence"]["outbound"]["from_position"]
    )

    failures = validator(debug, "clone_bay")

    assert any("positive coordinate displacement" in failure for failure in failures)
    assert any("route points" in failure for failure in failures)
    assert any("runtime coordinate displacement" in failure for failure in failures)


def test_clone_hook_evidence_rejects_matching_routes_from_an_older_run():
    renderer = load_renderer()
    debug = valid_clone_debug_artifact()
    debug["latest"]["minimum_event_id"] = 18

    failures = renderer.validate_hook_evidence(debug, "clone_bay")

    assert any("current test-hook run" in failure for failure in failures)


def test_run_sh_test_hook_enforces_renderer_evidence_acceptance():
    run_sh = RUN_SH.read_text(encoding="utf-8")

    assert '--require-hook-evidence "$target_room"' in run_sh
    assert "Hook movement evidence accepted" in run_sh


def test_run_sh_test_hook_fails_when_runtime_events_cannot_be_delivered():
    run_sh = RUN_SH.read_text(encoding="utf-8")

    assert "Unable to deliver synthetic hook start event" in run_sh
    failure_block = run_sh.split("Unable to deliver synthetic hook start event", 1)[1].split("fi", 1)[0]
    assert "return 1" in failure_block
    post_json = run_sh.split("post_json() {", 1)[1].split("test_hook() {", 1)[0]
    assert "--connect-timeout" in post_json
    assert "--max-time" in post_json
    assert '"minimum_event_id"' in run_sh

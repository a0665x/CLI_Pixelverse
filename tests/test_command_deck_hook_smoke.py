from __future__ import annotations

import importlib.util
import json
import os
import shutil
import subprocess
import sys
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RENDERER = ROOT / "scripts" / "render_local_ui_trajectory.py"
RUN_SH = ROOT / "run.sh"


def prepare_async_hook_fixture(tmp_path: Path, *, never_deliver: bool = False) -> tuple[Path, dict[str, str], Path]:
    fixture_root = tmp_path / "fixture"
    fixture_root.mkdir()
    (fixture_root / "scripts").mkdir()
    (fixture_root / "tmp").mkdir()
    shutil.copy2(RUN_SH, fixture_root / "run.sh")
    shutil.copy2(RENDERER, fixture_root / "scripts" / RENDERER.name)
    (fixture_root / "public").symlink_to(ROOT / "public", target_is_directory=True)

    state_dir = fixture_root / "state"
    state_dir.mkdir()
    (state_dir / "compose.env").write_text(
        "PIXELVERSE_PORT=5999\nPIXELVERSE_BRIDGE_PORT=4999\n",
        encoding="utf-8",
    )
    relay_state = fixture_root / "relay-state.json"
    relay_state.write_text("{}\n", encoding="utf-8")
    fake_bin = fixture_root / "bin"
    fake_bin.mkdir()
    fake_curl = fake_bin / "curl"
    fake_curl.write_text(
        textwrap.dedent(
            """\
            #!/usr/bin/env python3
            import json
            import os
            import sys

            state_path = os.environ["FAKE_RELAY_STATE"]
            try:
                state = json.load(open(state_path, encoding="utf-8"))
            except (FileNotFoundError, json.JSONDecodeError):
                state = {}
            args = sys.argv[1:]
            url = next((item for item in args if item.startswith("http://") or item.startswith("https://")), "")

            def evidence(event_id, agent, from_room, to_room, start, end):
                return {
                    "id": event_id,
                    "kind": "heartbeat",
                    "payload": {
                        "agent": agent,
                        "route_evidence": {
                            "event_id": event_id,
                            "from_room": from_room,
                            "to_room": to_room,
                            "from_position": {"x": start[0], "y": start[1]},
                            "to_position": {"x": end[0], "y": end[1]},
                            "position_changed": True,
                        },
                    },
                }

            if url.endswith("/api/world"):
                if not state.get("final_posted"):
                    snapshot = {"events": [{"id": 10, "kind": "heartbeat", "payload": {"agent": "baseline"}}]}
                else:
                    state["snapshot_polls"] = int(state.get("snapshot_polls", 0)) + 1
                    events = [
                        evidence(11, "henry-main", "think_lab", "clone_bay", (19, 20), (80, 20)),
                        evidence(13, "synthetic-subagent-1", "clone_bay", "tool_forge", (66, 18), (64, 82)),
                        evidence(16, "synthetic-subagent-1", "tool_forge", "clone_bay", (64, 82), (66, 18)),
                    ]
                    if not os.environ.get("FAKE_RELAY_NEVER") and state["snapshot_polls"] >= 3:
                        events.append(evidence(17, "henry-main", "clone_bay", "standby_dock", (80, 20), (16, 82)))
                    snapshot = {"events": events, "agents": []}
                print(json.dumps(snapshot))
            else:
                payload = args[args.index("-d") + 1] if "-d" in args else ""
                if url.endswith("/hook") and '"agent:end"' in payload:
                    state["final_posted"] = True

            with open(state_path, "w", encoding="utf-8") as handle:
                json.dump(state, handle)
            """
        ),
        encoding="utf-8",
    )
    fake_curl.chmod(0o755)

    env = os.environ.copy()
    env.update({
        "PATH": f"{fake_bin}:{env['PATH']}",
        "PIXELVERSE_STATE_DIR": str(state_dir),
        "PIXELVERSE_TEST_HOOK_TARGET": "clone_bay",
        "PIXELVERSE_TEST_HOOK_DELAY": "0",
        "PIXELVERSE_TEST_HOOK_EVIDENCE_TIMEOUT": "1",
        "PIXELVERSE_TEST_HOOK_EVIDENCE_INTERVAL": "0.02",
        "PIXELVERSE_TEST_HOOK_CONNECT_TIMEOUT": "1",
        "PIXELVERSE_TEST_HOOK_MAX_TIME": "1",
        "FAKE_RELAY_STATE": str(relay_state),
    })
    if never_deliver:
        env["FAKE_RELAY_NEVER"] = "1"
    return fixture_root, env, relay_state


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


def test_run_sh_test_hook_loads_saved_bridge_port_like_saved_ui_port():
    run_sh = RUN_SH.read_text(encoding="utf-8")

    assert 'SAVED_BRIDGE_PORT=""' in run_sh
    assert "SAVED_BRIDGE_PORT=\"$(sed -n 's/^PIXELVERSE_BRIDGE_PORT=//p' \"$ENV_FILE\" | tail -n 1)\"" in run_sh
    assert 'BRIDGE_PORT="${PIXELVERSE_BRIDGE_PORT:-${SAVED_BRIDGE_PORT:-4567}}"' in run_sh


def test_run_sh_waits_for_delayed_async_main_return_evidence(tmp_path):
    fixture_root, env, relay_state = prepare_async_hook_fixture(tmp_path)

    result = subprocess.run(
        [str(fixture_root / "run.sh"), "test-hook"],
        cwd=fixture_root,
        env=env,
        text=True,
        capture_output=True,
        timeout=10,
        check=False,
    )

    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(relay_state.read_text(encoding="utf-8"))["snapshot_polls"] >= 3
    assert "Hook movement evidence accepted for clone_bay" in result.stdout


def test_run_sh_async_main_return_wait_is_bounded_and_clear(tmp_path):
    fixture_root, env, relay_state = prepare_async_hook_fixture(tmp_path, never_deliver=True)

    result = subprocess.run(
        [str(fixture_root / "run.sh"), "test-hook"],
        cwd=fixture_root,
        env=env,
        text=True,
        capture_output=True,
        timeout=5,
        check=False,
    )

    assert result.returncode != 0
    assert "Timed out waiting for current main-agent route evidence: clone_bay -> standby_dock" in result.stderr
    assert json.loads(relay_state.read_text(encoding="utf-8"))["snapshot_polls"] > 1

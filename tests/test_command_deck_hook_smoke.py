from __future__ import annotations

import json
import os
import shutil
import subprocess
import textwrap
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RUN_SH = ROOT / "run.sh"


def prepare_async_hook_fixture(tmp_path: Path, *, never_deliver: bool = False) -> tuple[Path, dict[str, str], Path]:
    fixture_root = tmp_path / "fixture"
    fixture_root.mkdir()
    (fixture_root / "tmp").mkdir()
    shutil.copy2(RUN_SH, fixture_root / "run.sh")

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


def test_run_sh_test_hook_enforces_snapshot_evidence_without_legacy_renderer():
    run_sh = RUN_SH.read_text(encoding="utf-8")

    assert "render_latest_trajectory" not in run_sh
    assert "render_local_ui_trajectory" not in run_sh
    assert "local_ui_trajectory" not in run_sh
    assert "global_map_walkability_mask" not in run_sh
    assert "pixelverse_debug_log" not in run_sh
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
    assert "Hook movement evidence accepted: clone_bay route and coordinate checks passed." in result.stdout


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

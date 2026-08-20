from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "furniture_drag_browser_smoke.py"
RUN_SH = ROOT / "run.sh"


def load_module():
    spec = importlib.util.spec_from_file_location("furniture_drag_browser_smoke", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_browser_smoke_script_defines_repeatable_cross_room_drag_plan():
    smoke = load_module()

    plan = smoke.DragPlan()

    assert plan.base_url == "http://127.0.0.1:5660"
    assert plan.source_room == "file_library"
    assert plan.target_room == "response_studio"
    assert plan.target_x_pct > 90
    assert plan.target_y_pct > 90
    assert plan.artifact.name == "furniture_drag_browser_smoke.json"
    assert plan.screenshot.name == "furniture_drag_browser_smoke.png"

    source = SCRIPT.read_text(encoding="utf-8")
    assert 'wait_until="domcontentloaded"' in source
    assert "networkidle" not in source


def test_browser_smoke_result_requires_cross_room_move_and_visible_overflow():
    smoke = load_module()

    result = smoke.SmokeResult(
        ok=True,
        source_room="file_library",
        target_room="response_studio",
        before_room="file_library",
        after_room="response_studio",
        parent_room="response_studio",
        ghost_seen=True,
        save_enabled=True,
        visually_outside_target_district=True,
        clipping_ancestor=None,
        district_overflow="visible",
        props_overflow="visible",
        props_pointer_events="none",
        prop_pointer_events="auto",
        console_errors=[],
        screenshot="tmp/furniture_drag_browser_smoke.png",
    )

    failures = smoke.evaluate_result(result)

    assert failures == []


def test_browser_smoke_result_fails_when_drop_is_clipped_or_does_not_cross_room():
    smoke = load_module()

    result = smoke.SmokeResult(
        ok=False,
        source_room="file_library",
        target_room="response_studio",
        before_room="file_library",
        after_room="file_library",
        parent_room="file_library",
        ghost_seen=False,
        save_enabled=False,
        visually_outside_target_district=False,
        clipping_ancestor="district",
        district_overflow="hidden",
        props_overflow="hidden",
        props_pointer_events="auto",
        prop_pointer_events="auto",
        console_errors=["TypeError: boom"],
        screenshot="",
    )

    failures = smoke.evaluate_result(result)

    assert any("did not cross rooms" in failure for failure in failures)
    assert any("clipping ancestor" in failure for failure in failures)
    assert any("ghost" in failure for failure in failures)
    assert any("console" in failure for failure in failures)


def test_run_sh_exposes_furniture_drag_smoke_command():
    run_sh = RUN_SH.read_text(encoding="utf-8")

    assert "smoke-furniture-drag" in run_sh
    assert "furniture_drag_browser_smoke.py" in run_sh

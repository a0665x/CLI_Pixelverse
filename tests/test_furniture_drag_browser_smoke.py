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


def test_browser_smoke_script_targets_the_current_second_layer_interior():
    smoke = load_module()
    plan = smoke.InteriorSmokePlan()
    assert plan.base_url == "http://127.0.0.1:5660"
    assert plan.building_id == "maker-workshop"
    assert plan.artifact.name == "furniture_drag_browser_smoke.json"
    assert plan.screenshot.name == "furniture_drag_browser_smoke.png"
    source = SCRIPT.read_text(encoding="utf-8")
    assert 'wait_until="domcontentloaded"' in source
    assert "pixelverse.command.focus" in source
    assert ".cutaway-dom-panel" in source
    assert ".district[data-room]" not in source
    assert "networkidle" not in source


def test_browser_smoke_result_requires_visible_cutaway_and_assets():
    smoke = load_module()
    result = smoke.InteriorSmokeResult(
        ok=True, building_id="maker-workshop", iframe_visible=True,
        cutaway_visible=True, cutaway_title="Maker Workshop",
        canvas_width=1280, canvas_height=720, edit_control_visible=True,
        edit_mode_visible=True, legacy_map_present=False,
        console_errors=[], screenshot="tmp/furniture_drag_browser_smoke.png",
        essential_asset_statuses={
            "/assets/private/modern-office-v1.2/Modern_Office_Singles_200.png": 200,
            "/assets/private/modern-office-v1.2/collision-masks.json": 200,
        },
    )
    assert smoke.evaluate_result(result) == []


def test_browser_smoke_result_reports_interior_and_asset_failures():
    smoke = load_module()
    result = smoke.InteriorSmokeResult(
        ok=False, building_id="maker-workshop", iframe_visible=False,
        cutaway_visible=False, cutaway_title="", canvas_width=0, canvas_height=0,
        edit_control_visible=False, edit_mode_visible=False, legacy_map_present=True,
        console_errors=["TypeError: boom"], screenshot="",
        essential_asset_statuses={
            "/assets/private/modern-office-v1.2/Modern_Office_Singles_200.png": 404,
            "/assets/private/modern-office-v1.2/collision-masks.json": 200,
        },
    )
    failures = smoke.evaluate_result(result)
    assert any("iframe" in failure for failure in failures)
    assert any("cutaway" in failure for failure in failures)
    assert any("canvas" in failure for failure in failures)
    assert any("console" in failure for failure in failures)
    assert any("essential asset" in failure for failure in failures)
    assert any("edit mode" in failure for failure in failures)
    assert any("legacy map" in failure for failure in failures)


def test_browser_smoke_declares_the_render_and_collision_assets_as_essential():
    smoke = load_module()
    assert smoke.ESSENTIAL_ASSET_PATHS == (
        "/assets/private/modern-office-v1.2/Modern_Office_Singles_200.png",
        "/assets/private/modern-office-v1.2/collision-masks.json",
    )


def test_run_sh_exposes_furniture_smoke_command():
    run_sh = RUN_SH.read_text(encoding="utf-8")
    assert "smoke-furniture-drag" in run_sh
    assert "furniture_drag_browser_smoke.py" in run_sh

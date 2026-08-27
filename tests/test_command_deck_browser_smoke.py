from __future__ import annotations

import importlib.util
import ast
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "command_deck_browser_smoke.py"


def load_module():
    spec = importlib.util.spec_from_file_location("command_deck_browser_smoke", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def passing_artifact() -> dict:
    viewports = [
        {
            "name": "desktop-large",
            "width": 1440,
            "height": 900,
            "mode": "desktop",
            "layout_bounds": {"world": [0, 156, 1440, 744], "roster": [0, 44, 1440, 112], "overlaps": []},
            "roster_visible": True,
            "village_visible": True,
            "village_larger_than_roster": True,
            "pass": True,
        },
        {
            "name": "desktop-compact",
            "width": 1024,
            "height": 768,
            "mode": "desktop",
            "layout_bounds": {"world": [0, 156, 1024, 612], "roster": [0, 44, 1024, 112], "overlaps": []},
            "roster_visible": True,
            "village_visible": True,
            "village_larger_than_roster": True,
            "pass": True,
        },
        {
            "name": "narrow",
            "width": 800,
            "height": 450,
            "mode": "narrow",
            "layout_bounds": {"world": [0, 140, 800, 310], "roster": [0, 44, 800, 96], "overlaps": []},
            "roster_visible": True,
            "village_visible": True,
            "village_larger_than_roster": True,
            "pass": True,
        },
    ]
    expected_languages = {"en-US": "en", "zh-TW": "zh-Hant", "ja-JP": "ja", "ko-KR": "ko"}
    expected_help = {"en-US": "Help", "zh-TW": "說明", "ja-JP": "ヘルプ", "ko-KR": "도움말"}
    expected_help_aria = {
        "en-US": "Open Panels: Help",
        "zh-TW": "開啟側欄: 說明",
        "ja-JP": "パネル表示: ヘルプ",
        "ko-KR": "패널 열기: 도움말",
    }
    expected_shell = {
        "en-US": {"agents_title": "Agent roster", "timeline_title": "Mission trace", "language_label": "Language"},
        "zh-TW": {"agents_title": "代理人物列", "timeline_title": "任務軌跡", "language_label": "語言"},
        "ja-JP": {"agents_title": "エージェント一覧", "timeline_title": "ミッション軌跡", "language_label": "言語"},
        "ko-KR": {"agents_title": "에이전트 목록", "timeline_title": "미션 추적", "language_label": "언어"},
    }
    expected_village = {
        "en-US": {"rest_cabin": "Rest Cabin", "maker_workshop": "Maker Workshop"},
        "zh-TW": {"rest_cabin": "休息小屋", "maker_workshop": "編輯工坊"},
        "ja-JP": {"rest_cabin": "休憩小屋", "maker_workshop": "編集工房"},
        "ko-KR": {"rest_cabin": "휴식 오두막", "maker_workshop": "편집 공방"},
    }
    locale_checks = {
        locale: {
            "shell_text": f"shell-{locale}",
            "village_text": f"village-{locale}",
            "help_copy": {
                "aria_label": expected_help_aria[locale],
                "tooltip": expected_help[locale],
                "title": expected_help[locale],
            },
            "shell_copy": expected_shell[locale],
            "village_copy": expected_village[locale],
            "document_lang": expected_languages[locale],
            "copy_signature": f"copy-{locale}",
            "shell_signature": f"shell-signature-{locale}",
            "village_signature": f"village-signature-{locale}",
            "help_signature": f"help-signature-{locale}",
            "missing_text": [],
            "pass": True,
        }
        for locale in ("en-US", "zh-TW", "ja-JP", "ko-KR")
    }
    return {
        "schema_version": 1,
        "base_url": "http://127.0.0.1:5661",
        "viewports": viewports,
        "locale_coverage": {
            "supported": ["en-US", "zh-TW", "ja-JP", "ko-KR"],
            "checks": locale_checks,
            "unique_signatures": True,
            "pass": True,
        },
        "agent_overview": {
            "selection": {"id": "smoke-main", "card_selected": True, "village_synced": True, "synchronized": True},
            "signal_kinds": ["busy", "offline"],
            "reduced_motion_semantics": True,
            "external_copy_nodes": 4,
            "pass": True,
        },
        "hook_routes": {
            "main": {
                "from_room": "clone_bay",
                "to_room": "standby_dock",
                "position_changed": True,
            },
            "subagent": {
                "agent_id": "smoke-subagent",
                "from_room": "clone_bay",
                "to_room": "tool_forge",
                "position_changed": True,
            },
            "pass": True,
        },
        "starting_cabin": {
            "building_id": "rest-cabin",
            "opened": True,
            "agent_id": "smoke-main",
            "agent_inside": True,
            "saved_furniture_count": 9,
            "pass": True,
        },
        "furniture_invariants": {
            "source_house": "rest-cabin",
            "target_house": "maker-workshop",
            "saved": True,
            "reloaded": True,
            "cross_house": True,
            "created_via_ui": True,
            "placed_via_ui": True,
            "save_changed_target": True,
            "geometry": {
                "size": True,
                "aspect_ratio": True,
                "rotation": True,
                "member_spacing": True,
            },
            "pass": True,
        },
        "screenshots": {
            "village": {
                "path": "docs/assets/command-deck-village.png",
                "width": 1440,
                "height": 900,
                "agents": ["smoke-main", "smoke-subagent"],
                "pass": True,
            },
            "cabin": {
                "path": "docs/assets/starting-cabin-agent.png",
                "width": 1440,
                "height": 900,
                "agents": ["smoke-main"],
                "saved_furniture_count": 9,
                "pass": True,
            },
        },
        "console_errors": [],
        "page_errors": [],
        "failures": [],
        "pass": True,
    }


def test_browser_smoke_plan_and_artifact_paths_are_deterministic():
    smoke = load_module()

    plan = smoke.BrowserSmokePlan()

    assert plan.base_url == "http://127.0.0.1:5661"
    assert [(item.name, item.width, item.height, item.mode) for item in plan.viewports] == [
        ("desktop-large", 1440, 900, "desktop"),
        ("desktop-compact", 1024, 768, "desktop"),
        ("narrow", 800, 450, "narrow"),
    ]
    assert plan.locales == ("en-US", "zh-TW", "ja-JP", "ko-KR")
    assert plan.artifact == ROOT / "tmp" / "command_deck_browser_smoke.json"
    assert plan.village_screenshot == ROOT / "docs" / "assets" / "command-deck-village.png"
    assert plan.cabin_screenshot == ROOT / "docs" / "assets" / "starting-cabin-agent.png"


def test_world_readiness_returns_a_boolean_instead_of_a_cdp_serialized_dom_node():
    smoke = load_module()

    class FakeBrowser:
        def wait_until(self, expression, description, timeout=None):
            assert description == "Pixelworld fonts/assets/world readiness"
            # Runtime.evaluate(returnByValue=True) serializes a DOM node as {},
            # which is falsey to the Python polling loop even when the node exists.
            result = True if "return Boolean(" in expression else {}
            if not result:
                raise smoke.BrowserFailure("CDP serialized the readiness node as {}")
            return result

        def evaluate(self, _expression):
            return True

    smoke.wait_world(FakeBrowser())


def test_predicate_and_value_waits_are_distinct_and_predicates_coerce_before_cdp_serialization():
    smoke = load_module()
    browser = object.__new__(smoke.ChromiumDevTools)
    browser.timeout_seconds = 0.01
    evaluated = []

    def evaluate(expression):
        evaluated.append(expression)
        return expression.startswith("Boolean((")

    browser.evaluate = evaluate

    assert browser.wait_until("document.querySelector('.ready')", "ready node") is True
    assert evaluated == ["Boolean((document.querySelector('.ready')))" ]


def test_cdp_drag_is_paced_across_animation_frames(monkeypatch):
    smoke = load_module()
    browser = object.__new__(smoke.ChromiumDevTools)
    events = []
    sleeps = []
    browser.call = lambda method, params: events.append((method, params)) or {}
    monkeypatch.setattr(smoke.time, "sleep", lambda duration: sleeps.append(duration))

    browser.drag((10, 20), (110, 120), steps=4)

    assert [event[1]["type"] for event in events] == [
        "mouseMoved", "mousePressed", "mouseMoved", "mouseMoved",
        "mouseMoved", "mouseMoved", "mouseReleased",
    ]
    assert [event[1]["button"] for event in events] == [
        "none", "left", "none", "none", "none", "none", "left",
    ]
    assert [event[1]["buttons"] for event in events] == [0, 1, 1, 1, 1, 1, 0]
    assert len(sleeps) >= 6
    assert all(duration > 0 for duration in sleeps)


def test_all_runner_polls_use_explicit_predicate_or_value_wait_apis():
    source = SCRIPT.read_text(encoding="utf-8")
    tree = ast.parse(source)
    calls = [
        node for node in ast.walk(tree)
        if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
        and node.func.attr in {"wait_for", "wait_until", "wait_value"}
    ]

    assert all(node.func.attr != "wait_for" for node in calls)
    runner_value_expressions = [
        ast.unparse(node.args[0])
        for node in calls
        if node.func.attr == "wait_value"
        and isinstance(node.func.value, ast.Name) and node.func.value.id == "browser"
    ]
    assert len(runner_value_expressions) == 6
    assert all(
        "localStorage.getItem" in expression or ".__commandDeckSmokeFocus.find" in expression
        for expression in runner_value_expressions
    )


def test_svg_controls_report_js_click_context_and_use_real_cdp_center_coordinates():
    smoke = load_module()

    class FakeBrowser:
        def __init__(self):
            self.expressions = []
            self.points = []

        def evaluate(self, expression):
            self.expressions.append(expression)
            if "typeof el.click" in expression:
                return {"found": True, "clickable": False, "tag": "circle"}
            return {"found": True, "tag": "circle", "left": 110, "top": 220, "width": 30, "height": 40}

        def click_point(self, x, y, **kwargs):
            self.points.append((x, y, kwargs))

    browser = FakeBrowser()
    with pytest.raises(smoke.BrowserFailure, match=r"mission-event-node.*<circle>.*click_center"):
        smoke.click(browser, ".mission-event-node")

    evidence = smoke.click_center(browser, ".mission-event-node", child=True)

    assert evidence["tag"] == "circle"
    assert browser.points == [(125.0, 240.0, {})]
    assert "#pixelworld-frame" in browser.expressions[-1]
    assert "outer.left + inner.left" in browser.expressions[-1]


def test_world_building_click_uses_authoritative_scaled_hit_region_not_label_height():
    smoke = load_module()

    class FakeBrowser:
        def __init__(self):
            self.points = []

        def evaluate(self, expression):
            assert "hitRegionLeft" in expression
            return {
                "found": True,
                "left": 200,
                "top": 100,
                "width": 160,
                "height": 96,
                "label_height": 999,
                "canvas": {"left": 50, "top": 25, "width": 768, "height": 448},
            }

        def click_point(self, x, y, **kwargs):
            self.points.append((x, y, kwargs))

        def wait_until(self, expression, description, timeout=None):
            assert "pixelworldCutaway" in expression
            assert description == "maker-workshop cutaway opened by a real village click"
            return True

    browser = FakeBrowser()
    smoke.click_world_building(browser, "maker-workshop")

    assert browser.points == [(280.0, 148.0, {})]


def test_furniture_marquee_uses_room_bounds_and_visible_group_action_as_selection_authority():
    smoke = load_module()

    room = {"left": 396.0, "top": 200.0, "width": 720.0, "height": 423.0,
            "right": 1116.0, "bottom": 623.0}
    assert smoke.interior_marquee_points(room) == ((438.75, 611.25), (1073.25, 211.75))

    class FakeBrowser:
        def __init__(self):
            self.drags = []
            self.right_clicks = []

        def evaluate(self, expression):
            if "cutaway-dom-status" in expression:
                return {
                    "status": "9 items selected · Ready to create an assembly",
                    "inspector_disabled": False,
                    "toolbar_hidden": False,
                    "edit_button_text": "✓",
                    "hook_label_count": 2,
                    "start_hit": "canvas",
                    "end_hit": "canvas",
                }
            if "getBoundingClientRect" in expression:
                assert "cutaway-room-labels" in expression and "data-region" in expression
                return {"left": 100, "top": 200, "width": 600, "height": 400,
                        "right": 700, "bottom": 600}
            if "data-context-action" in expression:
                return len(self.right_clicks) >= 2
            raise AssertionError(expression)

        def drag(self, start, end, **kwargs):
            self.drags.append((start, end))

        def click_point(self, x, y, **kwargs):
            assert kwargs == {"button": "right"}
            self.right_clicks.append((x, y))

        def wait_until(self, expression, description, timeout=None):
            assert "data-context-action" in expression
            assert description == "multi-furniture group UI action"
            return bool(self.evaluate(expression))

    browser = FakeBrowser()
    evidence = smoke.select_furniture_group_via_marquee(browser)

    assert browser.drags == [((110.71428571428571, 575.0), (689.2857142857143, 210.71428571428572))]
    assert len(browser.right_clicks) == 2
    assert evidence["group_action_visible"] is True
    assert evidence["edit_mode"] is True
    helper_source = SCRIPT.read_text(encoding="utf-8").split("def select_furniture_group_via_marquee", 1)[1].split("\ndef ", 1)[0]
    assert "marquee-selected furniture labels" not in helper_source
    assert "hook_label_count" in helper_source  # diagnostic only, never the pass condition


def test_cabin_furniture_is_explicitly_saved_before_its_screenshot_is_captured():
    source = SCRIPT.read_text(encoding="utf-8")
    runner = source.split("def run_smoke", 1)[1]

    saved = runner.index("saved_cabin_furniture_count(browser)")
    captured = runner.index("browser.screenshot(temporary_cabin)")
    grouped = runner.index("furniture_evidence(browser)")

    assert saved < captured < grouped


def test_moving_subagent_is_sampled_before_waiting_for_the_main_route_and_screenshot_uses_roster():
    runner = SCRIPT.read_text(encoding="utf-8").split("def run_smoke", 1)[1]

    assert runner.index("moving_sub = agent_dom_state(browser, plan.subagent)") < runner.index(
        '"visible main agent displacement from Clone Bay toward Starting Cabin"'
    )
    assert "document.querySelectorAll('.agent-roster-card[data-selection-id]')" in runner


def test_reload_persistence_closes_restored_cutaway_before_next_world_building_click():
    smoke = load_module()

    class FakeBrowser:
        def __init__(self):
            self.expressions = []
            self.waits = []

        def evaluate(self, expression):
            self.expressions.append(expression)
            if "typeof el.click" in expression:
                return {"found": True, "clickable": True, "tag": "button"}
            return {
                "dataset": "open",
                "panel_open": True,
                "panel_title": "Rest Cabin",
                "building_labels": [],
            }

        def wait_until(self, expression, description, timeout=None):
            self.waits.append((expression, description))
            return True

    browser = FakeBrowser()
    smoke.close_cutaway_to_village(browser, "maker-workshop")

    assert any('[data-action=\\"close\\"]' in expression for expression in browser.expressions)
    assert browser.waits == [(
        "document.body.dataset.pixelworldCutaway !== 'open' && !document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-dom-panel') && document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.world-building-label[data-building-id=\"maker-workshop\"]')",
        "restored cutaway close and maker-workshop world label",
    )]
    source = SCRIPT.read_text(encoding="utf-8").split("def furniture_evidence", 1)[1].split("\ndef ", 1)[0]
    assert source.index("reloaded =") < source.index('close_cutaway_to_village(browser, "maker-workshop")')
    assert source.index('close_cutaway_to_village(browser, "maker-workshop")') < source.index('click_world_building(browser, "maker-workshop")')


def test_complete_browser_evidence_satisfies_the_artifact_contract():
    smoke = load_module()

    assert smoke.evaluate_artifact(passing_artifact()) == []


def test_contract_rejects_missing_viewport_actions_and_overlap():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["viewports"][1]["village_larger_than_roster"] = False
    artifact["viewports"][2]["layout_bounds"]["overlaps"] = ["world:agent-live-rail"]

    failures = smoke.evaluate_artifact(artifact)

    assert any("desktop-compact" in failure and "larger" in failure for failure in failures)
    assert any("narrow" in failure and "overlap" in failure for failure in failures)


def test_contract_rejects_incomplete_drilldown_locale_and_error_evidence():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["agent_overview"]["selection"]["synchronized"] = False
    artifact["agent_overview"]["selection"]["village_synced"] = False
    artifact["locale_coverage"]["checks"].pop("ja-JP")
    artifact["locale_coverage"]["unique_signatures"] = False
    artifact["console_errors"] = ["TypeError: exploded"]

    failures = smoke.evaluate_artifact(artifact)

    assert any("agent" in failure and "synchron" in failure for failure in failures)
    assert any("ja-JP" in failure for failure in failures)
    assert any("distinct" in failure for failure in failures)
    assert any("console" in failure.lower() for failure in failures)


def test_contract_rejects_missing_portraits_ecg_and_external_copy_markers():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["viewports"][0]["roster_visible"] = False
    artifact["agent_overview"]["signal_kinds"] = ["busy"]
    artifact["agent_overview"]["reduced_motion_semantics"] = False
    artifact["agent_overview"]["external_copy_nodes"] = 0

    failures = smoke.evaluate_artifact(artifact)

    assert any("desktop-large" in failure and "roster" in failure for failure in failures)
    assert any("offline" in failure and "ECG" in failure for failure in failures)
    assert any("reduced motion" in failure for failure in failures)
    assert any("external copy" in failure for failure in failures)


def test_contract_rejects_wrong_locale_copy_even_when_it_is_nonempty():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["locale_coverage"]["checks"]["zh-TW"]["help_copy"] = {
        "aria_label": "Help", "tooltip": "Help", "title": "Help",
    }
    artifact["locale_coverage"]["checks"]["ja-JP"]["shell_copy"]["timeline_title"] = "Mission trace"
    artifact["locale_coverage"]["checks"]["ko-KR"]["village_copy"]["rest_cabin"] = "休憩小屋"
    artifact["locale_coverage"]["checks"]["ko-KR"]["village_signature"] = artifact["locale_coverage"]["checks"]["en-US"]["village_signature"]

    failures = smoke.evaluate_artifact(artifact)

    assert any("zh-TW" in failure and "Help" in failure for failure in failures)
    assert any("ja-JP" in failure and "shell" in failure for failure in failures)
    assert any("ko-KR" in failure and "village" in failure for failure in failures)
    assert any("distinct village" in failure for failure in failures)


def test_contract_rejects_text_only_routes_closed_cabin_and_missing_agents():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["hook_routes"]["subagent"]["position_changed"] = False
    artifact["starting_cabin"]["agent_inside"] = False
    artifact["screenshots"]["village"]["agents"] = ["smoke-main"]

    failures = smoke.evaluate_artifact(artifact)

    assert any("subagent" in failure and "position" in failure for failure in failures)
    assert any("Starting Cabin" in failure and "agent" in failure for failure in failures)
    assert any("village screenshot" in failure and "subagent" in failure for failure in failures)


def test_contract_requires_saved_cabin_furniture_instead_of_optional_hook_labels():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["starting_cabin"]["saved_furniture_count"] = 0

    failures = smoke.evaluate_artifact(artifact)

    assert any("Starting Cabin" in failure and "furniture" in failure for failure in failures)


def test_contract_rejects_furniture_geometry_or_persistence_regressions():
    smoke = load_module()
    artifact = passing_artifact()
    artifact["furniture_invariants"]["reloaded"] = False
    artifact["furniture_invariants"]["geometry"]["rotation"] = False
    artifact["furniture_invariants"]["geometry"]["member_spacing"] = False
    artifact["furniture_invariants"]["placed_via_ui"] = False

    failures = smoke.evaluate_artifact(artifact)

    assert any("reload" in failure for failure in failures)
    assert any("rotation" in failure for failure in failures)
    assert any("member_spacing" in failure for failure in failures)
    assert any("placed via UI" in failure for failure in failures)


def test_runner_cannot_seed_prefab_or_target_layout_and_must_drive_real_ui_paths():
    source = SCRIPT.read_text(encoding="utf-8")

    assert "localStorage.setItem('pixelworld:interior-prefabs:v1'" not in source
    assert "localStorage.setItem('pixelworld:interior-layout:maker-workshop'" not in source
    assert "Input.dispatchMouseEvent" in source
    assert "data-context-action=\"group\"" in source
    assert '.cutaway-dom-categories button[aria-label="Grouped Furniture"]' in source


def test_member_spacing_is_id_independent_for_real_prefab_placement():
    smoke = load_module()
    template = [
        {"id": "template-a", "point": {"x": 1.25, "y": 2.5}},
        {"id": "template-b", "point": {"x": 4.75, "y": 6.0}},
    ]
    placed = [
        {"id": "prefab-123-group-0", "point": {"x": 10.0, "y": 11.0}},
        {"id": "prefab-123-group-1", "point": {"x": 13.5, "y": 14.5}},
    ]

    assert smoke.member_offsets(template) == smoke.member_offsets(placed)


def test_catalog_prefab_slot_accounts_for_missing_required_hook_furniture():
    smoke = load_module()

    assert smoke.catalog_prefab_offset("Editing · Hook 2/5 · Prefab 1") == 3
    assert smoke.catalog_prefab_offset("Editing · Hook 5/5 · Prefab 1") == 0
    assert smoke.catalog_prefab_offset("status unavailable") == 0


def test_readme_and_progressive_specs_publish_the_verified_browser_acceptance():
    readme = (ROOT / "README.md").read_text(encoding="utf-8")
    project_map = (ROOT / "spec" / "PROJECT_MAP.md").read_text(encoding="utf-8")
    frontend = (ROOT / "spec" / "modules" / "world-frontend.md").read_text(encoding="utf-8")
    testing = (ROOT / "spec" / "modules" / "testing-and-ops.md").read_text(encoding="utf-8")

    village_markdown = "![CLI_Pixelverse command deck with active village agents](./docs/assets/command-deck-village.png)"
    cabin_markdown = "![Starting Cabin interior with an active agent](./docs/assets/starting-cabin-agent.png)"
    assert village_markdown in readme
    assert cabin_markdown in readme
    assert readme.index(village_markdown) < readme.index("## What It Supports")
    assert readme.index(cabin_markdown) < readme.index("## What It Supports")
    assert "command_deck_model.mjs" in project_map
    assert "mission_trace.mjs" in frontend
    assert "canonicalFurnitureGeometry.ts" in frontend
    assert "tmp/command_deck_browser_smoke.json" in testing
    assert "python3 scripts/command_deck_browser_smoke.py --base-url http://127.0.0.1:5661" in testing

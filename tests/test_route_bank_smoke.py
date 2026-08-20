from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "scripts" / "route_bank_smoke.py"


def load_module():
    spec = importlib.util.spec_from_file_location("route_bank_smoke", SCRIPT)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def test_route_bank_defines_ten_visible_multi_agent_room_jobs():
    route_bank = load_module()

    routes = route_bank.build_route_bank()

    assert len(routes) == 10
    assert {route.agent for route in routes} == {f"smoke-agent-{i:02d}" for i in range(1, 11)}
    assert {route.target_room for route in routes} == {
        "think_lab",
        "blueprint_lab",
        "clone_bay",
        "file_library",
        "code_workbench",
        "terminal_bay",
        "standby_dock",
        "response_studio",
        "tool_forge",
        "session_archive",
    }
    assert all(route.role in {"subagent", "branch_session", "main_agent"} for route in routes)
    assert all(route.color.startswith("#") for route in routes)


def test_build_payload_sequence_starts_agents_then_sends_each_to_its_room_and_keeps_them_visible():
    route_bank = load_module()
    routes = route_bank.build_route_bank()

    payloads = route_bank.build_payloads(routes)

    assert len(payloads) == 30
    assert [payload["event"] for payload in payloads[:10]] == ["start"] * 10
    assert [payload["target_room"] for payload in payloads[:10]] == ["clone_bay"] * 10

    working_payloads = payloads[10:20]
    assert [payload["event"] for payload in working_payloads] == ["tool.started"] * 10
    assert {payload["agent"] for payload in working_payloads} == {route.agent for route in routes}
    assert {payload["target_room"] for payload in working_payloads} == {route.target_room for route in routes}
    assert all(payload["state"] == "working" for payload in working_payloads)

    hold_payloads = payloads[20:]
    assert [payload["event"] for payload in hold_payloads] == ["status"] * 10
    assert {payload["target_room"] for payload in hold_payloads} == {route.target_room for route in routes}
    assert all(payload["state"] == "working" for payload in hold_payloads)
    assert all("停留" in payload["message"] for payload in hold_payloads)


def test_plan_summary_is_operator_readable_and_mentions_url():
    route_bank = load_module()

    summary = route_bank.format_plan_summary("http://localhost:5660", route_bank.build_route_bank())

    assert "http://localhost:5660" in summary
    assert "smoke-agent-01" in summary
    assert "session_archive" in summary
    assert "10" in summary

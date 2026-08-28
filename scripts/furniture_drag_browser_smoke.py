#!/usr/bin/env python3
"""Repeatable browser smoke test for cross-room furniture dragging.

This uses a real Chromium browser against a running Pixelverse UI. It enters
Move Furniture mode, drags one prop from file_library into response_studio near
that room's lower-right edge, and verifies the prop can extend outside the room
card without being clipped.

Run with:
  uv run --with playwright python scripts/furniture_drag_browser_smoke.py
"""

from __future__ import annotations

import argparse
import asyncio
import json
import shutil
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
DEFAULT_BASE_URL = "http://127.0.0.1:5660"
ESSENTIAL_ASSET_PATHS = (
    "/assets/private/modern-office-v1.2/Modern_Office_Singles_200.png",
    "/assets/private/modern-office-v1.2/collision-masks.json",
)


@dataclass(frozen=True)
class DragPlan:
    base_url: str = DEFAULT_BASE_URL
    source_room: str = "file_library"
    target_room: str = "response_studio"
    target_x_pct: float = 96.0
    target_y_pct: float = 96.0
    prop_selector: str = ".prop"
    artifact: Path = TMP / "furniture_drag_browser_smoke.json"
    screenshot: Path = TMP / "furniture_drag_browser_smoke.png"
    headless: bool = True
    slow_mo_ms: int = 0
    timeout_ms: int = 20_000


@dataclass(frozen=True)
class SmokeResult:
    ok: bool
    source_room: str
    target_room: str
    before_room: str | None
    after_room: str | None
    parent_room: str | None
    ghost_seen: bool
    save_enabled: bool
    visually_outside_target_district: bool
    clipping_ancestor: str | None
    district_overflow: str | None
    props_overflow: str | None
    props_pointer_events: str | None
    prop_pointer_events: str | None
    console_errors: list[str]
    screenshot: str
    essential_asset_statuses: dict[str, int]


def evaluate_result(result: SmokeResult) -> list[str]:
    failures: list[str] = []
    if result.before_room != result.source_room:
        failures.append(f"source prop started in {result.before_room!r}, expected {result.source_room!r}")
    if result.after_room != result.target_room or result.parent_room != result.target_room:
        failures.append(
            f"furniture did not cross rooms: after={result.after_room!r}, parent={result.parent_room!r}, expected {result.target_room!r}"
        )
    if not result.ghost_seen:
        failures.append("drag ghost was not observed during pointer drag")
    if not result.save_enabled:
        failures.append("Save Layout button was not enabled after accepted cross-room drag")
    if not result.visually_outside_target_district:
        failures.append("prop did not extend outside target district, so this run would not catch clipping regressions")
    if result.clipping_ancestor:
        failures.append(f"clipping ancestor detected: {result.clipping_ancestor}")
    if result.district_overflow != "visible":
        failures.append(f"district overflow is {result.district_overflow!r}, expected 'visible'")
    if result.props_overflow != "visible":
        failures.append(f"district-props overflow is {result.props_overflow!r}, expected 'visible'")
    if result.props_pointer_events != "none":
        failures.append(f"district-props pointer-events is {result.props_pointer_events!r}, expected 'none'")
    if result.prop_pointer_events != "auto":
        failures.append(f"prop pointer-events is {result.prop_pointer_events!r}, expected 'auto'")
    if result.console_errors:
        failures.append("browser console errors: " + " | ".join(result.console_errors[:5]))
    for path in ESSENTIAL_ASSET_PATHS:
        status = result.essential_asset_statuses.get(path)
        if status != 200:
            failures.append(f"essential asset {path} returned HTTP {status!r}, expected 200")
    return failures


def chromium_executable() -> str | None:
    for name in ("chromium", "chromium-browser", "google-chrome", "google-chrome-stable"):
        path = shutil.which(name)
        if path:
            return path
    return None


def _jsonable_plan(plan: DragPlan) -> dict[str, Any]:
    payload = asdict(plan)
    payload["artifact"] = str(plan.artifact)
    payload["screenshot"] = str(plan.screenshot)
    return payload


async def run_browser_smoke(plan: DragPlan) -> SmokeResult:
    from playwright.async_api import async_playwright  # type: ignore[import-not-found]

    console_errors: list[str] = []
    TMP.mkdir(parents=True, exist_ok=True)
    executable = chromium_executable()
    launch_args = ["--no-sandbox", "--disable-dev-shm-usage"]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=plan.headless,
            executable_path=executable,
            slow_mo=plan.slow_mo_ms,
            args=launch_args,
        )
        page = await browser.new_page(viewport={"width": 1600, "height": 1100}, device_scale_factor=1)
        def record_console_error(msg):
            text = f"{msg.type}: {msg.text}"
            if msg.type != "error":
                return
            if "favicon" in text.lower():
                return
            console_errors.append(text)

        page.on("console", record_console_error)
        page.on("pageerror", lambda err: console_errors.append(f"pageerror: {err}"))
        essential_asset_statuses: dict[str, int] = {}
        for path in ESSENTIAL_ASSET_PATHS:
            response = await page.request.get(f"{plan.base_url.rstrip('/')}{path}", timeout=plan.timeout_ms)
            essential_asset_statuses[path] = response.status
        # The app keeps an SSE/polling channel open, so waiting for idle network can hang forever.
        # DOMContentLoaded + the first district is the repeatable readiness signal.
        await page.goto(f"{plan.base_url.rstrip('/')}?smoke=furniture-drag-browser", wait_until="domcontentloaded", timeout=plan.timeout_ms)
        await page.wait_for_selector(".district[data-room]", timeout=plan.timeout_ms)
        await page.click("#edit-furniture-btn", timeout=plan.timeout_ms)
        source_selector = f'.district[data-room="{plan.source_room}"] {plan.prop_selector}'
        target_selector = f'.district[data-room="{plan.target_room}"]'
        await page.wait_for_selector(source_selector, timeout=plan.timeout_ms)
        source = page.locator(source_selector).first
        target = page.locator(target_selector).first
        source_box = await source.bounding_box()
        target_box = await target.bounding_box()
        if not source_box or not target_box:
            raise RuntimeError("Could not resolve source prop or target room bounding boxes")

        before_room = await source.evaluate("el => el.dataset.roomKey || el.closest('.district')?.dataset.room || null")
        start_x = source_box["x"] + source_box["width"] / 2
        start_y = source_box["y"] + source_box["height"] / 2
        drop_x = target_box["x"] + target_box["width"] * (plan.target_x_pct / 100)
        drop_y = target_box["y"] + target_box["height"] * (plan.target_y_pct / 100)

        await page.mouse.move(start_x, start_y)
        await page.mouse.down()
        await page.mouse.move(drop_x, drop_y, steps=24)
        ghost_seen = await page.locator(".furniture-drag-ghost").count() > 0
        await page.mouse.up()
        await page.wait_for_timeout(250)

        data = await page.evaluate(
            """
            ({ sourceRoom, targetRoom }) => {
              const prop = document.querySelector(`.prop[data-origin-room-key="${sourceRoom}"][data-room-key="${targetRoom}"]`)
                || document.querySelector(`.district[data-room="${targetRoom}"] .prop[data-origin-room-key="${sourceRoom}"]`)
                || document.querySelector(`.district[data-room="${targetRoom}"] .prop`);
              const district = document.querySelector(`.district[data-room="${targetRoom}"]`);
              const props = district?.querySelector('.district-props') || null;
              const save = document.querySelector('#save-furniture-btn');
              const propRect = prop?.getBoundingClientRect();
              const districtRect = district?.getBoundingClientRect();
              const visuallyOutside = !!(propRect && districtRect && (
                propRect.left < districtRect.left || propRect.right > districtRect.right ||
                propRect.top < districtRect.top || propRect.bottom > districtRect.bottom
              ));
              let clippingAncestor = null;
              let node = prop?.parentElement || null;
              while (node && node !== document.body) {
                if (node.classList?.contains('world')) break;
                const style = getComputedStyle(node);
                const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
                if (/(hidden|clip|scroll|auto)/.test(overflow)) {
                  clippingAncestor = `${node.className || node.id || node.tagName}: ${overflow}`;
                  break;
                }
                node = node.parentElement;
              }
              return {
                afterRoom: prop?.dataset.roomKey || null,
                parentRoom: prop?.closest('.district')?.dataset.room || null,
                saveEnabled: !!(save && !save.disabled),
                visuallyOutsideTargetDistrict: visuallyOutside,
                clippingAncestor,
                districtOverflow: district ? getComputedStyle(district).overflow : null,
                propsOverflow: props ? getComputedStyle(props).overflow : null,
                propsPointerEvents: props ? getComputedStyle(props).pointerEvents : null,
                propPointerEvents: prop ? getComputedStyle(prop).pointerEvents : null,
              };
            }
            """,
            {"sourceRoom": plan.source_room, "targetRoom": plan.target_room},
        )
        await page.screenshot(path=str(plan.screenshot), full_page=True)
        await browser.close()

    result = SmokeResult(
        ok=False,
        source_room=plan.source_room,
        target_room=plan.target_room,
        before_room=before_room,
        after_room=data.get("afterRoom"),
        parent_room=data.get("parentRoom"),
        ghost_seen=ghost_seen,
        save_enabled=bool(data.get("saveEnabled")),
        visually_outside_target_district=bool(data.get("visuallyOutsideTargetDistrict")),
        clipping_ancestor=data.get("clippingAncestor"),
        district_overflow=data.get("districtOverflow"),
        props_overflow=data.get("propsOverflow"),
        props_pointer_events=data.get("propsPointerEvents"),
        prop_pointer_events=data.get("propPointerEvents"),
        console_errors=console_errors,
        screenshot=str(plan.screenshot),
        essential_asset_statuses=essential_asset_statuses,
    )
    failures = evaluate_result(result)
    return SmokeResult(**{**asdict(result), "ok": not failures})


def write_artifact(plan: DragPlan, result: SmokeResult, failures: list[str]) -> None:
    plan.artifact.parent.mkdir(parents=True, exist_ok=True)
    plan.artifact.write_text(
        json.dumps(
            {
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
                "plan": _jsonable_plan(plan),
                "result": asdict(result),
                "failures": failures,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run a real browser smoke test for cross-room furniture dragging/clipping.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--source-room", default="file_library")
    parser.add_argument("--target-room", default="response_studio")
    parser.add_argument("--target-x-pct", type=float, default=96.0)
    parser.add_argument("--target-y-pct", type=float, default=96.0)
    parser.add_argument("--headed", action="store_true", help="Show Chromium while running the drag smoke.")
    parser.add_argument("--slow-mo-ms", type=int, default=0)
    parser.add_argument("--timeout-ms", type=int, default=20_000)
    parser.add_argument("--artifact", type=Path, default=TMP / "furniture_drag_browser_smoke.json")
    parser.add_argument("--screenshot", type=Path, default=TMP / "furniture_drag_browser_smoke.png")
    return parser


async def async_main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    plan = DragPlan(
        base_url=args.base_url,
        source_room=args.source_room,
        target_room=args.target_room,
        target_x_pct=args.target_x_pct,
        target_y_pct=args.target_y_pct,
        artifact=args.artifact,
        screenshot=args.screenshot,
        headless=not args.headed,
        slow_mo_ms=args.slow_mo_ms,
        timeout_ms=args.timeout_ms,
    )
    result = await run_browser_smoke(plan)
    failures = evaluate_result(result)
    write_artifact(plan, result, failures)
    print(f"Furniture drag browser smoke: {'PASS' if not failures else 'FAIL'}")
    print(f"Artifact: {plan.artifact}")
    print(f"Screenshot: {plan.screenshot}")
    print(json.dumps(asdict(result), ensure_ascii=False, indent=2))
    if failures:
        print("Failures:")
        for failure in failures:
            print(f"- {failure}")
        return 1
    return 0


def main(argv: list[str] | None = None) -> int:
    return asyncio.run(async_main(argv))


if __name__ == "__main__":
    raise SystemExit(main())

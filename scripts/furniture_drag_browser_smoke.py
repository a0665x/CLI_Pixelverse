#!/usr/bin/env python3
"""Browser smoke for the current village-to-interior furniture experience.

The dashboard now renders the village in an iframe and opens furniture in a
second-layer Phaser cutaway.  This smoke uses the production focus-message
contract to open that cutaway, then verifies its chrome, canvas, licensed
render asset, collision manifest, console, and screenshot.
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
class InteriorSmokePlan:
    base_url: str = DEFAULT_BASE_URL
    building_id: str = "maker-workshop"
    artifact: Path = TMP / "furniture_drag_browser_smoke.json"
    screenshot: Path = TMP / "furniture_drag_browser_smoke.png"
    headless: bool = True
    slow_mo_ms: int = 0
    timeout_ms: int = 20_000


@dataclass(frozen=True)
class InteriorSmokeResult:
    ok: bool
    building_id: str
    iframe_visible: bool
    cutaway_visible: bool
    cutaway_title: str
    canvas_width: float
    canvas_height: float
    edit_control_visible: bool
    console_errors: list[str]
    screenshot: str
    essential_asset_statuses: dict[str, int]


def evaluate_result(result: InteriorSmokeResult) -> list[str]:
    failures: list[str] = []
    if not result.iframe_visible:
        failures.append("pixelworld iframe is not visible")
    if not result.cutaway_visible:
        failures.append(f"second-layer cutaway did not open for {result.building_id}")
    if not result.cutaway_title.strip():
        failures.append("cutaway title is empty")
    if result.canvas_width < 320 or result.canvas_height < 240:
        failures.append(
            f"interior canvas is too small: {result.canvas_width:g}x{result.canvas_height:g}"
        )
    if not result.edit_control_visible:
        failures.append("cutaway furniture edit control is not visible")
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


def _jsonable_plan(plan: InteriorSmokePlan) -> dict[str, Any]:
    payload = asdict(plan)
    payload["artifact"] = str(plan.artifact)
    payload["screenshot"] = str(plan.screenshot)
    return payload


async def run_browser_smoke(plan: InteriorSmokePlan) -> InteriorSmokeResult:
    from playwright.async_api import async_playwright  # type: ignore[import-not-found]

    console_errors: list[str] = []
    TMP.mkdir(parents=True, exist_ok=True)
    launch_args = ["--no-sandbox", "--disable-dev-shm-usage"]
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=plan.headless,
            executable_path=chromium_executable(),
            slow_mo=plan.slow_mo_ms,
            args=launch_args,
        )
        page = await browser.new_page(viewport={"width": 1600, "height": 1100}, device_scale_factor=1)

        def record_console_error(msg):
            location_url = str((msg.location or {}).get("url") or "")
            text = f"{msg.type}: {msg.text}" + (f" [{location_url}]" if location_url else "")
            if msg.type == "error" and "favicon" not in text.lower():
                console_errors.append(text)

        page.on("console", record_console_error)
        page.on("pageerror", lambda err: console_errors.append(f"pageerror: {err}"))
        await page.add_init_script(
            """
            window.__pixelverseSmokeWorldReady = false;
            window.addEventListener('message', (event) => {
              if (event.origin === window.location.origin
                  && event.data?.type === 'pixelverse.world.ready') {
                window.__pixelverseSmokeWorldReady = true;
              }
            });
            """
        )
        essential_asset_statuses: dict[str, int] = {}
        for path in ESSENTIAL_ASSET_PATHS:
            response = await page.request.get(
                f"{plan.base_url.rstrip('/')}{path}", timeout=plan.timeout_ms
            )
            essential_asset_statuses[path] = response.status

        await page.goto(
            f"{plan.base_url.rstrip('/')}?smoke=furniture-interior-browser",
            wait_until="domcontentloaded",
            timeout=plan.timeout_ms,
        )
        iframe_locator = page.locator("#pixelworld-frame")
        await iframe_locator.wait_for(state="visible", timeout=plan.timeout_ms)
        iframe_box = await iframe_locator.bounding_box()
        iframe_element = await iframe_locator.element_handle()
        frame = await iframe_element.content_frame() if iframe_element else None
        if frame is None:
            raise RuntimeError("Pixelworld iframe did not expose a content frame")
        await frame.wait_for_selector("canvas", state="visible", timeout=plan.timeout_ms)
        await page.wait_for_function(
            "window.__pixelverseSmokeWorldReady === true", timeout=plan.timeout_ms
        )

        await page.evaluate(
            """
            ({ buildingId }) => {
              const publish = () => {
                const target = document.querySelector('#pixelworld-frame');
                target?.contentWindow?.postMessage({
                  type: 'pixelverse.command.focus',
                  selection: { kind: 'building', id: buildingId },
                  sequence: Date.now(),
                }, window.location.origin);
              };
              publish();
              window.__pixelverseSmokeFocusTimer = window.setInterval(publish, 250);
            }
            """,
            {"buildingId": plan.building_id},
        )
        panel = frame.locator(".cutaway-dom-panel")
        await panel.wait_for(state="visible", timeout=plan.timeout_ms)
        await page.evaluate(
            "window.clearInterval(window.__pixelverseSmokeFocusTimer)"
        )
        title = (await panel.locator("h2").inner_text()).strip()
        edit_control = panel.locator('[data-action="edit"]')
        canvas_box = await frame.locator("canvas").bounding_box()
        await page.screenshot(path=str(plan.screenshot), full_page=True)

        result = InteriorSmokeResult(
            ok=False,
            building_id=plan.building_id,
            iframe_visible=bool(iframe_box and iframe_box["width"] > 0 and iframe_box["height"] > 0),
            cutaway_visible=await panel.is_visible(),
            cutaway_title=title,
            canvas_width=float(canvas_box["width"] if canvas_box else 0),
            canvas_height=float(canvas_box["height"] if canvas_box else 0),
            edit_control_visible=await edit_control.is_visible(),
            console_errors=console_errors,
            screenshot=str(plan.screenshot),
            essential_asset_statuses=essential_asset_statuses,
        )
        await browser.close()

    failures = evaluate_result(result)
    return InteriorSmokeResult(**{**asdict(result), "ok": not failures})


def write_artifact(
    plan: InteriorSmokePlan, result: InteriorSmokeResult, failures: list[str]
) -> None:
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
    parser = argparse.ArgumentParser(
        description="Open the current second-layer interior and smoke-test furniture rendering."
    )
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--building-id", default="maker-workshop")
    parser.add_argument("--headed", action="store_true", help="Show Chromium while running the smoke.")
    parser.add_argument("--slow-mo-ms", type=int, default=0)
    parser.add_argument("--timeout-ms", type=int, default=20_000)
    parser.add_argument("--artifact", type=Path, default=TMP / "furniture_drag_browser_smoke.json")
    parser.add_argument("--screenshot", type=Path, default=TMP / "furniture_drag_browser_smoke.png")
    return parser


async def async_main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    plan = InteriorSmokePlan(
        base_url=args.base_url,
        building_id=args.building_id,
        artifact=args.artifact,
        screenshot=args.screenshot,
        headless=not args.headed,
        slow_mo_ms=args.slow_mo_ms,
        timeout_ms=args.timeout_ms,
    )
    result = await run_browser_smoke(plan)
    failures = evaluate_result(result)
    write_artifact(plan, result, failures)
    print(f"Furniture interior browser smoke: {'PASS' if not failures else 'FAIL'}")
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

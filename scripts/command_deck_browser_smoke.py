#!/usr/bin/env python3
"""Deterministic production-browser acceptance for the Pixelverse command deck.

The smoke launches the system Chromium through the DevTools protocol, drives only
public UI controls and the supported same-origin command-focus bridge, and writes
``tmp/command_deck_browser_smoke.json``. Repository screenshots are promoted from
temporary files only after every assertion passes.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import shutil
import struct
import subprocess
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
TMP = ROOT / "tmp"
DEFAULT_BASE_URL = os.environ.get("PIXELVERSE_SMOKE_BASE_URL", "http://127.0.0.1:5661")
SUPPORTED_LOCALES = ("en-US", "zh-TW", "ja-JP", "ko-KR")
EXPECTED_LOCALE_COPY = {
    "en-US": {
        "document_lang": "en", "agents_title": "Agent roster", "timeline_title": "Mission trace",
        "language_label": "Language", "help": "Help", "help_aria": "Open Panels: Help",
        "rest_cabin": "Rest Cabin", "maker_workshop": "Maker Workshop",
        "current_agent_state": "codex · Idle · Standby Dock · Waiting for a new CLI session",
    },
    "zh-TW": {
        "document_lang": "zh-Hant", "agents_title": "代理人物列", "timeline_title": "任務軌跡",
        "language_label": "語言", "help": "說明", "help_aria": "開啟側欄: 說明",
        "rest_cabin": "休息小屋", "maker_workshop": "編輯工坊",
        "current_agent_state": "codex · 待命中 · 待命站 · 等待新的 CLI 工作階段",
    },
    "ja-JP": {
        "document_lang": "ja", "agents_title": "エージェント一覧", "timeline_title": "ミッション軌跡",
        "language_label": "言語", "help": "ヘルプ", "help_aria": "パネル表示: ヘルプ",
        "rest_cabin": "休憩小屋", "maker_workshop": "編集工房",
        "current_agent_state": "codex · 待機 · 待機ドック · 新しい CLI セッションを待機中",
    },
    "ko-KR": {
        "document_lang": "ko", "agents_title": "에이전트 목록", "timeline_title": "미션 추적",
        "language_label": "언어", "help": "도움말", "help_aria": "패널 열기: 도움말",
        "rest_cabin": "휴식 오두막", "maker_workshop": "편집 공방",
        "current_agent_state": "codex · 대기 · 대기 도크 · 새 CLI 세션을 기다리는 중",
    },
}


@dataclass(frozen=True)
class Viewport:
    name: str
    width: int
    height: int
    mode: str


@dataclass(frozen=True)
class BrowserSmokePlan:
    base_url: str = DEFAULT_BASE_URL
    viewports: tuple[Viewport, ...] = (
        Viewport("desktop-large", 1440, 900, "desktop"),
        Viewport("desktop-compact", 1024, 768, "desktop"),
        Viewport("narrow", 800, 450, "narrow"),
        Viewport("mobile", 390, 844, "narrow"),
    )
    locales: tuple[str, ...] = SUPPORTED_LOCALES
    artifact: Path = TMP / "command_deck_browser_smoke.json"
    village_screenshot: Path = ROOT / "docs" / "assets" / "command-deck-village.png"
    cabin_screenshot: Path = ROOT / "docs" / "assets" / "starting-cabin-agent.png"
    timeout_seconds: float = 45.0
    main_agent: str = "command-deck-smoke-main"
    subagent: str = "command-deck-smoke-subagent"
    busy_agent: str = "command-deck-smoke-busy"
    offline_agent: str = "command-deck-smoke-offline"


def _mapping(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def evaluate_artifact(artifact: dict[str, Any]) -> list[str]:
    """Return human-readable contract failures for one browser artifact."""
    failures: list[str] = []
    expected_viewports = {
        "desktop-large": (1440, 900, "desktop"),
        "desktop-compact": (1024, 768, "desktop"),
        "narrow": (800, 450, "narrow"),
        "mobile": (390, 844, "narrow"),
    }
    viewports = {
        item.get("name"): item
        for item in artifact.get("viewports", [])
        if isinstance(item, dict) and item.get("name")
    }
    for name, (width, height, mode) in expected_viewports.items():
        item = _mapping(viewports.get(name))
        if (item.get("width"), item.get("height"), item.get("mode")) != (width, height, mode):
            failures.append(f"{name}: missing or incorrect {width}x{height} {mode} viewport evidence")
            continue
        overlaps = _mapping(item.get("layout_bounds")).get("overlaps")
        if overlaps != []:
            failures.append(f"{name}: village overlap evidence is not empty: {overlaps!r}")
        if item.get("roster_visible") is not True:
            failures.append(f"{name}: pixel agent roster was not visible")
        if item.get("village_visible") is not True:
            failures.append(f"{name}: village was not visible")
        if item.get("village_larger_than_roster") is not True:
            failures.append(f"{name}: village was not larger than the agent roster")
        if item.get("pass") is not True:
            failures.append(f"{name}: viewport did not pass")

    agent_detail = _mapping(artifact.get("agent_detail"))
    for source in ("roster_activation", "village_activation"):
        activation = _mapping(agent_detail.get(source))
        if not activation.get("id") or activation.get("opened") is not True:
            failures.append(f"agent detail {source.replace('_', ' ')} was not verified")
    detail_viewports = _mapping(agent_detail.get("viewports"))
    for name, (_, _, shell_mode) in expected_viewports.items():
        evidence = _mapping(detail_viewports.get(name))
        expected_mode = "drawer" if shell_mode == "desktop" else "dialog"
        if evidence.get("detailMode") != expected_mode:
            failures.append(f"{name}: Agent detail did not use {expected_mode} mode")
        if evidence.get("horizontalOverflow") is not False:
            failures.append(f"{name}: Agent detail caused horizontal overflow")
        if int(evidence.get("external_copy_nodes") or 0) <= 0:
            failures.append(f"{name}: Agent detail external copy was not verified")
        if evidence.get("pass") is not True:
            failures.append(f"{name}: Agent detail viewport did not pass")
    if agent_detail.get("focus_restore") is not True:
        failures.append("Agent detail did not restore focus after Escape")
    resize = _mapping(agent_detail.get("layout_resize"))
    if not all(resize.get(key) is True for key in ("changed", "persisted", "reset")):
        failures.append("Agent detail layout resize/persistence/reset was not verified")
    if agent_detail.get("pass") is not True:
        failures.append("Agent detail evidence did not pass")

    locale_coverage = _mapping(artifact.get("locale_coverage"))
    supported = locale_coverage.get("supported")
    checks = _mapping(locale_coverage.get("checks"))
    if supported != list(SUPPORTED_LOCALES):
        failures.append("locale coverage does not declare the exact four supported locales")
    for locale in SUPPORTED_LOCALES:
        check = _mapping(checks.get(locale))
        if not check:
            failures.append(f"{locale}: locale browser evidence is missing")
            continue
        if not check.get("shell_text") or not check.get("village_text"):
            failures.append(f"{locale}: shell or village visible copy was empty")
        help_copy = _mapping(check.get("help_copy"))
        expected = EXPECTED_LOCALE_COPY[locale]
        if not all(help_copy.get(key) for key in ("aria_label", "tooltip", "title")):
            failures.append(f"{locale}: localized Help control accessible copy was incomplete")
        if (help_copy.get("aria_label") != expected["help_aria"]
                or any(help_copy.get(key) != expected["help"] for key in ("tooltip", "title"))):
            failures.append(f"{locale}: Help control did not use the selected locale")
        if check.get("document_lang") != expected["document_lang"]:
            failures.append(f"{locale}: document language did not match the selected locale")
        shell_copy = _mapping(check.get("shell_copy"))
        if any(shell_copy.get(key) != expected[key] for key in ("agents_title", "timeline_title", "language_label")):
            failures.append(f"{locale}: command-deck shell did not use the selected locale")
        village_copy = _mapping(check.get("village_copy"))
        if any(village_copy.get(key) != expected[key] for key in ("rest_cabin", "maker_workshop")):
            failures.append(f"{locale}: village did not use the selected locale")
        if check.get("current_agent_state") != expected["current_agent_state"]:
            failures.append(f"{locale}: current agent state did not use the selected locale")
        if not check.get("copy_signature"):
            failures.append(f"{locale}: localized copy signature was empty")
        if check.get("missing_text") != []:
            failures.append(f"{locale}: untranslated or empty product copy remains")
        if check.get("pass") is not True:
            failures.append(f"{locale}: locale switch did not pass")
    for key, label in (
        ("shell_signature", "shell"),
        ("village_signature", "village"),
        ("help_signature", "Help"),
    ):
        signatures = {str(_mapping(checks.get(locale)).get(key) or "") for locale in SUPPORTED_LOCALES}
        if "" in signatures or len(signatures) != len(SUPPORTED_LOCALES):
            failures.append(f"locale coverage did not produce four distinct {label} signatures")
    if locale_coverage.get("unique_signatures") is not True:
        failures.append("locale coverage did not record distinct localized signatures")

    overview = _mapping(artifact.get("agent_overview"))
    selection = _mapping(overview.get("selection"))
    if (not selection.get("id") or selection.get("card_selected") is not True
            or selection.get("village_synced") is not True or selection.get("synchronized") is not True):
        failures.append("agent roster and village selection were not synchronized")
    signal_kinds = set(overview.get("signal_kinds") or [])
    for signal_kind in ("busy", "offline"):
        if signal_kind not in signal_kinds:
            failures.append(f"{signal_kind} ECG semantics were not verified")
    if overview.get("reduced_motion_semantics") is not True:
        failures.append("ECG reduced motion semantics were not verified")
    if int(overview.get("external_copy_nodes") or 0) <= 0:
        failures.append("agent roster external copy markers were not verified")
    if overview.get("pass") is not True:
        failures.append("agent overview did not pass")

    routes = _mapping(artifact.get("hook_routes"))
    for role, expected in (("main", ("clone_bay", "standby_dock")), ("subagent", ("clone_bay", "tool_forge"))):
        route = _mapping(routes.get(role))
        if (route.get("from_room"), route.get("to_room")) != expected:
            failures.append(f"{role}: expected Hook route {expected[0]} -> {expected[1]}")
        if route.get("position_changed") is not True:
            failures.append(f"{role}: rendered position did not change")

    cabin = _mapping(artifact.get("starting_cabin"))
    if cabin.get("building_id") != "rest-cabin" or cabin.get("opened") is not True:
        failures.append("Starting Cabin was not opened through the supported cutaway focus path")
    if cabin.get("agent_inside") is not True or not cabin.get("agent_id"):
        failures.append("Starting Cabin did not contain a visible agent")
    if int(cabin.get("saved_furniture_count") or 0) <= 0:
        failures.append("Starting Cabin did not prove visible furniture through its saved UI layout")

    furniture = _mapping(artifact.get("furniture_invariants"))
    if furniture.get("source_house") != "rest-cabin" or furniture.get("target_house") != "maker-workshop":
        failures.append("furniture invariance did not cover the Starting Cabin and a differently sized house")
    for key in ("saved", "reloaded", "cross_house"):
        if furniture.get(key) is not True:
            failures.append(f"furniture {key.replace('_', ' ')} evidence failed")
    for key, label in (
        ("created_via_ui", "created via UI"),
        ("placed_via_ui", "placed via UI"),
        ("save_changed_target", "explicit target save"),
    ):
        if furniture.get(key) is not True:
            failures.append(f"furniture {label} evidence failed")
    geometry = _mapping(furniture.get("geometry"))
    for key in ("size", "aspect_ratio", "rotation", "member_spacing"):
        if geometry.get(key) is not True:
            failures.append(f"furniture geometry invariant failed: {key}")

    screenshots = _mapping(artifact.get("screenshots"))
    village = _mapping(screenshots.get("village"))
    cabin_shot = _mapping(screenshots.get("cabin"))
    if village.get("path") != "docs/assets/command-deck-village.png" or village.get("pass") is not True:
        failures.append("village screenshot was not captured at the canonical path")
    village_agents = village.get("agents") if isinstance(village.get("agents"), list) else []
    if len(village_agents) < 2:
        failures.append("village screenshot does not prove a main agent and subagent")
    if cabin_shot.get("path") != "docs/assets/starting-cabin-agent.png" or cabin_shot.get("pass") is not True:
        failures.append("cabin screenshot was not captured at the canonical path")
    if not cabin_shot.get("agents"):
        failures.append("cabin screenshot does not identify its visible agent")
    if int(cabin_shot.get("saved_furniture_count") or 0) <= 0:
        failures.append("cabin screenshot does not identify its saved visible furniture")
    for label, shot in (("village", village), ("cabin", cabin_shot)):
        if (shot.get("width"), shot.get("height")) != (1440, 900):
            failures.append(f"{label} screenshot is not 1440x900")

    if artifact.get("console_errors"):
        failures.append("browser console errors: " + " | ".join(map(str, artifact["console_errors"][:5])))
    if artifact.get("page_errors"):
        failures.append("browser page errors: " + " | ".join(map(str, artifact["page_errors"][:5])))
    return failures


class BrowserFailure(RuntimeError):
    pass


class ChromiumDevTools:
    """Small synchronous CDP client backed by the already-installed Chromium."""

    def __init__(self, viewport: Viewport, timeout_seconds: float):
        self.viewport = viewport
        self.timeout_seconds = timeout_seconds
        self.profile: tempfile.TemporaryDirectory[str] | None = None
        self.process: subprocess.Popen[bytes] | None = None
        self.socket: Any = None
        self.sequence = 0
        self.events: list[dict[str, Any]] = []
        self.console_errors: list[str] = []
        self.page_errors: list[str] = []

    def __enter__(self) -> "ChromiumDevTools":
        external_port = os.environ.get("PIXELVERSE_CDP_PORT")
        if external_port:
            port = int(external_port)
        else:
            executable = shutil.which("chromium") or shutil.which("chromium-browser") or shutil.which("google-chrome")
            if not executable:
                raise BrowserFailure("Chromium executable is required")
            self.profile = tempfile.TemporaryDirectory(prefix="command-deck-cdp-", dir=TMP)
            stderr_path = TMP / "command_deck_chromium.stderr.log"
            stderr = stderr_path.open("wb")
            self.process = subprocess.Popen(
                [
                    executable,
                    "--headless=new",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--disable-dev-shm-usage",
                    "--hide-scrollbars",
                    "--remote-debugging-port=0",
                    f"--user-data-dir={self.profile.name}",
                    f"--window-size={self.viewport.width},{self.viewport.height}",
                    "about:blank",
                ],
                stdout=subprocess.DEVNULL,
                stderr=stderr,
            )
            stderr.close()
            active_port = Path(self.profile.name) / "DevToolsActivePort"
            deadline = time.monotonic() + self.timeout_seconds
            while time.monotonic() < deadline and not active_port.exists():
                if self.process.poll() is not None:
                    raise BrowserFailure(f"Chromium exited before DevTools became ready; see {stderr_path}")
                time.sleep(0.05)
            if not active_port.exists():
                raise BrowserFailure("Chromium DevTools port did not become ready")
            port = int(active_port.read_text(encoding="utf-8").splitlines()[0])
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/list", timeout=5) as response:
            targets = json.load(response)
        page = next((target for target in targets if target.get("type") == "page"), None)
        if not page:
            raise BrowserFailure("Chromium did not expose a page target")
        from websockets.sync.client import connect  # type: ignore[import-not-found]

        self.socket = connect(page["webSocketDebuggerUrl"], open_timeout=5, close_timeout=2, max_size=None)
        for domain in ("Page", "Runtime", "Log", "Network"):
            self.call(f"{domain}.enable")
        self.set_viewport(self.viewport.width, self.viewport.height)
        return self

    def __exit__(self, _kind: Any, _value: Any, _traceback: Any) -> None:
        try:
            self.socket and self.socket.close()
        finally:
            if self.process and self.process.poll() is None:
                self.process.terminate()
                try:
                    self.process.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    self.process.kill()
            self.profile and self.profile.cleanup()

    def _record_event(self, event: dict[str, Any]) -> None:
        self.events.append(event)
        method = event.get("method")
        params = _mapping(event.get("params"))
        if method == "Runtime.exceptionThrown":
            details = _mapping(params.get("exceptionDetails"))
            exception = _mapping(details.get("exception"))
            self.page_errors.append(str(exception.get("description") or details.get("text") or "Runtime exception"))
        elif method == "Runtime.consoleAPICalled" and params.get("type") in {"error", "assert"}:
            values = [_mapping(item).get("value") or _mapping(item).get("description") for item in params.get("args", [])]
            self.console_errors.append(" ".join(str(value) for value in values if value is not None))
        elif method == "Log.entryAdded":
            entry = _mapping(params.get("entry"))
            if entry.get("level") == "error" and "Failed to load resource" not in str(entry.get("text", "")):
                self.console_errors.append(str(entry.get("text") or "Log error"))

    def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self.sequence += 1
        request_id = self.sequence
        self.socket.send(json.dumps({"id": request_id, "method": method, "params": params or {}}))
        deadline = time.monotonic() + self.timeout_seconds
        while time.monotonic() < deadline:
            message = json.loads(self.socket.recv(timeout=max(0.1, deadline - time.monotonic())))
            if message.get("id") == request_id:
                if "error" in message:
                    raise BrowserFailure(f"CDP {method} failed: {message['error']}")
                return _mapping(message.get("result"))
            self._record_event(message)
        raise BrowserFailure(f"Timed out waiting for CDP {method}")

    def flush_events(self) -> None:
        while True:
            try:
                message = json.loads(self.socket.recv(timeout=0.02))
            except TimeoutError:
                return
            self._record_event(message)

    def evaluate(self, expression: str) -> Any:
        result = self.call("Runtime.evaluate", {
            "expression": expression,
            "awaitPromise": True,
            "returnByValue": True,
            "userGesture": True,
        })
        if result.get("exceptionDetails"):
            raise BrowserFailure(f"JavaScript evaluation failed: {result['exceptionDetails']}")
        remote = _mapping(result.get("result"))
        if remote.get("subtype") == "error":
            raise BrowserFailure(str(remote.get("description") or "JavaScript error"))
        return remote.get("value")

    def wait_value(self, expression: str, description: str, timeout: float | None = None) -> Any:
        """Poll an expression whose serialized value is the evidence being awaited."""
        deadline = time.monotonic() + (timeout or self.timeout_seconds)
        last: Any = None
        while time.monotonic() < deadline:
            try:
                last = self.evaluate(expression)
            except BrowserFailure:
                last = None
            if last:
                return last
            time.sleep(0.12)
        raise BrowserFailure(f"Timed out waiting for {description}; last value={last!r}")

    def wait_until(self, expression: str, description: str, timeout: float | None = None) -> bool:
        """Poll a predicate after coercing it to boolean inside the browser realm."""
        return bool(self.wait_value(f"Boolean(({expression}))", description, timeout))

    def set_viewport(self, width: int, height: int) -> None:
        self.call("Emulation.setDeviceMetricsOverride", {
            "width": width,
            "height": height,
            "deviceScaleFactor": 1,
            "mobile": False,
            "screenWidth": width,
            "screenHeight": height,
        })

    def mouse(self, event_type: str, x: float, y: float, *, button: str = "none", buttons: int = 0) -> None:
        self.call("Input.dispatchMouseEvent", {
            "type": event_type,
            "x": x,
            "y": y,
            "button": button,
            "buttons": buttons,
            "clickCount": 1 if event_type in {"mousePressed", "mouseReleased"} else 0,
        })

    def click_point(self, x: float, y: float, *, button: str = "left") -> None:
        mask = 2 if button == "right" else 1
        self.mouse("mouseMoved", x, y)
        self.mouse("mousePressed", x, y, button=button, buttons=mask)
        self.mouse("mouseReleased", x, y, button=button)

    def key(self, key: str, code: str | None = None) -> None:
        payload = {"key": key, "code": code or key, "windowsVirtualKeyCode": 27 if key == "Escape" else 0}
        self.call("Input.dispatchKeyEvent", {"type": "keyDown", **payload})
        self.call("Input.dispatchKeyEvent", {"type": "keyUp", **payload})

    def drag(
        self,
        start: tuple[float, float],
        end: tuple[float, float],
        *,
        steps: int = 12,
    ) -> None:
        self.mouse("mouseMoved", *start)
        time.sleep(0.025)
        self.mouse("mousePressed", *start, button="left", buttons=1)
        time.sleep(0.035)
        for step in range(1, steps + 1):
            ratio = step / steps
            self.mouse(
                "mouseMoved",
                start[0] + (end[0] - start[0]) * ratio,
                start[1] + (end[1] - start[1]) * ratio,
                buttons=1,
            )
            time.sleep(0.018)
        time.sleep(0.035)
        self.mouse("mouseReleased", *end, button="left")
        time.sleep(0.025)

    def navigate(self, url: str) -> None:
        self.call("Page.navigate", {"url": url})
        self.wait_until("document.readyState === 'complete'", "top-level page load")

    def reload(self) -> None:
        self.call("Page.reload", {"ignoreCache": True})
        time.sleep(0.15)
        self.wait_until("document.readyState === 'complete'", "page reload")

    def screenshot(self, path: Path) -> tuple[int, int]:
        payload = self.call("Page.captureScreenshot", {
            "format": "png",
            "fromSurface": True,
            "captureBeyondViewport": False,
        })
        data = base64.b64decode(payload["data"])
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        return png_dimensions(path)


def png_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()[:24]
    if len(data) != 24 or not data.startswith(b"\x89PNG\r\n\x1a\n") or data[12:16] != b"IHDR":
        raise BrowserFailure(f"Invalid PNG: {path}")
    return struct.unpack(">II", data[16:24])


def post_event(base_url: str, payload: dict[str, Any]) -> dict[str, Any]:
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/api/event",
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=10) as response:
            result = json.load(response)
    except urllib.error.URLError as exc:
        raise BrowserFailure(f"Could not POST synthetic browser event: {exc}") from exc
    if not result.get("ok"):
        raise BrowserFailure(f"Synthetic browser event was rejected: {result}")
    return result


def synthetic_event(agent: str, role: str, event: str, state: str, room: str, message: str) -> dict[str, Any]:
    return {
        "agent_type": "codex",
        "agent": agent,
        "name": "Command Deck Main" if role == "main_agent" else "Command Deck Subagent",
        "role": role,
        "event": event,
        "state": state,
        "target_room": room,
        "message": message,
        "tool_names": ["browser", "mcp"] if room == "tool_forge" else ["delegate_task"],
        "color": "#72e2a5" if role == "main_agent" else "#a78bfa",
        "instance_name": "command-deck-browser-smoke",
    }


READY_EXPRESSION = """
(() => {
  const frame = document.querySelector('#pixelworld-frame');
  const child = frame?.contentDocument;
  const canvas = child?.querySelector('#game-root canvas');
  return Boolean(document.readyState === 'complete' && child?.readyState === 'complete'
    && canvas && canvas.getBoundingClientRect().width > 0
    && child.querySelector('#world-status-layer'));
})()
"""


def wait_world(browser: ChromiumDevTools) -> None:
    browser.wait_until(READY_EXPRESSION, "Pixelworld fonts/assets/world readiness")
    browser.evaluate("""
      (async () => {
        await document.fonts.ready;
        const child = document.querySelector('#pixelworld-frame')?.contentDocument;
        if (child?.fonts) await child.fonts.ready;
        return true;
      })()
    """)


def click(browser: ChromiumDevTools, selector: str, *, child: bool = False) -> bool:
    selector_json = json.dumps(selector)
    root = "document.querySelector('#pixelworld-frame')?.contentDocument" if child else "document"
    result = _mapping(browser.evaluate(f"""
      (() => {{
        const el = ({root})?.querySelector({selector_json});
        if (!el) return {{ found: false, tag: '' }};
        const tag = el.tagName?.toLowerCase() || el.constructor?.name || 'unknown';
        if (typeof el.click !== 'function') return {{ found: true, clickable: false, tag }};
        el.click();
        return {{ found: true, clickable: true, tag }};
      }})()
    """))
    tag = str(result.get("tag") or "unknown")
    if not result.get("found"):
        raise BrowserFailure(f"JS click selector {selector!r} did not resolve an element")
    if result.get("clickable") is not True:
        raise BrowserFailure(
            f"JS click selector {selector!r} resolved <{tag}> without click(); use click_center for pointer controls"
        )
    return True


def click_center(browser: ChromiumDevTools, selector: str, *, child: bool = False) -> dict[str, Any]:
    selector_json = json.dumps(selector)
    child_json = "true" if child else "false"
    result = _mapping(browser.evaluate(f"""
      (() => {{
        const child = {child_json};
        const frame = child ? document.querySelector('#pixelworld-frame') : null;
        const root = child ? frame?.contentDocument : document;
        const node = root?.querySelector({selector_json});
        if (!node) return {{ found: false, tag: '' }};
        const outer = child ? frame.getBoundingClientRect() : {{ left: 0, top: 0 }};
        const inner = node.getBoundingClientRect();
        return {{ found: true, tag: node.tagName?.toLowerCase() || node.constructor?.name || 'unknown',
          left: outer.left + inner.left, top: outer.top + inner.top,
          width: inner.width, height: inner.height }};
      }})()
    """))
    tag = str(result.get("tag") or "unknown")
    if not result.get("found"):
        raise BrowserFailure(f"Pointer click selector {selector!r} did not resolve an element")
    width = float(result.get("width") or 0)
    height = float(result.get("height") or 0)
    if width <= 0 or height <= 0:
        raise BrowserFailure(f"Pointer click selector {selector!r} resolved hidden or empty <{tag}> ({width}x{height})")
    browser.click_point(float(result["left"]) + width / 2, float(result["top"]) + height / 2)
    return result


def child_rect(browser: ChromiumDevTools, selector: str) -> dict[str, float]:
    result = browser.evaluate(f"""
      (() => {{
        const frame = document.querySelector('#pixelworld-frame');
        const node = frame?.contentDocument?.querySelector({json.dumps(selector)});
        if (!frame || !node) return null;
        const outer = frame.getBoundingClientRect();
        const inner = node.getBoundingClientRect();
        return {{ left: outer.left + inner.left, top: outer.top + inner.top,
          width: inner.width, height: inner.height, right: outer.left + inner.right,
          bottom: outer.top + inner.bottom }};
      }})()
    """)
    if not isinstance(result, dict):
        raise BrowserFailure(f"Missing child rectangle for {selector}")
    return {key: float(value) for key, value in result.items()}


def interior_marquee_points(
    room: dict[str, float],
    *,
    columns: int = 14,
    rows: int = 9,
) -> tuple[tuple[float, float], tuple[float, float]]:
    """Return safe empty-corner points inside the fitted room content."""
    cell = min(room["width"] / columns, room["height"] / rows)
    content_left = room["left"] + (room["width"] - columns * cell) / 2
    content_top = room["top"]
    quarter_cell = cell / 4
    return (
        (content_left + quarter_cell, content_top + rows * cell - quarter_cell),
        (content_left + columns * cell - quarter_cell, content_top + quarter_cell),
    )


def select_furniture_group_via_marquee(browser: ChromiumDevTools) -> dict[str, Any]:
    """Select the room's furniture with real pointer input and expose Group.

    The room label layer is the DOM projection of the editor's actual room
    viewport. Hook labels are intentionally omitted here: they exist only for
    selected semantic furniture and therefore cannot establish selection.
    """
    room = child_rect(browser, '.cutaway-room-labels[data-region="room"]')
    start, end = interior_marquee_points(room)
    browser.drag(start, end)
    diagnostics = _mapping(browser.evaluate(f"""
      (() => {{
        const frame = document.querySelector('#pixelworld-frame');
        const child = frame?.contentDocument;
        const outer = frame?.getBoundingClientRect();
        const describe = (node) => node
          ? `${{node.tagName?.toLowerCase() || 'unknown'}}${{node.id ? '#' + node.id : ''}}${{node.className ? '.' + String(node.className).trim().replace(/\\s+/g, '.') : ''}}`
          : '';
        const hit = (x, y) => describe(child?.elementFromPoint(x - outer.left, y - outer.top));
        return {{
          status: child?.querySelector('.cutaway-dom-status')?.textContent?.trim() || '',
          inspector_disabled: Boolean(child?.querySelector('[data-action="inspector"]')?.disabled),
          toolbar_hidden: Boolean(child?.querySelector('.cutaway-room-toolbar')?.hidden),
          edit_button_text: child?.querySelector('[data-action="edit"]')?.textContent?.trim() || '',
          hook_label_count: child?.querySelectorAll('.cutaway-room-label--hook').length || 0,
          start_hit: outer ? hit({start[0]}, {start[1]}) : '',
          end_hit: outer ? hit({end[0]}, {end[1]}) : '',
        }};
      }})()
    """))
    match = re.search(r"(\d+) items selected", str(diagnostics.get("status") or ""))
    selected_count = int(match.group(1)) if match else 0
    edit_mode = diagnostics.get("edit_button_text") == "✓" and diagnostics.get("toolbar_hidden") is False
    diagnostics.update({"room_rect": room, "selected_count": selected_count, "edit_mode": edit_mode})
    if not edit_mode or selected_count < 2:
        raise BrowserFailure(
            "Marquee did not select multiple furniture items: "
            + json.dumps(diagnostics, ensure_ascii=False, sort_keys=True)
        )
    group_expression = (
        "Boolean(document.querySelector('#pixelworld-frame')?.contentDocument"
        "?.querySelector('[data-context-action=\"group\"]'))"
    )
    # These normalized points are centers of distinct furnished floor zones in
    # the canonical cabin. Empty misses are harmless and preserve the marquee.
    for x_ratio, y_ratio in (
        (0.19, 0.16), (0.49, 0.16), (0.91, 0.16), (0.84, 0.44),
        (0.32, 0.63), (0.51, 0.64), (0.64, 0.62),
    ):
        browser.click_point(
            room["left"] + room["width"] * x_ratio,
            room["top"] + room["height"] * y_ratio,
            button="right",
        )
        time.sleep(0.10)
        if bool(browser.evaluate(group_expression)):
            break
    if not bool(browser.evaluate(group_expression)):
        diagnostics["candidate_count"] = 7
        diagnostics["group_action_visible"] = False
        raise BrowserFailure(
            "Selected furniture did not expose the Group action: "
            + json.dumps(diagnostics, ensure_ascii=False, sort_keys=True)
        )
    browser.wait_until(group_expression, "multi-furniture group UI action")
    return {**diagnostics, "group_action_visible": True}


def click_world_building(browser: ChromiumDevTools, building_id: str) -> None:
    evidence = _mapping(browser.evaluate(f"""
      (() => {{
        const frame = document.querySelector('#pixelworld-frame');
        const child = frame?.contentDocument;
        const label = child?.querySelector('.world-building-label[data-building-id={json.dumps(building_id)}]');
        const canvas = child?.querySelector('canvas');
        if (!frame || !label || !canvas) return {{ found: false }};
        const outer = frame.getBoundingClientRect();
        const canvasRect = canvas.getBoundingClientRect();
        const number = (key) => Number(label.dataset[key]);
        const left = number('hitRegionLeft');
        const top = number('hitRegionTop');
        const width = number('hitRegionWidth');
        const height = number('hitRegionHeight');
        return {{
          found: [left, top, width, height].every(Number.isFinite),
          left: outer.left + left, top: outer.top + top, width, height,
          label_height: label.getBoundingClientRect().height,
          canvas: {{ left: outer.left + canvasRect.left, top: outer.top + canvasRect.top,
            width: canvasRect.width, height: canvasRect.height }},
        }};
      }})()
    """))
    width = float(evidence.get("width") or 0)
    height = float(evidence.get("height") or 0)
    if not evidence.get("found") or width <= 0 or height <= 0:
        raise BrowserFailure(
            f"Missing authoritative building hit region for {building_id}: "
            + json.dumps(evidence, ensure_ascii=False, sort_keys=True)
        )
    center_x = float(evidence["left"]) + width / 2
    center_y = float(evidence["top"]) + height / 2
    canvas = _mapping(evidence.get("canvas"))
    if not (
        float(canvas.get("left") or 0) <= center_x <= float(canvas.get("left") or 0) + float(canvas.get("width") or 0)
        and float(canvas.get("top") or 0) <= center_y <= float(canvas.get("top") or 0) + float(canvas.get("height") or 0)
    ):
        raise BrowserFailure(
            f"Building hit center fell outside the canvas for {building_id}: "
            + json.dumps(evidence, ensure_ascii=False, sort_keys=True)
        )
    browser.click_point(center_x, center_y)
    try:
        browser.wait_until(
            "document.body.dataset.pixelworldCutaway === 'open' && document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-dom-panel')",
            f"{building_id} cutaway opened by a real village click",
        )
    except BrowserFailure as exc:
        raise BrowserFailure(
            f"Authoritative village hit-region click did not open {building_id}: "
            + json.dumps(evidence, ensure_ascii=False, sort_keys=True)
        ) from exc


def close_cutaway_to_village(browser: ChromiumDevTools, next_building_id: str) -> None:
    """Use the public Close control and wait until village labels return."""
    state = _mapping(browser.evaluate("""
      (() => {
        const child = document.querySelector('#pixelworld-frame')?.contentDocument;
        const panel = child?.querySelector('.cutaway-dom-panel');
        return {
          dataset: document.body.dataset.pixelworldCutaway || '',
          panel_open: Boolean(panel),
          panel_title: panel?.querySelector('h2')?.textContent?.trim() || '',
          building_labels: [...(child?.querySelectorAll('.world-building-label[data-building-id]') || [])]
            .map((node) => node.dataset.buildingId),
        };
      })()
    """))
    if state.get("panel_open"):
        click(browser, '.cutaway-dom-panel [data-action="close"]', child=True)
    predicate = (
        "document.body.dataset.pixelworldCutaway !== 'open' "
        "&& !document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-dom-panel') "
        f"&& document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.world-building-label[data-building-id=\"{next_building_id}\"]')"
    )
    try:
        browser.wait_until(predicate, f"restored cutaway close and {next_building_id} world label")
    except BrowserFailure as exc:
        diagnostics = browser.evaluate("""
          (() => {
            const child = document.querySelector('#pixelworld-frame')?.contentDocument;
            const panel = child?.querySelector('.cutaway-dom-panel');
            return {
              dataset: document.body.dataset.pixelworldCutaway || '',
              panel_open: Boolean(panel),
              panel_title: panel?.querySelector('h2')?.textContent?.trim() || '',
              panel_status: panel?.querySelector('.cutaway-dom-status')?.textContent?.trim() || '',
              building_labels: [...(child?.querySelectorAll('.world-building-label[data-building-id]') || [])]
                .map((node) => node.dataset.buildingId),
            };
          })()
        """)
        raise BrowserFailure(
            f"Village did not return after public cutaway Close: {json.dumps(diagnostics, ensure_ascii=False, sort_keys=True)}"
        ) from exc


def layout_snapshot(browser: ChromiumDevTools) -> dict[str, Any]:
    return browser.evaluate("""
      (() => {
        const workspace = document.querySelector('.map-first-workspace');
        const world = document.querySelector('#world');
        const rect = (node) => {
          if (!node) return [0, 0, 0, 0];
          const box = node.getBoundingClientRect();
          return [Math.round(box.left), Math.round(box.top), Math.round(box.width), Math.round(box.height)];
        };
        const worldRect = world.getBoundingClientRect();
        const panels = [...document.querySelectorAll('[data-command-region]:not([data-command-region="center"])')]
          .filter((node) => {
            const style = getComputedStyle(node); const box = node.getBoundingClientRect();
            return style.display !== 'none' && style.visibility !== 'hidden' && box.width > 0 && box.height > 0;
          });
        const overlaps = panels.flatMap((node) => {
          const box = node.getBoundingClientRect();
          const width = Math.min(worldRect.right, box.right) - Math.max(worldRect.left, box.left);
          const height = Math.min(worldRect.bottom, box.bottom) - Math.max(worldRect.top, box.top);
          return width > 1 && height > 1 ? [`world:${node.id || node.dataset.commandRegion}`] : [];
        });
        return {
          mode: workspace?.dataset.commandDeckMode || '',
          world: rect(world),
          top: rect(document.querySelector('#top-status-bar')),
          roster: rect(document.querySelector('#agent-roster')),
          detail: rect(document.querySelector('#agent-detail:not([hidden])')),
          detailMode: document.querySelector('#agent-detail')?.dataset.agentDetailMode || '',
          horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          overlaps,
        };
      })()
    """)


def exercise_layout(browser: ChromiumDevTools, viewport: Viewport) -> dict[str, Any]:
    browser.set_viewport(viewport.width, viewport.height)
    browser.evaluate("window.dispatchEvent(new Event('resize')); true")
    browser.wait_until(
        f"document.querySelector('.map-first-workspace')?.dataset.commandDeckMode === {json.dumps(viewport.mode)}",
        f"{viewport.name} command-deck mode",
    )
    bounds = layout_snapshot(browser)
    world = bounds["world"]
    roster = bounds["roster"]
    roster_visible = roster[2] > 0 and roster[3] > 0
    village_visible = world[2] > 0 and world[3] > 0
    village_larger = world[2] * world[3] > roster[2] * roster[3]
    return {
        "name": viewport.name,
        "width": viewport.width,
        "height": viewport.height,
        "mode": bounds.pop("mode"),
        "layout_bounds": bounds,
        "roster_visible": roster_visible,
        "village_visible": village_visible,
        "village_larger_than_roster": village_larger,
        "pass": roster_visible and village_visible and village_larger and not bounds["overlaps"]
        and bounds["horizontalOverflow"] is False,
    }


def agent_detail_evidence(browser: ChromiumDevTools, plan: BrowserSmokePlan, agent_id: str) -> dict[str, Any]:
    selector = f'.agent-roster-card[data-selection-id="{agent_id}"]'
    viewport_evidence: dict[str, Any] = {}
    roster_activation: dict[str, Any] = {}
    focus_restore = True
    layout_resize = {"changed": False, "persisted": False, "reset": False}

    if not browser.evaluate("document.querySelector('#agent-detail')?.hidden"):
        browser.key("Escape")
        browser.wait_until(
            "document.querySelector('#agent-detail')?.hidden",
            "close pre-opened Agent detail",
        )

    for index, viewport in enumerate(plan.viewports):
        browser.set_viewport(viewport.width, viewport.height)
        browser.evaluate("window.dispatchEvent(new Event('resize')); true")
        browser.wait_until(f"document.querySelector({json.dumps(selector)})", f"{viewport.name} roster detail trigger")
        browser.evaluate(f"document.querySelector({json.dumps(selector)}).focus(); true")
        click(browser, selector)
        browser.wait_until(
            f"!document.querySelector('#agent-detail')?.hidden && document.querySelector('#agent-detail')?.dataset.agentId === {json.dumps(agent_id)}",
            f"{viewport.name} Agent detail open",
        )
        evidence = _mapping(browser.evaluate("""
          (() => {
            const detail = document.querySelector('#agent-detail');
            const box = detail.getBoundingClientRect();
            return {
              id: detail.dataset.agentId || '',
              detailMode: detail.dataset.agentDetailMode || '',
              width: Math.round(box.width), height: Math.round(box.height),
              horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
              external_copy_nodes: detail.querySelectorAll('[data-external-copy="true"]').length,
            };
          })()
        """))
        expected_mode = "drawer" if viewport.mode == "desktop" else "dialog"
        evidence["pass"] = bool(
            evidence.get("id") == agent_id
            and evidence.get("detailMode") == expected_mode
            and evidence.get("horizontalOverflow") is False
            and int(evidence.get("external_copy_nodes") or 0) > 0
        )
        viewport_evidence[viewport.name] = evidence
        if index == 0:
            roster_activation = {"id": evidence.get("id"), "opened": True}
        browser.key("Escape")
        browser.wait_until("document.querySelector('#agent-detail')?.hidden", f"{viewport.name} Agent detail Escape close")
        evidence["focus_restored"] = bool(browser.evaluate(
            f"document.activeElement === document.querySelector({json.dumps(selector)})"
        ))
        evidence["active_element"] = browser.evaluate(
            "document.activeElement?.className || document.activeElement?.id || document.activeElement?.tagName || ''"
        )
        focus_restore = focus_restore and evidence["focus_restored"]
        if index == 0:
            before = _mapping(browser.evaluate("JSON.parse(localStorage.getItem('pixelverse:village-first-layout:v1') || '{}')"))
            browser.evaluate("document.querySelector('#village-top-splitter').focus(); true")
            browser.key("ArrowDown")
            changed = _mapping(browser.evaluate("JSON.parse(localStorage.getItem('pixelverse:village-first-layout:v1') || '{}')"))
            browser.reload(); wait_world(browser)
            persisted = _mapping(browser.evaluate("JSON.parse(localStorage.getItem('pixelverse:village-first-layout:v1') || '{}')"))
            browser.evaluate("document.querySelector('#village-top-splitter').dispatchEvent(new MouseEvent('dblclick', {bubbles:true})); true")
            reset = _mapping(browser.evaluate("JSON.parse(localStorage.getItem('pixelverse:village-first-layout:v1') || '{}')"))
            layout_resize = {
                "changed": changed.get("topHeight") != before.get("topHeight"),
                "persisted": persisted.get("topHeight") == changed.get("topHeight"),
                "reset": reset.get("topHeight") == 56,
            }

    browser.set_viewport(1440, 900)
    browser.evaluate("window.dispatchEvent(new Event('resize')); true")
    village_activation = {"id": agent_id, "opened": False}
    browser.evaluate(f"""
      (() => {{
        const frame = document.querySelector('#pixelworld-frame');
        window.dispatchEvent(new MessageEvent('message', {{
          data: {{ type: 'pixelverse.command.focus', selection: {{ kind: 'agent', id: {json.dumps(agent_id)} }}, sequence: Date.now() }},
          origin: location.origin,
          source: frame.contentWindow,
        }}));
        return true;
      }})()
    """)
    village_activation["opened"] = bool(browser.wait_until(
        f"!document.querySelector('#agent-detail')?.hidden && document.querySelector('#agent-detail')?.dataset.agentId === {json.dumps(agent_id)}",
        "village Agent detail activation through the supported bridge",
    ))
    browser.key("Escape")

    passed = bool(roster_activation.get("opened") and village_activation.get("opened") and focus_restore
                  and all(layout_resize.values()) and all(item.get("pass") for item in viewport_evidence.values()))
    return {"roster_activation": roster_activation, "village_activation": village_activation,
            "viewports": viewport_evidence, "focus_restore": focus_restore,
            "layout_resize": layout_resize, "pass": passed}


def agent_dom_state(browser: ChromiumDevTools, agent_id: str) -> dict[str, Any]:
    return browser.evaluate(f"""
      (() => {{
        const child = document.querySelector('#pixelworld-frame')?.contentDocument;
        const node = child?.querySelector('.world-agent-status[data-agent-id={json.dumps(agent_id)}]');
        if (!node) return null;
        const box = node.getBoundingClientRect();
        return {{ transform: node.style.transform, hidden: node.hidden, x: box.x, y: box.y }};
      }})()
    """) or {}


def wait_agent(browser: ChromiumDevTools, agent_id: str) -> dict[str, Any]:
    browser.wait_until(
        f"document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.world-agent-status[data-agent-id={json.dumps(agent_id)}]')?.style.transform",
        f"rendered agent {agent_id}",
    )
    return agent_dom_state(browser, agent_id)


def wait_agent_displacement(
    browser: ChromiumDevTools,
    agent_id: str,
    initial_transform: str,
    description: str,
) -> dict[str, Any]:
    """Capture the changed transform in the same browser evaluation that observes it."""
    return _mapping(browser.wait_value(f"""
      (() => {{
        const child = document.querySelector('#pixelworld-frame')?.contentDocument;
        const node = child?.querySelector('.world-agent-status[data-agent-id={json.dumps(agent_id)}]');
        if (!node?.style.transform || node.style.transform === {json.dumps(initial_transform)}) return null;
        const box = node.getBoundingClientRect();
        return {{ transform: node.style.transform, hidden: node.hidden, x: box.x, y: box.y }};
      }})()
    """, description))


def locale_evidence(browser: ChromiumDevTools, locale: str) -> dict[str, Any]:
    browser.evaluate(f"""
      (() => {{
        const select = document.querySelector('#locale-select');
        select.value = {json.dumps(locale)};
        select.dispatchEvent(new Event('change', {{ bubbles: true }}));
        return true;
      }})()
    """)
    browser.wait_until(
        f"document.body.dataset.locale === {json.dumps(locale)} && document.querySelector('#pixelworld-frame')?.contentDocument?.documentElement.lang === {json.dumps(locale)}",
        f"{locale} shell and village locale switch",
    )
    return browser.evaluate("""
      (() => {
        const child = document.querySelector('#pixelworld-frame')?.contentDocument;
        const mark = (node, attribute) => `${node.id || node.className || node.tagName}:${attribute}`;
        const missing = [
          ...[...document.querySelectorAll('[data-i18n]')]
            .filter((node) => !(node.textContent || '').trim()).map((node) => mark(node, 'text')),
          ...[...document.querySelectorAll('[data-i18n-aria-label]')]
            .filter((node) => !(node.getAttribute('aria-label') || '').trim()).map((node) => mark(node, 'aria-label')),
          ...[...document.querySelectorAll('[data-i18n-title]')]
            .filter((node) => !(node.title || '').trim()).map((node) => mark(node, 'title')),
          ...[...document.querySelectorAll('[data-i18n-tooltip]')]
            .filter((node) => !(node.dataset.tooltip || '').trim()).map((node) => mark(node, 'tooltip')),
          ...[...child.querySelectorAll('[aria-label]')]
            .filter((node) => !(node.getAttribute('aria-label') || '').trim()).map((node) => mark(node, 'aria-label')),
        ];
        const shellNodes = [...document.querySelectorAll('[data-i18n], [data-i18n-aria-label], [data-i18n-title], [data-i18n-tooltip]')];
        const shell = [
          document.querySelector('#agent-live-title')?.textContent,
          document.querySelector('#mission-trace-title')?.textContent,
          document.querySelector('#language-label')?.textContent,
        ].filter(Boolean).join(' · ');
        const village = [...child.querySelectorAll('.world-building-label')].slice(0, 3)
          .map((node) => node.textContent).filter(Boolean).join(' · ');
        const help = document.querySelector('#dashboard-help-btn');
        const helpCopy = { aria_label: help?.getAttribute('aria-label') || '',
          tooltip: help?.dataset.tooltip || '', title: help?.title || '' };
        const shellCopy = {
          agents_title: document.querySelector('#agent-live-title')?.textContent?.trim() || '',
          timeline_title: document.querySelector('#mission-trace-title')?.textContent?.trim() || '',
          language_label: document.querySelector('#language-label')?.textContent?.trim() || '',
        };
        const villageCopy = {
          rest_cabin: child.querySelector('.world-building-label[data-building-id="rest-cabin"]')?.textContent?.trim() || '',
          maker_workshop: child.querySelector('.world-building-label[data-building-id="maker-workshop"]')?.textContent?.trim() || '',
        };
        const currentAgentState = document.querySelector('#current-agent-state')?.textContent?.trim() || '';
        const shellSignature = JSON.stringify(shellNodes.map((node) => [
          node.dataset.i18n || node.dataset.i18nAriaLabel || node.dataset.i18nTitle || node.dataset.i18nTooltip,
          (node.textContent || '').trim(), node.getAttribute('aria-label') || '', node.title || '', node.dataset.tooltip || '',
        ]));
        const villageSignature = JSON.stringify([...child.querySelectorAll('[aria-label]')]
          .map((node) => [node.className, node.getAttribute('aria-label') || '', (node.textContent || '').trim()]));
        return { shell_text: shell, village_text: village, missing_text: missing,
          help_copy: helpCopy, shell_copy: shellCopy, village_copy: villageCopy,
          current_agent_state: currentAgentState,
          document_lang: document.documentElement.lang,
          copy_signature: JSON.stringify([shellSignature, villageSignature, helpCopy]),
          shell_signature: shellSignature, village_signature: villageSignature,
          help_signature: JSON.stringify(helpCopy),
          shell_nodes: document.querySelectorAll('[data-i18n], [data-i18n-aria-label]').length,
          village_nodes: child.querySelectorAll('[aria-label]').length };
      })()
    """)


def locale_coverage_evidence(
    browser: ChromiumDevTools, plan: BrowserSmokePlan
) -> dict[str, Any]:
    locale_checks: dict[str, Any] = {}
    for locale in plan.locales:
        check = locale_evidence(browser, locale)
        help_copy = _mapping(check.get("help_copy"))
        expected = EXPECTED_LOCALE_COPY[locale]
        check["pass"] = bool(
            check["shell_text"]
            and check["village_text"]
            and not check["missing_text"]
            and check.get("document_lang") == expected["document_lang"]
            and help_copy.get("aria_label") == expected["help_aria"]
            and all(help_copy.get(key) == expected["help"] for key in ("tooltip", "title"))
            and all(
                _mapping(check.get("shell_copy")).get(key) == expected[key]
                for key in ("agents_title", "timeline_title", "language_label")
            )
            and all(
                _mapping(check.get("village_copy")).get(key) == expected[key]
                for key in ("rest_cabin", "maker_workshop")
            )
            and check.get("current_agent_state") == expected["current_agent_state"]
        )
        locale_checks[locale] = check
    signature_keys = ("shell_signature", "village_signature", "help_signature")
    unique_signatures = all(
        len({str(check.get(key) or "") for check in locale_checks.values()}) == len(plan.locales)
        and all(check.get(key) for check in locale_checks.values())
        for key in signature_keys
    )
    locale_evidence(browser, "en-US")
    return {
        "supported": list(plan.locales),
        "checks": locale_checks,
        "unique_signatures": unique_signatures,
        "pass": unique_signatures and all(check["pass"] for check in locale_checks.values()),
    }


def drilldown_evidence(browser: ChromiumDevTools) -> dict[str, Any]:
    browser.evaluate("""
      (() => {
        window.__commandDeckSmokeSelections = [];
        if (!window.__commandDeckSmokeSelectionProbe) {
          window.addEventListener('message', (event) => {
            if (event.origin === location.origin && event.source === document.querySelector('#pixelworld-frame')?.contentWindow
              && event.data?.type === 'pixelverse.command.focus') {
              window.__commandDeckSmokeSelections.push(event.data.selection);
            }
          });
          window.__commandDeckSmokeSelectionProbe = true;
        }
        const child = document.querySelector('#pixelworld-frame')?.contentWindow;
        child.__commandDeckSmokeFocus = [];
        if (!child.__commandDeckSmokeFocusProbe) {
          child.addEventListener('message', (event) => {
            if (event.origin === location.origin && event.data?.type === 'pixelverse.command.focus') {
              child.__commandDeckSmokeFocus.push(event.data.selection);
            }
          });
          child.__commandDeckSmokeFocusProbe = true;
        }
        return true;
      })()
    """)

    def reset_focus_messages() -> None:
        browser.evaluate("document.querySelector('#pixelworld-frame').contentWindow.__commandDeckSmokeFocus = []; true")

    def focus_message(kind: str, item_id: str) -> dict[str, Any]:
        result = browser.wait_value(
            f"document.querySelector('#pixelworld-frame').contentWindow.__commandDeckSmokeFocus.find((item) => item?.kind === {json.dumps(kind)} && item?.id === {json.dumps(item_id)})",
            f"village focus message for {kind}:{item_id}",
        )
        return _mapping(result)

    def close_cutaway() -> None:
        if browser.evaluate("document.body.dataset.pixelworldCutaway === 'open'"):
            click(browser, '.cutaway-dom-panel [data-action="close"]', child=True)
            browser.wait_until("document.body.dataset.pixelworldCutaway !== 'open'", "cutaway close between drill-down checks")

    browser.wait_until("document.querySelector('.agent-live-row[data-selection-id]')", "agent force-rail entry")
    agent_id = browser.evaluate("document.querySelector('.agent-live-row[data-selection-id]').dataset.selectionId")
    if browser.evaluate("document.querySelector('#hook-live-channels [data-selection-kind=\"hook\"].selected')"):
        raise BrowserFailure("Agent drill-down started with stale Hook selection")
    reset_focus_messages()
    click_center(browser, f'.agent-live-row[data-selection-id="{agent_id}"]')
    agent_source = bool(browser.wait_until(
        f"document.querySelector('.agent-live-row[data-selection-id={json.dumps(agent_id)}]')?.classList.contains('selected')",
        "agent force-rail selection",
    ))
    agent_inspector = bool(browser.wait_until(
        "document.querySelector('#hook-live-channels [data-selection-kind=\"hook\"].selected')",
        "agent-related Hook inspector selection",
    ))
    agent_hook_id = browser.evaluate(
        "document.querySelector('#hook-live-channels [data-selection-kind=\"hook\"].selected')?.dataset.selectionId"
    )
    agent_focus = focus_message("agent", agent_id)
    agent_village = agent_focus.get("id") == agent_id and bool(agent_dom_state(browser, agent_id))
    agent_sync = agent_source and agent_inspector and agent_village
    close_cutaway()

    browser.wait_until("document.querySelector('#hook-live-channels [data-selection-kind=\"hook\"].selected')", "agent-related Hook drill-down entry")
    hook_id = browser.evaluate("document.querySelector('#hook-live-channels [data-selection-kind=\"hook\"].selected')?.dataset.selectionId")
    if hook_id != agent_hook_id:
        raise BrowserFailure(f"Agent drill-down selected Hook {agent_hook_id!r}, then resolved {hook_id!r}")
    reset_focus_messages()
    click_center(browser, f'#hook-live-channels [data-selection-id="{hook_id}"]')
    hook_source = bool(browser.wait_until(
        f"document.querySelector('#hook-live-channels [data-selection-id={json.dumps(hook_id)}]')?.classList.contains('selected')",
        "Hook source selection",
    ))
    hook_focus = focus_message("hook", hook_id)
    hook_agent_id = str(hook_focus.get("agentId") or "")
    hook_inspector = hook_agent_id == agent_id and bool(browser.wait_until(
        f"document.querySelector('.agent-live-row[data-selection-kind=\"agent\"][data-selection-id={json.dumps(hook_agent_id)}]')?.classList.contains('selected')",
        f"Hook-related agent selection {hook_agent_id}",
    ))
    hook_village = hook_focus.get("id") == hook_id
    hook_sync = hook_source and hook_inspector and hook_village
    close_cutaway()

    timeline_selector = f'.mission-lane-agent[data-selection-id="{agent_id}"]'
    browser.wait_until(
        f"document.querySelector({json.dumps(timeline_selector)})?.closest('article')?.querySelector('.mission-event-node[data-selection-id]')",
        "selected agent timeline event node",
    )
    timeline_id = browser.evaluate(
        f"document.querySelector({json.dumps(timeline_selector)}).closest('article').querySelector('.mission-event-node[data-selection-id]').dataset.selectionId"
    )
    reset_focus_messages()
    click_center(browser, f'.mission-event-node[data-selection-id="{timeline_id}"]')
    timeline_source = bool(browser.wait_until(
        f"document.querySelector('.mission-event-node[data-selection-id={json.dumps(timeline_id)}]')?.classList.contains('selected')",
        "timeline source selection",
    ))
    timeline_focus = focus_message("event", timeline_id)
    timeline_agent_id = str(timeline_focus.get("agentId") or "")
    timeline_inspector = bool(timeline_agent_id) and bool(browser.wait_until(
        f"document.querySelector('.agent-live-row[data-selection-kind=\"agent\"][data-selection-id={json.dumps(timeline_agent_id)}]')?.classList.contains('selected')",
        f"timeline-related agent selection {timeline_agent_id}",
    ))
    timeline_village = timeline_focus.get("id") == timeline_id
    timeline_sync = timeline_source and timeline_inspector and timeline_village
    close_cutaway()

    browser.evaluate("window.__commandDeckSmokeSelections = []; true")
    click_world_building(browser, "rest-cabin")
    building_source = bool(browser.wait_until(
        "window.__commandDeckSmokeSelections.some((item) => item?.kind === 'building' && item?.id === 'standby_dock')",
        "village-originated Starting Cabin selection message",
    ))
    building_inspector = bool(browser.wait_until(
        "document.querySelector('.district[data-room=\"standby_dock\"]')?.classList.contains('command-selected')",
        "command-deck building selection styling",
    ))
    building_village = bool(browser.evaluate(
        "Boolean(document.body.dataset.pixelworldCutaway === 'open' && document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-dom-panel'))"
    ))
    building_sync = building_source and building_inspector and building_village
    close_cutaway()
    return {
        "agent": {"id": agent_id, "hook_id": agent_hook_id, "resolved_hook_agent_id": hook_agent_id, "source_activated": agent_source, "inspector_synced": agent_inspector and hook_agent_id == agent_id, "village_synced": agent_village, "synchronized": agent_sync and hook_agent_id == agent_id},
        "building": {"id": "standby_dock", "source_activated": building_source, "inspector_synced": building_inspector, "village_synced": building_village, "synchronized": building_sync},
        "hook": {"id": hook_id, "source_activated": hook_source, "inspector_synced": hook_inspector, "village_synced": hook_village, "synchronized": hook_sync},
        "timeline": {"id": timeline_id, "source_activated": timeline_source, "inspector_synced": timeline_inspector, "village_synced": timeline_village, "synchronized": timeline_sync},
        "pass": agent_sync and hook_agent_id == agent_id and building_sync and hook_sync and timeline_sync,
    }


def agent_overview_evidence(browser: ChromiumDevTools, agent_id: str) -> dict[str, Any]:
    selector = f'.agent-roster-card[data-selection-id="{agent_id}"]'
    browser.wait_until(f"document.querySelector({json.dumps(selector)})", "pixel agent roster card")
    browser.evaluate("""
      (() => {
        const child = document.querySelector('#pixelworld-frame')?.contentWindow;
        child.__commandDeckSmokeFocus = [];
        if (!child.__commandDeckSmokeFocusProbe) {
          child.addEventListener('message', (event) => {
            if (event.origin === location.origin && event.data?.type === 'pixelverse.command.focus') {
              child.__commandDeckSmokeFocus.push(event.data.selection);
            }
          });
          child.__commandDeckSmokeFocusProbe = true;
        }
        return true;
      })()
    """)
    click(browser, selector)
    card_selected = bool(browser.wait_until(
        f"document.querySelector({json.dumps(selector)})?.classList.contains('selected')",
        "pixel agent roster selection",
    ))
    focus = _mapping(browser.wait_value(
        f"document.querySelector('#pixelworld-frame').contentWindow.__commandDeckSmokeFocus.find((item) => item?.kind === 'agent' && item?.id === {json.dumps(agent_id)})",
        "matching village agent focus",
    ))
    village_synced = focus.get("id") == agent_id and bool(agent_dom_state(browser, agent_id))
    signal_kinds = browser.evaluate("""
      [...document.querySelectorAll('.agent-roster-card[data-signal-kind]')]
        .map((node) => node.dataset.signalKind)
    """) or []
    external_copy_nodes = int(browser.evaluate(
        "document.querySelectorAll('#agent-roster [data-external-copy=\"true\"]').length"
    ) or 0)

    browser.call("Emulation.setEmulatedMedia", {
        "features": [{"name": "prefers-reduced-motion", "value": "reduce"}],
    })
    browser.reload()
    wait_world(browser)
    reduced_motion_semantics = bool(browser.evaluate("""
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
        && [...document.querySelectorAll('.agent-roster-ecg path')].length > 0
        && [...document.querySelectorAll('.agent-roster-ecg path')]
          .every((path) => Boolean(path.getAttribute('d')))
    """))
    browser.call("Emulation.setEmulatedMedia", {"features": []})
    browser.reload()
    wait_world(browser)

    synchronized = card_selected and village_synced
    return {
        "selection": {
            "id": agent_id,
            "card_selected": card_selected,
            "village_synced": village_synced,
            "synchronized": synchronized,
        },
        "signal_kinds": sorted(set(map(str, signal_kinds))),
        "reduced_motion_semantics": reduced_motion_semantics,
        "external_copy_nodes": external_copy_nodes,
        "pass": synchronized and {"busy", "offline"}.issubset(set(signal_kinds))
        and reduced_motion_semantics and external_copy_nodes > 0,
    }


def geometry_signature(items: list[dict[str, Any]]) -> dict[str, tuple[Any, ...]]:
    return {
        str(item.get("id")): (
            _mapping(item.get("footprint")).get("width", 1),
            _mapping(item.get("footprint")).get("height", 1),
            item.get("scale", 1),
            item.get("rotation", 0),
        )
        for item in items
    }


def member_offsets(items: list[dict[str, Any]]) -> tuple[tuple[float, float], ...]:
    if len(items) < 2:
        return ()
    origin = _mapping(items[0].get("point"))
    return tuple(
        (
            float(_mapping(item.get("point")).get("x", 0)) - float(origin.get("x", 0)),
            float(_mapping(item.get("point")).get("y", 0)) - float(origin.get("y", 0)),
        )
        for item in items
    )


def catalog_prefab_offset(status_text: str) -> int:
    inventory = re.search(r"Hook\s+(\d+)\s*/\s*(\d+)", str(status_text))
    if not inventory:
        return 0
    return min(12, max(0, int(inventory.group(2)) - int(inventory.group(1))))


def saved_cabin_furniture_count(browser: ChromiumDevTools) -> int:
    """Persist the currently rendered cabin through its public Save control."""
    click(browser, '.cutaway-dom-panel [data-action="edit"]', child=True)
    browser.wait_until(
        "!document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-room-toolbar')?.hidden",
        "Starting Cabin edit toolbar before screenshot save",
    )
    click(browser, '.cutaway-room-toolbar [data-action="save"]', child=True)
    saved_raw = browser.wait_value(
        "localStorage.getItem('pixelworld:interior-layout:rest-cabin')",
        "Starting Cabin explicit pre-screenshot furniture save",
    )
    saved = json.loads(saved_raw)
    count = len(saved.get("furniture", []))
    if count <= 0:
        raise BrowserFailure(f"Starting Cabin Save persisted no furniture: {saved!r}")
    click(browser, '.cutaway-dom-panel [data-action="edit"]', child=True)
    browser.wait_until(
        "document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-room-toolbar')?.hidden",
        "Starting Cabin returned to cutaway view before screenshot",
    )
    return count


def furniture_evidence(browser: ChromiumDevTools) -> dict[str, Any]:
    click(browser, '.cutaway-dom-panel [data-action="edit"]', child=True)
    browser.wait_until(
        "!document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-room-toolbar')?.hidden",
        "Starting Cabin edit toolbar",
    )
    selection_evidence = select_furniture_group_via_marquee(browser)
    click(browser, '[data-context-action="group"]', child=True)
    prefab_raw = browser.wait_value(
        "localStorage.getItem('pixelworld:interior-prefabs:v1')",
        "UI-created v2 furniture group",
    )
    prefab_payload = json.loads(prefab_raw)
    user_prefabs = prefab_payload.get("prefabs", [])
    if prefab_payload.get("version") != 2 or len(user_prefabs) != 1:
        raise BrowserFailure(f"Grouping UI did not persist one canonical v2 prefab: {prefab_payload!r}")
    prefab = user_prefabs[0]
    prefab_members = [member.get("item", {}) for member in prefab.get("members", [])]
    if len(prefab_members) < 2:
        raise BrowserFailure("UI-created furniture group did not contain at least two members")
    click(browser, '.cutaway-room-toolbar [data-action="save"]', child=True)
    source_raw = browser.wait_value(
        "localStorage.getItem('pixelworld:interior-layout:rest-cabin')",
        "Starting Cabin explicit grouped furniture save",
    )
    source_saved = json.loads(source_raw)
    if not any(item.get("prefabInstanceId", "").startswith("draft-group-") for item in source_saved.get("furniture", [])):
        raise BrowserFailure("Starting Cabin save did not include the UI-created group instance")
    browser.reload()
    wait_world(browser)
    reload_raw = browser.evaluate("localStorage.getItem('pixelworld:interior-layout:rest-cabin')")
    prefab_reload_raw = browser.evaluate("localStorage.getItem('pixelworld:interior-prefabs:v1')")
    reloaded = source_raw == reload_raw and json.loads(prefab_reload_raw) == prefab_payload

    close_cutaway_to_village(browser, "maker-workshop")
    click_world_building(browser, "maker-workshop")
    click(browser, '.cutaway-dom-panel [data-action="edit"]', child=True)
    browser.wait_until(
        "!document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-room-toolbar')?.hidden",
        "Maker Workshop edit toolbar",
    )
    click(browser, '.cutaway-room-toolbar [data-action="save"]', child=True)
    target_before_raw = browser.wait_value(
        "localStorage.getItem('pixelworld:interior-layout:maker-workshop')",
        "Maker Workshop baseline explicit save",
    )
    target_before = json.loads(target_before_raw)
    before_instances = {
        item.get("prefabInstanceId") for item in target_before.get("furniture", []) if item.get("prefabInstanceId")
    }
    click(browser, '.cutaway-dom-panel [data-action="catalog"]', child=True)
    browser.wait_until(
        "!document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.cutaway-dom-catalog')?.hidden",
        "Maker Workshop furniture catalog",
    )
    click(browser, '.cutaway-dom-categories button[aria-label="Grouped Furniture"]', child=True)
    catalog = child_rect(browser, '.cutaway-dom-catalog')
    canvas_scale = float(browser.evaluate("document.querySelector('#pixelworld-frame').contentDocument.querySelector('canvas').getBoundingClientRect().width / 768"))
    slot_spacing = min(34 * canvas_scale, (catalog["width"] - 30 * canvas_scale) / 11)
    status_text = str(browser.evaluate(
        "document.querySelector('#pixelworld-frame').contentDocument.querySelector('.cutaway-dom-status')?.textContent || ''"
    ))
    prefab_offset = catalog_prefab_offset(status_text)
    prefab_source = (
        catalog["left"] + (catalog["width"] - slot_spacing * 11) / 2 + prefab_offset * slot_spacing,
        catalog["bottom"] - 42 * canvas_scale,
    )
    panel = child_rect(browser, '.cutaway-dom-panel')
    toolbar = child_rect(browser, '.cutaway-room-toolbar')
    room_top = toolbar["bottom"]
    room_bottom = catalog["top"]
    room_height = max(1.0, room_bottom - room_top)
    room_width = min(panel["width"], room_height * 18 / 12)
    room_left = panel["left"] + (panel["width"] - room_width) / 2
    target_raw = target_before_raw
    target_group: list[dict[str, Any]] = []
    placement_diagnostics: list[dict[str, Any]] = []
    candidate_ratios = [(x, y) for y in (0.22, 0.38, 0.55, 0.72) for x in (0.18, 0.34, 0.50, 0.66, 0.82)]
    for x_ratio, y_ratio in candidate_ratios:
        browser.drag(prefab_source, (
            room_left + room_width * x_ratio,
            room_top + room_height * y_ratio,
        ))
        drag_status = browser.evaluate(
            "document.querySelector('#pixelworld-frame').contentDocument.querySelector('.cutaway-dom-status')?.textContent || ''"
        )
        if "outside the room or blocks the door" in str(drag_status):
            placement_diagnostics.append({"target": [x_ratio, y_ratio], "drag_status": drag_status})
            continue
        click(browser, '.cutaway-room-toolbar [data-action="save"]', child=True)
        target_raw = browser.evaluate("localStorage.getItem('pixelworld:interior-layout:maker-workshop')")
        target_saved = json.loads(target_raw)
        new_instances = {
            item.get("prefabInstanceId") for item in target_saved.get("furniture", [])
            if item.get("prefabInstanceId") and item.get("prefabInstanceId") not in before_instances
        }
        if new_instances:
            placed_instance = sorted(new_instances)[0]
            target_group = [
                item for item in target_saved.get("furniture", []) if item.get("prefabInstanceId") == placed_instance
            ]
            break
        placement_diagnostics.append({
            "target": [x_ratio, y_ratio],
            "drag_status": drag_status,
            "status": browser.evaluate(
                "document.querySelector('#pixelworld-frame').contentDocument.querySelector('.cutaway-dom-status')?.textContent || ''"
            ),
            "furniture_count": len(target_saved.get("furniture", [])),
        })
    if not target_group:
        active_category = browser.evaluate(
            "document.querySelector('#pixelworld-frame').contentDocument.querySelector('.cutaway-dom-categories button[data-active=\"true\"]')?.getAttribute('aria-label') || ''"
        )
        raise BrowserFailure(
            "The UI-created group could not be placed through the Maker Workshop catalog: "
            + json.dumps({
                "active_category": active_category,
                "status": status_text,
                "prefab_offset": prefab_offset,
                "prefab_source": prefab_source,
                "catalog": catalog,
                "panel": panel,
                "room": {"left": room_left, "top": room_top, "width": room_width, "height": room_height},
                "attempts": placement_diagnostics,
            }, ensure_ascii=False, sort_keys=True)
        )
    source_values = list(geometry_signature(prefab_members).values())
    target_values = list(geometry_signature(target_group).values())
    size = len(source_values) == len(target_values) >= 2 and all(
        source[:3] == target[:3] for source, target in zip(source_values, target_values, strict=True)
    )
    rotation = len(source_values) == len(target_values) >= 2 and all(
        source[3] == target[3] for source, target in zip(source_values, target_values, strict=True)
    )
    aspect = len(source_values) == len(target_values) >= 2 and all(
        source[0] / source[1] == target[0] / target[1]
        for source, target in zip(source_values, target_values, strict=True)
    )
    spacing = member_offsets(prefab_members) == member_offsets(target_group)
    save_changed_target = target_raw != target_before_raw
    return {
        "source_house": "rest-cabin",
        "target_house": "maker-workshop",
        "saved": bool(source_raw),
        "reloaded": reloaded,
        "cross_house": len(target_group) == len(prefab_members),
        "created_via_ui": True,
        "placed_via_ui": True,
        "save_changed_target": save_changed_target,
        "source_furniture_count": len(source_saved.get("furniture", [])),
        "selection": selection_evidence,
        "group_id": prefab.get("id"),
        "member_count": len(target_group),
        "geometry": {
            "size": size,
            "aspect_ratio": aspect,
            "rotation": rotation,
            "member_spacing": spacing,
        },
        "pass": bool(source_raw) and reloaded and save_changed_target
        and len(target_group) == len(prefab_members) and size and aspect and rotation and spacing,
    }


def write_artifact(path: Path, artifact: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def run_smoke(plan: BrowserSmokePlan) -> dict[str, Any]:
    TMP.mkdir(parents=True, exist_ok=True)
    temporary_village = TMP / "command-deck-village.candidate.png"
    temporary_cabin = TMP / "starting-cabin-agent.candidate.png"
    artifact: dict[str, Any] = {
        "schema_version": 1,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "base_url": plan.base_url.rstrip("/"),
        "viewports": [],
        "locale_coverage": {},
        "agent_overview": {},
        "agent_detail": {},
        "hook_routes": {},
        "starting_cabin": {},
        "furniture_invariants": {},
        "screenshots": {},
        "console_errors": [],
        "page_errors": [],
        "failures": [],
        "pass": False,
    }
    browser: ChromiumDevTools | None = None
    try:
        with ChromiumDevTools(plan.viewports[0], plan.timeout_seconds) as active_browser:
            browser = active_browser
            browser.navigate(f"{plan.base_url.rstrip('/')}?smoke=command-deck-browser")
            wait_world(browser)
            artifact["viewports"] = [exercise_layout(browser, viewport) for viewport in plan.viewports]
            browser.set_viewport(1440, 900)
            browser.reload()
            wait_world(browser)
            artifact["locale_coverage"] = locale_coverage_evidence(browser, plan)

            post_event(plan.base_url, synthetic_event(plan.main_agent, "main_agent", "start", "working", "clone_bay", "Main agent enters Clone Bay"))
            post_event(plan.base_url, synthetic_event(plan.subagent, "subagent", "start", "working", "clone_bay", "Subagent starts in Clone Bay"))
            post_event(plan.base_url, synthetic_event(plan.offline_agent, "subagent", "status", "offline", "standby_dock", "Offline fixture"))
            wait_agent(browser, plan.main_agent)
            wait_agent(browser, plan.subagent)
            browser.wait_until(
                f"(() => {{ const child = document.querySelector('#pixelworld-frame')?.contentDocument; const main = child?.querySelector('.world-agent-status[data-agent-id={json.dumps(plan.main_agent)}]'); const sub = child?.querySelector('.world-agent-status[data-agent-id={json.dumps(plan.subagent)}]'); return main?.hidden && sub?.hidden; }})()",
                "main and subagent arrival inside Clone Bay",
            )
            initial_main = agent_dom_state(browser, plan.main_agent)
            initial_sub = agent_dom_state(browser, plan.subagent)

            post_event(plan.base_url, synthetic_event(plan.subagent, "subagent", "tool.started", "working", "tool_forge", "Subagent uses external browser tool"))
            post_event(plan.base_url, synthetic_event(plan.main_agent, "main_agent", "completed", "idle", "standby_dock", "Main agent returns to Starting Cabin"))
            moving_sub = wait_agent_displacement(
                browser, plan.subagent, str(initial_sub.get("transform") or ""),
                "real subagent displacement from Clone Bay to Tool Forge",
            )
            wait_agent_displacement(
                browser, plan.main_agent, str(initial_main.get("transform") or ""),
                "main agent displacement from Clone Bay toward Starting Cabin",
            )
            visible_agents = browser.evaluate("""
              (() => [...document.querySelectorAll('.agent-roster-card[data-selection-id]')]
                .filter((node) => { const box = node.getBoundingClientRect(); return box.width > 0 && box.height > 0; })
                .map((node) => node.dataset.selectionId))()
            """)
            village_size = browser.screenshot(temporary_village)

            busy_payload = synthetic_event(
                plan.busy_agent, "main_agent", "tool.started", "working", "terminal_bay", "Busy shell fixture",
            )
            busy_payload["tool_names"] = ["terminal", "shell"]
            post_event(plan.base_url, busy_payload)
            browser.wait_until(
                "document.querySelector('.agent-roster-card[data-signal-kind=\"busy\"]') && document.querySelector('.agent-roster-card[data-signal-kind=\"offline\"]')",
                "busy and offline roster ECG states",
            )
            artifact["agent_overview"] = agent_overview_evidence(browser, plan.subagent)
            artifact["agent_detail"] = agent_detail_evidence(browser, plan, plan.subagent)

            browser.wait_until(
                f"(() => {{ const node = document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector('.world-agent-status[data-agent-id={json.dumps(plan.main_agent)}]'); return node && node.hidden && node.style.transform && node.style.transform !== {json.dumps(initial_main.get('transform'))}; }})()",
                "main agent arrival inside Starting Cabin",
            )
            final_main = agent_dom_state(browser, plan.main_agent)
            click_world_building(browser, "rest-cabin")
            occupant_selector = f'.cutaway-room-label--agent[data-label-id="agent:{plan.main_agent}"]'
            browser.wait_until(
                f"document.querySelector('#pixelworld-frame')?.contentDocument?.querySelector({json.dumps(occupant_selector)})",
                "main agent inside the Starting Cabin cutaway",
            )
            cabin_agents = browser.evaluate("""
              (() => [...document.querySelector('#pixelworld-frame').contentDocument.querySelectorAll('.cutaway-room-label--agent')]
                .map((node) => (node.dataset.labelId || '').replace(/^agent:/, '')))()
            """)
            saved_furniture_count = saved_cabin_furniture_count(browser)
            cabin_size = browser.screenshot(temporary_cabin)
            artifact["starting_cabin"] = {
                "building_id": "rest-cabin",
                "opened": True,
                "agent_id": plan.main_agent,
                "agent_inside": plan.main_agent in cabin_agents,
                "saved_furniture_count": saved_furniture_count,
                "pass": plan.main_agent in cabin_agents and saved_furniture_count > 0,
            }
            furniture = furniture_evidence(browser)
            artifact["furniture_invariants"] = furniture
            if int(furniture.get("source_furniture_count") or 0) != saved_furniture_count:
                raise BrowserFailure("Starting Cabin furniture count changed between screenshot Save and grouping Save")
            artifact["hook_routes"] = {
                "main": {
                    "agent_id": plan.main_agent,
                    "from_room": "clone_bay",
                    "to_room": "standby_dock",
                    "before": initial_main,
                    "after": final_main,
                    "position_changed": initial_main.get("transform") != final_main.get("transform"),
                },
                "subagent": {
                    "agent_id": plan.subagent,
                    "from_room": "clone_bay",
                    "to_room": "tool_forge",
                    "before": initial_sub,
                    "after": moving_sub,
                    "position_changed": initial_sub.get("transform") != moving_sub.get("transform"),
                },
                "pass": initial_main.get("transform") != final_main.get("transform")
                and initial_sub.get("transform") != moving_sub.get("transform"),
            }
            artifact["screenshots"] = {
                "village": {
                    "path": "docs/assets/command-deck-village.png",
                    "width": village_size[0],
                    "height": village_size[1],
                    "agents": [agent for agent in (plan.main_agent, plan.subagent) if agent in visible_agents],
                    "pass": village_size == (1440, 900) and all(agent in visible_agents for agent in (plan.main_agent, plan.subagent)),
                },
                "cabin": {
                    "path": "docs/assets/starting-cabin-agent.png",
                    "width": cabin_size[0],
                    "height": cabin_size[1],
                    "agents": cabin_agents,
                    "saved_furniture_count": saved_furniture_count,
                    "pass": cabin_size == (1440, 900)
                    and plan.main_agent in cabin_agents and saved_furniture_count > 0,
                },
            }
            post_event(plan.base_url, synthetic_event(
                plan.subagent, "subagent", "completed", "idle", "clone_bay", "Subagent smoke route completed",
            ))
            browser.flush_events()
            artifact["console_errors"] = list(dict.fromkeys(filter(None, browser.console_errors)))
            artifact["page_errors"] = list(dict.fromkeys(filter(None, browser.page_errors)))
    except Exception as exc:  # the artifact is the operator-facing failure record
        if browser is not None:
            artifact["console_errors"] = list(dict.fromkeys(filter(None, browser.console_errors)))
            artifact["page_errors"] = list(dict.fromkeys(filter(None, browser.page_errors)))
        artifact["failures"] = [f"{type(exc).__name__}: {exc}"]
        artifact["pass"] = False
        write_artifact(plan.artifact, artifact)
        return artifact

    failures = evaluate_artifact({**artifact, "pass": True})
    artifact["failures"] = failures
    artifact["pass"] = not failures
    if not failures:
        plan.village_screenshot.parent.mkdir(parents=True, exist_ok=True)
        os.replace(temporary_village, plan.village_screenshot)
        os.replace(temporary_cabin, plan.cabin_screenshot)
    write_artifact(plan.artifact, artifact)
    return artifact


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Run deterministic command-deck production browser acceptance.")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--artifact", type=Path, default=TMP / "command_deck_browser_smoke.json")
    parser.add_argument("--timeout-seconds", type=float, default=45.0)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    plan = BrowserSmokePlan(
        base_url=args.base_url,
        artifact=args.artifact,
        timeout_seconds=args.timeout_seconds,
    )
    artifact = run_smoke(plan)
    print(f"Command deck browser smoke: {'PASS' if artifact['pass'] else 'FAIL'}")
    print(f"Artifact: {plan.artifact}")
    print(json.dumps({
        "pass": artifact["pass"],
        "viewports": [item.get("name") for item in artifact.get("viewports", [])],
        "locales": list(_mapping(artifact.get("locale_coverage")).get("checks", {})),
        "hook_routes": artifact.get("hook_routes"),
        "starting_cabin": artifact.get("starting_cabin"),
        "furniture_invariants": artifact.get("furniture_invariants"),
        "screenshots": artifact.get("screenshots"),
        "console_errors": artifact.get("console_errors"),
        "page_errors": artifact.get("page_errors"),
        "failures": artifact.get("failures"),
    }, ensure_ascii=False, indent=2))
    return 0 if artifact["pass"] else 1


if __name__ == "__main__":
    raise SystemExit(main())

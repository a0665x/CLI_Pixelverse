from __future__ import annotations

import re
from pathlib import Path


HTML_PATH = Path("public/index.html")
APP_PATH = Path("public/app.mjs")


def test_top_right_uses_one_settings_entry_with_complete_sections() -> None:
    html = HTML_PATH.read_text(encoding="utf-8")

    assert 'id="dashboard-help-btn"' not in html
    assert html.count('class="hook-settings top-settings"') == 1
    assert 'id="top-settings"' in html
    assert 'id="top-settings-summary"' in html
    for section in (
        "settings-appearance",
        "settings-connection",
        "settings-agent",
        "settings-help",
        "settings-about",
    ):
        assert html.count(f'id="{section}"') == 1
    assert 'id="settings-open-help-btn"' in html
    assert 'data-dashboard-card="help"' in html


def test_status_header_uses_intrinsic_height_without_text_clipping() -> None:
    html = HTML_PATH.read_text(encoding="utf-8")

    live_hud_rule = re.search(
        r"\.map-first-workspace \.hud\.live-hud,\s*"
        r"\.map-first-workspace \.live-hud\s*\{(?P<body>[^}]*)\}",
        html,
    )
    brand_rule = re.search(
        r"\.map-first-workspace \.live-hud \.brand\s*\{(?P<body>[^}]*)\}",
        html[live_hud_rule.end() :] if live_hud_rule else "",
    )

    assert live_hud_rule
    assert "height: 44px" not in live_hud_rule.group("body")
    assert "overflow: hidden" not in live_hud_rule.group("body")
    assert brand_rule
    assert "height: 44px" not in brand_rule.group("body")
    assert "overflow: hidden" not in brand_rule.group("body")
    assert "min-height:" in brand_rule.group("body")
    assert "@media (max-width: 899px)" in html
    assert ".live-hud #last-sync" in html


def test_settings_can_close_on_escape_and_outside_pointer() -> None:
    app = APP_PATH.read_text(encoding="utf-8")

    assert "topSettings: document.getElementById('top-settings')" in app
    assert "topSettingsSummary: document.getElementById('top-settings-summary')" in app
    assert "function closeTopSettings" in app
    assert "event.key !== 'Escape'" in app
    assert "dom.topSettings.contains(event.target)" in app
    assert "dom.topSettingsSummary?.focus()" in app


def test_phone_header_gives_agent_status_its_own_row() -> None:
    html = HTML_PATH.read_text(encoding="utf-8")

    assert "@media (max-width: 480px)" in html
    phone_css = html[html.index("@media (max-width: 480px)") :]
    assert ".live-hud .current-agent-state" in phone_css
    assert "grid-column: 1 / -1" in phone_css
    assert "white-space: normal" in phone_css

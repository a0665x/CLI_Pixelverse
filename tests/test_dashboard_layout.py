import re
from html.parser import HTMLParser
from pathlib import Path


class DashboardParser(HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self.stack = []
        self.parents = {}
        self.ids = set()
        self.id_counts = {}
        self.elements_by_id = {}
        self.elements = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = frozenset(attributes.get("class", "").split())
        element = {"tag": tag, "id": attributes.get("id"), "classes": classes, "attributes": attributes}
        self.elements.append(element)
        element_id = attributes.get("id")
        if element_id:
            self.ids.add(element_id)
            self.id_counts[element_id] = self.id_counts.get(element_id, 0) + 1
            self.elements_by_id[element_id] = element
            self.parents[element_id] = [item for item in self.stack if item]
        if tag not in self.VOID_TAGS:
            self.stack.append(element_id)

    def handle_endtag(self, tag):
        if self.stack:
            self.stack.pop()


def test_dashboard_layout_keeps_timeline_outside_left_sidebar_and_exposes_camera_controls():
    parser = DashboardParser()
    parser.feed(Path("public/index.html").read_text(encoding="utf-8"))

    assert "dashboard-sidebar" in parser.ids
    assert "events" in parser.ids
    assert "event-timeline-belt" in parser.ids
    assert "dashboard-sidebar" not in parser.parents["events"]
    assert "dashboard-sidebar" not in parser.parents["event-timeline-belt"]
    assert {"mobile-mode-btn", "sidebar-toggle-btn", "heartbeat-status", "heartbeat-label"} <= parser.ids
    assert {"hook-state-title", "hook-state-table"} <= parser.ids
    assert {"hook-state-panel", "inspector-panel", "inspector-agent-select"} <= parser.ids
    assert {"event-timeline-belt", "furniture-coord-hud", "furniture-coord-title"} <= parser.ids
    assert {"refresh-slower-btn", "refresh-faster-btn", "refresh-rate-output"} <= parser.ids
    assert {"zoom-in-btn", "zoom-reset-btn", "zoom-out-btn"} <= parser.ids


def test_dashboard_supports_persistent_furniture_and_visible_timeline_lanes():
    compose = Path("docker-compose.yml").read_text(encoding="utf-8")
    html = Path("public/index.html").read_text(encoding="utf-8")
    app = Path("public/app.mjs").read_text(encoding="utf-8")

    assert "PIXELVERSE_RUNTIME_DIR: /app/runtime" in compose
    assert ":/app/runtime" in compose
    assert "furniture-drag-ghost" in html
    assert "updateFurnitureDragGhost" in app
    assert "overflow-y: auto;" in html


def test_liquid_glass_is_reserved_for_functional_controls():
    html = Path("public/index.html").read_text(encoding="utf-8")
    app = Path("public/app.mjs").read_text(encoding="utf-8")
    parser = DashboardParser()
    parser.feed(html)

    for token in (
        "--material-content:",
        "--material-structural:",
        "--material-glass:",
        "--material-glass-border:",
    ):
        assert token in html

    approved_roles = {"camera-controls", "lang-switch", "exposure-switch"}
    glass_elements = [element for element in parser.elements if "functional-glass" in element["classes"]]
    observed_roles = set()
    for element in glass_elements:
        identities = approved_roles & element["classes"]
        if element["id"] == "sidebar-toggle-btn":
            identities = identities | {"sidebar-toggle-btn"}
        assert len(identities) == 1, element
        observed_roles.update(identities)
    assert observed_roles == approved_roles | {"sidebar-toggle-btn"}

    structural_panels = [element for element in parser.elements if "panel" in element["classes"]]
    assert structural_panels
    assert all("functional-glass" not in element["classes"] for element in structural_panels)
    timeline_class_tokens = [
        frozenset(match.group("classes").split())
        for match in re.finditer(
            r'<article\s+class="(?P<classes>[^"<>]*\btimeline-panel\b[^"<>]*)"',
            app,
        )
    ]
    assert timeline_class_tokens
    assert all("functional-glass" not in classes for classes in timeline_class_tokens)

    panel_rule = re.search(r"\.panel\s*\{(?P<body>[^}]*)\}", html)
    timeline_rule = re.search(r"\.timeline-panel\s*\{(?P<body>[^}]*)\}", html)
    assert panel_rule and "background: var(--material-structural)" in panel_rule.group("body")
    assert "backdrop-filter" not in panel_rule.group("body")
    assert timeline_rule and "background: var(--material-content)" in timeline_rule.group("body")
    assert "backdrop-filter" not in timeline_rule.group("body")

    assert "@media (prefers-reduced-transparency: reduce)" in html
    assert "@media (prefers-contrast: more)" in html


def test_reduced_motion_preserves_layout_transforms_and_glass_groups_have_shape():
    html = Path("public/index.html").read_text(encoding="utf-8")

    reduced_motion = html[html.index("@media (prefers-reduced-motion: reduce)"):]
    reduced_motion = reduced_motion[:reduced_motion.index("@media (prefers-reduced-transparency: reduce)")]
    assert "transform: none" not in reduced_motion
    assert "scale: 1" in reduced_motion
    assert 'body[data-mobile-mode="on"][data-sidebar-open="true"] #sidebar-toggle-btn' in html
    assert "transform: translateX(8px);" in html
    assert re.search(r"\.lang-switch,\s*\.exposure-switch\s*\{[^}]*border-radius:", html)


def test_map_first_dashboard_keeps_live_state_outside_collapsed_drawers():
    parser = DashboardParser()
    parser.feed(Path("public/index.html").read_text(encoding="utf-8"))

    core_ids = {
        "pixelworld-frame",
        "heartbeat-status",
        "current-agent-state",
        "agent-count",
        "subagent-count",
        "session-count",
    }
    assert core_ids <= parser.ids
    for element_id in core_ids:
        assert "workspace-drawer" not in parser.parents[element_id]

    assert parser.id_counts["pixelworld-frame"] == 1
    assert all(count == 1 for count in parser.id_counts.values())
    assert parser.elements_by_id["current-agent-state"]["attributes"].get("aria-live") == "polite"

    for panel_id in ("timeline-drawer-panel", "agents-drawer-panel", "diagnostics-drawer-panel"):
        assert panel_id in parser.ids
        assert "hidden" in parser.elements_by_id[panel_id]["attributes"]
        assert "workspace-drawer" in parser.parents[panel_id]

    assert "timeline-drawer-panel" in parser.parents["events"]
    assert "agents-drawer-panel" in parser.parents["inspector-panel"]
    assert "diagnostics-drawer-panel" in parser.parents["hook-state-panel"]


def test_map_first_drawers_overlay_the_map_and_offer_discoverable_controls():
    html = Path("public/index.html").read_text(encoding="utf-8")
    parser = DashboardParser()
    parser.feed(html)

    drawer = parser.elements_by_id["workspace-drawer"]
    assert "hidden" in drawer["attributes"]
    for drawer_name in ("timeline", "agents", "diagnostics"):
        button = parser.elements_by_id[f"{drawer_name}-drawer-btn"]
        assert button["attributes"].get("aria-controls") == "workspace-drawer"
        assert button["attributes"].get("aria-expanded") == "false"
        assert button["attributes"].get("aria-label")
        assert button["attributes"].get("data-tooltip")

    assert "dashboard-guide" in parser.ids
    assert "dashboard-guide-dismiss" in parser.ids
    assert ".map-first-workspace { position: fixed; inset: 0; overflow: hidden;" in html
    assert ".map-first-workspace .map-stage { position: absolute; inset: 0;" in html
    assert ".workspace-drawer {" in html
    assert "position: absolute;" in html
    assert ".workspace-drawer[hidden] { display: none; }" in html
    assert '[data-tooltip]:hover::after' in html
    assert '[data-tooltip]:focus-visible::after' in html


def test_pixelworld_is_the_default_interactive_layer_and_legacy_editor_is_explicitly_hidden():
    parser = DashboardParser()
    parser.feed(Path("public/index.html").read_text(encoding="utf-8"))

    frame = parser.elements_by_id["pixelworld-frame"]
    legacy_stage = parser.elements_by_id["camera-stage"]
    assert "hidden" not in frame["attributes"]
    assert "hidden" in legacy_stage["attributes"]
    assert legacy_stage["attributes"].get("aria-hidden") == "true"


def test_persistent_help_diagnostics_copy_and_motion_safe_tooltips_are_structural_contracts():
    html = Path("public/index.html").read_text(encoding="utf-8")
    parser = DashboardParser()
    parser.feed(html)

    help_button = parser.elements_by_id["dashboard-help-btn"]
    assert help_button["tag"] == "button"
    assert help_button["attributes"].get("aria-controls") == "dashboard-guide"
    assert help_button["attributes"].get("data-tooltip")
    assert "diagnostics-drawer-panel" in parser.parents["diagnostics-drawer-explanation"]
    assert parser.elements_by_id["diagnostics-drawer-explanation"]["attributes"].get("aria-live") is None

    drawer_rule = re.search(r"\.workspace-drawer\s*\{([^}]*)\}", html, re.S)
    assert drawer_rule
    assert "position: absolute" in drawer_rule.group(1)
    assert "inset: 68px 14px 14px auto" in drawer_rule.group(1)
    assert "touch-action: manipulation" in html

    reduced_motion = re.search(r"@media \(prefers-reduced-motion: reduce\)\s*\{(.*?)\n\s*\}", html, re.S)
    assert reduced_motion
    assert "[data-tooltip]::after" in reduced_motion.group(1)
    assert "transition: none" in reduced_motion.group(1)
    assert "transform: translateY(0)" in reduced_motion.group(1)


def test_compact_cutaway_reserves_an_exact_status_rail_above_the_iframe():
    html = Path("public/index.html").read_text(encoding="utf-8")
    parser = DashboardParser()
    parser.feed(html)

    assert "live-status-rail" in parser.ids
    for status_id in ("heartbeat-status", "current-agent-state", "agent-count", "subagent-count"):
        assert "live-status-rail" in parser.parents[status_id]
    assert "--compact-cutaway-status-height: 48px;" in html
    assert 'body[data-pixelworld-cutaway="open"] .map-first-workspace .map-stage {' in html
    assert "inset: var(--compact-cutaway-status-height) 0 0;" in html
    assert 'body[data-pixelworld-cutaway="open"] .map-first-workspace .live-hud {' in html
    assert "height: var(--compact-cutaway-status-height);" in html
    assert 'body[data-pixelworld-cutaway="open"] .map-first-workspace .live-hud,' not in html
    assert 'body[data-pixelworld-cutaway="open"] .workspace-tools' in html
    assert 'body[data-pixelworld-cutaway="open"] .workspace-drawer' in html
    assert 'body[data-pixelworld-cutaway="open"] .dashboard-guide' in html


def test_dashboard_does_not_link_to_an_uncommitted_map_builder_route():
    html = Path("public/index.html").read_text(encoding="utf-8")
    parser = DashboardParser()
    parser.feed(html)

    assert "map-builder-tab-link" not in parser.ids
    assert 'href="/map_builder.html"' not in html

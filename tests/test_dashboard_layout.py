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
        self.elements = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        classes = frozenset(attributes.get("class", "").split())
        self.elements.append({"tag": tag, "id": attributes.get("id"), "classes": classes})
        element_id = attributes.get("id")
        if element_id:
            self.ids.add(element_id)
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

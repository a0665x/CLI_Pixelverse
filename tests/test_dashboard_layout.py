from html.parser import HTMLParser
from pathlib import Path


class DashboardParser(HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__()
        self.stack = []
        self.parents = {}
        self.ids = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
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

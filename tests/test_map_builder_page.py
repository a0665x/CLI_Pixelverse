from html.parser import HTMLParser
from pathlib import Path


class IdParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.scripts = []
        self.help_modes = set()

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        if element_id := attributes.get("id"):
            self.ids.add(element_id)
        if help_mode := attributes.get("data-help-mode"):
            self.help_modes.add(help_mode)
        if tag == "script" and attributes.get("src"):
            self.scripts.append(attributes["src"])


def test_map_builder_page_exposes_png_yaml_tools_and_canvas():
    html = Path("public/map_builder.html").read_text(encoding="utf-8")
    parser = IdParser()
    parser.feed(html)

    assert {
        "png-input",
        "yaml-input",
        "builder-stage",
        "builder-canvas",
        "mode-room",
        "mode-corridor",
        "mode-door",
        "mode-furniture",
        "mode-select",
        "room-key-input",
        "furniture-type-input",
        "validate-map-btn",
        "export-yaml-btn",
        "submit-map-btn",
        "open-map-builder-link",
        "builder-prompt-checklist",
        "route-plan-list",
        "yaml-output",
        "validation-list",
        "assign-popover",
        "assign-room-key",
        "assign-room-name",
        "assign-confirm-btn",
        "assign-delete-btn",
        "assign-cancel-btn",
        "selection-toolbar",
        "selection-edit-btn",
        "selection-delete-btn",
        "selection-cancel-btn",
        "selection-duplicate-btn",
        "builder-inspector",
        "inspector-body",
        "zoom-in-btn",
        "zoom-out-btn",
        "zoom-reset-btn",
        "zoom-output",
        "builder-locale",
        "room-palette",
        "furniture-palette",
        "layer-panel",
        "layer-list",
        "drag-preview-label",
        "current-action",
        "current-tool-label",
        "current-payload-label",
        "drop-hint",
        "builder-help-tooltip",
        "simple-editor-toggle",
        "simple-step-rooms",
        "simple-step-corridors",
        "simple-step-doors",
        "simple-step-furniture",
        "simple-step-validate",
        "simple-exit-btn",
        "wall-mask-canvas",
        "wall-mask-toggle",
        "wall-mask-summary",
    } <= parser.ids
    assert {"room", "corridor", "door", "furniture", "select"} <= parser.help_modes
    assert "./map_builder.mjs" in parser.scripts


def test_map_builder_page_has_simplified_layout_mode_for_nontechnical_map_alignment():
    html = Path("public/map_builder.html").read_text(encoding="utf-8")

    assert "simple-builder" in html
    assert "簡易編輯" in html
    assert "深色牆面遮罩" in html
    assert "圈選房間" in html
    assert "圈選走廊" in html
    assert "新增門" in html
    assert "補空間" in html
    assert "驗證/提交" in html
    assert ".builder-app.simple-builder" in html
    assert "#wall-mask-canvas" in html


def test_simple_builder_exposes_layer_picker_and_compact_labels():
    html = Path("public/map_builder.html").read_text(encoding="utf-8")
    parser = IdParser()
    parser.feed(html)

    assert {
        "simple-step-free-space",
        "simple-layer-select",
        "simple-layer-hide-btn",
        "simple-layer-lock-btn",
        "simple-layer-focus-btn",
        "simple-validate-now-btn",
        "simple-submit-now-btn",
        "simple-export-now-btn",
        "simple-clear-selection-btn",
        "simple-feedback",
        "batch-room-row",
        "batch-corridor-row",
        "batch-free-space-row",
        "batch-door-row",
        "batch-furniture-row",
    } <= parser.ids
    assert "shape-label" in html
    assert ".simple-layer-dock" in html
    assert ".simple-command-bar" in html
    assert ".simple-batch-panel" in html
    assert "提交並儲存" in html
    assert "驗證地圖" in html
    assert "複製 Ctrl+C" in html
    assert "刪除 Delete" in html
    assert "data-selected-summary" in html
    assert "aria-busy" in html
    assert ".simple-builder .shape:not(.selected) .shape-label" in html
    assert ".shape.selected" in html
    assert ".batch-chip.active" in html
    assert ".simple-feedback.working::before" in html
    assert "pointer-events: none" in html


def test_simple_builder_paint_like_toolbar_prioritizes_canvas_workflow():
    html = Path("public/map_builder.html").read_text(encoding="utf-8")
    parser = IdParser()
    parser.feed(html)

    assert {
        "paint-tool-palette",
        "paint-tool-select",
        "paint-tool-room",
        "paint-tool-corridor",
        "paint-tool-free-space",
        "paint-tool-eraser",
        "paint-tool-door",
        "paint-tool-furniture",
        "paint-layer-toggle-btn",
        "paint-status-strip",
    } <= parser.ids
    assert "小畫家模式" in html
    assert "先選工具，再在圖上拖拉" in html
    assert ".simple-builder.paint-mode" in html
    assert ".paint-tool-palette" in html
    assert ".simple-builder.paint-mode:not(.layers-open) .simple-batch-panel" in html
    assert ".paint-tool.active" in html
    assert "data-paint-mode=\"free_space\"" in html
    assert "data-paint-mode=\"eraser\"" in html
    assert "橡皮擦" in html
    assert "拖拉刪除" in html
    assert "paint-legend-chip eraser" in html
    assert "paint-layer-legend" in html
    assert "paint-legend-chip room" in html
    assert "綠色可走房間" in html
    assert "橘色通道" in html
    assert "藍色補橋" in html
    assert "#paint-tool-room" in html
    assert "#paint-tool-corridor" in html
    assert "#paint-tool-free-space" in html
    assert ".simple-builder.paint-mode .shape.room" in html
    assert ".simple-builder.paint-mode .shape.corridor" in html
    assert ".simple-builder.paint-mode .shape.free-space" in html
    assert "rgba(0, 168, 132, 0.30)" in html
    assert "rgba(255, 138, 0, 0.44)" in html
    assert "repeating-linear-gradient(135deg, rgba(0, 152, 219, 0.16)" in html
    assert "z-index: 5;" in html
    assert "data-layer-kind" in Path("public/map_builder.mjs").read_text(encoding="utf-8")

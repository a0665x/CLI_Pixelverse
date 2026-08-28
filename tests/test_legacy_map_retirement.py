from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_outer_dashboard_contains_only_the_phaser_world_layer():
    html = (ROOT / "public/index.html").read_text(encoding="utf-8")
    for retired in (
        'id="edit-furniture-btn"', 'id="save-furniture-btn"', 'id="cancel-furniture-btn"',
        'id="camera-stage"', 'class="district"', 'id="path-layer"', 'id="agents-layer"',
    ):
        assert retired not in html
    assert 'id="pixelworld-frame"' in html


def test_dashboard_script_does_not_switch_to_a_legacy_map():
    source = (ROOT / "public/app.mjs").read_text(encoding="utf-8")
    for retired in (
        "beginFurnitureEdit", "saveFurnitureEdit", "cancelFurnitureEdit",
        "furnitureEditMode", "applyMapLayerVisibility", "renderDistricts", "repaintAgents",
        "agentPayloadPresentation", "agentEventChipPresentation",
    ):
        assert retired not in source


def test_retired_outer_editor_styles_are_removed():
    html = (ROOT / "public/index.html").read_text(encoding="utf-8")
    for retired in (".toast-stack {", ".coord-hud {", ".toast {"):
        assert retired not in html

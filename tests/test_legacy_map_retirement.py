from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
RETIRED = (
    "global_map/default.yaml", "global_map/default.png",
    "public/global_map_loader.mjs", "public/house_layout.mjs",
    "public/room_furniture.mjs",
    "public/map_builder.html", "public/map_builder.mjs", "public/map_builder_core.mjs",
    "public/world_motion.mjs", "scripts/check_global_map_alignment.py",
    "scripts/generate_global_map_pixel_art.py", "scripts/generate_honeycomb_global_map.py",
    "scripts/generate_vlm_courtyard_map.py", "scripts/render_local_ui_trajectory.py",
)


def test_tracked_legacy_map_files_are_absent():
    assert [path for path in RETIRED if (ROOT / path).exists()] == []


def test_active_sources_do_not_reference_retired_map_contracts():
    sources = "\n".join((ROOT / path).read_text(encoding="utf-8") for path in (
        "public/app.mjs", "public/index.html", "run.sh", "docker-compose.yml",
        "pixelverse_server.py", "pixelverse_fastapi.py",
    ))
    for token in (
        "global_map", "map_builder", "PIXELVERSE_FLOORPLAN", "furniture-layout",
        "render_local_ui_trajectory", "local_ui_trajectory", "pixelverse_debug_log",
    ):
        assert token not in sources


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


def test_current_readme_does_not_advertise_retired_map_workflow():
    current_docs = {
        "README.md": ROOT / "README.md",
        "bootstrap skill": ROOT / "skill" / "CLI_Pixelverse" / "SKILL.md",
        "integration module": ROOT / "spec" / "modules" / "integration-and-events.md",
        "testing module": ROOT / "spec" / "modules" / "testing-and-ops.md",
    }
    retired = (
        "PIXELVERSE_FLOORPLAN",
        "PIXELVERSE_GLOBAL_MAP_DIR_HOST",
        "./run.sh map-builder",
        "./run.sh floorplans",
        "global_map",
        "world_motion",
        "house_layout",
        "room_furniture",
        "render_local_ui_trajectory",
        "pixelverse_debug_log",
        "local_ui_trajectory",
        "global_map_walkability",
    )
    for label, path in current_docs.items():
        contents = path.read_text(encoding="utf-8")
        for token in retired:
            assert token not in contents, f"{label} advertises {token}"

    readme = current_docs["README.md"].read_text(encoding="utf-8")
    assert "open" in readme.lower() and "interior" in readme.lower()
    assert "PIXELVERSE_BRIDGE_PORT=4568" in readme
    assert "http://127.0.0.1:4568/health" in readme

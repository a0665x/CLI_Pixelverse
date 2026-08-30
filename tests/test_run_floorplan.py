from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_run_source_contains_no_floorplan_selector_or_compatibility_command() -> None:
    source = (ROOT / "run.sh").read_text(encoding="utf-8")
    for retired in (
        "select_floorplan_key",
        "prepare_floorplan",
        "PIXELVERSE_FLOORPLAN",
        "PIXELVERSE_GLOBAL_MAP_DIR_HOST",
        "Select visual floorplan",
        "floorplans|prepare-floorplan|map-builder",
    ):
        assert retired not in source

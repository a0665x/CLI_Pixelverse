from __future__ import annotations

import os
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_script(*args: str, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged_env = os.environ.copy()
    if env:
        merged_env.update(env)
    return subprocess.run(
        [str(ROOT / "run.sh"), *args],
        cwd=ROOT,
        env=merged_env,
        text=True,
        capture_output=True,
        check=False,
    )


def test_prepare_floorplan_copies_selected_yaml_and_png_to_runtime_override(tmp_path):
    source_yaml = ROOT / "global_map" / "tdd_floorplan.yaml"
    source_png = ROOT / "global_map" / "tdd_floorplan.png"
    output_dir = tmp_path / "global-map-runtime"

    source_yaml.write_text("version: 2\nkey: tdd-floorplan\nrooms: {}\n", encoding="utf-8")
    source_png.write_bytes(b"png")
    try:
        result = run_script(
            "prepare-floorplan",
            env={
                "PIXELVERSE_FLOORPLAN": "tdd_floorplan",
                "PIXELVERSE_GLOBAL_MAP_DIR_HOST": str(output_dir),
            },
        )
    finally:
        source_yaml.unlink(missing_ok=True)
        source_png.unlink(missing_ok=True)

    assert result.returncode == 0, result.stderr
    assert "Selected floorplan: tdd_floorplan" in result.stdout
    assert (output_dir / "default.yaml").read_text(encoding="utf-8").startswith("version: 2")
    assert (output_dir / "default.png").read_bytes() == b"png"


def test_floorplans_lists_only_complete_yaml_png_pairs():
    incomplete = ROOT / "global_map" / "tdd_incomplete.yaml"
    complete_yaml = ROOT / "global_map" / "tdd_complete.yaml"
    complete_png = ROOT / "global_map" / "tdd_complete.png"

    incomplete.write_text("version: 2\nkey: incomplete\nrooms: {}\n", encoding="utf-8")
    complete_yaml.write_text("version: 2\nkey: complete\nrooms: {}\n", encoding="utf-8")
    complete_png.write_bytes(b"png")
    try:
        result = run_script("floorplans")
    finally:
        incomplete.unlink(missing_ok=True)
        complete_yaml.unlink(missing_ok=True)
        complete_png.unlink(missing_ok=True)

    assert result.returncode == 0, result.stderr
    assert "tdd_complete" in result.stdout
    assert "tdd_incomplete" not in result.stdout


def test_prepare_floorplan_preserves_existing_runtime_map_when_no_selection_is_given(tmp_path):
    output_dir = tmp_path / "existing-global-map"
    output_dir.mkdir()
    (output_dir / "default.yaml").write_text("version: 2\nkey: existing\nrooms: {}\n", encoding="utf-8")
    (output_dir / "default.png").write_bytes(b"existing-png")

    result = run_script(
        "prepare-floorplan",
        env={
            "PIXELVERSE_GLOBAL_MAP_DIR_HOST": str(output_dir),
        },
    )

    assert result.returncode == 0, result.stderr
    assert "Using existing floorplan override" in result.stdout
    assert (output_dir / "default.yaml").read_text(encoding="utf-8") == "version: 2\nkey: existing\nrooms: {}\n"
    assert (output_dir / "default.png").read_bytes() == b"existing-png"


def test_docker_compose_mounts_runtime_global_map_read_write_for_builder_submit():
    compose = (ROOT / "docker-compose.yml").read_text(encoding="utf-8")
    assert ":/app/tmp/global_map:ro" not in compose
    assert ":/app/tmp/global_map" in compose


def test_map_builder_command_prints_builder_url_and_export_flow():
    result = run_script("map-builder")

    assert result.returncode == 0, result.stderr
    assert "http://localhost:5660/map_builder.html" in result.stdout
    assert "tmp/global_map/default.yaml" in result.stdout
    assert "check_global_map_alignment.py" in result.stdout

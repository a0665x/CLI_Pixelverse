import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_command(command):
    return subprocess.run(["bash", "run.sh", command], cwd=ROOT, text=True, capture_output=True,
                          env={**os.environ, "PIXELVERSE_AGENT_KIND": "codex"})


def test_retired_floorplan_commands_return_migration_guidance():
    for command in ("floorplans", "prepare-floorplan", "map-builder"):
        result = run_command(command)
        assert result.returncode == 2
        assert "single built-in world" in result.stderr


def test_run_source_contains_no_floorplan_selector_or_runtime_map_setting():
    source = (ROOT / "run.sh").read_text(encoding="utf-8")
    for retired in ("select_floorplan_key", "prepare_floorplan", "PIXELVERSE_FLOORPLAN",
                    "PIXELVERSE_GLOBAL_MAP_DIR_HOST", "Select visual floorplan"):
        assert retired not in source

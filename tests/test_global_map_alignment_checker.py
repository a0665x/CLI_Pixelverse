from __future__ import annotations

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def run_checker(key: str) -> dict:
    result = subprocess.run(
        [
            "python3",
            "scripts/check_global_map_alignment.py",
            "--yaml",
            f"global_map/{key}.yaml",
            "--png",
            f"global_map/{key}.png",
            "--json",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_alignment_checker_accepts_default_and_custom_maps():
    for key in ("default", "custom"):
        report = run_checker(key)
        assert report["ok"] is True
        assert report["room_count"] >= 10
        assert report["corridor_count"] >= 4
        assert report["dark_ratio"] < 0.12
        assert not report["errors"]


def test_alignment_checker_reports_furniture_occupancy_under_forty_percent():
    for key in ("default", "custom"):
        report = run_checker(key)
        ratios = report["furniture_occupancy_ratios"]

        assert ratios
        assert report["max_furniture_occupancy_ratio"] <= 0.4
        assert all(room["ratio"] <= 0.4 for room in ratios.values())

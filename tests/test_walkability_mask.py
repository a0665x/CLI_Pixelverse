from __future__ import annotations

import subprocess
import json
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]


def test_trajectory_renderer_writes_walkability_mask_with_furniture_and_doors():
    result = subprocess.run(
        ["python3", "scripts/render_local_ui_trajectory.py"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    mask_path = ROOT / "tmp" / "global_map_walkability_mask.png"
    assert mask_path.exists()

    image = Image.open(mask_path).convert("L")
    assert image.size == (1000, 1000)

    pixel_source = image.get_flattened_data() if hasattr(image, "get_flattened_data") else image.getdata()
    pixels = list(pixel_source)
    white = sum(1 for pixel in pixels if pixel >= 245)
    black = sum(1 for pixel in pixels if pixel <= 10)
    door = sum(1 for pixel in pixels if 130 <= pixel <= 210)

    assert white > 25_000
    assert black > 200_000
    assert door > 1_000

    debug = json.loads((ROOT / "tmp" / "pixelverse_debug_log.json").read_text(encoding="utf-8"))
    blocker = next(
        item
        for item in debug["map"]["furniture_blockers"]
        if item["roomKey"] == "think_lab" and item["prop"]["type"] == "board"
    )

    # A real furniture footprint center should be blocked in the planner mask.
    assert image.getpixel((round(blocker["center"]["x"] * 10), round(blocker["center"]["y"] * 10))) <= 10

    # A known room floor point remains free.
    assert image.getpixel((16 * 10, 25 * 10)) >= 245

    # Door threshold should be explicitly visible instead of hidden as a wall.
    assert 130 <= image.getpixel((16 * 10, 34 * 10)) <= 210

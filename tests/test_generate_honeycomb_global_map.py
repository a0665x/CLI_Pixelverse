from __future__ import annotations

import math
import subprocess
import sys
from pathlib import Path

import yaml
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "generate_honeycomb_global_map.py"


def point_in_polygon(point: dict, polygon: list[dict]) -> bool:
    x, y = point["x"], point["y"]
    inside = False
    j = len(polygon) - 1
    for i, pi in enumerate(polygon):
        pj = polygon[j]
        if ((pi["y"] > y) != (pj["y"] > y)) and x < (pj["x"] - pi["x"]) * (y - pi["y"]) / (pj["y"] - pi["y"]) + pi["x"]:
            inside = not inside
        j = i
    return inside


def test_generator_builds_deterministic_seven_room_honeycomb(tmp_path: Path):
    args = [sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)]
    first = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=False)
    assert first.returncode == 0, first.stderr
    yaml_path = tmp_path / "global_map" / "VLM_Generated.yaml"
    before = yaml_path.read_bytes()
    second = subprocess.run(args, cwd=ROOT, text=True, capture_output=True, check=False)
    assert second.returncode == 0, second.stderr
    assert yaml_path.read_bytes() == before

    manifest = yaml.safe_load(before)
    assert manifest["geometry"]["layout"] == "seven-room-honeycomb"
    assert manifest["geometry"]["corridor_mode"] == "none"
    assert len(manifest["rooms"]) == 7
    assert len(manifest["doors"]) == 12
    assert len(manifest["adjacency"]) == 12
    assert isinstance(manifest["corridors"], list)  # legacy runtime compatibility

    for key, room in manifest["rooms"].items():
        assert len(room["polygon"]) == 6, key
        assert len(room["walkable_polygon"]) == 6, key
        assert room["free_space"] == [room["walkable_polygon"]]
        for anchor in ("center", "aisle", "portal", "hub"):
            assert set(room[anchor]) == {"x", "y"}
            assert point_in_polygon(room["center"], room["walkable_polygon"])
        assert set(room["rect"]) == {"left", "top", "width", "height"}
        assert room["furniture"], f"{key} must contain visible furniture"
        lengths = [math.dist((a["x"], a["y"]), (b["x"], b["y"])) for a, b in zip(room["polygon"], room["polygon"][1:] + room["polygon"][:1])]
        assert max(lengths) - min(lengths) < 1e-3
        for item in room["furniture"]:
            half_w, half_h = item["footprint"]["w"] / 2, item["footprint"]["h"] / 2
            for corner in ({"x": item["x"] + dx, "y": item["y"] + dy} for dx in (-half_w, half_w) for dy in (-half_h, half_h)):
                assert point_in_polygon(corner, room["walkable_polygon"]), (key, item, corner)

    centers = [room["center"] for room in manifest["rooms"].values()]
    nearest = [min(math.dist((a["x"], a["y"]), (b["x"], b["y"])) for b in centers if b is not a) for a in centers]
    assert max(nearest) - min(nearest) < 1e-3

    pairs = {tuple(sorted(edge)) for edge in manifest["adjacency"]}
    for door in manifest["doors"]:
        assert tuple(sorted(door["rooms"])) in pairs
        assert len(door["segment"]) == 2
        assert door["width"] > 0
        midpoint = {"x": sum(p["x"] for p in door["segment"]) / 2, "y": sum(p["y"] for p in door["segment"]) / 2}
        assert math.dist((midpoint["x"], midpoint["y"]), (door["center"]["x"], door["center"]["y"])) < 1e-5


def test_artifacts_and_plants_respect_walkability(tmp_path: Path):
    result = subprocess.run(
        [sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    expected = {
        "global_map/VLM_Generated.png": (960, 960),
        "tmp/VLM_Generated_overlay.png": (960, 960),
        "tmp/VLM_Generated_walkability.png": (960, 960),
    }
    for relative, size in expected.items():
        with Image.open(tmp_path / relative) as image:
            assert image.size == size

    manifest = yaml.safe_load((tmp_path / "global_map/VLM_Generated.yaml").read_text())
    walkables = [room["walkable_polygon"] for room in manifest["rooms"].values()]
    assert manifest["plants"]
    assert all(not any(point_in_polygon(plant["center"], polygon) for polygon in walkables) for plant in manifest["plants"])

    alignment = subprocess.run(
        [sys.executable, str(ROOT / "scripts/check_global_map_alignment.py"), "--yaml", str(tmp_path / "global_map/VLM_Generated.yaml"), "--png", str(tmp_path / "global_map/VLM_Generated.png"), "--json"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    assert alignment.returncode == 0, alignment.stdout + alignment.stderr

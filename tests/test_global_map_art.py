from __future__ import annotations

import importlib.util
from pathlib import Path

import yaml
from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
MAP_YAML = ROOT / "global_map" / "default.yaml"
MAP_PNG = ROOT / "global_map" / "default.png"
GENERATOR = ROOT / "scripts" / "generate_global_map_pixel_art.py"


def load_generator():
    spec = importlib.util.spec_from_file_location("generate_global_map_pixel_art", GENERATOR)
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_default_map_png_is_pixel_art_background():
    with Image.open(MAP_PNG) as image:
        assert image.size == (960, 960)
        assert image.mode == "RGB"
        assert len(image.getcolors(maxcolors=100_000) or []) > 20
        raw = image.tobytes()
        dark_pixels = sum(1 for index in range(0, len(raw), 3) if raw[index] + raw[index + 1] + raw[index + 2] < 90)
        dark_ratio = dark_pixels / (image.size[0] * image.size[1])
        assert dark_ratio < 0.08


def test_generator_can_rebuild_png_from_yaml(tmp_path):
    generator = load_generator()
    out = tmp_path / "default.png"

    generator.generate(MAP_YAML, out)

    with Image.open(out) as image:
        assert image.size == (960, 960)
        assert image.mode == "RGB"


def test_room_portals_touch_corridors_and_furniture_stays_inside_rooms():
    generator = load_generator()
    manifest = yaml.safe_load(MAP_YAML.read_text(encoding="utf-8"))
    corridors = [generator.rect_px(corridor) for corridor in manifest["corridors"]]

    def point_in_box(x: int, y: int, box: tuple[int, int, int, int]) -> bool:
        left, top, right, bottom = box
        return left <= x <= right and top <= y <= bottom

    for key, room in manifest["rooms"].items():
        if key == "offline_corner":
            continue

        portal = room["portal"]
        px = generator.pct(float(portal["x"]))
        py = generator.pct(float(portal["y"]))
        assert any(point_in_box(px, py, corridor) for corridor in corridors), key

        room_left, room_top, room_right, room_bottom = generator.room_rect_px(room)
        for item in room.get("furniture", []):
            left, top, right, bottom = generator.furniture_box(room, item)
            assert room_left < left < right < room_right, (key, item)
            assert room_top < top < bottom < room_bottom, (key, item)

from __future__ import annotations

import importlib.util
import subprocess
import sys
from pathlib import Path

import yaml
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
GENERATOR = ROOT / "scripts" / "generate_vlm_courtyard_map.py"
SPEC = importlib.util.spec_from_file_location("generate_vlm_courtyard_map", GENERATOR)
assert SPEC and SPEC.loader
generator = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(generator)


def inside(rect, x, y, margin=0):
    return rect["left"] + margin <= x <= rect["left"] + rect["width"] - margin and rect["top"] + margin <= y <= rect["top"] + rect["height"] - margin


def overlaps(a, b):
    return not (
        a["left"] + a["width"] <= b["left"]
        or b["left"] + b["width"] <= a["left"]
        or a["top"] + a["height"] <= b["top"]
        or b["top"] + b["height"] <= a["top"]
    )


def test_room_name_badges_fit_inside_wall_safe_width():
    draw = ImageDraw.Draw(Image.new("RGB", (generator.SIZE, generator.SIZE)))
    manifest = generator.build_manifest()
    wall_safe_inset = (max(generator.WALL_WIDTH_PX, generator.OUTER_WALL_WIDTH_PX) + 1) // 2

    for room_key, room in manifest["rooms"].items():
        layout = generator.fit_room_label(draw, room["name"], room["rect"], room["label_anchor"])
        room_left, _, room_right, _ = generator.pixel_box(room["rect"])
        badge_left, _, badge_right, _ = layout["badge"]
        assert badge_right - badge_left == layout["text_width"] + 2 * generator.LABEL_HORIZONTAL_PADDING_PX
        assert room_left + wall_safe_inset <= badge_left, room_key
        assert badge_right <= room_right - wall_safe_inset, room_key
        assert layout["font_size"] >= generator.MIN_LABEL_FONT_SIZE


def test_generates_connected_room_and_shared_hall_map(tmp_path: Path):
    result = subprocess.run([sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    manifest = yaml.safe_load((tmp_path / "global_map/VLM_Generated.yaml").read_text())
    assert manifest["geometry"]["layout"] == "compact-terraced-central-gallery"
    assert manifest["geometry"]["corridor_mode"] == "single-gallery"
    assert len(manifest["rooms"]) >= 8
    assert manifest["corridors"]
    assert manifest["garden_ring"]
    assert len(manifest["doors"]) == len(manifest["rooms"])
    assert {d["room"] for d in manifest["doors"]} == set(manifest["rooms"])
    for key, room in manifest["rooms"].items():
        assert inside(room["rect"], room["center"]["x"], room["center"]["y"])
        assert inside(room["walkable_rect"], room["aisle"]["x"], room["aisle"]["y"])
        for item in room["furniture"]:
            fp = item["footprint"]
            assert inside(room["walkable_rect"], item["x"], item["y"], max(fp["w"], fp["h"]) / 2)


def test_room_rows_tile_the_house_without_gaps_or_overlaps(tmp_path: Path):
    subprocess.run([sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)], cwd=ROOT, check=True)
    manifest = yaml.safe_load((tmp_path / "global_map/VLM_Generated.yaml").read_text())
    house = manifest["garden_ring"]["house"]
    gallery = manifest["corridors"]
    assert len(gallery) == 1
    gallery = gallery[0]
    assert gallery["left"] == house["left"]
    assert gallery["width"] == house["width"]

    for row in ("north", "south"):
        rooms = sorted(
            (room for room in manifest["rooms"].values() if room["row"] == row),
            key=lambda room: room["rect"]["left"],
        )
        assert len(rooms) == 5
        assert rooms[0]["rect"]["left"] == house["left"]
        assert rooms[-1]["rect"]["left"] + rooms[-1]["rect"]["width"] == house["left"] + house["width"]
        for left, right in zip(rooms, rooms[1:]):
            assert left["rect"]["left"] + left["rect"]["width"] == right["rect"]["left"]
        for room in rooms:
            edge = room["rect"]["top"] + room["rect"]["height"] if row == "north" else room["rect"]["top"]
            expected = gallery["top"] if row == "north" else gallery["top"] + gallery["height"]
            assert edge == expected


def test_door_swing_clearance_is_inside_room_and_clear_of_furniture(tmp_path: Path):
    subprocess.run([sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)], cwd=ROOT, check=True)
    manifest = yaml.safe_load((tmp_path / "global_map/VLM_Generated.yaml").read_text())
    doors = {door["room"]: door for door in manifest["doors"]}
    for key, room in manifest["rooms"].items():
        door = doors[key]
        assert door["swing"] == "inward"
        assert door["clearance"]["room"] == key
        clearance = door["clearance"]["rect"]
        rect = room["rect"]
        assert inside(rect, clearance["left"], clearance["top"])
        assert inside(rect, clearance["left"] + clearance["width"], clearance["top"] + clearance["height"])
        for item in room["furniture"]:
            fp = item["footprint"]
            item_rect = {
                "left": item["x"] - fp["w"] / 2,
                "top": item["y"] - fp["h"] / 2,
                "width": fp["w"],
                "height": fp["h"],
            }
            assert not overlaps(item_rect, clearance)


def test_outputs_png_and_two_validation_layers(tmp_path: Path):
    result = subprocess.run([sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    for rel in ["global_map/VLM_Generated.png", "tmp/VLM_Generated_overlay.png", "tmp/VLM_Generated_walkability.png"]:
        with Image.open(tmp_path / rel) as image:
            assert image.size == (960, 960)


def test_each_room_has_semantic_furniture_and_clear_interaction_anchors(tmp_path: Path):
    subprocess.run([sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)], cwd=ROOT, check=True)
    manifest = yaml.safe_load((tmp_path / "global_map/VLM_Generated.yaml").read_text())
    expected = {
        "think_lab": {"desk", "chair", "board", "lamp"},
        "blueprint_lab": {"table", "board", "cabinet"},
        "clone_bay": {"portal", "desk", "terminal", "server"},
        "file_library": {"bookshelf", "desk", "chair"},
        "code_workbench": {"desk", "terminal", "chair"},
        "terminal_bay": {"terminal", "server", "chair"},
        "session_archive": {"cabinet", "bookshelf", "table"},
        "standby_dock": {"sofa", "coffee", "bed"},
        "response_studio": {"desk", "terminal", "chair", "bookshelf"},
        "tool_forge": {"workbench", "server", "locker", "terminal"},
    }
    for room_key, required_types in expected.items():
        room = manifest["rooms"][room_key]
        assert required_types <= {item["type"] for item in room["furniture"]}
        assert room["label_anchor"]["contrast"] == "high"
        blockers = []
        for item in room["furniture"]:
            fp = item["footprint"]
            blockers.append({
                "left": item["x"] - fp["w"] / 2,
                "top": item["y"] - fp["h"] / 2,
                "width": fp["w"],
                "height": fp["h"],
            })
            assert item["icon_style"] == "semantic-pixel"
            assert item["anchors"], f"{room_key}/{item['type']} needs an interaction anchor"
            anchor = item["anchors"][0]
            world_x = room["rect"]["left"] + room["rect"]["width"] * anchor["x"] / 100
            world_y = room["rect"]["top"] + room["rect"]["height"] * anchor["y"] / 100
            assert inside(room["walkable_rect"], world_x, world_y)
        for item in room["furniture"]:
            anchor = item["anchors"][0]
            world_x = room["rect"]["left"] + room["rect"]["width"] * anchor["x"] / 100
            world_y = room["rect"]["top"] + room["rect"]["height"] * anchor["y"] / 100
            assert not any(inside(other, world_x, world_y) for other in blockers)


def test_landscape_ring_uses_varied_shrubs_trees_and_flowers(tmp_path: Path):
    subprocess.run([sys.executable, str(GENERATOR), "--output-dir", str(tmp_path)], cwd=ROOT, check=True)
    manifest = yaml.safe_load((tmp_path / "global_map/VLM_Generated.yaml").read_text())
    kinds = {plant["kind"] for plant in manifest["plants"]}
    assert {"shrub", "small_tree", "flower_cluster"} <= kinds
    assert len({plant["radius"] for plant in manifest["plants"]}) >= 4
    assert manifest["garden_ring"]["style"] == "layered-naturalistic"

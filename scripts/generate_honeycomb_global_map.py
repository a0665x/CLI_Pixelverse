#!/usr/bin/env python3
"""Deterministically generate the seven-room honeycomb global map and diagnostics."""

from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Any

import yaml
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SIZE = 960
RADIUS = 15.0
WALL_BUBBLE = 1.25
DOOR_WIDTH = 5.0
ROOM_SPECS = [
    ("hub", "Coordination Hub", (0, 0), ["thinking", "awaiting_input"]),
    ("tool_forge", "Tool Forge", (1, 0), ["tool_call", "invoking_skill"]),
    ("terminal_bay", "Terminal Bay", (0, 1), ["shell_command", "executing"]),
    ("response_studio", "Response Studio", (-1, 1), ["responding"]),
    ("standby_dock", "Standby Dock", (-1, 0), ["idle", "sleeping"]),
    ("file_library", "File Library", (0, -1), ["reading_files"]),
    ("code_workbench", "Code Workbench", (1, -1), ["editing_files", "self_healing"]),
]
COLORS = ["#d9c487", "#afc6a9", "#9fbfc0", "#d2b393", "#bdb292", "#c5b47f", "#c3cca7"]


def point(x: float, y: float) -> dict[str, float]:
    return {"x": round(x, 4), "y": round(y, 4)}


def center_for(q: int, r: int) -> tuple[float, float]:
    return 50 + 1.5 * RADIUS * q, 50 + math.sqrt(3) * RADIUS * (r + q / 2)


def hexagon(cx: float, cy: float, radius: float) -> list[dict[str, float]]:
    return [point(cx + radius * math.cos(math.radians(60 * i)), cy + radius * math.sin(math.radians(60 * i))) for i in range(6)]


def rect_for(poly: list[dict[str, float]]) -> dict[str, float]:
    xs, ys = [p["x"] for p in poly], [p["y"] for p in poly]
    return {"left": round(min(xs), 4), "top": round(min(ys), 4), "width": round(max(xs) - min(xs), 4), "height": round(max(ys) - min(ys), 4)}


def contains(poly: list[dict[str, float]], x: float, y: float) -> bool:
    signs = []
    for a, b in zip(poly, poly[1:] + poly[:1]):
        cross = (b["x"] - a["x"]) * (y - a["y"]) - (b["y"] - a["y"]) * (x - a["x"])
        if abs(cross) > 1e-7:
            signs.append(cross > 0)
    return not signs or all(value == signs[0] for value in signs)


def shared_edge(a: list[dict[str, float]], b: list[dict[str, float]]) -> tuple[dict[str, float], dict[str, float]] | None:
    common = [pa for pa in a if any(math.dist((pa["x"], pa["y"]), (pb["x"], pb["y"])) < 0.01 for pb in b)]
    return (common[0], common[1]) if len(common) == 2 else None


def inset_anchor(center: dict[str, float], portal: dict[str, float], distance: float, inward: bool = True) -> dict[str, float]:
    dx, dy = center["x"] - portal["x"], center["y"] - portal["y"]
    length = math.hypot(dx, dy)
    sign = 1 if inward else -1
    return point(portal["x"] + sign * distance * dx / length, portal["y"] + sign * distance * dy / length)


def build_manifest() -> dict[str, Any]:
    rooms: dict[str, Any] = {}
    for key, name, axial, states in ROOM_SPECS:
        cx, cy = center_for(*axial)
        polygon = hexagon(cx, cy, RADIUS)
        walkable = hexagon(cx, cy, RADIUS - WALL_BUBBLE)
        rooms[key] = {
            "name": name, "description": f"Honeycomb workspace: {name}.", "states": states,
            "polygon": polygon, "walkable_polygon": walkable, "free_space": [walkable],
            "wall_bubble": WALL_BUBBLE, "rect": rect_for(polygon), "center": point(cx, cy),
            "patrol": [point(cx, cy)],
            "furniture": [
                {"type": "desk", "label": f"{name} desk", "x": round(cx - 4, 4), "y": round(cy, 4), "footprint": {"w": 3.0, "h": 2.0}, "scale": 0.8},
                {"type": "chair", "label": f"{name} chair", "x": round(cx + 4, 4), "y": round(cy, 4), "footprint": {"w": 2.0, "h": 2.0}, "scale": 0.7},
            ],
        }

    adjacency: list[list[str]] = []
    doors: list[dict[str, Any]] = []
    keys = list(rooms)
    for i, akey in enumerate(keys):
        for bkey in keys[i + 1:]:
            edge = shared_edge(rooms[akey]["polygon"], rooms[bkey]["polygon"])
            if not edge:
                continue
            adjacency.append([akey, bkey])
            ex, ey = edge[1]["x"] - edge[0]["x"], edge[1]["y"] - edge[0]["y"]
            edge_len = math.hypot(ex, ey)
            center = point((edge[0]["x"] + edge[1]["x"]) / 2, (edge[0]["y"] + edge[1]["y"]) / 2)
            half = DOOR_WIDTH / 2
            segment = [point(center["x"] - ex / edge_len * half, center["y"] - ey / edge_len * half), point(center["x"] + ex / edge_len * half, center["y"] + ey / edge_len * half)]
            doors.append({"key": f"{akey}--{bkey}", "rooms": [akey, bkey], "segment": segment, "center": center, "width": DOOR_WIDTH})

    for key, room in rooms.items():
        primary = next(d for d in doors if key in d["rooms"] and (key != "hub" or "tool_forge" in d["rooms"]))
        other = primary["rooms"][1] if primary["rooms"][0] == key else primary["rooms"][0]
        room["portal"] = dict(primary["center"])
        room["aisle"] = inset_anchor(room["center"], room["portal"], 3.0)
        room["hub"] = inset_anchor(rooms[other]["center"], room["portal"], 1.5)
        room["anchors"] = {"center": room["center"], "aisle": room["aisle"], "portal": room["portal"], "hub": room["hub"]}
        room["door_keys"] = [d["key"] for d in doors if key in d["rooms"]]
        for item in room["furniture"]:
            half_w, half_h = item["footprint"]["w"] / 2, item["footprint"]["h"] / 2
            if not all(contains(room["walkable_polygon"], item["x"] + dx, item["y"] + dy) for dx in (-half_w, half_w) for dy in (-half_h, half_h)):
                raise ValueError(f"{key} furniture footprint escapes walkable polygon: {item}")

    # Legacy corridor rectangles are door thresholds only; geometry.corridor_mode remains authoritative.
    corridors = []
    for door in doors:
        xs, ys = [p["x"] for p in door["segment"]], [p["y"] for p in door["segment"]]
        corridors.append({"key": f"door-threshold-{door['key']}", "left": round(min(xs) - .6, 4), "top": round(min(ys) - .6, 4), "width": round(max(max(xs) - min(xs), 1.2) + 1.2, 4), "height": round(max(max(ys) - min(ys), 1.2) + 1.2, 4), "compatibility": "door-threshold"})

    plants = [{"key": f"plant-{i + 1}", "center": point(x, y), "radius": 1.4} for i, (x, y) in enumerate([(8, 8), (92, 8), (8, 92), (92, 92), (50, 6), (50, 94)])]
    return {
        "version": 2, "key": "VLM_Generated", "name": "Seven Room Honeycomb", "image": "/global_map/VLM_Generated.png",
        "description": "Seven hexagonal rooms share walls and connect through centered doors; no corridors.",
        "bounds": {"left": 2, "top": 2, "width": 96, "height": 96},
        "geometry": {"layout": "seven-room-honeycomb", "corridor_mode": "none", "wall_bubble": WALL_BUBBLE, "units": "percent"},
        "rooms": rooms, "adjacency": adjacency, "doors": doors, "corridors": corridors, "free_space": [r["walkable_polygon"] for r in rooms.values()], "plants": plants,
    }


def px(p: dict[str, float]) -> tuple[int, int]:
    return round(p["x"] * SIZE / 100), round(p["y"] * SIZE / 100)


def render(manifest: dict[str, Any], image_path: Path, overlay_path: Path, walk_path: Path) -> None:
    image = Image.new("RGB", (SIZE, SIZE), "#8da77b")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()
    for plant in manifest["plants"]:
        x, y = px(plant["center"]); radius = round(plant["radius"] * SIZE / 100)
        draw.ellipse((x-radius, y-radius, x+radius, y+radius), fill="#315b35", outline="#183b24", width=3)
    for index, (key, room) in enumerate(manifest["rooms"].items()):
        poly = [px(p) for p in room["polygon"]]
        draw.polygon(poly, fill=COLORS[index], outline="#211b2b", width=8)
        for item in room["furniture"]:
            fp = item["footprint"]
            left, top = px(point(item["x"] - fp["w"] / 2, item["y"] - fp["h"] / 2))
            right, bottom = px(point(item["x"] + fp["w"] / 2, item["y"] + fp["h"] / 2))
            draw.rectangle((left, top, right, bottom), fill="#704f38", outline="#30241d", width=2)
        cx, cy = px(room["center"])
        label = room["name"]
        box = draw.textbbox((0, 0), label, font=font)
        draw.rectangle((cx-(box[2]-box[0])//2-4, cy-8, cx+(box[2]-box[0])//2+4, cy+8), fill="#3b3340")
        draw.text((cx-(box[2]-box[0])//2, cy-5), label, fill="#fff1cc", font=font)
    for door in manifest["doors"]:
        draw.line((*px(door["segment"][0]), *px(door["segment"][1])), fill="#ffe7b7", width=12)
    image_path.parent.mkdir(parents=True, exist_ok=True); image.save(image_path)

    overlay = image.copy(); od = ImageDraw.Draw(overlay)
    for room in manifest["rooms"].values():
        od.line([px(p) for p in room["walkable_polygon"]] + [px(room["walkable_polygon"][0])], fill="#20e6ff", width=3)
    for door in manifest["doors"]:
        od.ellipse((px(door["center"])[0]-5, px(door["center"])[1]-5, px(door["center"])[0]+5, px(door["center"])[1]+5), fill="#ff3df2")
    overlay_path.parent.mkdir(parents=True, exist_ok=True); overlay.save(overlay_path)

    walk = Image.new("L", (SIZE, SIZE), 0); wd = ImageDraw.Draw(walk)
    for room in manifest["rooms"].values(): wd.polygon([px(p) for p in room["walkable_polygon"]], fill=255)
    for door in manifest["doors"]: wd.line((*px(door["segment"][0]), *px(door["segment"][1])), fill=170, width=12)
    walk.save(walk_path)


def generate(output_dir: Path) -> list[Path]:
    manifest = build_manifest()
    yaml_path = output_dir / "global_map/VLM_Generated.yaml"
    image_path = output_dir / "global_map/VLM_Generated.png"
    overlay_path = output_dir / "tmp/VLM_Generated_overlay.png"
    walk_path = output_dir / "tmp/VLM_Generated_walkability.png"
    yaml_path.parent.mkdir(parents=True, exist_ok=True)
    class NoAliasDumper(yaml.SafeDumper):
        def ignore_aliases(self, data: Any) -> bool:
            return True
    yaml_path.write_text(yaml.dump(manifest, Dumper=NoAliasDumper, sort_keys=False, allow_unicode=True, width=1_000_000, default_flow_style=True), encoding="utf-8")
    render(manifest, image_path, overlay_path, walk_path)
    return [image_path, yaml_path, overlay_path, walk_path]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT, help="Repository/output root")
    args = parser.parse_args()
    for path in generate(args.output_dir.resolve()): print(f"wrote {path}")


if __name__ == "__main__":
    main()

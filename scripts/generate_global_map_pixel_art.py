#!/usr/bin/env python3
"""Generate the default top-down pixel art office map from global_map/default.yaml."""

from __future__ import annotations

import argparse
from pathlib import Path
from typing import Any

import yaml
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_YAML = ROOT / "global_map" / "default.yaml"
DEFAULT_OUT = ROOT / "global_map" / "default.png"
BASE_SIZE = 480
OUT_SIZE = 960
WALL = 4
DOOR_WIDTH_PCT = 5.4

ROOM_COLORS = {
    "think_lab": "#d9c487",
    "blueprint_lab": "#d0c39f",
    "clone_bay": "#b6c7d7",
    "file_library": "#c5b47f",
    "code_workbench": "#c3cca7",
    "terminal_bay": "#9fbfc0",
    "standby_dock": "#bdb292",
    "response_studio": "#d2b393",
    "tool_forge": "#afc6a9",
    "session_archive": "#bcb18f",
    "offline_corner": "#6f665d",
}

ROOM_ACCENTS = {
    "think_lab": "#f6e0a3",
    "blueprint_lab": "#e2d4af",
    "clone_bay": "#c9d7e6",
    "file_library": "#d7c48a",
    "code_workbench": "#d6dfb8",
    "terminal_bay": "#b4d0d0",
    "standby_dock": "#d1c39e",
    "response_studio": "#e5c3a0",
    "tool_forge": "#c2d8bc",
    "session_archive": "#d0c29f",
    "offline_corner": "#8a7b6f",
}

FURNITURE_COLORS = {
    "bed": ("#8aa3b8", "#5d7487"),
    "board": ("#254659", "#d8f2e1"),
    "bookshelf": ("#7b5136", "#d7b16c"),
    "cabinet": ("#746d61", "#b6ab98"),
    "chair": ("#9d674a", "#6b4434"),
    "coffee": ("#8d6a4b", "#d9b879"),
    "desk": ("#8a5f3e", "#c99b62"),
    "locker": ("#607080", "#91a5b5"),
    "portal": ("#4f7eb6", "#9ee7ff"),
    "server": ("#374151", "#8bd3ff"),
    "sofa": ("#7f9c7c", "#597058"),
    "table": ("#8a6a4c", "#cda876"),
    "terminal": ("#2d3748", "#62f0a6"),
    "workbench": ("#6d5b45", "#d1945c"),
}


def pct(value: float) -> int:
    return int(round(value * BASE_SIZE / 100))


def rect_px(rect: dict[str, Any]) -> tuple[int, int, int, int]:
    left = pct(float(rect["left"]))
    top = pct(float(rect["top"]))
    right = pct(float(rect["left"]) + float(rect["width"]))
    bottom = pct(float(rect["top"]) + float(rect["height"]))
    return left, top, right, bottom


def room_rect_px(room: dict[str, Any]) -> tuple[int, int, int, int]:
    return rect_px(room["rect"])


def local_to_world(room: dict[str, Any], item: dict[str, Any]) -> tuple[float, float]:
    rect = room["rect"]
    return (
        float(rect["left"]) + float(rect["width"]) * float(item["x"]) / 100,
        float(rect["top"]) + float(rect["height"]) * float(item["y"]) / 100,
    )


def draw_tile_floor(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], base: str, grid: str) -> None:
    draw.rectangle(box, fill=base)
    left, top, right, bottom = box
    step = 24
    for x in range(left + step, right, step):
        draw.line((x, top + 4, x, bottom - 4), fill=grid, width=1)
    for y in range(top + step, bottom, step):
        draw.line((left + 4, y, right - 4, y), fill=grid, width=1)
    for x in range(left + 10, right, step * 2):
        draw.point((x, top + 10), fill="#ffffff")


def draw_room_walls(draw: ImageDraw.ImageDraw, room_key: str, room: dict[str, Any]) -> None:
    left, top, right, bottom = room_rect_px(room)
    wall = "#211b2b" if room_key != "offline_corner" else "#3f3030"
    draw.rectangle((left, top, right, bottom), outline=wall, width=WALL)

    portal = room["portal"]
    px = pct(float(portal["x"]))
    py = pct(float(portal["y"]))
    door_half = max(10, pct(DOOR_WIDTH_PCT) // 2)
    threshold = "#ffe1a6"
    if abs(py - top) <= abs(py - bottom):
        draw.rectangle((px - door_half, top - 1, px + door_half, top + WALL + 1), fill=threshold)
        draw.line((px - door_half, top + WALL + 1, px + door_half, top + WALL + 1), fill="#8a6d3b")
    else:
        draw.rectangle((px - door_half, bottom - WALL - 1, px + door_half, bottom + 1), fill=threshold)
        draw.line((px - door_half, bottom - WALL - 1, px + door_half, bottom - WALL - 1), fill="#8a6d3b")


def draw_corridor(draw: ImageDraw.ImageDraw, corridor: dict[str, Any]) -> None:
    box = rect_px(corridor)
    draw_tile_floor(draw, box, "#b8ad91", "#a69a7d")
    draw.rectangle(box, outline="#2a2333", width=2)


def draw_label(draw: ImageDraw.ImageDraw, font: ImageFont.ImageFont, room: dict[str, Any], text: str) -> None:
    left, top, right, _bottom = room_rect_px(room)
    label = text.split()[0][:10]
    x = left + WALL + 3
    y = top + WALL + 2
    width = min(max(26, len(label) * 5 + 7), max(30, right - left - 14))
    draw.rectangle((x, y, x + width, y + 8), fill="#3b3340", outline="#7d715d")
    draw.text((x + 3, y), label, fill="#f6e7c5", font=font)


def furniture_box(room: dict[str, Any], item: dict[str, Any]) -> tuple[int, int, int, int]:
    wx, wy = local_to_world(room, item)
    scale = max(0.55, min(1.8, float(item.get("scale", 1))))
    width = pct(float(item["w"]) * scale)
    height = pct(float(item["h"]) * scale)
    cx = pct(wx)
    cy = pct(wy)
    left, top, right, bottom = cx - width // 2, cy - height // 2, cx + width // 2, cy + height // 2
    room_left, room_top, room_right, room_bottom = room_rect_px(room)
    min_left = room_left + WALL + 2
    min_top = room_top + WALL + 2
    max_right = room_right - WALL - 2
    max_bottom = room_bottom - WALL - 2

    if left < min_left:
        right += min_left - left
        left = min_left
    if top < min_top:
        bottom += min_top - top
        top = min_top
    if right > max_right:
        left -= right - max_right
        right = max_right
    if bottom > max_bottom:
        top -= bottom - max_bottom
        bottom = max_bottom

    return max(min_left, left), max(min_top, top), min(max_right, right), min(max_bottom, bottom)


def draw_screen(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], color: str) -> None:
    left, top, right, bottom = box
    draw.rectangle((left + 2, top + 2, right - 2, bottom - 2), fill="#111827")
    draw.rectangle((left + 4, top + 4, right - 4, bottom - 4), fill=color)
    for y in range(top + 6, bottom - 5, 4):
        draw.line((left + 6, y, right - 6, y), fill="#1f6f5b")


def draw_furniture(draw: ImageDraw.ImageDraw, room: dict[str, Any], item: dict[str, Any]) -> None:
    kind = str(item.get("type", "table"))
    left, top, right, bottom = furniture_box(room, item)
    main, accent = FURNITURE_COLORS.get(kind, ("#796553", "#c7a46b"))
    draw.rectangle((left + 2, top + 3, right + 2, bottom + 3), fill="#1b1722")

    if kind in {"terminal", "server"}:
        draw.rectangle((left, top, right, bottom), fill=main, outline="#1d2430")
        draw_screen(draw, (left + 2, top + 2, right - 2, bottom - 2), accent)
        if kind == "server":
            for y in range(top + 4, bottom - 2, 5):
                draw.rectangle((left + 3, y, right - 3, y + 2), fill="#64748b")
        return

    if kind == "portal":
        draw.ellipse((left, top, right, bottom), fill=main, outline="#213b63", width=2)
        draw.ellipse((left + 4, top + 4, right - 4, bottom - 4), fill=accent)
        draw.rectangle((left + 7, top + 2, right - 7, bottom - 2), outline="#eefcff")
        return

    if kind == "board":
        draw.rectangle((left, top, right, bottom), fill=main, outline="#1c2f3d")
        draw.rectangle((left + 2, top + 2, right - 2, bottom - 2), fill=accent)
        draw.line((left + 4, top + 5, right - 5, top + 5), fill="#5b7f8c")
        return

    if kind in {"bookshelf", "cabinet", "locker"}:
        draw.rectangle((left, top, right, bottom), fill=main, outline="#3f2f23")
        for x in range(left + 4, right, 7):
            draw.rectangle((x, top + 3, min(x + 4, right - 2), bottom - 3), fill=accent)
        return

    if kind in {"desk", "table", "workbench"}:
        draw.rectangle((left, top, right, bottom), fill=main, outline="#463422")
        draw.rectangle((left + 3, top + 3, right - 3, bottom - 3), fill=accent)
        draw.rectangle((left + 5, bottom - 4, left + 8, bottom + 1), fill="#5b3d2a")
        draw.rectangle((right - 8, bottom - 4, right - 5, bottom + 1), fill="#5b3d2a")
        return

    if kind in {"chair", "coffee"}:
        draw.rectangle((left, top, right, bottom), fill=main, outline="#4d382b")
        draw.rectangle((left + 3, top + 3, right - 3, bottom - 3), fill=accent)
        return

    if kind in {"sofa", "bed"}:
        draw.rectangle((left, top, right, bottom), fill=main, outline="#445344")
        draw.rectangle((left + 3, top + 3, right - 3, bottom - 3), fill=accent)
        if kind == "bed":
            draw.rectangle((left + 3, top + 3, left + 11, bottom - 3), fill="#edf2f7")
        return

    draw.rectangle((left, top, right, bottom), fill=main, outline="#3f3428")


def generate(yaml_path: Path, out_path: Path) -> None:
    manifest = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    image = Image.new("RGB", (BASE_SIZE, BASE_SIZE), "#b8ad91")
    draw = ImageDraw.Draw(image)
    font = ImageFont.load_default()

    bounds = manifest.get("bounds", {"left": 2, "top": 2, "width": 96, "height": 96})
    outer = rect_px(bounds)
    draw.rectangle(outer, fill="#b8ad91", outline="#37283a", width=4)

    for corridor in manifest.get("corridors", []):
        draw_corridor(draw, corridor)

    rooms = manifest.get("rooms", {})
    for room_key, room in rooms.items():
        if room_key == "offline_corner":
            continue
        box = room_rect_px(room)
        floor = ROOM_COLORS.get(room_key, "#c6b891")
        grid = ROOM_ACCENTS.get(room_key, "#d6c8a3")
        draw_tile_floor(draw, box, floor, grid)

    for room_key, room in rooms.items():
        if room_key == "offline_corner":
            continue
        draw_room_walls(draw, room_key, room)

    for room_key, room in rooms.items():
        if room_key == "offline_corner":
            continue
        for item in room.get("furniture", []):
            draw_furniture(draw, room, item)
        draw_label(draw, font, room, str(room.get("name", room_key)))

    # Pixel threshold details on corridor intersections.
    for room_key, room in rooms.items():
        if room_key == "offline_corner":
            continue
        if "portal" not in room:
            continue
        px = pct(float(room["portal"]["x"]))
        py = pct(float(room["portal"]["y"]))
        draw.rectangle((px - 5, py - 2, px + 5, py + 2), fill="#ffe7b7")

    out = image.resize((OUT_SIZE, OUT_SIZE), Image.Resampling.NEAREST)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out.save(out_path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yaml", type=Path, default=DEFAULT_YAML)
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = parser.parse_args()
    generate(args.yaml, args.out)
    print(f"wrote {args.out}")


if __name__ == "__main__":
    main()

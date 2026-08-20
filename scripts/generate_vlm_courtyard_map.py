#!/usr/bin/env python3
"""Generate a compact terraced house with one central gallery and aligned diagnostics."""
from __future__ import annotations

import argparse
import math
from pathlib import Path
from typing import Any

import yaml
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
SIZE = 960
BUBBLE = 1.10
WALL_WIDTH_PX = 8
OUTER_WALL_WIDTH_PX = 11
LABEL_FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
PREFERRED_LABEL_FONT_SIZE = 15
MIN_LABEL_FONT_SIZE = 10
LABEL_HORIZONTAL_PADDING_PX = 7
LABEL_VERTICAL_PADDING_PX = 5
HOUSE = {"left": 8.0, "top": 8.0, "width": 84.0, "height": 84.0}
GALLERY = {"key": "central-gallery", "left": 8.0, "top": 45.0, "width": 84.0, "height": 10.0}
COLUMN_WIDTHS = [16.0, 17.0, 18.0, 17.0, 16.0]
ROOM_SPECS = [
    ("think_lab", "Thinking Room", "north", ["thinking", "awaiting_input"]),
    ("blueprint_lab", "Blueprint Lab", "north", ["planning"]),
    ("clone_bay", "Clone Bay", "north", ["initializing", "collaborating"]),
    ("file_library", "File Library", "north", ["reading_files"]),
    ("code_workbench", "Code Workbench", "north", ["editing_files", "self_healing"]),
    ("terminal_bay", "Terminal Bay", "south", ["shell_command", "executing"]),
    ("session_archive", "Session Archive", "south", ["branch_session"]),
    ("standby_dock", "Standby Dock", "south", ["idle", "sleeping"]),
    ("response_studio", "Response Studio", "south", ["responding"]),
    ("tool_forge", "Tool Forge", "south", ["tool_call", "invoking_skill", "browsing"]),
]
ROOM_COLORS = [
    "#ddc98f", "#cfc4a4", "#b7cada", "#c7b783", "#c4cfaa",
    "#9fc1c2", "#beb593", "#c8bd9e", "#d7b797", "#afc8aa",
]

FURNITURE_SCHEMES = {
    "think_lab": [("desk", "Focus Computer Desk"), ("chair", "Thinking Armchair"), ("board", "Idea Whiteboard"), ("lamp", "Idea Lamp")],
    "blueprint_lab": [("table", "Blueprint Planning Table"), ("board", "Route Planning Board"), ("cabinet", "Blueprint Cabinet")],
    "clone_bay": [("portal", "Subagent Docking Pod"), ("desk", "Subagent Workstation"), ("terminal", "Dispatch Console"), ("server", "Clone Node Rack")],
    "file_library": [("bookshelf", "Research Bookshelf"), ("bookshelf", "Reference Shelf"), ("desk", "Reading Desk"), ("chair", "Reading Chair")],
    "code_workbench": [("desk", "Coding Computer Desk"), ("terminal", "Code Monitor"), ("chair", "Developer Chair"), ("board", "Patch Review Board")],
    "terminal_bay": [("terminal", "Shell Terminal Console"), ("server", "Process Server Rack"), ("chair", "Operator Chair"), ("terminal", "Log Monitor")],
    "session_archive": [("cabinet", "Session File Cabinet"), ("bookshelf", "History Shelf"), ("table", "Timeline Index Table")],
    "standby_dock": [("sofa", "Idle Rest Sofa"), ("coffee", "Break Coffee Table"), ("bed", "Sleep Pod"), ("locker", "Ready Locker")],
    "response_studio": [("desk", "Response Writing Desk"), ("terminal", "Conversation Monitor"), ("chair", "Writer Chair"), ("bookshelf", "Style Reference Shelf")],
    "tool_forge": [("workbench", "Tool Assembly Bench"), ("server", "External Tool Server"), ("locker", "Parts Locker"), ("terminal", "MCP Tool Console")],
}

FURNITURE_SIZES = {
    "bed": (5.4, 4.2), "board": (4.4, 1.8), "bookshelf": (4.2, 2.4),
    "cabinet": (3.4, 2.8), "chair": (2.2, 2.2), "coffee": (3.0, 2.4),
    "desk": (5.0, 3.0), "lamp": (1.8, 1.8), "locker": (3.2, 2.6),
    "portal": (4.2, 3.4), "server": (3.4, 3.0), "sofa": (5.4, 3.2),
    "table": (5.2, 3.4), "terminal": (3.8, 2.8), "workbench": (5.2, 3.2),
}


class FlowMap(dict):
    """Mapping rendered in YAML flow style for the browser's small YAML parser."""


class FlowList(list):
    """Sequence rendered in YAML flow style for the browser's small YAML parser."""


class BrowserYamlDumper(yaml.SafeDumper):
    def increase_indent(self, flow: bool = False, indentless: bool = False):
        return super().increase_indent(flow, False)

    def ignore_aliases(self, data: Any) -> bool:
        return True


def _represent_flow_map(dumper: BrowserYamlDumper, value: FlowMap):
    return dumper.represent_mapping("tag:yaml.org,2002:map", value, flow_style=True)


def _represent_flow_list(dumper: BrowserYamlDumper, value: FlowList):
    return dumper.represent_sequence("tag:yaml.org,2002:seq", value, flow_style=True)


BrowserYamlDumper.add_representer(FlowMap, _represent_flow_map)
BrowserYamlDumper.add_representer(FlowList, _represent_flow_list)


def flow(value: Any) -> Any:
    if isinstance(value, dict):
        return FlowMap({key: flow(item) for key, item in value.items()})
    if isinstance(value, list):
        return FlowList(flow(item) for item in value)
    return value


def browser_compatible_manifest(manifest: dict[str, Any]) -> dict[str, Any]:
    """Keep top-level/room blocks readable while making nested values parser-safe."""
    output: dict[str, Any] = {}
    for key, value in manifest.items():
        if key == "rooms":
            output[key] = {
                room_key: {
                    field: ([flow(item) for item in field_value] if field == "furniture" else flow(field_value))
                    if isinstance(field_value, (dict, list)) else field_value
                    for field, field_value in room.items()
                }
                for room_key, room in value.items()
            }
        elif key in {"corridors", "free_space", "blocked"}:
            output[key] = [flow(item) for item in value]
        elif isinstance(value, (dict, list)):
            output[key] = flow(value)
        else:
            output[key] = value
    return output


def dump_manifest(manifest: dict[str, Any]) -> str:
    return yaml.dump(
        browser_compatible_manifest(manifest),
        Dumper=BrowserYamlDumper,
        sort_keys=False,
        allow_unicode=True,
        width=1_000_000,
    )


def rect(left: float, top: float, width: float, height: float) -> dict[str, float]:
    return {"left": round(left, 3), "top": round(top, 3), "width": round(width, 3), "height": round(height, 3)}


def inset(value: dict[str, float], amount: float = BUBBLE) -> dict[str, float]:
    return rect(
        value["left"] + amount,
        value["top"] + amount,
        value["width"] - 2 * amount,
        value["height"] - 2 * amount,
    )


def point(x: float, y: float) -> dict[str, float]:
    return {"x": round(x, 3), "y": round(y, 3)}


def px(x: float, y: float) -> tuple[int, int]:
    return round(x * SIZE / 100), round(y * SIZE / 100)


def pixel_box(value: dict[str, float]) -> tuple[int, int, int, int]:
    return (*px(value["left"], value["top"]), *px(value["left"] + value["width"], value["top"] + value["height"]))


def furniture_for_room(key: str, room_rect: dict[str, float], walkable: dict[str, float], row: str) -> list[dict[str, Any]]:
    """Place semantic furniture around the perimeter while keeping a clear centre aisle."""
    y_near = walkable["top"] + 5.0 if row == "north" else walkable["top"] + walkable["height"] - 5.0
    y_deep = walkable["top"] + 14.0 if row == "north" else walkable["top"] + walkable["height"] - 14.0
    slots = [
        (walkable["left"] + 3.3, y_near, "right"),
        (walkable["left"] + walkable["width"] - 3.3, y_near, "left"),
        (walkable["left"] + 3.3, y_deep, "right"),
        (walkable["left"] + walkable["width"] - 3.3, y_deep, "left"),
    ]
    output = []
    for index, (kind, label) in enumerate(FURNITURE_SCHEMES[key]):
        x, y, facing = slots[index]
        width, height = FURNITURE_SIZES[kind]
        stand_x = x + width / 2 + 1.15 if facing == "right" else x - width / 2 - 1.15
        local_x = (stand_x - room_rect["left"]) / room_rect["width"] * 100
        local_y = (y - room_rect["top"]) / room_rect["height"] * 100
        output.append({
            "type": kind,
            "label": label,
            "x": round(x, 3),
            "y": round(y, 3),
            "w": width,
            "h": height,
            "footprint": {"w": width, "h": height},
            "coordinate_space": "world",
            "scale": 1.0,
            "icon_style": "semantic-pixel",
            "interaction_role": key,
            "anchors": [{"key": "use", "x": round(local_x, 3), "y": round(local_y, 3), "facing": facing}],
        })
    return output


def build_manifest() -> dict[str, Any]:
    rooms: dict[str, Any] = {}
    doors: list[dict[str, Any]] = []
    x_positions = [HOUSE["left"]]
    for width in COLUMN_WIDTHS[:-1]:
        x_positions.append(x_positions[-1] + width)

    for index, (key, name, row, states) in enumerate(ROOM_SPECS):
        column = index % 5
        left = x_positions[column]
        width = COLUMN_WIDTHS[column]
        if row == "north":
            room_rect = rect(left, HOUSE["top"], width, GALLERY["top"] - HOUSE["top"])
            side = "bottom"
        else:
            south_top = GALLERY["top"] + GALLERY["height"]
            room_rect = rect(left, south_top, width, HOUSE["top"] + HOUSE["height"] - south_top)
            side = "top"
        walkable = inset(room_rect)
        center_x = room_rect["left"] + room_rect["width"] / 2
        center_y = room_rect["top"] + room_rect["height"] / 2
        portal_y = GALLERY["top"] if row == "north" else GALLERY["top"] + GALLERY["height"]
        aisle_y = portal_y - 2.5 if row == "north" else portal_y + 2.5
        hub_y = portal_y + 2.5 if row == "north" else portal_y - 2.5
        portal = point(center_x, portal_y)
        aisle = point(center_x, aisle_y)
        hub = point(center_x, hub_y)
        door_width = 4.2
        hinge_side = "left" if column % 2 == 0 else "right"
        hinge_x = center_x - door_width / 2 if hinge_side == "left" else center_x + door_width / 2
        clearance_left = hinge_x if hinge_side == "left" else hinge_x - door_width
        clearance_top = portal_y - door_width if row == "north" else portal_y
        clearance = rect(clearance_left, clearance_top, door_width, door_width)
        furniture = furniture_for_room(key, room_rect, walkable, row)
        rooms[key] = {
            "name": name,
            "description": f"Terraced {row} room opening directly onto the central gallery.",
            "states": states,
            "row": row,
            "rect": room_rect,
            "walkable_rect": dict(walkable),
            "free_space": [dict(walkable)],
            "wall_bubble": BUBBLE,
            "center": point(center_x, center_y),
            "portal": dict(portal),
            "aisle": dict(aisle),
            "hub": dict(hub),
            "anchors": {"center": point(center_x, center_y), "portal": dict(portal), "aisle": dict(aisle), "hub": dict(hub)},
            "patrol": [point(center_x, center_y), dict(aisle)],
            "label_anchor": {
                "x": round(center_x, 3),
                "y": round(room_rect["top"] + 2.2 if row == "north" else room_rect["top"] + room_rect["height"] - 2.2, 3),
                "contrast": "high",
            },
            "furniture": furniture,
        }
        doors.append(
            {
                "key": f"{key}--central-gallery",
                "room": key,
                "connects": [key, "central_gallery"],
                "side": side,
                "center": dict(portal),
                "width": door_width,
                "hinge": point(hinge_x, portal_y),
                "hinge_side": hinge_side,
                "swing": "inward",
                "swing_degrees": 90,
                "swing_radius": door_width,
                "clearance": {"room": key, "rect": clearance},
            }
        )

    plants: list[dict[str, Any]] = []
    kinds = ["shrub", "flower_cluster", "shrub", "small_tree"]
    radii = [1.05, 0.72, 1.35, 1.62, 0.92]
    border_points = []
    for index, x in enumerate(range(4, 98, 4)):
        border_points.extend([(x, 4.4 + (index % 3) * 0.35), (x, 95.6 - (index % 2) * 0.4)])
    for index, y in enumerate(range(10, 92, 4)):
        border_points.extend([(4.4 + (index % 2) * 0.35, y), (95.6 - (index % 3) * 0.3, y)])
    for index, (x, y) in enumerate(border_points):
        plants.append({
            "center": point(x, y),
            "radius": radii[index % len(radii)],
            "kind": kinds[index % len(kinds)],
            "tone": index % 4,
        })

    return {
        "version": 3,
        "key": "VLM_Generated",
        "name": "Compact Terraced Gallery House",
        "image": "/global_map/VLM_Generated.png",
        "description": "Two contiguous five-room terraces share one bright central gallery inside a continuous flower garden.",
        "bounds": {"left": 2, "top": 2, "width": 96, "height": 96},
        "geometry": {
            "layout": "compact-terraced-central-gallery",
            "corridor_mode": "single-gallery",
            "wall_bubble": BUBBLE,
            "partition_wall_width_px": WALL_WIDTH_PX,
            "outer_wall_width_px": OUTER_WALL_WIDTH_PX,
            "units": "percent",
            "coordinate_space": "image-inner-bounds",
        },
        "rooms": rooms,
        "corridors": [dict(GALLERY)],
        "free_space": [dict(GALLERY)] + [dict(room["walkable_rect"]) for room in rooms.values()],
        "doors": doors,
        "garden_ring": {
            "outer": {"left": 2, "top": 2, "width": 96, "height": 96},
            "house": dict(HOUSE),
            "style": "layered-naturalistic",
        },
        "plants": plants,
    }


def draw_floor_texture(draw: ImageDraw.ImageDraw, value: dict[str, float], color: str, vertical: bool = True) -> None:
    draw.rectangle(pixel_box(value), fill=color)
    if vertical:
        start = math.ceil(value["left"] + 2)
        stop = math.floor(value["left"] + value["width"])
        for x in range(start, stop, 4):
            draw.line((*px(x, value["top"] + 0.4), *px(x, value["top"] + value["height"] - 0.4)), fill="#ffffff", width=1)
    else:
        start = math.ceil(value["top"] + 1)
        stop = math.floor(value["top"] + value["height"])
        for y in range(start, stop, 2):
            draw.line((*px(value["left"] + 0.4, y), *px(value["left"] + value["width"] - 0.4, y)), fill="#c9b98e", width=1)


def draw_door(draw: ImageDraw.ImageDraw, door: dict[str, Any], floor_color: str) -> None:
    center_x, center_y = px(**door["center"])
    half = round(door["width"] * SIZE / 200)
    opening_width = WALL_WIDTH_PX + 4
    draw.line((center_x - half, center_y, center_x + half, center_y), fill=floor_color, width=opening_width)
    hinge_x, hinge_y = px(**door["hinge"])
    radius = round(door["swing_radius"] * SIZE / 100)
    leaf_end_y = hinge_y - radius if door["side"] == "bottom" else hinge_y + radius
    draw.line((hinge_x, hinge_y, hinge_x, leaf_end_y), fill="#6f4f3a", width=4)
    if door["side"] == "bottom":
        arc_box = (hinge_x - radius, hinge_y - radius, hinge_x + radius, hinge_y + radius)
        angles = (270, 360) if door["hinge_side"] == "left" else (180, 270)
    else:
        arc_box = (hinge_x - radius, hinge_y - radius, hinge_x + radius, hinge_y + radius)
        angles = (0, 90) if door["hinge_side"] == "left" else (90, 180)
    draw.arc(arc_box, *angles, fill="#8a6a4e", width=2)


def draw_semantic_furniture(draw: ImageDraw.ImageDraw, item: dict[str, Any]) -> None:
    fp = item["footprint"]
    box = rect(item["x"] - fp["w"] / 2, item["y"] - fp["h"] / 2, fp["w"], fp["h"])
    left, top, right, bottom = pixel_box(box)
    kind = item["type"]
    outline = "#2b2130"
    palettes = {
        "desk": ("#8b5e3c", "#d9a45e"), "table": ("#9a6945", "#e0b46f"),
        "chair": ("#365f76", "#70a7bc"), "terminal": ("#263747", "#63d8e5"),
        "server": ("#3e4653", "#84d187"), "bookshelf": ("#70472f", "#e8c56d"),
        "cabinet": ("#59636b", "#b8c3c9"), "locker": ("#526a72", "#a9ced0"),
        "board": ("#e9e2cb", "#5fa8a8"), "lamp": ("#8f6735", "#ffe17a"),
        "portal": ("#594278", "#b58cff"), "sofa": ("#6d5877", "#c49bc9"),
        "coffee": ("#7b5136", "#d89a5b"), "bed": ("#697a94", "#d9e5f2"),
        "workbench": ("#70472f", "#e0964f"),
    }
    base, accent = palettes.get(kind, ("#75533b", "#d7ad70"))
    draw.rounded_rectangle((left, top, right, bottom), radius=3, fill=base, outline=outline, width=2)
    cx, cy = (left + right) // 2, (top + bottom) // 2
    if kind in {"terminal", "server"}:
        draw.rectangle((left + 4, top + 4, right - 4, bottom - 5), fill="#17232d", outline=accent, width=2)
        draw.line((left + 7, cy, right - 7, cy), fill=accent, width=2)
        draw.ellipse((right - 8, top + 5, right - 5, top + 8), fill="#8cff8c")
    elif kind in {"desk", "table", "workbench"}:
        draw.rectangle((left + 3, top + 3, right - 3, cy), fill=accent)
        if kind == "desk":
            draw.rectangle((cx - 7, top + 2, cx + 7, cy + 1), fill="#263747", outline="#72d7e5")
        elif kind == "workbench":
            draw.line((cx - 8, cy - 4, cx + 7, top + 4), fill="#4b2f24", width=3)
    elif kind == "bookshelf":
        for x in range(left + 5, right - 3, 6):
            draw.rectangle((x, top + 4, min(x + 3, right - 3), bottom - 4), fill=accent)
    elif kind in {"cabinet", "locker"}:
        draw.line((cx, top + 3, cx, bottom - 3), fill=accent, width=2)
        draw.ellipse((cx - 4, cy - 1, cx - 2, cy + 1), fill="#f5dc87")
        draw.ellipse((cx + 2, cy - 1, cx + 4, cy + 1), fill="#f5dc87")
    elif kind == "board":
        draw.rectangle((left + 3, top + 3, right - 3, bottom - 3), fill="#f4f1df", outline=accent)
        draw.line((left + 7, cy, right - 7, cy), fill="#e06b65", width=2)
    elif kind == "lamp":
        draw.ellipse((cx - 7, top + 2, cx + 7, cy + 3), fill=accent, outline="#c59838")
        draw.line((cx, cy, cx, bottom - 2), fill="#553c29", width=3)
    elif kind == "portal":
        draw.ellipse((left + 4, top + 3, right - 4, bottom - 3), outline=accent, width=4)
        draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill="#e9dcff")
    elif kind == "sofa":
        draw.rounded_rectangle((left + 3, top + 4, right - 3, bottom - 4), radius=5, fill=accent)
        draw.line((cx, top + 5, cx, bottom - 5), fill=base, width=2)
    elif kind == "bed":
        draw.rectangle((left + 3, top + 3, right - 3, bottom - 3), fill=accent)
        draw.rectangle((left + 5, top + 5, cx, cy + 2), fill="#f5f0df")
    elif kind == "coffee":
        draw.ellipse((left + 3, top + 3, right - 3, bottom - 3), fill=accent, outline=outline)
        draw.ellipse((cx - 3, cy - 3, cx + 3, cy + 3), fill="#f0e0c0")
    elif kind == "chair":
        draw.rounded_rectangle((left + 4, top + 4, right - 4, bottom - 4), radius=4, fill=accent)


def draw_landscape_plant(draw: ImageDraw.ImageDraw, plant: dict[str, Any]) -> None:
    x, y = px(**plant["center"])
    radius = round(plant["radius"] * SIZE / 100)
    kind = plant.get("kind", "shrub")
    tone = int(plant.get("tone", 0))
    greens = [("#173f2a", "#357a43"), ("#244f30", "#4f8b48"), ("#1e4933", "#5b9251"), ("#315b35", "#70a05a")]
    dark, light = greens[tone % len(greens)]
    if kind == "small_tree":
        draw.rectangle((x - 2, y + radius // 3, x + 2, y + radius + 4), fill="#65472d")
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=dark, outline="#132e20", width=2)
        draw.ellipse((x - radius // 2, y - radius // 2, x + radius // 2, y + radius // 3), fill=light)
    elif kind == "flower_cluster":
        for dx, dy, color in [(-5, 0, "#f2a7c4"), (4, -4, "#f6d56b"), (4, 5, "#b9a4ed"), (0, 0, "#fff0ae")]:
            draw.ellipse((x + dx - 4, y + dy - 4, x + dx + 4, y + dy + 4), fill=color, outline="#466c38")
    else:
        draw.ellipse((x - radius, y - radius // 2, x + radius, y + radius // 2), fill=dark, outline="#132e20", width=2)
        draw.ellipse((x - radius // 2, y - radius // 2, x + radius // 3, y + radius // 3), fill=light)


def fit_room_label(
    draw: ImageDraw.ImageDraw,
    label: str,
    room_rect: dict[str, float],
    label_anchor: dict[str, Any],
) -> dict[str, Any]:
    """Fit a padded label badge between the room's wall-safe inner edges."""
    room_left, _, room_right, _ = pixel_box(room_rect)
    wall_safe_inset = math.ceil(max(WALL_WIDTH_PX, OUTER_WALL_WIDTH_PX) / 2)
    safe_width = room_right - room_left - 2 * wall_safe_inset
    font = None
    bbox = (0, 0, 0, 0)
    font_size = MIN_LABEL_FONT_SIZE
    for candidate_size in range(PREFERRED_LABEL_FONT_SIZE, MIN_LABEL_FONT_SIZE - 1, -1):
        try:
            candidate_font = ImageFont.truetype(LABEL_FONT_PATH, candidate_size)
        except OSError:
            candidate_font = ImageFont.load_default(size=candidate_size)
        candidate_bbox = draw.textbbox((0, 0), label, font=candidate_font)
        candidate_width = candidate_bbox[2] - candidate_bbox[0]
        font, bbox, font_size = candidate_font, candidate_bbox, candidate_size
        if candidate_width + 2 * LABEL_HORIZONTAL_PADDING_PX <= safe_width:
            break

    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    badge_width = text_width + 2 * LABEL_HORIZONTAL_PADDING_PX
    badge_height = text_height + 2 * LABEL_VERTICAL_PADDING_PX
    anchor_x, anchor_y = px(label_anchor["x"], label_anchor["y"])
    badge_left = anchor_x - badge_width // 2
    badge_top = anchor_y - badge_height // 2
    return {
        "font": font,
        "font_size": font_size,
        "text_width": text_width,
        "text_height": text_height,
        "text_position": (anchor_x - text_width / 2 - bbox[0], anchor_y - text_height / 2 - bbox[1]),
        "badge": (badge_left, badge_top, badge_left + badge_width, badge_top + badge_height),
    }


def render(manifest: dict[str, Any], image_path: Path, overlay_path: Path, walk_path: Path) -> None:
    image = Image.new("RGB", (SIZE, SIZE), "#779765")
    draw = ImageDraw.Draw(image)

    for y in range(0, SIZE, 24):
        draw.line((0, y, SIZE, y), fill="#82a16e")
    for plant in manifest["plants"]:
        draw_landscape_plant(draw, plant)

    draw.rectangle(pixel_box(HOUSE), fill="#d8cba8")
    for index, room in enumerate(manifest["rooms"].values()):
        draw_floor_texture(draw, room["rect"], ROOM_COLORS[index], vertical=True)
    draw_floor_texture(draw, GALLERY, "#dfd2ad", vertical=False)

    # Shared partitions are drawn once. This is the visual fix for double-thick walls and false gaps.
    column_edges = [HOUSE["left"] + sum(COLUMN_WIDTHS[:index]) for index in range(1, 5)]
    for edge in column_edges:
        draw.line((*px(edge, HOUSE["top"]), *px(edge, GALLERY["top"])), fill="#251d2a", width=WALL_WIDTH_PX)
        draw.line((*px(edge, GALLERY["top"] + GALLERY["height"]), *px(edge, HOUSE["top"] + HOUSE["height"])), fill="#251d2a", width=WALL_WIDTH_PX)
    draw.line((*px(HOUSE["left"], GALLERY["top"]), *px(HOUSE["left"] + HOUSE["width"], GALLERY["top"])), fill="#251d2a", width=WALL_WIDTH_PX)
    draw.line((*px(HOUSE["left"], GALLERY["top"] + GALLERY["height"]), *px(HOUSE["left"] + HOUSE["width"], GALLERY["top"] + GALLERY["height"])), fill="#251d2a", width=WALL_WIDTH_PX)
    draw.rectangle(pixel_box(HOUSE), outline="#241c29", width=OUTER_WALL_WIDTH_PX)

    for door in manifest["doors"]:
        draw_door(draw, door, "#eadcb8")

    for room in manifest["rooms"].values():
        for item in room["furniture"]:
            draw_semantic_furniture(draw, item)
        label = room["name"]
        layout = fit_room_label(draw, label, room["rect"], room["label_anchor"])
        draw.rounded_rectangle(layout["badge"], radius=4, fill="#241c29", outline="#f4e8c8", width=2)
        draw.text(layout["text_position"], label, fill="#fff4d7", font=layout["font"])

    image_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(image_path)

    overlay = image.copy()
    overlay_draw = ImageDraw.Draw(overlay)
    for room in manifest["rooms"].values():
        overlay_draw.rectangle(pixel_box(room["walkable_rect"]), outline="#00efff", width=4)
    overlay_draw.rectangle(pixel_box(GALLERY), outline="#55ff75", width=4)
    for door in manifest["doors"]:
        overlay_draw.rectangle(pixel_box(door["clearance"]["rect"]), outline="#ff9f1c", width=3)
        x, y = px(**door["center"])
        overlay_draw.ellipse((x - 6, y - 6, x + 6, y + 6), fill="#ff32dc")
    overlay_path.parent.mkdir(parents=True, exist_ok=True)
    overlay.save(overlay_path)

    walkability = Image.new("L", (SIZE, SIZE), 0)
    walk_draw = ImageDraw.Draw(walkability)
    walk_draw.rectangle(pixel_box(GALLERY), fill=190)
    for room in manifest["rooms"].values():
        walk_draw.rectangle(pixel_box(room["walkable_rect"]), fill=255)
    for door in manifest["doors"]:
        x, y = px(**door["center"])
        half = round(door["width"] * SIZE / 200)
        walk_draw.rectangle((x - half, y - 7, x + half, y + 7), fill=225)
    walkability.save(walk_path)


def generate(root: Path) -> list[Path]:
    manifest = build_manifest()
    yaml_path = root / "global_map/VLM_Generated.yaml"
    image_path = root / "global_map/VLM_Generated.png"
    overlay_path = root / "tmp/VLM_Generated_overlay.png"
    walk_path = root / "tmp/VLM_Generated_walkability.png"
    yaml_path.parent.mkdir(parents=True, exist_ok=True)
    yaml_path.write_text(dump_manifest(manifest), encoding="utf-8")
    render(manifest, image_path, overlay_path, walk_path)
    return [image_path, yaml_path, overlay_path, walk_path]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, default=ROOT)
    args = parser.parse_args()
    for path in generate(args.output_dir.resolve()):
        print(f"wrote {path}")


if __name__ == "__main__":
    main()

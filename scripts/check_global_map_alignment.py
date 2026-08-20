#!/usr/bin/env python3
"""Validate that a global_map YAML manifest plausibly matches its PNG floorplan."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

import yaml
from PIL import Image, ImageStat

MAX_FURNITURE_OCCUPANCY_RATIO = 0.4


def rect_to_pixels(rect: dict[str, Any], width: int, height: int) -> tuple[int, int, int, int]:
    left = int(round(float(rect["left"]) * width / 100))
    top = int(round(float(rect["top"]) * height / 100))
    right = int(round((float(rect["left"]) + float(rect["width"])) * width / 100))
    bottom = int(round((float(rect["top"]) + float(rect["height"])) * height / 100))
    return max(0, left), max(0, top), min(width, right), min(height, bottom)


def point_in_rect(point: dict[str, Any], rect: dict[str, Any], padding: float = 0) -> bool:
    x = float(point["x"])
    y = float(point["y"])
    return (
        float(rect["left"]) - padding <= x <= float(rect["left"]) + float(rect["width"]) + padding
        and float(rect["top"]) - padding <= y <= float(rect["top"]) + float(rect["height"]) + padding
    )


def normalize_corridors(raw: Any) -> list[dict[str, Any]]:
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict):
        result = []
        for key, value in raw.items():
            if not isinstance(value, dict):
                continue
            rect = dict(value.get("rect") or value)
            rect.setdefault("key", str(key).replace("_", "-"))
            result.append(rect)
        return result
    return []


def crop_has_visual_content(image: Image.Image, box: tuple[int, int, int, int]) -> bool:
    left, top, right, bottom = box
    if right <= left or bottom <= top:
        return False
    crop = image.crop(box).convert("RGB")
    stat = ImageStat.Stat(crop)
    # Single-color crops usually mean the YAML rect points at empty background.
    return sum(stat.stddev) > 4.0 and len(crop.getcolors(maxcolors=50_000) or []) > 4


def furniture_occupancy(room: dict[str, Any]) -> dict[str, Any]:
    rect = room.get("rect") if isinstance(room, dict) else None
    if not isinstance(rect, dict):
        return {"area": 0, "furniture_area": 0, "ratio": 0, "count": 0}

    room_width = max(0.0, float(rect.get("width") or 0))
    room_height = max(0.0, float(rect.get("height") or 0))
    room_area = room_width * room_height
    furniture_area = 0.0
    count = 0

    for prop in room.get("furniture") or []:
        if not isinstance(prop, dict):
            continue
        width = max(0.0, float(prop.get("w", prop.get("width", 0)) or 0))
        height = max(0.0, float(prop.get("h", prop.get("height", 0)) or 0))
        scale = min(1.8, max(0.55, float(prop.get("scale", 1) or 1)))
        furniture_area += width * height * scale * scale
        count += 1

    ratio = furniture_area / room_area if room_area else 0
    return {
        "area": round(room_area, 4),
        "furniture_area": round(furniture_area, 4),
        "ratio": round(ratio, 4),
        "count": count,
    }


def analyze(yaml_path: Path, png_path: Path) -> dict[str, Any]:
    manifest = yaml.safe_load(yaml_path.read_text(encoding="utf-8"))
    image = Image.open(png_path).convert("RGB")
    width, height = image.size
    raw = image.tobytes()
    dark_pixels = sum(1 for index in range(0, len(raw), 3) if raw[index] + raw[index + 1] + raw[index + 2] < 90)
    dark_ratio = dark_pixels / (width * height)

    errors: list[str] = []
    rooms = manifest.get("rooms") if isinstance(manifest, dict) else {}
    corridors = normalize_corridors(manifest.get("corridors") if isinstance(manifest, dict) else None)
    occupancy_ratios: dict[str, dict[str, Any]] = {}

    corridorless = bool(isinstance(manifest, dict) and (manifest.get("geometry") or {}).get("corridor_mode") == "none")
    if not rooms:
      errors.append("manifest must define rooms")
    if not corridors and not corridorless:
      errors.append("manifest must define corridors as a non-empty list")

    for index, corridor in enumerate(corridors):
        for field in ("left", "top", "width", "height"):
            if field not in corridor:
                errors.append(f"corridor[{index}] missing {field}")
        if not corridorless and all(field in corridor for field in ("left", "top", "width", "height")):
            if not crop_has_visual_content(image, rect_to_pixels(corridor, width, height)):
                errors.append(f"corridor[{index}] does not overlap visible PNG content")

    for room_key, room in (rooms or {}).items():
        if not isinstance(room, dict):
            errors.append(f"room {room_key} must be an object")
            continue
        rect = room.get("rect")
        if not isinstance(rect, dict):
            errors.append(f"room {room_key} missing rect")
            continue
        for field in ("left", "top", "width", "height"):
            if field not in rect:
                errors.append(f"room {room_key} rect missing {field}")
        if room_key != "offline_corner" and all(field in rect for field in ("left", "top", "width", "height")):
            if not crop_has_visual_content(image, rect_to_pixels(rect, width, height)):
                errors.append(f"room {room_key} rect does not overlap visible PNG content")
        for point_name in ("center", "portal", "aisle", "hub"):
            if not isinstance(room.get(point_name), dict) or "x" not in room[point_name] or "y" not in room[point_name]:
                errors.append(f"room {room_key} missing {point_name}.x/y")
        if room_key != "offline_corner" and isinstance(room.get("portal"), dict) and all(field in rect for field in ("left", "top", "width", "height")):
            if not point_in_rect(room["portal"], rect, 0.3):
                errors.append(f"room {room_key} portal is outside room rect")
            if not corridorless and not any(point_in_rect(room["portal"], corridor, 2.8) for corridor in corridors):
                errors.append(f"room {room_key} portal does not touch a corridor")
            if not corridorless and isinstance(room.get("hub"), dict) and not any(point_in_rect(room["hub"], corridor, 0.3) for corridor in corridors):
                errors.append(f"room {room_key} hub is outside corridors")
        if room_key != "offline_corner" and all(field in rect for field in ("left", "top", "width", "height")):
            occupancy = furniture_occupancy(room)
            occupancy_ratios[room_key] = occupancy
            if occupancy["ratio"] > MAX_FURNITURE_OCCUPANCY_RATIO:
                errors.append(
                    f"room {room_key} furniture occupancy ratio {occupancy['ratio']:.4f} exceeds "
                    f"{MAX_FURNITURE_OCCUPANCY_RATIO:.2f}"
                )

    max_occupancy = max((room["ratio"] for room in occupancy_ratios.values()), default=0)

    return {
        "ok": not errors,
        "yaml": str(yaml_path),
        "png": str(png_path),
        "image_size": [width, height],
        "room_count": len(rooms or {}),
        "corridor_count": len(corridors),
        "dark_ratio": round(dark_ratio, 6),
        "max_furniture_occupancy_ratio": round(max_occupancy, 4),
        "furniture_occupancy_ratios": occupancy_ratios,
        "errors": errors,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--yaml", type=Path, required=True)
    parser.add_argument("--png", type=Path, required=True)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    report = analyze(args.yaml, args.png)
    if args.json:
        print(json.dumps(report, ensure_ascii=False, indent=2))
    else:
        status = "OK" if report["ok"] else "FAILED"
        print(f"{status}: {args.yaml} <-> {args.png}")
        print(
            f"rooms={report['room_count']} corridors={report['corridor_count']} "
            f"dark_ratio={report['dark_ratio']} max_furniture_occupancy={report['max_furniture_occupancy_ratio']}"
        )
        for error in report["errors"]:
            print(f"- {error}")
    raise SystemExit(0 if report["ok"] else 1)


if __name__ == "__main__":
    main()

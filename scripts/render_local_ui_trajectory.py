#!/usr/bin/env python3
"""Render the latest Pixelverse UI map and planned trajectory."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tmp" / "local_ui_trajectory.jpg"
LOG_OUT = ROOT / "tmp" / "pixelverse_debug_log.json"
LATEST = ROOT / "tmp" / "latest_test_hook_route.json"
SNAPSHOT = ROOT / "tmp" / "latest_world_snapshot.json"
SCALE = 10
WIDTH = HEIGHT = 100 * SCALE
MARGIN = 72


NODE_CODE = r"""
import fs from 'node:fs';
import { CORRIDOR_RECTS, HOUSE_DOORS, ROOM_LAYOUTS } from './public/house_layout.mjs';
import { getRoomDecor } from './public/ui_strings.mjs';
import {
  furnitureBlockers,
  roomDecorLayout,
  roomInteractionPositions,
  roomLocalToWorld,
} from './public/room_furniture.mjs';
import { selectInteractionTarget } from './public/agent_pose.mjs';
import { buildRoute, FURNITURE_BLOCKERS, routeStaysWalkable } from './public/world_motion.mjs';

const latestPath = './tmp/latest_test_hook_route.json';
const latest = fs.existsSync(latestPath)
  ? JSON.parse(fs.readFileSync(latestPath, 'utf8'))
  : { target_room: 'blueprint_lab', tool_csv: 'search_files,read_file', label: 'default debug route', start_room: 'think_lab', return_room: 'standby_dock' };

const startRoom = latest.start_room || 'think_lab';
const targetRoom = latest.target_room || 'blueprint_lab';
const returnRoom = latest.return_room || 'standby_dock';
const agentPlans = latest.agents || [{
  agent: 'henry-main',
  name: 'Henry',
  role: 'main_agent',
  start_room: startRoom,
  target_room: targetRoom,
  return_room: returnRoom,
  state: 'working',
  tool_csv: latest.tool_csv || '',
}];
const props = Object.fromEntries(Object.keys(ROOM_LAYOUTS).map((roomKey) => {
  const decor = getRoomDecor(roomKey, 'zh-TW');
  const layout = roomDecorLayout(roomKey, decor).map(({ prop, pos }) => ({
    prop,
    pos,
    world: roomLocalToWorld(roomKey, pos),
  }));
  const stands = roomInteractionPositions(roomKey, decor);
  return [roomKey, {
    layout,
    stands,
    blockers: furnitureBlockers(roomKey, decor),
  }];
}));

function roomTarget(roomKey, agent, fallback) {
  const decor = props[roomKey].layout.map((item) => item.prop);
  const positions = props[roomKey].stands;
  return selectInteractionTarget(agent, decor, positions, fallback) || fallback;
}

const routes = agentPlans.map((plan, index) => {
  const fromRoom = plan.start_room || startRoom;
  const toRoom = plan.target_room || targetRoom;
  const homeRoom = plan.return_room || returnRoom;
  const task = plan.tool_csv || latest.tool_csv || '';
  const start = roomTarget(fromRoom, { role: plan.role, state: plan.role === 'subagent' ? 'idle' : 'thinking', task: plan.role === 'subagent' ? 'delegate_task' : 'planning' }, ROOM_LAYOUTS[fromRoom].center);
  const work = roomTarget(toRoom, { role: plan.role, state: plan.state || 'working', task }, ROOM_LAYOUTS[toRoom].center);
  const ret = roomTarget(homeRoom, { role: plan.role, state: 'idle', task: 'idle' }, ROOM_LAYOUTS[homeRoom].center);
  const outbound = buildRoute(start, work, fromRoom, toRoom);
  const inbound = buildRoute(work, ret, toRoom, homeRoom);
  return {
    ...plan,
    index,
    startRoom: fromRoom,
    targetRoom: toRoom,
    returnRoom: homeRoom,
    task,
    start,
    work,
    ret,
    outbound,
    inbound,
    outboundWalkable: routeStaysWalkable(outbound),
    inboundWalkable: routeStaysWalkable(inbound),
    routePointCount: outbound.length + inbound.length,
    anchors: {
      start: ROOM_LAYOUTS[fromRoom],
      target: ROOM_LAYOUTS[toRoom],
      return: ROOM_LAYOUTS[homeRoom],
    },
  };
});

console.log(JSON.stringify({
  latest,
  rooms: ROOM_LAYOUTS,
  corridors: CORRIDOR_RECTS,
  doors: HOUSE_DOORS,
  props,
  furnitureBlockers: FURNITURE_BLOCKERS,
  routes,
  route: routes[0],
}));
"""

FLOORS = {
    "think_lab": (198, 187, 151),
    "blueprint_lab": (187, 202, 194),
    "tool_forge": (190, 180, 155),
    "response_studio": (199, 190, 175),
    "standby_dock": (180, 197, 171),
    "clone_bay": (186, 184, 204),
    "session_archive": (181, 188, 176),
}


def pct(point: dict[str, float]) -> tuple[int, int]:
    return (round(point["x"] * SCALE) + MARGIN, round(point["y"] * SCALE) + MARGIN)


def rect_pct(rect: dict[str, float]) -> tuple[int, int, int, int]:
    left = rect["left"] * SCALE + MARGIN
    top = rect["top"] * SCALE + MARGIN
    right = (rect.get("right", rect["left"] + rect.get("width", 0))) * SCALE + MARGIN
    bottom = (rect.get("bottom", rect["top"] + rect.get("height", 0))) * SCALE + MARGIN
    return tuple(round(v) for v in (left, top, right, bottom))


def draw_dashed(draw: ImageDraw.ImageDraw, points: list[dict[str, float]], fill: tuple[int, int, int], width: int = 5) -> None:
    if len(points) < 2:
        return
    dash = 14
    gap = 9
    for a, b in zip(points, points[1:]):
        x1, y1 = pct(a)
        x2, y2 = pct(b)
        dx = x2 - x1
        dy = y2 - y1
        length = max(1, (dx * dx + dy * dy) ** 0.5)
        distance = 0
        while distance < length:
            end = min(length, distance + dash)
            sx = x1 + dx * (distance / length)
            sy = y1 + dy * (distance / length)
            ex = x1 + dx * (end / length)
            ey = y1 + dy * (end / length)
            draw.line((sx, sy, ex, ey), fill=fill, width=width)
            distance += dash + gap


def label(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, fill=(236, 241, 249), bg=(14, 20, 30)) -> None:
    x, y = xy
    box = draw.textbbox((x, y), text)
    draw.rectangle((box[0] - 5, box[1] - 3, box[2] + 5, box[3] + 4), fill=bg)
    draw.text((x, y), text, fill=fill)


def blocker_rect(blocker: dict[str, float]) -> tuple[int, int, int, int]:
    return rect_pct({
        "left": blocker["left"],
        "top": blocker["top"],
        "right": blocker["right"],
        "bottom": blocker["bottom"],
    })


def draw_marker(draw: ImageDraw.ImageDraw, point: dict[str, float], text: str, fill: tuple[int, int, int]) -> None:
    x, y = pct(point)
    draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=fill, outline=(8, 13, 20), width=3)
    label(draw, (x + 16, y - 12), text, fill=fill)


def write_debug_log(data: dict) -> None:
    snapshot = None
    if SNAPSHOT.exists():
        try:
            snapshot = json.loads(SNAPSHOT.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            snapshot = {"error": "latest_world_snapshot.json was not valid JSON"}
    routes = data.get("routes") or [data.get("route")]
    debug = {
        "generated_at_source": "scripts/render_local_ui_trajectory.py",
        "latest": data.get("latest", {}),
        "world_snapshot": snapshot,
        "agents": [],
        "map": {
            "rooms": data.get("rooms", {}),
            "corridors": data.get("corridors", []),
            "doors": data.get("doors", []),
            "furniture_blockers": data.get("furnitureBlockers", []),
        },
    }
    for route in [item for item in routes if item]:
        debug["agents"].append({
            "agent": route.get("agent"),
            "name": route.get("name"),
            "role": route.get("role"),
            "task": route.get("task"),
            "rooms": {
                "start": route.get("startRoom"),
                "work": route.get("targetRoom"),
                "return": route.get("returnRoom"),
            },
            "points": {
                "start": route.get("start"),
                "work": route.get("work"),
                "return": route.get("ret"),
            },
            "walkable": {
                "outbound": route.get("outboundWalkable"),
                "return": route.get("inboundWalkable"),
            },
            "route_point_count": route.get("routePointCount"),
            "outbound_route": route.get("outbound", []),
            "return_route": route.get("inbound", []),
            "door_anchors": {
                "start": {
                    "aisle": route.get("anchors", {}).get("start", {}).get("aisle"),
                    "portal": route.get("anchors", {}).get("start", {}).get("portal"),
                    "hub": route.get("anchors", {}).get("start", {}).get("hub"),
                },
                "work": {
                    "aisle": route.get("anchors", {}).get("target", {}).get("aisle"),
                    "portal": route.get("anchors", {}).get("target", {}).get("portal"),
                    "hub": route.get("anchors", {}).get("target", {}).get("hub"),
                },
                "return": {
                    "aisle": route.get("anchors", {}).get("return", {}).get("aisle"),
                    "portal": route.get("anchors", {}).get("return", {}).get("portal"),
                    "hub": route.get("anchors", {}).get("return", {}).get("hub"),
                },
            },
        })
    LOG_OUT.write_text(json.dumps(debug, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    payload = subprocess.check_output(["node", "--input-type=module", "-e", NODE_CODE], cwd=ROOT, text=True)
    data = json.loads(payload)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    write_debug_log(data)

    image = Image.new("RGB", (WIDTH + MARGIN * 2, HEIGHT + MARGIN * 2), (20, 24, 31))
    draw = ImageDraw.Draw(image)
    draw.rectangle((MARGIN, MARGIN, MARGIN + WIDTH, MARGIN + HEIGHT), fill=(30, 34, 42))

    for corridor in data["corridors"]:
        draw.rectangle(rect_pct(corridor), fill=(177, 163, 119), outline=(85, 73, 54), width=2)

    for key, room in data["rooms"].items():
        if key == "offline_corner":
            continue
        rect = rect_pct(room)
        draw.rectangle(rect, fill=FLOORS.get(key, (195, 185, 155)), outline=(38, 31, 29), width=7)
        draw.rectangle((rect[0] + 18, rect[1] + 18, rect[2] - 18, rect[3] - 18), outline=(226, 219, 194), width=1)
        label(draw, (rect[0] + 8, rect[1] + 8), key)

        for blocker in data["props"][key]["blockers"]:
            brect = blocker_rect(blocker)
            draw.rectangle(brect, fill=(88, 70, 55), outline=(33, 26, 23), width=2)
            prop_type = blocker["prop"]["type"]
            label(draw, (brect[0] + 2, brect[1] + 2), prop_type[:7], fill=(244, 229, 184), bg=(70, 50, 38))

        for stand in data["props"][key]["stands"]:
            x, y = pct(stand)
            draw.ellipse((x - 4, y - 4, x + 4, y + 4), fill=(92, 226, 160), outline=(19, 52, 36))

        for anchor_name, color in [("aisle", (82, 183, 255)), ("portal", (255, 218, 92)), ("hub", (104, 246, 166))]:
            x, y = pct(room[anchor_name])
            draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=color, outline=(13, 17, 23))

    for door in data["doors"]:
        x1, y1, x2, y2 = rect_pct(door)
        draw.rectangle((x1, y1, x2, y2), fill=(154, 88, 42), outline=(54, 33, 22), width=2)

    palette = [
        ((60, 188, 255), (255, 184, 78), (245, 248, 255)),
        ((168, 139, 250), (110, 231, 249), (255, 235, 130)),
        ((74, 222, 128), (244, 114, 182), (255, 255, 255)),
    ]
    routes = data.get("routes") or [data["route"]]
    for index, route in enumerate(routes):
        out_color, back_color, start_color = palette[index % len(palette)]
        draw_dashed(draw, route["outbound"], out_color, width=5 if index == 0 else 4)
        draw_dashed(draw, route["inbound"], back_color, width=4 if index == 0 else 3)
        draw_marker(draw, route["start"], f"{route.get('agent', 'agent')} START {route['startRoom']}", start_color)
        draw_marker(draw, route["work"], f"{route.get('agent', 'agent')} WORK {route['targetRoom']}", out_color)
        draw_marker(draw, route["ret"], f"{route.get('agent', 'agent')} RETURN {route['returnRoom']}", back_color)

    status = "OK" if all(route["outboundWalkable"] and route["inboundWalkable"] for route in routes) else "BAD"
    route = routes[0]
    latest = data["latest"]
    label(draw, (MARGIN, 18), f"Latest Pixelverse trajectory: {len(routes)} agent(s), primary {route['startRoom']} -> {route['targetRoom']} -> {route['returnRoom']}", fill=(245, 248, 255))
    label(draw, (MARGIN, 44), f"{status} | {latest.get('tool_csv', '')} | furniture blockers + door anchors from shared UI map", fill=(112, 245, 155) if status == "OK" else (255, 122, 122))
    label(draw, (MARGIN + 575, 44), "multi-color dashed routes; green dots=interaction stand points; debug JSON beside image", fill=(215, 223, 235))

    image.save(OUT, quality=92)
    print(f"{OUT}\n{LOG_OUT}")


if __name__ == "__main__":
    main()

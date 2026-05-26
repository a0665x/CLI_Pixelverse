import { CORRIDOR_BAND, CORRIDOR_RECTS, ROOM_LAYOUTS } from './house_layout.mjs';
import { getRoomDecor } from './ui_strings.mjs';
import {
  allFurnitureBlockers,
  isInsideFurnitureBlocker,
} from './room_furniture.mjs';

export const ROOM_ANCHORS = Object.fromEntries(
  Object.entries(ROOM_LAYOUTS).map(([key, value]) => [key, {
    x: value.center.x,
    y: value.center.y,
    portal: value.portal,
    aisle: value.aisle,
    hub: value.hub,
    patrol: value.patrol,
  }]),
);

const CORRIDOR_Y = (CORRIDOR_BAND.top + CORRIDOR_BAND.bottom) / 2;
const SAME_ROOM_LANE_THRESHOLD = 10;
const GRID_STEP = 1;
const MAX_SEARCH_VISITS = 18000;
const AGENT_CLEARANCE = 1.6;
const CORRIDOR_CLEARANCE = 0.45;
const FURNITURE_CLEARANCE = 0.35;
const DECOR_BY_ROOM = Object.fromEntries(
  Object.keys(ROOM_LAYOUTS).map((roomKey) => [roomKey, getRoomDecor(roomKey, 'zh-TW')]),
);
export const FURNITURE_BLOCKERS = allFurnitureBlockers(DECOR_BY_ROOM);

const near = (a, b, epsilon = 0.25) => Math.abs(a - b) <= epsilon;

export function point(x, y) {
  return { x: Number(x.toFixed(2)), y: Number(y.toFixed(2)) };
}

function pointKey(item) {
  return `${Math.round(item.x)},${Math.round(item.y)}`;
}

function parsePointKey(key) {
  const [x, y] = key.split(',').map(Number);
  return { x, y };
}

export function getFacingFromDelta(dx = 0, dy = 0, fallback = 'right') {
  if (Math.abs(dx) <= 0.12 && Math.abs(dy) <= 0.12) return fallback;
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

export function nextWalkFrame(frame = 0, moving = false) {
  if (!moving) return 0;
  return Math.abs(frame + 1) % 2;
}

function dedupe(points) {
  return points.filter((item, index, arr) => index === 0 || !near(item.x, arr[index - 1].x) || !near(item.y, arr[index - 1].y));
}

function asPoint(value, fallback) {
  return point((value || fallback).x, (value || fallback).y);
}

function roomRect(roomKey) {
  const room = ROOM_LAYOUTS[roomKey] || ROOM_LAYOUTS.standby_dock;
  return {
    left: room.left,
    right: room.left + room.width,
    top: room.top,
    bottom: room.top + room.height,
  };
}

function inRect(candidate, rect, inset = 0.8) {
  return candidate.x >= rect.left + inset
    && candidate.x <= rect.right - inset
    && candidate.y >= rect.top + inset
    && candidate.y <= rect.bottom - inset;
}

function inDoorThreshold(candidate, anchor) {
  return Math.abs(candidate.x - anchor.portal.x) <= 2.7 && Math.abs(candidate.y - anchor.portal.y) <= 2.1;
}

function isCorridor(candidate) {
  return CORRIDOR_RECTS.some((rect) => (
    candidate.x >= rect.left + CORRIDOR_CLEARANCE
    && candidate.x <= rect.right - CORRIDOR_CLEARANCE
    && candidate.y >= rect.top + CORRIDOR_CLEARANCE
    && candidate.y <= rect.bottom - CORRIDOR_CLEARANCE
  ));
}

export function isWalkable(candidate) {
  if (isCorridor(candidate)) return true;
  for (const [roomKey] of Object.entries(ROOM_LAYOUTS)) {
    if (roomKey === 'offline_corner') continue;
    const rect = roomRect(roomKey);
    if (inDoorThreshold(candidate, ROOM_ANCHORS[roomKey])) return true;
    if (inRect(candidate, rect, AGENT_CLEARANCE)) {
      return !isInsideFurnitureBlocker(candidate, FURNITURE_BLOCKERS, FURNITURE_CLEARANCE);
    }
  }
  return false;
}

export function segmentStaysWalkable(start, end, step = 0.5) {
  const distance = Math.hypot(end.x - start.x, end.y - start.y);
  const samples = Math.max(1, Math.ceil(distance / step));
  for (let i = 0; i <= samples; i += 1) {
    const ratio = i / samples;
    const sample = point(start.x + (end.x - start.x) * ratio, start.y + (end.y - start.y) * ratio);
    if (!isWalkable(sample)) return false;
  }
  return true;
}

export function routeStaysWalkable(route = []) {
  if (!route.every((item) => isWalkable(item))) return false;
  for (let i = 1; i < route.length; i += 1) {
    if (!segmentStaysWalkable(route[i - 1], route[i])) return false;
  }
  return true;
}

function heuristic(a, b) {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function snapToWalkable(raw) {
  const origin = point(Math.round(raw.x), Math.round(raw.y));
  if (isWalkable(origin)) return origin;
  for (let radius = 1; radius <= 4; radius += 1) {
    for (let dx = -radius; dx <= radius; dx += 1) {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const candidate = point(origin.x + dx, origin.y + dy);
        if (isWalkable(candidate)) return candidate;
      }
    }
  }
  return origin;
}

function neighbors(node) {
  return [
    { x: node.x + GRID_STEP, y: node.y },
    { x: node.x - GRID_STEP, y: node.y },
    { x: node.x, y: node.y + GRID_STEP },
    { x: node.x, y: node.y - GRID_STEP },
  ].filter((candidate) => candidate.x >= 0 && candidate.x <= 100 && candidate.y >= 0 && candidate.y <= 100 && isWalkable(candidate));
}

function reconstructPath(cameFrom, current) {
  const path = [current];
  let key = pointKey(current);
  while (cameFrom.has(key)) {
    const prev = cameFrom.get(key);
    path.push(prev);
    key = pointKey(prev);
  }
  path.reverse();
  return path.map((item) => point(item.x, item.y));
}

function compressPath(path) {
  if (path.length <= 2) return path.map((item) => point(item.x, item.y));
  const result = [path[0]];
  let prevDir = null;
  for (let i = 1; i < path.length; i += 1) {
    const prev = path[i - 1];
    const current = path[i];
    const dir = { x: Math.sign(current.x - prev.x), y: Math.sign(current.y - prev.y) };
    if (!prevDir || dir.x !== prevDir.x || dir.y !== prevDir.y) {
      result.push(prev);
      prevDir = dir;
    }
  }
  result.push(path.at(-1));
  return ensureOrthogonal(dedupe(result.map((item) => point(item.x, item.y))));
}

function ensureOrthogonal(points) {
  const expanded = [points[0]];
  for (let i = 1; i < points.length; i += 1) {
    const prev = expanded.at(-1);
    const current = points[i];
    if (near(prev.x, current.x) || near(prev.y, current.y)) {
      expanded.push(current);
      continue;
    }
    const xThenY = point(current.x, prev.y);
    const yThenX = point(prev.x, current.y);
    if (isWalkable(xThenY) && segmentStaysWalkable(prev, xThenY) && segmentStaysWalkable(xThenY, current)) {
      expanded.push(xThenY, current);
    } else if (isWalkable(yThenX) && segmentStaysWalkable(prev, yThenX) && segmentStaysWalkable(yThenX, current)) {
      expanded.push(yThenX, current);
    } else {
      expanded.push(current);
    }
  }
  return dedupe(expanded);
}

function findPathSegment(start, end) {
  const snappedStart = snapToWalkable(start);
  const snappedEnd = snapToWalkable(end);
  const startKey = pointKey(snappedStart);
  const goalKey = pointKey(snappedEnd);
  if (startKey === goalKey) return [snappedStart];

  const open = [snappedStart];
  const openSet = new Set([startKey]);
  const cameFrom = new Map();
  const gScore = new Map([[startKey, 0]]);
  const fScore = new Map([[startKey, heuristic(snappedStart, snappedEnd)]]);
  let visits = 0;

  while (open.length && visits < MAX_SEARCH_VISITS) {
    visits += 1;
    open.sort((a, b) => (fScore.get(pointKey(a)) ?? Infinity) - (fScore.get(pointKey(b)) ?? Infinity));
    const current = open.shift();
    const currentKey = pointKey(current);
    openSet.delete(currentKey);
    if (currentKey === goalKey) return compressPath(reconstructPath(cameFrom, current));

    for (const neighbor of neighbors(current)) {
      const neighborKey = pointKey(neighbor);
      const tentative = (gScore.get(currentKey) ?? Infinity) + 1;
      if (tentative >= (gScore.get(neighborKey) ?? Infinity)) continue;
      cameFrom.set(neighborKey, current);
      gScore.set(neighborKey, tentative);
      fScore.set(neighborKey, tentative + heuristic(neighbor, snappedEnd));
      if (!openSet.has(neighborKey)) {
        open.push(neighbor);
        openSet.add(neighborKey);
      }
    }
  }

  return dedupe([snappedStart, snappedEnd]);
}

function stitchSegments(segments) {
  const stitched = [];
  segments.forEach((segment) => {
    if (!segment.length) return;
    if (!stitched.length) {
      stitched.push(...segment);
      return;
    }
    if (pointKey(stitched.at(-1)) === pointKey(segment[0])) stitched.push(...segment.slice(1));
    else stitched.push(...segment);
  });
  return ensureOrthogonal(dedupe(stitched.map((item) => point(item.x, item.y))));
}

function routeBetweenHubs(fromHub, toHub) {
  if (near(fromHub.x, toHub.x) && near(fromHub.y, toHub.y)) return [];
  if (near(fromHub.x, toHub.x) || near(fromHub.y, toHub.y)) return [point(toHub.x, toHub.y)];
  const via = [];
  if (!near(fromHub.y, CORRIDOR_Y)) via.push(point(fromHub.x, CORRIDOR_Y));
  if (!near(fromHub.x, toHub.x)) via.push(point(toHub.x, CORRIDOR_Y));
  if (!near(toHub.y, CORRIDOR_Y)) via.push(point(toHub.x, toHub.y));
  return via;
}

export function buildRoute(start, end, roomFrom, roomTo) {
  const from = ROOM_ANCHORS[roomFrom] || ROOM_ANCHORS.standby_dock;
  const to = ROOM_ANCHORS[roomTo] || ROOM_ANCHORS.standby_dock;
  const startPoint = point(start.x, start.y);
  const endPoint = point(end.x, end.y);
  const fromAisle = asPoint(from.aisle, from.portal);
  const toAisle = asPoint(to.aisle, to.portal);
  const fromPortal = asPoint(from.portal, from);
  const toPortal = asPoint(to.portal, to);
  const fromHub = asPoint(from.hub, fromPortal);
  const toHub = asPoint(to.hub, toPortal);

  if (roomFrom === roomTo) {
    const directDistance = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
    if (directDistance <= SAME_ROOM_LANE_THRESHOLD) return dedupe([startPoint, endPoint]);
    return stitchSegments([
      findPathSegment(startPoint, fromAisle),
      findPathSegment(fromAisle, endPoint),
    ]);
  }

  const corridorWaypoints = routeBetweenHubs(fromHub, toHub);
  const waypoints = [fromAisle, fromPortal, fromHub, ...corridorWaypoints, toHub, toPortal, toAisle, endPoint];
  const segments = [];
  let current = startPoint;
  waypoints.forEach((next) => {
    segments.push(findPathSegment(current, next));
    current = next;
  });
  return stitchSegments(segments);
}

export function routeUsesDoorThresholds(route = [], roomFrom, roomTo) {
  const from = ROOM_ANCHORS[roomFrom] || ROOM_ANCHORS.standby_dock;
  const to = ROOM_ANCHORS[roomTo] || ROOM_ANCHORS.standby_dock;
  return route.some((item) => near(item.x, from.portal.x, 1.1) && near(item.y, from.portal.y, 1.2))
    && route.some((item) => near(item.x, to.portal.x, 1.1) && near(item.y, to.portal.y, 1.2));
}

export function patrolPoint(roomKey, index = 0) {
  const room = ROOM_ANCHORS[roomKey] || ROOM_ANCHORS.standby_dock;
  const waypoint = room.patrol[index % room.patrol.length] || room;
  return point(waypoint.x, waypoint.y);
}

export function shouldPatrol(state) {
  return ['thinking', 'planning', 'working'].includes(state);
}

export function pathLength(points = []) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

export function movementDurationMs(points = [], state = 'idle') {
  const speed = state === 'working' ? 0.02 : state === 'planning' ? 0.018 : state === 'thinking' ? 0.016 : 0.014;
  return Math.max(420, Math.round(pathLength(points) / speed));
}

export function pointsToSvg(points = [], width = 100, height = 100) {
  if (!points.length) return '';
  return points
    .map((item) => `${(item.x / 100) * width},${(item.y / 100) * height}`)
    .join(' ');
}

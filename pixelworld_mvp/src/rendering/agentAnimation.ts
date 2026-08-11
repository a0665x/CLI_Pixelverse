import type { Facing } from '../world/types';

const IDLE_FRAMES: Readonly<Record<Facing, number>> = { right: 0, up: 1, left: 2, down: 3 };
const WALK_START_FRAMES: Readonly<Record<Facing, number>> = { right: 24, up: 30, left: 36, down: 42 };
const WALK_FRAME_MS = 120;
const WALK_FRAME_COUNT = 6;

/** Select frames exactly as authored in LimeZu's Adam 16x32 sprite sheet. */
export function agentAnimationFrame(facing: Facing, walking: boolean, elapsedMs: number): number {
  if (!walking) return IDLE_FRAMES[facing];
  const step = Math.floor(Math.max(0, elapsedMs) / WALK_FRAME_MS) % WALK_FRAME_COUNT;
  return WALK_START_FRAMES[facing] + step;
}

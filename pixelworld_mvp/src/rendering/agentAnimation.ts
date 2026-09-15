import type { Facing } from '../world/types';
import { agentFrameIndex, type AgentSkin } from './assetManifest';

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

export function agentFrameForSkin(
  skin: AgentSkin,
  facing: Facing,
  walking: boolean,
  elapsedMs: number,
): number {
  if (skin.animation === 'adam-16x32') return agentAnimationFrame(facing, walking, elapsedMs);
  if (!walking) return agentFrameIndex(skin, facing,skin.sheet.startsWith('woodland-rabbit-')&&elapsedMs%3600>3380?6:skin.idleRow);
  const step = Math.floor(Math.max(0, elapsedMs) / WALK_FRAME_MS) % skin.walkRows.length;
  return agentFrameIndex(skin, facing, skin.walkRows[step]);
}

import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import type { AgentController } from '../src/agents/AgentController';
import { DepthOcclusionSystem, depthFromFootY, shouldFadeForeground } from '../src/rendering/DepthOcclusionSystem';
import type { RenderedForeground } from '../src/scenes/WorldScene';

interface FakeSprite {
  y: number;
  depth: number;
  visible: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  setDepth(depth: number): FakeSprite;
  getBounds(): FakeSprite['bounds'];
}

const sprite = (y: number, bounds: FakeSprite['bounds']): FakeSprite => ({
  y,
  depth: 0,
  visible: true,
  bounds,
  setDepth(depth) { this.depth = depth; return this; },
  getBounds() { return this.bounds; },
});

const agent = (fakeSprite: FakeSprite) => ({ sprite: fakeSprite }) as unknown as AgentController;

const foreground = (bounds: FakeSprite['bounds'], baselineY: number) => {
  const object = {
    alpha: 1,
    setAlpha(alpha: number) { this.alpha = alpha; return this; },
  };
  return { entry: { object, bounds, baselineY } as unknown as RenderedForeground, object };
};

const system = (
  now: { value: number },
  foregrounds: RenderedForeground[],
  agents: () => AgentController[],
) => new DepthOcclusionSystem({ time: { get now() { return now.value; } } } as Phaser.Scene, foregrounds, agents);

describe('depth and foreground occlusion', () => {
  it('uses foot Y with a stable tie breaker', () => {
    expect(depthFromFootY(160, 2)).toBe(160.002);
    expect(depthFromFootY(160, 3)).toBeGreaterThan(depthFromFootY(160, 2));
  });

  it('fades only when the selected Agent is fully covered and behind the baseline', () => {
    const foreground = { x: 10, y: 10, width: 48, height: 48 };
    expect(shouldFadeForeground({ x: 20, y: 20, width: 12, height: 20 }, foreground, 35, 58)).toBe(true);
    expect(shouldFadeForeground({ x: 20, y: 20, width: 12, height: 20 }, foreground, 70, 58)).toBe(false);
    expect(shouldFadeForeground({ x: 0, y: 0, width: 12, height: 20 }, foreground, 20, 58)).toBe(false);
  });

  it('applies deterministic foot-Y depth to every current Agent', () => {
    const now = { value: 0 };
    const firstSprite = sprite(160, { x: 0, y: 0, width: 12, height: 20 });
    const secondSprite = sprite(160, { x: 20, y: 0, width: 12, height: 20 });
    const agents = [agent(firstSprite), agent(secondSprite)];

    system(now, [], () => agents).update(agents[0]!);

    expect(firstSprite.depth).toBe(160.001);
    expect(secondSprite.depth).toBe(160.002);
  });

  it('waits 500ms before fading and considers only the selected Agent', () => {
    const now = { value: 0 };
    const selected = agent(sprite(40, { x: 20, y: 20, width: 12, height: 20 }));
    const unselected = agent(sprite(40, { x: 20, y: 20, width: 12, height: 20 }));
    const outside = agent(sprite(40, { x: 80, y: 80, width: 12, height: 20 }));
    const covered = foreground({ x: 10, y: 10, width: 48, height: 48 }, 58);
    let agents = [selected, unselected];
    const depthSystem = system(now, [covered.entry], () => agents);

    depthSystem.update(selected);
    now.value = 499;
    depthSystem.update(selected);
    expect(covered.object.alpha).toBe(1);
    now.value = 500;
    depthSystem.update(selected);
    expect(covered.object.alpha).toBe(0.6);

    agents = [outside, unselected];
    now.value = 1_100;
    depthSystem.update(outside);
    expect(covered.object.alpha).toBe(1);
  });

  it('resets alpha and fade timing after coverage ends', () => {
    const now = { value: 0 };
    const selectedSprite = sprite(40, { x: 20, y: 20, width: 12, height: 20 });
    const selected = agent(selectedSprite);
    const covered = foreground({ x: 10, y: 10, width: 48, height: 48 }, 58);
    const depthSystem = system(now, [covered.entry], () => [selected]);

    depthSystem.update(selected);
    now.value = 500;
    depthSystem.update(selected);
    expect(covered.object.alpha).toBe(0.6);

    selectedSprite.bounds = { x: 80, y: 80, width: 12, height: 20 };
    depthSystem.update(selected);
    expect(covered.object.alpha).toBe(1);
    selectedSprite.bounds = { x: 20, y: 20, width: 12, height: 20 };
    now.value = 1_000;
    depthSystem.update(selected);
    expect(covered.object.alpha).toBe(1);
  });

  it('resets removed foregrounds and uses a replacement Agent registry safely', () => {
    const now = { value: 0 };
    const oldAgent = agent(sprite(40, { x: 20, y: 20, width: 12, height: 20 }));
    const oldForeground = foreground({ x: 10, y: 10, width: 48, height: 48 }, 58);
    const foregrounds = [oldForeground.entry];
    let agents = [oldAgent];
    const depthSystem = system(now, foregrounds, () => agents);

    depthSystem.update(oldAgent);
    now.value = 500;
    depthSystem.update(oldAgent);
    expect(oldForeground.object.alpha).toBe(0.6);

    const replacementSprite = sprite(200, { x: 80, y: 80, width: 12, height: 20 });
    const replacementAgent = agent(replacementSprite);
    const replacementForeground = foreground({ x: 70, y: 70, width: 48, height: 48 }, 220);
    foregrounds.splice(0, foregrounds.length, replacementForeground.entry);
    agents = [replacementAgent];
    depthSystem.update(replacementAgent);

    expect(oldForeground.object.alpha).toBe(1);
    expect(replacementSprite.depth).toBe(200.001);
    expect(replacementForeground.object.alpha).toBe(1);
  });

  it('never fades the village for a selected Agent hidden inside a building', () => {
    const now = { value: 500 };
    const selectedSprite = sprite(40, { x: 20, y: 20, width: 12, height: 20 });
    const selected = agent(selectedSprite);
    const covered = foreground({ x: 10, y: 10, width: 48, height: 48 }, 58);
    const depthSystem = system(now, [covered.entry], () => [selected]);

    depthSystem.update(selected);
    now.value = 1_000;
    depthSystem.update(selected);
    expect(covered.object.alpha).toBe(0.6);

    selectedSprite.visible = false;
    depthSystem.update(selected);
    expect(covered.object.alpha).toBe(1);
  });
});

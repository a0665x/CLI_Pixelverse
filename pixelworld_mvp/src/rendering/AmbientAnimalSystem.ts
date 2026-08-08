import type Phaser from 'phaser';
import { TILE_SIZE } from '../game/constants';
import type { AmbientAnimalDefinition, GridPoint, GridRect } from '../world/types';
import { ANIMAL_ASSETS } from './assetManifest';

export interface AnimalMotionState {
  point: GridPoint;
  targetIndex: number;
  idleMs: number;
}

export function pointInsideRect(point: GridPoint, bounds: GridRect): boolean {
  return point.x >= bounds.x && point.y >= bounds.y &&
    point.x < bounds.x + bounds.width && point.y < bounds.y + bounds.height;
}

const patrolTargets = ({ x, y, width, height }: GridRect): GridPoint[] => {
  const left = x + 0.5;
  const right = x + Math.max(0.5, width - 0.5);
  const top = y + 0.5;
  const bottom = y + Math.max(0.5, height - 0.5);
  return [
    { x: left, y: top }, { x: right, y: top },
    { x: right, y: bottom }, { x: left, y: bottom },
  ];
};

const stablePause = (id: string, targetIndex: number): number => {
  const hash = [...id].reduce((total, character) => total + character.charCodeAt(0), targetIndex * 97);
  return 400 + hash % 501;
};

export function advanceAnimal(
  state: AnimalMotionState,
  definition: AmbientAnimalDefinition,
  deltaMs: number,
): AnimalMotionState {
  if (state.idleMs > 0) {
    return { ...state, point: { ...state.point }, idleMs: Math.max(0, state.idleMs - Math.max(0, deltaMs)) };
  }
  const targets = patrolTargets(definition.patrolBounds);
  const targetIndex = ((state.targetIndex % targets.length) + targets.length) % targets.length;
  const target = targets[targetIndex]!;
  const dx = target.x - state.point.x;
  const dy = target.y - state.point.y;
  const distance = Math.hypot(dx, dy);
  const step = definition.speed / TILE_SIZE * Math.max(0, deltaMs) / 1_000;
  if (distance <= step || distance === 0) {
    return {
      point: { ...target },
      targetIndex: (targetIndex + 1) % targets.length,
      idleMs: stablePause(definition.id, targetIndex),
    };
  }
  return {
    point: { x: state.point.x + dx / distance * step, y: state.point.y + dy / distance * step },
    targetIndex,
    idleMs: 0,
  };
}

interface RenderedAnimal {
  definition: AmbientAnimalDefinition;
  state: AnimalMotionState;
  sprite: Phaser.GameObjects.Image;
}

export class AmbientAnimalSystem {
  private readonly animals: RenderedAnimal[];

  constructor(scene: Phaser.Scene, definitions: readonly AmbientAnimalDefinition[]) {
    this.animals = definitions.map((definition, index) => {
      const asset = ANIMAL_ASSETS[definition.species];
      const sprite = scene.add.image(
        definition.start.x * TILE_SIZE + TILE_SIZE / 2,
        definition.start.y * TILE_SIZE + TILE_SIZE / 2,
        asset.key,
      ).setOrigin(0.5, 0.82).setDepth(definition.start.y * TILE_SIZE + TILE_SIZE / 2 + index / 1_000);
      return {
        definition,
        state: { point: { ...definition.start }, targetIndex: 0, idleMs: stablePause(definition.id, 0) / 2 },
        sprite,
      };
    });
  }

  update(deltaMs: number): void {
    this.animals.forEach((animal, index) => {
      const previousX = animal.state.point.x;
      animal.state = advanceAnimal(animal.state, animal.definition, deltaMs);
      const x = animal.state.point.x * TILE_SIZE + TILE_SIZE / 2;
      const y = animal.state.point.y * TILE_SIZE + TILE_SIZE / 2;
      animal.sprite
        .setPosition(x, y)
        .setFlipX(animal.state.point.x < previousX)
        .setDepth(y + index / 1_000);
    });
  }

  destroy(): void {
    this.animals.forEach(({ sprite }) => sprite.destroy());
    this.animals.length = 0;
  }
}

import Phaser from 'phaser';
import { TILE_SIZE } from '../game/constants';
import { findPath } from '../navigation/aStar';
import { NavigationGrid } from '../navigation/navigationGrid';
import { AGENT_SKINS, agentFrameIndex, type AgentSkin } from '../rendering/assetManifest';
import type { StationAssignment } from '../stations/stationAllocator';
import type { AgentWorldEvent, BehaviorRoute, Facing, GridPoint } from '../world/types';
import { ActionController } from './ActionController';
import { PathFollower } from './pathFollower';

export class AgentController {
  readonly sprite: Phaser.GameObjects.Image;
  readonly actions: ActionController;
  readonly role: 'main' | 'subagent';
  currentEvent?: AgentWorldEvent;
  currentRoute?: BehaviorRoute;
  currentAssignment?: StationAssignment;
  currentPath: GridPoint[] = [];
  private readonly follower = new PathFollower(TILE_SIZE, 48);
  private facing: Facing = 'down';
  private moving = false;
  private arriveCallback: (() => void) | undefined;
  private renderOffsetX = 0;
  private preservePositionOnNextDispatch = false;

  constructor(
    scene: Phaser.Scene,
    readonly agentId: string,
    role: 'main' | 'subagent',
    spawn: GridPoint,
    private readonly grid: NavigationGrid,
    private readonly skin: AgentSkin = role === 'main' ? AGENT_SKINS.main : AGENT_SKINS.subagent,
  ) {
    this.role = role;
    this.sprite = scene.add.image(
      spawn.x * TILE_SIZE + TILE_SIZE / 2,
      spawn.y * TILE_SIZE + TILE_SIZE / 2,
      this.skin.sheet,
      agentFrameIndex(this.skin, this.facing),
    ).setOrigin(0.5, 0.82);
    this.actions = new ActionController(scene, this.sprite);
  }

  tilePosition(): GridPoint {
    return { x: Math.floor((this.sprite.x - this.renderOffsetX) / TILE_SIZE), y: Math.floor(this.sprite.y / TILE_SIZE) };
  }

  clearRenderOffset(): void {
    this.sprite.x -= this.renderOffsetX;
    this.renderOffsetX = 0;
  }

  applyRenderOffset(offsetX: number): void {
    this.clearRenderOffset();
    this.renderOffsetX = Phaser.Math.Clamp(offsetX, -6, 6);
    this.sprite.x += this.renderOffsetX;
  }

  dispatch(event: AgentWorldEvent, assignment: StationAssignment, route: BehaviorRoute, onArrive?: () => void): boolean {
    const path = findPath(this.grid, this.tilePosition(), assignment.point);
    if (!path) return false;
    const preservePosition = this.moving || this.preservePositionOnNextDispatch;
    this.actions.stop();
    this.currentEvent = event;
    this.currentRoute = route;
    this.currentAssignment = assignment;
    this.currentPath = path;
    this.arriveCallback = onArrive;
    this.follower.setPath(path, { preservePosition });
    this.preservePositionOnNextDispatch = false;
    this.moving = preservePosition || path.length > 1;
    if (!this.moving) this.arrive();
    return true;
  }

  heartbeat(): void { this.actions.pulse(); }

  cancel(): void {
    this.actions.stop();
    this.clearRenderOffset();
    const frozen = { x: this.sprite.x, y: this.sprite.y };
    this.arriveCallback = undefined;
    this.moving = false;
    this.currentPath = [];
    delete this.currentEvent;
    delete this.currentRoute;
    delete this.currentAssignment;
    this.sprite.setPosition(frozen.x, frozen.y);
    this.follower.setPosition(frozen);
    this.preservePositionOnNextDispatch = true;
  }

  update(deltaMs: number): void {
    if (this.moving) {
      const snapshot = this.follower.update(deltaMs);
      this.facing = snapshot.facing;
      this.sprite.setPosition(snapshot.position.x, snapshot.position.y).setTexture(
        this.skin.sheet,
        agentFrameIndex(this.skin, this.facing, this.skin.walkRows[1]),
      );
      if (snapshot.arrived) this.arrive();
    }
    this.actions.update();
  }

  destroy(): void {
    this.arriveCallback = undefined;
    this.moving = false;
    this.currentPath = [];
    this.preservePositionOnNextDispatch = false;
    this.clearRenderOffset();
    this.actions.destroy();
    this.sprite.destroy();
  }

  private arrive(): void {
    this.moving = false;
    this.currentPath = [];
    this.sprite.setTexture(this.skin.sheet, agentFrameIndex(this.skin, this.currentAssignment?.facing ?? this.facing));
    const action = this.currentAssignment?.kind === 'queue'
      ? 'queue'
      : (this.currentRoute?.action ?? this.currentAssignment?.action ?? 'arrive');
    this.actions.start(action);
    const callback = this.arriveCallback;
    this.arriveCallback = undefined;
    callback?.();
  }
}

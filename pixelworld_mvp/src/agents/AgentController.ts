import Phaser from 'phaser';
import { TILE_SIZE } from '../game/constants';
import { findPathVia } from '../navigation/aStar';
import { NavigationGrid } from '../navigation/navigationGrid';
import { AGENT_SKINS, agentFrameIndex, type AgentSkin } from '../rendering/assetManifest';
import type { StationAssignment } from '../stations/stationAllocator';
import type { AgentWorldEvent, BehaviorRoute, Facing, GridPoint } from '../world/types';
import { ActionController } from './ActionController';
import type { AgentPresence, AgentTravelPlan } from './agentPresence';
import { PathFollower } from './pathFollower';

const WALK_FRAME_MS = 100;

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
  private presenceState: AgentPresence = { kind: 'outside' };
  private destinationBuilding: AgentTravelPlan['destinationBuilding'];
  private walkClockMs = 0;

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

  presence(): AgentPresence {
    return this.presenceState.kind === 'inside'
      ? { ...this.presenceState, threshold: { ...this.presenceState.threshold } }
      : { kind: 'outside' };
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

  dispatch(
    event: AgentWorldEvent,
    assignment: StationAssignment,
    route: BehaviorRoute,
    onArrive?: () => void,
    travelPlan: AgentTravelPlan = { waypoints: [assignment.point], stayInside: false },
  ): boolean {
    if (travelPlan.stayInside) return this.dispatchInside(event, assignment, route, onArrive, travelPlan);

    const departurePresence = this.presenceState;
    const start = departurePresence.kind === 'inside' ? departurePresence.threshold : this.tilePosition();
    const path = findPathVia(this.grid, start, travelPlan.waypoints);
    if (!path) return false;
    const preservePosition = departurePresence.kind === 'outside' && (this.moving || this.preservePositionOnNextDispatch);
    this.actions.stop();
    this.clearRenderOffset();
    this.currentEvent = event;
    this.currentRoute = route;
    this.currentAssignment = assignment;
    this.currentPath = path;
    this.arriveCallback = onArrive;
    this.destinationBuilding = travelPlan.destinationBuilding;
    if (departurePresence.kind === 'inside') {
      this.sprite.setPosition(
        departurePresence.threshold.x * TILE_SIZE + TILE_SIZE / 2,
        departurePresence.threshold.y * TILE_SIZE + TILE_SIZE / 2,
      );
      this.presenceState = { kind: 'outside' };
      this.sprite.setVisible(true);
    }
    this.follower.setPath(path, { preservePosition });
    this.preservePositionOnNextDispatch = false;
    this.walkClockMs = 0;
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
    this.destinationBuilding = undefined;
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
      this.walkClockMs += Math.max(0, deltaMs);
      const snapshot = this.follower.update(deltaMs);
      this.facing = snapshot.facing;
      this.sprite.setPosition(snapshot.position.x, snapshot.position.y).setTexture(
        this.skin.sheet,
        agentFrameIndex(this.skin, this.facing, this.skin.walkRows[Math.floor(this.walkClockMs / WALK_FRAME_MS) % this.skin.walkRows.length]),
      );
      if (snapshot.arrived) this.arrive();
    }
    this.actions.update();
  }

  destroy(): void {
    this.arriveCallback = undefined;
    this.moving = false;
    this.currentPath = [];
    this.destinationBuilding = undefined;
    this.preservePositionOnNextDispatch = false;
    this.walkClockMs = 0;
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
    if (this.destinationBuilding) {
      this.presenceState = {
        kind: 'inside',
        buildingId: this.destinationBuilding.buildingId,
        threshold: { ...this.destinationBuilding.threshold },
      };
      this.sprite.setVisible(false);
    }
    this.destinationBuilding = undefined;
    const callback = this.arriveCallback;
    this.arriveCallback = undefined;
    callback?.();
  }

  private dispatchInside(
    event: AgentWorldEvent,
    assignment: StationAssignment,
    route: BehaviorRoute,
    onArrive: (() => void) | undefined,
    travelPlan: AgentTravelPlan,
  ): boolean {
    if (
      this.presenceState.kind !== 'inside' ||
      !travelPlan.destinationBuilding ||
      travelPlan.destinationBuilding.buildingId !== this.presenceState.buildingId
    ) return false;

    this.actions.stop();
    this.currentEvent = event;
    this.currentRoute = route;
    this.currentAssignment = assignment;
    this.currentPath = [];
    this.arriveCallback = onArrive;
    this.destinationBuilding = undefined;
    this.moving = false;
    this.preservePositionOnNextDispatch = false;
    this.arrive();
    return true;
  }
}

import type { Facing, GridPoint } from '../world/types';

export interface PixelPoint { x: number; y: number }
export interface FollowerSnapshot { position: PixelPoint; facing: Facing; moving: boolean; arrived: boolean }
export interface SetPathOptions { preservePosition?: boolean }

export class PathFollower {
  private waypoints: PixelPoint[] = [];
  private index = 0;
  private position: PixelPoint = { x: 0, y: 0 };
  private facing: Facing = 'down';

  constructor(private readonly tileSize: number, private readonly speedPixelsPerSecond: number) {}

  setPosition(position: PixelPoint): void {
    this.position = { ...position };
  }

  setPath(path: GridPoint[], options: SetPathOptions = {}): void {
    this.waypoints = path.map((point) => ({
      x: point.x * this.tileSize + this.tileSize / 2,
      y: point.y * this.tileSize + this.tileSize / 2,
    }));
    if (!options.preservePosition && this.waypoints.length > 0) this.position = { ...this.waypoints[0]! };
    this.index = options.preservePosition ? 0 : Math.min(1, this.waypoints.length);
  }

  update(deltaMs: number, allowed?: (from:PixelPoint,to:PixelPoint)=>boolean): FollowerSnapshot {
    let distanceLeft = this.speedPixelsPerSecond * Math.max(0, deltaMs) / 1000;
    while (distanceLeft > 0 && this.index < this.waypoints.length) {
      const target = this.waypoints[this.index]!;
      const dx = target.x - this.position.x;
      const dy = target.y - this.position.y;
      const distance = Math.abs(dx) + Math.abs(dy);
      if (distance === 0) {
        this.index += 1;
        continue;
      }
      this.facing = Math.abs(dx) > 0 ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const step = Math.min(distanceLeft, distance, allowed ? this.tileSize*.1 : Infinity);
      const candidate = {x:this.position.x+dx*step/distance,y:this.position.y+dy*step/distance};
      if(allowed&&!allowed(this.position,candidate))return {position:{...this.position},facing:this.facing,moving:false,arrived:false};
      if(step < Math.min(distanceLeft,distance)) {this.position=candidate;distanceLeft-=step;continue;}
      if (distanceLeft >= distance) {
        this.position = { ...target };
        this.index += 1;
        distanceLeft -= distance;
        // Carry remaining distance around corners: turns must not lose one frame of travel.
      } else {
        const ratio = distanceLeft / distance;
        this.position = { x: this.position.x + dx * ratio, y: this.position.y + dy * ratio };
        distanceLeft = 0;
      }
    }
    const arrived = this.index >= this.waypoints.length;
    return { position: { ...this.position }, facing: this.facing, moving: !arrived, arrived };
  }
}

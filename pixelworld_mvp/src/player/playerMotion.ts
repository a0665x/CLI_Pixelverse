export interface PlayerPoint { x: number; y: number }
/** Small swept steps keep held keys from tunnelling through banks or furniture. */
export function movePlayer(point: PlayerPoint, dx: number, dy: number, distance: number,
  allowed: (point: PlayerPoint) => boolean): PlayerPoint {
  const magnitude = Math.hypot(dx,dy);
  if (!magnitude) return { ...point };
  const steps = Math.max(1,Math.ceil(distance / .1));
  const sx = dx / magnitude * distance / steps, sy = dy / magnitude * distance / steps;
  const result = { ...point };
  for (let i=0;i<steps;i++) {
    if (allowed({x:result.x+sx,y:result.y})) result.x+=sx;
    if (allowed({x:result.x,y:result.y+sy})) result.y+=sy;
  }
  return result;
}
export function choiceIndex(index: number, direction: number): number { return (index + direction + 3) % 3; }
export function clearSight(a: PlayerPoint,b: PlayerPoint,allowed:(p:PlayerPoint)=>boolean): boolean {
  const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)*6));
  for(let i=1;i<count;i++) if(!allowed({x:a.x+(b.x-a.x)*i/count,y:a.y+(b.y-a.y)*i/count})) return false;
  return true;
}

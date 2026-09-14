import type Phaser from 'phaser';
import type { GridPoint, WorldDefinition } from '../world/types';

export const PATH_TEXTURE = 'village-continuous-paths';
const key = ({ x, y }: GridPoint) => `${x},${y}`;

/** Paint the connected network once, then expose native tile frames for depth sorting.
 * Shared edge midpoints prevent atlas seams; quadratic bends replace square elbows.
 */
export function installVillagePaths(scene: Phaser.Scene, world: WorldDefinition, points: GridPoint[]): void {
  if (!scene.textures?.createCanvas) return;
  if (scene.textures.exists(PATH_TEXTURE)) scene.textures.remove(PATH_TEXTURE);
  const texture = scene.textures.createCanvas(PATH_TEXTURE, world.width * 16, world.height * 16);
  if (!texture) return;
  const c = texture.context;
  const roads = new Set([...points.map(key), ...world.buildings.map(b => key(b.entrance.threshold))]);
  const plazas = new Set(world.terrain.filter(t => t.kind === 'plaza').map(t => key(t.bounds)));
  const directions = [[0,-1],[1,0],[0,1],[-1,0]] as const;
  const neighbors = (p: GridPoint) => directions.map(([dx,dy]) => ({x:p.x+dx,y:p.y+dy})).filter(p => roads.has(key(p)));
  const vertices = new Map([...roads].map(k => { const [x,y] = k.split(',').map(Number); return [k,{x:x!,y:y!}] as const; }));
  const visited = new Set<string>();
  const trails: GridPoint[][] = [];
  const edgeKey = (a: GridPoint,b: GridPoint) => [key(a),key(b)].sort().join('|');
  for (const start of vertices.values()) {
    if (neighbors(start).length === 2) continue;
    for (const next of neighbors(start)) {
      if (visited.has(edgeKey(start,next))) continue;
      const trail = [start]; let previous = start, current = next;
      while (true) {
        visited.add(edgeKey(previous,current)); trail.push(current);
        const adjacent = neighbors(current);
        if (adjacent.length !== 2) break;
        const following = adjacent.find(p => key(p) !== key(previous))!;
        if (visited.has(edgeKey(current,following))) break;
        previous = current; current = following;
      }
      trails.push(trail.filter((p,i) => i === 0 || i === trail.length-1 ||
        (p.x-trail[i-1]!.x !== trail[i+1]!.x-p.x || p.y-trail[i-1]!.y !== trail[i+1]!.y-p.y)));
    }
  }
  c.lineCap = 'round'; c.lineJoin = 'round';
  // Round across several cells, so the bend reads as a trail rather than a tile elbow.
  for (const [width,color] of [[14,'#99965c'],[11,'#c1ae72']] as const) {
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = width;
    for (const trail of trails) {
      c.beginPath(); c.moveTo(trail[0]!.x*16+8,trail[0]!.y*16+8);
      for (let i=1;i<trail.length-1;i++) {
        const a=trail[i-1]!,p=trail[i]!,b=trail[i+1]!;
        const before=Math.hypot(p.x-a.x,p.y-a.y),after=Math.hypot(b.x-p.x,b.y-p.y);
        const r=Math.min(1.5,before/2,after/2);
        c.lineTo((p.x-(p.x-a.x)/before*r)*16+8,(p.y-(p.y-a.y)/before*r)*16+8);
        c.quadraticCurveTo(p.x*16+8,p.y*16+8,(p.x+(b.x-p.x)/after*r)*16+8,(p.y+(b.y-p.y)/after*r)*16+8);
      }
      const last=trail.at(-1)!; c.lineTo(last.x*16+8,last.y*16+8); c.stroke();
    }
    // The gathering clearing fills the dense plaza independently of trail tracing.
    for (const p of points) if (plazas.has(key(p))) {
      c.beginPath(); c.arc(p.x*16+8,p.y*16+8,width/2+6,0,Math.PI*2); c.fill();
    }
  }
  // Sparse, world-positioned grain never introduces a repeated tile border.
  c.globalCompositeOperation = 'source-atop';
  for (let y = 0; y < world.height * 16; y += 3) {
    for (let x = 0; x < world.width * 16; x += 3) {
      const n = (x * 31 + y * 17) % 29;
      if (n > 2) continue;
      c.fillStyle = n === 0 ? '#b7a26a' : '#cbb980'; c.fillRect(x,y,1,1);
    }
  }
  c.globalCompositeOperation = 'source-over';
  for (let y=0;y<world.height;y++) for (let x=0;x<world.width;x++) texture.add(y * world.width + x, 0, x * 16, y * 16, 16, 16);
  texture.refresh();
}

import type Phaser from 'phaser';
import type { GridPoint } from '../world/types';

/** Exposed bank bits: north, east, south, west. No decorative atlas fragments. */
export function riverBankMask({ x, y }: GridPoint, water: Set<string>): number {
  return [[0, -1], [1, 0], [0, 1], [-1, 0]].reduce((mask, [dx, dy], bit) =>
    mask | (water.has(`${x + dx!},${y + dy!}`) ? 0 : 1 << bit), 0);
}
export const riverTexture = (mask: number): string => `village-stream-${mask}`;
export const bridgeTexture = (end: 'left' | 'middle' | 'right'): string => `village-footbridge-${end}`;

/** Native 16px tiles retain continuous water beneath the transparent bridge. */
export function installRiverArt(scene: Phaser.Scene): void {
  if (!scene.textures?.createCanvas) return;
  for (let mask = 0; mask < 16; mask++) {
    if (scene.textures.exists(riverTexture(mask))) continue;
    const texture = scene.textures.createCanvas(riverTexture(mask), 16, 16);
    if (!texture) continue;
    const c = texture.context;
    c.fillStyle = '#498d9a'; c.fillRect(0, 0, 16, 16);
    const edges = [[0, 0, 16, 3], [13, 0, 3, 16], [0, 13, 16, 3], [0, 0, 3, 16]];
    edges.forEach(([x, y, w, h], bit) => {
      if (!(mask & (1 << bit))) return;
      c.fillStyle = '#8bb8a0'; c.fillRect(x!, y!, w!, h!);
      c.fillStyle = '#b8bc81';
      c.fillRect(bit === 1 ? 15 : x!, bit === 2 ? 15 : y!, bit % 2 ? 1 : 16, bit % 2 ? 16 : 1);
    });
    c.fillStyle = '#68a9b0'; c.fillRect(5, 5, 4, 1); c.fillRect(10, 12, 3, 1);
    texture.refresh();
  }
  for (const end of ['left', 'middle', 'right'] as const) {
    if (scene.textures.exists(bridgeTexture(end))) continue;
    const texture = scene.textures.createCanvas(bridgeTexture(end), 16, 16);
    if (!texture) continue;
    const c = texture.context;
    c.fillStyle = '#304e50'; c.fillRect(0, 4, 16, 12);
    for (let x = 0; x < 16; x += 4) {
      c.fillStyle = x % 8 ? '#ba9159' : '#cba26a'; c.fillRect(x, 3, 3, 10);
      c.fillStyle = '#e0bb7e'; c.fillRect(x, 3, 1, 9);
    }
    c.fillStyle = '#67492f'; c.fillRect(0, 1, 16, 2); c.fillRect(0, 12, 16, 2);
    c.fillStyle = '#e0bb7e'; c.fillRect(0, 1, 16, 1); c.fillRect(0, 12, 16, 1);
    if (end !== 'middle') {
      const x = end === 'left' ? 1 : 13;
      c.fillStyle = '#624831'; c.fillRect(x, 0, 2, 5); c.fillRect(x, 11, 2, 5);
      c.fillStyle = '#efc98c'; c.fillRect(x, 0, 2, 1); c.fillRect(x, 11, 2, 1);
    }
    texture.refresh();
  }
}
